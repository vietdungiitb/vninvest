/**
 * tenantreg-d (slice D) — unit pins for the auth error parser and the auth
 * adapter wire contract.
 *
 * The component-level behaviour is covered by tenantreg-auth-pages.component.test.tsx.
 * This file tests the pure functions and the exact request bodies, because a
 * wrong body is invisible to a mocked-adapter component test.
 */
import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CoreApiRequestError } from "../../adapters/coreApiAdapter.js";
import { createAuthClient } from "../../adapters/core/auth.js";
import { createTranslator } from "../../i18n/index.js";
import {
  CODE_TO_I18N_KEY,
  collectFieldErrors,
  parseAuthError,
  resolveErrorCode,
  resolveGlobalMessage,
  resolveRetryAfterSeconds,
  REGISTER_FIELD_MAP,
} from "./authErrors.js";
import { PASSWORD_MIN_LENGTH, isValidUsername, normalizeUsername, scorePassword } from "./authPolicy.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const tVi = createTranslator("vi");
const tEn = createTranslator("en");

describe("tenantreg D4 — collectFieldErrors reads every container", () => {
  test("reads the legacy `{ detail: { field: [...] } }` shape", () => {
    const error = new CoreApiRequestError("x", { status: 400, payload: { detail: { email: ["E"] } } });
    expect(collectFieldErrors(error)).toEqual({ email: ["E"] });
  });

  test("reads slice A's `field_errors` envelope via error.fieldErrors", () => {
    const error = new CoreApiRequestError("x", {
      status: 400,
      payload: { detail: "weak", field_errors: { password: ["P"] } },
      fieldErrors: { password: ["P"] },
    });
    expect(collectFieldErrors(error).password).toEqual(["P"]);
  });

  test("reads `field_errors` straight off the payload", () => {
    const error = new CoreApiRequestError("x", { status: 400, payload: { field_errors: { token: ["T"] } } });
    expect(collectFieldErrors(error).token).toEqual(["T"]);
  });

  test("keeps EVERY message for a field, not just the first", () => {
    const error = new CoreApiRequestError("x", {
      status: 400,
      payload: { detail: { password: ["a", "b", "c"] } },
    });
    expect(collectFieldErrors(error).password).toEqual(["a", "b", "c"]);
  });

  test("accepts a bare string value as well as an array", () => {
    const error = new CoreApiRequestError("x", { status: 400, payload: { detail: { email: "E" } } });
    expect(collectFieldErrors(error).email).toEqual(["E"]);
  });

  test("the old 4-key whitelist would have dropped these fields", () => {
    const error = new CoreApiRequestError("x", {
      status: 400,
      payload: {
        detail: {
          password: ["p"],
          non_field_errors: ["n"],
          website: ["w"],
          first_name: ["f"],
        },
      },
    });
    const parsed = parseAuthError(error as any, tVi, { locale: "vi" });
    // `password` now maps to a real control.
    expect(parsed.fieldErrors.password).toEqual(["p"]);
    // The rest are not silently dropped: they are collected for the banner.
    expect(parsed.unmappedMessages).toEqual(expect.arrayContaining(["n", "f"]));
    // The honeypot is never attached to a named field — the backend answers a
    // filled honeypot with a fake generic error precisely so a bot cannot detect
    // the trap (serializers.py:412-415), so naming the field would give it away.
    expect(Object.keys(parsed.fieldErrors)).not.toContain("website");
  });
});

