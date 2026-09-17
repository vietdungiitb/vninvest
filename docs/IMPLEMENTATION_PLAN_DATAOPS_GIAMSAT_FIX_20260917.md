# KẾ HOẠCH THỰC HIỆN FIX GIÁM SÁT DATAOPS — Entry 107 + Phản biện F-G01

**Ngày:** 17/09/2026 16:00 — **Trạng thái:** ĐÃ THỰC HIỆN Entry 107 (chưa commit, worktree dirty) — **Tài liệu này là bản chuẩn để đội code tự thực hiện lại từ đầu mà không cần hỏi, kèm tiêu chí audit để reviewer chỉ cần grep là pass/fail.**

**Liên quan:**
- Audit gốc: `docs/AUDIT_DATAOPS_GIAMSAT_UI_20260917.md` (7 ảnh, 16 findings F-G01…F-V16, 6 contradictions C1-C5, errata F-G01 Entry 107)
- Phản biện: CONTRADICTION chính F-G01 audit gốc sai root cause — bảo “`vi.js:793` thiếu 5 keys, cần thêm”, thực tế `vi.js:802-812` đủ 9 keys, lỗi là **duplicate key shadowing** `vi.js:1050-1093` / `en.js:1050-1093` block cũ (commit `8c10e013`, 44 dòng, 0 consumer trong `grep -R soc\.matrix`) đè block đầu → 6 keys đầu fallback raw `soc.matrix.title` (ảnh 1-2). Fix đúng là **xoá block duplicate**, không thêm keys. Entry 107 đã làm đúng.
- Entry 107 đã fix 4 findings, gates chạy thật: `tsc 0`, `vitest soc-monitor 5/5`, `build PASS 37.40s`, `grep confirm còn 1 matrix: block/locale` (xem §3). F-G04 (Reconnecting) ngoài scope, chưa xác minh độc lập.
- **Worktree hiện dirty** lẫn nhiều file khác (28 files `git diff --stat`), chưa commit Entry 107 — kế hoạch này giúp team cherry-pick đúng 4 slices mà không lẫn rác.

---

## 0. NGUYÊN TẮC BẮT BUỘC (AGENTS.md)

1. Mọi khẳng định kèm `file:line` — không line = không hợp lệ
2. Không đoán — chưa đọc file thật → ghi “CHƯA XÁC MINH”
3. Bắt buộc `grep/glob/read`, không dùng kinh nghiệm chung
4. Plan↔code mâu thuẫn → mục CONTRADICTIONS riêng, mỗi dòng `plan:file:line | code:file:line | impact`
5. Grep toàn repo `.css/.module.css/config/i18n/adapters` (`soc.module.css`, `soc.tokens.css`, `vite.config.ts`, `vi.js:802,1050`)
6. Không viết code trong audit — chỉ nghiên cứu (trừ khi được yêu cầu rõ — kế hoạch này là ngoại lệ “được yêu cầu”)
7. Không bịa file — không tồn tại → báo `KHÔNG TỒN TẠI`
8. Báo cáo tiếng Việt

**Quality gates bắt buộc sau mỗi slice:** `npx tsc --noEmit` `packages/web` + `grep` xác nhận (xem checklist mỗi slice). Cuối P0: `npm run build` `packages/web` PASS.

---

## 1. TỔNG QUAN & DEPENDENCIES

**Mục tiêu:** Đóng 4 findings blocker/high của Giám sát mà không đổi contract BE, không thêm API, chỉ sửa i18n + FE mapping + hiển thị, để ảnh 1-7 không còn `soc.matrix.title` / `Queue tier chưa đặt tên` / `STARVED` giả / `soc.dataops.anomaly_guard_desc`.

**Không làm (out of scope Entry 107):** F-G04 `Re­connecting` SSE (`useDataOpsStream.ts:30`, `dataops_stream.py:116`) — để backlog riêng, chưa xác minh độc lập (ghi “CHƯA XÁC MINH”). Mọi slice dưới không chạm SSE.

**Nhánh & dirty:** Tạo nhánh mới từ `dev` sạch, cherry-pick chỉ 6 files của Entry 107 (xem `git diff --stat` lọc), không mang theo 22 files rác khác (`DOCKER_STARTUP_GUIDE.md:17`, `service_ops/urls.py`, etc). Lệnh:

```bash
git checkout dev
git checkout -b fix/dataops-giamsat-p0-107
git cherry-pick --no-commit <hash Entry107>  # hoặc apply patch 6 files bên dưới
git reset HEAD -- docs/AUDIT*.md  # giữ audit riêng
```

