<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Slider } from '$lib/components/ui/slider';
  import { useTracery } from '../context';
  import { FIGLET_FONTS, TDF_FONTS, WEB_FONTS, entryOf, type FontEntry } from '../fonts';
  import FontCard from './FontCard.svelte';
  import TextDock from './TextDock.svelte';

  /** The font picker: type once, see the text in every font, pick one to go back to the editor. */
  const app = useTracery();
  const S = $derived(app.settings);

  type Scope = 'all' | 'favorites' | 'colored';
  type Look = 'solid' | 'lines' | null;
  type Size = 'small' | 'medium' | 'large' | null;
  let scope = $state<Scope>('all');
  let look = $state<Look>(null);
  let size = $state<Size>(null);
  let query = $state('');
  let imageInput = $state<HTMLInputElement | null>(null);

  // How many fonts sit in a row, remembered in this browser.
  let perRow = $state(Math.min(6, Math.max(1, Number((() => { try { return localStorage.getItem('tracery:per-row'); } catch { return null; } })()) || 4)));
  $effect(() => { try { localStorage.setItem('tracery:per-row', String(perRow)); } catch { /* Optional preference. */ } });
  let gridWidth = $state(0);
  const columns = $derived(Math.max(1, Math.min(perRow, Math.floor(gridWidth / 150) || 1)));

  // Cards redraw a moment after typing stops, not on every key.
  let words = $state(app.settings.words);
  $effect(() => {
    const next = S.words;
    const timer = setTimeout(() => { words = next; }, 180);
    return () => clearTimeout(timer);
  });

  const sizeOf = (entry: FontEntry): Size => (entry.height <= 5 ? 'small' : entry.height < 10 ? 'medium' : 'large');
  const keep = (entry: FontEntry) => {
    const search = query.trim().toLowerCase();
    if (search && !entry.name.toLowerCase().includes(search)) return false;
    if (scope === 'favorites' && !app.favorites.includes(entry.id)) return false;
    if (scope === 'colored' && !entry.colored) return false;
    if (look && entry.solid !== (look === 'solid')) return false;
    return !size || sizeOf(entry) === size;
  };
  const sections = $derived([
    { title: 'FIGlet', items: FIGLET_FONTS.filter(keep) },
    { title: 'TheDraw', items: TDF_FONTS.filter(keep) },
    { title: 'Web fonts', items: WEB_FONTS.filter(keep) },
  ].filter(section => section.items.length));
  const count = $derived(sections.reduce((n, section) => n + section.items.length, 0));
  const selected = $derived(S.src === 'font' ? entryOf(S.face)?.id : S.src === 'text' ? `web:${S.font}` : undefined);

  const shown = new SvelteSet<string>();
  const observer = new IntersectionObserver(entries => {
    for (const e of entries) {
      const id = (e.target as HTMLElement).dataset.font!;
      if (e.isIntersecting) shown.add(id); else shown.delete(id);
    }
  }, { rootMargin: '400px 0px' });
  $effect(() => () => observer.disconnect());
  function observe(node: HTMLElement) {
    observer.observe(node);
    return { destroy: () => observer.unobserve(node) };
  }

  const tile = 'flex h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-xs transition-colors hover:border-muted-foreground hover:bg-white/[0.03] aria-[current=true]:border-primary/60 motion-reduce:transition-none';
  function choose(entry: FontEntry) {
    if (entry.kind === 'web') return app.chooseWebFont(entry.name);
    // Picking a TheDraw family keeps the color variant you already chose in it.
    app.chooseFont(entry.variants.some(v => v.id === S.face) ? S.face : entry.id);
  }
  const pill = 'cursor-pointer rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-raise aria-pressed:text-foreground motion-reduce:transition-none';
</script>

