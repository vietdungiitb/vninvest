# Đề xuất: Quản lý cấu hình Broker (SSI/TCBS/DNSE) — Mức người dùng + Mức hệ thống

- **Ngày**: 2026-09-23 — Trạng thái: **chờ phê duyệt** — Phạm vi: **chỉ cấu hình** (chưa trade/sync/realtime)
- **Cơ sở**: `docs/AUDIT_BROKER_MANAGEMENT_20260923.md` (F3–F5) +
  `docs/IMPLEMENTATION_PLAN_BROKER_MANAGEMENT_20260923.md` (toàn cảnh Broker Hub)
- **Lý do tách pha**: các tính năng hệ thống sắp tới (backfill dùng chung, snapshot thị trường,
  cảnh báo, job nền) đều cần provider SSI/TCBS/DNSE — phải có **registry + credential hệ thống**
  trước khi các pha trade/sync dùng tới. Mức người dùng cần **một nơi cấu hình duy nhất**
  thay vì 2 store DNSE song song như hiện nay.

## 1. Hiện trạng & khoảng trống (3 dòng)

- User có **2 store DNSE song song**: `user_workspace.DNSECredential` (trade/sync đọc,
  `views_dnse.py:49,118`) và `identity_access.UserDNSECredential` (D02-backfill, `urls.py:68`) —
  dễ "lưu nơi này, báo thiếu nơi kia" (Audit F4).
- Hệ thống **chưa có registry brokerage**: SOC chỉ quản market-data providers
  (`service_ops/views/vnbroker.py:4-10`, 9 routes `urls.py:48-56`); system credential DNSE
  nằm nhờ trong credential của admin staff (`get_system_provider_credentials()`,
  `identity_access/models.py:943-960`) — không tường minh, không audit, không hỗ trợ SSI/TCBS.
- vnbroker quy định credential qua **env** (`VNBROKER_BROKER_SSI_*`, `VNBROKER_BROKER_TCBS_*`,
  `DNSE_*`), còn app cần quản **runtime qua DB/UI** — thiếu lớp ánh xạ env↔DB↔UI.

## 2. Nguyên tắc thiết kế (kế thừa, không phát minh lại)

- **P1**: Mọi secret Fernet at-rest, response chỉ trả preview `****` (mẫu `dnse_credential_views.py:93-97`),
  không log secret (mẫu `broker/security/redaction.py` + `TCBSAuthService`, `broker/tcbs/auth.py:5-7`).
- **P2**: Secret không qua Celery args — task chỉ nhận id (mẫu `identity_access/models.py:886-891`).
- **P3**: Config đổi phải có preview + before/after snapshot + audit (mẫu `SocConfigPreviewModal`,
  `service_ops/models.py:344-347`, `SocVnbrokerPanel.tsx:58-73` adapter pattern).
- **P4**: Schema typed có `validate()/to_dict()/from_dict()` (mẫu `domain_configs/vnbroker.py:36-232`).
- **P5**: Catalog provider có `credential_mode` + `required_runtime_envs` (mẫu `provider_catalog.py:9-37`).
- **P6**: Chuẩn repo: glassmorphism/SOC tokens, LangContext i18n full VI/EN, `tsc`+`build` xanh mỗi sub-step,
  `i18n:scan` 0, test mới cho mọi endpoint.

## 3. Mức 1 — Cấu hình cho người dùng thông thường

### 3.1 Model `UserBrokerConfig` (mới, gộp 2 store DNSE)

```python
# user_workspace/models.py (mới)
class UserBrokerConfig(models.Model):
    user = FK(User, related_name='broker_configs')
    provider = CharField(choices=[dnse, ssi, tcbs])   # mở rộng sau không sửa schema
    label = CharField()                                # "TK SSI chính"
    secrets_cipher = JSONField(default=dict)           # Fernet toàn bộ secret theo schema §5
    prefs = JSONField(default=dict)                    # default_account, sync_enabled, notify_on...
    status = CharField(choices=[never_connected, connected, expired, error])
    last_verified_at / last_error / created_at / updated_at
    class Meta: unique_together = [('user', 'provider', 'label')]
```

