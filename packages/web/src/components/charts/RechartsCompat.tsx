/**
 * RechartsCompat — lớp tương thích RECHARTS trên nền ECharts.
 *
 * MỤC ĐÍCH (D2 — gỡ dependency `recharts`):
 *   10 file production import API recharts (BarChart/Bar/AreaChart/Area/PieChart/
 *   Pie/Cell/XAxis/YAxis/Tooltip/CartesianGrid/Legend/Brush/ResponsiveContainer).
 *   Thay vì viết lại 10 chart bằng option-object của echarts (≈200 dòng chart
 *   rời rạc, khó so sánh visual), ta dựng MỘT lớp tương thích giữ nguyên
 *   cấu trúc JSX của các file đó. ⇒ diff mỗi file = ĐỔI 1 DÒNG IMPORT.
 *
 * VÌ SAO KHÔNG DÙNG `echarts` trọn:
 *   import từ `echarts/core` + từng component (tree-shake) — cùng pattern đã
 *   dùng ở `components/portfolio/PortfolioChart.tsx:36-56`. Import `echarts` trọn
 *   kéo 700KB vào mọi route (đo được: `measure-route-graph.mjs` → "echarts
 *   711.5 KB bị kẹm trong tải đầu").
 *
 * KHÔNG THÊM DEPENDENCY MỚI: `echarts ^6.0.0` + `echarts-for-react ^3.0.6`
 * đã có sẵn trong `packages/web/package.json`.
 *
 * HỢP ĐỒNG TƯƠNG THÍCH (giữ đúng hành vi recharts mà code đang dựa vào):
 *   - `<ResponsiveContainer>` → div 100%/100% (mặc định) hoặc width/height.
 *   - `<BarChart data margin>` / `<AreaChart data margin>` → grid + series.
 *   - `<PieChart>` + `<Pie data dataKey nameKey label>` + `<Cell fill>`.
 *   - `Tooltip contentStyle/labelFormatter/formatter` → dịch sang tooltip echarts.
 *   - `fill="url(#gradId)"` + `<defs><linearGradient><stop/></defs>` → LinearGradient echarts.
 *   - `<Brush>` → `dataZoom` slider.
 *
 * ⚠ BIÊN DỊCH `Tooltip.formatter` (khác nhau giữa 2 thư viện):
 *   recharts: `formatter(value, name, item) => [value, name] | string`
 *   echarts : `formatter(params) => string` (params = mảng series)
 *   Ta giữ **API recharts** bên ngoài (vì code đã viết theo API đó) và dịch
 *   chiều trong lớp này — nếu đổi chiều, `OrderFlowRadarPanel.js:403` sẽ
 *   format sai số.
 */

import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart as EBarChart, LineChart as ELineChart, PieChart as EPieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { createElement, useMemo, Children, isValidElement, type ReactNode } from "react";

echarts.use([
  EBarChart,
  ELineChart,
  EPieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  LabelLayout,
  CanvasRenderer,
]);

/* ────────────────────────── Kiểu dữ liệu ────────────────────────── */

export type Row = Record<string, unknown>;

export interface AxisTickStyle {
  fontSize?: number;
  fill?: string;
  color?: string;
}

export interface GradientStop {
  offset: number;
  color: string;
  opacity: number;
}

/* ────────────────────────── Marker component (chỉ để đọc props) ────────────────────────── */

/*
 * Marker KHÔNG render gì — chỉ tồn tại để JSX `<XAxis …/>` tạo ra element
 * mà `collectConfig` đọc được `props` của nó.
 *
 * ⚠ So sánh phải theo **reference function**, KHÔNG theo tên chuỗi:
 * `child.type` của `<XAxis/>` là chính function `XAxis`, không phải "XAxis".
 * (Test `recharts-compat-d2` đã bắt được lỗi này — đừng đổi lại.)
 */
export function Bar(_props: SeriesProps): null { return null; }
export function Area(_props: SeriesProps): null { return null; }
export function Line(_props: SeriesProps): null { return null; }
export function Pie(_props: SeriesProps): null { return null; }
export function Cell(_props: { fill?: string }): null { return null; }
export function XAxis(_props: AxisProps): null { return null; }
export function YAxis(_props: AxisProps): null { return null; }
export function Tooltip(_props: TooltipProps): null { return null; }
export function CartesianGrid(_props: GridProps): null { return null; }
export function Legend(_props: LegendProps): null { return null; }
export function Brush(_props: BrushProps): null { return null; }

/* ────────────────────────── Thu thập props từ children ────────────────────────── */

