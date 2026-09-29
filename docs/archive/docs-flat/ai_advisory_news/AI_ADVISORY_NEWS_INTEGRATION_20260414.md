# AI Advisory News Integration — Sprint 35
**Date**: 2026-04-14  
**Status**: Planning & Implementation  
**Purpose**: Enrich AI executive summary synthesis with news context, long-window whale/dark-flow grounding, and 30-session technical trend context to improve accuracy and recommendation quality

---

## 1. Executive Summary

**Problem**: AI executive summaries at stock detail pages lack news context, leading to incomplete/inaccurate recommendations.

**Solution**: Integrate AI-generated news summary plus grounded market context into the executive synthesis prompt so the AI can factor recent events, long-window whale/dark-flow structure, and 30-session technical trend when generating recommendations.

**Impact**: 
- Better contextual recommendations (e.g., MWG stock with recent news about store openings, earnings, regulatory changes)
- More holistic advisory (combines: long-window whale signals + long-window dark flow + 30-session RSI/MACD/VOL/Bollinger + **news sentiment**)
- Improved user trust in AI recommendations

---

## 2. Current Architecture

### 2.1 AI Advisory Pipeline (Existing)
```
User clicks "Tổng hợp lại" (Regenerate Summary) at /stocks/MWG
    ↓
frontend calls: regenerateStockAIExecutiveSummary(symbol, {component_ids, synthesis_preference})
    ↓
backend API: POST /api/stock-management/stocks/{symbol}/ai-advisory-summary/regenerate/
    ↓
backend views_ai_advisory_components_summary.py::stock_ai_advisory_summary_regenerate_api()
    ↓
Fetches active AIAdvisoryComponentRecord (indicator, price_action, volume_orderflow)
    ↓
_sprint17_compute_summary_from_components(components)  → summary_payload dict
    ↓
_sprint17_generate_executive_synthesis_with_ai(user, symbol, components, summary_payload, synthesis_preference)
    ↓
Calls LLM with prompt containing:
  - Symbol, strategy_action, risk_level, overall_confidence
  - Component details (name, type, status, confidence, action, rationale)
    ↓
LLM generates 18-22 bullet points
    ↓
Saves to AIAdvisoryExecutiveSummary
```

### 2.2 News Summary System (Existing — Sprint 34)
```
User clicks "AI News" at StockNewsPanel
    ↓
frontend: generateStockNewsAISummary(symbol, {force})
    ↓
backend: POST /api/stock-management/stocks/{symbol}/news/ai-summary/
    ↓
backend views_stock_news.py::stock_news_ai_summary_api()
    ↓
Fetches news items via vnbroker API
    ↓
generate_portfolio_digest(provider, model, api_key, symbols, news_context_by_symbol, user)
    ↓
LLM generates:
  - summary: ~50 word concise headline
  - full: ~200 word detailed analysis
    ↓
Response: {summary, full, item_count, ai_provider, ai_model, generated_at, news_fetched_at, cached}
```

### 2.3 Data Models
- **WhaleAdvisory**: Owns advisory session (side: BUY/SELL/HOLD, latest buy/sell values)
- **AIAdvisoryComponentRecord**: Individual indicator analysis (3 per advisory)
- **AIAdvisoryExecutiveSummary**: 18-22 bullet point synthesis (one per regenerate action)
- **StockNews items**: From vnbroker API (not stored in DB, cached in Redis)

---

## 3. Integration Points

### 3.1 New Flow
```
stock_ai_advisory_summary_regenerate_api()
    ↓
[EXISTING] Fetch active components from DB
    ↓
[EXISTING] _sprint17_compute_summary_from_components(components) → summary_payload
    ↓
[NEW] _fetch_news_context_for_advisory(symbol, user) → news_context_str
    ↓
[MODIFIED] _sprint17_generate_executive_synthesis_with_ai(
      user, symbol, components, summary_payload, synthesis_preference,
      news_context=news_context_str  # ← NEW PARAM
    )
    ↓
[EXISTING] LLM call with enriched prompt (includes news block)
    ↓
[EXISTING] Save to AIAdvisoryExecutiveSummary
```

