import { createElement, useCallback, ChangeEvent } from "react";
import { useI18n } from "../../context/LangContext.js";
import type { ScreenerCondition } from "../../types/screener.d.ts";
import { SCREENER_FIELD_GROUPS, OP_OPTIONS, LOGIC_OPTIONS } from "../../types/screener.ts";
import { getFieldSpec } from "./screenerValidation.js";

interface ScreenerFilterBuilderProps {
  conditions: ScreenerCondition[];
  onChange: (conditions: ScreenerCondition[]) => void;
  maxConditions?: number;
}

export function ScreenerFilterBuilder({ conditions, onChange, maxConditions = 20 }: ScreenerFilterBuilderProps) {
  const { t } = useI18n();

  const updateCondition = useCallback((index: number, field: string, value: string | number) => {
    onChange(conditions.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }, [conditions, onChange]);

  const addCondition = useCallback(() => {
    if (conditions.length >= maxConditions) return;
    onChange([...conditions, { field: "rsi_14", op: "lt", value: 30, logic: "AND" }]);
  }, [conditions, onChange, maxConditions]);

  const removeCondition = useCallback((index: number) => {
    if (conditions.length <= 1) return;
    onChange(conditions.filter((_, i) => i !== index));
  }, [conditions, onChange]);

  // P0.3 (F4): picker checkboxes really add/remove conditions (R3.3).
  const togglePickerField = useCallback((fieldKey: string) => {
    const idx = conditions.findIndex((c) => c.field === fieldKey);
    if (idx >= 0) {
      if (conditions.length <= 1) return;
      onChange(conditions.filter((_, i) => i !== idx));
      return;
    }
    if (conditions.length >= maxConditions) return;
    const spec = getFieldSpec(fieldKey);
    onChange([...conditions, {
      field: fieldKey,
      op: spec?.defaultOp ?? "gt",
      value: spec?.defaultValue ?? 0,
      logic: "AND" }]);
  }, [conditions, onChange, maxConditions]);

  const renderCondition = (cond: ScreenerCondition, index: number) => {
    
    return createElement(
      "div",
      { 
        key: index, 
        style: { 
          display: "flex", 
          alignItems: "center", 
          gap: "8px", 
          flexWrap: "wrap",
          padding: "8px",
          background: "rgba(15,23,42,0.3)",
          borderRadius: "8px",
          border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" }
      },
      index > 0 && createElement(
        "select",
        {
          value: cond.logic || "AND",
          onChange: (e: ChangeEvent<HTMLSelectElement>) => updateCondition(index, "logic", e.target.value),
          style: {
            padding: "4px 8px",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
            borderRadius: "4px",
            color: "var(--text-primary, #f1f5f9)",
            fontSize: "12px",
            minWidth: "70px" }
        },
        LOGIC_OPTIONS.map((o) => createElement("option", { key: o.value, value: o.value }, t("screener.logic." + o.value)))
      ),
      index === 0 && createElement("span", { style: { width: "70px", color: "var(--text-muted, #94a3b8)", fontSize: "12px" } }, "\u2014"),
      createElement(
        "select",
        {
          value: cond.field,
          onChange: (e: ChangeEvent<HTMLSelectElement>) => updateCondition(index, "field", e.target.value),
          style: {
            padding: "4px 8px",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
            borderRadius: "4px",
            color: "var(--text-primary, #f1f5f9)",
            fontSize: "12px",
            minWidth: "180px" }
        },
        Object.entries(SCREENER_FIELD_GROUPS).flatMap(([groupKey, group]) =>
          createElement("optgroup", { key: groupKey, label: t("screener.group." + groupKey) },
            Object.entries(group.fields).map(([fieldKey, field]) =>
              createElement("option", { key: fieldKey, value: fieldKey }, t("screener.fields." + field.key))
            )
          )
        )
      ),
      createElement(
        "select",
        {
          value: cond.op,
          onChange: (e: ChangeEvent<HTMLSelectElement>) => updateCondition(index, "op", e.target.value),
          style: {
            padding: "4px 8px",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
            borderRadius: "4px",
            color: "var(--text-primary, #f1f5f9)",
            fontSize: "12px",
            minWidth: "60px" }
        },
        OP_OPTIONS.map((o) => createElement("option", { key: o.value, value: o.value }, o.label))
      ),
      createElement(
        "input",
        {
          type: "number",
          step: "any",
          value: cond.value,
          // P0.3: keep "" when cleared so save-time valueRequired fires (R3.1)
          onChange: (e: ChangeEvent<HTMLInputElement>) => updateCondition(index, "value", e.target.value === "" ? "" : Number(e.target.value)),
          placeholder: t("screener.valuePlaceholder"),
          style: {
            width: "100px",
            padding: "4px 8px",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
            borderRadius: "4px",
            color: "var(--text-primary, #f1f5f9)",
            fontSize: "12px" }
        }
      ),
      conditions.length > 1 && createElement(
        "button",
        {
          onClick: () => removeCondition(index),
          style: {
            padding: "4px 8px",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px" }
        },
        "\u2715"
      )
    );
  };

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "16px" } },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
      createElement("h3", { style: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-secondary, #94a3b8)" } }, t("screener.conditionsLabel")),
      conditions.length < 20 && createElement(
        "button",
        {
          onClick: addCondition,
          style: {
            padding: "6px 12px",
            background: "var(--accent-cyan, #06b6d4)",
            color: "#fff",
            fontSize: "12px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontWeight: 500 }
        },
        t("screener.addCondition")
      )
    ),
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      conditions.map(renderCondition)
    ),
    createElement(
      "details",
      { style: { marginTop: "16px", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "8px", background: "rgba(15,23,42,0.3)" } },
      createElement("summary", { style: { padding: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "var(--accent-cyan, #06b6d4)" } },
        t("screener.fieldPicker")
      ),
      createElement("div", { style: { padding: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" } },
        Object.entries(SCREENER_FIELD_GROUPS).map(([groupKey, group]) =>
          createElement("div", { key: groupKey, style: { display: "flex", flexDirection: "column", gap: "8px" } },
            createElement("h4", { style: { margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--accent-amber)" } },
              t("screener.group." + groupKey)
            ),
            Object.entries(group.fields).map(([fieldKey, field]) =>
              createElement("label", { key: fieldKey, style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary, #94a3b8)", cursor: "pointer" } },
                createElement("input", {
                  type: "checkbox",
                  checked: conditions.some(c => c.field === fieldKey),
                  onChange: () => togglePickerField(fieldKey),
                  style: { width: "16px", height: "16px", accentColor: "var(--accent-cyan, #06b6d4)" } }),
                t("screener.fields." + field.key)
              )
            )
          )
        )
      )
    )
  );
}

export default ScreenerFilterBuilder;