# Evidence — PM verify tay i18n Wave 2 (Pha 2, 2026-10-15)

- `npm run i18n:scan:strict` trên cây hợp nhất: exit 0.
- Verify tay ≥3 key/bề mặt (cả VI + EN, lệnh Select-String trên `src/i18n/vi.js` + `en.js`):

| Key | VI | EN |
|---|---|---|
| `brokerHub.data.badge.brokerBacked` | True | True |
| `brokerHub.data.account.title` | True | True |
| `brokerHub.data.balance.cash` | True | True |
| `brokerHub.hub.tiles.title` | True | True |
| `brokerHub.hub.connect.title` | True | True |
| `brokerHub.hub.errors.fieldRequired` | True | True |

- Prefix tách đôi đúng contract (HUB `brokerHub.hub.*`, DATA `brokerHub.data.*`, ngoại lệ duy nhất `routes.broker`). `check:i18n-hardcoded` không viện dẫn (allowlist không chứa file broker — O3).
- Người ký: PM (supervisor Wave 2).
