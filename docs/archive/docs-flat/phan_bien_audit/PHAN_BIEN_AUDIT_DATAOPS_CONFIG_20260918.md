# PHẢN BIỆN ĐỘC LẬP — Audit + Kế hoạch Cấu hình DataOps (2026-09-18)

> **Ngày phản biện:** 2026-09-18
> **Đối tượng:** `docs/AUDIT_DATAOPS_CONFIG_20260918.md` (Entry 119) + `docs/IMPLEMENTATION_PLAN_DATAOPS_CONFIG_COMMERCIAL_20260918.md` (8 slices C1→C8).
> **Phương pháp:** reproduce-first theo khung AGENTS.md (Nguyên tắc 1–6). Mọi kết luận kèm `file:line` đã đọc thật. Không viết code. Ngôn ngữ: Tiếng Việt.
> **Base:** `ec594e4c` + Entry 118 (uncommitted changes).
> **Kết quả gate đã chạy lại:** `npx tsc --noEmit` (packages/web) = **0**; `docker exec vninvest-dev-core-api python src/manage.py check` = **0 issues**.

---

## TÓM TẮT — 5 phát hiện nghiêm trọng nhất trong bản audit/plan

**R1 (ERROR — sai sự thật BE):** Audit **CFG-04** khẳng định "BE `audit_trail` serializer thiếu `change_summary`" và "không `before/after`". **SAI.** `DataOpsRuntimeConfigAuditSerializer` đã trả `change_summary` (`dataops_config.py:161`) + `service_key` (`:158`); DB `ConfigChangeAudit` đã có `action`, `before_snapshot`, `after_snapshot` (`models.py:340,344,345`) và `ConfigApplyMixin` đã ghi đủ (`mixins.py:83,86,87`). Thiếu duy nhất ở khâu **FE không render**. → Finding P0 của audit sai nền; plan **C3.1/C5.5** làm lại thứ đã có.

**R2 (ERROR — benchmark sai):** Audit **CFG-01** lấy `SocVnbrokerPanel.tsx` làm mẫu "form per-field". **SAI**: VNBroker cũng xài raw `textarea` (`SocVnbrokerPanel.tsx:223`, `className=configEditor`). Chỉ `SocScreenerConfigForm.tsx:99-100` mới có `input type=number`. Audit tự mâu thuẫn: thân bài nói VNBroker có form (dòng 145), phụ lục lại ghi "textarea" (dòng 190).

**R3 (ERROR — plan đề xuất hack sai):** Plan **C5.5** đề nghị "nếu model chưa có field `before_after`, lưu before/after vào `change_summary` mở rộng (không migration)". **Không cần** — `before_snapshot`/`after_snapshot` tồn tại sẵn (`models.py:344-345`) và đã được ghi (`mixins.py:86-87`). Nhồi JSON vào `change_summary` sẽ phá ngữ nghĩa field này và xung đột chính DoD C3.2 ("`change_summary` từ `audit.change_summary`, không hard-code").

**R4 (GAP — tích hợp nhầm tầng):** Plan **C5.1** nói nhận `expected_updated_at` "trong `config_payload` wrapper", nhưng BE `apply_config` đọc `request.data.get('change_reason','')` ở **top-level** (`mixins.py:77`), và FE adapter chỉ gửi `{ config_payload }` (`soc.js:237`). Nếu đặt lock/reason trong wrapper → BE không thấy → lock vô hiệu (silent).

**R5 (ERROR — số hiệu finding + trích dẫn):** Bản audit có **2 bảng số hiệu xung đột**: mục "Tóm tắt 5 findings" gán CFG-03=Audit trail, CFG-04=validate, CFG-05=versioning; còn bảng D lại gán CFG-03=diff, CFG-04=audit, CFG-06=validate, CFG-07=versioning. Ledger Entry 119 theo bảng D. Ngoài ra **CFG-02** trích `alert()` tại `135,167` — hai dòng này **không phải** `alert` (135 = `}, []);`, 167 = `} catch (err) {`).

> **Kết luận nhanh:** Bản audit **đúng phần lớn mô tả FE/UX**, nhưng **~40-50% khẳng định phía BE và benchmark sai**. Kế hoạch **vẫn implementable** (không blocker vận hành), nhưng phải sửa R1–R5 trước khi bàn giao để tránh làm lại/đổi contract sai.

