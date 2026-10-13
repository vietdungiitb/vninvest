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

  it("uses only catalog ids in main.tsx (D-01 reverse direction)", () => {
    // Mọi resolvePageComponent('X') trong main.tsx phải có id X trong catalog.
    // Khóa chiều ngược: đổi id ở catalog mà quên main (hoặc ngược lại) là vỡ.
    // Ngoại lệ duy nhất: id đi qua lớp ánh xạ registry (`core-*`,
    // `portfolio-workspace`, `alert-center`, `whale-advisory`, ...) là đầu RA
    // của resolver, không phải routeId — test này chỉ quét đầu VÀO.
    const catalogIds = new Set(
      (routeCatalog as Array<{ id: string }>).map((e) => e.id),
    );
    const idRe = /resolvePageComponent\(\s*['"]([^'"]+)['"]\s*\)/g;
    const usedIds = new Set<string>();
    let im: RegExpExecArray | null;
    while ((im = idRe.exec(mainSource as unknown as string)) !== null) {
      usedIds.add(im[1]);
    }
    const unknown = [...usedIds].filter((id) => !catalogIds.has(id));
    expect(unknown).toEqual([]);
  });
});