{#snippet group(label: string, options: readonly (readonly [string, string])[], value: string | null, set: (next: string | null) => void, toggle = false)}
  <div role="group" aria-label={label} class="flex items-center gap-0.5">
    {#each options as [option, text] (text)}
      <button type="button" class={pill} aria-pressed={value === option} onclick={() => set(toggle && value === option ? null : option)}>{text}</button>
    {/each}
  </div>
{/snippet}

<svelte:window onkeydown={event => { if (event.key === 'Escape' && !event.defaultPrevented && !app.exportOpen) app.setStep('style'); }} />

<main class="relative flex min-h-0 flex-1 flex-col overflow-auto">
  <div class="bg-background/90 sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-4 py-2.5 backdrop-blur md:px-6">
    {@render group('Show', [['all', 'All'], ['favorites', '★ Favorites'], ['colored', 'Colored']] as const, scope, next => { scope = (next ?? 'all') as Scope; })}
    <span class="bg-line-soft hidden h-4 w-px sm:block" aria-hidden="true"></span>
    {@render group('Look', [['solid', 'Solid'], ['lines', 'Lines']] as const, look, next => { look = next as Look; }, true)}
    <span class="bg-line-soft hidden h-4 w-px sm:block" aria-hidden="true"></span>
    {@render group('Size', [['small', 'S'], ['medium', 'M'], ['large', 'L']] as const, size, next => { size = next as Size; }, true)}
    <Input type="search" bind:value={query} placeholder="Search fonts" aria-label="Search fonts" spellcheck="false" class="h-7 w-40 text-xs md:text-xs" />
    <div class="text-muted-foreground ml-auto flex items-center gap-2.5 text-[11px]">
      <span class="tabular-nums">{count} fonts</span>
      <span class="hidden sm:inline">Per row</span>
      <Slider type="single" bind:value={perRow} min={1} max={6} step={1} thumbLabel="Fonts per row" class="w-24" />
      <output class="text-foreground w-3 tabular-nums">{perRow}</output>
      <Button size="xs" class="ml-2 font-semibold" title="Back to the editor (Esc)" onclick={() => app.setStep('style')}>Done</Button>
    </div>
  </div>

  <div class="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-10 md:px-6" bind:clientWidth={gridWidth}>
    <h2 class="text-faint mb-3 text-[11px] tracking-[0.12em] uppercase">Start from</h2>
    <div class="mb-10 grid grid-cols-2 gap-3 sm:max-w-[520px]">
      <button type="button" class={tile} aria-current={S.src === 'ascii'} onclick={() => app.useAscii()}>
        <span class="font-mono text-[10px] leading-[1.1] whitespace-pre text-muted-foreground">{'  /\\  \n /  \\ \n/____\\'}</span>ASCII art you paste
      </button>
      <button type="button" class={tile} aria-current={S.src === 'image'} onclick={() => imageInput?.click()}>
        <span class="text-muted-foreground text-lg">▚▞▚</span>An image or logo
      </button>
      <input bind:this={imageInput} type="file" accept="image/*" class="hidden" onchange={event => { app.loadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
    </div>
    {#each sections as section (section.title)}
      <h2 class="text-faint mb-3 text-[11px] tracking-[0.12em] uppercase">{section.title} · {section.items.length}</h2>
      <div class="mb-10 grid gap-x-5 gap-y-6" style:grid-template-columns={`repeat(${columns}, minmax(0, 1fr))`}>
        {#each section.items as entry (entry.id)}
          <div use:observe data-font={entry.id}>
            <FontCard
              {entry}
              {words}
              selected={selected === entry.id}
              favorite={app.favorites.includes(entry.id)}
              shown={shown.has(entry.id)}
              onchoose={() => choose(entry)}
              onfavorite={() => app.toggleFavorite(entry.id)}
            />
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-muted-foreground py-20 text-center">{scope === 'favorites' && !query ? 'No favorites yet. Star a font to keep it here.' : 'No fonts match these filters.'}</p>
    {/each}
  </div>
  <TextDock />
</main>
