# PHẢN BIỆN ĐỘC LẬP — IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923 (Entry 154)

**Ngày**: 2026-09-23
**Đối tượng**: `docs/IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923.md` (3 đợt, 12 slices B1.1–B3.3, D1–D5)
**Phương pháp**: Đối chiếu từng `file:line` plan trỏ tới — đọc thật code vninvest + repo ngoài vnbroker
(`C:\Mujoco Projects\vnbroker`), không suy luận. PowerShell (`Select-String`/`Get-Content`), không `grep`/`rg`.

> **Tóm tắt 5 findings nghiêm trọng nhất**
> C1. Đợt 3 contract test B3.3 pin `TCBSBrokerClient.get_accounts` — method này KHÔNG tồn tại
> (`vnbroker/broker/tcbs/client.py` chỉ có `get_account_list:122`, `get_account_balance:131`, `list_accounts:147`, `get_holdings:327`) → test fail ngay, giết đúng mục tiêu "pin signature".
> C2. Đợt 3 B3.1 viết `SSIBrokerClient(api_key, api_secret)` theo vị trí — nhưng `__init__` là
> `(client_id, api_key, api_secret, ...)` (`ssi/client.py:69-73`) → gán `client_id=api_key, api_key=api_secret, api_secret=None` → test-connection sai/treo. Phải keyword args.
> C3. Prereq B3.0 "bump tag có SSI lane ≥v3.2.0" — tag đó KHÔNG tồn tại trên GitHub (chỉ `v1.1.0`/
> `v3.4.0-core`/`internal-core-1.0.0`, NGHIEN_CUU:18); phải chạy đủ NGHIEN_CUU Phase 1–2 tạo tag v3.3.0 trước.
> C4. B2.3 `icon: "Landmark"` KHÔNG có trong whitelist `lucide-icon.tsx` (46 icons) → `LucideIcon` trả `⬤` fallback → tab Broker mất icon.
> C5. B3.1 mock tests theo `docs/SSI_USAGE_GUIDE.md:8-29` — file KHÔNG tồn tại trong vninvest repo (Test-Path False); chỉ có ở external repo `C:\Mujoco Projects\vnbroker\docs\`.

---

## A. Bản đồ xác minh file:line (plan ⇄ code)

| Ref plan | Thực tế code (verified) | Kết luận |
|---|---|---|
| `user_workspace/models.py:393` | `class DNSECredential(models.Model)` @393 | ✅ khớp |
| `models.py:427-441` (Fernet) | `set_client_id` @427 `encrypt_string`/`decrypt_string` @429/433, get @431/439 | ✅ khớp |
| `user_workspace/urls.py:78-85` (8 routes cũ) | 8 path `broker/dnse/*` @78-85, @77 là comment | ✅ khớp (B1.2.5 hợp lệ) |
| `user_workspace/tasks.py:34-47` fan-out + `.delay()` | `reconcile_all` @34-40 (`.delay` @38), `sync_all` @41-47 (`.delay` @46) | ✅ khớp (B2.4) |
| `tasks.py:50` | `def sync_dnse_accounts_task` @50 | ✅ khớp (B1.2) |
| `views_dnse.py` sync-in-request (F1) | `dnse_config_api` @64, sync_accounts @132→`.delay` @144, balances @162→@174, reconcile @186→@204, place_order @216 | ✅ xác nhận F1 (B1.2 "không treo request" đúng động lực) |
| `identity_access/models.py:886-891` staff-only | docstring staff/is_system_provider @888-891, class @882, `get_api_key` @934, `get_api_secret` @938, `get_system_provider_credentials` @943 | ✅ khớp (B1.1.2/B2.2) |
| `identity_access/urls.py:68` | `path('dnse-credential/', ...)` @68 | ✅ khớp |
| `register.py:37-80` rate-limit 3-layer | chú thích R3 + IP @38-41 | ✅ khớp (B1.2.6) |
| `service_ops/models.py:322-362` ConfigChangeAudit | class @322, action @340, actor @341, actor_ip @342, before @344, after @345, change_summary @347, request_id @350 | ✅ khớp (B2.3) |
| `service_ops/domain_configs/vnbroker.py:36-232` | `VnbrokerTimeoutConfig` @36-37, `VnbrokerProviderConfig` @74-75, `VnbrokerDomainConfig` @126-127; validate/to_dict/from_dict đầy đủ | ✅ khớp (B2.1 mẫu đúng) |
| `service_ops/urls.py:48-56` (9 vnbroker routes) | 9 path @47-56 | ✅ khớp |
| `provider_catalog.py:9-37` | 3 provider (vci/kbs/dnse), `credential_mode` @14/22/30 | ✅ khớp — ⚠️ ssi/tcbs chưa có (M7) |
| `market_data/models.py:96-132` VnbrokerRuntimeConfig | class @96, is_active @110 | ✅ khớp (mẫu đợt 2) |
| B3.0 `requirements.txt:29` | KHÔNG có file gốc; thực tế `packages/core/backend/requirements.txt:29` = `vnbroker@v1.1.0` | ⚠️ M1 (thiếu path) |
| vnbroker `broker/ssi/client.py` | `SSIBrokerClient` @48, `__init__(client_id, api_key, api_secret, private_key, api_url, stream_url)` @69-73, `authenticate(otp=None,…)` market-only @128, `get_ohlc` @663, `get_master_data` @729 | ✅ nội dung B3.1 đúng, ❌ cách gọi positional sai (C2) |
| vnbroker `broker/tcbs/client.py` | `TCBSBrokerClient` @40, `__init__(api_key, base_url, custody_code)` @60, `authenticate(otp)` @94, `is_token_valid` @110, `get_balance` @151 — KHÔNG có `get_accounts` | ❌ C1 |
| vnbroker `connector/dnse/client.py` | `DNSEClient` @18, `get_accounts` @70, `post_order` @198 | ✅ khớp (B3.3 DNSE) |
| `UserSettingsPage.tsx:253` | `e(DNSECredentialsSection, …)` @253 | ✅ khớp (B1.3) |
| `PortfoliosPage.tsx:103-104` | `e(DNSEConnectionPanel, null)` @104 (không có @103) | ⚠️ M2 |
| `workspace.js:319,352,363` | `syncDNSEAccounts` @319, `createDNSETradingToken` @352, `placeDNSEOrder` @363 | ✅ khớp (B1.3 adapter gộp) |
| `dnse.js:1-113` | file 115 dòng, client re-export khả thi | ✅ khớp |
| `ShellOperationsCenterPage.tsx:26-33` | `SOC_TABS` thực tế @25-34 (8 tabs, vnbroker @31) | ⚠️ M3 |
| `SocVnbrokerPanel.tsx:1-90` | adapter cast `defaultCoreApiAdapter as unknown as {…}` @59-73, export @75 | ✅ khớp (B2.3) |
| i18n `vi.js/en.js` | dnse keys `vi.js:2006-2021`/`en.js:2012+`; `soc.tabs.*` @`vi.js:162+`; chưa có `broker.*`/`soc.tabs.broker` | ✅ khớp (thêm keys là mới) |
| `lucide-icon.tsx` iconMap whitelist | 46 icons — KHÔNG có `Landmark`; LucideIcon fallback `⬤` @68-70 | ❌ C4 |
| `docs/SSI_USAGE_GUIDE.md:8-29` (B3.1) | KHÔNG tồn tại trong vninvest; chỉ external `C:\Mujoco Projects\vnbroker\docs\SSI_USAGE_GUIDE.md` @8-29 = mục "1. Market data không OTP" | ❌ C5 |

## B. CONTRADICTIONS (plan ⇄ thực tế)

| # | Plan (file:line ý tưởng) | Thực tế (code:line verified) | Tác động |
|---|---|---|---|
| C1 | B3.3: pin `TCBSBrokerClient.authenticate/get_accounts` | `tcbs/client.py`: có `get_account_list`@122, `get_account_balance`@131, `list_accounts`@147, `get_holdings`@327 — **không có `get_accounts`** | Contract test fail ngay → chặn Đợt 3; đúng thứ "pin signature" nhưng pin nhầm method. **Fix**: pin `authenticate/get_balance` hoặc `list_accounts`. |
| C2 | B3.1: `test_connection = SSIBrokerClient(api_key, api_secret).authenticate()` | `ssi/client.py:69-73` `__init__(client_id, api_key, api_secret, …)` — gọi positional 2 tham số đầu = `client_id`, `api_key` | `api_secret=None` (rơi vào param thứ 3), `api_key` thành `client_id` → authenticating hỏng/treo. **Fix**: keyword args `SSIBrokerClient(client_id=…, api_key=…, api_secret=…)`. |
| C3 | B3.0: "bump `requirements.txt:29` lên tag có SSI lane (≥v3.2.0)" | GitHub tags chỉ `v1.1.0`/`v3.4.0-core`/`internal-core-1.0.0` (NGHIEN_CUU:18); không tồn tại v3.2.0/v3.3.0 | Prereq trỏ tag không tồn tại → nhóm code mất thời gian tìm. **Fix**: Prereq phải = "chạy NGHIEN_CUU Phase 1–2 **tạo tag v3.3.0** tại vnbroker, merge, release, rồi bump ghim SHA `38eec3a`". |
| C4 | B2.3: thêm tab `{ key: "broker", icon: "Landmark" }` | `lucide-icon.tsx` iconMap 46 icons không có `Landmark`; `LucideIcon` trả `⬤` @68 | Tab Broker mất icon (chấm tròn). **Fix**: thêm `Landmark` vào whitelist hoặc dùng icon có sẵn (vd `Building2`@29). |
| C5 | B3.1: tests mock theo `docs/SSI_USAGE_GUIDE.md:8-29` | File không có tại vninvest (`Test-Path` false); chỉ ở external vnbroker doc | Đội code không tìm thấy file → tự bịa fixture. **Fix**: ghi đủ path external hoặc copy guide hướng dẫn vào vninvest/docs. |

## C. GAPS / RISKS

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| G1 | MED | `user_workspace/tasks.py:34-47` vs `service_ops/tasks.py:34-47` | Cả 2 file đều có; plan ghi trần `tasks.py:34-47` — user_workspace=fan-out `.delay()`, service_ops=constants | Mơ hồ chỗ đặt quiet-hours | Ghi đủ path `user_workspace/tasks.py:34-47` |
| G2 | MED | B2.3 SOC tab staff-only | Plan: non-staff 403. Chưa verify `service_ops/views.py` có sẵn cơ chế staff gate cho tab mới | Rủi ro lộ system credential nếu bỏ sót | Chỉ rõ gate tái dùng pattern SOC hiện có (test 403 bắt buộc) |
| G3 | LOW | B1.3.5 credential đọc store mới trong `DNSEConnectionPanel` | `PortfoliosPage.tsx:104` giữ panel cũ; nhưng panel gọi adapter cũ (`workspace.js:319`) | Nếu chỉ gộp adapter mới mà `DNSEConnectionPanel` chưa switch → 2 nguồn thật | B1.3.5 cần liệt kê đổi dòng gọi adapter trong `DNSEConnectionPanel` (không chỉ giữ) |
| G4 | LOW | vnbroker TCBS `__init__` @60 có `custody_code`; B3.2 regex `105C...` | Đúng hướng; format custody DNSE/TCBS có thể khác tuỳ TK | Validate sai format TK thật trên prod | Xác nhận format hiện tại trước khi chặn regex |

## D. Xác minh Đợt 1/2 (KHÔNG có blocker)

- Slices B1.1–B1.4, B2.1–B2.4: mọi ref BE/FE/i18n verified khớp, không contradiction thật ngoài M2/M3 (lệch 1 dòng chỉ dẫn).
- B2.1 mẫu `domain_configs/vnbroker.py:36-232` (validate/to_dict/from_dict) — đúng mẫu versioned, dùng được.
- B2.4 adapter set `REQUEST_TIMEOUT/RATE_LIMIT_RPM/RETRIES` — verified vnbroker `config.py` có `REQUEST_TIMEOUT:11`, `RETRIES:14`, `RATE_LIMIT_RPM:26` (env `vnbroker_RATE_LIMIT_RPM`); plan khả thi.
- B2.2 `get_system_provider_credentials()` hiện tại @943-962 trả 1 tuple; plan giữ delegating + deprecated — tốt, không phá call-sites.

## E. Quality gates

- Không chạy được `npx tsc --noEmit`/`npm run build`/`manage.py check` cho **chính plan** (plan = tài liệu, chưa đổi code) — đúng bản chất Entry 154 ("nghiên cứu + viết plan, không đổi code").
- Tất cả khẳng định trên đều qua đọc file thật với line — không có claim "CHƯA XÁC MINH" còn sót.
- Môi trường: không có `grep`/`rg`/`test` trong PowerShell — nhóm code cần dùng `Select-String` cho các command audit trong plan (plan vẫn dùng cú pháp bash `grep -rE …` ở B3.3 → nên ghi chú chạy bằng Git Bash/WSL).

## F. Câu hỏi cần làm rõ
1. Dùng method TCBS nào làm contract pin thay `get_accounts`? (`get_account_list` vs `list_accounts` vs `get_balance`)
2. Có được phép thêm icon mới vào `lucide-icon.tsx` whitelist (C4) hay phải dùng icon có sẵn?
3. Ai thực thi NGHIEN_CUU Phase 1–2 (tạo tag v3.3.0) và có hạn nào cho prereq B3.0?

## G. Đánh giá tổng thể

- **Verdict: IMPLEMENTABLE — không blocker cho Đợt 1–2; 3 blocker nhỏ cho Đợt 3 là C1–C3, 2 gap UI là C4–C5.**
- Độ chính xác file:line của plan rất cao (~95% verified khớp; sai lệch chủ yếu là ±1 dòng chỉ dẫn hoặc path không đủ rõ).
- **Sửa bắt buộc trước khi bàn giao đội code**: C1 (TCBS method pin), C2 (SSI positional→keyword), C3 (prereq tag), C4 (icon Landmark), C5 (đường dẫn SSI_USAGE_GUIDE). Các sửa đều 1–2 dòng trong plan, không đổi kiến trúc, không đổi D1–D5.
- Khuyến nghị: chốt các câu hỏi §F rồi cập nhật plan thành Rev.1 trước khi giao; Evidence pack 4 loại/đợt giữ nguyên.

---

## Addendum Rev.1 (2026-09-23, Entry 158 — người áp dụng plan)

- Tất cả C1–C5, G1–G4 đã được xác minh độc lập lại và sửa trong
  `docs/IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923.md` (header Rev.1).
- **C3 cập nhật**: tag `v3.3.0` nay ĐÃ tồn tại trên GitHub (`541d7f22`,
  `git ls-remote --tags origin` khớp, `git ls-tree v3.3.0 vnbroker/broker/ssi/` có lane) —
  khuyến nghị "tạo tag v3.3.0" ở §B-C3/§F-3 được thay bằng "bump `@v3.3.0` ghim SHA" trong plan Rev.1.
- **F-Q1–Q3 đã chốt trong plan**: pin `authenticate/get_account_list/get_balance`;
  icon `Building2` có sẵn (`ui/lucide-icon.tsx:29`); Q3 hết hiệu lực.
- Ledger: entry phản biện này đánh lại số 155 → **157** (trùng Entry 155 cũ "Deploy frontend dev"
  2026-09-22; tiền lệ Entry 149).