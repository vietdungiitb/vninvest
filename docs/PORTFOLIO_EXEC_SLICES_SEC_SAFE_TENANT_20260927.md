# TẬP SLICE 1 — WAVE −1 SECURITY · WAVE 0 SAFETY · WAVE 1 TENANT

**Ngày:** 2026-09-27 · 16 slice · 49–64 ed
**Đọc trước:** `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` §0 · `docs/AGENT_PROTOCOL.md`
**Điều kiện mở Wave 0:** Wave −1 hoàn tất, GT10 = 0 hit
**Điều kiện mở Wave 1:** Wave 0 hoàn tất, tất cả GT xanh

---

## Cấu trúc bắt buộc của mỗi slice

Mỗi slice dưới đây có 12 mục. Không slice nào được coi là xong nếu thiếu mục nào.

---

# WAVE −1 — SECURITY

> **Bắt đầu ngay hôm nay. Không phụ thuộc gì.** Đây là 1 tuần công việc, không cần thiết kế, không cần thảo luận — chỉ cần thực thi.

## SEC-01 — Revoke & rotate 7 secret

**Ước lượng:** 2 ed · **Phụ thuộc:** không · **Rủi ro nếu làm 90%:** secret cũ vẫn còn hiệu lực

### 1. Mục tiêu
Bảo đảm 7 secret đã bị thu hồi tại nguồn phát sinh và được thay bằng giá trị mới, theo D-29 (một sự kiện duy nhất).

### 2. Phạm vi
**Được chạm:** file cấu hình **local** của chính bạn (`compose.dev.env` cục bộ, `.env.local`), `docs/evidence/SEC-01/`
**KHÔNG được chạm:** `docker-compose*.yml`, `packages/web/package.json`, file tracked (xem SEC-03)

### 3. Yêu cầu
- **R1:** Owner revoke 7 secret tại nguồn (GitHub, Django, DNSE, Ad signing) — **việc này owner làm, agent GHI LẠI bằng chứng**
- **R2:** 7 key mới sinh, đặt vào secret store / `.env.local`, **không** commit
- **R3:** Owner thông báo user trước khi rotate (session/PAT cũ sẽ vô hiệu) — D-29
- **R4:** Xác minh sau rotate: key cũ **không** còn giải mã được dữ liệu cũ trong DB (đây là hành vi mong đợi — người dùng phải kết nối lại broker)

### 4. Tiêu chí nghiệm thu
- **AC1:** Cả 7 key có timestamp rotate nằm trong 24h gần nhất, dán bằng chứng từ nguồn phát sinh
- **AC2:** `git grep -InE 'github_pat_|ghp_|DNSE_CREDENTIAL_FERNET_KEY=[A-Za-z0-9]' -- . ':!*.example'` → **0 hit** trên HEAD
- **AC3:** Không có giá trị secret nào trong bất kỳ commit nào của branch này — kiểm bằng `git log -p | grep`
- **AC4:** Ảnh chụp màn hình trang quản lý secret của nhà cung cấp, đã che giá trị

### 5. Phản biện bắt buộc
- **PB1:** Thử dùng key cũ để `POST /api/v1/auth/refresh` — có còn 200 không? Nếu còn ⇒ AC1 fail
- **PB2:** `git log --all -p -S 'DNSE_CREDENTIAL_FERNET_KEY'` có lộ giá trị cũ trong lịch sử không? Nếu có ⇒ ghi vào backlog purge, không tự purge khi còn agent chạy
- **PB3:** Có `DOCKER_STARTUP_GUIDE.md:14,116` / `docker-start.ps1:8` / `set-docker-env.ps1:4` còn chứa PAT không?

### 6. Test bắt buộc
Không cần unit test. Cần **verification script** chạy thật:
```
git grep -InE 'github_pat_[A-Za-z0-9_]{20,}' -- . ':!*.md.example'   → phải rỗng
git log --all -p -S 'github_pat_' | grep -c 'github_pat_'          → ghi lại số, không tự purge
```

### 7. Bằng chứng bàn giao
- **EV1:** `docs/evidence/SEC-01/gates.md` — output GT10 thật
- **EV2:** `docs/evidence/SEC-01/rotate-log.md` — bảng 7 key: tên, nguồn, thời điểm revoke, thời điểm phát hành bản mới (giá trị đã che)
- **EV3:** `docs/evidence/SEC-01/pb-answers.md` — trả lời PB1..PB3
- **EV4:** Ảnh màn hình đã che

### 8. Gate
GT10 (secret scan) · GT14 (BE env) nếu chạy test

### 9. Lệ thuộc
Không. **Chạy được ngay, song song với mọi slice khác.**

### 10. Rollback
Không rollback được (rotate là một sự kiện không thu hồi). Nếu rotate sai ⇒ rotate lại lần 2. Ghi rõ trong `rollback.md` rằng thao tác này **khong revert được**.

### 11. Ngoài phạm vi
- Purge git history (chờ khi không còn agent chạy — `AGENTS.md` quy định)
- Đổi license/production config

### 12. Ghi chú cho agent
Bạn **không thể** tự revoke secret. Việc bạn làm: chuẩn bị checklist, viết script verify, và ghi bằng chứng sau khi owner làm xong. Nếu owner chưa làm ⇒ ghi `CHƯA CHẠY (chờ owner)` và **không** báo PASS.

---

## SEC-02 — SecretStore abstraction + `BROKER_SECRET_KEY`

**Ước lượng:** 2 ed · **Phụ thuộc:** SEC-01 · **Rủi ro nếu làm 90%:** secret broker vẫn derive từ `SECRET_KEY` ⇒ rotate `SECRET_KEY` làm hỏng broker

### 1. Mục tiêu
Tách secret broker ra khỏi `SECRET_KEY` theo D-15, có versioning để rotate không phá dữ liệu cũ.

### 2. Phạm vi
**Được chạm:** `packages/core/backend/src/vninvest_core/utils/encryption.py`, `packages/core/backend/src/user_workspace/models.py` (thêm `secret_version` vào `UserBrokerConfig`), file test tương ứng
**KHÔNG được chạm:** `docker-compose*.yml`, `.env*`, `requirements.txt`

### 3. Yêu cầu
- **R1:** Tạo class `SecretStore` với interface: `encrypt(plaintext, version) -> str`, `decrypt(ciphertext) -> (plaintext, version)`
- **R2:** `BROKER_SECRET_KEY` là biến môi trường riêng, **không** derive từ `SECRET_KEY` — D-15
- **R3:** `UserBrokerConfig.secret_version` (PositiveSmallIntegerField, default 1) để biết ciphertext dùng key version nào
- **R4:** `decrypt` phải **fail-closed**: thiếu key version ⇒ raise, không trả plaintext rỗng
- **R5:** Cho phép giữ **nhiều** key version cùng lúc để rotate mà không phá ciphertext cũ
- **R6:** Không log plaintext/ciphertext ở bất kỳ tầng nào

