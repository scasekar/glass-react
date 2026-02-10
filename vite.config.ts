import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import liveReload from 'vite-plugin-live-reload';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    liveReload(['engine/build-web/**/*.{js,wasm}']),
  ],
  optimizeDeps: {
    exclude: ['engine'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
