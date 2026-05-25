import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import { CoreApiRequestError, coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { TurnstileWidget } from "../../components/auth/TurnstileWidget.js";
import "./AuthRegisterPage.css";

const EMPTY_FIELD_ERRORS = Object.freeze({
  username: "",
  email: "",
  password_confirm: "",
  turnstile_token: "",
});

function parseApiErrors(error) {
  const fieldErrors = { ...EMPTY_FIELD_ERRORS };
  let globalMessage = "Đăng ký thất bại. Vui lòng kiểm tra thông tin và thử lại.";

  if (error instanceof CoreApiRequestError) {
    const payloadFieldErrors = error?.fieldErrors;
    if (payloadFieldErrors && typeof payloadFieldErrors === "object") {
      Object.keys(fieldErrors).forEach((key) => {
        const value = payloadFieldErrors[key];
        if (Array.isArray(value) && value[0]) {
          fieldErrors[key] = String(value[0]);
        } else if (typeof value === "string" && value.trim()) {
          fieldErrors[key] = value.trim();
        }
      });
    }

    const detail = error?.payload?.detail;
    if (typeof detail === "string" && detail.trim()) {
      globalMessage = detail;
    } else if (detail && typeof detail === "object") {
      Object.keys(fieldErrors).forEach((key) => {
        const value = detail[key];
        if (Array.isArray(value) && value[0] && !fieldErrors[key]) {
          fieldErrors[key] = String(value[0]);
        }
      });

      const firstValue = Object.values(detail).find((entry) =>
        (Array.isArray(entry) && entry.length > 0) || (typeof entry === "string" && entry.trim()),
      );
      if (Array.isArray(firstValue) && firstValue[0]) {
        globalMessage = String(firstValue[0]);
      }
      if (typeof firstValue === "string" && firstValue.trim()) {
        globalMessage = firstValue.trim();
      }
    }
  } else if (error instanceof Error && error.message) {
    globalMessage = error.message;
  }

  return { fieldErrors, globalMessage };
}

export function AuthRegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ ...EMPTY_FIELD_ERRORS });

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      setMessage("");
      setFieldErrors({ ...EMPTY_FIELD_ERRORS, password_confirm: "Mật khẩu xác nhận không khớp." });
      return;
    }

    if (!turnstileToken.trim()) {
      setErrorMessage("Vui lòng hoàn tất xác thực Turnstile.");
      setMessage("");
      setFieldErrors({ ...EMPTY_FIELD_ERRORS, turnstile_token: "Vui lòng xác thực bạn không phải robot." });
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");
    setFieldErrors({ ...EMPTY_FIELD_ERRORS });

    try {
      const payload = await coreApiAdapter.registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
        password_confirm: passwordConfirm,
        website,
        turnstile_token: turnstileToken,
      });

      const successMessage = payload?.data?.message || payload?.message || "Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.";
      setMessage(successMessage);
      setUsername("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setWebsite("");
      setTurnstileToken("");
      setFieldErrors({ ...EMPTY_FIELD_ERRORS });
    } catch (error) {
      const parsedError = parseApiErrors(error);
      setFieldErrors(parsedError.fieldErrors);
      setErrorMessage(parsedError.globalMessage);
      setTurnstileToken("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return createElement(
    "main",
    { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4" },
    createElement(
      "section",
      { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, "VNInvest"),
      createElement("p", { className: "mt-2 text-sm text-gray-400" }, "Tạo tài khoản SaaS mới"),
      createElement(
        "form",
        { className: "mt-6 space-y-4", onSubmit: handleSubmit },
        createElement("input", {
          value: username,
          onChange: (event) => setUsername(event.target.value),
          required: true,
          autoComplete: "username",
          className: `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ${fieldErrors.username ? "border-red-500" : "border-gray-700"}`,
          placeholder: "Tên đăng nhập",
        }),
        fieldErrors.username
          ? createElement("p", { className: "text-red-400 text-xs" }, fieldErrors.username)
          : null,
        createElement("input", {
          value: email,
          onChange: (event) => setEmail(event.target.value),
          required: true,
          type: "email",
          autoComplete: "email",
          className: `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ${fieldErrors.email ? "border-red-500" : "border-gray-700"}`,
          placeholder: "Email",
        }),
        fieldErrors.email
          ? createElement("p", { className: "text-red-400 text-xs" }, fieldErrors.email)
          : null,
        createElement("input", {
          value: password,
          onChange: (event) => setPassword(event.target.value),
          required: true,
          type: "password",
          autoComplete: "new-password",
          minLength: 8,
          className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
          placeholder: "Mật khẩu",
        }),
        createElement("input", {
          value: passwordConfirm,
          onChange: (event) => setPasswordConfirm(event.target.value),
          required: true,
          type: "password",
          autoComplete: "new-password",
          minLength: 8,
          className: `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ${fieldErrors.password_confirm ? "border-red-500" : "border-gray-700"}`,
          placeholder: "Nhập lại mật khẩu",
        }),
        fieldErrors.password_confirm
          ? createElement("p", { className: "text-red-400 text-xs" }, fieldErrors.password_confirm)
          : null,
        createElement("input", {
          value: website,
          onChange: (event) => setWebsite(event.target.value),
          className: "invisible-honeypot",
          tabIndex: -1,
          autoComplete: "off",
          placeholder: "Website",
          "aria-hidden": true,
        }),
        createElement(TurnstileWidget, {
          onVerify: (token) => {
            setTurnstileToken(token);
            setFieldErrors((prev) => ({ ...prev, turnstile_token: "" }));
          },
          onError: () => setErrorMessage("Không thể tải Turnstile. Vui lòng thử lại."),
          onExpire: () => setTurnstileToken(""),
        }),
        fieldErrors.turnstile_token
          ? createElement("p", { className: "text-red-400 text-xs text-center" }, fieldErrors.turnstile_token)
          : null,
        message
          ? createElement("p", { className: "text-emerald-400 text-xs leading-5" }, message)
          : null,
        errorMessage
          ? createElement("p", { className: "text-red-400 text-xs leading-5" }, errorMessage)
          : null,
        createElement(
          "button",
          {
            type: "submit",
            className: "w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors",
            disabled: isSubmitting || !turnstileToken,
          },
          isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký",
        ),
      ),
      createElement(
        "div",
        { className: "mt-6 text-sm" },
        createElement(Link, { to: "/login", className: "text-brand-400 hover:text-brand-300 transition-colors" }, "Quay lại đăng nhập"),
      ),
    ),
  );
}
