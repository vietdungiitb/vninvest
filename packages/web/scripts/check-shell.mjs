import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BUILD_TARGETS,
  ShellAuthProvider,
  createVipAppControlClient,
  createEmptyAuthRuntimeState,
  createShellAuthRuntime,
  deriveAuthRuntimeState,
  getPageComponent,
  getPageRegistryRouteIds,
  navigationCatalog,
  pageRegistry,
  renderShellField,
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
  renderShellSelectField,
  routeCatalog,
  ShellAdminOpsPage,
  ShellSettingsPage,
  shellAdapters,
  VipLocalControlPage,
  useShellAuth,
  useShellAuthRuntime,
} from "../src/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const allowedTargets = new Set(BUILD_TARGETS);
const routeIds = routeCatalog.map((route) => route.id);
const uniqueRouteIds = new Set(routeIds);

assert(uniqueRouteIds.size === routeIds.length, "Duplicate route ids detected in routeCatalog");

for (const route of routeCatalog) {
  assert(route.buildTargets.length > 0, `Route ${route.id} must declare at least one build target`);
  for (const target of route.buildTargets) {
    assert(allowedTargets.has(target), `Route ${route.id} uses unknown build target: ${target}`);
  }
}

for (const group of navigationCatalog) {
  for (const routeId of group.items) {
    assert(uniqueRouteIds.has(routeId), `Navigation group ${group.id} references unknown route id: ${routeId}`);
  }
}

const adapterIds = shellAdapters.map((adapter) => adapter.adapterId);
const uniqueAdapterIds = new Set(adapterIds);
const requiredAdapterMethods = [
  "resolveBaseUrl",
  "getBuildMeta",
  "getCapabilityBootstrapEndpoint",
  "getSessionPayloadEndpoint",
  "getHealthcheckEndpoint",
];

assert(uniqueAdapterIds.size === adapterIds.length, "Duplicate adapter ids detected in shellAdapters");

for (const adapter of shellAdapters) {
  for (const methodName of requiredAdapterMethods) {
    assert(typeof adapter[methodName] === "function", `Adapter ${adapter.adapterId} is missing method: ${methodName}`);
  }
}

const adminOpsRoute = routeCatalog.find((route) => route.id === "admin-ops");
const vipShellAdapter = shellAdapters.find((adapter) => adapter.adapterId === "vip-app");
const settingsRoute = routeCatalog.find((route) => route.id === "settings");
const vipLocalControlRoute = routeCatalog.find((route) => route.id === "vip-local-control");
const requiredVipControlMethods = [
  "getAuthLoginEndpoint",
  "getAuthLogoutEndpoint",
  "getAuthResetEndpoint",
  "getRbacUsersEndpoint",
  "getAuditLogsEndpoint",
];

for (const methodName of requiredVipControlMethods) {
  assert(typeof vipShellAdapter?.[methodName] === "function", `VIP adapter is missing method: ${methodName}`);
}

assert(adminOpsRoute?.status === "baseline", "admin-ops route must move to baseline when the page exists");
assert(settingsRoute?.status === "baseline", "settings route must remain baseline once the shell settings page exists");
assert(vipLocalControlRoute?.status === "baseline", "vip-local-control route must move to baseline when the page exists");

const pageRegistryRouteIds = new Set(getPageRegistryRouteIds());
assert(pageRegistry.length === pageRegistryRouteIds.size, "Duplicate route ids detected in pageRegistry");
assert(pageRegistryRouteIds.has("admin-ops"), "pageRegistry must register admin-ops");
assert(pageRegistryRouteIds.has("settings"), "pageRegistry must register settings");
assert(pageRegistryRouteIds.has("vip-local-control"), "pageRegistry must register vip-local-control");
assert(getPageComponent("admin-ops") === ShellAdminOpsPage, "admin-ops must resolve to ShellAdminOpsPage");
assert(getPageComponent("settings") === ShellSettingsPage, "settings must resolve to ShellSettingsPage");
assert(getPageComponent("vip-local-control") === VipLocalControlPage, "vip-local-control must resolve to VipLocalControlPage");
assert(typeof renderShellPageChrome === "function", "Shared shell page chrome helper must be exported");
assert(typeof renderShellPanel === "function", "Shared shell panel helper must be exported");
assert(typeof renderShellMetric === "function", "Shared shell metric helper must be exported");
assert(typeof renderShellField === "function", "Shared shell field helper must be exported");
assert(typeof renderShellSelectField === "function", "Shared shell select helper must be exported");

