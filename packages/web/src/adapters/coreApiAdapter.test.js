/**
 * coreApiAdapter.test.js
 *
 * Unit tests for coreApiAdapter.
 * Uses jsdom / fetch mock — no real network calls.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { CoreApiRequestError, authTokenStorage, coreApiAdapter, createCoreApiAdapter } from "./coreApiAdapter.js";

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

  function mockErrorJsonResponse(status, payload, statusText = "Error") {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
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
    await expect(coreApiAdapter.getSymbolSnapshot("VCI")).rejects.toThrow("Core API request error 404");
  });

  // ---------------------------------------------------------------------------
  // getSessionFacts
  // ---------------------------------------------------------------------------
  test("getSessionFacts calls /core/v1/session-facts/{symbol}/", async () => {
    mockOkResponse({ symbol: "VCI", cvd_normalized: 0.5 });

    await coreApiAdapter.getSessionFacts("VCI", "2026-05-03");
    const [url] = fetchMock.mock.calls[0];
    // T1.4 F-10: BE reads trade_date (market_serving/views.py:35-52)
    expect(url).toContain("/session-facts/VCI/?trade_date=2026-05-03");
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

    await expect(adapter.getSymbolSnapshot("VCI")).rejects.toThrow("Core API request error 401");
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

  test("getAlertCenterSymbolStats calls /core/v1/signals/alert-center/symbol-stats", async () => {
    mockOkResponse({ lane: "main", symbols: [] });
    await coreApiAdapter.getAlertCenterSymbolStats({ timeframe: "session", page_size: 200 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/alert-center/symbol-stats");
    expect(url).toContain("timeframe=session");
    expect(url).toContain("page_size=200");
  });

  test("getAIAlertsSymbolStats calls /core/v1/signals/ai-alerts/symbol-stats", async () => {
    mockOkResponse({ lane: "ai", symbols: [] });
    await coreApiAdapter.getAIAlertsSymbolStats({ timeframe: "5d", page: 2 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/signals/ai-alerts/symbol-stats");
    expect(url).toContain("timeframe=5d");
    expect(url).toContain("page=2");
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
  // dashboard lower-deck native routes
  // ---------------------------------------------------------------------------
  test("getBulkTechnicalsBySymbols calls /core/v1/market-data/technicals/bulk/", async () => {
    const payload = { technicals: [{ symbol: "TPB", rsi_14: 63.4 }], results: [{ symbol: "TPB", rsi_14: 63.4 }] };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getBulkTechnicalsBySymbols(["tpb", "fpt"]);
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/market-data/technicals/bulk/?symbols=TPB,FPT");
    expect(url).toContain("/core/v1/");
  });

  test("getStockChartHistory calls /core/v1/stock-management/stocks/{symbol}/chart/", async () => {
    const payload = { symbol: "TPB", timeframe: "1H", points: [] };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getStockChartHistory("tpb", { timeframe: "1H", days: 30 });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/stocks/TPB/chart/");
    expect(url).toContain("timeframe=1H");
    expect(url).toContain("days=30");
  });

  test("getDarkMoneyHistory calls /core/v1/stock-management/stocks/{symbol}/dark-money-history/", async () => {
    const payload = { ok: true, symbol: "TPB", interval: "1h", period: "1M" };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getDarkMoneyHistory("tpb", { interval: "1h", period: "1M" });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/stocks/TPB/dark-money-history/");
    expect(url).toContain("interval=1h");
    expect(url).toContain("period=1M");
  });

  test("getWhaleAnalyticsSnapshot calls /core/v1/workspace/whale-analytics/{symbol}/", async () => {
    const payload = { symbol: "TPB", timeframe: "session", bubble_series: [], flow_series: { cvd: [] } };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getWhaleAnalyticsSnapshot("tpb", {
      timeframe: "session",
      compact: 0,
      tradeDate: "2026-05-20",
      includeBaseline: false,
    });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspace/whale-analytics/TPB/");
    expect(url).toContain("timeframe=session");
    expect(url).toContain("compact=0");
    expect(url).toContain("trade_date=2026-05-20");
    expect(url).toContain("include_baseline=0");
  });

  test("getWhaleAnalyticsSnapshot throws on missing symbol", () => {
    expect(() => coreApiAdapter.getWhaleAnalyticsSnapshot("")).toThrow("symbol is required");
  });

  test("getPortfolioHoldings calls /core/v1/workspace/portfolios/{id}/holdings/", async () => {
    const payload = [{ symbol: "VCB", quantity: 120 }];
    mockOkResponse(payload);

    const result = await coreApiAdapter.getPortfolioHoldings(123);
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/workspace/portfolios/123/holdings/");
    expect(url).not.toContain("/api/portfolio/portfolios/123/holdings/");
  });

  test("getPortfolioSummary calls /core/v1/workspace/portfolios/{id}/summary/", async () => {
    const payload = { portfolio_id: 123, portfolio_name: "Danh mục chính" };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getPortfolioSummary(123);
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/workspace/portfolios/123/summary/");
    expect(url).not.toContain("/api/portfolio/portfolios/123/summary/");
  });

  test("getPortfolioAnalytics calls /core/v1/workspace/portfolios/{id}/analytics/", async () => {
    const payload = { summary: { portfolio_id: 123 }, note: "full_analytics_available_via_sub_endpoints" };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getPortfolioAnalytics(123, 30);
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/workspace/portfolios/123/analytics/?days=30");
    expect(url).not.toContain("/api/portfolio/portfolios/123/analytics/");
  });

  test("getPortfolioTechnicals calls /core/v1/workspace/portfolios/{id}/technicals/", async () => {
    const payload = [{ symbol: "VCB", price_change_pct: "2.9700" }];
    mockOkResponse(payload);

    const result = await coreApiAdapter.getPortfolioTechnicals(123);
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/workspace/portfolios/123/technicals/");
    expect(url).not.toContain("/api/portfolio/portfolios/123/technicals/");
  });

  test("getPortfolioNewsDigest calls /core/v1/stock-management/portfolio/news-digest/", async () => {
    const payload = { news: [], note: "news_digest_not_available_in_native" };
    mockOkResponse(payload);

    const result = await coreApiAdapter.getPortfolioNewsDigest({ page_size: 5 });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/stock-management/portfolio/news-digest/");
    expect(url).toContain("page_size=5");
    expect(url).not.toContain("/api/stock-management/portfolio/news-digest");
  });

  test("getTrackedSymbols calls /core/v1/stock-management/tracked-symbols/", async () => {
    const payload = [{ symbol: "TPB", source_group_id: 7 }];
    mockOkResponse(payload);

    const result = await coreApiAdapter.getTrackedSymbols();
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/stock-management/tracked-symbols/");
    expect(url).not.toContain("/api/stock-management/tracked-symbols/");
  });

  test("getLegacyWatchlistGroups now resolves through /core/v1/stock-management/groups/ without price enrichment", async () => {
    const payload = [{ id: 7, name: "Ngân hàng", items: [] }];
    mockOkResponse(payload);

    const result = await coreApiAdapter.getLegacyWatchlistGroups();
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/stock-management/groups/");
    expect(url).toContain("include_prices=0");
    expect(url).not.toContain("/api/portfolio/watchlist/groups/");
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

  // ---------------------------------------------------------------------------
  // public auth endpoints for registration hardening
  // ---------------------------------------------------------------------------
  test("registerUser posts anti-spam payload to /core/v1/auth/register/", async () => {
    mockOkResponse({ status: "success", data: { message: "ok" } });

    await coreApiAdapter.registerUser({
      username: "newuser",
      email: "NEWUSER@example.com",
      password: "StrongPassword123!",
      website: "",
      turnstile_token: "cf-token",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/register/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      username: "newuser",
      email: "newuser@example.com",
      password: "StrongPassword123!",
      password_confirm: "StrongPassword123!",
      website: "",
      turnstile_token: "cf-token",
    });
  });

  test("registerUser throws CoreApiRequestError with envelope metadata", async () => {
    mockErrorJsonResponse(400, {
      detail: "Validation error",
      code: "validation_error",
      request_id: "req_test_123",
      field_errors: {
        email: ["Email không hợp lệ"],
      },
    }, "Bad Request");

    try {
      await coreApiAdapter.registerUser({
        username: "u1",
        email: "bad-email",
        password: "x",
      });
      throw new Error("Expected registerUser to throw CoreApiRequestError");
    } catch (error) {
      expect(error).toBeInstanceOf(CoreApiRequestError);
      expect(error.status).toBe(400);
      expect(error.code).toBe("validation_error");
      expect(error.requestId).toBe("req_test_123");
      expect(error.fieldErrors?.email?.[0]).toBe("Email không hợp lệ");
    }
  });

  test("resendVerificationEmail posts to /core/v1/auth/resend-verification/", async () => {
    mockOkResponse({ status: "success", data: { message: "resent" } });
    await coreApiAdapter.resendVerificationEmail("A@Example.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/resend-verification/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@example.com" });
  });

  test("verifyEmailToken posts to /core/v1/auth/verify-email/", async () => {
    mockOkResponse({ status: "success", data: { message: "verified" } });
    await coreApiAdapter.verifyEmailToken("token_abc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/verify-email/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "token_abc" });
  });

  test("loginUser posts credentials to /core/v1/auth/token/", async () => {
    const setTokens = jest.fn();
    const adapter = createCoreApiAdapter({
      env: { CORE_API_BASE_URL: "/core/v1" },
      getToken: () => null,
      getRefreshToken: () => null,
      setTokens,
      clearTokens: jest.fn(),
    });

    mockOkResponse({ access: "acc_1", refresh: "ref_1" });
    await adapter.loginUser({ username: "demo", password: "secret" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/token/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ username: "demo", password: "secret" });
    expect(setTokens).toHaveBeenCalledWith({ access: "acc_1", refresh: "ref_1" });
  });

  test("requestPasswordReset posts to /core/v1/auth/password-reset/", async () => {
    mockOkResponse({ detail: "ok" });
    await coreApiAdapter.requestPasswordReset("USER@Example.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/password-reset/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "user@example.com" });
  });

  test("confirmPasswordReset posts to /core/v1/auth/password-reset/confirm/", async () => {
    mockOkResponse({ detail: "ok" });
    await coreApiAdapter.confirmPasswordReset("token_1", "NewPass123!", "NewPass123!");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/password-reset/confirm/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      token: "token_1",
      new_password: "NewPass123!",
      new_password_confirm: "NewPass123!",
    });
  });

  test("refreshAuthToken posts to /core/v1/auth/token/refresh/ and stores tokens", async () => {
    const setTokens = jest.fn();
    const adapter = createCoreApiAdapter({
      env: { CORE_API_BASE_URL: "/core/v1" },
      getToken: () => null,
      getRefreshToken: () => "refresh_old",
      setTokens,
      clearTokens: jest.fn(),
    });

    mockOkResponse({ access: "acc_new", refresh: "ref_new" });
    await adapter.refreshAuthToken();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/core/v1/auth/token/refresh/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ refresh: "refresh_old" });
    expect(setTokens).toHaveBeenCalledWith({ access: "acc_new", refresh: "ref_new" });
  });

  test("authTokenStorage tracks get/set/clear lifecycle", () => {
    global.window = {
      localStorage: {
        store: {},
        getItem(key) {
          return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
        },
        setItem(key, value) {
          this.store[key] = String(value);
        },
        removeItem(key) {
          delete this.store[key];
        },
      },
    };

    authTokenStorage.setTokens({ access: "acc1", refresh: "ref1" });
    expect(authTokenStorage.getAccessToken()).toBe("acc1");
    expect(authTokenStorage.getRefreshToken()).toBe("ref1");
    expect(authTokenStorage.hasTokens()).toBe(true);

    authTokenStorage.clearTokens();
    expect(authTokenStorage.getAccessToken()).toBeNull();
    expect(authTokenStorage.getRefreshToken()).toBeNull();
    expect(authTokenStorage.hasTokens()).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // tracked symbols and price alerts extensions
  // ---------------------------------------------------------------------------
  test("addTrackedSymbol posts to /core/v1/stock-management/tracked-symbols/", async () => {
    const payload = { symbol: "HPG", source_group_id: 10, whale_alert_threshold_million: 50 };
    mockOkResponse({ id: 123, ...payload });

    const result = await coreApiAdapter.addTrackedSymbol("hpg", 10, 50);
    expect(result).toEqual({ id: 123, ...payload });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/tracked-symbols/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      symbol: "HPG",
      source_group_id: 10,
      whale_alert_threshold_million: 50,
    });
  });

  test("removeTrackedSymbol deletes to /core/v1/stock-management/tracked-symbols/{id}/", async () => {
    mockOkResponse(null);
    await coreApiAdapter.removeTrackedSymbol(123);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/tracked-symbols/123/");
    expect(init.method).toBe("DELETE");
  });

  test("getPriceAlerts calls /core/v1/stock-management/price-alerts/", async () => {
    mockOkResponse({ results: [] });
    await coreApiAdapter.getPriceAlerts({ symbol: "FPT" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/price-alerts/?symbol=FPT");
  });

  test("createPriceAlert posts to /core/v1/stock-management/price-alerts/", async () => {
    const payload = { symbol: "FPT", condition: "above", target_price: 150000, cooldown_seconds: 60, is_active: true };
    mockOkResponse({ id: 99, ...payload });

    const result = await coreApiAdapter.createPriceAlert(payload);
    expect(result).toEqual({ id: 99, ...payload });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/price-alerts/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      ...payload,
      symbol: "FPT",
    });
  });

  test("updatePriceAlert patches /core/v1/stock-management/price-alerts/{id}/", async () => {
    mockOkResponse({ id: 99, is_active: false });
    await coreApiAdapter.updatePriceAlert(99, { is_active: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/price-alerts/99/");
    expect(init.method).toBe("PATCH");
  });

  test("deletePriceAlert deletes /core/v1/stock-management/price-alerts/{id}/", async () => {
    mockOkResponse(null);
    await coreApiAdapter.deletePriceAlert(99);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/price-alerts/99/");
    expect(init.method).toBe("DELETE");
  });

  test("getStockNews calls /core/v1/stock-management/stocks/{symbol}/news/", async () => {
    mockOkResponse({ results: [] });
    await coreApiAdapter.getStockNews("HPG", { page_size: 10 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/stocks/HPG/news/?page_size=10");
  });

  test("getStockFinancials calls /core/v1/stock-management/stocks/{symbol}/financials/", async () => {
    mockOkResponse({ revenue: 1000 });
    await coreApiAdapter.getStockFinancials("HPG");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/stock-management/stocks/HPG/financials/");
  });
});
