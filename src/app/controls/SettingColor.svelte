<script lang="ts">
  import { useTracery } from '../context';
  import type { StringKey } from './keys';

  let { key, label }: { key: Extract<StringKey, 'gapFill' | 'outlineColor' | 'lipColor' | 'shineColor' | 'shadowColor' | 'termBg'>; label: string } = $props();
  const app = useTracery();
</script>

<input
  type="color"
  class="swatch"
  aria-label={label}
  value={app.settings[key]}
  oninput={event => app.edit({ [key]: event.currentTarget.value }, key)}
  onchange={() => app.endEdit()}
/>
