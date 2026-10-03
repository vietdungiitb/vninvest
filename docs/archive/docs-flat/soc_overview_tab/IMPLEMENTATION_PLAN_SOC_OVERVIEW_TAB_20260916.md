# Kế hoạch thực hiện — SOC Overview Tab (`?tab=overview`)

> **Ngày**: 2026-09-16
> **Nguồn**: `docs/AUDIT_SOC_OVERVIEW_TAB_20260916.md` (20 findings F-OV-01→20, 6 contradictions C1→C6, gates, §G)
> **Phạm vi**: FE `SocOverviewPanel.tsx` + BE `overview.py` (`OverviewSummaryView`/`ServiceDetailView.patch`/`SloOverviewView`) + i18n + CSS + tests
> **Nguyên tắc**: Không đổi contract BE hiện hữu (chỉ thêm field optional). Mọi khẳng định kèm `file:line`. Đội code tự thực hiện + tự audit theo checklist §7, không cần hỏi lại.

---

## 0. Đính chính audit trước khi code (bắt buộc đọc)

| # | Audit viết | Thực tế (evidence) | Kết luận chốt |
|---|-----------|-------------------|---------------|
| Đ1 | F-OV-01: "bất kỳ `IsAuthenticated` nào cũng PATCH tắt service" | `packages/core/backend/src/service_ops/views/base.py:38` `permission_classes = [IsAuthenticated, IsAdminUser]`; `ServiceDetailView` không override permission; test `test_soc_api_overview.py:374-380` đã assert non-staff PATCH → `403` | **BE RBAC đã đạt.** Không sửa permission. P0 chỉ làm: FE confirm + BE ghi audit toggle (thiếu) |
| Đ2 | F-OV-13 hỏi throttle 120/min có vỡ khi 4 tab cùng poll | `vninvest_core/settings.py:259` `soc_operator_read: 120/min` (bucket riêng, không share quota `user`); overview poll = 2 req/15s = 8 req/phút/tab → 4 tab ≈ 32/phút < 120 | **Không vỡ.** Vẫn làm pause khi tab ẩn (tiết kiệm, không phải vì vỡ quota) |
| Đ3 | F-OV-11 yêu cầu "chuyển JSX" | File 666 dòng `createElement`, migrate JSX = diff lớn, rủi ro cao, không sửa bug | **Hoãn JSX.** Chỉ thêm `aria-*` vào `createElement` hiện có |
| Đ4 | F-OV-15 yêu cầu SSE `EventSource /stream/health/` | Endpoint này **KHÔNG TỒN TẠI** trong BE (đã grep `stream/health` — không có) | **P2 chỉ làm visibility+jitter.** SSE là epic riêng (cần BE mới), ngoài scope plan này |
| Đ5 | Status enum: FE có `critical`, BE không | BE canonical: `healthy/degraded/unhealthy/unknown/maintenance` (`overview.py:280-287`, `OverviewCountsSerializer:52-58`). FE `critical` là **alias hiển thị** của `unhealthy` (`SocOverviewPanel.tsx:45-46,187-189,214`) | **Không đổi BE.** FE giữ map `unhealthy→critical`, thêm `maintenance` riêng |

**Quyết định khóa (không hỏi lại)**:
1. Metric cards: **7 cards** (thêm `maintenance`), giữ grid 3 cột (`soc.components.css:315-320` không đổi).
2. Health bar: **6 segments** theo thứ tự `healthy → degraded → critical → maintenance → unknown → disabled`.
3. Toggle: FE dùng modal confirm **có ô lý do** (copy pattern `SocSchedulerBoard.tsx:230-281`, không dùng `useConfirm` vì nó không có textarea — xem `ConfirmModal.tsx:18`). BE PATCH nhận thêm `change_reason` optional + ghi `ConfigChangeAudit(action='toggle')`. Không có lý do → BE vẫn cho qua (backward compatible), FE bắt buộc nhập (disable nút khi trống, giống scheduler modal `:271`).
4. Không thêm dependency mới (không `date-fns`): relative time tự viết ~15 dòng.
5. Không đổi `DOMAIN_TAB_MAP` key hiện có; chỉ **thêm** key thiếu + fallback (xem W3).

---

## 1. Chia việc (2 PR, đúng thứ tự)

