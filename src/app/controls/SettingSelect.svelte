<script lang="ts">
  import { DEFAULTS, SETTINGS_SCHEMA } from '../../engine';
  import * as Select from '$lib/components/ui/select';
  import { useTracery } from '../context';
  import type { ChoiceKey } from './keys';

  interface Props {
    key: ChoiceKey;
    label: string;
    /** Preview each font option in its own face. */
    fonts?: boolean;
  }
  let { key, label, fonts = false }: Props = $props();
  const app = useTracery();
  const id = $props.id();
  const options = $derived.by(() => {
    const rule = SETTINGS_SCHEMA[key];
    return rule.kind === 'choice' ? rule.values.map((value, i) => ({ value: String(value), label: rule.labels?.[i] ?? String(value) })) : [];
  });
  const value = $derived(String(app.settings[key]));
  const selected = $derived(options.find(option => option.value === value)?.label ?? value);

  function choose(next: string) {
    if (!next || next === value) return;
    if (!app.edit({ [key]: typeof DEFAULTS[key] === 'number' ? Number(next) : next })) return;
    app.endEdit();
    if (key === 'font') app.loadFont();
  }
</script>

<div class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2.5">
  <label for={id} class="text-muted-foreground text-xs">{label}</label>
  <Select.Root type="single" {value} onValueChange={choose}>
    <Select.Trigger {id} size="sm" class="w-full text-xs" style={fonts ? `font-family: "${value}"` : undefined}>
      {selected}
    </Select.Trigger>
    <Select.Content>
      {#each options as option (option.value)}
        <Select.Item value={option.value} label={option.label} class="text-xs" style={fonts ? `font-family: "${option.value}"; font-size: 14px` : undefined}>
          {option.label}
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>
