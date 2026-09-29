# Phản biện Audit — SOC Prefetch Panel (SocPrefetchPanel) & Prefetch Domain

- **Ngày**: 2026-09-22
- **Phạm vi**: `packages/web/src/components/soc/SocPrefetchPanel.tsx` + `packages/web/src/adapters/core/soc.js` (FE) vs `packages/core/backend/src/service_ops/views/prefetch.py` + `service_ops/urls.py` (BE) + `packages/web/src/i18n/vi.js` (+ legacy `frontend/src/components/soc/PrefetchPanel.jsx` làm baseline so sánh).
- **Chế độ**: Audit độc lập, reproduce-first, mọi khẳng định kèm `file:line`. Không sửa code.
- **Chuẩn đối chiếu**: `AGENTS.md` Nguyên tắc 1–7 (định lượng mọi claim, không đoán, đối chiếu plan↔code, quality gates).

---

## 1. TÓM TẮT

Audit gốc đưa 9 khẳng định (P0-1..P0-4, P1-1, GAP-A, GAP-B, UI/UX C1-C8) về panel Prefetch. Kết quả phản biện độc lập:

| ID | Claim | Verdict | Bằng chứng |
|----|-------|---------|-----------|
| P0-1 | BE không có route `config/preview/`; FE gọi → 404 | **CONFIRMED** | `urls.py:58-67` (9 route, không có preview); `soc.js:314-315` |
| P0-2 | BE cache-status trả dữ liệu mock/hardcoded; FE map `hit_rate` từ `hit_ratio` | **CONFIRMED (một phần)** | `prefetch.py:286-310`; `soc.js:301-308` |
| P0-3 | Universe groups là registry-first (Global Symbol Registry), group chỉ là metadata hint | **CONFIRMED** | `prefetch.py:374-479`; `SocPrefetchPanel.tsx:63-67`; `vi.js:1085-1086` |
| P0-4 | FE warm-now/apply gửi `universe_group_ids` trong body nhưng BE không đọc | **CONFIRMED** | `SocPrefetchPanel.tsx:109,129`; `soc.js:318-321`; `prefetch.py:351-371` |
| P1-1 | Profiles endpoint tồn tại ở BE nhưng FE panel không dùng | **CONFIRMED** | `urls.py:61`; `soc.js:291-298`; `SocPrefetchPanel.tsx:52-56` |
| GAP-A | Thiếu preview config trước khi apply (so với legacy Preview Form) | **CONFIRMED** | `PrefetchPanel.jsx:91-97` vs `SocPrefetchPanel.tsx:84-104` |
| GAP-B | Warm-now không nhận universe groups → không thể warm theo nhóm | **CONFIRMED** | `prefetch.py:351-371`; `SocPrefetchPanel.tsx:123-132` |
| UI/UX C1-C8 | i18n, metric cards, universe groups UI, confirm modal, inline states | **CONFIRMED phần lớn** | `vi.js:1056-1094`; `SocPrefetchPanel.tsx:163-284` |

**Đánh giá độ chính xác của audit gốc: ~85–90%** — 8/9 claims đúng bản chất; 1 claim (P0-2) đúng nhưng thiếu một nửa bằng chứng (BE mock nhưng FE có fallback local preview), và **P0-1 có một sự kiện giảm nhẹ quan trọng**: FE đã có fallback local (không gọi BE) khi adapter không expose `previewSocPrefetchConfig`. Một vài claim line-number trong audit gốc không khớp chính xác với file thật (lệch 1–2 dòng).

---

## 2. BẢN ĐỒ KIẾN TRÚC

### 2.1 Backend (BE) — Prefetch domain

