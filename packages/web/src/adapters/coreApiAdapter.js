/**
 * coreApiAdapter.js (Facade)
 *
 * Re-exports the modular clients from packages/web/src/adapters/core/ domains.
 * Maintains full backward compatibility with all packages/web shell pages.
 */

import {
  createCoreTransport,
  authTokenStorage,
  CoreApiRequestError,
} from "./core/transport.js";

import { createAuthClient } from "./core/auth.js";
import { createMarketClient } from "./core/market.js";
import { createWorkspaceClient } from "./core/workspace.js";
import { createCommercialClient } from "./core/commercial.js";
import { createScreenerClient } from "./core/screener.js";
import { createAdvisoryClient } from "./core/advisory.js";
import { createCrawlClient } from "./core/crawl.js";
import { createDnseClient } from "./core/dnse.js";
import { createOperatorClient } from "./core/operator.js";
import { createMiscClient } from "./core/misc.js";
import { createSocClient } from "./core/soc.js";

export { authTokenStorage, CoreApiRequestError };

export function createCoreApiAdapter({ env = {}, getToken, getRefreshToken, setTokens, clearTokens } = {}) {
  const transport = createCoreTransport(env, {
    getToken,
    getRefreshToken,
    setTokens,
    clearTokens,
  });

  const persistTokens = typeof setTokens === "function" ? setTokens : () => {};

  // Build individual clients with shared transport helpers
  const authClient = createAuthClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
    corePatch: transport.corePatch,
    persistTokens,
    getRefreshToken,
  });

  const marketClient = createMarketClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
  });

  const workspaceClient = createWorkspaceClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
    corePut: transport.corePut,
    corePatch: transport.corePatch,
    coreDelete: transport.coreDelete,
  });

  const commercialClient = createCommercialClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
  });

  const screenerClient = createScreenerClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
    corePut: transport.corePut,
    coreDelete: transport.coreDelete,
  });

  const advisoryClient = createAdvisoryClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
    coreDelete: transport.coreDelete,
  });

  const crawlClient = createCrawlClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
  });

  const dnseClient = createDnseClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
    coreDelete: transport.coreDelete,
  });

  const operatorClient = createOperatorClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
  });

  const miscClient = createMiscClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
  });

  const socClient = createSocClient({
    coreGet: transport.coreGet,
    corePost: transport.corePost,
    corePut: transport.corePut,
    corePatch: transport.corePatch,
    coreDelete: transport.coreDelete,
  });

  // Combine into a single unified API client object (Facade)
  return {
    ...authClient,
    ...marketClient,
    ...workspaceClient,
    ...commercialClient,
    ...screenerClient,
    ...advisoryClient,
    ...crawlClient,
    ...dnseClient,
    ...operatorClient,
    ...miscClient,
    ...socClient,
  };
}

export const defaultCoreApiAdapter = createCoreApiAdapter({
  env: typeof process !== "undefined" ? process.env : {},
  getToken: () => authTokenStorage.getAccessToken(),
  getRefreshToken: () => authTokenStorage.getRefreshToken(),
  setTokens: (tokens) => authTokenStorage.setTokens(tokens),
  clearTokens: () => authTokenStorage.clearTokens(),
});

export const coreApiAdapter = defaultCoreApiAdapter;