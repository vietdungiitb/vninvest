# Core API Readiness Assessment & Remediation Proposal
**Document**: CORE_API_REMEDIATION_PROPOSAL_20260513.md  
**Date**: 2026-05-13  
**Status**: Quality Audit Complete - Ready for Fix Implementation  
**Prepared By**: AI Engineering Team

---

## Executive Summary

Core-API has **47 identified code quality issues** preventing public release. Fixes require **~40 hours of focused development** across **4 weeks**. With proper remediation, API will be **production-ready by June 10, 2026**.

### Governance extension (approved direction)
Sau remediation 4 tuan, du an tiep tuc 2 tuan governance de khoa chat quy trinh:
- Tuan 5: Bat buoc OpenAPI hard rules trong PR va CI
- Tuan 6: Audit rollout va chot KPI gate

Reference:
- `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
- `docs/CORE_API_OPENAPI_STANDARDIZATION_HANDOFF_MASTER_20260513.md`
- `docs/IMPLEMENTATION_PLAN_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `docs/TECH_SPEC_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`

### Quality Grade Today
| Dimension | Grade | Issues |
|-----------|-------|--------|
| **Critical Bugs** | F | 5 blockers (auth, email, hardcoding) |
| **Security** | C+ | Brute force risk, data isolation gaps |
| **Error Handling** | D | 6+ silent failures, exception swallowing |
| **Test Coverage** | C | 45-70% (good), but critical paths untested |
| **Documentation** | B | API specs exist, but internal code docs sparse |
| **Performance** | C | No pagination on 3 endpoints, N+1 risks |
| **Deployment** | D | Hardcoded localhost, env config weak |

### Quality Grade After Fixes
| Dimension | Grade | Status |
|-----------|-------|--------|
| **Critical Bugs** | ✅ A | All resolved |
| **Security** | ✅ B+ | Rate limiting + isolation verified |
| **Error Handling** | ✅ B | Comprehensive logging + validation |
| **Test Coverage** | ✅ A- | 85%+ with critical path tests |
| **Documentation** | ✅ A | API docs + code comments complete |
| **Performance** | ✅ A | Pagination, query optimization added |
| **Deployment** | ✅ A | Environment validation, safe defaults |

---

## Part 1: Critical Issues (MUST FIX BEFORE PUBLIC)

### 🔴 Critical #1: Password Reset Tokens Lost on Restart
**File**: `identity_access/views_auth.py` line 463  
**Severity**: 🔴 CRITICAL (Users cannot reset passwords)  
**Impact**: Production outage — users locked out

**Current Code**:
```python
_PASSWORD_RESET_TOKEN_STORE = {}  # ❌ Lost on restart!

def password_reset_request_view(request):
    token = secrets.token_urlsafe(32)
    _PASSWORD_RESET_TOKEN_STORE[token] = {
        'email': email,
        'expires_at': timezone.now() + timedelta(hours=1)
    }
```

**Issue**: Tokens stored in app memory. Restart = all password resets invalidated.

**Fix** (Effort: 2 hours):
```python
# Use Django ORM instead
class PasswordResetToken(models.Model):
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

def password_reset_request_view(request):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    PasswordResetToken.objects.create(
        email=email,
        token_hash=token_hash,
        expires_at=timezone.now() + timedelta(hours=1)
    )
    # Send email with token (see C4)
```

**Test Required**:
```python
def test_password_reset_token_persists_across_restart():
    # Create token, simulate restart, verify token still valid
```

---

### 🔴 Critical #2: Exception Handlers Swallowing Errors
**Files**: Multiple (views_auth.py, advisory/views.py, consumers.py)  
**Severity**: 🔴 CRITICAL (Silent production failures)  
**Impact**: Bugs hidden from monitoring

**Example 1 - views_auth.py line 245**:
```python
try:
    tenant = user.core_tenant
except CoreTenant.DoesNotExist:
    pass  # ❌ Silent failure, no response!
```

**Example 2 - advisory/views.py line 187**:
```python
try:
    historical_signals = load_signals_from_cache(symbol)
except Exception:  # ❌ Catches everything!
    pass
```

**Fix** (Effort: 3 hours):
```python
# Option A: Always return error response
try:
    tenant = user.core_tenant
except CoreTenant.DoesNotExist:
    return Response(
        {'detail': 'No tenant associated with user.'},
        status=status.HTTP_404_NOT_FOUND
    )

# Option B: Log + re-raise for proper monitoring
try:
    historical_signals = load_signals_from_cache(symbol)
except Exception as e:
    logger.error(f'Cache load failed for {symbol}', exc_info=True)
    raise  # Let outer error handler respond
```

