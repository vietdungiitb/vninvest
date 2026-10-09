export function makePageEntry(routeId, status, loadComponent) {
  return Object.freeze({ routeId, status, loadComponent });
}

export const pageRegistry = Object.freeze([
  makePageEntry('live', 'core', () => import('./LivePage.tsx').then((m) => m.LivePage)),
  // Entry dưới đây không route nào tham chiếu — phải bị báo, không âm thầm bỏ.
  makePageEntry('orphan', 'core', () => import('./OrphanPage.tsx').then((m) => m.OrphanPage)),
]);

export function getPageComponent(routeId) {
  const entry = pageRegistry.find((e) => e.routeId === routeId);
  return entry ? entry.loadComponent : null;
}
