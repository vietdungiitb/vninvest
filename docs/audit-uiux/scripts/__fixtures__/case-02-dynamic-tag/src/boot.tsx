import { pageRegistry } from './pages/pageRegistry.js';

export const PRIMARY_ROUTE = 'route-dynamic-tag';
export const routeIds = pageRegistry.map((entry) => entry.routeId);
