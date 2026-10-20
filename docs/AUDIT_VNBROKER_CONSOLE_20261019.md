# AUDIT — Tab VNBroker (`/operations-center?tab=vnbroker`)

> **Ngày:** 2026-10-19 · **Baseline:** `dev` @ `e7b008f25` (đồng bộ `origin/dev`, 0 ahead / 0 behind)
> **Branch:** `feat/vnbroker-console` → `dev` · **Claim:** `vnbroker-console` (`docs/CLAIMS.md`)
> **Phạm vi:** `packages/web/src/components/soc/SocVnbrokerPanel.tsx` + adapter `packages/web/src/adapters/core/soc.js` + BE `packages/core/backend/src/service_ops/**`
> **Slice 1 = DOC-ONLY.** Chưa sửa code FE. 4 câu hỏi cần Owner chốt ở §F trước khi code.
> **Lessons áp dụng:** [L-001, L-002, L-M02, L-F03, L-G02, L-G04, L-V01, L-V02, L-V03, L-V04, L-T01]

---

## Tóm tắt 5 finding nghiêm trọng nhất

Tab VNBroker **trông như đang hoạt động nhưng thực tế gần như mọi con số đều sai hoặc là số bịa**. (1) **Áp dụng cấu hình mất 100% chỉnh sửa của người dùng**: FE gửi nguyên *envelope* API (`id`, `service`, `applied_by`, `providers_catalog`…) làm `config_payload`, trong khi BE chỉ đọc key cấp 1 ⇒ mọi chỉnh sửa bị **âm thầm ghi đè bằng mặc định** (đã chạy code thật: `timeout.connect 99→10`, `preferred_provider kbs→vci`, `rpm 5→60`). (2) **Bảng benchmark chết**: FE đọc `result.results[]` với 4 tên field không tồn tại, BE trả `{has_report, report:{results:[…]}}` ⇒ bảng **luôn rỗng** kể cả sau khi bấm "Chạy thử nghiệm". (3) **Badge "ĐANG KẾT NỐI (CLOSED)" là xanh giả**: FE đọc `.tripped` (BE không có field này) **và** BE `circuit-breaker-status` là **stub hardcode** luôn trả `closed`/`failures: 0`. (4) **3 khối số liệu "Sức khỏe / Thông lượng / Tỷ lệ lỗi" được tính bằng công thức bịa** trong adapter (`1000/avg_response_ms`, map `status→0/25/50/100%`) chứ không phải số đo. (5) **Thử nghiệm kết nối luôn thành công** vì BE trả `latency_ms: 45` cứng mà không gọi provider. Nguyên nhân gốc chung: **UI và BE không có hợp đồng (contract) thật** — adapter chỉ được test bằng cách assert URL, không assert shape, nên 5 lỗi này tồn tại mà `tsc`/`lint`/`i18n` vẫn xanh.

---

## A. Bản đồ kiến trúc

| File | LOC | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | 130 | Router 9 tab SOC | `?tab=` + `localStorage soc_active_tab` (`:26-36`, `:42-71`) |
| `packages/web/src/components/soc/SocTabNavigation.tsx` | 51 | Render tab bar | `overflow-x:auto` + mask (`:31-50`) |
| **`packages/web/src/components/soc/SocVnbrokerPanel.tsx`** | **463** | **Panel VNBroker** | **đối tượng refactor** |
| `packages/web/src/components/soc/SocServiceHealthCard.tsx` | 81 | Card provider | dùng chung với panel khác |
| `packages/web/src/components/soc/SocConfigPreviewModal.tsx` | 202 | Modal preview/apply | có sẵn `diffTable`/`jsonBlock` |
| `packages/web/src/components/soc/SocOwnershipBadge.tsx` | 51 | Badge quyền ghi | **không dùng ở tab này** |
| `packages/web/src/components/soc/SocWriteGuardBanner.tsx` | 39 | Banner read-only | **không dùng ở tab này** |
| `packages/web/src/components/soc/socStatusColors.ts` | 93 | Map status → màu | `toneColor`/`getStatusBadgeStyle` |
| `packages/web/src/adapters/core/soc.js` | 740 | Adapter SOC | VNBroker `:102-136`; metrics giả `:247-263` |
| `packages/core/backend/src/service_ops/views/vnbroker.py` | 663 | 7 endpoint VNBroker | 2 endpoint là **stub** |
| `packages/core/backend/src/service_ops/views/mixins.py` | 125 | `ConfigApplyMixin` | validate + audit + concurrency |
| `packages/core/backend/src/service_ops/domain_configs/vnbroker.py` | 232 | Schema config typed | `from_dict`/`to_dict` = SSOT |
| `packages/core/backend/src/service_ops/provider_catalog.py` | 163 | Catalog 3 provider | vci / kbs / dnse |
| `packages/core/backend/src/service_ops/urls.py` | — | 9 route vnbroker | `:49-57` |
| `packages/core/backend/src/market_data/vnbroker_benchmark.py` | ~325 | Benchmark + recommendation | `:158-174`, `:190-242`, `:285-299` |
| `packages/web/src/components/soc/soc.components.css` | 4076 | **395 class** sẵn có | tái dùng được gần như toàn bộ |
| `packages/web/src/components/soc/soc.tokens.css` | 192 | Design token | 2 theme (dark/light) |
| `packages/web/src/components/soc/soc.module.css` | 3 | **Barrel re-export** | `@import` tokens + components |

**Không có test nào cho panel.** `packages/web/src/adapters/core/__tests__/soc.test.js:82-132` chỉ assert **URL** + wrapper, không assert shape response ⇒ contract sai vẫn xanh (L-V04).

---

## B. Luồng dữ liệu đã trace

### B1. Đọc cấu hình (use-case chính)

1. `ShellOperationsCenterPage.tsx:83-84` → render `SocVnbrokerPanel`
2. `SocVnbrokerPanel.tsx:124-126` → `useEffect` → `fetchData()`
3. `SocVnbrokerPanel.tsx:101-107` → `Promise.all` **5** call:
   | # | Adapter | HTTP | BE view |
   |---|---|---|---|
   | 1 | `soc.js:102-104` `getSocVnbrokerConfig` | GET `/operator/soc/vnbroker/config/` | `views/vnbroker.py:328-363` |
   | 2 | `soc.js:114-116` `getSocVnbrokerHealth` | GET `…/health/` | `views/vnbroker.py:441-457` |
   | 3 | `soc.js:122-124` `getSocVnbrokerProviders` | GET `…/providers/` | `views/vnbroker.py:521-550` |
   | 4 | `soc.js:130-132` `getSocVnbrokerBenchmarkLatest` | GET `…/benchmark/` | `views/vnbroker.py:612-616` |
   | 5 | `soc.js:134-136` `getSocVnbrokerCircuitBreaker` | GET `…/circuit-breaker-status/` | `views/vnbroker.py:565-579` |
4. `SocVnbrokerPanel.tsx:109-115` → setState; `setEditConfig(JSON.stringify(cfg))` ← **editor nhận envelope**
5. `SocVnbrokerPanel.tsx:210-445` → render

### B2. Áp dụng cấu hình (use-case có dữ liệu mất)

