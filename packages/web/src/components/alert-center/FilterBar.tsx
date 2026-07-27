import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";

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

const FAMILY_OPTIONS = [
  { value: "whale", labelKey: "alertCenter.famWhale" },
  { value: "dark_flow", labelKey: "alertCenter.famDarkFlow" },
  { value: "price_shock", labelKey: "alertCenter.famPriceShock" },
  { value: "signal", labelKey: "alertCenter.famSignal" },
  { value: "system", labelKey: "alertCenter.famSystem" },
  { value: "ai_suggest", labelKey: "alertCenter.famAiSuggest" },
];

interface FilterBarProps {
  lane: string;
  onLaneChange: (lane: string) => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  symbolDraft: string;
  onSymbolDraftChange: (val: string) => void;
  onSymbolApply: (e: React.FormEvent) => void;
  severityFilter: string[];
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

  return (
    <>
      <div className={`${soc.toolbar}`}>
        <div className={`${soc.toolbarRow}`}>
          <div className={`${soc.subTabBar}`}>
            {LANE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`${soc.subTabBtn} ${props.lane === o.value ? soc.subTabBtnActive : ""}`}
                onClick={() => props.onLaneChange(o.value)}
              >
                {t(o.label)}
              </button>
            ))}
            <div className={`${soc.separator}`} style={{ width: 1, alignSelf: "stretch" }} />
            {WINDOW_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
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

        <form className={`${soc.searchWrapper}`} onSubmit={props.onSymbolApply}>
          <span className={soc.searchIcon}>⌕</span>
          <input
            type="text"
            className={soc.searchInputWithIcon}
            value={props.symbolDraft}
            maxLength={10}
            placeholder={t("alertCenter.filterSymbol")}
            onChange={e => props.onSymbolDraftChange(e.target.value.toUpperCase())}
          />
        </form>
      </div>

      <div className={`${soc.toolbarRow}`} style={{ marginBottom: 12 }}>
        <span className={`${soc.opsLabel}`}>{t("alertCenter.severity")}</span>
        {SEVERITY_OPTIONS.map(s => (
          <button
            key={s.value}
            type="button"
            className={`${soc.filterBtn} ${props.severityFilter.includes(s.value) ? soc.filterBtnActive : soc.filterBtnInactive}`}
            onClick={() => props.onToggleSeverity(s.value)}
          >
            {t(s.labelKey)}
          </button>
        ))}
        <div className={`${soc.separator}`} style={{ width: 1, alignSelf: "stretch", margin: "0 4px" }} />
        <span className={`${soc.opsLabel}`}>{t("alertCenter.family")}</span>
        {FAMILY_OPTIONS.map(f => (
          <button
            key={f.value}
            type="button"
            className={`${soc.filterBtn} ${props.familyFilter.includes(f.value) ? soc.filterBtnActive : soc.filterBtnInactive}`}
            onClick={() => props.onToggleFamily(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
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
