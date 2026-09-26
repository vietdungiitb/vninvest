import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../context/LangContext.js';
import useWhaleAnalyticsData from '../../hooks/useWhaleAnalyticsData.js';
import WhaleAnalyticsAdvisoryModal from './WhaleAnalyticsAdvisoryModal.jsx';
import { RotateCw, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

// R1.1 — bubble chart là thành phần DUY NHẤT thuộc dashboard (`grep` toàn repo:
// chỉ `WhaleAnalyticsTab` import). Import tĩnh khiến Vite gom nó vào chunk
// dùng chung với component của trang `/ai-advisory`, buộc trang advisory tải
// thêm 774 KB chỉ để vẽ chart. Lazy-load để tách thành chunk riêng, chỉ
// dashboard tải.
const FactsFirstWhaleBubbleChart = lazy(() => import('../FactsFirstWhaleBubbleChart.jsx'));

const TIMEFRAME_OPTIONS = [
  { value: '15m', labelKey: 'whaleChart.timeframe15m', defaultLabel: '15 phút' },
  { value: '30m', labelKey: 'whaleChart.timeframe30m', defaultLabel: '30 phút' },
  { value: '1h', labelKey: 'whaleChart.timeframe1h', defaultLabel: '1 giờ' },
  { value: 'morning', labelKey: 'whaleChart.timeframeMorning', defaultLabel: 'Phiên sáng' },
  { value: 'afternoon', labelKey: 'whaleChart.timeframeAfternoon', defaultLabel: 'Phiên chiều' },
  { value: 'session', labelKey: 'whaleChart.timeframeSession', defaultLabel: 'Cả phiên' },
];

export default function WhaleAnalyticsTab({
  selectedSymbol,
  holdings = [],
  quotesBySymbol = {},
  symbolOptions = [],
}) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState('session');
  const [symbol, setSymbol] = useState(selectedSymbol || '');
  const [isAdvisoryModalOpen, setIsAdvisoryModalOpen] = useState(false);
  const { data, loading, error } = useWhaleAnalyticsData(symbol, timeframe, null, {
    includeBaseline: false,
  });

  const availableSymbols = useMemo(() => {
    const sourceSymbols = Array.isArray(symbolOptions) && symbolOptions.length > 0
      ? symbolOptions
      : holdings.map((holding) => String(holding?.symbol || '').trim().toUpperCase()).filter(Boolean);
    const symbols = new Set(sourceSymbols);
    return Array.from(symbols).sort();
  }, [holdings, symbolOptions]);

  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
    }
  }, [selectedSymbol, symbol]);

  useEffect(() => {
    if (!symbol && availableSymbols.length > 0) {
      setSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, symbol]);

  const smfi = data?.flow?.smfi ?? null;
  const strength = data?.flow?.dark_flow?.strength ?? 0;
  const isStale = Boolean(data?.meta?.is_stale);
  const isDegraded = Boolean(data?.meta?.degraded_mode);
  const staleReason = data?.meta?.stale_reason || null;
  const degradedBadgeLabel = staleReason === 'missing_intraday_ticks'
    ? t('whaleAnalytics.degradedMissingIntraday', { defaultValue: 'Thiếu tick intraday' })
    : t('whaleAnalytics.degradedMode', { defaultValue: 'Thiếu dữ liệu tham chiếu' });

  return (
    <div className="dashboard-full-width-deck flex flex-col">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-900/60 border-b border-slate-800/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {t('modernDeck.symbolLabel') || 'Mã CK'}
            </label>
            <select
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
            >
              {availableSymbols.map((availableSymbol) => (
                <option key={availableSymbol} value={availableSymbol}>{availableSymbol}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {t('whaleAnalytics.timeframe') || 'Khoảng thời gian'}
            </label>
            <select
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
            >
              {TIMEFRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{t(option.labelKey, { defaultValue: option.defaultLabel })}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {smfi !== null && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                {t('whaleAnalytics.smfiIndex') || 'Chỉ số SMFI'}
              </span>
              <span className={`text-sm font-black ${smfi >= 0 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]`}>
                {smfi > 0 ? '+' : ''}{smfi.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
              {t('whaleAnalytics.instStrength') || 'Sức mạnh tổ chức'}
            </span>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500 transition-all duration-1000 ease-out"
                  style={{ width: `${strength}%` }}
                />
              </div>
              <span className="text-sm font-black text-slate-200">{strength.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-hidden min-h-[300px]">
        <div className="relative group flex-1 min-h-[300px]">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000" />
          <div className="relative bg-slate-900/40 rounded-xl border border-slate-800/60 shadow-2xl overflow-hidden h-full">
            <Suspense
              fallback={(
                <div
                  className="flex h-full items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-600"
                  data-testid="whale-bubble-loading"
                >
                  {t('whaleChart.loading', { defaultValue: 'Đang tải biểu đồ…' })}
                </div>
              )}
            >
              <FactsFirstWhaleBubbleChart
                symbol={symbol}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                onSymbolChange={setSymbol}
                holdings={holdings}
                quotesBySymbol={quotesBySymbol}
                symbolOptions={availableSymbols}
                isEmbedded={true}
                selectedSymbol={symbol}
                analyticsData={data}
                analyticsLoading={loading}
                analyticsError={error}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Footer with status badges and AI advisory button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/60 border-t border-slate-800/50">
        <p className="text-[10px] text-slate-500 italic max-w-md">
          {t('whaleAnalytics.disclaimer', { defaultValue: '* Dữ liệu dòng tiền và bubble được chuẩn hóa theo bucket thời gian tương ứng với timeframe đang chọn. Sức mạnh tổ chức (0-100) phản ánh mức độ tập trung của dòng tiền thông minh trong phiên.' })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {isStale && (
            <span className="px-2 py-1 rounded bg-amber-950/30 border border-amber-800/50 text-[9px] text-amber-300 font-bold uppercase">
              {t('whaleAnalytics.staleData', { defaultValue: 'Dữ liệu chậm' })}
            </span>
          )}
          {isDegraded && (
            <span className="px-2 py-1 rounded bg-rose-950/30 border border-rose-800/50 text-[9px] text-rose-300 font-bold uppercase">
              {degradedBadgeLabel}
            </span>
          )}
          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-400 font-bold uppercase">
            {t('whaleAnalytics.ssotVerified', { defaultValue: 'Xác thực SSOT' })}
          </span>
          <span className="px-2 py-1 rounded bg-emerald-950/30 border border-emerald-800/50 text-[9px] text-emerald-400 font-bold uppercase">
            {t('whaleAnalytics.realtimeFeed', { defaultValue: 'Dữ liệu Realtime' })}
          </span>
          <button
            type="button"
            onClick={() => setIsAdvisoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-800/50 text-[9px] text-cyan-300 font-bold uppercase transition-colors hover:bg-cyan-900/30 hover:border-cyan-700/50"
          >
            <Activity className="h-3 w-3" />
            {t('whaleAnalytics.aiAdvisoryCta', { defaultValue: 'Tư vấn AI' })}
          </button>
        </div>
      </div>

      <WhaleAnalyticsAdvisoryModal
        isOpen={isAdvisoryModalOpen}
        symbol={symbol}
        onClose={() => setIsAdvisoryModalOpen(false)}
      />
    </div>
  );
}