**Tiền điều kiện:** `npm ci --legacy-peer-deps` `packages/web` đã cài, `vitest` `jest` chạy được, `vi.js` hiện có 2 block `soc.matrix` (verify `grep -n "matrix:" packages/web/src/i18n/vi.js` ra 2 dòng `802` và trong `1050-1093` nếu chưa fix).

---

## 2. PHÂN RÃ SLICE — YÊU CẦU ĐẠT + TIÊU CHÍ AUDIT (team làm không cần hỏi)

### Slice 1 — F-G01: Xoá block `soc.matrix` duplicate bị shadowing (P0 BLOCKER)

**Goal:** Ảnh 1-2 không còn `soc.matrix.title/recent_cycles/no_cycles` lộ thô, hiển thị `Ma trận snapshot trực tiếp` / `Các chu kỳ gần đây` / `Chưa có chu kỳ nào`.

**Files (duy nhất):**
- `packages/web/src/i18n/vi.js:1050-1093` (44 dòng, block cũ `matrix: {loading/monitor_title/active_cycle/idle/...}` 0 consumer)
- `packages/web/src/i18n/en.js:1050-1093` (tương ứng, 44 dòng)

**Yêu cầu chi tiết (phải đạt, không được sai):**
1. Xoá toàn bộ block thứ 2 `matrix: { ... }` tại `vi.js:1050-1093` và `en.js:1050-1093` — giữ lại block thứ 1 `vi.js:802-812` `matrix: {title/start_cycle/loading/recent_cycles/no_cycles/abort/providers/abort_confirm/cycle_started}` (9 keys) và `en.js:802-812`.
2. Không thêm keys mới, không đổi key nào ở block 1.
3. Sau xoá, `grep -c "matrix:" vi.js` phải = **1** (trước =2), `grep -n "soc\.matrix" vi.js` chỉ còn 0 hit hoặc hit trong comment (không trong object).
4. `grep -R "soc\.matrix\.title" packages/web/src --include="*.ts" --include="*.tsx"` vẫn phải hit `SocMatrixScrapeMonitor.tsx:105` `t("soc.matrix.title")` (consumer còn, không phải 0 consumer như block cũ).

**Không làm:** Đổi `t("soc.matrix.title")` thành `t("soc.dataops.matrix_title")` — sai, vì consumer đã đúng, chỉ cần xoá shadowing.

**Tiêu chí audit cho reviewer (chỉ grep, không cần chạy app):**

```bash
# 1. Còn duy nhất 1 block matrix
grep -n "matrix:" packages/web/src/i18n/vi.js  # expect 1 line: 802
grep -n "matrix:" packages/web/src/i18n/en.js  # expect 1 line: 802
# 2. Không còn block 1050-1093
test ! $(grep -n "monitor_title" packages/web/src/i18n/vi.js) && echo PASS || echo FAIL
# 3. File vẫn parse được
node -c packages/web/src/i18n/vi.js && echo "vi.js parse OK"
node -c packages/web/src/i18n/en.js && echo "en.js parse OK"
# 4. tsc không vỡ
npx tsc --noEmit --project packages/web/tsconfig.json  # expect exit 0
```

**DoD Slice 1:** `grep` trên pass + `npx tsc --noEmit` 0 + `npm run build` sau khi gộp 4 slices vẫn PASS (không cần build riêng).

**Rủi ro & giảm thiểu:** Xoá nhầm block 1 (802) thay vì block 2 → mất 9 keys đang dùng → UI sẽ lộ `soc.matrix.title` tiếp. Giảm thiểu: trước khi xoá `read vi.js:798-815` và `read vi.js:1048-1095`, diff 2 block, xác nhận block 2 có `monitor_title/active_cycle/idle` (không có `recent_cycles`).

---

### Slice 2 — F-G02: Bổ sung 3 keys `anomaly_guard_desc` bị thiếu (P0)

**Goal:** Ảnh 5-6 không còn `soc.dataops.anomaly_guard_desc` / `no_critical_gaps` / `no_hot_breach` lộ thô, panel `Giám sát dị thường dòng dữ liệu` hiện mô tả + 2 dòng “Không có ...”.

**Files:**
- `packages/web/src/i18n/vi.js:548-555` trong `dataops: { anomaly_guard, ... }`
- `packages/web/src/i18n/en.js:548-555` tương ứng