### 4. Tiêu chí nghiệm thu
- **AC1:** `SecretStore.decrypt` với ciphertext của version không có trong registry → raise `SecretKeyMissingError`, **không** trả `""`
- **AC2:** Đổi `BROKER_SECRET_KEY` ⇒ ciphertext version cũ vẫn giải mã được (nếu version cũ vẫn còn trong registry)
- **AC3:** Grep toàn repo `log.*secret|print.*secret` trong module encryption → 0 hit
- **AC4:** `manage.py check` = 0 issue; test mới ≥ 6 case, tất cả pass

### 5. Phản biện bắt buộc
- **PB1:** Thiếu `BROKER_SECRET_KEY` trong prod — app có raise lúc import, hay chỉ fail lúc decrypt? Nếu chỉ fail lúc decrypt ⇒ R4 chưa đạt vì request có thể tới đó không kiểm soát
- **PB2:** Có chỗ nào khác vẫn gọi `Fernet(SECRET_KEY)` cho broker không? Grep toàn repo
- **PB3:** Thêm key version mới rồi xoá version cũ khỏi registry — ciphertext cũ còn giải mã được không?

### 6. Test bắt buộc
File: `packages/core/backend/src/user_workspace/test_secret_store.py`
| # | Tên test | Kỳ vọng |
|---|----------|---------|
| 1 | `test_encrypt_decrypt_roundtrip_v1` | plaintext khớp |
| 2 | `test_decrypt_missing_version_raises` | raise, không trả `""` |
| 3 | `test_multi_version_coexist` | 2 version giải mã đúng |
| 4 | `test_secret_not_derived_from_django_secret` | đổi `SECRET_KEY` không ảnh hưởng broker |
| 5 | `test_ciphertext_has_version_marker` | đọc được version từ ciphertext |
| 6 | `test_no_plaintext_in_repr` | `repr()` không chứa plaintext |

### 7. Bằng chứng bàn giao
`docs/evidence/SEC-02/` — `gates.md` (GT6, GT9) · `tests.md` (output 6 test) · `pb-answers.md`

### 8. Gate
GT6 (check) · GT7 (nếu đụng model) · GT8 (Postgres) · GT9 (BE test) · GT14

### 9. Lệ thuộc
SEC-01 xong (cần key mới có sẵn để test roundtrip thật)

### 10. Rollback
Revert commit. `secret_version` column có thể giữ nguyên vô hại. Ciphertext cũ vẫn giải mã được nếu key version cũ còn trong registry.

### 11. Ngoài phạm vi
Rotate key thật (SEC-01) · Migrate ciphertext hiện có sang version mới (defer sang BRK-02)

---

## SEC-03 — Gỡ secret khỏi tracked files + CI secret scanning

**Ước lượng:** 2 ed · **Phụ thuộc:** SEC-01 · **Rủi ro nếu làm 90%:** secret quay lại repo qua lần commit sau

### 1. Mục tiêu
Làm repo không còn chứa secret thật, và có chặn tự động để không quay lại.

### 2. Phạm vi
**Được chạm:** `.gitignore`, `scripts/` (script scan), `.github/workflows/*.yml`, tài liệu markdown có chứa secret
**KHÔNG được chạm:** `packages/web/package.json`, `pyproject.toml`

### 3. Yêu cầu
- **R1:** Thay PAT thật trong `DOCKER_STARTUP_GUIDE.md`, `docker-start.ps1`, `set-docker-env.ps1` bằng placeholder `<PAT_TOKEN>` hoặc hướng dẫn đọc từ env
- **R2:** `.gitignore` phải chặn `compose.dev.env`, `.env`, `.env.*` (trừ `.env.example`)
- **R3:** `compose.dev.env` phải **gỡ khỏi tracked** (`git rm --cached`) — audit ghi file này đang tracked và không bị gitignore chặn
- **R4:** Gỡ default secret khỏi `docker-compose*.yml`: `CORE_DB_PASSWORD`, `CORE_PAT_PEPPER`, `DNSE_CREDENTIAL_FERNET_KEY` — **YÊU CẦU owner duyệt vì đụng file shared**
- **R5:** Script `scripts/scan-secrets.mjs` chạy được, exit khác 0 khi phát hiện, exit 0 khi sạch
- **R6:** Gắn script vào CI, **fail-closed** (không dùng `|| true`)

### 4. Tiêu chí nghiệm thu
- **AC1:** `node scripts/scan-secrets.mjs` → exit 0, in "0 secret found"
- **AC2:** Tạo file test chứa `github_pat_` giả ⇒ script exit ≠ 0 (kiểm chứng gate thật sự chặn)
- **AC3:** `git check-ignore -v compose.dev.env` → in ra dòng ignore
- **AC4:** `git ls-files | grep -c 'compose.dev.env'` → 0
- **AC5:** CI workflow có bước scan và **không** có `|| true` / `continue-on-error: true` quanh nó

### 5. Phản biện bắt buộc
- **PB1:** Tự thêm `continue-on-error: true` vào workflow scan thì CI có còn chặn không?
- **PB2:** Script có quét được file đã có trong lịch sử git không? Nếu không, ghi rõ giới hạn
- **PB3:** Có pattern nào trong repo mà script bỏ sót? Liệt kê các loại secret của riêng dự án (`DNSE_API_SECRET`, `CORE_AD_SIGNING_SECRET`, Fernet key 44 ký tự)

### 6. Test bắt buộc
Negative test cho gate — đây là quy tắc cứng:
```
# Tạo file giả rồi xác nhận script FAIL
"<YOUR_GITHUB_PAT_HERE>" > /tmp/fake.txt
node scripts/scan-secrets.mjs → phải exit 1
```
Không có negative test thì gate chưa được kiểm chứng.

### 7. Bằng chứng bàn giao
`docs/evidence/SEC-03/` — `gates.md` (GT10) · `negative-test.md` (output 2 lần chạy) · `pb-answers.md`

### 8. Gate
GT10 · GT11 nếu ≥2 agent

### 9. Lệ thuộc
SEC-01 (đã biết key nào cần gỡ)

### 10. Rollback
Revert file văn bản. `git rm --cached` thì phải `git add` lại. **R4 đụng file shared ⇒ cần coordinator commit hợp nhất.**

### 11. Ngoài phạm vi
Purge git history (chờ owner, sau khi hết agent chạy)

---

# WAVE 0 — SAFETY

> **Mục tiêu:** làm cho hệ thống **không thể** fail-open. Mọi đường ghi đều phải bị chặn trước khi chạm broker.

## SAFE-01 — Order fail-closed + server-side mode

**Ước lượng:** 4 ed · **Phụ thuộc:** Wave −1 · **Rủi ro nếu làm 90%:** vẫn có 1 đường đặt lệnh live không kiểm soát

### 1. Mục tiêu
Đảm bảo **không có đường nào** đặt lệnh live ngoài ý muốn của người dùng. D-01 + D-22.