**Affected Views** (6 total):
- `identity_access/views_auth.py:245` - tenant lookup
- `advisory/views.py:187` - cache load
- `signal_intelligence/consumers.py:102` - JSON decode
- `market_serving/views.py:234` - snapshot fetch
- `user_workspace/views.py:156` - transaction lookup
- `ops_audit/tasks.py:78` - audit log

---

### 🔴 Critical #3: Email Onboarding Not Implemented
**File**: `identity_access/onboarding_views.py` line 36-39  
**Severity**: 🔴 CRITICAL (Registration flow incomplete)  
**Impact**: Tenants cannot complete signup

**Current Code**:
```python
def register_tenant_view(request):
    # ... create user, create tenant ...
    
    # TODO: Send welcome email
    # TODO: Send verification email
    # return Response(...)  # No email sent!
```

**Fix** (Effort: 4 hours):
```python
from django.core.mail import send_mail
from celery import shared_task

@shared_task
def send_welcome_email(user_id):
    user = User.objects.get(id=user_id)
    send_mail(
        subject='Chào mừng đến VNInvest Core API',
        message=f'''Xin chào {user.username}!
        
Tài khoản của bạn đã được tạo thành công.

Hãy đăng nhập tại: https://core-api.vninvest.com/login

PAT của bạn có hiệu lực trong 90 ngày.

Trân trọng,
VNInvest Team''',
        from_email='noreply@vninvest.com',
        recipient_list=[user.email],
        fail_silently=False  # ❌ Don't fail silently
    )

def register_tenant_view(request):
    # ... create user, tenant, service account ...
    
    # Queue email task
    send_welcome_email.delay(user.id)
    
    return Response(
        {'tenant': {...}, 'user': {...}, 'token': raw_pat},
        status=status.HTTP_201_CREATED
    )
```

**Email Templates Required**:
- `templates/emails/welcome.html`
- `templates/emails/password_reset.html`
- `templates/emails/subscription_renewal.html`

---

### 🔴 Critical #4: Hardcoded Localhost Fallbacks
**Files**: Multiple (views_auth.py:530, vnbroker_adapter.py:77)  
**Severity**: 🔴 CRITICAL (Breaks in production)  
**Impact**: Wrong URLs in emails, cache connects locally

**Example 1 - views_auth.py line 530**:
```python
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')  # ❌ Default to localhost!
password_reset_link = f'{frontend_url}/auth/reset/{token}'
# Sends email with: http://localhost:3000/... ❌ WRONG
```

**Example 2 - vnbroker_adapter.py line 77**:
```python
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/3')  # ❌
# Silently fails in production if env not set
```

**Fix** (Effort: 1 hour):
```python
# Use required() helper for mandatory env vars
def _get_required_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise ValueError(f'Environment variable {key} is required for production')
    return value

# In settings.py
FRONTEND_URL = _get_required_env('FRONTEND_URL')  # Fail fast if missing
REDIS_URL = _get_required_env('REDIS_URL')
CORE_API_BASE_URL = _get_required_env('CORE_API_BASE_URL')

# Or use .env validation on startup
```

**Validation Script** (Add to management command):
```python
# python manage.py validate_config
def validate_required_env():
    required = [
        'FRONTEND_URL', 'CORE_API_BASE_URL', 'REDIS_URL',
        'DATABASE_URL', 'SECRET_KEY', 'CORE_PAT_PEPPER'
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise ValueError(f'Missing required env: {", ".join(missing)}')
```

---

### 🔴 Critical #5: WebSocket Consumer Missing Error Handling
**File**: `signal_intelligence/consumers.py` line 102  
**Severity**: 🔴 CRITICAL (Silent WebSocket corruption)  
**Impact**: Real-time feeds silently break

**Current Code**:
```python
async def receive(self, text_data):
    try:
        data = json.loads(text_data)  # Can throw JSONDecodeError
        symbol = data.get('symbol')
        await self.subscribe(symbol)
    except Exception:
        pass  # ❌ Silent failure — client never knows
```

