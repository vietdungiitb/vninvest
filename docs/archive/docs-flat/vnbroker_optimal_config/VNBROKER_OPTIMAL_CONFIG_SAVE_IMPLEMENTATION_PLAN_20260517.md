# Chức Năng "Lưu Cấu Hình Tối Ưu" (Save Optimal Config)
## Implementation Plan — May 17, 2026

---

## 🎯 Mục Tiêu

Cho phép người dùng tự động áp dụng kết quả benchmark vào cấu hình per-provider mà không cần cấu hình thủ công từng field.

**Workflow**:
```
1. User nhấn "Chạy benchmark" (chạy benchmark)
2. Khi xong, hiển thị "💡 Cấu hình tối ưu có sẵn"
3. User xem gợi ý tối ưu dựa trên kết quả
4. User nhấn "Lưu Cấu Hình Tối Ưu" → Tự động áp dụng
5. Config được cập nhật + preview + apply
```

---

## 📊 Dữ Liệu Từ Benchmark

**Report structure** (từ backend):
```json
{
  "status": "completed",
  "results": [
    {
      "provider": "VCI",
      "concurrency": 4,
      "latency_ms": 124,
      "requests_per_minute": 45,
      "success_pct": 98.5,
      "error_pct": 1.5,
      "rate_limited_pct": 0.0
    },
    {
      "provider": "KBS",
      "concurrency": 8,
      "latency_ms": 89,
      "requests_per_minute": 85,
      "success_pct": 99.8,
      "error_pct": 0.2,
      "rate_limited_pct": 5.0
    },
    {
      "provider": "DNSE",
      "concurrency": 2,
      "latency_ms": 156,
      "requests_per_minute": 30,
      "success_pct": 96.0,
      "error_pct": 4.0,
      "rate_limited_pct": 20.0
    }
  ],
  "recommendation": {
    "primary_provider": "KBS",
    "fallback_provider": "VCI",
    "best_requests_per_minute": 85,
    "best_rate_limited_pct": 5.0
  }
}
```

---

## 🧮 Logic Tính Cấu Hình Tối Ưu

### Per-Provider Configuration Rules

**Rule 1: Timeout dựa trên latency**
```javascript
function calculateOptimalTimeout(latencyMs, successPct) {
  // Nếu latency cao → timeout cao hơn
  // Nếu success rate thấp → timeout cao hơn (cho phép retry)
  
  const baseTimeout = Math.max(latencyMs / 1000, 1);
  const safetyFactor = successPct < 95 ? 2.0 : 1.5;
  
  return Math.ceil(baseTimeout * safetyFactor * 2) / 2; // Round to 0.5s
}

Examples:
- VCI: latency 124ms, success 98.5% → connect: 3s, read: 20s
- KBS: latency 89ms, success 99.8% → connect: 2s, read: 15s
- DNSE: latency 156ms, success 96% → connect: 4s, read: 30s
```

**Rule 2: Max retries dựa trên error rate**
```javascript
function calculateOptimalRetries(errorPct) {
  if (errorPct < 1) return 2;    // Stable → fewer retries
  if (errorPct < 5) return 3;    // Normal
  return 4;                       // Unstable → more retries
}

Examples:
- VCI: 1.5% error → max_retries: 3
- KBS: 0.2% error → max_retries: 2
- DNSE: 4.0% error → max_retries: 4
```

**Rule 3: Rate limit dựa trên observed requests/min + rate_limited_pct**
```javascript
function calculateOptimalRateLimit(requestsPerMin, rateLimitedPct) {
  // Giảm 10-20% để tránh trigger rate limit
  const reductionFactor = rateLimitedPct > 10 ? 0.8 : 0.9;
  return Math.floor(requestsPerMin * reductionFactor);
}

Examples:
- VCI: 45 req/min, 0% rate limited → 40 req/min (safety margin)
- KBS: 85 req/min, 5% rate limited → 75 req/min (aggressive but safe)
- DNSE: 30 req/min, 20% rate limited → 24 req/min (very conservative)
```

**Rule 4: Burst limit = 20% of requests_per_minute**
```javascript
burst_limit = Math.ceil(rate_limit * 0.2)

Examples:
- VCI: 40 req/min → burst: 8
- KBS: 75 req/min → burst: 15
- DNSE: 24 req/min → burst: 5
```

