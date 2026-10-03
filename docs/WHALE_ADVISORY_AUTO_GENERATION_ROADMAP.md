# 🐋 Whale Advisory Auto-Generation & Auto-Refresh Roadmap

**Date Created**: 2026-04-09  
**Status**: Planning Phase  
**Owner**: VNInvest Development Team  
**Priority**: High (Cost Control + Feature Completeness)

---

## 📋 Executive Summary

### Problem Statement
| Issue | Impact | Priority |
|-------|--------|----------|
| Advisories ONLY created when whale signals detected | Tracked symbols without whale alerts = no advisory | 🔴 High |
| No auto-refresh mechanism | Advisory remains old > 24h | 🔴 High |
| AI prompt lacks portfolio context | Advisory not relevant to user position | 🟠 Medium |
| Advisory text too long (50-200 words) | Doesn't meet 5-10 lines requirement | 🟠 Medium |
| No cost control | Uncontrolled API spending | 🔴 High |

### Solution Overview
Implement **7-phase system** for auto-generating advisories on all tracked symbols with:
- ✅ Automatic generation every 4 hours or configurable interval
- ✅ Auto-refresh for stale advisories (> 24h old)
- ✅ Portfolio-aware AI prompts (5-10 lines output)
- ✅ User-level cost control (toggle auto/whale/manual + daily budget)
- ✅ Token tracking and monitoring

---

## 🎯 Success Criteria

- [ ] All tracked symbols have advisory (no empty states)
- [ ] Advisories refreshed automatically when > 24h old
- [ ] Advisory text limited to 5-10 lines (~100 tokens)
- [ ] User settings control auto/whale/manual generation
- [ ] Daily token budget tracked per user
- [ ] No API exceeds quota
- [ ] All changes deployed to `deploy` branch
- [ ] Production tested and working

---

## 🔧 Architecture Overview

```
TRIGGER PATHS:
├─ Auto-Generation (Periodic Job, Every 4h)
│  └─ Celery Beat → auto_generate_advisories_for_all_tracked()
│     └─ Queries all users + TrackedSymbols
│     └─ Checks: Config enabled + Budget available + Age > 24h
│     └─ Generates concise advisory (~5-10 lines)
│
├─ Whale Signal (Real-time)
│  └─ detect_whale_signals() → generate_whale_advisory_task()
│     └─ Checks: Config enabled + Budget available
│     └─ Generates full advisory immediately
│
└─ Manual Refresh (User-triggered)
   └─ /api/whale-advisory/<symbol>/refresh/ (POST)
      └─ Checks: Config enabled + Budget available + Cooldown
      └─ Skips cooldown if advisory > 24h old

DATA FLOW:
build_symbol_ai_context()
├─ Portfolio position (shares, avg_price, unrealized P&L)
├─ Stock market stats (price, volume, volatility)
├─ Order flow signals (recent whale alerts)
└─ User tier (Pro/Premium/Admin)
   ↓
generate_advisory_concise()
├─ Prompt: 5-10 lines format
├─ Max tokens: ~100 (vs 50-200 current)
└─ Models: OpenClaw, Claude, OpenAI
   ↓
WhaleAdvisory.create()
├─ Store: symbol, matched_value, side, ai_summary
├─ Track: source (auto_gen|whale_signal|manual_refresh)
├─ Log tokens: AdvisoryTokenLog.create()
└─ Push: WebSocket to user group

CONFIG CONTROL:
UserConfig settings
├─ advisory_auto_generation_enabled (default: True)
├─ advisory_whale_signal_enabled (default: True)
├─ advisory_manual_refresh_enabled (default: True)
├─ advisory_refresh_interval_hours (default: 24)
└─ advisory_max_tokens_per_day (default: 5000)
   ↓
Rate Limiting
├─ Daily budget tracking: AdvisoryTokenLog.filter(date=today).sum()
├─ Skip generation if: tokens_today >= budget
└─ Alert user: "65% of daily budget used"
```

---

## 📊 7-Phase Implementation Plan

### 🟢 PHASE 1: Database Model Enhancement
**Duration**: 4 hours  
**Files Modified**:
- `backend/portfolio/models.py` (WhaleAdvisory + UserConfig + AdvisoryTokenLog)
- `backend/portfolio/migrations/` (new migration)

**Changes**:

1. **WhaleAdvisory Model** (line ~1162):
   ```python
   # ADD fields:
   next_refresh_at = DateTimeField(null=True, blank=True)
   refresh_count = PositiveIntegerField(default=0)
   is_auto_generated = BooleanField(default=True)
   source = CharField(max_length=20, choices=[
       ('whale_signal', 'Whale Signal Detected'),
       ('periodic_job', 'Auto-Generation Job'),
       ('user_refresh', 'Manual User Refresh'),
   ])
   
   # ADD indexes:
   class Meta:
       indexes = [
           models.Index(fields=['user', 'next_refresh_at']),
           models.Index(fields=['symbol', 'next_refresh_at']),
       ]
   ```

