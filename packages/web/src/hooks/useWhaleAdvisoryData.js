import { useState, useCallback, useEffect, useMemo } from 'react';
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

export const ADVISORY_INVALIDATION_EVENT = 'whale_advisory_invalidated';
export const ADVISORY_STATUS_POLL_INTERVAL_MS = 4000;
export const ADVISORY_STATUS_TIMEOUT_MS = 60000;
export const ADVISORY_FALLBACK_MAX_SYMBOLS = 20;
export const ADVISORY_FALLBACK_CACHE_TTL_MS = 60000;

const advisoryFallbackCache = new Map();

export async function loadAdvisoryFallback(symbols, adapter, now = Date.now()) {
  const candidates = Array.from(new Set((Array.isArray(symbols) ? symbols : [])
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean)))
    .slice(0, ADVISORY_FALLBACK_MAX_SYMBOLS);
  const resolved = [];
  const missing = [];
  candidates.forEach((symbol) => {
    const cached = advisoryFallbackCache.get(symbol);
    if (cached && now - cached.cachedAt < ADVISORY_FALLBACK_CACHE_TTL_MS && cached.item) {
      resolved.push(cached.item);
    } else {
      missing.push(symbol);
    }
  });
  if (missing.length === 0) return resolved;
  const responses = await Promise.allSettled(
    missing.map((symbol) => adapter.getAdvisoryHistory(symbol, { page_size: 1 })),
  );
  responses.forEach((response, index) => {
    if (response.status !== 'fulfilled') return;
    const payload = response.value || {};
    const item = normalizeAdvisoryItem((Array.isArray(payload.results) ? payload.results : [])[0]);
    if (!item) return;
    resolved.push(item);
    advisoryFallbackCache.set(missing[index], { item, cachedAt: now });
  });
  return resolved;
}

