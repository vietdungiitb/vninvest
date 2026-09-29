# TECH SPEC — Screener SaaS Native Upgrade (2026-07-10)

**Pham vi**: Technical design cho toan bo screener upgrade pipeline
**Related Plan**: `SCREENER_SAAS_NATIVE_AUDIT_AND_UPGRADE_PLAN_20260710.md`
**Trang thai**: READY FOR REVIEW

---

## 1. Backend URL Routing Fix

### 1.1 File: `packages/core/backend/src/user_workspace/urls.py`

**Current state**: `ScreenerRuleListCreateAPIView` va cac view lien quan duoc import trong `portfolio_analytics_views.py` nhung khong duoc map trong `urls.py`.

**Target**: Them screener URL patterns:

```python
# Them vao urlpatterns list
from .portfolio_analytics_views import (
    ScreenerRuleListCreateAPIView,
    ScreenerRuleDetailView,
    ScreenerRuleRunView,
)

urlpatterns += [
    path('screener/rules/',
         ScreenerRuleListCreateAPIView.as_view(),
         name='screener-rules-list'),
    path('screener/rules/<int:pk>/',
         ScreenerRuleDetailView.as_view(),
         name='screener-rule-detail'),
    path('screener/rules/<int:pk>/run/',
         ScreenerRuleRunView.as_view(),
         name='screener-rule-run'),
]
```

### 1.2 URL Namespace

- User-facing: `/api/portfolio/screener/...` (under `withCoreBase` middleware)
- SOC admin: `/api/soc/screener/...` (under `service_ops` app, already working)

---

## 2. Type Declarations Unification

### 2.1 File: `packages/web/src/adapters/coreApiAdapter.d.ts`

**Replace** existing screener block (lines 115-121):

```typescript
// BEFORE (wrong — "presets" model)
getScreenerPresets: () => Promise<ScreenerRule[]>;
createScreenerPreset: (rule: Omit<ScreenerRule, 'id'>) => Promise<ScreenerRule>;
updateScreenerPreset: (id: number, rule: Partial<ScreenerRule>) => Promise<ScreenerRule>;
deleteScreenerPreset: (id: number) => Promise<void>;
runScreener: (id: number) => Promise<ScreenerResult>;
getScreenerResults: (id: number) => Promise<ScreenerResult>;

// AFTER (correct — "rules" model, matching runtime)
getScreenerRules: () => Promise<ScreenerRule[]>;
createScreenerRule: (rule: Omit<ScreenerRule, 'id'>) => Promise<ScreenerRule>;
updateScreenerRule: (id: number, rule: Partial<ScreenerRule>) => Promise<ScreenerRule>;
deleteScreenerRule: (id: number) => Promise<void>;
runScreenerRule: (id: number) => Promise<ScreenerResult>;
```

### 2.2 New File: `packages/web/src/types/screener.d.ts`

```typescript
// User-facing screener types
export interface ScreenerCondition {
  field: string;  // keyof typeof SCREENER_FIELDS
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value: number;
}

export interface ScreenerRule {
  id?: number;
  name: string;
  rules_json: ScreenerCondition[];
  created_at?: string;
  updated_at?: string;
}

export interface ScreenerRow {
  symbol: string;
  close: number | null;
  rsi_14: number | null;
  sma20: number | null;
  sma50: number | null;
  price_vs_sma20_pct: number | null;
  price_vs_sma50_pct: number | null;
  sma20_vs_sma50_pct: number | null;
  macd_hist: number | null;
  volume_rvol: number | null;
  momentum_20d_pct: number | null;
  range_position_pct: number | null;
  avg_volume_20: number | null;
  date: string;
  ai_advisory?: {
    ai_score_0_100: number;
    ai_confidence_0_100: number;
    strategy_action: 'BUY' | 'SELL' | 'HOLD' | 'STAND_ASIDE';
    risk_level: string;
    synthesis_text: string;
  } | null;
}

export interface ScreenerResult {
  matched: ScreenerRow[];
  matched_count: number;
  total_scanned: number;
  rule_name: string;
  rule_id: number;
}

// SOC screener types
export interface SocScreenerConfig {
  scan_interval_seconds: number;
  max_symbols_per_scan: number;
  alert_cooldown_seconds: number;
  max_alerts_per_symbol_per_hour: number;
  result_retention_hours: number;
  publish_to_redis: boolean;
  redis_channel_prefix: string;
  rules: SocScreenerRule[];
}

export interface SocScreenerRule {
  id: string;
  name: string;
  type: SocScreenerRuleType;
  enabled: boolean;
  threshold?: unknown;
  value?: unknown;
}

export type SocScreenerRuleType =
  | 'price_change_pct'
  | 'volume_spike_ratio'
  | 'cvd_threshold'
  | 'whale_count'
  | 'dark_pool_ratio'
  | 'rsi_level'
  | 'ma_cross'
  | 'bollinger_band_break'
  | 'custom';

// Screener field definitions
export const SCREENER_FIELDS = {
  close: { labelKey: 'screener.fields.close', group: 'price' },
  volume: { labelKey: 'screener.fields.volume', group: 'volume' },
  rsi_14: { labelKey: 'screener.fields.rsi14', group: 'technical' },
  sma20: { labelKey: 'screener.fields.sma20', group: 'technical' },
  sma50: { labelKey: 'screener.fields.sma50', group: 'technical' },
  price_vs_sma20_pct: { labelKey: 'screener.fields.priceVsSma20Pct', group: 'technical' },
  price_vs_sma50_pct: { labelKey: 'screener.fields.priceVsSma50Pct', group: 'technical' },
  sma20_vs_sma50_pct: { labelKey: 'screener.fields.sma20VsSma50Pct', group: 'technical' },
  macd_hist: { labelKey: 'screener.fields.macdHist', group: 'technical' },
  volume_rvol: { labelKey: 'screener.fields.volumeRvol', group: 'volume' },
  momentum_20d_pct: { labelKey: 'screener.fields.momentum20dPct', group: 'technical' },
  range_position_pct: { labelKey: 'screener.fields.rangePositionPct', group: 'technical' },
  avg_volume_20: { labelKey: 'screener.fields.avgVolume20', group: 'volume' },
} as const;
```

