export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing app element: ${id}`);
  return found as T;
}
export const showMessage = (message: string) => { element('projectMsg').textContent = message; };
