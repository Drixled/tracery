<script lang="ts">
  import { useTracery } from '../context';
  import ColorPanel from './ColorPanel.svelte';
  import ShapePanel from './ShapePanel.svelte';
  import OutputPanel from './OutputPanel.svelte';
  import Segmented from '../controls/Segmented.svelte';

  /** How the banner looks, in one column. What's drawn is set in the toolbar and text bar instead. */
  const app = useTracery();
  const row = 'grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2.5';
</script>

<aside class="bg-panel flex min-h-0 min-w-0 flex-1 flex-col gap-3.5 border-t border-line-soft px-4.5 pt-4.5 pb-7 studio:overflow-auto studio:border-t-0" aria-label="Banner controls">
  {#if app.settings.src === 'font' || app.settings.src === 'ascii'}
    <div class="flex flex-col gap-2.5">
      <div class={row} title="Characters keep the letters as they are. Blocks fill them with block pixels, so outlines and bevels work.">
        <span class="text-muted-foreground text-xs">Render as</span>
        <Segmented key="draw" label="Render as" />
      </div>
      {#if app.settings.src === 'font'}
      <div class={row} title="Font keeps a colored font's own colors. Gradient runs the palette across the text. Shade maps each font color to a palette color of the same brightness, keeping its texture.">
        <span class="text-muted-foreground text-xs">Colors</span>
        <Segmented key="tint" label="Colors" />
      </div>
      {/if}
    </div>
  {/if}
  <ColorPanel />
  <ShapePanel />
  <OutputPanel />
</aside>
