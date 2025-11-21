import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reactPlugins = react();
const plugins: PluginOption[] = Array.isArray(reactPlugins) ? reactPlugins : [reactPlugins];

export default defineConfig({
  plugins,
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, '..'), resolve(__dirname, '..', '..')]
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  }
});
