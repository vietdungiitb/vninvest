# Subscribed Frontend Integration Quick-Start Guide
**Document**: SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE_20260513.md  
**Target Audience**: Frontend teams integrating with core-api  
**Status**: Implementation Guide

---

## 1. For Frontend Developers: 10-Minute Integration

### 1.1 Get Your Credentials

1. **Register tenant** in core-api admin
2. **Create service account** via partner portal
   ```
   Name: "my-frontend-app"
   Scopes: ["read:dashboard", "read:portfolio", "read:signals"]
   ```
3. **Issue initial PAT** 
   - Store securely in environment: `CORE_API_PAT=vni_...`
   - PAT shown **once only** — save to `.env.local`
   - Rotate every 90 days via partner portal

### 1.2 Install SDK (2 lines)

```bash
npm install @vninvest/core-sdk
# or
yarn add @vninvest/core-sdk
```

### 1.3 Initialize Adapter (3 lines)

```typescript
import { CoreApiAdapter } from '@vninvest/core-sdk';

const api = new CoreApiAdapter(
  process.env.CORE_API_URL,      // e.g., https://core-api.vninvest.com
  process.env.CORE_API_PAT       // e.g., vni_abc123...
);
```

### 1.4 Make Your First Call (1 line)

```typescript
const ticker = await api.fetchRealtimeTicker('VRE');
console.log(ticker.data.price);  // "94.50"
```

**Done!** 🎉

---

## 2. Common Use Cases

### 2.1 Display Real-Time Ticker in React Component

```jsx
import { useEffect, useState } from 'react';
import { CoreApiAdapter } from '@vninvest/core-sdk';

export function TickerWidget({ symbol }) {
  const [ticker, setTicker] = useState(null);
  const api = new CoreApiAdapter(CORE_API_URL, PAT);

  useEffect(() => {
    api.fetchRealtimeTicker(symbol)
      .then(resp => setTicker(resp.data))
      .catch(err => console.error(err));
  }, [symbol]);

  if (!ticker) return <div>Loading...</div>;

  return (
    <div>
      <h2>{ticker.symbol}</h2>
      <p>Price: ₫{ticker.price}</p>
      <p className={ticker.change_pct > 0 ? 'green' : 'red'}>
        {ticker.change_pct > 0 ? '+' : ''}{ticker.change_pct}%
      </p>
    </div>
  );
}
```

### 2.2 Check Plan Features Before Rendering

```jsx
import { CoreCapabilityGuard } from '@vninvest/core-sdk';

export function AdvisoryFeature({ api }) {
  const guard = new CoreCapabilityGuard(api);
  const [canUse, setCanUse] = useState(false);

  useEffect(() => {
    guard.has('ai_advisory').then(setCanUse);
  }, []);

  if (!canUse) {
    return (
      <div className="upgrade-prompt">
        <p>AI Advisory is available on Pro & Enterprise plans</p>
        <button>Upgrade Now</button>
      </div>
    );
  }

  return <AdvisoryPanel />;
}
```

### 2.3 Handle Rate Limiting Gracefully

```javascript
async function fetchWithRetry(apiCall, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (err) {
      if (err.response?.status === 429) {
        // Rate limited — wait and retry
        const resetTime = parseInt(
          err.response.headers['x-ratelimit-reset']
        );
        const waitMs = resetTime * 1000 - Date.now();
        console.log(`Rate limited. Waiting ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }
  }
}

// Usage:
const ticker = await fetchWithRetry(
  () => api.fetchRealtimeTicker('VRE')
);
```

### 2.4 Fetch Portfolio with Automatic Tenant Scoping

```typescript
async function getMyPortfolios() {
  // No need to pass tenant_id — core-api filters automatically
  const response = await api.fetchPortfolios({
    cursor: undefined,
    page_size: 50
  });

  return response.data.results;
  // Only returns portfolios owned by authenticated tenant
}
```

### 2.5 Listen for Real-Time Data Updates via WebSocket

```typescript
import { CoreWebSocketClient } from '@vninvest/core-sdk';

const ws = new CoreWebSocketClient(CORE_WS_URL, PAT);

ws.subscribe('ticker', { symbols: ['VRE', 'HPG'] }, (data) => {
  console.log(`${data.symbol} updated to ₫${data.price}`);
});

