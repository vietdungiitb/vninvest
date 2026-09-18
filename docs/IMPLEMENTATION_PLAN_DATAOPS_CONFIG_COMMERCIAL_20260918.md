# IMPLEMENTATION PLAN — Nâng cấp Cấu hình DataOps lên Thương mại (2026-09-18)

**Base:** `ec594e4c` + `Entry 118` (beat mem, queue dedup, coverage hook, heartbeat, tz, UI) — config là backlog P2, audit `docs/AUDIT_DATAOPS_CONFIG_20260918.md` Entry 119.
**Mục tiêu:** Từ `textarea JSON 12 dòng + alert + audit HH:MM:SS` → form thương mại Datadog/AWS Config: per-field control, inline validate, diff có highlight, audit có before/after + filter + export + revert, optimistic lock, preset, schema-driven.
**Chuyển giao:** Đội code thực thi không cần hỏi lại. Mỗi slice có **Yêu cầu đạt (DoD)** + **Tiêu chí audit copy-paste** (`grep`/`manage.py`/`tsc`/`vitest`) + **Test**. Gate bắt buộc sau mỗi slice.

> **Ràng buộc giữ:** Vietnamese full dấu `vi.js`, tokens `soc.tokens.css/sclang`, `LangContext t()`, `defaultCoreApiAdapter as unknown as { … }`, `soc.module.css:sectionCard/glassPanel/inlineError/actionBtn`.
> **Không đổi contract** BE `POST config_payload` — chỉ thêm `expected_updated_at` optional + `schema` GET (backward compat).

---

## 0. BỐI CẢNH & THIẾU HỤT ĐÃ CHỨNG MINH (Entry 119)

