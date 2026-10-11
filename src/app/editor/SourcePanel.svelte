<script lang="ts">
  import { ONEIR_ART, SETTINGS_SCHEMA } from '../../engine';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import Segmented from '../controls/Segmented.svelte';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingSelect from '../controls/SettingSelect.svelte';
  import SettingCheck from '../controls/SettingCheck.svelte';

  const app = useTracery();
  const S = $derived(app.settings);
  let dragging = $state(false);
  const limit = (key: 'ascii' | 'text') => { const rule = SETTINGS_SCHEMA[key]; return rule.kind === 'string' ? rule.maxLength : undefined; };

  function typed(key: 'ascii' | 'text', field: HTMLTextAreaElement) {
    // A rejected edit, such as too many lines, puts the last accepted text back.
    if (!app.edit({ [key]: field.value }, key)) field.value = app.settings[key];
  }
  function dropped(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    app.loadImage(event.dataTransfer?.files[0]);
  }
  const field = 'dark:bg-well bg-well field-sizing-fixed font-mono [tab-size:4]';
</script>

<Segmented key="src" label="Source" />

{#if S.src === 'ascii'}
  <div class="flex min-w-0 flex-col gap-2.5">
    <Textarea
      aria-label="ASCII art source"
      spellcheck="false"
      maxlength={limit('ascii')}
      value={S.ascii}
      class={cn(field, 'min-h-[190px] resize-y overflow-auto text-[11px] leading-[1.15] whitespace-pre md:text-[11px]')}
      oninput={event => typed('ascii', event.currentTarget)}
      onchange={() => app.endEdit()}
    />
    <SettingSlider key="cw" label="Char width" />
    <SettingSlider key="ch" label="Char height" />
    <SettingCheck key="glyph" label="Shape punctuation (dots sit low, quotes sit high)" />
    <div><Button variant="outline" size="xs" onclick={() => app.edit({ ascii: ONEIR_ART })}>Load the Oneir sample</Button></div>
  </div>
{:else if S.src === 'text'}
  <div class="flex min-w-0 flex-col gap-2.5">
    <Textarea
      aria-label="Text to render"
      spellcheck="false"
      maxlength={limit('text')}
      value={S.text}
      class={cn(field, 'min-h-16 text-[13px] md:text-[13px]')}
      oninput={event => typed('text', event.currentTarget)}
      onchange={() => app.endEdit()}
    />
    <SettingSelect key="font" label="Font" fonts />
    <SettingSlider key="size" label="Height px" />
    <SettingSlider key="tracking" label="Tracking" />
    <SettingSlider key="leading" label="Line gap" />
    <p class="text-muted-foreground m-0 text-[11px]">Pixel fonts look crispest at multiples of 8.</p>
  </div>
{:else}
  <div class="flex min-w-0 flex-col gap-2.5">
    <label
      class={cn(
        'text-muted-foreground relative flex cursor-pointer items-center justify-center rounded-md border border-dashed px-3.5 py-6.5 text-center text-xs',
        'bg-[repeating-linear-gradient(-45deg,transparent_0_8px,var(--line-soft)_8px_9px)] hover:border-primary hover:text-foreground focus-within:border-primary focus-within:text-foreground',
        dragging && 'border-primary text-foreground',
      )}
      ondragenter={event => { event.preventDefault(); dragging = true; }}
      ondragover={event => { event.preventDefault(); dragging = true; }}
      ondragleave={event => { event.preventDefault(); dragging = false; }}
      ondrop={dropped}
    >
      <input type="file" accept="image/*" class="sr-only" onchange={event => { app.loadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
      <span>{app.source ? `${app.source.name} · Saved in this project.` : 'Drop a PNG or click to choose. Transparent logos work best.'}</span>
    </label>
    <SettingSlider key="imgW" label="Width px" />
    <SettingSlider key="thresh" label="Threshold" />
    <SettingSelect key="imgUse" label="Keep pixels" />
    <SettingCheck key="imgColors" label="Use the image's own colors for the fill" />
  </div>
{/if}
