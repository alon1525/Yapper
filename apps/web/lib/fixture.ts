import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A report written by hand, standing in for the model.
 *
 * The deck's copy is the product — the slides are only the frame it arrives in
 * — and judging whether a slide type earns its place needs real writing on a
 * real chat, not a deterministic sample that is honestly not trying to be
 * funny. This lets a report be authored as JSON and played through the actual
 * deck, so a character card that overflows or an awards list that reads flat is
 * visible before a key is ever attached.
 *
 * Deliberately scoped to the branch that already has no key: a fixture can only
 * ever replace a sample, never a generation someone paid for. `WRAPPED_FIXTURE_DIR`
 * is a local path, so nothing here is reachable on a deploy that does not set it.
 */
export function loadFixture(name: 'preview' | 'premium' | 'write'): unknown | null {
  const dir = process.env.WRAPPED_FIXTURE_DIR;
  if (!dir) return null;

  try {
    return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
  } catch (error) {
    // A fixture that is present but unreadable is a typo in a filename, not a
    // reason to fall through to the sample and leave someone wondering why
    // their writing did not appear.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[fixture] ${name}.json could not be read`, error);
    }
    return null;
  }
}