describe("tenantreg D5 — code resolution", () => {
  test("prefers error.code, then payload.code", () => {
    expect(resolveErrorCode({ code: "a", payload: { code: "b" } })).toBe("a");
    expect(resolveErrorCode({ payload: { code: "b" } })).toBe("b");
    expect(resolveErrorCode({})).toBe("");
  });

  test("every mapped code resolves to a real, non-key string in BOTH locales", () => {
    Object.entries(CODE_TO_I18N_KEY).forEach(([code, key]) => {
      [tVi, tEn].forEach((t, index) => {
        const localeName = index === 0 ? "vi" : "en";
        const value = t(key, { min: PASSWORD_MIN_LENGTH, seconds: 60, code });
        expect(value, `${localeName} ${code} -> ${key} is missing`).not.toBe(key);
        expect(value.trim().length, `${localeName} ${code} -> ${key} is empty`).toBeGreaterThan(0);
      });
    });
  });

  test("registration collisions all collapse onto one neutral message", () => {
    const keys = new Set([
      CODE_TO_I18N_KEY.registration_unavailable,
      CODE_TO_I18N_KEY.username_already_exists,
      CODE_TO_I18N_KEY.email_already_exists,
    ]);
    expect(keys.size, "all three collision codes must share one message").toBe(1);
  });

  test("a 429 produces a localized countdown, not the raw detail", () => {
    const error = new CoreApiRequestError("x", {
      status: 429,
      payload: { detail: "Thử lại quá nhanh từ IP này.", code: "register_rate_limit_exceeded" },
    });
    const message = resolveGlobalMessage(error, tVi, { locale: "vi" });
    expect(message).toMatch(/60 giây/);
    expect(message).not.toMatch(/từ IP/);
  });

  test("an UNRECOGNISED code yields a localized fallback that still shows the code", () => {
    const error = new CoreApiRequestError("x", {
      status: 500,
      payload: { detail: "Một lỗi lạ chưa từng thấy.", code: "brand_new_code" },
    });
    [tVi, tEn].forEach((t) => {
      const message = resolveGlobalMessage(error, t, { locale: "vi" });
      expect(message).toMatch(/brand_new_code/);
      // Raw prose must never be the answer when a code exists to translate.
      expect(message).not.toMatch(/chưa từng thấy/);
    });
  });

  test("with no code at all, a VI reader still gets the server's own wording", () => {
    const error = new CoreApiRequestError("x", { status: 400, payload: { detail: "Chi tiết từ server." } });
    expect(resolveGlobalMessage(error, tVi, { locale: "vi" })).toBe("Chi tiết từ server.");
    // An EN reader must not be shown Vietnamese.
    expect(resolveGlobalMessage(error, tEn, { locale: "en" })).not.toBe("Chi tiết từ server.");
  });

  test("a plain network failure still produces localized copy", () => {
    const error = new TypeError("Failed to fetch");
    const message = resolveGlobalMessage(error, tEn, { locale: "en", fallbackKey: "auth.loginFailed" });
    expect(message).not.toBe("auth.loginFailed");
    expect(message).not.toBe("Failed to fetch");
  });

  test("the cooldown prefers a server-provided value over the default", () => {
    expect(resolveRetryAfterSeconds({ payload: { retry_after: 42 } })).toBe(42);
    expect(resolveRetryAfterSeconds({ payload: {} })).toBe(60);
    expect(resolveRetryAfterSeconds({})).toBe(60);
  });

  test("REGISTER_FIELD_MAP covers the fields the backend can actually return", () => {
    ["username", "email", "password", "password_confirm", "turnstile_token"].forEach((field) => {
      expect(REGISTER_FIELD_MAP[field], `${field} is unmapped`).toBeTruthy();
    });
  });
});

describe("tenantreg D6 — password policy single source of truth", () => {
  test("the minimum is 10 and the copy interpolates it rather than hardcoding it", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    const interpolated = tVi("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH });
    expect(interpolated).toContain("10");
    expect(interpolated).not.toContain("{min}");
  });

  test("no dictionary hardcodes the minimum any more", () => {
    ["auth.validation.passwordMinLength"].forEach((key) => {
      expect(tVi(key, { min: 10 })).not.toMatch(/\b8\b/);
      expect(tEn(key, { min: 10 })).not.toMatch(/\b8\b/);
    });
  });

  test("an all-numeric password scores zero, matching NumericPasswordValidator", () => {
    expect(scorePassword("1234567890123")).toBe(0);
  });

  test("a long mixed password scores higher than a short weak one", () => {
    expect(scorePassword("Str0ng-Passw0rd!")).toBeGreaterThan(scorePassword("abc"));
  });

  test("username rules mirror serializers.py:384", () => {
    expect(isValidUsername("viet_dung")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("a".repeat(31))).toBe(false);
  });
});

describe("tenantreg D10 — username normalisation", () => {
  test("lowercases and trims", () => {
    expect(normalizeUsername("  VietDung  ")).toBe("vietdung");
  });
});