ws.on('disconnect', () => {
  console.log('Disconnected. Will auto-reconnect...');
});
```

---

## 3. Error Handling Pattern

### Standard Error Codes & Handling

```typescript
try {
  const advisor = await api.fetchAdvisory('VRE');
} catch (err) {
  const { status, data } = err.response || {};
  
  switch (status) {
    case 401:
      // Token expired or invalid — force re-auth
      localStorage.clear();
      window.location.href = '/login';
      break;
    
    case 403:
      // User lacks permission (plan, capability)
      showDialog('Feature requires Pro plan. Upgrade?');
      break;
    
    case 404:
      // Resource not found
      console.warn(`Advisory not found for VRE`);
      break;
    
    case 429:
      // Rate limited — show cooldown
      const resetTime = err.response.headers['x-ratelimit-reset'];
      const secs = Math.ceil((resetTime * 1000 - Date.now()) / 1000);
      showToast(`Please wait ${secs}s before retrying`);
      break;
    
    case 500:
      // Server error — retry with exponential backoff
      await retryWithBackoff(() => api.fetchAdvisory('VRE'), 5);
      break;
    
    default:
      showToast('Unexpected error. Please contact support.');
  }
}
```

---

## 4. Environment Configuration

### Development (`.env.local`)
```bash
CORE_API_URL=http://localhost:8000
CORE_API_PAT=vni_dev_pat_abc123xyz
DEBUG=true
```

### Staging (`.env.staging`)
```bash
CORE_API_URL=https://core-api-staging.vninvest.com
CORE_API_PAT=$(VAULT_READ staging/core-api-pat)
DEBUG=false
LOG_LEVEL=info
```

### Production (`.env.production` or secrets manager)
```bash
CORE_API_URL=https://core-api.vninvest.com
CORE_API_PAT=$(VAULT_READ prod/core-api-pat)  # Never hardcode!
DEBUG=false
LOG_LEVEL=warn
```

### CORS Configuration (Admin Task)
```python
# In core-api settings
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',                # local dev
    'https://dev.myapp.com',                # dev frontend
    'https://myapp.com',                    # production
    'https://app.vninvest.com',             # legacy
]
```

---

## 5. Pagination: Cursor vs Offset

### Cursor-Based (Recommended)
```typescript
// First page
let response = await api.fetchPortfolios({ page_size: 50 });
console.log(response.data.results);  // [portfolio1, portfolio2, ...]
console.log(response.data.cursor);   // "cD0yMDI2LTA1LTEzJmlkPTEyMzQ1"

