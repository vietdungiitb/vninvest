# Run Spec Audit — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## Mục tiêu

Đối chiếu từng requirement (R1–R14) từ Traceability Matrix với implementation thực tế. Mỗi item phải có: trạng thái PASS / FAIL / PARTIAL, file evidence, và lệnh verify.

---

## Audit R1 — DNSE historical tape có thể fetch cho bất kỳ ngày giao dịch nào

**Spec**: `fetch_intraday_tape_history(symbol, trade_date)` trả về list ticks cho ngày bất kỳ.

**Verify**:
```powershell
grep -n "def fetch_intraday_tape_history" packages/core/backend/src/market_data/vnbroker_adapter.py
```

Kỳ vọng: hàm tồn tại với đúng signature.

**Evidence file**: `market_data/vnbroker_adapter.py`

---

## Audit R2 — DNSE API key/secret lưu mã hóa

**Spec**: `api_key_encrypted` và `api_secret_encrypted` là BinaryField, encrypt bằng Fernet.

**Verify**:
```powershell
grep -A 10 "class UserDNSECredential" packages/core/backend/src/identity_access/models.py
```

Kỳ vọng: fields type = `BinaryField`.

```powershell
python manage.py test identity_access.tests.test_dnse_credential.EncryptionTests.test_encrypt_decrypt_roundtrip --keepdb
```

---

## Audit R3 — Tối đa 1 credential là system provider

**Spec**: `UniqueConstraint` on `is_system_provider=True`.

**Verify**:
```powershell
grep -A 10 "class Meta" packages/core/backend/src/identity_access/models.py | grep -A 5 "unique_active_system_provider"
```

Kỳ vọng: constraint tên `unique_active_system_provider` tồn tại.

---

## Audit R4 — Non-admin không được set is_system_provider

**Spec**: Endpoint `set-system-provider` phải check `is_staff`.

**Verify**:
```powershell
grep -B 2 -A 10 "set.system.provider\|IsAdminUser" packages/core/backend/src/identity_access/views.py
```

Kỳ vọng: `permission_classes` hoặc explicit `if not request.user.is_staff`.

---

## Audit R5 — System backfill abort khi không có system provider

**Spec**: Task trả `{status: 'aborted', reason: 'no_system_provider'}` khi không có credential.

**Verify**:
```powershell
grep -A 5 "no_system_provider\|aborted" packages/core/backend/src/data_ingest/tasks.py
```

Test: `data_ingest.tests.test_backfill_tasks.SystemBackfillTests.test_system_backfill_aborts_no_credential`

---

## Audit R6 — System backfill idempotent

**Spec**: Presence check — skip nếu đã có data cho symbol+date.

**Verify**:
```powershell
grep -n "dates_skipped_already_exists\|\.exists()" packages/core/backend/src/data_ingest/tasks.py
```

Test: `test_system_backfill_idempotency`

---

## Audit R7 — User backfill rate limit 5 req/ngày

**Spec**: HTTP 429 tại request thứ 6.

**Verify**:
```powershell
grep -n "UserBackfillThrottle\|user_whale_backfill" packages/core/backend/src/vninvest_core/settings.py
grep -n "throttle_classes\|UserBackfillThrottle" packages/core/backend/src/data_ingest/views.py
```

Test: `test_user_backfill_rate_limit_429`

---

## Audit R8 — User backfill skip ngày đủ data

**Spec**: >= 100 ticks → `dates_skipped_system_has_data += 1`.

**Verify**:
```powershell
grep -n "DNSE_PRESENCE_THRESHOLD\|dates_skipped_system_has_data\|>= 100" packages/core/backend/src/data_ingest/tasks.py
```

Test: `test_user_backfill_skips_sufficient_dates`

---

## Audit R9 — Detection task filter đúng ngày lịch sử

**Spec**: `detect_and_store_global_whale_alerts(symbol, session_date='2026-05-10')` filter IntradayTick theo date.

**Verify**:
```powershell
grep -A 20 "def detect_and_store_global_whale_alerts" packages/core/backend/src/signal_intelligence/tasks.py | grep -E "session_date|parse_date|filter"
```

Test: `test_detect_with_session_date_filters_correctly`

---

## Audit R10 — Frontend qua coreApiAdapter

**Spec**: Không direct fetch trong component mới.

**Verify**:
```powershell
grep -rn "axios\.\|fetch(" packages/web/src/components/soc/WhaleBackfillPanel.jsx packages/web/src/components/settings/DNSECredentialTab.jsx packages/web/src/components/whale/SymbolBackfillTrigger.jsx
```

Kỳ vọng: 0 match.

---

## Audit R11 — Text UI qua i18n

**Spec**: Không hardcode Vietnamese string trong JSX component mới.

**Verify**:
```powershell
grep -rn '"Kết nối\|"Bắt đầu\|"Xóa\|"Xác minh\|"Tải lịch sử' packages/web/src/components/soc/WhaleBackfillPanel.jsx packages/web/src/components/settings/DNSECredentialTab.jsx packages/web/src/components/whale/SymbolBackfillTrigger.jsx
```

Kỳ vọng: 0 match.

---

## Audit R12 — Credentials không trong logs

**Verify**:
```powershell
grep -rn "api_key\|api_secret" packages/core/backend/src --include="*.py" | Where-Object { $_ -match "log\.|print\|logger" }
```

Kỳ vọng: 0 match.

---

## Audit R13 — Auto-trigger detection sau backfill insert

**Spec**: Mỗi date insert thành công → `detect_and_store_global_whale_alerts.delay(symbol, session_date=date)`.

**Verify**:
```powershell
grep -n "detect_and_store_global_whale_alerts.delay\|detect_and_store.*delay" packages/core/backend/src/data_ingest/tasks.py
```

Kỳ vọng: call xuất hiện trong loop insert.

---

## Audit R14 — Burst rate limit

**Spec**: 1/120s burst (second request trong 2 phút cùng user → 429).

**Verify**:
```powershell
grep -n "120\|2min\|burst\|UserBackfillBurstThrottle" packages/core/backend/src/data_ingest/views.py packages/core/backend/src/vninvest_core/settings.py
```

---

## Summary table

| Req | Status | Evidence |
|---|---|---|
| R1 | | |
| R2 | | |
| R3 | | |
| R4 | | |
| R5 | | |
| R6 | | |
| R7 | | |
| R8 | | |
| R9 | | |
| R10 | | |
| R11 | | |
| R12 | | |
| R13 | | |
| R14 | | |

**Ngày audit**:
**Auditor**:
**Kết quả tổng**: ALL PASS / PARTIAL PASS / FAIL
**Open items**:
