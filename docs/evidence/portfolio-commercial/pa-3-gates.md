# PA-3 — Broker egress allowlist (P1-SEC-01) + adapter lifecycle fail-closed (P1-AUTH-01)

- **Agent:** `pf3-brokerhub` · **Branch:** `feat/pf3-brokerhub` · **Worktree:** `C:\Mujoco Projects\pf3-brokerhub`
- **DB:** `ag_pf3_brokerhub` (`postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf3_brokerhub`)
- **Nguồn:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §C-04, §D2 `P1-SEC-01`, §D2 `P1-AUTH-01`, §E3
- **Ngày:** 2026-09-26 · **Migration:** KHÔNG tạo (`makemigrations --check` sạch)

> **KHÔNG TỒN TẠI:** `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` được yêu cầu đọc
> ở §2/§9 — kiểm cả worktree lẫn main tree `C:\Mujoco Projects\vninvest`, file **không tồn tại**
> (`Get-ChildItem -Recurse -Filter "*VERIFICATION*"` chỉ trả về 6 file khác, không có file này).
> Báo cáo này dựa trên `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` (có thật, đã đọc trực tiếp).

---

## 1. Môi trường — `vnbroker` KHÔNG cài được

```powershell
cd C:\Mujoco Projects\pf3-brokerhub\packages\core\backend
python -c "import vnbroker"
# ModuleNotFoundError: No module named 'vnbroker'   → exit 1
```

`vnbroker` là package **private, editable install** trỏ `C:\Mujoco Projects\vnbrokder`
(thư mục **không tồn tại** trên đĩa). Hệ quả trực tiếp:

1. **Không đọc được body thư viện** ⇒ mọi lời gọi lifecycle dùng **capability detection**
   (`callable(getattr(client, 'authenticate', None))` + `inspect.signature`) thay vì đoán API.
2. **Mọi test phải mock client.** Đã đạt: 60/60 test xanh mà không cần `vnbroker`.
3. `test_broker_retail.py` có **3 error `ModuleNotFoundError: vnbroker` PRE-EXISTING** — xác nhận
   ở trên, không do slice này, không sửa.

---

## 2. Bằng chứng ĐỎ trước khi sửa

Cách thực hiện (không phải "nhớ từ trí nhớ"): `git checkout` 4 file nguồn về HEAD, xoá
`egress.py`, **giữ nguyên test mới**, chạy lại. Bộ test cuối cùng ⇒ **21/23 đỏ**.

```
$ python manage.py test user_workspace.test_broker_egress user_workspace.test_broker_adapter_lifecycle -v 1
ERROR: test_broker_egress (unittest.loader._FailedTest.test_broker_egress)
ERROR: test_client_cache_keyed_by_credential_fingerprint (…SsiAuthRequiredTests…)
ERROR: test_explicit_authenticate_is_idempotent (…SsiAuthRequiredTests…)
ERROR: test_close_error_does_not_break_previous_read_result (…SsiCloseLifecycleTests…)
ERROR: test_close_is_idempotent (…SsiCloseLifecycleTests…)
ERROR: test_close_releases_cached_client (…SsiCloseLifecycleTests…)
ERROR: test_close_without_session_is_noop (…SsiCloseLifecycleTests…)
ERROR: test_context_manager_closes_session (…SsiCloseLifecycleTests…)
ERROR: test_refresh_opens_session_when_none (…SsiCloseLifecycleTests…)
ERROR: test_refresh_reauthenticates_open_session (…SsiCloseLifecycleTests…)
ERROR: test_refresh_without_capability_fails_closed (…SsiCloseLifecycleTests…)
ERROR: test_authenticate_without_otp_fails_closed (…TcbsUnverifiedTests…)
ERROR: test_connection_status_never_leaks_secret (…TcbsUnverifiedTests…)
ERROR: test_connection_status_survives_missing_lane (…TcbsUnverifiedTests…)
ERROR: test_otp_authenticates_and_marks_connected (…TcbsUnverifiedTests…)
ERROR: test_reads_never_mark_connected (…TcbsUnverifiedTests…)
ERROR: test_status_unverified_before_otp (…TcbsUnverifiedTests…)
ERROR: test_token_valid_flag_upgrades_status (…TcbsUnverifiedTests…)
FAIL: test_authenticate_called_once_across_many_reads (…SsiAuthRequiredTests…)
FAIL: test_client_without_authenticate_raises_and_never_reads (…SsiAuthRequiredTests…)
FAIL: test_read_client_is_cached (…TcbsUnverifiedTests…)
Ran 23 tests in 0.012s
FAILED (failures=3, errors=18)
```

