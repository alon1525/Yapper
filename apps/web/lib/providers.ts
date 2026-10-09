import { z } from 'zod';

/**
 * Which model house writes the report.
 *
 * The product was built against one vendor and every route reached for its SDK
 * directly, which made "use a different model" a change to four files and a
 * rewrite of the error handling in each. This module is the seam: it exposes
 * one shape — a system prompt, a user prompt, a schema, a token ceiling — and
 * hides whose API is on the other end.
 *
 * The OpenAI side deliberately speaks the *chat-completions* wire format over
 * plain `fetch` rather than through a vendor SDK. That is not laziness. Almost
 * every hosted model that is not Anthropic's exposes an OpenAI-compatible
 * endpoint, so one small client plus a configurable base URL reaches all of
 * them, and pinning an SDK would reach exactly one.
 */

export type Provider = 'anthropic' | 'openai';

/**
 * Which provider this deployment is configured for.
 *
 * `WRAPPED_PROVIDER` wins when set, so a server holding both keys is never
 * ambiguous. Otherwise whichever key is present decides, and Anthropic wins a
 * tie only because it is the one the prompts were tuned against.
 */
export function activeProvider(): Provider | null {
  const forced = process.env.WRAPPED_PROVIDER?.trim().toLowerCase();
  if (forced === 'openai' || forced === 'anthropic') {
    return hasKey(forced) ? forced : null;
  }
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

function hasKey(provider: Provider): boolean {
  return provider === 'anthropic'
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

/**
 * True when no model is reachable, whoever the vendor is.
 *
 * Every route used to test `ANTHROPIC_API_KEY` by name to decide whether to
 * serve a fixture or a 503. That test silently means "is Anthropic configured",
 * which stopped being the question this product asks.
 */
export function modelConfigured(): boolean {
  return activeProvider() !== null;
}

/**
 * Default host. Overridable for any vendor that speaks the same wire format.
 *
 * Read per call, not once at module load. A module-scope constant freezes
 * whatever the environment held at import time, which is silently wrong
 * anywhere config is applied after the module graph is built — and the failure
 * is the worst shape available: the request goes to the *default* host with
 * your key attached, rather than erroring.
 */
function openaiBase(): string {
  return process.env.WRAPPED_OPENAI_BASE_URL?.replace(/\/+$/, '') ?? 'https://api.openai.com/v1';
}

/** The four generations this product makes, each with its own model setting. */
export type Stage = 'preview' | 'detective' | 'write' | 'premium';

const STAGE_ENV: Record<Stage, string> = {
  preview: 'WRAPPED_AI_MODEL',
  detective: 'WRAPPED_DETECTIVE_MODEL',
  write: 'WRAPPED_WRITER_MODEL',
  premium: 'WRAPPED_PREMIUM_MODEL',
};

/**
 * Which model id this stage should ask for, or null when it cannot be known.
 *
 * The null case is the point. Model ids belong to one vendor — a Claude id
 * posted to a chat-completions host is a 404, and the reverse is a 404 too — so
 * there is no default that is right for both providers. Falling back to the
 * Anthropic id regardless would send every OpenAI-configured deployment
 * straight into a generic "Could not build your report", with the real cause
 * visible only in a server log, on the *free* slide that runs before anybody
 * has paid anything.
 *
 * So Anthropic keeps its default, because that id is correct there, and the
 * other provider has to be told. Refusing to guess is the whole feature.
 */
export function modelFor(stage: Stage): string | null {
  const explicit = process.env[STAGE_ENV[stage]]?.trim();
  if (explicit) return explicit;
  return activeProvider() === 'anthropic' ? 'claude-opus-5' : null;
}

/** What to tell an operator who has not set the model for this stage. */
export function modelMissingMessage(stage: Stage): string {
  return `Set ${STAGE_ENV[stage]} to a model id your provider recognises.`;
}

export interface ChatRequest {
  model: string;
  system: string;
  /** Alternating turns. The first is always the user's prompt. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  schema: z.ZodType;
  maxTokens: number;
}

export type ChatResult =
  /** The model's raw reply. Parsing and validation belong to the caller. */
  | { ok: true; text: string }
  /** The model declined outright. Distinct from a failure — it is an answer. */
  | { ok: false; kind: 'refusal' }
  | { ok: false; kind: 'rate-limit' }
  | { ok: false; kind: 'empty' }
  | { ok: false; kind: 'error'; detail: string };

/* ------------------------------------------------------------------ *
 * OpenAI-compatible chat completions
 * ------------------------------------------------------------------ */

/**
 * The schema, as the chat-completions API wants it.
 *
 * `strict: true`, which this spent a while believing was impossible. The reason
 * given was that these schemas lean on `.default()` and strict mode wants every
 * property in `required` — but `io: 'output'` is the view *after* parsing, and
 * a field with a default is always present there, so zod lists it as required
 * already. Only `.optional()` produces a genuinely absent key, and the one that
 * existed has been given a default instead.
 *
 * The distinction is worth the words, because loose mode is not a weaker
 * version of this — it is nothing. The schema goes down the wire as a
 * suggestion, and a writer that answers with a fourteenth slide format gets no
 * complaint from the host at all; the first thing that notices is zod, one
 * paid call later. `strictSchemas` in the tests keeps the door shut.
 */
function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'output', target: 'draft-2020-12' }) as Record<string, unknown>;
}

async function openaiChat(request: ChatRequest): Promise<ChatResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, kind: 'error', detail: 'OPENAI_API_KEY is not set.' };

  let response: Response;
  try {
    response = await fetch(`${openaiBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: request.model,
        max_completion_tokens: request.maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'report', strict: true, schema: jsonSchemaFor(request.schema) },
        },
        messages: [
          { role: 'system', content: request.system },
          ...request.messages,
        ],
      }),
    });
  } catch (error) {
    return { ok: false, kind: 'error', detail: `Could not reach ${openaiBase()}: ${String(error)}` };
  }

  if (response.status === 429) return { ok: false, kind: 'rate-limit' };
  if (!response.ok) {
    // The body carries the vendor's own explanation — an unknown model id, a
    // response_format the host does not support — and that is the single most
    // useful thing to have in the log when pointing this at a new provider.
    const body = await response.text().catch(() => '');
    return { ok: false, kind: 'error', detail: `${response.status} ${body.slice(0, 400)}` };
  }

  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  } | null;

  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) return { ok: false, kind: 'refusal' };

  const text = choice?.message?.content;
  if (!text) return { ok: false, kind: 'empty' };

  return { ok: true, text };
}

/* ------------------------------------------------------------------ *
 * Anthropic messages
 * ------------------------------------------------------------------ */

async function anthropicChat(request: ChatRequest): Promise<ChatResult> {
  // Imported here rather than at module scope so a deployment running on the
  // other provider does not load a vendor SDK it will never call.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      // Safety classifiers can decline a request outright; a group chat can
      // contain anything. Falling back keeps a real refusal rare.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: request.system,
      output_config: { format: zodOutputFormat(request.schema) },
      messages: request.messages,
    });

    if (response.stop_reason === 'refusal') return { ok: false, kind: 'refusal' };

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return { ok: false, kind: 'empty' };

    return { ok: true, text: text.text };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, kind: 'rate-limit' };
    return { ok: false, kind: 'error', detail: String(error) };
  }
}

/** One structured completion, from whichever provider is configured. */
export async function chat(request: ChatRequest): Promise<ChatResult> {
  const provider = activeProvider();
  if (!provider) return { ok: false, kind: 'error', detail: 'No model provider is configured.' };
  return provider === 'openai' ? openaiChat(request) : anthropicChat(request);
}
