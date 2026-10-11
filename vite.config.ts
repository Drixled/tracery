import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import icons from 'unplugin-icons/vite';

export default defineConfig({
  // Heroicons as Svelte components: import XMarkIcon from '~icons/heroicons/x-mark-16-solid'.
  plugins: [tailwindcss(), svelte(), icons({ compiler: 'svelte' })],
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  build: { outDir: 'dist/web', emptyOutDir: true },
  // Reach the dev server over `tailscale serve` from other tailnet devices.
  server: { allowedHosts: ['.ts.net'] },
});
