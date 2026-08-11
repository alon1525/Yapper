import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

/**
 * One structured generation, validated, with a repair attempt.
 *
 * `output_config` constrains the model's output to the schema, which handles the
 * ordinary case. What it does not handle is a reply that is valid JSON of the
 * right shape but wrong in a way only zod's refinements catch, or a truncated
 * reply from hitting the token ceiling on a long deck. Both produce a parse
 * failure at the end of the most expensive request in the product, and throwing
 * that away costs the full price again.
 *
 * So there is exactly one retry, and it is a *repair*: the model is shown its
 * own output and the validation errors, rather than being asked the original
 * question a second time. One, not three — past the second attempt the failure
 * is the prompt or the schema, and looping only spends money proving it.
 */

export interface GenerateOptions<T extends z.ZodType> {
  model: string;
  system: string;
  prompt: string;
  schema: T;
  maxTokens: number;
  /** Named in logs so a failure says which stage produced it. */
  stage: string;
}

export type GenerateResult<T> =
  | { ok: true; value: T; repaired: boolean }
  | { ok: false; status: number; error: string };

export async function generateStructured<T extends z.ZodType>(
  client: Anthropic,
  options: GenerateOptions<T>,
): Promise<GenerateResult<z.infer<T>>> {
  const { model, system, prompt, schema, maxTokens, stage } = options;

  const call = async (messages: Anthropic.Beta.BetaMessageParam[]) =>
    client.beta.messages.create({
      model,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      output_config: { format: zodOutputFormat(schema) },
      messages,
    });

  try {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
    const response = await call(messages);

    if (response.stop_reason === 'refusal') {
      return {
        ok: false,
        status: 422,
        error: 'The AI declined to write about this chat. Your statistics are all still here.',
      };
    }

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      return { ok: false, status: 502, error: 'Empty response from the model.' };
    }

    const first = parse(schema, text.text);
    if (first.ok) return { ok: true, value: first.value, repaired: false };

    console.warn(`[${stage}] output failed validation, attempting repair`, first.detail);

    // Show it its own reply and what was wrong with it. Asking the original
    // question again would re-roll the same generation for the same money; this
    // at least has new information in it.
    const repair = await call([
      ...messages,
      { role: 'assistant', content: text.text },
      {
        role: 'user',
        content:
          'That reply did not validate against the required schema. Fix exactly these problems ' +
          'and return the corrected object, changing nothing else:\n\n' +
          first.detail +
          '\n\nDo not add commentary. Return only the object.',
      },
    ]);

    const repairedText = repair.content.find((b) => b.type === 'text');
    if (!repairedText || repairedText.type !== 'text') {
      return { ok: false, status: 502, error: 'Empty response from the model.' };
    }

    const second = parse(schema, repairedText.text);
    if (second.ok) return { ok: true, value: second.value, repaired: true };

    console.error(`[${stage}] repair also failed validation`, second.detail);
    return { ok: false, status: 502, error: 'Could not build your report.' };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        status: 429,
        error: 'Too many requests right now. Try again in a minute.',
      };
    }
    console.error(`[${stage}] generation failed`, error);
    return { ok: false, status: 502, error: 'Could not build your report.' };
  }
}

function parse<T extends z.ZodType>(
  schema: T,
  raw: string,
): { ok: true; value: z.infer<T> } | { ok: false; detail: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // A truncated reply is the common cause, and it is worth naming: the repair
    // turn can close the object rather than guessing what went wrong.
    return { ok: false, detail: 'The reply was not valid JSON. It may have been cut off.' };
  }

  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    detail: result.error.issues
      .slice(0, 12)
      .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n'),
  };
}
