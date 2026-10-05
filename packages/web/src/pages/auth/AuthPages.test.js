import React from "react";
import "jest-location-mock";
import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
jest.unstable_mockModule("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

/**
 * `TurnstileWidget.js:31` đọc `import.meta.env.VITE_TURNSTLE_SITE_KEY` — cú pháp
 * Vite. Babel transform sang CommonJS nên văng
 * "SyntaxError: Cannot use 'import.meta' outside a module" và giết cả suite.
 *
 * Phải dùng `jest.mock` chứ KHÔNG `jest.unstable_mockModule`: babel ép
 * `AuthRegisterPage.tsx` về CJS (`at Object.require (...:6:1)`), mà
 * `unstable_mockModule` chỉ chặn ESM `import()` — đăng ký mock kiểu đó im lặng
 * không có tác dụng.
 *
 * Test double này giữ **đúng contract** mà widget thật phục vụ khi không có env
 * site key (`TurnstileWidget.js:103-114`): nút `turnstile-test-trigger` gọi
 * `onVerify("cf-test-token")`. Trả `null` như lần mock đầu sẽ giết chính test
 * cần nó. Widget thật có test riêng — `components/auth/tenantreg-turnstile-sitekey.component.test.tsx`.
 * `require("react")` bên trong factory vì factory bị hoist lên trên mọi import.
 */
// `unstable_mockModule` resolves its specifier against the setup file
// (`test/setupTests.js`), not against this test, so a relative path fails with
// "Cannot find module". Resolve it from this file instead. `fileURLToPath` is
// required rather than `new URL(...).pathname`, which leaves the spaces in
// "Mujoco Projects" percent-encoded.
import { fileURLToPath } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const resolveFromHere = (rel) => path.join(HERE, rel);
jest.unstable_mockModule(resolveFromHere("../../components/auth/TurnstileWidget.js"), () => {
 return {
    TURNSTILE_TEST_SITE_KEY: "1x00000000000000000000AA",
    readTurnstileEnv: () => ({ siteKey: "", rawEnvPresent: false }),
    resolveTurnstileSiteKey: () => ({
      siteKey: "1x00000000000000000000AA",
      source: "test-fallback",
      isTestKey: true,
      isMissing: false,
    }),
    TurnstileWidget: ({ onVerify, onError }) =>
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "turnstile-test-trigger",
          onClick: () => onVerify?.("cf-test-token"),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") onVerify?.("cf-test-token");
          },
        },
        "Turnstile test token",
      ),
  };
});

/**
 * tenantreg-d (slice D) — D9 follow-up.
 *
 * These pages used to inline `{ defaultValue: "<Vietnamese>" }` on every `t()`
 * call, and this suite rendered them WITHOUT a LangProvider. `useI18n()` then
 * returns a stub whose `t()` honours `defaultValue` (LangContext.js:92-103), so
 * the assertions passed on the inline copies rather than on the dictionaries.
 *
 * The inline defaults have been removed (a missing key must fail loudly, not
 * quietly render Vietnamese into the EN UI), so the stub would now render raw
 * key paths. Mocking with the REAL translator keeps these assertions honest:
 * they check the shipped copy, and a key deleted from vi.js now fails here.
 *
 * NOTE the specifier: resolves relative to THIS FILE. (An older comment
 * claimed `unstable_mockModule` resolved relative to `test/setupTests.js` and
 * used `../src/...`; jest threw "Cannot find module".) From `src/pages/auth/`
 * the path to `src/context/LangContext.js` is `../../context/...`.
 *
 * `jest.mock` chứ KHÔNG `jest.unstable_mockModule`: babel ép các page về CJS,
 * còn `unstable_mockModule` chỉ chặn ESM `import()` ⇒ mock im lặng không có tác
 * dụng, `useI18n()` trả locale thật và assertion tìm chuỗi VI không thấy.
 * Factory của `jest.mock` không được async nên `require` đồng bộ thay cho `await`.
 */
jest.unstable_mockModule(resolveFromHere("../../context/LangContext.js"), async () => {
  const { createTranslator, DEFAULT_LOCALE } = await import("../../i18n/index.js");
  return {
    useI18n: () => ({
      locale: DEFAULT_LOCALE,
      localeTag: "vi-VN",
      t: createTranslator(DEFAULT_LOCALE),
    }),
  };
});

// Top-level `await` không transform được trong CJS của Jest ("await is only
// valid in async functions and the top level bodies of modules") ⇒ suite này
// chết. Gộp vào `beforeAll` để giữ thứ tự "đăng ký mock → import module".
let MemoryRouter, Route, Routes;
let AuthLoginPage, AuthRegisterPage, AuthVerifyEmailPage, AuthResetPasswordPage;
let CoreApiRequestError, coreApiAdapter;

beforeAll(async () => {
  ({ MemoryRouter, Route, Routes } = await import("react-router-dom"));
  ({ AuthLoginPage } = await import("./AuthLoginPage.tsx"));
  ({ AuthRegisterPage } = await import("./AuthRegisterPage.tsx"));
  ({ AuthVerifyEmailPage } = await import("./AuthVerifyEmailPage.tsx"));
  ({ AuthResetPasswordPage } = await import("./AuthResetPasswordPage.tsx"));
  ({ CoreApiRequestError, coreApiAdapter } = await import("../../adapters/coreApiAdapter.js"));
});

function renderAtRoute(path, element, entry) {
  const initialEntry = entry || path;
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path, element }),
      ),
    ),
  );
}

describe("packages/web auth pages", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("AuthLoginPage submits credentials and redirects on success", async () => {
    const user = userEvent.setup();
    const assignSpy = jest.spyOn(window.location, "assign").mockImplementation(() => {});
    const loginSpy = jest.spyOn(coreApiAdapter, "loginUser").mockResolvedValue({
      data: { access: "access-token", refresh: "refresh-token" },
    });

    renderAtRoute("/login", React.createElement(AuthLoginPage));

    const usernameInput = screen.getByLabelText(/tên đăng nhập hoặc email/i);
    const passwordInput = screen.getByLabelText(/mật khẩu/i);

    await user.type(usernameInput, "  user1  ");
    await user.type(passwordInput, "pass123456");

    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    expect(loginSpy).toHaveBeenCalledWith({ username: "user1", password: "pass123456" });
    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
    assignSpy.mockRestore();
  });

  test("AuthRegisterPage shows validation message when password confirmation mismatches", async () => {
    const user = userEvent.setup();
    renderAtRoute("/register", React.createElement(AuthRegisterPage));

    const usernameInput = screen.getByPlaceholderText("Tên đăng nhập");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Mật khẩu");
    const passwordConfirmInput = screen.getByPlaceholderText("Nhập lại mật khẩu");

    await user.type(usernameInput, "newuser");
    await user.type(emailInput, "newuser@example.com");
    await user.type(passwordInput, "abc12345");
    await user.type(passwordConfirmInput, "abc123456");

    const form = document.querySelector("form");
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getAllByText(/mật khẩu xác nhận không khớp/i).length).toBeGreaterThanOrEqual(1);
  });

  test("AuthRegisterPage maps API field errors to register form", async () => {
    const user = userEvent.setup();
    const registerSpy = jest.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        payload: { detail: { email: ["Email đã tồn tại"], turnstile_token: ["Token hết hạn"] } },
      }),
    );

    renderAtRoute("/register", React.createElement(AuthRegisterPage));

    const usernameInput = screen.getByPlaceholderText("Tên đăng nhập");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Mật khẩu");
    const passwordConfirmInput = screen.getByPlaceholderText("Nhập lại mật khẩu");

    await user.type(usernameInput, "newuser");
    await user.type(emailInput, "newuser@example.com");
    await user.type(passwordInput, "password-123");
    await user.type(passwordConfirmInput, "password-123");

    const verifyButton = screen.getByTestId("turnstile-test-trigger");
    await user.click(verifyButton);

    await user.click(screen.getByRole("button", { name: /đăng ký/i }));

    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({
      username: "newuser",
      email: "newuser@example.com",
      turnstile_token: "cf-test-token",
    }));
    expect(screen.getAllByText(/Email đã tồn tại/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Token hết hạn/i).length).toBeGreaterThanOrEqual(1);
  });

  test("AuthVerifyEmailPage shows missing token state", async () => {
    const verifySpy = jest.spyOn(coreApiAdapter, "verifyEmailToken");
    renderAtRoute("/verify-email", React.createElement(AuthVerifyEmailPage));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(verifySpy).not.toHaveBeenCalled();
    expect(screen.getByText(/thiếu token xác minh email/i)).toBeTruthy();
  });

  test("AuthVerifyEmailPage verifies token and renders success message", async () => {
    const verifySpy = jest.spyOn(coreApiAdapter, "verifyEmailToken").mockResolvedValue({ message: "Xác minh thành công" });
    renderAtRoute("/verify-email", React.createElement(AuthVerifyEmailPage), "/verify-email?token=abc-token");

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(verifySpy).toHaveBeenCalledWith("abc-token");
    expect(screen.getByText(/xác minh thành công/i)).toBeTruthy();
  });

  test("AuthResetPasswordPage request mode sends reset email", async () => {
    const user = userEvent.setup();
    const requestSpy = jest.spyOn(coreApiAdapter, "requestPasswordReset").mockResolvedValue({ message: "Đã gửi email" });
    renderAtRoute("/reset-password", React.createElement(AuthResetPasswordPage));

    const emailInput = screen.getByPlaceholderText("Email tài khoản");
    await user.type(emailInput, "user@example.com");

    await user.click(screen.getByRole("button", { name: /gửi yêu cầu/i }));

    expect(requestSpy).toHaveBeenCalledWith("user@example.com");
    expect(screen.getByText(/đã gửi email/i)).toBeTruthy();
  });

  test("AuthResetPasswordPage confirm mode updates password", async () => {
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(coreApiAdapter, "confirmPasswordReset").mockResolvedValue({ message: "Đổi mật khẩu thành công" });
    renderAtRoute("/reset-password", React.createElement(AuthResetPasswordPage), "/reset-password?token=confirm-token");

    const passwordInput = screen.getByPlaceholderText("Mật khẩu mới");
    const passwordConfirmInput = screen.getByPlaceholderText("Nhập lại mật khẩu mới");

    await user.type(passwordInput, "new-password-123");
    await user.type(passwordConfirmInput, "new-password-123");

    await user.click(screen.getByRole("button", { name: /xác nhận mật khẩu mới/i }));

    expect(confirmSpy).toHaveBeenCalledWith("confirm-token", "new-password-123", "new-password-123");
    expect(screen.getByText(/đổi mật khẩu thành công/i)).toBeTruthy();
  });
});


