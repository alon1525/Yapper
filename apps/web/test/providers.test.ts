import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WrittenDeckSchema } from '@wrapped/core';
import { failureBody, generateStructured } from '../lib/generate';
import { activeProvider, modelConfigured, modelFor, modelMissingMessage } from '../lib/providers';

/**
 * The provider seam.
 *
 * This product spent its whole life talking to one vendor, and every route
 * reached for that vendor's SDK directly. These tests are about the thing that
 * replaced it: a request going out in the right shape, and — more importantly —
 * every *failure* still arriving back as the same status and the same sentence
 * a reader would have seen before. A provider swap that quietly turns a refusal
 * into a 502 has changed the product, not the plumbing.
 *
 * Run against a stub that speaks chat-completions rather than against a real
 * host: the contract worth pinning is the wire format and the mapping, and
 * neither needs anybody's money to check.
 */

const PORT = 4611;
const BASE = `http://127.0.0.1:${PORT}/v1`;

/** What the stub should do next, set per test. */
let mode: 'ok' | 'refusal' | 'ratelimit' | 'http-error' | 'repair' | 'always-invalid' = 'ok';
let requests: { url: string; auth?: string; body: Record<string, any> }[] = [];

const DECK = { slides: [], dictionary: [] };
/** Valid JSON, wrong enum — the case only zod catches, which is the repair's job. */
const INVALID_DECK = {
  slides: [{ id: 's', type: 'not-a-real-type', format: 'profile', title: 'Person A' }],
  dictionary: [],
};

let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      requests.push({
        url: req.url ?? '',
        auth: req.headers.authorization,
        body: JSON.parse(raw || '{}'),
      });

      if (mode === 'ratelimit') return res.writeHead(429).end('{}');
      if (mode === 'http-error') {
        return res
          .writeHead(404, { 'Content-Type': 'application/json' })
          .end('{"error":{"message":"The model does not exist"}}');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (mode === 'refusal') {
        return res.end(JSON.stringify({ choices: [{ message: { refusal: 'No.' } }] }));
      }
      // The repair case is invalid once, then correct — so a passing test proves
      // the second turn happened rather than that the first one got lucky.
      const payload =
        mode === 'always-invalid' || (mode === 'repair' && requests.length === 1)
          ? INVALID_DECK
          : DECK;
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  requests = [];
  mode = 'ok';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.WRAPPED_PROVIDER = 'openai';
  process.env.WRAPPED_OPENAI_BASE_URL = BASE;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WRAPPED_DEBUG_ERRORS;
  for (const v of ['WRAPPED_AI_MODEL', 'WRAPPED_DETECTIVE_MODEL', 'WRAPPED_WRITER_MODEL', 'WRAPPED_PREMIUM_MODEL']) {
    delete process.env[v];
  }
});

const generate = () =>
  generateStructured({
    model: 'some-model-id',
    system: 'you write slides',
    prompt: 'write the deck',
    schema: WrittenDeckSchema,
    maxTokens: 4000,
    stage: 'write',
  });

describe('provider resolution', () => {
  it('uses whichever key is present', () => {
    delete process.env.WRAPPED_PROVIDER;
    expect(activeProvider()).toBe('openai');

    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(activeProvider()).toBe('anthropic');
  });

  it('lets the explicit setting break a tie', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.WRAPPED_PROVIDER = 'openai';
    expect(activeProvider()).toBe('openai');
  });

  it('reports nothing configured when the chosen provider has no key', () => {
    // Naming a provider you hold no key for is a misconfiguration, not a
    // silent fall back to the other one — that would spend money at a vendor
    // the operator did not choose.
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.WRAPPED_PROVIDER = 'openai';

    expect(activeProvider()).toBeNull();
    expect(modelConfigured()).toBe(false);
  });

  it('knows when no key is set at all', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.WRAPPED_PROVIDER;
    expect(modelConfigured()).toBe(false);
  });
});

describe('model ids belong to one vendor', () => {
  it('refuses to guess a model id on the provider it has no default for', () => {
    // The trap this replaced: every stage defaulted to a Claude id, so an
    // OpenAI-configured server posted `claude-opus-5` to chat completions, got
    // a 404, and showed the reader "Could not build your report" — on the free
    // slide, before anybody had paid anything.
    delete process.env.WRAPPED_WRITER_MODEL;
    expect(modelFor('write')).toBeNull();
    expect(modelMissingMessage('write')).toContain('WRAPPED_WRITER_MODEL');
  });

  it('keeps the default on the provider where that id is correct', () => {
    delete process.env.WRAPPED_WRITER_MODEL;
    delete process.env.WRAPPED_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    expect(modelFor('write')).toBe('claude-opus-5');
  });

  it('uses whatever id the operator set, whoever the provider is', () => {
    process.env.WRAPPED_WRITER_MODEL = 'some-other-model';
    expect(modelFor('write')).toBe('some-other-model');
  });

  it('keeps each stage on its own setting', () => {
    process.env.WRAPPED_WRITER_MODEL = 'writer-model';
    process.env.WRAPPED_AI_MODEL = 'preview-model';

    expect(modelFor('write')).toBe('writer-model');
    expect(modelFor('preview')).toBe('preview-model');
    // Unset, and no Anthropic default available on this provider.
    delete process.env.WRAPPED_DETECTIVE_MODEL;
    expect(modelFor('detective')).toBeNull();
  });
});

