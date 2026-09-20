import { createElement, useState, useEffect } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface SocScreenerConfigFormProps {
  initialConfig: {
    scan_interval_seconds?: number;
    max_symbols_per_scan?: number;
    alert_cooldown_seconds?: number;
    max_alerts_per_symbol_per_hour?: number;
    result_retention_hours?: number;
    // SC-05: the panel passes the normalized envelope `{...payload, config,
    // config_payload}` — real fields live under `config_payload` (alias `config`).
    config_payload?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };
  onSave: (config: {
    scan_interval_seconds?: number;
    max_symbols_per_scan?: number;
    alert_cooldown_seconds?: number;
    max_alerts_per_symbol_per_hour?: number;
    result_retention_hours?: number;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * SC-05: resolve the editable config source. The panel passes the normalized
 * envelope `{...payload, config, config_payload}` where the real fields live
 * under `config_payload` (alias `config`); a flat payload is used as-is.
 */
export function resolveScreenerConfigSource(initialConfig: unknown): Record<string, unknown> {
  const env = (initialConfig ?? {}) as Record<string, unknown>;
  const nested = (env.config_payload ?? env.config) as unknown;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  return env;
}

function SocScreenerConfigForm(props: SocScreenerConfigFormProps) {
  const { t } = useI18n();
  const { initialConfig, onSave, onCancel, loading = false } = props;
  const source = resolveScreenerConfigSource(initialConfig);

  const [config, setConfig] = useState({
    scan_interval_seconds: (source.scan_interval_seconds as number | undefined) ?? 60,
    max_symbols_per_scan: (source.max_symbols_per_scan as number | undefined) ?? 2000,
    alert_cooldown_seconds: (source.alert_cooldown_seconds as number | undefined) ?? 300,
    max_alerts_per_symbol_per_hour: (source.max_alerts_per_symbol_per_hour as number | undefined) ?? 5,
    result_retention_hours: (source.result_retention_hours as number | undefined) ?? 24,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const next = resolveScreenerConfigSource(initialConfig);
    setConfig({
      scan_interval_seconds: (next.scan_interval_seconds as number | undefined) ?? 60,
      max_symbols_per_scan: (next.max_symbols_per_scan as number | undefined) ?? 2000,
      alert_cooldown_seconds: (next.alert_cooldown_seconds as number | undefined) ?? 300,
      max_alerts_per_symbol_per_hour: (next.max_alerts_per_symbol_per_hour as number | undefined) ?? 5,
      result_retention_hours: (next.result_retention_hours as number | undefined) ?? 24,
    });
  }, [initialConfig]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (config.scan_interval_seconds < 10) {
      newErrors.scan_interval_seconds = t("soc.screener.config.scan_interval_min", { min: 10 });
    }
    if (config.max_symbols_per_scan < 1 || config.max_symbols_per_scan > 5000) {
      newErrors.max_symbols_per_scan = t("soc.screener.config.max_symbols_range", { min: 1, max: 5000 });
    }
    if (config.alert_cooldown_seconds < 60) {
      newErrors.alert_cooldown_seconds = t("soc.screener.config.alert_cooldown_min", { min: 60 });
    }
    if (config.max_alerts_per_symbol_per_hour < 1) {
      newErrors.max_alerts_per_symbol_per_hour = t("soc.screener.config.alerts_per_symbol_min", { min: 1 });
    }
    if (config.result_retention_hours < 1) {
      newErrors.result_retention_hours = t("soc.screener.config.retention_min", { min: 1 });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave(config);
  };

  const handleReset = () => {
    setConfig({
      scan_interval_seconds: 60,
      max_symbols_per_scan: 2000,
      alert_cooldown_seconds: 300,
      max_alerts_per_symbol_per_hour: 5,
      result_retention_hours: 24,
    });
    setErrors({});
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem",
    background: "rgba(15,23,42,0.6)",
    border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
    borderRadius: "6px",
    color: "var(--text-primary, #f1f5f9)",
    fontSize: "0.875rem",
    outline: "none",
  };

  const field = (key: keyof typeof config, label: string, min?: number, max?: number) =>
    createElement("div", { },
      createElement("label", { }, label),
      createElement("input", {
        type: "number",
        value: config[key],
        onChange: (e) => setConfig((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) || (min ?? 0) })),
        min: min,
        max: max,
        style: { ...inputStyle, borderColor: errors[key as string] ? "var(--accent-red)" : "var(--border-default, rgba(80, 120, 168, 0.28))" },
      }),
      errors[key as string] && createElement("p", { }, errors[key as string])
    );

  return createElement("div", null,
    createElement("div", { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.config_title")),
      createElement("div", { },
        field("scan_interval_seconds", t("soc.screener.config.scan_interval"), 10),
        field("max_symbols_per_scan", t("soc.screener.config.max_symbols"), 1, 5000),
        field("alert_cooldown_seconds", t("soc.screener.config.alert_cooldown"), 60),
        field("max_alerts_per_symbol_per_hour", t("soc.screener.config.max_alerts_per_symbol"), 1),
        field("result_retention_hours", t("soc.screener.config.retention_hours"), 1),
      ),
    ),
    createElement("details", { className: styles.sectionCard,  },
      createElement("summary", { },
        t("soc.screener.config.advanced")
      ),
      createElement("div", { className: styles.configEditor,  },
        JSON.stringify(resolveScreenerConfigSource(props.initialConfig), null, 2)
      ),
    ),
    createElement("div", { },
      createElement("button", {
        onClick: handleReset,
        className: styles.actionBtn,
        
      },
      t("soc.screener.config.reset")
      ),
      createElement("button", {
        onClick: onCancel,
        className: styles.actionBtn,
        
      },
      t("common.cancel")
      ),
      createElement("button", {
        onClick: handleSave,
        disabled: loading,
        className: styles.actionBtn,
        
      },
      loading ? t("common.saving") : t("common.save")
      ),
    ),
  );
}

export { SocScreenerConfigForm };