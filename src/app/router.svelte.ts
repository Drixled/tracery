/** A banner shows the editor, or the font picker over it. */
export type Step = 'font' | 'style';
/** Home at /, and one banner at /b/<id>, with its font picker at /b/<id>/font. Anything else goes home. */
export type Route = { view: 'home' } | { view: 'banner'; id: string; step: Step };

export const routePath = (route: Route) =>
  route.view === 'home' ? '/' : `/b/${encodeURIComponent(route.id)}${route.step === 'style' ? '' : `/${route.step}`}`;

/** The host must serve index.html for these paths (Vite's dev and preview servers already do). */
export class Router {
  route = $state.raw<Route>({ view: 'home' });
  private listeners = new Set<(route: Route) => void>();
  constructor() {
    window.addEventListener('popstate', () => this.read());
    // Same-origin links navigate in place instead of reloading the page.
    document.addEventListener('click', event => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
      event.preventDefault();
      this.navigate(link.pathname);
    });
    this.read();
  }
  subscribe(listener: (route: Route) => void) { this.listeners.add(listener); listener(this.route); }
  go(route: Route, replace = false) { this.navigate(routePath(route), replace); }
  private navigate(path: string, replace = false) {
    if (path !== location.pathname) history[replace ? 'replaceState' : 'pushState'](null, '', path);
    this.read();
  }
  private read() {
    const [view, id, step] = location.pathname.split('/').filter(Boolean);
    let decoded = '';
    try { decoded = view === 'b' && id ? decodeURIComponent(id) : ''; } catch { /* A malformed address goes home. */ }
    this.route = decoded ? { view: 'banner', id: decoded, step: step === 'font' ? 'font' : 'style' } : { view: 'home' };
    const canonical = routePath(this.route);
    if (location.pathname !== canonical) history.replaceState(null, '', canonical);
    this.listeners.forEach(listener => listener(this.route));
  }
}