- Migration dữ liệu: copy `user_workspace.DNSECredential` → provider `dnse`/label `Mặc định`;
  copy `identity_access.UserDNSECredential(is_system_provider=False)` tương tự; giữ bảng cũ
  read-only 1 release (alias GET cũ vẫn trả từ store mới) rồi drop.
- Vì sao JSON secrets thay vì cột riêng: 3 broker có tập field khác nhau (§5); validate bằng
  schema registry phía BE (P4), FE render form động từ `GET broker/config-schema/<provider>/`.

### 3.2 Schema & validation theo provider (§5 chi tiết)

- Mỗi provider có `BrokerConfigSchema`: danh sách field `{key, label_i18n, type, required, secret,
  placeholder, validate_regex, help_i18n}` + `test_connection()` read-only
  (DNSE: `get_accounts`; SSI: `authenticate()` market-only không OTP; TCBS: **chưa test được nếu thiếu OTP**
  → cho lưu `unverified` + verify sau khi có OTP).
- BE validate trước khi lưu; FE disable nút Lưu khi thiếu required; lỗi trả theo field.

### 3.3 API (mở rộng `user_workspace/urls.py:77-85`, giữ route cũ alias)

| Method/Path | Chức năng |
|---|---|
| `GET /api/broker/providers/` | Danh sách 3 broker + `credential_mode` + trạng thái đã nối của user |
| `GET /api/broker/config-schema/<provider>/` | Schema form động (§3.1) |
| `GET/POST/DELETE /api/broker/<provider>/config/` | CRUD config user (POST validate + lưu Fernet, không trả secret) |
| `POST /api/broker/<provider>/test-connection/` | Kiểm tra read-only, cập nhật `status/last_verified_at/last_error`, **không** tạo phiên trade |
| `GET /api/broker/<provider>/status/` | Trạng thái + preview + TTL phiên (gộp `token-status` DNSE hiện tại, `views_dnse.py:319-338`) |

- Auth: `IsAuthenticated`; trade-phases sau sẽ thêm plan-gate (không làm ở pha config).
- Test-connection của SSI/TCBS/DNSE **chạy trong Celery** (rút kinh nghiệm Audit F1 — không I/O broker
  trong request), FE polling `GET broker/jobs/<id>/` (pattern DataOps Run Logs).

### 3.4 FE — Khối "Môi giới" trong Cài đặt + nền Broker Hub

- Gộp `DNSECredentialsSection.tsx` (Settings `:253`) + `DNSEConnectionPanel.js` (Portfolios `:103-104`)
  thành một khối **Môi giới**: tiles 3 broker (logo/trạng thái/kết nối) → form động từ schema →
  nút Kiểm tra kết nối (spinner + kết quả) → Xóa/ngắt.
- Sửa nợ: full i18n `broker.*` (~40 keys VI/EN, sửa hardcode VI của panel DNSE),
  gộp adapter thành `adapters/core/broker.js` (hết xé lẻ `dnse.js` vs `workspace.js:319,352,363`),
  SOC tokens/glass cho khối mới.
- Khối này là **nền cắm** cho Broker Hub (Account Manager/Order Ticket ở pha trade) — API/status
  tái dùng nguyên, không đập đi.

## 4. Mức 2 — Cấu hình hệ thống (quản trị)

### 4.1 `BrokerProviderRegistry` (mới, học `VnbrokerDomainConfig`)

```python
# service_ops/domain_configs/broker.py (mới, mẫu domain_configs/vnbroker.py:126-232)
@dataclass
class BrokerProviderEntry:   # mỗi provider dnse/ssi/tcbs
    enabled: bool = True
    routing_order: int = 0               # thứ tự ưu tiên khi system cần chọn provider
    timeout: {connect, read}             # khung VnbrokerTimeoutConfig (connect 1-60s, read 5-300s)
    max_retries: int (0-10)
    requests_per_minute / burst_limit    # chống rate-limit upstream
    purpose_allowlist: [backfill, snapshot, signal, notify]  # provider này được dùng cho việc gì
@dataclass
class BrokerSystemConfig:
    entries: dict[provider, BrokerProviderEntry]
    kill_switch_write: bool = False      # ngắt mọi write hệ thống khi sự cố
    quiet_hours: {start, end}            # chỉ job nền chạy ngoài phiên
    validate(): kiểm tra enabled ≥1 cho mỗi purpose, timeout trong khung, routing_order không trùng
```

