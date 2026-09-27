/**
 * tenantreg-d (slice D) — D4, D5, D6, D7, D8, D9, D10, D3.
 *
 * Component-level pins for the auth screens. The pure parsers are covered in
 * tenantreg-auth-errors.component.test.ts; this file drives the real pages.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createElement } from "react";

import { CoreApiRequestError, coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { AuthRegisterPage } from "./AuthRegisterPage.js";
import { AuthLoginPage } from "./AuthLoginPage.js";
import { AuthResetPasswordPage } from "./AuthResetPasswordPage.js";
import { AuthVerifyEmailPage } from "./AuthVerifyEmailPage.js";
import { PASSWORD_MIN_LENGTH } from "./authPolicy.js";

/**
 * `useI18n()` without a provider returns a STUB whose `t()` echoes the key
 * (LangContext.js:92-103), so rendering these pages bare would make every label
 * read "auth.registerPasswordLabel" and the assertions would pass on garbage.
 *
 * Mocking with the REAL translator does two things at once: it renders real
 * copy, and it turns any missing i18n key into a visible literal key path — so
 * a key deleted from vi.js fails here instead of shipping.
 */
vi.mock("../../context/LangContext.js", async () => {
  const { createTranslator, DEFAULT_LOCALE } = await import("../../i18n/index.js");
  return {
    useI18n: () => ({
      locale: DEFAULT_LOCALE,
      localeTag: "vi-VN",
      t: createTranslator(DEFAULT_LOCALE),
    }),
  };
});

function renderAtRoute(path: string, element: any, entry?: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [entry ?? path] },
      createElement(Routes, null, createElement(Route, { path, element })),
    ),
  );
}

/** The widget renders a click-to-verify button in a test build. */
async function completeTurnstile() {
  const trigger = await screen.findByTestId("turnstile-test-trigger");
  fireEvent.click(trigger);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  // A leaked fake timer makes every later async test hang until it times out, so
  // restore real timers unconditionally rather than trusting a test's `finally`.
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function fillRegisterForm(user: any, overrides: Record<string, string> = {}) {
  const values = {
    username: "newuser",
    email: "newuser@example.com",
    password: "Str0ng-Passw0rd!",
    passwordConfirm: "Str0ng-Passw0rd!",
    ...overrides,
  };
  await user.type(screen.getByLabelText(/tên đăng nhập/i), values.username);
  await user.type(screen.getByLabelText(/^email$/i), values.email);
  await user.type(screen.getByLabelText(/^mật khẩu$/i), values.password);
  await user.type(screen.getByLabelText(/xác nhận mật khẩu/i), values.passwordConfirm);
  await completeTurnstile();
  return values;
}

describe("tenantreg D6 — client password rule matches the server rule", () => {
  test("the enforced minimum is 10, matching MinimumLengthValidator in settings.py:64", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  test("register password inputs use the shared minimum, not a literal 8", async () => {
    renderAtRoute("/register", <AuthRegisterPage />);
    const password = screen.getByLabelText(/^mật khẩu$/i) as HTMLInputElement;
    const confirm = screen.getByLabelText(/xác nhận mật khẩu/i) as HTMLInputElement;
    expect(password.getAttribute("minlength")).toBe(String(PASSWORD_MIN_LENGTH));
    expect(confirm.getAttribute("minlength")).toBe(String(PASSWORD_MIN_LENGTH));
  });

  test("register shows a strength hint that names the minimum", () => {
    renderAtRoute("/register", <AuthRegisterPage />);
    expect(screen.getByText(/ít nhất 10 ký tự/i)).toBeTruthy();
  });

  test("reset confirm inputs use the shared minimum", () => {
    renderAtRoute("/reset-password", <AuthResetPasswordPage />, "/reset-password?token=abc");
    // Queried by id: the label and the placeholder share the same words, so a
    // text matcher would be ambiguous.
    const password = document.getElementById("auth-reset-new-password") as HTMLInputElement;
    const confirm = document.getElementById("auth-reset-new-password-confirm") as HTMLInputElement;
    expect(password.getAttribute("minlength")).toBe(String(PASSWORD_MIN_LENGTH));
    expect(confirm.getAttribute("minlength")).toBe(String(PASSWORD_MIN_LENGTH));
  });

  test("no auth screen still declares minLength 8", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    ["AuthRegisterPage.tsx", "AuthResetPasswordPage.tsx", "AuthLoginPage.tsx"].forEach((name) => {
      const source = readFileSync(join(dir, name), "utf8");
      expect(source, `${name} still hardcodes minLength: 8`).not.toMatch(/minLength:\s*8\b/);
    });
  });
});

describe("tenantreg D8 — every control has an accessible name", () => {
  test("register: all four visible inputs are labelled with resolved copy", () => {
    renderAtRoute("/register", <AuthRegisterPage />);
    ["username", "email", "password", "password_confirm"].forEach((id) => {
      const domId = `auth-register-${id.replace("_", "-")}`;
      const input = document.getElementById(domId);
      expect(input, `missing #${domId}`).toBeTruthy();
      const label = document.querySelector(`label[for="${domId}"]`);
      expect(label, `no <label for> pointing at #${domId}`).toBeTruthy();
      const text = label!.textContent?.trim() ?? "";
      expect(text.length, `${domId} has an empty label`).toBeGreaterThan(0);
      // Guards against the bare-`useI18n` stub silently rendering key paths.
      expect(text, `${domId} label is an unresolved i18n key`).not.toMatch(/^auth\./);
    });
  });

  test("register: the honeypot is hidden, untabbable and has no placeholder", () => {
    renderAtRoute("/register", <AuthRegisterPage />);
    const honeypot = document.querySelector(".invisible-honeypot") as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot.getAttribute("tabindex")).toBe("-1");
    // A placeholder on a hidden field is what password managers autofill.
    expect(honeypot.getAttribute("placeholder")).toBeNull();
    expect(honeypot.getAttribute("name")).toBe("website");
  });

  test("register: banners and field errors live in an ARIA live region", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        status: 400,
        payload: { detail: { password: ["Mật khẩu quá yếu."] } },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByTestId("register-error")).toBeTruthy());
    expect(screen.getByTestId("register-error").getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("register-error").getAttribute("aria-live")).toBe("assertive");
  });

  test("verify: the status box is a live region", async () => {
    vi.spyOn(coreApiAdapter, "verifyEmailToken").mockResolvedValue({ message: "Xác minh thành công" });
    renderAtRoute("/verify-email", <AuthVerifyEmailPage />, "/verify-email?token=abc");
    await waitFor(() => expect(screen.getByTestId("verify-status")).toBeTruthy());
    const status = screen.getByTestId("verify-status");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBeTruthy();
  });
});

