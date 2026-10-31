import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        workbench: resolve(__dirname, 'workbench.html'),
        offscreen: resolve(__dirname, 'offscreen.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/dsp/**/*.test.ts', 'tests/state/**/*.test.ts'],
    reporters: ['default'],
  },
});
