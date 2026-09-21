import { memo, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";
import soc from "../soc/soc.module.css";
import {
  formatSessionDate,
  formatVnd,
  isDuplicateSummary,
} from "../../utils/alertCenterFormat.js";

interface WhaleDetail {
  price?: unknown;
  volume?: unknown;
  matched_value?: unknown;
  side?: string;
  executed_at?: string;
  [key: string]: unknown;
}

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
  whale_detail?: WhaleDetail | null;
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
  handleMuteRequest?: (alert: AlertItem) => void;
  formatAlertValue: (val: unknown) => string;
  formatAlertTimestamp: (val: unknown) => string;
  style?: React.CSSProperties;
  index?: number;
  onHeight?: (index: number, height: number) => void;
}

const FAMILY_LABELS: Record<string, string> = {
  whale: "alertCenter.famWhale",
  dark_flow: "alertCenter.famDarkFlow",
  price_shock: "alertCenter.famPriceShock",
  signal: "alertCenter.famSignal",
  system: "alertCenter.famSystem",
  ai_suggest: "alertCenter.famAiSuggest",
};

const FAMILY_EN_LABELS: Record<string, string> = {
  whale: "alertCenter.famWhaleEn",
  dark_flow: "alertCenter.famDarkFlowEn",
  price_shock: "alertCenter.famPriceShockEn",
  signal: "alertCenter.famSignalEn",
  system: "alertCenter.famSystemEn",
  ai_suggest: "alertCenter.famAiSuggestEn",
  ai_alert: "alertCenter.famAiAlertEn",
  stale_quote: "alertCenter.famStaleQuoteEn",
};

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

function getDirectionArrow(dir: string): string {
  const d = String(dir || "").toLowerCase();
  if (d.includes("buy") || d === "mua") return "↑";
  if (d.includes("sell") || d === "bán") return "↓";
  return "—";
}

// S5: map freshness/direction thô sang nhãn i18n
function freshnessLabel(fs: unknown, t: (key: string) => string): string {
  const s = String(fs || "").toLowerCase();
  if (s === "fresh") return t("alertCenter.freshFresh");
  if (s === "stale") return t("alertCenter.freshStale");
  return "—";
}