### 2. Phạm vi
**Được chạm:** `packages/core/backend/src/user_workspace/views_dnse.py`, `views_broker.py`, `service_ops/broker_runtime.py`, `packages/web/src/components/DNSEConnectionPanel.js`, `packages/web/src/adapters/core/workspace.js`, file test
**KHÔNG được chạm:** `docker-compose*.yml`, `requirements.txt`

### 3. Yêu cầu
- **R1:** `dry_run` mặc định **True** — hiện tại mặc định False tại `views_dnse.py:190`
- **R2:** Client **không được** tự quyết định `live`; server quyết định dựa trên tenant capability + feature flag + approval
- **R3:** Thêm `mode` field vào response: `paper | live`, trả kèm lý do nếu bị từ chối
- **R4:** FE gửi `dry_run` **luôn** (kể cả khi false) và hiển thị rõ badge "Paper" / "Live"
- **R5:** Cùng kiểu lỗi đã tìm ở `AdvisoryOrderTicket.js` phải sửa
- **R6:** Endpoint tạo challenge (`send-email-otp`) và `create-trading-token` cũng phải fail-closed — hiện parse thiếu `dry_run` thành live tại `views_dnse.py:99-176`

### 4. Tiêu chí nghiệm thu
- **AC1:** `POST /broker/dnse/place-order/` không có field `dry_run` ⇒ response `mode="paper"`, **không** gọi `client.post_order()`
- **AC2:** `dry_run=false` với tenant không có capability live ⇒ `403` + `problem+json`
- **AC3:** Test spy trên `client.post_order` — với paper mode, **0 lần** được gọi
- **AC4:** `AdvisoryOrderTicket.js` không còn chỗ nào đặt `live` mặc định
- **AC5:** 3 endpoint (place-order, send-email-otp, create-trading-token) đều có test fail-closed

### 5. Phản biện bắt buộc
- **PB1:** Grep toàn repo `post_order` / `place_order` — còn đường gọi nào không qua policy gate không? Đếm số call site trước/sau
- **PB2:** Gửi `dry_run=true` nhưng header giả mạo capability live ⇒ kết quả?
- **PB3:** FE có chỗ nào hiển thị "Live" khi thực tế là paper không? (Cảnh báo UX — người dùng tưởng đang đặt lệnh thật)

### 6. Test bắt buộc
BE: `test_order_fail_closed.py` — 8 case
| # | Tên | Kỳ vọng |
|---|-----|---------|
| 1 | `test_no_dry_run_field_defaults_paper` | mode=paper, broker không gọi |
| 2 | `test_dry_run_true_never_calls_broker` | spy count = 0 |
| 3 | `test_live_requires_capability` | 403 |
| 4 | `test_live_requires_feature_flag` | 403 khi flag off |
| 5 | `test_otp_endpoint_fail_closed` | không gọi broker |
| 6 | `test_token_endpoint_fail_closed` | không gọi broker |
| 7 | `test_response_includes_mode_and_reason` | có mode + reason |
| 8 | `test_problem_json_shape` | RFC 9457 — nhưng API-01 chưa làm thì ghi `CHƯA CHẠY` |

FE: 2 case — panel luôn gửi `dry_run`; badge đúng mode

### 7. Bằng chứng bàn giao
`docs/evidence/SAFE-01/` — `gates.md` (GT3, GT4 ×3, GT6, GT9) · `tests.md` · `pb-answers.md` (kèm **ảnh chụp màn hình** badge Paper/Live)

### 8. Gate
GT1 GT2 GT3 GT4 GT6 GT9 GT10 GT14

### 9. Lệ thuộc
Wave −1 xong. `views_dnse.py` còn đọc store cũ — **không sửa ở slice này** (để BRK-01).

### 10. Rollback
Revert. Nhưng lưu ý: revert làm lộ lại fail-open ⇒ **rollback phải kèm feature flag tắt live**.

### 11. Ngoài phạm vi
Sửa store mismatch (BRK-01) · Order model + `OrderEvent` (LIV-02) · RiskLimit (LIV-03)

---

## SAFE-02 — `Idempotency-Key` bắt buộc

**Ước lượng:** 3 ed · **Phụ thuộc:** SAFE-01 · **Rủi ro nếu làm 90%:** double-click vẫn tạo 2 lệnh

### 1. Mục tiêu
Chống double order theo D-12.

### 2. Phạm vi
**Được chạm:** `packages/core/backend/src/vninvest_core/middleware.py` hoặc decorator mới, `user_workspace/views_dnse.py`, FE `workspace.js` + `DNSEConnectionPanel.js`, file test

### 3. Yêu cầu
- **R1:** Mọi write tài chính (order, transaction, broker config) **bắt buộc** có header `Idempotency-Key`
- **R2:** Thiếu header ⇒ `400` với `problem+json` nêu rõ field
- **R3:** Unique constraint `(tenant_id, actor_id, scope, key)`
- **R4:** TTL 7 ngày cho order (D-12)
- **R5:** FE tự sinh key **mỗi lần bấm nút** — không sinh 1 lần rồi dùng lại
- **R6:** Cùng key + cùng payload ⇒ trả lại response cũ (`200`/`201` giống lần đầu), không tạo bản ghi mới
- **R7:** Cùng key + **khác** payload ⇒ `409` (chống nhầm lẫn)

### 4. Tiêu chí nghiệm thu
- **AC1:** Gửi cùng `Idempotency-Key` 2 lần ⇒ đếm bản ghi order = **1**
- **AC2:** Gửi cùng key khác payload ⇒ `409`
- **AC3:** Không có header ⇒ `400`, `body.type` trỏ RFC 9457
- **AC4:** FE: bấm nút 2 lần nhanh (double-click) ⇒ 1 order (test với `userEvent.dblClick`)
- **AC5:** Bản ghi cũ hơn 7 ngày ⇒ key tái sử dụng được (TTL test)

### 5. Phản biện bắt buộc
- **PB1:** Hai request song song (true concurrent, không phải tuần tự) có race không? Test bằng `Promise.all`
- **PB2:** Có endpoint write nào **không** bắt buộc key không? Grep `POST|PUT|PATCH|DELETE` trong `user_workspace/urls.py` rồi đối chiếu
- **PB3:** FE có tách sử dụng lại key khi retry không? Nếu retry dùng lại key cũ ⇒ vô hiệu chống double

### 6. Test bắt buộc
BE `test_idempotency.py` — 7 case: bắt buộc header · trùng payload · khác payload 409 · TTL hết hạn · concurrent race · scope khác nhau độc lập · tenant khác nhau độc lập
FE — 2 case: key sinh mới mỗi lần bấm · double-click chỉ 1 order

### 7. Bằng chứng
`docs/evidence/SAFE-02/` — kèm **log đếm bản ghi** trước/sau (SQL output), không chỉ HTTP status

### 8. Gate
GT1 GT2 GT3 GT4 GT6 GT7 GT8 GT9 GT10 GT14

### 9. Lệ thuộc
SAFE-01 (biết endpoint nào là write tài chính)

### 10. Rollback
Revert + gỡ unique constraint (migration riêng, không gộp migration khác)

