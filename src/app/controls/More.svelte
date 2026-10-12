<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRightIcon from '~icons/heroicons/chevron-right-16-solid';

  /** Fine-tuning that most people never need, folded away under a "More" toggle. */
  let { label = 'More', children }: { label?: string; children: Snippet } = $props();
</script>

<details class="group/more">
  <summary class="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] select-none [&::-webkit-details-marker]:hidden">
    <ChevronRightIcon class="size-3.5 transition-transform group-open/more:rotate-90 motion-reduce:transition-none" />{label}
  </summary>
  <div class="mt-2.5 flex flex-col gap-2.5">{@render children()}</div>
</details>
