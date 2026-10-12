<script lang="ts">
  import XIcon from '~icons/heroicons/x-mark-16-solid';
  import { LOOKS, drawsChars } from '../../engine';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import Section from '../controls/Section.svelte';
  import More from '../controls/More.svelte';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingCheck from '../controls/SettingCheck.svelte';
  import SettingColor from '../controls/SettingColor.svelte';
  import { chip } from '../controls/chip';

  const app = useTracery();
  const S = $derived(app.settings);
  let lookName = $state('');
  const chars = $derived(drawsChars(S));

  async function saveLook(event: SubmitEvent) {
    event.preventDefault();
    if (await app.saveLook(lookName)) lookName = '';
  }
</script>

{#snippet shadow()}
  <SettingCheck key="shadowOn" label="Drop shadow">
    {#snippet trailing()}{#if S.shadowOn}<SettingColor key="shadowColor" label="Shadow color" />{/if}{/snippet}
  </SettingCheck>
  {#if S.shadowOn}
    <div class="grid grid-cols-2 gap-3.5">
      <SettingSlider key="sdx" label="X" layout="compact" />
      <SettingSlider key="sdy" label="Y" layout="compact" />
    </div>
  {/if}
{/snippet}

<Section title="Effects">
  {#if chars}
    {@render shadow()}
    <p class="text-muted-foreground m-0 text-[11px]">
      Outlines and bevels need block pixels.
      <button type="button" class="text-primary cursor-pointer underline-offset-4 hover:underline" onclick={() => { if (app.edit({ draw: 'blocks' })) app.endEdit(); }}>Render as Blocks</button>
    </p>
  {:else}
    <div class="flex flex-wrap gap-1.5">
      {#each LOOKS as look (look.name)}
        <button type="button" class={cn(chip, 'px-2.5 py-1')} onclick={() => app.edit(look.v)}>{look.name}</button>
      {/each}
      {#each app.looks as look (look.id)}
        <span class="inline-flex">
          <button type="button" class={cn(chip, 'rounded-r-none px-2.5 py-1 shadow-[inset_2px_0_0_var(--primary)]')} onclick={() => app.applyLook(look)}>{look.name}</button>
          <button type="button" class="bg-raise text-muted-foreground hover:text-destructive cursor-pointer rounded-r-sm border border-l-0 px-1.5" aria-label={`Delete look ${look.name}`} onclick={() => app.deleteLook(look)}>
            <XIcon class="size-3" />
          </button>
        </span>
      {/each}
    </div>
    <SettingSlider key="outline" label="Outline" />
    <SettingSlider key="gap" label="Gap" />
    <div class="grid grid-cols-2 gap-x-3.5">
      <SettingCheck key="lipOn" label="Lower lip" />
      <SettingCheck key="shineOn" label="Shine" />
      <SettingCheck key="bevel" label="Bevel" />
    </div>
    {@render shadow()}
    <More label="Colors and saved looks">
      <div class="text-muted-foreground grid grid-cols-2 gap-x-3.5 gap-y-2 text-xs">
        <span class="flex items-center justify-between">Outline <SettingColor key="outlineColor" label="Outline color" /></span>
        <span class="flex items-center justify-between">Lip <SettingColor key="lipColor" label="Lip color" /></span>
        <span class="flex items-center justify-between">Shine <SettingColor key="shineColor" label="Shine color" /></span>
      </div>
      <SettingCheck key="gapFillOn" label="Fill the gap">
        {#snippet trailing()}<SettingColor key="gapFill" label="Gap color" />{/snippet}
      </SettingCheck>
      <form class="flex gap-1.5" onsubmit={saveLook}>
        <Input bind:value={lookName} maxlength={128} placeholder="Name this look" aria-label="Look name" class="h-7 text-xs md:text-xs" />
        <Button type="submit" variant="outline" size="xs" class="h-7">Save look</Button>
      </form>
    </More>
  {/if}
</Section>
