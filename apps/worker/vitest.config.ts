import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'worker',
    environment: 'node',
    testTimeout: 30_000,
  },
});