1. `SocVnbrokerPanel.tsx:129` `JSON.parse(editConfig)` → **envelope**
2. `SocVnbrokerPanel.tsx:150` → `applySocVnbrokerConfig(parsed)`
3. `soc.js:106-108` → `corePost("/operator/soc/vnbroker/config/", { config_payload: <envelope> })`
4. `views/vnbroker.py:365-388` → `ConfigApplyMixin.apply_config(...)`
5. `views/mixins.py:81` → `config_obj = config_class.from_dict(config_payload)`
6. `domain_configs/vnbroker.py:182-212` → `from_dict` đọc **key cấp 1**: `timeout`, `max_retries`, `preferred_provider`, `fallback_providers`, `requests_per_minute`, `burst_limit`, `per_provider_config`, `enabled`
   → **envelope không có key nào ở cấp 1** ⇒ `from_dict` trả **toàn bộ mặc định**
7. `views/mixins.py:98-104` → lưu `config_payload=config_obj.to_dict()` ⇒ **mất sạch chỉnh sửa**
8. `views/mixins.py:107-116` → `ConfigChangeAudit` với `change_summary = request.data.get('change_reason','')` ⇒ **rỗng** vì FE không gửi `change_reason`

### B3. Chuỗi giả (đã chạy thật)

```
VnbrokerDomainConfig.from_dict(<envelope>) →
{
  "timeout": {"connect": 10.0, "read": 30.0, "write": 10.0, "pool": 5.0},
  "max_retries": 3, "retry_delay_seconds": 2.0,
  "preferred_provider": "vci", "fallback_providers": ["kbs","dnse"],
  "enabled": true, "circuit_breaker_threshold": 5, …,
  "requests_per_minute": 60, "burst_limit": 10, "per_provider_config": {}
}
```
Trong khi user đã sửa trong textarea: `connect:99, read:77, write:55, pool:4, max_retries:9, preferred_provider:"kbs", fallback:["dnse"], rpm:5, burst:2`.

---

## C. CONTRADICTIONS (audit cũ vs code thật)

Audit trước (`docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md:214-219`, mục D10) chỉ ghi **2 finding P2** cho VNBroker. Cả 2 đều **sai một nửa** và **bỏ sót 8 lỗi P0/P1**:

| # | Audit cũ nói | Code thật | Đánh giá |
|---|---|---|---|
| X-01 | COC-46: "Throughput tính 2 nơi, lệch 1 decimal" | `soc.js:247-263` dùng **công thức bịa** `1000/avg_response_ms`; FE dùng đúng 1 nơi | **thiếu sót** — vấn đề gốc là số liệu không tồn tại, không phải lệch làm tròn |
| X-02 | COC-47: "Dùng `health.is_active` từ BE" | BE **không có** `is_active` lẫn `provider_health` (`views/vnbroker.py:131-141`) | **sai** — đề xuất fix không khả thi; vấn đề là adapter tự chế dữ liệu |
| X-03 | "8 tab router" (audit `:21`) | `ShellOperationsCenterPage.tsx:26-36` có **9** tab (thêm `broker`) | stale |
| X-04 | COC-49 (audit `:226`) "Runtime KPI placeholder" | `SocRuntimeKpiPanel.tsx` vẫn placeholder ⇒ tab chết vẫn còn | còn đúng, chưa xử lý |
| X-05 | `AUDIT_OPERATIONS_CENTER_UI_UX_AND_TECHNICAL_GAPS_20260701.md:20` "config textarea có logical-OR fallback" | `SocVnbrokerPanel.tsx:110` dùng `JSON.stringify(cfg \|\| {}, null, 2)` — không có logical-OR fallback trong `onChange` | **đã hết hiệu lực** |

---

## D. Findings

### D1. P0 — chức năng đang hỏng (đã verify bằng chạy code thật)

| ID | Thực tế (file:line) | Tác động |
|---|---|---|
| **F-01** | FE gửi **envelope** làm `config_payload` (`SocVnbrokerPanel.tsx:110,129,150` + `soc.js:106-108`); BE chỉ đọc key cấp 1 (`domain_configs/vnbroker.py:182-212` + `views/mixins.py:81`) | **Mất 100% chỉnh sửa của user**; mọi lần "Áp dụng" đều ghi đè config bằng mặc định. Đã chạy thật — xem §B3 |
| **F-02** | FE đọc `change_summary` / `impact_warnings` / `validation_errors` (`SocVnbrokerPanel.tsx:132-137`); BE trả `valid` / `errors` / `config_payload` / `providers_catalog` / `impact` (`views/vnbroker.py:407-426`) | **Preview không bao giờ hiện lỗi** ⇒ user bấm "Áp dụng" xong mới nhận HTTP 400 |
| **F-03** | FE đọc `result.results[]` với `{latency_ms, rpm, success_rate, rate_limit_pct}` (`SocVnbrokerPanel.tsx:165-166,381-416`); BE trả `{has_report, report:{results:[…], recommendation:{…}}}` (`views/vnbroker.py:612-616,658-662`) với `{p50_latency_seconds, p95_latency_seconds, requests_per_minute, success_pct, rate_limited_pct, …}` (`vnbroker_benchmark.py:158-174`) | **0/5 tên field khớp + sai wrapper** ⇒ bảng benchmark **luôn rỗng** ("Chưa có kết quả thử nghiệm.") kể cả sau khi chạy |
| **F-04** | FE đọc `circuitBreaker?.tripped` (`SocVnbrokerPanel.tsx:285,291`); BE trả `{circuit_breaker:{status, failures, threshold, window_seconds, cooldown_seconds}, per_provider:{…}}` (`views/vnbroker.py:565-579`) **và đây là stub hardcode** — luôn `closed`/`failures: 0` | Badge "ĐANG KẾT NỐI (CLOSED)" **luôn xanh giả**, kể cả khi provider đang chết |
| **F-05** | `soc.js:19-29` `normalizeVnbrokerHealth` dựng `provider_health` từ **service** health (`status` cấp service) chứ không phải provider | "HOẠT ĐỘNG TỐT 1 / SUY GIẢM 0 / NGUY CẤP 0" — tổng luôn = 1 trong khi catalog có **3** provider |
| **F-06** | `soc.js:247-263` `getSocVnbrokerMetrics`: `throughput = 1000/avg_response_ms`; `error_rate` map cứng `healthy→0, degraded→25, unknown→50, unhealthy→100` | "Thông lượng 934.6/s" và "Tỷ lệ lỗi 0%" là **công thức bịa**, không phải số đo |
| **F-07** | BE `views/vnbroker.py:500-506` trả `{'status':'ok','latency_ms':45}` cứng, **không gọi provider** (còn comment `# Placeholder — in real implementation, call vnbroker_adapter`); FE bỏ luôn latency, chỉ toast "thành công" (`SocVnbrokerPanel.tsx:192-193`) | "Thử nghiệm kết nối" **luôn báo thành công** = xanh giả |
| **F-08** | FE chỉ dùng `prov.providers` (`SocVnbrokerPanel.tsx:112`), **bỏ** `primary` / `fallback` / `enabled` mà BE trả sẵn (`views/vnbroker.py:530-535`) | Operator **không biết provider nào đang chính / dự phòng** — mất đúng mục tiêu "quản trị broker tải dữ liệu" |

### D2. P1 — mất thông tin / lỗi trải nghiệm