### PR-1 — P0 Hotfix (0.5 ngày, 1 PR duy nhất, merge trước)
W1: Toggle confirm + audit (F-OV-01 phần còn thiếu) · W2: Health bar 6 segment (F-OV-03) · W3: Maintenance metric (F-OV-04, C3, C6) · W4: Tách lỗi SLO (F-OV-08, C2) · W5: Token hóa đúng chỗ chạm (C5, F-OV-12 phạm vi hẹp, F-OV-20) + i18n `empty_filtered` (F-OV-17).

### PR-2 — P1 Parity thương mại (2 ngày, merge sau PR-1)
W6: Error non-blocking (F-OV-02) · W7: Domain strip từ `by_domain` (F-OV-09) · W8: Thời gian local + relative (F-OV-05) · W9: Debounce + highlight + sort (F-OV-06) · W10: Pagination numbers + pageSize + range (F-OV-10) · W11: Burn theo budget + ẩn SLO khi disabled (F-OV-07) · W12: Mở rộng `DOMAIN_TAB_MAP` + fallback (F-OV-16) · W13: Polling visibility + jitter (F-OV-13 phạm vi đã chốt) · W14: A11y attrs (F-OV-11 phạm vi đã chốt, F-OV-19).

P2-full (SSE, ETag, donut global F-OV-14/15/18) và P3 (export history, dependency graph, maintenance scheduler) **ngoài scope**, ghi backlog §8.

---

## 2. PR-1 chi tiết (tiêu chí bàn giao)

### W1 — Toggle confirm + audit
**File chạm**: `SocOverviewPanel.tsx:224-238`, `overview.py:408-433`, `vi.js:193-221` + `en.js:193-221`, `test_soc_api_overview.py` (thêm), `soc-p2.component.test.tsx` hoặc file mới (thêm).

**Hiện trạng**: `handleToggle` gọi `updateSocService(key, {is_active})` ngay, không confirm, không lý do (`SocOverviewPanel.tsx:224-238`). BE `patch` chỉ save `is_active`, không ghi audit (`overview.py:430-431`).

**Làm**:
1. FE: thêm state `confirmToggle: ServiceItem | null`. Nút toggle → `setConfirmToggle(service)` thay vì gọi API. Modal copy cấu trúc `SocSchedulerBoard.tsx:238-281` (overlay + card + textarea lý do + 2 nút), dùng class CSS scheduler modal có sẵn (`schedulerModalOverlay/Card/Title/Body/Field/Textarea/Actions/Cancel/Proceed`).
2. FE `onConfirm(reason)`: gọi `updateSocService(key, { is_active: !s.is_active, change_reason: reason })`, toast thành công, `fetchData(true)`, đóng modal. Nút xác nhận `disabled` khi `!reason.trim()`.
3. BE `ServiceDetailView.patch`: đọc `change_reason = str(request.data.get('change_reason','')).strip()` (optional, cho qua nếu trống); sau `service.save` tạo `ConfigChangeAudit(service=service, action='toggle', actor=username, change_summary=reason hoặc 'Bật/Tắt dịch vụ {key}', request_id=...)`. Kiểm tra field model `ConfigChangeAudit` trước khi code (đã dùng ở `test_soc_api_overview.py:320-325`: có `action/reset/actor/change_summary/request_id` — dùng đúng các field này).
4. i18n thêm (cả `vi.js` + `en.js`, block `overview`): xem bảng §4 (nhóm toggle: 6 keys).

**Nghiệm thu**:
- [ ] Click Tắt/Bật → modal hiện tên service + cảnh báo, nút xác nhận disable khi lý do trống.
- [ ] Xác nhận → `is_active` đổi, toast thành công, audit row `action='toggle'` xuất hiện (kiểm tra qua API audit service hoặc DB).
- [ ] Hủy → không gọi API (assert bằng test).
- [ ] Non-staff PATCH → `403` (test BE đã có `test_soc_api_overview.py:374-380` — chạy lại phải xanh, không cần viết mới).
- [ ] BE không gửi `change_reason` → vẫn `200` (backward compat, có test).

### W2 — Health bar 6 segment (F-OV-03)
**File chạm**: `SocOverviewPanel.tsx:343-397`, `soc.components.css:296-312` (thêm 3 class).

