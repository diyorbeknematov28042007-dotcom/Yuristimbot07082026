import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { 'cloudflare:workers': new URL('./tests/cloudflare.ts', import.meta.url).pathname } },
  test: { environment: 'node', testTimeout: 10000 }
});