| File:line | Trách nhiệm |
|-----------|-------------|
| `service_ops/urls.py:58-67` | 9 route prefetch: `config/`, `config/apply/`, `config/profiles/`, `cache-status/`, `purge-cache/`, `warm-now/`, `universe-groups/`, `task-schedule/`, `ownership/`. **Không có `config/preview/`**. |
| `service_ops/views/prefetch.py:29-67` | Serializers: PrefetchConfigRequest/Response, WarmNow, CacheStatus, PurgeCache, UniverseGroups, TaskSchedule, Ownership |
| `prefetch.py:224-238` | `PrefetchConfigView.get` → trả config hiện tại |
| `prefetch.py:240-256` | `PrefetchConfigView.post` → apply config (qua ConfigApplyMixin) |
| `prefetch.py:286-310` | `PrefetchCacheStatusView.get` → **trả dữ liệu hardcoded/mock** (`redis`, `cache_hits`, `cache_misses`, `hit_ratio`, `last_prefetch_at`) |
| `prefetch.py:313-335` | `PrefetchPurgeCacheView.post` → mock purge (trả `purged_keys: 456` cứng) |
| `prefetch.py:338-371` | `PrefetchWarmNowView.post` → tạo ServiceRunLog `queued`, **không đọc `request.data`** |
| `prefetch.py:374-479` | `PrefetchUniverseGroupsView.get` → registry-first snapshot (GlobalSymbolRegistry priority tiers) |
| `prefetch.py:512-525` | `PrefetchOwnershipView.get` → ownership matrix |

### 2.2 Frontend (FE)

| File:line | Trách nhiệm |
|-----------|-------------|
| `adapters/core/soc.js:283-334` | Adapter methods: `getSocPrefetchConfig` (:283), `applySocPrefetchConfig` (:287), `getSocPrefetchProfiles` (:291), `getSocPrefetchCacheStatus` (:301-308), `purgeSocPrefetchCache` (:310), `previewSocPrefetchConfig` (:314-315), `warmSocPrefetchNow` (:318-321), `getSocPrefetchUniverseGroups` (:324), `getSocPrefetchSchedule` (:328), `getSocPrefetchMetrics` (:332) |
| `components/soc/SocPrefetchPanel.tsx:46-74` | `fetchData` — load config + cache status + universe groups (Promise.all) |
| `SocPrefetchPanel.tsx:84-104` | `handlePreview` — gọi `adapter.previewSocPrefetchConfig` nếu có, **fallback local** nếu không |
| `SocPrefetchPanel.tsx:106-121` | `handleApply` — gọi `adapter.applySocPrefetchConfig` |
| `SocPrefetchPanel.tsx:123-132` | `handleWarmNow` — gọi `adapter.warmSocPrefetchNow("async", { groups })` |
| `SocPrefetchPanel.tsx:134-150` | `handlePurgeCache` — confirm + purge + refetch |
| `SocPrefetchPanel.tsx:152-165` | `toggleGroup` — chọn universe group, sync vào editConfig |
| `SocPrefetchPanel.tsx:167-174` | `renderMetricCard` |
| `SocPrefetchPanel.tsx:176-284` | Render: universe section-card, config editor, metric grid, warm-now/purge, scheduler board |
| `i18n/vi.js:1056-1094` | Toàn bộ keys `soc.prefetch.*` + `soc.prefetch.universe_groups_*` |

### 2.3 Legacy (baseline so sánh)

| File:line | Trách nhiệm |
|-----------|-------------|
| `frontend/src/components/soc/PrefetchPanel.jsx:19-31` | CORE_NUMBER_FIELDS (batch_size, symbol_limit, max_retries...) |
| `PrefetchPanel.jsx:91-97` | `handlePreview` → gọi preview → mở modal "Xem trước" |
| `PrefetchPanel.jsx:124-132` | `handleWarmNow` → warm async/sync |
| `PrefetchPanel.jsx:169-173` | `warmStatus` hiển thị |
| `PrefetchPanel.jsx:193-287` | Universe card render (chọn nhóm, summary). |
| `PrefetchPanel.jsx:300-334` | Profiles grid + config form (JSONEditor/textarea). |

---

## 3. LUỒNG DỮ LIỆU ĐÃ TRACE

### Use-case: Xem trước rồi áp dụng config prefetch

1. FE mount → `SocPrefetchPanel.tsx:76-78` `useEffect() → fetchData`.
2. `fetchData` (`:43-74`) → `adapter.getSocPrefetchConfig()`, `getSocPrefetchCacheStatus()`, `getSocPrefetchUniverseGroups()` song song.
3. Người dùng sửa JSON config → `handlePreview` (`:84-104`):
   - Parse JSON (`:87-91`), set `universe_group_ids` từ `selectedGroups`.
   - `if (typeof adapter.previewSocPrefetchConfig === "function")` (`:95`) → gọi BE preview nếu adapter cung cấp; ngược lại fallback local `setPreviewModal({before, after})` (`:98-100`).
   - **OBSERVATION**: adapter `soc.js:314-315` CÓ `previewSocPrefetchConfig` → nên BE route không tồn tại → 404 bị catch (`:101-103`) → inline error. Fallback local chỉ hoạt động khi adapter bỏ method.
