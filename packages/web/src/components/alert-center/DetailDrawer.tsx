import { useEffect, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";

interface DetailDrawerProps {
  activeAlertId: string | number;
  activeDetail: Record<string, unknown> | null;
  activeContext: Record<string, unknown> | null;
  appliedSymbol: string;
  onClose: () => void;
}

export function DetailDrawer(props: DetailDrawerProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  const { activeDetail, onClose } = props;

  useEffect(() => {
    if (activeDetail) {
      closeRef.current?.focus();
    }
  }, [activeDetail]);

  useEffect(() => {
    if (!activeDetail) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [activeDetail, onClose]);

  if (!props.activeDetail) return null;

  return (
    <div className={`${soc.drawerOverlay}`} onClick={props.onClose}>
      <aside
        className={`${soc.drawerContent}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={String(props.activeAlertId)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {t("alertCenter.detailTitle", { id: props.activeAlertId })}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={props.onClose}
            aria-label={t("alertCenter.close")}
            style={{
              background: "rgba(100,116,139,0.15)", border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-muted)", borderRadius: 8, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div className={`${soc.sectionCard}`} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            {t("alertCenter.detailContent")}
          </h4>
          <div className={`${soc.opsConfigFields}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t("alertCenter.detailTitle", { id: "" })}
              </span>
              <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
                {String(props.activeDetail?.title || t("alertCenter.detailNoTitle"))}
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t("alertCenter.detailSummary")}
              </span>
              <strong style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {String(props.activeDetail?.summary || props.activeDetail?.body || t("alertCenter.cardNoSummary"))}
              </strong>
            </div>
          </div>
        </div>

        {props.activeContext && (
          <div className={`${soc.sectionCard}`}>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              {t("alertCenter.detailContext", { symbol: String(props.activeContext.symbol || props.appliedSymbol) })}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>{t("alertCenter.detailTotal")}: <strong>{String((props.activeContext.total as number) || 0)}</strong></div>
              <div>{t("alertCenter.detailUnseen")}: <strong style={{ color: "var(--accent-amber)" }}>{String((props.activeContext.unseen as number) || 0)}</strong></div>
              <div>{t("alertCenter.detailAvgSeverity")}: <strong>{String(props.activeContext.average_severity || "medium")}</strong></div>
              <div>{t("alertCenter.detailThreshold")}: <strong>{String(props.activeContext.threshold_strategy || "default")}</strong></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
