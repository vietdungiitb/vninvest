export function makePageEntry(routeId, status, loadComponent) {
  return Object.freeze({ routeId, status, loadComponent });
}

export const pageRegistry = Object.freeze([
  makePageEntry('route-no-h1', 'core', () => import('./RouteNoH1Page.tsx').then((m) => m.RouteNoH1Page)),
]);

export function getPageComponent(routeId) {
  const entry = pageRegistry.find((e) => e.routeId === routeId);
  return entry ? entry.loadComponent : null;
}
