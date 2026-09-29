# Self Audit and Test Protocol — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## 1. Mục tiêu audit

Đảm bảo implementation:
1. Tuân thủ SSOT rule: tất cả DNSE historical fetch qua `vnbroker_adapter.py`.
2. Credential an toàn: mã hóa, không log, không expose qua API.
3. Idempotency: chạy backfill nhiều lần không sinh duplicate.
4. Detection trigger đúng: sau mỗi date insert, whale detection chạy cho phiên đó.
5. Rate limit enforce: user không bypass 5/day limit.
6. Shared data: user backfill ghi vào shared DB, không tạo silo.
7. Backwards compatible: detection task không phá behavior hiện tại.

---

## 2. Checklist bắt buộc trước khi đánh dấu DONE

### A. Adapter SSOT (D01)
- [ ] `fetch_intraday_tape_history` tồn tại trong `market_data/vnbroker_adapter.py`
- [ ] Grep `from vnbroker` và `import DNSEQuote` trong toàn bộ codebase (ngoài adapter) → 0 match
- [ ] Timestamp VN 09:30:00 → UTC 02:30:00 (kiểm tra bằng test T-A2)
- [ ] API error → return `[]` không raise (T-A3)
- [ ] `api_key`/`api_secret` không xuất hiện trong Django logs khi adapter được gọi

### B. Credential model (D02)
- [ ] `identity_access_user_dnse_credential` table tồn tại sau migrate
- [ ] Unique constraint `unique_active_system_provider` được enforce
- [ ] GET `/core/v1/user/dnse-credential/` response KHÔNG chứa `api_key` hay `api_secret`
- [ ] `encrypt_dnse_credential` → `decrypt_dnse_credential` round-trip trả về giá trị gốc
- [ ] `DNSE_CREDENTIAL_FERNET_KEY` được generate bằng `Fernet.generate_key()` (32-byte base64)
- [ ] `compose.dev.env` và `compose.prod.env.example` có key `DNSE_CREDENTIAL_FERNET_KEY`

### C. System backfill (D03)
- [ ] Task gọi với no system provider → return `{'status': 'aborted', 'reason': 'no_system_provider'}`
- [ ] Chạy task 2 lần cùng symbol/date → `dates_inserted` = 0 lần 2 (idempotency)
- [ ] `ServiceRunLog.output_summary` chứa `ticks_inserted`, `dates_inserted`, `dates_skipped_already_exists`
- [ ] Endpoint `/core/v1/data-ingest/trigger/whale-backfill/` trả 202 với `task_id`
- [ ] Non-admin user gọi endpoint → HTTP 403
- [ ] `detect_and_store_global_whale_alerts` được trigger với `session_date` param sau mỗi insert

### D. User backfill (D04)
- [ ] Gọi 6 lần cùng user trong ngày → lần thứ 6 nhận HTTP 429
- [ ] User không có credential gọi backfill → HTTP 400 với `code: 'no_dnse_credential'`
- [ ] Symbol có >= 100 ticks → `dates_skipped_system_has_data` tăng 1
- [ ] Records được insert có `source='dnse_user'`
- [ ] `detect_and_store_global_whale_alerts` được trigger sau user insert

### E. Detection historical (D05)
- [ ] `detect_and_store_global_whale_alerts(symbol='HPG', session_date='2026-05-10')` filter đúng `IntradayTick` ngày 2026-05-10
- [ ] `detect_and_store_global_whale_alerts(symbol='HPG')` (không có session_date) vẫn hoạt động như cũ
- [ ] Existing tests không bị phá

### F. Frontend (D07)
- [ ] `npm run build` PASS không warning mới
- [ ] Grep `'DNSE'` và `"kết nối"` trong components → tất cả qua i18n key
- [ ] Grep `direct fetch` / `axios.` / `fetch(` trong component mới → 0 match
- [ ] Khi API trả 429, UI hiển thị message `"Bạn đã đạt giới hạn 5 lần/ngày. Thử lại vào ngày mai."`

---

## 3. Test categories bắt buộc

### Unit tests

```powershell
Push-Location ./packages/core/backend
python manage.py test market_data.tests.test_vnbroker_adapter_history --keepdb
python manage.py test identity_access.tests.test_dnse_credential --keepdb
python manage.py test data_ingest.tests.test_backfill_tasks --keepdb
python manage.py test signal_intelligence.tests.test_detect_historical --keepdb
Pop-Location
```

### Integration smoke

```powershell
# Kiểm tra model tồn tại
docker exec vninvest-dev-core-api python -c "
import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','vninvest_core.settings')
django.setup()
from identity_access.models import UserDNSECredential
print('Table OK, rows:', UserDNSECredential.objects.count())
"

# Kiểm tra task đã đăng ký
docker exec vninvest-dev-core-worker celery -A vninvest_core inspect registered \
  | grep -E "backfill_intraday_tick|detect_and_store"

# Kiểm tra adapter hàm mới
docker exec vninvest-dev-core-api python -c "
from market_data.vnbroker_adapter import fetch_intraday_tape_history
result = fetch_intraday_tape_history('HPG', '2026-01-10')  # No credentials → public
print('fetch returned:', type(result), 'len:', len(result))
"
```

### Security audit commands

```powershell
# Không có DNSEQuote import ngoài adapter
grep -r "DNSEQuote\|from vnbroker.explorer.dnse" ./packages/core/backend/src \
  --include="*.py" | grep -v vnbroker_adapter.py

# Không có api_key log
grep -r "api_key\|api_secret" ./packages/core/backend/src \
  --include="*.py" | grep -i "log\.\|print("
```

---

## 4. Slice completion gate (bắt buộc trước khi sang slice tiếp theo)

```
[ ] Tests PASS cho slice hiện tại
[ ] `./start_dev.ps1` rebuild thành công và stack healthy
[ ] Evidence template điền đủ
[ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` cập nhật
[ ] `docs/TASKBOARD_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md` status → DONE
[ ] Commit riêng, push origin/dev
```