2. **UserConfig Model** (extend existing):
   ```python
   # ADD fields:
   advisory_auto_generation_enabled = BooleanField(default=True)
   advisory_whale_signal_enabled = BooleanField(default=True)
   advisory_manual_refresh_enabled = BooleanField(default=True)
   advisory_refresh_interval_hours = PositiveIntegerField(default=24)
   advisory_max_tokens_per_day = PositiveIntegerField(default=5000)
   ```

3. **New Model: AdvisoryTokenLog**:
   ```python
   class AdvisoryTokenLog(models.Model):
       user = ForeignKey(User, on_delete=models.CASCADE)
       advisory = ForeignKey(WhaleAdvisory, on_delete=models.CASCADE, null=True)
       tokens_used = PositiveIntegerField()
       source = CharField(max_length=20, choices=[...])
       created_at = DateTimeField(auto_now_add=True)
       
       class Meta:
           indexes = [
               models.Index(fields=['user', 'created_at']),
           ]
   ```

**Validation**: Verify migrations create without errors

---

### 🟡 PHASE 2: AI Context & Prompt Enhancement
**Duration**: 6 hours  
**Files Modified**:
- `backend/portfolio/ai_context.py` (expand build_symbol_ai_context)
- `backend/portfolio/ai_service.py` (new generate_advisory_concise)
- `backend/portfolio/openclaw_client.py` (new prompt template)

**Changes**:

1. **Enrich AI Context** (`ai_context.py`):
   ```python
   def build_symbol_ai_context(symbol: str, user=None) -> dict:
       # EXISTING: profile, market, intraday, recent_advisories
       # ADD:
       return {
           ...existing_data,
           'portfolio_position': {
               'shares_owned': int,
               'avg_buy_price': float,
               'current_value': float,
               'unrealized_pnl': float,
               'unrealized_pnl_pct': float,
           } if user and user.portfolio.filter(symbol=symbol) else None,
           'tracked_reason': str,  # Why user tracks
           'user_tier': str,  # 'Pro' | 'Premium' | 'Admin'
       }
   ```

2. **New Concise Advisory Generator** (`ai_service.py`):
   ```python
   def generate_advisory_concise(
       provider: str, model: str, api_key: str,
       symbol: str, matched_value_vnd: float, side: str, user=None
   ) -> dict:
       """
       Generate 5-10 line advisory (~100 tokens)
       Returns: {summary, detail, tokens_used}
       """
       context = build_symbol_ai_context(symbol, user)
       
       prompt = render_concise_prompt_template(
           symbol=symbol,
           matched_value_vnd=matched_value_vnd,
           side=side,
           portfolio=context.get('portfolio_position'),
           market=context.get('market'),
       )
       
       if provider == 'openclaw':
           return generate_whale_concise(prompt, symbols, side)
       elif provider == 'claude':
           return _claude_completion(api_key, model, prompt, max_tokens=130)
       # ... other providers
   ```

3. **Concise Prompt Templates** (`openclaw_client.py`):
   ```python
   def generate_whale_concise(
       symbol: str, matched_value_vnd: float, side: str, extra_context: str
   ) -> dict:
       """5-10 lines, ~100 tokens"""
       prompt = f"""Phân tích ngắn gọn (5-10 dòng) về tín hiệu giao dịch tại TTCK Việt Nam:
   
   Mã: {symbol}
   Lệnh: {side}
   Giá trị: {matched_value_vnd/1e9:.1f} tỷ VNĐ
   
   {extra_context}
   
   Viết nhanh gọn:
   - 1 câu về động lực
   - 1 câu về rủi ro
   - 1 câu về theo dõi
   
   [Thông tin tham khảo, không phải lời khuyên đầu tư]"""
       
       return _call(prompt, max_tokens=130)
   ```

**Validation**: Test with sample symbols, verify output is 5-10 lines

---

### 🟢 PHASE 3: Celery Periodic Job
**Duration**: 5 hours  
**Files Modified**:
- `backend/portfolio/tasks.py` (new auto_generate_advisories task)
- `backend/config/celery.py` (add beat schedule)

**Changes**:

1. **New Celery Task** (`tasks.py`, new function):
   ```python
   @shared_task
   def auto_generate_advisories_for_all_tracked():
       """
       Periodic job: generate advisories for all tracked symbols
       Run every 4 hours (configurable in Celery Beat)
       """
       from django.utils import timezone
       from datetime import timedelta
       
       # 1. Query all active users with tracked symbols
       users = User.objects.filter(is_active=True).distinct()
       
       for user in users:
           config = UserConfig.objects.get(user=user)
           
           # 2. Check: auto-generation enabled?
           if not config.advisory_auto_generation_enabled:
               continue
           
           # 3. Check: daily budget exceeded?
           tokens_today = AdvisoryTokenLog.objects.filter(
               user=user,
               created_at__date=timezone.now().date(),
           ).aggregate(Sum('tokens_used'))['tokens_used__sum'] or 0
           
           if tokens_today >= config.advisory_max_tokens_per_day:
               logger.info(f"User {user.id} budget exceeded, skipping auto-gen")
               send_budget_alert(user, tokens_today, config.advisory_max_tokens_per_day)
               continue
           
           # 4. Process each tracked symbol
           tracked_symbols = TrackedSymbol.objects.filter(user=user)
           
           for tracked in tracked_symbols:
               symbol = tracked.symbol
               
               # Check advisory exists + age
               advisory = WhaleAdvisory.objects.filter(
                   user=user, symbol=symbol
               ).order_by('-created_at').first()
               
               if advisory is None:
                   # 5a. CREATE new advisory
                   logger.info(f"Generating first advisory for {symbol}")
                   generate_whale_advisory_task.apply_async(
                       kwargs={
                           'symbol': symbol,
                           'matched_value_vnd': 0,  # Auto-gen has no signal
                           'side': 'INFO',
                           'user_id': user.id,
                           'source': 'periodic_job',
                       },
                       countdown=random.randint(5, 15),  # Stagger requests
                   )
               else:
                   # 5b. CHECK if refresh needed
                   next_refresh = advisory.next_refresh_at or (
                       advisory.created_at + timedelta(
                           hours=config.advisory_refresh_interval_hours
                       )
                   )
                   
                   if next_refresh <= timezone.now():
                       logger.info(f"Refreshing stale advisory for {symbol}")
                       generate_whale_advisory_task.apply_async(
                           kwargs={
                               'symbol': symbol,
                               'matched_value_vnd': 0,
                               'side': 'INFO',
                               'user_id': user.id,
                               'source': 'periodic_job',
                               'force_refresh': True,
                           },
                           countdown=random.randint(5, 15),
                       )
   ```

2. **Celery Beat Schedule** (`config/celery.py`):
   ```python
   from celery.schedules import crontab
   
   CELERY_BEAT_SCHEDULE = {
       ...existing_tasks,
       'auto-generate-advisories': {
           'task': 'portfolio.tasks.auto_generate_advisories_for_all_tracked',
           'schedule': crontab(minute=0, hour='*/4'),  # Every 4 hours
           'options': {'expires': 3600},  # Expire if not run within 1h
       },
   }
   ```

3. **Modify generate_whale_advisory_task** (`tasks.py`, existing function ~line 432):
   ```python
   @shared_task
   def generate_whale_advisory_task(
       symbol: str,
       matched_value_vnd: float,
       side: str,
       threshold: float = 0,
       force_refresh: bool = False,
       user_id: int | None = None,
       source: str = 'whale_signal',
   ) -> dict:
       # EXISTING logic...
       user = User.objects.get(id=user_id) if user_id else None
       
       # NEW: Check config before generating
       if user:
           config = UserConfig.objects.get(user=user)
           
           if source == 'whale_signal' and not config.advisory_whale_signal_enabled:
               logger.info(f"User {user_id} has whale-signal disabled")
               return {'status': 'skipped', 'reason': 'whale_signal_disabled'}
           
           if source == 'periodic_job' and not config.advisory_auto_generation_enabled:
               logger.info(f"User {user_id} has auto-gen disabled")
               return {'status': 'skipped', 'reason': 'auto_gen_disabled'}
       
       # EXISTING: Generate advisory
       ai_summary = generate_advisory_concise(...)
       
       # NEW: Create advisory with source tracking
       advisory = WhaleAdvisory.objects.create(
           user=user,
           symbol=symbol,
           matched_value=matched_value_vnd,
           side=side,
           threshold=threshold,
           ai_summary=ai_summary,
           ai_provider=provider,
           ai_model=model,
           prompt_tokens=prompt_tokens,
           completion_tokens=completion_tokens,
           is_auto_generated=(source in ['periodic_job', 'auto_gen']),
           source=source,
           next_refresh_at=timezone.now() + timedelta(hours=24),
       )
       
       # NEW: Log token usage
       AdvisoryTokenLog.objects.create(
           user=user,
           advisory=advisory,
           tokens_used=prompt_tokens + completion_tokens,
           source=source,
       )
       
       return {'status': 'success', 'advisory_id': advisory.id}
   ```

**Validation**: Test job scheduling, verify advisories generate correctly

---

### 🟡 PHASE 4: API Endpoint Enhancement
**Duration**: 4 hours  
**Files Modified**:
- `backend/portfolio/views.py` (WhaleAdvisoryListView, refresh endpoint)
- `backend/portfolio/serializers.py` (WhaleAdvisorySerializer)

