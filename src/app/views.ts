import { element as $ } from './dom';
type View = 'library' | 'editor' | 'export';
type Inspector = 'source' | 'color' | 'shape' | 'output';

/** Desktop workspace navigation has no effect on the current project or history. */
export class Views {
  private current: View = 'editor';
  private active: Inspector = 'source';
  constructor(private refresh: () => void) {
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.onclick = () => this.open(button.dataset.view as View));
    document.querySelectorAll<HTMLButtonElement>('[data-inspector]').forEach(button => button.onclick = () => this.inspect(button.dataset.inspector as Inspector));
    $('resumeDraft').onclick = () => this.open('editor');
    setupTabKeys($('inspectorView'));
    window.addEventListener('hashchange', () => this.route());
    this.route();
  }
  private route() {
    const [view, inspector] = location.hash.slice(1).split('/');
    if (['library', 'editor', 'export'].includes(view)) this.current = view as View;
    if (['source', 'color', 'shape', 'output'].includes(inspector)) this.active = inspector as Inspector;
    this.sync();
  }
  open(view: View) { this.current = view; this.sync(); this.url(); }
  inspect(inspector: Inspector) { this.current = 'editor'; this.active = inspector; this.sync(); this.url(); }
  private url() { history.replaceState(null, '', `#${this.current}${this.current === 'editor' ? `/${this.active}` : ''}`); }
  private sync() {
    $('libraryView').hidden = this.current !== 'library';
    $('workspace').hidden = this.current === 'library';
    $('inspectorView').hidden = this.current !== 'editor';
    $('exportView').hidden = this.current !== 'export';
    $('workspace').classList.toggle('exporting', this.current === 'export');
    document.querySelectorAll<HTMLElement>('[data-view]').forEach(button => button.setAttribute('aria-current', button.dataset.view === this.current ? 'page' : 'false'));
    document.querySelectorAll<HTMLElement>('[data-inspector-pane]').forEach(pane => { pane.hidden = pane.dataset.inspectorPane !== this.active; });
    document.querySelectorAll<HTMLButtonElement>('[data-inspector]').forEach(button => { const selected = button.dataset.inspector === this.active; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
    this.refresh();
  }
}
export function setupTabKeys(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[role=tablist]').forEach(list => list.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = [...list.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click(); buttons[next].focus();
  }));
}
