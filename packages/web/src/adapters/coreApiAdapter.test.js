/**
 * coreApiAdapter.test.js
 *
 * Unit tests for coreApiAdapter.
 * Uses jsdom / fetch mock — no real network calls.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { coreApiAdapter, createCoreApiAdapter } from "./coreApiAdapter.js";

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

  function mockErrorResponseWithBody(status, body = "", statusText = "Error") {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
      text: () => Promise.resolve(body),
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
  // alert-center / ai-alerts endpoints
  // ---------------------------------------------------------------------------
  test("getAlertCenterFeed calls /core/v1/signals/alert-center/feed", async () => {
    const payload = { results: [], next: null, previous: null };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getAlertCenterFeed({ symbol: "VCI", severity: "high" });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/alert-center/feed");
    expect(url).toContain("symbol=VCI");
    expect(url).toContain("severity=high");
  });

  test("getAlertCenterFeed works with no params", async () => {
    mockOkResponse({ results: [] });
    await coreApiAdapter.getAlertCenterFeed();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/signals\/alert-center\/feed$/);
  });

  test("getAIAlertsFeed calls /core/v1/signals/ai-alerts/feed", async () => {
    const payload = { results: [], next: null, previous: null };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getAIAlertsFeed({ severity: "high" });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/ai-alerts/feed");
    expect(url).toContain("severity=high");
  });

  test("coreApiAdapter accepts env override as factory", async () => {
    mockOkResponse({ results: [] });
    const adapter = createCoreApiAdapter({ env: { CORE_API_BASE_URL: "https://core.example.test/base" } });
    await adapter.getAlertCenterFeed();
    const [url] = fetchMock.mock.calls[0];
    expect(url.startsWith("https://core.example.test/base")).toBe(true);
  });

  test("retries once after successful token refresh on 401", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("expired"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access: "next-access", refresh: "next-refresh" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ symbol: "VCI" }),
      });

    const setTokens = jest.fn();
    const adapter = createCoreApiAdapter({
      getToken: () => "expired-access",
      getRefreshToken: () => "refresh-token",
      setTokens,
      clearTokens: jest.fn(),
    });

    const result = await adapter.getSymbolSnapshot("VCI");
    expect(result).toEqual({ symbol: "VCI" });
    expect(setTokens).toHaveBeenCalledWith({ access: "next-access", refresh: "next-refresh" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/token/refresh/");
  });

  test("clears tokens and throws when refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("expired"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("invalid refresh"),
      });

    const clearTokens = jest.fn();
    const adapter = createCoreApiAdapter({
      getToken: () => "expired-access",
      getRefreshToken: () => "invalid-refresh",
      setTokens: jest.fn(),
      clearTokens,
    });

    await expect(adapter.getSymbolSnapshot("VCI")).rejects.toThrow("Core API error 401");
    expect(clearTokens).toHaveBeenCalledTimes(1);
  });

  test("uses injected getToken in authorization header", async () => {
    mockOkResponse({ symbol: "VCI" });
    const adapter = createCoreApiAdapter({
      getToken: () => "access-from-injected-provider",
      getRefreshToken: () => null,
      setTokens: jest.fn(),
      clearTokens: jest.fn(),
    });
    await adapter.getSymbolSnapshot("VCI");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-from-injected-provider");
  });

  test("acknowledgeAlertCenterEvent posts /core/v1/signals/alert-center/events/{id}/ack", async () => {
    mockOkResponse({ delivery_state: "acknowledged" });
    await coreApiAdapter.acknowledgeAlertCenterEvent("abc-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/alert-center/events/abc-123/ack");
    expect(init.method).toBe("POST");
  });

  test("muteAlertCenterPreference posts /core/v1/signals/alert-center/preferences/mute", async () => {
    mockOkResponse({ mute_until: "2026-05-16T00:00:00Z" });
    await coreApiAdapter.muteAlertCenterPreference({ symbol: "VCI", alert_family: "whale", mute_minutes: 30 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/alert-center/preferences/mute");
    expect(init.method).toBe("POST");
  });

  test("getAlertCenterSymbolContext calls /core/v1/signals/alert-center/symbols/{symbol}/context", async () => {
    mockOkResponse({ symbol: "VCI", total: 1, recent_events: [] });
    await coreApiAdapter.getAlertCenterSymbolContext("vci", { session_date: "2026-05-16" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/alert-center/symbols/VCI/context");
    expect(url).toContain("session_date=2026-05-16");
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
