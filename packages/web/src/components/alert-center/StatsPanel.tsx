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
  totalSymbols: number;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  formatAlertValue: (val: unknown) => string;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  sortKey: "count" | "value" | "time";
  sortDir: "asc" | "desc";
  onSortChange: (key: "count" | "value" | "time") => void;
}

export function StatsPanel(props: StatsPanelProps) {
  const { t } = useI18n();

  return (
    <div className={`${soc.panel}`}>
      <div className={`${soc.panelHeader}`}>
        <h2 className={soc.panelTitle}>{t("alertCenter.statsTitle")}</h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {t("alertCenter.statsTotal", { total: props.totalSymbols })}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {t("alertCenter.statsPageInfo", { page: props.page, total: props.totalPages, perPage: props.pageSize })}
          </span>
        </div>
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
        {props.searchTerm && (
          <button
            type="button"
            aria-label={t("alertCenter.clearFilter")}
            title={t("alertCenter.clearFilter")}
            onClick={() => props.onSearchChange("")}
            style={{
              position: "absolute", right: 6, background: "transparent", border: "none",
              color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <StatsTable
        rows={props.rows}
        formatAlertValue={props.formatAlertValue}
        sortKey={props.sortKey}
        sortDir={props.sortDir}
        onSortChange={props.onSortChange}
      />

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
