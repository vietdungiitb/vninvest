/**
 * __mocks__/RechartsCompat.tsx — Mock tự động cho `RechartsCompat` trong Vitest.
 *
 * D2 gỡ dependency `recharts`, thay bằng `RechartsCompat` (dùng echarts).
 * ECharts cố vẽ bằng ZRender trong jsdom → lỗi `ZRender._refresh` / `ECharts.setOption`
 * vì jsdom không có canvas/DOM thực.
 *
 * Mock này khiến mọi component chart render thành `<div>` rỗng, đủ cho test
 * điều khiển URL / Zustand state / i18n text mà không cần vẽ biểu đồ thật.
 *
 * Vitest tự động dùng file này khi test file gọi `vi.mock("../charts/RechartsCompat")`
 * (không có factory), vì `__mocks__` nằm ngay cạnh module được mock.
 */

import { createElement, type ReactNode } from "react";

const noop = () => null;
const container = ({ children }: { children?: ReactNode }) =>
  createElement("div", {}, children);

export { container as ResponsiveContainer };
export const BarChart = noop;
export const AreaChart = noop;
export const LineChart = noop;
export const PieChart = noop;
export const Bar = noop;
export const Area = noop;
export const Line = noop;
export const Pie = noop;
export const Cell = noop;
export const XAxis = noop;
export const YAxis = noop;
export const Tooltip = noop;
export const CartesianGrid = noop;
export const Legend = noop;
export const Brush = noop;
export default {
  ResponsiveContainer: container,
  BarChart: noop,
  AreaChart: noop,
  LineChart: noop,
  PieChart: noop,
  Bar: noop,
  Area: noop,
  Line: noop,
  Pie: noop,
  Cell: noop,
  XAxis: noop,
  YAxis: noop,
  Tooltip: noop,
  CartesianGrid: noop,
  Legend: noop,
  Brush: noop,
};