**Làm**:
1. Tính thêm `maintenancePct/unknownPct/disabledPct` từ `stats` (sau W3 `stats` đã có `maintenance`).
2. Render 6 segment theo thứ tự healthy → degraded → critical → maintenance → unknown → disabled, mỗi segment có `title` (vd `Bảo trì: 2`) + `aria-label`. Tổng width = 100% khi đủ dữ liệu (cho phép sai số làm tròn < 0.1%).
3. CSS thêm: `.overviewHealthBarSegmentMaintenance` (gradient cyan `--soc-c-06b6d4 → --soc-c-22d3ee`), `.overviewHealthBarSegmentUnknown` (solid `var(--soc-c-94a3b8)`), `.overviewHealthBarSegmentDisabled` (solid `var(--soc-c-64748b)` + `opacity .6`).

**Nghiệm thu**:
- [ ] Fixture 6 trạng thái mỗi loại 1 → bar đủ 6 màu, tổng width ≈ 100%.
- [ ] Chỉ 1 trạng thái → 1 segment full bar.
- [ ] `total=0` → bar rỗng, không `NaN` (giữ guard `stats.total || 1` ở `:343`).

### W3 — Maintenance metric (F-OV-04, C3, C6)
**File chạm**: `SocOverviewPanel.tsx:60-103,204-222,303`.

**Làm**:
1. `METRIC_DEFS` thêm `{ key: "maintenance", icon: "Wrench", colorVar: "--soc-c-22d3ee" }` (đặt sau `critical`, trước `unknown`).
2. `METRIC_LABEL_KEYS` + `METRIC_COLORS` + `METRIC_BORDER_COLORS` + `METRIC_ICON_BG` thêm key `maintenance` — **dùng token, không hard-code**: màu chữ `var(--soc-c-22d3ee)`, border/icon dùng `color-mix(in srgb, var(--soc-c-22d3ee) 60%, transparent)` và `12%` (tránh `rgba(...)` hard-code — chính là C5).
3. `stats.reduce`: `else if (s.status === "maintenance") acc.maintenance += 1` (thay block trống `:215-217`); initial thêm `maintenance: 0`. Skeleton `Array.from({length: 6})` → `7` (`:303`).
4. i18n: `maintenance_count` (VI `Bảo trì`, EN `Maintenance`).

**Nghiệm thu**:
- [ ] 7 cards hiển thị; service `active+maintenance` đếm đúng ô Bảo trì, `unknown` không bị lây.
- [ ] `sum(6 ô trạng thái) + disabled == total` với mọi fixture.
- [ ] Filter `maintenance` (`:190`) và metric `maintenance` khớp số nhau (đóng C6).

### W4 — Tách lỗi SLO (F-OV-08, C2)
**File chạm**: `SocOverviewPanel.tsx:108-156`.

**Làm**:
1. Thêm `const [sloError, setSloError] = useState("")`. Trong `fetchData`: `setSloError("")` đầu hàm; gọi 2 API **riêng** (không `Promise.all` + `.catch(()=>[])` ở `:129-132` nữa): overview fail →throw như cũ; SLO fail → `setSloError(message)` và `setSloMap({})`, không throw.
2. Render banner SLO riêng trên service grid (dùng `styles.inlineError` + nút Retry chỉ fetch SLO — tách hàm `fetchSlo()` dùng chung).
3. Khi `sloError` set: SLO badges ẩn, card service vẫn hiện đầy đủ.

**Nghiệm thu**:
- [ ] SLO API 500 → banner lỗi SLO hiện, grid service vẫn đầy đủ (khác hiện tại: badge lặng lẽ trống).
- [ ] Retry SLO → thành công thì banner mất, badges hiện.
- [ ] Overview API fail + chưa có data → error toàn panel như cũ (không regression).

### W5 — Token + i18n tồn đọng PR-1 (C5 hẹp, F-OV-20, F-OV-17)
**Làm**:
1. `soc.tokens.css` thêm (nếu chưa có): `--soc-c-64748b: #64748b;` (dùng cho disabled thay vì hard-code `:85,93` khi chạm các dòng này — không refactor toàn file).
2. Nút toggle inline `style background/color` (`:598-601`) → 2 class mới `.enableBtn/.disableBtn` trong `soc.components.css` (dùng `STATUS_BG_VAR` tương đương: success/danger translucide + `toneColor` đã có). Xóa inline style (đóng F-OV-20, CSP).
3. Empty state (`:477-485`): thay concat `filter_all + unknown_value` bằng key mới `empty_filtered` (VI/EN, §4).

