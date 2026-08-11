import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The web workspace had no vitest config: its two existing suites import by
 * relative path, so nothing needed one.
 *
 * The pipeline suite imports the same modules the app does — `@/lib/...` — and
 * has to, because those modules import each other that way. Without the alias
 * here, a test either cannot load them or has to be written against a different
 * module graph than the one that ships, which is the kind of test that passes
 * while production is broken.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
