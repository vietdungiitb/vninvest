import { pageRegistry } from './pages/pageRegistry.js';

export const PRIMARY_ROUTE = 'route-broken-import';
export const routeIds = pageRegistry.map((entry) => entry.routeId);
