# Phản biện độc lập: `docs/ALERT_CENTER_IMPLEMENTATION_PLAN_20260719.md`

> **Ngày**: 2026-07-19
> **Phạm vi**: Plan 18 slice / 4 phase — Alert Center post-UI-refactor
> **Phương pháp**: Đọc + grep + đối chiếu codebase (AGENTS.md AI Audit Framework)

---

## Phase 0 Evidence Table — Verified

| Claim | Status | Evidence |
|-------|--------|----------|
| 7 endpoint ở `signal_intelligence/urls.py` | ✅ | `urls.py:6-12` — feed, summary, symbol-stats, events, ack, context, mute |
| `coreApiAdapter.d.ts` chưa có method alert-center | ✅ | 0 matches cho `getAlertCenter*` |
| Cast `as unknown as Record` | ✅ | `AlertCenterPage.tsx:20` |
| WS `useRealtimeFeedCore` đã wire | ✅ | `hooks/useAlertCenterRealtime.js` + page dùng |
| `@tanstack/react-query v5.101.2` | ✅ | `package.json:59` |
| `react-window` chưa cài | ✅ | `package.json` — không có |
| `vninvestcharts-widget` đã có | ✅ | `package.json:92` `^1.2.5` |

---

## 🚩 6 Findings

### F1 — `soc.bannerError` không tồn tại | Mức: **CAO**

- **Plan viết** (A2, dòng 50): "Error state dùng `soc.banner` + `bannerError`".
- **Thực tế**: `soc.module.css` **KHÔNG** có class `.bannerError`. Các class gần nhất:
  - `inlineError` — DataOps-specific layout
  - `schedulerActionBannerError` — Scheduler-specific
  - `statusBadgeDanger` — badge pill, không phải banner
- **Tác động**: Code implement A2 sẽ dùng class không tồn tại → error state không style → UX lỗi.
- **Fix**:
  1. Thêm `.bannerError` vào `soc.module.css` trước khi chạy A2 (recommended)
  2. Hoặc dùng `inlineError` layout có sẵn cho error banner

---

### F2 — `soc.heroBadge` không tồn tại | Mức: **CAO**

- **Code hiện tại**: `AlertCenterPage.tsx:376` dùng `className: \`\${soc.heroBadge}\``
- **Thực tế**: `soc.module.css` chỉ có `.overviewHeroBadge`, **không có `.heroBadge`**
- **Tác động**: CSS module resolve `soc.heroBadge` → `undefined` → live badge không style. Không crash nhưng mất visual.
- **Verification mù**: Plan dòng 43 grep `"heroBadge"` sẽ PASS (match ở AlertCenterPage.tsx) nhưng **không detect** class thiếu trong CSS.
- **Fix**: Sửa `soc.heroBadge` → `soc.overviewHeroBadge` ở AlertCenterPage.tsx. Làm ngay (P0) hoặc trong A1.

---

### F3 — `soc.btnPrimary` / `soc.btnSecondary` không tồn tại | Mức: **CAO**

- **Code hiện tại**: `AlertCard.js:93` dùng `soc.btnPrimary`, `AlertCard.js:105,117` dùng `soc.btnSecondary`
- **Thực tế**: `soc.module.css` **KHÔNG** có class `.btnPrimary` hoặc `.btnSecondary`
- **Tác động**: Button actions (Acknowledge / Mute / View Detail) không style SOC → render mặc định. Ảnh hưởng cả B1 (bulk actions) nếu tái dụng pattern.
- **Fix**: Thêm `.btnPrimary`/`.btnSecondary` vào `soc.module.css`, hoặc thay bằng `actionBtn`/`runBtn` có sẵn.

---

### F4 — Critical path C2→C3 trước C5 là suboptimal | Mức: **TRUNG BÌNH**

- **Plan viết** (dòng 330): Critical path `C1 → C2 → C3`.
- **Phân tích**: C2 (virtualize feed) cần data không re-render toàn bộ. Nhưng C5 (React Query cache) chưa làm → feed vẫn poll 5s thủ công (`setInterval`) → mỗi poll trigger re-render toàn bộ `FixedSizeList` → mất lợi ích virtualize.
- **Tác động**: Effort làm C2 bị giảm hiệu quả nếu C5 chưa có. Render lại 1000 row mỗi 5s sẽ gây giật.
- **Fix**: Chuyển C5 lên trước C2, hoặc gộp vào cùng phase. Ít nhất ghi rõ "C2 phải kết hợp `React.memo` + kiểm soát polling" trong acceptance.

---

### F5 — Thiếu WS event contract reference | Mức: **THẤP**

- **Plan**: Slice B2 (notification) và B3 (custom rules) phụ thuộc shape WS event (`severity`, `event_type`, `symbol`, `triggered_at`, ...)
- **Thực tế**: Không tham chiếu `docs/WEBSOCKET_EVENT_CONTRACT.md` (file tồn tại, định nghĩa `whale_alert`, `dark_flow_alert` event shape)
- **Tác động**: Dev implement B2/B3 sẽ đoán shape thay vì đọc spec.
- **Fix**: Thêm dòng vào scope B2/B3: "Tham chiếu `docs/WEBSOCKET_EVENT_CONTRACT.md` để parse event shape".

---

### F6 — Ledger reference sai canonical location | Mức: **THẤP**

- **Plan viết** (dòng 312, Quality Gate 6): "thêm entry vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`".
- **Thực tế**: Root `CODE_CHANGE_AUDIT_LEDGER.md` và `docs/CODE_CHANGE_AUDIT_LEDGER.md` có hash **khác nhau** (từ audit độc lập trước). File canonical là root, `docs/` là stale copy.
- **Tác động**: Entry mới ghi vào file `docs/` sẽ không đồng bộ với root.
- **Fix**: Xoá `docs/CODE_CHANGE_AUDIT_LEDGER.md` (stale), ghi rõ canonical là `CODE_CHANGE_AUDIT_LEDGER.md` (root).

---

## Đánh giá tổng thể

| Tiêu chí | Điểm | Ghi chú |
|----------|------|---------|
| Cấu trúc | 10/10 | Slice rõ, 5 trường, dependency graph, quality gates |
| Độ chính xác (evidence) | 9/10 | Phase 0 đúng 7/7 claim |
| Khả thi | 7/10 | F1-F3 cần CSS class mới hoặc sửa reference hiện tại |

**Must-fix trước khi chạy Phase A:**
- F2 + F3: heroBadge, btnPrimary, btnSecondary không resolve → thêm class hoặc sửa reference code cũ
- F1: bannerError cần tạo class mới hoặc chọn alternative

**Recommended reordering:**
- C5 (React Query) lên trước hoặc song song C2 (virtualize) — không thì virtualize kém hiệu quả

**Slice A1 nên mở rộng:** Verify cả F2/F3 (CSS class thiếu) cùng lúc với verify dev render, tránh phát hiện muộn.
