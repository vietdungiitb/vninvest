# 📊 VNStock Configuration Analysis - Tóm Tắt Toàn Bộ

**Ngày phân tích:** 12/04/2026  
**Thời gian:** ~12 giờ triển khai  
**Trạng thái:** ✅ Sẵn sàng triển khai

---

## 📁 DANH SÁCH TÀI LIỆU TẠO RA

Tôi đã tạo 3 tài liệu chi tiết cho bạn:

| Tài liệu | Mục đích | Đọc bao lâu |
|---------|---------|----------|
| **VNSTOCK_CONFIGURATION_ANALYSIS_20260412.md** | Phân tích toàn bộ chuỗi cấu hình + đề xuất kiến trúc | 45 phút |
| **VNSTOCK_QUICK_REFERENCE_20260412.md** | Tóm tắt nhanh 1 trang - file, params, roadmap | 10 phút |
| **VNSTOCK_IMPLEMENTATION_GUIDE_20260412.md** | Hướng dẫn code chi tiết Step-by-step | 60 phút |

👉 **Đọc trước:** VNSTOCK_QUICK_REFERENCE_20260412.md (để hiểu nhanh)  
👉 **Triển khai:** VNSTOCK_IMPLEMENTATION_GUIDE_20260412.md (step-by-step)  
👉 **Tham khảo:** VNSTOCK_CONFIGURATION_ANALYSIS_20260412.md (chi tiết kỹ thuật)

---

## 🎯 TÓM TẮT PHÁT HIỆN

### 1️⃣ File Sử Dụng VNStock (6 file chính)

```
backend/portfolio/adapters/vnstock_adapter.py       ← Central adapter
backend/portfolio/adapters/cache_adapter.py        ← Cache + rate limit
backend/portfolio/vnstock_compat.py                ← Runtime patches
backend/portfolio/apps.py                          ← Khởi tạo patches
backend/portfolio/realtime/collector.py            ← Intraday ticks
backend/portfolio/services.py                      ← Daily prices, exchange, sync
```

### 2️⃣ Tham Số Cấu Hình Runtime (18 tham số)

**Core Concurrency:**
- `VNSTOCK_MAX_CONCURRENCY` (default: 12)
- `VNSTOCK_RETRY_ATTEMPTS` (default: 1)
- `VNSTOCK_RETRY_BACKOFF_SECONDS` (default: 0.35)

**Timeout by Channel:**
- `VNSTOCK_GENERAL_TIMEOUT_SECONDS` (8)
- `VNSTOCK_INTRADAY_TIMEOUT_SECONDS` (8)
- `VNSTOCK_PRICE_BOARD_TIMEOUT_SECONDS` (8)
- `VNSTOCK_FINANCIAL_RATIO_TIMEOUT_SECONDS` (10)
- `VNSTOCK_HISTORY_TIMEOUT_SECONDS` (12)
- `VNSTOCK_LISTING_TIMEOUT_SECONDS` (12)

**Rate Limit & Sources:**
- `VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS` (20)
- `VNSTOCK_PRICE_BOARD_SOURCE` (VCI)
- `VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES` (KBS,VCI)

### 3️⃣ Initialization Flow

```
Django Load → vnstock_adapter imports → env vars load once
    ↓
PortfolioConfig.ready()
    ├─ patch_vnstock_finance_init()       [Fix period bug]
    └─ disable_vnstock_upgrade_notice()   [Tắt warnings]
    ↓
First request → Lazy import vnstock
    → Adapter wraps with timeout/retry/rate-limit
    → BoundedSemaphore concurrency control
```

### 4️⃣ Current Status

✅ **Hoạt động tốt:**
- Multi-source fallback (price board: VCI → KBS)
- Graceful degradation (fallback DB/synthetic)
- Exponential backoff retry
- Concurrency gating
- Rate limit detection

❌ **Thiếu:**
- Runtime config UI (phải edit .env + restart)
- Hot reload (config load một lần)
- Observability (không có dashboard)
- Audit trail (không log config changes)

---

## 💡 GIẢI PHÁP ĐỀ XUẤT

### Architecture: `RuntimeVnstockConfig` Model + Admin UI