---

## 4. Implementation Details

### 4.1 New Helper Function: `_fetch_news_context_for_advisory()`

**File**: `backend/portfolio/ai_advisory_helpers.py`

**Location**: Add before `_sprint17_generate_executive_synthesis_with_ai()` (around line 520)

**Signature**:
```python
def _fetch_news_context_for_advisory(
    symbol: str,
    user,
    max_headlines: int = 4,
    timeout_sec: float = 5.0,
) -> str:
    """
    Fetch AI-summarized news for stock and format as text block for prompt injection.
    
    Args:
        symbol: Stock code (e.g., 'MWG')
        user: User object (for access to UserConfig AI settings)
        max_headlines: Max number of headlines to include (default: 4)
        timeout_sec: Timeout for internal API call (default: 5 sec)
    
    Returns:
        Formatted news context string, or empty string if unavailable:
        e.g.:
        '''
        Tin tức gần đây về MWG:
        - MWG đẩy nhanh mở cửa hàng mới tại Hà Nội (news, 2026-04-13)
        - Lợi nhuận Q1 vượt kỳ vọng 12% (company, 2026-04-11)
        '''
    
    Behavior:
        1. Try to fetch from Redis cache (key: `stock:news:ai-summary:{symbol}`)
        2. If cache miss or timeout → return empty string (graceful degradation)
        3. Parse AI summary + item count from response
        4. Format as bullet list with timestamps
        5. Limit to max_headlines lines
        6. Return formatted string or "" if any error
    """
    pass
```

**Implementation Logic**:
```python
def _fetch_news_context_for_advisory(symbol: str, user, max_headlines: int = 4, timeout_sec: float = 5.0) -> str:
    try:
        from portfolio.adapters.cache_adapter import get_cache
        
        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            return ''
        
        # Try cache first
        ai_cache_key = f'stock:news:ai-summary:{normalized_symbol}'
        cached_ai = get_cache(ai_cache_key)
        
        if cached_ai is None:
            # Graceful degradation: news not available is OK
            return ''
        
        summary_text = str(cached_ai.get('summary') or '').strip()
        item_count = int(cached_ai.get('item_count') or 0)
        
        if not summary_text or item_count == 0:
            return ''
        
        # Format for prompt injection
        news_block = f"Tin tức gần đây về {normalized_symbol}:\n"
        news_block += f"- {summary_text}\n"
        news_block += f"(Tổng hợp từ {item_count} tin tức gần đây)"
        
        return news_block
    
    except Exception as e:
        logger.debug('Fetch news context fallback symbol=%s err=%s', symbol, e)
        return ''
```

**Error Handling**:
- Cache miss → return `""`
- API error → return `""`
- Parsing error → return `""`
- **No hard failure** — advisory synthesis continues without news context

---

### 4.2 Modified Function: `_sprint17_generate_executive_synthesis_with_ai()`

**File**: `backend/portfolio/ai_advisory_helpers.py` (line ~520)

**Changes**:
1. Add parameter: `news_context: str = ""`
2. Insert news block into prompt template
3. Adjust token budget in prompt instructions

**Current Signature**:
```python
def _sprint17_generate_executive_synthesis_with_ai(
    user,
    symbol: str,
    components: list[AIAdvisoryComponentRecord],
    summary_payload: dict,
    synthesis_preference: str = 'balanced',
) -> str | None:
```

**New Signature**:
```python
def _sprint17_generate_executive_synthesis_with_ai(
    user,
    symbol: str,
    components: list[AIAdvisoryComponentRecord],
    summary_payload: dict,
    synthesis_preference: str = 'balanced',
    news_context: str = "",  # ← NEW: AI news summary formatted string
) -> str | None:
```

**Prompt Template Changes**:

