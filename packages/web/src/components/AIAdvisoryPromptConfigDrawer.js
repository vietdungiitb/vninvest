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

const DEFAULT_CONFIG = {
  version: 2,
  sources: {
    whale: { enabled: true, lookback: 30 },
    dark_flow: { enabled: true, lookback: 30 },
    technical: { enabled: true, lookback: 20, indicators: ['vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot'] },
    news: { enabled: true, lookback: 14 },
    market: { enabled: true, lookback: 7 },
    fundamental: { enabled: false, lookback: 1 },
    ownership: { enabled: false, lookback: 365 },
    sector: { enabled: false, lookback: 60 },
  },
};

export function AIAdvisoryPromptConfigDrawer({ isOpen, onClose, config, onConfigChange }) {
  const mergedConfig = config ? { ...DEFAULT_CONFIG, ...config, sources: { ...DEFAULT_CONFIG.sources, ...(config.sources || {}) } } : DEFAULT_CONFIG;
  const [localConfig, setLocalConfig] = useState(mergedConfig);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        ...DEFAULT_CONFIG,
        ...config,
        sources: { ...DEFAULT_CONFIG.sources, ...(config.sources || {}) },
      });
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

  const     enabledIndicators = (localConfig.sources.technical?.indicators || []).length;

  const PRESET_CONFIGS = {
    balanced: {
      sources: {
        whale: { enabled: true, lookback: 180 },
        dark_flow: { enabled: true, lookback: 90 },
        technical: { enabled: true, lookback: 30, indicators: ['vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot'] },
        news: { enabled: true, lookback: 14 },
        market: { enabled: true, lookback: 7 },
        fundamental: { enabled: false, lookback: 1 },
        ownership: { enabled: false, lookback: 365 },
        sector: { enabled: false, lookback: 60 },
      },
    },
    flow_first: {
      sources: {
        whale: { enabled: true, lookback: 30 },
        dark_flow: { enabled: true, lookback: 30 },
        technical: { enabled: true, lookback: 5, indicators: ['vols', 'prices'] },
        news: { enabled: false, lookback: 14 },
        market: { enabled: true, lookback: 7 },
        fundamental: { enabled: false, lookback: 90 },
        ownership: { enabled: false, lookback: 365 },
        sector: { enabled: false, lookback: 60 },
      },
    },
    deep_dive: {
      sources: {
        whale: { enabled: true, lookback: 180 },
        dark_flow: { enabled: true, lookback: 180 },
        technical: { enabled: true, lookback: 60, indicators: ['vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot'] },
        news: { enabled: true, lookback: 30 },
        market: { enabled: true, lookback: 30 },
        fundamental: { enabled: true, lookback: 365 },
        ownership: { enabled: true, lookback: 730 },
        sector: { enabled: true, lookback: 90 },
      },
    },
    cost_control: {
      sources: {
        whale: { enabled: true, lookback: 7 },
        dark_flow: { enabled: false, lookback: 30 },
        technical: { enabled: true, lookback: 5, indicators: ['vols', 'prices'] },
        news: { enabled: false, lookback: 7 },
        market: { enabled: false, lookback: 7 },
        fundamental: { enabled: false, lookback: 1 },
        ownership: { enabled: false, lookback: 365 },
        sector: { enabled: false, lookback: 60 },
      },
    },
  };

  const PRESET_LABELS = {
    balanced: 'Cân bằng',
    flow_first: 'Ưu tiên dòng tiền',
    deep_dive: 'Chuyên sâu',
    cost_control: 'Tiết kiệm token',
  };

  const LOOKBACK_OPTIONS = [7, 14, 30, 60, 90, 180, 365, 730];

  const applyPreset = (presetId) => {
    const presetConfig = PRESET_CONFIGS[presetId];
    if (!presetConfig) return;
    setLocalConfig(presetConfig);
    onConfigChange(presetConfig);
  };

  const handleTechnicalPreset = (mode) => {
    const ALL_INDICATORS = ['vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot'];
    const LEAN_INDICATORS = ['vols', 'prices', 'rsi'];
    const indicators = mode === 'full' ? ALL_INDICATORS : LEAN_INDICATORS;
    const techObj = localConfig.sources.technical || { enabled: true, lookback: 20 };
    const updated = {
      ...localConfig,
      sources: {
        ...localConfig.sources,
        technical: { ...techObj, indicators },
      },
    };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  const handleLookbackQuickSelect = (sourceId, value) => {
    const meta = SOURCES_METADATA[sourceId];
    if (!meta) return;
    const clamped = Math.max(meta.min, Math.min(meta.max, Number(value) || meta.defaultLookback));
    handleLookbackChange(sourceId, clamped);
  };

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

      // Preset Bar
      e("div", { key: "preset-bar", className: "sdp-preset-bar" },
        e("span", { className: "sdp-preset-label" }, "Mẫu cấu hình nhanh:"),
        Object.entries(PRESET_LABELS).map(([id, label]) =>
          e("button", {
            key: id,
            type: "button",
            onClick: () => applyPreset(id),
            className: "sdp-preset-btn",
          }, label)
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
                { className: "sdp-indicators-section" },
                e(
                  "div",
                  { className: "sdp-indicators-presets" },
                  e("button", { type: "button", onClick: () => handleTechnicalPreset('full'), className: "sdp-indicator-preset-btn" }, "Bật toàn bộ"),
                  e("button", { type: "button", onClick: () => handleTechnicalPreset('lean'), className: "sdp-indicator-preset-btn" }, "Bộ gọn")
                ),
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
                )
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
              ),
              e(
                "select",
                {
                  disabled: !isEnabled,
                  onChange: (e) => handleLookbackQuickSelect(sourceId, e.target.value),
                  value: lookbackDays,
                  className: "sdp-lookback-quick-select",
                },
                LOOKBACK_OPTIONS.filter(opt => opt >= meta.min && opt <= meta.max).map(opt =>
                  e("option", { key: opt, value: opt }, `${opt} phiên`)
                )
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
