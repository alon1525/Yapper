'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatStats } from '@wrapped/core';
import type { Brief, ReportLanguage, ReportTone } from './brief';
import type { Preview } from './useAiPreview';
import type { ReportDeck } from './useReport';

/**
 * Reports kept on this device.
 *
 * The product's promise is that nothing is stored, and that is still true of
 * the server: there is no account and no database, and a finished report is
 * returned to the browser and forgotten. What this module adds is the one
 * place a report can live if the reader asks for it — their own browser's
 * storage, on this device, in IndexedDB. Nothing in this file makes a request.
 *
 * What is kept is what the deck needs to play again: the statistics, the
 * written slides with names already restored, the free story if it was
 * written, and the brief minus its photos. Not the export, and not a message
 * beyond the ones quoted on a slide. A saved report can be reopened; the paid
 * pipeline cannot be re-run from it, because the chat it would read is not
 * there. Photos are object URLs pointing at bytes the browser has long since
 * released, so a reopened report draws the animals instead.
 *
 * IndexedDB rather than localStorage: a report is a few hundred kilobytes of
 * nested data, localStorage is a five-megabyte string bag, and the structured
 * clone keeps the shape without a serialisation step that can drift from the
 * types.
 */

export const SAVED_REPORT_VERSION = 1;

/** The brief without its photos — the only part of it that can be stored. */
export interface SavedBrief {
  language: ReportLanguage;
  kind: string;
  tone: ReportTone;
  notes: string;
}

export interface SavedReport {
  id: string;
  version: typeof SAVED_REPORT_VERSION;
  /** ISO timestamp of the save. */
  savedAt: string;
  fileName: string;
  stats: ChatStats;
  brief: SavedBrief;
  /** The paid report, when it had been written before the save. */
  deck: ReportDeck | null;
  /** The free story, when it had been written before the save. */
  preview: Preview | null;
}

/** What the front page lists: everything about a report but its weight. */
export interface SavedReportSummary {
  id: string;
  savedAt: string;
  groupName: string | null;
  totalMessages: number;
  spanLabel: string;
  people: number;
  language: ReportLanguage;
  hasDeck: boolean;
  hasPreview: boolean;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The record to store. Pure, so the shape can be tested without a browser:
 * photos are left out by construction rather than by remembering to delete
 * them, which is the same reasoning the payload types use for the same field.
 */
export function buildSavedReport(input: {
  stats: ChatStats;
  brief: Brief;
  fileName: string;
  deck: ReportDeck | null;
  preview: Preview | null;
  /** Reusing an id overwrites that record — how a save is updated in place. */
  id?: string;
  now?: Date;
}): SavedReport {
  const { stats, brief, fileName, deck, preview } = input;
  return {
    id: input.id ?? randomId(),
    version: SAVED_REPORT_VERSION,
    savedAt: (input.now ?? new Date()).toISOString(),
    fileName,
    stats,
    brief: {
      language: brief.language,
      kind: brief.kind,
      tone: brief.tone ?? 'roast',
      notes: brief.notes,
    },
    deck,
    preview,
  };
}

export function summarize(report: SavedReport): SavedReportSummary {
  return {
    id: report.id,
    savedAt: report.savedAt,
    groupName: report.stats.groupName,
    totalMessages: report.stats.totalMessages,
    spanLabel: report.stats.span.label,
    people: report.stats.people.length,
    language: report.brief.language,
    hasDeck: report.deck !== null,
    hasPreview: report.preview !== null,
  };
}

/** A brief the deck can read, from a saved one. Faces fall back to animals. */
export function briefFromSaved(report: SavedReport): Brief {
  return { ...report.brief, photos: {}, groupPhotos: {} };
}

/* ------------------------------------------------------------------ *
 * IndexedDB
 * ------------------------------------------------------------------ */

const DB_NAME = 'yapped';
const DB_VERSION = 1;
const STORE = 'reports';

/** False in a private window on some browsers, and in environments without a DOM. */
export function storageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  if (!storageAvailable()) return Promise.reject(new Error('Storage is not available here.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open storage.'));
    // Another tab holds an older version open. Rare, and the honest answer
    // is a failure the caller can report rather than a hang.
    request.onblocked = () => reject(new Error('Storage is in use by another tab.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const result = await work(tx.objectStore(STORE));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Storage transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
    });
    return result;
  } finally {
    db.close();
  }
}

/** Newest first. Reads whole records, which is fine for the handful anyone keeps. */
export async function listSavedReports(): Promise<SavedReportSummary[]> {
  const all = await withStore('readonly', (store) => settle(store.getAll() as IDBRequest<SavedReport[]>));
  return all
    .filter((r) => r && r.version === SAVED_REPORT_VERSION)
    .map(summarize)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function loadSavedReport(id: string): Promise<SavedReport | null> {
  const record = await withStore('readonly', (store) =>
    settle(store.get(id) as IDBRequest<SavedReport | undefined>),
  );
  return record && record.version === SAVED_REPORT_VERSION ? record : null;
}

/** `put`, so saving again under the same id updates rather than duplicates. */
export async function saveReport(report: SavedReport): Promise<void> {
  await withStore('readwrite', (store) => settle(store.put(report)));
}

export async function deleteSavedReport(id: string): Promise<void> {
  await withStore('readwrite', (store) => settle(store.delete(id)));
}

/* ------------------------------------------------------------------ *
 * The hook the front page reads
 * ------------------------------------------------------------------ */

export function useSavedReports() {
  const [reports, setReports] = useState<SavedReportSummary[]>([]);
  /* False until the first read has come back, so the front page does not
     flash an empty section and then fill it. */
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!storageAvailable()) {
      setReports([]);
      setReady(true);
      return;
    }
    try {
      setReports(await listSavedReports());
    } catch {
      // A blocked or broken store is the same as an empty one to the reader.
      setReports([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSavedReport(id);
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const open = useCallback(async (id: string): Promise<SavedReport | null> => {
    try {
      return await loadSavedReport(id);
    } catch {
      return null;
    }
  }, []);

  return { reports, ready, refresh, remove, open };
}
