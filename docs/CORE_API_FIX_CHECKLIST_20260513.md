# Core API Fix Checklist & Priority Tracker
**Document**: CORE_API_FIX_CHECKLIST_20260513.md  
**Status**: Ready to Execute  
**Last Updated**: 2026-05-13

---

## Quick Status Dashboard

```
🔴 CRITICAL FIXES: 5 items (BLOCKING RELEASE)  
🟠 HIGH PRIORITY: 12 items (MUST FIX)
🟡 MEDIUM PRIORITY: 18 items (SHOULD FIX)
🟢 LOW PRIORITY: 12 items (NICE TO HAVE)

ESTIMATED EFFORT: 40 hours
ESTIMATED TIMELINE: 4 weeks
CURRENT READINESS: 15% (NOT READY FOR PUBLIC)
```

---

## 🧭 Governance Rollout Checklist (Week 5-6)

### [ ] G1. Ban hanh hard rules OpenAPI
- [ ] Chot tai lieu constitution:
  - `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- [ ] Chot checklist gate PR:
  - `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
- [ ] Chot goi handoff thuc thi:
  - `docs/CORE_API_OPENAPI_STANDARDIZATION_HANDOFF_MASTER_20260513.md`
  - `docs/IMPLEMENTATION_PLAN_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
  - `docs/TECH_SPEC_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- [ ] Cong bo owner va hieu luc ap dung tren toan bo API PR

### [ ] G2. CI gate integration
- [ ] Them OpenAPI lint vao workflow PR
- [ ] Them script check error envelope/pagination/rate-limit conventions
- [ ] Block merge neu vi pham hard rules

### [ ] G3. Rollout audit
- [ ] Audit ngau nhien 10 PR API dau tien sau rollout
- [ ] Do KPI first-pass CI success
- [ ] Tong ket vi pham lap lai va cap nhat guideline

### [ ] G4. Exception governance
- [ ] Mau exception ticket co owner + expiry
- [ ] Rule qua han exception thi auto block merge

---

## 🔴 CRITICAL FIXES (Must Complete Before Public)

### Week 1: Critical Blocker Resolution (10 hours)

#### [ ] C1. Password Reset Tokens (2 hours)
**File**: `identity_access/views_auth.py`  
**Issue**: Tokens stored in memory, lost on restart  
**Impact**: Users can't reset passwords

**Checklist**:
- [ ] Create Django model: `PasswordResetToken`
  - email
  - token_hash (HMAC-SHA256)
  - created_at, expires_at
  - used (boolean flag)
- [ ] Migrate: `python manage.py makemigrations && migrate`
- [ ] Update `password_reset_request_view()` to save to DB
- [ ] Update `password_reset_confirm_view()` to verify from DB
- [ ] Add token cleanup task (delete expired hourly)
- [ ] Write tests:
  ```python
  test_token_persists_across_restart()
  test_expired_token_rejected()
  test_token_marked_used_after_reset()
  ```
- [ ] Verify: `python manage.py test identity_access.tests.test_password_reset`

---

#### [ ] C2. Exception Handler Swallowing (3 hours)
**Files**: 6 files with bare `except: pass`  
**Issue**: Silent failures hidden from monitoring  
**Impact**: Production bugs invisible to ops

**Checklist**:
- [ ] File 1: `identity_access/views_auth.py:245`
  - [ ] Identify specific exception type (e.g., `CoreTenant.DoesNotExist`)
  - [ ] Return proper error response with status
  - [ ] Add logger.error() before return
  - [ ] Test: `test_missing_tenant_returns_404()`

- [ ] File 2: `advisory/views.py:187`
  - [ ] Replace `except Exception` with specific type
  - [ ] Add logger.error() + raise (let outer handler catch)
  - [ ] Test: `test_cache_failure_logs_and_raises()`

- [ ] File 3: `signal_intelligence/consumers.py:102`
  - [ ] Add try-except with await self.send(error_response)
  - [ ] Test: `test_websocket_invalid_json_sends_error()`

