import { createElement, useEffect, useState } from "react";

const e = createElement;

const SOURCES_METADATA = {
  whale:       { defaultLookback: 30,  min: 1, max: 180, label: "Dòng tiền Cá mập (Whale Alerts)" },
  dark_flow:   { defaultLookback: 30,  min: 1, max: 180, label: "Dòng tiền ẩn danh (Dark Flow)" },
  technical:   { defaultLookback: 20,  min: 1, max: 60,  label: "Phân tích kỹ thuật (Technical)" },
  news:        { defaultLookback: 14,  min: 1, max: 90,  label: "Tin tức & Sự kiện (News Context)" },
  market:      { defaultLookback: 7,   min: 1, max: 30,  label: "Bối cảnh thị trường (Market)" },
  fundamental: { defaultLookback: 90,  min: 1, max: 365, label: "Phân tích cơ bản (Fundamental)" },
  ownership:   { defaultLookback: 365, min: 1, max: 730, label: "Cơ cấu sở hữu (Ownership)" },
  sector:      { defaultLookback: 20,  min: 1, max: 90,  label: "So sánh ngành (Sector)" },
};

const TECHNICAL_INDICATORS = ["rsi", "bollinger", "vols", "prices", "ma20", "ma50", "snapshot", "cdms"];

export function AIAdvisoryPromptConfigDrawer({ isOpen, onClose, config, onConfigChange }) {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config, isOpen]);

  if (!isOpen || !localConfig) return null;

  const handleSourceToggle = (sourceId) => {
    const sourceObj = localConfig.sources[sourceId] || { enabled: true, lookback: SOURCES_METADATA[sourceId].defaultLookback };
    const updated = {
      ...localConfig,
      sources: {
        ...localConfig.sources,
        [sourceId]: {
          ...sourceObj,
          enabled: !sourceObj.enabled,
        },
      },
    };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  const handleLookbackChange = (sourceId, days) => {
    const meta = SOURCES_METADATA[sourceId];
    const clamped = Math.max(meta.min, Math.min(meta.max, Number(days) || 1));
    const sourceObj = localConfig.sources[sourceId] || { enabled: true, lookback: meta.defaultLookback };
    const updated = {
      ...localConfig,
      sources: {
        ...localConfig.sources,
        [sourceId]: {
          ...sourceObj,
          lookback: clamped,
        },
      },
    };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  const handleIndicatorToggle = (indicator) => {
    const techObj = localConfig.sources.technical || { enabled: true, lookback: 20, indicators: [] };
    const currentIndicators = techObj.indicators || [];
    const updated = {
      ...localConfig,
      sources: {
        ...localConfig.sources,
        technical: {
          ...techObj,
          indicators: currentIndicators.includes(indicator)
            ? currentIndicators.filter((ind) => ind !== indicator)
            : [...currentIndicators, indicator],
        },
      },
    };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  const enabledSources = Object.entries(localConfig.sources)
    .filter(([_, cfg]) => cfg.enabled)
    .length;

  const enabledIndicators = (localConfig.sources.technical?.indicators || []).length;

  return e(
    "div",
    { className: "sdp-drawer-overlay", onClick: onClose },
    e(
      "div",
      { className: "sdp-drawer-content", onClick: (e) => e.stopPropagation() },
      
      // Header
      e(
        "div",
        { className: "sdp-drawer-header" },
        e(
          "div",
          null,
          e("h2", { className: "sdp-drawer-title" }, "⚙️ Cài đặt Cố vấn AI (Prompt Config)"),
          e("p", { className: "sdp-drawer-subtitle" }, `Đang bật ${enabledSources} nguồn dữ liệu & ${enabledIndicators} chỉ báo kỹ thuật`)
        ),
        e(
          "button",
          { className: "sdp-drawer-close-btn", onClick: onClose, type: "button" },
          "✕"
        )
      ),

      // Scrollable Body
      e(
        "div",
        { className: "sdp-drawer-body" },
        Object.entries(SOURCES_METADATA).map(([sourceId, meta]) => {
          const cfg = localConfig.sources[sourceId] || { enabled: false, lookback: meta.defaultLookback };
          const isEnabled = cfg.enabled;
          const lookbackDays = cfg.lookback ?? meta.defaultLookback;

          return e(
            "div",
            {
              key: sourceId,
              className: `sdp-drawer-source-card ${isEnabled ? "sdp-source-active" : ""}`,
            },
            e(
              "div",
              { className: "sdp-source-row-1" },
              e(
                "label",
                { className: "sdp-source-label" },
                e("input", {
                  type: "checkbox",
                  checked: isEnabled,
                  onChange: () => handleSourceToggle(sourceId),
                  className: "sdp-source-checkbox",
                }),
                e("span", null, meta.label)
              )
            ),

            // Optional Technical Indicators
            sourceId === "technical" &&
              isEnabled &&
              e(
                "div",
                { className: "sdp-indicators-pills" },
                TECHNICAL_INDICATORS.map((ind) => {
                  const isSelected = (localConfig.sources.technical?.indicators || []).includes(ind);
                  return e(
                    "button",
                    {
                      key: ind,
                      type: "button",
                      onClick: () => handleIndicatorToggle(ind),
                      className: `sdp-indicator-pill ${isSelected ? "sdp-pill-selected" : ""}`,
                    },
                    ind.toUpperCase()
                  );
                })
              ),

            // Lookback Slider
            e(
              "div",
              { className: `sdp-lookback-control ${!isEnabled ? "sdp-control-disabled" : ""}` },
              e("span", { className: "sdp-slider-bound" }, meta.min),
              e("input", {
                type: "range",
                min: meta.min,
                max: meta.max,
                value: lookbackDays,
                disabled: !isEnabled,
                onChange: (e) => handleLookbackChange(sourceId, e.target.value),
                className: "sdp-lookback-slider",
              }),
              e("span", { className: "sdp-slider-bound" }, meta.max),
              e(
                "div",
                { className: "sdp-lookback-input-box" },
                e("input", {
                  type: "number",
                  min: meta.min,
                  max: meta.max,
                  value: lookbackDays,
                  disabled: !isEnabled,
                  onChange: (e) => handleLookbackChange(sourceId, e.target.value),
                  className: "sdp-lookback-number-input",
                }),
                e("span", { className: "sdp-lookback-unit" }, " phiên")
              )
            )
          );
        })
      ),

      // Footer
      e(
        "div",
        { className: "sdp-drawer-footer" },
        e("span", { className: "sdp-drawer-footer-text" }, "Cấu hình được đồng bộ tự động và áp dụng cho lượt Làm mới tiếp theo."),
        e(
          "button",
          { className: "sdp-drawer-save-btn", onClick: onClose, type: "button" },
          "Đóng & Lưu"
        )
      )
    )
  );
}