**Changes**:

1. **Update WhaleAdvisoryListView** (`views.py`, ~line 3246):
   ```python
   class WhaleAdvisoryListView(generics.ListAPIView):
       permission_classes = [IsAuthenticated, IsProPlan]
       serializer_class = WhaleAdvisorySerializer
       
       def get_queryset(self):
           qs = WhaleAdvisory.objects.filter(user=self.request.user).order_by('-created_at')[:100]
           
           # NEW: Filter by refresh status
           refresh_status = self.request.query_params.get('refresh_status')
           if refresh_status == 'ready':
               # Ready for refresh: > 24h old
               cutoff = timezone.now() - timedelta(hours=24)
               qs = qs.filter(created_at__lt=cutoff)
           elif refresh_status == 'pending':
               # Pending next refresh
               qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__lte=timezone.now())
           elif refresh_status == 'recent':
               # Recent (< 4h)
               cutoff = timezone.now() - timedelta(hours=4)
               qs = qs.filter(created_at__gt=cutoff)
           
           return qs
   ```

2. **New Endpoint: Advisory Info** (`views.py`, new):
   ```python
   @api_view(['GET'])
   @permission_classes([IsAuthenticated, IsProPlan])
   def whale_advisory_auto_refresh_info(request, symbol: str):
       """GET /api/portfolio/whale-advisory/<symbol>/auto-refresh-info/"""
       user = request.user
       
       try:
           advisory = WhaleAdvisory.objects.filter(
               user=user, symbol=symbol
           ).order_by('-created_at').first()
           
           tracked = TrackedSymbol.objects.get(user=user, symbol=symbol)
           
           if not advisory:
               return Response({
                   'symbol': symbol,
                   'status': 'no_advisory',
                   'reason': 'Not yet generated',
                   'tracked_since': tracked.created_at,
               }, status=200)
           
           config = UserConfig.objects.get(user=user)
           refresh_interval = config.advisory_refresh_interval_hours
           next_refresh = advisory.created_at + timedelta(hours=refresh_interval)
           
           return Response({
               'symbol': symbol,
               'advisory_id': advisory.id,
               'last_refreshed_at': advisory.created_at,
               'next_refresh_at': next_refresh,
               'refresh_count': advisory.refresh_count,
               'is_stale': next_refresh < timezone.now(),
               'source': advisory.source,
               'tracked_reason': getattr(tracked, 'note', ''),
           }, status=200)
       except TrackedSymbol.DoesNotExist:
           return Response({'error': 'Symbol not tracked'}, status=404)
   ```

3. **Update Refresh Endpoint** (`views.py`, ~line 3276):
   ```python
   @api_view(['POST'])
   @permission_classes([IsAuthenticated, IsProPlan])
   def refresh_whale_advisory_api(request, symbol: str):
       """POST /api/portfolio/whale-advisory/<symbol>/refresh/"""
       user = request.user
       config = UserConfig.objects.get(user=user)
       
       # NEW: Check manual refresh enabled
       if not config.advisory_manual_refresh_enabled:
           return Response(
               {'error': 'Manual refresh disabled in settings'},
               status=403
           )
       
       # Existing: Check cooldown + budget
       ...
       
       # NEW: Skip cooldown if advisory > 24h old
       existing = WhaleAdvisory.objects.filter(
           user=user, symbol=symbol
       ).order_by('-created_at').first()
       
       if existing and (timezone.now() - existing.created_at).total_seconds() > 86400:
           # Advisory > 24h old: allow refresh without cooldown
           logger.info(f"Refreshing stale advisory for {symbol}")
           cooldown_needed = False
       
       if cooldown_needed:
           refresh_lock_key = f'whale_advisory_refresh_lock:{user.id}:{symbol}'
           if cache.get(refresh_lock_key):
               return Response({'error': 'Too many refreshes'}, status=429)
           cache.set(refresh_lock_key, True, 90)
       
       # Trigger refresh
       generate_whale_advisory_task.apply_async(
           kwargs={
               'symbol': symbol,
               'matched_value_vnd': 0,
               'side': 'INFO',
               'user_id': user.id,
               'source': 'user_refresh',
               'force_refresh': True,
           },
           countdown=2,
       )
       
       return Response({'status': 'refresh_queued'}, status=202)
   ```

4. **Update Serializer** (`serializers.py`, ~line 170):
   ```python
   class WhaleAdvisorySerializer(serializers.ModelSerializer):
       class Meta:
           model = WhaleAdvisory
           fields = [
               'id', 'symbol', 'matched_value', 'side', 'threshold',
               'ai_summary', 'ai_detail', 'ai_provider', 'ai_model',
               'created_at', 'next_refresh_at', 'refresh_count',
               'is_auto_generated', 'source',  # NEW
           ]
           read_only_fields = fields
   ```

