import React from "react";
import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { act, create } from "react-test-renderer";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthLoginPage } from "./AuthLoginPage.js";
import { AuthRegisterPage } from "./AuthRegisterPage.js";
import { AuthVerifyEmailPage } from "./AuthVerifyEmailPage.js";
import { AuthResetPasswordPage } from "./AuthResetPasswordPage.js";
import { CoreApiRequestError, coreApiAdapter } from "../../adapters/coreApiAdapter.js";

function renderAtRoute(path, element, entry) {
  const initialEntry = entry || path;
  return create(
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("packages/web auth pages", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    delete global.window;
  });

  test("AuthLoginPage submits credentials and redirects on success", async () => {
    const loginSpy = jest.spyOn(coreApiAdapter, "loginUser").mockResolvedValue({
      data: { access: "access-token", refresh: "refresh-token" },
    });
    const storage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    global.window = { location: { assign: jest.fn() }, localStorage: storage };

    const renderer = renderAtRoute("/login", React.createElement(AuthLoginPage));
    const usernameInput = renderer.root.findByProps({ id: "auth-login-username" });
    const passwordInput = renderer.root.findByProps({ id: "auth-login-password" });
    const form = renderer.root.findByType("form");

    await act(async () => {
      usernameInput.props.onChange({ target: { value: "  user1  " } });
      passwordInput.props.onChange({ target: { value: "pass123456" } });
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(loginSpy).toHaveBeenCalledWith({ username: "user1", password: "pass123456" });
    expect(global.window.location.assign).toHaveBeenCalledWith("/dashboard");
  });

  test("AuthRegisterPage shows validation message when password confirmation mismatches", async () => {
    const renderer = renderAtRoute("/register", React.createElement(AuthRegisterPage));
    const inputs = renderer.root.findAllByType("input");
    const form = renderer.root.findByType("form");

    await act(async () => {
      inputs[2].props.onChange({ target: { value: "abc12345" } });
      inputs[3].props.onChange({ target: { value: "abc123456" } });
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(JSON.stringify(renderer.toJSON())).toContain("Mật khẩu xác nhận không khớp.");
  });

  test("AuthRegisterPage maps API field errors to register form", async () => {
    const registerSpy = jest.spyOn(coreApiAdapter, "registerUser").mockRejectedValue(
      new CoreApiRequestError("Validation error", {
        payload: { detail: { email: ["Email đã tồn tại"], turnstile_token: ["Token hết hạn"] } },
      }),
    );

    const renderer = renderAtRoute("/register", React.createElement(AuthRegisterPage));
    const usernameInput = renderer.root.findByProps({ placeholder: "Tên đăng nhập" });
    const emailInput = renderer.root.findByProps({ placeholder: "Email" });
    const passwordInput = renderer.root.findByProps({ placeholder: "Mật khẩu" });
    const passwordConfirmInput = renderer.root.findByProps({ placeholder: "Nhập lại mật khẩu" });
    const verifyButton = renderer.root.findByProps({ "data-testid": "turnstile-test-trigger" });
    const form = renderer.root.findByType("form");

    await act(async () => {
      usernameInput.props.onChange({ target: { value: "newuser" } });
      emailInput.props.onChange({ target: { value: "newuser@example.com" } });
      passwordInput.props.onChange({ target: { value: "password-123" } });
      passwordConfirmInput.props.onChange({ target: { value: "password-123" } });
      verifyButton.props.onClick();
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({
      username: "newuser",
      email: "newuser@example.com",
      turnstile_token: "cf-test-token",
    }));
    expect(JSON.stringify(renderer.toJSON())).toContain("Email đã tồn tại");
    expect(JSON.stringify(renderer.toJSON())).toContain("Token hết hạn");
  });

  test("AuthVerifyEmailPage shows missing token state", async () => {
    const verifySpy = jest.spyOn(coreApiAdapter, "verifyEmailToken");
    const renderer = renderAtRoute("/verify-email", React.createElement(AuthVerifyEmailPage));

    await flushEffects();

    expect(verifySpy).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain("Thiếu token xác minh email.");
  });

  test("AuthVerifyEmailPage verifies token and renders success message", async () => {
    const verifySpy = jest.spyOn(coreApiAdapter, "verifyEmailToken").mockResolvedValue({ message: "Xác minh thành công" });
    const renderer = renderAtRoute("/verify-email", React.createElement(AuthVerifyEmailPage), "/verify-email?token=abc-token");

    await flushEffects();
    await flushEffects();

    expect(verifySpy).toHaveBeenCalledWith("abc-token");
    expect(JSON.stringify(renderer.toJSON())).toContain("Xác minh thành công");
  });

  test("AuthResetPasswordPage request mode sends reset email", async () => {
    const requestSpy = jest.spyOn(coreApiAdapter, "requestPasswordReset").mockResolvedValue({ message: "Đã gửi email" });
    const renderer = renderAtRoute("/reset-password", React.createElement(AuthResetPasswordPage));
    const emailInput = renderer.root.findByProps({ placeholder: "Email tài khoản" });
    const form = renderer.root.findByType("form");

    await act(async () => {
      emailInput.props.onChange({ target: { value: "user@example.com" } });
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(requestSpy).toHaveBeenCalledWith("user@example.com");
    expect(JSON.stringify(renderer.toJSON())).toContain("Đã gửi email");
  });

  test("AuthResetPasswordPage confirm mode updates password", async () => {
    const confirmSpy = jest.spyOn(coreApiAdapter, "confirmPasswordReset").mockResolvedValue({ message: "Đổi mật khẩu thành công" });
    const renderer = renderAtRoute("/reset-password", React.createElement(AuthResetPasswordPage), "/reset-password?token=confirm-token");
    const passwordInput = renderer.root.findByProps({ placeholder: "Mật khẩu mới" });
    const passwordConfirmInput = renderer.root.findByProps({ placeholder: "Nhập lại mật khẩu mới" });
    const form = renderer.root.findByType("form");

    await act(async () => {
      passwordInput.props.onChange({ target: { value: "new-password-123" } });
      passwordConfirmInput.props.onChange({ target: { value: "new-password-123" } });
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(confirmSpy).toHaveBeenCalledWith("confirm-token", "new-password-123", "new-password-123");
    expect(JSON.stringify(renderer.toJSON())).toContain("Đổi mật khẩu thành công");
  });
});