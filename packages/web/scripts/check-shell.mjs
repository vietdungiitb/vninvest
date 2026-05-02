import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BUILD_TARGETS,
  ShellAuthProvider,
  createEmptyAuthRuntimeState,
  createShellAuthRuntime,
  deriveAuthRuntimeState,
  navigationCatalog,
  routeCatalog,
  shellAdapters,
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