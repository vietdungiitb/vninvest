import { memo } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";
import soc from "../soc/soc.module.css";

interface AlertItem {
  alert_id: string | number;
  symbol?: string;
  title?: string;
  body?: string;
  summary?: string;
  severity?: string;
  direction?: string;
  value?: unknown;
  confidence?: number;
  freshness_state?: string;
  session_date?: string;
  triggered_at?: string;
  executed_at?: string;
  alert_family?: string;
  alert_type?: string;
  evidence?: Record<string, unknown>;
  acknowledged?: boolean;
  muted?: boolean;
  _optimistic?: boolean;
  lane?: string;
  [key: string]: unknown;
}

interface AlertCardProps {
  alert: AlertItem;
  lane: string;
  busyAlertId: string | number;
  isEvidenceExpanded: boolean;
  toggleEvidence: (id: string) => void;
  handleLoadDetail: (alert: AlertItem) => void;
  handleAcknowledge: (alert: AlertItem) => void;
  handleMuteSymbol: (alert: AlertItem) => void;
  formatAlertValue: (val: unknown) => string;
  formatAlertTimestamp: (val: unknown) => string;
  style?: React.CSSProperties;
}

const SEVERITY_TO_SOC: Record<string, string> = {
  critical: soc.statusBadgeDanger,
  high: soc.statusBadgeWarning,
  medium: soc.statusBadgeInfo,
  low: "",
};

function getDirectionClass(dir: string): string {
  const d = String(dir || "").toLowerCase();
  if (d.includes("buy") || d === "mua") return soc.signalLabelBuy;
  if (d.includes("sell") || d === "bán") return soc.signalLabelSell;
  return soc.signalLabelNeutral;
}

function renderEvidenceList(evidence: Record<string, unknown>, t: (key: string) => string) {
  const entries = Object.entries(evidence || {}).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) {
    return (
      <ul className={styles.acEvidenceList}>
        <li>{t("alertCenter.evidenceEmpty")}</li>
      </ul>
    );
  }
  return (
    <ul className={styles.acEvidenceList}>
      {entries.map(([key, value]) => (
        <li key={key}>{key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}</li>
      ))}
    </ul>
  );
}

export const AlertCard = memo(function AlertCard(props: AlertCardProps) {
  const { t } = useI18n();
  const { alert, lane, busyAlertId, isEvidenceExpanded, toggleEvidence, handleLoadDetail, handleAcknowledge, handleMuteSymbol, formatAlertValue, formatAlertTimestamp, style } = props;

  const severity = alert.severity || "medium";
  const severityCap = severity.charAt(0).toUpperCase() + severity.slice(1);
  const borderClass = styles[`acCard${severityCap}` as keyof typeof styles] || styles.acCardMedium;
  const severityBadgeClass = SEVERITY_TO_SOC[severity] || "";
  const directionClass = getDirectionClass(alert.direction || "");

  return (
    <article className={`${soc.feedCard} ${soc.signalRow} ${String(borderClass)}`.trim()} style={style}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
          <div className={`${soc.signalIcon} ${severityBadgeClass || soc.statusBadgeInfo}`}>
            {severity === "critical" ? "⚠" : severity === "high" ? "⚡" : "ℹ"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span className={`${soc.signalSymbol}`}>{alert.symbol || "—"}</span>
              <span className={`${soc.statusBadge} ${severityBadgeClass || ""}`.trim()}>
                {t(`alertCenter.sev${severityCap}` as any)}
              </span>
              <span className={`${soc.statusBadge} ${soc.statusBadgeInfo}`}>
                {alert.freshness_state || "—"}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
              {alert.title || t("alertCenter.cardTitle")}
            </h3>
            <div className={`${soc.signalMeta}`}>
              {alert.alert_family || alert.alert_type || "—"} · Lane: {alert.lane || lane}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className={`${soc.signalVolume}`}>
            {formatAlertValue(alert.value)} VND
          </div>
          <div className={`${soc.signalLabel} ${directionClass}`.trim()}>
            {alert.direction || "—"}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", margin: "8px 0" }}>
        {alert.summary || alert.body || t("alertCenter.cardNoSummary")}
      </p>

      {alert._optimistic && (
        <span className={`${soc.statusBadge} ${soc.statusBadgeWarning}`} style={{ marginBottom: 8 }}>
          {alert.acknowledged ? t("alertCenter.pendingAck") : t("alertCenter.pendingMute")}
        </span>
      )}

      <div className={`${soc.signalMeta}`} style={{ marginBottom: 10 }}>
        <span><strong>{t("alertCenter.labelValue")}:</strong> {formatAlertValue(alert.value)} VND</span>
        <span><strong>{t("alertCenter.labelDirection")}:</strong> <span className={directionClass}>{alert.direction || "—"}</span></span>
        <span><strong>{t("alertCenter.labelConfidence")}:</strong> {alert.confidence != null ? `${alert.confidence}` : "—"}</span>
        <span><strong>{t("alertCenter.labelFreshness")}:</strong> {alert.freshness_state || "—"}</span>
        <span><strong>{t("alertCenter.labelSession")}:</strong> {alert.session_date || "—"}</span>
        <span><strong>{alert.executed_at ? t("alertCenter.labelExecuted") : t("alertCenter.labelTime")}:</strong> {alert.executed_at ? formatAlertTimestamp(alert.executed_at) : formatAlertTimestamp(alert.triggered_at)}</span>
      </div>

      {alert.evidence && Object.keys(alert.evidence).length > 0 && (
        <div className={`${soc.accordion}`} style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`${soc.accordionHeader}`}
            onClick={() => toggleEvidence(String(alert.alert_id))}
          >
            <span>{t("alertCenter.evidenceView")}</span>
            <span>{isEvidenceExpanded ? "▼" : "▶"}</span>
          </button>
          {isEvidenceExpanded && renderEvidenceList(alert.evidence, t)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnActive}`}
          disabled={busyAlertId === alert.alert_id}
          onClick={() => handleLoadDetail(alert)}
        >
          {busyAlertId === alert.alert_id ? t("alertCenter.btnDetailLoading") : t("alertCenter.btnDetail")}
        </button>
        {lane === "main" && (
          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            disabled={busyAlertId === alert.alert_id}
            onClick={() => handleAcknowledge(alert)}
          >
            {t("alertCenter.btnAck")}
          </button>
        )}
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
          disabled={busyAlertId === (alert.alert_id || alert.symbol)}
          onClick={() => handleMuteSymbol(alert)}
        >
          {t("alertCenter.btnMute")}
        </button>
      </div>
    </article>
  );
});
