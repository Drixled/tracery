<script lang="ts">
  import StarIcon from '~icons/heroicons/star-16-solid';
  import StarOutlineIcon from '~icons/heroicons/star';
  import { DEFAULTS, renderArtChars, setText, type Settings } from '../../engine';
  import { cn } from '$lib/utils';
  import { drawCells } from '../preview';
  import { asDrawn, browserFace, type FontEntry } from '../fonts';

  interface Props {
    entry: FontEntry;
    words: string;
    selected: boolean;
    favorite: boolean;
    /** Only cards on screen load their font and draw. */
    shown: boolean;
    onchoose: () => void;
    onfavorite: () => void;
  }
  let { entry, words, selected, favorite, shown, onchoose, onfavorite }: Props = $props();
  const LOOK: Settings = asDrawn({ ...DEFAULTS, src: 'font' });
  let canvas = $state<HTMLCanvasElement | null>(null);
  let width = $state(0);
  let height = $state(0);
  let missing = $state<string[]>([]);
  let failed = $state('');

  $effect(() => {
    if (entry.kind === 'web' || !shown || !canvas || !width) return;
    const text = words.trim() ? words : entry.name;
    const target = canvas, w = width, h = height;
    let cancelled = false;
    browserFace(entry.id).then(face => {
      if (cancelled) return;
      const art = setText(face, { ...LOOK, words: text });
      const result = renderArtChars(art, LOOK);
      missing = art.missing;
      failed = '';
      if (!result.lines) { target.width = 0; return; }
      // As large as the frame allows, so the per-row control really changes the size.
      const cell = Math.max(1, Math.min(16, Math.floor(w / result.cols), Math.floor(h / (result.lines * 2))));
      drawCells(target, result.rows, result.cols, { cell, ratio: 2 });
    }, e => { if (!cancelled) failed = (e as Error).message; });
    return () => { cancelled = true; };
  });
</script>

<div class="group flex min-w-0 flex-col gap-1.5">
  <button
    type="button"
    aria-label={`Use ${entry.name}`}
    aria-current={selected}
    class={cn('relative block aspect-[2/1] w-full cursor-pointer rounded-lg transition-colors hover:bg-white/[0.03] motion-reduce:transition-none', selected && 'bg-white/[0.04] ring-1 ring-primary/50')}
    onclick={onchoose}
  >
    <!-- Positioned, so the drawing can never resize the frame it was sized from. -->
    <div class="absolute inset-3 flex items-center justify-center overflow-hidden" bind:clientWidth={width} bind:clientHeight={height}>
      {#if entry.kind === 'web'}
        <!-- Web fonts are drawn by the browser; sized so the longest line fits the frame. -->
        {@const lines = (words.trim() ? words : entry.name).split('\n')}
        <span class="text-foreground leading-none whitespace-pre" style:font-family={`"${entry.name}"`} style:font-size={`${Math.max(8, Math.min(height / lines.length * 0.7, width / (Math.max(...lines.map(l => l.length)) * 0.75)))}px`}>{lines.join('\n')}</span>
      {:else}
        {#if failed}<span class="text-destructive text-center text-[11px]">{failed}</span>{/if}
        <canvas bind:this={canvas} hidden={!!failed} class="max-h-full max-w-full [image-rendering:pixelated]"></canvas>
      {/if}
    </div>
  </button>
  <div class="text-muted-foreground flex min-w-0 items-center gap-1.5 px-1 text-[11px]">
    <span class={cn('truncate', selected ? 'text-primary' : 'group-hover:text-foreground')}>{entry.name}</span>
    {#if entry.variants.length}<span class="text-faint shrink-0">{entry.variants.length} colors</span>{/if}
    {#if missing.length}<span class="text-warn shrink-0" title={`No glyphs for: ${missing.join(' ')}`}>missing {missing.length}</span>{/if}
    <button
      type="button"
      class={cn('ml-auto shrink-0 cursor-pointer', favorite ? 'text-primary' : 'text-faint hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
      aria-label={favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`}
      aria-pressed={favorite}
      onclick={onfavorite}
    >
      {#if favorite}<StarIcon class="size-3.5" />{:else}<StarOutlineIcon class="size-3.5" />{/if}
    </button>
  </div>
</div>