export async function pollAdvisoryStatus({
  advisoryId,
  getStatus,
  timeoutMs = ADVISORY_STATUS_TIMEOUT_MS,
  intervalMs = ADVISORY_STATUS_POLL_INTERVAL_MS,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const startedAt = now();
  while (now() - startedAt <= timeoutMs) {
    const payload = await getStatus(advisoryId);
    const state = String(payload?.status || '').toLowerCase();
    if (state === 'generated' || state === 'failed' || state === 'superseded') {
      return { status: state, payload };
    }
    await sleep(intervalMs);
  }
  return { status: 'timeout', payload: null };
}

function toList(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

// Nhất quán với SSOT BE `advisory/signal_norm.py` (R0.1): phải khớp cả
// tiếng Việt có dấu, và phải từ chối khuyến nghị bị phủ định. Trước đây
// FE chỉ so khớp chuỗi không dấu nên `BÁN` rơi về UNKNOWN.
const SIGNAL_BUY_TOKENS = new Set(['BUY', 'MUA', 'TANG', 'NEN MUA', 'DU KIEN MUA']);
const SIGNAL_SELL_TOKENS = new Set(['SELL', 'BAN', 'GIAM', 'CHOT LOI', 'HUY', 'THOAT', 'NEN BAN', 'DU KIEN BAN', 'CHOT LAI']);
const SIGNAL_FLAT_TOKENS = new Set(['HOLD', 'WATCH', 'NEUTRAL', 'GIU', 'THEO DOI', 'GAM', 'DONG']);
const SIGNAL_NEGATION_TOKENS = new Set(['KHONG', 'KHONG NEN', 'DUNG', 'CHUA', 'TUONG DOI', 'TRANH', 'TUYEN', 'CHAP', 'NOT', 'NO', 'AVOID', 'DONT', 'SHOULDNT', 'WITHHOLD']);
const SIGNAL_MAX_TOKENS = 4;

function normalizeSignalTokens(raw) {
  if (typeof raw !== 'string') return [];
  // NFD: tách dấu, giữ ký tự gốc Latin để so khớp với bảng token không dấu.
  const stripped = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return stripped
    .split(/[\s,.;:()[\]/\-–—+*&%!?"'`]+/)
    .map((token) => token.replace(/[^A-Z ]/g, ' ').trim())
    .filter(Boolean)
    .flatMap((token) => (token.includes(' ') ? token.split(' ') : [token]))
    .filter(Boolean);
}

export function normalizeAdvisorySide(rawSignal) {
  const tokens = normalizeSignalTokens(rawSignal);
  if (!tokens.length) return 'UNKNOWN';
  if (tokens.length > SIGNAL_MAX_TOKENS) return 'UNKNOWN';
  if (tokens.some((token) => SIGNAL_NEGATION_TOKENS.has(token))) return 'UNKNOWN';

  // Phải khớp cả token đơn lẻ lẫn cụm nhiều từ. `THEO DÕI` bị tách thành
  // ['THEO','DOI'] nên chỉ kiểm token đơn sẽ hụt, dẫn tới UNKNOWN.
  // BE (`signal_norm.normalize_signal`) làm đúng cả hai bước này.
  const joined = tokens.join(' ');
  const matches = (set) => tokens.some((token) => set.has(token)) || set.has(joined);

  const buy = matches(SIGNAL_BUY_TOKENS);
  const sell = matches(SIGNAL_SELL_TOKENS);
  if (buy && sell) return 'UNKNOWN';
  if (buy) return 'BUY';
  if (sell) return 'SELL';
  if (matches(SIGNAL_FLAT_TOKENS)) return 'HOLD';
  return 'UNKNOWN';
}

export function normalizeAdvisoryItem(item) {
  if (!item) return null;
  const structured = item?.structured_output && typeof item.structured_output === 'object'
    ? item.structured_output
    : {};
  const featureAttribution = item?.feature_attribution || structured.feature_attribution;
  const inputSnapshot = item?.input_snapshot || structured.input_snapshot;
  const rawConfidence = item?.confidence_score ?? item?.confidence;
  let normalizedConfidence = null;
  if (typeof rawConfidence === 'number' && rawConfidence > 0 && rawConfidence <= 1) {
    normalizedConfidence = Math.round(rawConfidence * 100);
  } else if (typeof rawConfidence === 'number') {
    normalizedConfidence = rawConfidence;
  }
  const errorInfo = item?.error_message && structured?.error && typeof structured.error === 'object'
    ? structured.error
    : null;
  // Phải khớp `AdvisoryRecordSerializer.get_signal` ở BE: đọc `signal`, nếu
  // UNKNOWN thì mới thử `recommendation`. Dùng `??` là không đủ vì chuỗi
  // "UNKNOWN" là truthy nên sẽ không rơi xuống nhánh fallback.
  const resolveSide = () => {
    const primary = normalizeAdvisorySide(item?.signal);
    if (primary !== 'UNKNOWN') return primary;
    const secondary = normalizeAdvisorySide(item?.side);
    if (secondary !== 'UNKNOWN') return secondary;
    const fromStructured = normalizeAdvisorySide(structured.signal);
    if (fromStructured !== 'UNKNOWN') return fromStructured;
    return normalizeAdvisorySide(structured.recommendation);
  };
  return {
    id: item?.advisory_id || item?.id,
    symbol: item?.symbol,
    side: resolveSide(),
    ai_summary: item?.summary || item?.summary_text || structured.summary || '',
    ai_detail: item?.rationale || structured.rationale || '',
    ai_provider: item?.ai_provider || '',
    ai_model: item?.ai_model || '',
    created_at: item?.created_at || item?.generated_at || null,
    generated_at: item?.generated_at || null,
    status: item?.status || 'pending',
    risk_level: item?.risk_level || structured.risk_level || 'unknown',
    target_price: item?.target_price ?? structured.target_price ?? null,
    confidence: normalizedConfidence,
    feature_attribution: featureAttribution && typeof featureAttribution === 'object' ? featureAttribution : {},
    input_snapshot: inputSnapshot && typeof inputSnapshot === 'object' ? inputSnapshot : {},
    matched_value: item?.matched_value ?? structured.matched_value ?? null,
    is_discovery: item?.is_discovery || structured.is_discovery || false,
    discovery_bucket: item?.discovery_bucket || structured.discovery_bucket || 'standard',
    whale_intensity: item?.whale_intensity ?? structured.whale_intensity ?? null,
    recommendation: item?.recommendation || structured.recommendation || '',
    components: Array.isArray(item?.components) ? item.components : [],
    tokens_used: item?.tokens_used ?? 0,
    error_code: item?.error_code || errorInfo?.error_code || null,
    user_message: item?.user_message || errorInfo?.user_message || null,
    error_message: item?.error_message || '',
    structured_output: structured,
  };
}

function buildFallbackSymbolStats(symbols, advisories = []) {
  const advisoryBySymbol = new Map(
    (Array.isArray(advisories) ? advisories : [])
      .filter(Boolean)
      .map((advisory) => [String(advisory?.symbol || '').trim().toUpperCase(), advisory]),
  );
  return Array.from(new Set((Array.isArray(symbols) ? symbols : [])
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean)))
    .sort()
    .map((symbol) => {
      const advisory = advisoryBySymbol.get(symbol) || null;
      const side = String(advisory?.side || '').trim().toUpperCase();
      return {
        symbol,
        // Không có dữ liệu -> `null` (hiển thị `—`), KHÔNG phải 0. Cột `0%`
        // giả trước đây làm 50 mã trông như có số liệu.
        side: side || null,
        signal: side || null,
        confidence: advisory?.confidence ?? null,
        isDiscovery: Boolean(advisory?.is_discovery),
        updatedAt: advisory?.created_at || null,
      };
    });
}

/**
 * @param {boolean} watchlistOnly
 * @param {boolean} isDiscoveryMode
 * @param {{ activePortfolioId?: string | number | null }} [options]
 */
export function useWhaleAdvisoryData(watchlistOnly, isDiscoveryMode = false, { activePortfolioId = null } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingRefreshSymbols, setPendingRefreshSymbols] = useState({});
  const [pendingDeleteSymbols, setPendingDeleteSymbols] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const [symbolStats, setSymbolStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshInfoMap, setRefreshInfoMap] = useState({});
  const [refreshInfoErrors, setRefreshInfoErrors] = useState({});

  const adapter = coreApiAdapter;

  const loadNativeSymbolUniverse = useCallback(async () => {
    const [holdingsResult, trackedResult] = await Promise.allSettled([
      activePortfolioId ? adapter.getPortfolioHoldings(activePortfolioId) : Promise.resolve({ results: [] }),
      adapter.getTrackedSymbols(),
    ]);

    const symbols = new Set();
    const holdings = holdingsResult.status === 'fulfilled' ? toList(holdingsResult.value?.results ?? holdingsResult.value) : [];
    const trackedSymbols = trackedResult.status === 'fulfilled' ? toList(trackedResult.value?.results ?? trackedResult.value) : [];

    holdings.forEach((holding) => {
      const symbol = String(holding?.symbol || '').trim().toUpperCase();
      if (symbol) symbols.add(symbol);
    });
    trackedSymbols.forEach((item) => {
      const symbol = String(item?.symbol || '').trim().toUpperCase();
      if (symbol) symbols.add(symbol);
    });

    return Array.from(symbols).sort();
  }, [activePortfolioId, adapter]);

  const fetchWhaleStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const resp = await adapter.getWhaleAdvisorySymbolStats({ window: 'session' });
      const stats = Array.isArray(resp?.stats) ? resp.stats : Array.isArray(resp) ? resp : [];
      if (stats.length > 0) {
        setSymbolStats(stats);
        return;
      }
      if (!isDiscoveryMode) {
        const fallbackSymbols = await loadNativeSymbolUniverse();
        setSymbolStats(buildFallbackSymbolStats(fallbackSymbols));
      }
    } catch (err) {
      setStatsLoading(false);
      throw err;
    }
    setStatsLoading(false);
  }, [isDiscoveryMode, loadNativeSymbolUniverse, adapter]);

  const fetchDataSnapshot = useCallback(async () => {
    try {
      let advisoryResp;
      if (isDiscoveryMode) {
        advisoryResp = await adapter.getMarketDiscoveryHub();
      } else {
        const params = watchlistOnly ? { watchlist_only: 'true', contract: 'canonical' } : { contract: 'canonical' };
        advisoryResp = await adapter.getWhaleAdvisories(params);
      }

      const dataItems = isDiscoveryMode
        ? (advisoryResp?.discovery_signals || advisoryResp?.data?.discovery_signals || [])
        : (advisoryResp?.items || advisoryResp?.data?.items || []);

      let advisories = dataItems
        .map((item) => normalizeAdvisoryItem(item))
        .filter(Boolean);

      // R0.12 — `GET /portfolio/ai-advisory/` đã implement thật, nên nhánh
      // fallback 20 request/mã không còn cần thiết. Giữ lại nhưng chỉ khi
      // list endpoint trả rỗng VÀ còn mã ứng viên, để trang không trắng khi
      // endpoint lỗi tạm thời.
      if (!isDiscoveryMode && advisories.length === 0) {
        const candidateSymbols = await loadNativeSymbolUniverse();
        if (candidateSymbols.length > 0) {
          advisories = await loadAdvisoryFallback(candidateSymbols, adapter);
          setSymbolStats((current) => {
            const hasAdvisoryBackedStats = current.some((item) => (
              Number(item?.count || 0) > 0
              || Number(item?.buyCount || 0) > 0
              || Number(item?.sellCount || 0) > 0
              || Number(item?.whaleIntensity || 0) > 0
            ));
            return hasAdvisoryBackedStats
              ? current
              : buildFallbackSymbolStats(candidateSymbols, advisories);
          });
        }
      }

      setItems(advisories);
      return advisories;
    } catch (err) {
      console.error('Fetch snap failed:', err);
      throw err;
    }
  }, [watchlistOnly, isDiscoveryMode, loadNativeSymbolUniverse, adapter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchDataSnapshot(), fetchWhaleStats()]);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'fetch-failed');
    } finally {
      setLoading(false);
    }
  }, [fetchDataSnapshot, fetchWhaleStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchWhaleStats, 60000);
    return () => clearInterval(interval);
  }, [fetchWhaleStats]);

  useEffect(() => {
    const onInvalidated = () => fetchDataSnapshot();
    const onDiscoveryUpdate = () => fetchDataSnapshot();
    window.addEventListener(ADVISORY_INVALIDATION_EVENT, onInvalidated);
    window.addEventListener('market_discovery_update', onDiscoveryUpdate);
    return () => {
      window.removeEventListener(ADVISORY_INVALIDATION_EVENT, onInvalidated);
      window.removeEventListener('market_discovery_update', onDiscoveryUpdate);
    };
  }, [fetchDataSnapshot]);

  const loadRefreshInfo = useCallback(async (symbol) => {
    if (!symbol || refreshInfoMap[symbol]) return;
    try {
      const resp = await adapter.getAdvisoryAutoRefreshInfo(symbol);
      setRefreshInfoMap(prev => ({ ...prev, [symbol]: resp || null }));
      setRefreshInfoErrors(prev => {
        if (!prev[symbol]) return prev;
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    } catch (err) {
      setRefreshInfoErrors(prev => ({
        ...prev,
        [symbol]: err?.response?.data?.detail || err?.message || 'refresh-info-unavailable',
      }));
    }
  }, [refreshInfoMap, adapter]);

  const handleRefreshAdvisory = useCallback(async (symbol) => {
    if (!symbol || pendingRefreshSymbols[symbol]) return;
    setPendingRefreshSymbols(prev => ({ ...prev, [symbol]: true }));
    setRowMessages(prev => ({ ...prev, [symbol]: '' }));

    try {
      const accepted = await adapter.refreshAdvisory(symbol);
      const advisoryId = accepted?.advisory_id || accepted?.task_id;
      if (!advisoryId) throw new Error('missing-advisory-id');
      setRowMessages(prev => ({ ...prev, [symbol]: `Đã xếp hàng làm mới ${symbol}` }));

      const result = await pollAdvisoryStatus({
        advisoryId,
        getStatus: adapter.getAdvisoryStatus,
      });
      if (result.status === 'generated') {
        await fetchDataSnapshot();
        setRowMessages(prev => ({ ...prev, [symbol]: 'Thành công' }));
        window.dispatchEvent(new CustomEvent(ADVISORY_INVALIDATION_EVENT, { detail: { symbol } }));
      } else if (result.status === 'failed') {
        setRowMessages(prev => ({ ...prev, [symbol]: 'Làm mới thất bại' }));
      } else {
        setRowMessages(prev => ({ ...prev, [symbol]: 'Hết thời gian chờ' }));
      }
    } catch (err) {
      setRowMessages(prev => ({ ...prev, [symbol]: 'Làm mới thất bại' }));
    } finally {
      setPendingRefreshSymbols(prev => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  }, [pendingRefreshSymbols, adapter, fetchDataSnapshot]);

  const handleDeleteAdvisory = useCallback(async (symbol) => {
    if (!symbol || pendingDeleteSymbols[symbol]) return;
    setPendingDeleteSymbols(prev => ({ ...prev, [symbol]: true }));
    try {
      await adapter.deleteCurrentWhaleAdvisory(symbol);
      await fetchDataSnapshot();
    } catch (err) {
      setRowMessages(prev => ({ ...prev, [symbol]: 'Lỗi' }));
    } finally {
      setPendingDeleteSymbols(prev => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  }, [pendingDeleteSymbols, adapter, fetchDataSnapshot]);

  // N3 — tìm mã trên TOÀN BỘ thị trường, không giới hạn danh sách theo dõi.
  //
  // Trước N3 sidebar chỉ lọc client-side trong `symbolStats`, mà `symbolStats`
  // đến từ holdings + watchlist. Người dùng muốn phân tích một mã không nằm
  // trong danh sách đó sẽ thấy "Không tìm thấy mã nào phù hợp" — tức là
  // tính năng tìm kiếm trông như đã hỏng, dù thị trường có 1399 mã active
  // (`StockProfile`). Nay gọi `GET /market-data/symbols/?q=` (đã xếp hạng khớp
  // chính xác lên đầu ở `market_data/views.py`).
  //
  // `hasAdvisory` đánh dấu mã đã có tư vấn: UI dùng cờ này để hiển thị `—`
  // thay vì bịa số liệu cho mã chưa phân tích.
  const [globalMatches, setGlobalMatches] = useState([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState('');

  const searchGlobalSymbols = useCallback(async (query) => {
    const trimmed = String(query || '').trim();
    if (trimmed.length < 1) {
      setGlobalMatches([]);
      setGlobalSearchError('');
      return;
    }
    setGlobalSearchLoading(true);
    setGlobalSearchError('');
    try {
      const resp = await adapter.getSymbolList({ q: trimmed, page_size: 12 });
      const results = Array.isArray(resp?.results) ? resp.results : Array.isArray(resp) ? resp : [];
      setGlobalMatches(
        results
          .map((row) => ({
            symbol: String(row?.symbol || row?.code || '').trim().toUpperCase(),
            name: String(row?.name || row?.company_name || '').trim(),
            exchange: String(row?.exchange || row?.market || '').trim(),
          }))
          .filter((row) => row.symbol),
      );
    } catch (err) {
      // Không nuốt lỗi: sidebar hiện thông báo, không im lặng rồi báo
      // "không tìm thấy" — hai việc khác nhau.
      setGlobalMatches([]);
      setGlobalSearchError(
        err?.message === 'symbol-search-failed'
          ? 'Không tải được danh sách mã'
          : String(err?.message || 'Không tải được danh sách mã'),
      );
    } finally {
      setGlobalSearchLoading(false);
    }
  }, [adapter]);

  return {
    items,
    loading,
    error,
    symbolStats,
    statsLoading,
    globalMatches,
    globalSearchLoading,
    globalSearchError,
    searchGlobalSymbols,
    refreshInfoMap,
    refreshInfoErrors,
    pendingRefreshSymbols,
    pendingDeleteSymbols,
    rowMessages,
    fetchData,
    loadRefreshInfo,
    handleRefreshAdvisory,
    handleDeleteAdvisory,
  };
}