4. Preview modal → `handleApply` (`:106-121`) → `adapter.applySocPrefetchConfig(parsed)` → POST `/operator/soc/prefetch/config/` (chú ý adapter dùng `corePost("/operator/soc/prefetch/config/", {config_payload})`? — discrepency, xem CONTRADICTIONS).
5. Sau apply → refetch, hiển thị inline success/error.

### Use-case: Warm-now theo universe group

1. `handleWarmNow` (`:123-132`) → `adapter.warmSocPrefetchNow("async", { groups: selectedGroups })`.
2. Adapter `soc.js:318-321` → `corePost("/operator/soc/prefetch/warm-now/?mode=async", { universe_group_ids: groups })`.
3. BE `prefetch.py:351-371` → `post()` tạo ServiceRunLog với `input_summary` từ **config active**, **không đọc `universe_group_ids` từ request** → **groups bị bỏ qua**.

---

## 4. CONTRADICTIONS (claim vs thực tế)

| # | Plan/Audit claim (file:line) | Thực tế code (file:line) | Tác động |
|---|------------------------------|--------------------------|----------|
| C-1 | P0-1: "FE `previewSocPrefetchConfig` gọi endpoint không tồn tại → 404 luôn luôn fail" | `SocPrefetchPanel.tsx:94-100` có **fallback local** (`setPreviewModal({before, after})`) khi method không tồn tại — audit gốc bỏ sót nhánh else | Cường độ claim giảm: 404 xảy ra **chỉ khi** adapter expose method; hiện tại adapter `soc.js:314-315` đúng là expose → 404 vẫn xảy ra. Claim đúng phần lớn nhưng cơ chế sai. |
| C-2 | P0-2: "cache-status trả mock → hit_rate sai" | `prefetch.py:286-310` đúng là hardcoded (cache_hits 15234, hit_ratio 0.816). Nhưng `soc.js:301-308` map `hit_rate = hit_ratio*100`, `size_mb`, `ttl_minutes`. BE không trả `ttl_minutes` → FE luôn hiển thị 0 TTL. **Audit thiếu claim về `ttl_minutes`.** | Bổ sung GAP mới (xem Finding F-2). |
| C-3 | P0-4: "BE không đọc universe groups trong warm-now" | `prefetch.py:351-371` đúng, nhưng audit gốc mô tả FE gửi `universe_group_ids`; `soc.js:318-321` thực chất chỉ gửi groups khi `opts.groups`/`universe_group_ids` — panel truyền `{groups}` (`:127`). | Claim đúng, chi tiết option name lệch nhẹ. |
| C-4 | P1-1: "profiles endpoint: BE có, FE panel không dùng" | Đúng: `urls.py:61` + `soc.js:291-298`; `SocPrefetchPanel.tsx:52-56` fetchData chỉ gọi 3 methods (không profiles). | Claim đúng. |
| C-5 | GAP-A: "thiếu preview modal" | `SocPrefetchPanel.tsx:259-262` vẫn có `SocConfigPreviewModal` (import `:6`) — nhưng chỉ hiển thị khi `previewModal` set. Legacy có `PreviewForm` luôn. | Claim đúng "thiếu so với legacy", không phải "không có modal". |
| C-6 | GAP-B: "warm-now không nhận groups" | Khớp: `prefetch.py:351-371` bỏ qua `universe_group_ids` | Claim đúng. |

---

## 5. FINDINGS

### [F-1] <RISK> — P0 — BE thiếu endpoint preview config
- Thực tế: `service_ops/urls.py:58-67` không có route `config/preview/`; adapter `soc.js:314-315` `previewSocPrefetchConfig` → POST `/operator/soc/prefetch/config/preview/`.
- Tác động: preview luôn 404 (hoặc fallback local tĩnh, không có server-side validation/impact).
- Đề xuất: Thêm view `PrefetchConfigPreviewView` + route `prefetch/config/preview/`; hoặc FE bỏ fallback dependency BE, self-preview.

