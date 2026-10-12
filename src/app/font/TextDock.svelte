<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SETTINGS_SCHEMA } from '../../engine';
  import { cn } from '$lib/utils';
  import { useTracery } from '../context';

  /**
   * What's being drawn, typed in a bar that sticks to the bottom of the font picker or the preview.
   * Place it last in a scrolling column. `text` (web fonts) also updates `words`, so switching fonts keeps the text.
   * `flush` drops the floating inset so the bar spans its column, right under the preview.
   */
  let { field = 'words', trailing, flush = false }: { field?: 'words' | 'text' | 'ascii'; trailing?: Snippet; flush?: boolean } = $props();
  const app = useTracery();
  const art = $derived(field === 'ascii');
  const maxLength = $derived.by(() => { const rule = SETTINGS_SCHEMA[field]; return rule.kind === 'string' ? rule.maxLength : undefined; });

  function typed(input: HTMLTextAreaElement) {
    const value = input.value;
    if (!app.edit(field === 'text' ? { text: value, words: value } : { [field]: value }, field)) input.value = app.settings[field];
  }
</script>

<div class={cn('pointer-events-none sticky bottom-0 z-20 flex justify-center', flush ? 'pb-[env(safe-area-inset-bottom)]' : 'mt-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]')}>
  <div class={cn('bg-popover/95 pointer-events-auto flex w-full items-end gap-3 rounded-xl border p-2 pl-4 shadow-[0_18px_50px_-12px_#000] backdrop-blur', flush ? 'rounded-[10px]' : art ? 'max-w-[880px]' : 'max-w-[640px]')}>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      rows="1"
      autofocus={!art}
      spellcheck="false"
      maxlength={maxLength}
      aria-label={art ? 'ASCII art' : 'Text'}
      placeholder={art ? 'Paste ASCII art' : 'Type something'}
      value={app.settings[field]}
      class={cn(
        'placeholder:text-faint min-h-9 flex-1 resize-none bg-transparent py-1.5 outline-none [field-sizing:content]',
        art ? 'max-h-72 overflow-auto font-mono text-[11px] leading-[1.15] whitespace-pre [tab-size:4]' : 'max-h-40 text-lg leading-6',
      )}
      oninput={event => typed(event.currentTarget)}
      onchange={() => app.endEdit()}
    ></textarea>
    {#if trailing}<div class="text-faint flex min-h-9 items-center gap-2 pr-1 text-[11px]">{@render trailing()}</div>{/if}
  </div>
</div>
