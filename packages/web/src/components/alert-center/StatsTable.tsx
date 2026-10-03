import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";
import soc from "../soc/soc.module.css";
import { formatAgo, formatDateTimeICT, formatVnd, formatVndCompact } from "../../utils/alertCenterFormat.js";

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

interface StatsTableProps {
  rows: SymbolStatsRow[];
  formatAlertValue: (val: unknown) => string;
  sortKey: "count" | "value" | "time";
  sortDir: "asc" | "desc";
  onSortChange: (key: "count" | "value" | "time") => void;
}

// S4: map theo enum key (explosive/high/medium/low) — không theo chuỗi Việt để đúng cả 2 locale
const FREQ_SOC_MAP: Record<string, string> = {
  explosive: soc.statusBadgeDanger,
  high: soc.statusBadgeWarning,
  medium: soc.statusBadgeInfo,
  low: "",
};

function freqLabelKey(freq: string): string {
  if (freq === "explosive") return "alertCenter.freqExplosive";
  if (freq === "high") return "alertCenter.freqHigh";
  if (freq === "medium") return "alertCenter.freqMedium";
  return "alertCenter.freqLow";
}

const SORT_LABEL_KEYS: Record<string, string> = {
  count: "alertCenter.sortByCount",
  value: "alertCenter.sortByValue",
  time: "alertCenter.sortByTime",
};

export function StatsTable(props: StatsTableProps) {
  const { t, locale } = useI18n();
  const { rows } = props;

  if (rows.length === 0) {
    return <p className={`${soc.emptyState}`}>{t("alertCenter.statsEmpty")}</p>;
  }

  const renderSortTh = (key: "count" | "value" | "time", labelKey: string, alignRight = false) => {
    const active = props.sortKey === key;
    return (
      <th aria-sort={active ? (props.sortDir === "desc" ? "descending" : "ascending") : "none"}
        style={alignRight ? { textAlign: "right" } : undefined}>
        <button
          type="button"
          onClick={() => props.onSortChange(key)}
          title={t(SORT_LABEL_KEYS[key] as any)}
          aria-label={t(SORT_LABEL_KEYS[key] as any)}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "inherit", font: "inherit", textTransform: "inherit",
            letterSpacing: "inherit", padding: 0,
            textAlign: alignRight ? "right" : "left",
          }}
        >
          {t(labelKey as any)}{" "}
          <span aria-hidden="true" style={{ opacity: active ? 1 : 0.35 }}>
            {active ? (props.sortDir === "desc" ? "▼" : "▲") : "△"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className={`${soc.coverageTableWrap}`}>
      <table className={`${soc.coverageTable}`}>
        <thead>
          <tr>
            <th>{t("alertCenter.colSymbol")}</th>
            {renderSortTh("count", "alertCenter.colCount")}
            <th>{t("alertCenter.colBuySell")}</th>
            <th>{t("alertCenter.colFreq")}</th>
            {renderSortTh("value", "alertCenter.colValue", true)}
          </tr>
        </thead>
        <tbody>
          {rows.map(item => {
            const total = item.count || 0;
            const buyPct = total > 0 ? (item.buyCount / total) * 100 : 0;
            const sellPct = total > 0 ? (item.sellCount / total) * 100 : 0;
            const neutralPct = total > 0 ? (item.neutralCount / total) * 100 : 0;
            const freqClass = FREQ_SOC_MAP[item.freq] || "";
            const latestAbs = item.latestTime ? formatDateTimeICT(item.latestTime) : "—";

            return (
              <tr key={item.symbol}>
                <td>
                  <a
                    href={`/stocks/${item.symbol}`}
                    className={`${soc.statusBadge}`}
                    style={{ fontWeight: 800 }}
                    title={t("alertCenter.openStockWorkspace") as string}
                  >
                    {item.symbol}
                  </a>
                  <div
                    style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}
                    title={latestAbs}
                  >
                    {item.latestTime ? (
                      <button
                        type="button"
                        onClick={() => props.onSortChange("time")}
                        title={`${t("alertCenter.sortByTime")} · ${latestAbs}`}
                        aria-label={t("alertCenter.sortByTime") as string}
                        style={{
                          background: "transparent", border: "none", cursor: "pointer",
                          color: "inherit", font: "inherit", padding: 0,
                        }}
                      >
                        {formatAgo(item.latestTime, locale)}
                        {props.sortKey === "time" && (
                          <span aria-hidden="true"> {props.sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </button>
                    ) : "—"}
                  </div>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t("alertCenter.times", { count: item.count })}
                </td>
                <td>
                  <div className={`${styles.acBuySellOneLine}`}
                    title={`${t("alertCenter.labelBuy")}: ${item.buyCount} · ${t("alertCenter.labelSell")}: ${item.sellCount} · ${t("alertCenter.labelOther")}: ${item.neutralCount}`}>
                    <div className={`${styles.acStrengthBar}`} style={{ width: 72 }}>
                      {buyPct > 0 && (
                        <div className={`${styles.acStrengthBuy}`} style={{ width: `${buyPct}%` }} />
                      )}
                      {sellPct > 0 && (
                        <div className={`${styles.acStrengthSell}`} style={{ width: `${sellPct}%` }} />
                      )}
                      {neutralPct > 0 && (
                        <div className={`${styles.acStrengthNeutral}`} style={{ width: `${neutralPct}%` }} />
                      )}
                    </div>
                    <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <b style={{ color: "var(--soc-c-34d399, #34d399)" }}>{t("alertCenter.buyShort")}&nbsp;{item.buyCount}</b>
                      {" / "}
                      <b style={{ color: "var(--soc-c-f87171, #f87171)" }}>{t("alertCenter.sellShort")}&nbsp;{item.sellCount}</b>
                      {item.neutralCount > 0 && (
                        <span style={{ color: "var(--text-muted)" }}> / {item.neutralCount}</span>
                      )}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`${soc.statusBadge} ${freqClass}`.trim()}>
                    {t(freqLabelKey(item.freq) as any)}
                  </span>
                </td>
                <td style={{ fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                  title={`${formatVnd(item.totalValue)} VND`}>
                  {formatVndCompact(item.totalValue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