Traceback tiêu biểu (nguyên văn từ output):

```
ModuleNotFoundError: No module named 'user_workspace.broker.egress'
AttributeError: 'SsiBrokerAdapter' object has no attribute 'authenticate'
AttributeError: 'SsiBrokerAdapter' object has no attribute 'close'
AttributeError: 'SsiBrokerAdapter' object has no attribute 'refresh'
AssertionError: 4 != 1 : client phải được cache, không tạo mới mỗi read
AssertionError: BrokerAdapterError not raised
AssertionError: 4 != 1 : TCBS cũng phải cache client (X.8)
```

`4 != 1` là bằng chứng X.8 của audit: **4 lệnh read ⇒ 4 client**, token không được cache,
connection không được giải phóng.

> `Ran 23` chứ không phải 60 vì `test_broker_egress` hỏng lúc **collection** (chưa có module
> `egress`) nên test runner không nạp được 37 test của file đó. Sau fix: `Ran 60 … OK`.

---

## 3. Gate PASS (chạy thật)

| # | Lệnh | Kết quả |
|---|---|---|
| 1 | `python manage.py check` | `System check identified no issues (0 silenced).` — **exit 0** |
| 2 | `python manage.py makemigrations --check --dry-run` | `No changes detected` — **exit 0** |
| 3 | `python manage.py test user_workspace.test_broker_egress user_workspace.test_broker_adapter_lifecycle -v 2` | **`Ran 60 tests … OK`** |
| 4 | `python manage.py test user_workspace.test_broker_adapters user_workspace.test_vnbroker_broker_signatures -v 1` | **`Ran 13 tests … OK (skipped=2)`** — y hệt baseline trước slice |
| 5 | `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS` — **exit 0** |
| 6 (thêm) | `python manage.py test user_workspace.test_broker_config_api user_workspace.test_user_broker_config -v 1` | **`Ran 24 tests … OK`** |

**Gate CHƯA CHẠY (không ghi PASS):**

| Lệnh | Lý do |
|---|---|
| `test_vnbroker_broker_signatures.LiveBrokerContractTests` (2 test) | `skipUnless(VNBROKER_RUN_LIVE_CONTRACT=1)`; cần `vnbroker` thật — **CHƯA CHẠY** (skip cả trước và sau) |
| `python manage.py test user_workspace.test_broker_retail` | `Ran 5 … FAILED (errors=3)` — **3 error `ModuleNotFoundError: vnbroker` PRE-EXISTING**, không phải việc của slice này |
| Probe mạng thật tới `openapi.tcbs.com.vn` / `fc-tradeapi.ssi.com.vn` | **CỐ Ý KHÔNG CHẠY** — cần credential thật, và nằm ngoài phạm vi |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | **KHÔNG ÁP DỤNG** — slice này không sửa file `packages/web/**` nào |

Cảnh báo (không chặn) của `check-multi-agent` về file "chưa tồn tại" ở claim của mình đã tự
giải quyết khi commit: 3 file mới + file evidence đã được tạo và commit.

---

## 4. AC → bằng chứng

