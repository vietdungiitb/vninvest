import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { routeCatalog } from "../src/app/routeCatalog.js";
import { getPageLoader, getPageRegistryRouteIds } from "../src/pages/pageRegistry.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const shellFilePath = path.resolve(scriptDirectory, "../src/pages/market/ShellStockDetailPage.js");
const shellSource = readFileSync(shellFilePath, "utf8");

const stockDetailRoute = routeCatalog.find((route) => route.id === "core-stock-detail");
assert(stockDetailRoute, "routeCatalog must declare core-stock-detail");
assert(stockDetailRoute.path === "/stocks/:symbol", "core-stock-detail must expose /stocks/:symbol");
assert(stockDetailRoute.status === "core", "core-stock-detail must remain a core route");

const pageRegistryRouteIds = new Set(getPageRegistryRouteIds());
assert(pageRegistryRouteIds.has("core-stock-detail"), "pageRegistry must register core-stock-detail");

const pageLoader = getPageLoader("core-stock-detail");
assert(typeof pageLoader === "function", "core-stock-detail must expose a deferred page loader");
assert(
  pageLoader.toString().includes("./market/ShellStockDetailPage.js"),
  "core-stock-detail loader must target market/ShellStockDetailPage.js",
);

assert(shellSource.includes("resolveStockSymbolFromPathname"), "ShellStockDetailPage must resolve symbol from pathname");
assert(shellSource.includes("syncStockLocation"), "ShellStockDetailPage must sync symbol state back to shell location");
assert(shellSource.includes("StockDetailPage"), "ShellStockDetailPage must mount the raw StockDetailPage surface");

console.log("core-stock-detail shell wiring OK");