**Nghiệm thu**: `grep -n "rgba(239\|rgba(34, 197" SocOverviewPanel.tsx` trả về rỗng; empty state hiện đúng 2 ngôn ngữ.

---

## 3. PR-2 chi tiết

### W6 — Error non-blocking (F-OV-02)
Đổi `if (error)` (`:331`) thành: chỉ return toàn panel khi `error && !data`; khi `error && data` → render banner lỗi trên cùng + giữ toàn bộ nội dung (bar, metric, grid, pagination). Nút Retry gọi `fetchData(false)`.

### W7 — DomainHealthStrip (F-OV-09, dùng `by_domain` BE đã trả)
BE đã trả `by_domain` (`overview.py:296-308`) nhưng FE bỏ qua (type `OverviewData` không có field này). Thêm `by_domain?: Record<string, {total,healthy,degraded,unhealthy,unknown,maintenance}>` vào interface; render strip pills `domain healthy/total` trước toolbar; click pill → `setDomainFilter(domain)` (thêm state, `null` = tất cả) kết hợp với `filtered` memo; pill active có `aria-pressed`. Thêm key `domain_all`.

### W8 — Thời gian local + relative (F-OV-05)
Thay `split("T")[1]?.slice(0,8)` (`:582`) bằng helper `formatLastCheck(iso, lang)` trong file mới `socTime.ts` (cùng thư mục): absolute `Intl.DateTimeFormat(lang==='vi'?'vi-VN':'en-US', {hour,minute,day,month})`, relative tự tính (`vừa xong` <60s / `{n} phút trước` / `{n} giờ trước` / `{n} ngày trước`), render `absolute (relative)` + `title=ISO gốc`. Keys: `time_just_now/time_minutes_ago/time_hours_ago/time_days_ago` (VI/EN).

### W9 — Debounce + highlight + sort (F-OV-06)
`search` → `debouncedSearch` (timeout 300ms, cleanup đúng). `filtered` dùng `debouncedSearch`. Highlight: helper bôi `<mark>` phần khớp trong `service.name` (dùng CSS sẵn hoặc inline `background: var(--soc-c-fbbf24)` — cho phép 1 inline duy nhất, hoặc thêm class `.overviewHighlight`). Sort: thêm `sortBy` state (`name|status|latency`) + `<select>` trước grid; severity order `critical(0) < degraded(1) < maintenance(2) < unknown(3) < healthy(4)`, disabled luôn cuối. Keys `sort_label/sort_name/sort_status/sort_latency`.

### W10 — Pagination (F-OV-10)
Thêm `pageSize` state (9/18/36, mặc định 9), `<select>` + numbered buttons (cửa sổ 5 trang quanh `safePage`, nút Đầu/Cuối khi xa). Dòng range dùng key `showing_range`: VI `Hiển thị {from}–{to} / {total}`, EN `Showing {from}–{to} of {total}`. Reset `page=1` khi search/filter/domain/pageSize/sort đổi. Nút trang có `aria-label` + `aria-current`.

### W11 — Burn theo budget + ẩn SLO khi disabled (F-OV-07)
Thay ngưỡng cứng `:536-540` bằng: `burnColor` từ `error_budget_remaining` (còn >50% xanh, 20–50% vàng, <20% đỏ; null → muted) — vì budget đã normalize theo `slo_target` ở BE (audit C4). Ẩn toàn bộ SLO badges khi `!service.is_active`. Giữ tooltip keys hiện có.

### W12 — DOMAIN_TAB_MAP (F-OV-16)
Thêm: `platform: "overview"`, `data_ingest: "dataops"`, `realtime: "signals"`, `cache: "prefetch"`, `analytics: "runtime-kpi"`, `matrix: "dataops"`. `handleConfigure`: `tab = MAP[domain] ?? null`; nếu null → vẫn hiện nút nhưng click chuyển `onChangeTab("overview")` thay vì ẩn hẳn (xóa logic `hasConfig` ẩn nút → đổi thành luôn hiện, title fallback). Ghi rõ trong code comment để lần sau thêm domain chỉ thêm 1 dòng map.

### W13 — Polling visibility + jitter (F-OV-13, phạm vi đã chốt Đ2/Đ4)
`restartInterval`: delay thực = `delayMs + random(0,3000)`. Thêm `document.addEventListener("visibilitychange")`: ẩn → clear interval; hiện → `fetchData(true)` + restart. Cleanup listener khi unmount. Giữ backoff 60s sau 3 lỗi (`:147`).