### 11. Ngoài phạm vi
`IdempotencyRecord` model cho ledger (LED-06) — slice này dùng bảng riêng nhẹ hơn, LED-06 sẽ hợp nhất sau

---

## SAFE-03 — Kill-switch fail-closed 4 lớp

**Ước lượng:** 4 ed · **Phụ thuộc:** SAFE-01 · **Rủi ro nếu làm 90%:** vẫn 1 tầng gọi broker không qua kill-switch

### 1. Mục tiêu
Khi có sự cố, chặn được **mọi** đường ghi, theo D-14 + D-23 (4 lớp).

### 2. Phạm vi
**Được chạm:** `service_ops/broker_runtime.py`, `user_workspace/views_dnse.py`, `user_workspace/tasks.py`, middleware mới, file test

### 3. Yêu cầu
- **R1:** `check_kill_switch(scope, tenant, provider)` — lỗi DB ⇒ **deny**, không phải allow. Hiện `broker_runtime.py:24-38` fail-open
- **R2:** Cấp độ: `global` / `tenant` / `provider` — 3 scope
- **R3:** Bắt buộc có caller ở **4 lớp**: middleware → view → service → worker (D-23)
- **R4:** Cấu hình qua `SystemAISettings`-style settings hoặc env, có audit mỗi lần toggle
- **R5:** UI SOC hiển thị trạng thái + nút toggle (operator, có capability)
- **R6:** Lỗi khi đọc trạng thái phải **log ERROR** (không im lặng)

### 4. Tiêu chí nghiệm thu
- **AC1:** Mock DB raise exception ⇒ `check_kill_switch` trả **deny**, và caller trả `503`
- **AC2:** Đếm call site của `check_kill_switch` trong 4 lớp — mỗi lớp ≥ 1 (grep output dán vào evidence)
- **AC3:** Bật kill-switch toàn cục ⇒ mọi order (paper **và** live) bị chặn
- **AC4:** `tenant A` bật, `tenant B` không ⇒ A bị chặn, B không (test 2 tenant)
- **AC5:** Mỗi lần toggle sinh 1 audit event

### 5. Phản biện bắt buộc
- **PB1:** Giả lập DB chết **thật** (dừng Postgres) rồi gọi order endpoint ⇒ 503 hay 500 hay vẫn gọi broker? Đây là bằng chứng quyết định
- **PB2:** Task Celery đã vào queue rồi mới bật kill-switch ⇒ task đó có bị chặn không?
- **PB3:** Có bao giờ gọi broker **không** đi qua view/service nào không? Grep `client.post` / `vnbroker` trong toàn repo

### 6. Test bắt buộc
`test_kill_switch.py` — 9 case: mặc định allow · global on chặn · tenant on chặn riêng · provider on chặn riêng · **DB lỗi ⇒ deny** · đủ 4 lớp có caller · audit có bản ghi · worker bị chặn khi queue đã có task · toggle ghi audit
**Bắt buộc:** 1 test dừng Postgres thật (hoặc mock `OperationalError` ở đúng tầng), ghi lại response thật.

### 7. Bằng chứng
`docs/evidence/SAFE-03/` — kèm **output của lần dừng Postgres thật**

### 8. Gate
GT6 GT9 GT10 GT14 · GT4 nếu có FE (SOC panel)

### 9. Lệ thuộc
SAFE-01

### 10. Rollback
Revert. Lưu ý: nếu revert mà để lại caller cũ fail-open thì tệ hơn không revert — rollback plan ghi rõ.

### 11. Ngoài phạm vi
Rate limit (SAFE-04 phần) · SOC panel đầy đủ (BRK-06)

---

## SAFE-04 — RBAC/capability toàn endpoint

**Ước lượng:** 3 ed · **Phụ thuộc:** SAFE-01 · **Rủi ro nếu làm 90%:** còn endpoint không yêu cầu capability

### 1. Mục tiêu
Mọi endpoint portfolio/broker yêu cầu capability đúng, theo D-22.

### 2. Phạm vi
**Được chạm:** `user_workspace/permissions.py`, `user_workspace/urls.py`, `identity_access/permissions.py`, file test

### 3. Yêu cầu
- **R1:** Mỗi view khai báo capability bắt buộc, không dựa vào mặc định
- **R2:** Capability cho portfolio: `workspace.portfolios.manage` (đọc), `workspace.portfolios.trade`, `workspace.broker.manage`
- **R3:** Deny **mặc định** khi thiếu khai báo
- **R4:** `403` + `problem+json` nêu rõ capability thiếu
- **R5:** Endpoint tài chính (order, transaction write) yêu cầu capability **khác** endpoint đọc

### 4. Tiêu chí nghiệm thu
- **AC1:** Lập bảng **đầy đủ** endpoint ↔ capability — mỗi dòng có capability hoặc ghi "không yêu cầu" kèm lý do
- **AC2:** Test tự động duyệt **mọi** URL trong `user_workspace/urls.py` với user không có capability ⇒ **100%** trả 401/403
- **AC3:** Không có view nào dùng `IsAuthenticated` trần cho route tài chính
- **AC4:** Bảng endpoint↔capability lưu vào evidence

### 5. Phản biện bắt buộc
- **PB1:** Test duyệt URL có thực sự chạy hết không, hay bỏ sót route có điều kiện? In ra **số lượng route đã test** rồi đối chiếu `urls.py`
- **PB2:** Có endpoint nào dùng `permission_classes = []` không?
- **PB3:** Staff bypass có đúng không, hay bypass quá rộng?

### 6. Test bắt buộc
`test_capability_matrix.py` — 3 case: endpoint đọc cần `manage` · endpoint order cần `trade` · user không capability nhận 403
**Bắt buộc:** script sinh bảng tự động từ `urls.py`, output vào evidence.

### 7. Bằng chứng
`docs/evidence/SAFE-04/` — `endpoint-capability-matrix.md` (bảng đầy đủ) · `gates.md` · `pb-answers.md`

### 8. Gate
GT6 GT9 GT14

### 9. Lệ thuộc
SAFE-01 (biết route nào là tài chính)

### 10. Rollback
Revert — nhưng nhớ revert làm lộ endpoint không kiểm soát.

### 11. Ngoài phạm vi
Tenant resolver (TEN-01) · Rate limit atomic (defer)

---

## SAFE-05 — Domain audit event + outbox

**Ước lượng:** 4 ed · **Phụ thuộc:** SAFE-01 · **Rủi ro nếu làm 90%:** vẫn chỉ có HTTP access log, không truy vết được thay đổi tài chính

### 1. Mục tiêu
Mọi thay đổi tài chính/nghiệp vụ có audit **append-only** theo D-23, truy vết được.

### 2. Phạm vi
**Được chạm:** `ops_audit/models.py`, `ops_audit/middleware.py`, `ops_audit/tasks.py`, module audit mới, file test
**KHÔNG được chạm:** `docker-compose*.yml`

