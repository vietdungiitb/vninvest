import { pageRegistry } from './pages/pageRegistry.js';

// CHỈ tham chiếu 'live'. 'orphan' cố tình không xuất hiện ở đâu trong cây entry.
export const LIVE_ROUTE = 'live';
export const routeIds = pageRegistry.map((entry) => entry.routeId);