**Validation**: Test all endpoints with curl/Postman, verify filtering works

---

### 🟢 PHASE 5: Frontend Integration
**Duration**: 5 hours  
**Files Modified**:
- `frontend/src/pages/WhaleAdvisory.jsx`
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

**Changes**:

1. **Add Advisory Age Badge** (`WhaleAdvisory.jsx`):
   ```jsx
   // Helper: calculate advisory age
   const getAdvisoryAge = (createdAt) => {
     const age = Date.now() - new Date(createdAt).getTime();
     if (age < 3600000) return `${Math.floor(age / 60000)}m`;
     if (age < 86400000) return `${Math.floor(age / 3600000)}h`;
     return `${Math.floor(age / 86400000)}d`;
   };
   
   // Helper: check if stale (> 24h)
   const isStale = (createdAt) => {
     return Date.now() - new Date(createdAt).getTime() > 86400000;
   };
   
   // In table row:
   <td className="text-xs text-slate-400">
     {isStale(row.created_at) ? (
       <span className="inline-flex items-center gap-1 rounded bg-red-900/30 px-2 py-1 text-red-200">
         ⚠️ {t('whaleAdvisory.staleAdvisory')} ({getAdvisoryAge(row.created_at)})
       </span>
     ) : (
       <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1">
         🕐 {t('whaleAdvisory.advisoryAge', { age: getAdvisoryAge(row.created_at) })}
       </span>
     )}
   </td>
   ```

2. **Add Refresh Button** (`WhaleAdvisory.jsx`):
   ```jsx
   const [refreshing, setRefreshing] = useState({});
   
   const handleRefresh = async (symbol) => {
     setRefreshing(prev => ({...prev, [symbol]: true}));
     try {
       const res = await fetch(
         `/api/portfolio/whale-advisory/${symbol}/refresh/`,
         { method: 'POST' }
       );
       if (res.ok) {
         toast.success(t('whaleAdvisory.refreshQueued'));
         // Reload advisories after 2s
         setTimeout(() => fetchData(), 2000);
       } else {
         toast.error(await res.json().error);
       }
     } catch (err) {
       toast.error(err.message);
     } finally {
       setRefreshing(prev => ({...prev, [symbol]: false}));
     }
   };
   
   // In table row:
   <td>
     <button
       onClick={() => handleRefresh(row.symbol)}
       disabled={refreshing[row.symbol] || !isStale(row.created_at)}
       className="rounded bg-cyan-700 px-3 py-1 text-xs hover:bg-cyan-600 disabled:opacity-50"
     >
       {refreshing[row.symbol] ? '⏳' : '🔄'} {t('whaleAdvisory.refreshNow')}
     </button>
   </td>
   ```

3. **Enhanced Empty States** (`WhaleAdvisory.jsx`):
   ```jsx
   if (trackedSymbolList.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center py-12 text-slate-400">
         <div className="text-6xl mb-4">📭</div>
         <p>{t('whaleAdvisory.noTrackedSymbols')}</p>
       </div>
     );
   }
   
   if (pagedRows.length === 0 && sortedRows.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center py-12 text-slate-400">
         <div className="text-6xl mb-4">🔄</div>
         <p>{t('whaleAdvisory.generatingAdvisories')}</p>
       </div>
     );
   }
   ```

4. **Add i18n Keys** (`vi.js` + `en.js`):
   ```javascript
   // vi.js
   whaleAdvisory: {
     ...existing_keys,
     advisoryAge: 'Cập nhật {age} trước',
     staleAdvisory: 'Khuyến nghị cũ - Nhấn để làm mới',
     nextRefresh: 'Lần tới tự động cập nhật lúc {time}',
     refreshNow: 'Làm mới',
     refreshQueued: 'Đã gửi yêu cầu làm mới',
     autoRefreshPending: 'Chờ tự động cập nhật',
     generatingAdvisories: 'Đang tạo khuyến nghị cho các mã mới...',
     noTrackedSymbols: 'Chưa theo dõi mã nào',
   }
   
   // en.js
   whaleAdvisory: {
     ...existing_keys,
     advisoryAge: 'Updated {age} ago',
     staleAdvisory: 'Stale advisory - Click to refresh',
     nextRefresh: 'Next auto-update at {time}',
     refreshNow: 'Refresh',
     refreshQueued: 'Refresh queued',
     autoRefreshPending: 'Awaiting auto-refresh',
     generatingAdvisories: 'Generating advisories for new symbols...',
     noTrackedSymbols: 'No tracked symbols yet',
   }
   ```

**Validation**: Visual test on `/ai-advisory` page, verify buttons work; legacy `/whale-advisory` path is retired.

---

