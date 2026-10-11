<script lang="ts">
  import CameraIcon from '~icons/heroicons/camera-16-solid';
  import XIcon from '~icons/heroicons/x-mark-16-solid';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingColor from '../controls/SettingColor.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import Terminal from './Terminal.svelte';

  const app = useTracery();
  const S = $derived(app.settings);
  const result = $derived(app.result);
  const MODES = { half: 'HALF', quad: 'QUAD', full: 'FULL' } as const;
  const fit = $derived(S.targetCols ? `fits ${S.targetCols} col` : result.cols <= 80 ? 'fits 80 col' : `needs ${result.cols} col`);
  const fitTone = $derived(result.cols <= 80 || S.targetCols ? 'text-ok' : result.cols <= 120 ? 'text-warn' : 'text-destructive');
  const segment = 'border-line-soft border-r px-3 py-0.5';
</script>

<section class="dot-grid flex min-h-0 min-w-0 flex-1 flex-col gap-3.5 px-3.5 py-4.5 studio:overflow-auto studio:px-8 studio:pt-7 studio:pb-5" aria-label="Preview">
  <div class={cn('my-auto grid grid-cols-[minmax(0,1fr)] gap-4', app.reference && 'studio:grid-cols-2')}>
    <Terminal
      title={`ssh ${S.name || 'banner'}`}
      background={S.termBg}
      {result}
      ratio={S.ratio}
      zoom={S.fit ? null : S.zoom}
      rulers
      empty="The screen is empty. Paste some art, type a word or drop a logo."
    >
      {#snippet footer()}
        <div class="bg-raise text-muted-foreground flex flex-wrap items-stretch text-[11px] tabular-nums">
          {#if result.lines}
            <span class="bg-primary text-primary-foreground px-3 py-0.5 font-semibold tracking-[0.08em]">{MODES[S.mode]}</span>
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
    {#if app.reference}
      {@const reference = app.reference}
      <Terminal
        title={`Reference · ${reference.result.cols}×${reference.result.lines} cells`}
        background={reference.background}
        result={reference.result}
        ratio={reference.ratio}
      />
    {/if}
  </div>

  <p role="status" class="text-destructive m-0 text-center text-xs empty:hidden">{app.problem}</p>

  <div class="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
    <div class="text-muted-foreground flex flex-wrap items-center gap-x-4.5 gap-y-2 text-[11px]">
      <label class="flex cursor-pointer items-center gap-1.5">
        <Checkbox checked={S.fit} onCheckedChange={checked => { if (app.edit({ fit: checked })) app.endEdit(); }} /> Fit
      </label>
      <SettingSlider key="zoom" label="Zoom" layout="inline" readout={false} disabled={S.fit} />
      <SettingSlider key="ratio" label="Cell ratio" layout="inline" title="Terminal cell height divided by width. Ghostty and most fonts sit near 2.0" />
      <span class="flex items-center gap-1.5">Background <SettingColor key="termBg" label="Terminal background" /></span>
    </div>
    <div class="flex gap-2">
      {#if app.reference}
        <Button variant="outline" size="xs" onclick={() => { app.reference = null; }}><XIcon />Clear reference</Button>
      {:else}
        <Button variant="outline" size="xs" disabled={!result.lines} title="Keep a snapshot of this design beside the preview" onclick={() => app.pinReference()}>
          <CameraIcon />Pin reference
        </Button>
      {/if}
    </div>
  </div>
</section>
