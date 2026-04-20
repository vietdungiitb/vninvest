import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getSummary, getHoldings, getAnalytics, getPortfolioTechnicals, getPortfolioNewsDigest } from '../../api/client';
import { useI18n } from '../../context/LangContext';
import useRealtimeFeed from '../../hooks/useRealtimeFeed';
import { buildLiveHoldingsOverlay } from '../../utils/dashboardRealtimeSelectors';

import SmartStatsHeader from '../../components/modern/SmartStatsHeader';
import ModularPositionDeck from '../../components/modern/ModularPositionDeck';
import ModernSidebar from '../../components/modern/ModernSidebar';
import PortfolioHeatmap from '../../components/PortfolioHeatmap';
import EquityVsBenchmarkChart from '../../components/EquityVsBenchmarkChart';

export default function ModernDashboard() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t } = useI18n();

  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [technicals, setTechnicals] = useState(null);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);

  const monitoredSymbols = useMemo(() => {
    return holdings.map(h => h.symbol.trim().toUpperCase());
  }, [holdings]);

  const {
    quotesBySymbol,
    alerts,
    realtimeStatus
  } = useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 10 });

  const liveHoldings = buildLiveHoldingsOverlay(holdings, quotesBySymbol);

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
      ]);

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      if (results[1].status === 'fulfilled') setHoldings(results[1].value.data);
      if (results[2].status === 'fulfilled') setAnalytics(results[2].value.data);
      if (results[3].status === 'fulfilled') setTechnicals(results[3].value.data?.technicals || []);
      if (results[4].status === 'fulfilled') setDigest(results[4].value.data);
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
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Left: Charts & Positions (65%) */}
        <div className="w-[65%] flex flex-col gap-4 overflow-hidden">
          
          {/* Visual Hub: Heatmap & Equity Curve Side-by-Side */}
          <div className="h-[40%] grid grid-cols-2 gap-4">
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden p-1">
               <PortfolioHeatmap 
                  holdings={liveHoldings} 
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
           />
        </div>
      </div>
    </div>
  );
}
