import { useState, useEffect, createElement } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import "./AIAdvisorAlertPanel.css";

const e = createElement;

export function AIAdvisorAlertPanel({ className = "" }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await coreApiAdapter.getAIAlertsFeed();
      if (res && Array.isArray(res.results)) {
        setAlerts(res.results);
      } else if (Array.isArray(res)) {
        setAlerts(res);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      setError(err?.message || "Không thể tải danh sách cảnh báo AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const getPulseGlowClass = (alert) => {
    const rsi = alert?.metadata?.rsi || alert?.evidence?.rsi || alert?.evidence?.rsi_at_signal;
    if (rsi != null) {
      const rsiNum = parseFloat(rsi);
      if (rsiNum <= 30) return "pulse-emerald";
      if (rsiNum >= 70) return "pulse-rose";
    }
    return "";
  };

  const formatValue = (val) => {
    if (val == null) return "—";
    const num = parseFloat(val);
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)} tỷ`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(0)} triệu`;
    }
    return num.toLocaleString("vi-VN");
  };

  return e(
    "div",
    { className: `ai-advisor-panel ${className}` },
    e(
      "div",
      { className: "ai-advisor-panel-header" },
      e("h3", { className: "ai-advisor-panel-title" }, "Trung Tâm Tín Hiệu AI Advisor"),
      e(
        "button",
        {
          className: "ai-advisor-panel-refresh-btn",
          onClick: fetchFeed,
          disabled: loading,
        },
        loading ? "Đang tải..." : "Làm mới"
      )
    ),
    error && e("div", { className: "ai-advisor-panel-error" }, error),
    loading && alerts.length === 0 && e(
      "div",
      { className: "ai-advisor-panel-loading" },
      "Đang phân tích dữ liệu dòng tiền và RSI..."
    ),
    !loading && alerts.length === 0 && !error && e(
      "div",
      { className: "ai-advisor-panel-empty" },
      "Chưa ghi nhận tín hiệu cảnh báo AI nào trong phiên hiện tại."
    ),
    e(
      "div",
      { className: "ai-advisor-panel-list" },
      alerts.map((alert) => {
        const glowClass = getPulseGlowClass(alert);
        const rsi = alert?.metadata?.rsi || alert?.evidence?.rsi || alert?.evidence?.rsi_at_signal;
        
        return e(
          "div",
          { key: alert.alert_id, className: `ai-advisor-alert-card ${glowClass}` },
          e(
            "div",
            { className: "ai-advisor-card-header" },
            e(
              "div",
              { className: "ai-advisor-card-title-group" },
              e("span", { className: "ai-advisor-card-symbol" }, alert.symbol),
              e(
                "span",
                {
                  className: "ai-advisor-card-severity-badge",
                  "data-severity": alert.severity,
                },
                alert.severity === "critical" ? "Cực kỳ khẩn cấp" :
                alert.severity === "high" ? "Khẩn cấp" :
                alert.severity === "medium" ? "Trung bình" : "Thấp"
              )
            ),
            e("span", { className: "ai-advisor-card-date" }, alert.session_date)
          ),
          e("h4", { className: "ai-advisor-card-title" }, alert.title),
          e("p", { className: "ai-advisor-card-body" }, alert.body || alert.summary),
          e(
            "div",
            { className: "ai-advisor-card-metrics" },
            e(
              "div",
              { className: "ai-advisor-metric-item" },
              e("span", { className: "ai-advisor-metric-label" }, "Dòng tiền:"),
              e("span", { className: "ai-advisor-metric-value" }, `${formatValue(alert.value)} VND`)
            ),
            e(
              "div",
              { className: "ai-advisor-metric-item" },
              e("span", { className: "ai-advisor-metric-label" }, "Xu hướng:"),
              e(
                "span",
                { className: `ai-advisor-metric-value trend-${alert.direction}` },
                alert.direction === "buy" ? "MUA" : alert.direction === "sell" ? "BÁN" : "TRUNG LẬP"
              )
            ),
            rsi != null && e(
              "div",
              { className: "ai-advisor-metric-item" },
              e("span", { className: "ai-advisor-metric-label" }, "RSI Hiện Tại:"),
              e("span", { className: "ai-advisor-metric-value font-bold" }, parseFloat(rsi).toFixed(1))
            )
          )
        );
      })
    )
  );
}
