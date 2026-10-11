<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { useTracery } from '../context';
  import type { BooleanKey } from './keys';

  interface Props {
    key: BooleanKey;
    label: string;
    /** Shown at the end of the row, usually the color this option paints with. */
    trailing?: Snippet;
  }
  let { key, label, trailing }: Props = $props();
  const app = useTracery();
  const id = $props.id();
</script>

<div class="flex min-h-6 items-center gap-2">
  <Checkbox {id} checked={app.settings[key]} onCheckedChange={checked => { if (app.edit({ [key]: checked })) app.endEdit(); }} />
  <label for={id} class="flex-1 cursor-pointer text-xs">{label}</label>
  {@render trailing?.()}
</div>
