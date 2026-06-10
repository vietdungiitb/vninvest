/**
 * WP-05: Widget adapters index.
 *
 * Optional subpath import — NOT bundled in core IIFE.
 * Usage:
 *   import { VNInvestDataAdapter } from 'vninvestcharts/adapters';
 */
export { VNInvestClient, resolveApiBase, TIMEFRAME_MAP } from "./VNInvestClient.js";
export { VNInvestWebSocketClient } from "./VNInvestWebSocketClient.js";
export { VNInvestDataAdapter } from "./VNInvestDataAdapter.js";
export { normalizeBarsPagingMeta, buildBackwardPageRequest } from "./barsPagingPolicy.js";
