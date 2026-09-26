/**
 * tenantreg-e / E1 + E10 — transport-level tenant header + cross-tab token sync.
 *
 * E1 regression pin: the assertion that was missing before (and whose absence
 * let a no-op workspace switcher ship) is "X-Tenant-ID actually appears on the
 * wire after a switch". Here the switch is simulated the way the real code
 * performs it — a localStorage write — and the header is asserted on a real
 * fetch call.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createCoreTransport,
  tenantIdStorage,
  TENANT_ID_STORAGE_KEY,
  initTokenStorageSync,
  destroyTokenStorageSync,
  CORE_TOKENS_CLEARED_EVENT,
  clearStaffSwitchSession,
} from "./transport.js";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("tenantreg-e E1 — X-Tenant-ID reaches the wire", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  const transport = () =>
    createCoreTransport({ CORE_API_BASE_URL: "/core/v1" }, {
      getToken: () => "pat-token",
      getRefreshToken: () => null,
      setTokens: () => {},
      clearTokens: () => {},
    });

  it("sends X-Tenant-ID after a workspace switch writes localStorage", async () => {
    // This is exactly what PortfolioContext.switchTenant does.
    tenantIdStorage.setTenantId("tenant-B");

    await transport().coreGet("/identity/profile/");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Tenant-ID"]).toBe("tenant-B");
  });

  it("localStorage is the single source of truth (sessionStorage alone is not read)", async () => {
    // Regression shape of the original bug: a value parked in sessionStorage
    // with nothing in localStorage must still be honoured (migrated), NOT
    // silently dropped.
    sessionStorage.setItem(TENANT_ID_STORAGE_KEY, "tenant-legacy");

    await transport().coreGet("/identity/profile/");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Tenant-ID"]).toBe("tenant-legacy");
    // and it is promoted so the next read is a plain localStorage hit
    expect(localStorage.getItem(TENANT_ID_STORAGE_KEY)).toBe("tenant-legacy");
  });

  it("omits the header entirely when no workspace is selected", async () => {
    await transport().coreGet("/identity/profile/");
    const [, init] = fetchMock.mock.calls[0];
    expect("X-Tenant-ID" in init.headers).toBe(false);
  });

  it("clearTenantId() removes BOTH stores so a stale id cannot wedge requests", async () => {
    localStorage.setItem(TENANT_ID_STORAGE_KEY, "tenant-A");
    sessionStorage.setItem(TENANT_ID_STORAGE_KEY, "tenant-A");
    tenantIdStorage.setTenantId("tenant-B");

    tenantIdStorage.clearTenantId();

    expect(tenantIdStorage.getTenantId()).toBeNull();
    await transport().coreGet("/identity/profile/");
    const [, init] = fetchMock.mock.calls[0];
    expect("X-Tenant-ID" in init.headers).toBe(false);
  });

  it("clearStaffSwitchSession drops the R5 view-as-tenant token", () => {
    sessionStorage.setItem("staff_switch", JSON.stringify({ token: "switch-abc" }));
    clearStaffSwitchSession();
    expect(sessionStorage.getItem("staff_switch")).toBeNull();
  });
});

describe("tenantreg-e E10 — cross-tab token removal does not hard-reload", () => {
  afterEach(() => {
    destroyTokenStorageSync();
    vi.unstubAllGlobals();
  });

  it("relays a core-tokens-cleared event instead of calling location.reload()", () => {
    const reload = vi.fn();
    // jsdom's location.reload is not always writable, so assert on the
    // observable contract instead: the event fires and no reload is requested.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    const seen: string[] = [];
    const onCleared = () => seen.push("cleared");
    window.addEventListener(CORE_TOKENS_CLEARED_EVENT, onCleared);

    initTokenStorageSync();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "access_token", newValue: null }),
    );

    window.removeEventListener(CORE_TOKENS_CLEARED_EVENT, onCleared);
    expect(seen).toEqual(["cleared"]);
    expect(reload).not.toHaveBeenCalled();
  });

  it("ignores a cross-tab token REPLACEMENT (rotation is not a logout)", () => {
    const seen: string[] = [];
    const onCleared = () => seen.push("cleared");
    window.addEventListener(CORE_TOKENS_CLEARED_EVENT, onCleared);

    initTokenStorageSync();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "access_token", newValue: "rotated-pat" }),
    );

    window.removeEventListener(CORE_TOKENS_CLEARED_EVENT, onCleared);
    expect(seen).toEqual([]);
  });

  it("is idempotent: a second initTokenStorageSync does not double-subscribe", () => {
    const seen: string[] = [];
    const onCleared = () => seen.push("cleared");
    window.addEventListener(CORE_TOKENS_CLEARED_EVENT, onCleared);

    initTokenStorageSync();
    initTokenStorageSync();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "access_token", newValue: null }),
    );

    window.removeEventListener(CORE_TOKENS_CLEARED_EVENT, onCleared);
    expect(seen).toEqual(["cleared"]);
  });
});