- [ ] File 4: `market_serving/views.py:234`
  - [ ] Handle stale data case explicitly
  - [ ] Test: `test_stale_snapshot_returns_with_flag()`

- [ ] File 5: `user_workspace/views.py:156`
  - [ ] Return 404 or 403 instead of silent pass
  - [ ] Test: `test_transaction_not_found_returns_404()`

- [ ] File 6: `ops_audit/tasks.py:78`
  - [ ] Log audit failures, don't swallow
  - [ ] Test: `test_audit_failure_logs_error()`

- [ ] Verify: `grep -r "except.*:$" packages/core/backend/src/` (should be 0)

---

#### [ ] C3. Email Onboarding Not Implemented (4 hours)
**File**: `identity_access/onboarding_views.py:36-39`  
**Issue**: Welcome + password reset emails never sent  
**Impact**: Tenants can't complete signup

**Checklist**:
- [ ] Create email templates:
  - [ ] `templates/emails/welcome.html` (welcome + first PAT)
  - [ ] `templates/emails/password_reset.html` (reset link)
  - [ ] `templates/emails/subscription_renewal.html`
  - [ ] Ensure templates use `{{ FRONTEND_URL }}` not hardcoded URL

- [ ] Create Celery tasks in `data_ingest/tasks.py`:
  ```python
  @shared_task
  def send_welcome_email(user_id):
      user = User.objects.get(id=user_id)
      send_mail(...)
  
  @shared_task
  def send_password_reset_email(email, reset_token):
      send_mail(...)
  ```

- [ ] Update `register_tenant_view()`:
  - [ ] After user creation, call `send_welcome_email.delay(user.id)`
  - [ ] Include PAT prefix in response (for admin)

- [ ] Update `password_reset_request_view()`:
  - [ ] After token created, call `send_password_reset_email.delay(email, token)`
  - [ ] Respond with "Check your email" message

- [ ] Configure email backend:
  - [ ] Set `EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'` in prod
  - [ ] Set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM` in env
  - [ ] Test with: `python manage.py shell`
    ```python
    from django.core.mail import send_mail
    send_mail('Test', 'Body', 'noreply@vninvest.com', ['you@example.com'])
    ```

- [ ] Tests:
  - [ ] `test_welcome_email_sent_on_registration()`
  - [ ] `test_password_reset_email_sent_with_link()`
  - [ ] `test_email_contains_correct_frontend_url()`

- [ ] Verify: `python manage.py test identity_access.tests.test_onboarding`

---

#### [ ] C4. Hardcoded Localhost Fallbacks (1 hour)
**Files**: Multiple (views_auth.py, vnbroker_adapter.py, etc.)  
**Issue**: localhost defaults break in production  
**Impact**: Wrong URLs in emails, cache connects locally

**Checklist**:
- [ ] Create `vninvest_core/env_config.py`:
  ```python
  def get_required_env(key: str) -> str:
      value = os.getenv(key)
      if not value:
          raise ValueError(f'Required: {key}')
      return value
  
  FRONTEND_URL = get_required_env('FRONTEND_URL')
  REDIS_URL = get_required_env('REDIS_URL')
  CORE_API_BASE_URL = get_required_env('CORE_API_BASE_URL')
  ```

- [ ] Update `settings.py`:
  - [ ] Import from `env_config`
  - [ ] Remove all `os.getenv(key, 'localhost:...')` defaults
  - [ ] Replace with required checks

- [ ] Update all references:
  - [ ] `views_auth.py:530` - use `FRONTEND_URL`
  - [ ] `vnbroker_adapter.py:77` - use `REDIS_URL`
  - [ ] Any other hardcoded localhost

- [ ] Create `.env.example`:
  ```
  FRONTEND_URL=https://app.vninvest.com
  CORE_API_BASE_URL=https://core-api.vninvest.com
  REDIS_URL=redis://redis:6379/3
  DATABASE_URL=postgresql://user:pass@db:5432/vninvest
  SECRET_KEY=<generate-strong-key>
  CORE_PAT_PEPPER=<generate-strong-pepper>
  ```

- [ ] Add startup validation:
  ```python
  # In manage.py or wsgi.py
  from vninvest_core.env_config import validate_required_env
  validate_required_env()  # Raises if any missing
  ```

- [ ] Tests:
  - [ ] `test_startup_fails_if_frontend_url_missing()`
  - [ ] `test_password_reset_email_has_correct_url()`
  - [ ] `test_redis_connects_to_configured_url()`

- [ ] Verify: App fails to start if env missing ✅

---

#### [ ] C5. WebSocket Consumer Error Handling (2 hours)
**File**: `signal_intelligence/consumers.py:102`  
**Issue**: Silent WebSocket corruption on errors  
**Impact**: Real-time feeds break silently

**Checklist**:
- [ ] Rewrite `receive()` method:
  - [ ] Catch `JSONDecodeError` → send error response
  - [ ] Validate symbol not empty → send error response
  - [ ] Check symbol exists in DB → send error response
  - [ ] Wrap subscribe in try-except → log + send error

- [ ] Add error response pattern:
  ```python
  await self.send(json.dumps({
      'type': 'error',
      'message': 'Human readable message',
      'code': 'error_code',
      'timestamp': timezone.now().isoformat()
  }))
  ```

- [ ] Tests:
  - [ ] `test_websocket_invalid_json_sends_error()`
  - [ ] `test_websocket_empty_symbol_rejected()`
  - [ ] `test_websocket_nonexistent_symbol_rejected()`
  - [ ] `test_websocket_subscription_error_logged()`

- [ ] Verify: `python manage.py test signal_intelligence.tests.test_consumer`

---

### Phase 1 Verification Checklist
```
After completing all 5 CRITICAL fixes:

[ ] No test failures: python manage.py test identity_access
[ ] No test failures: python manage.py test signal_intelligence  
[ ] No hardcoded localhost in code: grep -r "localhost" src/ (should be 0)
[ ] All exception handlers log something: grep -r "except.*:$" src/ (should be 0)
[ ] Email templates exist in templates/
[ ] .env.example created and documented
[ ] Startup validation working
[ ] WebSocket errors are logged
```

✅ **PHASE 1 SIGN-OFF**: All CRITICAL fixes working

---

## 🟠 HIGH PRIORITY FIXES (Week 2, 8 hours)

### H1. Pagination on List Endpoints (2 hours)
- [ ] `UnifiedAlertListView` - Add pagination_class
- [ ] `OrderFlowEventListView` - Add pagination_class  
- [ ] `AuditLogListView` - Add pagination_class
- [ ] Test: Load 10,000 records, verify pagination works
- [ ] Verify: All list endpoints have `pagination_class`

**Command to check**:
```bash
grep -r "pagination_class" packages/core/backend/src/ | grep -v "audit" | wc -l
# Should be >= 10 (all list views)
```

---

### H2. Rate Limiting on Auth (2 hours)
- [ ] Install: `pip install django-ratelimit`
- [ ] Add `@ratelimit` to:
  - [ ] `/api/auth/login/` → 5/minute per IP
  - [ ] `/api/auth/register/` → 3/minute per IP
  - [ ] `/api/auth/password-reset/` → 3/minute per email
- [ ] Test brute force protection
- [ ] Test: 429 status returned when limit exceeded

---

### H3. Tenant Isolation Audit (3 hours)
- [ ] Audit all views for tenant filtering
- [ ] Check: `Order`, `Payment`, `Transaction` - all scoped to tenant
- [ ] Add test: `test_user_cannot_access_other_tenant_data()`
- [ ] Verify: No data leakage across tenants

---

### H4. Missing Validation (1 hour)
- [ ] Add DRF validators to serializers
- [ ] Validate input: symbols, dates, quantities
- [ ] Return 400 with validation errors

---

## 🟡 MEDIUM PRIORITY FIXES (Week 3, 12 hours)

### Priority Fixes in Order:

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| M1: Serializer validation | 1h | Medium | 1 |
| M2: HTTP 429 status codes | 30m | Medium | 2 |
| M3: Query optimization (N+1) | 2h | High | 1 |
| M4: Cache error handling | 1h | Medium | 2 |
| M5: Input validation | 2h | High | 1 |
| M6: Timestamp serialization | 1h | Medium | 3 |
| M7: Logging config | 1h | Medium | 3 |
| M8: Test passwords cleanup | 30m | Low | 4 |

**Quick wins** (complete first):
- [ ] Fix HTTP status codes (30m)
- [ ] Add input validation (2h)
- [ ] Optimize N+1 queries (2h)

---

## 🟢 LOW PRIORITY FIXES (Week 4, 10 hours)

- [ ] Add type hints with mypy
- [ ] Code formatting (black + flake8)
- [ ] Missing docstrings
- [ ] Deprecation warnings

---

## Daily Standup Template

```
🎯 Today's Focus: [C1/C2/H1 etc]