describe("tenantreg D4 — every 4xx field error is surfaced, none dropped", () => {
  test("renders all messages for a field, not only the first", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        status: 400,
        payload: {
          detail: { password: ["Quá ngắn.", "Quá phổ biến.", "Chỉ chứa chữ số."] },
        },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByText(/quá ngắn/i)).toBeTruthy());
    expect(screen.getByText(/quá phổ biến/i)).toBeTruthy();
    expect(screen.getByText(/chỉ chứa chữ số/i)).toBeTruthy();
  });

  test("maps the `password` field, which the old whitelist omitted", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        status: 400,
        payload: { detail: { password: ["Mật khẩu không đủ mạnh."] } },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByText(/không đủ mạnh/i)).toBeTruthy());
    // The password input itself must be marked invalid, not just a bare red line.
    const password = screen.getByLabelText(/^mật khẩu$/i);
    expect(password.getAttribute("aria-invalid")).toBe("true");
    expect(password.className).toContain("border-red-500");
  });

  test("an unmapped field becomes a visible message instead of vanishing", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        status: 400,
        payload: { detail: { first_name: ["Tên không hợp lệ."] } },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByTestId("register-error")).toBeTruthy());
  });

  test("reads slice A's `field_errors` envelope, not only the legacy `detail`", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        status: 400,
        payload: { detail: "Password yếu.", code: "weak_password" },
        fieldErrors: { password: ["Mật khẩu yếu."] },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByText(/mật khẩu yếu/i)).toBeTruthy());
    expect(screen.getByTestId("register-error").textContent).toMatch(/không đủ mạnh|10 ký tự/i);
  });
});

