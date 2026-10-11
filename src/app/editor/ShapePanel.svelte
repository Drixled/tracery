<script lang="ts">
  import XIcon from '~icons/heroicons/x-mark-16-solid';
  import { LOOKS } from '../../engine';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import Section from '../controls/Section.svelte';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingCheck from '../controls/SettingCheck.svelte';
  import SettingColor from '../controls/SettingColor.svelte';
  import { chip } from '../controls/chip';

  const app = useTracery();
  let lookName = $state('');

  async function saveLook(event: SubmitEvent) {
    event.preventDefault();
    if (await app.saveLook(lookName)) lookName = '';
  }
</script>

<Section title="Looks">
  <div class="flex flex-wrap gap-1.5">
    {#each LOOKS as look (look.name)}
      <button type="button" class={cn(chip, 'px-2.5 py-1')} onclick={() => app.edit(look.v)}>{look.name}</button>
    {/each}
  </div>
  {#if app.looks.length}
    <div class="flex flex-wrap gap-1.5">
      {#each app.looks as look (look.id)}
        <span class="inline-flex">
          <button type="button" class={cn(chip, 'rounded-r-none px-2.5 py-1 shadow-[inset_2px_0_0_var(--primary)]')} onclick={() => app.applyLook(look)}>{look.name}</button>
          <button type="button" class="bg-raise text-muted-foreground hover:text-destructive cursor-pointer rounded-r-sm border border-l-0 px-1.5" aria-label={`Delete look ${look.name}`} onclick={() => app.deleteLook(look)}>
            <XIcon class="size-3" />
          </button>
        </span>
      {/each}
    </div>
  {/if}
  <form class="flex gap-1.5" onsubmit={saveLook}>
    <Input bind:value={lookName} maxlength={128} placeholder="Name this look" aria-label="Look name" class="h-7 text-xs md:text-xs" />
    <Button type="submit" variant="outline" size="xs" class="h-7">Save look</Button>
  </form>
</Section>

<Section title="Edges">
  <SettingSlider key="gap" label="Gap" />
  <SettingCheck key="gapFillOn" label="Fill the gap">
    {#snippet trailing()}<SettingColor key="gapFill" label="Gap color" />{/snippet}
  </SettingCheck>
  <SettingSlider key="outline" label="Outline" />
  <div class="text-muted-foreground flex min-h-6 items-center gap-2 text-xs">
    <span class="flex-1">Outline color</span><SettingColor key="outlineColor" label="Outline color" />
  </div>
</Section>

<Section title="Light">
  <SettingCheck key="lipOn" label="Darker lower lip">
    {#snippet trailing()}<SettingColor key="lipColor" label="Lip color" />{/snippet}
  </SettingCheck>
  <SettingCheck key="shineOn" label="Shine dots on left edges">
    {#snippet trailing()}<SettingColor key="shineColor" label="Shine color" />{/snippet}
  </SettingCheck>
  <SettingCheck key="bevel" label="Bevel (light top, dark bottom)" />
  <SettingCheck key="shadowOn" label="Drop shadow">
    {#snippet trailing()}<SettingColor key="shadowColor" label="Shadow color" />{/snippet}
  </SettingCheck>
  <div class="grid grid-cols-2 gap-3.5">
    <SettingSlider key="sdx" label="X" layout="compact" />
    <SettingSlider key="sdy" label="Y" layout="compact" />
  </div>
</Section>