✅ Completed:
- [ ] Issue resolved
- [ ] Tests passing
- [ ] PR created

⏳ In Progress:
- [ ] Issue description

🚧 Blocked By:
- [ ] N/A or issue description

📊 Progress:
- CRITICAL: 0/5 ✅
- HIGH: 0/12 ⏳
- MEDIUM: 0/18 ⏳
```

---

## Code Review Checklist

Before merging any fix PR:

- [ ] Tests added (unit + integration)
- [ ] No hardcoded values
- [ ] Error handling complete
- [ ] Logging in place
- [ ] Docs updated
- [ ] No new warnings
- [ ] Performance acceptable
- [ ] Security implications reviewed

---

## Verification Commands

Run after each phase:

```bash
# Phase 1: Critical
python manage.py test identity_access signal_intelligence
python manage.py check  # Django system checks
grep -r "except.*:$" packages/core/  # No bare except
grep -r "localhost" packages/core/  # No hardcoded localhost

# Phase 2: High Priority
python manage.py test --keepdb
python -m pytest packages/core/backend/ -v --cov

# Phase 3: Medium Priority
black --check packages/core/
flake8 packages/core/
mypy packages/core/

# Final: All Systems
docker compose -f docker-compose.dev.yml up -d
python manage.py runserver
# Manual smoke tests...
```

---

## Sign-Off Gates

**Gate 1: Critical Issues Resolved** (End of Week 1)
- [ ] All 5 CRITICAL issues fixed
- [ ] All CRITICAL tests passing
- [ ] Code review approved
- [ ] Tech Lead sign-off

**Gate 2: High Priority Issues Resolved** (End of Week 2)
- [ ] All 12 HIGH issues fixed
- [ ] Test coverage ≥ 85%
- [ ] Security audit passed
- [ ] DevOps sign-off

**Gate 3: Medium/Low Issues Resolved** (End of Week 4)
- [ ] All MEDIUM/LOW issues addressed
- [ ] Full test suite passing
- [ ] Code quality tools pass (mypy, flake8, black)
- [ ] Performance benchmarks met
- [ ] Documentation complete

**Gate 4: Release Ready** (Ready for Public)
- [ ] All gates passed ✅
- [ ] Executive sign-off ✅
- [ ] Deployment runbook created ✅
- [ ] Incident response plan ready ✅
- [ ] Error monitoring (Sentry) configured ✅

---

## Success Metrics

After completing all phases, verify:

```
Quality Metrics:
✅ Test coverage: ≥85%
✅ No CRITICAL issues: 0 remaining
✅ Exception handling: 100% covered
✅ Tenant isolation: Verified in all views
✅ Rate limiting: Active on auth endpoints

Security Metrics:
✅ No hardcoded secrets
✅ No data leakage across tenants
✅ No brute force vulnerabilities
✅ All env vars validated

Performance Metrics:
✅ P99 latency: <500ms
✅ Cache hit rate: >80%
✅ No N+1 queries
✅ Pagination: All list endpoints

