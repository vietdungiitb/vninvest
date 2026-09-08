import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const shellFilePath = path.resolve(scriptDirectory, "../src/pages/market/ShellStockDetailPage.js");
const shellSource = readFileSync(shellFilePath, "utf8");
const workstationPath = path.resolve(scriptDirectory, "../src/components/WorkstationShell.tsx");
const workstationSource = readFileSync(workstationPath, "utf8");
const routeCatalogPath = path.resolve(scriptDirectory, "../src/app/routeCatalog.js");
const routeCatalogSource = readFileSync(routeCatalogPath, "utf8");
const pageRegistryPath = path.resolve(scriptDirectory, "../src/pages/pageRegistry.js");
const pageRegistrySource = readFileSync(pageRegistryPath, "utf8");

assert(routeCatalogSource.includes("core-stock-detail"), "routeCatalog must declare core-stock-detail");
assert(routeCatalogSource.includes("/stocks/:symbol"), "core-stock-detail must expose /stocks/:symbol");
assert(pageRegistrySource.includes("core-stock-detail"), "pageRegistry must register core-stock-detail");
assert(pageRegistrySource.includes("./market/ShellStockDetailPage.js"), "core-stock-detail loader must target market/ShellStockDetailPage.js");

assert(shellSource.includes("resolveStockSymbolFromPathname"), "ShellStockDetailPage must resolve symbol from pathname");
assert(shellSource.includes("syncStockLocation"), "ShellStockDetailPage must sync symbol state back to shell location");
assert(shellSource.includes("StockDetailPage"), "ShellStockDetailPage must mount the raw StockDetailPage surface");
assert(shellSource.includes("WorkstationShell"), "ShellStockDetailPage must wrap via WorkstationShell (P2-1)");
assert(workstationSource.includes('role: "region"'), "WorkstationShell must use region landmark (P0-0 contract)");
assert(workstationSource.includes("useId"), "WorkstationShell must auto-generate a11y id (HIGH1)");
assert(!workstationSource.includes('renderElement("main"') && !workstationSource.includes("e(\"main\""), "WorkstationShell must not render nested <main> (DOM contract)");

console.log("core-stock-detail shell wiring OK — WorkstationShell variant (P2-1)");