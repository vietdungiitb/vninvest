# S2-AC3 — Click repro: widget onClick có bắn khi click nến?

- **Date**: 2026-11-21 · **Kết luận source-level**: CÓ (xác minh bằng source, L-V02).
- **Bằng chứng** (`packages/web/node_modules/@vninvestcharts/widget/dist/index.js` @0.4.4):
  - React-stockcharts `Chart` gọi `this.props.onClick?.(moreProps, event)` trên mọi sự kiện
    canvas `click` (dist `index.js` ~40660: `case"click":{...this.props.onClick?.(s,n);break}`).
  - Widget tổng hợp payload click từ toạ độ canvas: `currentItem: Ue===null?void 0:d[Ue]`
    (dist ~368121, trong `useWidgetInteractions`-like `fe=wr((Z,De)=>{...})`,
    `Qe=Pg(...)` hit-test pane, `Ue=T6(...)` map index), đúng shape
    `VNInvestChartsProps.d.ts:142-147` (`{currentItem?: EnrichedDatum, ...}`),
    `EnrichedDatum extends RawOHLCV {date: Date}`.
  - Public prop được forward: `onClick:e.onClick` (dist ~872918, container → fork/interaction runtime).
- **Giới hạn**: đây là chứng minh tĩnh. Click runtime trên staging (có bật drawing-tool,
  crosshair, pan) **CHƯA CHẠY** — cần feat deploy + thao tác tay theo B7 plan
  (click 3 nến TPB → banner + bubble + feed cùng ngày). Nếu runtime phát hiện sự kiện
  bị nuốt khi drawing-tool active, mở ticket riêng (không thuộc S1/S2).
- **Phòng thủ đã code theo**: `resolveSessionFromChartItem` guard `date` invalid → `null`,
  `handleClick` bỏ qua khi `null` (không set session rác khi click vùng trống).
