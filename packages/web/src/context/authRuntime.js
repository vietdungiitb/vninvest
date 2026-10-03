import { deriveLegacyAuthState, loadShellBootstrap, resolveShellAdapter } from "./bootstrapClient.js";

function createEmptyUserIdentity() {
  return {
    id: null,
    username: "",
    email: "",
    isStaff: false,
    isSuperuser: false,
    is_staff: false,
    is_superuser: false,
  };
}

function cloneAuthRuntimeState(state) {
  return {
    ...state,
    userIdentity: { ...state.userIdentity },
    abilities: [...state.abilities],
    navigation: {
      ...state.navigation,
      visible_groups: [...state.navigation.visible_groups],
      visible_routes: [...state.navigation.visible_routes],
    },
    surfaces: { ...state.surfaces },
    session: state.session
      ? {
          ...state.session,
          principal: state.session.principal ? { ...state.session.principal } : null,
          tenant: state.session.tenant ? { ...state.session.tenant } : null,
        }
      : null,
    health: state.health ? { ...state.health } : null,
    buildMeta: state.buildMeta ? { ...state.buildMeta } : null,
    bootstrap: state.bootstrap ? { ...state.bootstrap } : null,
  };
}

export function createEmptyAuthRuntimeState(options = {}) {
  const { buildTarget = null, buildMeta = null } = options;

  return {
    status: "idle",
    loading: false,
    authStateReady: false,
    isAuthenticated: false,
    error: null,
    bootstrap: null,
    buildMeta,
    userPlan: "free",
    userIdentity: createEmptyUserIdentity(),
    abilities: [],
    buildTarget,
    navigation: {
      visible_groups: [],
      visible_routes: [],
    },
    surfaces: {
      show_operations_center: false,
      show_ai_command_center: false,
      show_vip_shell: false,
    },
    session: null,
    health: null,
  };
}

export function deriveAuthRuntimeState(bootstrapPayload, options = {}) {
  const { buildTarget = null, buildMeta = null } = options;
  const legacyAuthState = deriveLegacyAuthState(bootstrapPayload);
  const userIdentity = legacyAuthState.userIdentity || createEmptyUserIdentity();

  return {
    status: "ready",
    loading: false,
    authStateReady: true,
    isAuthenticated: Boolean(legacyAuthState.session?.session_id),
    error: null,
    bootstrap: bootstrapPayload,
    buildMeta: buildMeta || bootstrapPayload?.buildMeta || null,
    userPlan: legacyAuthState.userPlan || "free",
    userIdentity,
    abilities: Array.isArray(legacyAuthState.abilities) ? legacyAuthState.abilities : [],
    buildTarget: legacyAuthState.buildTarget ?? buildTarget,
    navigation: legacyAuthState.navigation || {
      visible_groups: [],
      visible_routes: [],
    },
    surfaces: legacyAuthState.surfaces || {
      show_operations_center: false,
      show_ai_command_center: false,
      show_vip_shell: false,
    },
    session: legacyAuthState.session || null,
    health: legacyAuthState.health || null,
  };
}

export function createShellAuthRuntime(options = {}) {
  const {
    adapter: adapterOrId,
    env = {},
    fetchImpl,
    bootstrapLoader = loadShellBootstrap,
  } = options;
  const adapter = resolveShellAdapter(adapterOrId);
  const buildMeta = adapter.getBuildMeta(env);
  const listeners = new Set();
  let state = createEmptyAuthRuntimeState({
    buildTarget: buildMeta.target,
    buildMeta,
  });

  function emit() {
    const snapshot = cloneAuthRuntimeState(state);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function commit(nextState) {
    state = nextState;
    emit();
    return cloneAuthRuntimeState(state);
  }

  return {
    adapter,
    getBuildMeta() {
      return { ...buildMeta };
    },
    getState() {
      return cloneAuthRuntimeState(state);
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new Error("A listener function is required to subscribe to the shell auth runtime");
      }

      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      return commit(
        createEmptyAuthRuntimeState({
          buildTarget: buildMeta.target,
          buildMeta,
        }),
      );
    },
    hydrate(bootstrapPayload) {
      return commit(
        deriveAuthRuntimeState(bootstrapPayload, {
          buildTarget: buildMeta.target,
          buildMeta,
        }),
      );
    },
    async refresh() {
      state = {
        ...state,
        status: state.status === "idle" ? "bootstrapping" : "refreshing",
        loading: true,
        authStateReady: false,
        error: null,
      };
      emit();

      try {
        const bootstrapPayload = await bootstrapLoader({
          adapter,
          env,
          fetchImpl,
        });

        return this.hydrate(bootstrapPayload);
      } catch (error) {
        return commit({
          ...state,
          status: "error",
          loading: false,
          authStateReady: true,
          error,
        });
      }
    },
  };
}