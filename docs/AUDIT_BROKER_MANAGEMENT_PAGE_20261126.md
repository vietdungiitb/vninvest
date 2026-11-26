# AUDIT + PHƯƠNG ÁN NÂNG CẤP — Trang "Quản trị Broker" (tab Môi giới, Operations Center)

- **Ngày:** 2026-11-26 · **Scope:** FE `SocBrokerPanel` + adapter `soc.js`, BE `service_ops/views/broker.py`, schema `domain_configs/broker.py`, runtime `broker_runtime.py`, credential store `SystemBrokerCredential`, i18n VI/EN, evidence staging.
- **Trigger:** owner ghi nhận "mục cấu hình broker thiết kế chưa ổn để staff cấu hình các broker sử dụng cho hệ thống" (2 ảnh chụp: banner 400 `/operator/soc/broker/credentials/`, form JSON `{}`, audit log rỗng).
- **Trạng thái:** **ĐÃ AUDIT ĐỘC LẬP** — reviewer chốt `NEED_REVISION`; các refutation đã được sửa ở bản này (§9). Chuyên gia **đã chốt 6 quyết định mặc định ở §8** — owner chỉ cần phản đối nếu muốn khác; không còn câu hỏi ngược lại trước khi triển khai.
- **Read-only:** không sửa source, không chạy test/build, không deploy. Số runtime đều kèm lệnh/timestamp (L-V01); claim kế thừa đều đối chiếu code (L-V02).

## TÓM TẮT ĐỂ OWNER PHÊ DUYỆT

**Vấn đề gốc không phải là giao diện xấu — là cấu hình gần như không có hiệu lực runtime.** Trang trộn 3 concerns (registry `ServiceConfig`, credential `SystemBrokerCredential`, health/audit) nhưng không nối chúng: `get_system_broker_secrets()` có **đúng 1 consumer** là backfill hardcode `('dnse','backfill')` (`data_ingest/tasks.py:2515`); `provider_for_purpose()` (`broker_runtime.py:73-75`) và `DEFAULT_PURPOSE_PROVIDER` (`domain_configs/broker.py:17-21`) **0 consumer production** (chỉ test). Không có ràng buộc chéo purpose ↔ credential ↔ routing: staff có thể Apply "backfill = bật, DNSE routing 0" dù credential DNSE thiếu hoặc chỉ có purpose `snapshot` — vẫn báo "Áp dụng thành công". Trên nền đó, banner 400 do textarea mặc định `{}`, placeholder sai schema (`api_key` thay vì `client_id`), 3 key i18n thiếu, nút "Kiểm tra" không có endpoint poll (`broker/jobs` không tồn tại) — tất cả chỉ là triệu chứng. **Phương án phải gồm slice nối runtime (S2b) trước khi redesign (S5)**, nếu không chỉ làm đẹp banner lỗi. Audit độc lập chốt **NEED_REVISION** vì draft đầu thiếu slice này; đã sửa.

---

## 0. NGUYÊN TẮC / SSOT

1. `docs/adr/ADR-006-broker-ssot-qua-vnbroker.md:8-21, 28-29`: vnbroker SSOT cho protocol/auth/sign/parse; vninvest sở hữu credential vault, tenant, điều phối, UI, audit, kill-switch. Thiếu năng lực ⇒ `VNBROKER-REQ`, không tự code broker.
2. `ADR-005:10-20, :27`: danh mục tường minh theo nguồn; holdings broker ≠ watchlist thủ công.
3. `ADR-008:11-22`: không sàn/không lệnh live — redesign không mở live trading.
4. `ADR-006:14-15` cho phép vninvest làm **policy** tại `broker_runtime.py`; **HTTP retry/rate-limit ở tầng protocol thuộc vnbroker** — nếu enforce `rpm/retry/burst/timeout` vượt ranh giới này ⇒ mở `VNBROKER-REQ` mới (`REQUESTS_TO_VNBROKER_20261014.md` hiện **không có** REQ rate-limit/routing).
5. UI: token → `soc.tokens.css`, class → `soc.components.css`, **không** đụng `soc.module.css`; đổi màu tăng/giảm hỏi owner.

**Lessons áp dụng:** `[L-V01, L-V02, L-T02, L-F03]`

