import type { z } from 'zod';
import { coerceToSchema } from './coerce';
import { chat } from './providers';

/**
 * One structured generation, validated, with a repair attempt.
 *
 * The provider constrains output to the schema, which handles the ordinary
 * case. What it does not handle is a reply that is valid JSON of the right
 * shape but wrong in a way only zod's refinements catch, or a truncated reply
 * from hitting the token ceiling on a long deck. Both produce a parse failure
 * at the end of the most expensive request in the product, and throwing that
 * away costs the full price again.
 *
 * So there is exactly one retry, and it is a *repair*: the model is shown its
 * own output and the validation errors, rather than being asked the original
 * question a second time. One, not three — past the second attempt the failure
 * is the prompt or the schema, and looping only spends money proving it.
 *
 * The repair turn earns its keep more on some providers than others. Anthropic
 * constrains decoding to the schema; the OpenAI-compatible path asks for
 * `json_schema` in loose mode, because these schemas use `.default()` in a
 * dozen places and strict mode rejects that shape outright. Loose mode steers
 * rather than guarantees — so this is the stage that catches the difference,
 * and it is the reason swapping providers does not mean rewriting validation.
 */

export interface GenerateOptions<T extends z.ZodType> {
  model: string;
  system: string;
  prompt: string;
  schema: T;
  maxTokens: number;
  /** Named in logs so a failure says which stage produced it. */
  stage: string;
  /**
   * Applied to the parsed reply before validation, for the repairs that need to
   * know what the thing *is* — see `normalizeWrittenDeck`. Budgets are handled
   * generically by `coerceToSchema` and need nothing here.
   */
  normalize?: (raw: unknown) => unknown;
}

export type GenerateResult<T> =
  | { ok: true; value: T; repaired: boolean }
  /**
   * `error` is what the reader sees and is deliberately vague. `detail` is the
   * provider's own words — an unknown model id, a billing refusal, a reply that
   * was cut off — and is never shown unless the operator asks for it. See
   * `failureBody`.
   */
  | { ok: false; status: number; error: string; detail?: string };

const REFUSED = {
  ok: false as const,
  status: 422,
  error: 'The AI declined to write about this chat. Your statistics are all still here.',
};
const RATE_LIMITED = {
  ok: false as const,
  status: 429,
  error: 'Too many requests right now. Try again in a minute.',
};
const EMPTY = { ok: false as const, status: 502, error: 'Empty response from the model.' };
const FAILED = { ok: false as const, status: 502, error: 'Could not build your report.' };

export async function generateStructured<T extends z.ZodType>(
  options: GenerateOptions<T>,
): Promise<GenerateResult<z.infer<T>>> {
  const { model, system, prompt, schema, maxTokens, stage, normalize } = options;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: prompt },
  ];

  const first = await chat({ model, system, messages, schema, maxTokens });
  if (!first.ok) return failure(first, stage);

  const parsedFirst = parse(schema, first.text, normalize);
  if (parsedFirst.ok) {
    if (parsedFirst.coerced) console.warn(`[${stage}] reply trimmed to fit the schema's budgets`);
    return { ok: true, value: parsedFirst.value, repaired: false };
  }

  console.warn(`[${stage}] output failed validation, attempting repair`, parsedFirst.detail);

  // Show it its own reply and what was wrong with it. Asking the original
  // question again would re-roll the same generation for the same money; this
  // at least has new information in it.
  const second = await chat({
    model,
    system,
    schema,
    maxTokens,
    messages: [
      ...messages,
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content:
          'That reply did not validate against the required schema. Fix exactly these problems ' +
          'and return the corrected object, changing nothing else:\n\n' +
          parsedFirst.detail +
          '\n\nDo not add commentary. Return only the object.',
      },
    ],
  });
  if (!second.ok) return failure(second, stage);

  const parsedSecond = parse(schema, second.text, normalize);
  if (parsedSecond.ok) return { ok: true, value: parsedSecond.value, repaired: true };

  console.error(`[${stage}] repair also failed validation`, parsedSecond.detail);
  // Both turns, not just the second. The two failures usually differ, and the
  // difference is the diagnosis: a first turn that was cut off followed by a
  // repair with a bad enum is a token ceiling, not a schema problem, and
  // reporting only the repair would name the wrong cause.
  return {
    ...FAILED,
    detail: `first: ${parsedFirst.detail} | repair: ${parsedSecond.detail}`,
  };
}

function failure(result: { ok: false; kind: string; detail?: string }, stage: string) {
  if (result.kind === 'refusal') return REFUSED;
  if (result.kind === 'rate-limit') return RATE_LIMITED;
  if (result.kind === 'empty') return EMPTY;
  // The provider's own words. On a freshly pointed-at endpoint this is usually
  // "unknown model" or "unsupported response_format", and it is the only thing
  // that tells the operator which of the two it was.
  console.error(`[${stage}] generation failed`, result.detail);
  return { ...FAILED, detail: result.detail };
}

/**
 * The body a route sends when generation failed.
 *
 * The reader's message never changes. What changes is whether the provider's
 * explanation rides along, and that is off unless `WRAPPED_DEBUG_ERRORS=1` is
 * set on the deployment — because the detail can quote a model id, a billing
 * state, or a fragment of the reply, and none of that belongs in a response
 * anyone can reach.
 *
 * It exists because the alternative is reading a serverless log to find out
 * that an environment variable is wrong, and on a preview deployment that is
 * several minutes of authentication to recover one line of text.
 *
 * Read per call, not at module load: a constant would freeze whatever the
 * environment held when the module graph was built, which is exactly wrong for
 * a switch an operator flips on a deployment that is already misbehaving.
 */
export function failureBody(result: { error: string; detail?: string }): {
  error: string;
  detail?: string;
} {
  if (process.env.WRAPPED_DEBUG_ERRORS !== '1' || !result.detail) {
    return { error: result.error };
  }
  return { error: result.error, detail: result.detail.slice(0, 600) };
}

function parse<T extends z.ZodType>(
  schema: T,
  raw: string,
  normalize?: (raw: unknown) => unknown,
): { ok: true; value: z.infer<T>; coerced: boolean } | { ok: false; detail: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // A truncated reply is the common cause, and it is worth naming: the repair
    // turn can close the object rather than guessing what went wrong.
    return { ok: false, detail: 'The reply was not valid JSON. It may have been cut off.' };
  }

  if (normalize) json = normalize(json);

  // Budgets are applied, not asserted — see `coerceToSchema`. What reaches the
  // repair turn from here is a reply that is wrong in some way trimming cannot
  // fix, which is the only kind worth paying a second call to correct.
  const result = coerceToSchema(schema, json);
  if (result.ok) return { ok: true, value: result.value, coerced: result.coerced };

  return {
    ok: false,
    detail: result.issues
      .slice(0, 12)
      .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n'),
  };
}