### W14 — A11y attrs (F-OV-11 hẹp, F-OV-19)
Không đổi `createElement` → JSX. Thêm: root `glassPanel` `role="region" aria-label={t(overview_title)}`; filter buttons `aria-pressed`; health bar `role="img"` + `aria-label` (key `health_bar_label`); pagination nav `aria-label` + buttons `aria-label`; metric grid `role="list"`/cards `role="listitem"` nếu ít rủi ro. Không làm: focus trap modal (modal đơn giản, Enter/Esc mặc định đủ).

---

## 4. i18n keys phải thêm (cả `vi.js` và `en.js`, block `soc.overview` trừ ghi chú)

| Key | VI | EN |
|-----|----|----|
| `maintenance_count` | `Bảo trì` | `Maintenance` |
| `empty_filtered` | `Không có dịch vụ nào khớp bộ lọc hiện tại` | `No services match the current filter` |
| `toggle_title` | `Xác nhận đổi trạng thái` | `Confirm status change` |
| `toggle_confirm_disable` | `Tắt dịch vụ {name}? Các probe sẽ dừng.` | `Disable service {name}? Probes will stop.` |
| `toggle_confirm_enable` | `Bật lại dịch vụ {name}?` | `Re-enable service {name}?` |
| `toggle_reason_label` | `Lý do thay đổi (bắt buộc)` | `Reason (required)` |
| `toggle_reason_placeholder` | `VD: bảo trì định kỳ theo ticket OPS-123` | `E.g. scheduled maintenance per OPS-123` |
| `toggle_success` | `Đã đổi trạng thái dịch vụ.` | `Service status updated.` |
| `slo_load_failed` | `Không thể tải dữ liệu SLO.` | `Failed to load SLO data.` |
| `retry_slo` | `Thử lại SLO` | `Retry SLO` |
| `domain_all` | `Tất cả domain` | `All domains` |
| `showing_range` | `Hiển thị {from}–{to} / {total}` | `Showing {from}–{to} of {total}` |
| `page_size_label` | `Mỗi trang` | `Per page` |
| `sort_label` | `Sắp xếp` | `Sort` |
| `sort_name` | `Tên A–Z` | `Name A–Z` |
| `sort_status` | `Mức độ nghiêm trọng` | `Severity` |
| `sort_latency` | `Độ trễ cao nhất` | `Highest latency` |
| `health_bar_label` | `Tỷ lệ sức khỏe: {healthy}/{total} tốt` | `Health ratio: {healthy}/{total} healthy` |
| `time_just_now` | `vừa xong` | `just now` |
| `time_minutes_ago` | `{n} phút trước` | `{n}m ago` |
| `time_hours_ago` | `{n} giờ trước` | `{n}h ago` |
| `time_days_ago` | `{n} ngày trước` | `{n}d ago` |

Quy tắc: VI full dấu; không concat 2 key làm câu (lỗi cũ F-OV-17); chạy `npm run i18n:scan` sau khi thêm.

---

## 5. Tests bắt buộc (thiếu là chưa xong)

### BE (`service_ops/tests/test_soc_api_overview.py` — thêm vào file có sẵn)
1. `test_toggle_creates_audit_with_reason`: PATCH kèm `change_reason` → `200` + `ConfigChangeAudit(action='toggle')` tồn tại, `change_summary` chứa reason.
2. `test_toggle_without_reason_still_200`: PATCH không reason → `200` (backward compat).
3. `test_overview_summary_counts_maintenance`: tạo service health `maintenance` → `GET overview` `summary.maintenance >= 1`, `by_domain` có key domain đó.
4. Chạy lại toàn file: `python manage.py test service_ops.tests.test_soc_api_overview --keepdb` xanh (bao gồm test 403 có sẵn).

