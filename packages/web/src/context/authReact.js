import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { createShellAuthRuntime } from "./authRuntime.js";
import { authTokenStorage, isTokenExpiringSoon } from "../adapters/coreApiAdapter.js";

export const ShellAuthContext = createContext(null);
export const ShellAuthRuntimeContext = createContext(null);

function createShellAuthContextValue(runtime, snapshot) {
  return {
    ...snapshot,
    adapter: runtime.adapter,
    buildMeta: runtime.getBuildMeta(),
    refresh() {
      return runtime.refresh();
    },
    reset() {
      return runtime.reset();
    },
    hydrate(bootstrapPayload) {
      return runtime.hydrate(bootstrapPayload);
    },
  };
}

export function ShellAuthProvider({
  children,
  runtime = null,
  adapter,
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoRefresh = true,
}) {
  const runtimeRef = useRef(runtime);

  if (runtime && runtimeRef.current !== runtime) {
    runtimeRef.current = runtime;
  }

  if (runtimeRef.current === null) {
    runtimeRef.current = createShellAuthRuntime({
      adapter,
      env,
      fetchImpl,
      bootstrapLoader,
    });
  }

  const activeRuntime = runtimeRef.current;
  const snapshot = useSyncExternalStore(
    activeRuntime.subscribe,
    activeRuntime.getState,
    activeRuntime.getState,
  );

  const silentRefreshRef = useRef(null);

  const scheduleSilentRefresh = useCallback(() => {
    const accessToken = authTokenStorage.getAccessToken();
    if (!accessToken) return;

    // If token expires within 60s, refresh proactively
    if (isTokenExpiringSoon(accessToken, 60)) {
      void activeRuntime.refresh();
      return;
    }

    // Otherwise schedule a check at token expiry - 60s, minimum 5s
    const payload = (() => {
      try {
        const parts = accessToken.split(".");
        if (parts.length !== 3) return null;
        return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      } catch { return null; }
    })();

    if (payload?.exp) {
      const now = Math.floor(Date.now() / 1000);
      const msUntilExp = (payload.exp - now - 60) * 1000;
      if (msUntilExp > 5000 && isFinite(msUntilExp)) {
        silentRefreshRef.current = setTimeout(scheduleSilentRefresh, msUntilExp);
      }
    }
  }, [activeRuntime]);

  useEffect(() => {
    silentRefreshRef.current = null;

    if (!autoRefresh) {
      return () => {
        if (silentRefreshRef.current) {
          clearTimeout(silentRefreshRef.current);
          silentRefreshRef.current = null;
        }
      };
    }

    void activeRuntime.refresh();
    scheduleSilentRefresh();

    return () => {
      if (silentRefreshRef.current) {
        clearTimeout(silentRefreshRef.current);
        silentRefreshRef.current = null;
      }
    };
  }, [activeRuntime, autoRefresh, scheduleSilentRefresh]);

  return createElement(
    ShellAuthRuntimeContext.Provider,
    { value: activeRuntime },
    createElement(
      ShellAuthContext.Provider,
      { value: createShellAuthContextValue(activeRuntime, snapshot) },
      children,
    ),
  );
}

export function useShellAuth() {
  const context = useContext(ShellAuthContext);
  if (context === null) {
    throw new Error("useShellAuth must be used inside ShellAuthProvider");
  }

  return context;
}

export function useShellAuthRuntime() {
  const context = useContext(ShellAuthRuntimeContext);
  if (context === null) {
    throw new Error("useShellAuthRuntime must be used inside ShellAuthProvider");
  }

  return context;
}