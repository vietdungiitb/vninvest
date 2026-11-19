# PLAN — Header realtime indicator phân biệt 5 trạng thái (R1)

- **Ngày**: 2026-11-19 · **Nguồn**: `docs/DIAGNOSIS_OFFLINE_404_DATAOPS_20261119.md` (Entry 558) · **Ưu tiên**: P1
- **Lessons áp dụng**: L-V01, L-V02, L-V04, L-F10 (spec/constant ở cấp module), L-T01 (encoding).
- **Mục tiêu**: trang không có symbol realtime (vd. `/operations-center?tab=dataops`) **không** còn hiện chữ `Offline` sai; header phản ánh đúng `idle | connecting | polling | connected | disconnected`.

## 1. Bằng chứng nguồn (đã tự mở đọc)

| Vị trí | Thực tế |
|---|---|
| `Header.tsx:90-94` | `wsStatus` chỉ có 3 giá trị; `idle`/`connecting`/`polling` đều gom về `connecting`. |
| `Header.tsx:331,334` | Mọi giá trị không phải `connected` render chữ `Offline` + chấm đỏ. |
| `RealtimeContext.js:45-50,91-105` | `enabled = aggregatedSymbols.length > 0`; context lộ `feed.metrics.manager.consumerCount` / `symbolUnionCount`. |
| `useRealtimeFeedCore.js:464,556,913,968,985,997,1003,1014,1020,1044,1100,1134-1178,1194,1228,1238` | **4 giá trị thật**: `idle`, `connecting`, `polling`, `live`. `'disconnected'` **không bao giờ được set** (grep 0 hit) — giữ là nhánh phòng thủ, chỉ test mock sinh ra (O2). |
| `ShellOperationsCenterPage.tsx:1-110` | Trang SOC đăng ký 0 symbol → `consumerCount=0`, status `idle`. |

## 2. Tiêu chí nghiệm thu (Given/When/Then)

| ID | AC |
|---|---|
| AC0 | Given `useRealtimeContext()` trả `null`/`undefined` (test cũ mount không Provider); When render; Then nhãn = `layout.realtime.idle`, chấm xám — **không throw**, không hiện "Đang kết nối" (O3). |
| AC1 | Given `consumerCount=0` **hoặc** `realtimeStatus='idle'`; When render Header; Then assert dương tính: `getByText('layout.realtime.idle')` **và** chấm có class `bg-slate-500`; thêm assert phủ định: không có chuỗi "Offline" (L-V04). |
| AC2 | Given `realtimeStatus='connecting'` (có consumer); When render; Then `getByText('layout.realtime.connecting')` + chấm `bg-amber-400`. |
| AC3 | Given `realtimeStatus='polling'`; When render; Then `getByText('layout.realtime.polling')` + chấm `bg-amber-400`. |
| AC4 | Given `realtimeStatus='live'` hoặc `'connected'`; When render; Then `getByText('layout.realtime.online')` + chấm `bg-emerald-400 live-dot-pulse` (giữ hành vi cũ). |
| AC5 | **Defensive-only** (production không phát `disconnected`): Given `realtimeStatus='disconnected'`; When render; Then `getByText('layout.realtime.disconnected')` + chấm `bg-rose-400`. |
| AC6 | **5 key** `layout.realtime.{idle,connecting,polling,online,disconnected}` tồn tại trong **cả 2** `locales/{vi,en}/layout.js`; mọi `t()` có `defaultValue`. **`common.online` không dùng** — grep 0 hit (O1). |
| AC7 | Test mới **đỏ trước** khi chưa sửa `Header.tsx`, xanh sau; test cũ 7/7 vẫn xanh. Test assert trên **key** vì mock `t:(k)=>k` trả key, không phải chuỗi dịch (O4). |

## 3. Baseline gate (chạy thật trước khi sửa)

```
node packages/web/scripts/check-multi-agent.mjs   → 0 lỗi (206 cảnh báo stale, không chặn)
npx tsc --noEmit            (packages/web)       → exit 0
npx vitest run .../Header.component.test.tsx     → 1 file / 7 test PASS
```
Không có claim `in-progress` nào giữ `Header.tsx` hay `locales/{vi,en}/layout.js` (parse 13 claim in-progress bằng node, 0 match).

