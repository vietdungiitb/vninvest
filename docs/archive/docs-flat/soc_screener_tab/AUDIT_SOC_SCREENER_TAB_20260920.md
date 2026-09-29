# Audit — SocScreenerPanel / `operations-center?tab=screener` (end-to-end, BE→FE)

- **Ngày**: 2026-09-20
- **Loại**: NGHIÊN CỨU + PHÂN TÍCH CHI TIẾT (audit thuần, không sửa code)
- **Phạm vi**: `SocScreenerPanel.tsx` + `SocScreenerConfigForm.tsx` + `SocScreenerRuleModal.tsx` ↔ `adapters/core/soc.js` ↔ BE `service_ops/views/screener.py` + `domain_configs/screener.py` + `registry.py` + `tasks.py` (recovery), `i18n vi.js/en.js`, BE tests.

---

## 1. Tóm tắt 5 findings nghiêm trọng nhất

1. **SC-01 (P0)** — Card "Cảnh báo" luôn rỗng: adapter `getSocScreenerAlerts` đọc `(data.alerts || [])` (soc.js:498) nhưng BE trả paginated `{count, next, previous, results: [...]}` (screener.py:118-123, 509) → `data.alerts` không bao giờ tồn tại → FE luôn `[]`. Bug bị che vì jest test mock sai shape `{alerts: [...]}` (soc.test.js:449).
2. **SC-02 (P0)** — Mỗi lần Save config = **XÓA HẾT rules**: `SocScreenerConfigForm` chỉ gửi 5 số nguyên; BE `from_dict` không có key `rules` → `ScreenerDomainConfig.rules` = default `[]` → `apply_config` ghi đè config cũ → mất toàn bộ rule (data loss).
3. **SC-03 (P0)** — Nút "Chạy quét" (manual scan) = **no-op**: `ScreenerManualScanView.post` chỉ tạo `ServiceRunLog(status='queued')` cho service `screener_scan_dispatcher` (screener.py:528-547), **không `.delay()`/không `send_task`/không consumer nào đọc**; celery beat cũng không có clocked task cho engine global (settings.py:385-526) → recovery loop (tasks.py:233) sau grace period tự đánh `failed`. Kết quả quét không bao giờ đổi.
4. **SC-06 (P1)** — **18 i18n key dùng `t()` không tồn tại ở cả 2 locale** (loading, add_rule, edit_rule, results_title, alerts_title, config_saved, apply_failed, scan_failed, rule_saved, rule_save_failed, rule_deleted, delete_failed, delete_rule_title, rule_name_placeholder, invalid_json, threshold_json, value_json, enabled) + 9 subkey `rule_type.*` (RuleModal.tsx:45). `translate()` fallback trả nguyên key → UI hiện `soc.screener.loading`, dropdown hiện `soc.screener.rule_type.price_change_pct`.
5. **SC-04 (P1)** — Metric card lừa dối: `avg_scan_duration_ms` **luôn 0** vì BE results view không bao giờ trả `scan_duration_ms`; `rules_hit_rate = alerts/symbols_scanned` mà BE `symbols_scanned` = số **distinct matched symbols** (chỉ các symbol có alert) → tỷ lệ có thể >100% và không phải "hit rate" thật.

**Đánh giá tổng thể**: tab đang ở mức "config CRUD + feed signals giả-lập", chưa đạt commercial parity. Có 3 P0 chặn; nhưng tất cả fix đều cục bộ (đúng file:line), không cần rewrite. Test BE/FE hiện có đều PASS (22 BE + 12 jest) nhưng không bắt được SC-01/02/03/11 do mock sai shape + endpoint stub.

---

## 2. Bản đồ kiến trúc

