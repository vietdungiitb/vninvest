import { createElement, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { TurnstileWidget } from "../../components/auth/TurnstileWidget.js";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_PATTERN,
  normalizeUsername,
  scorePassword,
} from "./authPolicy.js";
import { fieldFallbackKey, parseAuthError, REGISTER_FIELD_MAP } from "./authErrors.js";
import "./AuthRegisterPage.css";

type FieldErrors = Record<string, string[]>;

const EMPTY_FIELD_ERRORS: FieldErrors = {};

/**
 * tenantreg-d (slice D) — D9.
 *
 * The old page passed `{ defaultValue: "<Vietnamese>" }` to 17 `t()` calls.
 * Those defaults are unreachable: `createTranslator` (i18n/index.js:33-56)
 * resolves `dictionary[key] ?? viDictionary[key] ?? defaultValue`, and every one
 * of those keys exists in both locales, so the default never renders. Worse,
 * the VI fallback sits one level up, so deleting or renaming a key in en.js
 * silently substitutes Vietnamese text in the English UI.
 *
 * VI is the dictionary source of truth instead: nothing is inlined here, and
 * the duplicate-key gate (src/i18n/tenantreg-dup-i18n-keys.component.test.ts)
 * plus the vi/en parity assertion in the same file keep both locales honest.
 */