| ID | Thực tế (file:line) | Tác động |
|---|---|---|
| **F-09** | Catalog provider có 13 field (`provider_catalog.py:123-137`), FE khai interface chỉ 6 và **dùng 4** (`SocVnbrokerPanel.tsx:40-47,433-440`); bỏ `runtime_gate`, `readiness_reason`, `credential_mode`, `required_runtime_envs`, `in_active_cycle`, `default_selected` | Provider thiếu credential (DNSE cần `SOC_MATRIX_DNSE_API_ID/KEY`) hiện "Chưa xác định" mà **không có lý do** — BE đã có sẵn `readiness_reason` tiếng Việt |
| **F-10** | `last_check_at` **không** truyền vào `SocServiceHealthCard` (`SocVnbrokerPanel.tsx:433-440` vs `SocServiceHealthCard.tsx:37-39`) | "Lần kiểm gần nhất: Chưa có" **vĩnh viễn** (khớp ảnh chụp) |
| **F-11** | `avg_response_ms` (**service**-level) gán cho **mọi** provider (`SocVnbrokerPanel.tsx:439`) | "Độ trễ 1ms" giống nhau ở mọi provider = ảo |
| **F-12** | BE có `VnbrokerOwnershipView` (`views/vnbroker.py:591-595`, route `urls.py:56`) nhưng adapter **không có** method — chỉ có `getSocSignalOwnership` (`soc.js:449`) và `getSocScreenerOwnership` (`soc.js:648`) | Không biết ai có quyền ghi trước khi apply; gặp 403 `OWNERSHIP_WRITE_DENIED` (`views/mixins.py:46-53`) mới biết |
| **F-13** | `<table>` benchmark không có class (`SocVnbrokerPanel.tsx:362-422`) | **HTML thô** — không viền, không header, không zebra, không padding. Đúng ảnh chụp |
| **F-14** | 3 `div` bên trong `SocServiceHealthCard` không có class (`SocServiceHealthCard.tsx:45-79`) | Xếp dọc, không lưới, không phân biệt nhãn / giá trị. Đúng ảnh chụp |
| **F-15** | Apply không gửi `change_reason`; BE ghi `change_summary = request.data.get('change_reason','')` (`views/mixins.py:103,114`) | **Audit trail rỗng** — mất dấu vết ai đổi gì. Panel "Môi giới" đã làm đúng (`SocBrokerPanel.tsx:219`) |
| **F-16** | Không gửi `expected_updated_at` dù BE hỗ trợ optimistic concurrency (`views/mixins.py:55-78`) | 2 operator sửa chồng → **mất cập nhật** không có cảnh báo |
| **F-17** | `status` tính `"degraded"` khi thiếu credential nhưng `is_active=false` ⇒ `getStatusLabel` trả "Chưa xác định" (`SocVnbrokerPanel.tsx:437-438` + `SocServiceHealthCard.tsx:22-31`) | Badge **mâu thuẫn** với trạng thái thật; nhánh `degraded` là **dead code** |
| **F-18** | `SocOwnershipBadge` + `SocWriteGuardBanner` tồn tại và đã dùng ở DataOps/Screener (`SocDataOpsConfigSection.tsx:685,708` · `SocScreenerPanel.tsx:332`) nhưng tab này **không dùng** | Thiếu cảnh báo read-only trên bề mặt ghi cấu hình |

### D3. P2 — i18n / kỹ thuật

| ID | Thực tế (file:line) | Tác động |
|---|---|---|
| **F-19** | **Trùng key** trong `soc.vnbroker` ở **cả** `vi.js` và `en.js`: `reset_confirm` (`:1013` vs `:1077`), `benchmark_title` (`:1020` vs `:1059`) | JS lấy key **sau** ⇒ `"Chạy thử nghiệm (Benchmark)"` chết. **Khớp ảnh chụp** (hiện "Benchmark provider") |
| **F-20** | **40/69 key** `soc.vnbroker.*` **chết** (đo bằng script Node quét đệ quy `src/`) — gồm label form đầy đủ (`timeout_connect`, `retry_section`, `per_provider_config_title`, `clear_provider_override`), cột benchmark (`benchmark_col_*`), và `optimized_save` / `optimized_badge_ready` / `optimized_primary` / `optimized_fallback` | **Bằng chứng một UI giàu thông tin từng được thiết kế rồi bị thay bằng JSON editor** — có sẵn nhãn để dựng lại |
| **F-21** | `test-connection` không có ô chọn provider ⇒ luôn gửi mặc định `'vci'` (BE `views/vnbroker.py:476`) | Không test được KBS/DNSE |
| **F-22** | Không poll / auto-refresh (panel khác trong SOC có, vd `SocSchedulerBoard.tsx:454-459`) | Số liệu cũ, phải F5 |
| **F-23** | Loading = 1 dòng text (`SocVnbrokerPanel.tsx:220`); error = 1 dòng không nút retry (`:222`) | Trải nghiệm yếu, không có đường thoát khi lỗi mạng |
| **F-24** | `handleResetToDefaults` gọi `applySocVnbrokerConfig({})` không preview, không `change_reason` (`SocVnbrokerPanel.tsx:174-187`) | Ghi đè cấu hình không có bước xác nhận diff |
| **F-25** | 9 tab tràn ngang — `.tabBar` có `overflow-x:auto` + mask (`soc.components.css:5-22`) nhưng ảnh 1920px vẫn cắt chữ tab cuối | Tab cuối ("Hiệu năng thời gian thực") bị cắt, không có affordance cuộn |

---

## E. Quality gates audit (đã chạy thật, không suy đoán)

| Gate | Kết quả | Bằng chứng |
|---|---|---|
| `npx tsc --noEmit` (`packages/web`) | **PASS** (exit 0) | chạy tại baseline `e7b008f25` |
| `npx eslint src/components/soc/SocVnbrokerPanel.tsx src/components/soc/SocServiceHealthCard.tsx src/adapters/core/soc.js` | **PASS** (exit 0) | — |
| `node scripts/i18n-scan-strict.mjs` | **PASS** (exit 0) | đã kiểm `git status` sạch sau khi chạy — **không ghi file** (L-V03) |
| `node scripts/check-lessons.mjs` | **PASS** (exit 0) | baseline 11 file / 45/60 lesson |
| `node packages/web/scripts/check-multi-agent.mjs` | **PASS** (exit 0) | 0 lỗi, 0 trùng số migration |
| `node scripts/normalize-eol.mjs` | **PASS** (exit 0) | `git diff --numstat` = `6 0 docs/CLAIMS.md` (không churn line-ending) |
| `npm run test` (jest) | **CHƯA CHẠY** | — |
| `npm run test:components` (vitest) | **CHƯA CHẠY** | — |
| `npm run build` | **CHƯA CHẠY** | — |
| BE test | **CHƯA CHẠY** | cần `CORE_DATABASE_URL` + Postgres |
| E2E / ảnh chụp thật sau khi sửa | **CHƯA CHẠY** | — |

### E1. Kiểm chứng deployment không stale

| Artifact | Kết quả |
|---|---|
| `packages/web/dist/assets/soc-CqdbE_IP.css` (local build `2026-10-19T08:52`) | 76 569 byte |
| `https://docker.edusuccess.vn/assets/soc-Ql-MEZQk.css` | 76 569 byte — **cùng nội dung** |
| Kiểm tra class | `serviceCard`, `metricCard`, `glassPanel`, `actionBtn`, `configEditor`, `sectionGrid` đều **có** trong CSS deploy |