- FE `SocDataOpsConfigSection.tsx:232` `textarea` cho 14 số nguyên lồng nhau (6 keys ×4 tiers) — không label/min/max/unit/tooltip → typo `CFG-01 ERROR`.
- `alert()` `173,187` blocking (KHÔNG phải `135/167` — hai dòng đó không phải `alert`) — không inline, không a11y `CFG-02`.
- `computeChangeSummary:36` slice 80 + `computeImpactWarnings:51` chỉ sensitiveKeys — không diff highlight `CFG-03`.
- Audit FE `264-315` chỉ `actor•action•HH:MM:SS` `281` — **FE không render** `change_summary`/`before_snapshot`/`after_snapshot`/`count`/**`action`** dù BE đã trả sẵn (`dataops_config.py:158-161,164`; DB + handler `models.py:340,344,345` + `mixins.py:83,86,87`); thiếu filter/export `CFG-04`.
- BE `MarketDataRuntimeConfig.validate():112` chỉ `>=1/>=10` — không max, không cross-check, không preset `CFG-06`.
- Không versioning/lock/revert `CFG-05/07`, không per-field write guard `CFG-08`, path `/scraping` vs `/soc` lệch `CFG-09`, không stream/context `CFG-10`.

> **Số hiệu CFG chuẩn (R5):** dùng theo **Bảng D** của audit (`docs/AUDIT_DATAOPS_CONFIG_20260918.md:143-156`): CFG-01 form · CFG-02 alert · CFG-03 diff · CFG-04 audit · CFG-05 label/revert · CFG-06 validate · CFG-07 lock · CFG-08 guard · CFG-09 schema/path · CFG-10 context · CFG-11 i18n · CFG-12 INFO. Mục "Tóm tắt" audit (dòng 27-31) đánh số CFG-03/04/05 khác — **bỏ qua**, toàn bộ plan dùng bảng D.

---

## 1. KIẾN TRÚC ĐÍCH

```
[BE] domain_configs/market_data.py:MarketDataRuntimeConfig (validate + schema) 
      ↕  GET/POST/Preview/Audit/Schema (+ ETag updated_at)
[coreApiAdapter soc.js:232] get/apply/preview/audit/getSchema (+ ETag)
      ↕
[FE] DataOpsContext (config state, SWR 30s) → SocDataOpsConfigSection (Form per-field)
      ├── useConfigForm (typed state, inline errors, touched)
      ├── DiffEngine (before→after, locked_fields badge)
      ├── SocConfigPreviewModal (DiffTable + highlight)
      └── ConfigAuditTable (actor•time•summary•diff•revert•filter•export)
```

Giữ `soc.component.css` glass panel, `soc.tokens.css` spacing.

---

## 2. SLICES & TIÊU CHÍ AUDIT (copy-paste chạy được)

### SLICE C1 — Form per-field P0 (thay textarea) — FIX CFG-01, CFG-11

**Mục tiêu:** Operator chỉnh 14 field bằng NumberInput có label/min/max/unit, không cần nhớ JSON.

**Mẫu thiết kế (R2 — benchmark đúng):** chỉ dùng `SocScreenerConfigForm.tsx:99-100` (`input type=number`) làm mẫu form per-field. **KHÔNG** lấy `SocVnbrokerPanel.tsx` làm mẫu form — file này cũng là raw `textarea:223` (`className=configEditor`) y hệt DataOps, không phải form control.

**Files:**
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:1` (331 → ~420 dòng, giữ `createElement`)
- `packages/web/src/components/soc/SocQueueTierFieldSet.tsx` **MỚI** (50 dòng, `poll_interval_seconds`, `max_batch_size`, `max_dispatch_per_cycle` + tooltip)
- `packages/web/src/i18n/vi.js:403,629` + `en.js` (+12 keys field labels/help)
- `packages/web/src/components/soc/soc.components.css` (thêm `.fieldGrid/.fieldRow/.helpText` — dùng tokens)

**Yêu cầu đạt (DoD):**
- C1.1. Xóa `textarea:231-239` — thay bằng: `sectionCard` Global `2× NumberInput` (`decay_days:7`, `parity_snapshot_retention_days:30` min 1 max 365 help `vi.js:645`) + `sectionGrid 2×2` 4 `SocQueueTierFieldSet` (hot `30/50/50`, warm `120/50/50`, cold `900/200/200`, recovery `600/50/50` — default từ `domain_configs/market_data.py:53-78`).
- C1.2. Mỗi `SocQueueTierFieldSet` có `label` (`vi.js:687-690` tier names), `NumberInput min/max/step`, `unit` (`giây`/`bản ghi`), `help` tooltip (`vi.js:647-648`), `error` inline khi `<10` hoặc `>3600/500`.
- C1.3. Nút `Đặt lại` `259` đổi label `t("soc.actions.reset")` (hiện `Sửa` sai) — reset về `envelope.config`; thêm `Đặt lại mặc định` (gửi `{}` về BE defaults).
- C1.4. Giữ `SocOwnershipBadge:205` + `SocWriteGuardBanner:212` + `locked_fields` disable per-field (xem C6, nhưng C1 đã chuẩn bị `disabled={locked_fields.includes(key)}`).
- C1.5. Không đổi `DataOpsContext` — state form giữ trong section (controlled).

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "SocQueueTierFieldSet|NumberInput|fieldGrid" | Out-String  # expect ≥3 hits (import + 4 usages + grid)
Select-String -Path packages/web/src/components/soc/SocQueueTierFieldSet.tsx -Pattern "poll_interval|max_batch|max_dispatch" | Out-String  # expect 3
Select-String -Path packages/web/src/i18n/vi.js -Pattern "field_decay_days|field_poll_interval" | Out-String  # expect 2+
npx tsc --noEmit --project packages/web/tsconfig.json  # 0
npm run build --prefix packages/web  # PASS
```

**Test (FE):** `SocDataOpsConfigSection.component.test.tsx` **MỚI** (3 tests): render 14 inputs với default `7/30/30`, nhập `poll 5` → inline error `≥10`, sửa lại `30` → error clear, nút Đặt lại trả về `7`. Gate `vitest run SocDataOpsConfigSection`.

---

### SLICE C2 — Inline error + Preview diff upgrade P0 — FIX CFG-02, CFG-03

**Mục tiêu:** Không `alert`, diff đọc được, impact rõ.

**Files:**
- `SocDataOpsConfigSection.tsx:145-191` (`handlePreview`, `handleApply`, `computeChangeSummary:36`, `computeImpactWarnings:51`)
- `SocConfigPreviewModal.tsx:1` (122 dòng → thêm DiffTable)
- `packages/web/src/lib/diffUtil.ts` **MỚI** (30 dòng, `diffObjects(before, after) → {key, before, after, impact}[]`)

**Yêu cầu đạt (DoD):**
- C2.1. Xóa `alert(t("soc.dataops.invalid_json")):173` + `alert(Error):187` — thay `setError("JSON không hợp lệ…")` render `inlineError` `202` + focus field lỗi (queue tier name).
- C2.2. `computeChangeSummary` không slice 80 — trả full array `DiffRow[]`; `SocConfigPreviewModal` render **DiffTable** 3 cột `Trường | Trước → Sau | Tác động` với `impact` badge (đỏ khi `poll <10` hoặc `max_dispatch > max_batch*2`).
- C2.3. `before/after` JSON trong modal có **highlight diff** (dòng đổi màu `rgba(22,215,160,0.15)` / `rgba(239,68,68,0.15)`), sticky header `soc.config_preview.changes`.
- C2.4. `validationErrors:45` + `impactWarnings:54` render riêng `inlineError` với `role="alert"` và icon `⚠`.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "alert\(" | Out-String  # expect 0 sau fix
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "setError|inlineError|diffObjects" | Out-String  # expect ≥2
Select-String -Path packages/web/src/lib/diffUtil.ts -Pattern "diffObjects" | Out-String  # expect 1
```

**Test (FE):** Thêm 2 tests trong `SocDataOpsConfigSection.component.test.tsx`: preview với `hot.poll=5` → modal hiện `validationErrors` `poll_interval phải >=10`; sửa `hot.poll=30` → diff table 1 dòng `hot_user_demand.poll_interval_seconds: 30→5`.

---

### SLICE C3 — Audit trail thương mại P0 — FIX CFG-04, CFG-05 (phần read)

**Mục tiêu:** Audit như Datadog: actor•time•summary•diff•revert + filter + export.

**Files:**
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:264-315` (audit trail)
- `packages/core/backend/src/service_ops/views/dataops_config.py:156-200` (serializers + AuditView)
- `packages/core/backend/src/service_ops/models.py` (`ConfigChangeAudit` — **R3: đã có** `action`/`before_snapshot`/`after_snapshot` `:340,344,345`, **không** thêm field, **không** migration)
- `packages/web/src/adapters/core/soc.js:244` (`getSocDataOpsRuntimeConfigAudit`)

**Yêu cầu đạt (DoD):**
- C3.1. **R1/R3 — không viết lại thứ đã có.** BE `DataOpsRuntimeConfigAuditSerializer:156` **chỉ cần thêm** `action` + `before_snapshot` + `after_snapshot` + `request_id`; các field `change_summary:161`, `service_key:158`, `actor:159`, `timestamp:160` **đã có sẵn ở serializer**, và DB `ConfigChangeAudit.action/before_snapshot/after_snapshot` đã được ghi (`models.py:340,344,345` + `mixins.py:83,86,87`). FE không cắt `timestamp.slice(0,8)` `281` — dùng `socTime.formatLastCheck` (local + relative); render `entry.action` thay cho hard-code `config_change` `:279`.
- C3.2. FE audit table 5 cột `Người thực hiện | Thời điểm (local) | Tóm tắt thay đổi | Diff (nút Xem) | Hoàn tác`. `change_summary` từ `audit.change_summary` (BE đã có), không hard-code `config_change`.
- C3.3. Thêm filter `Theo người thực hiện` (select actor) + `Từ ngày` (date input) + `Tìm kiếm` (change_summary) — client filter trên `auditTrail` (page 20), không cần BE thêm query (giữ BE simple).
- C3.4. Thêm `Xuất CSV` `soc.export.export_config_audits` (dùng `exportSocConfigAudits` pattern) — hỏi `limit 50`.
- C3.5. Pagination giữ `Prev/Next` `289-312` nhưng thêm `Tổng thay đổi {count}` `vi.js:634` + disabled logic.

**Tiêu chí audit:**
```bash
Select-String -Path packages/core/backend/src/service_ops/views/dataops_config.py -Pattern "action|before_snapshot|after_snapshot|change_summary" | Out-String  # expect hit trong AuditSerializer (change_summary đã có sẵn)
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "change_summary|formatLastCheck|Xuất CSV" | Out-String  # expect ≥2
python src/manage.py test service_ops.tests.test_dataops_config_audit --keepdb  # expect PASS (thêm test mới)
```

**Test (BE):** `service_ops/tests/test_dataops_config.py` **MỚI** (3 tests): `GET audit` trả `results[0].change_summary` + `action` + `before_snapshot`/`after_snapshot` + `timestamp` ISO; `GET ?page=2` pagination; `filter` FE không cần BE test.
**Test (FE):** Thêm 2 tests audit: render `actor BIDV • 14:32 • decay_days 7→14` + nút `Hoàn tác` hiện.

---

### SLICE C4 — BE validation hardening + error mapping P1 — FIX CFG-06

**Mục tiêu:** Cho phép `poll 86400` bị chặn, `max_dispatch > max_batch*2` cảnh báo, message chuẩn vi.js.

**Files:**
- `packages/core/backend/src/service_ops/domain_configs/market_data.py:31,112` (`validate()`)
- `packages/core/backend/src/service_ops/views/dataops_config.py:125-145` (PreviewView)
- `packages/web/src/i18n/vi.js:403-693` (error keys)

**Yêu cầu đạt (DoD):**
- C4.1. `QueueTierRuntimeConfig.validate():31` thêm `poll_interval_seconds <=3600` (`"phải <= 3600 giây (1 giờ)"`), `max_batch_size <=500`, `max_dispatch_per_cycle <=1000`.
- C4.2. Thêm cross-check trong `MarketDataRuntimeConfig.validate():112` sau `errors.extend(...)`: nếu `tier.max_dispatch_per_cycle > tier.max_batch_size * 2` → `errors.append(f"{field_prefix}.max_dispatch_per_cycle không nên vượt quá {max_batch*2} (hiện {dispatch})")` (warning level — vẫn 400 nhưng message là impact).
- C4.3. PreviewView `125-145` giữ `is_valid False + 400` khi errors, FE `C2` đã hiện `validationErrors`.
- C4.4. Xóa dead `retention_days` khỏi `SocDataOpsConfigSection.tsx:54` `sensitiveKeys`.

**Tiêu chí audit:**
```bash
Select-String -Path packages/core/backend/src/service_ops/domain_configs/market_data.py -Pattern "poll_interval.*3600|max_batch.*500|max_dispatch" | Out-String  # expect 3
python src/manage.py shell -c "from service_ops.domain_configs.market_data import MarketDataRuntimeConfig; c=MarketDataRuntimeConfig.from_dict({'hot_user_demand':{'poll_interval_seconds':5000}}); print(c.validate())"  # expect error <=3600
```

**Test (BE):** Thêm 4 tests trong `test_dataops_config.py`: `poll 5 → >=10`, `poll 4000 → <=3600`, `max_batch 0 → >=1`, `max_dispatch 200 vs max_batch 50 → warning`.

---

### SLICE C5 — Versioning / optimistic lock / revert P1 — FIX CFG-07, CFG-05 (write)

**Mục tiêu:** Không last-write-wins, có Hoàn tác từ audit.

**Files:**
- `packages/core/backend/src/service_ops/views/dataops_config.py:71` (`DataOpsRuntimeConfigView.post`)
- `packages/core/backend/src/service_ops/models.py` (`ServiceConfig.applied_at` làm ETag)
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:177` (`handleApply`)
- `packages/web/src/adapters/core/soc.js:232,236` (thêm `expected_updated_at` optional)

**Yêu cầu đạt (DoD):**
- C5.1. **R4** `GET runtime-config/` trả `updated_at` ISO — FE giữ `envelope.updated_at` làm `expected`. `POST` nhận `expected_updated_at?: string` ở **top-level `request.data`** (cùng cấp với `config_payload`, **KHÔNG lồng trong wrapper** — BE `ConfigApplyMixin.apply_config` đọc top-level `request.data.get('change_reason','')` `mixins.py:77`). FE adapter `soc.js:236-237` gửi `{ config_payload, expected_updated_at, change_reason }` (không break cũ: không gửi thì bỏ qua lock).
- C5.2. BE `post:80` nếu `request.data.get('expected_updated_at')` và khác `ServiceConfig.applied_at.isoformat()` → `409 Conflict` `{code:"CONFIG_CONFLICT", detail:"Cấu hình đã được cập nhật bởi người khác lúc {time}. Vui lòng tải lại.", current_config, updated_at}`.
- C5.3. FE `handleApply` gửi `expected_updated_at: envelope.updated_at`; nếu `409` → `setError(detail)` + nút `Tải lại & so sánh` (gọi `fetchConfigOnly` + mở modal diff `envelope.config` vs `editConfig`).
- C5.4. **R4** Audit row `Hoàn tác` `C3` gọi `applySocDataOpsRuntimeConfig(audit.before_snapshot)` với `change_reason` + `expected_updated_at` gửi **top-level** (cùng cấp `config_payload`, không lồng wrapper) → BE tạo `ConfigChangeAudit` mới, `action='apply'` hoặc `'rollback'` (choice có sẵn `models.py:328`).
- C5.5. **R3 — bỏ hack cũ.** BE **đã có** `ConfigChangeAudit.before_snapshot`/`after_snapshot` (`models.py:344-345`) và `ConfigApplyMixin` đã ghi (`mixins.py:86-87`). **KHÔNG** nhồi before/after vào `change_summary` (sẽ phá ngữ nghĩa field và xung đột C3.2). Chỉ cần expose 2 field này ở `DataOpsRuntimeConfigAuditSerializer` (C3.1).

**Tiêu chí audit:**
```bash
Select-String -Path packages/core/backend/src/service_ops/views/dataops_config.py -Pattern "expected_updated_at|409|CONFIG_CONFLICT" | Out-String  # expect ≥2
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "expected_updated_at|Tải lại" | Out-String  # expect ≥1
python src/manage.py test service_ops.tests.test_dataops_config_conflict --keepdb  # expect 409 khi stale
```

**Test (BE):** Thêm `test_dataops_config_conflict.py` (2 tests): `POST` với `expected_updated_at` cũ → `409`; `POST` không `expected_updated_at` → `201` (backward compat).
**Test (FE):** Mock `409` → inline error `CONFIG_CONFLICT` + nút `Tải lại` hiện.

---

### SLICE C6 — Write guard per-field + schema-driven P1/P2 — FIX CFG-08, CFG-09, CFG-01 nâng cao

**Mục tiêu:** Field bị khóa thì disable + lock icon, không phải 403 sau khi bấm.

**Files:**
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:224-228` (`locked_fields`)
- `packages/web/src/components/soc/SocQueueTierFieldSet.tsx` (C1)
- `packages/core/backend/src/service_ops/views/dataops_base.py:47-62` (ownership)
- `packages/core/backend/src/service_ops/domain_configs/market_data.py` (+ `get_schema()` **MỚI**)
- `packages/core/backend/src/service_ops/views/dataops_config.py` (+ `DataOpsRuntimeConfigSchemaView` **MỚI** `GET /schema/`)

**Yêu cầu đạt (DoD):**
- C6.1. FE `SocQueueTierFieldSet` nhận `lockedKeys: string[]` — nếu `locked_fields.includes("hot_user_demand.poll_interval_seconds")` hoặc `"decay_days"` → `disabled` + `🔒` + tooltip `t("soc.badge.write_block_reason", {reason})` + `aria-disabled`.
- C6.2. `SocDataOpsConfigSection.tsx:228` không còn `join(", ")` thô — thay bằng per-field badge.
- C6.3. BE `GET /operator/scraping/dataops/runtime-config/schema/` trả `{fields:[{key:"decay_days", type:"int", min:1, max:365, default:7, help:"..."}, {key:"hot_user_demand.poll_interval_seconds", min:10, max:3600, default:30}]}` — FE C1 có thể hard-code fallback nếu `schema` 404 (giữ backward compat).
- C6.4. Không bắt buộc FE dùng schema ở C1, nhưng C6 thêm `useEffect` fetch schema → render form động nếu có, không thì fallback 14 hard-coded.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocQueueTierFieldSet.tsx -Pattern "locked.*disabled|aria-disabled|🔒" | Out-String  # expect 1
Select-String -Path packages/core/backend/src/service_ops/views/dataops_config.py -Pattern "SchemaView|/schema" | Out-String  # expect 1
curl -s http://127.0.0.1:8001/core/v1/operator/scraping/dataops/runtime-config/schema/ 2>&1 | Out-String  # expect 200 với fields (sau deploy)
```

**Test (BE):** Thêm `test_schema` — `GET schema/` trả `fields` chứa `decay_days`.
**Test (FE):** `locked_fields=["decay_days"]` → input `decay_days` disabled + lock icon.

---

### SLICE C7 — Context/stream + preset P2 — FIX CFG-10, CFG-04 nâng cao

**Mục tiêu:** Config không stale, có preset nhanh.

**Files:**
- `packages/web/src/components/soc/DataOpsContext.tsx:42-50` (thêm `config` state)
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:102-122` (chuyển sang context)
- `packages/web/src/hooks/useDataOpsStream.ts` (đã có cho dataops stream)
- `packages/web/src/i18n/vi.js:630-635` (preset labels)

**Yêu cầu đạt (DoD):**
- C7.1. `DataOpsContext` thêm `config: RuntimeEnvelope | null`, `refreshConfig: () => Promise<void>`, `configUpdatedAt: string|null` — `useEffect` fetch config + `SWR 30s` (hoặc `useDataOpsStream` nếu BE stream có config event). `SocDataOpsConfigSection` dùng `useDataOps().state.config` thay fetch riêng → share.
- C7.2. Khi `updated_at` đổi từ stream/poll → `auditPage` reset 1 + `editConfig` không overwrite nếu `dirty` (đang gõ) — chỉ `setEnvelope` + `error` banner `Đã có cập nhật mới — Tải lại`.
- C7.3. Thêm preset `Tiết kiệm | Cân bằng | Hiệu năng` (3 nút) — fill 12 field polling/batch/dispatch theo template BE `market_data.py:53-78` defaults: Tiết kiệm `hot 60/30/30`, Cân bằng `30/50/50`, Hiệu năng `15/100/100`.
- C7.4. `Last updated {soc.dataops.last_updated:644}` `vi.js` render local time `socTime.formatLastCheck`.

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/DataOpsContext.tsx -Pattern "config.*RuntimeEnvelope|refreshConfig" | Out-String  # expect 1
Select-String -Path packages/web/src/components/soc/SocDataOpsConfigSection.tsx -Pattern "useDataOps\(\)|preset|Tiết kiệm" | Out-String  # expect 1
```

**Test (FE):** `DataOpsContext` test — mock `getSocDataOpsRuntimeConfig` trả `decay 7` → `state.config.decay_days=7`.

---

### SLICE C8 — Tài liệu & ledger

**Files:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md` + `docs/AUDIT_DATAOPS_CONFIG_20260918.md`

**Yêu cầu đạt (DoD):** Entry `120→` mỗi slice, commit hash, gates.

---

## 3. THỨ TỰ THỰC HIỆN & GATE

| Bước | Slice | Verify ngay | Gate |
|------|-------|-------------|------|
| 1 | **C1 Form** | `SocQueueTierFieldSet` + `field_decay_days` + `tsc 0` | `vitest SocDataOpsConfigSection` 3 PASS |
| 2 | **C2 Diff** | `alert 0` + `diffObjects` + modal DiffTable | vitest + `manage.py check` 0 |
| 3 | **C3 Audit** | `change_summary` + `formatLastCheck` + audit export | `test_dataops_config_audit` 3 PASS |
| 4 | **C4 Validate** | `poll 5000 ≤3600` + `max_batch` | `test_dataops_config` 4 PASS |
| 5 | **C5 Lock/Revert** | `expected_updated_at 409` | `test_dataops_config_conflict` 2 PASS |
| 6 | **C6 Guard/Schema** | `locked disabled` + `GET schema 200` | `test_schema` 1 PASS |
| 7 | **C7 Context/Preset** | `DataOpsContext config` + preset | vitest context 1 PASS |
| 8 | **C8 Ledger** | `grep ^## Entry` | — |

**Gate chung mỗi slice:** `python src/manage.py check` 0 + `npx tsc --noEmit` (web) 0 + `npm run build --prefix packages/web` PASS.
**Gate cuối:** `python src/manage.py test service_ops.tests.test_dataops_config* --keepdb` (≥12 tests) + `vitest run soc` 67+6 PASS + `npm run i18n:scan` 0.

---

## 4. VERIFY E2E SAU KHI XONG

```bash
# 1. Form 14 field
open http://localhost:8080/operations-center?tab=dataops&subtab=config → 2 global + 4 fieldset 3 inputs = 14 NumberInput, help tooltip, Đặt lại mặc định

# 2. Inline error + diff
Đổi hot poll 30→5 → blur → inline "phải >=10" + Preview → modal DiffTable 1 dòng đỏ + validationErrors

# 3. Audit
Sửa decay 7→14 → Apply (reason "test E2E") → audit table top row actor•14:32•"decay_days 7→14" → filter actor → 1 row → Hoàn tác → decay về 7

# 4. Lock
Thử field locked (nếu BE khóa warm) → input grey + 🔒 + tooltip, Preview disable

# 5. Conflict
Mở 2 tab → tab1 đổi 7→14 Apply → tab2 Apply với updated_at cũ → 409 + nút Tải lại & so sánh

# 6. Preset
Bấm "Hiệu năng" → hot 15/100/100 fill → Preview → 3 warnings

# 7. Stream
Đổi config tab Khác → tab Config tự hiện banner "Đã có cập nhật mới — Tải lại" (30s)
```

---

## 5. RỦI RO & QUYẾT ĐỊNH DESIGN

- Giữ `createElement` (không JSX) theo `AGENTS.md` — dù `SocDataOpsConfigSection` JSX đẹp hơn, nhưng thống nhất với `SocVnbrokerPanel` style hiện tại.
- Không thêm `zod`/`react-hook-form` — dùng controlled `useState` + `validate()` FE mirror BE `validate()` để tránh lib nặng (đã có `socValidation.ts`).
- Path `/scraping` vs `/soc` giữ backward compat — thêm alias `re_path(r'^soc/dataops/runtime-config/schema/')` trỏ cùng view.
- `expected_updated_at` optional — không bắt buộc FE cũ phải gửi, tránh break.
- **R3** `ConfigChangeAudit` không cần migration — `before_snapshot`/`after_snapshot` đã tồn tại (`models.py:344-345`); chỉ expose ở serializer, **không** nhồi vào `change_summary`.
- Preset không gọi BE — chỉ fill form, vẫn qua `preview→apply`.

---

## 6. PHẠM VI NGOÀI

- Approval 2-step (đề xuất→duyệt) như `signals/rules/request` — để P3 nếu cần SOX compliance.
- Bulk import JSON file / Export config file — P3.
- Role-based `locked_fields` editor — hiện BE `ownership.py` single source, không UI edit.
- Analytics impact simulation (dự đoán queue backlog nếu poll 10s) — P3.

---

## 7. BÀN GIAO CHECKLIST

- [ ] C1 14 inputs + 4 fieldset + Đặt lại mặc định + tsc 0 + build PASS
- [ ] C2 0 `alert()`, DiffTable highlight, inlineError `role=alert`
- [ ] C3 audit `change_summary` + `formatLastCheck` + filter + Xuất CSV + Hoàn tác
- [ ] C4 `validate()` max + cross-check + 4 BE tests
- [ ] C5 `409 CONFIG_CONFLICT` + `expected_updated_at` + revert
- [ ] C6 per-field `locked_fields` disable + `GET schema 200` + fallback
- [ ] C7 `DataOpsContext config` + `Last updated` + 3 presets
- [ ] C8 ledger Entry 120+ + `AGENTS.md` sync + `i18n:scan` 0 + `vitest` + `manage.py check` 0

**File plan:** `docs/IMPLEMENTATION_PLAN_DATAOPS_CONFIG_COMMERCIAL_20260918.md` (file này).
**Audit:** `docs/AUDIT_DATAOPS_CONFIG_20260918.md`.
**Ledger:** cập nhật sau mỗi slice.