interface AxisProps {
  dataKey?: string;
  tick?: AxisTickStyle;
  interval?: number | "preserveStartEnd" | "preserveEnd";
  axisLine?: boolean;
  tickLine?: boolean;
  stroke?: string;
  width?: number;
  height?: number;
  unit?: string;
  allowDecimals?: boolean;
  tickFormatter?: (value: unknown, index?: number) => string;
}

interface SeriesProps {
  dataKey?: string;
  name?: string;
  nameKey?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: [number, number, number, number] | number;
  stackId?: string;
  type?: string;
  dot?: boolean;
  data?: Row[];
  /**
   * Callback `label` của recharts (Pie): nhận `{ name, percent }`.
   * `percent` là **bắt buộc** (recharts luôn truyền 0..1); buildOption ép
   * `percent ?? 0` để không bao giờ undefined lọt vào code gọi.
   */
  label?: (params: { name?: string; percent: number }) => string;
  labelLine?: boolean;
  cx?: string | number;
  cy?: string | number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  /** className của recharts (không dùng, giữ để tương thích props). */
  className?: string;
  /** children (`<Cell/>` bên trong `<Pie>`). */
  children?: ReactNode;
}

interface TooltipProps {
  contentStyle?: Record<string, unknown>;
  labelStyle?: Record<string, unknown>;
  labelFormatter?: (label: string) => string;
  formatter?: (value: unknown, name: unknown, item: unknown) => unknown;
}

interface GridProps {
  stroke?: string;
  strokeDasharray?: string;
  vertical?: boolean;
}

interface LegendProps {
  wrapperStyle?: Record<string, unknown>;
}

interface BrushProps {
  dataKey?: string;
  height?: number;
  stroke?: string;
  travellerWidth?: number;
}

interface ContainerProps {
  width?: string | number;
  height?: string | number;
  children?: ReactNode;
}

/** `margin` của recharts — grid của echarts dùng grid thay vì margin. */
interface Margin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/* ────────────────────────── Thu thập props từ children ────────────────────────── */

interface ChartConfig {
  xAxis?: AxisProps;
  yAxis?: AxisProps;
  series: SeriesProps[];
  cells: Array<{ fill?: string }>;
  tooltip?: TooltipProps;
  grid?: GridProps;
  legend?: LegendProps;
  brush?: BrushProps;
  gradients: Record<string, GradientStop[]>;
}

/**
 * Đọc props của các child recharts mà KHÔNG render chúng.
 *
 * Vì sao đọc được: `<XAxis dataKey="date"/>` tạo React element với `props`
 * ngay từ lúc JSX được evaluate — trước khi render. Vậy nên ta không cần
 * context (recharts dùng context) mà vẫn lấy đủ cấu hình.
 */
function collectConfig(children: ReactNode): ChartConfig {
  const cfg: ChartConfig = { series: [], cells: [], gradients: {} };
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    const type = child.type as unknown;
    if (type === XAxis) {
      cfg.xAxis = props as AxisProps;
      return;
    }
    if (type === YAxis) {
      cfg.yAxis = props as AxisProps;
      return;
    }
    if (type === Bar || type === Area || type === Line || type === Pie) {
      cfg.series.push(props as SeriesProps);
      return;
    }
    if (type === Cell) {
      cfg.cells.push(props as { fill?: string });
      return;
    }
    if (type === Tooltip) {
      cfg.tooltip = props as TooltipProps;
      return;
    }
    if (type === CartesianGrid) {
      cfg.grid = props as GridProps;
      return;
    }
    if (type === Legend) {
      cfg.legend = props as LegendProps;
      return;
    }
    if (type === Brush) {
      cfg.brush = props as BrushProps;
      return;
    }
    // `<defs>` là element DOM thật → type là string "defs".
    if (type === "defs") {
      collectGradients(props.children as ReactNode, cfg.gradients);
    }
  });
  return cfg;
}

/** `<defs><linearGradient id><stop/></linearGradient></defs>` → map id → stops. */
function collectGradients(node: ReactNode, into: Record<string, GradientStop[]>) {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    const type = child.type as unknown;
    if (type === "linearGradient" && typeof props.id === "string") {
      const stops: GradientStop[] = [];
      Children.forEach(props.children as ReactNode, (stop) => {
        if (!isValidElement(stop)) return;
        const sp = stop.props as Record<string, unknown>;
        if (stop.type !== "stop") return;
        const offsetRaw = String(sp.offset ?? "0%");
        const offset = offsetRaw.endsWith("%")
          ? Number(offsetRaw.slice(0, -1)) / 100
          : Number(offsetRaw);
        stops.push({
          offset: Number.isFinite(offset) ? offset : 0,
          color: String(sp.stopColor ?? "#000000"),
          opacity: typeof sp.stopOpacity === "number" ? sp.stopOpacity : 1,
        });
      });
      into[props.id] = stops;
      return;
    }
    if (type === "stop") return;
    collectGradients(props.children as ReactNode, into);
  });
}