**Yêu cầu chi tiết:**
1. Thêm **đúng 3 keys** (không thêm thừa) vào `dataops` object, ngay sau `anomaly_guard`:
   - `vi.js:549` `anomaly_guard_desc: 'Tự động phát hiện khoảng trống dữ liệu và vi phạm hot tier trong pipeline thị trường để cảnh báo sớm cho vận hành viên.'`
   - `vi.js:552` `no_critical_gaps: 'Không có khoảng trống nguy cấp'`
   - `vi.js:555` `no_hot_breach: 'Không có vi phạm hot tier'`
   - `en.js` tương ứng: `anomaly_guard_desc: 'Automatically detects data gaps and hot tier breaches ...'`, `no_critical_gaps: 'No critical gaps'`, `no_hot_breach: 'No hot tier breaches'`
2. Giữ thứ tự `anomaly_guard` → `anomaly_guard_desc` → `anomaly_promotion_backlog` → `anomaly_repair_age` → `anomaly_critical_gaps` → `no_critical_gaps` → `anomaly_hot_breaches` → `no_hot_breach` (khớp ảnh 5 thứ tự `Khoảng trống nguy cấp` rồi `Vi phạm hot tier`).
3. Không đổi bất kỳ key `anomaly_*` cũ.

**Tiêu chí audit:**

```bash
grep -n "anomaly_guard_desc" packages/web/src/i18n/vi.js  # expect 1 hit
grep -n "no_critical_gaps" packages/web/src/i18n/vi.js   # expect 1
grep -n "no_hot_breach" packages/web/src/i18n/vi.js      # expect 1
# 3 keys đều có bản en
grep -n "anomaly_guard_desc" packages/web/src/i18n/en.js
# Không còn lộ thô trong code (consumer đã có, chỉ thiếu key)
grep -n "t(\"soc.dataops.anomaly_guard" packages/web/src/components/soc/SocDataOpsMonitorSection.tsx  # expect 1-2 hits
npx tsc --noEmit  # 0
```

**DoD Slice 2:** `t("soc.dataops.anomaly_guard_desc")` render tiếng Việt trong `SocAnomalyGuardPanel.tsx:30`, không còn `soc.dataops.*` trong DOM snapshot test.

---

### Slice 3 — F-G03: Sửa `TIER_LABEL_KEYS` khớp BE `hot_user_demand` (P0)

**Goal:** Ảnh 3-4-7 không còn `Queue tier chưa đặt tên` ×8, hiển thị đúng `Nhu cầu người dùng nóng` / `Thị trường thanh khoản ấm` / `Thị trường toàn cục lạnh` / `Hàng đợi phục hồi`.

**Files:**
- `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:102-108` `const TIER_LABEL_KEYS`
- (Không chạm BE `dataops_market_data.py:30` — BE đã đúng)

**Yêu cầu chi tiết:**
1. Đổi `TIER_LABEL_KEYS` từ 4 keys ngắn `hot/warm/cold/recovery` thành **4 keys dài** khớp `QUEUE_TIER_ORDER` BE:
   ```ts
   const TIER_LABEL_KEYS: Record<string, string> = {
     hot_user_demand: "soc.dataops.tier_hot_user_demand",
     warm_liquid_market: "soc.dataops.tier_warm_liquid_market",
     cold_full_market: "soc.dataops.tier_cold_full_market",
     recovery_backlog: "soc.dataops.tier_recovery_backlog",
   };
   ```
2. Giữ fallback `|| "soc.dataops.unknown_tier"` cho tier lạ, nhưng sau fix không còn fallback trong ảnh.
3. Không đổi `vi.js:675-678` 4 keys `tier_hot_user_demand`... (đã có sẵn).

**Tiêu chí audit:**

```bash
grep -n "TIER_LABEL_KEYS" packages/web/src/components/soc/SocDataOpsMonitorSection.tsx  # expect hit với 4 keys dài
grep -n "hot_user_demand" packages/web/src/components/soc/SocDataOpsMonitorSection.tsx | grep TIER_LABEL
# Không còn key ngắn
! grep -q "\"hot\":" packages/web/src/components/soc/SocDataOpsMonitorSection.tsx && echo PASS
# Runtime: 4 starvation + 4 queue tier table đều không chứa "chưa đặt tên"
grep -n "unknown_tier" packages/web/src/i18n/vi.js  # vẫn tồn tại nhưng không render
npx tsc --noEmit  # 0
```

**DoD Slice 3:** Reload ảnh 3 `Chỉ báo starvation` 4 dòng hiện tên tier đúng, ảnh 7 `Queue tier` table 4 dòng hiện tên đúng.

