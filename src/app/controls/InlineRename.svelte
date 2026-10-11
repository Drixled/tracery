<script lang="ts">
  import { onMount } from 'svelte';
  import { Input } from '$lib/components/ui/input';
  import { cn } from '$lib/utils';

  /** A text field that replaces a name while renaming. Enter or blur commits, Escape cancels. */
  let { value, onDone, class: className }: { value: string; onDone: (name: string | null) => void; class?: string } = $props();
  let input = $state<HTMLInputElement | null>(null);
  let done = false;
  function finish(save: boolean) {
    if (done) return;
    done = true;
    const next = input?.value.trim() ?? '';
    onDone(save && next && next !== value ? next : null);
  }
  // Menus restore focus to their trigger as they close; select the text after that.
  onMount(() => { requestAnimationFrame(() => input?.select()); });
</script>

<Input
  bind:ref={input}
  {value}
  maxlength={128}
  aria-label="Banner name"
  class={cn('h-8', className)}
  onkeydown={event => { if (event.key === 'Enter') finish(true); if (event.key === 'Escape') finish(false); }}
  onblur={() => finish(true)}
/>
