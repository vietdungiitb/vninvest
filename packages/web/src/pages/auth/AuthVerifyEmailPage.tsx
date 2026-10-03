import { createElement, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { ResendVerificationForm } from "../../components/auth/ResendVerificationForm.js";
import { fieldFallbackKey, parseAuthError } from "./authErrors.js";
import "./AuthRegisterPage.css";

/**
 * tenantreg-d (slice D) — D3, D8, D9, D5.
 *
 * D3: this page had no way to request a new verification email, and
 * `resendVerificationEmail` had zero consumers in src/**, so a user who lost the
 * first email was stuck permanently (the account stays `is_active=False` and
 * login answers `user_inactive` forever). The resend form is now embedded here,
 * prefilled from `?email=` so the post-register link lands with the address
 * already filled in.
 *
 * D8: the status box was a bare `<div>` with no live region, so a screen reader
 * user got no announcement when verification finished.
 */
export function AuthVerifyEmailPage() {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [canResend, setCanResend] = useState(false);

  const prefillEmail = String(searchParams.get("email") || "").trim();

  useEffect(() => {
    const token = String(searchParams.get("token") || "").trim();
    if (!token) {
      setIsLoading(false);
      setIsSuccess(false);
      setMessage(t("auth.verifyMissingToken"));
      // No token means the user arrived from the register page or followed a
      // stale link: offering resend is the only useful action.
      setCanResend(true);
      return;
    }

    let mounted = true;
    coreApiAdapter
      .verifyEmailToken(token)
      .then((payload: unknown) => {
        if (!mounted) return;
        const data = (payload ?? {}) as Record<string, unknown>;
        const nested = (data.data ?? null) as Record<string, unknown> | null;
        const serverMessage = String(nested?.message ?? data.message ?? "");
        setIsSuccess(true);
        setMessage(
          locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.verifySuccess"),
        );
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        const parsed = parseAuthError(error as any, t, {
          fieldMap: { token: "token", invalid_token: "token" },
          fallbackKey: "auth.verifyFailed",
          locale,
        });
        setIsSuccess(false);
        // Prefer the server's own wording in VI; otherwise our localized copy,
        // because the backend writes `detail` in Vietnamese.
        const tokenMessages = (parsed.fieldErrors as Record<string, string[]>).token ?? [];
        const serverDetail = (error as any)?.payload?.detail;
        if (typeof serverDetail === "string" && serverDetail.trim() && locale === "vi") {
          setMessage(serverDetail.trim());
        } else if (tokenMessages.length) {
          setMessage(t(fieldFallbackKey("token")));
        } else {
          setMessage(parsed.globalMessage);
        }
        setCanResend(true);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [searchParams, t, locale]);

  const statusClasses = isLoading
    ? "border-gray-700 bg-gray-950 text-gray-300"
    : isSuccess
      ? "border-emerald-800/70 bg-emerald-950/20 text-emerald-200"
      : "border-rose-800/70 bg-rose-950/20 text-rose-200";

  return createElement(
    "main",
    { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10" },
    createElement(
      "section",
      { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, t("auth.verifyTitle")),
      createElement("p", { className: "mt-2 text-sm text-gray-400" }, t("auth.verifySubtitle")),
      createElement(
        "div",
        {
          className: `mt-6 rounded-lg border px-4 py-4 text-sm leading-6 ${statusClasses}`,
          // D8: announce the outcome, do not just repaint it.
          role: "status",
          "aria-live": isLoading ? "polite" : "assertive",
          "aria-busy": isLoading,
          "data-testid": "verify-status",
        },
        message,
      ),
      canResend
        ? createElement(
            "div",
            { className: "mt-6 border-t border-gray-800 pt-5" },
            createElement(
              "h2",
              { className: "text-sm font-semibold text-gray-200" },
              t("auth.resendVerification"),
            ),
            createElement(ResendVerificationForm, { initialEmail: prefillEmail }),
          )
        : null,
      createElement(
        "div",
        { className: "mt-6" },
        createElement(
          Link,
          {
            to: "/login",
            className:
              "inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700",
          },
          t("auth.verifyBackToLogin"),
        ),
      ),
    ),
  );
}
