export interface MenuItem {
  label: string;
  run: () => void;
  danger?: boolean;
  /** Ask for a second click before running, for actions that cannot be undone. */
  confirm?: string;
}
let closeOpen: (() => void) | null = null;

/** A small dropdown under its button. Closes on Escape, outside clicks, or after an item runs. */
export function attachMenu(button: HTMLButtonElement, items: () => MenuItem[]) {
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', event => {
    event.stopPropagation();
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    closeOpen?.();
    if (wasOpen) return;
    const menu = document.createElement('div'); menu.className = 'menu'; menu.setAttribute('role', 'menu');
    for (const item of items()) {
      const entry = document.createElement('button'); entry.type = 'button'; entry.setAttribute('role', 'menuitem'); entry.textContent = item.label;
      if (item.danger) entry.classList.add('danger');
      entry.onclick = event => {
        event.stopPropagation();
        if (item.confirm && !entry.classList.contains('confirm')) { entry.classList.add('confirm'); entry.textContent = item.confirm; return; }
        close(); item.run();
      };
      menu.append(entry);
    }
    const close = () => { menu.remove(); button.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); document.removeEventListener('keydown', escape); closeOpen = null; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { close(); button.focus(); } };
    const box = button.getBoundingClientRect();
    menu.style.top = `${box.bottom + 4}px`;
    document.body.append(menu);
    menu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - menu.offsetWidth - 8))}px`;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', close); document.addEventListener('keydown', escape);
    window.addEventListener('scroll', close, { once: true, capture: true });
    closeOpen = close;
    menu.querySelector<HTMLButtonElement>('button')?.focus();
  });
}

/** Swap a label for a text field. Enter or blur commits, Escape cancels. */
export function editInPlace(label: HTMLElement, value: string, commit: (value: string) => void) {
  const input = document.createElement('input'); input.type = 'text'; input.value = value; input.maxLength = 128; input.className = 'rename';
  input.setAttribute('aria-label', 'Banner name');
  let done = false;
  const finish = (save: boolean) => {
    if (done) return; done = true;
    input.replaceWith(label);
    const next = input.value.trim();
    if (save && next && next !== value) commit(next);
  };
  input.onkeydown = event => { if (event.key === 'Enter') finish(true); if (event.key === 'Escape') finish(false); };
  input.onblur = () => finish(true);
  label.replaceWith(input); input.select();
}
