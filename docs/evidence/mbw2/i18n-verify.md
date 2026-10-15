# Evidence — PM verify tay i18n Wave 2 (Pha 2, 2026-10-15)

- `npm run i18n:scan:strict` trên cây hợp nhất: exit 0.
- Verify tay ≥3 key/bề mặt (cả VI + EN, lệnh Select-String trên `src/i18n/vi.js` + `en.js`):

| Key (tên thật, resolve runtime) | VI | EN |
|---|---|---|
| `brokerHub.data.badge.brokerBacked` | True | True |
| `brokerHub.data.account.title` | True | True |
| `brokerHub.data.balance.cash` | True | True |
| `brokerHub.hub.title` | True | True |
| `brokerHub.hub.connectTitle` | True | True |
| `brokerHub.hub.errors.fieldRequired` | True | True |

- Đính chính cross-review O7-major: bản đầu ghi 2 key sai (`hub.tiles.title`, `hub.connect.title` không tồn tại — grep leaf `title` trúng nhầm). Bảng trên dùng tên thật.
- **BLOCKER cross-review:** `brokerHub:` trùng 2 lần/vi.js+en.js (runtime mất `data.*`) — ĐÃ SỬA: gộp 1 khối duy nhất (commit consolidation supervisor).
- Chứng minh runtime (node import file locale thật, resolve 12 key × 2 locale): **RUNTIME-12/12** (6 hub + 6 data: hub.title/connectTitle/errors.fieldRequired/accountTitle/backToHub/data.title ở trên + data.tabs.positions/orders.empty/matched.note/account.title/balance.cash/badge.brokerBacked).

- Prefix tách đôi đúng contract (HUB `brokerHub.hub.*`, DATA `brokerHub.data.*`, ngoại lệ duy nhất `routes.broker`). `check:i18n-hardcoded` không viện dẫn (allowlist không chứa file broker — O3).
- Người ký: PM (supervisor Wave 2).
