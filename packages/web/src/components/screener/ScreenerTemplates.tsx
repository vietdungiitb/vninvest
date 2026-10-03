import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import type { ScreenerTemplate, ScreenerTemplateCategory } from "../../types/screener.d.ts";

interface ScreenerTemplatesProps {
  templates: ScreenerTemplate[];
  applyingId: string | null;
  savingId: string | null;
  onPreview: (template: ScreenerTemplate) => void;
  onSave: (template: ScreenerTemplate) => void;
}

const CATEGORY_COLORS: Record<ScreenerTemplateCategory, { bg: string; border: string; text: string }> = {
  technical: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.35)", text: "#fbbf24" },
  whale: { bg: "rgba(34,211,238,0.15)", border: "rgba(34,211,238,0.35)", text: "#22d3ee" },
  dark: { bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)", text: "#a78bfa" },
  fundamental: { bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.35)", text: "#4ade80" },
};

export function ScreenerTemplates({ templates, applyingId, savingId, onPreview, onSave }: ScreenerTemplatesProps) {
  const { t } = useI18n();

  if (!templates.length) return null;

  return createElement(
    "div",
    {
      style: {
        background: "var(--bg-panel, #0f172a)",
        border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      },
    },
    createElement(
      "h3",
      { style: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-secondary, #94a3b8)" } },
      t("screener.templates.title"),
    ),
    createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "12px",
        },
      },
      templates.map((tmpl) =>
        createElement(
          "div",
          {
            key: tmpl.id,
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "14px",
              background: "rgba(15,23,42,0.35)",
              border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
              borderRadius: "10px",
            },
          },
          createElement(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
            createElement(
              "span",
              {
                style: {
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  ...CATEGORY_COLORS[tmpl.category],
                },
              },
              t("screener.templates.category." + tmpl.category),
            ),
            createElement("span", { style: { fontSize: "11px", color: "var(--text-muted, #94a3b8)" } }, String(tmpl.rules_json.length)),
          ),
          createElement("p", { style: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #f1f5f9)" } }, t(tmpl.name_key)),
          createElement("p", { style: { margin: 0, fontSize: "12px", color: "var(--text-muted, #94a3b8)", lineHeight: 1.4, minHeight: "34px" } }, t(tmpl.desc_key)),
          createElement(
            "div",
            { style: { display: "flex", gap: "8px" } },
            createElement(
              "button",
              {
                type: "button",
                disabled: applyingId === tmpl.id || savingId === tmpl.id,
                onClick: () => onPreview(tmpl),
                style: {
                  flex: 1,
                  padding: "6px 12px",
                  background: applyingId === tmpl.id ? "rgba(34,211,238,0.3)" : "var(--accent-cyan, #06b6d4)",
                  color: "#fff",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: applyingId === tmpl.id ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  opacity: applyingId === tmpl.id ? 0.7 : 1,
                },
              },
              applyingId === tmpl.id ? t("screener.running") : t("screener.templates.preview"),
            ),
            createElement(
              "button",
              {
                type: "button",
                disabled: applyingId === tmpl.id || savingId === tmpl.id,
                onClick: () => onSave(tmpl),
                style: {
                  flex: 1,
                  padding: "6px 12px",
                  background: "rgba(15,23,42,0.6)",
                  border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                  color: "var(--text-primary, #f1f5f9)",
                  fontSize: "12px",
                  borderRadius: "6px",
                  cursor: savingId === tmpl.id ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  opacity: savingId === tmpl.id ? 0.7 : 1,
                },
              },
              savingId === tmpl.id ? t("screener.running") : t("screener.templates.saveAsRule"),
            ),
          ),
        ),
      ),
    ),
  );
}

export default ScreenerTemplates;