### FE (thêm `packages/web/src/components/__tests__/soc-overview-tab.test.tsx`, mock adapter như `soc-p2.component.test.tsx:8-30`)
1. Maintenance metric: fixture có 1 `active+maintenance` → card `maintenance_count` hiện `1`, `unknown` là `0`.
2. Bar 6 segment: fixture đủ 6 trạng thái → 6 segment, tổng width ≈ 100%.
3. SLO fail: `getSocSloOverview` reject → banner `slo_load_failed` hiện + grid service vẫn hiện.
4. Toggle confirm: click Tắt → modal `toggle_title` hiện; Hủy → `updateSocService` không được gọi; nhập lý do + xác nhận → được gọi với `{is_active:false, change_reason}`.
5. Domain strip: `by_domain` 2 domain → 2 pills; click pill → grid lọc đúng domain.
6. Pagination range: 10 services, pageSize 9 → dòng `showing_range` `1–9 / 10`, sang trang 2 còn 1 card.
7. Empty filter: search không khớp → `empty_filtered` (không phải text concat cũ).
8. Burn theo budget: SLO `error_budget_remaining=0.1` → burn badge màu đỏ; service `is_active=false` → không có SLO badge.

---

## 6. Thứ tự code + lệnh gates (sau mỗi work-item)

1. `npx tsc --noEmit` (packages/web) — 0 lỗi mới.
2. `npx vitest run <file test>` nếu chạm FE; `python manage.py test service_ops.tests.test_soc_api_overview --keepdb` nếu chạm BE.
3. Cuối mỗi PR: `npm run build` (PASS), `npm run lint` (0 errors; warn `jsx-no-literals` do `createElement` là pre-existing — không cần fix), `npm run i18n:scan` (không key thừa/thiếu).
4. Tuyệt đối không sửa ngoài file đã liệt kê ở mỗi W (chống scope creep — bài học renderSeries).

---

## 7. Checklist tự audit trước khi xin review (copy-paste đánh dấu)

**Chức năng** (làm tay 1 lần trên `http://localhost/operations-center?tab=overview`, cả VI + EN):
- [ ] Toggle Tắt/Bật có modal + lý do bắt buộc; audit ghi nhận; non-admin không thấy nút? (FE ẩn nút khi `!isAdmin` nếu có context quyền; tối thiểu BE 403 — xác nhận bằng test).
- [ ] Bar đủ 6 màu khi đủ trạng thái; tổng ≈ 100%.
- [ ] Số metric Bảo trì == số card `maintenance` khi filter Bảo trì.
- [ ] SLO sập → banner riêng, grid còn nguyên; Retry SLO phục hồi.
- [ ] Overview sập lần đầu → error toàn panel + Retry; sập khi đã có data → banner + giữ grid (PR-2).
- [ ] Domain pills lọc đúng; search debounce (gõ nhanh không giật); sort/latency đổi thứ tự đúng; pagination range/pageSize đúng.
- [ ] Thời gian hiện local + relative, tooltip ISO.
- [ ] Tab ẩn 1 phút → network không còn poll 15s; hiện lại → fetch ngay.

**Gates** (dán output vào PR):
- [ ] `npx tsc --noEmit` → 0
- [ ] `npm run build` → PASS (ghi thời gian)
- [ ] `npm run lint` → 0 errors
- [ ] `npx vitest run soc-overview-tab soc-p2` → pass (ghi số test)
- [ ] `python manage.py test service_ops.tests.test_soc_api_overview --keepdb` → OK
- [ ] `npm run i18n:scan` → không thiếu/thừa key
- [ ] `grep` không còn `split("T")[1]`, `catch(() => ({ services: [] }))`, `rgba(239, 68, 68, 0.15)` trong `SocOverviewPanel.tsx`

**Docs**: cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` 1 entry/PR (Entry tiếp theo), ghi rõ findings nào đóng (F-OV-01→…).

---

## 8. Backlog có lý do (không làm trong 2 PR này)

- SSE realtime + ETag/304 + donut global từ `HealthStatusView` (F-OV-14/15/18): cần BE endpoint mới + đo perf — tách epic, có SIC riêng.
- Migrate `createElement` → JSX (F-OV-11 full): rủi ro lớn, lợi ích đọc hiểu — làm khi có codemod hoặc chạm file vì lý do khác.
- Export health history CSV, dependency graph, maintenance window scheduler (P3 audit): backlog thương mại.
- Câu hỏi audit F1→F5: đã trả lời bằng evidence ở §0 (Đ1/Đ2/Đ5); F2 (`is_active=false` ẩn SLO) chốt ẩn; F3 (map domain) chốt ở W12; F5 (`by_domain` kèm counts) — BE đã kèm, FE dùng ở W7, không cần đổi BE.
