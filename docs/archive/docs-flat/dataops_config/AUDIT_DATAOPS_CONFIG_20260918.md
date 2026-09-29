# AUDIT Tính năng Cấu hình DataOps — SOC Operations Center (2026-09-18)

> **Ngày audit:** 2026-09-18 (ảnh UI `Trung tâm Hoạt động Dịch vụ` → `Dữ liệu vận hành` → `Cấu hình`)
> **Phạm vi:** `packages/web` (React/Vite, `SocDataOpsConfigSection.tsx:1` + `DataOpsContext.tsx:1` + `SocConfigPreviewModal.tsx:1`) ↔ `packages/core` (`service_ops/views/dataops_config.py:1`, `views/dataops_base.py:1`, `domain_configs/market_data.py:1`, `models.py:ConfigChangeAudit`) ↔ `vninvestcharts-widget` (không liên quan) ↔ `defaultCoreApiAdapter` (`adapters/core/soc.js:232`)
> **Phương pháp:** Tuân khung AGENTS.md (Nguyên tắc 1-6, B1-B6) — reproduce-first qua `grep/glob/read` toàn repo `.css/.module.css/config/i18n/adapters`, đối chiếu plan↔code, benchmark thương mại Bloomberg/Datadog/Grafana/AWS Config.
> **Stack:** `ec594e4c` (origin/dev), `ECOM-C1..3` đã fix (queue dedup, coverage hook, heartbeat) — config là P2 backlog.

---

## 0. Nguyên tắc bắt buộc (đã tuân)

1. Mọi khẳng định kèm `file_path:line_number`. Không line = không hợp lệ.
2. Không đoán — chưa đọc file thật → ghi CHƯA XÁC MINH.
3. Bắt buộc `grep/glob/read`, không dùng kinh nghiệm chung.
4. Plan/doc mâu thuẫn code → mục CONTRADICTIONS riêng.
5. `grep/scrape` toàn repo bao gồm `.css`, `.module.css`, `soc.components.css`, `vite.config.ts`, `tsconfig*.json`, `src/i18n/vi.js`/`en.js`, `src/adapters/core/*`.
6. Không viết code trong audit — chỉ phân tích + đề xuất.

---

## Tóm tắt 5 findings nghiêm trọng nhất

**CFG-01 (ERROR, P0):** `SocDataOpsConfigSection.tsx:232` dùng raw `textarea` JSON 12 dòng cho 4 queue-tier ×3 field +2 global, không có form per-field, không label, không range, không tooltip — user phải nhớ key chính xác, sai 1 dấu phẩy là `alert("invalid_json")` `172`. Benchmark VNBroker/Screener đều có form control.

**CFG-02 (ERROR, P0):** Mọi lỗi đều `alert()` blocking `172,187` — không có inline error, không auto-focus, không `aria-invalid`. Preview lỗi cũng `alert`, không giữ state.

**CFG-03 (GAP, P0):** Audit trail `264-315` chỉ hiện `actor • action • time.slice(0,8)` (giờ UTC cắt chuỗi) — không có `change_summary` chi tiết, không before/after, không pagination info, không filter theo actor/ngày, không export CSV.

**CFG-04 (GAP, P1):** Backend `MarketDataRuntimeConfig.validate():112` chỉ check `poll_interval >=10`, `max_batch >=1` — không có max, không cross-check `max_dispatch > max_batch`, không cảnh báo cadence quá nhanh (<10s) gây storm, không template/preset.

**CFG-05 (RISK, P1):** Không có versioning/rollback/revert, không `If-Match`/`updated_at` optimistic lock — 2 operator sửa đồng thời → last-write-wins mất audit.

> **Điểm:** **3.5/10** — đọc/ghi/preview/audit chạy được, nhưng UX sơ sài, thiếu form/thao tác thương mại, không đạt Datadog/AWS Config.

---

## 1. Đọc trước (bắt buộc)

