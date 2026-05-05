/**
 * SM-P5.7: VNInvest API Load Test
 * k6 load test: 500 VUs, target p95 < 200ms, 0 errors
 *
 * Run:
 *   k6 run infra/load-tests/api-load.js \
 *     -e BASE_URL=https://your-domain.com \
 *     -e CORE_PAT=your-pat-token
 *
 * Or with Docker:
 *   docker run --rm -i grafana/k6 run - < infra/load-tests/api-load.js \
 *     -e BASE_URL=https://your-domain.com -e CORE_PAT=your-pat-token
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const p95Latency = new Trend('p95_latency', true);
const errorRate = new Rate('error_rate');
const totalRequests = new Counter('total_requests');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 VUs
    { duration: '1m', target: 300 },    // Ramp up to 300 VUs
    { duration: '2m', target: 500 },    // Hold at 500 VUs
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // p95 < 200ms
    error_rate: ['rate<0.01'],          // < 1% error rate
    http_req_failed: ['rate<0.01'],     // < 1% failed requests
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';
const CORE_PAT = __ENV.CORE_PAT || '';

const coreHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${CORE_PAT}`,
};

const legacyHeaders = {
  'Content-Type': 'application/json',
};

// Test symbols (VN30 subset)
const SYMBOLS = ['VIC', 'VHM', 'VNM', 'HPG', 'TCB', 'VCB', 'BID', 'CTG', 'MBB', 'ACB'];

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function () {
  const symbol = randomSymbol();

  // Test 1: Health check (should be sub-10ms)
  const healthRes = http.get(`${BASE_URL}/core/v1/health`, { tags: { name: 'health' } });
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });
  errorRate.add(healthRes.status >= 400);
  totalRequests.add(1);
  p95Latency.add(healthRes.timings.duration);

  // Test 2: Whale alerts list
  const whaleRes = http.get(
    `${BASE_URL}/api/whale-alerts/?limit=20`,
    { headers: legacyHeaders, tags: { name: 'whale-alerts' } },
  );
  check(whaleRes, {
    'whale-alerts 200': (r) => r.status === 200,
  });
  errorRate.add(whaleRes.status >= 400);
  totalRequests.add(1);
  p95Latency.add(whaleRes.timings.duration);

  // Test 3: Market serving — stock snapshot
  const snapshotRes = http.get(
    `${BASE_URL}/core/v1/market/snapshot/?symbols=${symbol}`,
    { headers: coreHeaders, tags: { name: 'snapshot' } },
  );
  check(snapshotRes, {
    'snapshot 200 or 401': (r) => r.status === 200 || r.status === 401,
  });
  if (snapshotRes.status >= 500) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  totalRequests.add(1);
  p95Latency.add(snapshotRes.timings.duration);

  // Test 4: Daily prices (market_data domain)
  const pricesRes = http.get(
    `${BASE_URL}/core/v1/market-data/daily-prices/${symbol}/`,
    { headers: coreHeaders, tags: { name: 'daily-prices' } },
  );
  check(pricesRes, {
    'daily-prices not 5xx': (r) => r.status < 500,
  });
  errorRate.add(pricesRes.status >= 500);
  totalRequests.add(1);
  p95Latency.add(pricesRes.timings.duration);

  sleep(Math.random() * 0.5 + 0.1); // 100-600ms think time
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const errRate = (data.metrics.error_rate?.values?.rate || 0) * 100;
  const totalReqs = data.metrics.total_requests?.values?.count || 0;

  console.log(`\n=== VNInvest Load Test Summary ===`);
  console.log(`Total requests: ${totalReqs}`);
  console.log(`p95 latency: ${p95.toFixed(1)}ms (target: <200ms) ${p95 < 200 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Error rate: ${errRate.toFixed(2)}% (target: <1%) ${errRate < 1 ? '✓ PASS' : '✗ FAIL'}`);

  return {
    'infra/load-tests/results/summary.json': JSON.stringify(data, null, 2),
  };
}
