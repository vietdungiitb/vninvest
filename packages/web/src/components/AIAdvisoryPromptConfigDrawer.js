import { createElement, useEffect, useState } from "react";
import { useI18n } from "../context/LangContext.js";
import styles from "./aiSettings.module.css";

const e = createElement;


const SOURCES_METADATA = {
  whale:       { defaultLookback: 30,  min: 1, max: 180, labelKey: "whale" },
  dark_flow:   { defaultLookback: 30,  min: 1, max: 180, labelKey: "darkFlow" },
  technical:   { defaultLookback: 20,  min: 1, max: 60,  labelKey: "technical" },
  news:        { defaultLookback: 14,  min: 1, max: 90,  labelKey: "news" },
  market:      { defaultLookback: 7,   min: 1, max: 30,  labelKey: "market" },
  fundamental: { defaultLookback: 90,  min: 1, max: 365, labelKey: "fundamental" },
  ownership:   { defaultLookback: 365, min: 1, max: 730, labelKey: "ownership" },
  sector:      { defaultLookback: 20,  min: 1, max: 90,  labelKey: "sector" },
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
  const { t } = useI18n();
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
    balanced: t("promptConfig.presets.balanced"),
    flow_first: t("promptConfig.presets.flowFirst"),
    deep_dive: t("promptConfig.presets.deepDive"),
    cost_control: t("promptConfig.presets.costControl"),
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
    { className: styles.drawerOverlay, onClick: onClose },
    e(
      "div",
      { className: styles.drawerContent, onClick: (e) => e.stopPropagation() },

      // Header
      e(
        "div",
        { className: styles.drawerHeader },
        e(
          "div",
          null,
          e("h2", { className: styles.drawerTitle }, t("promptConfig.title")),
          e("p", { className: styles.drawerSubtitle }, (t("promptConfig.subtitle")).replace("{sources}", enabledSources).replace("{indicators}", enabledIndicators))
        ),
        e(
          "button",
          { className: styles.drawerClose, onClick: onClose, type: "button" },
          "✕"
        )
      ),

      // Preset Bar
      e("div", { key: "preset-bar", className: styles.presetBar },
        e("span", { className: styles.presetLabel }, t("promptConfig.presetLabel")),
        Object.entries(PRESET_LABELS).map(([id, label]) =>
          e("button", {
            key: id,
            type: "button",
            onClick: () => applyPreset(id),
            className: styles.presetBtn,
          }, label)
        )
      ),

      // Scrollable Body
      e(
        "div",
        { className: styles.drawerBody },
        Object.entries(SOURCES_METADATA).map(([sourceId, meta]) => {
          const cfg = localConfig.sources[sourceId] || { enabled: false, lookback: meta.defaultLookback };
          const isEnabled = cfg.enabled;
          const lookbackDays = cfg.lookback ?? meta.defaultLookback;

          return e(
            "div",
            {
              key: sourceId,
              className: `${styles.sourceCard} ${isEnabled ? styles.sourceCardActive : ""}`,
            },
            e(
              "div",
              { className: styles.sourceRow },
              e(
                "label",
                { className: styles.sourceLabel },
                e("input", {
                  type: "checkbox",
                  checked: isEnabled,
                  onChange: () => handleSourceToggle(sourceId),
                  className: styles.checkbox,
                }),
                e("span", null, t(`promptConfig.sources.${meta.labelKey}`, { defaultValue: meta.labelKey }))
              )
            ),

            // Optional Technical Indicators
            sourceId === "technical" &&
              isEnabled &&
              e(
                "div",
                { className: styles.indicatorsSection },
                e(
                  "div",
                  { className: styles.indicatorPresets },
                  e("button", { type: "button", onClick: () => handleTechnicalPreset('full'), className: styles.indicatorPresetBtn }, t("promptConfig.enableAll")),
                  e("button", { type: "button", onClick: () => handleTechnicalPreset('lean'), className: styles.indicatorPresetBtn }, t("promptConfig.leanSet"))
                ),
                e(
                  "div",
                  { className: styles.indicatorsPills },
                  TECHNICAL_INDICATORS.map((ind) => {
                    const isSelected = (localConfig.sources.technical?.indicators || []).includes(ind);
                    return e(
                      "button",
                      {
                        key: ind,
                        type: "button",
                        onClick: () => handleIndicatorToggle(ind),
                        className: `${styles.indicatorPill} ${isSelected ? styles.indicatorPillActive : ""}`,
                      },
                      ind.toUpperCase()
                    );
                  })
                )
              ),

            // Lookback Slider
            e(
              "div",
              { className: `${styles.lookbackControl} ${!isEnabled ? styles.lookbackControlDisabled : ""}` },
              e("span", { className: styles.sliderBound }, meta.min),
              e("input", {
                type: "range",
                min: meta.min,
                max: meta.max,
                value: lookbackDays,
                disabled: !isEnabled,
                onChange: (e) => handleLookbackChange(sourceId, e.target.value),
                className: styles.slider,
              }),
              e("span", { className: styles.sliderBound }, meta.max),
              e(
                "div",
                { className: styles.lookbackInputBox },
                e("input", {
                  type: "number",
                  min: meta.min,
                  max: meta.max,
                  value: lookbackDays,
                  disabled: !isEnabled,
                  onChange: (e) => handleLookbackChange(sourceId, e.target.value),
                  className: styles.numberInput,
                }),
                e("span", { className: styles.lookbackUnit }, ` ${t("promptConfig.lookbackUnit")}`)
              ),
              e(
                "select",
                {
                  disabled: !isEnabled,
                  onChange: (e) => handleLookbackQuickSelect(sourceId, e.target.value),
                  value: lookbackDays,
                  className: styles.quickSelect,
                },
                LOOKBACK_OPTIONS.filter(opt => opt >= meta.min && opt <= meta.max).map(opt =>
                  e("option", { key: opt, value: opt }, `${opt} ${t("promptConfig.lookbackUnit")}`)
                )
              )
            )
          );
        })
      ),

      // Footer
      e(
        "div",
        { className: styles.drawerFooter },
        e("span", { className: styles.drawerFooterText }, t("aiCommandCenter.promptDrawerFooter")),
        e(
          "button",
          { className: `${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`, onClick: onClose, type: "button" },
          t("promptConfig.close")
        )
      )
    )
  );
}
