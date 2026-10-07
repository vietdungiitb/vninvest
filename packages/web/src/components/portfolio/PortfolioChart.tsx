/**
 * S-03 - Chart contract cho Portfolio workspace, tren ECharts.
 *
 * ⚠ VÌ SAO KHÔNG DÙNG `vninvestcharts-widget` (D1 - đảo kiến trúc của plan v2):
 *
 * Widget 1.2.5 KHÔNG export component series nào. Đo export surface thật:
 *   node --input-type=module -e "import('vninvestcharts-widget').then(m=>console.log(Object.keys(m).length))"
 *   → 29
 *   → BaseAdapter, DjangoVnstockAdapter, MeasurementOverlay, MockAdapter,
 *     PaperTradePanel, SettingsModal, UDFDataAdapter, VNInvestCharts,
 *     VNInvestMultiCharts, WidgetEmptyState, WidgetErrorBoundary,
 *     WidgetI18nContext, WidgetI18nProvider, WorkspaceSerializer,
 *     createLocalStorageAdapter, createMockBars, createRestAdapter,
 *     evaluateRuntimePolicy, getIndicator, injectVNInvestChartsCSS,
 *     isDrawingToolName, listDrawingTools, registerIndicator,
 *     resolveRequestedRuntime, shouldForceLegacyRuntime, useWidgetI18n,
 *     version, widgetMessagesEn, widgetMessagesVi
 *
 * KHÔNG CÓ: Line, Area, Bar, Comparison, Treemap, Sunburst, Donut.
 * `registerSeries("Comparison", {component: () => null})` trong `dist/index.js:19271`
 * là registry NỘI BỘ của engine, KHÔNG phải export cho app.
 *
 * Plan v2 xây cả chiến lược chart (T1-T6) trên API không tồn tại. Đây là
 * hazard 7 lặp lần thứ 3: đọc *tên* trong bundle rồi kết luận *API có*.
 * Cách đúng là liệt kê `Object.keys(module)`.
 *
 * ECharts đã là dependency sẵn (`echarts ^6.0.0`, `echarts-for-react ^3.0.6`)
 * và có sẵn pattern tree-shake trong repo tại `WhaleBubbleChart.jsx:17-28`.
 * Không thêm dependency mới. KHÔNG sửa package.json (deny-list).
 *
 * IMPORT ĐÚNG CÁCH: import từ `echarts/core` + từng component, KHÔNG import
 * `echarts` trọn — vì sao xem `docs/evidence` Entry B3 (echarts 623 KB từng
 * bị nạp ở mọi route do `__vitePreload` của Vite gán nhầm chunk).
 */

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart, TreemapChart, SunburstChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

// Đăng ký đúng phần dùng. Chart nào không được import ở đây sẽ ném lỗi lúc
// runtime thay vì âm thầm vẽ trống — đó là điều ta muốn.
echarts.use([
  LineChart, BarChart, PieChart, TreemapChart, SunburstChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DatasetComponent,
  LabelLayout, UniversalTransition, CanvasRenderer,
]);

/** 1 điểm NAV. `nav` là **string** khi lấy từ API — BE trả
 *  `'nav': str(round(nav, 2))` (`portfolio_analytics_views.py:477`) nên
 *  `typeof nav === "number"` loại RÚI mọi điểm ⇒ chart luôn trống (audit B1).
 */
export interface NavPoint {
  date: string;
  nav: number | string | null;
}

export type PortfolioChartKind = "line" | "bar" | "treemap" | "sunburst" | "pie";

