<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import XIcon from '~icons/heroicons/x-mark-16-solid';
  import { buildDownload, buildExport, rasterizeCells, type ExportKind, type RenderResult } from '../../engine';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { useTracery } from '../context';
  import { downloadBlob } from '../downloads';
  import Segmented from '../controls/Segmented.svelte';
  import SettingSlider from '../controls/SettingSlider.svelte';
  import SettingCheck from '../controls/SettingCheck.svelte';

  const FORMATS: { kind: ExportKind; title: string; detail: string }[] = [
    { kind: 'install', title: 'Install command', detail: "Set it as a server's login banner" },
    { kind: 'agent', title: 'Agent prompt', detail: 'Let a coding agent install it' },
    { kind: 'printf', title: 'printf', detail: 'One line, paste anywhere' },
    { kind: 'raw', title: 'Raw ANSI', detail: 'The escape codes, nothing else' },
    { kind: 'png', title: 'PNG', detail: 'A picture of the banner' },
    { kind: 'graphics', title: 'Terminal image', detail: 'Kitty, Ghostty or iTerm2 graphics' },
    { kind: 'json', title: 'Project file', detail: 'Settings and source, to edit later' },
  ];
  const EXTENSIONS: Record<ExportKind, string> = { install: '.sh', agent: '.txt', printf: '.sh', raw: '.ansi', png: '.png', graphics: '.sh', json: '.json' };

  const app = useTracery();
  let tab = $state<ExportKind>(saved());
  function saved(): ExportKind {
    try { const value = localStorage.getItem('tracery:tab') ?? localStorage.getItem('ansi-kiln:tab'); if (FORMATS.some(f => f.kind === value)) return value as ExportKind; } catch { /* Optional preference. */ }
    return 'install';
  }
  function select(kind: ExportKind) {
    tab = kind;
    try { localStorage.setItem('tracery:tab', kind); } catch { /* Optional preference. */ }
  }
  const needsPng = $derived(tab === 'png' || tab === 'graphics');

  // The PNG is encoded off the main path, a moment after its inputs settle. Each input set is one object, compared by identity.
  const cell = $derived(app.settings.pngCell);
  const ratio = $derived(app.settings.ratio);
  const background = $derived(app.settings.pngTransparent ? null : app.settings.termBg);
  const pngInput = $derived({ result: app.result, cell, ratio, background });
  type PngInput = typeof pngInput;
  let png = $state.raw<{ input: PngInput; bytes: Uint8Array; url: string } | null>(null);
  let pngError = $state.raw<{ input: PngInput; message: string } | null>(null);
  const fresh = $derived(png?.input === pngInput ? png : null);
  const failed = $derived(pngError?.input === pngInput ? pngError.message : '');

  async function encode({ result, cell, ratio, background }: { result: RenderResult; cell: number; ratio: number; background: string | null }) {
    const raster = rasterizeCells(result.rows, result.cols, cell, ratio, background);
    const canvas = document.createElement('canvas');
    canvas.width = raster.width; canvas.height = raster.height;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not encode the PNG. Reduce Cell px or the source size.');
    return { blob, bytes: new Uint8Array(await blob.arrayBuffer()) };
  }
  $effect(() => {
    if (!app.exportOpen || !needsPng) return;
    const input = pngInput;
    if (!input.result.lines || untrack(() => png?.input === input || pngError?.input === input)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      encode(input).then(
        ({ blob, bytes }) => {
          if (cancelled) return;
          if (png) URL.revokeObjectURL(png.url);
          png = { input, bytes, url: URL.createObjectURL(blob) };
        },
        e => { if (!cancelled) pngError = { input, message: (e as Error).message }; },
      );
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  });
  onDestroy(() => { if (png) URL.revokeObjectURL(png.url); });

  const output = $derived(app.exportOpen ? buildExport(tab, app.settings, app.result, { project: app.project, png: fresh?.bytes }) : null);
  const disabled = $derived(tab !== 'json' && (!app.result.lines || (needsPng && !fresh)));
  let pre = $state<HTMLPreElement | null>(null);

  let flash = $state('');
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  function say(text: string) { flash = text; clearTimeout(flashTimer); flashTimer = setTimeout(() => { flash = ''; }, 1600); }
  async function copy() {
    if (tab === 'png') {
      try { if (fresh) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([fresh.bytes as BlobPart], { type: 'image/png' }) })]); say('Copied'); } }
      catch { say('Use Download instead'); }
      return;
    }
    if (!output) return;
    try { await navigator.clipboard.writeText(output.text); say('Copied'); }
    catch {
      const range = document.createRange(); if (pre) range.selectNodeContents(pre);
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      say('Selected, press Ctrl/Cmd+C');
    }
  }
  async function download() {
    const file = buildDownload(tab, app.settings, app.result, { project: app.project, png: fresh?.bytes });
    try { await downloadBlob(file.filename, file.data, file.mime); } catch (e) { toast.error((e as Error).message); }
  }
  function named(field: HTMLInputElement) {
    if (!app.edit({ name: field.value }, 'name')) field.value = app.settings.name;
  }
  const shows = (...kinds: ExportKind[]) => kinds.includes(tab);
