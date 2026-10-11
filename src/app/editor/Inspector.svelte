<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs';
  import { useTracery } from '../context';
  import { PANELS, type Panel } from '../tracery.svelte';
  import SourcePanel from './SourcePanel.svelte';
  import ColorPanel from './ColorPanel.svelte';
  import ShapePanel from './ShapePanel.svelte';
  import OutputPanel from './OutputPanel.svelte';

  const app = useTracery();
  const LABELS: Record<Panel, string> = { source: 'Source', color: 'Color', shape: 'Shape', output: 'Output' };
  const pane = 'flex flex-col gap-3.5 px-4.5 pt-4.5 pb-7 motion-safe:data-active:animate-in motion-safe:data-active:fade-in-0 motion-safe:data-active:slide-in-from-bottom-1';
</script>

<aside class="bg-panel min-h-0 min-w-0 flex-1 border-t border-line-soft studio:overflow-auto studio:border-t-0" aria-label="Banner controls">
  <Tabs.Root bind:value={() => app.panel, value => app.setPanel(value as Panel)} class="gap-0">
    <Tabs.List variant="line" class="bg-panel sticky top-0 z-10 grid h-auto w-full grid-cols-4 rounded-none border-b border-line-soft p-0">
      {#each PANELS as panel (panel)}
        <Tabs.Trigger
          value={panel}
          class="text-muted-foreground hover:text-foreground data-active:text-foreground -mb-px h-11 rounded-none border-0 border-b-2 border-transparent text-[13px] font-normal after:hidden data-active:border-b-primary dark:data-active:border-b-primary"
        >
          {LABELS[panel]}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
    <Tabs.Content value="source" class={pane}><SourcePanel /></Tabs.Content>
    <Tabs.Content value="color" class={pane}><ColorPanel /></Tabs.Content>
    <Tabs.Content value="shape" class={pane}><ShapePanel /></Tabs.Content>
    <Tabs.Content value="output" class={pane}><OutputPanel /></Tabs.Content>
  </Tabs.Root>
</aside>
