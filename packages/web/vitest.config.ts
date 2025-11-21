import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    dir: 'src',
    environmentMatchGlobs: [
      ['**/vite-config.test.ts', 'node'],
      ['**/tailwind-config.test.ts', 'node']
    ],
    coverage: {
      reporter: ['text', 'json', 'html']
    }
  }
});