### [F-2] <GAP> — P1 — Cache-status không trả `ttl_minutes`/`ttl_seconds`
- Thực tế: `prefetch.py:286-310` trả dict không có `ttl_minutes`; `soc.js:306` map `ttl_minutes: data.redis?.ttl_minutes || 0`.
- Tác động: UI luôn show "0 min" dù cache có TTL thật.
- Đề xuất: BE thêm `ttl_minutes` vào response; FE bỏ `|| 0` cheat.

### [F-3] <GAP> — P1 — Warm-now bỏ qua universe_group_ids
- Thực tế: `prefetch.py:351-371` không đọc request body; `SocPrefetchPanel.tsx:127` gửi `{groups}`.
- Tác động: Toggle chọn nhóm universe KHÔNG ảnh hưởng warm-now → UX hiểu lầm.
- Đề xuất: BE đọc `request.data['universe_group_ids']` nếu present.

### [F-4] <RISK> — P2 — Cache-status/purge là mock (hardcoded)
- Thực tế: `cache-status` (286-310) và `purge-cache` (313-335) trả số cứng.
- Tác động: Operator tin vào hit_rate sai 81.6%; không phản ánh Redis thật.
- Đề xuất: Kết nối Redis thật hoặc tách rõ label "sample/mock".

### [F-5] <GAP> — P2 — FE adapter URL path không khớp BE urls
- Thực tế: `soc.js:288` `applySocPrefetchConfig` chưa xác định path chuẩn; cần đối chiếu `urls.py:60` (`config/apply/`).
- Tác động: apply có thể fail 404 nếu path lệch.
- Đề xuất: Thống nhất prefix `/operator/soc/prefetch/config/apply/`.

### [F-6] <RISK> — P3 — i18n key `universe_groups_registry_first` chỉ hiển thị khi registry-mode
- Thực tế: `SocPrefetchPanel.tsx:179-181` hiển thị hint registry-first `vi.js:1085-1086`.
- Tác động: trong non-registry mode khối universe vẫn render nhưng thiếu hint.
- Đề xuất: hiển thị hint theo `universe_mode` thực tế.

---

## 6. QUALITY GATES

- Lint: `npm run lint` — (chưa chạy lại trong phiên này; audit chỉ đọc code).
- Type-check: `npx tsc --noEmit` — chưa chạy.
- i18n: `npm run i18n:scan` — chưa chạy; dựa trên tồn tại key `vi.js:1056-1094` và `en.js` tương ứng (verified tồn tại).
- Test: `npm run test`, `npm run test:components` — chưa chạy.
- **Ghi chú**: Phiên này là audit/reading research — không chạy tsc/build/test như đầy đủ gate. Cần xác nhận bằng chạy thật (xem Câu hỏi Q4).

---

## 7. CÂU HỎI CẦN LÀM RÕ

- Q1: Adapter `defaultCoreApiAdapter` có expose đúng method `applySocPrefetchConfig` với path nào — `config/` hay `config/apply/`? (`C-1`/`F-5`)
- Q2: FE có panel nào khác render Prefetch ngoài `SocPrefetchPanel.tsx`? Legacy `PrefetchPanel.jsx` còn được route nữa không?
- Q3: `ttl_minutes` có tồn tại trong DB config schema BE không (PrefetchTimePolicyConfig model) — source thật để FE map?
- Q4: Cần run tsc/build/lint/i18n-scan/test để đóng quality gates — có chạy trong phiên tiếp theo không?

---

## 8. KẾT LUẬN

**Implementable**: CÓ, không có blocker. Các GAP là feature-missing (preview route, warm-now groups, TTL field, de-mock cache-status) — đều có thể fix bằng BE/FE tối thiểu.

**Ưu tiên sửa**:
1. P0: Thêm BE endpoint preview (`F-1`).
2. P1: `ttl_minutes` (`F-2`) + warm-now read groups (`F-3`).
3. P2: de-mock cache-status/purge (`F-4`), chuẩn URL apply (`F-5`).

**Độ chính xác audit gốc**: ~85–90%. Đa số claim đúng bản chất; điểm yếu duy nhất là bỏ sót fallback local (C-1) và `ttl_minutes` (C-2). Không phát hiện claim sai hoàn toàn.
