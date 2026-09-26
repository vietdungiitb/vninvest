import { createElement, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { authTokenStorage, coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { parseAuthError } from "./authErrors.js";
import "./AuthRegisterPage.css";

function readTokenPayload(payload: unknown): { access: string; refresh: string } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.access === "string") {
    return p as { access: string; refresh: string };
  }
  if (p.data && typeof p.data === "object") {
    const d = p.data as Record<string, unknown>;
    if (typeof d.access === "string") {
      return d as { access: string; refresh: string };
    }
  }
  return null;
}

/**
 * tenantreg-d (slice D) — D5, D3, D9, D10.
 */
export function AuthLoginPage() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(() => authTokenStorage.hasTokens());
  const [hasStoredTokens, setHasStoredTokens] = useState(() => authTokenStorage.hasTokens());
  const destination = useMemo(() => {
    const locState = location.state as { from?: string } | null;
    if (typeof locState?.from === "string" && locState.from.trim()) {
      return locState.from;
    }
    return "/dashboard";
  }, [location]);

  useEffect(() => {
    if (!hasStoredTokens) {
      setIsCheckingSession(false);
      return;
    }

    let mounted = true;
    coreApiAdapter
      .getTenantLifecycle()
      .then(() => {
        if (mounted && typeof window !== "undefined") {
          window.location.assign("/dashboard");
        }
      })
      .catch(() => {
        authTokenStorage.clearTokens();
        if (mounted) {
          setHasStoredTokens(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [hasStoredTokens]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setErrorCode("");

    try {
      const payload = await coreApiAdapter.loginUser({
        // D10: the adapter lowercases this. The backend stores usernames
        // lowercased (serializers.py:388) but authenticates with the exact
        // string it receives (views/login.py:124), so a mixed-case sign-in
        // otherwise fails with "invalid credentials" on a correct password.
        username: username.trim(),
        password,
      });

      const tokenPayload = readTokenPayload(payload);
      if (!tokenPayload?.access || !tokenPayload?.refresh) {
        throw new Error(t("auth.loginNoToken"));
      }

      if (typeof window !== "undefined") {
        window.location.assign(destination);
      }
    } catch (error) {
      // D5: a 429 previously rendered the backend's raw Vietnamese `detail`, so
      // an EN user read Vietnamese, and no countdown was shown even though the
      // login endpoint is limited to 3/min per user and 5/min per IP
      // (views/login.py:76-104).
      const parsed = parseAuthError(error as any, t, {
        fieldMap: {},
        fallbackKey: "auth.loginFailed",
        locale,
      });
      setErrorMessage(parsed.globalMessage);
      setErrorCode(parsed.code);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Only offer the resend path when the server actually said the account is
  // unverified, and only prefill when the user typed something email-shaped.
  const canResend = errorCode === "user_inactive" && username.includes("@");

  if (isCheckingSession) {
    return createElement(
      "main",
      { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4" },
      createElement(
        "section",
        { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
        createElement("h1", { className: "text-2xl font-bold text-brand-500" }, t("auth.loginTitle")),
        createElement("p", { className: "mt-2 text-sm text-gray-400" }, t("auth.loginChecking")),
      ),
    );
  }

  return createElement(
    "main",
    { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4" },
    createElement(
      "section",
      { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, t("auth.loginTitle")),
      createElement("p", { className: "mt-2 text-sm text-gray-400" }, t("auth.loginSubtitle")),
      createElement(
        "form",
        {
          className: "mt-6 space-y-4",
          onSubmit: handleSubmit,
        },
        createElement(
          "div",
          null,
          createElement(
            "label",
            { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-login-username" },
            t("auth.loginUsernameLabel"),
          ),
          createElement("input", {
            id: "auth-login-username",
            name: "username",
            autoComplete: "username",
            value: username,
            onChange: (event) => setUsername((event.target as HTMLInputElement).value),
            className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
            placeholder: t("auth.loginUsernamePlaceholder"),
            required: true,
          }),
        ),
        createElement(
          "div",
          null,
          createElement(
            "label",
            { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-login-password" },
            t("auth.loginPasswordLabel"),
          ),
          createElement("input", {
            id: "auth-login-password",
            name: "password",
            type: "password",
            autoComplete: "current-password",
            value: password,
            onChange: (event) => setPassword((event.target as HTMLInputElement).value),
            className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
            placeholder: t("auth.loginPasswordPlaceholder"),
            required: true,
          }),
        ),
        errorMessage
          ? createElement(
              "p",
              {
                className: "text-red-400 text-xs leading-5",
                role: "alert",
                "aria-live": "assertive",
                "data-testid": "login-error",
              },
              errorMessage,
            )
          : null,
        canResend
          ? createElement(
              "p",
              { className: "text-xs" },
              createElement(
                Link,
                {
                  to: `/verify-email?email=${encodeURIComponent(username.trim())}`,
                  className: "text-brand-400 hover:text-brand-300 underline",
                },
                t("auth.loginResendVerificationCta"),
              ),
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
          isSubmitting ? t("auth.loginSubmitting") : t("auth.loginSubmit"),
        ),
      ),
      createElement(
        "div",
        { className: "mt-6 flex items-center justify-between text-sm" },
        createElement(
          Link,
          { to: "/register", className: "text-brand-400 hover:text-brand-300 transition-colors" },
          t("auth.loginCreateAccount"),
        ),
        createElement(
          Link,
          { to: "/reset-password", className: "text-gray-400 hover:text-gray-300 transition-colors" },
          t("auth.loginForgotPassword"),
        ),
      ),
    ),
  );
}
