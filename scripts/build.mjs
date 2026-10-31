import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

async function buildExtension() {
  console.log('1/3 Building HTML surfaces (popup, workbench, offscreen) & static public assets...');
  await build({
    root: rootDir,
    configFile: false,
    base: './',
    publicDir: 'public',
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2022',
      rollupOptions: {
        input: {
          popup: resolve(rootDir, 'popup.html'),
          workbench: resolve(rootDir, 'workbench.html'),
          offscreen: resolve(rootDir, 'offscreen.html'),
        },
      },
    },
  });

  console.log('2/3 Building Manifest V3 Service Worker (dist/background.js)...');
  await build({
    root: rootDir,
    configFile: false,
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'es2022',
      lib: {
        entry: resolve(rootDir, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('3/3 Building self-contained AudioWorkletProcessor (dist/worklet/vintage-radio-processor.js)...');
  await build({
    root: rootDir,
    configFile: false,
    publicDir: false,
    build: {
      outDir: 'dist/worklet',
      emptyOutDir: false,
      target: 'es2022',
      lib: {
        entry: resolve(rootDir, 'src/worklet/vintage-radio-processor.ts'),
        name: 'VintageRadioWorklet',
        formats: ['iife'],
        fileName: () => 'vintage-radio-processor.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('Extension build complete in dist/');
}

buildExtension().catch((err) => {
  console.error('Extension build failed:', err);
  process.exit(1);
});