export function AuthRegisterPage() {
  const { t, locale } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [turnstileUnavailable, setTurnstileUnavailable] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);

  const strength = scorePassword(password);
  const strengthKey = ["passwordStrengthWeak", "passwordStrengthFair", "passwordStrengthGood", "passwordStrengthStrong"][
    Math.max(0, strength - 1)
  ];
  const strengthTone = ["bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][Math.max(0, strength - 1)];

  /** D4: render EVERY message for a field, not just the first. */
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    // Mismatch is checked first: it is the more specific error, and reordering
    // would replace a precise message with a generic length hint.
    if (password !== passwordConfirm) {
      const mismatch = t("auth.registerPasswordMismatch");
      setErrorMessage(mismatch);
      setMessage("");
      setFieldErrors({ password_confirm: [mismatch] });
      return;
    }

    if (!turnstileToken.trim()) {
      setErrorMessage(t("auth.registerTurnstileRequired"));
      setMessage("");
      setFieldErrors({ turnstile_token: [t("auth.registerTurnstileNotRobot")] });
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");
    setFieldErrors(EMPTY_FIELD_ERRORS);

    try {
      const payload = await coreApiAdapter.registerUser({
        username: normalizeUsername(username),
        email: email.trim(),
        password,
        password_confirm: passwordConfirm,
        website,
        turnstile_token: turnstileToken,
      });

      const payloadData = (payload ?? {}) as Record<string, unknown>;
      const nested = (payloadData.data ?? null) as Record<string, unknown> | null;
      const serverMessage = String(nested?.message ?? payloadData.message ?? "");
      setMessage(
        locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.registerSuccess"),
      );
      // D10: the backend lowercases the username (serializers.py:388) and returns
      // the normalised value. Show it, otherwise the user types "VietDung" here
      // and then cannot sign in with it.
      const serverUsername = String(nested?.username ?? payloadData.username ?? "");
      if (serverUsername) setUsername(serverUsername);
      setRegisteredEmail(String(nested?.email ?? payloadData.email ?? email).trim());
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setWebsite("");
      setTurnstileToken("");
      setFieldErrors(EMPTY_FIELD_ERRORS);
    } catch (error) {
      const parsed = parseAuthError(error as any, t, { fieldMap: REGISTER_FIELD_MAP, locale });
      setFieldErrors(parsed.fieldErrors as FieldErrors);
      setErrorMessage(parsed.globalMessage);
      // The challenge is single-use, so a failed submit must ask for a new one.
      setTurnstileToken("");
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
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, t("auth.loginTitle")),
      createElement("p", { className: "mt-2 text-sm text-gray-400" }, t("auth.registerSubtitle")),
      createElement(
        "form",
        { className: "mt-6 space-y-4", onSubmit: handleSubmit, noValidate: false },
        // -- username ---------------------------------------------------
        createElement(
          "div",
          null,
          createElement(
            "label",
            { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-register-username" },
            t("auth.registerUsernameLabel"),
          ),
          createElement("input", {
            id: "auth-register-username",
            name: "username",
            value: username,
            onChange: (event) => setUsername((event.target as HTMLInputElement).value),
            required: true,
            autoComplete: "username",
            // Matches identity_access/serializers.py:384.
            pattern: USERNAME_PATTERN.source,
            minLength: 3,
            maxLength: 30,
            className: inputClass("username"),
            placeholder: t("auth.registerUsernamePlaceholder"),
            "aria-describedby": "auth-register-username-hint",
            "aria-invalid": fieldErrors.username?.length ? true : undefined,
          }),
          createElement(
            "p",
            { id: "auth-register-username-hint", className: "mt-1 text-gray-500 text-xs" },
            t("auth.registerUsernameHint"),
          ),
          renderFieldErrors("username", "auth-register-username"),
        ),
        // -- email ------------------------------------------------------
        createElement(
          "div",
          null,
          createElement(
            "label",
            { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-register-email" },
            t("auth.registerEmailLabel"),
          ),
          createElement("input", {
            id: "auth-register-email",
            name: "email",
            value: email,
            onChange: (event) => setEmail((event.target as HTMLInputElement).value),
            required: true,
            type: "email",
            autoComplete: "email",
            className: inputClass("email"),
            placeholder: t("auth.registerEmailPlaceholder"),
            "aria-describedby": fieldErrors.email?.length ? "auth-register-email-error" : undefined,
            "aria-invalid": fieldErrors.email?.length ? true : undefined,
          }),
          renderFieldErrors("email", "auth-register-email"),
        ),
        // -- password ---------------------------------------------------
        createElement(
          "div",
          null,
          createElement(
            "label",
            { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-register-password" },
            t("auth.registerPasswordLabel"),
          ),
          createElement("input", {
            id: "auth-register-password",
            name: "password",
            value: password,
            onChange: (event) => setPassword((event.target as HTMLInputElement).value),
            required: true,
            type: "password",
            autoComplete: "new-password",
            // D6: was hardcoded 8 while the server enforces 10 plus
            // common/numeric rejection (settings.py:63-67).
            minLength: PASSWORD_MIN_LENGTH,
            // D4: the className here used to be unconditional, so a rejected
            // password was never highlighted.
            className: inputClass("password"),
            placeholder: t("auth.registerPasswordPlaceholder"),
            "aria-describedby": "auth-register-password-hint",
            "aria-invalid": fieldErrors.password?.length ? true : undefined,
          }),
          createElement(
            "p",
            { id: "auth-register-password-hint", className: "mt-1 text-gray-500 text-xs" },
            t("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH }),
          ),
          password
            ? createElement(
                "div",
                { className: "mt-1.5 flex items-center gap-2" },
                createElement("div", { className: "h-1 flex-1 rounded bg-gray-700" }, [
                  createElement("div", {
                    key: "fill",
                    className: `h-1 rounded ${strengthTone}`,
                    style: { width: `${(strength / 4) * 100}%` },
                  }),
                ]),
                createElement(
                  "span",
                  { className: "text-gray-400 text-xs", "data-testid": "register-password-strength" },
                  t("auth.registerPasswordStrength", { level: t(strengthKey), min: PASSWORD_MIN_LENGTH }),
                ),
              )
            : null,
          renderFieldErrors("password", "auth-register-password"),
        ),
        // -- password confirm -------------------------------------------
        createElement(
          "div",
          null,
          createElement(
            "label",
            {
              className: "block text-xs text-gray-400 mb-1.5",
              htmlFor: "auth-register-password-confirm",
            },
            t("auth.registerPasswordConfirmLabel"),
          ),
          createElement("input", {
            id: "auth-register-password-confirm",
            name: "password_confirm",
            value: passwordConfirm,
            onChange: (event) => setPasswordConfirm((event.target as HTMLInputElement).value),
            required: true,
            type: "password",
            autoComplete: "new-password",
            minLength: PASSWORD_MIN_LENGTH,
            className: inputClass("password_confirm"),
            placeholder: t("auth.registerPasswordConfirmPlaceholder"),
            "aria-describedby": fieldErrors.password_confirm?.length
              ? "auth-register-password-confirm-error"
              : undefined,
            "aria-invalid": fieldErrors.password_confirm?.length ? true : undefined,
          }),
          renderFieldErrors("password_confirm", "auth-register-password-confirm"),
        ),
        // -- honeypot ---------------------------------------------------
        // D8: keeps aria-hidden / tabIndex -1, but now has no placeholder and
        // an explicit name so password managers leave it alone. A placeholder
        // on a hidden field is exactly what gets autofilled.
        createElement("input", {
          type: "text",
          name: "website",
          value: website,
          onChange: (event) => setWebsite((event.target as HTMLInputElement).value),
          className: "invisible-honeypot",
          tabIndex: -1,
          autoComplete: "off",
          "aria-hidden": true,
        }),
        createElement(TurnstileWidget, {
          onVerify: (token: string) => {
            setTurnstileToken(token);
            setFieldErrors((prev) => ({ ...prev, turnstile_token: [] }));
          },
          onError: () => {
            setErrorMessage(t("auth.registerTurnstileLoadFailed"));
            setTurnstileUnavailable(true);
          },
          onExpire: () => setTurnstileToken(""),
          unavailableMessage: t("auth.registerTurnstileUnavailable"),
        }),
        fieldErrors.turnstile_token?.length
          ? createElement(
              "div",
              {
                className: "text-red-400 text-xs text-center",
                role: "alert",
                "aria-live": "assertive",
              },
              locale === "vi"
                ? fieldErrors.turnstile_token.join(" ")
                : t("auth.registerTurnstileNotRobot"),
            )
          : null,
        // -- banners ----------------------------------------------------
        message
          ? createElement(
              "p",
              {
                className: "text-emerald-400 text-xs leading-5",
                role: "status",
                "aria-live": "polite",
                "data-testid": "register-success",
              },
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
                "data-testid": "register-error",
              },
              errorMessage,
            )
          : null,
        // D3: a successful registration must offer a way to reach the resend
        // flow, otherwise a lost verification email is a dead end.
        message && registeredEmail
          ? createElement(
              "p",
              { className: "text-xs text-gray-400", "data-testid": "register-resend-link" },
              createElement(
                Link,
                {
                  to: `/verify-email?email=${encodeURIComponent(registeredEmail)}`,
                  className: "text-brand-400 hover:text-brand-300 underline",
                },
                t("auth.registerResendVerificationCta"),
              ),
            )
          : null,
        turnstileUnavailable
          ? createElement(
              "p",
              { className: "text-amber-400 text-xs leading-5", role: "alert" },
              t("auth.registerTurnstileUnavailable"),
            )
          : null,
        createElement(
          "button",
          {
            type: "submit",
            className:
              "w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors",
            disabled: isSubmitting || !turnstileToken,
          },
          isSubmitting ? t("auth.registerSubmitting") : t("auth.registerSubmit"),
        ),
      ),
      createElement(
        "div",
        { className: "mt-6 text-sm" },
        createElement(
          Link,
          { to: "/login", className: "text-brand-400 hover:text-brand-300 transition-colors" },
          t("auth.registerBackToLogin"),
        ),
      ),
    ),
  );
}
