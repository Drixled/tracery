<script lang="ts">
  import { SETTINGS_SCHEMA } from '../../engine';
  import { Slider } from '$lib/components/ui/slider';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import type { NumberKey } from './keys';

  interface Props {
    key: NumberKey;
    label: string;
    /** Text for the value readout. */
    format?: (value: number) => string;
    /** `row` lines up with other panel rows; `compact` fits two side by side; `inline` sits in a toolbar. */
    layout?: 'row' | 'compact' | 'inline';
    readout?: boolean;
    disabled?: boolean;
    title?: string;
  }
  let { key, label, format = String, layout = 'row', readout = true, disabled = false, title }: Props = $props();
  const app = useTracery();
  const range = $derived.by(() => { const rule = SETTINGS_SCHEMA[key]; return rule.kind === 'number' ? rule : { min: 0, max: 1, step: 1 }; });
  // Fractional steps such as 0.05 accumulate float error; round to the step's precision.
  const digits = $derived((String(range.step).split('.')[1] ?? '').length);
  const value = $derived(app.settings[key]);
  const grid = { row: 'grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] gap-2.5', compact: 'grid grid-cols-[1rem_minmax(0,1fr)_1.5rem] gap-2.5', inline: 'flex gap-1.5' };
</script>

<div class={cn('items-center', grid[layout])} {title}>
  <span class={cn(layout !== 'inline' && 'text-muted-foreground text-xs')}>{label}</span>
  <Slider
    type="single"
    {value}
    min={range.min}
    max={range.max}
    step={range.step}
    {disabled}
    thumbLabel={label}
    class={cn(layout === 'inline' && 'w-[90px]')}
    onValueChange={next => app.edit({ [key]: Number(next.toFixed(digits)) }, key)}
    onValueCommit={() => app.endEdit()}
  />
  {#if readout}<output class="text-foreground min-w-[2ch] text-right text-xs tabular-nums">{format(value)}</output>{/if}
</div>
