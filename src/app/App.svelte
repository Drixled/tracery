<script lang="ts">
  import { Toaster } from '$lib/components/ui/sonner';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { buttonVariants } from '$lib/components/ui/button';
  import { provideTracery } from './context';
  import type { Tracery } from './tracery.svelte';
  import Home from './home/Home.svelte';
  import EditorView from './editor/EditorView.svelte';

  let { app }: { app: Tracery } = $props();
  // The app object is created once in main.ts and never replaced.
  // svelte-ignore state_referenced_locally
  provideTracery(app);

  const title = $derived(
    app.view === 'editor' && app.open ? `${app.open.name} · Tracery` : app.view === 'missing' ? 'Not found · Tracery' : 'Tracery',
  );
</script>

<svelte:head><title>{title}</title></svelte:head>
<svelte:window onpagehide={() => { void app.flush(); }} />
<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'hidden') void app.flush(); }} />

<Tooltip.Provider delayDuration={400}>
  {#if app.fatal}
    <p class="text-destructive m-auto p-6 text-center">{app.fatal}</p>
  {:else if app.view === 'home'}
    <Home />
  {:else if app.view === 'editor'}
    <EditorView />
  {:else if app.view === 'missing'}
    <main class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p class="max-w-[48ch]">This banner isn't in this browser. It may have been deleted, or made on another computer.</p>
      <a class={buttonVariants({ variant: 'outline', size: 'sm' })} href="/">Back to all banners</a>
    </main>
  {/if}
</Tooltip.Provider>
<Toaster position="bottom-center" />
