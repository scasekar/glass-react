import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  root: 'demo',
  plugins: [react(), wasm(), topLevelAwait()],
  base: './',
  optimizeDeps: {
    exclude: ['engine'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
  },
});