```
┌─────────────────────────────────────┐
│ Django Admin UI                     │
│ (http://localhost:8000/admin/)      │
├─────────────────────────────────────┤
│ RuntimeVnstockConfig                │
│ ├─ max_concurrency                  │
│ ├─ timeouts (7 channels)            │
│ ├─ retry strategy                   │
│ ├─ rate limit cooldown              │
│ └─ sources + feature flags          │
├─────────────────────────────────────┤
│ Cache Layer (5 phút)                │
├─────────────────────────────────────┤
│ vnstock_adapter.py                  │
│ (lazy load config)                  │
└─────────────────────────────────────┘
```

### Implementation (12 giờ)

| Phase | Task | Time | Benefit |
|-------|------|------|---------|
| 1 | Add model + admin | 2h | UI control |
| 2 | Update adapter lazy-load | 3h | Hot reload |
| 3 | Migration + CLI | 1h | Deploy |
| 4 | Metrics/dashboard | 4h | Observability |
| 5 | Patch toggle | 2h | Safe upgrades |

---

## 📝 QUICK START (3 bước)

### Bước 1: Tạo Model (backend/portfolio/models.py)
```python
class RuntimeVnstockConfig(models.Model):
    max_concurrency = PositiveIntegerField(default=12)
    general_timeout_seconds = PositiveIntegerField(default=8)
    intraday_timeout_seconds = PositiveIntegerField(default=8)
    # ... 7 more timeout fields
    retry_attempts = PositiveIntegerField(default=1)
    retry_backoff_seconds = FloatField(default=0.35)
    rate_limit_cooldown_seconds = PositiveIntegerField(default=20)
    price_board_source = CharField(max_length=50, default='VCI')
    # ... + audit fields (updated_at, updated_by, notes)
```
👉 Xem chi tiết: VNSTOCK_IMPLEMENTATION_GUIDE_20260412.md → STEP 1

### Bước 2: Register Admin (backend/portfolio/admin.py)
```python
@admin.register(RuntimeVnstockConfig)
class RuntimeVnstockConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Concurrency', {'fields': ('max_concurrency',)}),
        ('Timeouts', {'fields': (...)}),
        ('Retry', {'fields': (...)}),
        ('Sources', {'fields': (...)}),
    )
    
    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(...)
        cache.delete('vnstock_runtime_config_cache')  # ← Hot invalidate
```
👉 Xem chi tiết: VNSTOCK_IMPLEMENTATION_GUIDE_20260412.md → STEP 2

### Bước 3: Update Adapter (backend/portfolio/adapters/vnstock_adapter.py)
```python
def _get_runtime_config():
    """Load từ DB (cache 5 phút), fallback env vars"""
    cached = cache.get('vnstock_runtime_config_cache')
    if cached:
        return cached
    
    cfg = RuntimeVnstockConfig.get_current()
    config_dict = {...}
    cache.set('vnstock_runtime_config_cache', config_dict, 300)
    return config_dict

def _resolve_int_env_or_db(name, default):
    # Priority: env var > DB config > default
    env = os.getenv(name)
    if env:
        return int(env)
    
    cfg = _get_runtime_config()
    if cfg and name in cfg:
        return cfg[name]
    
    return default
```
👉 Xem chi tiết: VNSTOCK_IMPLEMENTATION_GUIDE_20260412.md → STEP 3

---

## 🚀 USAGE AFTER IMPLEMENTATION

### Trước (cũ - phải restart)
```bash
# Edit .env
VNSTOCK_MAX_CONCURRENCY=20

# Restart Django (downtime!)
systemctl restart django
```

### Sau (mới - hot reload)
```
1. Django Admin → VNStock Runtime Configuration
2. max_concurrency: 12 → 20
3. Click Save
4. Config takes effect within 5 min (no downtime!)
5. Audit log: "user@example.com updated max_concurrency to 20 (2026-04-12 14:30)"
```

---

## 🔍 ERROR CODES REFERENCE

| Code | Trigger | Action |
|------|---------|--------|
| `vnstock_timeout` | Timeout exceed | Retry if enabled |
| `vnstock_rate_limited` | HTTP 429 | Cooldown cache + try fallback source |
| `vnstock_busy` | Semaphore saturated | Return error (queue full) |
| `vnstock_error` | Generic error | Retry if 5xx |
| `vnstock_missing` | Import fails | Fallback to DB |

---

## 📊 DATA SOURCE PRIORITY

