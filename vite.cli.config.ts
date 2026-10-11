import { defineConfig } from 'vite';

// Bundles the CLI and the shared engine into one Node ESM file.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'cli/kiln.ts',
    outDir: 'dist/cli',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'kiln.js', format: 'es' } },
  },
});