### 🟡 PHASE 6: Configuration UI & Cost Control
**Duration**: 6 hours  
**Files Modified**:
- `frontend/src/pages/UserSettings.jsx` (or admin panel)
- `frontend/src/i18n/vi.js` + `en.js`
- `backend/portfolio/views.py` (new config endpoints)

**Changes**:

1. **Backend Config API** (`views.py`, new):
   ```python
   @api_view(['GET', 'PUT'])
   @permission_classes([IsAuthenticated])
   def user_advisory_config(request):
       """GET/PUT /api/portfolio/advisory-config/"""
       config = UserConfig.objects.get(user=request.user)
       
       if request.method == 'GET':
           return Response({
               'advisory_auto_generation_enabled': config.advisory_auto_generation_enabled,
               'advisory_whale_signal_enabled': config.advisory_whale_signal_enabled,
               'advisory_manual_refresh_enabled': config.advisory_manual_refresh_enabled,
               'advisory_refresh_interval_hours': config.advisory_refresh_interval_hours,
               'advisory_max_tokens_per_day': config.advisory_max_tokens_per_day,
               'tokens_used_today': AdvisoryTokenLog.objects.filter(
                   user=request.user,
                   created_at__date=timezone.now().date(),
               ).aggregate(Sum('tokens_used'))['tokens_used__sum'] or 0,
           })
       
       elif request.method == 'PUT':
           serializer = UserAdvisoryConfigSerializer(config, data=request.data, partial=True)
           if serializer.is_valid():
               serializer.save()
               return Response(serializer.data)
           return Response(serializer.errors, status=400)
   ```

2. **Frontend Settings Page** (`UserSettings.jsx`, new section):
   ```jsx
   export function AdvisoryConfigSection() {
     const [config, setConfig] = useState(null);
     const [loading, setLoading] = useState(false);
     const [budgetUsage, setBudgetUsage] = useState(0);
     const { t } = useI18n();
     
     useEffect(() => {
       fetchConfig();
     }, []);
     
     const fetchConfig = async () => {
       const res = await fetch('/api/portfolio/advisory-config/');
       const data = await res.json();
       setConfig(data);
       setBudgetUsage(data.tokens_used_today / data.advisory_max_tokens_per_day * 100);
     };
     
     const handleSave = async () => {
       setLoading(true);
       const res = await fetch('/api/portfolio/advisory-config/', {
         method: 'PUT',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify(config),
       });
       if (res.ok) {
         toast.success(t('settings.advisorySaved'));
       } else {
         toast.error(t('settings.error'));
       }
       setLoading(false);
     };
     
     if (!config) return <div>Loading...</div>;
     
     const budgetColor = budgetUsage > 80 ? 'bg-red-600' : budgetUsage > 50 ? 'bg-yellow-600' : 'bg-green-600';
     
     return (
       <div className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
         <h3 className="text-lg font-semibold">{t('settings.advisoryConfig')}</h3>
         
         {/* Toggles */}
         <div className="space-y-3">
           <Toggle
             checked={config.advisory_auto_generation_enabled}
             onChange={(checked) => setConfig({...config, advisory_auto_generation_enabled: checked})}
             label={t('settings.autoGeneration')}
             description={t('settings.autoGenerationDesc')}
           />
           <Toggle
             checked={config.advisory_whale_signal_enabled}
             onChange={(checked) => setConfig({...config, advisory_whale_signal_enabled: checked})}
             label={t('settings.whaleSignal')}
             description={t('settings.whaleSignalDesc')}
           />
           <Toggle
             checked={config.advisory_manual_refresh_enabled}
             onChange={(checked) => setConfig({...config, advisory_manual_refresh_enabled: checked})}
             label={t('settings.manualRefresh')}
             description={t('settings.manualRefreshDesc')}
           />
         </div>
         
         {/* Sliders */}
         <div className="space-y-3">
           <Slider
             label={t('settings.refreshInterval')}
             min={8}
             max={48}
             value={config.advisory_refresh_interval_hours}
             onChange={(val) => setConfig({...config, advisory_refresh_interval_hours: val})}
             unit="hours"
           />
           <Slider
             label={t('settings.dailyBudget')}
             min={1000}
             max={20000}
             step={1000}
             value={config.advisory_max_tokens_per_day}
             onChange={(val) => setConfig({...config, advisory_max_tokens_per_day: val})}
             unit="tokens"
           />
         </div>
         
         {/* Budget Usage */}
         <div className="space-y-2">
           <div className="flex justify-between text-xs text-slate-400">
             <span>{t('settings.budgetUsage')}</span>
             <span>{config.tokens_used_today} / {config.advisory_max_tokens_per_day}</span>
           </div>
           <div className="h-2 rounded-full bg-slate-800">
             <div
               className={`h-full rounded-full transition-all ${budgetColor}`}
               style={{width: `${Math.min(budgetUsage, 100)}%`}}
             />
           </div>
         </div>
         
         <button
           onClick={handleSave}
           disabled={loading}
           className="rounded bg-cyan-700 px-4 py-2 font-semibold hover:bg-cyan-600 disabled:opacity-50"
         >
           {loading ? t('common.saving') : t('common.save')}
         </button>
       </div>
     );
   }
   ```

