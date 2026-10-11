import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist/web', emptyOutDir: true },
  test: { include: ['test/**/*.test.ts'] },
});
