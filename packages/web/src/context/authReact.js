import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { createShellAuthRuntime } from "./authRuntime.js";

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

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    void activeRuntime.refresh();
    return undefined;
  }, [activeRuntime, autoRefresh]);

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