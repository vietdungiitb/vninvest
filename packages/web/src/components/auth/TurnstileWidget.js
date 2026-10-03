import { createElement, useEffect, useMemo } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

/**
 * tenantreg-d (slice D) — D1.
 *
 * Cloudflare's always-pass TEST site key. It is safe in a dev server and in test
 * runners, and it is DANGEROUS in a production build: the backend verifies the
 * token with the REAL secret, gets `success: false`, and rejects the
 * registration. Shipping it as a silent fallback means the anti-bot control
 * renders a green check while enforcing nothing, and the user only finds out
 * from a 400. So the fallback is scoped to dev/test and production renders a
 * visible error instead.
 */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/** Shape of the build-time environment this component reads. */
export function readTurnstileEnv() {
  // Vite and Vitest inject `import.meta.env`. Under jest the file is compiled
  // to CJS and `import.meta.env` resolves to an empty object, so every read
  // below is `undefined` and the `process.env` fallbacks take over. Verified by
  // running it, not assumed.
  const viteEnv = import.meta.env ?? {};
  const nodeEnv = typeof process !== "undefined" ? process.env ?? {} : {};

  const siteKeyRaw = viteEnv.VITE_TURNSTILE_SITE_KEY;
  const mode = String(viteEnv.MODE || nodeEnv.NODE_ENV || "");

  return {
    siteKey: typeof siteKeyRaw === "string" ? siteKeyRaw.trim() : "",
    mode,
    // `import.meta.env.DEV` is true in a dev server AND under Vitest; MODE is
    // what actually separates them ("development" vs "test").
    isDev: Boolean(viteEnv.DEV) || mode === "development",
    isTest: mode === "test",
  };
}

/**
 * Decide which site key to use.
 *
 * `import.meta.env.VITE_TURNSTILE_SITE_KEY` is the only supported production
 * source (see docs/plans/FRONTEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md:54).
 *
 * The old code read a Create-React-App style `process.env.REACT_APP_*` variable
 * and a `window.*_SITE_KEY` global. Neither can ever resolve in this app:
 * `vite.config.ts` declares no `define` and no process shim, `index.html` sets
 * nothing, and no file ever assigns that window global. The function therefore
 * always fell through to the test key.
 */
export function resolveTurnstileSiteKey(env = readTurnstileEnv()) {
  // Trim at the point of decision, not only at the read: a `.env` line with
  // trailing whitespace is truthy, so without this a blank key would be treated
  // as configured and the widget would render a challenge that can never load.
  const siteKey = typeof env.siteKey === "string" ? env.siteKey.trim() : "";

  if (siteKey) {
    return { siteKey, source: "env", isTestKey: false, isMissing: false };
  }
  if (env.isDev || env.isTest) {
    return { siteKey: TURNSTILE_TEST_SITE_KEY, source: "test-fallback", isTestKey: true, isMissing: false };
  }
  // Production build with no key: fail loud, never fake a passing challenge.
  return { siteKey: "", source: "missing", isTestKey: false, isMissing: true };
}

/**
 * @typedef {Object} TurnstileWidgetProps
 * @property {(token: string) => void} [onVerify]
 * @property {() => void} [onError]
 * @property {() => void} [onExpire]
 * @property {string} [errorMessage]  inline error copy shown under a live challenge
 * @property {string} [unavailableMessage]  shown when no site key is configured
 */

/**
 * @param {TurnstileWidgetProps} props
 */
export function TurnstileWidget({ onVerify, onError, onExpire, errorMessage, unavailableMessage }) {
  const resolved = useMemo(() => resolveTurnstileSiteKey(), []);
  const { siteKey, isMissing, isTestKey } = resolved;

  // A missing key is a deployment error, not a user error. Tell the parent once
  // so the form can explain itself and the submit button can stay disabled.
  useEffect(() => {
    if (isMissing) {
      onError?.();
    }
  }, [isMissing, onError]);

  if (isMissing) {
    return createElement(
      "div",
      {
        className: "my-2 rounded-md border border-rose-800/70 bg-rose-950/20 px-3 py-2 text-sm text-rose-200",
        role: "alert",
        "data-testid": "turnstile-config-error",
      },
      unavailableMessage || "Turnstile is not configured.",
    );
  }

  // Test runners cannot solve a real Turnstile challenge, so they get a button
  // that hands back a canned token. The backend treats a test token as valid
  // only when it is configured with Cloudflare's test secret.
  if (isTestKey) {
    return createElement(
      "button",
      {
        type: "button",
        "data-testid": "turnstile-test-trigger",
        onClick: () => onVerify?.("cf-test-token"),
      },
      "Turnstile test token",
    );
  }

  return createElement(
    "div",
    { className: "my-2 flex justify-center" },
    createElement(Turnstile, {
      siteKey,
      onSuccess: (token) => onVerify?.(String(token || "")),
      onError: () => onError?.(),
      onExpire: () => onExpire?.(),
      options: {
        theme: "dark",
        size: "flexible",
      },
    }),
    errorMessage
      ? createElement("p", { className: "text-red-400 text-xs", role: "alert" }, errorMessage)
      : null,
  );
}