---

## A. BẢN ĐỒ KIẾN TRÚC (đã read xác nhận)

| File | Lines | Trách nhiệm | Note (đã verify) |
|------|-------|-------------|------------------|
| `packages/web/src/components/soc/SocDataOpsConfigSection.tsx` | 331 | FE config load/edit/preview/apply/audit | `textarea:231-239`; `alert:173,187`; `computeChangeSummary:36`; `computeImpactWarnings:51`; `locked_fields:224-230`; `Sửa` reset `:252-260`; audit `264-315` |
| `packages/web/src/components/soc/SocConfigPreviewModal.tsx` | 122 | Drawer preview | `validationErrors:45`, `impactWarnings:54`, `changeSummary:63`, JSON thô `83,89` — **không** diff highlight |
| `packages/web/src/components/soc/DataOpsContext.tsx` | 179 | Context `inventory/runs/coverage` | State `77-83` — **không** config state (C2 đúng) |
| `packages/web/src/adapters/core/soc.js` | — | Adapter 4 endpoint config | get/apply `/operator/scraping/...` `:233,237`; preview/audit `/operator/soc/...` `:241,245` (C1 đúng); `exportSocConfigAudits:64` |
| `packages/core/backend/src/service_ops/views/dataops_config.py` | 200 | 3 view config | Get `72-78`; POST `80-95` (`service_key=matrix :83`); Preview `122-154`; Audit serializer `156-161`; Audit view `181-200` |
| `packages/core/backend/src/service_ops/views/dataops_base.py` | 164 | Ownership serializer + payload | Serializer `47-56`; `_build_market_data_ownership_payload:58`; import `SOC_DOMAIN_PRIMARY_SERVICE_KEYS:32` |
| `packages/core/backend/src/service_ops/views/mixins.py` | 99 | `ConfigApplyMixin` | Guard `44-52`; validate `54-64`; audit create `81-90` (`before_snapshot:86`, `after_snapshot:87`) |
| `packages/core/backend/src/service_ops/models.py` | 754 | `ConfigChangeAudit:322` + `ServiceConfig:59` | `action:340`, `before_snapshot:344`, `after_snapshot:345`, `change_summary:347`, `actor:341`, `timestamp:349`, `request_id:350` |
| `packages/core/backend/src/service_ops/domain_configs/market_data.py` | 132 | Typed config | `QueueTierRuntimeConfig.validate:31-39`; `MarketDataRuntimeConfig.validate:112-122` — **chỉ min**, không max/cross |
| `packages/core/backend/src/service_ops/registry.py` | 421 | SSOT service keys | `SOC_DOMAIN_PRIMARY_SERVICE_KEYS:241-248` (`matrix:247`, `dataops:244`); `_build_default_config_payloads:278-284` **bỏ sót** dataops/matrix |
| `packages/core/backend/src/service_ops/operator_urls.py` | 39 | Route `/operator/scraping/` | Chỉ `runtime-config/` `:34`; **không** preview/audit/schema |
| `packages/core/backend/src/service_ops/urls.py` | — | Route `/operator/soc/` | `runtime-config/ :135`, `preview/ :136`, `audit/ :137` |
| `packages/core/backend/src/vninvest_core/contracts/operator/urls.py` | 22 | Mount 2 namespace | `/scraping/ :16` + `/soc/ :17` |
| *Benchmark đúng* `packages/web/src/components/soc/SocScreenerConfigForm.tsx` | — | `input type=number` `:99-100` | Mẫu form per-field hợp lệ |
| *Benchmark audit SAI* `packages/web/src/components/soc/SocVnbrokerPanel.tsx` | 454 | **Raw `textarea:223`** | Không phải form; audit phụ lục tự nhận "textarea" |
| `packages/web/src/hooks/useDataOpsStream.ts` | 149 | SSE DataOps | Snapshot `6-24` **không có `config`** (chỉ `queue_tiers.poll_interval_seconds:23`) |

---

## B. LUỒNG DỮ LIỆU ĐÃ TRACE (use-case áp dụng config)

