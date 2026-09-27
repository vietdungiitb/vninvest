/**
 * tenantreg-e — PortfolioContext: session lifecycle + workspace switching.
 *
 * These are the first tests that render `PortfolioProvider` at all (every other
 * suite mocks `usePortfolio`), so they also pin the bootstrap contract that
 * E1/E2/E5/E6/E7/E8 all hang off.
 *
 * `coreApiAdapter` is mocked; `adapters/core/transport.js` is deliberately REAL
 * so `tenantIdStorage` / `clearStaffSwitchSession` / `initTokenStorageSync` are
 * exercised for real — the whole point of E1 is that the context and the
 * transport agree on one store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, waitFor, screen } from "@testing-library/react";
import { createElement } from "react";

const h = vi.hoisted(() => {
  const adapter = {
    coreGet: vi.fn(),
    corePost: vi.fn(),
    corePut: vi.fn(),
    corePatch: vi.fn(),
    coreDelete: vi.fn(),
    getUserProfile: vi.fn(),
    getTenantLifecycle: vi.fn(),
    getPortfolios: vi.fn(),
    loginUser: vi.fn(),
    registerUser: vi.fn(),
    resendVerificationEmail: vi.fn(),
    refreshAuthToken: vi.fn(),
    updateUserProfile: vi.fn(),
    createPortfolio: vi.fn(),
    updatePortfolio: vi.fn(),
    deletePortfolio: vi.fn(),
    createSubAccount: vi.fn(),
    updateSubAccount: vi.fn(),
    deleteSubAccount: vi.fn(),
  };
  return { adapter };
});

vi.mock("../adapters/coreApiAdapter.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, coreApiAdapter: h.adapter };
});

import { PortfolioProvider, usePortfolio } from "./PortfolioContext.js";
import { createCoreTransport, tenantIdStorage, CORE_TOKENS_CLEARED_EVENT } from "../adapters/core/transport.js";

const SESSION_PAYLOAD = {
  id: 42,
  username: "nam",
  email: "nam@example.com",
  is_staff: false,
  is_superuser: false,
  plan: "pro",
  abilities: [{ action: "read", subject: "Dashboard" }],
  entitlements: { maxSymbols: 100, sse: true },
  tenant: { tenant_id: "tenant-a", public_id: "tenant-a" },
  tenants: [
    { tenant_id: "tenant-a", public_id: "tenant-a", display_name: "Alpha", plan: "pro" },
    { tenant_id: "tenant-b", public_id: "tenant-b", display_name: "Beta", plan: "free" },
  ],
};

const PROFILE_PAYLOAD = {
  username: "nam",
  email: "nam@example.com",
  is_staff: false,
  is_superuser: false,
  display_name: "Nguyễn Nam",
  avatar_url: "https://cdn.example/nam.png",
  language: "vi",
  theme: "dark",
  whale_alert_threshold: "500",
  preferences: {},
  tenants: SESSION_PAYLOAD.tenants,
  abilities: SESSION_PAYLOAD.abilities,
};

let latest: any = null;

function Probe() {
  latest = usePortfolio();
  return createElement("div", { "data-testid": "probe" }, latest.isAuthenticated ? "authed" : "anon");
}

function renderProvider() {
  return render(
    createElement(PortfolioProvider, null, createElement(Probe, null)),
  );
}

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

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  latest = null;
  h.adapter.coreGet.mockReset();
  h.adapter.corePost.mockReset();
  h.adapter.getUserProfile.mockReset();
  h.adapter.getTenantLifecycle.mockReset();
  h.adapter.getPortfolios.mockReset();
  h.adapter.updateUserProfile.mockReset();
  h.adapter.loginUser.mockReset();
  h.adapter.refreshAuthToken.mockReset();

  localStorage.setItem("access_token", "pat-token");
  localStorage.setItem("refresh_token", "pat-refresh");

  h.adapter.coreGet.mockImplementation(async (path: string) => {
    if (path === "/auth/me/") return SESSION_PAYLOAD;
    throw new Error(`unexpected coreGet: ${path}`);
  });
  h.adapter.getUserProfile.mockResolvedValue(PROFILE_PAYLOAD);
  h.adapter.getTenantLifecycle.mockResolvedValue({ plan: "pro", status: "active" });
  h.adapter.getPortfolios.mockResolvedValue([{ id: "pf-1", name: "Chính" }]);
  h.adapter.corePost.mockResolvedValue({ detail: "Logged out and PAT revoked." });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

async function bootstrap() {
  renderProvider();
  await waitFor(() => expect(latest?.authStateReady).toBe(true));
}

describe("tenantreg-e E1 — one source of truth for the workspace id", () => {
  it("switchTenant makes X-Tenant-ID appear on the next request", async () => {
    await bootstrap();
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const transport = createCoreTransport(
      { CORE_API_BASE_URL: "/core/v1" },
      { getToken: () => "pat-token", getRefreshToken: () => null, setTokens: () => {}, clearTokens: () => {} },
    );

    await act(async () => {
      await transport.coreGet("/partner/usage/trend/");
    });
    const [, beforeInit] = fetchMock.mock.calls[0];
    expect(beforeInit.headers["X-Tenant-ID"]).toBe("tenant-a");

    await act(async () => {
      latest.switchTenant("tenant-b");
    });
    expect(tenantIdStorage.getTenantId()).toBe("tenant-b");

    await act(async () => {
      await transport.coreGet("/partner/usage/trend/");
    });
    const [, afterInit] = fetchMock.mock.calls[1];
    // This is the assertion whose absence let a no-op switcher ship.
    expect(afterInit.headers["X-Tenant-ID"]).toBe("tenant-b");
  });

  it("seeds the workspace select from session.tenants[] on first login", async () => {
    expect(tenantIdStorage.getTenantId()).toBeNull();
    await bootstrap();
    // Was: seeded only from the non-existent `profile.tenant.tenant_id`, so the
    // <select> rendered value='' with no matching option on a blank selector.
    expect(latest.activeTenantId).toBe("tenant-a");
    expect(tenantIdStorage.getTenantId()).toBe("tenant-a");
    expect(latest.userTenants).toHaveLength(2);
  });

  it("clears a stale stored id that is no longer a member (slice B 403 wedge)", async () => {
    localStorage.setItem("tenant_id", "tenant-from-another-account");
    await bootstrap();
    expect(tenantIdStorage.getTenantId()).toBe("tenant-a");
    expect(latest.activeTenantId).toBe("tenant-a");
  });

  it("clears the stored id when the account genuinely has no workspace", async () => {
    h.adapter.coreGet.mockImplementation(async (path: string) => {
      if (path === "/auth/me/") return { ...SESSION_PAYLOAD, tenants: [], tenant: null };
      throw new Error(`unexpected coreGet: ${path}`);
    });
    localStorage.setItem("tenant_id", "tenant-a");
    await bootstrap();
    expect(tenantIdStorage.getTenantId()).toBeNull();
    expect(latest.activeTenantId).toBeNull();
  });

  it("reconciles the workspace BEFORE the tenant-scoped lifecycle call", async () => {
    localStorage.setItem("tenant_id", "tenant-from-another-account");
    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));
    // The lifecycle call is the first request that would 403 on a stale header.
    expect(h.adapter.getTenantLifecycle).toHaveBeenCalledTimes(1);
    expect(latest.userPlan).toBe("pro");
  });
});

describe("tenantreg-e E2 — logout revokes the PAT and clears every trace", () => {
  it("clears locally first, then revokes with the captured token", async () => {
    // ORDER CHANGED, and the previous order was wrong.
    //
    // It used to await the revoke BEFORE clearing, which left two real holes:
    //  1. AuthLoginPage initialises from authTokenStorage.hasTokens() and fires
    //     GET /tenant/lifecycle/. While the revoke was in flight that call saw a
    //     still-authenticated session and hard-navigated the user BACK to the
    //     dashboard — "I cannot log out".
    //  2. The PAT revoke is the whole point of E2, and closing the tab during
    //     that window killed the fire-and-forget call, so the 12h token survived
    //     and the fix defeated its own purpose.
    //
    // Now the local session is cleared synchronously first and the revoke carries
    // a token captured beforehand, plus keepalive so the browser finishes it.
    await bootstrap();
    localStorage.setItem("tenant_id", "tenant-b");
    sessionStorage.setItem("staff_switch", JSON.stringify({ token: "switch-abc" }));

    let authAtRevokeTime: string | undefined;
    let storageAtRevokeTime: string | null = null;
    h.adapter.corePost.mockImplementation(async (
      _path: string,
      _body?: unknown,
      options?: { headers?: Record<string, string>; keepalive?: boolean },
    ) => {
      authAtRevokeTime = options?.headers?.Authorization;
      storageAtRevokeTime = localStorage.getItem("access_token");
      return { detail: "ok" };
    });

    await act(async () => {
      await latest.logout();
    });

    expect(h.adapter.corePost).toHaveBeenCalledWith(
      "/auth/logout/",
      undefined,
      expect.objectContaining({
        keepalive: true,
        headers: { Authorization: "Bearer pat-token" },
      }),
    );
    // The captured credential is what authorises the revoke, not the (now empty)
    // store -- otherwise the request would go out unauthenticated.
    expect(authAtRevokeTime).toBe("Bearer pat-token");
    expect(storageAtRevokeTime).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(tenantIdStorage.getTenantId()).toBeNull();
    expect(sessionStorage.getItem("staff_switch")).toBeNull();
    expect(latest.activeTenantId).toBeNull();
    expect(latest.userTenants).toEqual([]);
    expect(latest.isAuthenticated).toBe(false);
  });

  it("clears the local session even when the revoke fails", async () => {
    await bootstrap();
    h.adapter.corePost.mockRejectedValue(new Error("network down"));

    await act(async () => {
      await expect(latest.logout()).resolves.not.toThrow();
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(tenantIdStorage.getTenantId()).toBeNull();
    expect(latest.isAuthenticated).toBe(false);
  });

  it("never rejects, so fire-and-forget callers (Header/Sidebar) are safe", async () => {
    await bootstrap();
    h.adapter.corePost.mockRejectedValue(new Error("boom"));
    let rejected = false;
    await act(async () => {
      latest.logout().catch(() => { rejected = true; });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(rejected).toBe(false);
    expect(latest.isAuthenticated).toBe(false);
  });

  it("does not call the server when there are no tokens to revoke", async () => {
    localStorage.clear();
    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));
    await act(async () => { await latest.logout(); });
    expect(h.adapter.corePost).not.toHaveBeenCalled();
  });

  it("a cross-tab token removal clears the session without a reload", async () => {
    await bootstrap();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CORE_TOKENS_CLEARED_EVENT));
    });
    expect(latest.isAuthenticated).toBe(false);
    expect(latest.userTenants).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("tenantreg-e E5/E6 — identity, entitlements and the threshold unit", () => {
  it("populates id and entitlements from GET /auth/me/", async () => {
    await bootstrap();
    // Were permanently null: /identity/profile/ returns neither key.
    expect(latest.userIdentity.id).toBe(42);
    expect(latest.userEntitlements).toEqual({ maxSymbols: 100, sse: true });
    expect(latest.capabilitySnapshot.entitlements).toEqual({ maxSymbols: 100, sse: true });
    expect(latest.userPlan).toBe("pro");
  });

  it("fills avatar/display_name from the profile endpoint", async () => {
    await bootstrap();
    expect(latest.userIdentity.avatar_url).toBe("https://cdn.example/nam.png");
    expect(latest.userIdentity.display_name).toBe("Nguyễn Nam");
  });

  it("E6: whale_alert_threshold is in millions (BE default=500), not raw VND", async () => {
    h.adapter.getUserProfile.mockResolvedValue({ ...PROFILE_PAYLOAD, whale_alert_threshold: undefined });
    await bootstrap();
    // Backend: DecimalField(default=500, verbose_name='... (triệu VNĐ)'),
    // models.py:507-512. The old fallback was '500000000' — raw VND, 6 orders
    // of magnitude out, and updateUserConfig would have persisted it verbatim.
    expect(latest.userConfig.whale_alert_threshold).toBe("500");
  });

  it("E6: updateUserConfig round-trips the backend value untouched", async () => {
    await bootstrap();
    h.adapter.updateUserProfile.mockResolvedValue({ language: "en", theme: "light", whale_alert_threshold: "250" });
    await act(async () => { await latest.updateUserConfig({ whale_alert_threshold: "250" }); });
    expect(h.adapter.updateUserProfile).toHaveBeenCalledWith({ whale_alert_threshold: 250 });
    expect(latest.userConfig.whale_alert_threshold).toBe("250");
  });

  it("still works when /auth/me/ is unavailable and only the profile answers", async () => {
    h.adapter.coreGet.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    await bootstrap();
    expect(latest.userIdentity.username).toBe("nam");
    expect(latest.activeTenantId).toBe("tenant-a");
    expect(latest.userEntitlements).toBeNull();
  });
});

describe("tenantreg-e E7 — a failed bootstrap is visible, and late writes are dropped", () => {
  it("publishes a retryable authStateError instead of a silently empty shell", async () => {
    const seen: any[] = [];
    const onErr = (ev: Event) => seen.push((ev as CustomEvent).detail);
    window.addEventListener("core-auth-state-error", onErr);
    h.adapter.coreGet.mockRejectedValue(new Error("500"));
    h.adapter.getUserProfile.mockRejectedValue(new Error("500"));

    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));
    window.removeEventListener("core-auth-state-error", onErr);

    expect(latest.isAuthenticated).toBe(true);
    expect(latest.authStateError).toMatchObject({ reason: "bootstrap-failed", retryable: true });
    expect(seen).toHaveLength(1);
    expect(typeof latest.retryAuthBootstrap).toBe("function");
  });

  it("retryAuthBootstrap re-runs the bootstrap and clears the error", async () => {
    h.adapter.coreGet.mockRejectedValueOnce(new Error("500"));
    h.adapter.getUserProfile.mockRejectedValueOnce(new Error("500"));
    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));
    expect(latest.authStateError).not.toBeNull();

    h.adapter.coreGet.mockImplementation(async (path: string) => {
      if (path === "/auth/me/") return SESSION_PAYLOAD;
      throw new Error(`unexpected coreGet: ${path}`);
    });
    await act(async () => { latest.retryAuthBootstrap(); });
    await waitFor(() => expect(latest?.authStateError).toBeNull());
    expect(latest.userIdentity.id).toBe(42);
  });

  it("reports session-expired (not bootstrap-failed) on 401 and logs out", async () => {
    const unauthorized = Object.assign(new Error("401"), { status: 401 });
    h.adapter.coreGet.mockRejectedValue(unauthorized);
    h.adapter.getUserProfile.mockRejectedValue(unauthorized);

    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));

    expect(latest.authStateError).toMatchObject({ reason: "session-expired", retryable: false });
    expect(latest.isAuthenticated).toBe(false);
  });

  it("a 403 from a stale workspace id does NOT log the user out — it self-heals", async () => {
    // slice B: the tenant resolver answers 403 for an unresolvable
    // X-Tenant-ID, and IsTenantActive reads request.tenant — so a stale id makes
    // BOTH identity calls 403 on a plain reload. Logging out there would strand
    // a signed-in user.
    localStorage.setItem("tenant_id", "tenant-from-another-account");
    const forbidden = Object.assign(new Error("403"), { status: 403 });
    const sessionSeen: (string | null)[] = [];
    h.adapter.coreGet.mockImplementation(async (path: string) => {
      if (path !== "/auth/me/") throw new Error(`unexpected coreGet: ${path}`);
      sessionSeen.push(localStorage.getItem("tenant_id"));
      if (localStorage.getItem("tenant_id")) throw forbidden;
      return SESSION_PAYLOAD;
    });
    h.adapter.getUserProfile.mockImplementation(async () => {
      if (localStorage.getItem("tenant_id")) throw forbidden;
      return PROFILE_PAYLOAD;
    });

    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));

    // first attempt carried the stale id, the retry did not
    expect(sessionSeen).toEqual(["tenant-from-another-account", null]);
    expect(latest.isAuthenticated).toBe(true);
    expect(latest.userIdentity.username).toBe("nam");
    expect(latest.activeTenantId).toBe("tenant-a");
    expect(latest.authStateError).toBeNull();
    // and the PAT was never revoked
    expect(h.adapter.corePost).not.toHaveBeenCalled();
  });

  it("a 403 that survives the retry is surfaced, never a silent logout", async () => {
    const forbidden = Object.assign(new Error("403"), { status: 403 });
    h.adapter.coreGet.mockRejectedValue(forbidden);
    h.adapter.getUserProfile.mockRejectedValue(forbidden);

    renderProvider();
    await waitFor(() => expect(latest?.authStateReady).toBe(true));

    expect(latest.authStateError).toMatchObject({ reason: "tenant-forbidden", retryable: true });
    expect(latest.isAuthenticated).toBe(true);
  });

  it("a slow syncAuthState landing AFTER logout cannot repopulate the session", async () => {
    let releaseProfile: (v: unknown) => void = () => {};
    h.adapter.getUserProfile.mockImplementation(
      () => new Promise((resolve) => { releaseProfile = resolve; }),
    );
    renderProvider();
    await waitFor(() => expect(h.adapter.getUserProfile).toHaveBeenCalled());

    await act(async () => { await latest.logout(); });
    expect(latest.isAuthenticated).toBe(false);

    await act(async () => {
      releaseProfile(PROFILE_PAYLOAD);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest.isAuthenticated).toBe(false);
    expect(latest.userIdentity.username).toBe("");
    expect(latest.userTenants).toEqual([]);
    expect(tenantIdStorage.getTenantId()).toBeNull();
  });
});

describe("tenantreg-e E3 — identity is rendered, not hardcoded", () => {
  it("exposes the real identity on the context the shell reads", async () => {
    await bootstrap();
    expect(screen.getByTestId("probe").textContent).toBe("authed");
    expect(latest.userIdentity.username).toBe("nam");
    expect(latest.userIdentity.email).toBe("nam@example.com");
  });
});
