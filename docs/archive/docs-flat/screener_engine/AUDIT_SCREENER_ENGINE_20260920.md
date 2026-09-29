# Audit — Screener engine hiện có (`user_workspace` + route `/screener`) — re-audit theo yêu cầu

- **Ngày**: 2026-09-20
- **Loại**: NGHIÊN CỨU + PHÂN TÍCH CHI TIẾT (audit thuần, không sửa code)
- **Phạm vi**: BE `user_workspace` (models/tasks/views/urls/helpers/templates/settings/queue_policy/worker) ↔ FE `pages/ScreenerPage.tsx` + `components/screener/*` + `adapters/core/workspace.js` + `types/screener.ts/.d.ts` + i18n `screener` block + CSS (không có file CSS riêng — toàn inline style).
- **Quyết định sản phẩm (user, 2026-09-20)**: **KEEP** tab SOC screener — giữ làm mặt quản trị engine, không gộp vào `/screener` cá nhân.
- **Liên quan**: `docs/AUDIT_SOC_SCREENER_TAB_20260920.md` (SC-01..SC-15), `docs/SCREENER_METHODOLOGY_20260914.md`, `docs/evidence/screener-p{0,1,2}/`.

---

## 1. Tóm tắt 5 findings quan trọng nhất

1. **UE-01 (P1, hiển thị)** — Dropdown VÀ/HOẶC/KHÔNG trong bộ lọc hiện **raw key**: `ScreenerFilterBuilder.tsx:81` gọi `t("screener.logic." + o.value.toLowerCase())` → `logic.and/or/not`, nhưng dict chỉ có `AND/OR/NOT` (vi.js:2708-2712, en tương ứng) → fallback trả nguyên key. Cùng file `:200` `t("screener.fieldPicker")` — key không tồn tại → tiêu đề picker hiện raw key.
2. **UE-02 (P1/P2, hiển thị)** — Badge STAND_ASIDE hiện raw key: `ScreenerHistory.tsx:59` `screener.ai.${action.toLowerCase()}` → `stand_aside`, nhưng dict chỉ có `standAside` (vi.js:2779). (buy/sell/hold đúng; `ScreenerScoreCard.tsx:46-53` map đúng nên bảng kết quả không lỗi.)
3. **UE-03 (P2, hiển thị)** — `t("screener.deleteRuleTitle")` (`ScreenerPage.tsx:230`) không tồn tại ở vi/en, không `defaultValue` → title của confirm-modal xóa rule hiện raw key.
4. **UE-04 (P2, UX)** — Nút submit form tạo **cảnh báo giá** dùng nhầm nhãn `t("screener.saveRule")` (`ScreenerResultsTable.tsx:399` = "Lưu rule") → user tưởng đang lưu rule.
5. **UE-06 (P2, product)** — `ScreenerSchedulePanel.tsx:61` tạo lịch cứng `weekdays [0-4]` + `notify_channels ["in_app"]`, không UI bật kênh **email** — dù BE hỗ trợ email và đã live-verify (W3, mailpit PASS). Muốn email phải gọi API tay.

**Đánh giá tổng thể**: engine thật, chạy được, có beat + worker + queue riêng + test phủ tốt. Lỗi tập trung ở **i18n key (case-sensitivity + key thiếu)** và **SchedulePanel hardcode**. Không phát hiện lỗi data-loss hay tenant-leak. SOC tab (SC-03/SC-10) nối vào engine này là khả thi nhưng cần adapter schema (xem §8).

---

## 2. Bản đồ kiến trúc

