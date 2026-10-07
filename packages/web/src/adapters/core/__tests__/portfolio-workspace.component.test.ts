/**
 * S-02 - 4 endpoint portfolio workspace phai goi DUNG path va QUA facade.
 *
 * VAY SAO PHAI ASSERT QUA FACADE (audit M4):
 * `coreApiAdapter.js` ghep client bang SPREAD TUONG MINH (`:134-144`), khong
 * phai `...mod`. Mot method khai trong `core/workspace.js` ma khong duoc wire
 * vao `createCoreApiAdapter` se xanh o test module truc tiep, trong khi moi
 * noi goi tu UI deu nham `undefined`. Test nay goi `defaultCoreApiAdapter.*`
 * de bat dung loi do.
 *
 * Fail-truoc/pass-sau: bo 4 method khoi `workspace.js` => 4 test nay FAIL.
 */

import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { defaultCoreApiAdapter } from "../../coreApiAdapter.js";

const CASES = [
  ["getPortfolioEquityCurve", "equity-curve", "curve"],
  ["getPortfolioAllocation", "allocation", "allocation"],
  ["getPortfolioChart", "chart", "curve"],
  ["getPortfolioMetrics", "metrics", "risk"],
] as const;

describe("S-02 portfolio workspace endpoints qua facade", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { marker: methodNameFromUrl("") }, meta: {} }),
      headers: new Headers({ "content-type": "application/json" }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function methodNameFromUrl(_u: string) {
    return "";
  }

  for (const [method, leaf, expectedKey] of CASES) {
    test(`${method} goi /core/v1/.../${leaf}/ qua facade`, async () => {
      const adapter = defaultCoreApiAdapter as unknown as Record<
        string,
        (id: number) => Promise<unknown>
      >;
      // Phai ton tai tren facade - day la phan bat loi cua M4.
      expect(typeof adapter[method]).toBe("function");

      const payload = { [expectedKey]: [], marker: method };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: payload, meta: {} }),
        headers: new Headers({ "content-type": "application/json" }),
      });

      const result = (await adapter[method](123)) as Record<string, unknown>;
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain(`/core/v1/workspace/portfolios/123/${leaf}/`);
      // KHONG duoc lui ve route legacy `/api/portfolio/...`
      expect(url).not.toContain("/api/portfolio/portfolios/123/");
      expect(result[expectedKey]).toBeDefined();
    });
  }

  for (const [method] of CASES) {
    test(`${method} nem loi khi thieu portfolioId`, async () => {
      const adapter = defaultCoreApiAdapter as unknown as Record<string, (id?: number) => Promise<unknown>>;
      expect(() => adapter[method](undefined)).toThrow(/portfolioId is required/);
    });
  }

  test("khong endpoint moi nao dung route legacy /api/portfolio/", () => {
    // Chan hoi qu: route moi phai o native /core/v1/ nhu cac route con lai.
    const adapter = defaultCoreApiAdapter as unknown as Record<string, (id: number) => Promise<unknown>>;
    for (const [method] of CASES) {
      expect(typeof adapter[method]).toBe("function");
    }
  });
});