**Checklist đã tick:**
- [x] L-V01: mọi số staging có lệnh + timestamp; control bằng lệnh lặp lại (số thay đổi theo thời gian).
- [x] L-V02: 400 giải thích bằng POST `{}` (code), không phải giả định GET lỗi; reviewer độc lập đối chiếu lại.
- [x] L-T02: citation trọng yếu tự mở lại đúng file (panel, broker.py, schema, runtime, dnse.py, i18n, tasks.py).
- [x] L-F03: grep i18n cả `vi/soc.js` + `en/soc.js` — 3 key thiếu ở cả 2 locale.

---

## 1. BẰNG CHỨNG RUNTIME (VPS `14.225.255.47`, read-only, 2026-11-26)

Lệnh chung: `ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 <cmd>`. Không đọc/ghi giá trị secret.

| # | Lệnh (tóm tắt) | Kết quả thật | Ý nghĩa |
|---|---|---|---|
| R1 | `docker exec vninvest-core-redis redis-cli -n 3 LLEN celery` | **10.486** (lần đo audit) / **10.583** (lần đo reviewer), cùng ngày — lệnh lặp lại cho số mới | Hàng đợi Celery **global** tồn đọng thật; theo `broker.py:52,75-82` bị gán cho **mọi provider card**, không phải backlog riêng broker. |
| R2 | `manage.py shell`: count model | `SystemBrokerCredential=0` · `UserDNSECredential=0` · `DNSECredential=0` · `UserBrokerConfig=0` · `BrokerSyncRun=0` · `BrokerSyncIssue=0` | 3 provider không có credential; lane metrics 24h = 0, giải thích card "0 lần chạy / 0% lỗi". |
| R3 | `manage.py shell`: health rows | Chỉ `kbs` (unhealthy, circuit **open**; `consecutive_failures=7` lần tôi đo, `=6` lần reviewer) và `vci` (healthy); **không có row DNSE** | UI vẫn render 3 card DNSE/SSI/TCBS từ default — dễ hiểu nhầm "đã giám sát". Số fail thay đổi theo thời gian. |
| R4 | `manage.py shell`: audit | 3 dòng `ConfigChangeAudit`, service = `vnbroker_quote` ×2 + `screener_rule_engine` ×1; **0 dòng `broker_config`** (service_id 28) | "CHƯA CÓ THAY ĐỔI NÀO." trong ảnh là **đúng**, audit không hỏng. |
| R5 | `manage.py shell`: runtime config | `VnbrokerRuntimeConfig` 1 row, `data_source='KBS'`, `fallback_sources=['VCI']` | KBS circuit-open nhưng vẫn là data_source chính — rủi ro vận hành, báo coordinator (ngoài scope UI). |
| R6 | `grep -rn "broker/jobs" service_ops/` | Chỉ **1 hit** = docstring `broker.py:526`; không có route | Nút "Kiểm tra" xếp job nhưng không có endpoint poll. |

---

## 2. BẢN ĐỒ KIẾN TRÚC