| File | Line count | Trách nhiệm | Note |
|---|---|---|---|
| `web/src/components/soc/SocScreenerPanel.tsx` | ~448 | 5-card layout (config/rules/manual-scan/results/alerts) + toast | dùng `createElement`, không JSX |
| `web/src/components/soc/SocScreenerConfigForm.tsx` | ~156 | 5 số nguyên + advanced JSON read-only | đọc `initialConfig.scan_interval_seconds` ở top-level |
| `web/src/components/soc/SocScreenerRuleModal.tsx` | ~58 | Create/Edit rule modal, 9 rule types dropdown | sub-key `rule_type.*` không tồn tại |
| `web/src/adapters/core/soc.js` | 463-540 | 11 adapter method | `getSocScreenerMetrics` tự GET lại `/results/` (duplicate) |
| `core/.../views/screener.py` | ~581 | 9 endpoints + `_save_screener_rules_config` | manual scan tạo run log, không dispatch |
| `core/.../domain_configs/screener.py` | ~77 | `ScreenerDomainConfig` (5 fields) + validate | `from_dict` bỏ key lạ → default (nguồn SC-02) |
| `core/.../views/mixins.py` | 22-125 | `ConfigApplyMixin` | ownership + audit trail CHỈ ở config apply path |
| `core/.../registry.py` | — | 4 service key (`screener_*`) | registry-only, không task implement |

**Endpoints BE (urls.py:103-112)**: GET `config/` + POST `config/apply/` (ConfigApplyMixin), GET/POST `rules/`, PUT/DELETE `rules/{rule_id}/`, POST `manual-scan/`, GET `results/`, GET `alert-history/`, GET `metrics/`, GET/SET ownership.

---

## 3. Luồng dữ liệu đã trace (use-case: bấm "Chạy quét")

1. `SocScreenerPanel.tsx:136-153` → `soc.js:507-509` `POST /operator/soc/screener/manual-scan/`.
2. `screener.py:528-547` validate + `ServiceRunLog.objects.create(..., service='screener_scan_dispatcher', status='queued')` → return `{run_log_id, status: 'queued'}`.
3. **Không có** `send_task`/`.delay()`/celery task nào consume log này (grep toàn repo: `screener_scan_dispatcher` chỉ xuất hiện ở registry + view + 1 test assert).
4. `tasks.py:233 reconcile_stale_running_service_run_logs` (beat 5m, settings.py:526) — chỉ **đánh dấu** log quá hạn `running`/`queued` → `failed`/`success` theo grace period; **không thực thi**.
5. FE `refetch` results → `getSocScreenerResults` (soc.js:518-523) đọc `data.symbols_matched` → dữ liệu cũ của `UnifiedAlert` feed, không thay đổi.
6. Kết luận: manual scan tab này **không bao giờ chạy engine**. (Note: engine người dùng thật tồn tại ở `user_workspace/screener_tasks.py` + beat `screener-scheduled-run-5m` settings.py:676 — là screener cá nhân, KHÔNG phải global SOC; global SOC không có task.)

**Registry (registry.py)**: `screener_scan_dispatcher` (dùng trong manual-scan), `screener_rule_engine`, `screener_result_publisher`, `screener_alert_history` (dùng trong results/metrics) — tất cả đều là registry entries, không task nào implement.

---

## 4. CONTRADICTIONS

| Plan/Contract | Thực tế | Tác động |
|---|---|---|
| `getSocScreenerAlerts` kỳ vọng BE trả `data.alerts` (soc.js:498; jest mock soc.test.js:449) | BE `ScreenerAlertHistoryView` trả paginated `results` (screener.py:118-123, 509) | Alerts card luôn rỗng (P0) |
| Jest test mock `{alerts: [...], results: [...]}` (soc.test.js:448-451) | shape không khớp BE thật | test PASS nhưng không bắt được bug |
| FE config apply gửi 5 scalar (ConfigForm) | BE đọc nguyên payload → `from_dict` default `rules=[]` (domain_configs/screener.py; mixins.py:95-104) | config save xoá toàn bộ rules (P0) |
| `SocConfigPreviewModal` import + render (SocScreenerPanel.tsx:4, 409-417) | `previewModal` không bao giờ set non-null (chỉ `setPreviewModal(null)`) | dead code "preview" không chạy |
| BE `alert_cooldown_seconds` min 30 (domain_configs/screener.py:52) | FE form min 60 (SocScreenerConfigForm.tsx:56) | lệch contract FE/BE (P3) |
| key `rules_empty`/`rule_active`/`rule_inactive` tồn tại (vi.js:1125-6) | panel hardcode `"Bật"/"Tắt"` (SocScreenerPanel.tsx:283), bảng rules không empty-state row | i18n bỏ qua (P2) |
| `getSocScreenerOwnership` + BE `/ownership/` tồn tại | panel hardcode `writable:true` (SocScreenerPanel.tsx:230); rule CRUD không check matrix | role read-only vẫn sửa rules (P1) |

