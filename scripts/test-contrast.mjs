// Runs the real-browser contrast audit (src/content/__tests__/renderedContrast.test.ts).
// Uses a locally installed Chrome or Edge; set LEXIFLOW_BROWSER to point at another browser.
import { spawnSync } from 'child_process';

const result = spawnSync('npx', ['vitest', 'run', 'src/content/__tests__/renderedContrast.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, LEXIFLOW_CONTRAST: '1' }
});
process.exit(result.status ?? 1);