- Lưu DB versioned (1 active row như `VnbrokerRuntimeConfig`, `market_data/models.py:96-132`) +
  audit before/after (`service_ops/models.py:344-347`).
- Ánh xạ xuống vnbroker runtime: `timeout→REQUEST_TIMEOUT`, `requests_per_minute→RATE_LIMIT_RPM`,
  `routing_order→PRIMARY_SOURCE_POOLS` (`source_router.py:42`), retry→`RETRIES/BACKOFF_*`
  (`vnbroker/config.py:10-19`) — qua adapter tập trung, không set env lẻ tẻ.

### 4.2 `SystemBrokerCredential` (mới, học `UserDNSECredential:882-927`)

- `provider` unique (1 credential hệ thống/broker — học constraint `unique_active_system_provider`,
  `models.py:917-923`), `secrets_cipher` Fernet, `is_verified/last_verified_at`,
  `allowed_purposes` (VD: DNSE-system chỉ `backfill`, SSI-system chỉ `snapshot` market-only không OTP).
- **Staff-only tuyệt đối** (học `models.py:886-891`: chỉ `is_staff` set; enforce ở view + test).
- Thay thế `get_system_provider_credentials()` (nhờ credential admin, `models.py:943-960`) bằng
  đọc tường minh từ bảng này; task backfill abort khi thiếu (giữ hành vi cũ).

### 4.3 SOC tab "Broker" (mới, học `SocVnbrokerPanel.tsx:1-90`)

- Card cấu hình registry (§4.1) + Preview modal + Apply + audit list + CSV export.
- Card system credentials: trạng thái verified/mask preview/test-connection/rotate (không hiện secret).
- Card providers health: latency, tỉ lệ lỗi, circuit-breaker, queue jobs broker (tái dùng pattern
  health+providers+benchmark+circuit-breaker của panel vnbroker, `:39-73`).
- Card kill-switch + quiet-hours (xác nhận 2 lớp `useConfirm`).
- Staff-only theo abilities (`helpers.py:152-162` mở rộng thêm `BrokerOps` subjects).

### 4.4 Mapping purpose → provider (quyết dùng, để pha sau khỏi tranh cãi)

| Purpose hệ thống | Provider đề xuất | Vì sao |
|---|---|---|
| Backfill tape dùng chung | DNSE system | Đã chạy (`tasks.py` backfill), LightSpeed ổn định |
| Snapshot/thị trường dùng chung | SSI system (market-only, **không OTP**) | Không tốn OTP, OHLC 8 timeframe + master trần/sàn (`broker/ssi/client.py:663-729`) |
| Dự phòng market-data | TCBS system | iFlash public endpoints |
| Cảnh báo/notify | Không gọi broker trực tiếp | Qua nội bộ (tín hiệu đã materialize) |

## 5. Ma trận field cấu hình theo provider (duy nhất — FE/BE cùng đọc)

| Field | DNSE | SSI | TCBS | Secret? | Validate |
|---|---|---|---|---|---|
| `client_id`/`api_key` | `client_id` (LightSpeed) | `api_key` (bắt buộc cả market-only) + `client_id` (cần cho balance/positions) | `api_key` | Có | required, không whitespace |
| `client_secret`/`api_secret` | `client_secret` | `api_secret` (bắt buộc) | — | Có | required |
| `private_key` (RSA ký lệnh) | — | optional ở bước config; **bắt buộc khi bật trade** | — | Có | PEM format khi trade |
| `custody_code` | — | — | optional (`105C...`) | Không | regex khi nhập |
| `base_url` override | — (cố định LightSpeed) | `api_url` default `https://api.ssi.com.vn` | `base_url` default iFlash | Không | URL khi nhập |
| `device_id` | — | default `A1:B2:C3:D4:E5:F6` (cho sửa) | — | Không | MAC format |
| `timeout_seconds` / `rate_limit` | dùng registry §4.1 | default 60s / 10 rps (`credentials.py:130-131`) | `VNBROKER_BROKER_TCBS_TIMEOUT_SECONDS` | Không | số trong khung |
| Test-connection | `get_accounts` | `authenticate()` market-only | cần OTP → lưu `unverified` | — | — |