OLD prompt structure (~400-500 tokens):
```
Ban la chuyen gia tu van chung khoan Viet Nam...
Yeu cau bat buoc:
1) Viet khoang 20 dong...
2) Moi dong bat dau bang '- '...
...

Input: symbol=..., strategy_action=..., risk_level=..., overall_confidence=...
So thich tong hop: ...
Danh sach components:
{component_block}

Chi tra ve noi dung 18-22 dong bat dau bang '- '.
```

NEW prompt structure (~600-700 tokens, with news):
```
Ban la chuyen gia tu van chung khoan Viet Nam...
Yeu cau bat buoc:
1) Viet khoang 18-20 dong (tone down from 20-22)...
2) Moi dong bat dau bang '- '...
...

Input: symbol=..., strategy_action=..., risk_level=..., overall_confidence=...
So thich tong hop: ...

{NEWS_BLOCK_IF_AVAILABLE}

Danh sach components:
{component_block}

Chi tra ve noi dung 18-20 dong bat dau bang '- '.
```

**Implementation**:
```python
# After building preference_instruction and component_block:

news_block = ''
if news_context and str(news_context).strip():
    news_block = f"\n\nThong tin tin tuc:\n{news_context}\n"

prompt = (
    "Ban la chuyen gia tu van chung khoan Viet Nam. "
    "Hay viet phan 'Thong tin tong hop' CHI TIET theo dung cac dau vao ben duoi.\n"
    "Yeu cau bat buoc:\n"
    "1) Viet khoang 18-20 dong (tu 18 den 20 dong).\n"
    "2) Moi dong bat dau bang '- '.\n"
    "3) Noi dung phai cu the, khong viet chung chung, khong nhac den viec ban la AI.\n"
    "4) Bao gom: tong quan xu huong, xung dot tin hieu, kich ban tang/giam, "
    "vung gia quan sat, quan tri rui ro, dieu kien vo hieu, va CAC TUAN NHAN TIN TUC.\n"
    "5) Khong dua ra cam ket loi nhuan.\n\n"
    f"Input: symbol={symbol}, strategy_action={summary_payload.get('strategy_action')}, "
    f"risk_level={summary_payload.get('risk_level')}, "
    f"overall_confidence={summary_payload.get('overall_confidence')}/10.\n"
    f"So thich tong hop: {preference_instruction}\n"
    f"{news_block}"
    "Danh sach components:\n"
    f"{component_block}\n\n"
    "Chi tra ve noi dung 18-20 dong bat dau bang '- '."
)
```

---

### 4.3 Update Call Site

**File**: `backend/portfolio/views_ai_advisory_components_summary.py` (line ~599)

**Current Code** (lines 599-607):
```python
summary_payload = legacy_views._sprint17_compute_summary_from_components(components)
ai_synthesis_text = legacy_views._sprint17_generate_executive_synthesis_with_ai(
    user=request.user,
    symbol=normalized_symbol,
    components=components,
    summary_payload=summary_payload,
    synthesis_preference=synthesis_preference,
)
```

**New Code**:
```python
summary_payload = legacy_views._sprint17_compute_summary_from_components(components)

# NEW: Fetch AI news summary context
news_context_str = legacy_views._fetch_news_context_for_advisory(
    symbol=normalized_symbol,
    user=request.user,
    max_headlines=4,
)

ai_synthesis_text = legacy_views._sprint17_generate_executive_synthesis_with_ai(
    user=request.user,
    symbol=normalized_symbol,
    components=components,
    summary_payload=summary_payload,
    synthesis_preference=synthesis_preference,
    news_context=news_context_str,  # NEW parameter
)
```

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Frontend: /stocks/MWG                                   │
│ User clicks "Tổng hợp lại"                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Backend API: POST /ai-advisory-summary/regenerate/      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────────┐         ┌──────────────────┐
    │  DB Query   │         │  Redis Cache     │
    │ Components  │         │ (news summary)   │
    └──────┬──────┘         └────────┬─────────┘
           │                        │
           │  [EXISTING]            │ [NEW] _fetch_news_context_for_advisory()
           │  _compute_summary()    │
           │                        │
           └───────────┬────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ _generate_executive_synthesis()  │
        │ (with news_context param)        │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Enriched Prompt to LLM:          │
        │ - Components                     │
        │ - Summary metrics                │
        │ - NEWS CONTEXT ← NEW             │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ LLM Response: 18-20 bullets      │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Save to AIAdvisoryExecutiveSummary
        │ (synthesis_text includes news)   │
        └──────────────────────────────────┘
