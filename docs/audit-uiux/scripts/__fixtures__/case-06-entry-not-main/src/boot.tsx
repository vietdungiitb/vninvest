import { pageRegistry } from './pages/pageRegistry.js';
import { App } from './App.js';

export const PRIMARY_ROUTE = 'route-from-boot';
export const app = App;
export const routeIds = pageRegistry.map((entry) => entry.routeId);
