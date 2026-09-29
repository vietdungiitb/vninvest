# DNSE Integration Config Ownership Matrix

## 1. Purpose
Define ownership, storage, and sensitivity for DNSE synchronization configuration in the Core SaaS stack.

## 2. Configuration Ownership

| Config Item | Owner | Storage | Sensitivity |
|---|---|---|---|
| DNSE API Key | System Admin | `user_workspace.DNSECredential` (ciphertext) | High (Encrypted) |
| DNSE API Secret | System Admin | `user_workspace.DNSECredential` (ciphertext) | Critical (Encrypted) |
| DNSE Username | User | `user_workspace.DNSECredential` (ciphertext) | Critical (Encrypted) |
| DNSE Password | User | `user_workspace.DNSECredential` (ciphertext) | Critical (Encrypted) |
| JWT Access Token | System | Redis cache / short-lived session cache | Medium |
| Trading Token | System | Redis cache / short-lived session cache | High |
| Public Market Data Provider Routing (price, intraday, company, listing, news) | Platform Team | `vnbroker` source router / provider config | Medium |
| Sync Interval | System Admin | Environment variable or runtime config | Low |
| Min NAV for Alerting | User | `identity_access.UserProfile` or user preference store | Low |

## 3. Storage & Encryption Standards
- Store broker credentials as ciphertext, not plaintext.
- Follow the same split used by the core PAT design: one-way HMAC with pepper for lookup secrets, ciphertext for reversible broker credentials.
- Do not log raw DNSE credentials or tokens.
- Rotate broker secrets on a fixed schedule, and record the rotation in the audit trail.
- If a shared core secret helper does not already exist, implement one in the DNSE workspace module before wiring the model save path.
- Public market data stays multi-provider inside `vnbroker`; DNSE config does not own those routes.

## 4. Environment-Specific Overrides

### Development
- `DNSE_API_BASE_URL`: `https://openapi.dnse.com.vn`
- `DNSE_SYNC_ENABLED`: `false`
- `DNSE_SECURE_MODE`: `false`

### Production
- `DNSE_API_BASE_URL`: `https://openapi.dnse.com.vn`
- `DNSE_SYNC_ENABLED`: `true`
- `DNSE_SECURE_MODE`: `true`
