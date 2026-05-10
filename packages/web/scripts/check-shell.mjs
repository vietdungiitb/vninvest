import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BUILD_TARGETS,
  coreAdapter,
  ShellAuthProvider,
  createCoreAdvisorySessionClient,
  createCoreWhaleAnalyticsSnapshotClient,
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
  ShellAiAdvisoryPage,
  ShellWhaleAlertsPage,
  ShellAiCommandCenterPage,
  ShellDashboardPage,
  ShellPortfoliosPage,
  ShellSettingsPage,
  ShellSupportPage,
  ShellTransactionsPage,
  ShellWatchlistPage,
  shellAdapters,
  VipLocalControlPage,
  useShellAuth,
  useShellAuthRuntime,
} from "../src/index.js";
import { filterAbilitiesBySubject } from "../src/pages/coreShellPageHelpers.js";

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

assert(
  coreAdapter.getSessionPayloadEndpoint().endsWith("/auth/me"),
  "Core adapter must use the current-code auth/me wrapper endpoint for session payloads",
);

const adminOpsRoute = routeCatalog.find((route) => route.id === "admin-ops");
const aiAdvisoryRoute = routeCatalog.find((route) => route.id === "ai-advisory");
const aiCommandCenterRoute = routeCatalog.find((route) => route.id === "ai-command-center");
const dashboardRoute = routeCatalog.find((route) => route.id === "dashboard");
const portfoliosRoute = routeCatalog.find((route) => route.id === "portfolios");
const supportRoute = routeCatalog.find((route) => route.id === "support");
const transactionsRoute = routeCatalog.find((route) => route.id === "transactions");
const watchlistRoute = routeCatalog.find((route) => route.id === "watchlist");
const whaleAlertsRoute = routeCatalog.find((route) => route.id === "whale-alerts");
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
assert(aiAdvisoryRoute?.status === "baseline", "ai-advisory route must remain baseline once the shell AI advisory page exists");
assert(aiCommandCenterRoute?.status === "baseline", "ai-command-center route must move to baseline when the page exists");
assert(dashboardRoute?.status === "baseline", "dashboard route must remain baseline once the shell dashboard page exists");
assert(portfoliosRoute?.status === "baseline", "portfolios route must move to baseline when the page exists");
assert(supportRoute?.status === "baseline", "support route must remain baseline once the shell support page exists");
assert(transactionsRoute?.status === "baseline", "transactions route must remain baseline once the shell transactions page exists");
assert(watchlistRoute?.status === "baseline", "watchlist route must remain baseline once the shell watchlist page exists");
assert(whaleAlertsRoute?.status === "baseline", "whale-alerts route must remain baseline once the shell whale alerts page exists");
assert(settingsRoute?.status === "baseline", "settings route must remain baseline once the shell settings page exists");
assert(vipLocalControlRoute?.status === "baseline", "vip-local-control route must move to baseline when the page exists");

