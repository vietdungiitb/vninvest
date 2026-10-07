/**
 * S-08 - Trang Phân tích.
 *
 * ⚠ ĐÂY LÀ TRANG BỊ RÚT NGẮN CỐ Ý. Plan v2 R6 yêu cầu 11 thẻ số. Đo backend:
 *   `sharpe` → 2 hit, CẢ HAI là comment (`analytics.py:256`)
 *   `sortino` → 0 hit · `correlation` → 0 hit
 *   `risk_metrics` trả đúng 4 key (analytics.py:346-349):
 *     volatility, var_95_daily, max_drawdown, concentration
 *   `benchmark_metrics` trả 5 key: alpha, alpha_annualized, beta,
 *     tracking_error, information_ratio
 *   `performance` trả 3 key: twr, mwr, default_method
 *
 * 3/11 thẻ của plan v2 không có dữ liệu. Thay vì hiện 0 (nói dối) hoặc bỏ
 * trống không giải thích, trang này hiện ĐÚNG 12 số có thật và ghi rõ phần
 * chưa có. Đây là D7.
 *
 * Selector kỳ hạn: endpoint `metrics/` hiện **không đọc** query param
 * (`PortfolioMetricsView.get` không parse `days`), nên UI không gửi tham số
 * giả — chỉ hiện kỳ hạn cố định của chuỗi NAV (365 ngày). Gửi `?days=` là ghi
 * vào cửa không có người nghe (audit M12).
 */

import { useCallback, useMemo } from "react";
import { useI18n } from "../../context/LangContext";
import { PortfolioChart, type NavPoint } from "../../components/portfolio/PortfolioChart";
import { usePortfolioResource, unwrapEnvelope, type PortfolioAdapter } from "../../hooks/usePortfolioWorkspace";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

type Metrics = {
  observations?: number;
  performance?: { twr?: WrValue; mwr?: WrValue; default_method?: string } | null;
  risk?: {
    volatility?: number | null; var_95_daily?: number | null;
    max_drawdown?: number | null; concentration?: Record<string, number> | null;
  } | null;
  benchmark?: {
    benchmark?: string; alpha?: number | null; alpha_annualized?: number | null;
    beta?: number | null; tracking_error?: number | null; information_ratio?: number | null;
  } | null;
  freshness?: Record<string, unknown> | null;
  performance_reason?: string;
  risk_reason?: string;
  benchmark_reason?: string;
  reason?: string;
};

const DASH = "—";

type WrValue = number | null | { value?: number | null; method?: string };

/**
 * `performance()` trả `{'value': …, 'method': 'TWR', 'calculation_version': …}`
 * (`analytics.py:152,156,235-240`) — KHÔNG phải số thuần. Nếu coi là number thì
 * `Number.isFinite(object)` = false ⇒ mọi thẻ TWR/MWR hiện "Chưa đủ dữ liệu"
 * dù BE đã tính được (audit B4/M1).
 */
function metricValue(raw: WrValue | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const inner = raw.value;
  if (inner === null || inner === undefined || !Number.isFinite(inner)) return null;
  return inner;
}

/** Số đo trực tiếp từ BE; null/NaN ⇒ DASH, KHÔNG phải 0. */
function metric(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return v.toFixed(digits);
}

