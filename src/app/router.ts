/** Two kinds of page: home at /, and one banner at /b/<id>. Anything else goes home. */
export type Route = { view: 'home' } | { view: 'banner'; id: string };

/** The host must serve index.html for these paths (Vite's dev and preview servers already do). */
export class Router {
  route: Route = { view: 'home' };
  private listeners = new Set<(route: Route) => void>();
  constructor() {
    window.addEventListener('popstate', () => this.read());
    // Same-origin links navigate in place instead of reloading the page.
    document.addEventListener('click', event => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
      event.preventDefault();
      this.navigate(link.pathname);
    });
    this.read();
  }
  subscribe(listener: (route: Route) => void) { this.listeners.add(listener); listener(this.route); }
  static path(route: Route) { return route.view === 'home' ? '/' : `/b/${encodeURIComponent(route.id)}`; }
  go(route: Route, replace = false) { this.navigate(Router.path(route), replace); }
  private navigate(path: string, replace = false) {
    if (path !== location.pathname) history[replace ? 'replaceState' : 'pushState'](null, '', path);
    this.read();
  }
  private read() {
    const [view, id] = location.pathname.split('/').filter(Boolean);
    this.route = view === 'b' && id ? { view: 'banner', id: decodeURIComponent(id) } : { view: 'home' };
    const canonical = Router.path(this.route);
    if (location.pathname !== canonical) history.replaceState(null, '', canonical);
    this.listeners.forEach(listener => listener(this.route));
  }
}
