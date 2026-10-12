<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { drawsChars } from '../../engine';
  import { useTracery } from '../context';
  import Section from '../controls/Section.svelte';
  import Segmented from '../controls/Segmented.svelte';
  import SettingSlider from '../controls/SettingSlider.svelte';

  const app = useTracery();
  const S = $derived(app.settings);
  const chars = $derived(drawsChars(S));
  const FIT: [number, string][] = [[0, 'Off'], [80, '80'], [103, '103'], [120, '120']];
  const pill = 'h-7 flex-1 cursor-pointer rounded-sm text-xs text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:font-semibold';
</script>

<Section title="Output">
  <Segmented key="color" label="Color depth" />
  {#if !chars}
    <div title="Half: two pixels per cell, safe everywhere. Quadrant: four, finer. Full: one pixel per two cells, chunky.">
      <Segmented key="mode" label="Blocks" />
    </div>
    <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2.5" title="Shrink wide artwork to fit this many terminal columns">
      <span class="text-muted-foreground text-xs">Fit columns</span>
      <div role="group" aria-label="Fit columns" class="bg-raise flex gap-0.5 rounded-md border p-0.5">
        {#each FIT as [value, text] (value)}
          <button type="button" class={pill} aria-pressed={S.targetCols === value} onclick={() => { if (app.edit({ targetCols: value })) app.endEdit(); }}>{text}</button>
        {/each}
      </div>
    </div>
    {#if S.src === 'font'}
      <SettingSlider key="cw" label="Block width" />
      <SettingSlider key="ch" label="Block height" />
    {/if}
  {/if}
  <div class="flex flex-col items-start gap-1.5 pt-1">
    <Button variant="destructive" size="xs" onclick={() => app.reset()}>Reset the look</Button>
    <p class="text-muted-foreground m-0 text-[11px]">Colors, effects and output go back to the defaults. What you're drawing stays. You can undo it.</p>
  </div>
</Section>