⇒ **Ảnh chụp phản ánh đúng code hiện tại**, không phải bản cũ. (Lưu ý: Vite/postcss-modules **có** scope các class trong `soc.components.css` được `@import` từ `soc.module.css` — tên ra `_metricCard_ovxpd_1`. Xem lesson mới `L-F09` trong `docs/LESSONS/css-soc.md`.)

---

## F. Câu hỏi cần Owner / PM chốt trước khi code

> **ĐÃ CHỐT 2026-10-19:** **Q1=B** (sửa BE — nối circuit breaker + test-connection thật) · **Q2=B** (thêm endpoint health per-provider) · **Q3=C** (được thêm class mới + token mới) · **Q4=A** (giữ 9 tab, rút gọn nhãn + affordance cuộn).
> Kết quả triển khai ở **§I**.

| # | Câu hỏi | Ảnh hưởng | Phương án A (FE-only) | Phương án B (được sửa BE) | **Owner chọn** |
|---|---|---|---|---|---|
| **Q1** | Cho phép sửa **BE** trong slice này không? (`VnbrokerCircuitBreakerView` + `VnbrokerTestConnectionView` là stub) | F-04, F-07 | Gắn nhãn "chưa nối runtime" + ẩn số giả | Nối runtime thật qua `market_data.vnbroker_adapter` | **B** |
| **Q2** | Có thêm endpoint **health per-provider** (latency/error thật từng provider) không? | F-05, F-11, F-14 | Chỉ hiển thị `provider_catalog` (ready/gate/lý do) + health cấp service, **xoá** số liệu bịa | Thêm `provider_health` thật | **B** |
| **Q3** | Cho phép thêm bao nhiêu class CSS mới? | F-13, F-14 | Tái dùng 100% class có sẵn | Cho phép thêm class + token mới | **C** |
| **Q4** | Giữ 9 tab hay gom lại? | F-25 | Giữ, thêm affordance cuộn + rút gọn nhãn | Gom 9 → 6 tab nhóm | **A** |

**Không cần hỏi:** màu tăng/giảm giữ chuẩn Bloomberg (xanh = tăng) — không đụng vùng này (L-F08).


---

## G. Đánh giá tổng thể + đề xuất refactor

### G1. Đánh giá

- **Implementable?** Có. Toàn bộ lỗi P0/P1 đều nằm ở **lớp hợp đồng FE↔BE** và **lớp trình bày** — không cần đổi mô hình dữ liệu, không cần migration.
- **Blocker?** **Q1 + Q2** là blocker cho phần "giám sát sức khỏe thật". Phần còn lại (form cấu hình + provider registry + benchmark + ownership) **làm được ngay không cần BE**.
- **Ưu tiên sửa trước:** F-01 (mất dữ liệu) → F-03/F-02 (chức năng chết) → F-05/F-06/F-07 (số giả) → F-08/F-09 (mất thông tin) → F-13/F-14 (UI thô) → F-19/F-20 (i18n).
- **Rủi ro khi làm:** `packages/web/src/i18n/{vi,en}.js` là file **nhiều agent đụng** — claim `ai-cc-uiux` ghi `i18n/vi.js` + `i18n/en.js` (đã `done`/released ở `CLAIMS.md`), cần khai claim cụ thể và merge cẩn thận.

### G2. Bố cục mới (information architecture)

| # | Vùng | Nội dung | Class tái dùng |
|---|---|---|---|
| **0** | Hero KPI strip (sticky) | Provider chính · Provider dự phòng · Sẵn sàng `x/y` · Timeout read · Req/phút + burst · Retry max + delay | `metricGrid` · `metricCard` · `metricLabel` · `metricValue` |
| **1** | **Bộ nhà cung cấp** (tile grid 3 cột) | Tên provider · role badge (CHÍNH / DỰ PHÒNG / NGOÀI CHU KỲ) · status dot · readiness chip (`runtime_gate` + `readiness_reason` + `required_runtime_envs`) · credential mode · nút "Đặt làm chính" | `brokerTileGrid` · `brokerTileBadges` · `brokerBadge` · `brokerBadgeOk` · `brokerBadgeWarn` · `domainPill` · `statusDot` |
| **2** | **Cấu hình** (form, **thay JSON editor**) | Timeout (connect/read/write/pool) · Retry (max, delay) · Rate limit (rpm, burst) · Circuit breaker (threshold/window/cooldown) · Provider (preferred select + fallback multi-checkbox + enabled) · **per-provider override** · JSON nâng cao thu gọn · **change_reason bắt buộc** | `fieldGrid` · `fieldRow` · `fieldLabel` · `fieldInput` · `fieldUnit` · `fieldError` · `configEditor` (thu gọn) · `jsonBlock` |
| **3** | **Quan sát** | Circuit breaker: `circuit_breaker.status` + `failures/threshold` + `per_provider` (kèm nhãn "stub" nếu BE chưa nối) · Health: `status`/`last_check_at`/`last_success_at`/`consecutive_failures`/`avg_response_ms` · **xoá** throughput/error_rate bịa hoặc ghi rõ nguồn | `statusBadge` · `statusBadgeOk` · `statusBadgeOff` · `kvTable` · `kvTableWrap` · `metricCardSm` |
| **4** | **Benchmark** | Bảng với **đúng tên field BE** (`p50_latency_seconds`→ms, `requests_per_minute`, `success_pct`, `rate_limited_pct`, `concurrency`, `total_requests`, `failed_requests`) · cột khuyến nghị (`recommendation.primary_provider` / `fallback_provider` / `adaptive_start_concurrency`) · nút **"Lưu cấu hình tối ưu"** | `socDataTable` · `socDataTableWrap` · `socDataCellWrap` |
| **5** | **Quyền & Nhật ký** | `SocOwnershipBadge` + `SocWriteGuardBanner` + audit config (`exportSocConfigAudits({service_key:'vnbroker'})` — adapter đã có, `soc.js:60-65`) | `guardBanner` · `statusBadge` · `socDataTable` |

**Quy tắc áp dụng:** token → `soc.tokens.css`, class → `soc.components.css`, **không** dùng `soc.module.css` (L-F03). Dự kiến **không thêm token**; class mới ≤ 6 nếu Q3 cho phép.

### G3. Sửa hợp đồng (adapter `packages/web/src/adapters/core/soc.js`)