describe("tenantreg — auth adapter wire contract", () => {
  function makeClient() {
    const corePost = vi.fn().mockResolvedValue({ data: { access: "a", refresh: "r" } });
    const coreGet = vi.fn().mockResolvedValue({});
    const corePatch = vi.fn().mockResolvedValue({});
    return {
      client: createAuthClient({ coreGet, corePost, corePatch, persistTokens: vi.fn(), getRefreshToken: () => null }),
      corePost,
    };
  }

  test("login lowercases the username so a mixed-case sign-in can work", async () => {
    const { client, corePost } = makeClient();
    await client.loginUser({ username: "  VietDung  ", password: "pw" });
    expect(corePost).toHaveBeenCalledWith("/auth/token/", { username: "vietdung", password: "pw" });
  });

  test("register forwards the honeypot and the Turnstile token", () => {
    const { client, corePost } = makeClient();
    client.registerUser({
      username: "VietDung",
      email: "A@B.com",
      password: "pw",
      password_confirm: "pw",
      website: "spam.example",
      turnstile_token: "tok",
    });
    expect(corePost).toHaveBeenCalledWith("/auth/register/", {
      username: "vietdung",
      email: "a@b.com",
      password: "pw",
      password_confirm: "pw",
      website: "spam.example",
      turnstile_token: "tok",
    });
  });

  /**
   * The brief's end-to-end check: post the exact body the adapter sends and
   * prove the backend will accept it.
   *
   * The adapter sends the CANONICAL `new_password`, and that is correct. The
   * gap is on the server:
   *   identity_access/views/password_reset.py:77
   *     new_password = str(request.data.get('password', '') or '')
   * so the canonical field arrives as '' and line :79 rejects the request with
   * "token and password are required." — password reset is 100% broken on the
   * current backend, for every user, regardless of password.
   *
   * A client-side shim that also sent the legacy `password` name was tried and
   * reverted (it would duplicate a secret field on a credential endpoint, and the
   * defect belongs to slice A). So this test asserts what the CLIENT must
   * guarantee, and separately reports the server-side key so the gap stays
   * visible instead of being quietly papered over.
   */
  test("confirmPasswordReset sends the canonical field names only", () => {
    const { client, corePost } = makeClient();
    client.confirmPasswordReset(" tok ", "New-Passw0rd!", "New-Passw0rd!");

    const [path, body] = corePost.mock.calls[0] as any;
    expect(path).toBe("/auth/password-reset/confirm/");
    expect(body).toEqual({
      token: "tok",
      new_password: "New-Passw0rd!",
      new_password_confirm: "New-Passw0rd!",
    });
    // No redundant copy of the secret under the legacy name.
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("password_confirm");
  });

  test("KNOWN BACKEND GAP: password_reset.py still reads the legacy key, so reset 400s", () => {
    const backend = readFileSync(
      // HERE = <repo>/packages/web/src/pages/auth -> up 4 = <repo>/packages
      join(HERE, "../../../../core/backend/src/identity_access/views/password_reset.py"),
      "utf8",
    );
    const readKey = /request\.data\.get\('(new_password|password)'/.exec(backend)?.[1];
    expect(readKey, "could not determine which password key the backend reads").toBeTruthy();
    expect(
      readKey,
      "password_reset_confirm_view no longer reads the legacy `password` key — slice A's fix has landed, " +
        "so this gap report and the note in adapters/core/auth.js can be deleted",
    ).toBe("password");
  });

  test("resendVerificationEmail lowercases the address", () => {
    const { client, corePost } = makeClient();
    client.resendVerificationEmail("  User@Example.COM ");
    expect(corePost).toHaveBeenCalledWith("/auth/resend-verification/", { email: "user@example.com" });
  });

  test("changeUserPassword sends both confirm names", () => {
    const { client, corePost } = makeClient();
    client.changeUserPassword({ current_password: "a", new_password: "b", new_password_confirm: "b" });
    expect(corePost).toHaveBeenCalledWith("/auth/password-change/", {
      current_password: "a",
      new_password: "b",
      new_password_confirm: "b",
    });
  });
});

