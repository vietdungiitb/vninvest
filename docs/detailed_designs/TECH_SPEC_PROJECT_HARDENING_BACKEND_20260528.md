# Tech Spec — Project Hardening Backend
**Ngày**: 2026-05-28  
**Status**: Draft locked for execution  
**Parent**: docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md

---

## 1. Scope model

Sub-plan này gồm hai tầng:
1. **Giai đoạn 1**: hardening bắt buộc để làm sạch nền kỹ thuật.
2. **Giai đoạn 2**: greenfield capabilities bám đúng foundation hiện có.

### Giai đoạn 1

- `user_workspace` tenant isolation migration
- orphan quarantine workflow
- auth rate-limiting audit
- gateway throttling config
- backend fat-file refactor
- `packages/web` fat-file refactor + packaging proof
- QG-1 closeout

### Giai đoạn 2

- VNPay/IPN payment flow
- outbound notification pipeline
- AI advisory cost control

---

## 2. System boundaries

### Backend domains

1. `user_workspace`
2. `identity_access`
3. `commercial`
4. `signal_intelligence`
5. `service_ops`

### Web domains

1. `packages/web/src/adapters`
2. `packages/web/src/pages`
3. frontend shell build path chỉ như packaging dependency, không phải owner business logic mới

---

## 3. Hard invariants

1. Không được auto-map orphan records về tenant mặc định.
2. Tenant isolation migration chỉ được chạy sau khi pre-audit sạch hoặc quarantine xong.
3. Mọi feature mới phải sống trong `packages/core` hoặc `packages/web`.
4. `commercial/` foundation hiện tại phải được reuse; không rewrite `Subscription`, `QuotaRecord`, `Invoice` chỉ để thêm payment.
5. `signal_intelligence` hiện là in-app delivery base; outbound delivery phải mở rộng từ truth layer này, không tạo truth song song ở frontend.
6. QG-1 backend gate chỉ hợp lệ khi env đã sync `packages/core/backend/requirements.txt` và khóa env vars tối thiểu.
7. `packages/web` packaging gate chuẩn là `build-community`, không phải `build`.

---

## 4. Migration and quarantine contract

### 4.1 Target entities

| Entity | Current anchor | Tenant status |
|---|---|---|
| Portfolio | `user_workspace/models.py:34` | nullable |
| Transaction | `user_workspace/models.py:56`, `:76` | nullable |
| Watchlist | `user_workspace/models.py:129` | nullable |
| TrackedSymbol | `user_workspace/models.py:193` | nullable |
| PriceAlert | `user_workspace/models.py:245`, `:273` | nullable |
| SubAccount | `user_workspace/models.py:328`, `:348` | nullable |

### 4.2 Pre-migration audit output

Script phải trả tối thiểu:

```json
{
  "table": "user_workspace_transaction",
  "orphan_count": 12,
  "sample_primary_keys": [101, 122, 145],
  "reason": "tenant_id is null and portfolio_id has no resolvable tenant"
}
```

### 4.3 Quarantine policy

1. Quarantine table hoặc artifact phải immutable theo slice execution.
2. Không được sửa dữ liệu gốc trong bước audit.
3. Migration phải fail-fast nếu còn orphan unresolved.

---

## 5. Security hardening contract

### 5.1 App-level throttling

Current validated anchors:
1. `login_view`
2. `register_view`
3. `password_reset_request_view`

Current validated tests:
1. login rate limit tests
2. register rate limit tests
3. password-reset rate limit tests

### 5.2 Gateway-level throttling

Target config additions:
1. `limit_req_zone` by client IP
2. `limit_req` on `/api/` and auth-sensitive paths
3. burst policy documented
4. reject semantics return HTTP 429

Non-goal:
1. Không đẩy business rate truth sang Nginx. Gateway chỉ là abuse guard bổ sung.

---

## 6. Refactor contract

### Backend

1. `views_auth.py` tách theo luồng: login, register, password-reset, oauth.
2. `dataops.py` chỉ giữ transport/controller logic; orchestration sang service classes.

### Web

1. `coreApiAdapter.js` tách theo domain nhưng giữ facade tương thích ngược.
2. `AlertCenterPage.js` tách sub-components theo ownership rõ ràng.
3. Sau refactor, `build-community` vẫn phải pass.

---

## 7. QG-1 execution contract

### Backend prerequisite

```powershell
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" -m pip install -r packages/core/backend/requirements.txt
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1,testserver'
```

Nếu env chưa có private deps:
1. Phải cấp `VNBROKER_GITHUB_TOKEN` theo lane nội bộ.
2. Hoặc chạy trong container/image dev đã provisioned sẵn.

### Backend gate

```powershell
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" packages/core/backend/manage.py test identity_access market_data user_workspace service_ops --keepdb
```

### Web gate

```powershell
npm --prefix packages/web run build-community
```

---

## 8. Giai đoạn 2 capability contract

### 8.1 VNPay/IPN

Phải thêm:
1. `PaymentTransaction`
2. `VNPayIPNLog`
3. signed URL generation
4. idempotent IPN handling
5. reconciliation job
6. replay-safe operator flow

### 8.2 Outbound notifications

Phải thêm:
1. channel config ownership
2. retry policy
3. delivery state mapping
4. anti-duplication guard

### 8.3 AI cost control

Phải thêm:
1. quota by tenant plan
2. semantic cache TTL + invalidation
3. router failover policy
4. observability for fallback and token usage

---

## 9. Observability requirements

1. Quarantine run phải có counts và sample IDs.
2. Migration run phải có before/after schema evidence.
3. Gateway throttle rollout phải có smoke evidence cho 429.
4. `build-community` gate phải lưu artifact path hoặc command output.
5. Phase 2 payment/notification flows phải có replay and failure evidence.

---

## 10. Non-goals

1. Không giải quyết toàn bộ cutover blockers của dashboard/build ownership tổng thể.
2. Không dùng sub-plan này để biện minh xóa `frontend/` hay `backend/` legacy ngay.
3. Không gộp thêm unrelated market-data remediation vào cùng doc pack.