```

---

## 6. Testing Strategy

### 6.1 Unit Tests
**File**: `backend/portfolio/tests/test_ai_advisory_news_integration.py` (CREATE NEW)

Test cases:
1. `test_fetch_news_context_success` — News cache hit, returns formatted string
2. `test_fetch_news_context_cache_miss` — No cache, returns empty string gracefully
3. `test_fetch_news_context_empty_news` — Cache exists but empty, returns empty string
4. `test_fetch_news_context_invalid_symbol` — Invalid symbol, returns empty string
5. `test_generate_synthesis_with_news` — Verify news block injected into prompt
6. `test_generate_synthesis_without_news` — Verify fallback when news unavailable
7. `test_synthesis_includes_news_sentiment` — Output mentions recent events

### 6.2 Integration Test
**Stock**: MWG (has recent news)

Steps:
1. Run `python manage.py test` for new test suite
2. Navigate to `http://localhost/stocks/MWG`
3. Ensure news is visible in StockNewsPanel with AI summary
4. Click "Tổng hợp lại" to regenerate executive summary
5. **Verify**: Output mentions recent news events (e.g., "Mở cửa hàng mới", "Lợi nhuận Q1")
6. Check synthesis is more contextual than before

---

## 7. Implementation Checklist

### Phase 1: Backend Implementation
- [ ] Add `_fetch_news_context_for_advisory()` helper to `ai_advisory_helpers.py`
- [ ] Modify `_sprint17_generate_executive_synthesis_with_ai()` signature and prompt template
- [ ] Update call site in `views_ai_advisory_components_summary.py`
- [ ] Add import statements if needed
- [ ] Run syntax check and linting

### Phase 2: Testing
- [ ] Create unit test file `test_ai_advisory_news_integration.py`
- [ ] Write 7 test cases
- [ ] Run full test suite: `python manage.py test portfolio`
- [ ] Verify no regressions in existing advisory tests

### Phase 3: Integration Testing
- [ ] Start dev stack: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
- [ ] Navigate to `/stocks/MWG`
- [ ] Generate news summary via "AI News" button
- [ ] Regenerate executive summary via "Tổng hợp lại"
- [ ] Verify output includes news context
- [ ] Test with 3+ different stocks (VCB, FPT, VNM)

### Phase 4: Deployment
- [ ] Commit to feature branch: `git checkout -b feature/sprint35-ai-news-integration`
- [ ] Push to dev: `git push origin feature/sprint35-ai-news-integration`
- [ ] Code review
- [ ] Merge to dev: `git checkout dev && git merge feature/...`
- [ ] Deploy to dev environment
- [ ] Notify team: "AI News Integration deployed to dev"

---

## 8. Files Summary

| File | Changes | Type |
|------|---------|------|
| `backend/portfolio/ai_advisory_helpers.py` | Add `_fetch_news_context_for_advisory()`, modify `_sprint17_generate_executive_synthesis_with_ai()` | Implementation |
| `backend/portfolio/views_ai_advisory_components_summary.py` | Update call to `_sprint17_generate_executive_synthesis_with_ai()` with news_context param | Implementation |
| `backend/portfolio/tests/test_ai_advisory_news_integration.py` | NEW: 7 unit tests | Testing |

---

## 9. Error Handling & Fallback

**Priority**: News integration is **OPTIONAL** — synthesis must work even if news unavailable.