---

### Slice 4 — F-V06: `neverRun` starvation hiển thị “Chưa có lần chạy” + hero bỏ đếm null (P1 → P0 trong Entry 107)

**Goal:** Ảnh 3 `Chỉ báo starvation` không còn `Giây - / ngưỡng 90` + `STARVED` 4/4 đỏ giả; thay bằng badge xám `Chưa có lần chạy` và hero `STARVED TIERS` không đếm tier chưa chạy. Khi có `latest_progress_started_at` thì hiện `12s / 90` và `STARVED` đỏ đúng.

**Files:**
- `packages/web/src/i18n/vi.js:556` + `en.js:556` thêm `starved_never_run`
- `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:528-560` `starvationIndicator` + hero `:465` `STARVED TIERS` count
- (BE `dataops_market_data.py:779` giữ nguyên `is_starved=True` khi `null` — FE chịu trách nhiệm hiển thị đúng, không đổi BE)

**Yêu cầu chi tiết:**
1. `vi.js:556` thêm `starved_never_run: 'Chưa có lần chạy'` (sau `starved_no`), `en.js:556` `starved_never_run: 'Never run'`.
2. `SocDataOpsMonitorSection.tsx` starvation card `:528-560`:
   - Tính `const neverRun = item.seconds_since_last_progress == null`
   - Badge: `neverRun ? {bg:"rgba(148,163,184,0.15)", color:"var(--soc-c-94a3b8)", text=t("soc.dataops.starved_never_run")} : isStarved ? danger : success`
   - Dòng `Giây ...`: `neverRun ? t("soc.dataops.starved_never_run") : t("soc.dataops.starvation_last_progress_seconds", {seconds, threshold})`
   - Progress bar `pct` khi `neverRun` → `0` và `background muted`
3. Hero `STARVED TIERS` `:465` đổi filter từ `.filter(s=>s.is_starved).length` thành `.filter(s=>s.is_starved && s.seconds_since_last_progress != null).length` và `some` tương tự, để 4 tier `null` ban đầu = `0` không phải `4` đỏ (khớp ảnh 2 `STARVED TIERS 4` trước fix → sau fix `0` xám khi chưa có chạy, `4` đỏ chỉ khi thực sự starved).

**Tiêu chí audit:**

```bash
grep -n "starved_never_run" packages/web/src/i18n/vi.js  # expect 1
grep -n "starved_never_run" packages/web/src/i18n/en.js
grep -n "neverRun" packages/web/src/components/soc/SocDataOpsMonitorSection.tsx  # expect 2-3 hits
# Không còn hardcode STARVED khi null
! grep -A2 "seconds_since_last_progress.*null" packages/web/src/components/soc/SocDataOpsMonitorSection.tsx | grep -q "STARVED" && echo "should not starved when null"
npx tsc --noEmit
# Vitest
npm run test:components -- src/components/__tests__/soc-monitor.component.test.tsx  # expect 5/5
```

**DoD Slice 4:** Ảnh 3 `Chỉ báo starvation` 4 dòng khi `null` hiện `Chưa có lần chạy` xám + `0%` progress, hero `STARVED TIERS 0` xám; khi `mock seconds_since=10 threshold 90` hiện `10 / 90` + `Ổn định` xanh / `STARVED` đỏ khi `>threshold`.

**Test bắt buộc (5 cases đã có trong Entry 107):**

```tsx
// soc-monitor.component.test.tsx — 5 tests đã pass 37.40s
it("queue tiers ok shows FPT") // F-G03
it("observability empty shows emptyState not Failed to fetch") // F-G04 ngoài scope nhưng cover
it("coverage matrix shows ratio tooltip 537 / 1533 (35.0%)") // P0-2
it("matrix allSettled: renders cycles even when providers fails") // non-blocking
it("retry button when observability fails and retries on click") // P0 tách lỗi
```

---

## 3. GATES TỔNG (chạy thật, không tin log cũ)

Sau khi gộp 4 slices, chạy **trên worktree sạch** (chỉ 6 files trên):