3. **i18n Keys** (`vi.js` + `en.js`):
   ```javascript
   // vi.js
   settings: {
     advisoryConfig: 'Cấu hình tạo khuyến nghị',
     autoGeneration: 'Tạo tự động (mỗi 4 giờ)',
     autoGenerationDesc: 'Tạo khuyến nghị cho tất cả mã được theo dõi',
     whaleSignal: 'Khi phát hiện tín hiệu cá voi',
     whaleSignalDesc: 'Tự động tạo khi có lệnh mua/bán lớn',
     manualRefresh: 'Cho phép làm mới thủ công',
     manualRefreshDesc: 'User có thể nhấn nút "Làm mới"',
     refreshInterval: 'Thời gian cập nhật tự động',
     dailyBudget: 'Ngân sách token hàng ngày',
     budgetUsage: 'Sử dụng ngân sách hôm nay',
     advisorySaved: 'Cấu hình khuyến nghị đã lưu',
   }
   ```

**Validation**: Settings page loads, toggles work, budget displays correctly

---

### 🔴 PHASE 7: Monitoring & Safeguards
**Duration**: 4 hours  
**Files Modified**:
- `backend/portfolio/tasks.py` (error handling + retry)
- `docs/PROGRESS_DASHBOARD.md` (add monitoring section)

**Changes**:

1. **Error Handling & Retry Logic** (`tasks.py`):
   ```python
   @shared_task(bind=True, max_retries=3)
   def generate_whale_advisory_task(self, **kwargs):
       try:
           # ... existing logic ...
       except Exception as exc:
           logger.error(f"Advisory generation failed: {exc}")
           
           # Retry with exponential backoff
           raise self.retry(exc=exc, countdown=min(2 ** self.request.retries, 600))
   
   
   def on_advisory_generation_failure(sender, task_id, exception, traceback, **kwargs):
       """Called when task exhausts all retries"""
       logger.critical(f"Advisory generation FAILED permanently: {exception}")
       # Alert admin via Slack/email
       send_admin_alert(f"Advisory generation failed: {exception}")
   
   
   task_postrun.connect(on_advisory_generation_failure)
   ```

2. **Rate Limiting Enforcement** (`tasks.py`):
   ```python
   def check_rate_limits(user_id: int, source: str) -> bool:
       """Check if user has exceeded rate limits"""
       # Daily budget check
       tokens_today = AdvisoryTokenLog.objects.filter(
           user_id=user_id,
           created_at__date=timezone.now().date(),
       ).aggregate(Sum('tokens_used'))['tokens_used__sum'] or 0
       
       config = UserConfig.objects.get(user_id=user_id)
       if tokens_today >= config.advisory_max_tokens_per_day:
           logger.warning(f"User {user_id} exceeded daily budget")
           return False
       
       # System-wide rate limit: 100 advisories/hour
       hour_ago = timezone.now() - timedelta(hours=1)
       recent_count = AdvisoryTokenLog.objects.filter(
           created_at__gte=hour_ago
       ).count()
       
       if recent_count >= 100:
           logger.warning("System rate limit: 100 advisories/hour exceeded")
           return False
       
       return True
   ```

3. **Monitoring Dashboard** (add to `docs/PROGRESS_DASHBOARD.md`):
   ```markdown
   ### 🐋 Advisory Generation Metrics
   
   **Daily Stats**:
   - Total advisories generated today: XX
   - Total tokens used: XX / XX,XXX
   - Failed generations: X (with retry countdown)
   - System rate limit: XX / 100 per hour
   
   **By Source**:
   - Auto-generation: XX
   - Whale signals: XX
   - Manual refresh: XX
   
   **Errors**:
   - API failures: X (last: {timestamp})
   - Timeout: X
   - Budget exceeded: X users
   
   **Top Tracked Symbols**:
   1. VNI: 15 advisories
   2. VCB: 12 advisories
   3. HPG: 10 advisories
   ```

**Validation**: Test retry logic, verify monitoring captures stats

---

## 📋 Phase Sequence & Dependencies