| AC | Yêu cầu | Test | Kết quả |
|---|---|---|---|
| **AC-1** | `http://evil.example.com` ⇒ từ chối, **không dựng client** | `BaseUrlSchemeTests.test_plain_http_external_rejected` + `AdapterAppliesValidatorTests.test_bad_base_url_blocks_client_construction` (assert `factory.assert_not_called()`) | PASS |
| **AC-2** | `http://169.254.169.254/latest/meta-data/` ⇒ từ chối | `MetadataAndIpLiteralTests.test_cloud_metadata_http_rejected` + `test_cloud_metadata_https_rejected` (code `broker_egress_private_address_blocked`) | PASS |
| **AC-3** | `https://evil-tcbs.com.vn.attacker.net` ⇒ từ chối | `HostAllowlistTests.test_suffix_lookalike_rejected` — 5 biến thể, gồm `openapi.tcbs.com.vn.attacker.net`, `not-openapi.tcbs.com.vn`, `xopenapi.tcbs.com.vn` | PASS |
| **AC-4** | `https://127.0.0.1` ⇒ từ chối trừ khi cấu hình tường minh | `test_loopback_literal_rejected` (127.0.0.1 / :8443 / `[::1]` / localhost) + `test_private_allowed_only_with_explicit_env` + `test_http_loopback_allowed_only_with_explicit_env` | PASS |
| **AC-5** | host trong allowlist provider ⇒ nhận | `test_production_host_accepted` (tcbs/ssi/dnse) + `test_sibling_provider_hosts_accepted` (`fc-tradehub.ssi.com.vn`) + `AdapterAppliesValidatorTests.test_allowlisted_base_url_reaches_client` (assert kwarg thật) | PASS |
| **AC-6** | `base_url` rỗng ⇒ default provider, không lỗi | `DefaultBaseUrlTests.test_empty_uses_provider_default` (`None`/`''`/`'   '`) + `test_blank_base_url_omits_kwarg_so_client_uses_own_default` | PASS |
| **AC-7** | `validate_secrets()` sai ⇒ code, **không echo** giá trị | `test_validate_secrets_rejects_bad_base_url_with_code` (assert `'attacker' not in message`, `'tcbs.com.vn' not in message`) + `test_validate_secrets_rejects_metadata_endpoint` (assert `'169.254' not in message`) + `test_test_connection_does_not_silently_fall_back_to_default` | PASS |
| **AC-8** | SSI client **không** có `authenticate` ⇒ `BrokerAdapterError`, **không** gọi read | `test_client_without_authenticate_raises_and_never_reads` (assert `read_calls == []`) | PASS |
| **AC-9** | `authenticate` **đúng 1 lần** cho nhiều read, không tạo client mới | `test_authenticate_called_once_across_many_reads` (4 read, `len(created) == 1`, `authenticate_calls == 1`) + `test_explicit_authenticate_is_idempotent` | PASS |
| **AC-10** | TCBS chưa OTP ⇒ `unverified`, **không** `connected` | `test_status_unverified_before_otp` + `test_reads_never_mark_connected` (đọc xong vẫn `connected == False`) + `test_otp_authenticates_and_marks_connected` (có OTP mới `connected`) | PASS |
| **AC-11** | `close()` khi session kết thúc; lỗi `close()` không hỏng read | `test_close_releases_cached_client` + `test_close_error_does_not_break_previous_read_result` (client `close()` raise `RuntimeError` ⇒ nuốt + log, read trước đó vẫn trả về) + `test_context_manager_closes_session` | PASS |
| **AC-12** | Test chạy được **không cần** `vnbroker` | §1: `import vnbroker` → `ModuleNotFoundError`, nhưng `Ran 60 tests … OK` | PASS |

**12/12 AC PASS.** (AC-12 đạt bằng mock 100%, không cần đánh đổi gì.)

---

## 5. C-04 — capability matrix versioned (deliverable cho coordinator)

Dữ liệu đặt trong `packages/core/backend/src/user_workspace/broker/base.py` (file trong allowlist):

- `CAPABILITY_MATRIX_VERSION = '2026-09-26.1'`
- `PROVIDER_CAPABILITIES` — mỗi provider có `read_basic` / `read_positions` / `read_orders` /
  `trade` / `otp_required` / `verified_contract` / `verified_contract_by`
- `capability_matrix()` → `{'version': …, 'providers': {…}}` (trả **copy**, caller không sửa được data)
- `is_fully_supported(provider)` → `True` **chỉ `dnse`**
- `providers_pending_capability_review()` → `['ssi', 'tcbs']`

**`views_broker.py` KHÔNG được sửa** (ngoài phạm vi, đang là deny list) ⇒ **coordinator phải nối**:

```python
# packages/core/backend/src/user_workspace/views_broker.py
from .broker.base import providers_pending_capability_review
FULLY_SUPPORTED = frozenset(SUPPORTED_PROVIDERS) - frozenset(providers_pending_capability_review())
```

Không có file mới nào ngoài allowlist — matrix nằm trong `base.py` nên **không cần xin duyệt thêm**.

---

## 6. Rủi ro còn lại (trung thực)

1. **`vnbroker` không cài ⇒ contract thật chưa verify.** `LiveBrokerContractTests` vẫn skip.
   Tên method `authenticate(otp=…)` / `refresh()` / `close()` / `is_token_valid` là **giả định
   dựa trên docstring trong repo** (`broker/tcbs.py:3-8`, `broker/ssi.py:3-6`). Vì vậy mọi lời gọi
   đều capability-detect: thiếu ⇒ raise `BrokerAdapterError` có `code`, **không** gọi mù.
   *Rủi ro còn lại:* nếu client thật có `refresh` **bắt buộc tham số** (ví dụ `refresh(token)`),
   `refresh()` sẽ raise `broker_client_refresh_unsupported` — thay vì refresh sai. Đây là
   fail-closed có code, chấp nhận được, nhưng cần probe live để chốt.
