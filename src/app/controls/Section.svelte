<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A titled group of controls in the side panel, separated from the previous group by a dashed rule. */
  let { title, tools, children }: { title?: string; tools?: Snippet; children: Snippet } = $props();
</script>

<section class="flex min-w-0 flex-col gap-2.5 [&+&]:mt-0.5 [&+&]:border-t [&+&]:border-dashed [&+&]:pt-4">
  {#if title}
    <h3 class="eyebrow flex items-center justify-between">
      {title}
      {#if tools}<span class="text-foreground flex gap-1.5 font-sans tracking-normal normal-case">{@render tools()}</span>{/if}
    </h3>
  {/if}
  {@render children()}
</section>