---

## 3. SOC Screener Rule Modal

### 3.1 New Component: `SocScreenerRuleModal.tsx`

```typescript
interface SocScreenerRuleModalProps {
  mode: 'create' | 'edit';
  initial?: SocScreenerRule;
  onConfirm: (rule: SocScreenerRule) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}
```

**Layout**:
```
┌─ Tạo/Sửa Rule ─────────────────────────────────┐
│                                                   │
│  Tên rule: [________________________]            │
│                                                   │
│  Loại rule: [Dropdown 9 types          ▼]       │
│    ○ price_change_pct                            │
│    ○ volume_spike_ratio                          │
│    ○ cvd_threshold                               │
│    ○ whale_count                                 │
│    ○ dark_pool_ratio                             │
│    ○ rsi_level                                   │
│    ○ ma_cross                                    │
│    ○ bollinger_band_break                        │
│    ○ custom                                      │
│                                                   │
│  Giá trị (JSON):                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ { "threshold": 30, "op": "lt" }        │    │
│  └─────────────────────────────────────────┘    │
│                                                   │
│  [✓ Kích hoạt]                                  │
│                                                   │
│  [Hủy]  [Lưu]                                   │
└───────────────────────────────────────────────────┘
```

### 3.2 CSS: Use existing `soc.module.css` tokens

- `glassPanel` — outer wrapper
- `sectionCard` — form sections
- `configEditor` — JSON textarea
- `actionBtn` — save/cancel buttons
- `searchInput` — text inputs

---

## 4. Config Form (Structured)

### 4.1 New Component: `SocScreenerConfigForm.tsx`

Replace raw JSON textarea voi structured form:

```
┌─ Cài đặt Screener ──────────────────────────────┐
│                                                   │
│  Chu kỳ quét (giây):    [____]  (min: 30)       │
│  Số mã tối đa/lần quét: [____]  (max: 5000)     │
│  Thời gian báo lại (giây): [____]  (min: 60)     │
│  Báo cáo/mã/giờ:         [____]  (min: 1)       │
│  Thời gian lưu kết quả (giờ): [____]  (min: 1)  │
│                                                   │
│  [Xem trước] [Áp dụng]                           │
└───────────────────────────────────────────────────┘
```

**Validation rules**:
- `scan_interval_seconds` ≥ 30
- `max_symbols_per_scan` 1–5000
- `alert_cooldown_seconds` ≥ 60
- `max_alerts_per_symbol_per_hour` ≥ 1
- `result_retention_hours` ≥ 1

---

## 5. Pre-built Templates

### 5.1 Template Data Structure

```typescript
interface ScreenerTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;           // emoji
  conditions: ScreenerCondition[];
  category: 'technical' | 'fundamental' | 'whale' | 'hybrid';
}
```

### 5.2 Default Templates

