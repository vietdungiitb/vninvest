export function makePageEntry(routeId, status, loadComponent) {
  return Object.freeze({ routeId, status, loadComponent });
}

export const pageRegistry = Object.freeze([
  makePageEntry('route-broken-import', 'core', () => import('./RouteBrokenImportPage.tsx').then((m) => m.RouteBrokenImportPage)),
]);

export function getPageComponent(routeId) {
  const entry = pageRegistry.find((e) => e.routeId === routeId);
  return entry ? entry.loadComponent : null;
}