const vipControlRequests = [];
const vipControlClient = createVipAppControlClient({
  env: { VNINVEST_VIP_APP_BASE_URL: "http://vip-app.local/vip-app/v1" },
  fetchImpl: async (url, init = {}) => {
    vipControlRequests.push({ url, init });

    if (url.endsWith("/auth/login")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            ok: true,
            session: { session_id: "sess_login", principal: { username: "vip-local-admin" } },
          };
        },
      };
    }

    if (url.endsWith("/auth/logout")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            ok: true,
            session: { session_id: "", principal: { username: "" } },
          };
        },
      };
    }

    if (url.endsWith("/auth/reset")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            ok: true,
            session: { session_id: "vip-local-session", principal: { username: "vip-local-admin" } },
          };
        },
      };
    }

    if (url.includes("/audit/logs")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            ok: true,
            audit_logs: [{ audit_id: 1, action: "auth.login" }],
          };
        },
      };
    }

    if (init.method === "POST") {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            ok: true,
            user: { user_id: 102, username: "vip-operator" },
          };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() {
        return {
          ok: true,
          users: [{ user_id: 101, username: "vip-local-admin" }],
        };
      },
    };
  },
});

const vipLoginPayload = await vipControlClient.login({
  username: "vip-local-admin",
  password: "vip-demo-pass",
});
const vipUsersPayload = await vipControlClient.listUsers();
const vipUserUpsertPayload = await vipControlClient.upsertUser({
  username: "vip-operator",
  role_keys: ["vip_operator"],
});
const vipAuditPayload = await vipControlClient.listAuditLogs({ limit: 5 });
const vipResetPayload = await vipControlClient.resetSession();
const vipLogoutPayload = await vipControlClient.logout();

assert(vipLoginPayload.session.session_id === "sess_login", "VIP control client must return login payload JSON");
assert(vipUsersPayload.users[0].username === "vip-local-admin", "VIP control client must return RBAC user listings");
assert(vipUserUpsertPayload.user.username === "vip-operator", "VIP control client must return upserted user payloads");
assert(vipAuditPayload.audit_logs[0].action === "auth.login", "VIP control client must return audit log payloads");
assert(vipResetPayload.session.session_id === "vip-local-session", "VIP control client must support auth reset");
assert(vipLogoutPayload.session.session_id === "", "VIP control client must support logout");

assert(vipControlRequests[0].url === "http://vip-app.local/vip-app/v1/auth/login", "VIP control client must hit the login endpoint from adapter metadata");
assert(vipControlRequests[0].init.method === "POST", "VIP control client login must use POST");
assert(JSON.parse(vipControlRequests[0].init.body).username === "vip-local-admin", "VIP control client login must serialize credentials as JSON");
assert(vipControlRequests[1].url === "http://vip-app.local/vip-app/v1/rbac/users", "VIP control client must use the RBAC users endpoint for listings");
assert(vipControlRequests[1].init.method === "GET", "VIP control client listUsers must use GET");
assert(vipControlRequests[2].url === "http://vip-app.local/vip-app/v1/rbac/users", "VIP control client must reuse the RBAC users endpoint for upserts");
assert(vipControlRequests[2].init.method === "POST", "VIP control client upsertUser must use POST");
assert(vipControlRequests[3].url === "http://vip-app.local/vip-app/v1/audit/logs?limit=5", "VIP control client must append audit query params through adapter metadata");
assert(vipControlRequests[4].url === "http://vip-app.local/vip-app/v1/auth/reset", "VIP control client resetSession must use the reset endpoint");
assert(vipControlRequests[5].url === "http://vip-app.local/vip-app/v1/auth/logout", "VIP control client logout must use the logout endpoint");

