import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";
import { StatsTable } from "./StatsTable.js";

interface SymbolStatsRow {
  symbol: string;
  count: number;
  buyCount: number;
  sellCount: number;
  neutralCount: number;
  totalValue: number;
  freq: string;
  severities: Record<string, number>;
  latestTime: number;
}

interface StatsPanelProps {
  rows: SymbolStatsRow[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  formatAlertValue: (val: unknown) => string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function StatsPanel(props: StatsPanelProps) {
  const { t } = useI18n();

  return (
    <div className={`${soc.panel}`}>
      <div className={`${soc.panelHeader}`}>
        <h2 className={soc.panelTitle}>{t("alertCenter.statsTitle")}</h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {props.rows.length} {t("alertCenter.colSymbol")}
        </span>
      </div>

      <div className={`${soc.searchWrapper}`} style={{ marginBottom: 12 }}>
        <span className={soc.searchIcon}>⌕</span>
        <input
          type="text"
          className={soc.searchInputWithIcon}
          value={props.searchTerm}
          maxLength={10}
          placeholder={t("alertCenter.statsSearch")}
          onChange={e => props.onSearchChange(e.target.value.toUpperCase())}
        />
      </div>

      <StatsTable rows={props.rows} formatAlertValue={props.formatAlertValue} />

      {props.totalPages > 1 && (
        <div className={`${soc.pagination}`}>
          <button
            type="button"
            className={`${soc.pageBtn}`}
            disabled={props.page === 1}
            onClick={() => props.onPageChange(1)}
          >
            «
          </button>
          <button
            type="button"
            className={`${soc.pageBtn}`}
            disabled={props.page === 1}
            onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
          >
            ‹
          </button>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", padding: "0 8px" }}>
            {t("alertCenter.paginationPage", { current: props.page, total: props.totalPages })}
          </span>
          <button
            type="button"
            className={`${soc.pageBtn}`}
            disabled={props.page === props.totalPages}
            onClick={() => props.onPageChange(Math.min(props.totalPages, props.page + 1))}
          >
            ›
          </button>
          <button
            type="button"
            className={`${soc.pageBtn}`}
            disabled={props.page === props.totalPages}
            onClick={() => props.onPageChange(props.totalPages)}
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
