import { pageRegistry } from './pages/pageRegistry.js';

export const PRIMARY_ROUTE = 'route-comment-h1';
export const routeIds = pageRegistry.map((entry) => entry.routeId);