describe("tenantreg D5 — 429 and backend codes are localized", () => {
  test("a register 429 shows a countdown, not the raw Vietnamese detail", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Too many", {
        status: 429,
        payload: { detail: "Thử lại quá nhanh từ IP này. Vui lòng đợi 1 phút.", code: "register_rate_limit_exceeded" },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByTestId("register-error")).toBeTruthy());
    const banner = screen.getByTestId("register-error").textContent ?? "";
    expect(banner).toMatch(/60 giây/);
    expect(banner).not.toMatch(/quá nhanh từ IP/);
  });

  test("slice A's opaque registration_unavailable shows one neutral message", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Conflict", {
        status: 409,
        payload: { detail: "Tên đăng nhập này đã tồn tại.", code: "registration_unavailable" },
      }),
    );
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByTestId("register-error")).toBeTruthy());
    // Must not tell the user WHICH field collided, and must not leak which one.
    expect(screen.getByTestId("register-error").textContent).not.toMatch(/đã tồn tại/i);
    expect(screen.getByTestId("register-error").textContent).toMatch(/không thể tạo tài khoản/i);
  });

  test("a login 429 is localized and carries a countdown", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "loginUser").mockRejectedValue(
      new CoreApiRequestError("Too many", {
        status: 429,
        payload: {
          detail: "Quá nhiều yêu cầu đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau 1 phút.",
          code: "login_rate_limit_exceeded",
        },
      }),
    );
    renderAtRoute("/login", <AuthLoginPage />);
    await user.type(screen.getByLabelText(/tên đăng nhập hoặc email/i), "newuser");
    await user.type(screen.getByLabelText(/^mật khẩu$/i), "whatever");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    await waitFor(() => expect(screen.getByTestId("login-error")).toBeTruthy());
    const banner = screen.getByTestId("login-error").textContent ?? "";
    expect(banner).toMatch(/60 giây/);
    expect(banner).not.toMatch(/địa chỉ IP/);
  });

  test("an unrecognised code still yields a localized message, never raw prose", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "loginUser").mockRejectedValue(
      new CoreApiRequestError("Boom", {
        status: 500,
        payload: { detail: "Một lỗi lạ chưa từng thấy.", code: "brand_new_code" },
      }),
    );
    renderAtRoute("/login", <AuthLoginPage />);
    await user.type(screen.getByLabelText(/tên đăng nhập hoặc email/i), "newuser");
    await user.type(screen.getByLabelText(/^mật khẩu$/i), "whatever");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    await waitFor(() => expect(screen.getByTestId("login-error")).toBeTruthy());
    const banner = screen.getByTestId("login-error").textContent ?? "";
    expect(banner).toMatch(/brand_new_code/);
    expect(banner).not.toMatch(/chưa từng thấy/);
  });
});

describe("tenantreg D7 — reset page validates the confirmation", () => {
  test("a mismatched confirmation is rejected before any request is sent", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(coreApiAdapter, "confirmPasswordReset");
    renderAtRoute("/reset-password", <AuthResetPasswordPage />, "/reset-password?token=abc");

    await user.type(document.getElementById("auth-reset-new-password")!, "Str0ng-Passw0rd!");
    await user.type(document.getElementById("auth-reset-new-password-confirm")!, "Str0ng-Passw0rdX");
    await user.click(screen.getByRole("button", { name: /xác nhận mật khẩu mới/i }));

    // Shown twice on purpose: once in the banner, once on the field itself.
    await waitFor(() => expect(screen.getAllByText(/không khớp/i).length).toBeGreaterThanOrEqual(2));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test("a matching confirmation is submitted", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(coreApiAdapter, "confirmPasswordReset").mockResolvedValue({ message: "ok" });
    renderAtRoute("/reset-password", <AuthResetPasswordPage />, "/reset-password?token=abc");

    await user.type(document.getElementById("auth-reset-new-password")!, "Str0ng-Passw0rd!");
    await user.type(document.getElementById("auth-reset-new-password-confirm")!, "Str0ng-Passw0rd!");
    await user.click(screen.getByRole("button", { name: /xác nhận mật khẩu mới/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith("abc", "Str0ng-Passw0rd!", "Str0ng-Passw0rd!"));
  });
});

describe("tenantreg D3 — a lost verification email is recoverable", () => {
  test("the verify page offers a resend form when there is no token", async () => {
    renderAtRoute("/verify-email", <AuthVerifyEmailPage />, "/verify-email");
    expect(await screen.findByTestId("resend-verification-form")).toBeTruthy();
  });

  test("the resend form is prefilled from ?email=", async () => {
    renderAtRoute("/verify-email", <AuthVerifyEmailPage />, "/verify-email?email=user@example.com");
    const input = (await screen.findByLabelText(/email tài khoản/i)) as HTMLInputElement;
    expect(input.value).toBe("user@example.com");
  });

  test("a successful registration links to the resend flow", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockResolvedValue({
      data: { username: "newuser", email: "newuser@example.com", message: "Đăng ký thành công." },
    });
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    const link = await screen.findByTestId("register-resend-link");
    expect(link.textContent).toBeTruthy();
    expect(link.querySelector("a")?.getAttribute("href")).toBe("/verify-email?email=newuser%40example.com");
  });

  test("the resend button starts an honest 60s countdown on success", async () => {
    // No fake timers: the assertion only needs the countdown's initial value,
    // and pairing fake timers with userEvent hangs on the awaited interactions.
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "resendVerificationEmail").mockResolvedValue({ message: "ok" });
    renderAtRoute("/verify-email", <AuthVerifyEmailPage />, "/verify-email");

    const input = await screen.findByLabelText(/email tài khoản/i);
    await user.type(input, "user@example.com");
    await user.click(screen.getByTestId("resend-verification-submit"));

    await waitFor(() => expect(screen.getByTestId("resend-success")).toBeTruthy());
    const submit = screen.getByTestId("resend-verification-submit") as HTMLButtonElement;
    expect(submit.disabled, "the button must be locked during the cooldown").toBe(true);
    expect(submit.textContent).toMatch(/60 giây/);
  });

  test("a 429 cooldown comes from the server answer, not a local guess", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "resendVerificationEmail").mockRejectedValue(
      new CoreApiRequestError("Too many", {
        status: 429,
        payload: { detail: "Vui lòng đợi 60 giây", code: "resend_cooldown_active", retry_after: 42 },
      }),
    );
    renderAtRoute("/verify-email", <AuthVerifyEmailPage />, "/verify-email");

    await user.type(await screen.findByLabelText(/email tài khoản/i), "user@example.com");
    await user.click(screen.getByTestId("resend-verification-submit"));

    await waitFor(() => expect(screen.getByTestId("resend-error")).toBeTruthy());
    // 42 comes from the response; the default 60 would mean the client ignored it.
    expect(screen.getByTestId("resend-error").textContent).toMatch(/42/);
  });
});

