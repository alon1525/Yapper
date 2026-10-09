import type { z } from 'zod';

/**
 * Make a reply fit the schema's budgets, without inventing anything.
 *
 * The schemas in this product carry two different kinds of rule, and only one
 * of them is a correctness rule. That a quote's `text` matches a real message is
 * checked in the browser against the reader's own transcript, and a claim that
 * fails it is thrown away. That a slide carries at most six stats is not that
 * kind of rule at all — it is a layout budget, chosen because a seventh stat
 * does not fit on a card nobody scrolls.
 *
 * Both were enforced the same way: by refusing the whole reply. That is the
 * right answer for the first kind and an expensive mistake for the second,
 * because the most costly call in the product had already been paid for by the
 * time the seventh stat arrived. A deck was discarded — after the detective pass
 * had run, after verification had passed — over a date string with a time on the
 * end of it.
 *
 * So the budgets are applied rather than asserted: an over-long array loses its
 * tail, an over-long string loses its end, and an entry too empty to render is
 * dropped. Everything a reader would actually notice — an invented quote, a
 * number that appears nowhere, a person who does not exist — is still checked
 * downstream by `verifySlideCopy`, which this cannot and does not weaken. It
 * only ever removes; it never fills a field in.
 *
 * The limits are read from the failure itself rather than restated here, so a
 * `.max()` that changes in the schema changes this too and the two cannot drift.
 */

/** How many times to re-validate after applying fixes. */
const MAX_ROUNDS = 6;

export type CoerceResult<T> =
  | { ok: true; value: T; coerced: boolean }
  | { ok: false; issues: z.core.$ZodIssue[] };

type Container = Record<string | number, unknown>;

/** The container holding the last path segment, or undefined if the path is gone. */
function parentOf(root: unknown, path: readonly PropertyKey[]): Container | undefined {
  let node: unknown = root;
  for (const segment of path.slice(0, -1)) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Container)[segment as string | number];
  }
  return node !== null && typeof node === 'object' ? (node as Container) : undefined;
}

/**
 * The array element a failure sits inside, as `[array, index]`.
 *
 * A quote whose text is empty cannot be shortened into validity — there is
 * nothing there. The repair is to drop the quote, which means finding the
 * nearest enclosing array rather than the field that failed.
 */
function enclosingElement(
  root: unknown,
  path: readonly PropertyKey[],
): [unknown[], number] | undefined {
  for (let i = path.length - 1; i >= 0; i--) {
    if (typeof path[i] !== 'number') continue;
    const holder = parentOf(root, path.slice(0, i + 1));
    if (Array.isArray(holder)) return [holder, path[i] as number];
  }
  return undefined;
}

/** Shorten an over-long array or string in place. Returns whether it did. */
function clamp(root: unknown, issue: z.core.$ZodIssue): boolean {
  if (issue.code !== 'too_big') return false;
  const maximum = Number(issue.maximum);
  if (!Number.isFinite(maximum) || issue.path.length === 0) return false;

  const parent = parentOf(root, issue.path);
  if (!parent) return false;
  const key = issue.path[issue.path.length - 1] as string | number;
  const target = parent[key];

  if (Array.isArray(target) && target.length > maximum) {
    parent[key] = target.slice(0, maximum);
    return true;
  }
  if (typeof target === 'string' && target.length > maximum) {
    parent[key] = target.slice(0, maximum);
    return true;
  }
  return false;
}

/**
 * One round of repair.
 *
 * Empty entries go before budgets, and the order is the whole point. An array
 * that is both too long and full of blanks gets clamped from the front, so
 * trimming first keeps the four empty quotes and throws away the real one
 * behind them — the reply survives validation having lost the only part worth
 * printing. Removing what cannot be rendered first means the budget then falls
 * on what is left.
 *
 * Drops all happen together. Every path in `issues` was measured against the
 * same unmodified tree, so they are valid simultaneously — but only until the
 * first splice, which is why the higher index goes first: it leaves the lower
 * ones pointing where they did. A slide with six empty quotes then costs one
 * round instead of six, and one-per-round was a limit on how badly the writer
 * could behave before a paid deck was discarded anyway.
 *
 * Clamps run in a later round rather than this one because they *replace* the
 * array they shorten, and a reference captured before that points at an array
 * nobody holds any more.
 */
function repair(root: unknown, issues: readonly z.core.$ZodIssue[]): boolean {
  const drops = new Map<unknown[], Set<number>>();
  for (const issue of issues) {
    if (issue.code !== 'too_small') continue;
    const found = enclosingElement(root, issue.path);
    if (!found) continue;
    const [array, index] = found;
    const indices = drops.get(array) ?? new Set<number>();
    indices.add(index);
    drops.set(array, indices);
  }

  if (drops.size > 0) {
    for (const [array, indices] of drops) {
      for (const index of [...indices].sort((a, b) => b - a)) array.splice(index, 1);
    }
    return true;
  }

  let changed = false;
  for (const issue of issues) changed = clamp(root, issue) || changed;
  return changed;
}

/**
 * Validate, and where the only thing wrong is a budget, fix it and validate
 * again. `coerced` says whether anything was touched, so a caller can log the
 * difference between a reply that fit and a reply that was made to fit.
 */
export function coerceToSchema<T extends z.ZodType>(
  schema: T,
  value: unknown,
): CoerceResult<z.infer<T>> {
  let current: unknown = structuredClone(value);
  let coerced = false;

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const result = schema.safeParse(current);
    if (result.success) return { ok: true, value: result.data, coerced };
    // Nothing here is a budget — the reply is wrong in a way that shortening it
    // cannot fix, and saying so is the honest answer.
    if (round === MAX_ROUNDS || !repair(current, result.error.issues)) {
      return { ok: false, issues: result.error.issues };
    }
    coerced = true;
  }

  return { ok: false, issues: [] };
}
