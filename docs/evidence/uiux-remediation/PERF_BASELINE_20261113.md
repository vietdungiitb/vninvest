# C1 — Perf baseline sau D2/D3 (2026-11-13)

> Build local `packages/web/dist` (tsc + vite, 2026-11-13). Đo bằng
> `node scripts/measure-route-graph.mjs <route>` (BFS cạnh import TĨNH).
> **Chưa gzip breakdown** ngoài log build; số dưới là KB chưa nén.

## 1. Bundle tổng (top chunks, build 2026-11-13)

| Chunk | Size | Ghi chú |
|---|---|---|
| RightSidebarDockHost | 1921.5 KB | widget dock host (lazy? cần verify) |
| echarts | 711.5 KB | treeshake core+3 charts+components; D2 shim dùng chung chunk này |
| i18n | 564.1 KB (537KB ở build sau D3) | monolith → D3 split file nhưng import tĩnh nên chunk không đổi |
| xlsx | 419.4 KB | chỉ cần ở 1-2 route export |
| StrategyTesterPanel | 308.3 KB | — |
| react-vendor | 270.2 KB | — |
| RechartsCompat (mới, D2) | 6.9 KB | shim, không còn chunk recharts riêng → **D2 xong** |

## 2. Initial load theo route

| Route | Tổng initial | Nặng nhất | Kết luận |
|---|---|---|---|
| dashboard | 1967.0 KB | echarts 711.5 + i18n 564.1 | CÓ echarts trong tải đầu |
| TenantAdminHomePage | 2100.5 KB | echarts 711.5 + i18n 564.1 | CÓ echarts trong tải đầu |
| PortfolioWorkspacePage | ~1900 KB | echarts 711.5 | CÓ echarts trong tải đầu |
| AdminAnalyticsPage | — | echarts 711.5 + RechartsCompat 6.9 | CÓ echarts trong tải đầu |

## 3. Nguyên nhân echarts vẫn trong tải đầu (sau D2)

1. `RechartsCompat.tsx` import `echarts/core` **tĩnh** → mọi route dùng chart compat đều kéo echarts.
2. `PortfolioHeatmap.js`, `WhaleBubbleChart.jsx`, `PortfolioChart.tsx` import echarts **tĩnh**.
3. `manualChunks` chỉ tách file, không ngăn `modulepreload` (ghi chú trong script đo).

## 4. Hướng giảm (ngoài scope D2/D3 — ticket follow-up)

- **C2-chart-defer**: bọc block chart trong `lazy()` + `import()` động ở 10 trang compat + PortfolioChart/Heatmap/WhaleBubble. Ước tính −700KB initial ở route không cần chart ngay.
- **xlsx**: chỉ `import()` khi bấm Export (hiện chunk riêng nhưng vẫn bị preload ở 1 số route — cần đo lại sau defer).
- **i18n lazy namespace**: cần async loader + Suspense (C3). D3 split file chỉ giảm merge-conflict, không giảm bundle.
- **RightSidebarDockHost 1.9MB**: kiểm tra có lazy được không (widget host).

## 5. Lệnh tái tạo

```
cd packages/web && npm run build
node scripts/measure-route-graph.mjs dashboard
node scripts/measure-route-graph.mjs TenantAdminHomePage
node scripts/measure-route-graph.mjs PortfolioWorkspacePage
node scripts/measure-route-graph.mjs AdminAnalyticsPage
```
