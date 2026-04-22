import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getTrackedSymbols,
  getWhaleAdvisories,
  getMarketDiscoveryHub, // Need to add this to api/client
  getWhaleAdvisorySymbolStats,
  getAdvisoryAutoRefreshInfo,
  refreshWhaleAdvisory,
  deleteCurrentWhaleAdvisory
} from '../api/client';
import { useI18n } from '../context/LangContext';

export const ADVISORY_INVALIDATION_EVENT = 'whale_advisory_invalidated';

export function useWhaleAdvisoryData(watchlistOnly, isDiscoveryMode = false) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingRefreshSymbols, setPendingRefreshSymbols] = useState({});
  const [pendingDeleteSymbols, setPendingDeleteSymbols] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const [symbolStats, setSymbolStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshInfoMap, setRefreshInfoMap] = useState({});

  const fetchWhaleStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const resp = await getWhaleAdvisorySymbolStats({ window: 'session' });
      if (resp.data?.stats) setSymbolStats(resp.data.stats);
    } catch (err) {
      console.error('Failed to fetch whale stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);
  
  const fetchDataSnapshot = useCallback(async () => {
    try {
      let advisoryResp;
      if (isDiscoveryMode) {
        advisoryResp = await getMarketDiscoveryHub();
      } else {
        advisoryResp = await getWhaleAdvisories(
          watchlistOnly ? { watchlist_only: 'true', contract: 'canonical' } : { contract: 'canonical' }
        );
      }

      const dataItems = isDiscoveryMode 
        ? (advisoryResp?.data?.discovery_signals || []) 
        : (advisoryResp?.data?.items || []);
      
      const advisories = dataItems.map((item) => ({
        id: item?.advisory_id || item?.id,
        symbol: item?.symbol,
        side: item?.recommendation || item?.side || 'UNKNOWN',
        ai_summary: item?.summary_text || item?.summary || '',
        ai_detail: item?.detail_text || '',
        ai_provider: item?.ai_provider || 'openclaw',
        ai_model: item?.ai_model || 'default',
        created_at: item?.created_at,
        severity: item?.risk_level || item?.severity || null,
        confidence: item?.confidence,
        matched_value: item?.matched_value || 0,
        // Phase 3 Discovery Fields
        is_discovery: item?.is_discovery || false,
        discovery_bucket: item?.discovery_bucket || 'standard',
        whale_intensity: item?.whale_intensity || item?.intensity || 0,
        threshold_source: item?.threshold_source || 'user_default',
      }));
      setItems(advisories);
      return advisories;
    } catch (err) {
      console.error('Fetch snap failed:', err);
      throw err;
    }
  }, [watchlistOnly, isDiscoveryMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchDataSnapshot(), fetchWhaleStats()]);
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleAdvisory.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [fetchDataSnapshot, fetchWhaleStats, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    const interval = setInterval(fetchWhaleStats, 60000);
    return () => clearInterval(interval);
  }, [fetchWhaleStats]);

  useEffect(() => {
    const onInvalidated = () => fetchDataSnapshot();
    const onDiscoveryUpdate = (e) => {
      // Phase 4: Atomic refresh on discovery update to keep UI live
      console.log('Realtime Discovery Update received:', e.detail);
      fetchDataSnapshot();
    };
    
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
      const resp = await getAdvisoryAutoRefreshInfo(symbol);
      setRefreshInfoMap(prev => ({ ...prev, [symbol]: resp?.data || null }));
    } catch (_) {}
  }, [refreshInfoMap]);

  const handleRefreshAdvisory = useCallback(async (symbol) => {
    if (!symbol || pendingRefreshSymbols[symbol]) return;
    setPendingRefreshSymbols(prev => ({ ...prev, [symbol]: true }));
    setRowMessages(prev => ({ ...prev, [symbol]: '' }));
    
    try {
       const baseline = items.find(i => i.symbol === symbol)?.created_at;
       const baselineTs = baseline ? new Date(baseline).getTime() : 0;

       await refreshWhaleAdvisory(symbol);
       setRowMessages(prev => ({ ...prev, [symbol]: t('whaleAdvisory.refreshQueued', { symbol }) }));

       let success = false;
       for (let i = 0; i < 15; i++) {
         const advisories = await fetchDataSnapshot();
         const latest = advisories.find(e => e.symbol === symbol);
         const currentTs = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
         if (currentTs > baselineTs) {
           success = true;
           break;
         }
         await new Promise(r => setTimeout(r, 4000));
       }
       
       if (success) {
         setRowMessages(prev => ({ ...prev, [symbol]: t('common.success') }));
         window.dispatchEvent(new CustomEvent(ADVISORY_INVALIDATION_EVENT, { detail: { symbol } }));
       }
    } catch (err) {
      setRowMessages(prev => ({ ...prev, [symbol]: t('whaleAdvisory.refreshFailed') }));
    } finally {
      setPendingRefreshSymbols(prev => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  }, [items, pendingRefreshSymbols, t, fetchDataSnapshot]);

  const handleDeleteAdvisory = useCallback(async (symbol) => {
    if (!symbol || pendingDeleteSymbols[symbol]) return;
    setPendingDeleteSymbols(prev => ({ ...prev, [symbol]: true }));
    try {
      await deleteCurrentWhaleAdvisory(symbol);
      await fetchDataSnapshot();
    } catch (err) {
      setRowMessages(prev => ({ ...prev, [symbol]: t('common.error') }));
    } finally {
      setPendingDeleteSymbols(prev => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  }, [pendingDeleteSymbols, fetchDataSnapshot, t]);

  return {
    items,
    loading,
    error,
    symbolStats,
    statsLoading,
    refreshInfoMap,
    pendingRefreshSymbols,
    pendingDeleteSymbols,
    rowMessages,
    fetchData,
    loadRefreshInfo,
    handleRefreshAdvisory,
    handleDeleteAdvisory
  };
}