export function PortfolioAnalyticsPage({
  portfolioId, adapter,
}: {
  portfolioId: string | number | null;
  adapter?: PortfolioAdapter;
}) {
  const { t } = useI18n();
  // B0: `adapter` la prop TUY CHON de test inject duoc. Trong app that
  // main.tsx -> pageRegistry khong truyen prop nao, nen phai fallback ve
  // `defaultCoreApiAdapter` — neu khong, moi trang se nem
  // "Cannot read properties of undefined" khi chay that.
  const api = (adapter ?? defaultCoreApiAdapter) as PortfolioAdapter;

  const fetchMetrics = useCallback(
    (id: string | number) => api.getPortfolioMetrics?.(id) ?? Promise.resolve(null),
    [api],
  );
  const fetchCurve = useCallback(
    (id: string | number) => api.getPortfolioEquityCurve?.(id) ?? Promise.resolve(null),
    [api],
  );

  const m = usePortfolioResource<Metrics>(portfolioId, fetchMetrics, () => null);
  const c = usePortfolioResource<{ curve?: NavPoint[] }>(portfolioId, fetchCurve, () => null);

  const m0 = useMemo(() => ((unwrapEnvelope(m.data) ?? {}) as Metrics), [m.data]);
  const curve = useMemo<NavPoint[]>(
    () => (Array.isArray(c.data?.curve) ? (c.data?.curve as NavPoint[]) : []),
    [c.data],
  );

  if (m.loading || c.loading) {
    return <p role="status">{t("portfolioWorkspace.loading", { defaultValue: "Đang tải…" })}</p>;
  }
  if (m.error || c.error) {
    return (
      <p role="alert">
        {t("portfolioWorkspace.loadError", { defaultValue: "Không tải được chỉ số" })}
        <code> {m.error ?? c.error}</code>
      </p>
    );
  }

  const cards: Array<{ key: string; label: string; value: string; group: string }> = [
    { group: "performance", key: "twr",
      label: t("portfolioWorkspace.analytics.twr", { defaultValue: "TWR" }),
      value: metric(metricValue(m0.performance?.twr), 6) },
    { group: "performance", key: "mwr",
      label: t("portfolioWorkspace.analytics.mwr", { defaultValue: "MWR" }),
      value: metric(metricValue(m0.performance?.mwr), 6) },
    { group: "risk", key: "volatility",
      label: t("portfolioWorkspace.analytics.volatility", { defaultValue: "Biến động" }),
      value: metric(m0.risk?.volatility, 6) },
    { group: "risk", key: "var",
      label: t("portfolioWorkspace.analytics.var95", { defaultValue: "VaR 95% ngày" }),
      value: metric(m0.risk?.var_95_daily, 6) },
    { group: "risk", key: "maxDrawdown",
      label: t("portfolioWorkspace.analytics.maxDrawdown", { defaultValue: "Sụt giảm tối đa" }),
      value: metric(m0.risk?.max_drawdown, 6) },
    { group: "benchmark", key: "alpha",
      label: t("portfolioWorkspace.analytics.alpha", { defaultValue: "Alpha" }),
      value: metric(m0.benchmark?.alpha, 6) },
    { group: "benchmark", key: "alphaAnnualized",
      label: t("portfolioWorkspace.analytics.alphaAnnualized", { defaultValue: "Alpha năm" }),
      value: metric(m0.benchmark?.alpha_annualized, 6) },
    { group: "benchmark", key: "beta",
      label: t("portfolioWorkspace.analytics.beta", { defaultValue: "Beta" }),
      value: metric(m0.benchmark?.beta, 4) },
    { group: "benchmark", key: "trackingError",
      label: t("portfolioWorkspace.analytics.trackingError", { defaultValue: "Sai số theo dõi" }),
      value: metric(m0.benchmark?.tracking_error, 6) },
    { group: "benchmark", key: "ir",
      label: t("portfolioWorkspace.analytics.informationRatio", { defaultValue: "Information ratio" }),
      value: metric(m0.benchmark?.information_ratio, 4) },
  ];

  const groups = [
    { id: "performance", label: t("portfolioWorkspace.analytics.groupPerformance", { defaultValue: "Hiệu quả" }) },
    { id: "risk", label: t("portfolioWorkspace.analytics.groupRisk", { defaultValue: "Rủi ro" }) },
    { id: "benchmark", label: t("portfolioWorkspace.analytics.groupBenchmark", {
      defaultValue: `So sánh ${m0.benchmark?.benchmark ?? "VN30"}`,
    }) },
  ];

  const missing = (["performance", "risk", "benchmark"] as const)
    .filter((k) => m0[`${k}_reason` as keyof Metrics]);

  return (
    <div className="pf-analytics">
      {m0.reason === "no_holdings" && (
        <p className="pf-inline-warning" role="status">
          {t("portfolioWorkspace.analytics.noHoldings", { defaultValue: "Danh mục chưa có mã nào để tính chỉ số" })}
        </p>
      )}

      {missing.length > 0 && (
        <p className="pf-inline-warning" role="status">
          {t("portfolioWorkspace.analytics.partialReason", { defaultValue: "Một số chỉ số thiếu dữ liệu:" })}{" "}
          <code>{missing.map((k) => String(m0[`${k}_reason` as keyof Metrics])).join(", ")}</code>
        </p>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`pf-${g.id}-heading`}>
          <h2 id={`pf-${g.id}-heading`}>{g.label}</h2>
          <ul className="pf-metric-grid">
            {cards.filter((c) => c.group === g.id).map((c) => (
              <li key={c.key} className="pf-metric-card" data-empty={c.value === DASH ? "true" : undefined}>
                <span className="pf-metric-card__label">{c.label}</span>
                <strong className="pf-metric-card__value">{c.value}</strong>
                {c.value === DASH && (
                  <span className="pf-metric-card__note">
                    {t("portfolioWorkspace.analytics.noData", { defaultValue: "Chưa đủ dữ liệu" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="pf-analytics-note">
        <h2 id="pf-analytics-note">
          {t("portfolioWorkspace.analytics.notComputedTitle", { defaultValue: "Chỉ số chưa có" })}
        </h2>
        <p className="pf-note">
          {t("portfolioWorkspace.analytics.notComputedBody", {
            defaultValue: "Sharpe, Sortino và hệ số tương quan chưa được backend tính — hiển thị ở đây sẽ là số bịa. Số quan sát chuỗi NAV:",
          })}{" "}
          <strong>{m0.observations ?? 0}</strong>
        </p>
      </section>

      <section aria-labelledby="pf-analytics-curve">
        <h2 id="pf-analytics-curve">
          {t("portfolioWorkspace.analytics.navHeading", { defaultValue: "Chuỗi NAV dùng để tính" })}
        </h2>
        <PortfolioChart
          kind="line"
          points={curve}
          height={240}
          ariaLabel={t("portfolioWorkspace.analytics.curveLabel", {
            defaultValue: "Chuỗi giá trị danh mục dùng làm đầu vào cho chỉ số rủi ro",
          })}
          emptyMessage={t("portfolioWorkspace.analytics.noCurve", {
            defaultValue: "Chưa đủ chuỗi NAV để tính chỉ số",
          })}
        />
      </section>
    </div>
  );
}

export default PortfolioAnalyticsPage;
