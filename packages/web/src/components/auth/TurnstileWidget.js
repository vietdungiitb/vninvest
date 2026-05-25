import { createElement, useMemo } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

function resolveSiteKey() {
  if (typeof process !== "undefined" && typeof process.env?.REACT_APP_TURNSTILE_SITE_KEY === "string" && process.env.REACT_APP_TURNSTILE_SITE_KEY.trim()) {
    return process.env.REACT_APP_TURNSTILE_SITE_KEY.trim();
  }
  if (typeof window !== "undefined" && typeof window.TURNSTILE_SITE_KEY === "string" && window.TURNSTILE_SITE_KEY.trim()) {
    return window.TURNSTILE_SITE_KEY.trim();
  }
  return "1x00000000000000000000AA";
}

export function TurnstileWidget({ onVerify, onError, onExpire }) {
  const siteKey = useMemo(resolveSiteKey, []);

  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
    return createElement(
      "button",
      {
        type: "button",
        "data-testid": "turnstile-test-trigger",
        onClick: () => onVerify?.("cf-test-token"),
      },
      "Turnstile test token",
    );
  }

  return createElement(
    "div",
    { className: "my-2 flex justify-center" },
    createElement(Turnstile, {
      siteKey,
      onSuccess: (token) => onVerify?.(String(token || "")),
      onError: () => onError?.(),
      onExpire: () => onExpire?.(),
      options: {
        theme: "dark",
        size: "flexible",
      },
    }),
  );
}