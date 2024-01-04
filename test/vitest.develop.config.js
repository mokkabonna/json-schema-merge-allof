import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporter: ['basic'],
    coverage: {
      enabled: true,
      reporter: ['lcov']
    }
  }
});