Deployment Readiness:
✅ Error monitoring configured
✅ Runbook created
✅ Team trained on procedures
✅ Go-live checklist ready
```

---

## Resources & Contacts

**Slack Channels**:
- #core-api-fixes (standup updates)
- #quality-assurance (testing)
- #security-review (sec team)

**Docs**:
- Full audit: `CORE_API_CODE_QUALITY_AUDIT_20260513.md`
- Detailed issues: `CORE_API_ISSUES_INVENTORY_20260513.md`
- Remediation plan: `CORE_API_REMEDIATION_PROPOSAL_20260513.md`

**Timeline**: May 13 → June 10 (4 weeks)

---

## ✅ Frontend-Confirmed Bug Fixes (2026-05-13)

> Báo cáo từ Frontend Team (react-stockcharts-master / VNInvest Chart Widget).  
> Tất cả 4 lỗi dưới đây đã được **xác nhận tồn tại trong source** và **đã fix ngay trong cùng ngày**.

| # | File | Vấn đề | Mức độ | Trạng thái |
|---|------|---------|--------|-----------|
| F1 | `signal_intelligence/views.py` | `WhaleFeedAggregateView` trả cursor-paginated shape — frontend không parse được | 🔴 CRITICAL | ✅ **Đã fix** |
| F2 | `market_data/views.py` | `StockProfileListView` ignore `?search=` / `?q=` params | 🔴 CRITICAL | ✅ **Đã fix** |
| F3 | `WS /ws/market/{symbol}/` | Frontend cần append `?token=` — đã fix phía frontend | 🟠 HIGH | ✅ FE Fixed |
| F4 | `market_data/stock_mgmt_native_views.py` | `StockManagementChartView` ignore `?days=` và `?timeframe=` | 🟠 HIGH | ✅ **Đã fix** |
| F5 | `market_serving/native_views.py` | `RealtimeIntradayView` không normalize `ts→time`, `B/S→BUY/SELL`, price string | 🟡 MEDIUM | ✅ **Đã fix** |

### Chi tiết fix F1 — `WhaleFeedAggregateView`
**File**: `signal_intelligence/views.py`  
- Chuyển từ `generics.ListAPIView` (cursor paginated) → `APIView` với flat response  
- Output mới: `{symbol, whale_orders: [{ts, price, volume, matched_value, side, size_class}], summary: {buy_value, sell_value}}`  
- Thêm `_WHALE_SIDE_MAP` (`B→BUY`, `S→SELL`) và `_whale_size_class()` helper  
- `matched_value` và `price` đổi từ string Decimal → float  

### Chi tiết fix F2 — `StockProfileListView`
**File**: `market_data/views.py`  
- Thêm `search`/`q` filter: `Q(symbol__icontains=search) | Q(company_name__icontains=search)`  
- Filter được apply trước `exchange` và `industry` filter  

### Chi tiết fix F4 — `StockManagementChartView`
**File**: `market_data/stock_mgmt_native_views.py`  
- Thêm xử lý `?days=N` → auto-compute `date_from = today - timedelta(days=N)`  
- Thêm `?timeframe=` detection: nếu intraday (`1m/5m/15m/30m/1h/2h/4h/1H/2H/4H`) → trả `{results: [], note: 'intraday_not_available_in_native'}`  

### Chi tiết fix F5 — `RealtimeIntradayView`
**File**: `market_serving/native_views.py`  
- Thêm `_normalize_trade()` helper: `ts→time`, `float(price)`, `B/S→BUY/SELL/NO`  
- `total` được tính từ `len(trades)` sau normalize (trước đó dùng `data.get('total')` có thể wrong)  

### Ghi chú thêm (không phải lỗi)
- `GET /core/v1/market-data/daily-prices/{symbol}/` trả `order_by('-date')` — Frontend đã `.reverse()` phía client. Backend không cần đổi nhưng **cần ghi vào API doc** để tránh nhầm lẫn.

---

**Status**: Ready to Execute  
**Next Step**: Allocate backend engineer + start Phase 1 immediately

Would you like to begin Phase 1 this week?