| Hàm | Hiện tại | Sửa thành |
|---|---|---|
| `getSocVnbrokerConfig` | trả nguyên envelope | `{ config_payload, providers_catalog, applied_at, applied_by, is_current }` — tách rõ payload thật |
| `applySocVnbrokerConfig` | `POST {config_payload: <envelope>}` | `POST {config_payload: <payload thật>, change_reason, expected_updated_at}` — **fix F-01** |
| `previewSocVnbrokerConfig` | trả `{valid, errors, impact}` | normalize về `{validationErrors, impactWarnings, changeSummary, providersCatalog}` — **fix F-02** |
| `getSocVnbrokerBenchmarkLatest` / `runSocVnbrokerBenchmark` | trả `{has_report, report}` | normalize `report.results[]` + đổi tên field sang `latency_ms` / `rpm` / `success_rate` / `rate_limit_pct` + `recommendation` — **fix F-03** |
| `getSocVnbrokerCircuitBreaker` | trả `{circuit_breaker, per_provider}` | normalize `{status, failures, threshold, per_provider, is_stub}` — **fix F-04** |
| `getSocVnbrokerHealth` | tự chế `provider_health` | **bỏ** `provider_health` giả, trả nguyên health cấp service — **fix F-05** |
| `getSocVnbrokerMetrics` | công thức bịa | **xoá** hoặc trả `null` + nhãn "chưa có nguồn số liệu" — **fix F-06** |
| `getSocVnbrokerProviders` | FE bỏ `primary`/`fallback` | expose `primary` / `fallback` / `enabled` / `providers` — **fix F-08** |
| **mới** `getSocVnbrokerOwnership` | chưa có | `GET /operator/soc/vnbroker/ownership/` — **fix F-12** |

### G4. Kế hoạch test (bắt buộc — L-V04: assert **giá trị thật**, không assert "không xảy ra")

**Tệp mới:** `packages/web/src/components/__tests__/soc-vnbroker-console.component.test.tsx`

| # | Test | Loại |
|---|---|---|
| T1 | Render đúng số provider từ `providers_catalog` (3) + role badge chính/dự phòng theo `primary`/`fallback` | dương tính |
| T2 | **Apply gửi `config_payload` = payload thật** (không phải envelope) — assert giá trị từng field sau khi user sửa `preferred_provider` | dương tính (chặn F-01) |
| T3 | Preview có `errors` ⇒ hiển thị `validationErrors` trong modal | dương tính (chặn F-02) |
| T4 | Benchmark đọc `report.results[]` với tên field BE ⇒ bảng có dòng, `latency_ms` = `p50_latency_seconds × 1000` | dương tính (chặn F-03) |
| T5 | Circuit breaker đọc `circuit_breaker.status` ⇒ badge đổi theo `open`/`closed` | dương tính (chặn F-04) |
| T6 | Provider thiếu credential ⇒ hiện `readiness_reason` + `required_runtime_envs` (không phải "Chưa xác định") | dương tính (chặn F-09) |
| T7 | **Không** render số liệu bịa (throughput / error_rate) khi không có nguồn | âm tính có kiểm soát |
| T8 | Apply gửi `change_reason` bắt buộc (disable nút khi rỗng) | dương tính (chặn F-15) |

**Mở rộng:** `packages/web/src/adapters/core/__tests__/soc.test.js:82-132` — bổ sung assert **shape** (không chỉ URL) cho 9 hàm VNBroker.

### G5. Trình tự thực hiện (sau khi Owner chốt Q1–Q4)

| Bước | Nội dung | Gate sau mỗi bước |
|---|---|---|
| **S1** | Sửa contract ở `soc.js` (G3) + adapter test | `npx tsc --noEmit` + `npm run test:components` |
| **S2** | Viết `soc-vnbroker-console.component.test.tsx` (T1–T8) — **fail-before** phải đỏ trên code hiện tại | `npm run test:components` |
| **S3** | Viết lại `SocVnbrokerPanel.tsx`: KPI strip + provider tiles + form + quan sát | `npx tsc --noEmit` |
| **S4** | Benchmark + ownership + audit (SocConfigPreviewModal tái dùng) | `npx tsc --noEmit` |
| **S5** | CSS: tái dùng class có sẵn, thêm ≤6 class vào `soc.components.css`; **không** thêm token; **không** đụng `soc.module.css` | `npm run check:tokens` + `npm run check:contrast` |
| **S6** | i18n: dùng lại 40 key đang chết, gộp 2 key trùng, thêm key mới cho phần mới | `npm run i18n:scan:strict` |
| **S7** | Ảnh chụp thật trên staging + mở ảnh ra xem (L-V05) | E2E Playwright |
| **S8** | Đóng phiên: `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → gate) → claim `done` → push → `pwsh -File scripts/agent-pr.ps1` | toàn bộ |

**Gate bắt buộc:** `npx tsc --noEmit` sau **mỗi** sub-step · `npm run build` cuối mỗi step · `npm run lint` · `npm run test:components` · `npm run check:shell` · `node scripts/check-lessons.mjs`.

---

## H. Ghi chú quy trình (cần coordinator xử lý)

### H1. `agent-preflight` báo **false positive** khi ghi vào ledger

`node scripts/agent-preflight.mjs --staged` báo:

```
agent-preflight: 1 VI PHAM
  [claimed-in-progress]  docs/CODE_CHANGE_AUDIT_LEDGER.md
      Agent khác đang claim file này với trạng thái in-progress.
```

**Đã kiểm chứng là false positive** (L-V02):
- `docs/CLAIMS.md` có **4** dòng claim của agent `ai-cc-uiux` (`:1608`, `:1614`, `:1621` = `in-progress`; `:1627` = `**done**`).
- Dòng `**done**` (`:1627`) là dòng **đóng phiên** ⇒ công việc đã xong, PR đã merge, `Entry 383` đã nằm trong ledger ở `dev`.
- `docs/CLAIMS.md` là **append-only** ⇒ các dòng `in-progress` cũ **không bao giờ tự đổi** thành `done` ⇒ `check3ClaimedInProgress` cứ báo cho **mọi agent sau này** chạm vào ledger.
- `check-ledger-entry.mjs` **PASS** (0 trùng mới) ⇒ không có xung đột hunk thật.

**Đề xuất (chưa làm — ngoài phạm vi slice doc-only, cần claim riêng cho `tools/opencode-global/`):**
sửa `agent-preflight.mjs` → `check3ClaimedInProgress` bỏ qua dòng claim của agent mà **đã có dòng `done`/`released` sau nó** (superseded), hoặc yêu cầu agent khi đóng claim ghi rõ `superseded` ở dòng cũ.

### H2. Kiểm chứng mà không cần BE

Toàn bộ P0 ở §D1 đã được kiểm chứng **không cần môi trường BE**:
- **F-01** — gọi trực tiếp `VnbrokerDomainConfig.from_dict(<envelope>)` (script Python, không cần Django settings vì `provider_catalog.py` chỉ import `os`).
- **F-03 / F-04 / F-05 / F-06** — đối chiếu tên field giữa `soc.js` và `views/vnbroker.py` + `vnbroker_benchmark.py`.
- **F-19 / F-20** — script Node đếm key trùng + key chết.
- **E1 (deploy không stale)** — so kích thước CSS local build vs VPS.

---

## Phụ lục — Bằng chứng đo được

### P1. F-01 (mất dữ liệu) — chạy `VnbrokerDomainConfig.from_dict(<envelope>)`

```
SAVED CONFIG AFTER APPLY-ENVELOPE:
{ "timeout": {"connect": 10.0, "read": 30.0, "write": 10.0, "pool": 5.0},
  "max_retries": 3, "retry_delay_seconds": 2.0,
  "preferred_provider": "vci", "fallback_providers": ["kbs","dnse"],
  "enabled": true, "circuit_breaker_threshold": 5, …,
  "requests_per_minute": 60, "burst_limit": 10, "per_provider_config": {} }