/* ────────────────────────── Dịch style → echarts ────────────────────────── */

function readContentStyle(style: Record<string, unknown> | undefined) {
  if (!style) return {};
  const out: Record<string, unknown> = {};
  if (style.background) out.backgroundColor = style.background;
  if (style.border) {
    const parsed = String(style.border).split(" ").filter(Boolean);
    const width = Number(parsed[0]);
    if (Number.isFinite(width)) out.borderWidth = width;
    const color = parsed[parsed.length - 1];
    if (color) out.borderColor = color;
  }
  if (style.borderRadius !== undefined) out.borderRadius = style.borderRadius;
  if (style.fontSize !== undefined) out.textStyle = { fontSize: style.fontSize };
  if (style.color !== undefined) {
    out.textStyle = { ...(out.textStyle as object | undefined), color: style.color };
  }
  return out;
}

function axisLabelStyle(tick: AxisTickStyle | undefined) {
  if (!tick) return {};
  const out: Record<string, unknown> = {};
  if (tick.fontSize !== undefined) out.fontSize = tick.fontSize;
  const color = tick.fill ?? tick.color;
  if (color) out.color = color;
  return out;
}

/** `fill="url(#id)"` → LinearGradient echarts; ngược lại → chuỗi màu. */
function resolveFill(
  fill: string | undefined,
  gradients: Record<string, GradientStop[]>,
): unknown {
  if (!fill) return undefined;
  const match = /^url\(#([^)]+)\)$/.exec(fill);
  if (!match) return fill;
  const stops = gradients[match[1]];
  if (!stops || stops.length === 0) return undefined;
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

/* ────────────────────────── Tooltip dịch 2 chiều ────────────────────────── */

/**
 * Dịch `Tooltip.formatter` của recharts → echarts.
 *
 * recharts gọi `formatter(value, name, item)` với `value` = giá trị điểm dữ
 * liệu, `name` = tên series, và kỳ vọng trả về `[value, name]` (mảng 2 phần
 * tử) hoặc chuỗi. echarts gọi `formatter(params)` với `params` = mảng item.
 */
function buildTooltipFormatter(tooltip: TooltipProps | undefined) {
  if (!tooltip?.formatter) return undefined;
  const rcFormatter = tooltip.formatter;
  return (params: unknown) => {
    const items = Array.isArray(params) ? params : [params];
    return items
      .map((raw) => {
        const item = raw as {
          value?: unknown;
          seriesName?: unknown;
          axisValue?: unknown;
          name?: unknown;
          dataIndex?: number;
          color?: unknown;
        };
        const label = String(item.axisValue ?? item.name ?? "");
        const out = rcFormatter(item.value, item.seriesName, item);
        if (Array.isArray(out)) return out.map((part) => String(part)).join(" : ");
        if (out === undefined || out === null) return `${label} : ${String(item.value ?? "")}`;
        return String(out);
      })
      .join("<br/>");
  };
}

function buildLabelFormatter(tooltip: TooltipProps | undefined) {
  if (!tooltip?.labelFormatter) return undefined;
  const rcLabel = tooltip.labelFormatter;
  return (params: unknown) => {
    const items = Array.isArray(params) ? params : [params];
    const first = items[0] as { axisValue?: unknown; name?: unknown } | undefined;
    const label = String(first?.axisValue ?? first?.name ?? "");
    return rcLabel(label);
  };
}

/* ────────────────────────── Dựng option ────────────────────────── */

function buildOption(
  kind: "bar" | "area" | "line" | "pie",
  data: Row[],
  cfg: ChartConfig,
  margin?: Margin,
): Record<string, unknown> {
  const xAxisProps = cfg.xAxis;
  const yAxisProps = cfg.yAxis;
  const gridStroke = cfg.grid?.stroke;
  const categories = (data ?? []).map((row) =>
    xAxisProps?.dataKey ? row[xAxisProps.dataKey] : undefined,
  );

  const xAxis = {
    type: "category" as const,
    data: categories,
    axisLabel: {
      ...axisLabelStyle(xAxisProps?.tick),
      ...(xAxisProps?.interval !== undefined ? { interval: xAxisProps.interval } : {}),
      ...(xAxisProps?.stroke ? { color: xAxisProps.stroke } : {}),
    },
    axisLine: { show: xAxisProps?.axisLine !== false },
    axisTick: { show: xAxisProps?.tickLine !== false },
    splitLine: { show: false },
  };

  const yAxis = {
    type: "value" as const,
    axisLabel: {
      ...axisLabelStyle(yAxisProps?.tick),
      ...(yAxisProps?.unit ? { formatter: `{value}${yAxisProps.unit}` } : {}),
      ...(yAxisProps?.tickFormatter
        ? {
            formatter: (value: unknown) =>
              String(yAxisProps?.tickFormatter?.(value) ?? value),
          }
        : {}),
    },
    axisLine: { show: yAxisProps?.axisLine !== false },
    axisTick: { show: yAxisProps?.tickLine !== false },
    ...(yAxisProps?.allowDecimals === false ? { minInterval: 1 } : {}),
    ...(yAxisProps?.width ? { width: yAxisProps.width } : {}),
  };

  const tooltipCfg = cfg.tooltip;
  const tooltip = {
    trigger: "axis" as const,
    ...readContentStyle(tooltipCfg?.contentStyle),
    ...(tooltipCfg?.labelStyle
      ? {
          textStyle: {
            ...((readContentStyle(tooltipCfg?.contentStyle).textStyle as object) ?? {}),
            ...(tooltipCfg.labelStyle as object),
          },
        }
      : {}),
    ...(buildTooltipFormatter(tooltipCfg)
      ? { formatter: buildTooltipFormatter(tooltipCfg) }
      : {}),
    ...(buildLabelFormatter(tooltipCfg)
      ? { axisPointer: { label: { formatter: buildLabelFormatter(tooltipCfg) } } }
      : {}),
  };

  const legend = cfg.legend
    ? {
        show: true,
        textStyle: {
          fontSize: (cfg.legend.wrapperStyle?.fontSize as number) ?? 12,
          color:
            (cfg.legend.wrapperStyle?.color as string) ??
            axisLabelStyle(yAxisProps?.tick).color,
        },
        ...(cfg.legend.wrapperStyle?.paddingTop !== undefined
          ? { top: cfg.legend.wrapperStyle.paddingTop }
          : {}),
      }
    : { show: false };

  const dataZoom = cfg.brush
    ? [
        {
          type: "slider" as const,
          xAxisIndex: 0,
          height: cfg.brush.height ?? 20,
          borderColor: cfg.brush.stroke,
          ...(cfg.brush.travellerWidth ? { handleSize: cfg.brush.travellerWidth } : {}),
          ...(xAxisProps?.dataKey
            ? { start: 0, end: 100 }
            : { start: 0, end: 100 }),
        },
      ]
    : [];

  if (kind === "pie") {
    const pie = cfg.series[0];
    const nameKey = pie?.nameKey as string | undefined;
    const dataKey = pie?.dataKey as string | undefined;
    const rows = (pie?.data ?? []) as Row[];
    const pieData = rows.map((row, index) => ({
      name: nameKey ? String(row[nameKey] ?? "") : String(row.name ?? ""),
      value: dataKey ? Number(row[dataKey] ?? 0) : 0,
      ...(cfg.cells[index]?.fill ? { itemStyle: { color: cfg.cells[index]?.fill } } : {}),
    }));
    const labelFn = pie?.label;
    return {
      tooltip: { trigger: "item" as const, ...readContentStyle(tooltipCfg?.contentStyle) },
      legend: { show: false },
      series: [
        {
          type: "pie" as const,
          radius: pie?.innerRadius
            ? [String(pie.innerRadius), String(pie.outerRadius ?? "70%")]
            : String(pie?.outerRadius ?? "70%"),
          center: [String(pie?.cx ?? "50%"), String(pie?.cy ?? "50%")],
          data: pieData,
          ...(labelFn
            ? {
                label: {
                  formatter: (params: { name?: string; percent?: number }) =>
                    labelFn({
                      name: params.name,
                      percent: params.percent ?? 0,
                    }),
                },
              }
            : {}),
          ...(pie?.labelLine === false ? { labelLine: { show: false } } : {}),
        },
      ],
    };
  }

  const series = cfg.series.map((s) => {
    const values = (data ?? []).map((row) =>
      s.dataKey ? row[s.dataKey] : undefined,
    );
    if (kind === "area") {
      return {
        type: "line" as const,
        name: s.name,
        data: values,
        smooth: s.type === "monotone",
        stack: s.stackId,
        showSymbol: s.dot !== false,
        symbolSize: 4,
        lineStyle: { color: s.stroke, width: s.strokeWidth ?? 2 },
        itemStyle: { color: s.stroke },
        areaStyle: { color: resolveFill(s.fill, cfg.gradients) ?? s.stroke },
      };
    }
    return {
      type: "bar" as const,
      name: s.name,
      data: values,
      stack: s.stackId,
      itemStyle: {
        color: s.fill,
        ...(s.radius ? { borderRadius: s.radius } : {}),
      },
    };
  });

  return {
    grid: {
      top: margin?.top ?? 24,
      right: margin?.right ?? 16,
      bottom: margin?.bottom ?? 24,
      left: margin?.left ?? 8,
      containLabel: true,
    },
    tooltip,
    legend,
    ...(dataZoom.length ? { dataZoom } : {}),
    xAxis,
    yAxis,
    ...(cfg.grid
      ? {
          ...(gridStroke
            ? {
                splitLine: {
                  show: true,
                  lineStyle: {
                    color: gridStroke,
                    ...(cfg.grid.strokeDasharray
                      ? { type: "dashed" as const }
                      : {}),
                  },
                },
              }
            : {}),
        }
      : {}),
    series,
  };
}

/* ────────────────────────── Component xuất ra ────────────────────────── */

/** Thay cho `<ResponsiveContainer>` của recharts. */
export function ResponsiveContainer({ width, height, children }: ContainerProps) {
  return createElement(
    "div",
    {
      style: {
        width: width ?? "100%",
        height: height ?? "100%",
        minHeight: typeof height === "number" ? height : undefined,
      },
    },
    children,
  );
}

function ChartHost({
  kind,
  data,
  cfg,
  height,
  margin,
}: {
  kind: "bar" | "area" | "line";
  data: Row[];
  cfg: ChartConfig;
  height: number | string;
  margin?: Margin;
}) {
  const option = useMemo(
    () => buildOption(kind, data, cfg, margin),
    [kind, data, cfg, margin],
  );
  return createElement(
    "div",
    { style: { width: "100%", height } },
    createElement(ReactEChartsCore, {
      echarts,
      option,
      style: { width: "100%", height: "100%" },
      opts: { renderer: "canvas" },
      notMerge: true,
    }),
  );
}

export function BarChart({
  data = [],
  children,
  height = 260,
  margin,
}: {
  data?: Row[];
  children?: ReactNode;
  height?: number | string;
  margin?: Margin;
}) {
  const cfg = useMemo(() => collectConfig(children), [children]);
  return createElement(ChartHost, { kind: "bar", data, cfg, height, margin });
}

export function AreaChart({
  data = [],
  children,
  height = 260,
  margin,
}: {
  data?: Row[];
  children?: ReactNode;
  height?: number | string;
  margin?: Margin;
}) {
  const cfg = useMemo(() => collectConfig(children), [children]);
  return createElement(ChartHost, { kind: "area", data, cfg, height, margin });
}

export function LineChart({
  data = [],
  children,
  height = 260,
  margin,
}: {
  data?: Row[];
  children?: ReactNode;
  height?: number | string;
  margin?: Margin;
}) {
  const cfg = useMemo(() => collectConfig(children), [children]);
  return createElement(ChartHost, { kind: "line", data, cfg, height, margin });
}

export function PieChart({
  children,
  height = 260,
}: {
  children?: ReactNode;
  height?: number | string;
}) {
  const cfg = useMemo(() => collectConfig(children), [children]);
  const option = useMemo(() => buildOption("pie", [], cfg), [cfg]);
  return createElement(
    "div",
    { style: { width: "100%", height } },
    createElement(ReactEChartsCore, {
      echarts,
      option,
      style: { width: "100%", height: "100%" },
      opts: { renderer: "canvas" },
      notMerge: true,
    }),
  );
}

/* Marker — không render gì, chỉ để `collectConfig` đọc props.
 * Khai báo ở trên (nhóm marker) để `collectConfig` so sánh được reference. */

/** Export cho test — KHÔNG dùng ở code production. */
export const __collectConfigForTest = collectConfig;
export const __buildOptionForTest = buildOption;

export default {
  ResponsiveContainer,
  BarChart,
  AreaChart,
  LineChart,
  PieChart,
  Bar,
  Area,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Brush,
};