describe('the OpenAI-compatible request', () => {
  it('posts chat completions to the configured host, with the schema attached', async () => {
    const result = await generate();
    expect(result.ok).toBe(true);

    const sent = requests[0]!;
    expect(sent.url).toBe('/v1/chat/completions');
    expect(sent.auth).toBe('Bearer sk-test');
    expect(sent.body.model).toBe('some-model-id');
    expect(sent.body.response_format.type).toBe('json_schema');
    // Strict, so the host enforces the schema rather than suggesting it. Loose
    // mode is not a weaker version of this — nothing is checked at all, and the
    // first thing to notice is zod, one paid call later.
    expect(sent.body.response_format.json_schema.strict).toBe(true);
    expect(sent.body.response_format.json_schema.schema.properties.slides).toBeDefined();
  });

  it('sends the system prompt as its own turn', () => {
    // Anthropic takes `system` as a top-level field and this format does not.
    // Folding it into the user turn would quietly change every prompt in the
    // product, which is the sort of thing that shows up as "the writing got
    // worse" and never as an error.
    return generate().then(() => {
      const messages = requests[0]!.body.messages;
      expect(messages[0]).toEqual({ role: 'system', content: 'you write slides' });
      expect(messages[1]).toEqual({ role: 'user', content: 'write the deck' });
    });
  });
});

describe('failures keep their meaning', () => {
  it('turns a refusal into the reader-facing 422, not an error', async () => {
    mode = 'refusal';
    const result = await generate();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.error).toContain('declined to write about this chat');
  });

  it('passes a rate limit through as 429', async () => {
    mode = 'ratelimit';
    const result = await generate();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
  });

  it('does not leak the vendor error to the reader', async () => {
    // The host's own words go to the log, where an operator pointing this at a
    // new provider needs them. What comes back to the browser is the same
    // sentence every other failure produces.
    mode = 'http-error';
    const result = await generate();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.error).toBe('Could not build your report.');
  });
});

describe('the operator switch', () => {
  /**
   * Four different faults produce the same 502 and the same sentence: an
   * unknown model id, a refused key, a reply that was cut off, and a reply that
   * failed validation twice. Telling them apart meant reading a serverless log.
   * This is the switch that puts the provider's own words in the response
   * instead — off by default, because they are nobody else's business.
   */

  it('carries the vendor error when the operator asked for it', async () => {
    process.env.WRAPPED_DEBUG_ERRORS = '1';
    mode = 'http-error';
    const result = await generate();

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const body = failureBody(result);
    expect(body.error).toBe('Could not build your report.');
    expect(body.detail).toContain('The model does not exist');
  });

  it('reports both turns, because the difference between them is the diagnosis', async () => {
    process.env.WRAPPED_DEBUG_ERRORS = '1';
    // Invalid every time, so both turns fail validation — the case that used to
    // reach the browser as a bare "Could not build your report."
    mode = 'always-invalid';
    const result = await generate();

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // A first turn that was cut off and a repair that came back with a bad enum
    // are a token ceiling; two bad enums are a schema problem. Reporting only
    // the second turn cannot tell those apart.
    const body = failureBody(result);
    expect(body.detail).toContain('first:');
    expect(body.detail).toContain('repair:');
    expect(body.detail).toContain('slides.0.type');
  });

  it('stays silent by default', async () => {
    mode = 'http-error';
    const result = await generate();

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // The detail exists on the result — the log needs it — and does not reach
    // the body. A reader on a normal deployment sees exactly what they saw
    // before this switch existed.
    expect(result.detail).toBeDefined();
    expect(failureBody(result)).toEqual({ error: 'Could not build your report.' });
  });

  it('bounds what it will echo', () => {
    process.env.WRAPPED_DEBUG_ERRORS = '1';
    const body = failureBody({ error: 'Could not build your report.', detail: 'x'.repeat(5000) });
    expect(body.detail).toHaveLength(600);
  });
});

describe('the repair turn', () => {
  it('shows the model its own reply and the validation errors', async () => {
    mode = 'repair';
    const result = await generate();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repaired).toBe(true);
    expect(requests).toHaveLength(2);

    const second = requests[1]!.body.messages;
    expect(second.at(-2).role).toBe('assistant');
    expect(second.at(-1).content).toContain('slides.0.type');
  });
});
