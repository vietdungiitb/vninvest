export function makePageEntry(routeId, status, loadComponent) {
  return Object.freeze({ routeId, status, loadComponent });
}

export const pageRegistry = Object.freeze([
  makePageEntry('route-comment-h1', 'core', () => import('./RouteCommentH1Page.tsx').then((m) => m.RouteCommentH1Page)),
]);

export function getPageComponent(routeId) {
  const entry = pageRegistry.find((e) => e.routeId === routeId);
  return entry ? entry.loadComponent : null;
}
