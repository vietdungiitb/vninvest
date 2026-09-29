# Backend Design — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## 1. Architecture layers

```
┌─────────────────────────────────────────────────────────────────┐
│  API Layer (DRF Views)                                          │
│  data_ingest/views.py                 identity_access/views.py  │
│  POST trigger/whale-backfill/         GET/POST/DELETE/PATCH     │
│                    │                   user/dnse-credential/    │
│                    │                         │                  │
├────────────────────▼─────────────────────────▼──────────────────┤
│  Celery Task Layer (queue: manual_on_demand)                    │
│  data_ingest/tasks.py                                           │
│  backfill_intraday_tick_system(symbols, days_back, overwrite)   │
│  backfill_intraday_tick_user(user_id, symbol, days_back)        │
│                    │                         │                  │
├────────────────────▼─────────────────────────▼──────────────────┤
│  Credential Layer                                               │
│  identity_access/models.py             utils/encryption.py     │
│  UserDNSECredential                    encrypt/decrypt Fernet   │
│  get_system_provider_credentials()                              │
│                    │                                            │
├────────────────────▼────────────────────────────────────────────┤
│  Adapter SSOT                                                   │
│  market_data/vnbroker_adapter.py                                │
│  fetch_intraday_tape_history(symbol, trade_date, api_key=None)  │
│                    │                                            │
├────────────────────▼────────────────────────────────────────────┤
│  External API                                                   │
│  DNSE (DNSEQuote.intraday)                                      │
└─────────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│  Detection Layer (triggered after each date insert)             │
│  signal_intelligence/tasks.py                                   │
│  detect_and_store_global_whale_alerts(symbol, session_date)     │
│                    │                                            │
│  (reads IntradayTick filtered by date)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data flow: System Backfill

```
Admin → POST /core/v1/data-ingest/trigger/whale-backfill/
         {symbols: ["HPG","VNM"], days_back: 90}

→ 202 {task_id: "abc-123"}

Celery task backfill_intraday_tick_system:
  1. get_system_provider_credentials() → (api_key, api_secret) or None
  2. if None → return {status: 'aborted', reason: 'no_system_provider'}
  3. for each symbol:
     for each trade_date in workdays_back(days_back):
       if IntradayTick.filter(symbol, date).exists() and not overwrite:
         dates_skipped_already_exists += 1; continue
       ticks = fetch_intraday_tape_history(symbol, date, api_key, api_secret)
       if ticks: bulk_create; trigger detect_and_store(symbol, date)
  4. log ServiceRunLog with summary counters
```

---

## 3. Data flow: User Backfill

```
Authenticated user → POST /core/v1/whale/backfill-symbol/
                     {symbol: "HPG", days_back: 30}

Rate check: UserBackfillThrottle (5/day, 1/120s)
 → 429 if exceeded

→ 202 {task_id: "xyz-456"}

Celery task backfill_intraday_tick_user:
  1. UserDNSECredential.objects.get(user_id=user_id)
     → DoesNotExist → return {status: 'no_credential'}
  2. Decrypt api_key, api_secret
  3. for each trade_date in workdays_back(min(days_back, 180)):
       existing_count = IntradayTick.filter(symbol, date).count()
       if existing_count >= DNSE_PRESENCE_THRESHOLD:  # 100
         dates_skipped_system_has_data += 1; continue
       ticks = fetch_intraday_tape_history(symbol, date, api_key, api_secret)
       if ticks:
         new_ticks = [t for t if not IntradayTick.filter(symbol,t.timestamp).exists()]
         bulk_create(new_ticks); trigger detect_and_store(symbol, date)
  4. return summary counters
```

---

## 4. Model: UserDNSECredential

```python
# packages/core/backend/src/identity_access/models.py