**Fix** (Effort: 2 hours):
```python
async def receive(self, text_data):
    try:
        data = json.loads(text_data)
    except json.JSONDecodeError as e:
        await self.send(json.dumps({
            'type': 'error',
            'message': 'Invalid JSON',
            'detail': str(e)
        }))
        return
    
    symbol = data.get('symbol', '').upper()
    if not symbol:
        await self.send(json.dumps({
            'type': 'error',
            'message': 'Symbol required'
        }))
        return
    
    # Validate symbol exists
    if not StockProfile.objects.filter(symbol=symbol).exists():
        await self.send(json.dumps({
            'type': 'error',
            'message': f'Symbol {symbol} not found'
        }))
        return
    
    try:
        await self.subscribe(symbol)
    except Exception as e:
        logger.error(f'Subscribe failed for {symbol}', exc_info=True)
        await self.send(json.dumps({
            'type': 'error',
            'message': 'Subscription failed'
        }))
```

---

## Part 2: High Priority Issues (SHOULD FIX BEFORE PUBLIC)

### 🟠 High #1: Missing Pagination on List Endpoints
**Affected Endpoints** (3 total):
- `UnifiedAlertListView` → Could return 100k+ records
- `OrderFlowEventListView` → Unlimited results
- `AuditLogListView` → No limit

**Issue**: OOM risk if many records exist

**Fix** (Effort: 2 hours):
```python
class UnifiedAlertListView(generics.ListAPIView):
    serializer_class = UnifiedAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AlertCursorPagination  # ✅ Add this
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]  # ✅ Add filtering

    def get_queryset(self):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs[:1000]  # ✅ Add hard limit
```

---

### 🟠 High #2: No Rate Limiting on Auth Endpoints
**Endpoints**:
- `/api/auth/login/` - Brute force vulnerable
- `/api/auth/register/` - Account enumeration attack
- `/api/auth/password-reset/` - DOS attack vector

**Fix** (Effort: 2 hours):
```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='5/m', method='POST')  # 5 attempts per minute
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    # ... existing code ...
```

---

### 🟠 High #3: Missing Tenant Isolation in Orders
**File**: `user_workspace/views_dnse.py` line 234  
**Issue**: Place order not filtered by tenant

```python
# ❌ WRONG — Any authenticated user can modify any order
order = Order.objects.get(id=order_id)
order.status = 'placed'
order.save()

# ✅ CORRECT
tenant = CoreTenant.objects.get(owner_user=request.user)
order = Order.objects.get(id=order_id, portfolio__tenant=tenant)
```

---

## Part 3: Medium Priority Issues (NICE TO HAVE)

| # | Issue | File | Effort | Impact |
|---|-------|------|--------|--------|
| M1 | Serializer validation not enforced | advisory/serializers.py | 1h | Silent invalid data accepted |
| M2 | HTTP 429 returns 400 instead | views_auth.py:198 | 30m | Rate limit semantics wrong |
| M3 | N+1 queries in portfolio list | user_workspace/views.py:45 | 2h | Slow API (100 portfolios = 100+ queries) |
| M4 | Cache error handling swallows exceptions | market_serving/views.py:102 | 1h | Silent stale data |
| M5 | Test passwords hardcoded | settings_test.py:34 | 30m | Bad practice |
| M6 | Missing input validation | advisory/views.py:67 | 2h | Invalid symbols accepted |
| M7 | Timestamp serialization inconsistent | models.py (various) | 1h | Frontend parsing issues |
| M8 | Logging level not configurable | settings.py:456 | 1h | Can't debug in prod |

---

## Part 4: Low Priority Issues (FUTURE)

- Type hints missing (add mypy)
- Documentation strings sparse
- Code formatting (add black + flake8)
- Deprecation warnings not handled
- Database migrations not tested
- Async tasks not monitored
- Performance metrics not collected

---

## Recommended Fix Plan

### Phase 1: Critical (Week 1) — 10 hours
```
Mon-Tue:   Fix password reset (C1) + exception handlers (C2)  → 3h
Wed:       Implement email (C3) + env validation (C4)         → 4h  
Thu-Fri:   Fix WebSocket (C5) + verify all paths               → 3h
```

**Deliverable**: All critical tests passing ✅

### Phase 2: High (Week 2) — 8 hours
```
Mon-Tue:   Add pagination (H1) + rate limiting (H2)           → 4h
Wed-Thu:   Tenant isolation audit (H3) + fix all             → 3h
Fri:       Integration testing + sanity checks               → 1h
```

**Deliverable**: Security review complete ✅