USER INTENDED (envelope.config_payload):
{ "timeout": {"connect": 99.0, "read": 77.0, "write": 55.0, "pool": 4.0},
  "max_retries": 9, "preferred_provider": "kbs",
  "fallback_providers": ["dnse"], "requests_per_minute": 5, "burst_limit": 2 }
```

### P2. F-19 (trùng key i18n) — đếm bằng script Node trên `vi.js`/`en.js`

```
=== vi.js soc.vnbroker block lines 1007-1079 keys=69
  DUPLICATE key [reset_confirm] at lines 1013, 1077
  DUPLICATE key [benchmark_title] at lines 1020, 1059
=== en.js soc.vnbroker block lines 1007-1079 keys=69
  DUPLICATE key [reset_confirm] at lines 1013, 1077
  DUPLICATE key [benchmark_title] at lines 1020, 1059
```

### P3. F-20 (40 key chết) — quét đệ quy `packages/web/src/`

```
defined(unique)=69  used=29  DEAD=40
config, health, metrics, preferred_provider, max_retries, retry_delay_seconds,
requests_per_minute, burst_limit, circuit_breaker_threshold, timeout_section,
timeout_connect, timeout_read, timeout_write, timeout_pool, per_provider_config_title,
per_provider_config_hint, retry_section, rate_limit_section, clear_provider_override,
providers_status, provider_configured, provider_not_configured, benchmark_run,
benchmark_running, benchmark_ready, benchmark_no_report, benchmark_col_provider,
benchmark_col_latency, benchmark_col_rpm, benchmark_col_success, benchmark_col_rate_limited,
optimized_save, optimized_saving, optimized_saved_success, optimized_badge_ready,
optimized_preview_warning, optimized_primary, optimized_fallback, reset_to_defaults,
reset_success
```

### P4. E1 (deploy không stale) — so sánh CSS build local vs VPS

```
packages/web/dist/assets/soc-CqdbE_IP.css   76569 byte   (mtime 2026-10-19T08:52:36Z)
https://docker.edusuccess.vn/assets/soc-Ql-MEZQk.css   76569 byte
→ serviceCard / metricCard / glassPanel / actionBtn / configEditor / sectionGrid: đều CÓ
```

### P5. Mapping field FE ↔ BE (nguồn của F-03)

| Ý nghĩa | FE đọc (`SocVnbrokerPanel.tsx`) | BE trả (`vnbroker_benchmark.py:158-174`) | Khớp? |
|---|---|---|---|
| độ trễ | `latency_ms` | `p50_latency_seconds` / `p95_latency_seconds` | ✗ |
| thông lượng | `rpm` | `requests_per_minute` | ✗ |
| tỷ lệ thành công | `success_rate` | `success_pct` | ✗ |
| tỷ lệ rate-limit | `rate_limit_pct` | `rate_limited_pct` | ✗ |
| wrapper | `response.results` | `response.report.results` | ✗ |

---

## I. KẾT QUẢ TRIỂN KHAI (Slice 2 FE + Slice 3 BE)

> Owner chốt 2026-10-19: **Q1=B · Q2=B · Q3=C · Q4=A**. Branch `feat/vnbroker-console` → `dev`.
> Commit: `037e81ca7` (Slice 2 FE) · `911ea4582` (Slice 3 BE).

### I1. Slice 2 — FE (`037e81ca7`)

| Hạng mục | Trước | Sau |
|---|---|---|
| `getSocVnbrokerConfig` | trả nguyên envelope | trả `config` = **config payload thật** + `providers_catalog` + provenance |
| `applySocVnbrokerConfig` | `{config_payload: envelope}` | `{config_payload: payload, change_reason, expected_updated_at}` |
| `previewSocVnbrokerConfig` | trả thô | `validationErrors` + `impactWarnings` (mã) + `configPayload` |
| `getSocVnbrokerBenchmarkLatest` / `runSocVnbrokerBenchmark` | đọc `.results` (không tồn tại) | đọc `report.results` + đổi tên 4 field theo BE (`p50_latency_seconds`→`latency_ms`, `requests_per_minute`→`rpm`, `success_pct`→`success_rate`, `rate_limited_pct`→`rate_limit_pct`) |
| `getSocVnbrokerCircuitBreaker` | đọc `.tripped` (không tồn tại) | đọc `circuit_breaker.status` + `per_provider` + `source` |
| `getSocVnbrokerHealth` | tự chế `provider_health` | bỏ hẳn `provider_health` |
| `getSocVnbrokerMetrics` | `1000/avg_response_ms` + map status→% | **XOÁ** (số bịa) |
| `getSocVnbrokerProviders` | bỏ `primary`/`fallback` | expose đủ `primary` / `fallback` / `enabled` / `providers` |
| `getSocVnbrokerProviderHealth` | — | **MỚI** (per-provider) |
| `getSocVnbrokerOwnership` | — | **MỚI** |

**Panel** `SocVnbrokerPanel.tsx` 463 → 1089 dòng (JSX), 6 vùng: KPI strip · provider tile grid · form cấu hình (thay JSON editor) · quan sát · benchmark · quyền & nhật ký. `change_reason` bắt buộc; preview có lỗi thì hiện inline, không mở modal. `SocOwnershipBadge` + `SocWriteGuardBanner` (2 component có sẵn, trước đây không dùng) nay đã dùng.

**i18n**: dùng lại 13 key `soc.vnbroker.*` đang chết + thêm 36 key mới (2 locale); **gộp 2 key trùng** (`reset_confirm`, `benchmark_title`) — giữ nguyên giá trị hiển thị hiện tại.
**CSS/token (Q3=C)**: 5 class mới (`vnbTile`, `vnbTileHead`, `vnbStatRow`, `vnbStatLabel`, `vnbStatValue`) + 2 token (`--vnb-tile-min`, `--vnb-kpi-min`). Không sửa rule cũ.
**Q4=A**: rút gọn nhãn 9 tab (`Screener` / `DataOps` / `Prefetch` / `Hiệu năng` / `Backfill DNSE`) + tab bar `scroll-snap` + tab đang chọn tự `scrollIntoView`.

### I2. Slice 3 — BE (`911ea4582`)

| Hạng mục | Trước | Sau |
|---|---|---|
| Tầng đo runtime | **không tồn tại** | `market_data/vnbroker_provider_health.py` (mới): `record_provider_success/failure`, `is_circuit_open`, `get_circuit_snapshot`, `build_provider_health_payload`, `probe_provider`, `get_soc_vnbroker_config` |
| Bảng số đo per-provider | **không tồn tại** | `market_data.VnbrokerProviderHealth` + migration `0007_vnbrokerproviderhealth` (số do `makemigrations` sinh) |
| `GET /api/soc/vnbroker/circuit-breaker-status/` | `closed` / `failures: 0` **cứng** | state thật + `source: runtime` |
| `POST /api/soc/vnbroker/test-connection/` | `latency_ms: 45` **cứng** | gọi provider thật qua `probe_provider`; provider chết ⇒ **502** `VNBROKER_PROVIDER_UNREACHABLE` |
| `GET /api/soc/vnbroker/provider-health/` | — | **MỚI**: độ trễ / tỉ lệ thành công / lỗi liên tiếp / circuit state **thật** |
| Adapter | không đo latency, không có breaker | đo latency thật, ghi health row, **bỏ qua provider khi mạch mở** |
| Config SOC → runtime | **F-26: không có consumer nào** | `preferred_provider` + `fallback_providers` + `circuit_breaker_*` **có hiệu lực thật** |

### I3. Test (fail-before đã chạy thật)

| Tệp | Trước | Sau |
|---|---|---|
| `packages/web/src/components/__tests__/soc-vnbroker-console.component.test.tsx` | — | **8/8 FAIL** trên panel cũ → **8/8 PASS** trên panel mới (T1–T8) |
| `packages/web/src/adapters/core/__tests__/soc.test.js` | 13 test chỉ assert URL | 13 test **assert shape + giá trị thật** + 1 test chặn `getSocVnbrokerMetrics` quay lại → **98/98** |
| `packages/core/backend/src/service_ops/tests/test_vnbroker_console.py` | — | **14 test** (circuit breaker mở/đóng/half-open, health per-provider, probe thật, config bridge) |
| `packages/core/backend/src/market_data/tests/test_vnbroker_daily_history_guard.py` | giữ nguyên ý nghĩa | cập nhật để kích hoạt kịch bản DNSE qua **nguồn quyết định mới** (config SOC) — vẫn bảo đảm DNSE không bao giờ dùng cho daily OHLCV |

### I4. Bằng chứng "số liệu thật, không phải số bịa"

Các con số trong ảnh chụp ban đầu (`HOẠT ĐỘNG TỐT 1`, `934.6/s`, `0%`, `1ms`, `ĐANG KẾT NỐI (CLOSED)`) **không còn tồn tại trong code**:
`normalizeVnbrokerHealth` không còn chế `provider_health`; `getSocVnbrokerMetrics` đã bị xoá; `avg_response_ms` cấp service được ghi rõ là "độ trễ cấp dịch vụ" và **không** được gán cho từng provider; badge circuit breaker đọc state thật.

### I5. Trạng thái gate sau 2 slice

| Gate | Kết quả |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npx eslint` (file đã sửa) | **0 error** (111 warning `react/jsx-no-literals` — cùng loại với các file JSX sẵn có trong repo) |
| `npm run build` | **PASS** |
| `npx vitest run` (panel mới) | **8/8 PASS** |
| `jest soc.test.js` | **98/98 PASS** |
| `npm run i18n:scan:strict` | **PASS** |
| `npm run check:contrast` | **PASS** |
| `npm run check:tokens` | **exit 1** — lỗi **nền có sẵn** `brokerData.css #c4b5fd`, ngoài scope |
| BE `manage.py check` / `migrate` | **PASS** (Postgres riêng `vnbroker_console`) |
| BE `test market_data + test_soc_tasks + test_vnbroker_console` | **219/219 PASS** |
| BE `test market_data + service_ops` (toàn suite) | 675 test · **failures=3, errors=5** — 6 lỗi trong domain broker DNSE/SSI/TCBS **đã chứng minh là lỗi nền** (stash phần BE của tôi rồi chạy lại trên base `e7b008f25` → FAIL y hệt) |
| `npm run test` (jest toàn bộ) | 3 suite FAIL (`route-contract`, `field-contract`, `WorkstationLayout`) — **đã chứng minh là lỗi nền** (stash 9 file của tôi rồi chạy lại → FAIL y hệt 3 suite / 9 test) |
| E2E Playwright / ảnh chụp thật sau khi sửa | **CHƯA CHẠY** |