```bash
# 1. tsc
npx tsc --noEmit --project packages/web/tsconfig.json  # expect 0

# 2. grep còn duy nhất 1 block matrix
grep -n "matrix:" packages/web/src/i18n/vi.js | wc -l  # expect 1
grep -n "monitor_title" packages/web/src/i18n/vi.js && echo FAIL || echo PASS  # expect PASS (không còn block cũ)

# 3. vitest 5/5 soc-monitor
npm run test:components -- src/components/__tests__/soc-monitor.component.test.tsx  # expect 5 passed

# 4. build
npm run build --prefix packages/web  # expect PASS ~37s (log 37.40s Entry 107)

# 5. Không còn lộ thô khi build (grep dist)
grep -R "soc\.matrix" packages/web/dist --include="*.js" | grep -v "soc.*.js" && echo FAIL || echo PASS
```

**Entry 107 đã chạy thật và pass cả 4 gates trên.** Reviewer chỉ cần chạy lại 5 lệnh trên trên nhánh `fix/dataops-giamsat-p0-107` sạch là đủ, không cần hỏi lại logic `queueTiersError` vs `observabilityError`.

---

## 4. CONTRADICTIONS ĐÃ XỬ LÝ

| # | Audit gốc | Thực tế Entry 107 | Hành động |
|---|-----------|-------------------|-----------|
| C1 | `vi.js:793 thiếu 5 keys soc.matrix` | `vi.js:802 đủ 9 keys + vi.js:1050-1093 duplicate shadowing` `grep -n matrix: vi.js` 2 hits | **Xoá block duplicate 1050-1093**, không thêm keys — audit gốc sai, team không được làm theo audit gốc |
| C6 | Không có | Block cũ 0 consumer `grep -R soc\.matrix packages/web/src --include="*.tsx" | grep -v SocMatrix` = 0 | Bài học Nguyên tắc 3: mọi reference phải `grep` xác nhận tồn tại |

---

## 5. RỦI RO & KHÔNG LÀM

- **Không chạm F-G04 (Re­connecting):** `useDataOpsStream.ts:30` + `dataops_stream.py:116` cần xác minh độc lập với `Last-Event-ID / since` + `soc_stream 60/min` + `idle 1h` như `signals_stream.py` — để backlog riêng, không tính DoD P0 Entry 107. Nếu reviewer thấy `Re­connecting` vẫn xám trong ảnh 1, đó là **expected** ngoài scope.
- **Dirty worktree:** Hiện `git diff --stat` 28 files, trong đó `DOCKER_STARTUP_GUIDE.md`, `service_ops/urls.py`, `soc.js`, `DataOpsContext.tsx`, `SocDataOpsConfigSection.tsx`, `SocDataOpsOperationsSection.tsx`, `SocPrefetchPanel.tsx`, `SocSchedulerBoard.tsx`, `soc.components.css` là rác không liên quan 4 slices — **không commit** vào nhánh fix, chỉ commit 6 files: `vi.js`, `en.js`, `SocDataOpsMonitorSection.tsx`, `SocMatrixScrapeMonitor.tsx` (không có), `SocAnomalyGuardPanel.tsx` (nếu có), `soc-monitor` test + `i18n` — kiểm `git diff --stat -- packages/web/src/i18n/vi.js packages/web/src/i18n/en.js packages/web/src/components/soc/SocDataOpsMonitorSection.tsx` phải = 4 files.
- **Build image:** Không cần `docker compose build --no-cache frontend 106s` cho 4 slices i18n/FE mapping — chỉ cần `docker cp dist` như Entry 107 đã làm, reviewer verify bằng `grep` không cần docker.

---

## 6. HANDOVER CHECKLIST CHO REVIEWER (không cần hỏi lại)

- [ ] `grep -n "matrix:" vi.js` =1, `grep monitor_title` =0
- [ ] `grep -n "anomaly_guard_desc" vi.js` =1, `no_critical_gaps` =1, `no_hot_breach` =1 (cả `en.js`)
- [ ] `grep -n "hot_user_demand" SocDataOpsMonitorSection.tsx` =1 (trong `TIER_LABEL_KEYS`), không còn `"hot":`
- [ ] `grep -n "starved_never_run" vi.js` =1, `neverRun` trong `SocDataOpsMonitorSection.tsx` =2
- [ ] `npx tsc --noEmit` 0
- [ ] `vitest soc-monitor 5/5` (37.40s)
- [ ] `npm run build` PASS
- [ ] Reload `http://127.0.0.1/operations-center?tab=dataops` ảnh 1-7 không còn `soc.matrix`/`chưa đặt tên`/`STARVED` giả (F-G04 `Re­connecting` được phép bỏ qua)

*Kết thúc — file này đủ để đội code thực hiện lại Entry 107 từ đầu mà không cần hỏi, và reviewer chỉ cần 7 lệnh grep + tsc + vitest + build là pass/fail.*