const adminOpsMarkup = renderToStaticMarkup(
  createElement(ShellAdminOpsPage, {
    autoLoad: false,
    initialSnapshot: {
      buildMeta: {
        adapterId: "core",
        displayName: "Core API",
        target: "saas",
        baseUrl: "http://core.local/core/v1",
      },
      health: { ok: true, service: "core-api", environment: "foundation" },
      capabilities: {
        principal: {
          identity: {
            username: "package-admin",
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "Dashboard" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "system", "admin"],
          visible_routes: ["dashboard", "settings", "admin-ops", "ai-command-center"],
        },
        surfaces: {
          show_admin_ops: true,
          show_ai_command_center: true,
          show_vip_shell: false,
        },
      },
      session: {
        session_id: "core-session-foundation",
        principal: { username: "package-admin" },
      },
    },
  }),
);

assert(adminOpsMarkup.includes("Trung tâm vận hành admin shell"), "Admin ops page must render the Vietnamese page title");
assert(adminOpsMarkup.includes("show_admin_ops"), "Admin ops page must render admin surface flags");
assert(adminOpsMarkup.includes("admin-ops"), "Admin ops page must render admin route visibility");
assert(adminOpsMarkup.includes("package-admin"), "Admin ops page must render the current operator identity");

const settingsPageMarkup = renderToStaticMarkup(
  createElement(ShellSettingsPage, {
    autoLoad: false,
    initialSnapshot: {
      buildMeta: {
        adapterId: "core",
        displayName: "Core API",
        target: "saas",
        baseUrl: "http://core.local/core/v1",
      },
      health: { ok: true, service: "core-api", environment: "foundation" },
      capabilities: {
        principal: {
          identity: {
            username: "package-admin",
            email: "package-admin@vninvest.local",
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "Settings" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "system", "admin"],
          visible_routes: ["dashboard", "settings", "admin-ops"],
        },
        surfaces: {
          show_admin_ops: true,
          show_ai_command_center: true,
          show_vip_shell: false,
        },
      },
      session: {
        session_id: "core-session-foundation",
        principal: { username: "package-admin" },
      },
    },
  }),
);

assert(settingsPageMarkup.includes("Thiết lập shell và quyền truy cập"), "Shell settings page must render the Vietnamese page title");
assert(settingsPageMarkup.includes("package-admin"), "Shell settings page must render the current core identity");
assert(settingsPageMarkup.includes("core-api"), "Shell settings page must render the health payload");
assert(settingsPageMarkup.includes("show_admin_ops"), "Shell settings page must render surface flags");

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

const emptyAuthState = createEmptyAuthRuntimeState({ buildTarget: "saas" });
assert(emptyAuthState.userPlan === "free", "Empty auth runtime state must default userPlan to free");
assert(emptyAuthState.userIdentity.isStaff === false, "Empty auth runtime state must expose legacy-compatible user identity flags");

const derivedAuthState = deriveAuthRuntimeState(
  {
    buildMeta: { adapterId: "core", target: "saas" },
    health: { ok: true, service: "core-api" },
    capabilities: {
      build: { target: "saas", plan: "pro" },
      principal: {
        identity: {
          user_id: 7,
          username: "runtime-user",
          email: "runtime-user@vninvest.local",
          is_staff: true,
          is_superuser: false,
        },
      },
      abilities: [{ action: "read", subject: "Dashboard" }],
      navigation: {
        visible_groups: ["workspace"],
        visible_routes: ["dashboard"],
      },
      surfaces: {
        show_admin_ops: true,
        show_ai_command_center: true,
        show_vip_shell: false,
      },
    },
    session: {
      session_id: "sess_runtime",
      principal: { user_id: 7, username: "runtime-user" },
      tenant: { tenant_id: null, tenant_slug: null, service_account_id: null },
      build_target: "saas",
    },
  },
  { buildTarget: "saas", buildMeta: { adapterId: "core", target: "saas" } },
);