const pageRegistryRouteIds = new Set(getPageRegistryRouteIds());
assert(pageRegistry.length === pageRegistryRouteIds.size, "Duplicate route ids detected in pageRegistry");
assert(pageRegistryRouteIds.has("admin-ops"), "pageRegistry must register admin-ops");
assert(pageRegistryRouteIds.has("ai-advisory"), "pageRegistry must register ai-advisory");
assert(pageRegistryRouteIds.has("ai-command-center"), "pageRegistry must register ai-command-center");
assert(pageRegistryRouteIds.has("dashboard"), "pageRegistry must register dashboard");
assert(pageRegistryRouteIds.has("transactions"), "pageRegistry must register transactions");
assert(pageRegistryRouteIds.has("watchlist"), "pageRegistry must register watchlist");
assert(pageRegistryRouteIds.has("whale-alerts"), "pageRegistry must register whale-alerts");
assert(pageRegistryRouteIds.has("portfolios"), "pageRegistry must register portfolios");
assert(pageRegistryRouteIds.has("support"), "pageRegistry must register support");
assert(pageRegistryRouteIds.has("settings"), "pageRegistry must register settings");
assert(pageRegistryRouteIds.has("vip-local-control"), "pageRegistry must register vip-local-control");
assert(getPageComponent("admin-ops") === ShellAdminOpsPage, "admin-ops must resolve to ShellAdminOpsPage");
assert(getPageComponent("ai-advisory") === ShellAiAdvisoryPage, "ai-advisory must resolve to ShellAiAdvisoryPage");
assert(getPageComponent("ai-command-center") === ShellAiCommandCenterPage, "ai-command-center must resolve to ShellAiCommandCenterPage");
assert(getPageComponent("dashboard") === ShellDashboardPage, "dashboard must resolve to ShellDashboardPage");
assert(getPageComponent("transactions") === ShellTransactionsPage, "transactions must resolve to ShellTransactionsPage");
assert(getPageComponent("watchlist") === ShellWatchlistPage, "watchlist must resolve to ShellWatchlistPage");
assert(getPageComponent("whale-alerts") === ShellWhaleAlertsPage, "whale-alerts must resolve to ShellWhaleAlertsPage");
assert(getPageComponent("portfolios") === ShellPortfoliosPage, "portfolios must resolve to ShellPortfoliosPage");
assert(getPageComponent("support") === ShellSupportPage, "support must resolve to ShellSupportPage");
assert(getPageComponent("settings") === ShellSettingsPage, "settings must resolve to ShellSettingsPage");
assert(getPageComponent("vip-local-control") === VipLocalControlPage, "vip-local-control must resolve to VipLocalControlPage");
assert(typeof renderShellPageChrome === "function", "Shared shell page chrome helper must be exported");
assert(typeof renderShellPanel === "function", "Shared shell panel helper must be exported");
assert(typeof renderShellMetric === "function", "Shared shell metric helper must be exported");
assert(typeof renderShellField === "function", "Shared shell field helper must be exported");
assert(typeof renderShellSelectField === "function", "Shared shell select helper must be exported");
assert(typeof createCoreAdvisorySessionClient === "function", "Core advisory session client must be exported");
assert(typeof createCoreWhaleAnalyticsSnapshotClient === "function", "Core whale analytics snapshot client must be exported");

const explicitAdminAbilities = filterAbilitiesBySubject(
  [
    { action: "manage", subject: "all" },
    { action: "read", subject: "admin.operator.read" },
    { action: "manage", subject: "system.ai_command_center.manage" },
  ],
  "admin",
);

assert(explicitAdminAbilities.length === 1, "Wildcard subject `all` must no longer satisfy admin keyword filters");
assert(explicitAdminAbilities[0].subject === "admin.operator.read", "Explicit admin ability must still match admin keyword filters");

const advisoryRequests = [];
const advisoryClient = createCoreAdvisorySessionClient({
  env: { VNINVEST_CORE_BASE_URL: "http://backend.local/core/v1" },
  fetchImpl: async (url) => {
    advisoryRequests.push(url);

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() {
        return {
          ok: true,
          symbol: "BCM",
          contract_version: "v2",
          selected_trade_date: "2026-04-15",
          aggregate: {
            decision: {
              score: 0.82,
              score_band: "high",
              action: "accumulate",
              risk: "low",
            },
            observability: {
              aggregate_quality: {
                score: 78.4,
                label: "high",
                actionability: 0.82,
                noise_ratio: 0.15,
                consistency: 0.73,
              },
            },
            benchmarks: {
              rvol: 1.6,
              rvol_regime: "elevated",
              relative_strength_20d_pct: 4.2,
              mtf_confirmation_score: 0.67,
              mtf_confirmation_label: "mixed",
            },
          },
        };
      },
    };
  },
});

const advisorySessionPayload = await advisoryClient.getAiAdvisorySession({
  symbol: "BCM",
  contract: "v2",
  includeBenchmarks: true,
  tradeDate: "2026-04-15",
});

assert(advisorySessionPayload.aggregate.decision.action === "accumulate", "Core advisory session client must return advisory session JSON");
assert(
  advisoryRequests[0] === "http://backend.local/core/v1/advisory/latest/BCM/?date=2026-04-15",
  "Core advisory session client must build the stock advisory session endpoint correctly",
);

const fallbackAdvisoryRequests = [];
const fallbackAdvisoryClient = createCoreAdvisorySessionClient({
  env: { VNINVEST_CORE_BASE_URL: "http://backend.local/core/v1" },
  fetchImpl: async (url) => {
    fallbackAdvisoryRequests.push(url);

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() {
        return {
          ok: true,
          symbol: "BCM",
          contract_version: "core_v1",
          selected_trade_date: "2026-04-15",
        };
      },
    };
  },
});

