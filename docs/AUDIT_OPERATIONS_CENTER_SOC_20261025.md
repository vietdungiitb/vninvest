# AUDIT & ĐÁNH GIÁ — Module Operations Center (SOC DataOps)

**Ngày:** 2026-10-25  
**Phạm vi:** `ShellOperationsCenterPage`, `SocDataOpsPanel`, `DataOpsContext`, SOC client adapter, backend `service_ops` (planner/urls/tasks), Celery/Redis/PostgreSQL.  
**Diagram bằng chứng:**
- Architecture: `.archify/architecture-operations-center-20261025-090000/operations-center-architecture.html`
- Dataflow: `.archify/dataflow-operations-center-20261025-090000/operations-center-dataflow.html`

## 1. Mục tiêu

Ghi lại đánh giá codebase và hướng giải pháp nâng cấp cho module Operations Center, để làm bằng chứng và theo dõi cho các công việc tiếp theo. Không chỉ lưu trong chat.

## 2. Trạng thái hiện tại

- Parity legacy: ~95%+, 9 tab SOC đã có (`ShellOperationsCenterPage.tsx:26-36`).
- Kiến trúc: FE shell → SOC client adapter → Django `service_ops` → Celery/Redis/PostgreSQL, có audit trail.
- Rủi ro chính: UX đồng bộ tab, thiếu realtime refresh, bundle lớn, module backend quá lớn.

## 3. Findings

### P0

#### F1. Tab router có 2 nguồn sự thật (URL + localStorage)
- Bằng chứng: `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx:42-71`
- Ảnh hưởng: deep-link/back-forward/localStorage cũ lệch nhau.
- Giải pháp: dùng `react-router useSearchParams` làm nguồn duy nhất; bỏ hoặc hydrate 1 chiều; thêm test deep-link.

#### F2. DataOps chỉ load dữ liệu một lần khi mount
- Bằng chứng: `packages/web/src/components/soc/DataOpsContext.tsx:176-183`
- Ảnh hưởng: operator chạy backfill nhưng UI không tự cập nhật runs/inventory.
- Giải pháp: polling có điều kiện theo visibility/active subtab; dừng khi tab ẩn; cleanup; cân nhắc SSE/stream URL.

#### F3. Signals live feed thực chất tĩnh
- Ảnh hưởng: “Luồng trực tiếp” không live.
- Giải pháp: polling/websocket qua `getSocSignalStreamUrl()` hoặc `getSocDataOpsStreamUrl()`.

#### F4. Nhãn hardcode chưa i18n
- Bằng chứng: `ShellOperationsCenterPage.tsx:118-122`
- Giải pháp: đưa `"OPERATIONS CENTER"`, `"LIVE"` vào `vi.js`/`en.js`.

### P1

#### F5. Bundle SOC lớn, chưa code-split tab
- Ảnh hưởng: chunk ~128KB, tải đầu lớn.
- Giải pháp: `React.lazy` + `Suspense` cho panel/tab, prefetch khi hover.

#### F6. `soc.js` adapter 864 dòng, nhiều domain trong một file
- Bằng chứng: `packages/web/src/adapters/core/soc.js`
- Giải pháp: tách theo domain và re-export từ `soc.js`.

#### F7. `SocRuntimeKpiPanel` gọi adapter trực tiếp
- Bằng chứng: `SocRuntimeKpiPanel.tsx:49-52`
- Giải pháp: thêm `getSocSloOverview` vào SOC client adapter và dùng thống nhất.

#### F8. `service_ops/urls.py` và `tasks.py` quá lớn
- Bằng chứng: `urls.py` 1-190; `tasks.py` 1361 dòng.
- Giải pháp: split URL includes và tasks theo domain.

#### F9. Error state chưa surface đồng nhất
- Bằng chứng: `DataOpsContext` có `errors` per-domain nhưng UI chưa đồng nhất.
- Giải pháp: banner lỗi ở panel level + retry + telemetry.

### P2

#### F10. Tablist tốt nhưng còn hardcoded/race
- Giải pháp: fix F1 trước, sau đó focus management (`aria-controls`, arrow keys).

#### F11. Runtime KPI không còn “coming soon”
- Bằng chứng: `SocRuntimeKpiPanel.tsx` đã render SLO sparkline.
- Giải pháp: cập nhật docs/audit stale; thêm empty-state guidance.

#### F12. Ownership/audit cần verify fail-closed
- Bằng chứng: `dataops_planner.py:276-282`
- Giải pháp: integration tests cho deny non-staff, ownership false, audit append.

## 4. Roadmap

### Giai đoạn A (1-2 sprint)
1. F1 unify tab router.
2. F4 i18n.
3. F2 polling DataOps.
4. F3 signals live feed.

### Giai đoạn B (2-3 sprint)
1. F5 code-split.
2. F6 split soc adapter.
3. F7 runtime KPI client.
4. F9 error state.

### Giai đoạn C (ongoing)
1. F8 split backend urls/tasks.
2. F12 integration tests.
3. F11 docs update.

## 5. Test recommendations

- Deep-link: `/operations-center?tab=dataops&dataops_tab=monitor`.
- Back/forward tab sync.
- Polling lifecycle: unmount/h hidden pause.
- Planner ownership deny.
- SOC client shape for SLO overview.

## 6. Ghi chú sơ đồ

- Dataflow diagram đã bỏ node `market_feed` để tránh crossing layout, nhưng code thật ingest từ sàn trong Celery (`tasks.py:1059-1170`).
- `soc.module.css` chỉ là barrel 3 dòng; token/class phải thêm vào `soc.tokens.css`/`soc.components.css`.

## 7. Quy định cứng liên quan

Mọi đánh giá, audit, plan, kết luận kỹ thuật phải được ghi thành tài liệu trong repo (như file này) để làm bằng chứng và theo dõi. Không chỉ lưu trong chat.