### I6. Bug của chính tôi trong phiên này (đã sửa, đã ghi lesson)

1. **`Edit` tool khớp MỜ** → tôi sửa nhầm `normalized_start_date` → `start_date` trong `fetch_daily_history` ⇒ `None.isoformat()` ⇒ 2 test BE đỏ. Đã khôi phục. → lesson **L-T03** (`docs/LESSONS/tooling-traps-2.md`).
2. **`git stash push/pop` đổi LF→CRLF** ⇒ `git diff --numstat` phình 3–5 lần (2 lần trong phiên). Đã `normalize-eol --fix` + kiểm lại numstat. → lesson **L-T04**.
3. **Probe đếm đôi** (`total_requests = 2` thay vì 1) — bắt được ngay bởi test fail-before ⇒ đã sửa bằng tham số `record_outcome=False`.

---

## J. VÒNG 2 — AUDIT UI/UX + ĐỘ TRƠN TRU BE↔FE (2026-10-20)

> Owner yêu cầu: audit lại UI/UX bằng UI agent + skill, sửa (a) 2 nút trong tile phải **bằng nhau**, (b) nhóm "Giới hạn tốc độ" **dồn 1 hàng**, (c) tự phát hiện lỗi khác, (d) kiểm tra độ trơn tru BE↔FE.
> Công cụ: 2 sub-agent (**Accessibility Auditor** · **UI Designer**) + skill `pbakaus/layout` + `jakubkrehel/better-interface`. Mọi kết luận đều có **đo đạc pixel thật** trên staging, không suy từ source.

### J1. Lỗi Owner nêu — đã sửa và **đo lại**

| # | Trước (đo) | Sau (đo) | Ngưỡng |
|---|---|---|---|
| O1 | 2 nút trong tile: **130px vs 99px** (lệch 31px) | **175.66 vs 175.67px** (lệch 0.01px) | ≤ 1px |
| O1b | 3 tile hàng nút ở 3 cao độ (275 / 275 / 345) | **3 tile cùng `top=738`** | ≤ 1px |
| O2 | "Giới hạn tốc độ" 2 field trải **593px/field**; "Thử lại" y hệt | 1 lưới chung `.vnbFormGrid` (`auto-fill minmax(240px,1fr)`) → mọi nhóm **cùng hệ cột**; độ rộng input lệch **25.53px** (do chip `s`) | ≤ 32px |

Nguyên nhân gốc: `.fieldGrid` = `repeat(auto-fit, minmax(200px,1fr))` ⇒ **`auto-fit` thu gọn track rỗng rồi phân lại `fr`** ⇒ nhóm 2 field bị kéo giãn full-width, 4 nhóm có 4 bề rộng cột khác nhau. Sửa bằng `.vnbFormGrid` (**`auto-fill`**) — track rỗng giữ nguyên.

### J2. Lỗi BE↔FE phát hiện khi audit (quan trọng hơn bố cục)

