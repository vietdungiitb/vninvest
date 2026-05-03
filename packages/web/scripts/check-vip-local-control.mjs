import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VipLocalControlPage,
  createVipAppControlClient,
  getPageComponent,
  getPageRegistryRouteIds,
  getRouteCatalogIds,
  getRoutesForBuildTarget,
  pageRegistry,
  routeCatalog,
  vipAppAdapter,
} from "../src/index.js";

const vipRoute = routeCatalog.find((route) => route.id === "vip-local-control");
assert(vipRoute, "vip-local-control route must exist in routeCatalog");
assert.equal(vipRoute.adapter, "vip-app");
assert.equal(vipRoute.path, "/vip/local-control");
assert.equal(vipRoute.status, "baseline");
assert.ok(vipRoute.buildTargets.includes("vip"), "vip-local-control must target the vip build");
assert.ok(!vipRoute.buildTargets.includes("saas"), "vip-local-control must not target saas builds");

assert.ok(getRouteCatalogIds().includes("vip-local-control"), "routeCatalog ids must include vip-local-control");
assert.ok(getRoutesForBuildTarget("vip").some((route) => route.id === "vip-local-control"), "vip build target must expose vip-local-control");
assert.equal(getPageComponent("vip-local-control"), VipLocalControlPage, "pageRegistry must resolve vip-local-control to VipLocalControlPage");
assert.ok(getPageRegistryRouteIds().includes("vip-local-control"), "pageRegistry route ids must include vip-local-control");
assert.equal(pageRegistry.find((entry) => entry.routeId === "vip-local-control")?.component, VipLocalControlPage, "pageRegistry entry must point to VipLocalControlPage");

const vipEnv = { VNINVEST_VIP_APP_BASE_URL: "http://vip-app.local/vip-app/v1" };
assert.equal(vipAppAdapter.getBuildMeta(vipEnv).baseUrl, "http://vip-app.local/vip-app/v1");
assert.equal(vipAppAdapter.getCapabilityBootstrapEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/access/capabilities");
assert.equal(vipAppAdapter.getSessionPayloadEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/session/bootstrap");
assert.equal(vipAppAdapter.getHealthcheckEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/health");
assert.equal(vipAppAdapter.getAuthLoginEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/auth/login");
assert.equal(vipAppAdapter.getAuthLogoutEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/auth/logout");
assert.equal(vipAppAdapter.getAuthResetEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/auth/reset");
assert.equal(vipAppAdapter.getRbacUsersEndpoint(vipEnv), "http://vip-app.local/vip-app/v1/rbac/users");
assert.equal(vipAppAdapter.getAuditLogsEndpoint(vipEnv, { limit: 5 }), "http://vip-app.local/vip-app/v1/audit/logs?limit=5");

const vipControlRequests = [];
const mockFetch = async (url, init = {}) => {
  const requestUrl = String(url);
  vipControlRequests.push({
    url: requestUrl,
    init: {
      ...init,
      headers: new Headers(init.headers || {}),
    },
  });

  if (requestUrl.endsWith("/auth/login")) {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        session: {
          session_id: "sess_login",
          principal: { username: "vip-local-admin" },
        },
        capabilities: {
          principal: {
            identity: { username: "vip-local-admin", is_staff: true, is_superuser: true },
          },
          navigation: { visible_routes: ["vip-local-control", "settings"] },
          build: { target: "vip", plan: "vip" },
        },
      }),
    };
  }

  if (requestUrl.endsWith("/rbac/users") && init.method === "GET") {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        count: 2,
        users: [
          { user_id: 101, username: "vip-local-admin", email: "vip-local-admin@vninvest.local", role_keys: ["vip_admin"] },
          { user_id: 102, username: "vip-operator", email: "vip-operator@vninvest.local", role_keys: ["vip_operator"] },
        ],
      }),
    };
  }

  if (requestUrl.endsWith("/rbac/users") && init.method === "POST") {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        created: true,
        user: {
          user_id: 103,
          username: "vip-auditor",
          email: "vip-auditor@vninvest.local",
          role_keys: ["vip_viewer"],
        },
      }),
    };
  }

  if (requestUrl.includes("/audit/logs")) {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        count: 1,
        audit_logs: [
          { audit_id: 8, action: "auth.login", actor_username: "vip-local-admin", created_at: "2026-05-02T10:44:01+00:00" },
        ],
      }),
    };
  }

  if (requestUrl.endsWith("/auth/reset")) {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        session: { session_id: "vip-local-session", principal: { username: "vip-local-admin" } },
        capabilities: { build: { target: "vip", plan: "vip" } },
      }),
    };
  }

  if (requestUrl.endsWith("/auth/logout")) {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        session: { session_id: "", principal: { username: "" } },
        capabilities: { build: { target: "vip", plan: "vip" } },
      }),
    };
  }

  return {
    ok: true,
    json: async () => ({ ok: true }),
  };
};