### Phase 3: Medium (Week 3) — 12 hours
```
Mon-Wed:   Serializer validation (M1) + HTTP codes (M2)      → 3h
Thu-Fri:   Query optimization (M3) + logging config (M8)     → 5h
          Input validation (M6) + cache fixes (M4)          → 4h
```

**Deliverable**: Performance tests pass ✅

### Phase 4: Polish (Week 4) — 10 hours
```
Mon-Tue:   Add type hints with mypy                          → 4h
Wed:       Final integration test suite                      → 3h
Thu-Fri:   Documentation + smoke tests                       → 3h
```

**Deliverable**: API ready for public ✅

---

## Quality Gates Before Public Release

### Code Quality Gate
```
✅ No CRITICAL issues remaining
✅ All HIGH issues fixed or documented
✅ Test coverage ≥ 85% on critical paths
✅ No hardcoded values in source
✅ All environment variables validated
```

### Security Gate
```
✅ Rate limiting on all auth endpoints
✅ Tenant isolation verified (data audit)
✅ CORS headers tested
✅ SQL injection tests passed
✅ No credentials in logs/errors
```

### Performance Gate
```
✅ All list endpoints paginated
✅ No N+1 queries (verified with django-silk)
✅ P99 latency < 500ms
✅ Cache hit rate > 80% on hot endpoints
```

### Deployment Gate
```
✅ All required env vars documented
✅ No localhost fallbacks in code
✅ Database migrations tested
✅ Error monitoring configured (Sentry)
✅ Runbook created for incident response
```

---

## Resource Requirements

### Team Composition
- **Backend Engineer**: 30 hours (fixes + testing)
- **DevOps/QA**: 8 hours (deployment + verification)
- **Tech Lead**: 2 hours (code review gates)

### Infrastructure
- Staging environment with realistic data
- Error monitoring (Sentry / DataDog)
- Performance testing tool (locust / k6)
- Load balancer for rate limit testing

---

## Success Criteria

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Critical issues fixed | 100% | 0% | ❌ |
| Test coverage | ≥85% | 45-70% | ❌ |
| Auth endpoint rate limited | ✅ | ❌ | ❌ |
| Tenant isolation verified | ✅ | ❌ | ❌ |
| All env vars validated | ✅ | ❌ | ❌ |
| Error handling complete | ✅ | ~60% | ❌ |
| Performance benchmark pass | ✅ | ❌ | ❌ |

**Estimated Timeline to Release**: June 10, 2026 (4 weeks)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Time overrun | Medium | High | Dedicated sprint, daily standups |
| Security issue found late | Low | Critical | External security audit in Week 3 |
| Regression in existing code | Medium | Medium | Comprehensive test suite required |
| Deployment issue | Low | High | Staging validation + runbook |
| Scope creep | Medium | High | Strict prioritization, defer non-critical |

---

## Next Steps

### This Week (May 13-17)
1. [ ] Get approval for 4-week plan
2. [ ] Allocate backend engineer (30 hours)
3. [ ] Set up staging environment
4. [ ] Create detailed GitHub issues for each fix
5. [ ] Begin Phase 1 (critical fixes)

### Next Week (May 20-24)
6. [ ] Complete Phase 1, test thoroughly
7. [ ] Begin Phase 2 (high priority)
8. [ ] Schedule external security audit

### Week 3 (May 27-31)
9. [ ] Complete Phase 2 + 3
10. [ ] Run external security audit
11. [ ] Performance testing

### Week 4 (June 3-10)
12. [ ] Complete Phase 4
13. [ ] Final integration tests
14. [ ] Get sign-off from Tech Lead
15. [ ] Deploy to production

---

## Appendix: Detailed Issues List

See companion documents:
- **`CORE_API_CODE_QUALITY_AUDIT_20260513.md`** - Full technical audit
- **`CORE_API_ISSUES_INVENTORY_20260513.md`** - Sortable issue tracker

---

## Sign-Off

**Prepared By**: AI Engineering Team  
**Date**: 2026-05-13  
**Version**: 1.0  
**Status**: Ready for Review

**Approval Required From**:
- [ ] Tech Lead (Architecture)
- [ ] Security Officer (Security review)
- [ ] DevOps (Infrastructure readiness)
- [ ] Product Manager (Timeline acceptance)

---

**Recommendation**: **DO NOT RELEASE until all CRITICAL issues are fixed and all gates are passed.**

Current status: **NOT READY FOR PUBLIC** (4-week remediation required)

Would you like to start Phase 1 immediately?
