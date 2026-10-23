import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// Dev builds (`npm run build:dev`) keep readable output with inline sourcemaps;
// production builds are minified and ship without sourcemaps.
const isDev = process.argv.includes('--dev');
// Which LexiFlow Cloud to talk to (src/config/cloud.ts): dev builds use local `wrangler dev`,
// `--cloud=staging` the staging Worker, and everything else production.
const cloudArg = process.argv.find((a) => a.startsWith('--cloud='))?.slice('--cloud='.length);
const cloudEnv = cloudArg ?? (isDev ? 'development' : 'production');
if (!['development', 'staging', 'production'].includes(cloudEnv)) {
  console.error(`Unknown --cloud=${cloudEnv}; use development, staging or production.`);
  process.exit(1);
}
const define = { __LEXIFLOW_DEMO__: JSON.stringify(isDev), __LEXIFLOW_CLOUD_ENV__: JSON.stringify(cloudEnv) };

async function buildAll() {
  console.log('--- Step 1: Building Popup and Dashboard HTML Pages ---');
  await build({
    root,
    define,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev ? 'inline' : false,
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
    define,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: !isDev,
      sourcemap: isDev ? 'inline' : false,
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
    define,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: !isDev,
      sourcemap: isDev ? 'inline' : false,
      lib: {
        entry: path.resolve(root, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js'
      }
    }
  });

  console.log('--- Step 4: Copying Manifest and Assets ---');
  const distDir = path.resolve(root, 'dist');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));
  if (cloudEnv === 'staging') {
    // Testers can tell the builds apart, and the staging API is reachable.
    manifest.name = `${manifest.name} (Staging)`;
    if (!manifest.host_permissions.includes('https://api-staging.lexiflow.app/*')) {
      manifest.host_permissions.push('https://api-staging.lexiflow.app/*');
    }
  }
  fs.writeFileSync(path.resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.cpSync(path.resolve(root, 'assets'), path.resolve(distDir, 'assets'), { recursive: true });

  console.log(`✓ LexiFlow Extension Build Complete in dist/ (LexiFlow Cloud: ${cloudEnv})`);
}

buildAll().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
