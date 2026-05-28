import React from "react";

const { createElement } = React;
const e = createElement;

function renderEvidenceList(evidence) {
  const entries = Object.entries(evidence || {}).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) {
    return e("ul", { key: "evidence-list", className: "core-alert-center-evidence-list" }, e("li", null, "Không có dữ liệu bằng chứng."));
  }

  return e(
    "ul",
    { key: "evidence-list", className: "core-alert-center-evidence-list" },
    entries.map(([key, value]) =>
      e("li", { key }, `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    )
  );
}

export function AlertCard({
  alert,
  lane,
  busyAlertId,
  isEvidenceExpanded,
  toggleEvidence,
  handleLoadDetail,
  handleAcknowledge,
  handleMuteSymbol,
  formatAlertValue,
  formatAlertTimestamp,
}) {
  const directionClass =
    String(alert?.direction || "").toLowerCase().includes("buy") || String(alert?.direction || "") === "mua"
      ? "direction-buy"
      : String(alert?.direction || "").toLowerCase().includes("sell") || String(alert?.direction || "") === "bán"
      ? "direction-sell"
      : "";

  return e("article", { className: `core-alert-center-card severity-${alert.severity || "medium"}` }, [
    e("div", { key: "card-top", className: "core-alert-center-card-top" }, [
      e("div", { key: "meta-container" }, [
        e("h3", { key: "title", className: "core-alert-center-card-title" }, alert.title || "Tín hiệu giao dịch bất thường"),
        e("p", { key: "meta", className: "core-alert-center-card-meta" }, [
          e("span", { key: "symbol", className: "core-alert-symbol-badge" }, alert.symbol || "—"),
          e("span", { key: "family-lane" }, `· ${alert.alert_family || alert.alert_type || "—"} · Lane: ${alert.lane || lane}`),
        ]),
      ]),
      e(
        "span",
        { key: "severity", className: `core-alert-center-badge severity-${alert.severity || "medium"}` },
        alert.severity || "medium"
      ),
    ]),
    e("p", { key: "summary", className: "core-alert-center-card-summary" }, alert.summary || alert.body || "Không có nội dung tóm tắt chi tiết."),
    
    // Key metrics strip
    e("div", { key: "metrics", className: "core-alert-center-card-metrics" }, [
      e("span", { key: "val" }, [
        "Giá trị: ", 
        e("strong", null, `${formatAlertValue(alert.value)} VND`)
      ]),
      e("span", { key: "dir" }, [
        "Chiều: ", 
        e("strong", { className: directionClass }, alert.direction || "—")
      ]),
      e("span", { key: "conf" }, [
        "Độ tin cậy: ", 
        e("strong", null, alert.confidence != null ? `${alert.confidence}` : "—")
      ]),
      e("span", { key: "fresh" }, [
        "Độ tươi: ", 
        e("strong", null, alert.freshness_state || "—")
      ]),
      e("span", { key: "sess" }, [
        "Phiên khớp: ", 
        e("strong", null, alert.session_date || "—")
      ]),
      e("span", { key: "time" }, [
        "Thời điểm: ", 
        e("strong", null, formatAlertTimestamp(alert.triggered_at))
      ]),
    ]),

    // Expandable Evidence list
    alert.evidence && Object.keys(alert.evidence).length > 0 ? e("div", { key: "evidence-wrapper" }, [
      e(
        "div",
        { key: "evidence-hdr", className: "core-evidence-header", onClick: () => toggleEvidence(alert.alert_id) },
        [
          e("span", { key: "lbl" }, "Xem bằng chứng bằng dữ liệu (evidence)"),
          e("span", { key: "icon" }, isEvidenceExpanded ? "▲ Ẩn" : "▼ Xem thêm")
        ]
      ),
      isEvidenceExpanded ? renderEvidenceList(alert.evidence) : null
    ]) : null,

    // Action Buttons Footer
    e("div", { key: "actions", className: "core-alert-card-actions" }, [
      e(
        "button",
        {
          key: "btn-detail",
          type: "button",
          className: "is-primary",
          disabled: busyAlertId === alert.alert_id,
          onClick: () => handleLoadDetail(alert),
        },
        busyAlertId === alert.alert_id ? "Đang tải..." : "Chi tiết"
      ),
      lane === "main"
        ? e(
            "button",
            {
              key: "btn-ack",
              type: "button",
              disabled: busyAlertId === alert.alert_id,
              onClick: () => handleAcknowledge(alert),
            },
            "Đánh dấu đã xem"
          )
        : null,
      e(
        "button",
        {
          key: "btn-mute",
          type: "button",
          disabled: busyAlertId === (alert.alert_id || alert.symbol),
          onClick: () => handleMuteSymbol(alert),
        },
        "Mute 30 phút"
      ),
    ]),
  ]);
}