```
price_board():
  ├─ Primary: VNSTOCK_PRICE_BOARD_SOURCE (default: VCI)
  ├─ On 429: Try VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES (KBS, VCI, ...)
  └─ If all fail: ExternalSystemException

intraday():    → Only VCI (best for ticks)
history():     → Parameterized source (default: KBS for historical)
finance.ratio: → Parameterized source (default: VCI)
listing:       → Parameterized source (default: VCI)
```

---

## 📋 DEPLOYMENT CHECKLIST

```
Pre-Deployment:
- [ ] Code review: models.py, admin.py, vnstock_adapter.py
- [ ] Staging test: Full deployment cycle
- [ ] Performance test: Cache overhead measurement

Deployment:
- [ ] git pull && migrate
- [ ] python manage.py init_vnstock_runtime_config
- [ ] Restart Django: systemctl restart vnin_vest_django
- [ ] Verify: Django admin accessible
- [ ] Test: Change config via admin → verify takes effect

Post-Deployment:
- [ ] Monitor logs for "Updating vnstock concurrency gate"
- [ ] Track error codes (vnstock_timeout, vnstock_rate_limited)
- [ ] Document new admin process for ops
```

---

## 🎓 LEARNING RESOURCES

Để hiểu chi tiết hơn về từng phần:

### VNStock Library
- **Repository:** git+https://github.com/vietdungiitb/vnstock.git@internal/core-1.0.0
- **Methods:** `.stock()`, `.quote.intraday()`, `.trading.price_board()`, `.finance.ratio()`, `.listing.all_symbols()`

### Django Caching
- `Django.core.cache`: redis-backend, in-memory, etc.
- TTL strategy: 5 min for hot config, 1h for cold data

### Threading
- `BoundedSemaphore`: Concurrency limiter
- `ThreadPoolExecutor`: Timeout enforcement

### Middleware Pattern
- Adapter wraps calls → timeout/retry/rate-limit
- Graceful fallback on error

---

## ❓ FAQ

**Q: Config change phải restart không?**  
A: Không! Cache invalidates in 5 minutes max. Use Django admin untuk hot update.

**Q: Nếu DB down, vnstock adapter vẫn hoạt động không?**  
A: Có, fallback ngay sang env vars (priority: env > DB > default).

**Q: Concurrency gate có race condition không?**  
A: Không, BoundedSemaphore thread-safe. Cập nhật gate khi config thay đổi.

**Q: Patch (Finance.__init__, upgrade notice) có thể toggle được không?**  
A: Hiện không. Phase 5 sẽ thêm feature flag. Tạm thời hardcoded.

**Q: Rate limit cooldown 20s quá lâu không?**  
A: Có thể giảm xuống (config có min: 5s). Adjust dựa trên provider behavior.

---

## 📞 NEXT STEPS

1. **Review** documents (15 min total)
2. **Try Phase 1** (Add model) - verify migration works
3. **Try Phase 2** (Admin UI) - test config change via admin
4. **Try Phase 3** (Adapter update) - verify lazy loading
5. **Performance test** - measure cache overhead
6. **Deploy to staging** - full test cycle
7. **Document** for ops team

---

## 📂 FILE LOCATION

Tất cả tài liệu lưu trong:
```
docs/
├─ VNSTOCK_ANALYSIS_20260412.md               [Phân tích toàn bộ]
├─ VNSTOCK_QUICK_REFERENCE_20260412.md        [Tóm tắt 1 trang]
├─ VNSTOCK_IMPLEMENTATION_GUIDE_20260412.md   [Code step-by-step]
└─ VNSTOCK_SUMMARY_20260412.md                [Tài liệu này]
```

---

## 🎯 FINAL VERDICT

**Current State:** ✅ Functional but inflexible (config requires restart)

**Recommended:** ✅ Implement RuntimeVnstockConfig (12h effort)

**Benefit:**
- Hot config updates (no restart)
- Admin UI for ops team
- Audit trail (who changed what, when)
- Cache-backed (minimal DB queries)
- Backward compatible (env vars still work as override)

**Risk:** 🟢 Low
- Non-breaking change
- Gradual rollout possible
- Fallback chain: env > DB > hardcoded

---

**Status:** 📋 Analysis Complete & Ready for Implementation  
**Confidence:** ✅ High (already exist: adapters, cache, models structure)  
**Effort Estimate:** 12-14 hours including testing  

**Prepared by:** GitHub Copilot  
**Date:** 2026-04-12