### 3. Yêu cầu
- **R1:** Taxonomy domain event: `order.placed`, `order.filled`, `order.cancelled`, `transaction.created`, `broker.config_changed`, `broker.synced`, `kill_switch.toggled`
- **R2:** Mỗi event có `actor`, `tenant`, `resource_type`, `resource_id`, `action`, `before`, `after`, `request_id`
- **R3:** **Append-only** — không có `UPDATE`/`DELETE` event (enforce bằng DB trigger hoặc permission)
- **R4:** Redaction: không ghi secret, token, ciphertext, PII nhạy cảm
- **R5:** Outbox pattern — ghi event và audit trong **cùng** transaction
- **R6:** `AuditLogListView` phải scope đúng (hiện `qs.none()` ở `ops_audit/views.py:39-47` khiến SOC operator không thấy gì)

### 4. Tiêu chí nghiệm thu
- **AC1:** Đặt lệnh thành công ⇒ đếm audit event = 1, `action` = `order.placed`
- **AC2:** Audit chứa `before`/`after` khác nhau khi sửa; `before` = `null` khi tạo
- **AC3:** Grep audit log không có chuỗi giống secret/token
- **AC4:** Thử `DELETE /api/v1/audit/<id>` ⇒ `405` hoặc `403`
- **AC5:** Rollback transaction DB ⇒ audit event cũng rollback (chứng minh outbox cùng transaction)
- **AC6:** SOC operator thấy được event của tenant họ phụ trách

### 5. Phản biện bắt buộc
- **PB1:** Đặt lệnh fail giữa chừng (broker lỗi) ⇒ có audit event không, hay im lặng? Phải có event `order.rejected`
- **PB2:** Đọc source audit có thấy event của **tenant khác** không?
- **PB3:** Ai có quyền đọc audit cross-tenant? Có audit cho việc đọc audit không?

### 6. Test bắt buộy
`test_audit_events.py` — 8 case: tạo/sửa/xoá phát sinh event đúng · append-only chặn DELETE · redaction · outbox cùng transaction · tenant isolation · actor ghi đúng · `order.rejected` khi broker lỗi · SOC operator thấy đúng scope

### 7. Bằng chứng
`docs/evidence/SAFE-05/` — kèm **SQL output** chứng minh append-only (thử UPDATE rồi rollback transaction test)

### 8. Gate
GT6 GT7 GT8 GT9 GT14

### 9. Lệ thuộc
SAFE-01 (biết action nào cần audit)

### 10. Rollback
Revert. Migration audit table phải là **expand** (thêm bảng), không drop bảng cũ.

### 11. Ngoài phạm vi
Retention 7 năm (OPS-05) · SIEM export (defer)

---

## SAFE-06 — Queue `broker` + worker thật

**Ước lượng:** 4 ed · **Phụ thuộc:** SAFE-01 · **Rủi ro nếu làm 90%:** sync vẫn chạy trong HTTP request ⇒ timeout

### 1. Mục tiêu
Broker I/O chạy qua Celery queue bền vững, không trong request — theo D-13.

### 2. Phạm vi
**Được chạm:** `vninvest_core/queue_policy.py`, `settings.py`, `user_workspace/tasks.py`, `views_dnse.py`
**KHÔNG được chạm:** `docker-compose*.yml` (**YÊU CẦU owner/coordinator** — cần thêm worker service)

### 3. Yêu cầu
- **R1:** Thêm queue `broker` vào `queue_policy.py` (hiện thiếu)
- **R2:** Task sync (`syncDNSEAccounts`, `syncDNSEBalances`, `reconcileDNSETransactions`) dispatch qua queue, **không** `.delay()` rồi chờ trong request
- **R3:** View trả `202 Accepted` + `sync_run_id` ngay
- **R4:** Cấu hình test: `task_always_eager=False` + Redis thật (D-13)
- **R5:** Retry với backoff; lỗi vĩnh viễn ⇒ DLQ
- **R6:** `CELERY_TASK_ALWAYS_EAGER` trong test phải là `False` — hiện `settings.py:381-388` bật

### 4. Tiêu chí nghiệm thu
- **AC1:** `celery inspect registered` ( qua worker `broker`) có task sync
- **AC2:** Gọi endpoint sync ⇒ HTTP `202` trong **< 500ms** (đo bằng timer)
- **AC3:** Task lỗi 3 lần ⇒ vào DLQ, không mất
- **AC4:** Test suite chạy với `task_always_eager=False` vẫn xanh (chứng minh task thật hoạt động)
- **AC5:** `docker compose config` có worker `broker` — **CHƯA CHẠY nếu chưa có compose change** (file shared)

### 5. Phản biện bắt buộc
- **PB1:** Đo latency thật của endpoint sync. Nếu > 500ms ⇒ AC2 fail
- **PB2:** Kill worker giữa lúc task đang chạy ⇒ task chạy lại hay mất? Kiểm tra `acks_late`
- **PB3:** Có consumer cho queue `broker` chưa? Nếu chưa, task sẽ tích tụ vô hạn — kiểm tra độ dài queue

### 6. Test bắt buộc
`test_broker_queue.py` — 6 case: dispatch trả 202 nhanh · task thật chạy với Redis · retry backoff · DLQ · `acks_late` chống mất task · độ dài queue không tăng vô hạn

### 7. Bằng chứng
`docs/evidence/SAFE-06/` — kèm **output `celery inspect active/registered` thật** + **đo latency**

### 8. Gate
GT6 GT9 GT14 · **Thêm:** `celery inspect registered` output phải có trong evidence

### 9. Lệ thuộc
SAFE-01

### 10. Rollback
Revert code. Nhưng nếu đã đổi compose thì rollback cần coordinator.

### 11. Ngoài phạm vi
Thêm worker vào `docker-compose.dev.yml` (file shared — coordinator) · Reconciliation engine chi tiết (BRK-04)

---

## SAFE-07 — CI gate fail-closed

**Ước lượng:** 2 ed · **Phụ thuộc:** tất cả wave 0 slice khác

### 1. Mục tiêu
CI chặn merge khi gate fail. Hiện `|| echo` / `|| true` làm gate vô hiệu.

### 2. Phạm vi
**Được chạm:** `.github/workflows/web-ci.yml`, `.github/workflows/core-api.yml`, `scripts/`
**KHÔNG được chạm:** mọi thứ khác

### 3. Yêu cầu
- **R1:** Xoá mọi `|| true` / `|| echo` / `continue-on-error: true` quanh gate
- **R2:** Capture exit code, **không** pipe: `out=$(cmd 2>&1); st=$?; echo "$out"; [ $st -eq 0 ] || exit 1`
- **R3:** Chạy `manage.py check`, `makemigrations --check`, `manage.py test`
- **R4:** Coverage threshold cho module portfolio
- **R5:** FE: `tsc`, `lint`, `test:components` 1 lần trong CI (D-19 áp dụng khi ký release, không phải mỗi commit)
- **R6:** Entry point script fail-closed (`packages/core/backend/entrypoint.sh:21,24,52`)

