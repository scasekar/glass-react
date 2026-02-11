import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import liveReload from 'vite-plugin-live-reload';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  // Library build: vite build (default)
  if (command === 'build' && mode !== 'demo') {
    return {
      plugins: [
        react(),
        wasm(),
        topLevelAwait(),
        dts({ tsconfigPath: './tsconfig.lib.json' }),
      ],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          formats: ['es'],
          fileName: 'index',
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'react/jsx-runtime',
            },
          },
        },
        outDir: 'dist',
        emptyOutDir: true,
      },
    };
  }

  // Dev server or demo build
  return {
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
  };
});
