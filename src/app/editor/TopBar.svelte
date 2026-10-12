<script lang="ts">
  import ChevronDownIcon from '~icons/heroicons/chevron-down-16-solid';
  import UndoIcon from '~icons/heroicons/arrow-uturn-left-16-solid';
  import RedoIcon from '~icons/heroicons/arrow-uturn-right-16-solid';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';
  import InlineRename from '../controls/InlineRename.svelte';
  import ConfirmDelete from '../controls/ConfirmDelete.svelte';

  const app = useTracery();
  const name = $derived(app.open?.name ?? 'Untitled banner');
  const mod = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';
  let renaming = $state(false);
  let confirming = $state(false);
</script>

<header class="bg-background flex h-14 flex-none items-center justify-between gap-x-4 border-b border-line-soft px-3.5 pt-[env(safe-area-inset-top,0px)] studio:pl-5">
  <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-2.5">
    <a href="/" title="All banners" class="wordmark shrink-0 text-[15px]">Tracery</a>
    <span class="text-faint" aria-hidden="true">/</span>
    {#if renaming}
      <InlineRename value={name} class="w-[260px]" onDone={next => { renaming = false; if (next) app.rename(next); }} />
    {:else}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'min-w-0 font-medium')} title="Banner options">
          <span class="max-w-[40vw] truncate">{name}</span>
          <ChevronDownIcon class="text-muted-foreground" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="min-w-52" onCloseAutoFocus={event => { if (renaming) event.preventDefault(); }}>
          <DropdownMenu.Item onSelect={() => { renaming = true; }}>Rename</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => app.duplicate()}>Duplicate</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => app.downloadProject()}>Download project file</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item variant="destructive" onSelect={() => { confirming = true; }}>Delete…</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
  </nav>


  <div class="flex items-center gap-2">
    <span role="status" class="text-muted-foreground mr-1.5 hidden text-[11px] whitespace-nowrap studio:inline">{app.saveStatus}</span>
    <div class="flex gap-0.5">
      {#each [{ direction: 'undo', label: 'Undo', keys: `${mod}Z`, enabled: app.canUndo, Icon: UndoIcon }, { direction: 'redo', label: 'Redo', keys: `${mod}Shift+Z`, enabled: app.canRedo, Icon: RedoIcon }] as const as action (action.direction)}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="ghost" size="icon-sm" aria-label={action.label} disabled={!action.enabled} onclick={() => app.travel(action.direction)}>
                <action.Icon />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>{action.label} <span class="opacity-60">{action.keys}</span></Tooltip.Content>
        </Tooltip.Root>
      {/each}
    </div>
    <Button size="sm" class="font-semibold" onclick={() => { app.exportOpen = true; }}>Export</Button>
  </div>
</header>

<ConfirmDelete bind:open={confirming} {name} onConfirm={() => app.deleteOpen()} />
