import React from "react";
const styles = {
  detailDrawer: "core-detail-drawer",
  titleRow: "core-detail-title-row",
  closeBtn: "core-detail-close-btn",
  detailGrid: "core-detail-grid",
  detailSection: "core-detail-section",
  detailItem: "core-detail-item",
  flexColGap8: "flex-col-gap-8",
  marginTop8: "margin-top-8",
  fontSize85remColorMuted: "font-size-85rem-color-muted"
};

const { createElement } = React;
const e = createElement;

export function DetailDrawer({ activeAlertId, activeDetail, activeContext, appliedSymbol, onClose }) {
  if (!activeDetail) return null;

  return e("section", { className: styles.detailDrawer }, [
    e("div", { key: "title-row", className: styles.titleRow }, [
      e("h3", null, `Kính lúp kiểm tra pháp y: ${activeAlertId}`),
      e("button", { className: styles.closeBtn, onClick: onClose }, "✕"),
    ]),
    
    e("div", { key: "grid", className: styles.detailGrid }, [
      e("div", { key: "detail", className: styles.detailSection }, [
        e("h4", null, "Nội dung & Tóm tắt"),
        e("p", null, activeDetail?.title || "Không có tiêu đề"),
        e("p", { className: styles.marginTop8 + " " + styles.fontSize85remColorMuted }, activeDetail?.summary || activeDetail?.body || "Không có tóm tắt chi tiết."),
      ]),
      
      activeContext ? e("div", { key: "context", className: styles.detailSection }, [
        e("h4", null, `Bối cảnh mã ${activeContext.symbol || appliedSymbol}`),
        e("div", { className: styles.flexColGap8 }, [
          e("div", null, ["Tổng cảnh báo đang hoạt động: ", e("strong", null, String(activeContext.total || 0))]),
          e("div", null, ["Cảnh báo chưa đọc: ", e("strong", { style: { color: "var(--neon-orange)" } }, String(activeContext.unseen || 0))]),
          e("div", null, ["Mức độ trung bình: ", e("strong", null, activeContext.average_severity || "medium")]),
          e("div", null, ["Cơ chế bảo mật threshold: ", e("strong", null, activeContext.threshold_strategy || "default")]),
        ])
      ]) : null,
    ])
  ]);
}