| File | Lines | Trách nhiệm | Note |
|---|---|---|---|
| `user_workspace/models.py` | 500-677 | `ScreenerRule`, `ScreenerRunHistory` (quota 100/user), `ScreenerSchedule` + `_compute_next_run`, tenant pre_save | tenant FK `null=False, blank=True` + resolver |
| `user_workspace/screener_tasks.py` | 298 | `run_screener_scan_task` (snapshot rule, cache, history, sched-alerts, email) + `screener_scheduled_run` (beat 5m) | progress per-200 hoãn (F-BE-05, :70-72) |
| `user_workspace/tasks.py` | 251-260 | re-export 2 task cho autodiscover (fix W2 "unregistered") | — |
| `user_workspace/portfolio_analytics_views.py` | 1305-1349, 1396-2444 | rule detail CRUD, `_compute_scan`, run sync/async+202, status poll, schedules CRUD/run-now/alerts, templates, history+backtest, sort/page contract | file 2444 dòng, đa trách nhiệm |
| `user_workspace/views.py` | 461-545 | rules list/create (validate), public catalog, fork | tenant-scoped, fail-closed |
| `user_workspace/urls.py` | 90-104 | **14 routes** screener | khớp 1:1 adapter |
| `user_workspace/screener_helpers.py` | 552 | `_validate_screener_rules`, `_apply_screener_condition`, cache guard 1MB/top-500, `_SCREENER_ALLOWED_FIELDS` (44), indicators (RSI Cutler/Stoch/ATR/ADX/Boll/VWAP/MFI/MACD/fundamentals) | 6 field no-source (§5 UE-07) |
| `user_workspace/screener_templates.py` | ~120+ | 12 templates, rule JSON chỉ dùng field có nguồn | `name_key/desc_key` → i18n |
| `user_workspace/serializers.py` | 78-84 | `ScreenerRuleSerializer` (+`owner_username`, `is_public` writable → share toggle) | — |
| `vninvest_core/settings.py` | 675-679 | beat `screener-scheduled-run-5m` → queue qua `SCHEDULER_QUEUE_MAP` | — |
| `vninvest_core/queue_policy.py` | 13-15, 147-156 | domain `screener_scans` → queue `screener` (2 task + beat name) | tách khỏi `manual_on_demand` (W2) |
| `docker-compose.dev.yml` | 341-354 | `core-worker-screener` (`CELERY_QUEUES: screener`) | live proof W2 |
| `web/.../ScreenerPage.tsx` | 796 | JSX + React Query: rules CRUD/share/fork, run sync+202/poll 1.5s/90s, preview template, URL share, export full-set | `opsHint` link sang SOC tab |
| `web/.../components/screener/*` | 12 files | FilterBuilder, ResultsTable (28 cột, sort server/client, row actions WL/alert), Templates, History (server+local, backtest), SchedulePanel, Community, Export CSV/xlsx, ScoreCard, validation, dedupe, historyStore, exportUtils | createElement trừ Page |
| `web/.../adapters/core/workspace.js` | 549-648 | 13 methods screener, querystring params | spread vào `coreApiAdapter` (:135) |
| `web/.../types/screener.ts` + `.d.ts` | 199 + 92 | registry field duy nhất (32 field + domain min/max), types đồng bộ | BE allowlist 44 ⊃ FE 32 |
| `web/.../i18n/vi.js` + `en.js` | 2615-2817 | block `screener` đầy đủ (columns/fields/logic/ops/group/templates/community/history/errors) | thiếu: logic thường, fieldPicker, deleteRuleTitle, schedule.*, rowActions.*, job*, runTimeout |

**Routes BE (urls.py:90-104)**: `rules/` GET/POST · `rules/public/` · `rules/<pk>/fork/` · `rules/<pk>/` GET/PUT/DELETE · `rules/<pk>/run/` POST · `run/status/` GET · `templates/` · `history/` GET/DELETE · `history/<pk>/` GET/DELETE · `history/<pk>/backtest/` · `schedules/` GET/POST · `schedules/alerts/` · `schedules/<pk>/` GET/PUT/DELETE · `run-now/` POST.

---

## 3. Luồng dữ liệu đã trace (use-case: bấm "Chạy Screener", sync path)

1. `ScreenerPage.tsx:464` `handleRun` → `runWithParams(rule, DEFAULT_SCAN_PARAMS)` (:353) → `workspace.js:569-577` POST `/screener/rules/<id>/run/?sort=ai_score&order=desc&page=1&limit=25&include_ai=1`.
2. `portfolio_analytics_views.py:1726` `RunView.post`: rule scoped `user(+tenant)` (:1731) → `_parse_scan_params` fail-fast 400 (:1740) → latest `SymbolSnapshot.session_date` (:1756) + staleness meta (:1771-1775) → cache key không sort (:1783).
3. Miss + universe ≤800 (default, :1804) → `_compute_scan` (:1874): snapshots+facts+profiles+prices bulk → `_screener_build_technical` + flow facts (+zeros/`_FLOW_FIELDS_NO_SOURCE`=None) + AI advisory (skip khi `include_ai=0`) → đánh giá AND/OR/NOT (:1688-1708) → `(matched, total, missing, window)`.
4. Cache guard 1MB/top-500 (`build_scan_cache_value`, helpers:30-68; flag `truncated`, :1876-1880) → sort server (None cuối, :1882-1887) + page (:1913-1919) → tạo `ScreenerRunHistory` + quota 100 (:1921-1974) → 200 payload (5 legacy keys + session/stale/missing/window + paging meta).
5. async path (universe >800 hoặc `?async=1`): snapshot rule chống drift → 202 `{job_id, poll_url}` (:1830-1872) → `run_screener_scan_task.delay` → queue `screener` → worker tính → cache scan-key + history (`via: task`) + sched-alerts (7d) + email nếu schedule có kênh email → FE poll `run/status/` 1.5s (guard 90s, `unknown`→fallback sync, 429 khi ≥3 pending) → completed → refetch sync (cache hit) → render + `saveScreenerRun` (localStorage 20) + `syncUrl` (`?rule&run&sort&order&page&limit`).
6. Beat: `screener_scheduled_run` mỗi 5m → due (`next_run_at<=now`, mọi tenant, per-schedule user) → enqueue per rule + cập nhật `last/next_run_at` (screener_tasks.py:236-298).

