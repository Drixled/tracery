<script lang="ts">
  import { cn } from '$lib/utils';
  import { drawsChars } from '../../engine';
  import { useTracery } from '../context';
  import Terminal from './Terminal.svelte';
  import TextDock from '../font/TextDock.svelte';

  const app = useTracery();
  const S = $derived(app.settings);
  const result = $derived(app.result);
  const MODES = { half: 'HALF', quad: 'QUAD', full: 'FULL' } as const;
  const chars = $derived(drawsChars(S));
  const fit = $derived(S.targetCols && !chars ? `fits ${S.targetCols} col` : result.cols <= 80 ? 'fits 80 col' : `needs ${result.cols} col`);
  const fitTone = $derived(result.cols <= 80 || (S.targetCols && !chars) ? 'text-ok' : result.cols <= 120 ? 'text-warn' : 'text-destructive');
  const segment = 'border-line-soft border-r px-3 py-0.5';
</script>

<section class={cn('dot-grid flex min-h-0 min-w-0 flex-1 flex-col gap-3.5 px-3.5 py-4.5 studio:overflow-auto studio:px-8 studio:pt-7 studio:pb-5')} aria-label="Preview">
  <div class="grid grid-cols-[minmax(0,1fr)]">
    <Terminal
      title={`ssh ${S.name || 'banner'}`}
      background={S.termBg}
      {result}
      ratio={S.ratio}
      rulers
      empty={app.fontLoading ? 'Loading the font…' : 'The screen is empty. Paste some art, type a word or drop a logo.'}
    >
      {#snippet footer()}
        <div class="bg-raise text-muted-foreground flex flex-wrap items-stretch text-[11px] tabular-nums">
          {#if result.lines}
            <span class="bg-primary text-primary-foreground px-3 py-0.5 font-semibold tracking-[0.08em]">{chars ? 'CHARS' : MODES[S.mode]}</span>
            <span class={segment}>{result.cols}×{result.lines}</span>
            <span class={segment}>{(result.bytes / 1024).toFixed(1)} KB</span>
            <span class={segment}>{S.color === 'true' ? 'truecolor' : `${S.color} colors`}</span>
            <span class={cn('border-line-soft ml-auto border-l px-3 py-0.5 font-semibold', fitTone)}>● {fit}</span>
          {:else}
            <span class="bg-primary text-primary-foreground px-3 py-0.5 font-semibold tracking-[0.08em]">IDLE</span>
            <span class={segment}>no output yet</span>
          {/if}
        </div>
      {/snippet}
    </Terminal>
  </div>

  <p role="status" class="text-destructive m-0 text-center text-xs empty:hidden">{app.problem}</p>
  {#if S.src !== 'image'}
    <TextDock field={S.src === 'font' ? 'words' : S.src} flush>
      {#snippet trailing()}
        {#if S.src === 'font' && app.art?.missing.length}<span class="text-warn" title="This font has no glyphs for these, so they're left out">no {app.art.missing.join(' ')}</span>{/if}
      {/snippet}
    </TextDock>
  {/if}
</section>
