/**
 * tenantreg-d (slice D) — D1 regression gate.
 *
 * The old `resolveSiteKey()` read `process.env.REACT_APP_TURNSTILE_SITE_KEY`
 * and `window.TURNSTILE_SITE_KEY`. Neither can ever resolve in this Vite app:
 * `vite.config.ts` declares no `define` and no `process` shim, `index.html` sets
 * nothing, and no file ever assigns `window.TURNSTILE_SITE_KEY`. The function
 * therefore always fell through to Cloudflare's always-pass TEST key
 * `1x00000000000000000000AA`, while the backend verified the token with the REAL
 * secret — so every self-service registration failed with an invalid
 * `turnstile_token` wherever Turnstile was genuinely enabled.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";

import {
  TURNSTILE_TEST_SITE_KEY,
  TurnstileWidget,
  readTurnstileEnv,
  resolveTurnstileSiteKey,
} from "./TurnstileWidget.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const PRODUCTION_ENV = { siteKey: "", mode: "production", isDev: false, isTest: false };
const DEV_ENV = { siteKey: "", mode: "development", isDev: true, isTest: false };
const TEST_ENV = { siteKey: "", mode: "test", isDev: true, isTest: true };

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("tenantreg D1 — resolveTurnstileSiteKey", () => {
  test("uses VITE_TURNSTILE_SITE_KEY when it is configured", () => {
    const resolved = resolveTurnstileSiteKey({ ...PRODUCTION_ENV, siteKey: "0x4AAAAAAA-real-key" });
    expect(resolved).toEqual({ siteKey: "0x4AAAAAAA-real-key", source: "env", isTestKey: false, isMissing: false });
  });

  test("trims a configured key", () => {
    expect(resolveTurnstileSiteKey({ ...PRODUCTION_ENV, siteKey: "  0xKEY  " }).siteKey).toBe("0xKEY");
  });

  test("falls back to the test key in a dev server", () => {
    const resolved = resolveTurnstileSiteKey(DEV_ENV);
    expect(resolved.siteKey).toBe(TURNSTILE_TEST_SITE_KEY);
    expect(resolved.isTestKey).toBe(true);
    expect(resolved.isMissing).toBe(false);
  });

  test("falls back to the test key under a test runner", () => {
    expect(resolveTurnstileSiteKey(TEST_ENV).siteKey).toBe(TURNSTILE_TEST_SITE_KEY);
  });

  test("treats a blank / whitespace-only key as missing", () => {
    expect(resolveTurnstileSiteKey({ ...PRODUCTION_ENV, siteKey: "   " }).isMissing).toBe(true);
    expect(resolveTurnstileSiteKey({ ...PRODUCTION_ENV, siteKey: "" }).isMissing).toBe(true);
  });

  test("NEVER falls back to the always-pass test key in a production build", () => {
    const resolved = resolveTurnstileSiteKey(PRODUCTION_ENV);
    expect(resolved.isMissing, "production build without a key must fail loud").toBe(true);
    expect(resolved.siteKey, "production must not render a fake challenge").toBe("");
    expect(resolved.isTestKey).toBe(false);
  });
});

describe("tenantreg D1 — readTurnstileEnv reads the Vite env, not a process shim", () => {
  test("exposes the documented VITE_TURNSTILE_SITE_KEY name", () => {
    // In the test runner the key is unset, so this asserts the wiring exists and
    // returns a string rather than undefined.
    const env = readTurnstileEnv();
    expect(typeof env.siteKey).toBe("string");
    expect(env.mode).toBe("test");
  });
});

describe("tenantreg D1 — TurnstileWidget render states", () => {
  test("renders the test trigger and reports a token under a test runner", () => {
    const onVerify = vi.fn();
    render(<TurnstileWidget onVerify={onVerify} />);

    const trigger = screen.getByTestId("turnstile-test-trigger");
    trigger.click();
    expect(onVerify).toHaveBeenCalledWith("cf-test-token");
  });

  test("renders a real error state and notifies the parent when the key is missing in production", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");

    const onError = vi.fn();
    render(
      <TurnstileWidget
        onError={onError}
        unavailableMessage="Turnstile chưa được cấu hình."
      />,
    );

    const alert = screen.getByTestId("turnstile-config-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toBe("Turnstile chưa được cấu hình.");
    // Crucially: no fake "solved it" affordance is offered to the user.
    expect(screen.queryByTestId("turnstile-test-trigger")).toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  test("never calls onVerify on its own when the key is missing", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");

    const onVerify = vi.fn();
    render(<TurnstileWidget onVerify={onVerify} />);
    expect(onVerify).not.toHaveBeenCalled();
  });
});

/**
 * Source-level pin. The original bug was a *pair* of reads that can never
 * resolve in Vite; re-introducing either one would silently restore the
 * always-pass test key, so forbid the strings outright.
 */
describe("tenantreg D1 — dead env reads are not reintroduced", () => {
  const source = readFileSync(join(HERE, "TurnstileWidget.js"), "utf8");

  test("no REACT_APP_ prefix (CRA convention, unsupported by Vite)", () => {
    expect(source).not.toContain("REACT_APP_TURNSTILE_SITE_KEY");
  });

  test("no window.TURNSTILE_SITE_KEY (never assigned anywhere in the repo)", () => {
    expect(source).not.toContain("window.TURNSTILE_SITE_KEY");
  });

  test("still reads the documented Vite variable", () => {
    expect(source).toContain("VITE_TURNSTILE_SITE_KEY");
  });
});
