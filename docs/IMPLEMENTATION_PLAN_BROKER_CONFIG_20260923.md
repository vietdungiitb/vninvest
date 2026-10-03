# IMPLEMENTATION PLAN — Quản lý cấu hình Broker 2 mức (User + System), 3 đợt

**Base:** `dev` HEAD + Entry 153 (đề xuất `docs/DE_XUAT_QUAN_LY_CAU_HINH_BROKER_20260923.md`) —
audit nền `docs/AUDIT_BROKER_MANAGEMENT_20260923.md`.
**Mục tiêu:** Từ 2 store DNSE song song + 0 registry hệ thống + env lẻ tẻ → `UserBrokerConfig` đa-broker
+ `BrokerSystemConfig` versioned + `SystemBrokerCredential` staff-only + SOC tab Broker + FE khối Môi giới,
theo đúng ma trận §5 của đề xuất. **Chỉ cấu hình** — không trade/sync/realtime mới.
**Chuyển giao:** Đội code thực thi không cần hỏi lại. Mỗi slice có **Files chạm** + **Yêu cầu đạt (DoD)** +
**Tiêu chí audit copy-paste** + **Test**. Gate bắt buộc sau mỗi slice.

> **Rev.1 (2026-09-23):** Áp dụng phản biện độc lập `docs/PHAN_BIEN_BROKER_CONFIG_20260923.md`
> (verdict IMPLEMENTABLE) — sửa C1 (pin TCBS đúng method), C2 (SSI keyword args), C3 (prereq = tag
> `v3.3.0` đã tồn tại trên GitHub, không còn "≥v3.2.0"), C4 (icon `Building2` có sẵn),
> C5 (đường dẫn guide đúng repo ngoài), G1–G4, trả lời F-Q1–Q3 ngay trong plan.
> Không đổi kiến trúc, không đổi D1–D5.

> **Ràng buộc giữ:** Vietnamese full dấu `vi.js/en.js` qua `LangContext t()` (không hardcode),
> SOC glassmorphism (`soc.module.css`, phân biệt `soc.tokens.css`), API calls
> `defaultCoreApiAdapter as unknown as { … }`, secret Fernet + preview `****`, không secret trong
> Celery args/log/response, I/O broker cấm trong request (async + poll).
> **Không đổi contract** các route DNSE cũ trong 1 release — chỉ thêm alias mới, route cũ proxy về store mới.

> **Quyết định chốt (khỏi hỏi lại):** D1 gộp 2 store DNSE → `UserBrokerConfig`, giữ alias read-only 1 release.
> D2 system credential quản qua SOC staff-only (thay nhờ credential admin). D3 kill-switch + quiet-hours
> vào Đợt 2 (kill-switch enforced ở backfill + write pipeline pha sau; quiet-hours enforced ở beat fan-out).
> D4 purpose mapping: DNSE→backfill, SSI market-only→snapshot dùng chung, TCBS→dự phòng.
> D5 nghiệm thu **từng đợt** — đợt sau chỉ bắt đầu khi gate đợt trước xanh.

---

## ĐỢT 1 — User config DNSE hợp nhất (~4-5 ngày)

### SLICE B1.1 — Model `UserBrokerConfig` + migrate dữ liệu 2 chiều

**Mục tiêu:** Một store đa-broker duy nhất, dữ liệu DNSE cũ còn nguyên.

**Files:**
- `packages/core/backend/src/user_workspace/models.py:393` (mới class sau `DNSECredential`, giữ class cũ + comment DEPRECATED alias 1 release)
- `packages/core/backend/src/user_workspace/migrations/00XX_user_broker_config.py` **MỚI** (create + data-migrate)
- `packages/core/backend/src/user_workspace/tests/test_user_broker_config_migrate.py` **MỚI**

