<script lang="ts">
  import { SETTINGS_SCHEMA } from '../../engine';
  import { toggleVariants } from '$lib/components/ui/toggle';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import type { ChoiceKey } from './keys';

  /** One-of-many buttons for a schema choice. Unlike a toggle group, the current choice cannot be switched off. */
  let { key, label }: { key: Exclude<ChoiceKey, 'targetCols' | 'fWrap'>; label: string } = $props();
  const app = useTracery();
  const options = $derived.by(() => {
    const rule = SETTINGS_SCHEMA[key];
    return rule.kind === 'choice' ? rule.values.map((value, i) => ({ value: String(value), label: rule.labels?.[i] ?? String(value) })) : [];
  });
</script>

<div role="group" aria-label={label} class="bg-raise flex gap-0.5 rounded-md border p-0.5">
  {#each options as option (option.value)}
    {@const pressed = app.settings[key] === option.value}
    <button
      type="button"
      aria-pressed={pressed}
      class={cn(toggleVariants({ size: 'sm' }), 'h-7 flex-1 px-1 text-xs text-muted-foreground', 'aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:font-semibold aria-pressed:hover:bg-primary')}
      onclick={() => { if (!pressed && app.edit({ [key]: option.value })) app.endEdit(); }}
    >
      {option.label}
    </button>
  {/each}
</div>
