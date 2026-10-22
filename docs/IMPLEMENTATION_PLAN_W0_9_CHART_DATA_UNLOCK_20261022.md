# IMPLEMENTATION PLAN — W1.4/W2.1 MỞ KHOÁ DỮ LIỆU CHART (bật indicator + tape + workspace toolbar)

**Agent:** `w0-9-chart-data-unlock` · **Branch:** `feat/w0-9-chart-data-unlock` -> `dev`
**Base:** `origin/dev` @ `d34ada0e4` · **Worktree:** `C:\Mujoco Projects\agent-w0-9`
**Nguồn:** `docs/ROADMAP_MASTER_2026Q4_2027.md` §4.3 **W1.4** ("mở khoá toàn bộ dữ liệu đang bị tắt trong chính repo — bật 7→59 series, tape, corporate events, 10 i18n dead key") + §4.4 **W2.1** ("bật 59 indicator + Pine Editor + tape + corporate events") — **ưu tiên sớm** vì D1 (Owner): retail mua **charts** là nhu cầu #1.
**Lessons áp dụng:** L-001 L-002 L-003 L-007 L-008 L-M02 L-M05 L-M08 L-V01 L-V02 L-V04 L-G01 L-G02 L-G04 L-G05 L-G07 L-G08 L-T01 L-T02 L-A01
**Skill:** `multi-agent-workflow` (8 stage) · `tdd-workflow` (RED → GREEN) · `verification-loop` · `project-lessons`

---

## 0. Vì sao ưu tiên slice này (và điều gì KHÔNG làm)

D1 (Owner 2026-10-21): *"khách trả tiền là retail, cần thông tin thị trường mà chỗ khác không có như **charts**, whale, dark flow, AI advisory"*. ⇒ **charts** là nhu cầu #1, và **chỉ sửa được bằng code trong repo này** ([T]) — không cần hợp đồng, không cần khoá dịch vụ, không cần vendor.

**Hiện trạng (đọc code thật):** `packages/web/src/components/VNStockChartPanel.js`
- `panes: customPanes` (`:148-187`) — **3 pane / 7 series**: Candlestick, EMA20, EMA50, BollingerBand, Volume, RSI, MACD.
- `showTapePanel: false` (`:257`) — bảng tape (time & sales) **tắt**.
- `showAdvisoryPanel: false` (`:258`).
- `showCorporateEvents: false` (`:259`) — overlay corporate events **tắt**.
- `showWorkspaceToolbar` **không** set ⇒ mặc định tắt (type decl `src/types/vninvestcharts-widget.d.ts:57`).
- Widget `vninvestcharts-widget@1.2.5` **có sẵn 59 indicator** trong catalog (`@vninvestcharts/engine-core`) + Pine Editor + Strategy Tester + Bar Replay — **app chỉ dùng 7**.

## 1. Scope (FE-only, [T], không đụng BE)

| # | Nội dung | File:line | Ghi chú trung thực |
|---|---|---|---|
| **S1** | **Bật `showTapePanel: true`** — bảng time & sales (dữ liệu tick **thật**: `market_data.IntradayTick` → `IntradayTapeView` `market_data/views.py:411`) | `VNStockChartPanel.js:257` | Dữ liệu đã có sẵn ở BE, chỉ đang tắt ở UI |
| **S2** | **Bật `showWorkspaceToolbar: true`** — toolbar layout/workspace (lưu layout, chọn pane) | `VNStockChartPanel.js` (thêm prop) | Type decl đã có prop này |
| **S3** | **Thêm pane "Chỉ báo" mặc định** — 6 indicator chuẩn dùng type có sẵn trong catalog widget: `Stoch` không có ⇒ dùng **`DMI`, `CCI`, `MFI`, `OBV`, `VWAP`, `SAR`** (đều có trong catalog) | `VNStockChartPanel.js:148-187` | Bật sẵn 13/59 indicator thay vì 7 — **không** bật hết 59 cùng lúc (chart rối + nặng) |
| **S4** | **i18n**: thêm `stockDetail.chartIndicators` (vi + en) cho label pane mới; **dùng lại** 10 key `indicatorMovingAverage`..`indicatorObv` (`vi.js:3671-3680`) đang là **dead key** thay vì xoá | `src/i18n/vi.js` + `en.js` | 10 dead key ⇒ có consumer ⇒ hết dead |
| **S5** | **Ghi rõ 2 thứ CHƯA bật và lý do** (không bật mù): `showCorporateEvents` (BE **chưa có nguồn corporate actions** ⇒ overlay rỗng) và Pine Editor (không có prop công khai trong type decl `vninvestcharts-widget.d.ts`) | comment trong `VNStockChartPanel.js` + roadmap §7 | Ghi bằng comment **có lý do** để người sau không tưởng là bỏ sót |

## 2. Non-goals (rõ ràng)

- **KHÔNG** bật `showCorporateEvents` khi BE chưa có nguồn dữ liệu ⇒ overlay rỗng là noise, và "bật rồi không có gì" = nói dối (đúng tinh thần W0.6). → ghi vào roadmap làm gap (W5.3 corporate actions đã có sẵn trong W5).
- **KHÔNG** sửa `vninvestcharts-widget` (repo khác, ngoài phạm vi).
- **KHÔNG** bật 59 indicator cùng lúc (UX rối + perf).
- **KHÔNG** đụng BE, **KHÔNG** migration, **KHÔNG** chạm deny-list.

## 3. TDD

**RED**: test component mới `src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` — đọc **nguồn** `VNStockChartPanel.js` (pattern đã có trong repo: `commercial-page.component.test.tsx` quét nguồn) và assert:
1. `showTapePanel: true` (hiện `false` ⇒ **RED**)
2. `showWorkspaceToolbar: true` (**RED** — chưa có)
3. có pane `id: 'indicators'` với **≥ 6** series (**RED**)
4. có label i18n `stockDetail.chartIndicators` trong **cả** `vi.js` và `en.js` (**RED**)
5. `showCorporateEvents` **vẫn `false`** + có comment giải thích (chống "bật mù")

**GREEN**: sửa code tối thiểu cho 1–4; case 5 là chốt hành vi.

## 4. Cổng chất lượng (Stage 6)

| Gate | Nơi chạy |
|---|---|
| `npm run test:components` (vitest) + `npm run test` (jest) | **VPS staging** (§12.4 — §12.1 cấm `npm run test*` local) |
| `npm run build` (tsc && vite build) | **VPS staging** (§12.1: RAM-heavy, cấm local) |
| `npm run lint` | VPS staging |
| `npx tsc --noEmit` | local (§12.2 cho phép) |
| `pre-push-gate` · `check-experiment-env` · `check-lessons` · `check-multi-agent` | local |

**Dọn sau thử nghiệm:** worktree VPS **remove** + prune · `node_modules` VPS **xoá** · `docker ps` xác nhận **không còn container thử nghiệm**.

## 5. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Bật tape làm chart nặng / vỡ layout | Test + build trên VPS; nếu build/test đỏ ⇒ revert flag |
| Indicator type sai ⇒ widget render lỗi | Chỉ dùng type **có sẵn trong catalog** (`DMI`,`CCI`,`MFI`,`OBV`,`VWAP`,`SAR`) + dùng `i18n` key có sẵn |
| 10 dead i18n key tên không khớp indicator dùng | Kiểm tra key thực tế trước khi dùng; nếu không khớp ⇒ **không** dùng, giữ nguyên dead-key list ghi vào handoff |
| Test quét nguồn quá "mỏng" | Test assert **giá trị prop** cụ thể + đếm series, không chỉ assert chuỗi có mặt |