1. **Load:** `SocDataOpsConfigSection.tsx:102 fetchConfigOnly()` → `soc.js:232 getSocDataOpsRuntimeConfig` → `GET /operator/scraping/dataops/runtime-config/` → `dataops_config.py:72 get()` → `get_market_data_runtime_config()` → `{config, ownership, updated_at}`.
2. **Edit:** `textarea:231-239` `onChange` `:235` — không parse, không field-level error.
3. **Preview:** `handlePreview:145` `JSON.parse` → `computeChangeSummary:36` (cắt 80 tại `:45`) + `computeImpactWarnings:51` → `soc.js:240` → `POST /operator/soc/dataops/runtime-config/preview/` → `dataops_config.py:125` dry-run `:136` → 400 nếu lỗi `:147`.
4. **Apply:** `handleApply:177` → `soc.js:236` `POST /operator/scraping/dataops/runtime-config/` `{config_payload}` → `dataops_config.py:80 post()` → `ConfigApplyMixin.apply_config` (`mixins.py:22`) → guard `:45` → validate `:56` → `ServiceConfig.create:72` + `ConfigChangeAudit.create:81` (**ghi `action/before_snapshot/after_snapshot`**) → 201.
5. **Audit:** `fetchAuditOnly:124` → `soc.js:244` → `GET /operator/soc/dataops/runtime-config/audit/?page=1` → `dataops_config.py:184` filter `service__service_key=matrix` `:186-188` → paginated `:200` → FE render `:272-283` (dùng `entry.action || "config_change"` `:279` — BE **không** trả `action`).

**Kết luận trace:** luồng chạy được; chỗ hụt thực sự nằm ở **FE render** (`change_summary`, `action`, `count`, `service_key` bị bỏ) và **thiếu diff/audit UI** — không phải BE thiếu dữ liệu.

---

## C. CONTRADICTIONS (Audit/Plan vs Code)

| # | Audit/Plan `file:line` | Thực tế `file:line` | Tác động |
|---|------------------------|---------------------|----------|
| **K1** | Audit CFG-04: "BE serializer thiếu `change_summary` chi tiết nhưng view có" (doc dòng 148) | Serializer **có** `change_summary` `dataops_config.py:161`; view trả `:196` | Finding sai nền → plan C3.1 thêm lại thừa |
| **K2** | Audit CFG-04: "không before/after" (doc dòng 148) | DB có `before_snapshot:344`/`after_snapshot:345` `models.py`; handler ghi `mixins.py:86-87` | Plan C5.5 đề xuất nhồi `change_summary` — sai |
| **K3** | Audit CFG-04: "không pagination info `count`" (doc dòng 148) | `count/next/previous` có ở `dataops_config.py:164-166`, trả qua `get_paginated_response:200` | FE chỉ cần render; không cần BE |
| **K4** | Audit CFG-01: "Benchmark VNBroker… có form control" (dòng 145, 114) | `SocVnbrokerPanel.tsx:223` là raw `textarea` | Benchmark sai; audit phụ lục dòng 190 tự mâu thuẫn |
| **K5** | Audit CFG-11: "Thiếu i18n cho field help/audit" (dòng 155) | Nhiều key đã có: `audit_actor:637`, `audit_change_summary:639`, `audit_service_key:638`, `audit_total:634`, `last_updated:644`, `decay_days:645`, `poll_interval:647`, tier `687-690` (`vi.js`) | Gap là **wiring**, không phải thiếu key |
| **K6** | Audit C5: "`SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']` `dataops_base.py:58` là generic, không phải `dataops_market_data`" (dòng 138) | Mapping ở `registry.py:247` (`matrix_cycle_coordinator`); `dataops_base.py:58` là `_build_market_data_ownership_payload`. Apply `dataops_config.py:83` + Audit `:185` dùng **cùng** key → không lọt domain | C5 sai nền; không có leak |
| **K7** | Audit C6/CFG-06: "`sensitiveKeys` thiếu `cold_full_market`/`recovery_backlog`" (dòng 139, 150) | `computeImpactWarnings:70-78` lặp nested cho **mọi** tier key | Overstated; chỉ `retention_days` thật sự dead |
| **K8** | Audit CFG-02: `alert()` tại `SocDataOpsConfigSection.tsx:173,187,135,167` (dòng 146) | Chỉ `:173` và `:187` là `alert`; `:135`=`}, []);`, `:167`=`} catch (err) {` | Trích dẫn sai |
| **K9** | Plan C5.1: `expected_updated_at` "trong `config_payload` wrapper" (dòng 164) | BE đọc top-level `request.data` `mixins.py:77`; FE gửi `{config_payload}` `soc.js:237` | Tích hợp sai tầng → lock silent |
| **K10** | Plan C3.1: "before/after lấy từ … `ConfigChangeAudit.change_payload` nếu có" (dòng 110) | Không có field `change_payload`; đúng là `before_snapshot`/`after_snapshot` | Sai tên field |
| **K11** | Plan C1.3: "đổi label `t("soc.actions.reset")`" (dòng 56) | Key `soc.actions.reset` **không tồn tại** trong block `soc.actions` `vi.js:169-182` | Plan phải thêm key |
| **K12** | Plan C7.1: "(hoặc `useDataOpsStream` nếu BE stream có config event)" (dòng 222) | `useDataOpsStream.ts:6-24` không có field `config` (chỉ `queue_tiers.poll_interval_seconds`) | Chỉ SWR 30s khả thi; stream không đủ |
| **K13** | Plan §5: "Giữ `createElement` (không JSX) theo `AGENTS.md`" (dòng 292) | AGENTS.md **không** có quy định này; ngược lại ghi nhận đã chuyển createElement→JSX (`AGENTS.md:64`) | Viện dẫn sai |
| **K14** | Audit mục "Tóm tắt" gán CFG-03=Audit/CFG-04=Validate/CFG-05=Versioning (dòng 27-31) vs bảng D gán CFG-03=Diff/CFG-04=Audit/CFG-06=Validate/CFG-07=Versioning (dòng 147-151) | Ledger Entry 119 theo bảng D | Số hiệu không nhất quán giữa các mục |