---

## 4. CONTRADICTIONS (contract-vs-code; plan-vs-code)

| Kỳ vọng | Thực tế | Tác động |
|---|---|---|
| FE gửi sort key bất kỳ từ header cột (`toServerSortKey`, ResultsTable:121-123) | 28/28 key cột ⊆ BE `_SORTABLE_FIELDS` (:1382-1388) | **không mâu thuẫn** — không 400 (ghi nhận tốt) |
| FE registry 32 field ⊆ BE allowlist 44 | đúng — save-path không 400; ngược lại BE dư 12 field FE không offer (UE-08) | product gap nhỏ |
| `screener.d.ts` ↔ `screener.ts` đồng bộ (W8) | đúng — types khớp (ScreenerRow thiếu whale/dark fields BE trả: dư vô hại) | tốt |
| `poll_url` BE trả `/core/v1/screener/...` (:1869) | FE không dùng, tự build URL (workspace.js:582) | dư vô hại |
| Quota history BE 100/user (:1969-1974) vs FE localStorage 20 | server thắng khi có data, local fallback khi trống; docstring model đã ghi | chấp nhận được |
| Progress per-200 (F-BE-05) | hoãn có lý do — comment code (:70-72); job status chỉ running→completed | backlog đúng |
| W8 backlog: realtime intraday, đa khung, preset khối ngoại | vẫn backlog, đã ghi lý do trong methodology §5 | không audit lại |

---

## 5. Findings

| ID | Severity | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| UE-01 | P1 | ScreenerFilterBuilder.tsx:81,200 | `screener.logic.and/or/not` (lowercase) ≠ dict `AND/OR/NOT`; `screener.fieldPicker` không tồn tại | dropdown VÀ/HOẶC/KHÔNG + tiêu đề picker hiện **raw key** | bỏ `.toLowerCase()`; thêm key `fieldPicker` 2 locale |
| UE-02 | P1/P2 | ScreenerHistory.tsx:59 | `screener.ai.stand_aside` ≠ dict `standAside` (vi:2779) | badge STAND_ASIDE hiện raw key | map `stand_aside`→`standAside` (như ScoreCard) |
| UE-03 | P2 | ScreenerPage.tsx:230 | `screener.deleteRuleTitle` không tồn tại, không defaultValue | title modal xóa rule hiện raw key | thêm key 2 locale |
| UE-04 | P2 | ScreenerResultsTable.tsx:399 | nút tạo cảnh báo giá dùng nhãn `screener.saveRule` ("Lưu rule") | nhãn sai, user hiểu lầm | key riêng `screener.rowActions.createAlertSubmit` |
| UE-05 | P2/P3 | ScreenerPage.tsx:432; SchedulePanel:96,135,158; ResultsTable:172,176,192,457,499,509 | ~13 key chỉ sống bằng `defaultValue` VI (jobQueued/jobRunning/jobCancelNote/runTimeout/schedule.*/rowActions.*) + SchedulePanel hardcode VI (lỗi, nút, placeholder, "· T2-T6", ISO thô, rule_ids thô) | locale EN hiện tiếng Việt | thêm đủ key 2 locale; format `next_run_at`/weekdays/rule names |
| UE-06 | P2 | ScreenerSchedulePanel.tsx:61 | create cứng `weekdays=[0-4]`, `notify_channels=["in_app"]` | không bật email từ UI dù BE đã live-verify (W3) | thêm checkbox kênh + chọn ngày |
| UE-07 | P3/RISK | screener_helpers.py:70-95 vs portfolio_analytics_views.py:1370-1376 | 6 field allowlist (`whale_unknown_*`, `whale_trade_count`, `whale_whale/shark/small_value`) luôn None → never-match; `_validate` vẫn pass | rule API-direct cho 0 match (đã giảm nhẹ bằng `missing_fields`) | hoặc loại khỏi allowlist, hoặc document rõ trong methodology |
| UE-08 | P3 | types/screener.ts:22-95 vs helpers:70-95 | 6 field CÓ nguồn không được offer (`whale_buy/sell/total_value`, `dark_flow_avg/max_strength`, `dark_flow_signal_count`) | user không lọc được dù engine hỗ trợ | thêm vào registry + i18n fields |
| UE-09 | P3 | ScreenerHistory.tsx:98-120,297-318; page:515 | `refreshPrices` N×`getDailyPrices` (Promise.all, không throttle client); local entries không xóa lẻ; backtest FE horizon cứng 5 (BE tới 60) | perf + UX nhỏ | gộp batch/limit concurrency; nút xóa local; chọn horizon |
| UE-10 | P3 | components dùng `(coreApiAdapter as any)` tràn lan | methods tồn tại (workspace.js:549-648, spread coreApiAdapter.js:135) nhưng `.d.ts` thiếu → cast | type-debt | bổ sung `.d.ts` |
| UE-11 | NOTE (tốt) | views.py:521-528,497-507; tasks:265; serializers:78-84 | fork guard `Q(is_public)\|Q(user)`+tenant; public catalog tenant-scoped + fail-closed; schedule lookup `filter(pk,user)` fail-closed; share toggle qua PUT `is_public` hợp lệ | isolation đúng | giữ nguyên, thêm test cross-tenant fork nếu chưa có |
| UE-12 | NOTE | settings:676; queue_policy:147-156; compose:341; tasks.py:251-260 | beat→queue `screener`→worker riêng, autodiscover fix W2 đã live-proof | infra đúng | giữ nguyên |

