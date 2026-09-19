import { describe, it, expect } from "vitest";
import { routeCatalog } from "../../app/routeCatalog.js";
// @ts-expect-error vite ?raw import — resolved by vitest/vite, no type declaration needed
import mainSource from "../../main.tsx?raw";

/**
 * Route-catalog contract (F-04 lock).
 * Every path declared in `routeCatalog` must be registered in the runtime
 * router (`main.tsx`), unless the entry explicitly opts out via
 * `externalEntry: true`. Prevents orphan routes like the former
 * `/vip/local-control` gap from silently reappearing.
 */
describe("route catalog ↔ router contract (F-04)", () => {
  const registeredPaths = new Set<string>();
  const pathRe = /path:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(mainSource as unknown as string)) !== null) {
    const p = m[1];
    if (p === "*" || p === "/") continue;
    registeredPaths.add(p.startsWith("/") ? p : `/${p}`);
  }

  it("registers every catalog path in main.tsx (or explicit externalEntry)", () => {
    const orphans = (routeCatalog as Array<{ id: string; path: string; externalEntry?: boolean }>)
      .filter((e) => !e.externalEntry && !registeredPaths.has(e.path))
      .map((e) => `${e.id} (${e.path})`);
    expect(orphans).toEqual([]);
  });

  it("registers /vip/local-control (F-04 regression)", () => {
    expect(registeredPaths.has("/vip/local-control")).toBe(true);
  });
});