| File | Line | Trách nhiệm |
|---|---|---|
| `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | 16, 42-43, 65-66, 108 | lazy mount tab `broker`, deep-link `?tab=` |
| `packages/web/src/components/soc/SocBrokerPanel.tsx` | 123-139 (**14** `useState`), 160-294, 296-545 | reload 4 GET; form registry/credential; health; audit; preview/apply |
| `packages/web/src/adapters/core/soc.js` | 349-391 | 8 method broker |
| `packages/web/src/adapters/core/transport.js` | 245-256, 287-305, 442-497 | `CoreApiRequestError`, dựng message thô |
| `packages/web/src/i18n/locales/{vi,en}/soc.js` | 995-1033 | `soc.broker.*` — 3 key thiếu |
| `packages/web/src/i18n/index.js` | 41-42 | missing key → `defaultValue` → **trả chính key** |
| `packages/core/backend/src/service_ops/urls.py` | 81-88 | **8 route** `broker/*` (dòng 80 là comment) |
| `packages/core/backend/src/service_ops/views/base.py` | 99-105 | `SOCBaseView = [IsAuthenticated, IsAdminUser]` |
| `packages/core/backend/src/service_ops/views/broker.py` | 75-82, 85-159, 199-215, 217-234, 251-318, 332-374, 391-422, 439-479, 493-538 | queue, lane metrics, audit, masked creds, config, health, credentials, test |
| `packages/core/backend/src/service_ops/domain_configs/broker.py` | 10-21, 53-108, 111-173, 175-184, 187-206 | schema + validation + defaults |
| `packages/core/backend/src/service_ops/broker_runtime.py` | 31-75, 78-129, 132-226, 242-255 | consumer kill-switch/quiet-hours; không tiêu thụ rpm/retry/timeout |
| `packages/core/backend/src/identity_access/models.py` | 960-1034 | `SystemBrokerCredential`, Fernet, `allowed_purposes`, `masked_preview` |
| `packages/core/backend/src/user_workspace/broker/dnse.py` | 62-84 | `test_connection` chỉ `get_accounts()`, đọc `client_id/client_secret` |
| `packages/core/backend/src/service_ops/tasks.py` | 1381-1416 | test job: chỉ DNSE, gán `is_verified=True` |

---

## 3. LUỒNG ĐÃ TRACE

**3.1 Mở trang:** `ShellOperationsCenterPage.tsx:65-66` → `SocBrokerPanel.tsx:182` → `reload()` `:160-180` gọi 4 GET (config/health/credentials/audit). GET credentials `broker.py:442-443` **luôn 200, không validate** — banner 400 không thể phát sinh lúc mount.

**3.2 Banner 400:** có **3 nhánh** trả 400 tại `broker.py`: provider lạ `:452-454`, **secrets rỗng `:455-457`**, purpose lạ `:458-461`. Ảnh khớp nhánh secrets rỗng: `SocBrokerPanel.tsx:137` default `"{}"` → `:241-247` `JSON.parse` hợp lệ → `:249` gửi `{secrets:{}}` → `broker.py:456` → `transport.js:304-305` dựng JSON thô → banner `:310`. Repo có đúng 1 caller POST (`SocBrokerPanel.tsx:249`). Tương tác thực tế lúc chụp: `CHƯA XÁC MINH` (không trace Network), backend staging drift: `CHƯA XÁC MINH`.

**3.3 Registry apply:** `updateEntry` `:184-195` → preview `:197-209` → apply `:211-238` → `broker.py:260-286`: `from_dict` → `validate()` → `ServiceConfig.objects.create` → `_write_audit`. Không có `expected_updated_at`, không rollback.

**3.4 "Kiểm tra":** `:274-284` → `broker.py:528-538` enqueue, trả 202 `{job_id,state:'pending'}` → FE toast `:278`; **không poll** (R6). Task `tasks.py:1394-1415`: lấy credential, chỉ DNSE, gọi `get_accounts()`, gán `is_verified=True` **không kiểm `allowed_purposes`**.

**3.5 Runtime tiêu thụ (blocker):** `get_system_broker_secrets` (`identity_access/models.py:1016-1034`) có **đúng 1 consumer** = `data_ingest/tasks.py:2515` với c hardcoded `('dnse','backfill')`; `provider_for_purpose` (`broker_runtime.py:73-75`, `domain_configs/broker.py:175-184`) và `DEFAULT_PURPOSE_PROVIDER` (`:17-21`) **0 consumer production** (chỉ `tests/test_broker_runtime.py:29-31,61`). Các field `rpm/retry/burst/timeout` không xuất hiện trong `broker_runtime.py` → **display-only**. Kill-switch tenant/provider `broker_runtime.py:190,217` chỉ có **2 hit, đều là đọc** — không writer nào (dead code fail-closed).

---

## 4. CONTRADICTIONS

| Nguồn | Thực tế | Tác động |
|---|---|---|
| Ảnh banner "400" tưởng lỗi lúc tải trang | GET luôn 200; 400 chỉ từ POST (3 nhánh, §3.2) | Sửa form validation + error mapping, không sửa GET. |
| FE placeholder `api_key/api_secret` (`SocBrokerPanel.tsx:498`) | `dnse.py:67-70` + migration backfill dùng `client_id/client_secret` | Lưu theo placeholder ⇒ verify `missing_credentials`. |
| `broker.py:526` hứa "poll qua broker/jobs" | `service_ops/urls.py:81-88` không có route | Không thể poll; toast FE vô hạn. |
| `domain_configs/broker.py:77-79` validate purpose lạ | `from_dict()` `:94` lọc thầm lặng trước validate | Apply "thành công" nhưng mất purpose — khác credentials `:458-461`. |
| "Apply xoá kill-switch" (draft đầu) | `broker_runtime.py:190,217` **chỉ đọc**, grep 0 writer; `to_dict()` vốn không xuất 2 key | Hạ mức: rủi ro **tiềm ẩn** + 2 scope đang **dead code**; không phải hành vi quan sát được. |
| `docs/evidence/broker-config/dot2/README.md:18` "keys đủ VI/EN" | 3 key thiếu ở cả 2 locale | Header raw `SOC.BROKER.COL_PROVIDER` như ảnh. |
| Draft đầu: `fast-data-b` in-progress chặn `service_ops/models.py` | `CLAIMS.md:2021` = `done`, `:2026` = close-stale-claims `done`, `:2029` = `released (stale)` | **Refuted** — claim đã đóng; bỏ cảnh báo giả. |
| Draft đầu: "trùng Entry 644" | `ledger:1` + `:11` đều **645**; `:2653` + `:2720` đều **386** | Số kế tiếp đúng là **647** (entry DNSE chuyển 646). |

---

## 5. FINDINGS (sau audit độc lập)

### P0 — blocker

**B-00 — Cấu hình không có hiệu lực runtime** · `data_ingest/tasks.py:2515` (1 consumer hardcoded) · `broker_runtime.py:73-75`, `domain_configs/broker.py:17-21,175-184` (0 consumer) · `broker_runtime.py` grep 0 hit `rpm/retry/burst/timeout`. Staff sửa registry/purpose/rate nhưng luồng chạy vẫn dùng giá trị cứng. **Fix:** slice S2b nối `provider_for_purpose()` vào chọn provider cho backfill/snapshot (thuộc policy vninvest, ADR-006:14-15); nếu chưa nối thì UI phải ghi rõ "chưa có đường chạy".

**B-01 — Default `{}` + không validate ⇒ 400 thô** · `SocBrokerPanel.tsx:137,241-255,310` + `broker.py:455-457` + `transport.js:304-305`. Fix: disable "Lưu" khi rỗng, map error payload sang i18n; **BE phải validate schema key theo provider ở S2** (không chỉ sửa FE).

**B-02 — 3 key i18n thiếu ở cả 2 locale** · `SocBrokerPanel.tsx:315,317,461`; `vi/soc.js:995-1033`, `en/soc.js:995-1033`; `i18n/index.js:41-42`. Fix: thêm key; test render có `LangProvider` + assert **text dịch** (không assert raw key).

**B-03 — Placeholder sai schema** · `SocBrokerPanel.tsx:498` vs `dnse.py:67-70`. Fix: field `client_id/client_secret` theo provider.

**B-18 — Không có cross-consistency purpose ↔ credential ↔ routing** (mới từ reviewer) · `domain_configs/broker.py:128-135` chỉ kiểm purpose có provider enabled + routing_order trùng; `broker.py:458-461` chỉ enum. Staff bật `backfill` cho DNSE dù credential thiếu/chỉ `snapshot` → vẫn "Apply thành công". Fix: validate chéo ở `BrokerConfigPreviewView`/`post` + hiển thị lý do do `needs_verification/stale_reason` (`broker.py:217-233`).

### P1

**B-04 — Trộn 3 concerns, thiếu luồng nghiệp vụ** · dẫn tới B-00; redesign theo §7.1 chỉ có ý nghĩa sau S2b.

**B-05 — Purpose lạ bị lọc thầm lặng** · `domain_configs/broker.py:94` vs `:77-79`. Fix: validate trước lọc, trả 400 như credentials.

**B-08 — Test connection không có quan sát** · `broker.py:526-538` + R6 + `SocBrokerPanel.tsx:274-284`. Fix: endpoint job-status + poll FE.

**B-09 — Ghi credential reset verify không confirm** · `broker.py:462-470`, FE `:240-256`. Fix: confirm overwrite; giữ verify nếu chỉ đổi purposes (owner chốt Q4).

**B-12 — Sai/xoay Fernet key ⇒ `{}` im lặng** · `models.py:1000-1006`. **Thiết kế đã sửa theo reviewer:** **không** đổi `get_secrets()` sang `raise` (sẽ làm `GET /credentials/` 500 và sập cả `Promise.all` `SocBrokerPanel.tsx:164-169`). Dùng cờ `decrypt_failed` trong payload + giữ `get_secrets()` trả `{}` để tab vẫn load.

**B-19 — Kill-switch tenant/provider là dead code fail-closed** (mới) · `broker_runtime.py:132-226` đọc key không ai ghi ⇒ luôn mặc định không chặn. Fix: đưa vào schema+UI (khi đó B-06 "merge thay vì replace" là bắt buộc) hoặc gỡ/ghi rõ chưa hỗ trợ (owner chốt Q5).

**B-20 — Nhãn "Đã xác minh" nói quá** (mới) · `tasks.py:1394-1415` + `dnse.py:62-84`: chỉ test `get_accounts()` read-only, **không kiểm `allowed_purposes`**, rồi gán `is_verified=True`. Fix: đổi nhãn "Đã xác minh tài khoản (read-only)" + test theo từng purpose.

### P2

**B-06 — Apply có thể làm mất key ngoài schema** (hạ mức từ draft: rủi ro tiềm ẩn, hiện 0 writer) · `broker_runtime.py:190,217` vs `domain_configs/broker.py:164-173`. Fix: merge key lạ thay vì replace nếu owner chọn giữ kill-switch (Q5).

**B-07 — Không optimistic concurrency/rollback** · `broker.py:260-286`, FE `:184-189,211-238`; **không** bị claim `fast-data-b` chặn (đã `done/released`).

**B-10 — FE không gate write** (hạ mức) · route `routeCatalog.js:616` + `identity_access/views/helpers.py:151-153` chỉ cấp `admin.operator.read` cho staff/superuser/INTERNAL; BE `IsAdminUser`. Chỉ còn edge-case INTERNAL non-staff gặp 403. Fix: disable form khi `!isStaff`.

**B-11 — Masked preview lộ 4 ký tự đầu, cả audit snapshot** · `models.py:1008-1013`, `broker.py:443,463-464,471-472,504`. Fix: 2 ký tự hoặc `••••`, bỏ preview khỏi snapshot.

**B-13 — Metric sai ngữ nghĩa** · `broker.py:100` cắt 200 rồi `total=len(runs)`; `:109-110` latency chỉ success; `:412` retry là config value; `:75-82,413` queue global nhân bản. Fix: `COUNT(*)`/aggregate DB, đổi nhãn hoặc enforce (Q3).

**B-14 — Chỉ DNSE có test-connection** · `tasks.py:1397-1398`; dropdown FE cho 3 provider. Fix: disable SSI/TCBS kèm nhãn hoặc REQ.

**B-15 — Test xanh giả** · `soc-broker.component.test.tsx:12-14,25-27,71-114`, `LangContext.js:116-121`: mock save/delete/test không assert, assert raw key nhờ fallback. Fix: test có provider + assert handler/payload/error.

**B-16 — `(lỗi N)` hardcoded** · `SocBrokerPanel.tsx:435-436`; đưa vào `brokerWave4.ops.*`.

**B-17 — Audit không atomic & không ghi test-connection** · `broker.py:199-215,284,473,506`, `settings.py:228-238` (không `ATOMIC_REQUESTS`), `tasks.py:1409-1415`. Fix: transaction + ghi sự kiện verify.

---

## 6. QUALITY GATES (trung thực)

| Gate | Kết quả |
|---|---|
| Runtime R1–R6 read-only (có lệnh/timestamp) | ✅ chạy thật; không đọc secret |
| Verify citation trọng yếu + reviewer đối chiếu | ✅ |
| `npx tsc --noEmit` sau **mỗi** sub-step | **CHƯA CHẠY** (doc-only) |
| `npm run build` cuối **mỗi** step | **CHƯA CHẠY** |
| `npm run test` / `test:components` / `check:shell` | **CHƯA CHẠY** |
| `node packages/web/scripts/check-multi-agent.mjs` · `node scripts/check-lessons.mjs` · `node scripts/normalize-eol.mjs` (kèm `git diff --numstat`) | **CHƯA CHẠY** |
| BE pytest trên Postgres riêng (`CORE_DATABASE_URL`, `DJANGO_DEBUG=1`) | **CHƯA CHẠY** |
| `bash scripts/deploy-staging.sh --verify` + E2E/ảnh thật | **CHƯA CHẠY** |
| Sửa source / migration | **KHÔNG** — audit doc-only |

---

## 7. PHƯƠN ÁN NÂNG CẤP (Rev 2 — sau audit độc lập, đã chốt, sẵn sàng triển khai)

### 7.1 Thiết kế lại theo task-oriented (chỉ sau S2b)

1. **Bước 1 — Mục đích:** 3 card `Bù dữ liệu / Chụp snapshot / Tín hiệu`. Hiện provider theo `DEFAULT_PURPOSE_PROVIDER` **kèm nhãn trạng thái runtime**: `backfill` có consumer (`tasks.py:2515`), `snapshot/signal` **chưa có consumer** — không tự động hứa "dùng được".
2. **Bước 2 — Credential:** field theo schema từng provider (`client_id/client_secret` cho DNSE), show/hide, masked preview từ bản đã lưu; **Lưu → Kiểm tra** là 2 bước có trạng thái; badge đổi thành "Đã xác minh tài khoản (read-only)".
3. **Bước 3 — Routing & limits:** bảng 3 dòng, inline validation từ `validation_errors`, preview diff, lý do bắt buộc, `expected_updated_at`, rollback 409/403; **cross-check purpose↔credential↔routing** trước Apply.
4. **Bước 4 — Giám sát & audit:** card chỉ cho provider có dữ liệu; queue ghi "Celery global (toàn hệ thống)"; job "Kiểm tra" có poll; audit timeline lọc `broker_config`, hiện actor/thời gian/diff tóm tắt.

### 7.2 Slice, AC, gate

| Slice | Việc | AC nghiệm thu | Gate |
|---|---|---|---|
| **S1 Quick fixes** | B-01 (FE validation/error map), B-02, B-03, B-10, B-16 | Không default `{}`; lưu disabled khi thiếu key; 3 key VI/EN; placeholder đúng schema; non-staff ẩn form. **Không** assert raw key trong test | `tsc --noEmit`, vitest component có `LangProvider`, `i18n:scan:strict`, `build` |
| **S2 Contract BE** | B-05, B-11, B-12 (`decrypt_failed` flag, **không raise**), B-17 (audit transaction), schema key theo provider | Purpose lạ → 400; secrets key sai → 400 có `error_code`; decrypt fail → payload báo lỗi mà GET vẫn 200; audit thất bại không lưu data | BE test Postgres, `manage.py check`, `makemigrations --check --dry-run` (không tự đặt số) |
| **S2b Runtime wiring + cross-consistency (MỚI, bắt buộc trước S5)** | B-00, B-18, B-19 | `provider_for_purpose()` được gọi từ luồng backfill thay vì hardcode `dnse`; credential purpose không khớp ⇒ Apply 400 + lý do; kill-switch theo owner Q5 (schema+UI hoặc gỡ + nhãn) | BE test fail-before (2 tab/2 purpose), `tsc`, `build` |
| **S3 Observability** | B-08, B-13, B-14, B-20 | Có job-status endpoint + FE poll; metrics `COUNT(*)`/aggregate; SSI/TCBS disable kèm nhãn; badge "xác minh tài khoản (read-only)" | test adapter + component + E2E staging |
| **S4 Concurrency** | B-07, B-09 | `expected_updated_at` + 409 + rollback; confirm rotate; giữ verified khi chỉ đổi purposes (Q4) | test 2 tab, `check-multi-agent`, `check-lessons`, `normalize-eol` |
| **S5 Redesign UI** | §7.1 | 4 bước task-oriented, có nhãn "chưa có runtime", ảnh staging đối chiếu | `check:tokens`, `token-conflict`, `check:contrast`, `check-theme-contrast`, `check:focus-ring`, `dom-landmarks`, `heading-contract`, `i18n:scan:strict`, `check:i18n-hardcoded`, `check-uiux-budget`, `test:visual`, `check-a11y-runtime`, `build` |

**Nguyên tắc:** S1→S2→**S2b**→S3/S4→S5. Không redesign trên nền cấu hình vô hiệu (nếu không lại đúng lời phàn nàn của owner). TDD fail-before mỗi slice; mọi PR thực thi gate tương ứng + `deploy-staging.sh --verify`; ảnh chụp phải mở ra xem (L-V05). Không tự implement broker logic (ADR-006).

### 7.3 Ước lượng

**ƯỚC LƯỢNG** S/M/L (không phải số đo): S1 = S · S2 = M · S2b = M · S3 = M · S4 = M · S5 = L. Quy đổi ngày làm việc khi owner giao.

---

## 8. QUYẾT ĐỊNH CHUYÊN GIA (mặc định áp dụng; owner chỉ phản đối nếu khác)

| # | Quyết định tôi chốt | Lý do / ranh giới |
|---|---|---|
| **D1** | **Nối runtime thật (S2b)** — thay hardcode `('dnse','backfill')` (`tasks.py:2515`) bằng `provider_for_purpose('backfill')`; **fail-closed về DNSE** nếu config thiếu hoặc provider được chọn không có consumer tape. Không chỉ ghi nhãn. | Đây là lời phàn nàn cốt lõi của owner: cấu hình mà không có hiệu lực thì redesign chỉ làm đẹp banner. Vẫn an toàn vì DNSE là provider duy nhất có tape (`vnbroker_dnse_compat.py`). |
| **D2** | `snapshot/signal`: **giữ trong registry nhưng disable chọn làm mục tiêu chạy + gắn nhãn "chưa có đường chạy"**. **Không mở REQ mới lúc này** — REQ-003b (watchlist) đang mở và DNSE không có API market-wide (`REQUESTS_TO_VNBROKER_20261014.md:28-37,61`). | Tránh hứa năng lực không có; không mở rộng phạm vi vô ích. |
| **D3** | `rpm/retry/burst/timeout`: **không enforce trong đợt này**; đổi nhãn thành "thông số dự kiến (chưa enforce)" + đưa backlog. Giữ nguyên `rate_limit='20/m'` phía Celery cho DNSE backfill. | Enforce HTTP retry/rate-limit ở vninvest là vi phạm ADR-006:8-11; nếu làm sau thì policy ở `broker_runtime.py`, protocol ở vnbroker và mở REQ riêng. |
| **D4** | **Giữ `is_verified` khi chỉ đổi `allowed_purposes`**; chỉ reset khi rotate secrets. Badge đổi thành "Đã xác minh tài khoản (read-only)" và verification là **account-level**, không phải purpose-level (B-20). | Verify dùng `get_accounts()` (`dnse.py:71-84`) không kiểm purpose — reset verify khi đổi purpose là sai ngữ nghĩa và làm mất trạng thái thật. |
| **D5** | Kill-switch tenant/provider (`broker_runtime.py:190,217`): **không đưa vào UI đợt này**; `to_dict()`/apply **merge giữ key lạ** (B-06), ghi chú trong schema "reserved, chưa hỗ trợ". | Hiện 0 writer → dead code; merge rẻ, tránh mất dữ liệu nếu sau này có writer; không mở diện tích UI mới. |
| **D6** | Backlog Celery ~10,5k: **tách ticket vận hành riêng**; trong trang chỉ đổi nhãn "Hàng đợi Celery (toàn hệ thống)" + cảnh báo ngưỡng, **không** đưa vào slice broker. | Số này là global (`broker.py:52,75-82`), không phải lỗi của trang quản trị broker; gộp vào sẽ làm slice mất tiêu điểm. |

**Hệ quả thực thi:** không còn gate chờ phê duyệt. Coordinator có thể khai claim S1 ngay theo thứ tự S1 → S2 → S2b → S3/S4 → S5. Owner chỉ cần nói "đổi D-x" nếu muốn khác; mọi thay đổi sau đó đi qua re-audit như thường.

---

## 9. AUDIT ĐỘC LẬP (bắt buộc trước phê duyệt)

**Reviewer:** agent độc lập (fresh context, Staff+), read-only, ngày 2026-11-26.
**VERDICT trên draft đầu:** **NEED_REVISION** — citation phần lớn đúng, nhưng 3 nhóm lỗi làm thay đổi kết luận: (a) số/citation sai; (b) **lỗi phạm vi**: bản chất là runtime gần như không tiêu thụ config nhưng draft xếp B-04 là P1 phụ và chỉ redesign giao diện; (c) thiếu AC/gate + §9 trống.

### 9.1 Refutations đã xử lý

| Draft đầu | Refutation của reviewer | Đã sửa ở bản này |
|---|---|---|
| "trùng Entry 644" (draft đầu) | Thực tế trùng là **645** (`ledger:1/:11`) + 386 (`:2653/:2720`) | Báo cáo này dùng **Entry 647**; entry DNSE đã đổi sang 646 |
| "9 route" / "13 state" | `urls.py:81-88` = **8**; `SocBrokerPanel.tsx:123-139` = **14** useState | §2 đã sửa |
| "`fast-data-b` chặn `models.py`" | `CLAIMS.md:2021` done, `:2026` done, `:2029` released | §4 + B-07 bỏ cảnh báo giả |
| "Apply xoá kill-switch" | 0 writer, 2 hit đều đọc → rủi ro tiềm ẩn + dead code | Hạ B-06 xuống P2, thêm B-19 |
| `provider_for_purpose` 0 consumer chỉ nêu ở §3 | Phải là **P0 blocker** và có slice riêng | Thêm **B-00** + slice **S2b** |
| Draft §7.1 dùng `DEFAULT_PURPOSE_PROVIDER` như thể runtime dùng | Hằng số 0 consumer production | Bước 1 gắn nhãn "chưa có runtime" |
| Giá trị 10.486 / 7 fail như hằng số | Số đổi theo thời gian (reviewer đo 10.583 / 6 fail) | §1 gắn timestamp + lệnh lặp |
| "400 chỉ từ secrets rỗng" | Có 3 nhánh 400 (`broker.py:452-461`) | §3.2 liệt kê cả 3 |
| B-12 đề xuất `raise` | Sẽ làm GET 500 + sập `Promise.all` | Đổi thành cờ `decrypt_failed` |
| B-10 P1 | Route đã gate staff | Hạ P2, chỉ edge-case INTERNAL |
| Gate S1–S5 thiếu `tsc`/build mỗi step, multi-agent, lessons, normalize-eol, fail-before, deploy --verify | Reviewer yêu cầu bổ sung | §6 + §7.2 bổ sung đầy đủ |
| §9 trống | Phải điền trước phê duyệt | Đang điền tại đây |

### 9.2 Finding mới từ reviewer (đã đưa vào §5)

- **N-01 → B-00** (P0): runtime tiêu thụ config gần như bằng 0.
- **N-02 → B-18** (P0): thiếu cross-consistency purpose↔credential↔routing.
- **N-03 → B-19** (P1): kill-switch tenant/provider dead code fail-closed.
- **N-04 → B-20** (P1): nhãn "Đã xác minh" nói quá (read-only, không kiểm purpose).
- **N-05**: số Entry kế tiếp = 647 (đã áp dụng).

### 9.3 Đánh giá §7 theo 5 tiêu chí (sau sửa)

| Tiêu chí | Trước | Sau sửa |
|---|---|---|
| Đúng ADR | Đúng một phần | Đã nêu rõ ranh giới policy (vninvest) vs protocol (vnbroker) + yêu cầu mở REQ nếu vượt (§0.4, Q3) |
| Khả thi | CHƯA | Có S2b nối runtime; bỏ claim stale giả; Bước 1 không dùng hằng số ảo |
| Đủ AC | CHƯA | Bổ AC cho runtime wiring, cross-check, secrets schema, decrypt flag, nhãn verify, kill-switch |
| Đủ gate | CHƯA | §6 + §7.2 đầy đủ theo AGENTS.md/skill UI |
| Thứ tự | Gần đúng, thiếu 1 slice | S1→S2→**S2b**→S3/S4→S5 |

### 9.4 Kết luận sau revision

Các refutation **đã được sửa trong bản này**. Chuyên gia đã chốt D1–D6 ở §8 thay vì hỏi ngược owner — báo cáo **sẵn sàng triển khai**, owner chỉ phản đối nếu muốn khác. Reviewer không đọc/ghi file; mọi thay đổi do session chính thực hiện và tự verify bằng `grep/read`. **Không có slice nào được triển khai** — trạng thái vẫn là doc-only.

---

## 10. NEXT STEPS / OWNER

1. Coordinator khai claim **S1** ngay theo `docs/AGENT_PROTOCOL.md` (không commit thẳng `dev`); D1–D6 là mặc định đã chốt, không chờ hỏi lại.
2. Thứ tự: S1 → S2 → **S2b (nối runtime)** → S3/S4 → S5. Mỗi slice: TDD fail-before → gate §6 → re-audit độc lập → PR → `bash scripts/deploy-staging.sh --verify` → ảnh thật (L-V05: mở ảnh ra xem).
3. Trước mỗi commit kiểm `grep '^## Entry' docs/CODE_CHANGE_AUDIT_LEDGER.md` rồi append Entry kế tiếp (báo cáo này đã là 647; DNSE là 646).
4. Chỉ mở `VNBROKER-REQ` nếu sau này quyết định enforce throttle/retry ở tầng protocol (D3) — hiện **không** mở.
