/**
 * S-07 - Trang Phân bổ.
 *
 * 4 chế độ theo yêu cầu thiết kế: treemap, sunburst, bar, pie.
 *
 * Widget 1.2.5 không có Treemap/Sunburst/Donut (đo export surface: 29 symbol,
 * không có 3 tên này) ⇒ dùng ECharts cho cả 4. Chi tiết ở `PortfolioChart.tsx`.
 *
 * Mã chưa có ngành gom vào "Chưa phân ngành", KHÔNG gom vào "Khác" giả — xem
 * `groupByIndustry`.
 *
 * `weight_covers_all_holdings === false` nghĩa là tổng tỷ trọng KHÔNG đủ 100%
 * vì có mã chưa có giá. Nói rõ điều đó, không cho biểu đồ trông như đã đủ.
 */

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "../../context/LangContext";
import {
  PortfolioChart,
  type PortfolioChartKind,
} from "../../components/portfolio/PortfolioChart";
import { usePortfolioResource, unwrapEnvelope, type PortfolioAdapter } from "../../hooks/usePortfolioWorkspace";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

interface AllocationPayload {
  total_value?: string | null;
  allocation?: Array<{ symbol?: string; value?: string | number; weight_pct?: number | null; industry?: string }>;
  unpriced_symbols?: string[];
  weight_covers_all_holdings?: boolean;
  reason?: string;
}

const MODES: ReadonlyArray<{ id: PortfolioChartKind; labelKey: string; fallback: string }> = [
  { id: "treemap", labelKey: "portfolioWorkspace.allocation.modeTreemap", fallback: "Treemap" },
  { id: "sunburst", labelKey: "portfolioWorkspace.allocation.modeSunburst", fallback: "Sunburst" },
  { id: "bar", labelKey: "portfolioWorkspace.allocation.modeBar", fallback: "Cột" },
  { id: "pie", labelKey: "portfolioWorkspace.allocation.modePie", fallback: "Tròn" },
];

export function PortfolioAllocationPage({
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
  const [mode, setMode] = useState<PortfolioChartKind>("treemap");
  const [bySector, setBySector] = useState(true);

  const fetchAllocation = useCallback(
    (id: string | number) => api.getPortfolioAllocation?.(id) ?? Promise.resolve(null),
    [api],
  );
  const res = usePortfolioResource<AllocationPayload>(portfolioId, fetchAllocation, () => "no_allocation");

  const payload = useMemo(
    () => ((unwrapEnvelope(res.data) ?? {}) as AllocationPayload),
    [res.data],
  );

  const items = useMemo(() => {
    const rows = Array.isArray(payload.allocation) ? payload.allocation : [];
    return rows
      .map((r) => ({ name: String(r.symbol ?? ""), value: Number(r.value ?? 0), industry: r.industry ?? "" }))
      .filter((r) => r.name && Number.isFinite(r.value) && r.value > 0);
  }, [payload.allocation]);

  // KHÔNG gom ở trang này. Gom 1 lần duy nhất trong `PortfolioChart` qua prop
  // `groupBySector` — trước đây trang gom rồi chart gom tiếp nên mọi mục mất
  // `industry` và treemap chỉ còn 1 ô "Chưa phân ngành" (audit B3).

  const unpriced = payload.unpriced_symbols ?? [];
  const partial = payload.weight_covers_all_holdings === false || unpriced.length > 0;

  if (res.loading) {
    return <p role="status">{t("portfolioWorkspace.loading", { defaultValue: "Đang tải…" })}</p>;
  }
  if (res.error) {
    return <p role="alert">{t("portfolioWorkspace.loadError", { defaultValue: "Không tải được phân bổ" })}<code> {res.error}</code></p>;
  }

  return (
    <div className="pf-allocation">
      <div className="pf-chart-modes" role="group" aria-label={t("portfolioWorkspace.allocation.modeLabel", {
        defaultValue: "Kiểu biểu đồ",
      })}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            className={mode === m.id ? "is-active" : undefined}
            onClick={() => setMode(m.id)}
          >
            {t(m.labelKey, { defaultValue: m.fallback })}
          </button>
        ))}
        <label className="pf-chart-modes__groupby">
          <input type="checkbox" checked={bySector} onChange={(e) => setBySector(e.target.checked)} />
          {t("portfolioWorkspace.allocation.groupBySector", { defaultValue: "Gom theo ngành" })}
        </label>
      </div>

      {partial && (
        <p className="pf-inline-warning" role="status">
          {t("portfolioWorkspace.allocation.partialHint", {
            defaultValue: "Tỷ trọng chưa đủ 100% vì có mã chưa có giá hôm nay",
          })}
          {unpriced.length > 0 && <> <code>{unpriced.join(", ")}</code></>}
        </p>
      )}

      <PortfolioChart
        kind={mode}
        items={items}
        groupBySector={bySector}
        ariaLabel={t("portfolioWorkspace.allocation.chartLabel", {
          defaultValue: "Phân bổ danh mục theo tỷ trọng giá trị",
        })}
        emptyMessage={t("portfolioWorkspace.allocation.empty", {
          defaultValue: "Chưa có giá để tính phân bổ",
        })}
      />
    </div>
  );
}

export default PortfolioAllocationPage;
