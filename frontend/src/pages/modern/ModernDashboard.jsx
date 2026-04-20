import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getSummary, getHoldings, getAnalytics, getPortfolioTechnicals, getPortfolioNewsDigest, getTrackedSymbols } from '../../api/client';
import { useI18n } from '../../context/LangContext';
import useRealtimeFeed from '../../hooks/useRealtimeFeed';
import { buildLiveHoldingsOverlay } from '../../utils/dashboardRealtimeSelectors';

import SmartStatsHeader from '../../components/modern/SmartStatsHeader';
import ModularPositionDeck from '../../components/modern/ModularPositionDeck';
import ModernSidebar from '../../components/modern/ModernSidebar';
import PortfolioHeatmap from '../../components/PortfolioHeatmap';
import EquityVsBenchmarkChart from '../../components/EquityVsBenchmarkChart';

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

export default function ModernDashboard() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t } = useI18n();

  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [technicals, setTechnicals] = useState(null);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);

  const holdingSymbols = useMemo(
    () => holdings.map((h) => normalizeSymbol(h.symbol)).filter(Boolean),
    [holdings],
  );
  const trackedSymbolNames = useMemo(
    () => trackedSymbols.map((t) => normalizeSymbol(t.symbol)).filter(Boolean),
    [trackedSymbols],
  );
  const monitoredSymbols = useMemo(
    () => [...new Set([...holdingSymbols, ...trackedSymbolNames])],
    [holdingSymbols, trackedSymbolNames],
  );

  const {
    quotesBySymbol,
    alerts,
    realtimeStatus
  } = useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 10 });

  const liveHoldings = buildLiveHoldingsOverlay(holdings, quotesBySymbol);

  const heatmapData = useMemo(() => {
    if (!monitoredSymbols.length) return [];

    const holdingsMap = new Map(liveHoldings.map((h) => [normalizeSymbol(h.symbol), h]));
    const trackedMap = new Map(trackedSymbols.map((t) => [normalizeSymbol(t.symbol), t]));

    const totalHeldValue = liveHoldings.reduce(
      (sum, h) => sum + Number(h.live_market_value || h.market_value || 0),
      0,
    );
    const avgPositionSize = liveHoldings.length > 0 ? totalHeldValue / liveHoldings.length : 10000;
    const nominalSize = Math.max(avgPositionSize * 0.4, 2000);

    const buildFallbackSparkline = (quote, held) => {
      const current = Number(quote?.current_price || held?.live_current_price || held?.current_price || 0);
      const prev = Number(quote?.prev_price || held?.prev_close || current || 0);
      if (!(current > 0) || !(prev > 0)) return [];
      const delta = current - prev;
      const base = prev;
      return [base, base + delta * 0.12, base + delta * 0.28, base + delta * 0.22,
              base + delta * 0.41, base + delta * 0.58, base + delta * 0.76, current]
        .map((v) => Number(v.toFixed(2)));
    };

    return monitoredSymbols.map((symbol) => {
      const held = holdingsMap.get(symbol);
      const quote = quotesBySymbol[symbol] || {};
      const changePct = quote.change_pct ?? held?.live_change_pct ?? 0;
      const sparkline24 = buildFallbackSparkline(quote, held);
      const trackedInfo = trackedMap.get(symbol);
      const industry = String(held?.industry || trackedInfo?.industry || 'Khác').trim() || 'Khác';

      if (held) {
        return {
          ...held,
          symbol,
          industry,
          company_name: held.company_name || held.name || symbol,
          market_cap_bn: held.market_cap_bn ?? trackedInfo?.market_cap_bn ?? null,
          live_current_price: Number(quote.current_price || held.live_current_price || held.current_price || 0),
          live_market_cap: Number(quote.market_cap || held.live_market_cap || held.market_cap || 0),
          live_volume: Number(quote.volume || held.live_volume || held.volume || 0),
          live_market_value: Number(held.live_market_value || held.market_value || 0),
          live_change_pct: changePct,
          sparkline24,
          is_holding: true,
        };
      }
      return {
        symbol,
        industry,
        company_name: trackedInfo?.name || trackedInfo?.company_name || symbol,
        market_cap_bn: trackedInfo?.market_cap_bn ?? null,
        live_current_price: Number(quote.current_price || 0),
        live_market_cap: Number(quote.market_cap || 0),
        live_volume: Number(quote.volume || 0),
        live_market_value: Number(quote.market_cap || 0) || nominalSize,
        live_change_pct: changePct,
        sparkline24,
        is_holding: false,
      };
    });
  }, [liveHoldings, monitoredSymbols, quotesBySymbol, trackedSymbols]);

  const realtimeMarketBreadth = useMemo(() => {
    return monitoredSymbols.reduce((acc, symbol) => {
      const quote = quotesBySymbol[symbol];
      if (!quote) return acc;
      const cp = quote.change_pct ?? 0;
      if (cp > 0) acc.up++;
      else if (cp < 0) acc.down++;
      else acc.flat++;
      return acc;
    }, { up: 0, down: 0, flat: 0 });
  }, [monitoredSymbols, quotesBySymbol]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !activePortfolioId) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getSummary(activePortfolioId),
        getHoldings(activePortfolioId),
        getAnalytics(activePortfolioId),
        getPortfolioTechnicals(activePortfolioId),
        getPortfolioNewsDigest(),
        getTrackedSymbols(),
      ]);

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      if (results[1].status === 'fulfilled') setHoldings(results[1].value.data);
      if (results[2].status === 'fulfilled') setAnalytics(results[2].value.data);
      if (results[3].status === 'fulfilled') setTechnicals(results[3].value.data?.technicals || []);
      if (results[4].status === 'fulfilled') setDigest(results[4].value.data);
      if (results[5].status === 'fulfilled') setTrackedSymbols(results[5].value.data || []);
    } catch (err) {
      console.error('ModernDashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activePortfolioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!activePortfolioId) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 italic">
        Vui lòng chọn hoặc tạo danh mục để bắt đầu.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* 1. Global High-Density Header */}
      <SmartStatsHeader 
        summary={summary} 
        loading={loading} 
        realtimeBreadth={realtimeMarketBreadth} 
        onRefresh={fetchData}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex p-4 gap-4 overflow-hidden relative">
        
        {/* Left: Charts & Positions (65%) */}
        <div className="w-[65%] flex flex-col gap-4 overflow-hidden">
          
          {/* Visual Hub: Heatmap & Equity Curve Side-by-Side */}
          <div className="h-[48%] grid grid-cols-2 gap-4 shrink-0">
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden p-1">
               <PortfolioHeatmap 
                  holdings={heatmapData} 
                  title="Theo dõi Dòng tiền"
                  compact={true}
               />
            </div>
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden p-3 flex flex-col">
               <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Đường cong tăng trưởng</h4>
               <div className="flex-1 min-h-0">
                  <EquityVsBenchmarkChart portfolioId={activePortfolioId} hideTitle={true} />
               </div>
            </div>
          </div>

          {/* Positional Deck: Tabbed Holdings */}
          <div className="flex-1 overflow-hidden">
             <ModularPositionDeck 
                holdings={liveHoldings} 
                loading={loading}
                quotesBySymbol={quotesBySymbol}
                technicals={technicals}
                alerts={alerts}
                analytics={analytics}
                digest={digest}
             />
          </div>
        </div>

        {/* Right: Sidebar Analytics (35%) */}
        <div className="w-[35%] overflow-hidden h-full">
           <ModernSidebar 
              portfolioId={activePortfolioId}
              alerts={alerts}
              breadth={realtimeMarketBreadth}
              analytics={analytics}
              digest={digest}
              loading={loading}
              portfolioSymbols={monitoredSymbols}
           />
        </div>
      </div>
    </div>
  );
}
