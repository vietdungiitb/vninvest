import React from "react";

const { createElement } = React;
const e = createElement;

export function DetailDrawer({ activeAlertId, activeDetail, activeContext, appliedSymbol, onClose }) {
  if (!activeDetail) return null;

  return e("section", { className: "core-detail-drawer" }, [
    e("div", { key: "title-row", className: "core-detail-title-row" }, [
      e("h3", null, `Kính lúp kiểm tra pháp y: ${activeAlertId}`),
      e("button", { className: "core-detail-close-btn", onClick: onClose }, "✕"),
    ]),
    
    e("div", { key: "grid", className: "core-detail-grid" }, [
      e("div", { key: "detail", className: "core-detail-section" }, [
        e("h4", null, "Nội dung & Tóm tắt"),
        e("p", null, activeDetail?.title || "Không có tiêu đề"),
        e("p", { style: { marginTop: "8px", fontSize: "0.85rem", color: "var(--text-muted)" } }, activeDetail?.summary || activeDetail?.body || "Không có tóm tắt chi tiết."),
      ]),
      
      activeContext ? e("div", { key: "context", className: "core-detail-section" }, [
        e("h4", null, `Bối cảnh mã ${activeContext.symbol || appliedSymbol}`),
        e("div", { style: { display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem" } }, [
          e("div", null, ["Tổng cảnh báo đang hoạt động: ", e("strong", null, String(activeContext.total || 0))]),
          e("div", null, ["Cảnh báo chưa đọc: ", e("strong", { style: { color: "var(--neon-orange)" } }, String(activeContext.unseen || 0))]),
          e("div", null, ["Mức độ trung bình: ", e("strong", null, activeContext.average_severity || "medium")]),
          e("div", null, ["Cơ chế bảo mật threshold: ", e("strong", null, activeContext.threshold_strategy || "default")]),
        ])
      ]) : null,
    ])
  ]);
}
