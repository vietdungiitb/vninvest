import { createElement } from "react";
import { useI18n } from "../../../context/LangContext.js";

const e = createElement;

export function StockSessionWitness({
  selectedSession,
  onClearSession,
  loading
}) {
  const { t } = useI18n();
  const tk = (key) => `stockDetail.page.${key}`;

  const hasActiveSession = !!selectedSession;
  const sessionDateStr = hasActiveSession
    ? new Date(selectedSession.tradeDate).toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : null;

  return e(
    "div",
    { className: `sdp-witness-strip ${hasActiveSession ? "sdp-witness-active" : ""}` },
    e(
      "div",
      { className: "sdp-witness-container" },
      e(
        "div",
        { className: "sdp-witness-left" },
        e("span", { className: `sdp-witness-dot ${hasActiveSession ? "sdp-pulse" : ""}` }),
        e("span", { className: "sdp-witness-label" }, hasActiveSession ? t(tk("sessionFilterLabel")) : t(tk("realtimeLabel"))),
        e(
          "span",
          { className: "sdp-witness-value" },
          loading
            ? e("span", { className: "sdp-witness-loading" }, t(tk("syncing")))
            : hasActiveSession
            ? sessionDateStr
            : t(tk("todaySession"))
        )
      ),
      hasActiveSession &&
        e(
          "button",
          {
            type: "button",
            className: "sdp-witness-clear-btn",
            onClick: onClearSession,
            title: t(tk("clearSession"))
          },
          `✕ ${t(tk("clearSession"))}`
        ),
      !hasActiveSession &&
        e(
          "span",
          { className: "sdp-witness-hint" },
          t(tk("sessionHint"))
        )
    )
  );
}
