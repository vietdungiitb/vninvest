import { createElement, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CoreApiRequestError, coreApiAdapter } from "../../adapters/coreApiAdapter.js";

function resolveVerifyMessage(error) {
  if (error instanceof CoreApiRequestError) {
    const detail = error?.payload?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (detail && typeof detail === "object") {
      const tokenErrors = detail?.token;
      if (Array.isArray(tokenErrors) && tokenErrors.length) {
        return String(tokenErrors[0]);
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Không thể xác minh email. Vui lòng thử lại.";
}

export function AuthVerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState("Đang xác minh email...");

  useEffect(() => {
    const token = String(searchParams.get("token") || "").trim();
    if (!token) {
      setIsLoading(false);
      setIsSuccess(false);
      setMessage("Thiếu token xác minh email.");
      return;
    }

    let mounted = true;
    coreApiAdapter
      .verifyEmailToken(token)
      .then((payload) => {
        if (!mounted) return;
        setIsSuccess(true);
        setMessage(payload?.data?.message || payload?.message || "Email đã được xác minh. Bạn có thể đăng nhập.");
      })
      .catch((error) => {
        if (!mounted) return;
        setIsSuccess(false);
        setMessage(resolveVerifyMessage(error));
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const statusClasses = isLoading
    ? "border-gray-700 bg-gray-950 text-gray-300"
    : isSuccess
      ? "border-emerald-800/70 bg-emerald-950/20 text-emerald-200"
      : "border-rose-800/70 bg-rose-950/20 text-rose-200";

  return createElement(
    "main",
    { className: "min-h-screen bg-gray-950 flex items-center justify-center px-4" },
    createElement(
      "section",
      { className: "w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8" },
      createElement("h1", { className: "text-2xl font-bold text-brand-500" }, "VNInvest"),
      createElement("p", { className: "mt-2 text-sm text-gray-400" }, "Xác minh email tài khoản"),
      createElement("div", { className: `mt-6 rounded-lg border px-4 py-4 text-sm leading-6 ${statusClasses}` }, message),
      createElement(
        "div",
        { className: "mt-6" },
        createElement(Link, { to: "/login", className: "inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700" }, "Quay lại đăng nhập"),
      ),
    ),
  );
}