2. **TCBS read path vẫn chạy khi chưa OTP.** Read-only không chặn cứng để giữ hợp đồng với
   `test_broker_adapters.py:114-137` (file ngoài phạm vi, 4 lệnh read không OTP). Đổi lại:
   `connection_status()` **luôn** trả `unverified` trước khi có token ⇒ UI không thể nhầm là
   `connected`. Chặn cứng trade phải làm ở tầng khác (chưa có trong slice này).
3. **Chưa có egress firewall ở tầng hạ tầng.** Allowlist này chặn ở tầng app; DNS rebinding và
   việc endpoint đã allowlist bị chiếm quyền DNS vẫn nằm ngoài tầm. Audit §D2 cũng yêu cầu
   "egress firewall" — việc đó thuộc hạ tầng (`docker-compose*.yml` là deny list).
4. **Allowlist chỉ có production.** Tài liệu chính thức không nêu sandbox của cả 3 provider
   (đã đọc `developers.tcbs.com.vn/docs/v1.0.0/auth/token/` — chỉ có prod
   `https://openapi.tcbs.com.vn`) ⇒ **không đoán**, phải khai báo qua env.
5. **Env là điểm mở rộng duy nhất** — ai có quyền set env deploy đều thêm được host. Đó là
   chủ ý (server-side config), nhưng phải audit quyền deploy.

### Biến env (server-side, không có đường client nào thêm host sau deploy)

| Env | Tác dụng | Mặc định |
|---|---|---|
| `BROKER_EGRESS_EXTRA_HOSTS` | thêm host, format `provider:host,provider2:host2` | rỗng (chỉ dùng allowlist mặc định) |
| `BROKER_EGRESS_ALLOW_PRIVATE_IPS` | cho phép IP private/loopback (sandbox nội bộ) | **tắt** |
| `BROKER_EGRESS_ALLOW_HTTP_LOOPBACK` | cho phép `http://` tới loopback | **tắt** |

Host khai báo qua env **vẫn** phải qua kiểm scheme + IP ⇒ thêm host không mở lại metadata endpoint
(`test_ip_literal_never_reaches_host_allowlist`).

---

## 7. Việc phát hiện NHƯNG KHÔNG tự sửa (ngoài phạm vi)

| # | Phát hiện | Vì sao không sửa |
|---|---|---|
| O-1 | `views_broker.py:31-32` `FULLY_SUPPORTED` chứa cả 3 provider trong khi `tcbs` cần OTP, `ssi` mới market-only (C-04) | file trong **deny list**; đã chuẩn bị matrix + 1 dòng code để coordinator nối (§5) |
| O-2 | `views_broker.py:30` `SUPPORTED_PROVIDERS` và `FULLY_SUPPORTED` là 2 hằng trùng nhau — dùng 1 là đủ | ngoài phạm vi |
| O-3 | `base.py` mô tả `base_url` là non-secret, giữ nguyên trong preview. **Non-secret ≠ tin cậy** — đã ghi chú ngay tại `base.py:9-11` nhưng `mask_secrets_preview` vẫn trả nguyên giá trị `base_url` cho client (lộ host nội bộ qua API, không lộ khoá) | sửa cần chính sách mới cho preview + test FE; đã ghi chú để coordinator quyết |
| O-4 | `views_broker.py:139-142` lưu đúng field trong schema, nhưng `UserBrokerConfig.set_secrets` (models.py:517-520) nhận JSON **tự do** — nếu có đường nào khác ghi thẳng thì `api_url`/`stream_url` có thể lọt. Đã phòng thủ ở `broker/ssi.py` (`ENDPOINT_FIELDS`) | `models.py` trong deny list |
| O-5 | `P1-AUTH-02` (audit §D2): chưa có phân quyền `broker.connect` / `broker.sync` / `order.live`; `views_dnse.py` chỉ `IsAuthenticated` | ngoài phạm vi hoàn toàn |
| O-6 | `test_broker_retail.py` 3 error `ModuleNotFoundError: vnbroker` | pre-existing, đã xác nhận, không phải việc của slice này |
| O-7 | `tasks.py:300-303` map `unverified` → `StatusChoices.UNVERIFIED` — **đã khớp** với `connection_status()` mới, không cần sửa | — |