---

## D. FINDINGS (phân loại mức + verdict các claim)

### D.1 — Verdict theo finding audit

| ID audit | Verdict | Cơ sở `file:line` | Ghi chú |
|----------|---------|-------------------|---------|
| CFG-01 raw textarea | **CONFIRMED** (claim gốc) | `SocDataOpsConfigSection.tsx:231-239` | Nhưng benchmark VNBroker **REFUTED** (xem R2/K4) |
| CFG-02 `alert()` blocking | **CONFIRMED** | `:173`, `:187` | Trích dẫn `135/167` sai (K8) |
| CFG-03 diff slice-80 thô | **CONFIRMED** | `computeChangeSummary:36-49` (`slice(0,80):45`); modal JSON thô `83,89` | Đúng |
| CFG-04 audit trail sơ sài (FE) | **PARTIALLY CONFIRMED** | FE chỉ render `actor/action/time` `:272-283` | Khẳng định **BE thiếu** là REFUTED (K1–K3); `action` thật ra là fallback `:279` |
| CFG-05 label `Sửa` = reset, không revert/reason | **CONFIRMED** | `:255` reset, `:259` label; `change_reason` optional `mixins.py:77`; `rollback` choice có sẵn `models.py:328` nhưng không endpoint | Đúng |
| CFG-06 validate chỉ min + dead `retention_days` | **CONFIRMED** | `market_data.py:112-122`; dead key `:54` | Riêng claim "thiếu cold/recovery" REFUTED (K7) |
| CFG-07 no optimistic lock | **CONFIRMED** | Không có `expected_updated_at`/ETag trong `dataops_config.py`/`soc.js` | Đúng |
| CFG-08 `locked_fields` không disable | **CONFIRMED** | `:224-230` (join `:228`) | Đúng |
| CFG-09 path `/scraping` vs `/soc` | **CONFIRMED** | `soc.js:233,237` vs `:241,245`; `operator_urls.py:34` vs `urls.py:136-137` | Đúng — nhưng **không phải bug** vì cả 2 route đều tồn tại |
| CFG-10 không context/stream | **CONFIRMED** | `DataOpsContext.tsx:77-83`; `useDataOpsStream.ts:6-24` | Đúng |
| CFG-11 i18n thiếu/hint dead | **PARTIALLY CONFIRMED** | `runtime_config_hint` dead `vi.js:630` (chỉ xuất hiện tại định nghĩa) | Nhiều key đã có (K5) → sửa wiring |
| CFG-12 a11y/style sơ sài | **CONFIRMED (INFO)** | `:225-228` không class; `:264` không `role=list`; `textarea` không max-height | Đúng |