**Rule 5: Retry delay dựa trên latency**
```javascript
function calculateRetryDelay(latencyMs) {
  // Delay sebelum retry = latency / 500ms (min 0.5s, max 3.0s)
  const delay = Math.max(0.5, Math.min(latencyMs / 500, 3.0));
  return Math.round(delay * 2) / 2; // Round to 0.5s
}

Examples:
- VCI: latency 124ms → delay: 0.5s
- KBS: latency 89ms → delay: 0.5s
- DNSE: latency 156ms → delay: 1.0s
```

---

## 🎨 UI Changes

### 1. Show Recommendation Badge (After Benchmark)
```
┌─────────────────────────────────────────────┐
│ Benchmark provider                          │
│ [VCI ▼] [Chạy benchmark]  [Chạy lại]      │
│                                             │
│ ✅ Cấu hình tối ưu có sẵn (23 phút trước)  │
│ 💡 KBS được đề xuất làm primary provider   │
│ [Xem chi tiết] [Lưu Cấu Hình Tối Ưu]     │
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ Kết quả benchmark:                      ││
│ │                                         ││
│ │ Provider    Latency  Req/min  Success   ││
│ │ KBS         89ms     85       99.8%     ││
│ │ VCI         124ms    45       98.5%     ││
│ │ DNSE        156ms    30       96.0%     ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 2. Show Recommendations Modal (When Clicking "Xem chi tiết")
```
┌──────────────────────────────────────────────────────┐
│ Cấu Hình Tối Ưu Được Đề Xuất                        │
│                                                      │
│ Dựa trên benchmark vừa chạy (23 phút trước)         │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ KBS (Đề xuất làm Primary)                      │  │
│ │                                                │  │
│ │ Timeout:                                       │  │
│ │   Connect: 2.0s  (giảm từ 10s, latency thấp) │  │
│ │   Read: 15s      (giảm từ 30s, latency thấp) │  │
│ │   Write: 5.0s                                 │  │
│ │   Pool: 3.0s                                  │  │
│ │                                                │  │
│ │ Retry:                                         │  │
│ │   Max Retries: 2 (ít lỗi)                    │  │
│ │   Delay: 0.5s                                 │  │
│ │                                                │  │
│ │ Rate Limit:                                    │  │
│ │   Requests/min: 75 (85 quan sát - 10% margin) │  │
│ │   Burst: 15                                    │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ VCI (Đề xuất làm Fallback)                     │  │
│ │                                                │  │
│ │ Timeout:                                       │  │
│ │   Connect: 3.0s                               │  │
│ │   Read: 20s                                    │  │
│ │   (...)                                        │  │
│ │                                                │  │
│ │ Rate Limit: 40 req/min (45 quan sát - margin) │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ DNSE (Fallback)                                │  │
│ │                                                │  │
│ │ Timeout: Connect 4.0s, Read 30s (cao)         │  │
│ │ Max Retries: 4 (lỗi nhiều)                   │  │
│ │ Rate Limit: 24 req/min (conservative)         │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ [Hủy] [Xem Trước] [Lưu Cấu Hình Tối Ưu]          │
└──────────────────────────────────────────────────────┘
```

### 3. Flow After "Lưu Cấu Hình Tối Ưu"
```
1. Modal đóng
2. Draft config được cập nhật với per_provider_config từ recommendations
3. Primary provider được set từ recommendation
4. Modal xem trước tự động hiển thị
5. User confirm → nhấn "Áp dụng"
```

---

## 🔧 Implementation Steps

### Step 1: Add State & Helper Functions (VnbrokerPanel.jsx)
**New state variables**:
```javascript
const [benchmarkResult, setBenchmarkResult] = useState(null);
const [recommendedConfig, setRecommendedConfig] = useState(null);
const [showRecommendationModal, setShowRecommendationModal] = useState(false);
```

**Helper function: Calculate optimal config from benchmark**:
```javascript
function calculateOptimalConfig(benchmarkResult) {
  const recommendations = {};
  
  for (const result of benchmarkResult.results) {
    const provider = result.provider.toLowerCase();
    
    recommendations[provider] = {
      timeout: {
        connect: calculateOptimalTimeout(result.latency_ms, 3).toFixed(1),
        read: calculateOptimalTimeout(result.latency_ms * 1.5, result.success_pct).toFixed(1),
        write: (calculateOptimalTimeout(result.latency_ms, 99) / 2).toFixed(1),
        pool: (calculateOptimalTimeout(result.latency_ms, 99) / 3).toFixed(1),
      },
      max_retries: calculateOptimalRetries(result.error_pct),
      retry_delay_seconds: calculateRetryDelay(result.latency_ms).toFixed(1),
      requests_per_minute: calculateOptimalRateLimit(result.requests_per_minute, result.rate_limited_pct),
      burst_limit: Math.ceil(calculateOptimalRateLimit(result.requests_per_minute, result.rate_limited_pct) * 0.2),
    };
  }
  
  return recommendations;
}
```

**Helper function: Apply recommendations to draft**:
```javascript
function applyRecommendedConfig(recommendedConfig) {
  setDraft((prev) => {
    const primaryProvider = benchmarkResult.recommendation.primary_provider.toLowerCase();
    
    return {
      ...prev,
      preferred_provider: primaryProvider,
      fallback_providers: benchmarkResult.recommendation.env_patch.VNBROKER_PRICE_BOARD_FALLBACK_SOURCES.split(',').map(p => p.toLowerCase()),
      per_provider_config: {
        ...(prev.per_provider_config || {}),
        ...recommendedConfig,
      },
    };
  });
}
```

---

### Step 2: Update Benchmark Handler (VnbrokerPanel.jsx)

**In handleRunBenchmark**:
```javascript
const handleRunBenchmark = async () => {
  setIsBenchmarking(true);
  setBenchmarkStatus(null);
  
  try {
    const result = await socApi.runVnbrokerBenchmark({
      provider: benchmarkProvider,
    });
    
    setBenchmarkResult(result);
    
    // Calculate optimal config automatically
    const optimal = calculateOptimalConfig(result);
    setRecommendedConfig(optimal);
    
    // Show recommendations badge
    setBenchmarkStatus({
      ok: true,
      message: `✅ Cấu hình tối ưu có sẵn (${formatTimeAgo()})`,
      primary: result.recommendation.primary_provider,
    });
  } catch (err) {
    setBenchmarkStatus({
      ok: false,
      message: `Benchmark thất bại: ${err.message}`,
    });
  } finally {
    setIsBenchmarking(false);
  }
};
```

---

### Step 3: Add Recommendation Modal Component
**New component: OptimalConfigRecommendationModal.jsx**

```javascript
export function OptimalConfigRecommendationModal({
  isOpen,
  benchmarkResult,
  recommendedConfig,
  onClose,
  onApply,
  t,
}) {
  if (!isOpen || !benchmarkResult || !recommendedConfig) {
    return null;
  }

  const primaryProvider = benchmarkResult.recommendation.primary_provider.toLowerCase();
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-2">
          {t('soc.vnbroker.optimal_config_title')}
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Dựa trên kết quả benchmark vừa chạy
        </p>

        <div className="space-y-4 mb-6">
          {['vci', 'kbs', 'dnse'].map((provider) => {
            const config = recommendedConfig[provider];
            const result = benchmarkResult.results.find(r => r.provider.toLowerCase() === provider);
            const isPrimary = provider === primaryProvider;

            return (
              <div key={provider} className={`p-4 border rounded-lg ${
                isPrimary ? 'border-blue-600 bg-blue-950/30' : 'border-slate-700 bg-slate-800'
              }`}>
                <p className="font-semibold text-white mb-2">
                  {provider.toUpperCase()} {isPrimary && '(Đề xuất Primary)'}
                </p>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-3">
                  <div>Latency: {result.latency_ms}ms</div>
                  <div>Req/min: {result.requests_per_minute}</div>
                  <div>Success: {result.success_pct.toFixed(1)}%</div>
                  <div>Rate limit: {result.rate_limited_pct.toFixed(1)}%</div>
                </div>

                {/* Timeout */}
                <div className="mb-2">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Timeout:</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {['connect', 'read', 'write', 'pool'].map(key => (
                      <div key={key}>
                        <label className="block text-slate-500">{key}</label>
                        <input type="text" value={`${config.timeout[key]}s`} disabled className="w-full bg-slate-700 text-slate-300 px-1 py-0.5 rounded" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Retry */}
                <div className="mb-2">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Retry:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-500">Max Retries</label>
                      <input type="text" value={config.max_retries} disabled className="w-full bg-slate-700 text-slate-300 px-1 py-0.5 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-500">Delay (s)</label>
                      <input type="text" value={config.retry_delay_seconds} disabled className="w-full bg-slate-700 text-slate-300 px-1 py-0.5 rounded" />
                    </div>
                  </div>
                </div>

                {/* Rate Limit */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Rate Limit:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-500">Requests/min</label>
                      <input type="text" value={config.requests_per_minute} disabled className="w-full bg-slate-700 text-slate-300 px-1 py-0.5 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-500">Burst</label>
                      <input type="text" value={config.burst_limit} disabled className="w-full bg-slate-700 text-slate-300 px-1 py-0.5 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded">
            Hủy
          </button>
          <button onClick={onApply} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded font-semibold">
            Lưu Cấu Hình Tối Ưu
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 4: Update Benchmark UI Section

**Show badge & buttons**:
```javascript
{benchmarkStatus && (
  <div className={`p-3 rounded border mb-3 ${
    benchmarkStatus.ok 
      ? 'bg-green-950/30 border-green-700 text-green-300'
      : 'bg-red-950/30 border-red-700 text-red-300'
  }`}>
    <p className="text-xs font-semibold mb-1">{benchmarkStatus.message}</p>
    {benchmarkStatus.ok && recommendedConfig && (
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setShowRecommendationModal(true)}
          className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded"
        >
          Xem Chi Tiết
        </button>
        <button
          onClick={() => {
            applyRecommendedConfig(recommendedConfig);
            setShowPreview(true);
          }}
          className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded font-semibold"
        >
          Lưu Cấu Hình Tối Ưu
        </button>
      </div>
    )}
  </div>
)}
```

---

### Step 5: Add i18n Keys

**New keys in vi.json**:
```json
{
  "soc": {
    "vnbroker": {
      "optimal_config_title": "Cấu Hình Tối Ưu Được Đề Xuất",
      "optimal_config_hint": "Dựa trên kết quả benchmark vừa chạy",
      "view_details": "Xem Chi Tiết",
      "save_optimal_config": "Lưu Cấu Hình Tối Ưu",
      "config_applied": "Cấu hình tối ưu đã áp dụng",
      "benchmark_no_data": "Chưa có kết quả benchmark"
    }
  }
}
```

---

## 📋 Estimated Changes

| File | Changes | LOC |
|------|---------|-----|
| VnbrokerPanel.jsx | Add state, handlers, UI for recommendations | +150 |
| OptimalConfigRecommendationModal.jsx | New modal component | +200 |
| vi.json | Add new i18n keys | +10 |
| **Total** | | **~360 LOC** |

---

## ✅ Success Criteria

1. ✅ After benchmark, show "Cấu hình tối ưu có sẵn" badge
2. ✅ "Xem Chi Tiết" opens modal with all recommendations
3. ✅ "Lưu Cấu Hình Tối Ưu" applies all per-provider settings
4. ✅ Primary provider set correctly
5. ✅ Fallback chain set from recommendation
6. ✅ Config preview shows before apply
7. ✅ All Vietnamese text renders correctly (no i18n keys)
8. ✅ Modal is responsive on small screens

---

## 🚀 Rollout Plan

### Phase 1: Implementation (2-3 commits)
- **Commit 1**: Add helper functions + state management
- **Commit 2**: Create OptimalConfigRecommendationModal component
- **Commit 3**: Wire everything together + i18n

### Phase 2: Validation (1 commit)
- Run full dev stack
- Test benchmark → recommendations → save flow
- Verify per-provider config applied correctly
- Check all Vietnamese text

### Phase 3: Deployment (1 commit)
- Rebuild Docker stack
- Push to dev branch
- Final smoke test

**Total estimated time**: 2-3 hours

---

## 🎯 User Benefits

✅ **Zero manual config needed** — After benchmark, 1 click to apply optimal settings  
✅ **Intelligent defaults** — Timeout/retry/rate-limit calculated from actual performance  
✅ **Per-provider tuning** — Each provider gets customized settings based on its characteristics  
✅ **Transparent reasoning** — Modal shows WHY each setting was chosen  
✅ **Quick iteration** — Can re-run benchmark anytime to get new recommendations  

---

## ❓ Questions Before Implementation?

1. ✅ Agree with calculation rules (timeout, retry, rate-limit)?
2. ✅ UI design acceptable (modal + badges + buttons)?
3. ✅ Should we persist recommendation history (last 5 benchmarks)?
4. ✅ Should "Lưu Cấu Hình Tối Ưu" auto-apply or show preview first?

**Current default**: Show preview first (safer, user can review before applying)