---

## 5. Findings

| ID | Severity | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| SC-01 | P0 | soc.js:498; screener.py:118-123,509 | adapter đọc `data.alerts`, BE trả `data.results` | Alerts card **luôn rỗng** | map `data.results`; sửa mock test đúng shape paginated |
| SC-02 | P0 | SocScreenerConfigForm.tsx:28-46; mixins.py:95-104; domain_configs/screener.py | form gửi 5 scalar, BE `from_dict` thiếu `rules` → `[]` | **Save config = xoá hết rules** | FE merge `rules` hiện tại vào payload; hoặc BE preserve rules khi apply |
| SC-03 | P0 | screener.py:528-547; registry.py; settings.py:385-526 | manual scan tạo queued run log, không dispatch, không consumer | Nút "Chạy quét" no-op; kết quả không đổi | wire `send_task` vào engine thật (hoặc chuyển global screener dùng chung engine user) |
| SC-04 | P1 | soc.js:525-536; screener.py:477-488 | `scan_duration_ms` BE không trả → `avg_scan_duration_ms` luôn 0; `rules_hit_rate = alerts/distinct_matched` có thể >100% | metric card lừa dối | BE trả `scan_duration_ms` thật + `symbols_scanned` = tổng quét (không phải distinct matched) |
| SC-05 | P1 | SocScreenerPanel.tsx:244; soc.js:10-17,505; SocScreenerConfigForm.tsx:28-46 | `initialConfig` = normalized envelope (`config`/`config_payload` lồng), form đọc `initialConfig.scan_interval_seconds` (undefined) | form **luôn hiện defaults** 60/2000/300/5/24, không hiện giá trị đã lưu | form đọc `initialConfig.config_payload` (hoặc panel truyền thẳng payload) |
| SC-06 | P1 | i18n vi/en (block SocScreener) + RuleModal.tsx:45 | 18 key dùng `t()` không tồn tại 2 locale + 9 subkey `rule_type.*` | UI hiện raw key (`soc.screener.loading`, dropdown hiện `rule_type.price_change_pct`) | thêm đủ 27 key 2 locale (scan i18n exit 0) |
| SC-07 | P1 | screener.py:343-372,390-432,448-462; mixins.py:44-53 | rule CRUD bỏ qua matrix + bỏ qua `ConfigChangeAudit`; panel hardcode writable | ownership không enforce; audit trail thiếu | chạy `matrix.is_domain_writable` trước CRUD; audit qua mixin; FE dùng `/ownership/` |
| SC-08 | P2 | SocScreenerPanel.tsx:283 | hardcode `"Bật"/"Tắt"` thay vì `t()` (key tồn tại) | EN locale lẫn tiếng Việt | dùng `t('soc.screener.rule_active/inactive')` |
| SC-09 | P2 | SocScreenerPanel.tsx:4,409-417 | `SocConfigPreviewModal` dead code (không bao giờ set) | không có preview trước apply | gỡ import/render hoặc nối preview flow |
| SC-10 | P2 | screener.py:178-184,474-488 | results/alerts/metrics đều derive từ `UnifiedAlert(type=SIGNAL)` = đúng feed tab Signals | "Kết quả quét" không gắn với run scan thật | kết nối output thật của engine sau khi SC-03 |
| SC-11 | P2 | screener.py:343-372,390-432; domain_configs/screener.py:9-13,37-48 | rule CRUD không validate `type` ∈ `VALID_RULE_TYPES` (chỉ config apply validate) | rule rác được tạo | validate type ở create/update |
| SC-12 | P3 | SocScreenerConfigForm.tsx:56 vs domain_configs/screener.py:52 | FE min cooldown 60 vs BE 30 | contract lệch | đồng bộ (60 hoặc 30) |
| SC-13 | P3 | SocScreenerPanel.tsx:424 | rule modal `loading:false` hardcode | double-submit | nối state loading thật |
| SC-14 | P3 | SocScreenerPanel.tsx:368 | results chỉ hiện `HH:MM:SS` (split("T")[1].slice(0,8)), không ngày | mơ hồ qua nhiều ngày | format đủ ngày+giờ |
| SC-15 | P3 | vi.js:1115; SocScreenerPanel.tsx (rules bảng) | `rules_empty` tồn tại không dùng; không empty-state row | bảng rỗng trông hỏng | thêm empty row dùng key |

