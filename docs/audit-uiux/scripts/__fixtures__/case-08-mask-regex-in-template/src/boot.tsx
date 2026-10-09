import { pageRegistry } from './pages/pageRegistry.js';

export const PRIMARY_ROUTE = 'route-after-template';
export const routeIds = pageRegistry.map((entry) => entry.routeId);