**Yêu cầu đạt (DoD):**
- B1.1.1. `UserBrokerConfig`: `user FK related_name='broker_configs'`, `provider` choices `(dnse,ssi,tcbs)`,
  `label` default `'Mặc định'`, `secrets_cipher JSON` (Fernet toàn dict, tái dùng
  `vninvest_core.utils.encryption.encrypt_string/decrypt_string` như `models.py:427-441`),
  `prefs JSON` (`default_account`, `sync_enabled=true`, `notify_on_error=true`),
  `status` choices `(never_connected,connected,expired,error)` default `never_connected`,
  `last_verified_at/last_error/created_at/updated_at`, `unique_together (user,provider,label)`.
- B1.1.2. Data-migrate: mỗi `DNSECredential` có `has_credentials()` → 1 row
  (`provider=dnse`, secrets `{client_id,client_secret}` lấy qua `get_client_id()/get_client_secret()`);
  mỗi `identity_access.UserDNSECredential(is_system_provider=False)` chưa trùng user → 1 row tương tự
  (lấy qua `get_api_key()/get_api_secret()`). `is_system_provider=True` **bỏ qua** (sang Đợt 2).
- B1.1.3. Không xóa 2 bảng cũ; thêm `DeprecationWarning` comment + docstring "read-only, nguồn thật là UserBrokerConfig".
- B1.1.4. Helper `get_user_broker_config(user, provider)` + `set_user_broker_secrets(...)` dùng chung cho views (không để view tự đọc cipher).

**Tiêu chí audit:**
```bash
Select-String -Path packages/core/backend/src/user_workspace/models.py -Pattern "class UserBrokerConfig|unique_together|secrets_cipher"  # expect ≥3
python src/manage.py check  # 0 issues
python src/manage.py migrate --check  # no changes (sau khi migrate)
python src/manage.py shell -c "from user_workspace.models import DNSECredential, UserBrokerConfig; a=DNSECredential.objects.filter(client_id_cipher__gt='').count(); b=UserBrokerConfig.objects.filter(provider='dnse').count(); print(a,b); assert b>=a, 'migrate thiếu'"
```

**Test (BE):** `test_user_broker_config_migrate.py` (5 tests): tạo DNSECredential mẫu → migrate → row mới đúng secrets/prefs/status;
chạy migrate 2 lần → không duplicate (idempotent); system-provider bị bỏ qua; unique chặn trùng (user,dnse,Mặc định);
helper get/set round-trip Fernet.

---

### SLICE B1.2 — Schema registry + CRUD + test-connection async (DNSE)

**Mục tiêu:** Form động + kiểm tra kết nối không treo request (fix Audit F1 ngay từ đầu).

**Files:**
- `packages/core/backend/src/user_workspace/broker/__init__.py` + `base.py` **MỚI** (interface `BrokerConfigSchema`, `test_connection`, normalize preview)
- `packages/core/backend/src/user_workspace/broker/dnse.py` **MỚI** (schema DNSE §5 đề xuất + `test_connection` = `get_accounts`)
- `packages/core/backend/src/user_workspace/views_broker.py` **MỚI** (6 endpoints §3.3 đề xuất)
- `packages/core/backend/src/user_workspace/urls.py:77` (thêm routes, giữ 8 routes DNSE cũ alias về store mới)
- `packages/core/backend/src/user_workspace/tasks.py:50` (thêm `test_broker_connection_task` shared_task)
- `packages/core/backend/src/user_workspace/tests/test_broker_config_api.py` **MỚI**

**Yêu cầu đạt (DoD):**
- B1.2.1. `GET broker/providers/` trả `[{id,label,credential_mode,status,is_configured}]` cho `dnse/ssi/tcbs`
  (ssi/tcbs `status=not_supported_yet` ở Đợt 1 — FE ẩn tile nhưng API đã có khung).
- B1.2.2. `GET broker/config-schema/dnse/` trả 2 fields theo §5 (client_id required non-secret-preview,
  client_secret required secret) + `help_i18n` keys + `test_connection_kind: accounts`.
- B1.2.3. `POST broker/dnse/config/` validate required/whitespace → lưu Fernet → trả `{ok, status: unverified,
  preview: {client_id: "abcd****"}}`, **không bao giờ trả secret** (assert trong test bằng cách đọc response raw).