### 4. Tiêu chí nghiệm thu
- **AC1:** Grep `|| true`, `|| echo`, `continue-on-error` trong workflow ⇒ **0 hit** quanh bước gate
- **AC2:** Cố tình làm fail 1 gate (ví dụ thêm `syntax error` tạm) ⇒ CI đỏ — **bằng chứng bắt buộc**
- **AC3:** Coverage threshold có trong config, và fail khi dưới ngưỡng
- **AC4:** `entrypoint.sh` exit ≠ 0 khi env bắt buộc thiếu

### 5. Phản biện bắt buộc
- **PB1:** Đây là **negative test bắt buộc** — không có nó thì gate chưa được kiểm chứng. Chạy và dán output CI đỏ.
- **PB2:** Có bước nào vẫn cho pass khi lỗi không? Đọc `if:` / `unless:` trong workflow
- **PB3:** BE test chạy trên SQLite trong CI sẽ hỏng vì `array_agg` — CI dùng Postgres chứ?

### 6. Test bắt buộy
1 test ghi: tạo file Python sai cú pháp ⇒ `manage.py check` exit ≠ 0
1 test ghi: `tsc` với type error ⇒ exit ≠ 0
Cả 2 dán output vào evidence.

### 7. Bằng chứng
`docs/evidence/SAFE-07/` — `negative-test.md` (CI đỏ thật) · `gates.md`

### 8. Gate
GT11 · GT10

### 9. Lệ thuộc
Tất cả slice wave 0 khác (để gate chạy được nội dung thật)

### 10. Rollback
Revert workflow. Nhưng gate yếu là rủi ro bảo mật — ghi rõ trong rollback.md.

### 11. Ngoài phạm vi
Thêm GitHub secret scanning / Dependabot (khả năng repo, đề xuất sau)

---

# WAVE 1 — TENANT ISOLATION

> **Mục tiêu:** đóng triệt để 3 đường rò rỉ tenant: analytics leak, FE/BE storage mismatch, broker config không tenant.

## TEN-01 — Một tenant resolver duy nhất

**Ước lượng:** 4 ed · **Phụ thuộc:** Wave 0 · **Rủi ro nếu làm 90%:** vẫn 2 resolver ⇒ vẫn lệch

### 1. Mục tiêu
Một nguồn tenant duy nhất theo D-02.

### 2. Phạm vi
**Được chạm:** `identity_access/middleware.py`, `user_workspace/permissions.py`, `identity_access/utils/resolve_tenant.py`, file test

### 3. Yêu cầu
- **R1:** `resolve_active_tenant(request)` là hàm **duy nhất**; `permissions.py` phải gọi hàm này, không tự resolve
- **R2:** `X-Tenant-ID` (public_id) là nguồn; `?tenant=` và `X-Tenant-Code` deprecate sau 1 release
- **R3:** Không resolve được ⇒ `request.tenant = None` + **fail-closed** (endpoint tài chính trả 403)
- **R4:** Sửa 2 `NameError` trong `middleware.py:305-407`: `CoreTenant` và `logger` chưa import
- **R5:** Deprecate path cũ trả header `Deprecation` + log warning đếm usage

### 4. Tiêu chí nghiệm thu
- **AC1:** Đếm nơi resolve tenant — grep trả **1** định nghĩa
- **AC2:** Reproduce 2 `NameError` (`middleware.py:311`, `:407`) cũ không còn xảy ra
- **AC3:** `?tenant=` cũ vẫn chạy nhưng log warning; sau release sẽ bị từ chối
- **AC4:** Endpoint tài chính + tenant không resolve ⇒ 403, **không** phải 500

### 5. Phản biện bắt buộc
- **PB1:** Header `X-Tenant-ID` chứa tenant user **không thuộc** ⇒ resolver có kiểm tra membership không? Đây là câu hỏi bảo mật quan trọng nhất của slice
- **PB2:** Gửi cả `X-Tenant-ID` và `X-Tenant-Code` xung đột ⇒ thắng cái nào? Tài liệu đã nói chưa
- **PB3:** Còn chỗ nào đọc `sessionStorage`/`localStorage` tenant trực tiếp không?

### 6. Test bắt buộc
`test_tenant_resolver.py` — 8 case: header hợp lệ · header không tồn tại ⇒ None · **header của tenant không thuộc ⇒ 403** · header + query xung đột · 2 header xung đột · legacy path log warning · fail-closed endpoint tài chính · middleware NameError paths

### 7. Bằng chứng
`docs/evidence/TEN-01/` — `gates.md` · `tests.md` · `pb-answers.md` (PB1 bắt buộc có **bằng chứng runtime**)

### 8. Gate
GT6 GT9 GT10 GT14

### 9. Lệ thuộc
Wave 0 xong

### 10. Rollback
Revert — nhưng cần đồng bộ cả FE (TEN-02)

### 11. Ngoài phạm vi
Tenant membership management (đã có ở `tenantreg-*`) · Quota enforcement (defer)

---

## TEN-02 — FE tenant SSOT (`tenantIdStorage`)

**Ước lượng:** 3 ed · **Phụ thuộc:** TEN-01

### 1. Mục tiêu
FE và BE dùng **cùng một** nguồn tenant. Đây là slice chặn bug "sai tenant hiển thị dữ liệu".

### 2. Phạm vi
**Được chạm:** `packages/web/src/context/PortfolioContext.js`, `packages/web/src/adapters/core/transport.js`, `packages/web/src/adapters/coreApiAdapter.js`, file test
**KHÔNG được chạm:** `package.json`

### 3. Yêu cầu
- **R1:** Mọi đọc/ghi tenant đi qua `tenantIdStorage` — không có chỗ nào đọc `localStorage`/`sessionStorage` trực tiếp
- **R2:** `switchTenant()` **phải** gọi `tenantIdStorage.setTenantId()` — hiện không có call site
- **R3:** `transport.js` đọc từ `tenantIdStorage`, không đọc `sessionStorage` trực tiếp
- **R4:** Đồng bộ **cross-tab** bằng `storage` event (đã có listener ở `PortfolioContext.js:242-252`)
- **R5:** `activeTenantId` trong context **luôn** khớp giá trị mà transport gửi

### 4. Tiêu chí nghiệm thu
- **AC1:** Grep `localStorage.getItem('.*tenant` / `sessionStorage.getItem('.*tenant` trong `packages/web/src/` ⇒ **0 hit** ngoài `tenantIdStorage`
- **AC2:** Test: `switchTenant('B')` ⇒ request kế tiếp có header `X-Tenant-ID` = B của tenant B
- **AC3:** Mở 2 tab, đổi tenant ở tab 1 ⇒ tab 2 cập nhật
- **AC4:** Test: sau `switchTenant`, header **không** phải giá trị cũ

### 5. Phản biện bắt buộc
- **PB1:** Reproduce bug gốc: set `localStorage` tay ⇒ header gửi đi là gì? Nếu vẫn sai ⇒ R3 chưa đạt
- **PB2:** Xoá `localStorage` (user clear) ⇒ app có fallback hợp lệ không, hay crash?
- **PB3:** Logout có xoá tenant không? Cần để user sau đó đăng nhập thấy tenant cũ không