const fallbackAdvisoryPayload = await fallbackAdvisoryClient.getAiAdvisorySession({
  symbol: "BCM",
  contract: "v2",
  includeBenchmarks: true,
  tradeDate: "2026-04-15",
});

assert(fallbackAdvisoryRequests.length === 1, "Core advisory client should issue a single request against the core advisory endpoint");
assert(
  fallbackAdvisoryRequests[0] === "http://backend.local/core/v1/advisory/latest/BCM/?date=2026-04-15",
  "Core advisory client must build advisory latest endpoint on core base URL",
);
assert(fallbackAdvisoryPayload.contract_version === "core_v1", "Advisory payload should expose the core contract version");

const whaleSnapshotRequests = [];
const whaleSnapshotClient = createCoreWhaleAnalyticsSnapshotClient({
  env: { VNINVEST_CORE_BASE_URL: "http://backend.local/core/v1" },
  fetchImpl: async (url) => {
    whaleSnapshotRequests.push(url);

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() {
        return {
          symbol: "HPG",
          trade_date: "2026-04-15",
          session_context: {
            selected_trade_date: "2026-04-15",
            latest_valid_trade_date: "2026-04-15",
            quality_state: "READY",
          },
          materialization: {
            freshness_state: "fresh",
            completeness_state: "complete",
            session_summary_state: "complete",
            read_path: "facts_first",
            bucket_fact_count: 12,
          },
          quality_flags: {
            contract_version: "kline-intelligence-v1",
            has_session_summary: true,
            facts_first_primary_path: true,
          },
          session_summary: {
            quality_state: "READY",
          },
          summary: {
            whale_order_count: 9,
            extreme_order_count: 2,
          },
        };
      },
    };
  },
});

const whaleSnapshotPayload = await whaleSnapshotClient.getWhaleAnalyticsSnapshot({
  symbol: "HPG",
  timeframe: "session",
  compact: true,
  includeBaseline: false,
  tradeDate: "2026-04-15",
});

assert(whaleSnapshotPayload.materialization.read_path === "facts_first", "Core whale analytics snapshot client must return facts-first whale snapshot JSON");
assert(
  whaleSnapshotRequests[0] === "http://backend.local/core/v1/whale-feed-aggregate/HPG/?timeframe=session&compact=1&trade_date=2026-04-15&include_baseline=0",
  "Core whale analytics snapshot client must build the whale-feed-aggregate core endpoint correctly",
);

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