**Ghi chú khác**:
- Adapter `getSocScreenerMetrics` tự gọi lại endpoint `/results/` (duplicate request mỗi poll) — SC-04 liên quan, nên BE gộp metric vào 1 payload.
- Adapter truyền `?page=` tới `/rules/` nhưng BE rules unpaginated (trả toàn bộ) → tham số vô hiệu (harmless, nhưng giả lập pagination client-side chỉ hiển thị 10/`page_size`).
- `ScreenerRulesRunView` (`rules/run/` alias, urls.py:112) chưa dùng; nếu wire được engine → 1 phần của SC-03.

---

## 6. Quality gates (kết quả thật hôm nay)

- FE `npx tsc --noEmit` → **0 errors**.
- FE `jest soc.test.js -t "Screener"` → **12 passed** (mock sai shape che SC-01).
- BE `test_soc_api_domain.ScreenerDomainApiTestCase` + `test_screener_rule_crud` + `test_soc_domain_configs` → **22 OK** (test manual-scan chỉ assert run log được tạo — đúng stub, không bắt được no-op; 404 cho rule delete không tồn tại là expected).
- `manage.py check` → 0 issues.
- i18n: kiểm tra script (tạm, `Temp\opencode\check-screener-i18n.mjs`) → 18 key thiếu cả 2 locale + 9 subkey `rule_type.*` (grep `rule_type\.` = 0 hits).

---

## 7. Câu hỏi cần làm rõ

1. Global screener engine (`screener_rule_engine`) đã có engine thật hay đang chờ phát triển? Nếu chưa → SC-03/SC-10 là "chưa có BE", fix FE không đủ.
2. Có nên bỏ hẳn tab Screener global SOC cho người dùng cuối (screener cá nhân đã ở route riêng `/screener`) và chỉ giữ để quản lý config/rules, hay muốn đưa engine cá nhân lên thành engine global?
3. Rules của global screener — đây là cấu hình chung áp dụng cho tất cả user, hay chỉ dữ liệu demo?

---

## 8. Verdict

**Implementable — không blocker về hạ tầng.** Fix theo đúng file:line bảng findings là đóng được tất cả. Ưu tiên:
1. **P0 first**: SC-01 (map `results`), SC-02 (preserve rules khi apply config), SC-03 (quyết định engine theo câu F1/F2 — nếu chưa có engine: gỡ nút "Chạy quét" + hiển thị "chưa hỗ trợ" thay vì no-op).
2. **P1**: SC-06 i18n 27 key (sửa ngay vì ảnh hưởng hiển thị lần load đầu), SC-05 form đọc đúng payload, SC-07 ownership/audit.
3. **P2/P3**: còn lại theo mức độ ưu tiên sản phẩm.
4. Bổ sung test: BE assert config apply **giữ rules** + manual scan **dispatch task thật**; FE assert adapter map đúng shape paginated.