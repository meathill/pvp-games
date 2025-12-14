import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gamesEntry = fileURLToPath(new URL('../games/src/index.ts', import.meta.url));
const sharedEntry = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const duelSnakeReactEntry = fileURLToPath(new URL('../games/src/duel-snake/react.tsx', import.meta.url));

export default defineConfig({
  root: __dirname,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
    include: ['app/**/*.test.tsx', 'test/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@pvp-games/games': gamesEntry,
      '@pvp-games/shared': sharedEntry,
      '@pvp-games/games/duel-snake/react': duelSnakeReactEntry,
    },
  },
});
