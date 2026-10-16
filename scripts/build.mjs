import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

async function buildAll() {
  console.log('--- Step 1: Building Popup and Dashboard HTML Pages ---');
  await build({
    root,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve(root, 'popup.html'),
          dashboard: path.resolve(root, 'dashboard.html')
        }
      }
    }
  });

  console.log('--- Step 2: Building Content Script (Standalone IIFE) ---');
  await build({
    root,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: false,
      sourcemap: 'inline',
      lib: {
        entry: path.resolve(root, 'src/content/index.ts'),
        name: 'LexiFlowContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  console.log('--- Step 3: Building Background Service Worker (ESM) ---');
  await build({
    root,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: false,
      sourcemap: 'inline',
      lib: {
        entry: path.resolve(root, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js'
      }
    }
  });

  console.log('--- Step 4: Copying Manifest and Assets ---');
  const distDir = path.resolve(root, 'dist');
  fs.copyFileSync(path.resolve(root, 'manifest.json'), path.resolve(distDir, 'manifest.json'));
  fs.cpSync(path.resolve(root, 'assets'), path.resolve(distDir, 'assets'), { recursive: true });

  console.log('✓ LexiFlow Extension Build Complete in dist/');
}

buildAll().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
