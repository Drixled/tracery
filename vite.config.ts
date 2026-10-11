import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist/web', emptyOutDir: true },
  test: { include: ['test/**/*.test.ts'] },
} as any);
