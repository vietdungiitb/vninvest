import { useState, useEffect, createElement } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import "./AIAdvisorAlertPanel.css";

const e = createElement;

const I18N = {
  vi: {
    "aiAdvisor.panel.title": "Trung Tâm Tín Hiệu AI Advisor",
    "aiAdvisor.panel.refresh": "Làm mới",
    "aiAdvisor.panel.loading": "Đang tải...",
    "aiAdvisor.panel.loadError": "Không thể tải danh sách cảnh báo AI.",
    "aiAdvisor.panel.initialLoading": "Đang phân tích dữ liệu dòng tiền và RSI...",
    "aiAdvisor.panel.empty": "Chưa ghi nhận tín hiệu cảnh báo AI nào trong phiên hiện tại.",
    "aiAdvisor.severity.critical": "Cực kỳ khẩn cấp",
    "aiAdvisor.severity.high": "Khẩn cấp",
    "aiAdvisor.severity.medium": "Trung bình",
    "aiAdvisor.severity.low": "Thấp",
    "aiAdvisor.metric.moneyFlow": "Dòng tiền:",
    "aiAdvisor.metric.trend": "Xu hướng:",
    "aiAdvisor.metric.rsi": "RSI Hiện Tại:",
    "aiAdvisor.trend.buy": "MUA",
    "aiAdvisor.trend.sell": "BÁN",
    "aiAdvisor.trend.neutral": "TRUNG LẬP",
    "aiAdvisor.unit.vnd": "VND",
    "aiAdvisor.unit.billion": "tỷ",
    "aiAdvisor.unit.million": "triệu",
  },
  en: {
    "aiAdvisor.panel.title": "AI Advisor Signal Center",
    "aiAdvisor.panel.refresh": "Refresh",
    "aiAdvisor.panel.loading": "Loading...",
    "aiAdvisor.panel.loadError": "Unable to load AI alerts.",
    "aiAdvisor.panel.initialLoading": "Analyzing money flow and RSI signals...",
    "aiAdvisor.panel.empty": "No AI alerts were detected in this trading session.",
    "aiAdvisor.severity.critical": "Critical",
    "aiAdvisor.severity.high": "High",
    "aiAdvisor.severity.medium": "Medium",
    "aiAdvisor.severity.low": "Low",
    "aiAdvisor.metric.moneyFlow": "Money flow:",
    "aiAdvisor.metric.trend": "Direction:",
    "aiAdvisor.metric.rsi": "Current RSI:",
    "aiAdvisor.trend.buy": "BUY",
    "aiAdvisor.trend.sell": "SELL",
    "aiAdvisor.trend.neutral": "NEUTRAL",
    "aiAdvisor.unit.vnd": "VND",
    "aiAdvisor.unit.billion": "billion",
    "aiAdvisor.unit.million": "million",
  },
};

export function resolveAiAdvisorLocale() {
  const browserLang =
    (typeof document !== "undefined" && document.documentElement?.lang) ||
    (typeof navigator !== "undefined" ? navigator.language : "") ||
    "vi";
  return String(browserLang).toLowerCase().startsWith("en") ? "en" : "vi";
}

export function createAiAdvisorTranslator(locale = "vi") {
  const language = locale === "en" ? "en" : "vi";
  const dict = I18N[language];
  return {
    language,
    t: (key) => dict[key] || I18N.vi[key] || key,
  };
}

export function AIAdvisorAlertPanel({ className = "" }) {
  const { t, language } = createAiAdvisorTranslator(resolveAiAdvisorLocale());
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
      setError(err?.message || t("aiAdvisor.panel.loadError"));
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
      return `${(num / 1_000_000_000).toFixed(2)} ${t("aiAdvisor.unit.billion")}`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(0)} ${t("aiAdvisor.unit.million")}`;
    }
    return num.toLocaleString(language === "en" ? "en-US" : "vi-VN");
  };

  const resolveSeverityLabel = (severity) => {
    if (severity === "critical") return t("aiAdvisor.severity.critical");
    if (severity === "high") return t("aiAdvisor.severity.high");
    if (severity === "medium") return t("aiAdvisor.severity.medium");
    return t("aiAdvisor.severity.low");
  };

  const resolveTrendLabel = (direction) => {
    if (direction === "buy") return t("aiAdvisor.trend.buy");
    if (direction === "sell") return t("aiAdvisor.trend.sell");
    return t("aiAdvisor.trend.neutral");
  };

  return e(
    "div",
    { className: `ai-advisor-panel ${className}` },
    e(
      "div",
      { className: "ai-advisor-panel-header" },
      e("h3", { className: "ai-advisor-panel-title" }, t("aiAdvisor.panel.title")),
      e(
        "button",
        {
          className: "ai-advisor-panel-refresh-btn",
          onClick: fetchFeed,
          disabled: loading,
        },
        loading ? t("aiAdvisor.panel.loading") : t("aiAdvisor.panel.refresh")
      )
    ),
    error && e("div", { className: "ai-advisor-panel-error" }, error),
    loading && alerts.length === 0 && e(
      "div",
      { className: "ai-advisor-panel-loading" },
      t("aiAdvisor.panel.initialLoading")
    ),
    !loading && alerts.length === 0 && !error && e(
      "div",
      { className: "ai-advisor-panel-empty" },
      t("aiAdvisor.panel.empty")
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
                resolveSeverityLabel(alert.severity)
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
              e("span", { className: "ai-advisor-metric-label" }, t("aiAdvisor.metric.moneyFlow")),
              e("span", { className: "ai-advisor-metric-value" }, `${formatValue(alert.value)} ${t("aiAdvisor.unit.vnd")}`)
            ),
            e(
              "div",
              { className: "ai-advisor-metric-item" },
              e("span", { className: "ai-advisor-metric-label" }, t("aiAdvisor.metric.trend")),
              e(
                "span",
                { className: `ai-advisor-metric-value trend-${alert.direction}` },
                resolveTrendLabel(alert.direction)
              )
            ),
            rsi != null && e(
              "div",
              { className: "ai-advisor-metric-item" },
              e("span", { className: "ai-advisor-metric-label" }, t("aiAdvisor.metric.rsi")),
              e("span", { className: "ai-advisor-metric-value font-bold" }, parseFloat(rsi).toFixed(1))
            )
          )
        );
      })
    )
  );
}
