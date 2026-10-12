<script lang="ts">
  import EllipsisIcon from '~icons/heroicons/ellipsis-horizontal-16-solid';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { buttonVariants } from '$lib/components/ui/button';
  import type { SavedProject } from '../storage';
  import { routePath } from '../router.svelte';
  import { useTracery } from '../context';
  import InlineRename from '../controls/InlineRename.svelte';
  import ConfirmDelete from '../controls/ConfirmDelete.svelte';

  let { banner }: { banner: SavedProject } = $props();
  const app = useTracery();
  const href = $derived(routePath({ view: 'banner', id: banner.id, step: 'style' }));
  let renaming = $state(false);
  let confirming = $state(false);

  const ago = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  function edited(time: number) {
    const minutes = Math.round((time - Date.now()) / 60000);
    if (minutes > -1) return 'Edited just now';
    if (minutes > -60) return `Edited ${ago.format(minutes, 'minute')}`;
    if (minutes > -1440) return `Edited ${ago.format(Math.round(minutes / 60), 'hour')}`;
    if (minutes > -10080) return `Edited ${ago.format(Math.round(minutes / 1440), 'day')}`;
    return `Edited ${new Date(time).toLocaleDateString()}`;
  }
</script>

<article class="flex min-w-0 flex-col gap-2.5">
  <a
    {href}
    aria-label={`Open ${banner.name}`}
    class="block aspect-[2/1] overflow-hidden rounded-lg bg-[#0c0c0c] shadow-[0_0_0_1px_var(--border)] transition-shadow hover:shadow-[0_0_0_2px_var(--primary)] motion-reduce:transition-none"
  >
    {#if banner.thumbnail}
      <img src={banner.thumbnail} alt="" class="block size-full object-contain [image-rendering:pixelated]" />
    {/if}
  </a>
  <div class="flex items-start gap-2 px-0.5">
    <div class="flex min-w-0 flex-1 flex-col gap-px">
      {#if renaming}
        <InlineRename
          value={banner.name}
          class="h-7 px-1.5"
          onDone={name => { renaming = false; if (name) void app.renameBanner(banner, name); }}
        />
      {:else}
        <a {href} class="truncate font-medium">{banner.name}</a>
      {/if}
      <small class="text-faint text-[11px]">{edited(banner.updatedAt)}</small>
    </div>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon-xs' })} aria-label={`Options for ${banner.name}`}>
        <EllipsisIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-44" onCloseAutoFocus={event => { if (renaming) event.preventDefault(); }}>
        <DropdownMenu.Item onSelect={() => app.openBanner(banner.id)}>Open</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => { renaming = true; }}>Rename</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => app.duplicateBanner(banner)}>Duplicate</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="destructive" onSelect={() => { confirming = true; }}>Delete…</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</article>

<ConfirmDelete bind:open={confirming} name={banner.name} onConfirm={() => app.deleteBanner(banner)} />
