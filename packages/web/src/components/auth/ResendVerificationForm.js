import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { CoreApiRequestError, coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { resolveRetryAfterSeconds } from "../../pages/auth/authErrors.js";

/**
 * tenantreg-d (slice D) — D3.
 *
 * `resendVerificationEmail` existed in adapters/core/auth.js:76-80 and was
 * re-exported from PortfolioContext.js, but had ZERO consumers in src/**, and
 * neither the register page nor the verify page offered any way to reach it. A
 * lost verification email was therefore a permanent dead end: the account stays
 * `is_active=False` (identity_access/views/register.py:115) and login returns
 * `user_inactive` forever.
 *
 * The backend enforces a 60s per-email cooldown and answers 429
 * `resend_cooldown_active` (identity_access/views/register.py:362-369, with
 * `cache.set(cooldown_key, True, 60)`).
 *
 * COUNTDOWN HONESTY: the countdown is not a local guess. On a 429 it is taken
 * from the server's answer via `resolveRetryAfterSeconds`; on success it starts
 * at the cooldown the server just applied. There is no `Retry-After` header on
 * these endpoints, which is why the parser falls back to the documented 60s
 * rather than pretending to read a header that does not exist.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * @typedef {Object} ResendVerificationFormProps
 * @property {string} [initialEmail]  prefilled address, e.g. from `?email=`
 * @property {(email: string) => void} [onResent]
 */

/**
 * @param {ResendVerificationFormProps} props
 */
export function ResendVerificationForm({ initialEmail = "", onResent }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(String(initialEmail || ""));
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef(null);

  // Single timer owner, cleared on unmount so a pending countdown cannot update
  // state after the screen is gone.
  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [cooldown]);

  const isCoolingDown = cooldown > 0;
  const isDisabled = isSubmitting || isCoolingDown || !String(email || "").trim();

  async function handleSubmit(event) {
    event.preventDefault();
    if (isDisabled) return;

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const payload = await coreApiAdapter.resendVerificationEmail(String(email).trim());
      const data = payload && typeof payload === "object" ? payload : {};
      const nested = data.data && typeof data.data === "object" ? data.data : null;
      // Slice A returns one neutral message for every outcome, so prefer our own
      // localized copy and never echo server prose into the EN UI.
      const serverMessage = String((nested && nested.message) ?? data.message ?? "");
      setMessage(
        locale === "vi" && serverMessage.trim()
          ? serverMessage.trim()
          : t("auth.resendVerificationSuccess"),
      );
      setCooldown(RESEND_COOLDOWN_SECONDS);
      onResent?.(String(email).trim());
    } catch (error) {
      const status = Number(error?.status ?? 0);
      if (status === 429) {
        // Honest countdown: the server told us how long, so use that.
        const seconds = resolveRetryAfterSeconds(error);
        setCooldown(seconds);
        const code = String(error?.code ?? "");
        setErrorMessage(
          t(code === "resend_cooldown_active" ? "auth.resendCooldownActive" : "auth.rateLimited", {
            seconds,
            min: 0,
            code,
          }),
        );
      } else if (error instanceof CoreApiRequestError && locale === "vi") {
        const detail = error?.payload?.detail;
        setErrorMessage(
          typeof detail === "string" && detail.trim()
            ? detail.trim()
            : t("auth.resendVerificationError"),
        );
      } else {
        setErrorMessage(t("auth.resendVerificationError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const buttonLabel = useMemo(() => {
    if (isSubmitting) return t("auth.resendVerificationLoading");
    if (isCoolingDown) return t("auth.resendCooldownActive", { seconds: cooldown, min: 0 });
    return t("auth.resendSubmit");
  }, [isSubmitting, isCoolingDown, cooldown, t]);

  return createElement(
    "form",
    { className: "mt-4 space-y-3", onSubmit: handleSubmit, "data-testid": "resend-verification-form" },
    createElement(
      "div",
      null,
      createElement(
        "label",
        { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-resend-email" },
        t("auth.resendEmailLabel"),
      ),
      createElement("input", {
        id: "auth-resend-email",
        type: "email",
        autoComplete: "email",
        value: email,
        onChange: (event) => setEmail(event.target.value),
        className:
          "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
        placeholder: t("auth.resendEmailPlaceholder"),
        required: true,
      }),
    ),
    message
      ? createElement(
          "p",
          {
            className: "text-emerald-400 text-xs leading-5",
            role: "status",
            "aria-live": "polite",
            "data-testid": "resend-success",
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
            "data-testid": "resend-error",
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
        disabled: isDisabled,
        "data-testid": "resend-verification-submit",
      },
      buttonLabel,
    ),
  );
}
