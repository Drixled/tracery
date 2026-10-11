<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { RenderResult } from '../../engine';
  import { drawCells } from '../preview';

  interface Props {
    title: string;
    background: string;
    result: RenderResult;
    ratio: number;
    /** Cell width in CSS px, or `null` to fit the window. */
    zoom?: number | null;
    /** Mark the 80, 103 and 120 column widths above the screen. */
    rulers?: boolean;
    empty?: string;
    footer?: Snippet;
  }
  let { title, background, result, ratio, zoom = null, rulers = false, empty = '', footer }: Props = $props();
  let canvas = $state<HTMLCanvasElement | null>(null);
  let width = $state(0);
  let cell = $state(0);

  $effect(() => {
    if (!canvas || !result.lines || !width) return;
    const size = zoom ?? Math.max(1, Math.min(16, Math.floor((width - 36) / Math.max(1, result.cols))));
    cell = drawCells(canvas, result.rows, result.cols, { cell: size, ratio });
  });
  const marks = $derived(rulers && result.lines ? [80, 103, 120].filter(columns => columns * cell < width + 400) : []);
</script>

<div class="overflow-hidden rounded-[10px] shadow-[0_0_0_1px_var(--border),0_16px_40px_-20px_#000]" style:background>
  <div class="bg-raise text-muted-foreground flex items-center gap-1.5 px-3 py-2 text-[11px]">
    <i class="bg-border size-2.5 rounded-full"></i><i class="bg-border size-2.5 rounded-full"></i><i class="bg-border size-2.5 rounded-full"></i>
    <span class="mr-[46px] flex-1 truncate text-center">{title}</span>
  </div>
  {#if rulers}
    <div class="relative mx-[22px] mt-1.5 h-3.5 overflow-hidden text-[10px] text-[#77706a]" aria-hidden="true">
      {#each marks as columns (columns)}
        <span class="absolute top-0 h-3.5 border-l border-dashed border-[#4a4442] pl-1 whitespace-nowrap" style:left="{columns * cell}px">{columns} col</span>
      {/each}
    </div>
  {/if}
  <div class="relative min-h-[180px] overflow-auto p-[22px]" bind:clientWidth={width}>
    <canvas bind:this={canvas} hidden={!result.lines} class="mx-auto block [image-rendering:pixelated]"></canvas>
    {#if !result.lines && empty}<p class="my-14 text-center text-xs text-[#8f8780]">{empty}</p>{/if}
  </div>
  {@render footer?.()}
</div>
