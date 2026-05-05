# packages/web/src/context

Shared frontend context providers and capability bootstrap logic will live here.

Current foundations:
- `bootstrapClient.js` exposes adapter-driven bootstrap fetch helpers.
- `authRuntime.js` owns runtime state transitions for bootstrap/auth readiness.
- `authReact.js` wraps the runtime with `ShellAuthProvider`, `useShellAuth()` and `useShellAuthRuntime()` for the package-track shell.