**Ghi chú thêm**: không có file CSS screener (toàn inline style — nhất quán cụm này nhưng lệch chuẩn SOC `soc.*.css`); `ScreenerPage` đã JSX + React Query (hiện đại hơn SOC tab `createElement`); `aria-label` pager "Previous/Next page" EN cứng + suffix "— sắp xếp" VI cứng (ResultsTable:431,529,543); export CSV/xlsx client-side qua `fetchAllRows(limit=2000)` khớp `_PAGE_LIMITS`.

---

## 6. Quality gates (kết quả thật hôm nay)

- BE `manage.py test user_workspace.test_screener_{rule_run,async_run,schedule,history,community,scan_params,scan_cache,indicators,lookback}` → **Ran 54 tests OK (59.6s)**; `System check identified no issues`.
- FE `vitest run src/components/screener` → **10 files / 48 tests pass (28.7s)**.
- FE `eslint` scoped (page + components + types + workspace adapter) → **0 errors, 6 warnings** (jsx-no-literals static attrs ×4, unused `url` trong test ×1, `.d.ts` ignored ×1 — pre-existing nhẹ).
- FE `tsc --noEmit` → **0** (chạy trong phiên audit SOC cùng ngày; cây code không thay đổi từ đó — phiên này audit-only).
- i18n: không chạy `i18n:scan` toàn cục (ngoài phạm vi); kiểm chứng key bằng grep trực tiếp vi.js/en.js (mục §5).

---

## 7. Câu hỏi cần làm rõ

1. UE-01/UE-02/UE-03: sửa key về đúng case hiện có (`AND`, `standAside`) hay chuẩn hóa dict về lowercase? (Khuyến nghị: sửa code theo dict, 3 dòng.)
2. UE-06: có muốn UI bật kênh email + chọn weekdays cho schedule trong đợt fix tới không?
3. UE-08: 6 field có nguồn có đưa vào builder ngay hay chờ methodology cập nhật?

---

## 8. Verdict + đối chiếu quyết định KEEP

**Engine đạt chuẩn vận hành** (beat/worker/queue/throttle/cache/history/schedule/email đều thật + test xanh). Fix list UE-01..UE-06 là đủ để UI sạch raw-key và schedule dùng được email.

**Trả lời F1/F2 (audit SOC)**: engine thật tồn tại, per-user/per-tenant, schema rule `{field,op,value,logic}` khác schema global SOC (`type/threshold`, 9 loại). **KEEP tab SOC** theo quyết định user: hướng triển khai SC-03 là **wire SOC manual-scan → engine này qua adapter chuyển đổi schema** (global rule → user-rule snapshot, chạy sync `_compute_scan` hoặc enqueue task với `user=system/tenant`), hoặc tối thiểu: SOC tab hiển thị link + trạng thái engine thay vì nút no-op. Không gộp 2 UI.
