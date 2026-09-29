# Config Ownership Matrix — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## Config registry

| Config | Mục đích | Owner | Writer | Runtime Surface | Rotate procedure |
|---|---|---|---|---|---|
| `DNSE_CREDENTIAL_FERNET_KEY` | Fernet key encrypt/decrypt DNSE credentials trong DB | Tech Lead Backend | Backend infra only | env var tại container | `Fernet.generate_key()` → update env → re-encrypt existing records |
| `UserDNSECredential.is_system_provider` | Đánh dấu credential nào là system provider | Admin user (staff/superuser) | Via API PATCH endpoint | DB field | Admin UI toggle |
| `UserDNSECredential.api_key_encrypted` | DNSE API key của user (mã hóa) | User (chính user) | Via API POST endpoint | DB field (BinaryField) | User re-register via UI |
| `UserDNSECredential.api_secret_encrypted` | DNSE API secret của user (mã hóa) | User (chính user) | Via API POST endpoint | DB field (BinaryField) | User re-register via UI |
| `days_back` (default 90) | Khoảng thời gian backfill mặc định | Tech Lead Backend | Hardcoded default; overridable per API call | API request body | Code change + redeploy |
| `DNSE_BACKFILL_SLEEP_SECONDS` | Delay giữa requests tới DNSE | Tech Lead Backend | Backend env var | data_ingest tasks | env var update + restart |
| `DNSE_PRESENCE_THRESHOLD` (100) | Min ticks để coi ngày là "đã có data" trong merge rule | Tech Lead Backend | Hardcoded default | data_ingest tasks | Code change + redeploy |
| `user_whale_backfill` throttle rate (5/day) | Rate limit user backfill | Tech Lead Backend | settings.py | DRF throttle | Code change + redeploy |
| `user_whale_backfill_burst` throttle (1/120s) | Burst rate limit | Tech Lead Backend | settings.py | DRF throttle | Code change + redeploy |

---

## Ownership rules

1. **Frontend không được ghi credential hay backfill policy** — chỉ trigger qua authenticated API endpoint.
2. **Operator UI chỉ toggle `is_system_provider`** — không được xem hoặc nhận plain text credential.
3. **`DNSE_CREDENTIAL_FERNET_KEY` không được commit vào source code** — dùng env var, documented trong `compose.prod.env.example`.
4. **Mọi thay đổi `is_system_provider`** phải ghi vào `ConfigChangeAudit` nếu model có (hoặc Django admin log).
5. **Fernet key rotation** phải kèm theo procedure re-encrypt toàn bộ `UserDNSECredential` records — không thay key mà không re-encrypt.
6. **`days_back` max 365 (system) / 180 (user)** được enforce tại view layer, không phải task layer.

---

## Environment variables cần khai báo

### `compose.dev.env`
```
DNSE_CREDENTIAL_FERNET_KEY=<generate bằng: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
DNSE_BACKFILL_SLEEP_SECONDS=1.2
```

### `compose.prod.env.example`
```
DNSE_CREDENTIAL_FERNET_KEY=${DNSE_CREDENTIAL_FERNET_KEY:?DNSE_CREDENTIAL_FERNET_KEY must be set}
DNSE_BACKFILL_SLEEP_SECONDS=1.5
```
