import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../context/LangContext';
import FactsFirstWhaleBubbleChart from './FactsFirstWhaleBubbleChart';
import { RVOLChartPanel } from './RVOLChartPanel';
import { MoneyFlowDonut } from './MoneyFlowDonut';
import { WhaleFeedPanel } from './WhaleFeedPanel';

/**
 * AnalyticsTabDeck — Tabbed analytics panel bên dưới KLineChartPanel.
 *
 * Tabs:
 *   - Tab "🐋 Cá Mập": FactsFirstWhaleBubbleChart + MoneyFlowDonut + RVOLChartPanel + WhaleFeedPanel
 *   - Tab "🤖 AI Advisory": Slot thông qua render prop (content phức tạp, giữ trong StockDetail)
 *
 * Thiết kế:
 *   - selectedTradeDate là page-level state từ StockDetail, KHÔNG tạo local state
 *   - Tab content dùng display:none khi inactive (không unmount) — tránh re-fetch
 *   - KLineChartPanel KHÔNG nằm trong component này
 *
 * Props:
 *   symbol              {string}        - Mã cổ phiếu chuẩn hóa (BMP, FPT...)
 *   selectedTradeDate   {string|null}   - Ngày phiên được click từ KLine (YYYY-MM-DD)
 *   chartVisibleRange   {object}        - { from_ts, to_ts } cho syncTimestamp
 *   whaleFeedData       {object|null}   - Dữ liệu whale feed
 *   whaleFeedLoading    {boolean}       - Loading state whale feed
 *   onRefreshFeed       {function}      - Callback refresh whale feed
 *   realtimeAlerts      {Array}         - Live alerts từ WebSocket
 *   advisoryContent     {ReactNode}     - Nội dung tab AI Advisory (render prop từ StockDetail)
 *   defaultTab          {string}        - Tab active mặc định ('whale'|'advisory')
 */
export default function AnalyticsTabDeck({
  symbol,
  selectedTradeDate = null,
  chartVisibleRange = { from_ts: null, to_ts: null },
  whaleFeedData = null,
  whaleFeedLoading = false,
  onRefreshFeed,
  realtimeAlerts = [],
  advisoryContent = null,
  defaultTab = 'whale',
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Track which tabs đã được mount ít nhất 1 lần (lazy mount)
  const mountedTabs = useRef(new Set([defaultTab]));

  const handleTabChange = useCallback((tab) => {
    mountedTabs.current.add(tab);
    setActiveTab(tab);
  }, []);

  // Khi tab thay đổi, đánh dấu tab mới đã mount
  useEffect(() => {
    mountedTabs.current.add(activeTab);
  }, [activeTab]);

  const syncTimestamp = chartVisibleRange?.to_ts
    ? Math.floor(Number(chartVisibleRange.to_ts) / 1000)
    : null;

  const TABS = [
    { id: 'whale', label: t('analyticsTabDeck.tabWhale', { defaultValue: '🐋 Cá Mập' }) },
    { id: 'advisory', label: t('analyticsTabDeck.tabAdvisory', { defaultValue: '🤖 AI Advisory' }) },
  ];

  return (
    <div className="analytics-tab-deck card-section" style={{ display: 'flex', flexDirection: 'column', minHeight: 340 }}>
      {/* Tab bar */}
      <div
        className="analytics-tab-bar"
        style={{
          display: 'flex',
          borderBottom: '1px solid #1e293b',
          background: 'rgba(15,23,42,0.95)',
          paddingLeft: 4,
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`analytics-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            role="tab"
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === tab.id ? '#e2e8f0' : '#64748b',
              borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              whiteSpace: 'nowrap',
              outline: 'none',
              border: 'none',
            }}
          >
            {tab.label}
          </button>
        ))}

        {/* Session context badge */}
        {selectedTradeDate && (
          <div
            style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              fontSize: 11,
              color: '#94a3b8',
              alignSelf: 'center',
            }}
          >
            {t('analyticsTabDeck.viewingSession', { defaultValue: 'Phiên đang xem' })}:{' '}
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedTradeDate}</span>
          </div>
        )}
      </div>

      {/* Tab contents — dùng display:none khi không active để tránh unmount */}
      <div style={{ flex: 1, overflow: 'hidden auto', minHeight: 0 }}>

        {/* ── Tab 1: Cá Mập ─────────────────────────────────────── */}
        {mountedTabs.current.has('whale') && (
          <div
            id="analytics-tab-panel-whale"
            role="tabpanel"
            aria-labelledby="analytics-tab-whale"
            style={{ display: activeTab === 'whale' ? 'block' : 'none' }}
          >
            <div className="analytics-tab-content-fade">
              <div className="p-4">
                {/* Whale Bubble Chart — facts-first, self-fetching */}
                <div className="mb-2">
                  <p className="text-label">
                    {t('analyticsTabDeck.whaleSubtitle', { defaultValue: 'Phân bổ lệnh lớn theo giá × khối lượng' })}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-white">
                    {t('analyticsTabDeck.bubbleChartTitle', { defaultValue: 'Bubble Chart — Cá Mập' })}
                    {selectedTradeDate && (
                      <span className="ml-2 text-[11px] font-normal text-slate-400">
                        · {selectedTradeDate}
                      </span>
                    )}
                  </h3>
                </div>
                <FactsFirstWhaleBubbleChart
                  symbol={symbol}
                  tradeDate={selectedTradeDate}
                  isEmbedded={true}
                  syncTimestamp={syncTimestamp}
                />
                
                {/* MoneyFlowDonut inside Whale tab right below Bubble chart */}
                <div className="mt-4 border-t border-slate-800/80 pt-4">
                  <MoneyFlowDonut
                    summary={whaleFeedData?.summary}
                    loading={whaleFeedLoading}
                    compact
                  />
                </div>
              </div>

              {/* RVOL Chart */}
              <RVOLChartPanel symbol={symbol} loading={false} />

              {/* Whale Feed Panel */}
              <WhaleFeedPanel
                symbol={symbol}
                realtimeAlerts={realtimeAlerts}
                feedData={whaleFeedData}
                ordersOverride={selectedTradeDate ? [] : null}
                selectedTradeDate={selectedTradeDate}
                loading={whaleFeedLoading}
                onRefresh={onRefreshFeed}
                feedHeightClass="h-[240px]"
              />
            </div>
          </div>
        )}

        {/* ── Tab 3: AI Advisory ───────────────────────────────── */}
        {mountedTabs.current.has('advisory') && (
          <div
            id="analytics-tab-panel-advisory"
            role="tabpanel"
            aria-labelledby="analytics-tab-advisory"
            style={{ display: activeTab === 'advisory' ? 'block' : 'none' }}
          >
            <div className="analytics-tab-content-fade p-4">
              {advisoryContent ?? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                  {t('analyticsTabDeck.advisoryLoading', { defaultValue: 'Đang tải nội dung AI Advisory...' })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fade-in animation CSS */}
      <style>{`
        .analytics-tab-content-fade {
          animation: atdFadeIn 0.18s ease-out;
        }
        @keyframes atdFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
