<script lang="ts">
  import AlignLeftIcon from '~icons/heroicons/bars-3-bottom-left-16-solid';
  import AlignCenterIcon from '~icons/heroicons/bars-3-16-solid';
  import AlignRightIcon from '~icons/heroicons/bars-3-bottom-right-16-solid';
  import ChevronDownIcon from '~icons/heroicons/chevron-down-16-solid';
  import StarIcon from '~icons/heroicons/star-16-solid';
  import { ONEIR_ART, faceName, tdfFamily, type Align, type FontLayout, type ImageKeep, type Settings } from '../../engine';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingCheck from '../controls/SettingCheck.svelte';
  import { entryOf } from '../fonts';

  /**
   * What's being drawn and how it's set, over the preview: the font (or ASCII art, or image) opens the picker,
   * and the tools that follow belong to that source. The text itself is typed in the dock below the preview.
   */
  const app = useTracery();
  const S = $derived(app.settings);
  const family = $derived(S.src === 'font' ? tdfFamily(S.face) : undefined);
  const favoriteId = $derived(S.src === 'font' ? entryOf(S.face)?.id : S.src === 'text' ? `web:${S.font}` : undefined);
  const favorite = $derived(!!favoriteId && app.favorites.includes(favoriteId));
  const name = $derived(S.src === 'font' ? family?.name ?? faceName(S.face) : S.src === 'text' ? S.font : S.src === 'ascii' ? 'ASCII art' : app.source?.name ?? 'Image');

  const SPACING: [FontLayout, string][] = [['default', 'Default'], ['full', 'Full'], ['fitted', 'Fitted'], ['smush', 'Smush']];
  const ALIGN = [['left', 'Align left', AlignLeftIcon], ['center', 'Center', AlignCenterIcon], ['right', 'Align right', AlignRightIcon]] as const;
  const WRAP: [number, string][] = [[0, 'Off'], [60, '60'], [80, '80'], [120, '120']];
  const KEEP: [ImageKeep, string][] = [['alpha', 'Opaque'], ['dark', 'Dark'], ['light', 'Light']];

  let imageInput = $state<HTMLInputElement | null>(null);
  const set = (patch: Partial<Settings>) => { if (app.edit(patch)) app.endEdit(); };
  const pill = 'h-7 cursor-pointer rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-raise aria-pressed:text-foreground motion-reduce:transition-none';
  const label = 'text-faint text-[10px] tracking-[0.12em] uppercase';
  const sliders = 'text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]';
</script>

{#snippet pills<T>(title: string, options: [T, string][], value: T, pick: (next: T) => void)}
  <div role="group" aria-label={title} class="flex items-center gap-0.5">
    <span class={cn(label, 'mr-1.5')}>{title}</span>
    {#each options as [option, text] (text)}
      <button type="button" class={pill} aria-pressed={value === option} onclick={() => pick(option)}>{text}</button>
    {/each}
  </div>
{/snippet}

<div class="bg-background flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line-soft px-4 py-2 md:px-6" role="toolbar" aria-label="Source">
  <div class="flex items-center gap-1">
    <button type="button" class="hover:bg-raise flex h-8 max-w-[16rem] cursor-pointer items-center gap-1.5 rounded-md px-2 font-medium" title="Change font or source" onclick={() => app.setStep('font')}>
      <span class="truncate" style:font-family={S.src === 'text' ? `"${S.font}"` : undefined}>{name}</span>
      <ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
    </button>
    {#if favoriteId}
      <button type="button" class={cn('cursor-pointer p-1', favorite ? 'text-primary' : 'text-faint hover:text-foreground')} aria-pressed={favorite} aria-label="Favorite" onclick={() => app.toggleFavorite(favoriteId)}>
        <StarIcon class="size-4" />
      </button>
    {/if}
  </div>

  {#if S.src === 'font'}
    {#if family && family.variants.length > 1}
      {@render pills('Color', family.variants.map(v => [v.id, v.label] as [string, string]), S.face, face => set({ face }))}
    {:else if !family}
      {@render pills('Spacing', SPACING, S.fLayout, fLayout => set({ fLayout }))}
    {/if}
    <div role="group" aria-label="Align" class="flex items-center gap-0.5">
      {#each ALIGN as [value, text, Icon] (value)}
        <button type="button" class={cn(pill, 'px-1.5')} aria-pressed={S.fAlign === value} aria-label={text} title={text} onclick={() => set({ fAlign: value as Align })}><Icon class="size-4" /></button>
      {/each}
    </div>
    {@render pills('Wrap', WRAP, S.fWrap, fWrap => set({ fWrap }))}
  {:else if S.src === 'text'}
    <div class={sliders}>
      <SettingSlider key="size" label="Height px" layout="inline" />
      <SettingSlider key="tracking" label="Tracking" layout="inline" />
      <SettingSlider key="leading" label="Line gap" layout="inline" />
    </div>
  {:else if S.src === 'ascii'}
    <div class={sliders}>
      <SettingSlider key="cw" label="Char width" layout="inline" />
      <SettingSlider key="ch" label="Char height" layout="inline" />
      <SettingCheck key="glyph" label="Shape punctuation" />
      <button type="button" class={pill} onclick={() => set({ ascii: ONEIR_ART })}>Load the Oneir sample</button>
    </div>
  {:else}
    <div class={sliders}>
      <button type="button" class={cn(pill, 'border')} onclick={() => imageInput?.click()}>Replace image</button>
      <input bind:this={imageInput} type="file" accept="image/*" class="hidden" onchange={event => { app.loadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
      <SettingSlider key="imgW" label="Width px" layout="inline" />
      <SettingSlider key="thresh" label="Threshold" layout="inline" />
      {@render pills('Keep', KEEP, S.imgUse, imgUse => set({ imgUse }))}
      <SettingCheck key="imgColors" label="Image colors" />
    </div>
  {/if}
</div>