describe("tenantreg D10 — username normalisation", () => {
  test("register sends the lowercased username", async () => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(coreApiAdapter, "registerUser").mockResolvedValue({ data: {} });
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user, { username: "VietDung" });
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ username: "vietdung" })),
    );
  });

  test("the server's normalised username is surfaced after registering", async () => {
    const user = userEvent.setup();
    vi.spyOn(coreApiAdapter, "registerUser").mockResolvedValue({
      data: { username: "vietdung", email: "newuser@example.com", message: "Đăng ký thành công." },
    });
    renderAtRoute("/register", <AuthRegisterPage />);
    await fillRegisterForm(user, { username: "VietDung" });
    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    await waitFor(() => expect(screen.getByTestId("register-success")).toBeTruthy());
    const username = screen.getByLabelText(/tên đăng nhập/i) as HTMLInputElement;
    expect(username.value, "the value that will actually be stored must be shown").toBe("vietdung");
  });

  test("the username hint warns that it is stored lowercase", () => {
    renderAtRoute("/register", <AuthRegisterPage />);
    expect(screen.getByText(/lưu dạng chữ thường/i)).toBeTruthy();
  });
});

describe("tenantreg D9 — no inline Vietnamese defaults in the auth screens", () => {
  /**
   * Comments are stripped first: the D9 rationale in these very files names
   * `defaultValue`, so a naive grep would either pass on a comment or fail on
   * its own documentation. A source check that a comment can satisfy is not a
   * check.
   */
  function codeOnly(source: string) {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  test("none of the four screens passes defaultValue copy to t()", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = [
      "AuthRegisterPage.tsx",
      "AuthLoginPage.tsx",
      "AuthResetPasswordPage.tsx",
      "AuthVerifyEmailPage.tsx",
    ];
    files.forEach((name) => {
      const code = codeOnly(readFileSync(join(dir, name), "utf8"));
      expect(code, `${name} still inlines a defaultValue`).not.toMatch(/defaultValue/);
    });
  });

  test("no auth screen uses a `t(...) || fallback` guard, which can never fire", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    ["AuthRegisterPage.tsx", "AuthLoginPage.tsx", "AuthResetPasswordPage.tsx", "AuthVerifyEmailPage.tsx"].forEach(
      (name) => {
        const code = codeOnly(readFileSync(join(dir, name), "utf8"));
        // `createTranslator` always returns a non-empty string, so a `||` on the
        // result of `t()` is unreachable and hides missing-key bugs.
        expect(code, `${name} still guards t() with ||`).not.toMatch(/\bt\([^)]*\)\s*\|\|/);
      },
    );
  });
});