| Scenario | Behavior |
|----------|----------|
| News cache hit | Use news in prompt |
| News cache miss | Skip news block, continue synthesis |
| News API error | Log warning, return empty string |
| Invalid news format | Catch exception, return empty string |
| Timeout | Return empty string after 5 sec |
| User not authenticated | Skip (user always authenticated at this point) |

---

## 10. Performance Considerations

- **Redis lookup**: ~1-5 ms (cached data)
- **No new DB queries**: Uses existing cache infrastructure
- **Token budget**: +100-150 tokens in prompt (well within 2000 token budget)
- **LLM latency**: Negligible increase (~0.1-0.2% more compute)
- **Cache TTL**: Inherits from news module (15 min for AI summary)

---

## 11. Future Enhancements

1. **Sentiment tracking**: Store news sentiment score in cache for trend analysis
2. **Historical news context**: Include 1-week news trend (bullish → bearish)
3. **Keyword extraction**: Extract key themes (IPO, earnings, acquisition, SEC) for better contextualization
4. **Multi-language support**: If Vietnamese + English news available, include both
5. **News weighting**: Prioritize breaking news over old news in prompt

---

## 12. References

- **Sprint 34 — AI News Module**: `/docs/SPRINT34_AI_NEWS_MODULE_PLAN.md`
- **AI Advisory Unification**: `/docs/AI_ADVISORY_UNIFICATION_PLAN_20260411.md`
- **Backend Views**: `backend/portfolio/views_ai_advisory_components_summary.py`
- **News API**: `backend/portfolio/views_stock_news.py`
- **AI Helpers**: `backend/portfolio/ai_advisory_helpers.py`

---

## 13. Notes for Team

✅ **What's Already in Place**:
- News summary generation (Sprint 34) ✓
- Redis caching for news ✓
- Stock detail page UI blocks ✓

⚠️ **What We're Adding**:
- News-aware advisory synthesis ← THIS
- Prompt injection with news context
- Fallback handling for missing news

❌ **What's NOT in Scope**:
- Changes to news fetching logic
- News storage in DB (remains cache-only)
- Frontend changes (backend-only enhancement)

---
Dữ liệu cần thêm / cập nhật phạm vi:

1. **Whale context (cửa sổ dài hạn, ưu tiên 180 ngày hoặc tối đa dữ liệu khả dụng)**
   - Total whale buy matches: X lệnh, Y tỷ đồng
   - Total whale sell matches: Z lệnh, W tỷ đồng
   - Buy/Sell ratio: VD 60% buy, 40% sell
    - Whale dominance: % so với turnover ước tính
    - So sánh 30 ngày gần nhất với 30 ngày trước để biết whale pressure đang tăng hay giảm

2. **Dark Flow trend (cửa sổ dài hạn, ưu tiên 180 ngày hoặc tối đa dữ liệu khả dụng)**
    - History tóm tắt: [(time, strength), ...] → hiển thị chiều hướng
   - Peak strength khi nào, tăng hay giảm
    - Phân bổ signal type gần đây: absorption / iceberg / twap_bot / mixed

3. **Technical readings (1 tháng / 30 phiên để rõ xu hướng)**
    - RSI: current + range 30 phiên + xu hướng lên/xuống
    - MACD: current line/signal/histogram + crossover + hướng histogram
    - Bollinger Bands: current upper/middle/lower + vị trí giá trong band
    - Volume: current vs MA20, ratio, xu hướng tăng/giảm trong 30 phiên

4. **Market context**
   - Timestamp: "14/04/2026, 14:35:00"
   - Session: pre-market / in-market / post-market
   - Support/Resistance: VD "Support: 760, Resistance: 780"
   - Previous advisory sentiment (nếu có lịch sử)

**Owner**: @copilot-squad  
**Reviewers**: @backend-team, @ai-team  
**Start Date**: 2026-04-14  
**Target Completion**: 2026-04-15
