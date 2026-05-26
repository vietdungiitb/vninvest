import { createElement } from "react";

const e = createElement;

export function StockSessionWitness({
  selectedSession,
  onClearSession,
  loading
}) {
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
        e("span", { className: "sdp-witness-label" }, hasActiveSession ? "Bộ lọc theo phiên chọn:" : "Dữ liệu thời gian thực:"),
        e(
          "span",
          { className: "sdp-witness-value" },
          loading
            ? e("span", { className: "sdp-witness-loading" }, "Đang đồng bộ...")
            : hasActiveSession
            ? sessionDateStr
            : "Phiên hôm nay (Mặc định)"
        )
      ),
      hasActiveSession &&
        e(
          "button",
          {
            type: "button",
            className: "sdp-witness-clear-btn",
            onClick: onClearSession,
            title: "Bỏ chọn phiên, quay lại phiên hôm nay"
          },
          "✕ Bỏ lọc phiên"
        ),
      !hasActiveSession &&
        e(
          "span",
          { className: "sdp-witness-hint" },
          "💡 Mẹo: Nhấp vào một cây nến trên biểu đồ để xem dòng tiền & khuyến nghị chi tiết cho phiên đó."
        )
    )
  );
}
