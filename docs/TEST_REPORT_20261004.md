# TEST_REPORT — Audit + remediation `vninvest`

**Ngày:** 2026-10-04 · **Branch:** `feat/openwork-ow02-03-04` · **Base:** `dc65b342a`
**Quy trình:** `multi-agent-workflow` Mode B · Stage 6

Môi trường: Windows, PowerShell 7, Python 3.13, Django 6, **PostgreSQL thật**
`127.0.0.1:5433`, **Redis thật** `127.0.0.1:6380`. Không SQLite (migration
`9000_auth_user_email_ci_unique` dùng `array_agg`).

Lệnh chạy từ `packages/core/backend`:
```
manage.py test <labels> -v 1 --keepdb
```

---

## 1. Kết quả từng cổng

| # | Cổng | Lệnh | Kết quả |
|---|---|---|---|
| 1 | Test mới — quota refund | `manage.py test tests.test_advisory_quota_security` | **Pass** — 6/6 |
| 2 | Test mới — VNPay fail-closed | `manage.py test tests.test_vnpay_ipn_security` | **Pass** — 6/6 |
| 3 | Test mới — support tenant guard | `manage.py test tests.test_support_ticket_tenant_guard` | **Pass** — 1/1 |
| 4 | SAML (đã có + 2 test mới) | `manage.py test identity_access.tests.test_saml_signature_mode identity_access.tests.test_saml_sso` | **Pass** — 51/51 |
| 5 | Regression vùng đã sửa | 10 module (xem §3) | **Pass** — 110/110 |
| 6 | Gate tổng hợp | `node scripts/pre-push-gate.mjs` | **Pass** — 15 PASS / 0 SKIP / 0 FAIL, exit 0 |
| 7 | Hook push hợp lệ | `bash -n .githooks/pre-push` | **Pass** — exit 0 |
| 8 | Claim hợp lệ | `node packages/web/scripts/check-multi-agent.mjs` | **Pass** — 0 lỗi, 0 trùng số migration |
| 9 | Quét secret | `node packages/web/scripts/scan-secrets.mjs` | **Pass** — 3601 tracked, 3459 scanned, 0 secret |

## 2. Bằng chứng fail-before (Hazard 10)

Mỗi fix đều được chứng minh **fail trước, pass sau**:

| Fix | Bằng chứng |
|---|---|
| Refund quota cho member | Chạy trên **chính logic cũ** → `AssertionError: 1 != 0`; sau fix → `OK` |
| Heuristic SAML `sys.argv` | Script đối chiếu 5 dạng argv: code cũ hạ `noop` **5/5** (`/srv/latest/bin/gunicorn`, `manage.py contest`, `manage.py protest`, `/opt/pytest/bin/pytest`, `/opt/mytest/venv/bin/python`); code mới **0/5** |
| `SKIP_PRE_PUSH_GATE=1` | Trước: im lặng. Sau: in `Day KHONG phai PASS` ra stderr |
| Gate thiếu file | `SKIP audit-status` **được gọi tên** + `1 FAIL ... CHAN PUSH` |

## 3. Negative test cho từng gate

| Cổng | Kích thích vi phạm | Kết quả mong đợi | Thực tế |
|---|---|---|---|
| `pre-push-gate` | `SKIP_PRE_PUSH_GATE=1` | cảnh báo, không giả vờ PASS | **Đúng** |
| `pre-push-gate` | đổi tên 1 gate file | SKIP gọi tên + FAIL chặn push | **Đúng** |
| hook push | `bash -n` | exit 0 | **Đúng** |
| `pre-push-gate.mjs` | `node --check` | exit 0 | **Đng** |

## 4. Cổng chạy bởi agent độc lập

| Cổng | Kết quả |
|---|---|
| Regression surface (module đã đụng) | **120 passed** |
| Full suite `manage.py test tests` | **643 passed / 18 failed** |
| Cùng full suite tại base `dc65b342a` | **18 failed — giống hệt** |
| Kết luận | **Không regression nào do 5 commit này** |

## 5. `CHƯA CHẠY` — không báo PASS cho những thứ này

| Mục | Lý do |
|---|---|
| `pytest backend/src` (toàn bộ `src/*/tests`) | **>30 phút, không xong.** Bao gồm 2104 test mà `manage.py test` không chạy |
| `run_tests.py identity_access` | **>15 phút, không xong** |
| `run_tests.py` (642 + 2104) | **CHƯA CHẠY** |
| `npm run build` / `lint` / `test` | **CHƯA CHẠY** |
| `mypy` / `ruff` | **CHƯA CHẠY** |
| `npm audit` / `pip-audit` | **CHƯA CHẠY** |
| Migration trên DB **đã có dữ liệu** | **CHUA CHẠY.** Không thay đổi schema trong phiên này, nhưng cũng chưa chứng minh được migration nào chạy được trên DB có số liệu |
| Gate frontend (vitest/e2e) | **CHƯA CHẠY** |

## 6. Fail có sẵn, không do commit này

| Lỗi | Bằng chứng |
|---|---|
| `tests.test_quota_period_accumulation` — 4 fail | Chạy lại trên `HEAD` unmodified qua `git stash`: **cùng 4 lỗi**. Liên quan bộ đếm Redis |
| Full suite — 18 fail | Giống hệt ở base `dc65b342a` (do agent độc lập chạy) |

**Ghi chú môi trường:** `settings.py:423` mặc định `REDIS_URL=redis://localhost:6379/1`
nhưng dev compose publish `6380:6379`. Không set `REDIS_URL` thì cache rơi về
LocMem và các test đếm sẽ fail. **Chưa sửa** — `compose.*.env.example` nằm trong
deny list.

## 7. Verdict

| Cổng 5→6 | Yêu cầu | Thực tế |
|---|---|---|
| Mọi dòng cổng | `Pass` hoặc `CHƯA CHẠY` được chấp nhận | 9 `Pass` · 8 `CHƯA CHẠY` ghi rõ lý do |
| Audit code | 0 blocker + 0 major | Vòng 1: **3 blocker** → đã sửa → vòng 2 xem `docs/REPORT_FINAL_20261004.md` |

**Kết luận trung thực:** mọi thứ **đã kiểm chứng chạy được** đều pass. Phần lớn
bề mặt kiểm thử **chưa chạy** — nổi bật là 2104 test trong `src/*/tests/` mà
đường push hiện tại không bao giờ chạy tới.