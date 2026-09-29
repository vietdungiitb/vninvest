/**
 * TEN-02 R1 — moi noi doc tenant phai qua `tenantIdStorage` (SSOT).
 *
 * Audit doc lap doc lap: 12 call site doc `localStorage.getItem('tenant_id')`
 * truc tiep o 8 file. Gia tri doc ra GIONG NHAU (cung key), nen bug khong
 * phai "sai so du lieu" ma la "bo qua buoc migrate":
 *
 *   `tenantIdStorage.getTenantId()` doc localStorage truoc, neu rong thi doc
 *   sessionStorage (ban cu) roi ghi nguoc lai localStorage.
 *
 * 12 call site cu BO QUA nhanh sessionStorage do. User con phien ban cu =>
 * SSOT tra tenant dung, 12 cho do tra `null` => React Query key lech nhau
 * giua cac man trong cung mot lan render, va mot so man hien "chua chon
 * tenant" dù user da chon.
 *
 * Bai test nay kiem migration path, va kiem AC1 bang cach doc source.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "tenant_id";

function freshStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    __dump: () => Object.fromEntries(store),
  };
}

async function loadTransport(local, session) {
  vi.resetModules();
  vi.doMock("../adapters/core/transport.js", () => ({}));
  // Nạp lại module để `tenantIdStorage` đọc đúng storage mới.
  const mod = await import("../adapters/core/transport.js");
  return mod.tenantIdStorage;
}

describe("TEN-02 — SSOT tenant storage", () => {
  let local;
  let session;

  beforeEach(() => {
    local = freshStorage();
    session = freshStorage();
    vi.stubGlobal("window", {
      localStorage: local,
      sessionStorage: session,
    });
    vi.resetModules();
  });

  it("doc localStorage khi co san", async () => {
    local.setItem(STORAGE_KEY, "TEN-A");
    const { tenantIdStorage } = await import("../adapters/core/transport.js");
    expect(tenantIdStorage.getTenantId()).toBe("TEN-A");
  });

  it("MIGRATE sessionStorage (ban cu) sang localStorage", async () => {
    // Day la buoc ma 12 call site cu bo qua.
    session.setItem(STORAGE_KEY, "TEN-OLD");
    const { tenantIdStorage } = await import("../adapters/core/transport.js");

    expect(tenantIdStorage.getTenantId()).toBe("TEN-OLD");
    // Và phai ghi nguoc lai localStorage de lan doc sau nhanh hon.
    expect(local.getItem(STORAGE_KEY)).toBe("TEN-OLD");
  });

  it("uu tien localStorage khi ca hai deu co", async () => {
    local.setItem(STORAGE_KEY, "TEN-NEW");
    session.setItem(STORAGE_KEY, "TEN-OLD");
    const { tenantIdStorage } = await import("../adapters/core/transport.js");
    expect(tenantIdStorage.getTenantId()).toBe("TEN-NEW");
  });

  it("clear xoa ca hai, khong de hoi sinh gia tri cu", async () => {
    local.setItem(STORAGE_KEY, "TEN-A");
    session.setItem(STORAGE_KEY, "TEN-OLD");
    const { tenantIdStorage } = await import("../adapters/core/transport.js");

    tenantIdStorage.clearTenantId();
    expect(tenantIdStorage.getTenantId()).toBeNull();
  });

  it("AC1 — khong con noi nao doc storage truc tiep cho tenant", async () => {
    // Doc source thay vi tin bao cao: bat buoc phai la lenh/grep, khong phai
    // suy luan.
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = dirname(dirname(fileURLToPath(import.meta.url))); // -> src/
    const offenders = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (["node_modules", ".git", "__tests__"].includes(name)) continue;
        const p = join(dir, name);
        let st;
        try {
          st = statSync(p);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(name)) continue;
        if (/\.(test|spec)\./.test(name)) continue;
        const src = readFileSync(p, "utf8");
        // transport.js LA noi duy nhat duoc phep doc storage truc tiep
        // (no chinh la noi cai dat SSOT).
        if (p.endsWith(join("adapters", "core", "transport.js"))) continue;
        if (/(local|session)Storage\.(get|set|remove)Item\(\s*["'`]tenant_id/.test(src)) {
          offenders.push(p.replace(root, "src/"));
        }
      }
    };
    walk(root);
    expect(offenders, `AC1 fail — file nao van doc tenant storage truc tiep:\n${offenders.join("\n")}`).toEqual([]);
  });
});