export interface PortfolioChartProps {
  kind: PortfolioChartKind;
  /** Chuỗi NAV. `nav: null` = ngày thiếu giá ⇒ BỎ QUA, không vẽ 0. */
  points?: NavPoint[];
  /** Phân bổ. Mỗi mục cần `industry` (S-00c) để group-by ngành. */
  items?: Array<{ name: string; value: number; industry?: string }>;
  /**
   * Gom `items` theo `industry` trước khi vẽ (treemap/sunburst/pie).
   *
   * Phải là MỘT chỗ duy nhất: nếu trang đã gom sẵn rồi chart gom lần hai thì
   * mọi mục đã mất `industry` ⇒ tất cả rơi vào "Chưa phân ngành" và checkbox
   * "gom theo ngành" hành động ngược (audit B3).
   */
  groupBySector?: boolean;
  /** Đơn vị tiền tệ, dùng trong tooltip. */
  valueFormat?: (v: number) => string;
  height?: number;
  /** Bảng màu lấy từ token `--pf-chart-*` (xem `soc.tokens.css`). */
  colors?: string[];
  ariaLabel: string;
  /** Chuỗi hiện khi chart rỗng (i18n của trang truyền vào). */
  emptyMessage?: string;
}

/**
 * Bỏ các điểm `nav: null` và chỉ giữ ngày có dữ liệu.
 *
 * Vì sao quan trọng: nếu đổi `null` thành 0 thì biểu đồ sẽ "rơi" xuống sàn 0
 * đúng những ngày hệ thống chưa biết giá — trông như danh mục sụp sàn.
 * Đây đúng là loại lỗi mà gate "bars render" không bắt được.
 *
 * BE trả `nav` dạng chuỗi (`str(round(nav, 2))`), nên phải ép kiểu CÓ KIỂM SOÁT:
 * `Number("")` = 0 và `Number("abc")` = NaN, cả hai đều phải bị loại, không
 * được biến thành điểm dữ liệu.
 */
