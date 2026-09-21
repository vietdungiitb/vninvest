import { useEffect, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";
import { formatDateTimeICT, formatSessionDate, formatVnd } from "../../utils/alertCenterFormat.js";

interface DetailDrawerProps {
  activeAlertId: string | number;
  activeDetail: Record<string, unknown> | null;
  activeContext: Record<string, unknown> | null;
  appliedSymbol: string;
  seen?: boolean;
  onClose: () => void;
}

function fmtDetailValue(v: unknown): string {
  if (v == null || v === "") return "—";
  return formatVnd(v);
}

function fmtDetailTime(v: unknown): string {
  if (!v) return "—";
  return formatDateTimeICT(v);
}

export function DetailDrawer(props: DetailDrawerProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  const { activeDetail, onClose } = props;
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (activeDetail) {
      closeRef.current?.focus();
    }
  }, [activeDetail]);

  useEffect(() => {
    if (!activeDetail) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [activeDetail, onClose]);

  if (!props.activeDetail) return null;

  return (
    <div className={`${soc.drawerOverlay}`} onClick={props.onClose}>
      <aside
        ref={drawerRef as any}
        className={`${soc.drawerContent}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-center-detail-title"
        aria-label={String(props.activeAlertId)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 id="alert-center-detail-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {t("alertCenter.detailTitle", { id: props.activeAlertId })}
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {props.seen && (
            <span className={`${soc.statusBadge} ${soc.statusBadgeInfo}`}>
              {t("alertCenter.seenBadge")}
            </span>
          )}
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
          <div className={`${soc.sectionCard}`} style={{ marginBottom: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              {t("alertCenter.detailForensics")}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <div>{t("alertCenter.detailSeverity")}: <strong>{String(props.activeDetail?.severity || "—")}</strong></div>
              <div>{t("alertCenter.detailConfidence")}: <strong>{props.activeDetail?.confidence != null ? `${Math.round(Number(props.activeDetail.confidence) * 100)}%` : "—"}</strong></div>
              <div>{t("alertCenter.detailValue")}: <strong>{fmtDetailValue(props.activeDetail?.value)}</strong></div>
              {(props.activeDetail as any)?.whale_detail?.price != null && (
                <div>{t("alertCenter.detailPrice")}: <strong>{formatVnd((props.activeDetail as any).whale_detail.price)} VND</strong></div>
              )}
              {(props.activeDetail as any)?.whale_detail?.volume != null && (
                <div>{t("alertCenter.detailVolume")}: <strong>{formatVnd((props.activeDetail as any).whale_detail.volume)}</strong></div>
              )}
              <div>{t("alertCenter.detailDirection")}: <strong>{String(props.activeDetail?.direction || "—")}</strong></div>
              <div>{t("alertCenter.labelSession")}: <strong>{formatSessionDate(props.activeDetail?.session_date)}</strong></div>
              <div>{t("alertCenter.detailTriggered")}: <strong>{fmtDetailTime(props.activeDetail?.triggered_at)}</strong></div>
              <div>{t("alertCenter.detailSourceRef")}: <strong style={{ wordBreak: "break-all" }}>{String(props.activeDetail?.source_ref || "—")}</strong></div>
              {props.activeDetail?.executed_at != null && String(props.activeDetail.executed_at) !== "" && (
                <div>{t("alertCenter.labelExecuted")}: <strong>{fmtDetailTime(props.activeDetail.executed_at)}</strong></div>
              )}
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  {t("alertCenter.detailEvidence")}
                </span>
                <pre style={{ margin: "4px 0 0", padding: 8, fontSize: 11, overflow: "auto", background: "rgba(2,11,35,0.3)", borderRadius: 8 }}>
                  {JSON.stringify(props.activeDetail?.evidence ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  {t("alertCenter.detailMetadata")}
                </span>
                <pre style={{ margin: "4px 0 0", padding: 8, fontSize: 11, overflow: "auto", background: "rgba(2,11,35,0.3)", borderRadius: 8 }}>
                  {JSON.stringify(props.activeDetail?.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {props.activeContext && (
          <div className={`${soc.sectionCard}`}>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              {t("alertCenter.detailContext", { symbol: String(props.activeContext.symbol || props.appliedSymbol) })}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>{t("alertCenter.detailTotal")}: <strong>{String((props.activeContext.total as number) || 0)}</strong></div>
              <div>{t("alertCenter.detailUnseen")}: <strong style={{ color: "var(--accent-amber)" }}>{String((props.activeContext.unseen as number) || 0)}</strong></div>
              <div>{t((props.activeContext.in_delivery_scope ? "alertCenter.detailInScope" : "alertCenter.detailNotInScope") as any)}</div>
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  {t("alertCenter.detailRecentEvents")}
                </span>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                  {((props.activeContext.recent_events as any[]) || []).slice(0, 5).map((ev: any) => (
                    <li key={String(ev.alert_id || ev.event_id || ev.symbol)}>
                      {String(ev.symbol || "")} {String(ev.severity || "")} {ev.triggered_at ? formatDateTimeICT(ev.triggered_at) : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