### D.2 — Verdict theo contradiction audit

| ID | Verdict | Ghi chú |
|----|---------|---------|
| C1 (`/soc` vs `/scraping`) | **CONFIRMED** | Chỉ là bất nhất namespace, không lỗi |
| C2 (Context không config) | **CONFIRMED** | |
| C3 (`runtime_config_hint` dead) | **CONFIRMED** | |
| C4 (impact thiếu interdependency) | **PARTIALLY CONFIRMED** | `decay_days` **có** trong `sensitiveKeys:54`; thiếu đúng phần cross-tier |
| C5 (audit filter lệch) | **REFUTED** | Apply/audit cùng key `dataops_config.py:83,185`; cite `dataops_base.py:58` sai |
| C6 (`retention_days` dead) | **CONFIRMED** | |

### D.3 — Findings mới (trên bản audit/plan)

| ID | Mức | `file:line` | Thực tế | Tác động | Đề xuất |
|----|-----|-------------|---------|----------|---------|
| **R1** | **ERROR** | `dataops_config.py:158-161,164` + `models.py:340,344,345` + `mixins.py:83,86,87` | BE đã có `change_summary`/`action`/`before_snapshot`/`after_snapshot`/`count` | Audit sai nền, plan làm lại thừa | Sửa audit: chỉ expose `action`, `before_snapshot`, `after_snapshot` ở serializer; FE render |
| **R2** | **ERROR** | `SocVnbrokerPanel.tsx:223` | VNBroker là raw `textarea`, không phải form | Benchmark sai hướng thiết kế | Chỉ dùng `SocScreenerConfigForm.tsx:99` làm mẫu |
| **R3** | **ERROR** | `models.py:344-345` + `mixins.py:86-87` | Đã có `before_snapshot`/`after_snapshot` | Plan C5.5 nhồi `change_summary` → phá ngữ nghĩa | Bỏ hack; thêm 2 field vào serializer |
| **R4** | **GAP** | `mixins.py:77` vs `soc.js:237` | BE đọc `change_reason`/`expected_updated_at` top-level; FE gửi wrapper | Lock/reason có thể silent fail | C5: gửi top-level `{config_payload, expected_updated_at, change_reason}` |
| **R5** | **ERROR** | audit dòng 27-31 vs 147-151 | 2 bảng số hiệu CFG xung đột | Nhầm khi implement | Thống nhất 1 bảng (theo bảng D) |
| **R6** | RISK | `registry.py:278-284` | `_build_default_config_payloads` **không** seed `dataops`/`matrix` | Config mặc định có thể không được khởi tạo chuẩn | Kiểm tra seed; nếu cần thêm key |
| **R7** | GAP | `vi.js:169-182` | `soc.actions.reset` chưa tồn tại | C1.3 vỡ nếu không thêm key | Thêm `reset: 'Đặt lại'` + `en.js` |
| **R8** | GAP | plan C3.1/C6.3 | File list thiếu đăng ký URL (`operator_urls.py`/`urls.py`) cho schema | Endpoint schema không route được | Bổ sung URL registration vào C6 |
| **R9** | RISK | plan C4.2 vs C2.2/C7.3 | C4.2 coi `max_dispatch > max_batch*2` là **lỗi 400**, nhưng C2.2 coi là badge impact, C7.3 preset "Hiệu năng 15/100/100" và E2E bước 6 kỳ vọng "3 warnings" | Mâu thuẫn: preset không sinh warning (100 < 200), lỗi 400 chặn preview | Thống nhất: warning mềm (không 400) + sửa kỳ vọng E2E |
| **R10** | INFO | plan §3 dòng 259 | "+6" test FE nhưng liệt kê C1(3)+C2(2)+C3(2)=7 | Số liệu gate sai nhẹ | Sửa thành 7 (hoặc nêu rõ) |
| **R11** | INFO | plan C3.1 dòng 111 | "không hard-code `config_change`" — đúng, nhưng gốc là FE `:279` | Cần FE sửa | FE nên render `entry.action`; BE expose `action` |

