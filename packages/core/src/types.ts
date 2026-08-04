/**
 * Core data model. Deliberately free of DOM/Node types so this package can be
 * imported by a future Expo app as-is.
 */

export type MessageKind = 'text' | 'attachment' | 'system' | 'deleted';

export type AttachmentType =
  | 'image'
  | 'video'
  | 'audio'
  | 'sticker'
  | 'gif'
  | 'document'
  | 'contact'
  | 'unknown';

export interface Message {
  /** Index into the message array. Stable for the lifetime of a parse. */
  id: number;

  /**
   * Ordering/gap arithmetic ONLY.
   *
   * WhatsApp writes timestamps in the exporter's local time with no UTC offset,
   * so there is no correct absolute instant to recover. We anchor to UTC purely
   * so that differences are exact and machine-independent. Never call
   * `getHours()`/`getDay()`/`getMonth()` on this — those read the *runtime's*
   * timezone and will silently shift every calendar-facing statistic. Use the
   * `local*` fields below instead.
   */
  ts: Date;

  /** Calendar fields lifted verbatim from the export text. Timezone-proof. */
  localYear: number;
  /** 1-12 */
  localMonth: number;
  /** 1-31 */
  localDay: number;
  /** 0=Sunday .. 6=Saturday, derived from the local Y/M/D triple. */
  localWeekday: number;
  /** 0-23, already normalised out of AM/PM. */
  localHour: number;
  /** 0-59 */
  localMinute: number;

  /** null for system messages, which belong to no participant. */
  sender: string | null;
  body: string;
  kind: MessageKind;
  attachmentType?: AttachmentType;

  /** 1-indexed line in the source file where this message's header sits. */
  lineStart: number;
  /** Number of source lines this message occupies (1 + continuation lines). */
  lineCount: number;
}

export type ExportFormat = 'ios' | 'android';
export type DateOrder = 'DMY' | 'MDY';

/**
 * How confident we are in {@link ParseResult.dateOrder}.
 * - `certain`   — a day-part > 12 appeared, which is unambiguous.
 * - `inferred`  — resolved by picking the ordering that keeps messages
 *                 chronologically monotonic.
 * - `assumed`   — no evidence either way; fell back to the default.
 */
export type DateOrderConfidence = 'certain' | 'inferred' | 'assumed';

/**
 * Line accounting. The invariant `headerLines + continuationLines + orphanLines
 * === totalLines` must hold for every parse — it is the check that actually
 * catches parser bugs, since WhatsApp exposes no message count to compare with.
 */
export interface ParseDiagnostics {
  totalLines: number;
  /** Lines that opened a new message (system messages included). */
  headerLines: number;
  /** Lines folded into the preceding message, blank lines within one included. */
  continuationLines: number;
  /** Lines before the first valid header. Should be 0; anything else is a bug. */
  orphanLines: number;
  /** Subset of headerLines that produced a `system` message. */
  systemMessages: number;
}

export interface ParseWarning {
  code:
    | 'orphan-lines'
    | 'ambiguous-date-order'
    | 'conflicting-date-order'
    | 'no-messages'
    | 'suspicious-sender';
  message: string;
  /** 1-indexed source lines, capped to a handful of examples. */
  lines?: number[];
}

export interface ParseResult {
  messages: Message[];
  /** Distinct senders, ordered by message count descending. */
  participants: string[];
  format: ExportFormat;
  dateOrder: DateOrder;
  dateOrderConfidence: DateOrderConfidence;
  diagnostics: ParseDiagnostics;
  warnings: ParseWarning[];
}

export interface ParseOptions {
  /**
   * Force the date ordering instead of detecting it. Surfaced in the UI as a
   * toggle for the case where an export is genuinely ambiguous (no day > 12).
   */
  dateOrder?: DateOrder;
  /** Fallback when detection finds no evidence at all. Defaults to 'DMY'. */
  defaultDateOrder?: DateOrder;
  /** Invoked with 0..1 progress so the worker can drive a real progress bar. */
  onProgress?: (fraction: number) => void;
}
