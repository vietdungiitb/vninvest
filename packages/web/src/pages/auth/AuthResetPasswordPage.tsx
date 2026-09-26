import { createElement, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { PASSWORD_MIN_LENGTH, scorePassword } from "./authPolicy.js";
import { fieldFallbackKey, parseAuthError } from "./authErrors.js";
import "./AuthRegisterPage.css";

type FieldErrors = Record<string, string[]>;

/**
 * Backend field name -> control on the reset form. Accepts both the canonical
 * `new_password*` and the legacy `password*` names so the form renders an
 * inline error whichever one the endpoint uses.
 */
const RESET_FIELD_MAP: Record<string, string> = {
  new_password: "new_password",
  password: "new_password",
  new_password_confirm: "new_password_confirm",
  password_confirm: "new_password_confirm",
  email: "email",
  token: "token",
};

const EMPTY_FIELD_ERRORS: FieldErrors = {};

/**
 * tenantreg-d (slice D) — D7, D6, D8, D9, D4, D5.
 */
export function AuthResetPasswordPage() {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const isConfirmMode = Boolean(token);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);

  const strength = scorePassword(newPassword);

  function handleFailure(error: unknown) {
    const parsed = parseAuthError(error as any, t, {
      fieldMap: RESET_FIELD_MAP,
      fallbackKey: isConfirmMode ? "auth.resetConfirmFailed" : "auth.resetFailed",
      locale,
    });
    setFieldErrors(parsed.fieldErrors as FieldErrors);
    setErrorMessage(parsed.globalMessage);
  }

  /** D4: every message for a field, not just the first. */
  function renderFieldErrors(control: string, idPrefix: string) {
    const messages = fieldErrors[control];
    if (!messages || messages.length === 0) return null;
    const visible = locale === "vi" ? messages : messages.map(() => t(fieldFallbackKey(control)));
    return createElement(
      "div",
      { id: `${idPrefix}-error`, className: "space-y-0.5", role: "alert", "aria-live": "assertive" },
      visible.map((text, index) =>
        createElement("p", { key: `${control}-${index}`, className: "text-red-400 text-xs" }, text),
      ),
    );
  }

  const inputClass = (control: string) =>
    `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
      fieldErrors[control]?.length ? "border-red-500" : "border-gray-700"
    }`;

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !email.trim()) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");
    setFieldErrors(EMPTY_FIELD_ERRORS);

    try {
      const payload = (await coreApiAdapter.requestPasswordReset(email.trim())) as Record<string, unknown>;
      const serverMessage = String(payload?.detail ?? payload?.message ?? "");
      setMessage(
        locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.resetSuccess"),
      );
    } catch (error) {
      handleFailure(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitConfirm(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !newPassword || !newPasswordConfirm) {
      return;
    }

    // D7: this guard did not exist. The register page compares the two fields
    // (AuthRegisterPage) but the reset page only checked that both were
    // non-empty, so a typo shipped a mismatched pair to the server and the user
    // got an opaque failure instead of "they do not match".
    if (newPassword !== newPasswordConfirm) {
      const mismatch = t("auth.resetConfirmMismatch");
      setMessage("");
      setErrorMessage(mismatch);
      setFieldErrors({ new_password_confirm: [mismatch] });
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");
    setFieldErrors(EMPTY_FIELD_ERRORS);

    try {
      // The adapter sends the canonical `new_password` / `new_password_confirm`.
      // See the D10 note in the report: the backend at
      // identity_access/views/password_reset.py:77 still reads the legacy
      // `password` key, so this call fails there until slice A lands. The
      // adapter body is correct and is pinned by a test.
      const payload = (await coreApiAdapter.confirmPasswordReset(
        token,
        newPassword,
        newPasswordConfirm,
      )) as Record<string, unknown>;
      const serverMessage = String(payload?.detail ?? payload?.message ?? "");
      setMessage(
        locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.resetConfirmSuccess"),
      );
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error) {
      handleFailure(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return createElement(
    "main",
    { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10" },
    createElement(
      "section",
      { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, t("auth.resetTitle")),
      createElement(
        "p",
        { className: "mt-2 text-sm text-gray-400" },
        isConfirmMode ? t("auth.resetConfirmSubtitle") : t("auth.resetSubtitle"),
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
              createElement(
                "div",
                null,
                createElement(
                  "label",
                  { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-reset-new-password" },
                  t("auth.resetNewPasswordLabel"),
                ),
                createElement("input", {
                  id: "auth-reset-new-password",
                  name: "new_password",
                  type: "password",
                  autoComplete: "new-password",
                  value: newPassword,
                  onChange: (event) => setNewPassword((event.target as HTMLInputElement).value),
                  required: true,
                  // D6: was 8, server enforces 10 (settings.py:63-67).
                  minLength: PASSWORD_MIN_LENGTH,
                  className: inputClass("new_password"),
                  placeholder: t("auth.resetNewPasswordPlaceholder"),
                  "aria-describedby": "auth-reset-new-password-hint",
                  "aria-invalid": fieldErrors.new_password?.length ? true : undefined,
                }),
                createElement(
                  "p",
                  { id: "auth-reset-new-password-hint", className: "mt-1 text-gray-500 text-xs" },
                  t("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH }),
                ),
                newPassword && strength < 2
                  ? createElement(
                      "p",
                      { className: "mt-1 text-amber-400 text-xs", "data-testid": "reset-password-weak" },
                      t("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH }),
                    )
                  : null,
                renderFieldErrors("new_password", "auth-reset-new-password"),
              ),
              createElement(
                "div",
                null,
                createElement(
                  "label",
                  {
                    className: "block text-xs text-gray-400 mb-1.5",
                    htmlFor: "auth-reset-new-password-confirm",
                  },
                  t("auth.resetConfirmPasswordLabel"),
                ),
                createElement("input", {
                  id: "auth-reset-new-password-confirm",
                  name: "new_password_confirm",
                  type: "password",
                  autoComplete: "new-password",
                  value: newPasswordConfirm,
                  onChange: (event) => setNewPasswordConfirm((event.target as HTMLInputElement).value),
                  required: true,
                  minLength: PASSWORD_MIN_LENGTH,
                  className: inputClass("new_password_confirm"),
                  placeholder: t("auth.resetConfirmPasswordPlaceholder"),
                  "aria-describedby": fieldErrors.new_password_confirm?.length
                    ? "auth-reset-new-password-confirm-error"
                    : undefined,
                  "aria-invalid": fieldErrors.new_password_confirm?.length ? true : undefined,
                }),
                renderFieldErrors("new_password_confirm", "auth-reset-new-password-confirm"),
              ),
            )
          : createElement(
              "div",
              null,
              createElement(
                "label",
                { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-reset-email" },
                t("auth.resetEmailLabel"),
              ),
              createElement("input", {
                id: "auth-reset-email",
                name: "email",
                type: "email",
                autoComplete: "email",
                value: email,
                onChange: (event) => setEmail((event.target as HTMLInputElement).value),
                required: true,
                className: inputClass("email"),
                placeholder: t("auth.resetEmailPlaceholder"),
                "aria-describedby": fieldErrors.email?.length ? "auth-reset-email-error" : undefined,
                "aria-invalid": fieldErrors.email?.length ? true : undefined,
              }),
              renderFieldErrors("email", "auth-reset-email"),
            ),
        message
          ? createElement(
              "p",
              { className: "text-emerald-400 text-xs leading-5", role: "status", "aria-live": "polite" },
              message,
            )
          : null,
        errorMessage
          ? createElement(
              "p",
              {
                className: "text-red-400 text-xs leading-5",
                role: "alert",
                "aria-live": "assertive",
                "data-testid": "reset-error",
              },
              errorMessage,
            )
          : null,
        createElement(
          "button",
          {
            type: "submit",
            className:
              "w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors",
            disabled: isSubmitting,
          },
          isSubmitting
            ? isConfirmMode
              ? t("auth.resetConfirmSubmitting")
              : t("auth.resetSubmitting")
            : isConfirmMode
              ? t("auth.resetConfirmSubmit")
              : t("auth.resetSubmit"),
        ),
      ),
      createElement(
        "div",
        { className: "mt-6" },
        createElement(
          Link,
          { to: "/login", className: "text-sm text-brand-400 hover:text-brand-300 transition-colors" },
          t("auth.resetBackToLogin"),
        ),
      ),
    ),
  );
}
