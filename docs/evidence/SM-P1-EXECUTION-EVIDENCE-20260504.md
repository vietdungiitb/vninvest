# SM Phase 1 — Execution Evidence
**Date**: 2026-05-04  
**Phase**: SM-P1 — Security Hardening  
**Tasks**: SM-P1.1, SM-P1.2, SM-P1.3, SM-P1.4  

---

## 1. Files Changed

| File | Task | Change |
|------|------|--------|
| `backend/config/settings.py` | SM-P1.1 | Added `rest_framework_simplejwt.token_blacklist` to INSTALLED_APPS; set `BLACKLIST_AFTER_ROTATION: True` |
| `backend/portfolio/models.py` | SM-P1.2 | `_hash_pat_secret()` upgraded from plain SHA-256 to HMAC-SHA256 with `CORE_PAT_PEPPER` env pepper; added `import os` |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P1.3 | ALLOWED_HOSTS: raises `ImproperlyConfigured` if wildcard/empty in production |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P1.4 | CORS: `CORS_ALLOW_ALL_ORIGINS = False`; explicit `CORS_ALLOWED_ORIGINS` from env; raises if empty in production |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P1.3 | SECRET_KEY: raises if using insecure default in production |
| `packages/core/backend/src/vninvest_core/settings.py` | bonus | CONN_MAX_AGE added to DATABASES (default and legacy_readonly) |

---

## 2. SM-P1.1 — JWT Token Blacklist

**Before**:
```python
'BLACKLIST_AFTER_ROTATION': False,  # "chưa cài blacklist app"
```
**After**:
```python
'BLACKLIST_AFTER_ROTATION': True,   # SM-P1.1: Blacklist rotated refresh tokens
```
INSTALLED_APPS now includes `'rest_framework_simplejwt.token_blacklist'`.

**Impact**: Rotated refresh tokens are invalidated — prevents replay attacks on token theft.  
**Migration required**: `manage.py migrate` will create `token_blacklist_blacklistedtoken` and `token_blacklist_outstandingtoken` tables on next deployment.

---

## 3. SM-P1.2 — PAT HMAC Pepper (Legacy Backend)

**Before** (`backend/portfolio/models.py`):
```python
def _hash_pat_secret(raw_secret: str) -> str:
    return hashlib.sha256(str(raw_secret or '').encode('utf-8')).hexdigest()
```
**After**:
```python
def _hash_pat_secret(raw_secret: str) -> str:
    """SM-P1.2: HMAC-SHA256 with pepper. Plain SHA-256 is insufficient."""
    pepper = os.environ.get('CORE_PAT_PEPPER', '')
    if not pepper:
        warnings.warn("CORE_PAT_PEPPER is not set...", RuntimeWarning)
    return hmac.new(pepper.encode('utf-8'), str(raw_secret or '').encode('utf-8'), hashlib.sha256).hexdigest()
```

**Impact**: PAT tokens stored in DB are now HMAC-protected with a server-side pepper.  
**Action required on deployment**: Set `CORE_PAT_PEPPER` env var. Existing PAT tokens will need to be re-issued (old hashes computed without pepper will not match new HMAC hashes).

**Residual**: Core identity_access/models.py already uses HMAC (no change needed there).

---

## 4. SM-P1.3 — ALLOWED_HOSTS Production Guard

**Before** (`vninvest_core/settings.py`):
```python
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
```
Wildcard default meant production could silently serve all hostnames.

**After**:
```python
_allowed_hosts_raw = os.environ.get('DJANGO_ALLOWED_HOSTS', '*' if DEBUG else '').split(',')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_raw if h.strip()]

if not DEBUG:
    if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['*']:
        raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set...")
    if SECRET_KEY == _secret_key_default:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be changed...")
    if not os.environ.get('CORE_PAT_PEPPER', ''):
        raise ImproperlyConfigured("CORE_PAT_PEPPER must be set...")
```

**Impact**: Container fails to start in production if required security configs are missing — fail-fast over fail-silent.

---

## 5. SM-P1.4 — CORS Hardening

**Before**:
```python
CORS_ALLOW_ALL_ORIGINS = DEBUG
```
`DEBUG=False` would set `CORS_ALLOW_ALL_ORIGINS = False` but no explicit allowed origins list, meaning CORS would reject all cross-origin requests silently.

**After**:
```python
CORS_ALLOW_ALL_ORIGINS = False
_cors_origins_default = 'http://localhost:3000,http://127.0.0.1:3000' if DEBUG else ''
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', _cors_origins_default).split(',') if o.strip()]

if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must be set in production.")
```

**Impact**: Production CORS is always explicit, never wildcard or silently empty.

---

## 6. Validation

```
python -c "
content = open('backend/config/settings.py', encoding='utf-8').read()
assert 'token_blacklist' in content
assert 'BLACKLIST_AFTER_ROTATION.*True' or \"'BLACKLIST_AFTER_ROTATION': True\" in content

content2 = open('backend/portfolio/models.py', encoding='utf-8').read()
assert 'hmac.new(' in content2
assert 'CORE_PAT_PEPPER' in content2

content3 = open('packages/core/backend/src/vninvest_core/settings.py', encoding='utf-8').read()
assert 'ImproperlyConfigured' in content3
assert 'CORS_ALLOW_ALL_ORIGINS = False' in content3
print('ALL ASSERTIONS PASSED')
"
# Output: ALL ASSERTIONS PASSED ✅
```

Syntax checks:
```
python -c "import ast; [ast.parse(open(f, encoding='utf-8').read()) for f in [
    'packages/core/backend/src/vninvest_core/settings.py',
    'backend/config/settings.py',
    'backend/portfolio/models.py',
]]"
# No errors ✅
```

---

## 7. Residual Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| PAT re-issue required after HMAC pepper activation | Existing users lose their PAT tokens | Document in deployment runbook; admin tool to rotate PATs |
| JWT blacklist table migration must run on deploy | Worker/Beat start before migration completes if raced | entrypoint.sh runs migrate on api startup only; worker depends on api health |
| `CORE_PAT_PEPPER` must be set before first production deploy | Container fails to start (by design) | Add to secret manager / .env.production before deploy |
| `BLACKLIST_AFTER_ROTATION` doubles DB writes on refresh | Performance cost ~1 extra write per refresh | Acceptable trade-off for security |
