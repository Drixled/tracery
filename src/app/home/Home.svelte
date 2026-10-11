<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { useTracery } from '../context';
  import BannerCard from './BannerCard.svelte';

  /** Home: every banner in this browser, newest edit first. */
  const app = useTracery();
  let importInput = $state<HTMLInputElement | null>(null);

  function importChosen(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void app.importFile(file);
  }
</script>

<header class="bg-background flex h-14 flex-none items-center justify-between gap-4 border-b border-line-soft pr-3.5 pl-5 pt-[env(safe-area-inset-top,0px)]">
  <a href="/" class="flex items-center"><h1 class="wordmark m-0 text-xl">Tracery</h1></a>
  <div class="flex items-center gap-2">
    <input bind:this={importInput} type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-hidden="true" onchange={importChosen} />
    <Button variant="outline" size="sm" onclick={() => importInput?.click()}>Import</Button>
    <Button size="sm" class="font-semibold" onclick={() => app.newBanner()}>New banner</Button>
  </div>
</header>

<main class="flex-1 overflow-auto px-4 pt-6 pb-12 md:px-10 md:pt-9 md:pb-16">
  <div class="mx-auto max-w-[1280px]">
    {#if app.banners?.length}
      <h2 class="text-muted-foreground mb-4.5 text-[13px] font-medium">Recent</h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-5 gap-y-6">
        {#each app.banners as banner (banner.id)}
          <BannerCard {banner} />
        {/each}
      </div>
    {:else if app.banners}
      <div class="text-muted-foreground flex flex-col items-center gap-5 px-4 py-[18vh] text-center">
        <p class="max-w-[46ch]">Paste ASCII art, type a word or drop a logo, and turn it into a colored terminal banner.</p>
        <Button size="lg" class="px-5 font-semibold" onclick={() => app.newBanner()}>Make your first banner</Button>
      </div>
    {/if}
  </div>
</main>
