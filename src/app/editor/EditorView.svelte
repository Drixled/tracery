<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import * as Resizable from '$lib/components/ui/resizable';
  import { useTracery } from '../context';
  import TopBar from './TopBar.svelte';
  import Stage from './Stage.svelte';
  import Inspector from './Inspector.svelte';
  import ExportDialog from './ExportDialog.svelte';

  const app = useTracery();
  // Matches the `studio` breakpoint in app.css. Narrower screens stack the preview over the controls.
  const wide = new MediaQuery('min-width: 860px');

  function keydown(event: KeyboardEvent) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || app.busy || app.exportOpen) return;
    // Text fields keep their native undo.
    if ((event.target as HTMLElement).closest('textarea, input:not([type=range]):not([type=color]):not([type=checkbox]), [contenteditable=true]')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' || (event.ctrlKey && key === 'y')) {
      event.preventDefault();
      app.travel(event.shiftKey || key === 'y' ? 'redo' : 'undo');
    }
  }
  function paste(event: ClipboardEvent) {
    if (!app.exportOpen) app.loadImage([...(event.clipboardData?.files ?? [])].find(file => file.type.startsWith('image/')));
  }
</script>

<svelte:window onkeydown={keydown} onpaste={paste} />

<div class="flex min-h-0 flex-1 flex-col">
  <TopBar />
  {#if wide.current}
    <Resizable.PaneGroup direction="horizontal" autoSaveId="tracery:workspace" class="min-h-0 flex-1">
      <Resizable.Pane defaultSize={72} minSize={40} class="flex min-w-0 flex-col"><Stage /></Resizable.Pane>
      <Resizable.Handle class="bg-line-soft" />
      <Resizable.Pane defaultSize={28} minSize={22} maxSize={50} class="flex min-w-0 flex-col"><Inspector /></Resizable.Pane>
    </Resizable.PaneGroup>
  {:else}
    <Stage />
    <Inspector />
  {/if}
</div>

<ExportDialog />