</script>

<Dialog.Root bind:open={app.exportOpen}>
  <Dialog.Content
    showCloseButton={false}
    class="bg-panel flex h-[min(680px,calc(100vh-48px))] w-[min(960px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
  >
    <header class="flex items-center justify-between border-b border-line-soft py-2.5 pr-3 pl-5">
      <Dialog.Title class="text-sm font-semibold">Export</Dialog.Title>
      <Dialog.Close>
        {#snippet child({ props })}<Button {...props} variant="ghost" size="icon-sm" aria-label="Close"><XIcon /></Button>{/snippet}
      </Dialog.Close>
    </header>
    <Dialog.Description class="sr-only">Choose a format, then copy or download the banner.</Dialog.Description>

    <div class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] studio:grid-cols-[260px_minmax(0,1fr)] studio:grid-rows-1">
      <nav aria-label="Export formats" class="flex gap-0.5 overflow-auto border-b border-line-soft p-2.5 studio:flex-col studio:border-r studio:border-b-0">
        {#each FORMATS as format (format.kind)}
          <button
            type="button"
            aria-current={tab === format.kind}
            class="aria-[current=true]:border-l-primary aria-[current=true]:bg-raise hover:bg-raise group flex flex-none cursor-pointer flex-col gap-px rounded-md border-l-2 border-transparent px-3 py-2 text-left transition-colors motion-reduce:transition-none"
            onclick={() => select(format.kind)}
          >
            <b class="font-medium">{format.title}</b>
            <small class="text-faint group-aria-[current=true]:text-muted-foreground hidden text-[11px] studio:block">{format.detail}</small>
          </button>
        {/each}
      </nav>

      <div class="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {#if !shows('raw', 'json')}
          <div class="flex max-w-[520px] flex-col gap-2.5 px-5 pt-4.5">
            {#if shows('install', 'agent', 'printf', 'graphics')}
              <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2.5">
                <label for="export-name" class="text-muted-foreground text-xs">Banner name</label>
                <Input id="export-name" value={app.settings.name} maxlength={128} spellcheck="false" class="h-8 text-xs md:text-xs" oninput={event => named(event.currentTarget)} onchange={() => app.endEdit()} />
              </div>
            {/if}
            {#if shows('png', 'graphics')}
              <SettingSlider key="pngCell" label="Cell px" />
              <SettingCheck key="pngTransparent" label="Transparent background" />
            {/if}
            {#if shows('graphics')}
              <Segmented key="gfxProto" label="Graphics protocol" />
              <SettingSlider key="gfxCols" label="Show at cols" format={value => (value ? String(value) : 'auto')} />
            {/if}
          </div>
        {/if}

        <div class="flex min-h-0 flex-1 flex-col gap-3 px-5 pt-4.5 pb-5">
          <p class="text-muted-foreground m-0 max-w-[70ch] text-xs">{needsPng && failed ? failed : output?.note}</p>
          <div class="flex gap-2">
            <Button size="sm" class="font-semibold" {disabled} onclick={copy}>{flash || (tab === 'png' ? 'Copy image' : 'Copy')}</Button>
            <Button size="sm" variant="outline" {disabled} onclick={download}>Download {EXTENSIONS[tab]}</Button>
          </div>
          {#if tab === 'png'}
            <div class="checkerboard min-h-0 flex-1 overflow-auto rounded-md border p-3">
              {#if fresh}<img src={fresh.url} alt="PNG export of the banner" class="block h-auto max-w-full [image-rendering:pixelated]" />{/if}
            </div>
          {:else}
            <!-- Focusable so the output can be scrolled and selected from the keyboard. -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <pre
              bind:this={pre}
              tabindex="0"
              aria-label="Export output"
              class="bg-well m-0 min-h-0 flex-1 overflow-auto rounded-md border p-3 text-[11px] leading-[1.45] break-all whitespace-pre-wrap text-[#cfc5b8]"
            >{tab === 'raw' ? output?.text.replace(/\x1b/g, '␛') : output?.text}</pre>
          {/if}
        </div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