const vipControlClient = createVipAppControlClient({
  env: vipEnv,
  fetchImpl: mockFetch,
});

const loginPayload = await vipControlClient.login({ username: "vip-local-admin", password: "vip-demo-pass" });
const usersPayload = await vipControlClient.listUsers();
const upsertPayload = await vipControlClient.upsertUser({
  username: "vip-auditor",
  role_keys: ["vip_viewer"],
});
const auditPayload = await vipControlClient.listAuditLogs({ limit: 5 });
const resetPayload = await vipControlClient.resetSession();
const logoutPayload = await vipControlClient.logout();

assert.equal(loginPayload.session.session_id, "sess_login", "VIP control client must return login payload JSON");
assert.equal(usersPayload.users[0].username, "vip-local-admin", "VIP control client must return RBAC user listings");
assert.equal(upsertPayload.user.username, "vip-auditor", "VIP control client must return upserted user payloads");
assert.equal(auditPayload.audit_logs[0].action, "auth.login", "VIP control client must return audit log payloads");
assert.equal(resetPayload.session.session_id, "vip-local-session", "VIP control client must support auth reset");
assert.equal(logoutPayload.session.session_id, "", "VIP control client must support logout");

assert.equal(vipControlRequests[0].url, "http://vip-app.local/vip-app/v1/auth/login", "VIP control client must hit the login endpoint from adapter metadata");
assert.equal(vipControlRequests[0].init.method, "POST", "VIP control client login must use POST");
assert.equal(JSON.parse(vipControlRequests[0].init.body).username, "vip-local-admin", "VIP control client login must serialize credentials as JSON");
assert.equal(vipControlRequests[1].url, "http://vip-app.local/vip-app/v1/rbac/users", "VIP control client must use the RBAC users endpoint for listings");
assert.equal(vipControlRequests[1].init.method, "GET", "VIP control client listUsers must use GET");
assert.equal(vipControlRequests[2].url, "http://vip-app.local/vip-app/v1/rbac/users", "VIP control client must reuse the RBAC users endpoint for upserts");
assert.equal(vipControlRequests[2].init.method, "POST", "VIP control client upsertUser must use POST");
assert.equal(vipControlRequests[3].url, "http://vip-app.local/vip-app/v1/audit/logs?limit=5", "VIP control client must append audit query params through adapter metadata");
assert.equal(vipControlRequests[4].url, "http://vip-app.local/vip-app/v1/auth/reset", "VIP control client resetSession must use the reset endpoint");
assert.equal(vipControlRequests[5].url, "http://vip-app.local/vip-app/v1/auth/logout", "VIP control client logout must use the logout endpoint");

const vipPageMarkup = renderToStaticMarkup(
  createElement(VipLocalControlPage, {
    autoLoad: false,
    initialSnapshot: {
      health: { ok: true, service: "vip-app-local-api" },
      capabilities: {
        abilities: [
          { action: "read", subject: "Dashboard" },
          { action: "manage", subject: "VipLocalControl" },
        ],
        navigation: {
          visible_routes: ["vip-local-control", "settings"],
        },
      },
      session: {
        session_id: "sess_vip_ui",
        principal: { username: "vip-local-admin" },
      },
      users: [
        {
          user_id: 101,
          username: "vip-local-admin",
          email: "vip-local-admin@vninvest.local",
          role_keys: ["vip_admin"],
        },
        {
          user_id: 102,
          username: "vip-operator",
          email: "vip-operator@vninvest.local",
          role_keys: ["vip_operator"],
        },
      ],
      auditLogs: [
        {
          audit_id: 8,
          action: "auth.login",
          actor_username: "vip-local-admin",
          created_at: "2026-05-02T10:44:01+00:00",
        },
      ],
    },
  }),
);

assert(vipPageMarkup.includes("Trung tâm điều khiển VIP cục bộ"), "VIP local control page must render the Vietnamese page title");
assert(vipPageMarkup.includes("Đăng nhập local"), "VIP local control page must render the local login action");
assert(vipPageMarkup.includes("vip-local-admin"), "VIP local control page must surface the current session identity");
assert(vipPageMarkup.includes("vip-operator"), "VIP local control page must render the user list");
assert(vipPageMarkup.includes("auth.login"), "VIP local control page must render audit actions");

console.log("VIP local control smoke passed.");