import { createElement, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CoreApiRequestError, coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";

function normalizeErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof CoreApiRequestError) {
    const detail = error?.payload?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (detail && typeof detail === "object") {
      const values = Object.values(detail as Record<string, unknown>);
      const firstArrayValue = values.find((entry) => Array.isArray(entry) && entry.length > 0);
      if (Array.isArray(firstArrayValue) && firstArrayValue[0]) {
        return String(firstArrayValue[0]);
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

export function AuthResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const isConfirmMode = Boolean(token);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !email.trim()) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const payload = await (coreApiAdapter as any).requestPasswordReset(email.trim()) as Record<string, unknown>;
      setMessage((payload?.detail || payload?.message || t("auth.resetSuccess", { defaultValue: "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu." })) as string);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, t("auth.resetFailed", { defaultValue: "Không thể gửi yêu cầu đặt lại mật khẩu." })));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitConfirm(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !newPassword || !newPasswordConfirm) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const payload = await (coreApiAdapter as any).confirmPasswordReset(token, newPassword, newPasswordConfirm) as Record<string, unknown>;
      setMessage((payload?.detail || payload?.message || t("auth.resetConfirmSuccess", { defaultValue: "Mật khẩu đã được đặt lại thành công." })) as string);
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, t("auth.resetConfirmFailed", { defaultValue: "Không thể đặt lại mật khẩu." })));
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
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, t("auth.resetTitle", { defaultValue: "VNInvest" })),
      createElement(
        "p",
        { className: "mt-2 text-sm text-gray-400" },
        isConfirmMode ? t("auth.resetConfirmSubtitle", { defaultValue: "Thiết lập mật khẩu mới" }) : t("auth.resetSubtitle", { defaultValue: "Yêu cầu đặt lại mật khẩu" }),
      ),
      createElement(
        "form",
        {
          className: "mt-6 space-y-4",
          onSubmit: isConfirmMode ? submitConfirm : submitRequest,
        },
        isConfirmMode
          ? createElement(
            "div",
            { className: "space-y-4" },
            createElement("input", {
              type: "password",
              autoComplete: "new-password",
              value: newPassword,
              onChange: (event) => setNewPassword((event.target as HTMLInputElement).value),
              required: true,
              minLength: 8,
              className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
              placeholder: t("auth.resetNewPasswordPlaceholder", { defaultValue: "Mật khẩu mới" }),
            }),
            createElement("input", {
              type: "password",
              autoComplete: "new-password",
              value: newPasswordConfirm,
              onChange: (event) => setNewPasswordConfirm((event.target as HTMLInputElement).value),
              required: true,
              minLength: 8,
              className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
              placeholder: t("auth.resetConfirmPasswordPlaceholder", { defaultValue: "Nhập lại mật khẩu mới" }),
            }),
          )
          : createElement("input", {
            type: "email",
            autoComplete: "email",
            value: email,
            onChange: (event) => setEmail((event.target as HTMLInputElement).value),
            required: true,
            className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
            placeholder: t("auth.resetEmailPlaceholder", { defaultValue: "Email tài khoản" }),
          }),
        message ? createElement("p", { className: "text-emerald-400 text-xs leading-5" }, message) : null,
        errorMessage ? createElement("p", { className: "text-red-400 text-xs leading-5" }, errorMessage) : null,
        createElement(
          "button",
          {
            type: "submit",
            className: "w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors",
            disabled: isSubmitting,
          },
          isSubmitting
            ? (isConfirmMode ? t("auth.resetConfirmSubmitting", { defaultValue: "Đang cập nhật mật khẩu..." }) : t("auth.resetSubmitting", { defaultValue: "Đang gửi yêu cầu..." }))
            : (isConfirmMode ? t("auth.resetConfirmSubmit", { defaultValue: "Xác nhận mật khẩu mới" }) : t("auth.resetSubmit", { defaultValue: "Gửi yêu cầu đặt lại mật khẩu" })),
        ),
      ),
      createElement(
        "div",
        { className: "mt-6" },
        createElement(Link, { to: "/login", className: "text-sm text-brand-400 hover:text-brand-300 transition-colors" }, t("auth.resetBackToLogin", { defaultValue: "Quay lại đăng nhập" })),
      ),
    ),
  );
}