function directionLabel(dir: unknown, t: (key: string) => string): string {
  const d = String(dir || "").toLowerCase();
  if (!d || d === "—") return "—";
  if (d.includes("buy") || d === "mua") return t("alertCenter.labelBuy");
  if (d.includes("sell") || d === "bán") return t("alertCenter.labelSell");
  if (d.includes("neutral")) return t("alertCenter.labelOther");
  return String(dir);
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
  const { alert, lane, busyAlertId, isEvidenceExpanded, toggleEvidence, handleLoadDetail, handleAcknowledge, handleMuteSymbol, handleMuteRequest, formatAlertValue, formatAlertTimestamp, style, index = -1, onHeight } = props;
  const [showMore, setShowMore] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  // S1.6: báo chiều cao thật cho VariableSizeList (jsdom offsetHeight=0 → bỏ qua, giữ 280).
  useLayoutEffect(() => {
    if (!onHeight || index < 0) return;
    const h = rootRef.current?.offsetHeight ?? 0;
    if (h > 0) onHeight(index, h);
  });

  const severity = alert.severity || "medium";
  const severityCap = severity.charAt(0).toUpperCase() + severity.slice(1);
  const borderClass = styles[`acCard${severityCap}` as keyof typeof styles] || styles.acCardMedium;
  const severityBadgeClass = SEVERITY_TO_SOC[severity] || "";
  const directionClass = getDirectionClass(alert.direction || "");
  const directionArrow = getDirectionArrow(alert.direction || "");
  const familyKey = FAMILY_LABELS[alert.alert_family || ""];
  const familyEnKey = FAMILY_EN_LABELS[alert.alert_family || ""];
  const title = alert.title || t("alertCenter.cardTitle");
  const summary = alert.summary || alert.body || "";
  const showSummary = summary.trim() !== "" && !isDuplicateSummary(title, summary);
  const whale = alert.whale_detail;
  const compactTime = alert.executed_at
    ? formatAlertTimestamp(alert.executed_at)
    : formatAlertTimestamp(alert.triggered_at);

  return (
    <article
      ref={rootRef as any}
      className={`${soc.feedCard} ${String(borderClass)}`.trim()}
      style={style}
      tabIndex={0}
      aria-label={`${alert.symbol || ""} ${title}`.trim()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) handleLoadDetail(alert);
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
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
                {freshnessLabel(alert.freshness_state, t)}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
              {title}
            </h3>
            <div
              style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}
              title={familyEnKey ? `Lane ${alert.lane || lane} · ${t(familyEnKey as any)}` : `Lane ${alert.lane || lane}`}
            >
              {familyKey ? t(familyKey as any) : alert.alert_family || alert.alert_type || "—"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className={`${soc.signalVolume}`} style={{ fontSize: "0.82rem", fontWeight: 700 }}>
            {formatAlertValue(alert.value ?? (alert as any).matched_value)} {t("alertCenter.currency")}
          </div>
          <div className={`${soc.signalLabel} ${directionClass}`.trim()} style={{ display: "inline-block" }}>
            {directionArrow} {directionLabel(alert.direction, t)}
          </div>
        </div>
      </div>

      {showSummary && (
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", margin: "8px 0" }}>
          {summary}
        </p>
      )}
      {!showSummary && !summary.trim() && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)", margin: "8px 0" }}>
          {t("alertCenter.cardNoSummary")}
        </p>
      )}

      {alert._optimistic && (
        <span className={`${soc.statusBadge} ${soc.statusBadgeWarning}`} style={{ marginBottom: 8 }}>
          {alert.acknowledged ? t("alertCenter.pendingAck") : t("alertCenter.pendingMute")}
        </span>
      )}

      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px",
        fontSize: "0.73rem", color: "var(--text-muted)",
        marginBottom: showMore ? 10 : 8,
      }}>
        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
          {formatSessionDate(alert.session_date)} · {compactTime} · {t("alertCenter.labelConfidence")}: {alert.confidence != null ? `${Math.round(Number(alert.confidence) * 100)}%` : "—"}
        </span>
        {whale && (whale.volume != null || whale.price != null) && (
          <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
            {t("alertCenter.whaleFill", {
              volume: formatVnd(whale.volume ?? "—"),
              price: formatVnd(whale.price ?? "—"),
            })}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          aria-expanded={showMore}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--accent-cyan, #22d3ee)", fontSize: "0.73rem", fontWeight: 700, padding: 0,
          }}
        >
          {showMore ? t("alertCenter.detailCollapse") : t("alertCenter.detailExpand")}
        </button>
      </div>

      {showMore && (
        <>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "4px 20px",
            fontSize: "0.73rem", color: "var(--text-muted)",
            marginBottom: 10, padding: "8px 12px",
            background: "rgba(2,11,35,0.3)",
            borderRadius: 8,
            border: "1px solid rgba(80,120,168,0.08)",
          }}>
            <span><strong>{t("alertCenter.labelSession")}:</strong> {formatSessionDate(alert.session_date)}</span>
            <span><strong>{alert.executed_at ? t("alertCenter.labelExecuted") : t("alertCenter.labelTime")}:</strong> {compactTime}</span>
            {whale?.price != null && (
              <span><strong>{t("alertCenter.detailPrice")}:</strong> {formatVnd(whale.price)}</span>
            )}
            {whale?.volume != null && (
              <span><strong>{t("alertCenter.detailVolume")}:</strong> {formatVnd(whale.volume)}</span>
            )}
          </div>

          {alert.evidence && Object.keys(alert.evidence).length > 0 && (
            <div className={`${soc.accordion}`} style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`${soc.accordionHeader}`}
                onClick={() => toggleEvidence(String(alert.alert_id))}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{t("alertCenter.evidenceView")}</span>
                </span>
                <span style={{ fontSize: "0.65rem" }}>{isEvidenceExpanded ? "▼" : "▶"}</span>
              </button>
              {isEvidenceExpanded && renderEvidenceList(alert.evidence, t)}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnActive}`}
          disabled={busyAlertId === alert.alert_id}
          onClick={() => handleLoadDetail(alert)}
          style={{ fontWeight: 700 }}
        >
          {busyAlertId === alert.alert_id ? t("alertCenter.btnDetailLoading") : t("alertCenter.btnDetail")}
        </button>
        {/* S3: ack khả dụng cả 2 lane (BE hỗ trợ ?lane=main|ai) */}
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
          disabled={busyAlertId === alert.alert_id}
          onClick={() => handleAcknowledge(alert)}
          title={t("alertCenter.btnAck")}
        >
          {t("alertCenter.btnAck")}
        </button>
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
          disabled={busyAlertId === (alert.alert_id || alert.symbol)}
          onClick={() => (handleMuteRequest ? handleMuteRequest(alert) : handleMuteSymbol(alert))}
          title={t("alertCenter.muteTitle") as string}
        >
          {t("alertCenter.btnMute")}
        </button>
      </div>
    </article>
  );
});
