import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sharedEntry = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig({
  root: __dirname,
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
  resolve: {
    alias: {
      '@pvp-games/shared': sharedEntry,
    },
  },
});
