import { defineConfig } from 'vite';

// Bundles the CLI and the shared engine into one Node ESM file.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: ['pngjs'] },
  build: {
    ssr: 'cli/tracery.ts',
    outDir: 'dist/cli',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'tracery.js', format: 'es' } },
  },
});