- B1.2.4. `POST broker/dnse/test-connection/` chỉ enqueue `test_broker_connection_task.delay(user_id, provider)`
  trả `{job_id}`; task gọi `get_accounts` read-only, cập nhật `status/last_verified_at/last_error`;
  `GET broker/jobs/<job_id>/` poll (tái dùng pattern Run Logs: `status/result/error`).
- B1.2.5. 8 routes DNSE cũ (`urls.py:78-85`) giữ nguyên path, đổi ruột đọc `UserBrokerConfig`
  (qua helper B1.1.4); `dnse_config_api` GET/POST/DELETE hành vi response giữ nguyên shape
  (backward compat cho FE cũ trong 1 release).
- B1.2.6. Rate-limit test-connection 5/phút/user (kế thừa pattern 3-layer `register.py:37-80`, tối thiểu 1 layer user).

**Tiêu chí audit:**
```bash
Select-String -Path packages/core/backend/src/user_workspace/views_broker.py -Pattern "\.delay\(|test_broker_connection_task|secrets"  # delay ≥1, không trả secrets
Select-String -Path packages/core/backend/src/user_workspace/urls.py -Pattern "broker/providers|config-schema|test-connection|broker/jobs"  # expect 4+
# Live (dev): POST test-connection → job PENDING trong <500ms (không block), poll → connected
```

**Test (BE):** `test_broker_config_api.py` (10 tests): schema shape; POST thiếu field → 400 theo field;
POST đủ → preview masked + DB Fernet (giải mã đúng); response không chứa secret substring;
test-connection trả job_id ngay + task mock `get_accounts` ok → status connected;
task mock raise → status error + last_error; route cũ GET config vẫn đúng shape; rate-limit 6 req → 429;
ssi schema ở Đợt 1 trả `not_supported_yet`.

---

### SLICE B1.3 — FE khối Môi giới (gộp 2 panel DNSE) + adapter gộp

**Mục tiêu:** Một khối cấu hình duy nhất trong Cài đặt, hết hardcode VI, hết xé adapter.

**Files:**
- `packages/web/src/components/BrokerSettingsSection.tsx` **MỚI** (~250 dòng, `createElement`, thay
  `DNSECredentialsSection.tsx` tại `UserSettingsPage.tsx:253`; giữ component cũ 1 release với banner deprecated)
- `packages/web/src/adapters/core/broker.js` **MỚI** (gộp `dnse.js:1-113` + `workspace.js:319,352,363`;
  2 file cũ re-export về file mới, TODO xóa release sau)
- `packages/web/src/components/BrokerSettingsSection.component.test.tsx` **MỚI**
- `packages/web/src/i18n/vi.js` (`settings.dnse*` giữ + thêm `broker.*` ~20 keys) + `en.js` (mirror đủ)

**Yêu cầu đạt (DoD):**
- B1.3.1. Tiles 3 broker (DNSE sáng, SSI/TCBS mờ + badge `broker.coming_soon` ở Đợt 1); tile DNSE hiện
  status (`connected/expired/error/never`) + `client_id preview` + `last_verified_at` + nút Kiểm tra/Xóa.
- B1.3.2. Form DNSE render từ `config-schema` (không hardcode field ở FE); validate required inline;
  nút Lưu disable khi thiếu; error theo field từ BE; success toast + reload status.
- B1.3.3. Test-connection: bấm → spinner → poll `broker/jobs/<id>/` mỗi 2s (tối đa 30s) → hiện
  `broker.test_ok` / `broker.test_failed + last_error`; không treo UI.
- B1.3.4. **0 string tiếng Việt hardcode** trong file mới (grep `"[À-ỹ]"` chỉ trúng trong `t(...)` keys);
  `en.js` đủ mirror (i18n:scan 0 missing).
