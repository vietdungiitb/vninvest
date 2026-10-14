# ADR-001 — RouteId Theo `routeCatalog` (D-01)

- **Ngày:** 2026-10-13 · **Người chốt:** Owner (qua audit 360, thực thi claim `audit-followup-5q`).
- **Ngữ cảnh:** `main.tsx` dùng id registry cũ (`portfolio-workspace`,
  `core-portfolios`) trong khi `routeCatalog.js` đã định nghĩa id catalog
  (`portfolios`, `portfolios-manage`) — id-drift, route mới không có entry.
- **Quyết định:** `main.tsx` dùng id catalog cho mọi route; resolver map id
  catalog → id registry cũ nên render không đổi. Mọi route mới phải có entry
  `routeCatalog` + `requiredCapabilities`.
- **Lý do:** một nguồn sự thật cho route (L-G07: đếm/đọc route từ registry,
  không từ tên file).
- **Hệ quả:** contract test khóa 2 chiều catalog ↔ `main.tsx`; gate
  `check-shell.mjs` giữ nguyên assert registry cũ.