| ID | Name | Category | Conditions |
|----|------|----------|------------|
| oversold-bounce | Quá bán phục hồi | technical | RSI(14) < 30 AND Volume > SMA20 |
| golden-cross | Golden Cross | technical | SMA20 vs SMA50% > 0 (crossover) |
| momentum-breakout | Đột phá động lực | technical | Price vs SMA20% > 0 AND Momentum > 5% |
| volume-anomaly | Dị thường khối lượng | technical | RVOL > 3x AND Price change > 2% |
| whale-accumulation | Cá voi tích lũy | whale | Whale net value > threshold |
| dark-pool-signal | Tín hiệu dark pool | whale | Dark flow strength > threshold |
| high-dividend | Cổ tức cao | fundamental | Dividend yield > 3% |
| small-cap-growth | Vốn nhỏ tăng trưởng | fundamental | Market cap < 500B AND EPS growth > 20% |
| range-trader | Giao dịch biên độ | technical | Range position < 20% OR > 80% |
| trend-follower | Theo xu hướng | hybrid | SMA20 > SMA50 AND Momentum > 0% AND RVOL > 1.5x |

---

## 6. Results Table Upgrade

### 6.1 Sortable Columns

```typescript
interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}
```

Sort logic: client-side for loaded page, backend for cross-page sort.

### 6.2 Column Picker

```typescript
interface ColumnConfig {
  key: string;
  labelKey: string;
  width: number;
  visible: boolean;
  group: 'price' | 'technical' | 'volume' | 'ai';
}
```

Default visible: symbol, close, rsi_14, macd_hist, volume_rvol, momentum_20d_pct, date.
Available: 30+ columns.

### 6.3 Export

```typescript
// CSV export (lightweight)
function exportToCSV(data: ScreenerRow[], filename: string): void {
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
  ].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

// Excel export (using xlsx library)
function exportToExcel(data: ScreenerRow[], filename: string): void {
  // xlsx library
}
```

---

## 7. Scheduled Scanning

### 7.1 Backend: Celery Beat Schedule

```python
# Celery task
@shared_task
def run_scheduled_screens():
    screens = ScreenerRule.objects.filter(
        is_active=True,
        schedule_enabled=True,
        schedule_next_run__lte=timezone.now()
    )
    for screen in screens:
        result = execute_screener(screen)
        if result['matched_count'] > 0:
            create_screener_alert(screen, result)
            send_notification(screen.user, result)
        screen.schedule_next_run = calculate_next_run(screen.schedule_frequency)
        screen.save()
```

### 7.2 Alert Integration

Reuses existing `UnifiedAlert` model:
- `type = 'screener'`
- `severity = 'info' | 'warning' | 'critical'` (based on matched count)
- `symbol` = matched symbols
- `message` = screen name + matched count

---

## 8. Backend Allowed Fields Expansion

### 8.1 File: `packages/core/backend/src/user_workspace/screener_helpers.py`

**Add to `ALLOWED_FIELDS`**:

```python
ALLOWED_FIELDS = frozenset([
    # Existing 13 technical
    'close', 'volume', 'rsi_14', 'sma20', 'sma50',
    'momentum_20d_pct', 'price_vs_sma20_pct', 'price_vs_sma50_pct',
    'range_position_pct', 'avg_volume_20', 'macd_hist',
    'volume_rvol', 'sma20_vs_sma50_pct',
    # New fundamental (6)
    'pe_ratio', 'market_cap', 'dividend_yield',
    'eps_growth_yoy', 'revenue_growth_yoy', 'debt_to_equity',
    # New advanced technical (7)
    'stochastic_k', 'stochastic_d', 'atr_14', 'adx_14',
    'bollinger_width', 'vwap', 'mfi_14',
    # Existing whale (13) + dark pool (5) — unchanged
])
```

**Total: 44 allowed fields** (from 31)

### 8.2 Computation Functions

Add to `screener_helpers.py`:

```python
def _compute_pe_ratio(row):
    """PE = close / EPS (from DailyPrice or fundamental cache)"""
    ...

def _compute_market_cap(row):
    """Market cap = close * shares_outstanding"""
    ...

def _compute_stochastic_k(row, period=14):
    """Stochastic %K = (close - lowest_low) / (highest_high - lowest_low) * 100"""
    ...

def _compute_atr(row, period=14):
    """Average True Range"""
    ...

def _compute_adx(row, period=14):
    """Average Directional Index"""
    ...
```

---

## 9. i18n Keys (New)