---

## E. QUALITY GATES AUDIT

| Gate | Lệnh | Kết quả (đã chạy lại) | Ghi chú |
|------|------|------------------------|---------|
| Type-check | `npx tsc --noEmit` (packages/web) | **0** | PASS |
| BE check | `docker exec vninvest-dev-core-api python src/manage.py check` | **0 issues** | PASS |
| Build | `npm run build --prefix packages/web` | Chưa chạy lại (Entry 118 = PASS 53.00s) | **CHƯA XÁC MINH LẠI** — no code change |
| i18n | `npm run i18n:scan` | Chưa chạy | `runtime_config_hint` dead xác nhận bằng grep (chỉ `vi.js:630`) |
| Test FE | `npm run test:components` | **0 file cover config** | Đúng: `__tests__` không có `soc-config*.component.test.*` |
| Test BE | `service_ops.tests.test_dataops_config*` | **Chưa tồn tại** | Chỉ có `test_dataops_backfill_fixes.py` |
| Path consistency | grep | `/scraping` (get/apply) vs `/soc` (preview/audit) | Both route tồn tại → không 404 |

**Đánh giá gate:** các gate tĩnh xanh. Khoảng trống test của config là thật (audit đúng phần này).

---

## F. CÂU HỎI CẦN LÀM RÕ

1. `action`, `before_snapshot`, `after_snapshot` đã có trong DB — có cần versioning/ETag riêng không, hay chỉ expose + `409` theo `expected_updated_at` là đủ?
2. C5.4 revert: dùng `action='rollback'` (đã có choice `models.py:328`) hay tạo `apply` mới? Cần chốt để audit đúng ngữ nghĩa.
3. `max_dispatch > max_batch*2`: hard error hay soft warning? (xem R9)
4. Có cần thêm `/schema/` khi form hard-code 14 field vẫn chạy tốt? (chi phí vs lợi ích)
5. `_build_default_config_payloads` có nên thêm `dataops`/`matrix` để đảm bảo seed? (R6)

---

## G. ĐÁNH GIÁ TỔNG THỂ

- **Audit có dùng được không?** Có — nhưng **độ chính xác ~55-65%**: phần FE/UX (CFG-01/02/03/05/07/08/09/10) đúng; phần BE (CFG-04) và benchmark (CFG-01) sai; C5 sai nền.
- **Plan có implementable không?** **Có**, không blocker vận hành. Nhưng phải sửa **R1, R2, R3, R4, R5** trước khi bàn giao; **R6–R11** là tinh chỉnh.
- **Blocker thật:** không có blocker kỹ thuật. "Blocker" duy nhất là **mô tả BE sai trong audit** khiến plan C3.1/C5.5 làm thừa/đổi sai contract (nhồi JSON vào `change_summary`).
- **Ưu tiên sửa trước khi code:**
  1. **P0 — Đính chính audit:** CFG-04 → nêu rõ BE đã đủ (`dataops_config.py:158-161` + `models.py:344-345` + `mixins.py:86-87`), chỉ FE thiếu render.
  2. **P0 — Sửa plan C3.1/C5.5:** expose `action`/`before_snapshot`/`after_snapshot` ở serializer; bỏ hack `change_summary`.
  3. **P0 — Sửa plan C5.1/C5.4:** `expected_updated_at`/`change_reason` là **top-level**, không trong `config_payload`.
  4. **P1 — Sửa benchmark:** chỉ dùng `SocScreenerConfigForm.tsx:99`.
  5. **P1 — Thống nhất số hiệu CFG** (R5) + cite `alert` đúng (`:173`, `:187`).

---

**File phản biện:** `docs/PHAN_BIEN_AUDIT_DATAOPS_CONFIG_20260918.md` (file này).
**Audit gốc:** `docs/AUDIT_DATAOPS_CONFIG_20260918.md`.
**Kế hoạch:** `docs/IMPLEMENTATION_PLAN_DATAOPS_CONFIG_COMMERCIAL_20260918.md`.
**Ledger:** cập nhật Entry 120.
