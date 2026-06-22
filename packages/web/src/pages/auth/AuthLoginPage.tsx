import { createElement, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CoreApiRequestError, authTokenStorage, coreApiAdapter } from "../../adapters/coreApiAdapter.js";

function resolveMessage(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }
  if (error instanceof CoreApiRequestError) {
    const detail = (error as any)?.payload?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }
  return error.message || fallbackMessage;
}

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

export function AuthLoginPage() {
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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

    try {
      const payload = await coreApiAdapter.loginUser({
        username: username.trim(),
        password,
      });

      const tokenPayload = readTokenPayload(payload);
      if (!tokenPayload?.access || !tokenPayload?.refresh) {
        throw new Error("Không nhận được bộ token đăng nhập hợp lệ.");
      }

      if (typeof window !== "undefined") {
        window.location.assign(destination);
      }
    } catch (error) {
      setErrorMessage(resolveMessage(error, "Đăng nhập thất bại. Vui lòng thử lại."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return createElement(
      "main",
      { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4" },
      createElement(
        "section",
        { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
        createElement("h1", { className: "text-2xl font-bold text-brand-500" }, "VNInvest"),
        createElement("p", { className: "mt-2 text-sm text-gray-400" }, "Đang kiểm tra phiên đăng nhập..."),
      ),
    );
  }

  return createElement(
    "main",
    { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4" },
    createElement(
      "section",
      { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, "VNInvest"),
      createElement("p", { className: "mt-2 text-sm text-gray-400" }, "Đăng nhập vào nền tảng SaaS VNInvest"),
      createElement(
        "form",
        {
          className: "mt-6 space-y-4",
          onSubmit: handleSubmit,
        },
        createElement(
          "div",
          null,
          createElement("label", { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-login-username" }, "Tên đăng nhập hoặc email"),
          createElement("input", {
            id: "auth-login-username",
            autoComplete: "username",
            value: username,
            onChange: (event) => setUsername((event.target as HTMLInputElement).value),
            className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
            placeholder: "Nhập tên đăng nhập hoặc email",
            required: true,
          }),
        ),
        createElement(
          "div",
          null,
          createElement("label", { className: "block text-xs text-gray-400 mb-1.5", htmlFor: "auth-login-password" }, "Mật khẩu"),
          createElement("input", {
            id: "auth-login-password",
            type: "password",
            autoComplete: "current-password",
            value: password,
            onChange: (event) => setPassword((event.target as HTMLInputElement).value),
            className: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500",
            placeholder: "••••••••",
            required: true,
          }),
        ),
        errorMessage
          ? createElement("p", { className: "text-red-400 text-xs leading-5" }, errorMessage)
          : null,
        createElement(
          "button",
          {
            type: "submit",
            className: "w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors",
            disabled: isSubmitting,
          },
          isSubmitting ? "Đang đăng nhập..." : "Đăng nhập",
        ),
      ),
      createElement(
        "div",
        { className: "mt-6 flex items-center justify-between text-sm" },
        createElement(Link, { to: "/register", className: "text-brand-400 hover:text-brand-300 transition-colors" }, "Tạo tài khoản"),
        createElement(Link, { to: "/reset-password", className: "text-gray-400 hover:text-gray-300 transition-colors" }, "Quên mật khẩu?"),
      ),
    ),
  );
}