```javascript
// Vietnamese
vi.js additions:
'screener.templates.title': 'Màn hình có sẵn',
'screener.templates.apply': 'Áp dụng',
'screener.templates.category.technical': 'Kỹ thuật',
'screener.templates.category.fundamental': 'Cơ bản',
'screener.templates.category.whale': 'Cá voi/Dòng tiền',
'screener.templates.category.hybrid': 'Kết hợp',
'screener.export.csv': 'Xuất CSV',
'screener.export.excel': 'Xuất Excel',
'screener.sort.asc': 'Tăng dần',
'screener.sort.desc': 'Giảm dần',
'screener.columns.customize': 'Tùy chỉnh cột',
'screener.schedule.title': 'Lên lịch quét',
'screener.schedule.frequency': 'Tần suất',
'screener.schedule.hourly': 'Hàng giờ',
'screener.schedule.daily': 'Hàng ngày',
'screener.schedule.weekly': 'Hàng tuần',
'screener.pe_ratio': 'P/E Ratio',
'screener.market_cap': 'Vốn hóa',
'screener.dividend_yield': 'Lợi suất cổ tức',
'screener.stochastic_k': 'Stochastic %K',
'screener.atr_14': 'ATR(14)',
'screener.adx_14': 'ADX(14)',
'screener.vwap': 'VWAP',
'screener.mfi_14': 'MFI(14)',
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test | File | Coverage |
|------|------|----------|
| Backend URL routing | `test_screener_api.py` | All 3 endpoints return 200/201 |
| Type declarations | `typecheck.ts` (manual) | No `as any` in screener files |
| Filter builder | `ScreenerFilterBuilder.test.tsx` | Add/remove/update conditions |
| Results table | `ScreenerResultsTable.test.tsx` | Sort, paginate, export |
| Template application | `ScreenerTemplates.test.tsx` | Apply template → conditions populated |
| Config form validation | `SocScreenerConfigForm.test.tsx` | All validation rules |
| Rule modal | `SocScreenerRuleModal.test.tsx` | Create, edit, cancel |

### 10.2 Integration Tests

| Test | Scope |
|------|-------|
| E2E: Create rule → Run → View results | Full user flow |
| E2E: SOC create rule → Config change → Manual scan | Admin flow |
| E2E: Export CSV → Verify file content | Export flow |

### 10.3 Exit Criteria

- `npx tsc --noEmit` — zero errors
- `npm run build` — success
- `npm run test` — all screener tests pass
- Manual QA: CRUD + Run + Export hoat dong tren browser
- Backend test: `python manage.py test portfolio.tests.test_screener_api --keepdb`

---

## 11. File Changes Summary

### Phase 0 (Critical)

| File | Action | Description |
|------|--------|-------------|
| `user_workspace/urls.py` | EDIT | Add screener URL patterns |
| `coreApiAdapter.d.ts` | EDIT | Fix "presets" → "rules" |
| `declarations.d.ts` | EDIT | Keep as-is (correct) |
| `SocScreenerPanel.tsx:121` | EDIT | Fix typo "screenter" |
| `routeCatalog.js` | EDIT | Add screener entry |
| `navigationCatalog.js` | EDIT | Add screener entry |
| `vi.js` + `en.js` | EDIT | Add missing i18n keys |

### Phase 1 (Legacy Parity)

| File | Action | Description |
|------|--------|-------------|
| `SocScreenerRuleModal.tsx` | NEW | Rule CRUD modal |
| `SocScreenerConfigForm.tsx` | NEW | Structured config form |
| `SocScreenerPanel.tsx` | EDIT | Integrate modal + form |
| `ScreenerPage.tsx` | EDIT | Replace alert/confirm |
| `soc.module.css` | EDIT | Add modal styles |

### Phase 2 (Commercial Features)

| File | Action | Description |
|------|--------|-------------|
| `screener.d.ts` | NEW | Unified type definitions |
| `SCREENER_FIELDS` | EDIT | Add 13 new fields |
| `ScreenerFilterBuilder.tsx` | NEW | Advanced filter UI |
| `ScreenerResultsTable.tsx` | NEW | Sortable, paginated table |
| `ScreenerTemplates.tsx` | NEW | Template grid |
| `ScreenerExport.tsx` | NEW | CSV/Excel export |
| `screener_helpers.py` | EDIT | Add 13 new computations |
| `portfolio_analytics_views.py` | EDIT | Add template + export endpoints |

### Phase 3 (AI Features)

| File | Action | Description |
|------|--------|-------------|
| `ai_advisory_helpers.py` | NEW/EDIT | Screener AI adapter |
| `ScreenerScoreCard.tsx` | NEW | AI score badge |
| `ScreenerHistory.tsx` | NEW | Run history view |
| `ScreenerSchedule.tsx` | NEW | Schedule config |

---

**Trang thai**: READY FOR APPROVAL