class UserDNSECredential(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='dnse_credential'
    )
    api_key_encrypted = models.BinaryField()
    api_secret_encrypted = models.BinaryField()
    is_system_provider = models.BooleanField(default=False, db_index=True)
    is_verified = models.BooleanField(default=False)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['is_system_provider'],
                condition=models.Q(is_system_provider=True),
                name='unique_active_system_provider'
            )
        ]

    def __str__(self):
        return f"DNSECredential(user={self.user_id}, system={self.is_system_provider})"
```

---

## 5. Adapter extension: fetch_intraday_tape_history

```python
# packages/core/backend/src/market_data/vnbroker_adapter.py

from datetime import datetime, timezone, timedelta

VN_TZ_OFFSET = timedelta(hours=7)

def fetch_intraday_tape_history(
    symbol: str,
    trade_date: str,  # "YYYY-MM-DD"
    api_key: str | None = None,
    api_secret: str | None = None,
) -> list[dict]:
    """
    Fetch historical intraday tape từ DNSE cho một ngày giao dịch.
    SSOT duy nhất cho DNSE historical access — không được import DNSEQuote từ chỗ khác.
    Trả về [] nếu lỗi, không raise exception.
    """
    try:
        from vnbroker.explorer.dnse.quote import DNSEQuote
        kwargs = {}
        if api_key:
            kwargs['api_key'] = api_key
        if api_secret:
            kwargs['api_secret'] = api_secret
        q = DNSEQuote(symbol, **kwargs)
        df = q.intraday(date=trade_date, get_all=True, page_size=1000)
        if df is None or df.empty:
            return []

        results = []
        for _, row in df.iterrows():
            # VN time string "YYYY-MM-DD HH:MM:SS" → UTC-aware datetime
            local_dt = datetime.strptime(str(row['time']), '%Y-%m-%d %H:%M:%S')
            utc_dt = (local_dt - VN_TZ_OFFSET).replace(tzinfo=timezone.utc)
            results.append({
                'timestamp': utc_dt,
                'price': float(row.get('price', 0)),
                'volume': int(row.get('volume', 0)),
                'side': str(row.get('side', '')).lower(),
                'match_type': str(row.get('match_type', '')),
                'source': 'dnse',
            })
        return results
    except Exception:
        # Không log credential, chỉ log symbol+date
        logger.warning('fetch_intraday_tape_history failed: symbol=%s date=%s', symbol, trade_date)
        return []
```

---

## 6. API endpoints summary

| Endpoint | Method | Auth | Rate limit | Status | Body/Response |
|---|---|---|---|---|---|
| `/core/v1/data-ingest/trigger/whale-backfill/` | POST | staff/admin | default | 202 | `{task_id}` |
| `/core/v1/whale/backfill-symbol/` | POST | authenticated | 5/day + 1/120s | 202 | `{task_id}` |
| `/core/v1/user/dnse-credential/` | GET | authenticated | default | 200 | status (no keys) |
| `/core/v1/user/dnse-credential/` | POST | authenticated | default | 201 | status |
| `/core/v1/user/dnse-credential/` | DELETE | authenticated | default | 204 | - |
| `/core/v1/user/dnse-credential/verify/` | POST | authenticated | 3/hour | 200 | `{is_verified}` |
| `/core/v1/user/dnse-credential/set-system-provider/` | PATCH | staff/admin | default | 200 | `{is_system_provider}` |

---

## 7. Migration plan

1. `identity_access` new migration: create `UserDNSECredential` table.
2. `vninvest_core/settings.py`: add throttle entry `"user_whale_backfill": "5/day"`.
3. `data_ingest/urls.py`: register new action `trigger_whale_backfill`.
4. `signal_intelligence/tasks.py`: add `session_date` param to existing task.
5. `compose.dev.env` và `compose.prod.env.example`: add `DNSE_CREDENTIAL_FERNET_KEY`.

---

## 8. Backwards compatibility

- `detect_and_store_global_whale_alerts(symbol=None)` call pattern → unchanged behavior.
- New `session_date` param → `None` by default → falls back to `_get_latest_session_date()`.
- Existing `fetch_intraday_tape()` hàm không bị sửa — chỉ thêm hàm mới.
