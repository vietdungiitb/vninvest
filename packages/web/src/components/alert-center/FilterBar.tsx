import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";
import styles from "../../pages/AlertCenterPage.module.css";

const LANE_OPTIONS = [
  { value: "main", label: "alertCenter.laneMain" },
  { value: "ai", label: "alertCenter.laneAi" },
];

const WINDOW_OPTIONS = [
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "session", label: "alertCenter.timeSession" },
  { value: "5d", label: "5d" },
];

const SEVERITY_OPTIONS = [
  { value: "critical", labelKey: "alertCenter.sevCritical" },
  { value: "high", labelKey: "alertCenter.sevHigh" },
  { value: "medium", labelKey: "alertCenter.sevMedium" },
  { value: "low", labelKey: "alertCenter.sevLow" },
];



interface FilterBarProps {
  lane: string;
  onLaneChange: (lane: string) => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  symbolDraft: string;
  onSymbolDraftChange: (val: string) => void;
  onSymbolApply: (e: React.FormEvent) => void;
  sessionDate: string;
  onSessionDateChange: (val: string) => void;
  severityFilter: string[];
  severityCounts?: Record<string, number>;
  onToggleSeverity: (val: string) => void;
  familyFilter: string[];
  onToggleFamily: (val: string) => void;
  onClearFilters: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function FilterBar(props: FilterBarProps) {
  const { t } = useI18n();
  const hasActiveFilters = props.severityFilter.length > 0 || props.familyFilter.length > 0;
  const counts = props.severityCounts || {};
  const familyOptions = props.lane === "ai"
    ? [
        { value: "ai_suggest", labelKey: "alertCenter.famAiSuggest", enKey: "alertCenter.famAiSuggestEn" },
        { value: "ai_alert", labelKey: "alertCenter.famAiAlert", enKey: "alertCenter.famAiAlertEn" },
      ]
    : [
        { value: "whale", labelKey: "alertCenter.famWhale", enKey: "alertCenter.famWhaleEn" },
        { value: "dark_flow", labelKey: "alertCenter.famDarkFlow", enKey: "alertCenter.famDarkFlowEn" },
        { value: "price_shock", labelKey: "alertCenter.famPriceShock", enKey: "alertCenter.famPriceShockEn" },
        { value: "signal", labelKey: "alertCenter.famSignal", enKey: "alertCenter.famSignalEn" },
        { value: "system", labelKey: "alertCenter.famSystem", enKey: "alertCenter.famSystemEn" },
        { value: "stale_quote", labelKey: "alertCenter.famStaleQuote", enKey: "alertCenter.famStaleQuoteEn" },
      ];

  return (
    <>
      <div className={`${soc.toolbar}`}>
        <div className={`${soc.toolbarRow}`}>
          <div className={`${soc.subTabBar}`}>
            {LANE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                aria-pressed={props.lane === o.value}
                className={`${soc.subTabBtn} ${props.lane === o.value ? soc.subTabBtnActive : ""}`}
                onClick={() => props.onLaneChange(o.value)}
              >
                {t(o.label)}
              </button>
            ))}
            <div className={`${soc.vSeparator}`} aria-hidden="true" />
            {WINDOW_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                aria-pressed={props.timeframe === o.value}
                className={`${soc.subTabBtn} ${props.timeframe === o.value ? soc.subTabBtnActive : ""}`}
                onClick={() => props.onTimeframeChange(o.value)}
              >
                {t(o.label)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            onClick={props.onRefresh}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            {props.isRefreshing && <span className={`${soc.pulsingDot} ${soc.dotGreen}`} />}
            {t("alertCenter.refresh")}
          </button>
        </div>

        <div className={`${soc.toolbarRow}`} style={{ justifyContent: "flex-start" }}>
          <input
            type="date"
            className={`${soc.searchInputWithIcon}`}
            value={props.sessionDate}
            aria-label={t("alertCenter.sessionDate")}
            onChange={e => props.onSessionDateChange(e.target.value)}
            style={{ maxWidth: 170 }}
          />
          <form className={`${soc.searchWrapper} ${styles.acSearchGrow}`} onSubmit={props.onSymbolApply}>
            <span className={soc.searchIcon}>⌕</span>
            <input
              type="text"
              className={soc.searchInputWithIcon}
              value={props.symbolDraft}
              maxLength={10}
              placeholder={t("alertCenter.filterSymbol")}
              aria-label={t("alertCenter.filterSymbol")}
              onChange={e => props.onSymbolDraftChange(e.target.value.toUpperCase())}
            />
          </form>
          {props.sessionDate && (
            <span style={{ fontSize: "0.72rem", color: "var(--accent-amber, #fbbf24)" }}>
              {t("alertCenter.dateOverridesTimeframe")}
            </span>
          )}
        </div>
      </div>

      <div className={`${soc.toolbarRow}`} style={{ marginBottom: 12 }}>
        <span className={`${soc.opsLabel}`}>{t("alertCenter.severity")}</span>
        {SEVERITY_OPTIONS.map(s => {
          const active = props.severityFilter.includes(s.value);
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={active}
              className={`${soc.filterBtn} ${active ? soc.filterBtnActive : soc.filterBtnInactive}`}
              onClick={() => props.onToggleSeverity(s.value)}
            >
              {t(s.labelKey)}
              <span className="chip-count" style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
                {" "}{counts[s.value] ?? 0}
              </span>
            </button>
          );
        })}
        <div className={`${soc.vSeparator}`} aria-hidden="true" />
        <span className={`${soc.opsLabel}`}>{t("alertCenter.family")}</span>
        {familyOptions.map(f => {
          const active = props.familyFilter.includes(f.value);
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              title={t(f.enKey as any) as string}
              className={`${soc.filterBtn} ${active ? soc.filterBtnActive : soc.filterBtnInactive}`}
              onClick={() => props.onToggleFamily(f.value)}
            >
              {t(f.labelKey)}
            </button>
          );
        })}
        {hasActiveFilters && (
          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            style={{ color: "var(--accent-amber)", borderColor: "rgba(245,158,11,0.4)" }}
            onClick={props.onClearFilters}
          >
            {t("alertCenter.clearFilter")}
          </button>
        )}
      </div>
    </>
  );
}
