import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";
import soc from "../soc/soc.module.css";

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
}

const FREQ_SOC_MAP: Record<string, string> = {
  "Bùng nổ": soc.statusBadgeDanger,
  "Cao": soc.statusBadgeWarning,
  "Trung bình": soc.statusBadgeInfo,
  "Thấp": "",
};

function freqLabelKey(freq: string): string {
  if (freq === "Bùng nổ") return "alertCenter.freqExplosive";
  if (freq === "Cao") return "alertCenter.freqHigh";
  if (freq === "Trung bình") return "alertCenter.freqMedium";
  return "alertCenter.freqLow";
}

export function StatsTable(props: StatsTableProps) {
  const { t } = useI18n();
  const { rows, formatAlertValue } = props;

  if (rows.length === 0) {
    return <p className={`${soc.emptyState}`}>{t("alertCenter.statsEmpty")}</p>;
  }

  return (
    <div className={`${soc.coverageTableWrap}`}>
      <table className={`${soc.coverageTable}`}>
        <thead>
          <tr>
            <th>{t("alertCenter.colSymbol")}</th>
            <th>{t("alertCenter.colCount")}</th>
            <th>{t("alertCenter.colBuySell")}</th>
            <th>{t("alertCenter.colFreq")}</th>
            <th>{t("alertCenter.colValue")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(item => {
            const total = item.count || 0;
            const buyPct = total > 0 ? (item.buyCount / total) * 100 : 0;
            const sellPct = total > 0 ? (item.sellCount / total) * 100 : 0;
            const neutralPct = total > 0 ? (item.neutralCount / total) * 100 : 0;
            const freqClass = FREQ_SOC_MAP[item.freq] || "";

            return (
              <tr key={item.symbol}>
                <td>
                  <a
                    href={`/stocks/${item.symbol}`}
                    className={`${soc.statusBadge}`}
                    style={{ fontWeight: 800 }}
                  >
                    {item.symbol}
                  </a>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t("alertCenter.times", { count: item.count })}
                </td>
                <td>
                  <div className={`${styles.acStrengthContainer}`}>
                    <div className={`${styles.acStrengthBar}`}>
                      {buyPct > 0 && (
                        <div className={`${styles.acStrengthBuy}`} style={{ width: `${buyPct}%` }}
                          title={`${t("alertCenter.labelBuy")}: ${item.buyCount}`}
                        />
                      )}
                      {sellPct > 0 && (
                        <div className={`${styles.acStrengthSell}`} style={{ width: `${sellPct}%` }}
                          title={`${t("alertCenter.labelSell")}: ${item.sellCount}`}
                        />
                      )}
                      {neutralPct > 0 && (
                        <div className={`${styles.acStrengthNeutral}`} style={{ width: `${neutralPct}%` }}
                          title={`${t("alertCenter.labelOther")}: ${item.neutralCount}`}
                        />
                      )}
                    </div>
                    <div className={`${styles.acStrengthText}`}>
                      <span style={{ color: "var(--soc-c-34d399, #34d399)" }}>{t("alertCenter.buyShort")}: {item.buyCount}</span>
                      <span style={{ color: "var(--soc-c-f87171, #f87171)" }}>{t("alertCenter.sellShort")}: {item.sellCount}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`${soc.statusBadge} ${freqClass}`.trim()}>
                    {t(freqLabelKey(item.freq) as any)}
                  </span>
                </td>
                <td style={{ fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatAlertValue(item.totalValue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