assert(derivedAuthState.authStateReady === true, "Derived auth runtime state must mark authStateReady true");
assert(derivedAuthState.isAuthenticated === true, "Derived auth runtime state must be authenticated when session_id exists");
assert(derivedAuthState.userIdentity.isStaff === true, "Derived auth runtime state must expose camelCase legacy staff flag");

const authRuntime = createShellAuthRuntime({
  adapter: "core",
  bootstrapLoader: async () => ({
    buildMeta: { adapterId: "core", target: "saas" },
    health: { ok: true, service: "core-api" },
    capabilities: {
      build: { target: "saas", plan: "pro" },
      principal: {
        identity: {
          user_id: 11,
          username: "bootstrap-user",
          email: "bootstrap-user@vninvest.local",
          is_staff: false,
          is_superuser: false,
        },
      },
      abilities: [{ action: "read", subject: "Dashboard" }],
      navigation: {
        visible_groups: ["workspace"],
        visible_routes: ["dashboard"],
      },
      surfaces: {
        show_admin_ops: false,
        show_ai_command_center: true,
        show_vip_shell: false,
      },
    },
    session: {
      session_id: "sess_bootstrap",
      principal: { user_id: 11, username: "bootstrap-user" },
      tenant: { tenant_id: null, tenant_slug: null, service_account_id: null },
      build_target: "saas",
    },
  }),
});

const runtimeUpdates = [];
const unsubscribe = authRuntime.subscribe((snapshot) => {
  runtimeUpdates.push(snapshot.status);
});

const refreshedState = await authRuntime.refresh();
unsubscribe();

assert(runtimeUpdates[0] === "bootstrapping", "Auth runtime must emit a bootstrapping state before hydration");
assert(refreshedState.status === "ready", "Auth runtime must resolve to ready after a successful refresh");
assert(refreshedState.userIdentity.username === "bootstrap-user", "Auth runtime must expose the bootstrapped identity");
assert(authRuntime.reset().status === "idle", "Auth runtime reset must return to idle state");

const reactRuntime = createShellAuthRuntime({ adapter: "core" });
reactRuntime.hydrate({
  buildMeta: { adapterId: "core", target: "saas" },
  health: { ok: true, service: "core-api" },
  capabilities: {
    build: { target: "saas", plan: "pro" },
    principal: {
      identity: {
        user_id: 21,
        username: "react-user",
        email: "react-user@vninvest.local",
        is_staff: true,
        is_superuser: false,
      },
    },
    abilities: [{ action: "read", subject: "Dashboard" }],
    navigation: {
      visible_groups: ["workspace"],
      visible_routes: ["dashboard"],
    },
    surfaces: {
      show_admin_ops: true,
      show_ai_command_center: true,
      show_vip_shell: false,
    },
  },
  session: {
    session_id: "sess_react",
    principal: { user_id: 21, username: "react-user" },
    tenant: { tenant_id: null, tenant_slug: null, service_account_id: null },
    build_target: "saas",
  },
});

function ShellAuthProbe() {
  const auth = useShellAuth();
  const runtimeFromHook = useShellAuthRuntime();

  return createElement(
    "pre",
    null,
    JSON.stringify({
      username: auth.userIdentity.username,
      authenticated: auth.isAuthenticated,
      buildTarget: auth.buildTarget,
      adapterId: runtimeFromHook.adapter.adapterId,
      canSeeAiCommandCenter: auth.surfaces.show_ai_command_center,
    }),
  );
}

const reactMarkup = renderToStaticMarkup(
  createElement(
    ShellAuthProvider,
    { runtime: reactRuntime, autoRefresh: false },
    createElement(ShellAuthProbe),
  ),
);

assert(reactMarkup.includes("react-user"), "Shell auth provider must expose the hydrated user identity");
assert(reactMarkup.includes("&quot;adapterId&quot;:&quot;core&quot;"), "Shell auth runtime hook must expose the active adapter");
assert(reactMarkup.includes("&quot;authenticated&quot;:true"), "Shell auth provider must surface authentication state");

console.log("packages/web shell check passed");