// Next page
response = await api.fetchPortfolios({
  cursor: response.data.cursor,
  page_size: 50
});
```

**Advantages**: Stable under inserts/deletes, efficient for large datasets

### Offset (Legacy, Deprecated)
```typescript
// Avoid new code using offset — use cursor instead
const page1 = await api.fetchPortfolios({ offset: 0, limit: 50 });
const page2 = await api.fetchPortfolios({ offset: 50, limit: 50 });
```

---

## 6. Advanced: Custom API Calls

### Direct HTTP with Auth Headers
```typescript
const customResponse = await fetch(
  'https://core-api.vninvest.com/api/custom-endpoint/',
  {
    headers: {
      'Authorization': `Bearer ${process.env.CORE_API_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: 'value' })
  }
);

const data = await customResponse.json();
```

### Using Adapter's Underlying HTTP Client
```typescript
const customData = await api.client.post(
  '/api/custom-endpoint/',
  { data: 'value' }
);
// Automatically includes Authorization header
```

---

## 7. Testing: Mock Core API Responses

### Mock Service Worker (MSW) Setup
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const mockServer = setupServer(
  rest.get('http://localhost:8000/api/realtime/ticker/:symbol', 
    (req, res, ctx) => {
      const { symbol } = req.params;
      return res(
        ctx.status(200),
        ctx.json({
          symbol: symbol.toUpperCase(),
          price: '94.50',
          change_pct: 2.34,
        })
      );
    }
  )
);

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

// Your test:
test('displays ticker price', async () => {
  render(<TickerWidget symbol="VRE" />);
  expect(await screen.findByText(/94.50/)).toBeInTheDocument();
});
```

### Mock SDK Directly (Simpler)
```typescript
jest.mock('@vninvest/core-sdk', () => ({
  CoreApiAdapter: jest.fn().mockImplementation(() => ({
    fetchRealtimeTicker: jest.fn().mockResolvedValue({
      data: { symbol: 'VRE', price: '94.50' }
    })
  }))
}));
```

---

## 8. Monitoring & Logging

### Log API Calls to Analytics
```typescript
class AnalyticsAdapter extends CoreApiAdapter {
  async fetchRealtimeTicker(symbol) {
    const startTime = Date.now();
    try {
      const result = await super.fetchRealtimeTicker(symbol);
      console.log('API_CALL', {
        endpoint: 'realtime/ticker',
        symbol,
        duration_ms: Date.now() - startTime,
        status: 'success',
      });
      return result;
    } catch (err) {
      console.error('API_CALL', {
        endpoint: 'realtime/ticker',
        symbol,
        duration_ms: Date.now() - startTime,
        status: 'error',
        error_code: err.response?.status,
      });
      throw err;
    }
  }
}
```

### Monitor Quota Usage
```typescript
async function checkQuotaAndWarn() {
  const meter = await api.fetchUsageMeters({ period: 'day' });
  const apiCallsMetric = meter.data.results.find(m => m.metric === 'api_calls');
  
  if (apiCallsMetric.percent_used > 80) {
    console.warn('⚠️  Daily API quota 80% used. Current plan may need upgrade.');
  }
  if (apiCallsMetric.percent_used >= 100) {
    console.error('❌ Daily API quota exceeded. Additional calls will fail.');
  }
}

// Check every 10 minutes
setInterval(checkQuotaAndWarn, 10 * 60 * 1000);
```

---

## 9. Migration Checklist: Legacy Backend → Core API

### Phase 1: Audit (Week 1)
- [ ] List all legacy API endpoints used by frontend
- [ ] Map to equivalent core-api endpoint (see § 2 of Catalog)
- [ ] Identify any custom endpoints with no core-api equivalent
- [ ] Document data transformation differences

### Phase 2: Gradual Replacement (Week 2-3)
- [ ] Start with read-only endpoints (tickers, profiles, history)
- [ ] Replace one feature area at a time
- [ ] Keep fallback to legacy API for unmigrated endpoints
- [ ] Test each replacement with real data

### Phase 3: Testing (Week 4)
- [ ] Run integration tests against core-api
- [ ] Load test with production-like traffic
- [ ] A/B test with 10% of users
- [ ] Monitor error rates + latency

### Phase 4: Cutover (Week 5)
- [ ] Remove legacy API fallback code
- [ ] Monitor for 24 hours
- [ ] Be ready to roll back if issues arise
- [ ] Celebrate! 🎉

---

## 10. Getting Help

### Documentation
- **API Catalog**: See `docs/CORE_API_CATALOG_SUBSCRIPTION_STANDARDIZATION_20260513.md`
- **OpenAPI Spec**: `https://core-api.vninvest.com/docs/openapi.yaml`
- **SDK GitHub**: `https://github.com/vninvest/core-sdk`

### Support Channels
- **Email**: api-support@vninvest.com (24-48h response)
- **Slack** (Pro+ only): #api-support channel in workspace
- **GitHub Discussions**: `github.com/vninvest/core-sdk/discussions`

### Common Issues & Solutions

#### "Invalid or revoked PAT"
- [ ] Check PAT hasn't expired (expires_at in partner portal)
- [ ] Verify Authorization header format: `Bearer vni_...`
- [ ] Check PAT is stored securely (not in git!)
- [ ] Rotate PAT if suspected compromise

#### "403 Forbidden — Feature requires Pro plan"
- [ ] Check user's plan in partner portal
- [ ] Verify feature is in plan's entitlements
- [ ] Upgrade plan if needed
- [ ] Use capability guard before rendering UI

#### "429 Too Many Requests"
- [ ] Check daily quota usage in partner portal
- [ ] Implement request batching (e.g., `fetchRealtimeTickers()` instead of loop)
- [ ] Use exponential backoff for retries
- [ ] Upgrade to higher plan if quota consistently exceeded

#### "CORS error: Origin not allowed"
- [ ] Contact api-support@vninvest.com with your domain
- [ ] Admin adds domain to `CORS_ALLOWED_ORIGINS`
- [ ] Allow 5-10 minutes for config reload
- [ ] Clear browser cache if error persists

---

## 11. Next Level: Advanced Patterns

### Caching Strategy
```typescript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchTicker(symbol) {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await api.fetchRealtimeTicker(symbol);
  cache.set(symbol, { data, timestamp: Date.now() });
  return data;
}
```

### Request Deduplication
```typescript
const pendingRequests = new Map();

async function fetchTickerDedup(symbol) {
  // If same request already in-flight, return same promise
  if (pendingRequests.has(symbol)) {
    return pendingRequests.get(symbol);
  }
  
  const promise = api.fetchRealtimeTicker(symbol);
  pendingRequests.set(symbol, promise);
  
  try {
    return await promise;
  } finally {
    pendingRequests.delete(symbol);
  }
}
```

### Streaming Large Datasets
```typescript
async function* streamAllPortfolios(pageSize = 100) {
  let cursor = undefined;
  
  while (true) {
    const response = await api.fetchPortfolios({
      cursor,
      page_size: pageSize
    });
    
    yield* response.data.results;
    
    if (!response.data.cursor) break;
    cursor = response.data.cursor;
  }
}

// Usage:
for await (const portfolio of streamAllPortfolios()) {
  console.log(portfolio.name);
}
```

---

**Last Updated**: 2026-05-13  
**Status**: Ready for Integration  
**Maintained By**: API Team  
**License**: Same as core-api
