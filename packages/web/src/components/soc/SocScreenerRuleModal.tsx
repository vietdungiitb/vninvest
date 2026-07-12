import { createElement, useState, ChangeEvent, MouseEvent } from "react";
import { useI18n } from "../../context/LangContext.js";

export interface SocScreenerRuleModalProps {
  mode: "create" | "edit";
  initial?: { id: string; name: string; type: string; enabled: boolean; threshold?: unknown; value?: unknown; };
  onConfirm: (rule: { name: string; type: string; enabled: boolean; threshold?: unknown; value?: unknown; }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

function SocScreenerRuleModal({ mode, initial, onConfirm, onCancel, loading }: SocScreenerRuleModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "price_change_pct");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [threshold, setThreshold] = useState<string>(initial?.threshold ? JSON.stringify(initial.threshold, null, 2) : "{}");
  const [value, setValue] = useState<string>(initial?.value ? JSON.stringify(initial.value, null, 2) : "{}");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) { newErrors.name = t("soc.screener.rule_name_required"); }
    let hasThresholdError = false; let hasValueError = false;
    try { JSON.parse(threshold); } catch { hasThresholdError = true; newErrors.threshold = t("soc.screener.invalid_json"); }
    try { JSON.parse(value); } catch { hasValueError = true; newErrors.value = t("soc.screener.invalid_json"); }
    setErrors(newErrors); setThresholdError(hasThresholdError ? t("soc.screener.invalid_json") : null); setValueError(hasValueError ? t("soc.screener.invalid_json") : null);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => { if (!validate()) return; await onConfirm({ name: name.trim(), type, enabled, threshold: JSON.parse(threshold), value: JSON.parse(value) }); };
  const handleCancel = () => { onCancel(); };

  const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" };
  const modalStyle = { background: "var(--bg-panel)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "1.5rem", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" };

  return createElement("div", { style: overlayStyle, onClick: handleCancel },
    createElement("div", { style: modalStyle, onClick: (e: MouseEvent) => e.stopPropagation() },
      createElement("h2", { style: { margin: 0, marginBottom: "1rem", color: "var(--text-primary)" } }, mode === "create" ? t("soc.screener.add_rule") : t("soc.screener.edit_rule")),
      createElement("div", { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
        createElement("div", null, createElement("label", { style: { display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" } }, t("soc.screener.rule_name")), createElement("input", { type: "text", value: name, onChange: (e: ChangeEvent<HTMLInputElement>) => setName(e.target.value), placeholder: t("soc.screener.rule_name_placeholder"), style: { width: "100%", padding: "0.5rem", background: "rgba(15,23,42,0.6)", border: errors.name ? "1px solid var(--accent-red)" : "1px solid var(--border-default)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" } }), errors.name && createElement("p", { style: { marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--accent-red)" } }, errors.name)),
        createElement("div", null, createElement("label", { style: { display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" } }, t("soc.screener.rule_type")), createElement("select", { value: type, onChange: (e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value), style: { width: "100%", padding: "0.5rem", background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" } }, [{value:"price_change_pct"},{value:"volume_spike_ratio"},{value:"cvd_threshold"},{value:"whale_count"},{value:"dark_pool_ratio"},{value:"rsi_level"},{value:"ma_cross"},{value:"bollinger_band_break"},{value:"custom"}].map((rt) => createElement("option", { key: rt.value, value: rt.value }, t(`soc.screener.rule_type.${rt.value}`))))),
        createElement("div", null, createElement("label", { style: { display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" } }, t("soc.screener.threshold_json")), createElement("textarea", { value: threshold, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => { setThreshold(e.target.value); setThresholdError(null); setErrors((prev) => { const n = { ...prev }; delete n.threshold; return n; }); }, rows: 4, className: "config-editor", style: { width: "100%", padding: "0.5rem", background: "rgba(15,23,42,0.6)", border: thresholdError ? "1px solid var(--accent-red)" : "1px solid var(--border-default)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.875rem", fontFamily: "monospace", resize: "vertical", outline: "none" } }), thresholdError && createElement("p", { style: { marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--accent-red)" } }, thresholdError)),
        createElement("div", null, createElement("label", { style: { display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" } }, t("soc.screener.value_json")), createElement("textarea", { value: value, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => { setValue(e.target.value); setValueError(null); setErrors((prev) => { const n = { ...prev }; delete n.value; return n; }); }, rows: 4, className: "config-editor", style: { width: "100%", padding: "0.5rem", background: "rgba(15,23,42,0.6)", border: valueError ? "1px solid var(--accent-red)" : "1px solid var(--border-default)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.875rem", fontFamily: "monospace", resize: "vertical", outline: "none" } }), valueError && createElement("p", { style: { marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--accent-red)" } }, valueError)),
        createElement("label", { style: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" } }, createElement("input", { type: "checkbox", checked: enabled, onChange: (e: ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked), style: { width: "1rem", height: "1rem", accentColor: "var(--accent-cyan)" } }), t("soc.screener.enabled")),
      ),
      createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" } },
        createElement("button", { onClick: handleCancel, disabled: loading, style: { background: "rgba(15,23,42,0.6)", color: "var(--text-secondary)", border: "1px solid var(--border-default)", padding: "0.5rem 1rem", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontSize: "0.875rem" } }, t("common.cancel")),
        createElement("button", { onClick: handleSubmit, disabled: loading, style: { background: "var(--accent-cyan)", color: "#fff", padding: "0.5rem 1rem", borderRadius: "8px", border: "none", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 } }, loading ? t("common.saving") : t("common.save")),
      ),
    )
  );
}

export { SocScreenerRuleModal };