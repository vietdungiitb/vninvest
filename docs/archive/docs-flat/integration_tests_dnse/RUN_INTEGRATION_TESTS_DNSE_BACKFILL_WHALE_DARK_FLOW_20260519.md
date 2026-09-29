# Run Integration Tests — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## Thiết lập môi trường

```powershell
# Đảm bảo DNSE_CREDENTIAL_FERNET_KEY có trong env
# Nếu chạy trong container:
docker exec vninvest-dev-core-api printenv DNSE_CREDENTIAL_FERNET_KEY

# Nếu chưa có, generate:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# → Thêm vào compose.dev.env: DNSE_CREDENTIAL_FERNET_KEY=<value>
# → Rebuild: .\start_dev.ps1
```

---

## Test file 1: Adapter SSOT

```powershell
# packages/core/backend/src/market_data/tests/test_vnbroker_adapter_history.py

Push-Location ./packages/core/backend
python manage.py test market_data.tests.test_vnbroker_adapter_history --keepdb -v 2
Pop-Location
```

### Test cases phải PASS

| ID | Test | Kỳ vọng |
|---|---|---|
| T-A1 | `test_fetch_intraday_tape_history_returns_list` | Returns list[dict] with timestamp/price/volume/side |
| T-A2 | `test_vn_to_utc_conversion` | VN 09:30:00 → UTC 02:30:00Z |
| T-A3 | `test_fetch_returns_empty_on_dnse_error` | DNSE exception → return [] (no raise) |
| T-A4 | `test_no_dnse_direct_import_outside_adapter` | grep check — fixture style |

### Skeleton test file

```python
# market_data/tests/test_vnbroker_adapter_history.py
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime, timezone, timedelta
from django.test import TestCase
from market_data.vnbroker_adapter import fetch_intraday_tape_history

class FetchIntradayTapeHistoryTests(TestCase):

    def _make_mock_df(self):
        return pd.DataFrame([{
            'time': '2026-05-10 09:30:00',
            'price': 25000.0,
            'volume': 1000,
            'side': 'buy',
            'match_type': 'LO',
        }])

    @patch('market_data.vnbroker_adapter.DNSEQuote')
    def test_returns_list_with_correct_shape(self, mock_quote_cls):
        mock_q = MagicMock()
        mock_q.intraday.return_value = self._make_mock_df()
        mock_quote_cls.return_value = mock_q
        result = fetch_intraday_tape_history('HPG', '2026-05-10')
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIn('timestamp', result[0])

    @patch('market_data.vnbroker_adapter.DNSEQuote')
    def test_vn_to_utc_conversion(self, mock_quote_cls):
        mock_q = MagicMock()
        mock_q.intraday.return_value = self._make_mock_df()
        mock_quote_cls.return_value = mock_q
        result = fetch_intraday_tape_history('HPG', '2026-05-10')
        ts = result[0]['timestamp']
        self.assertEqual(ts.tzinfo, timezone.utc)
        # VN 09:30 (UTC+7) = UTC 02:30
        self.assertEqual(ts.hour, 2)
        self.assertEqual(ts.minute, 30)

    @patch('market_data.vnbroker_adapter.DNSEQuote')
    def test_returns_empty_on_exception(self, mock_quote_cls):
        mock_q = MagicMock()
        mock_q.intraday.side_effect = Exception('DNSE timeout')
        mock_quote_cls.return_value = mock_q
        result = fetch_intraday_tape_history('HPG', '2026-05-10')
        self.assertEqual(result, [])
```

---

## Test file 2: Credential model

```powershell
Push-Location ./packages/core/backend
python manage.py test identity_access.tests.test_dnse_credential --keepdb -v 2
Pop-Location
```

### Test cases

| ID | Test | Kỳ vọng |
|---|---|---|
| T-B1 | `test_encrypt_decrypt_roundtrip` | Decrypt(Encrypt(key)) == key |
| T-B2 | `test_get_credential_response_no_keys` | GET response không có api_key_encrypted |
| T-B3 | `test_non_admin_cannot_set_system_provider` | HTTP 403 |
| T-B4 | `test_unique_system_provider_constraint` | IntegrityError khi set is_system_provider=True lần 2 |

---

## Test file 3: Backfill tasks

```powershell
Push-Location ./packages/core/backend
python manage.py test data_ingest.tests.test_backfill_tasks --keepdb -v 2
Pop-Location
```

### Test cases

| ID | Test | Kỳ vọng |
|---|---|---|
| T-C1 | `test_system_backfill_aborts_no_credential` | returns status='aborted' |
| T-C2 | `test_system_backfill_idempotency` | 2nd run → dates_inserted=0 |
| T-C3 | `test_user_backfill_rate_limit_429` | 6th request → HTTP 429 |
| T-C3b | `test_user_backfill_burst_rate_limit` | 2nd request in 2min → HTTP 429 |
| T-C4 | `test_user_backfill_skips_sufficient_dates` | >= 100 ticks → dates_skipped_system_has_data +=1 |
| T-C5 | `test_user_backfill_no_credential_returns_400` | HTTP 400 with code='no_dnse_credential' |
| T-C6 | `test_system_source_label` | inserted ticks have source='dnse_system' |
| T-C7 | `test_user_source_label` | inserted ticks have source='dnse_user' |

---

## Test file 4: Detection historical

```powershell
Push-Location ./packages/core/backend
python manage.py test signal_intelligence.tests.test_detect_historical --keepdb -v 2
Pop-Location
```

### Test cases

| ID | Test | Kỳ vọng |
|---|---|---|
| T-D1 | `test_detect_with_session_date_filters_correctly` | Only ticks on given date used |
| T-D2 | `test_detect_without_session_date_backward_compat` | Uses latest session, existing behavior |

---

## Full suite run

```powershell
Push-Location ./packages/core/backend
python manage.py test `
  market_data.tests.test_vnbroker_adapter_history `
  identity_access.tests.test_dnse_credential `
  data_ingest.tests.test_backfill_tasks `
  signal_intelligence.tests.test_detect_historical `
  --keepdb -v 2
Pop-Location
```

Kỳ vọng: `Ran 13 tests ... OK`

---

## Smoke test trên dev stack

```powershell
# Check migration applied
docker exec vninvest-dev-core-api python manage.py showmigrations identity_access | grep dnse

# Check new task registered
docker exec vninvest-dev-core-worker celery -A vninvest_core inspect registered | `
  grep -E "backfill_intraday_tick"

# Check endpoint accessible
$token = "Bearer <dev_token>"
Invoke-WebRequest -Uri "http://localhost:8100/core/v1/user/dnse-credential/" `
  -Headers @{Authorization=$token} -Method GET
# Kỳ vọng: 200 hoặc 404 (nếu chưa có credential)
```