### 6. Test bắt buộy
`tenant-storage-ssot.test.tsx` — 5 case: switch tenant đổi header · không đọc storage trực tiếp · cross-tab sync · clear storage không crash · logout xoá tenant

### 7. Bằng chứng
`docs/evidence/TEN-02/` — kèm **DevTools Network screenshot** cho thấy header đổi đúng sau `switchTenant`

### 8. Gate
GT1 GT2 GT3 GT4 ×3 GT5

### 9. Lệ thuộc
TEN-01 (BE contract đã chốt)

### 10. Rollback
Revert FE. Nhưng lưu ý BE đã đổi ⇒ rollback lệch version contract.

### 11. Ngoài phạm vi
React Query invalidation cross-tenant (đã có `QueryProvider.tsx`) · Tenant admin pages (đã có)

---

## TEN-03 — `BrokerConnection` có `tenant_id`

**Ước lượng:** 4 ed · **Phụ thuộc:** TEN-01

### 1. Mục tiêu
`UserBrokerConfig` phải scope theo tenant, không chỉ theo user.

### 2. Phạm vi
**Được chạm:** `user_workspace/models.py`, migration mới, `views_broker.py`, file test

### 3. Yêu cầu
- **R1:** Thêm `tenant_id` FK (NOT NULL) vào `UserBrokerConfig` — hiện không có (`models.py:452-540`)
- **R2:** Unique constraint theo `(tenant, user, provider, label)`
- **R3:** Migration **expand → backfill → verify → cutover → contract** (D-24)
- **R4:** Backfill: `tenant` lấy từ portfolio gần nhất, **không** đoán; không xác định ⇒ đưa vào bảng quarantine + báo
- **R5:** `NOT NULL` chỉ đặt **sau** khi verify backfill = 0 dòng null (contract phase)
- **R6:** Reverse chỉ revert row do chính migration backfill (có marker `backfilled_by`)

### 4. Tiêu chí nghiệm thu
- **AC1:** Migration chạy được trên DB **có dữ liệu thật** (không chỉ DB rỗng)
- **AC2:** Sau backfill: `SELECT count(*) FROM broker_config WHERE tenant_id IS NULL` = **0**, hoặc số dư đã vào quarantine kèm báo cáo
- **AC3:** Cùng `(user, provider, label)` ở 2 tenant khác nhau ⇒ tạo được 2 bản ghi
- **AC4:** Tenant A không đọc được config của tenant B
- **AC5:** Migration có marker `backfilled_by` ở mỗi row nó backfill

### 5. Phản biện bắt buộc
- **PB1:** Chạy migration trên DB **copy** của production có dữ liệu. Kết quả? (Không được chỉ chạy trên DB rỗng)
- **PB2:** Có `UserBrokerConfig` nào không thuộc tenant nào không? Xử lý thế nào, có để lọt NULL không?
- **PB3:** Migration `0017` đã copy credential **theo user**. Sau khi thêm tenant, có credential nào bị nhân bản không?

### 6. Test bắt buộy
`test_broker_config_tenant.py` — 6 case: tạo 2 tenant cùng user/provider/label OK · tenant A không đọc B · backfill đúng · quarantine hoạt động · NOT NULL chặn NULL · rollback chỉ revert row backfill

### 7. Bằng chứng
`docs/evidence/TEN-03/` — kèm **SQL output** đếm dòng null trước/sau backfill

### 8. Gate
GT6 GT7 GT8 GT9 GT14

### 9. Lệ thuộc
TEN-01. **Serialize với LED-05** (cùng đụng `user_workspace/migrations/`).

### 10. Rollback
Mỗi phase có rollback riêng. Contract phase (NOT NULL) **không** rollback an toàn nếu đã có dữ liệu mới.

### 11. Ngoài phạm vi
Credential cutover (BRK-01) · `secret_version` (BRK-02)

---

## TEN-04 — Đóng leak analytics cross-tenant

**Ước lượng:** 4 ed · **Phụ thuộc:** TEN-01 · **Ưu tiên cao nhất Wave 1**

### 1. Mục tiêu
Đóng lỗ hổng P0 đã **reproduce được HTTP 200**: analytics chỉ lọc user, không lọc tenant.

### 2. Phạm vi
**Được chạm:** `user_workspace/portfolio_analytics_views.py`, file test
**Ghi chú:** file này 2851 dòng — chỉ sửa **phần portfolio analytics** (`:25-306`), **không** đụng phần AI Advisory/Screener

### 3. Yêu cầu
- **R1:** `_get_user_portfolio()` phải lọc `pk + user + tenant` — hiện chỉ `pk + user` (`:25-27`)
- **R2:** Mọi view analytics dùng `TenantScopePermission` — hiện `IsAuthenticated`
- **R3:** Áp dụng cho **tất cả**: holdings, summary, chart, equity-curve, allocation, analytics, technicals, sync
- **R4:** Tenant không resolve ⇒ `403`, không phải trả data
- **R5:** Bổ sung test cross-tenant cho từng endpoint — hiện test chỉ chứng minh user ownership

### 4. Tiêu chí nghiệm thu
- **AC1:** **Probe bắt buộc** — user thuộc Tenant A+B, header chọn B, đọc portfolio của A ⇒ **404** (không phải 200)
- **AC2:** Chạy probe trên **cả 8 endpoint** analytics ⇒ 8/8 trả 404
- **AC3:** Cùng user, đúng tenant ⇒ 200 với data đúng
- **AC4:** Không header tenant ⇒ 403
- **AC5:** Test suite có case cho từng endpoint (không chỉ 1 endpoint tổng)

### 5. Phản biện bắt buộc
- **PB1:** Chạy lại **đúng probe đã dùng để phát hiện bug** (`AUDIT…:§1.4`) — kết quả phải là 404. Dán output.
- **PB2:** Còn endpoint nào dùng helper cũ không? Grep toàn repo `_get_user_portfolio`
- **PB3:** Endpoint lồng nhau (ví dụ `/screener` gọi analytics) có bị sót không?
- **PB4:** Cache có thể trả kết quả của tenant B cho tenant A không? Cần kiểm tra cả cache key (TEN-06)

### 6. Test bắt buộy
`test_portfolio_analytics_tenant_isolation.py` — **10 case** (8 endpoint × cross-tenant + no-tenant + same-tenant)
**Bắt buộc:** dán output probe script, không chỉ test result.

### 7. Bằng chứng
`docs/evidence/TEN-04/` — `probe-output.md` (output script, 8 dòng) · `gates.md` · `pb-answers.md`

### 8. Gate
GT6 GT9 GT10 GT14

### 9. Lệ thuộc
TEN-01

### 10. Rollback
Revert — **rollback làm lỗ hổng quay lại**. Ghi rõ trong rollback.md: chỉ rollback kèm việc tắt route analytics ở reverse proxy.