```
SEQUENTIAL ORDER (Must follow):

1️⃣  PHASE 1: Database Models
    ↓ Create migration
    ↓ Apply to DB
    ↓

2️⃣  PHASE 2: AI Context & Prompts
    ↓ Depends on Phase 1
    ↓

3️⃣  PHASE 3: Celery Job
    ↓ Depends on Phase 1 + Phase 2
    ↓

4️⃣  PHASE 4: API Endpoints
    ↓ Depends on Phase 1 + Phase 3
    ↓

5️⃣  PHASE 5: Frontend UI
    ↓ Depends on Phase 4
    ↓ Can parallel with Phase 6
    ↓

6️⃣  PHASE 6: Config UI
    ↓ Depends on Phase 4
    ↓ Can parallel with Phase 5
    ↓

7️⃣  PHASE 7: Monitoring
    ↓ Depends on Phase 3 + Phase 4
    ↓

✅ FINAL: End-to-end testing + deployment
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] WhaleAdvisory model saves with all new fields
- [ ] AdvisoryTokenLog tracks tokens correctly
- [ ] auto_generate_advisories_for_all_tracked queries correctly
- [ ] generate_advisory_concise produces 5-10 lines
- [ ] Rate limiting blocks over-budget users

### Integration Tests
- [ ] Celery Beat runs every 4h
- [ ] Advisory generated for symbol without existing advisory
- [ ] Advisory refreshes when > 24h old
- [ ] Manual refresh respects cooldown for fresh advisories
- [ ] Token logging records all sources (auto/whale/manual)

### API Tests
- [ ] GET /api/portfolio/whale-advisory/ returns advisories with new fields
- [ ] GET /api/portfolio/whale-advisory/<symbol>/auto-refresh-info/ returns correct status
- [ ] POST /api/portfolio/whale-advisory/<symbol>/refresh/ queues task
- [ ] GET/PUT /api/portfolio/advisory-config/ manages user settings
- [ ] Filter: ?refresh_status=ready|pending|recent works

### Frontend Tests
- [ ] Advisory age displays correctly (5m, 2h, 1d ago)
- [ ] Stale advisory shows red badge
- [ ] Refresh button disabled for fresh advisories
- [ ] Refresh button enabled + working for stale advisories
- [ ] Budget usage bar shows correct percentage
- [ ] Settings toggles save correctly
- [ ] Empty state shows when generating advisories

### E2E Tests
- [ ] Admin manually triggers periodic job
- [ ] Advisories generate for all tracked symbols
- [ ] Age badges update in real-time
- [ ] Auto-refresh happens when advisory > 24h old
- [ ] Budget tracking prevents generation when exceeded
- [ ] Manual refresh works with cooldown exception

---

## 📊 Configuration Presets

### Tier-Based Defaults

**Pro Users**:
```python
advisory_auto_generation_enabled = True
advisory_whale_signal_enabled = True
advisory_manual_refresh_enabled = True
advisory_refresh_interval_hours = 24
advisory_max_tokens_per_day = 5000
```

**Premium Users**:
```python
advisory_auto_generation_enabled = True
advisory_whale_signal_enabled = True
advisory_manual_refresh_enabled = True
advisory_refresh_interval_hours = 12  # 2x fresh
advisory_max_tokens_per_day = 10000   # 2x budget
```

**Admin Users**:
```python
advisory_auto_generation_enabled = True
advisory_whale_signal_enabled = True
advisory_manual_refresh_enabled = True
advisory_refresh_interval_hours = 8   # 3x fresh
advisory_max_tokens_per_day = 50000   # Unlimited
```

---

## 🚀 Deployment Checklist

- [ ] All migrations created and tested
- [ ] Celery Beat schedule added to config
- [ ] Celery workers updated with new tasks
- [ ] Feature flags configured (if using)
- [ ] Monitoring dashboard updated
- [ ] Admin alert system configured
- [ ] Database backups taken
- [ ] Staged release to `deploy` branch
- [ ] Health checks pass
- [ ] Token usage within acceptable limits
- [ ] No API quota exceeded
- [ ] Frontend loads without errors
- [ ] Settings UI tested in prod

---

## 📞 Support & Escalation

| Issue | Resolution |
|-------|-----------|
| API quota exceeded | Reduce advisory_max_tokens_per_day, alert users |
| Periodic job delays | Check Celery worker logs, increase worker count |
| Advisory quality poor | Review AI prompt, adjust tokens/model |
| User confused on refresh | Add help text to settings, email notification |
| Database migration fails | Rollback, fix schema, re-apply with test data |

---

## 📈 Success Metrics

- ✅ 100% of tracked symbols have advisory (no empty states)
- ✅ 95%+ of auto-refresh jobs complete successfully
- ✅ Average advisory age < 4 hours (checked daily)
- ✅ User satisfaction with advisory freshness > 4/5
- ✅ API token usage within 80% of budgeted amount
- ✅ Zero token quota exceeded incidents
- ✅ Page load time unaffected (< 2s for whale-advisory)

---

**Status**: ✅ Planning Complete — Ready for Code Implementation  
**Last Updated**: 2026-04-09  
**Next Step**: Begin PHASE 1 (Database Models)