| # | Vấn đề | Trước | Sau |
|---|---|---|---|
| B1 | **FE cho phép trạng thái BE sẽ từ chối**: `preferred_provider` ∈ `fallback_providers` → BE `validate()` trả 400 | UI cho chọn tự do | `sanitizeDraft()` + `setPreferred()` loại primary khỏi chuỗi dự phòng; **checkbox dự phòng của provider chính bị khoá** (test T9) |
| B2 | **Panel chờ ~60s mới hiện** (đo: 7 request song song) | 1 `Promise.allSettled` trên 7 endpoint + 1 cờ `loadingCore` gate toàn panel | **5 khối tải độc lập** (config / providers / ownership / runtime / benchmark), mỗi khối có loading + error + "Thử lại" riêng |
| B3 | **Timeout 12s (do tôi đoán) cắt mất endpoint còn sống** | — | Đo thật trên staging: **1 request 1.4–7.8s** ⇒ timeout **30s** (trên số đo, không đoán). Đây là lý do form bị trống ở lần deploy đầu — bắt được nhờ **mở ảnh ra xem** (L-V05) |
| B4 | **Không poll** ⇒ "Quan sát trực tiếp" là số tĩnh | số đo đứng yên sau 60s | poll **60s** (bỏ qua tab ẩn) + nút "Làm mới" + `aria-live` + dòng "Cập nhật lúc". Số liệu đã đổi giữa 2 lần chụp (KBS 185.39ms → 122.06ms) |
| B5 | "Thử nghiệm kết nối" cho provider **chưa sẵn sàng** → BE trả 400 kỹ thuật | bấm xong mới biết lỗi | nút **disable** + `title` giải thích bằng `readiness_reason` |
| B6 | "Đặt làm chính" cho provider **đang là chính** | bấm không có gì xảy ra | nút **disable** |
| B7 | Không có trạng thái "dirty" | không biết đã sửa gì | badge "Có thay đổi chưa áp dụng" (test đo: 0 → 1 khi đổi primary) |
| B8 | `health.status` hiện chuỗi API thô `healthy` | không dịch | dịch qua `soc.vnbroker.provider_status_*` → "Hoạt động tốt" |
| B9 | `breaker_closed: "ĐANG KẾT NỐI (CLOSED)"` — **ngữ nghĩa sai** (CLOSED = bình thường) | gây hiểu nhầm | "BÌNH THƯỜNG (CLOSED)" |

### J3. A11Y (WCAG 2.2 AA) — đã sửa

| # | Vấn đề | Sửa |
|---|---|---|
| A1 | `<select>` benchmark **không có accessible name** | `<label htmlFor>` + `id` (đo: `label[for]` ≠ null) |
| A2 | 6 nút trong tile **trùng tên** ("Thử nghiệm kết nối" ×3) | `aria-label` kèm tên provider + tile là `<section aria-labelledby>` (đo: **6/6** nhãn khác nhau) |
| A3 | Panel **không có heading** nào | `<h2>` panel · `<h3>` khối · `<h4>` nhóm con (đo: **15** heading) |
| A4 | Vùng live mount **động** ⇒ SR bỏ qua | node `role=alert`/`role=status` **luôn có trong DOM**, phần màu bên trong |
| A5 | Lỗi "bắt buộc" không liên kết với input | `required` + `aria-required` + `aria-invalid` + `aria-describedby`; lỗi chỉ hiện **sau khi user chạm** (trước đó form "hỏng" sẵn) |
| A6 | Focus ring `.fieldInput` chỉ đổi màu viền 1px | `:focus-visible` 2px |
| A7 | Checkbox 13px | 16px + `cursor: pointer` |
| A8 | `SocConfigPreviewModal` **không phải dialog** (không role/aria-modal, Escape không đóng, focus không trả về) | `role=dialog` + `aria-modal` + `aria-labelledby` + Escape đóng + focus vào nút xác nhận + trả focus về nút đã mở + nút đóng có `aria-label` |
| A9 | Bảng thiếu `scope` / `<caption>` | thêm đủ |

### J4. Số đo verify (staging, Playwright + `getBoundingClientRect`)

| Phép đo | Kết quả | Ngưỡng |
|---|---|---|
| 2 nút tile lệch rộng | **0.01px** | ≤ 1px |
| 3 tile hàng nút lệch cao độ | **0px** | ≤ 1px |
| Độ rộng input các nhóm lệch | **25.53px** | ≤ 32px |
| Tràn ngang ở 1680 / 1280 / 1024 / 840 / 768 / 430 | **OK** (scrollWidth == innerWidth) | không tràn |
| Panel hiện (shell) | 13.7s (nạp bundle) | — |
| Form có dữ liệu thật | 20.8s | — |
| Số liệu runtime | đổi giữa 2 lần chụp (poll chạy) | — |
| Console error | **0** | 0 |

### J5. Light theme — tìm ra **nguyên nhân gốc thật** (không phải lỗi badge)

Audit A11Y báo HIGH: "light theme → panel không đọc được". Tôi **đo lại** bằng script tự composite nền **thật** (đọc `backgroundColor` của `body`, không giả định trắng) + control `#fff/#000 = 21.00:1` và `#94a3b8/#fff = 2.56:1` (phải FAIL):

| Lần đo | Kết quả |
|---|---|
| V1 (giả định nền trắng) | badge 1.43 / 1.47 · empty-state 2.06 ⇒ **3 FAIL** |
| V2 (nền thật từ `body`) | body trong light theme = **`rgb(2, 6, 23)` — vẫn nền đen** ⇒ chữ tối trên nền tối |

**Nguyên nhân gốc (app-wide, KHÔNG phải của panel):**
- `packages/web/src/index.css:53` → `--color-bg-primary: #020617` — **không có** override trong khối `:root[data-theme="light"]` của `packages/web/src/theme/tokens.css:65-82`.
- `body` dùng class Tailwind `bg-gray-950` ⇒ **luôn tối** ở mọi theme.
- Trong khi đó `soc.tokens.css` lại đảo token sang nền sáng ⇒ **chữ tối trên nền tối**.

⇒ App-wide "light theme" **chưa hoàn thiện** (nền `body` + `--color-bg-primary`). Đây là **quyết định thiết kế** cần Owner, **không** sửa trong slice này (đụng mọi trang của app).

**Cách sửa trong phạm vi VNBroker (đã làm, zero blast radius):** `.vnbConsole` **khoá lại bảng màu tối của SOC** (text / border / bg / accent + raw `--soc-rgb-*`) ⇒ console đọc được ở **cả 2 theme**, và **dark theme không đổi 1 pixel**.

**Đo lại sau sửa (cùng script, cùng control):**

| Theme | badge | metric-value | field-input | action-btn | empty-state | FAIL |
|---|---|---|---|---|---|---|
| light | 8.75 · 8.35 | 17.73 | 17.62 | 16.09 | 7.28 | **0** |
| dark | 8.75 · 8.35 | 17.73 | 17.62 | 16.09 | 7.28 | **0** |

⇒ light **trùng hệt dark** ⇒ console nhất quán 2 theme. Ảnh: `docs/evidence/vnbroker-console/05-panel-light-theme.png`.

### J6. Gate

`tsc` 0 · `eslint` 0 error · `vitest` **12/12** (4 test mới: T9 chặn trạng thái BE từ chối · T10 nút bằng nhau · T11 nhãn nút khác nhau · T12 có heading) · `jest soc.test.js` 98/98 · `i18n:scan:strict` 0 · `check:contrast` 0 · `check:tokens` exit 1 (**lỗi nền** `brokerData.css #c4b5fd`) · `normalize-eol` 0.

---

## Liên kết

- Ledger: `docs/CODE_CHANGE_AUDIT_LEDGER.md` **Entry 384** (audit) + **Entry 385** (triển khai Slice 2 + Slice 3)
- Claim: `docs/CLAIMS.md` (agent `vnbroker-console`)
- Audit liên quan: `docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md` (mục D10 — thiếu sót, xem §C)
- Audit UI/UX liên quan: `docs/AUDIT_OPERATIONS_CENTER_UI_UX_AND_TECHNICAL_GAPS_20260701.md:20,61`
- Quy trình: `docs/AGENT_PROTOCOL.md` §2–§11 · `AGENTS.md`