### 11. Ngoài phạm vi
Cache tenant key (TEN-06) · Sửa file 2851 dòng thành module nhỏ hơn (defer, nhưng ghi vào tech debt)

---

## TEN-05 — Sửa migration `0008`

**Ước lượng:** 3 ed · **Phụ thuộc:** không · **Serialize:** phải xong **trước** LED-05

### 1. Mục tiêu
Migration `0008` fail vì query field không tồn tại, chặn deploy.

### 2. Phạm vi
**Được chạm:** `user_workspace/migrations/0008_backfill_transaction_subaccount_tenant.py` (hoặc tạo migration sửa thay vì sửa migration cũ — xem R2), `0019_pf4_tenant_and_financial_guards.py`, file test

### 3. Yêu cầu
- **R2 (quan trọng):** Migration đã chạy ở môi trường nào thì **không sửa**. Tạo migration mới để sửa. Chỉ sửa `0008` nếu chưa từng chạy ở bất kỳ đâu
- **R3:** Lỗi gốc: `TenantMember.objects.filter(..., is_active=True)` tại `:74` — field `is_active` không tồn tại trong historical model (`identity_access/migrations/0004_tenantmember_tenantinvite.py:17-27`)
- **R4:** Sửa bằng cách dùng field thực sự tồn tại ở thời điểm đó, hoặc bỏ điều kiện đó
- **R5:** Tuân thủ D-24: chỉ revert row do chính migration backfill, có marker
- **R6:** **Không `print()` tiếng Việt có dấu** trong migration — `UnicodeEncodeError` trên cp1252 đã làm fail giữa chừng (bài học đã ghi trong AGENTS.md). Dùng `logger`

### 4. Tiêu chí nghiệm thu
- **AC1:** Fresh DB: migrate tới `0007`, tạo Transaction/SubAccount tenantless, migrate tới head ⇒ **exit 0**
- **AC2:** Seeded DB (có dữ liệu) ⇒ exit 0 — **bằng chứng chính là AC này**
- **AC3:** `migrate --plan` trên DB có dữ liệu không còn bước lỗi
- **AC4:** Không có `print()` có dấu trong file migration (grep `\(` sau print)

### 5. Phản biện bắt buộc
- **PB1:** Reproduce **đúng** kịch bản đã ghi: fresh → `0007` → tạo data tenantless → migrate head. Dán output lỗi trước, output thành công sau.
- **PB2:** Migration đã chạy ở môi trường nào chưa? Kiểm tra `django_migrations` table trên DB thật. Nếu đã chạy ⇒ bắt buộc tạo migration mới.
- **PB3:** Có migration nào khác cùng lỗi pattern không? Grep `is_active` trong tất cả migration.

### 6. Test bắt buộy
1. `test_migration_0008_fresh_empty.py` — DB rỗng tới head
2. `test_migration_0008_with_data.py` — **DB có dữ liệu tenantless** tới head
3. `test_no_unicode_print_in_migrations.py` — static check

### 7. Bằng chứng
`docs/evidence/TEN-05/` — `repro-before.md` (lỗi) · `repro-after.md` (thành công) · kèm `SELECT * FROM django_migrations` thật

### 8. Gate
GT6 GT7 GT8 GT9 GT14

### 9. Lệ thuộc
**Không.** Nhưng phải **serialize trước LED-05**.

### 10. Rollback
Nếu tạo migration mới: revert migration mới. Nếu sửa `0008`: chỉ khi chưa chạy ở đâu.

### 11. Ngoài phạm vi
`0012` còn để `blank=True` (audit ghi) — xử lý trong LED-05

---

## TEN-06 — Cache key có `tenant_id`

**Ước lượng:** 3 ed · **Phụ thuộc:** TEN-01, TEN-04

### 1. Mục tiêu
Cache không bao giờ trả dữ liệu tenant này cho tenant khác.

### 2. Phạm vi
**Được chạm:** `user_workspace/ledger/services.py`, mọi chỗ set/get cache liên quan tenant, file test

### 3. Yêu cầu
- **R1:** **Mọi** cache key chứa `tenant_id` — grep toàn repo chỗ gọi cache
- **R2:** Key dạng `ledger:{version}:{tenant_id}:{portfolio_id}:{fingerprint}`
- **R3:** Kiểm tra tenant **trước** khi đọc cache và trước khi ghi
- **R4:** TTL theo D-28 (freshness SLA) — không dùng chung TTL cho mọi provider
- **R5:** Cache hit trả kèm `meta.cache_hit = true` để audit thấy

### 4. Tiêu chí nghiệm thu
- **AC1:** Cache cùng portfolio id nhưng 2 tenant khác nhau ⇒ 2 key khác nhau
- **AC2:** Test: gọi endpoint bằng tenant A (cache đầy) rồi tenant B ⇒ B thấy data của B, không phải A
- **AC3:** Grep cache key không có `tenant_id` ⇒ 0 hit
- **AC4:** `meta.cache_hit` đúng

### 5. Phản biện bắt buộc
- **PB1:** Test trên **cùng user thuộc 2 tenant** đọc **cùng portfolio id**? Portfolio id là global pk nên khó khớp — nhưng cache key dựa trên đó thì nguy hiểm. Kiểm tra.
- **PB2:** Có cache nào ở tầng khác (Redis trực tiếp, HTTP cache header) không? Grep `Cache-Control`, `Vary`
- **PB3:** TTL của từng provider đúng theo D-28 chứ?

### 6. Test bắt buộy
`test_cache_tenant_isolation.py` — 5 case: 2 tenant 2 key · không rò dữ liệu qua cache · cache key có tenant · TTL đúng provider · `cache_hit` flag

### 7. Bằng chứng
`docs/evidence/TEN-06/` — kèm **Redis `KEYS` output** cho thấy key có tenant

### 8. Gate
GT6 GT9 GT14

### 9. Lệ thuộc
TEN-01, TEN-04

### 10. Rollback
Revert + flush cache. Nhớ flush Redis khi rollback (cache cũ format vẫn còn).

### 11. Ngoài phạm vi
CDN/HTTP cache (chưa có) · Cache phân tầng (defer)

---

## Checklist đóng Wave 1

Không sang Wave 2 nếu **một** dòng sau chưa đạt:

- [ ] Probe cross-tenant: **0/500** request lọt (dán output script)
- [ ] 8/8 endpoint analytics trả 404 khi sai tenant
- [ ] Migration `0008` chạy được trên DB **có dữ liệu**
- [ ] `UserBrokerConfig` backfill: 0 dòng null hoặc đã quarantine kèm báo cáo
- [ ] Grep tenant resolver: **1** định nghĩa
- [ ] FE: `switchTenant` đổi header thật (có ảnh Network)
- [ ] Grep cache key không `tenant_id`: 0 hit
- [ ] GT1–GT11 xanh (trừ GT12/GT13 — chưa tới wave FE)
- [ ] `docs/evidence/TEN-*/audit.md`: 0 lỗi, confidence high

---

*Tiếp theo: `docs/PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md` (Wave 2, 3)*
