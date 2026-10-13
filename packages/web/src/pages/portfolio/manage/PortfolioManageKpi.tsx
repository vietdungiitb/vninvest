/**
 * Lưới KPI tổng cho `/portfolios/manage`.
 *
 * Vì sao có "partial" state: BE trả `null` + `market_value_reason` khi còn mã
 * chưa có giá phiên hôm nay (`portfolio_analytics_views.py:373-377`). Tổng
 * cộng lúc đó là **SỐ SAI**, hiện như số thật là bịa dữ liệu (vi phạm nguyên tắc
 * NO ZERO DISPLAY, `PORTFOLIO_COMMERCIAL_UPGRADE_PROPOSAL_20260927.md:87-108`).
 * Nên: thiếu bất kỳ danh mục nào ⇒ gắn nhãn "Tạm tính" và nêu rõ lý do.
 */

import { useI18n } from "../../../context/LangContext.js";
import {
  EM_DASH,
  formatPct,
  formatVnd,
  toneOf,
  type PortfolioSummary,
} from "./format";
import type { ManageTotals } from "./usePortfolioManage";
import "./portfolioManage.css";

export interface PortfolioManageKpiProps {
  totals: ManageTotals;
  summaries: Record<string, PortfolioSummary>;
  loading: boolean;
}

export function PortfolioManageKpi({ totals, summaries, loading }: PortfolioManageKpiProps) {
  const { t, localeTag } = useI18n();

  const reasons = Object.values(summaries)
    .map((s) => s.market_value_reason)
    .filter((r): r is string => typeof r === "string" && r.length > 0);

  const pnlPct =
    totals.cost > 0 ? (totals.unrealizedPnl / totals.cost) * 100 : null;
  const tone = toneOf(totals.unrealizedPnl);
  const partial = totals.totalCount > 0 && !totals.complete;

  const cards = [
    {
      key: "marketValue",
      labelKey: "portfoliosManage.kpi.marketValue",
      label: t("portfoliosManage.kpi.marketValue", { defaultValue: "Tổng giá trị danh mục" }),
      value: formatVnd(totals.marketValue, localeTag) ?? EM_DASH,
      hint:
        totals.totalCount === 0
          ? t("portfoliosManage.kpi.noData", { defaultValue: "Chưa có danh mục" })
          : t("portfoliosManage.kpi.pricedCount", {
              defaultValue: "{priced}/{total} danh mục có số liệu",
              priced: totals.pricedCount,
              total: totals.totalCount,
            }),
      tone: "flat" as const,
    },
    {
      key: "cost",
      labelKey: "portfoliosManage.kpi.cost",
      label: t("portfoliosManage.kpi.cost", { defaultValue: "Tổng giá vốn" }),
      value: formatVnd(totals.cost, localeTag) ?? EM_DASH,
      hint: t("portfoliosManage.kpi.costHint", { defaultValue: "Tổng giá mua của vị thế đang giữ" }),
      tone: "flat" as const,
    },
    {
      key: "pnl",
      labelKey: "portfoliosManage.kpi.pnl",
      label: t("portfoliosManage.kpi.pnl", { defaultValue: "Lãi/lỗ chưa thực hiện" }),
      value: formatVnd(totals.unrealizedPnl, localeTag) ?? EM_DASH,
      hint: formatPct(pnlPct, localeTag) ?? EM_DASH,
      tone,
    },
  ];

  return (
    <div className="pfm-kpi" aria-busy={loading || undefined}>
      {cards.map((card) => (
        <article key={card.key} className={`pfm-kpi__card pfm-tone-${card.tone}`}>
          <h3 className="pfm-kpi__label">{card.label}</h3>
          <p className="pfm-kpi__value">{card.value}</p>
          <p className="pfm-kpi__hint">{card.hint}</p>
        </article>
      ))}
      {partial && (
        <p className="pfm-kpi__notice" role="status">
          {t("portfoliosManage.kpi.partial", {
            defaultValue: "Tổng trên là tạm tính: {reason}",
            reason: reasons[0] ?? t("portfoliosManage.kpi.partialGeneric", {
              defaultValue: "một số danh mục chưa có số liệu",
            }),
          })}
        </p>
      )}
    </div>
  );
}

export default PortfolioManageKpi;