Nguồn env tương ứng (để migrate/toàn vẹn): SSI `VNBROKER_BROKER_SSI_*` (`credentials.py:114-159`),
TCBS `VNBROKER_BROKER_TCBS_*` (`credentials.py:14-91`), DNSE `DNSE_API_KEY/SECRET`
(`README vnbroker`). Quy tắc: **env là fallback khi DB chưa có**; khi admin lưu qua SOC, DB thắng
và ghi `source: db|env` vào response để debug.

## 6. Bảo mật (bắt buộc, kiểm tra khi nghiệm thu)

1. Fernet at-rest, key từ env (`DNSE_CREDENTIAL_FERNET_KEY` mẫu, `models.py:889`); thiếu key → từ chối khởi động tính năng.
2. Mọi response mask secret (`****`, mẫu `:94-97`); log redact (mẫu `broker/security/redaction.py`).
3. Không secret trong Celery args/DB log/audit payload (P2).
4. Test-connection read-only, không tạo phiên trade, không gửi OTP thật ở chế độ test.
5. System credential staff-only + audit mọi CRUD (ai/khi nào/provider/purpose).
6. Rate-limit endpoint config/test (kế thừa pattern 3-layer `register.py:37-80`).

## 7. Phân kỳ triển khai (chỉ cấu hình — trade/sync ở pha sau)

- **Đợt 1 (~4-5 ngày) — User config DNSE hợp nhất**: `UserBrokerConfig` + migrate 2 store +
  schema/test-connection DNSE async + FE khối Môi giới (DNSE tile) + i18n + alias route cũ.
  DoD: CRUD + test-connection xanh, dữ liệu cũ còn nguyên (count 2 chiều), `tsc` 0, `build` PASS,
  `i18n:scan` 0, tests ≥10 BE + 3 FE.
- **Đợt 2 (~5-6 ngày) — System registry + SOC tab**: `BrokerSystemConfig` + `SystemBrokerCredential`
  (DNSE-system migrate từ `get_system_provider_credentials()`) + SOC Broker tab
  (config/health/credentials/kill-switch/audit+CSV) + mapping §4.4 có hiệu lực cho backfill.
  DoD: đổi routing/timeout qua UI có hiệu lực runtime (không restart), audit đủ vết, backfill
  abort đúng khi thiếu credential.
- **Đợt 3 (~6-8 ngày) — SSI/TCBS user+system config**: schema §5 + test-connection (SSI market-only;
  TCBS unverified-flow) + tiles FE + system creds staff-only + contract test pin signature
  (rút kinh nghiệm Audit F7). Bump vnbroker theo `docs/NGHIEN_CUU_VNBROKER_NANG_CAP_20260923.md`.
  DoD: connect đủ 3 broker trên tài khoản thật, status/TTL đúng, 0 secret lọt log/response (scan).
- **Không làm ở pha này**: đặt/sửa/hủy lệnh mới, sync danh mục mới, realtime/WS, paper, chart-trading
  (thuộc pha Broker Hub đã duyệt hướng ở `IMPLEMENTATION_PLAN_BROKER_MANAGEMENT_20260923.md`).

## 8. Xin phê duyệt

1. Chốt gộp 2 store DNSE thành `UserBrokerConfig` (đề xuất: có, giữ alias 1 release)?
2. System credential để staff quản qua SOC (đề xuất) hay giữ env-ops như hiện tại?
3. `kill_switch_write` + `quiet_hours` có đưa vào Đợt 2 không?
4. Purpose mapping §4.4 (SSI market-only cho snapshot dùng chung) có đồng ý?
5. Phê duyệt **Đợt 1 → Đợt 2 → Đợt 3** liên tục hay từng đợt nghiệm thu riêng?