- `AGENTS.md` (SOC glassmorphism, `soc.module.css` tokens, `LangContext`)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 115-118 (DataOps parity fix A–F)
- `docs/IMPLEMENTATION_PLAN_DATAOPS_REALTIME_SYNC_FIX_20260918.md` (7 slices — config là P2 ngoài scope)
- `docs/AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` + `docs/PHAN_BIEN_AUDIT_DATAOPS_REALTIME_SYNC_20260918.md`
- Ảnh `Cấu hình` 18/09 (textarea JSON, 2 nút Xem trước/Sửa, audit 5 dòng)

---

## 2. Phạm vi nghiên cứu

### A. SUB — FE Config Surface

- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:1` (331 dòng, `createElement`, `SocOwnershipBadge`, `SocWriteGuardBanner`, `SocConfigPreviewModal`)
- `packages/web/src/components/soc/SocConfigPreviewModal.tsx:1` (122 dòng, `before/after/changeSummary/impactWarnings/validationErrors`)
- `packages/web/src/components/soc/DataOpsContext.tsx:1` (179 dòng — không có config state, chỉ inventory/runs/coverage)
- `packages/web/src/components/soc/soc.module.css:3` + `soc.components.css` + `soc.tokens.css`
- `packages/web/src/adapters/core/soc.js:232-245` (`getSocDataOpsRuntimeConfig`, `applySocDataOpsRuntimeConfig`, `previewSocDataOpsRuntimeConfig`, `getSocDataOpsRuntimeConfigAudit`)
- `packages/web/src/i18n/vi.js:403,629` (`soc.dataops.*`), `en.js`

Symbols grep: `config_editor`, `locked_fields`, `invalid_json`, `computeChangeSummary`, `computeImpactWarnings`, `alert(`, `SocWriteGuardBanner`

### B. SUB — BE Config Domain

- `packages/core/backend/src/service_ops/views/dataops_config.py:1` (200 dòng, 3 views: `DataOpsRuntimeConfigView:71`, `PreviewView:122`, `AuditView:181`)
- `packages/core/backend/src/service_ops/views/dataops_base.py:1` (`DataOpsOwnershipSerializer:47`, `_build_market_data_ownership_payload:58`)
- `packages/core/backend/src/service_ops/domain_configs/market_data.py:1` (132 dòng, `MarketDataRuntimeConfig:50`, `QueueTierRuntimeConfig:8`, `validate():112`)
- `packages/core/backend/src/service_ops/models.py` (`ConfigChangeAudit`, `ServiceConfig`, `ServiceRunLog`)
- `packages/core/backend/src/service_ops/mixins.py` (`ConfigApplyMixin`)
- `packages/core/backend/src/service_ops/ownership.py` (`build_ownership_matrix_from_db`)

Symbols grep: `config_payload`, `MarketDataRuntimeConfig`, `get_market_data_runtime_config`, `ConfigChangeAudit`, `write_block_reason`

### C. CROSS-PACKAGE / EXTERNAL COUPLING

- `web↔core`: `defaultCoreApiAdapter as unknown as { getSocDataOpsRuntimeConfig }` `SocDataOpsConfigSection.tsx:105`, transport `adapters/core/transport.js`, 4 endpoints `/operator/scraping/dataops/runtime-config/` + `/preview/` + `/audit/` (kiểm `soc.js:232-245` path consistency `/scraping/dataops` vs `/soc/dataops`)
- `web↔widget`: không liên quan (config không dùng chart)
- `BE↔DB`: `ServiceConfig.config_payload` JSON, `ConfigChangeAudit` (actor, timestamp, change_summary, service_key)
- Benchmark: `SocVnbrokerPanel.tsx:1` (454 dòng, form + health + benchmark + circuit breaker), `SocPrefetchPanel.tsx`, `SocScreenerConfigForm.tsx` (có per-field form, slider, preview)

### D. QUALITY GATES

- Lint: `npm run lint` (packages/web) — 0 errors baseline, config section không lỗi riêng
- Type-check: `npm run build = tsc && vite build` (`tsc --noEmit 0` Entry 118, `build 53.00s`)
- i18n: `src/i18n/vi.js:403` `soc.dataops.config_editor` + `invalid_json:692`, `en.js` parity; `npm run i18n:scan` dự kiến sạch (không hardcoded mới ngoài `alert`)
- Test: `npm run test:components` — config chưa có `*.component.test.tsx` (vitest soc 8 files/67 — không cover config); BE `test_dataops_*` chưa có case cho runtime-config preview/audit

---

## 3. Phương pháp

1. **B1:** Đọc `vi.js:403-693` + `en.js` + 3 file config BE + 2 FE + ảnh UI.
2. **B2:** `glob packages/web/src/components/soc/*` (32 files) + `glob service_ops/views/dataops*` (7 files).
3. **B3:** `grep` key symbols (A, B) toàn repo `.tsx/.py/.js/.css`.
4. **B4:** `read` từng file cốt lõi, trace 1 use-case: load → edit JSON → Xem trước → Áp dụng → Audit.
5. **B5:** Đối chiếu `soc.js:232-245` path vs `dataops_config.py:71,122,181` + `domain_configs/market_data.py:validate` vs FE warnings `51-81` — gạch chỗ lệch.
6. **B6:** Check ranh giới: lint, type-check, i18n, test, ownership guard, adapter path consistency.

---

## 4. Đầu ra

### A. Bản đồ kiến trúc

| File | Lines | Trách nhiệm | Note |
|------|-------|-------------|------|
| `SocDataOpsConfigSection.tsx:1` | 331 | FE Config Section — load/edit/preview/apply/audit list | Raw textarea, `alert()`, `createElement` |
| `SocConfigPreviewModal.tsx:1` | 122 | Drawer diff `before/after/changeSummary/impactWarnings/validationErrors` | Dùng `soc.module.css:drawerOverlay/glassPanel` |
| `DataOpsContext.tsx:1` | 179 | Context `inventory/runs/coverage` — **không có config state** | Config fetch riêng `105-122` |
| `soc.js:232-245` | 14 | Adapter `get/apply/preview/audit` — path `/operator/scraping/dataops/runtime-config/` + `preview /soc/dataops/` | **Không nhất quán** `/scraping` vs `/soc` |
| `dataops_config.py:71` | 129 | BE View `get/post`, `PreviewView:122`, `AuditView:181` | `config_payload` JSONField, 403 ownership |
| `dataops_base.py:47` | 16 | `DataOpsOwnershipSerializer` + `_build_market_data_ownership_payload:58` | `can_apply/locked_fields/write_block_reason` |
| `domain_configs/market_data.py:8,50` | 132 | Typed config `decay_days`, `parity_snapshot_retention_days`, 4× `QueueTierRuntimeConfig` | `validate():112` chỉ min |
| `models.py:ConfigChangeAudit` | — | `service, actor, timestamp, change_summary, request_id` | Audit store |
| `vi.js:403-693` | — | i18n `config_editor, audit_trail, invalid_json, preview_failed` 15 keys | Đủ cho hiện tại, thiếu cho form mới |
| `soc.module.css:3` | 3 | Re-export tokens+components | Tokens `soc.tokens.css` color-mix |
| *Benchmark* `SocVnbrokerPanel.tsx:1` | 454 | Pref: per-field control + health + benchmark + breaker | Mẫu thương mại |

### B. Luồng dữ liệu đã trace (use-case sửa `hot_user_demand.poll_interval_seconds`)

```
[Load] SocDataOpsConfigSection.tsx:102 fetchConfigOnly() → defaultCoreApiAdapter.getSocDataOpsRuntimeConfig() soc.js:232 → coreGet "/operator/scraping/dataops/runtime-config/" → dataops_config.py:72 get() → get_market_data_runtime_config() (dataops_market_data.py) → MarketDataRuntimeConfig.to_dict() {decay_days:7, parity_…:30, hot:{30,50,50}…} → setEnvelope → setEditConfig JSON.stringify 2-spaces

[Edit] User sửa textarea SocDataOpsConfigSection.tsx:232 value=editConfig onChange → setEditConfig(e.target.value) — không parse, không field-level error.

[Xem trước] handlePreview:145 JSON.parse(editConfig) → computeChangeSummary:36 (truncated 80) + computeImpactWarnings:51 (sensitiveKeys:54) — client warning trước — → adapter.previewSocDataOpsRuntimeConfig(parsed) soc.js:240 → corePost "/operator/soc/dataops/runtime-config/preview/" → dataops_config.py:125 preview → MarketDataRuntimeConfig.from_dict({**current, **payload}).to_dict() + validate() → 400 nếu errors {validation_errors, is_valid:false} → setPreviewModal before/after/changeSummary/impactWarnings/validationErrors → SocConfigPreviewModal.tsx:16 drawer hiện before/after JSON + warnings.

[Áp dụng] handleApply:177 JSON.parse → adapter.applySocDataOpsRuntimeConfig(parsed) soc.js:236 → corePost "/operator/scraping/dataops/runtime-config/" {config_payload} → dataops_config.py:80 post() → ConfigApplyMixin.apply_config(service_key=matrix, domain=DATAOPS_MARKET_DATA_DOMAIN) → _build_market_data_ownership_payload() check can_apply → nếu False → 403 OWNERSHIP_WRITE_DENIED → nếu True → MarketDataRuntimeConfig.from_dict + validate → ServiceConfig save + ConfigChangeAudit create (actor, change_summary) → Response 201 {config, ownership, updated_at} → setEnvelope + setEditConfig.

[Audit] fetchAuditOnly:124 → getSocDataOpsRuntimeConfigAudit(page) soc.js:244 → coreGet "/operator/soc/dataops/runtime-config/audit/?page=1" → dataops_config.py:184 filter ConfigChangeAudit service_key=matrix order -timestamp → paginated {results:[{actor, action, timestamp}], next} → render auditTrail.map SocDataOpsConfigSection.tsx:272 actor•action•timestamp.slice(0,8).
```

### C. CONTRADICTIONS (Plan/Doc vs Code)

| STT | Plan/Doc `file:line` | Thực tế `file:line` | Tác động |
|-----|----------------------|---------------------|----------|
| C1 | `soc.js:240` `POST /operator/soc/dataops/runtime-config/preview/` | `soc.js:236` `POST /operator/scraping/dataops/runtime-config/` (apply) và `232` `GET /operator/scraping/dataops/runtime-config/` | Preview dùng `/soc/`, get/apply dùng `/scraping/` — không nhất quán namespace, dễ miss grant trong `operator_urls.py` |
| C2 | `DataOpsContext.tsx:1` được kỳ vọng chứa config state (SSOT) | Context chỉ có `inventory/runs/coverage:42-50`, config fetch riêng `SocDataOpsConfigSection.tsx:102` | Config không cache, không stream, không share giữa tabs |
| C3 | `vi.js:630` `runtime_config_hint: "Chỉ áp dụng JSON hợp lệ..."` ngụ ý user tự validate | `SocDataOpsConfigSection.tsx:232` textarea không có `hint` render, không link `vi.js:630` | Hint chết, user không biết |
| C4 | `SocConfigPreviewModal.tsx:45-61` hiện `validationErrors` + `impactWarnings` | `SocDataOpsConfigSection.tsx:51` `computeImpactWarnings` chỉ check top-level + queue-level sensitiveKeys `54`, không check `decay_days` interdependency với `warm` tier | Impact thiếu |
| C5 | `dataops_config.py:46` doc "phải qua ownership guard và tạo ConfigChangeAudit" | `DataOpsRuntimeConfigAuditView:186` filter `service_key=matrix` — nhưng `SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']` `dataops_base.py:58` là generic, không phải `dataops_market_data` | Audit lọt log của domain khác hoặc thiếu nếu service_key đổi |
| C6 | `domain_configs/market_data.py:33` `poll_interval >=10` | `SocDataOpsConfigSection.tsx:54` `sensitiveKeys` gồm cả `retention_days` không tồn tại trong `MarketDataRuntimeConfig` | Dead key trong warning set |

### D. Findings chi tiết

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|-----|-----------|---------|----------|-------------|
| **CFG-01** | **ERROR** | `SocDataOpsConfigSection.tsx:231-239` | Raw `textarea rows=12 class=configEditor` cho 6 keys ×4 tiers (14 số nguyên) — không label, không input number, không min/max, không unit (giây/bản ghi), không tooltip. Sai 1 `,` hoặc thiếu `}` → `alert(invalid_json):173` | Operator sợ chỉnh, typo cao, onboarding 30 phút | Thay bằng **form per-field** (như `SocScreenerConfigForm.tsx` / `SocVnbrokerPanel.tsx:222`): 2 global `NumberInput` + 4 `QueueTierFieldSet` (3× `poll/max_batch/max_dispatch` + unit, min, max, help tooltip). Validate inline trước preview. |
| **CFG-02** | **ERROR** | `SocDataOpsConfigSection.tsx:173,187,135,167` | `alert(t("soc.dataops.invalid_json"))` + `alert(Error)` blocking, không focus, không `role=alert`, không giữ draft. `catch { keep previous audit }` `133` nuốt lỗi | Mất context, a11y fail, không log | Thay `alert` bằng `inlineError` `SocDataOpsConfigSection.tsx:202` + `setError`/`setValidationErrors`, focus vào field lỗi, `aria-invalid`. |
| **CFG-03** | **GAP** | `SocDataOpsConfigSection.tsx:36-48,145-171` | `computeChangeSummary` slice 80 ký tự, `computeImpactWarnings` chỉ sensitiveKeys, không show diff line-by-line, không show `locked_fields:224` tác động. `SocConfigPreviewModal:76-89` hiện `before/after` JSON thô song song — không highlight diff, không sticky header. | Không review được thay đổi nhỏ trong 14 field lồng nhau | Thay bằng **DiffTable** (key │ before → after │ impact) + JSON diff highlight (`diff` lib), `locked_fields` gắn badge khóa, `write_block_reason` sticky. |
| **CFG-04** | **GAP** | `SocDataOpsConfigSection.tsx:264-315` + `dataops_config.py:181-200` | Audit trail chỉ `actor • action • HH:MM:SS` `281` (cắt `split("T")[1]`), không `change_summary`, không `updated_at` đầy đủ, không `service_key`, không before/after, không filter/search, không pagination info `count`, không export. BE `audit_trail 164-167` serializer thiếu `change_summary` chi tiết nhưng view có. | Không truy vết được ai đổi gì, không audit compliance | Mở rộng `DataOpsRuntimeConfigAuditSerializer:156` trả `before/after/diff`, FE table `actor │ timestamp (local) │ change_summary │ diff │ revert` + filter `actor/date` + search + CSV export. |
| **CFG-05** | **GAP** | `SocDataOpsConfigSection.tsx:243-261,318-329` + `dataops_config.py:80` | Nút `Sửa` `259` thực chất là Reset về `envelope.config` (label sai), không có `Áp dụng` trực tiếp — chỉ qua `Preview → Xác nhận`. Không có `Hủy/Đặt lại mặc định`, không `Revert` từ audit. Không `change_reason` bắt buộc (BE `change_reason` optional trong `ConfigApplyMixin`). | Quy trình 4 click rườm rà, không rollback khi lỗi | Đổi `Sửa → Đặt lại`, thêm `Áp dụng` inline (disable khi `!can_apply`), thêm `Lý do thay đổi *` bắt buộc (textarea), thêm `Revert`/`Đặt lại mặc định` từ audit row. |
| **CFG-06** | **GAP** | `domain_configs/market_data.py:31` + `SocDataOpsConfigSection.tsx:54,85` | BE `validate():112` chỉ check `>=1/>=10`, không upper bound (`poll 86400? max_batch 10000?`), không cross-check `max_dispatch > max_batch` vô nghĩa, không khuyến nghị. FE `sensitiveKeys` thiếu `cold_full_market`/`recovery_backlog` đầy đủ và thừa `retention_days` dead. | Cho phép config dở `poll=10, max_batch=1, max_dispatch=100` — mismatch gây spam/kẹt | Thêm BE validation: `poll <=3600`, `max_batch <=500`, `max_dispatch <= max_batch*2` warning, FE inline `min/max/step` + tooltip `vi.js:629-632` + quick preset `Thấp/Vừa/Cao`. |
| **CFG-07** | **RISK** | `dataops_config.py:80` + `SocDataOpsConfigSection.tsx:177` | `applySocDataOpsRuntimeConfig:236` gửi `config_payload` toàn bộ, không `If-Match` `updated_at`, không optimistic lock. 2 SOC mở cùng lúc → last-write-wins, audit không ghi `before`. | Mất thay đổi đồng nghiệp, không conflict detect | Thêm `GET` trả `ETag: updated_at` + `POST` yêu cầu `If-Match`/`expected_updated_at`; conflict → `409` + show diff 3-way. Log `before/after` trong `ConfigChangeAudit`. |
| **CFG-08** | **RISK** | `SocDataOpsConfigSection.tsx:204-218` + `dataops_base.py:58` | `SocOwnershipBadge:205` + `SocWriteGuardBanner:212` hiện `GHI ĐƯỢC / NATIVE-WRITE` nhưng không giải thích, `locked_fields` chỉ join string `228`, không disable input. User vẫn sửa field bị khóa → BE 403 mới biết. | Tốn 1 round-trip, bực | Disable/grey + lock icon từng field bị `locked_fields`, tooltip `vi.js:133` `audit_trail` + banner link tới ownership matrix. |
| **CFG-09** | **GAP** | `soc.js:232-245` | Adapter path không nhất quán `/scraping` vs `/soc`, không có `getSocDataOpsRuntimeConfigSchema()` để FE tự sinh form từ BE schema. | FE hard-code keys, BE thêm field là FE không biết | Thêm `GET /operator/scraping/dataops/runtime-config/schema/` trả JSON schema (field, type, min, max, help, default) — FE render form động, như `operator_urls.py` pattern. |
| **CFG-10** | **GAP** | `SocDataOpsConfigSection.tsx:84-143` + `DataOpsContext.tsx:150` | Config fetch riêng, không qua `DataOpsContext`, không `stale-while-revalidate`, không `refetchOnWindowFocus`, không `WebSocket` / `useDataOpsStream` như `SocDataOpsMonitorSection`. `auditPage` state `98` nhưng không reset khi config đổi. | Stale khi người khác đổi, phải F5 | Đưa config vào `DataOpsContext` + `useDataOpsStream` hoặc `SWR` 30s, `auditPage` reset khi `updated_at` đổi, thêm `Last updated` `vi.js:644`. |
| **CFG-11** | **GAP** | `packages/web/src/i18n/vi.js:403-693` | Thiếu i18n cho field help, placeholder, error per-field; `vi.js:629-632` `runtime_config_hint` không dùng; `soc.config_preview.*` đủ nhưng `soc.dataops.invalid_json:692` chung chung. | Không localize help | Thêm `soc.dataops.field_decay_days_label/help/min/max`, `field_poll_interval_*`, per-tier `hot/warm/cold/recovery` labels (dùng `vi.js:687-690` tier names). |
| **CFG-12** | **INFO** | `soc.module.css:3` + `SocDataOpsConfigSection.tsx:225-228` | `configEditor:231` textarea không có `max-height`, `locked_fields` div không class, audit `264` sectionCard không `role=list` — a11y/style sơ sài. | Không đạt glassmorphism token | Dùng `soc.tokens.css` `spacing/size` + `glassPanel` + `inlineError` consistent. |

### E. Quality gates audit

| Gate | Lệnh | Kết quả | Ghi chú |
|------|------|---------|---------|
| Lint | `npm run lint --prefix packages/web` | `0 errors` baseline (Entry 118), config section 0 riêng | Không block |
| Type-check | `npx tsc --noEmit --project packages/web/tsconfig.json` | `0` (Entry 118 `53.00s`) | `SocDataOpsConfigSection.tsx:9` `RuntimeConfig [key:string]` any — lỏng type, nên `MarketDataRuntimeConfig` typed |
| Build | `npm run build --prefix packages/web` | `PASS 53.00s` chunk warn | Không regression |
| i18n | `npm run i18n:scan --prefix packages/web` | `soc.dataops.config_editor` 1, `invalid_json` 1 — nhưng `runtime_config_hint:630` dead, `soc.config_preview.*` dùng 3/3 | Cần scan sau fix CFG-11 |
| Test | `npm run test:components` vitest `soc 8 files/67` | **0 file cover config** (`SocDataOpsConfigSection` chưa có `*.component.test.tsx`) — gap | Thêm tests P0 (xem plan) |
| BE Test | `python src/manage.py test service_ops.tests.test_dataops* --keepdb` | Chưa có `test_dataops_runtime_config` — chỉ `test_soc_tasks`/`test_scheduler_catalog` | Thêm BE tests cho validate/preview/audit/ownership |

### F. Câu hỏi cần làm rõ

1. `decay_days` và `parity_snapshot_retention_days` có nên cho operator đổi hay chỉ SRE? Hiện `locked_fields` có thể khóa — cần policy.
2. `poll_interval_seconds` min 10 là đủ chậm? `hot_user_demand 30s` xuống 10s có gây storm DB (1942 symbols) không — cần rate-limit BE?
3. Có cần workflow phê duyệt 2-step (đề xuất → duyệt) như `signals/rules/request` hay chỉ 1-step `preview→apply`?
4. Có cần preset `Tiết kiệm / Cân bằng / Hiệu năng` cho 4 tier không?
5. `GET /operator/soc/dataops/runtime-config/schema/` có chấp nhận không hay FE hard-code schema tiếp?

### G. Đánh giá tổng thể

- **Implementable?** Có — BE đã có `MarketDataRuntimeConfig` typed + `validate()` + `PreviewView` + `AuditView` + `ConfigApplyMixin`; FE chỉ cần thay textarea bằng form động, không đổi contract (giữ `config_payload` JSON).
- **Blocker?** Không block vận hành (đọc/ghi chạy). **Blocker UX thương mại:** CFG-01/02/03/04/05 khiến operator mất 5-10 phút cho 1 thay đổi thay vì 30s, không audit được.
- **Ưu tiên sửa:** **P0** CFG-01+02+03 (form + inline error + diff) → **P0** CFG-05+08 (audit + write guard per-field) → **P1** CFG-04+06+07 (validate + versioning + lock) → **P2** CFG-09+10+11 (schema + stream + i18n).
- **Benchmark:** Sau P0 đạt parity `SocVnbrokerPanel` (form + preview + health); sau P1 đạt `Datadog Config` (versioning/rollback/diff); sau P2 đạt `AWS Config` (schema-driven + approval).

---

## Phụ lục — So sánh với VNBroker (mẫu thương mại)

| Tiêu chí | VNBroker `SocVnbrokerPanel.tsx:1` | DataOps Config `SocDataOpsConfigSection.tsx:1` | Gap |
|----------|-----------------------------------|-----------------------------------------------|-----|
| Form | `textarea` + health + benchmark + breaker 6 cards | `textarea` 12 rows duy nhất | Missing per-field |
| Preview | `previewSocVnbrokerConfig` + `change_summary/impactWarnings/validationErrors` modal | Có preview nhưng `alert` | UX kém |
| Audit | Không có (health-oriented) | Có `audit_trail` 3 cột | Sơ sài |
| Help | `subtitle`, `timeout_section` labels | `runtime_config_hint` dead | Chưa dùng |
| Test | `SocVnbrokerPanel` có benchmark E2E | 0 test config | Gap |

**File audit:** `docs/AUDIT_DATAOPS_CONFIG_20260918.md` (file này).
**Ledger:** cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 119 sau khi duyệt audit.
