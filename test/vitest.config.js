import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      all: true,
      include: ['src/**/*.js'],
      reporter: ['text', 'lcov', 'html']
    }
  }
});