- B1.3.5. `PortfoliosPage.tsx:104` giữ `DNSEConnectionPanel` ở Đợt 1 (trade panel sang pha Broker Hub),
  nhưng BẮT BUỘC chuyển các lời gọi adapter trong panel sang `adapters/core/broker.js` mới
  (hiện panel gọi `coreApiAdapter.syncDNSEAccounts/createDNSETradingToken/placeDNSEOrder` qua
  `adapters/core/workspace.js:319,352,363`) — nếu chỉ gộp adapter mà panel chưa switch thì vẫn 2 nguồn thật.
  Audit: `Select-String -Path packages/web/src/components/DNSEConnectionPanel.js -Pattern "workspace"` expect 0
  (xóa import workspace, chỉ dùng broker adapter).

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/BrokerSettingsSection.tsx -Pattern "useI18n|broker\.|poll|job_id"  # expect ≥4
Select-String -Path packages/web/src/components/BrokerSettingsSection.tsx -Pattern '[\u00C0-\u1EF9]'  # expect 0 (không hardcode VI)
Select-String -Path packages/web/src/i18n/en.js -Pattern "broker\."  # expect ≥15
npx tsc --noEmit  # 0
npm run build  # PASS
npm run i18n:scan  # 0 missing
```

**Test (FE):** `BrokerSettingsSection.component.test.tsx` (4 tests): render 3 tiles (SSI/TCBS mờ);
lưu thiếu secret → inline error + không gọi POST; test-connection → poll 2 lần → hiện ok;
mock status error → hiện last_error + nút thử lại. Gate `vitest run BrokerSettingsSection`.

---

### SLICE B1.4 — Gate Đợt 1 + evidence pack

**DoD đợt (không thiếu mục nào):** migrate count 2 chiều khớp (`UserBrokerConfig dnse == DNSECredential có creds +
UserDNSECredential user thường`); route cũ regression xanh (suite `identity_access` DNSE + backfill tests);
E2E tay trên dev: tạo user test → lưu DNSE demo → test-connection job → status connected (hoặc error rõ khi sai key);
minh chứng: output lệnh count, `manage.py check`, `tsc`, `build`, `i18n:scan`, pytest/vitest logs dán vào
`docs/evidence/broker-config/dot1/`.

---

## ĐỢT 2 — System registry + SOC tab (~5-6 ngày)

### SLICE B2.1 — `BrokerSystemConfig` versioned (học `VnbrokerDomainConfig`)

**Files:** `packages/core/backend/src/service_ops/domain_configs/broker.py` **MỚI** (dataclasses
`BrokerProviderEntry/BrokerSystemConfig` + `validate/to_dict/from_dict` theo mẫu `domain_configs/vnbroker.py:36-232`);
`service_ops/models.py` (mới `BrokerSystemConfigVersion`: `version int unique, payload JSON, is_active bool,
created_by, created_at`); migration; `service_ops/tests/test_broker_system_config.py` **MỚI**.

**DoD:** validate bắt: mỗi purpose (`backfill/snapshot/signal`) có ≥1 provider enabled; timeout trong khung
P4 đề xuất; `routing_order` không trùng; `from_dict` chịu payload thiếu (defaults §4.1 đề xuất);
`to_dict` round-trip. Tests 8.

**Audit:** `Select-String .../domain_configs/broker.py -Pattern "class Broker|def validate|kill_switch|quiet_hours"` expect ≥4;
`python src/manage.py check` 0.

### SLICE B2.2 — `SystemBrokerCredential` + migrate system DNSE

**Files:** `identity_access/models.py` (mới `SystemBrokerCredential`: `provider` unique, `secrets_cipher` Fernet,
`allowed_purposes JSON`, `is_verified/last_verified_at`, staff-only docstring như `:886-891`);
migration (copy row `UserDNSECredential(is_system_provider=True)` nếu có + DNSE admin từ
`get_system_provider_credentials()` `:943-960` nếu có); helper `get_system_broker_secrets(provider, purpose)`
thay hàm cũ (giữ hàm cũ delegate + deprecated); tests.

**DoD:** 1 provider đúng 1 row (unique); non-staff POST bị 403 (test); `allowed_purposes` chặn sai purpose
(DNSE-system xin `snapshot` → từ chối); backfill đọc qua helper mới. Tests 7.

### SLICE B2.3 — SOC tab Broker (học `SocVnbrokerPanel.tsx:1-90`)

**Files:** `components/soc/SocBrokerPanel.tsx` **MỚI** + adapter cast
(`defaultCoreApiAdapter as unknown as { getSocBrokerConfig/apply/preview/audit/testConnection/... }`);
`ShellOperationsCenterPage.tsx:25-34` thêm `{ key: "broker", icon: "Building2" }` + case render +
(DÙNG `Building2` có sẵn trong whitelist `ui/lucide-icon.tsx:29` — KHÔNG dùng `Landmark`
vì không có trong whitelist, `LucideIcon` sẽ trả fallback `⬤` theo `:66-70`)
`soc.tabs.*` i18n; `service_ops/urls.py` + views mới (`broker/config|apply|preview|audit|test|health`);
BE tests `test_soc_broker_config.py`.

**DoD:** config card (per-provider enabled/routing/timeout/retry/rpm + kill-switch + quiet-hours) +
Preview modal before/after + Apply ghi `ConfigChangeAudit` (`models.py:322-362`, action `apply`,
actor + IP + request_id) + audit list + CSV export + test-connection từng provider + health card
(latency/error/circuit/queue). Staff-only: views mới KẾ THỪA `SOCBaseView`
(`service_ops/views/base.py:99-102`, sẵn `permission_classes = [IsAuthenticated, IsAdminUser]`,
mẫu `VnbrokerConfigView(SOCBaseView, ConfigApplyMixin)` ở `views/vnbroker.py:323`) —
non-staff 403 test bắt buộc. FE tests 3 (render, preview diff, audit row).
`tsc` 0, `build` PASS, `i18n:scan` 0.

### SLICE B2.4 — Bật hiệu lực runtime + gate Đợt 2

- Adapter tập trung `service_ops/broker_runtime.py` **MỚI**: đọc active version → set
  `REQUEST_TIMEOUT/RATE_LIMIT_RPM/RETRIES` cho vnbroker calls + chọn provider theo `routing_order` +
  tôn trọng `kill_switch_write` (write hệ thống raise `BrokerWriteDisabled`) + `quiet_hours` ở beat fan-out
  (`user_workspace/tasks.py:34-47` — 2 hàm `reconcile_all_dnse_transactions_task`/`sync_all_dnse_balances_task`
  check giờ trước `.delay()`; KHÔNG phải `service_ops/tasks.py`).
- Backfill system chuyển sang `get_system_broker_secrets('dnse','backfill')`; thiếu → abort rõ (giữ hành vi cũ).
- **DoD đợt:** đổi timeout/routing qua SOC có hiệu lực không restart (test: set `requests_per_minute=1` →
  job bị throttle quan sát được); kill-switch bật → backfill abort có log; evidence vào
  `docs/evidence/broker-config/dot2/`.

---

## ĐỢT 3 — SSI/TCBS config (user + system) (~6-8 ngày, cần bump vnbroker trước)

**0. Prereq (không tính vào 6-8 ngày):** tag `v3.3.0` đã tồn tại trên GitHub
(`git ls-remote --tags origin` → `541d7f22`, đã chứa lane SSI — verified `git ls-tree v3.3.0
vnbroker/broker/ssi/`); bump `packages/core/backend/requirements.txt:29` lên `@v3.3.0` ghim SHA
`541d7f22` (KHÔNG dùng tag trôi, KHÔNG dùng `≥v3.2.0` — tag đó không tồn tại);
`Dockerfile` build PASS; verify trong container:
`docker exec vninvest-dev-core-api python src/manage.py shell -c "from vnbroker import Vnbroker;
c=Vnbroker().broker(provider='ssi', api_key='x', api_secret='y'); print(type(c).__name__)"`
→ in ra `SSIBrokerClient` (chứng minh lane nạp được; authenticate thật để pha trade).

