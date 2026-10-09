import { pageRegistry } from './pages/pageRegistry.js';

export const PRIMARY_ROUTE = 'route-deep';
export const routeIds = pageRegistry.map((entry) => entry.routeId);
