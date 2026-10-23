import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __LEXIFLOW_DEMO__: true,
    __LEXIFLOW_CLOUD_ENV__: JSON.stringify('development')
  },
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10000,
    // Let `popupStyles.css?raw` resolve to the real stylesheet so style guard tests can inspect it.
    css: { include: [/popupStyles\.css/] },
    include: ['src/**/*.test.{ts,tsx}']
  }
});
