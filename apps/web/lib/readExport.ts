import { strFromU8, unzipSync } from 'fflate';

export interface ExportFile {
  text: string;
  /** Name of the .txt inside the archive, which carries the group name. */
  fileName: string;
  /** Media files sitting alongside the chat, counted but never read in v1. */
  mediaCount: number;
}

const MAX_BYTES = 400 * 1024 * 1024;

/**
 * Turns whatever the user dropped into chat text.
 *
 * WhatsApp offers two exports and people pick either without noticing: a bare
 * `.txt`, or a `.zip` containing that same `.txt` plus every photo, video and
 * contact card. Both land here.
 *
 * Runs entirely in the browser. Nothing in this file makes a network request —
 * the archive is expanded in memory and only the chat text is kept.
 */
export async function readExportFile(file: File): Promise<ExportFile> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      'That export is over 400 MB. Export the chat again without media and try that instead.',
    );
  }

  const isZip =
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed';

  if (!isZip) {
    const text = await file.text();
    return { text, fileName: file.name, mediaCount: 0 };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Count every entry, but only decompress the .txt. A media export is mostly
  // photos and videos; inflating them would cost hundreds of megabytes of
  // memory to reach a file we already know is a few megabytes.
  let mediaCount = 0;
  const entries = unzipSync(bytes, {
    filter: (entry) => {
      const isText = entry.name.toLowerCase().endsWith('.txt');
      if (!isText && entry.size > 0) mediaCount++;
      return isText;
    },
  });

  const names = Object.keys(entries).filter((n) => !n.startsWith('__MACOSX'));
  if (names.length === 0) {
    throw new Error(
      'No chat file found inside that .zip. Make sure you exported the chat from WhatsApp.',
    );
  }

  // An archive can hold several .txt files; the chat is always the largest.
  const chatName = names.reduce((best, name) =>
    (entries[name]?.length ?? 0) > (entries[best]?.length ?? 0) ? name : best,
  );

  return {
    text: strFromU8(entries[chatName]!),
    fileName: chatName.split('/').pop() ?? chatName,
    mediaCount,
  };
}
