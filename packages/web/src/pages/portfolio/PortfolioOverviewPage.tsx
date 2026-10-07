/**
 * S-05 - Trang Tổng quan.
 *
 * RÀNG BUỘC QUAN TRỌNG NHẤT: 4/6 thẻ số ở đây (Daily P&L, Return 1Y, Sharpe,
 * Max Drawdown) KHÔNG có nguồn dữ liệu. Backend `PortfolioSummaryView` không
 * trả chúng, và `sharpe` chỉ tồn tại dưới dạng comment trong `analytics.py:256`
 * (`sortino`/`correlation` = 0 hit). Thẻ thiếu hiện `—` + lý do, KHÔNG hiện 0.
 *
 * Đây là lý do D7 tồn tại: plan v2 R8 ("số thiếu ⇒ —") đã che lỗi vì không có
 * test nào khẳng định số 0 đó là sai.
 */

import { useCallback, useMemo } from "react";
import { useI18n } from "../../context/LangContext";
import { PortfolioChart, type NavPoint } from "../../components/portfolio/PortfolioChart";
import { usePortfolioResource, unwrapEnvelope, type PortfolioAdapter } from "../../hooks/usePortfolioWorkspace";

const EMPTY_CURVE_REASON = "no_equity_curve";

interface SummaryRow {
  portfolio_name?: string;
  total_market_value?: string | null;
  total_cost?: string | null;
  total_unrealized_pnl?: string | null;
  total_unrealized_pnl_pct?: number | null;
  num_holdings?: number | null;
  cash?: string | null;
  realized_pnl?: string | null;
  dividend_income?: string | null;
  as_of?: string | null;
  nav_reason?: string | null;
  unpriced_symbols?: string[];
  [k: string]: unknown;
}

/** `—` khi thiếu, KHÔNG phải 0. Cột "nguồn" để người đọc biết vì sao trống. */
function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("vi-VN");
}

export function PortfolioOverviewPage({
  portfolioId, adapter,
}: {
  portfolioId: string | number | null;
  adapter?: PortfolioAdapter;
}) {
  const { t } = useI18n();
  const api = adapter as PortfolioAdapter;

  const fetchSummary = useCallback(
    (id: string | number) => api.getPortfolioSummary?.(id) ?? Promise.resolve(null),
    [api],
  );
  const fetchCurve = useCallback(
    (id: string | number) => api.getPortfolioEquityCurve?.(id) ?? Promise.resolve(null),
    [api],
  );

  const summary = usePortfolioResource<SummaryRow>(portfolioId, fetchSummary, () => null);
  const curveRes = usePortfolioResource<{ curve?: NavPoint[] }>(portfolioId, fetchCurve, () => null);

  const row = useMemo(() => (unwrapEnvelope(summary.data) ?? {}) as SummaryRow, [summary.data]);
  const curve = useMemo<NavPoint[]>(() => {
    const raw = curveRes.data?.curve;
    return Array.isArray(raw) ? raw : [];
  }, [curveRes.data]);

  if (summary.loading || curveRes.loading) {
    return <p role="status">{t("portfolioWorkspace.loading", { defaultValue: "Đang tải…" })}</p>;
  }
  if (summary.error || curveRes.error) {
    return (
      <p role="alert">
        {t("portfolioWorkspace.loadError", { defaultValue: "Không tải được dữ liệu" })}
        <code> {summary.error ?? curveRes.error}</code>
      </p>
    );
  }

  const unpriced = row.unpriced_symbols ?? [];
  const navReason = row.nav_reason ?? null;

  // 2 thẻ có nguồn thật từ summary; 4 thẻ dưới đây cố ý để trống + nêu lý do.
  const cards: Array<{ key: string; label: string; value: string; note?: string }> = [
    { key: "totalValue", label: t("portfolioWorkspace.cards.totalValue", { defaultValue: "Tổng giá trị" }),
      value: money(row.total_market_value) },
    { key: "holdings", label: t("portfolioWorkspace.cards.holdingsCount", { defaultValue: "Số mã" }),
      value: typeof row.num_holdings === "number" ? String(row.num_holdings) : "—" },
    { key: "unrealized", label: t("portfolioWorkspace.cards.unrealizedPnl", { defaultValue: "Lãi/lỗ tạm tính" }),
      value: money(row.total_unrealized_pnl),
      note: typeof row.total_unrealized_pnl_pct === "number"
        ? `${row.total_unrealized_pnl_pct}%` : undefined },
    { key: "cash", label: t("portfolioWorkspace.cards.cash", { defaultValue: "Tiền mặt" }),
      value: money(row.cash) },
    { key: "dailyPnl", label: t("portfolioWorkspace.cards.dailyPnl", { defaultValue: "Lãi/lỗ trong ngày" }),
      value: "—", note: t("portfolioWorkspace.cards.notProvided", { defaultValue: "BE chưa cung cấp" }) },
    { key: "return1y", label: t("portfolioWorkspace.cards.return1y", { defaultValue: "Lợi nhuận 1 năm" }),
      value: "—", note: t("portfolioWorkspace.cards.notProvided", { defaultValue: "BE chưa cung cấp" }) },
    { key: "sharpe", label: t("portfolioWorkspace.cards.sharpe", { defaultValue: "Sharpe" }),
      value: "—", note: t("portfolioWorkspace.cards.notComputed", { defaultValue: "BE không tính" }) },
    { key: "maxDrawdown", label: t("portfolioWorkspace.cards.maxDrawdown", { defaultValue: "Sụt giảm tối đa" }),
      value: "—", note: navReason
        ? t("portfolioWorkspace.cards.navIncomplete", { defaultValue: "NAV chưa đủ dữ liệu" })
        : t("portfolioWorkspace.cards.notComputed", { defaultValue: "BE không tính" }) },
  ];

  return (
    <div className="pf-overview">
      <ul className="pf-metric-grid">
        {cards.map((c) => (
          <li key={c.key} className="pf-metric-card" data-empty={c.value === "—" ? "true" : undefined}>
            <span className="pf-metric-card__label">{c.label}</span>
            <strong className="pf-metric-card__value">{c.value}</strong>
            {c.note && <span className="pf-metric-card__note">{c.note}</span>}
          </li>
        ))}
      </ul>

      {unpriced.length > 0 && (
        <p className="pf-inline-warning" role="status">
          {t("portfolioWorkspace.unpricedHint", {
            defaultValue: "Có mã chưa có giá hôm nay",
          })}{" "}
          <code>{unpriced.join(", ")}</code>
        </p>
      )}

      <section aria-labelledby="pf-nav-heading">
        <h2 id="pf-nav-heading">
          {t("portfolioWorkspace.navHeading", { defaultValue: "Biến động giá trị danh mục" })}
        </h2>
        <PortfolioChart
          kind="line"
          points={curve}
          ariaLabel={t("portfolioWorkspace.navChartLabel", {
            defaultValue: "Đường biểu diễn giá trị danh mục theo ngày",
          })}
          emptyMessage={curveRes.reason === EMPTY_CURVE_REASON
            ? t("portfolioWorkspace.chart.noCurve", { defaultValue: "Chưa có dữ liệu giá để vẽ đường cong" })
            : t("portfolioWorkspace.chart.empty", { defaultValue: "Chưa có dữ liệu để hiển thị" })}
        />
      </section>
    </div>
  );
}

export default PortfolioOverviewPage;