### SLICE B3.1 — Schema + test-connection SSI (market-only, không OTP)

**Files:** `user_workspace/broker/ssi.py` **MỚI** (schema §5: api_key/api_secret required, client_id optional,
private_key optional-ghi chú "cần khi bật trade", api_url/device_id advanced-collapsed;
`test_connection` = `SSIBrokerClient(api_key=..., api_secret=...).authenticate()` market-only —
BẮT BUỘC keyword args vì `__init__(self, client_id, api_key, api_secret, ...)` ở
`vnbroker/broker/ssi/client.py:69-73`; gọi positional sẽ gán nhầm `client_id=api_key`);
tests mock theo pattern "1. Market data không OTP" tại
`C:\Mujoco Projects\vnbroker\docs\SSI_USAGE_GUIDE.md:8-29` (repo ngoài — KHÔNG có trong vninvest;
khuyến nghị vendor 1 bản vào `vninvest/docs/` khi viết test để khỏi phụ thuộc path máy dev).

**DoD:** test-connection SSI thật (key demo) connected mà không đòi OTP; thiếu secret → 400 theo field;
private_key sai format khi bật trade-flag → lỗi rõ. Tests 6 (mocked, không gọi live trong CI).

### SLICE B3.2 — Schema + test-connection TCBS (unverified-flow)

