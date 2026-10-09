export function makePageEntry(routeId, status, loadComponent) {
  return Object.freeze({ routeId, status, loadComponent });
}

export const pageRegistry = Object.freeze([
  makePageEntry('route-deep', 'core', () => import('./RouteDeepPage.tsx').then((m) => m.RouteDeepPage)),
]);

export function getPageComponent(routeId) {
  const entry = pageRegistry.find((e) => e.routeId === routeId);
  return entry ? entry.loadComponent : null;
}
