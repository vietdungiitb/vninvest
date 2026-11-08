import { createElement, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authTokenStorage, coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { parseAuthError } from "./authErrors.js";
import { loginSchema, toLoginPayload, type LoginValues } from "./authLoginSchema.js";
import { FormField } from "../../components/ui/FormField.js";
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
 * B6: RHF + zod (authLoginSchema) instead of hand-rolled useState.
 * Validation rules stay in authPolicy.js (SSOT); parseAuthError still owns server errors.
 */
export function AuthLoginPage() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: "onSubmit" });
  const username = watch("username") ?? "";
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
        if (mounted) {
          if (typeof window !== "undefined") {
            window.location.assign("/dashboard");
          }
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

  const onSubmit = handleSubmit(async (values) => {
    setErrorMessage("");
    setErrorCode("");

    try {
      const payload = await coreApiAdapter.loginUser(toLoginPayload(values));

      const tokenPayload = readTokenPayload(payload);
      if (!tokenPayload?.access || !tokenPayload?.refresh) {
        throw new Error(t("auth.loginNoToken"));
      }

      if (typeof window !== "undefined") {
        window.location.assign(destination);
      }
    } catch (error) {
      const parsed = parseAuthError(error as any, t, {
        fieldMap: {},
        fallbackKey: "auth.loginFailed",
        locale,
      });
      setErrorMessage(parsed.globalMessage);
      setErrorCode(parsed.code);
    }
  });

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

  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500";

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
          onSubmit: onSubmit,
        },
        createElement(
          FormField,
          {
            label: t("auth.loginUsernameLabel"),
            htmlFor: "auth-login-username",
            error: errors.username?.message,
            required: true,
          },
          createElement("input", {
            id: "auth-login-username",
            autoComplete: "username",
            placeholder: t("auth.loginUsernamePlaceholder"),
            className: inputCls,
            "aria-invalid": !!errors.username,
            ...register("username"),
          }),
        ),
        createElement(
          FormField,
          {
            label: t("auth.loginPasswordLabel"),
            htmlFor: "auth-login-password",
            error: errors.password?.message,
            required: true,
          },
          createElement("input", {
            id: "auth-login-password",
            type: "password",
            autoComplete: "current-password",
            placeholder: t("auth.loginPasswordPlaceholder"),
            className: inputCls,
            "aria-invalid": !!errors.password,
            ...register("password"),
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

export default AuthLoginPage;