export function usableNavPoints(points: NavPoint[] | undefined): Array<{ date: string; nav: number }> {
  if (!Array.isArray(points)) return [];
  const out: Array<{ date: string; nav: number }> = [];
  for (const p of points) {
    if (!p || typeof p.date !== "string") continue;
    if (p.nav === null || p.nav === undefined || p.nav === "") continue;
    const n = typeof p.nav === "number" ? p.nav : Number(String(p.nav).trim());
    if (!Number.isFinite(n)) continue;
    out.push({ date: p.date, nav: n });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Gom mã theo ngành. Ngành rỗng gom vào `unclassifiedLabel`, KHÔNG gom vào "Khác" giả. */
export function groupByIndustry(
  items: Array<{ name: string; value: number; industry?: string }>,
  unclassifiedLabel = "Chưa phân ngành",
): Array<{ name: string; value: number }> {
  const buckets = new Map<string, number>();
  for (const it of items ?? []) {
    if (typeof it?.value !== "number" || !Number.isFinite(it.value) || it.value <= 0) continue;
    const key = it.industry && it.industry.trim() ? it.industry : unclassifiedLabel;
    buckets.set(key, (buckets.get(key) ?? 0) + it.value);
  }
  return [...buckets.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function readTokenColor(name: string, fallback: string): string {
  if (typeof document === "undefined" || !document.documentElement) return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function buildOption(props: PortfolioChartProps): Record<string, unknown> {
  const {
    kind, points, items, valueFormat, colors, ariaLabel, groupBySector,
  } = props;
  const fmt = valueFormat ?? ((v: number) => String(v));
  const palette = colors ?? [
    readTokenColor("--pf-chart-1", "#22d3ee"),
    readTokenColor("--pf-chart-2", "#34d399"),
    readTokenColor("--pf-chart-3", "#f59e0b"),
    readTokenColor("--pf-chart-4", "#a855f7"),
    readTokenColor("--pf-chart-5", "#f472b6"),
  ];

  // Chế độ cột: đầu vào là `items` (phân bổ theo mã/ngành), KHÔNG phải `points`.
  // Trước đây nhánh này đọc `points` trong khi trang Phân bổ truyền `items`
  // ⇒ biểu đồ luôn rỗng (audit B2).
  if (kind === "bar") {
    const rows = (items ?? [])
      .filter((i) => typeof i?.value === "number" && Number.isFinite(i.value) && i.value > 0)
      .sort((a, b) => b.value - a.value);
    return {
      aria: { enabled: true, description: ariaLabel },
      grid: { left: 56, right: 16, top: 16, bottom: 56 },
      tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? fmt(v) : "—") },
      xAxis: { type: "category", data: rows.map((r) => r.name) },
      yAxis: { type: "value" },
      series: [{
        type: "bar",
        name: ariaLabel,
        data: rows.map((r) => r.value),
        itemStyle: { color: palette[0] },
      }],
    };
  }

  if (kind === "line") {
    const usable = usableNavPoints(points);
    return {
      // Không có title trong chart: tiêu đề do `<h2>` của trang đảm nhiệm,
      // để screen reader không đọc trùng.
      aria: { enabled: true, description: ariaLabel },
      grid: { left: 56, right: 16, top: 16, bottom: 32 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) => (typeof v === "number" ? fmt(v) : "—"),
      },
      xAxis: { type: "category", data: usable.map((p) => p.date) },
      yAxis: { type: "value", scale: true },
      series: [{
        type: "line",
        name: ariaLabel,
        data: usable.map((p) => p.nav),
        showSymbol: false,
        smooth: true,
        areaStyle: { opacity: 0.12 },
        itemStyle: { color: palette[0] },
      }],
    };
  }

  // Gom theo ngành ở ĐÂY, đúng một lần (xem ghi chú `groupBySector`).
  const grouped = groupBySector
    ? groupByIndustry(items ?? [])
    : (items ?? [])
        .filter((i) => typeof i?.value === "number" && Number.isFinite(i.value) && i.value > 0)
        .map((i) => ({ name: i.name, value: i.value }))
        .sort((a, b) => b.value - a.value);

  if (kind === "pie") {
    return {
      aria: { enabled: true, description: ariaLabel },
      tooltip: { trigger: "item", valueFormatter: (v: unknown) => (typeof v === "number" ? fmt(v) : "—") },
      series: [{
        type: "pie",
        name: ariaLabel,
        radius: ["42%", "70%"],
        data: grouped,
        label: { show: true },
        itemStyle: { borderWidth: 1 },
      }],
    };
  }

  return {
    aria: { enabled: true, description: ariaLabel },
    tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? fmt(v) : "—") },
    series: [{
      type: kind,
      name: ariaLabel,
      data: grouped,
      roam: kind === "treemap",
      nodeClick: kind === "treemap" ? "zoomToNode" : undefined,
      breadcrumb: kind === "treemap" ? { show: true } : undefined,
      label: { show: true },
      itemStyle: { borderWidth: 1 },
      levels: kind === "sunburst" ? [{}, { itemStyle: { borderWidth: 2 } }] : undefined,
    }],
  };
}

/** Chart có gì để vẽ không — trả về lý do để trang hiện chữ thay vì khung rỗng. */
export function emptyReason(props: PortfolioChartProps): string | null {
  const { kind, points, items } = props;
  if (kind === "line") {
    return usableNavPoints(points).length >= 2 ? null : "insufficient_nav_history";
  }
  const usable = (items ?? []).filter((i) => typeof i?.value === "number" && i.value > 0);
  return usable.length > 0 ? null : "no_market_prices";
}

export function PortfolioChart(props: PortfolioChartProps) {
  const option = useMemo(() => buildOption(props), [props]);
  const reason = useMemo(() => emptyReason(props), [props]);

  if (reason) {
    return (
      <div
        className="pf-chart-empty"
        style={{ height: props.height ?? 320 }}
        role="status"
        data-reason={reason}
      >
        {props.emptyMessage ?? "Chưa có dữ liệu để hiển thị"}
      </div>
    );
  }

  return (
    <div
      className="pf-chart"
      role="img"
      aria-label={props.ariaLabel}
      style={{ height: props.height ?? 320 }}
    >
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
      />
    </div>
  );
}

export default PortfolioChart;
