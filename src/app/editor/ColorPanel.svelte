<script lang="ts">
  import PlusIcon from '~icons/heroicons/plus-16-solid';
  import MinusIcon from '~icons/heroicons/minus-16-solid';
  import { PALETTES, PALETTE_CATEGORIES, generatePalette, type Dither, type Palette, type Settings } from '../../engine';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import Section from '../controls/Section.svelte';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingSelect from '../controls/SettingSelect.svelte';
  import SettingCheck from '../controls/SettingCheck.svelte';
  import { chip } from '../controls/chip';

  const app = useTracery();
  const S = $derived(app.settings);
  let query = $state('');
  let category = $state('all');

  const groups = $derived.by(() => {
    const search = query.trim().toLowerCase();
    return PALETTE_CATEGORIES
      .filter(name => category === 'all' || name === category)
      .map(name => ({ name, items: PALETTES.filter(p => p.category === name && (!search || p.name.toLowerCase().includes(search) || name.toLowerCase().includes(search))) }))
      .filter(group => group.items.length);
  });
  const count = $derived(groups.reduce((total, group) => total + group.items.length, 0));

  function apply(p: Palette, extra: Partial<Settings> = {}) {
    app.edit({ palette: p.name, stops: p.stops.slice(), outlineColor: p.outlineColor, lipColor: p.lipColor, shineColor: p.shineColor, shadowColor: p.shadowColor, dither: p.dither ?? (app.settings.dither === 'none' ? 'bayer4' : app.settings.dither), ...extra });
  }
  const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
  function shuffle() {
    const p = pick(PALETTES);
    const dithers: Dither[] = ['bayer4', 'bayer2', 'bayer8', 'checker', 'lines', 'noise'];
    apply(p, { dither: p.dither ?? pick(dithers), dir: pick(['v', 'v', 'h', 'd', 'r'] as const), reverse: Math.random() < 0.2 });
  }
  function setStop(i: number, color: string) {
    const stops = app.settings.stops.slice();
    stops[i] = color;
    app.edit({ stops, palette: '' }, `stop${i}`);
  }
  function resize(change: 1 | -1) {
    const stops = app.settings.stops.slice();
    if (change === 1) stops.push(stops.at(-1)!); else stops.pop();
    app.edit({ stops, palette: '' });
  }
</script>

<Section title="Palette">
  {#snippet tools()}
    <Button variant="outline" size="xs" title="Make a new palette from a random color harmony" onclick={() => apply(generatePalette())}>Generate</Button>
    <Button variant="outline" size="xs" title="Pick a random preset and dither" onclick={shuffle}>Shuffle</Button>
  {/snippet}
  <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-1.5">
    <Input type="search" bind:value={query} placeholder={`Search ${PALETTES.length} palettes`} aria-label="Search palettes" spellcheck="false" class="h-8 text-xs md:text-xs" />
    <Select.Root type="single" bind:value={category}>
      <Select.Trigger size="sm" class="w-full text-xs" aria-label="Palette category">{category === 'all' ? 'All' : category}</Select.Trigger>
      <Select.Content>
        <Select.Item value="all" label="All" class="text-xs">All</Select.Item>
        {#each PALETTE_CATEGORIES as name (name)}<Select.Item value={name} label={name} class="text-xs">{name}</Select.Item>{/each}
      </Select.Content>
    </Select.Root>
  </div>
  <div class="flex max-h-[300px] flex-wrap content-start gap-1.5 overflow-auto p-0.5">
    {#each groups as group, i (group.name)}
      <div class={cn('text-faint basis-full text-[10px] tracking-[0.12em] uppercase', i > 0 && 'pt-2')}>{group.name} · {group.items.length}</div>
      {#each group.items as p (p.name)}
        <button type="button" class={cn(chip, 'py-1 pr-2 pl-1')} aria-pressed={p.name === S.palette} onclick={() => apply(p)}>
          <span class="h-3.5 w-[22px] flex-none rounded-[2px]" style:background={`linear-gradient(180deg,${p.stops.join(',')})`} style:box-shadow={`0 0 0 2px ${p.outlineColor}`}></span>
          {p.name}
        </button>
      {/each}
    {/each}
  </div>
  <p class="text-muted-foreground m-0 text-[11px]">{count ? `${count} of ${PALETTES.length} palettes` : 'No palettes match. Try another word, or Generate one.'}</p>
</Section>

<Section title="Ramp">
  <div class="flex flex-wrap items-center gap-1.5">
    {#each S.stops as stop, i (i)}
      <input type="color" class="swatch h-7 w-[34px]" aria-label={`Ramp color ${i + 1}`} value={stop} oninput={event => setStop(i, event.currentTarget.value)} onchange={() => app.endEdit()} />
    {/each}
    <Button variant="outline" size="icon-sm" class="h-7 w-[26px]" title="Add a color" aria-label="Add a color" disabled={S.stops.length >= 6} onclick={() => resize(1)}><PlusIcon /></Button>
    <Button variant="outline" size="icon-sm" class="h-7 w-[26px]" title="Remove the last color" aria-label="Remove the last color" disabled={S.stops.length <= 1} onclick={() => resize(-1)}><MinusIcon /></Button>
  </div>
  <SettingSelect key="dither" label="Dither" />
  <SettingSelect key="dir" label="Direction" />
  <SettingSlider key="spread" label="Spread" />
  <SettingCheck key="reverse" label="Reverse ramp" />
</Section>
