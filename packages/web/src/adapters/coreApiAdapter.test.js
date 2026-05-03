/**
 * coreApiAdapter.test.js
 *
 * Unit tests for coreApiAdapter.
 * Uses jsdom / fetch mock — no real network calls.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { coreApiAdapter } from "./coreApiAdapter.js";

describe("coreApiAdapter", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  function mockOkResponse(data) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });
  }

  function mockErrorResponse(status, statusText = "Error") {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
      text: () => Promise.resolve(""),
    });
  }

  // ---------------------------------------------------------------------------
  // getSymbolSnapshot
  // ---------------------------------------------------------------------------
  test("getSymbolSnapshot calls /core/v1/symbol-snapshot/{symbol}/", async () => {
    const payload = { symbol: "VCI", price: "50000.00", stale: false };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getSymbolSnapshot("vci");
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/symbol-snapshot/VCI/");
  });

  test("getSymbolSnapshot throws on missing symbol", () => {
    expect(() => coreApiAdapter.getSymbolSnapshot("")).toThrow("symbol is required");
  });

  test("getSymbolSnapshot throws on HTTP error", async () => {
    mockErrorResponse(404, "Not Found");
    await expect(coreApiAdapter.getSymbolSnapshot("VCI")).rejects.toThrow("Core API error 404");
  });

  // ---------------------------------------------------------------------------
  // getSessionFacts
  // ---------------------------------------------------------------------------
  test("getSessionFacts calls /core/v1/session-facts/{symbol}/", async () => {
    mockOkResponse({ symbol: "VCI", cvd_normalized: 0.5 });

    await coreApiAdapter.getSessionFacts("VCI", "2026-05-03");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/session-facts/VCI/?date=2026-05-03");
  });

  test("getSessionFacts works without date", async () => {
    mockOkResponse({ symbol: "VCI" });
    await coreApiAdapter.getSessionFacts("VCI");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/session-facts\/VCI\/$/);
  });

  test("getSessionFacts throws on missing symbol", () => {
    expect(() => coreApiAdapter.getSessionFacts(null)).toThrow("symbol is required");
  });

  // ---------------------------------------------------------------------------
  // getUnifiedAlerts
  // ---------------------------------------------------------------------------
  test("getUnifiedAlerts calls /core/v1/unified-alert/", async () => {
    const payload = { results: [], next: null, previous: null };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getUnifiedAlerts({ symbol: "VCI", severity: "high" });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/unified-alert/");
    expect(url).toContain("symbol=VCI");
    expect(url).toContain("severity=high");
  });

  test("getUnifiedAlerts works with no params", async () => {
    mockOkResponse({ results: [] });
    await coreApiAdapter.getUnifiedAlerts();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/unified-alert\/$/);
  });

  // ---------------------------------------------------------------------------
  // getWhaleFeedAggregate
  // ---------------------------------------------------------------------------
  test("getWhaleFeedAggregate calls /core/v1/whale-feed-aggregate/{symbol}/", async () => {
    const payload = { results: [{ side: "buy", matched_value: 1000000 }], next: null };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getWhaleFeedAggregate("VCI");
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/whale-feed-aggregate/VCI/");
  });

  test("getWhaleFeedAggregate throws on missing symbol", () => {
    expect(() => coreApiAdapter.getWhaleFeedAggregate("")).toThrow("symbol is required");
  });

  // ---------------------------------------------------------------------------
  // X-Request-ID header
  // ---------------------------------------------------------------------------
  test("all requests include X-Request-ID header", async () => {
    mockOkResponse({ ok: true });
    await coreApiAdapter.getSymbolSnapshot("VCI");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Request-ID"]).toBeTruthy();
    expect(typeof init.headers["X-Request-ID"]).toBe("string");
  });

  // ---------------------------------------------------------------------------
  // getTenantLifecycle
  // ---------------------------------------------------------------------------
  test("getTenantLifecycle calls /core/v1/tenant/lifecycle/", async () => {
    mockOkResponse({ plan: "starter", status: "active" });
    await coreApiAdapter.getTenantLifecycle();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/tenant/lifecycle/");
  });
});