**Files:** `user_workspace/broker/tcbs.py` **MỚI** (schema: api_key required, custody_code optional —
validate lỏng cảnh báo (warn) thay vì chặn cứng cho tới khi xác nhận format TK thật trên prod (G4);
base_url advanced; `test_connection` **không OTP** → chỉ check format + `is_token_valid==False`
→ trả `status: unverified` + hướng dẫn nhập OTP ở pha trade; không lưu gì ngoài config).

**DoD:** TCBS lưu được `unverified`, không bao giờ `connected` nếu chưa OTP (assert cứng);
FE tile TCBS hiện trạng "Chờ OTP" đúng. Tests 4.

### SLICE B3.3 — FE tiles SSI/TCBS + system creds + contract tests

- FE: bật 2 tiles (form từ schema, advanced collapsed, test-connection poll như B1.3.3);
  SOC: system credential SSI/TCBS (staff-only, purpose mặc định SSI=`snapshot`, TCBS=`snapshot-dự-phòng`,
  DNSE giữ `backfill`).
- Contract tests **MỚI** `user_workspace/tests/test_vnbroker_broker_signatures.py`: pin signature
  `SSIBrokerClient.__init__/authenticate` (gọi mẫu trong test BẮT BUỘC keyword args),
  `TCBSBrokerClient.authenticate/get_account_list/get_balance`
  (KHÔNG pin `get_accounts` — method này không tồn tại; `get_account_list:122`/`get_balance:151`
  là interface `BaseBrokerClient` bọc trên `list_accounts`, xem
  `vnbroker/broker/tcbs/client.py:122-153`),
  `DNSEClient.get_accounts/post_order` (fail khi bump lib đổi signature — rút kinh nghiệm Audit F7).
- Secret-scan gate (PowerShell, vì máy dev không có `grep`):
  `Select-String -Path <fixtures+logs> -Pattern "(api_secret|private_key).{0,20}[A-Za-z0-9]{16,}"`
  = 0 hit.

**DoD đợt:** connect đủ 3 broker trên TK thật (DNSE connected, SSI connected market-only, TCBS unverified);
SOC đổi purpose mapping có hiệu lực; full gates xanh (§TIÊU CHÍ PHẢN BIỆN).

---

## TIÊU CHÍ PHẢN BIỆN (reviewer dùng để bác — implementation phải trả lời trước)