## 4. SCOPE / LIMIT / non-goals

- **SCOPE (4 file)**:
  1. `packages/web/src/layouts/full/vertical/header/Header.tsx` — mapping 5 trạng thái + render.
  2. `packages/web/src/i18n/locales/vi/layout.js` — **5 key** `realtime.*` (kể cả `online`).
  3. `packages/web/src/i18n/locales/en/layout.js` — **5 key** `realtime.*` (kể cả `online`).
  4. `packages/web/src/layouts/full/vertical/header/__tests__/Header.component.test.tsx` — thêm `useRealtimeContext: vi.fn()` vào `h = vi.hoisted()` (`:32-39`), thêm `vi.mock("@/context/RealtimeContext.js", ...)` (`:41-47`), `mockReset()` + default trả `null` trong `beforeEach` (`:106-128`), đổi comment "4 of the 9 imports" → "5"; 6 case (AC0–AC5) assert **key** + class chấm. Alias `@` đã đúng (`vitest.config.ts:19`).
- **LIMIT**: 1 slice, tối đa 3 vòng sửa; không đụng `i18n/{vi,en}.js` **lẫn** `locales/*/common.js` (file nóng) — dùng `locales/*/layout.js`.
- **Non-goals**: không sửa backend 404 advisory/billing (R2 của diagnosis); không sửa badge `LIVE` tĩnh (R3); không đổi WebSocket/engine; không migration; không `package.json`.
- **Rollback**: `git revert` commit slice; không có data/schema migration.

## 5. Thiết kế tối thiểu

Khai hằng số ở cấp module (tránh literal identity — L-F10):

```
const REALTIME_STATUS_META = {
  idle:         { labelKey: 'layout.realtime.idle',         dot: 'bg-slate-500',   pulse: false },
  connecting:   { labelKey: 'layout.realtime.connecting',   dot: 'bg-amber-400',   pulse: false },
  polling:      { labelKey: 'layout.realtime.polling',      dot: 'bg-amber-400',   pulse: false },
  connected:    { labelKey: 'layout.realtime.online',        dot: 'bg-emerald-400', pulse: true  },
  disconnected: { labelKey: 'layout.realtime.disconnected', dot: 'bg-rose-400',    pulse: false },
};
```

Resolver thuần (export để test unit nếu cần, nhưng test chính mounts component):

```
if (!realtimeCtx)                             → idle
(consumerCount ?? 0) === 0 || status === 'idle' → idle   // R1: phải có ngoặc, ?? có precedence thấp hơn ===
status === 'live' || status === 'connected'   → connected
status === 'polling'                          → polling
status === 'disconnected'                     → disconnected (defensive)
default                                       → connecting
```

Render: giữ cấu trúc `div > span(dot) + span(label)`; thêm `title` để biết trạng thái khi ẩn nhãn trên mobile. Mọi `t(...)` có `defaultValue`. Đọc consumer bằng `realtimeCtx?.feed?.metrics?.manager?.consumerCount ?? 0` (không đọc trực tiếp — O3).

## 6. Gate sau khi sửa

- [ ] `npx vitest run <Header test>` — 13 test (7 cũ + 6 mới AC0–AC5) PASS; **fail-before** ghi log đỏ.
- [ ] `npx tsc --noEmit` — exit 0.
- [ ] `npx eslint <4 file>` — 0 error.
- [ ] `node scripts/i18n-scan-strict.mjs` — exit 0 (không ghi file; kiểm `git status` sau).
- [ ] `node packages/web/scripts/check-multi-agent.mjs` — 0 lỗi.
- [ ] `git diff --numstat` = **đúng 4 file SCOPE, 0 file ngoài SCOPE**; U+FFFD = 0; file kết thúc LF.
- [ ] **CHƯA CHẠY**: staging VPS (cần deploy), Playwright/visual — ghi rõ, không báo PASS giả.

## 7. Audit & đồng thuận

- B3/B4: auditor độc lập (subagent, chỉ đọc) → verdict ghi `docs/evidence/header-status/AUDIT_PLAN.md`.
- B8: re-audit → `docs/evidence/header-status/REAUDIT.md`.
- B9: claim `done`, ledger Entry 559.