const aiCommandCenterMarkup = renderToStaticMarkup(
  createElement(ShellAiCommandCenterPage, {
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
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["ai-advisory", "settings", "admin-ops", "ai-command-center"],
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

assert(aiCommandCenterMarkup.includes("Trung tâm điều hành AI shell"), "AI command center page must render the Vietnamese page title");
assert(aiCommandCenterMarkup.includes("show_ai_command_center"), "AI command center page must render the AI surface flag");
assert(aiCommandCenterMarkup.includes("ai-command-center"), "AI command center page must render AI route visibility");
assert(aiCommandCenterMarkup.includes("package-admin"), "AI command center page must render the current operator identity");

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

const portfoliosMarkup = renderToStaticMarkup(
  createElement(ShellPortfoliosPage, {
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
          { action: "manage", subject: "Portfolios" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "watchlist", "transactions", "portfolios", "settings"],
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

assert(portfoliosMarkup.includes("Trung tâm danh mục và workspace"), "Portfolios page must render the Vietnamese page title");
assert(portfoliosMarkup.includes("portfolios"), "Portfolios page must render the portfolios route visibility");
assert(portfoliosMarkup.includes("workspace"), "Portfolios page must render workspace group visibility");
assert(portfoliosMarkup.includes("package-admin"), "Portfolios page must render the current operator identity");

const dashboardMarkup = renderToStaticMarkup(
  createElement(ShellDashboardPage, {
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
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "watchlist", "transactions", "portfolios", "settings"],
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

assert(dashboardMarkup.includes("Trung tâm dashboard và workspace"), "Dashboard page must render the Vietnamese page title");
assert(dashboardMarkup.includes("dashboard"), "Dashboard page must render dashboard route visibility");
assert(dashboardMarkup.includes("workspace"), "Dashboard page must render workspace group visibility");
assert(dashboardMarkup.includes("package-admin"), "Dashboard page must render the current operator identity");

const watchlistMarkup = renderToStaticMarkup(
  createElement(ShellWatchlistPage, {
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "Watchlist" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "watchlist", "transactions", "portfolios", "settings"],
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

assert(watchlistMarkup.includes("Trung tâm watchlist và workspace"), "Watchlist page must render the Vietnamese page title");
assert(watchlistMarkup.includes("watchlist"), "Watchlist page must render watchlist route visibility");
assert(watchlistMarkup.includes("workspace"), "Watchlist page must render workspace group visibility");
assert(watchlistMarkup.includes("package-admin"), "Watchlist page must render the current operator identity");

const transactionsMarkup = renderToStaticMarkup(
  createElement(ShellTransactionsPage, {
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "Transactions" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "watchlist", "transactions", "portfolios", "settings"],
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

assert(transactionsMarkup.includes("Trung tâm giao dịch và workspace"), "Transactions page must render the Vietnamese page title");
assert(transactionsMarkup.includes("transactions"), "Transactions page must render transactions route visibility");
assert(transactionsMarkup.includes("workspace"), "Transactions page must render workspace group visibility");
assert(transactionsMarkup.includes("package-admin"), "Transactions page must render the current operator identity");

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

const supportPageMarkup = renderToStaticMarkup(
  createElement(ShellSupportPage, {
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "Support" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "system", "admin"],
          visible_routes: ["dashboard", "support", "settings", "ai-command-center"],
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

assert(supportPageMarkup.includes("Trung tâm hỗ trợ hệ thống"), "Shell support page must render the Vietnamese page title");
assert(supportPageMarkup.includes("support"), "Shell support page must render support route visibility");
assert(supportPageMarkup.includes("package-admin"), "Shell support page must render the current operator identity");
assert(supportPageMarkup.includes("show_admin_ops"), "Shell support page must render enabled surface flags");

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

const aiAdvisoryMarkup = renderToStaticMarkup(
  createElement(ShellAiAdvisoryPage, {
    autoLoad: false,
    advisorySymbol: "BCM",
    initialAdvisorySession: {
      ok: true,
      symbol: "BCM",
      contract_version: "v2",
      selected_trade_date: "2026-04-15",
      aggregate: {
        decision: {
          score: 0.82,
          score_band: "high",
          action: "accumulate",
          risk: "low",
        },
        observability: {
          aggregate_quality: {
            score: 78.4,
            label: "high",
            actionability: 0.82,
            noise_ratio: 0.15,
            consistency: 0.73,
          },
        },
        benchmarks: {
          rvol: 1.6,
          rvol_regime: "elevated",
          relative_strength_20d_pct: 4.2,
          mtf_confirmation_score: 0.67,
          mtf_confirmation_label: "mixed",
        },
      },
    },
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "WhaleAdvisory" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "ai-advisory", "whale-alerts", "watchlist", "transactions"],
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

assert(aiAdvisoryMarkup.includes("Trung tâm AI advisory và tín hiệu"), "AI advisory page must render the Vietnamese page title");
assert(aiAdvisoryMarkup.includes("ai-advisory"), "AI advisory page must render ai-advisory route visibility");
assert(aiAdvisoryMarkup.includes("signals"), "AI advisory page must render signals group visibility");
assert(aiAdvisoryMarkup.includes("package-admin"), "AI advisory page must render the current operator identity");
assert(aiAdvisoryMarkup.includes("BCM"), "AI advisory page must render the advisory symbol from the live data slice");
assert(aiAdvisoryMarkup.includes("78.4"), "AI advisory page must render advisory quality from the read-only data slice");
assert(aiAdvisoryMarkup.includes("elevated"), "AI advisory page must render benchmark enrichment from the read-only data slice");
assert(aiAdvisoryMarkup.includes("Đổi mã advisory"), "AI advisory page must render the advisory symbol control");

const aiAdvisoryQueryMarkup = renderToStaticMarkup(
  createElement(ShellAiAdvisoryPage, {
    autoLoad: false,
    advisorySearch: "?symbol=fpt",
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "WhaleAdvisory" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "ai-advisory", "whale-alerts", "watchlist", "transactions"],
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

assert(aiAdvisoryQueryMarkup.includes("FPT"), "AI advisory page must resolve the advisory symbol from the query string when no prop overrides it");
assert(aiAdvisoryQueryMarkup.includes("Chưa có advisory session thật"), "AI advisory page must keep a graceful empty state for query-driven advisory symbols");

const whaleAlertsMarkup = renderToStaticMarkup(
  createElement(ShellWhaleAlertsPage, {
    autoLoad: false,
    whaleSymbol: "HPG",
    whaleTradeDate: "2026-04-19",
    initialWhaleSnapshot: {
      symbol: "HPG",
      trade_date: "2026-04-17",
      session: {
        resolved_from: "latest_completed_session",
      },
      session_context: {
        selected_trade_date: "2026-04-19",
        latest_valid_trade_date: "2026-04-17",
        quality_state: "DEGRADED_SESSION_FALLBACK",
      },
      materialization: {
        freshness_state: "fresh",
        completeness_state: "complete",
        session_summary_state: "complete",
        read_path: "facts_first",
        bucket_fact_count: 12,
      },
      quality_flags: {
        contract_version: "kline-intelligence-v1",
        has_session_summary: true,
        facts_first_primary_path: true,
      },
      session_summary: {
        quality_state: "DEGRADED_SESSION_FALLBACK",
      },
      summary: {
        whale_order_count: 9,
        extreme_order_count: 2,
      },
    },
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "WhaleAdvisory" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "ai-advisory", "whale-alerts", "watchlist", "transactions"],
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

assert(whaleAlertsMarkup.includes("Trung tâm whale alerts và tín hiệu"), "Whale alerts page must render the Vietnamese page title");
assert(whaleAlertsMarkup.includes("whale-alerts"), "Whale alerts page must render whale-alerts route visibility");
assert(whaleAlertsMarkup.includes("signals"), "Whale alerts page must render signals group visibility");
assert(whaleAlertsMarkup.includes("package-admin"), "Whale alerts page must render the current operator identity");
assert(whaleAlertsMarkup.includes("HPG"), "Whale alerts page must render the whale snapshot symbol from the live data slice");
assert(whaleAlertsMarkup.includes("facts_first"), "Whale alerts page must render the facts-first materialization path");
assert(whaleAlertsMarkup.includes("DEGRADED_SESSION_FALLBACK"), "Whale alerts page must render the whale snapshot quality state");
assert(whaleAlertsMarkup.includes("2026-04-19"), "Whale alerts page must render the requested whale trade date when one is provided");
assert(whaleAlertsMarkup.includes("2026-04-17"), "Whale alerts page must render the latest valid whale trade date returned by the snapshot payload");
assert(whaleAlertsMarkup.includes("latest_completed_session"), "Whale alerts page must render the resolved session source from the whale snapshot payload");
assert(whaleAlertsMarkup.includes("Tải snapshot whale"), "Whale alerts page must render the whale snapshot control");
assert(whaleAlertsMarkup.includes("Dùng phiên hợp lệ gần nhất"), "Whale alerts page must render the quick action for the latest valid trade date when fallback metadata is available");

const whaleAlertsQueryMarkup = renderToStaticMarkup(
  createElement(ShellWhaleAlertsPage, {
    autoLoad: false,
    whaleSearch: "?symbol=ssi&trade_date=2026-04-19",
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
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: "saas",
          plan: "pro",
        },
        abilities: [
          { action: "read", subject: "WhaleAdvisory" },
          { action: "manage", subject: "all" },
        ],
        navigation: {
          visible_groups: ["workspace", "signals", "system", "admin"],
          visible_routes: ["dashboard", "ai-advisory", "whale-alerts", "watchlist", "transactions"],
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

assert(whaleAlertsQueryMarkup.includes("SSI"), "Whale alerts page must resolve the whale symbol from the query string when no prop overrides it");
assert(whaleAlertsQueryMarkup.includes("2026-04-19"), "Whale alerts page must resolve the whale trade date from the query string when no prop overrides it");
assert(whaleAlertsQueryMarkup.includes("Chưa có whale snapshot thật"), "Whale alerts page must keep a graceful empty state for query-driven whale symbols");

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