1. **Secret**: response/log/audit payload có chứa substring secret test không? (chạy secret-scan §B3.3, 0 hit)
2. **Async**: còn I/O broker nào trong request không? (`Select-String -Path user_workspace/views_broker.py -Pattern "\.delay\("` mọi view mới; test đo thời gian response test-connection <500ms)
3. **Migrate**: count 2 chiều khớp? chạy migrate 2 lần có duplicate? bảng cũ còn ghi mới ở đâu không? (`Select-String -Path user_workspace -Pattern "DNSECredential\.objects\.(create|get_or_create)"` ngoài migration = 0)
4. **Compat**: route DNSE cũ trả đúng shape cũ? (so sánh response mẫu trước/sau trong evidence)
5. **Validate**: field sai (whitespace-only secret, custody sai regex, PEM hỏng) có bị chặn với message đúng field + i18n EN đầy đủ?
6. **Phân quyền**: non-staff gọi SOC broker/system-cred có 403? user A có đọc được config user B? (test cross-user)
7. **Hiệu lực**: đổi registry qua UI có đổi hành vi runtime thật (throttle/routing/kill-switch quan sát được), không chỉ đổi DB?
8. **Audit**: mỗi apply/test-system-cred có row `ConfigChangeAudit` đủ actor/IP/before/after? CSV export đúng?
9. **Hồi quy**: suite DNSE cũ (`identity_access` + backfill) + `tsc/build/lint/i18n:scan` xanh?
10. **Tài liệu**: runbook cập nhật (OTP/TTL/giờ GD/dry-run) + evidence pack đủ 4 loại (§MINH CHỨNG)?

## MINH CHỨNG BÀN GIAO (mỗi đợt một thư mục `docs/evidence/broker-config/dot<N>/`)

1. `gates.txt`: output `manage.py check`, `tsc`, `build` (tail), `i18n:scan`, pytest + vitest/jest của scope.
2. `migrate-counts.txt`: count trước/sau + assert idempotent (B1.1/B2.2).
3. `api-samples.md`: request/response thật (đã che secret) của CRUD + test-connection + poll + SOC apply/preview/audit.
4. `ui/`: screenshot tile/form/test-ok/test-fail + SOC tab (VI + EN mỗi loại 1 tấm).
Thiếu 1 trong 4 = chưa nghiệm thu.

## TRẢ LỜI 3 CÂU HỎI PHẢN BIỆN §F (chốt — đội code không hỏi lại)

- **F-Q1 (pin method TCBS nào):** `TCBSBrokerClient.authenticate` + `get_account_list` + `get_balance`
  (interface `BaseBrokerClient` ở `vnbroker/broker/tcbs/client.py:122-153`; đã sửa ở B3.3 Rev.1).
- **F-Q2 (icon whitelist):** DÙNG icon có sẵn `Building2` (`ui/lucide-icon.tsx:29`, đúng nghĩa ngân hàng/môi giới) —
  không sửa whitelist (đã sửa ở B2.3 Rev.1).
- **F-Q3 (ai/hạn prereq tag):** HẾT HIỆU LỰC — tag `v3.3.0` đã tồn tại trên GitHub
  (`541d7f22`, verified chứa lane SSI); prereq B3.0 Rev.1 = bump ghim SHA, người chạy Đợt 3 tự làm,
  không cần việc riêng, không hạn mới.

## RỦI RO & ROLLBACK

- Migrate sai/dupe → rollback: migration `reverse_code` khôi phục (viết sẵn trong file migration, test reverse trên DB copy);
  alias bảng cũ còn nguyên nên revert code là chạy lại được ngay.
- SOC apply sai routing → revert 1 click từ audit row (dùng after_snapshot cũ làm payload, qua preview như apply thường).
- Bump vnbroker vỡ signature → contract test đỏ trước khi merge (B3.3 gate), pin SHA tag, rollback 1 dòng `requirements.txt`.
- Fernet key thiếu ở worker → readiness check `manage.py check --deploy` fail-closed (không start job broker).

*Kế hoạch này thực thi đề xuất Entry 153, không thay đổi quyết định D1–D5 đã chốt ở header.*
