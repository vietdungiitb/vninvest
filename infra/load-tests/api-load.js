/**
 * SM-P5.7 / P5.1: VNInvest API load harness
 *
 * Profiles:
 * - smoke: public-only validation for local syntax/runtime checks
 * - baseline: the existing 500-VU API mix
 * - core_saas: lightweight SaaS cutover validation against the native core runtime
 * - p5_1: 10k synthetic load on stable core-native read paths, warm queue, websocket fanout, and runtime probes
 * - p5_1_wide: diagnostic pass for broader observability/load endpoints kept outside the 10k gate
 *
 * Run examples:
 *   k6 run infra/load-tests/api-load.js -e BASE_URL=https://your-domain.com -e CORE_PAT=your-pat-token
 *   docker run --rm -v "${PWD}:/work" -w /work grafana/k6 run infra/load-tests/api-load.js \
 *     -e LOAD_PROFILE=smoke -e BASE_URL=http://host.docker.internal:80
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const LOAD_PROFILE = normalizeProfile(__ENV.LOAD_PROFILE || 'baseline');
const BASE_URL = normalizeBaseUrl(__ENV.BASE_URL || 'http://localhost:80');
const CORE_PAT = __ENV.CORE_PAT || '';
const OPS_PAT = __ENV.OPS_PAT || __ENV.ADMIN_PAT || CORE_PAT;
const WS_PAT = __ENV.WS_PAT || CORE_PAT;

const TARGET_HTTP_VUS = parseInteger(__ENV.TARGET_HTTP_VUS, LOAD_PROFILE === 'p5_1' ? 10000 : LOAD_PROFILE === 'core_saas' ? 1 : LOAD_PROFILE === 'p5_1_wide' ? 0 : 500);
const WS_CLIENTS = parseInteger(__ENV.WS_CLIENTS, LOAD_PROFILE === 'p5_1' ? 200 : LOAD_PROFILE === 'core_saas' ? 1 : LOAD_PROFILE === 'p5_1_wide' ? 0 : 10);
const QUEUE_PRESSURE_VUS = parseInteger(__ENV.QUEUE_PRESSURE_VUS, LOAD_PROFILE === 'p5_1' ? 5 : LOAD_PROFILE === 'p5_1_wide' ? 1 : LOAD_PROFILE === 'core_saas' ? 1 : 0);
const PROBE_VUS = parseInteger(__ENV.PROBE_VUS, LOAD_PROFILE === 'p5_1' ? 2 : LOAD_PROFILE === 'p5_1_wide' ? 1 : LOAD_PROFILE === 'core_saas' ? 1 : 1);
const WS_HOLD_SECONDS = parseInteger(__ENV.WS_HOLD_SECONDS, LOAD_PROFILE === 'p5_1' ? 300 : LOAD_PROFILE === 'core_saas' ? 5 : 30);
const LOAD_DURATION = __ENV.LOAD_DURATION || (LOAD_PROFILE === 'p5_1' ? '15m' : LOAD_PROFILE === 'p5_1_wide' ? '10m' : LOAD_PROFILE === 'core_saas' ? '45s' : '3m');
const SAMPLE_EVERY = Math.max(parseInteger(__ENV.SAMPLE_EVERY, LOAD_PROFILE === 'p5_1' ? 20 : LOAD_PROFILE === 'p5_1_wide' ? 10 : LOAD_PROFILE === 'core_saas' ? 3 : 10), 1);
const WS_SYMBOL_COUNT = Math.max(parseInteger(__ENV.WS_SYMBOL_COUNT, 3), 1);

const DEFAULT_SYMBOLS = [
  'VIC', 'VHM', 'VNM', 'HPG', 'TCB', 'VCB', 'BID', 'CTG', 'MBB', 'ACB',
  'SSI', 'FPT', 'GAS', 'MSN', 'PLX', 'SAB', 'VRE', 'VPB', 'STB', 'HDB',
  'GVR', 'KDH', 'NVL', 'POW', 'PNJ', 'DGC', 'DXG', 'TPB', 'SHB', 'LPB',
];

const SYMBOLS = splitCsv(__ENV.SYMBOLS) || DEFAULT_SYMBOLS;

const requestLatencyMs = new Trend('request_latency_ms', true);
const requestErrors = new Rate('request_errors');
const totalRequests = new Counter('total_requests');
const queueTriggerRequests = new Counter('queue_trigger_requests');
const websocketConnections = new Counter('websocket_connections');
const websocketMessages = new Counter('websocket_messages');
const websocketFanoutMessages = new Counter('websocket_fanout_messages');
const websocketConnectLatencyMs = new Trend('websocket_connect_latency_ms', true);
const websocketPingLatencyMs = new Trend('websocket_ping_latency_ms', true);
const prefetchFreshnessSeconds = new Trend('prefetch_freshness_seconds', true);
const prefetchHealthyRate = new Rate('prefetch_healthy_rate');
const realtimeHealthyRate = new Rate('realtime_healthy_rate');
const realtimePendingDepthTotal = new Trend('realtime_pending_depth_total', true);
const realtimePendingDepthMax = new Trend('realtime_pending_depth_max', true);

export const options = buildOptions();

function buildOptions() {
  if (LOAD_PROFILE === 'smoke') {
    return {
      scenarios: {
        smoke: {
          executor: 'shared-iterations',
          vus: 1,
          iterations: 5,
          exec: 'runSmokeMix',
        },
      },
      thresholds: {
        http_req_duration: ['p(95)<1000'],
        http_req_failed: ['rate<0.05'],
        request_errors: ['rate<0.05'],
      },
    };
  }

  if (LOAD_PROFILE === 'core_saas') {
    return {
      scenarios: {
        core_saas: {
          executor: 'shared-iterations',
          vus: 1,
          iterations: 3,
          exec: 'runCoreSaasCutover',
        },
      },
      thresholds: {
        http_req_failed: ['rate<0.05'],
        request_errors: ['rate<0.05'],
        websocket_ping_latency_ms: ['p(95)<1000'],
      },
    };
  }

  if (LOAD_PROFILE === 'p5_1') {
    return {
      scenarios: {
        api_mix: {
          executor: 'ramping-vus',
          exec: 'runHttpMix',
          stages: buildRampStages(TARGET_HTTP_VUS),
          gracefulRampDown: '30s',
        },
        queue_pressure: {
          executor: 'constant-vus',
          exec: 'runCoreSaasQueueWarm',
          vus: QUEUE_PRESSURE_VUS,
          duration: LOAD_DURATION,
          startTime: '30s',
        },
        websocket_fanout: {
          executor: 'constant-vus',
          exec: 'runWebsocketFanout',
          vus: WS_CLIENTS,
          duration: LOAD_DURATION,
          startTime: '45s',
        },
        runtime_probe: {
          executor: 'constant-vus',
          exec: 'runCoreSaasRuntimeProbe',
          vus: PROBE_VUS,
          duration: LOAD_DURATION,
          startTime: '15s',
        },
      },
      thresholds: {
        http_req_duration: ['p(95)<250'],
        http_req_failed: ['rate<0.01'],
        request_errors: ['rate<0.01'],
        websocket_connect_latency_ms: ['p(95)<1000'],
        websocket_ping_latency_ms: ['p(95)<1000'],
        prefetch_freshness_seconds: ['p(95)<2'],
        prefetch_healthy_rate: ['rate>0.99'],
        realtime_healthy_rate: ['rate>0.99'],
      },
    };
  }

  if (LOAD_PROFILE === 'p5_1_wide') {
    return {
      scenarios: {
        queue_pressure: {
          executor: 'constant-vus',
          exec: 'runQueuePressure',
          vus: QUEUE_PRESSURE_VUS,
          duration: LOAD_DURATION,
          startTime: '20s',
        },
        observability_probe: {
          executor: 'constant-vus',
          exec: 'probeObservability',
          vus: PROBE_VUS,
          duration: LOAD_DURATION,
          startTime: '45s',
        },
      },
    };
  }

  return {
    stages: [
      { duration: '30s', target: 100 },
      { duration: '1m', target: 300 },
      { duration: '2m', target: 500 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<200'],
      http_req_failed: ['rate<0.01'],
      request_errors: ['rate<0.01'],
    },
  };
}

function buildRampStages(targetVus) {
  const warmupTarget = Math.max(Math.floor(targetVus * 0.1), 1000);
  const midTarget = Math.max(Math.floor(targetVus * 0.5), warmupTarget);

  return [
    { duration: '5m', target: warmupTarget },
    { duration: '5m', target: midTarget },
    { duration: '10m', target: targetVus },
    { duration: '5m', target: targetVus },
    { duration: '3m', target: 0 },
  ];
}

export function runSmokeMix() {
  const healthRes = http.get(`${BASE_URL}/core/v1/health`, { tags: { name: 'health' } });
  recordHttpResponse(healthRes, 'health');
  check(healthRes, {
    'health responded': (r) => r.status === 200,
  });

  const capabilityRes = http.get(`${BASE_URL}/core/v1/capability-bootstrap`, { tags: { name: 'capability-bootstrap' } });
  recordHttpResponse(capabilityRes, 'capability-bootstrap');
  check(capabilityRes, {
    'capability bootstrap responded': (r) => r.status === 200,
  });

  const apiHealthRes = http.get(`${BASE_URL}/api/core/v1/health`, { tags: { name: 'api-core-health' } });
  recordHttpResponse(apiHealthRes, 'api-core-health');
  check(apiHealthRes, {
    'api core health responded': (r) => r.status === 200,
  });

  sleep(0.1);
}

export function runHttpMix() {
  const symbol = randomSymbol();

  const healthRes = http.get(`${BASE_URL}/core/v1/health`, { tags: { name: 'health' } });
  recordHttpResponse(healthRes, 'health');
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });

  const whaleRes = http.get(
    `${BASE_URL}/api/realtime/whale-feed/aggregate/?symbols=${encodeURIComponent(symbol)}&sort=ts&window=session&limit=5`,
    { headers: buildAuthHeaders(CORE_PAT), tags: { name: 'whale-feed-aggregate' } },
  );
  recordHttpResponse(whaleRes, 'whale-feed-aggregate');
  check(whaleRes, {
    'whale-feed aggregate 200': (r) => r.status === 200,
  });

  const pricesRes = http.get(
    `${BASE_URL}/core/v1/market-data/daily-prices/${encodeURIComponent(symbol)}/`,
    { headers: buildAuthHeaders(CORE_PAT), tags: { name: 'daily-prices' } },
  );
  recordHttpResponse(pricesRes, 'daily-prices');
  check(pricesRes, {
    'daily-prices not 5xx': (r) => r.status < 500,
  });

  sleep(Math.random() * 0.5 + 0.1);
}

export function runCoreSaasCutover() {
  runSmokeMix();
  runCoreSaasReadMix();
  runCoreSaasQueueWarm();
  runCoreSaasRuntimeProbe();
  runWebsocketFanout();
}

export function runCoreSaasReadMix() {
  const symbol = randomSymbol();

  const healthRes = http.get(`${BASE_URL}/core/v1/health`, { tags: { name: 'health' } });
  recordHttpResponse(healthRes, 'health');
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });

  const pricesRes = http.get(
    `${BASE_URL}/core/v1/market-data/daily-prices/${encodeURIComponent(symbol)}/`,
    { headers: buildAuthHeaders(CORE_PAT), tags: { name: 'daily-prices' } },
  );
  recordHttpResponse(pricesRes, 'daily-prices');
  check(pricesRes, {
    'daily-prices not 5xx': (r) => r.status < 500,
  });

  sleep(Math.random() * 0.25 + 0.05);
}

export function runCoreSaasQueueWarm() {
  if (!OPS_PAT) {
    sleep(1);
    return;
  }

  const warmRes = http.post(
    `${BASE_URL}/api/admin-ops/prefetch/warm/?mode=async`,
    '{}',
    { headers: buildJsonHeaders(OPS_PAT), tags: { name: 'warm-prefetch' } },
  );
  recordHttpResponse(warmRes, 'warm-prefetch');
  check(warmRes, {
    'warm prefetch queued': (r) => r.status === 200 || r.status === 202,
  });

  queueTriggerRequests.add(1);
  sleep(0.25 + Math.random() * 0.25);
}

export function runCoreSaasRuntimeProbe() {
  if (!OPS_PAT) {
    sleep(1);
    return;
  }

  const realtimeHealthRes = http.get(
    `${BASE_URL}/api/health/realtime/`,
    { headers: buildAuthHeaders(OPS_PAT), tags: { name: 'realtime-health-probe' } },
  );
  recordHttpResponse(realtimeHealthRes, 'realtime-health-probe');
  check(realtimeHealthRes, {
    'realtime health probe responded': (r) => r.status === 200,
  });

  const runtimeRes = http.get(
    `${BASE_URL}/api/admin-ops/runtime-kpi/`,
    { headers: buildAuthHeaders(OPS_PAT), tags: { name: 'runtime-kpi' } },
  );
  recordHttpResponse(runtimeRes, 'runtime-kpi');
  check(runtimeRes, {
    'runtime KPI responded': (r) => r.status === 200,
  });

  const runtimeSnapshot = safeJsonParse(runtimeRes.body);
  if (runtimeSnapshot && runtimeSnapshot.prefetch_health) {
    const freshnessSeconds = Number(runtimeSnapshot.prefetch_health.freshness_seconds);
    if (Number.isFinite(freshnessSeconds)) {
      prefetchFreshnessSeconds.add(freshnessSeconds);
    }
    if (Object.prototype.hasOwnProperty.call(runtimeSnapshot.prefetch_health, 'healthy')) {
      prefetchHealthyRate.add(Boolean(runtimeSnapshot.prefetch_health.healthy));
    }
  }

  sleep(0.25 + Math.random() * 0.25);
}

export function runQueuePressure() {
  if (!OPS_PAT) {
    sleep(1);
    return;
  }

  const warmRes = http.post(
    `${BASE_URL}/api/admin-ops/prefetch/warm/?mode=async`,
    '{}',
    { headers: buildJsonHeaders(OPS_PAT), tags: { name: 'warm-prefetch' } },
  );
  recordHttpResponse(warmRes, 'warm-prefetch');
  check(warmRes, {
    'warm prefetch queued': (r) => r.status === 200 || r.status === 202,
  });

  const ingestRes = http.post(
    `${BASE_URL}/api/admin-ops/prefetch/offpeak-ingest/?mode=async&days=5&max_symbols=25`,
    '{}',
    { headers: buildJsonHeaders(OPS_PAT), tags: { name: 'offpeak-ingest' } },
  );
  recordHttpResponse(ingestRes, 'offpeak-ingest');
  check(ingestRes, {
    'offpeak ingest queued': (r) => r.status === 200 || r.status === 202,
  });

  queueTriggerRequests.add(2);
  sleep(0.5 + Math.random() * 0.5);
}

export function runWebsocketFanout() {
  if (!WS_PAT) {
    sleep(1);
    return;
  }

  const symbol = randomSymbol();
  const wsUrl = buildWebSocketUrl(BASE_URL, WS_PAT, symbol);
  const connectStartedAt = Date.now();
  let pingSentAt = 0;
  let pingAckRecorded = false;

  const response = ws.connect(wsUrl, { tags: { name: 'realtime-ws' } }, (socket) => {
    websocketConnections.add(1);

    socket.on('open', () => {
      websocketConnectLatencyMs.add(Date.now() - connectStartedAt);
      pingSentAt = Date.now();
      socket.send(JSON.stringify({ type: 'ping' }));
    });

    socket.on('message', (message) => {
      websocketMessages.add(1);
      const payload = safeJsonParse(message);
      if (!payload) {
        return;
      }

      const eventType = String(payload.event_type || payload.type || payload.action || '').toLowerCase();
      if (!pingAckRecorded && eventType === 'pong') {
        websocketPingLatencyMs.add(Date.now() - pingSentAt);
        pingAckRecorded = true;
        return;
      }

      if (eventType !== 'connected' && eventType !== 'subscribed' && eventType !== 'pong') {
        websocketFanoutMessages.add(1);
      }
    });

    socket.setTimeout(() => {
      socket.close();
    }, WS_HOLD_SECONDS * 1000);
  });

  check(response, {
    'websocket connected': (r) => r && r.status === 101,
  });

  sleep(0.2);
}

export function probeObservability() {
  if (!OPS_PAT) {
    sleep(1);
    return;
  }

  const realtimeHealthRes = http.get(
    `${BASE_URL}/api/health/realtime/`,
    { headers: buildAuthHeaders(OPS_PAT), tags: { name: 'realtime-health-probe' } },
  );
  recordHttpResponse(realtimeHealthRes, 'realtime-health-probe');
  check(realtimeHealthRes, {
    'realtime health probe responded': (r) => r.status === 200,
  });

  const runtimeRes = http.get(
    `${BASE_URL}/api/admin-ops/runtime-kpi/`,
    { headers: buildAuthHeaders(OPS_PAT), tags: { name: 'runtime-kpi' } },
  );
  recordHttpResponse(runtimeRes, 'runtime-kpi');
  check(runtimeRes, {
    'runtime KPI responded': (r) => r.status === 200,
  });

  const runtimeSnapshot = safeJsonParse(runtimeRes.body);
  if (runtimeSnapshot && runtimeSnapshot.prefetch_health) {
    const freshnessSeconds = Number(runtimeSnapshot.prefetch_health.freshness_seconds);
    if (Number.isFinite(freshnessSeconds)) {
      prefetchFreshnessSeconds.add(freshnessSeconds);
    }
    if (Object.prototype.hasOwnProperty.call(runtimeSnapshot.prefetch_health, 'healthy')) {
      prefetchHealthyRate.add(Boolean(runtimeSnapshot.prefetch_health.healthy));
    }
  }

  const metricsRes = http.get(
    `${BASE_URL}/api/realtime/ops/metrics/?output=json`,
    { headers: buildAuthHeaders(OPS_PAT), tags: { name: 'realtime-ops-metrics' } },
  );
  recordHttpResponse(metricsRes, 'realtime-ops-metrics');
  check(metricsRes, {
    'realtime ops metrics responded': (r) => r.status === 200,
  });

  const metricsSnapshot = safeJsonParse(metricsRes.body);
  if (metricsSnapshot) {
    const realtimePayload = metricsSnapshot.metrics || metricsSnapshot;
    const streamReclaim = realtimePayload.stream_reclaim || {};
    const pendingDepthMap = streamReclaim.pending_depth || {};
    const pendingValues = Object.values(pendingDepthMap)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const totalPending = pendingValues.reduce((acc, value) => acc + value, 0);
    const maxPending = pendingValues.length > 0 ? Math.max(...pendingValues) : 0;

    realtimePendingDepthTotal.add(totalPending);
    realtimePendingDepthMax.add(maxPending);

    if (Object.prototype.hasOwnProperty.call(realtimePayload, 'healthy')) {
      realtimeHealthyRate.add(Boolean(realtimePayload.healthy));
    }
  }

  sleep(0.5);
}

export default function () {
  runHttpMix();
}

function recordHttpResponse(response, metricName) {
  totalRequests.add(1);
  requestErrors.add(response.status >= 400);
  requestLatencyMs.add(response.timings.duration, { name: metricName });
}

function buildAuthHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function buildJsonHeaders(token) {
  return buildAuthHeaders(token);
}

function buildWebSocketUrl(baseUrl, token, symbol) {
  const wsBaseUrl = baseUrl.startsWith('https://')
    ? baseUrl.replace('https://', 'wss://')
    : baseUrl.replace('http://', 'ws://');
  return `${wsBaseUrl}/ws/market/${encodeURIComponent(symbol)}/?token=${encodeURIComponent(token)}`;
}

function buildSummary(data) {
  const isHeavyProfile = LOAD_PROFILE === 'p5_1';
  const isWideProfile = LOAD_PROFILE === 'p5_1_wide';
  const httpP95 = metricStat(data, 'http_req_duration', 'p(95)');
  const httpErrorRate = metricStat(data, 'http_req_failed', 'rate');
  const customRequestErrorRate = metricStat(data, 'request_errors', 'rate');
  const wsConnectP95 = metricStat(data, 'websocket_connect_latency_ms', 'p(95)');
  const wsPingP95 = metricStat(data, 'websocket_ping_latency_ms', 'p(95)');
  const prefetchFreshnessP95 = metricStat(data, 'prefetch_freshness_seconds', 'p(95)');
  const pendingDepthMax = metricStat(data, 'realtime_pending_depth_max', 'max');
  const pendingDepthP95 = metricStat(data, 'realtime_pending_depth_total', 'p(95)');

  return {
    profile: LOAD_PROFILE,
    target_http_vus: TARGET_HTTP_VUS,
    websocket_clients: WS_CLIENTS,
    queue_pressure_vus: QUEUE_PRESSURE_VUS,
    probe_vus: PROBE_VUS,
    ws_hold_seconds: WS_HOLD_SECONDS,
    metrics: {
      http_req_duration_p95_ms: numberOrNull(httpP95),
      http_req_failed_rate: numberOrNull(httpErrorRate),
      request_errors_rate: numberOrNull(customRequestErrorRate),
      websocket_connect_latency_p95_ms: numberOrNull(wsConnectP95),
      websocket_ping_latency_p95_ms: numberOrNull(wsPingP95),
      prefetch_freshness_p95_seconds: numberOrNull(prefetchFreshnessP95),
      realtime_pending_depth_total_p95: numberOrNull(pendingDepthP95),
      realtime_pending_depth_max: numberOrNull(pendingDepthMax),
    },
    gates: {
      http_latency: isWideProfile ? null : (isHeavyProfile ? (numberOrNull(httpP95) <= 250) : (numberOrNull(httpP95) <= 200)),
      websocket_connect: wsConnectP95 == null ? null : wsConnectP95 <= 1000,
      websocket_ping: wsPingP95 == null ? null : wsPingP95 <= 1000,
      prefetch_freshness: prefetchFreshnessP95 == null ? null : prefetchFreshnessP95 <= 2,
      realtime_queue_depth: pendingDepthMax == null ? null : pendingDepthMax < 1000,
    },
    raw: data,
  };
}

function metricStat(data, metricName, statName) {
  const metric = data.metrics?.[metricName];
  if (!metric || !metric.values) {
    return null;
  }

  const value = metric.values[statName];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeProfile(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'smoke') {
    return 'smoke';
  }
  if (normalized === 'core_saas' || normalized === 'core-saas' || normalized === 'core.saas') {
    return 'core_saas';
  }
  if (normalized === 'p5_1' || normalized === 'p5-1' || normalized === 'p5.1' || normalized === 'p51') {
    return 'p5_1';
  }
  if (normalized === 'p5_1_wide' || normalized === 'p5-1-wide' || normalized === 'p5.1.wide' || normalized === 'p51wide') {
    return 'p5_1_wide';
  }
  return 'baseline';
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

function parseInteger(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(rawValue), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitCsv(rawValue) {
  if (!rawValue) {
    return null;
  }

  const values = String(rawValue)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : null;
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function pickSymbols(count) {
  const pool = [...SYMBOLS];
  const selected = [];

  while (pool.length > 0 && selected.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }

  if (selected.length === 0) {
    selected.push(randomSymbol());
  }

  return selected;
}

function safeJsonParse(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
  } catch (_error) {
    return null;
  }
}

function shouldSampleMetrics() {
  return Math.floor(Math.random() * SAMPLE_EVERY) === 0;
}

export function handleSummary(data) {
  const report = buildSummary(data);
  const text = [
    '=== VNInvest Load Test Summary ===',
    `Profile: ${report.profile}`,
    `Target HTTP VUs: ${report.target_http_vus}`,
    `Websocket clients: ${report.websocket_clients}`,
    `Queue pressure VUs: ${report.queue_pressure_vus}`,
    `Probe VUs: ${report.probe_vus}`,
    `HTTP p95: ${formatMaybeNumber(report.metrics.http_req_duration_p95_ms)} ms`,
    `HTTP failed rate: ${formatMaybeNumber(report.metrics.http_req_failed_rate, 4)}`,
    `Custom request error rate: ${formatMaybeNumber(report.metrics.request_errors_rate, 4)}`,
    `Websocket connect p95: ${formatMaybeNumber(report.metrics.websocket_connect_latency_p95_ms)} ms`,
    `Websocket ping p95: ${formatMaybeNumber(report.metrics.websocket_ping_latency_p95_ms)} ms`,
    `Prefetch freshness p95: ${formatMaybeNumber(report.metrics.prefetch_freshness_p95_seconds)} s`,
    `Realtime pending depth max: ${formatMaybeNumber(report.metrics.realtime_pending_depth_max)}`,
  ].join('\n');

  console.log(`\n${text}\n`);

  return {
    'infra/load-tests/results/summary.json': JSON.stringify(report, null, 2),
    'infra/load-tests/results/summary.txt': `${text}\n`,
  };
}

function formatMaybeNumber(value, precision = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'n/a';
  }

  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(precision);
}
