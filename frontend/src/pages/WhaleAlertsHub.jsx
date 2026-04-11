import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAggregateWhaleFeed, getTrackedSymbols, getWatchlistGroups, getWhaleAdvisories, getWhaleCampaigns, getSymbolInvestigation } from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';

function formatMoney(value, formatNumberFn) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatNumberFn(Number(value));
}

function formatCompactMoney(value, localeTag) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(localeTag, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatTime(value, formatDateTimeFn) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  const formatted = String(formatDateTimeFn(parsed) || '').trim();
  const hasClock = /\b\d{1,2}:\d{2}\b/.test(formatted);
  if (hasClock) return formatted;

  const timePart = parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatted} ${timePart}`.trim();
}

function getSideTone(side, t) {
  const normalizedSide = String(side || '').toLowerCase();
  if (normalizedSide === 'buy') {
    return {
      container: 'border-emerald-800/60 bg-emerald-950/20',
      badge: 'bg-emerald-950/70 text-emerald-300',
      label: t('whaleHub.bigBuy'),
    };
  }
  if (normalizedSide === 'sell') {
    return {
      container: 'border-rose-800/60 bg-rose-950/20',
      badge: 'bg-rose-950/70 text-rose-300',
      label: t('whaleHub.bigSell'),
    };
  }
  return {
    container: 'border-slate-800 bg-slate-950/70',
    badge: 'bg-slate-900 text-slate-300',
    label: t('whaleHub.neutral'),
  };
}

function getSizeClassLabel(sizeClass, t) {
  const normalizedSizeClass = String(sizeClass || '').toLowerCase();
  if (normalizedSizeClass === 'shark') return t('whaleHub.sizeClassShark');
  if (normalizedSizeClass === 'whale') return t('whaleHub.sizeClassWhale');
  return t('whaleHub.sizeClassLarge');
}

function getSeverityLabel(severity, t) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') return t('whaleHub.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleHub.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleHub.severityMedium');
  return t('whaleHub.severityLow');
}

function getCampaignTypeLabel(campaignType, t) {
  const normalized = String(campaignType || '').toLowerCase();
  if (normalized === 'accumulation') return t('whaleHub.campaignTypeAccumulation');
  if (normalized === 'distribution') return t('whaleHub.campaignTypeDistribution');
  return t('whaleHub.campaignTypeMixed');
}

function formatDuration(seconds, t) {
  const raw = Number(seconds || 0);
  if (!Number.isFinite(raw) || raw <= 0) return t('whaleHub.durationInstant');
  const minutes = Math.floor(raw / 60);
  if (minutes < 60) return t('whaleHub.durationMinutes', { value: minutes });
  const hours = Math.floor(minutes / 60);
  return t('whaleHub.durationHours', { value: hours });
}

function getCampaignSideLabel(side, t) {
  const normalized = String(side || '').toLowerCase();
  if (normalized === 'buy') return t('whaleHub.bigBuy');
  if (normalized === 'sell') return t('whaleHub.bigSell');
  return t('whaleHub.neutral');
}

function getSeverityTone(severity) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') {
    return 'bg-rose-500 text-white';
  }
  if (normalizedSeverity === 'high') {
    return 'bg-amber-400 text-slate-950';
  }
  if (normalizedSeverity === 'medium') {
    return 'bg-cyan-400 text-slate-950';
  }
  return 'bg-slate-800 text-slate-200';
}

function getThresholdSourceLabel(value, t) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'symbol_override') {
    return t('whaleHub.thresholdSourceOverride');
  }
  return t('whaleHub.thresholdSourceDefault');
}

function getAggregateSourceMeta(source, t) {
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource === 'redis_stream') {
    return {
      label: t('whaleHub.sourceRedisStream'),
      tone: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200',
      description: t('whaleHub.sourceRedisDesc'),
    };
  }
  if (normalizedSource === 'intraday_tick_db') {
    return {
      label: t('whaleHub.sourceIntradayDb'),
      tone: 'border-cyan-900/60 bg-cyan-950/30 text-cyan-200',
      description: t('whaleHub.sourceIntradayDesc'),
    };
  }
  if (normalizedSource === 'vnstock') {
    return {
      label: t('whaleHub.sourceVnstock'),
      tone: 'border-amber-800/60 bg-amber-950/30 text-amber-200',
      description: t('whaleHub.sourceVnstockDesc'),
    };
  }
  return {
    label: t('whaleHub.sourceUnknown'),
    tone: 'border-slate-800 bg-slate-950/70 text-slate-300',
    description: t('whaleHub.sourceUnknownDesc'),
  };
}

function buildTrackedSymbolBuckets(trackedSymbols) {
  const unique = [];
  const seen = new Set();

  for (const item of trackedSymbols || []) {
    const symbol = String(item.symbol || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    unique.push(symbol);
  }

  return unique;
}

function buildAggregateEventKey(item) {
  const primaryTime = item?.alert_first_seen_at || item?.alert_at || item?.ts || '';
  return [
    item?.symbol,
    item?.side,
    primaryTime,
    item?.matched_value,
    item?.volume,
    item?.price,
    item?.source,
    item?.threshold,
    item?.threshold_source,
  ].join(':');
}

function isCountableWhaleOrder(item) {
  const side = String(item?.side || '').toUpperCase();
  return side === 'BUY' || side === 'SELL';
}

function mergeUniqueAggregateEvents(existingItems, incomingItems) {
  const merged = [];
  const seen = new Set();
  for (const row of [...(existingItems || []), ...(incomingItems || [])]) {
    const key = buildAggregateEventKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

function buildSymbolStatsFromFeed(feedItems) {
  const map = {};
  for (const item of feedItems || []) {
    const sym = String(item.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    if (!map[sym]) {
      map[sym] = {
        buyCount: 0,
        sellCount: 0,
        totalValue: 0,
        totalVolume: 0,
        count: 0,
        latestAlertAt: null,
      };
    }
    const side = String(item.side || '').toUpperCase();
    const isOrderSide = isCountableWhaleOrder(item);
    if (isOrderSide) {
      if (side === 'BUY') map[sym].buyCount += 1;
      else map[sym].sellCount += 1;
      map[sym].totalValue += Number(item.matched_value || 0);
      map[sym].totalVolume += Number(item.volume || 0);
      map[sym].count += 1;
    }

    const alertTimeRaw = item.alert_first_seen_at || item.alert_at || item.ts || null;
    if (isOrderSide && alertTimeRaw) {
      const candidateTime = new Date(alertTimeRaw).getTime();
      const currentTime = map[sym].latestAlertAt ? new Date(map[sym].latestAlertAt).getTime() : NaN;
      if (!Number.isNaN(candidateTime) && (Number.isNaN(currentTime) || candidateTime > currentTime)) {
        map[sym].latestAlertAt = alertTimeRaw;
      }
    }
  }
  return map;
}

function getFrequencyLabel(totalValue, t) {
  // Dựa trên tổng giá trị (VNĐ) thay vì đếm số lần
  if (totalValue >= 5_000_000_000) return { label: t('whaleHub.freqExplosive'), color: 'text-rose-400', bg: 'bg-rose-900/40 border-rose-800/50' };
  if (totalValue >= 2_000_000_000) return { label: t('whaleHub.freqHigh'), color: 'text-amber-400', bg: 'bg-amber-900/40 border-amber-800/50' };
  if (totalValue >= 500_000_000) return { label: t('whaleHub.freqMedium'), color: 'text-cyan-400', bg: 'bg-cyan-900/40 border-cyan-800/50' };
  return { label: t('whaleHub.freqLow'), color: 'text-slate-500', bg: 'bg-slate-800/40 border-slate-700/50' };
}

function TrackedSymbolCard({ symbol, stats, t, localeTag, formatDateTimeFn }) {
  const st = stats || { buyCount: 0, sellCount: 0, totalValue: 0, totalVolume: 0, count: 0, latestAlertAt: null };
  const avgValue = st.count > 0 ? st.totalValue / st.count : 0;
  const whaleAvgPrice = st.totalVolume > 0 ? st.totalValue / st.totalVolume : 0;
  const totalOrders = st.buyCount + st.sellCount;
  const buyRatio = totalOrders > 0 ? (st.buyCount / totalOrders) * 100 : 0;
  const freq = getFrequencyLabel(st.totalValue, t);

  return (
    <Link
      to={`/whale-alerts/${symbol}`}
      className="block rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-colors hover:border-cyan-700/60"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-bold text-slate-100">{symbol}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${freq.bg} ${freq.color}`}>
          {freq.label}
        </span>
      </div>

      {/* Mua / Bán */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {t('whaleHub.buy')}: {st.buyCount}
        </span>
        <span className="flex items-center gap-1 text-rose-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
          {t('whaleHub.sell')}: {st.sellCount}
        </span>
      </div>

      {/* Bar */}
      {totalOrders > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rose-900/60">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${buyRatio}%` }}
          />
        </div>
      )}

      {/* Avg & Tổng */}
      <p className="mt-2 text-xs text-slate-400">
        {t('whaleHub.avgOrder')}: <span className="font-medium text-slate-200">{formatCompactMoney(avgValue, localeTag)} VND</span>
      </p>
      {whaleAvgPrice > 0 && (
        <p className="mt-0.5 text-xs text-cyan-400">
          {t('whaleHub.avgPrice')}: <span className="font-medium">{Number(whaleAvgPrice).toLocaleString(localeTag, { maximumFractionDigits: 0 })} VND/CP</span>
        </p>
      )}
      <p className="mt-0.5 text-xs text-slate-500">{t('whaleHub.totalOrders', { count: st.count })} · {formatCompactMoney(st.totalValue, localeTag)} VND</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {t('whaleHub.latestAlertAt')}: {formatTime(st.latestAlertAt, formatDateTimeFn)}
      </p>
    </Link>
  );
}

function AdvisoryPreviewCard({ item, canReadAdvisoryDetail, t, localeTag, formatDateTimeFn }) {
  const side = String(item.side || '').toUpperCase();
  const isBuy = side === 'BUY';

  return (
    <div className="grid grid-cols-[220px_1fr] divide-x divide-slate-800 border-t border-slate-800">
      {/* Cột trái: thông tin mã */}
      <div className={`p-4 border-l-2 ${isBuy ? 'border-emerald-500' : 'border-rose-500'}`}>
        <p className="text-sm font-bold text-slate-100">{item.symbol}</p>
        <div className="mt-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            isBuy ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
          }`}>
            {side || t('whaleHub.unknownSide')}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          <span className="font-medium text-slate-200">{formatCompactMoney(item.matched_value, localeTag)} VND</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{t('whaleHub.threshold')}: {formatCompactMoney(item.threshold, localeTag)} VND</p>
        <p className="mt-0.5 text-xs text-slate-500">{formatTime(item.created_at, formatDateTimeFn)}</p>
      </div>

      {/* Cột phải: AI Advisory */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-3">
          <span className="text-[11px] uppercase tracking-widest text-slate-500">
            {item.ai_provider || t('whaleHub.defaultAiProvider')}
          </span>
        </div>
        <p className="text-xs leading-6 text-slate-300 line-clamp-3">
          {item.ai_summary || t('whaleHub.noAiSummary')}
        </p>
        {canReadAdvisoryDetail && item.ai_detail ? (
          <p className="mt-2 text-xs leading-6 text-slate-400 line-clamp-2 border-t border-slate-800 pt-2">
            {item.ai_detail}
          </p>
        ) : !canReadAdvisoryDetail ? (
          <Link
            to="/upgrade"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
          >
            🔒 {t('whaleHub.deepAnalysis')}
          </Link>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
          <Link
            to={`/whale-alerts/${item.symbol}`}
            className="btn-secondary inline-flex items-center justify-center text-[11px]"
          >
            {t('whaleHub.openSymbolDashboard')}
          </Link>
          <Link
            to={`/stocks/${item.symbol}`}
            className="btn-secondary inline-flex items-center justify-center text-[11px]"
          >
            {t('whaleHub.openStockWorkspace')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function AggregateFeedCard({ item, t, localeTag, formatDateTimeFn }) {
  const tone = getSideTone(item.side, t);
  const severityTone = getSeverityTone(item.severity);
  const [showExplain, setShowExplain] = useState(false);

  const whyList = Array.isArray(item.why_triggered) ? item.why_triggered : [];
  const checkList = Array.isArray(item.next_checks) ? item.next_checks : [];
  const hasExplain = whyList.length > 0 || checkList.length > 0;

  // Abnormality score coloring
  const abnormalityScore = Number(item.abnormality_score ?? 50);
  let abnormalityTone = 'bg-slate-800 text-slate-200';
  if (abnormalityScore >= 80) abnormalityTone = 'bg-rose-900/70 text-rose-200';
  else if (abnormalityScore >= 60) abnormalityTone = 'bg-amber-900/70 text-amber-200';
  else if (abnormalityScore >= 40) abnormalityTone = 'bg-cyan-900/70 text-cyan-200';

  return (
    <div className={`rounded-2xl border transition-colors hover:border-cyan-700/60 ${tone.container}`}>
      <Link
        to={`/whale-alerts/${item.symbol}`}
        className="block p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-100">{item.symbol}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone.badge}`}>
                {tone.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{formatTime(item.ts, formatDateTimeFn)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              {getSizeClassLabel(item.size_class, t)}
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${severityTone}`}>
              {getSeverityLabel(item.severity, t)}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('whaleHub.matchedValue')}</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">{formatCompactMoney(item.matched_value, localeTag)} VND</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div className="flex flex-wrap justify-end gap-1.5 mb-2">
              <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${abnormalityTone}`}>
                {t('whaleHub.abnormality')}: {abnormalityScore.toFixed(0)}
              </div>
              {item.session_percentile !== undefined && (
                <div className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                  p{Math.round(item.session_percentile || 0)}
                </div>
              )}
            </div>
            <p>{t('whaleHub.displayScore')}: {item.display_score ?? '—'}</p>
            <p>{t('whaleHub.threshold')}: {formatCompactMoney(item.threshold, localeTag)} VND</p>
            <p>{t('whaleHub.thresholdSource')}: {getThresholdSourceLabel(item.threshold_source, t)}</p>
            <p className="mt-1">{t('whaleHub.source')}: {item.source || t('whaleHub.sourceRealtime')}</p>
          </div>
        </div>
      </Link>
      {hasExplain && (
        <div className="border-t border-slate-800/60 px-4 pb-3">
          <button
            type="button"
            onClick={() => setShowExplain((s) => !s)}
            className="mt-2 text-[11px] text-cyan-400/70 hover:text-cyan-300 transition-colors"
          >
            {showExplain ? t('whaleHub.hideExplain') : t('whaleHub.showExplain')}
          </button>
          {showExplain && (
            <div className="mt-2 space-y-2.5">
              {whyList.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">{t('whaleHub.whyTriggered')}</p>
                  <ul className="space-y-0.5">
                    {whyList.map((reason, i) => (
                      <li key={i} className="flex gap-1.5 text-[11px] text-slate-300">
                        <span className="text-cyan-500 shrink-0">•</span>{reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {checkList.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">{t('whaleHub.nextChecks')}</p>
                  <div className="flex flex-wrap gap-1">
                    {checkList.map((check) => (
                      <span key={check} className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] font-mono text-slate-300">{check}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ item, t, localeTag, formatDateTimeFn, onOpenDetail }) {
  const sideTone = getSideTone(item.side_bias, t);
  const sourceKeys = Object.keys(item.source_mix || {});
  const sourceMixLabel = sourceKeys.length === 0
    ? t('whaleHub.sourceUnknown')
    : sourceKeys.join(' + ');

  return (
    <div className={`rounded-2xl border p-4 ${sideTone.container}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to={`/whale-alerts/${item.symbol}`} className="text-lg font-semibold text-slate-100 hover:text-cyan-300">
              {item.symbol}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sideTone.badge}`}>
              {getCampaignTypeLabel(item.campaign_type, t)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{formatTime(item.last_event_at, formatDateTimeFn)}</p>
        </div>
        <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-cyan-300">
          {t('whaleHub.campaignStrength')}: {item.campaign_strength ?? '—'}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
          <p className="text-slate-500">{t('whaleHub.eventCount')}</p>
          <p className="mt-1 font-semibold text-slate-100">{item.event_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
          <p className="text-slate-500">{t('whaleHub.duration')}</p>
          <p className="mt-1 font-semibold text-slate-100">{formatDuration(item.duration_seconds, t)}</p>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        <p>{t('whaleHub.matchedValue')}: <span className="font-semibold text-slate-100">{formatCompactMoney(item.total_matched_value, localeTag)} VND</span></p>
        <p className="mt-1">{t('whaleHub.feedSource')}: {sourceMixLabel}</p>
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
        {t('whaleHub.campaignContains', { count: (item.events || []).length || 0 })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onOpenDetail?.(item)}
          className="rounded-lg border border-cyan-700/50 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-500 hover:text-cyan-100"
        >
          {t('whaleHub.viewCampaignDetail')}
        </button>
      </div>
    </div>
  );
}

function CampaignDetailModal({ campaign, onClose, t, localeTag, formatDateTimeFn }) {
  if (!campaign) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-label">{t('whaleHub.campaignDetailTitle')}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-100">
              {campaign.symbol} · {getCampaignTypeLabel(campaign.campaign_type, t)}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {t('whaleHub.campaignStrength')}: {campaign.campaign_strength ?? '—'} · {t('whaleHub.eventCount')}: {campaign.event_count ?? 0}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
          >
            {t('whaleHub.closeDetail')}
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p>{t('whaleHub.duration')}: <span className="font-semibold text-slate-100">{formatDuration(campaign.duration_seconds, t)}</span></p>
              <p className="mt-1">{t('whaleHub.matchedValue')}: <span className="font-semibold text-slate-100">{formatCompactMoney(campaign.total_matched_value, localeTag)} VND</span></p>
              <p className="mt-1">{t('whaleHub.serverTime')}: <span className="font-semibold text-slate-100">{formatTime(campaign.last_event_at, formatDateTimeFn)}</span></p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('whaleHub.eventTimeline')}</p>
              <div className="mt-3 max-h-[44vh] space-y-2 overflow-auto pr-1">
                {(campaign.events || []).map((event) => (
                  <div key={event.event_id || `${event.symbol}-${event.ts}`} className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{event.symbol} · {getCampaignSideLabel(event.side, t)}</span>
                      <span className="text-slate-500">{formatTime(event.ts, formatDateTimeFn)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>{t('whaleHub.matchedValue')}: {formatCompactMoney(event.matched_value, localeTag)} VND</span>
                      <span>{t('whaleHub.displayScore')}: {event.display_score ?? '—'}</span>
                      <span>{t('whaleHub.source')}: {event.source || t('whaleHub.sourceUnknown')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('whaleHub.confidenceBreakdown')}</p>
              <p className="mt-2">{t('whaleHub.campaignStrength')}: <span className="font-semibold text-cyan-300">{campaign.campaign_strength ?? '—'}</span></p>
              <p className="mt-1">{t('whaleHub.avgEventScore')}: <span className="font-semibold text-slate-100">{campaign.avg_event_score ?? '—'}</span></p>
              <p className="mt-1">{t('whaleHub.eventCount')}: <span className="font-semibold text-slate-100">{campaign.event_count ?? 0}</span></p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('whaleHub.sourceMix')}</p>
              <div className="mt-2 space-y-1.5">
                {Object.entries(campaign.source_mix || {}).length === 0 ? (
                  <p className="text-slate-500">{t('whaleHub.sourceUnknown')}</p>
                ) : (
                  Object.entries(campaign.source_mix || {}).map(([sourceKey, count]) => (
                    <div key={sourceKey} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5">
                      <span>{sourceKey}</span>
                      <span className="font-semibold text-slate-100">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SymbolInvestigationPanel({ selectedSymbol, onClose, t, localeTag, formatDateTimeFn }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('created_at');
  const [window, setWindow] = useState('5d');

  const loadData = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    setError('');
    try {
      const response = await getSymbolInvestigation(selectedSymbol, { window, sort });
      setData(response.data || {});
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleHub.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, window, sort, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!selectedSymbol) return null;

  const investigation = data || {};
  const campaigns = investigation.correlated_campaigns || [];
  const signals = investigation.correlated_signals || [];
  const groupedTimeline = investigation.grouped_timeline || [];
  const coObsSummary = investigation.co_observation_summary || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-label">{t('whaleHub.symbolInvestigation')}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">{selectedSymbol}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
        >
          {t('whaleHub.closeDetail')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('whaleHub.window')}</label>
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="5d">5 Days</option>
            <option value="1h">1 Hour</option>
            <option value="session">Session</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('whaleHub.sort')}</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="created_at">{t('whaleHub.latest')}</option>
            <option value="correlation_strength">{t('whaleHub.strength')}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-center text-slate-400">{t('common.loading')}</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-800/60 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">
                {t('whaleHub.campaigns')} ({campaigns.length})
              </p>
              <div className="space-y-2">
                {campaigns.length === 0 ? (
                  <div className="text-xs text-slate-500">{t('whaleHub.noEvents')}</div>
                ) : (
                  campaigns.map((item) => (
                    <div key={item.event_id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-100">{item.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.side === 'BUY' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
                        }`}>
                          {item.side}
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {t('whaleHub.matchedValue')}: {formatCompactMoney(item.matched_value, localeTag)} VND
                      </p>
                      <p className="text-slate-500 mt-1">{formatTime(item.created_at, formatDateTimeFn)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">
                {t('whaleHub.darkFlowSignals')} ({signals.length})
              </p>
              <div className="space-y-2">
                {signals.length === 0 ? (
                  <div className="text-xs text-slate-500">{t('whaleHub.noEvents')}</div>
                ) : (
                  signals.map((item) => (
                    <div key={item.signal_id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-100">{item.signal_type}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-900/60 text-cyan-300`}>
                          {(item.strength || 0).toFixed(0)}
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {t('whaleHub.confidence')}: {item.confidence}
                      </p>
                      <p className="text-slate-500 mt-1">{formatTime(item.created_at, formatDateTimeFn)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {groupedTimeline.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">
                {t('whaleHub.coObservationTimeline')}
                {coObsSummary.co_observation_count > 0 && (
                  <span className="ml-2 rounded-full bg-cyan-900/60 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 normal-case tracking-normal">
                    {coObsSummary.co_observation_count} co-observed
                  </span>
                )}
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {groupedTimeline.map((bucket, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      bucket.has_co_observation
                        ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200'
                        : 'border-slate-800 bg-slate-950/50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px]">{formatTime(bucket.bucket_start, formatDateTimeFn)}</span>
                      {bucket.has_co_observation && (
                        <span className="rounded-full bg-cyan-800/60 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                          {t('whaleHub.coObservationBucket')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px]">
                      {bucket.whale_count ?? 0} whale · {bucket.signal_count ?? 0} dark flow
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function WhaleAlertsHub() {
  const { ability, userPlan } = usePortfolio();
  const { t, localeTag, formatDateTime } = useI18n();
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [watchlistGroups, setWatchlistGroups] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [aggregateFeed, setAggregateFeed] = useState([]);
  const [aggregateCursor, setAggregateCursor] = useState(null);
  const [aggregateHasMore, setAggregateHasMore] = useState(false);
  const [aggregateLoadingMore, setAggregateLoadingMore] = useState(false);
  const [aggregateEntitlements, setAggregateEntitlements] = useState(null);
  const [aggregateFilters, setAggregateFilters] = useState(null);
  const [aggregateSource, setAggregateSource] = useState('');
  const [aggregateServerTime, setAggregateServerTime] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignHasMore, setCampaignHasMore] = useState(false);
  const [campaignCursor, setCampaignCursor] = useState(null);
  const [campaignLoadingMore, setCampaignLoadingMore] = useState(false);
  const [campaignSort, setCampaignSort] = useState('strength');
  const [campaignSideFilter, setCampaignSideFilter] = useState('all');
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('all');
  const [campaignMinStrength, setCampaignMinStrength] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [symbolStatsMap, setSymbolStatsMap] = useState({});
  const [aggregateTotalSignals, setAggregateTotalSignals] = useState(0);
  const [feedSort, setFeedSort] = useState('ts');
  const [feedWindow, setFeedWindow] = useState('session');
  const [selectedFeedScope, setSelectedFeedScope] = useState('tracked');
  const [activeBoardTab, setActiveBoardTab] = useState('tape');
  const [selectedSymbolInvestigation, setSelectedSymbolInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canReadAdvisory = ability.can('read', 'WhaleAdvisory');

  const activeWatchlistGroupId = useMemo(() => {
    if (!selectedFeedScope.startsWith('watchlist:')) return null;
    const parsedId = Number(selectedFeedScope.split(':')[1]);
    return Number.isFinite(parsedId) ? parsedId : null;
  }, [selectedFeedScope]);

  const activeWatchlistGroup = useMemo(
    () => watchlistGroups.find((group) => group.id === activeWatchlistGroupId) || null,
    [activeWatchlistGroupId, watchlistGroups]
  );

  const loadAggregateFeed = useCallback(async ({
    cursor = null,
    append = false,
    sort = feedSort,
    window = feedWindow,
    scope = selectedFeedScope,
  } = {}) => {
    const watchlistGroupId = scope.startsWith('watchlist:') ? Number(scope.split(':')[1]) : null;
    const response = await getAggregateWhaleFeed({
      cursor,
      sort,
      window,
      limit: 12,
      watchlistGroupIds: Number.isFinite(watchlistGroupId) ? [watchlistGroupId] : undefined,
    });
    const payload = response.data || {};
    const nextItems = payload.results || [];

    setAggregateFeed((prev) => (append
      ? mergeUniqueAggregateEvents(prev, nextItems)
      : mergeUniqueAggregateEvents([], nextItems)));
    setAggregateCursor(payload.next_cursor || null);
    setAggregateHasMore(Boolean(payload.has_more));
    setAggregateEntitlements(payload.entitlements || null);
    setAggregateFilters(payload.filters || null);
    setAggregateSource(payload.source || '');
    setAggregateServerTime(payload.server_time || '');
  }, [feedSort, feedWindow, selectedFeedScope]);

  const loadCampaigns = useCallback(async ({
    cursor = null,
    append = false,
    window = feedWindow,
    scope = selectedFeedScope,
    sort = campaignSort,
  } = {}) => {
    const watchlistGroupId = scope.startsWith('watchlist:') ? Number(scope.split(':')[1]) : null;
    const response = await getWhaleCampaigns({
      window,
      cursor,
      campaignLimit: 18,
      campaignSort: sort,
      watchlistGroupIds: Number.isFinite(watchlistGroupId) ? [watchlistGroupId] : undefined,
    });
    const payload = response.data || {};
    const nextItems = payload.results || [];
    setCampaigns((prev) => (append ? [...prev, ...nextItems] : nextItems));
    setCampaignHasMore(Boolean(payload.has_more));
    setCampaignCursor(payload.next_cursor || null);
  }, [campaignSort, feedWindow, selectedFeedScope]);

  const loadSymbolStatsMap = useCallback(async ({
    window = feedWindow,
    scope = selectedFeedScope,
  } = {}) => {
    const watchlistGroupId = scope.startsWith('watchlist:') ? Number(scope.split(':')[1]) : null;
    const rows = [];
    const seenEventKeys = new Set();
    const seenCursors = new Set();
    let cursor = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 20;

    while (hasMore && pageCount < maxPages) {
      const response = await getAggregateWhaleFeed({
        cursor,
        sort: 'ts',
        window,
        limit: 50,
        watchlistGroupIds: Number.isFinite(watchlistGroupId) ? [watchlistGroupId] : undefined,
      });
      const payload = response.data || {};
      const pageRows = payload.results || [];

      for (const item of pageRows) {
        const eventKey = item.event_id || [
          item.id,
          item.symbol,
          item.ts,
          item.side,
          item.matched_value,
        ].join(':');
        if (seenEventKeys.has(eventKey)) continue;
        seenEventKeys.add(eventKey);
        rows.push(item);
      }

      const nextCursor = payload.next_cursor || null;
      hasMore = Boolean(payload.has_more && nextCursor);
      if (!hasMore) break;
      if (seenCursors.has(nextCursor)) break;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      pageCount += 1;
    }

    const statsMap = buildSymbolStatsFromFeed(rows);
    const totalSignals = Object.values(statsMap).reduce((sum, entry) => sum + Number(entry?.count || 0), 0);
    return {
      statsMap,
      totalSignals,
    };
  }, [feedWindow, selectedFeedScope]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const requests = [
        getTrackedSymbols(),
        getWatchlistGroups(),
        loadAggregateFeed({ cursor: null, append: false, sort: feedSort, window: feedWindow, scope: selectedFeedScope }),
        loadCampaigns({ cursor: null, append: false, window: feedWindow, scope: selectedFeedScope, sort: campaignSort }),
        loadSymbolStatsMap({ window: feedWindow, scope: selectedFeedScope }),
      ];

      if (canReadAdvisory) {
        requests.push(getWhaleAdvisories());
      }

      const [trackedResult, watchlistGroupsResult, _aggregateResult, _campaignResult, symbolStatsResult, advisoryResult] = await Promise.all(requests);
      setTrackedSymbols(trackedResult.data || []);
      setWatchlistGroups(watchlistGroupsResult.data || []);
      setSymbolStatsMap(symbolStatsResult?.statsMap || {});
      setAggregateTotalSignals(Number(symbolStatsResult?.totalSignals || 0));
      setAdvisories(canReadAdvisory ? (advisoryResult.data || []).slice(0, 6) : []);
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleHub.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [canReadAdvisory, campaignSort, feedSort, feedWindow, loadAggregateFeed, loadCampaigns, loadSymbolStatsMap, selectedFeedScope, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedCampaign(null);
    setCampaignCursor(null);
  }, [campaignSort, feedWindow, selectedFeedScope]);

  const symbolShortcuts = useMemo(() => buildTrackedSymbolBuckets(trackedSymbols), [trackedSymbols]);

  const aggregateTotalCount = useMemo(() => (
    Number(aggregateTotalSignals || 0)
  ), [aggregateTotalSignals]);

  const aggregateDisplayedCount = useMemo(() => (
    (aggregateFeed || []).filter((item) => isCountableWhaleOrder(item)).length
  ), [aggregateFeed]);

  const handleLoadMore = useCallback(async () => {
    if (!aggregateHasMore || !aggregateCursor) return;

    setAggregateLoadingMore(true);
    try {
      await loadAggregateFeed({ cursor: aggregateCursor, append: true, sort: feedSort, window: feedWindow, scope: selectedFeedScope });
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleHub.loadMoreFailed'));
    } finally {
      setAggregateLoadingMore(false);
    }
  }, [aggregateCursor, aggregateHasMore, feedSort, feedWindow, loadAggregateFeed, selectedFeedScope, t]);

  const handleHideLess = useCallback(async () => {
    try {
      await loadAggregateFeed({ cursor: null, append: false, sort: feedSort, window: feedWindow, scope: selectedFeedScope });
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleHub.loadFailed'));
    }
  }, [feedSort, feedWindow, loadAggregateFeed, selectedFeedScope, t]);

  const handleSortChange = useCallback((nextSort) => {
    if (nextSort === feedSort) return;
    setFeedSort(nextSort);
  }, [feedSort]);

  const handleLoadMoreCampaigns = useCallback(async () => {
    if (!campaignHasMore || !campaignCursor) return;

    setCampaignLoadingMore(true);
    try {
      await loadCampaigns({
        cursor: campaignCursor,
        append: true,
        window: feedWindow,
        scope: selectedFeedScope,
        sort: campaignSort,
      });
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleHub.loadMoreFailed'));
    } finally {
      setCampaignLoadingMore(false);
    }
  }, [campaignCursor, campaignHasMore, campaignSort, feedWindow, loadCampaigns, selectedFeedScope, t]);

  const scopeLabel = useMemo(() => {
    if (aggregateFilters?.scope === 'watchlist' && activeWatchlistGroup) {
      return `watchlist: ${activeWatchlistGroup.name}`;
    }
    return t('whaleHub.trackedSymbols');
  }, [activeWatchlistGroup, aggregateFilters?.scope, t]);

  const aggregateSourceMeta = useMemo(() => getAggregateSourceMeta(aggregateSource, t), [aggregateSource, t]);

  const filteredCampaigns = useMemo(() => {
    return (campaigns || []).filter((item) => {
      const side = String(item.side_bias || '').toLowerCase();
      const type = String(item.campaign_type || '').toLowerCase();
      const strength = Number(item.campaign_strength || 0);
      if (campaignSideFilter !== 'all' && side !== campaignSideFilter) return false;
      if (campaignTypeFilter !== 'all' && type !== campaignTypeFilter) return false;
      if (strength < Number(campaignMinStrength || 0)) return false;
      return true;
    });
  }, [campaignMinStrength, campaignSideFilter, campaignTypeFilter, campaigns]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 xl:px-5">
      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label">{t('whaleHub.radarHub')}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">{t('whaleHub.workspaceTitle')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              {t('whaleHub.workspaceDescription')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-cyan-900/60 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200">
              {t('whaleHub.currentPlan', { plan: userPlan || 'free' })}
            </div>
            <button type="button" onClick={fetchData} className="btn-primary">
              {t('whaleHub.refresh')}
            </button>
          </div>
        </div>
      </section>

      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label">{t('whaleHub.aggregateFeed')}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">{t('whaleHub.liveBoard')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {t('whaleHub.liveBoardDescription')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
              <button
                type="button"
                onClick={() => setActiveBoardTab('tape')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  activeBoardTab === 'tape' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {t('whaleHub.tabLiveTape')}
              </button>
              <button
                type="button"
                onClick={() => setActiveBoardTab('campaigns')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  activeBoardTab === 'campaigns' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {t('whaleHub.tabCampaigns')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveBoardTab('investigation');
                  // Pre-select first symbol if available
                  if (trackedSymbols.length > 0 && !selectedSymbolInvestigation) {
                    setSelectedSymbolInvestigation(trackedSymbols[0].symbol);
                  }
                }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  activeBoardTab === 'investigation' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {t('whaleHub.tabSymbolInvestigation')}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-700/60 bg-slate-900 px-3 py-2 shadow-[0_0_0_1px_rgba(8,145,178,0.15)]">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{t('whaleHub.scope')}</span>
              <select
                value={selectedFeedScope}
                onChange={(event) => setSelectedFeedScope(event.target.value)}
                className="min-w-[190px] rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-100 outline-none transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                style={{ colorScheme: 'dark' }}
              >
                <option value="tracked">{t('whaleHub.trackedSymbols')}</option>
                {watchlistGroups.map((group) => (
                  <option key={group.id} value={`watchlist:${group.id}`}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
              {[
                ['5m', t('whaleHub.window5m')],
                ['15m', t('whaleHub.window15m')],
                ['1h', t('whaleHub.window1h')],
                ['session', t('whaleHub.windowSession')],
                ['5d', t('whaleHub.window5d')],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFeedWindow(value)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    feedWindow === value ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activeBoardTab === 'tape' ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
                <button
                  type="button"
                  onClick={() => handleSortChange('ts')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    feedSort === 'ts' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {t('whaleHub.latest')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSortChange('matched_value')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    feedSort === 'matched_value' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {t('whaleHub.largestValue')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
                {[
                  ['strength', t('whaleHub.campaignSortStrength')],
                  ['latest', t('whaleHub.campaignSortLatest')],
                  ['value', t('whaleHub.campaignSortValue')],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCampaignSort(value)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      campaignSort === value ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            {t('whaleHub.scope')}: {loading ? t('common.loading') : scopeLabel}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            {t('whaleHub.window')}: {t(`whaleHub.windowLabel.${feedWindow}`)}
          </div>
          <div className={`rounded-full border px-3 py-1.5 ${aggregateSourceMeta.tone}`}>
            {t('whaleHub.feedSource')}: {loading ? t('common.loading') : aggregateSourceMeta.label}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            {t('whaleHub.advisorySummary')}: {aggregateEntitlements?.can_read_whale_advisory ? t('whaleHub.planProPlus') : t('whaleHub.locked')}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            {t('whaleHub.advisoryDetail')}: {aggregateEntitlements?.can_read_whale_advisory_detail ? t('whaleHub.planPremiumPlus') : t('whaleHub.locked')}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            {t('whaleHub.weights')}: {aggregateFilters?.scope ? aggregateFeed[0]?.weights_version || t('whaleHub.defaultWeightsVersion') : t('common.loading')}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            {t('whaleHub.serverTime')}: {aggregateServerTime ? formatTime(aggregateServerTime, formatDateTime) : t('common.loading')}
          </div>
        </div>

        {!loading && (
          <div className="mt-3 text-xs text-slate-500">
            {aggregateSourceMeta.description}
          </div>
        )}

        {loading ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-900" />
            ))}
          </div>
        ) : activeBoardTab === 'investigation' ? (
          <div className="mt-4">
            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-2">{t('whaleHub.selectSymbol')}</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                {buildTrackedSymbolBuckets(trackedSymbols).map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => setSelectedSymbolInvestigation(symbol)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      selectedSymbolInvestigation === symbol
                        ? 'border-cyan-500 bg-cyan-900/60 text-cyan-100'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
            {selectedSymbolInvestigation && (
              <SymbolInvestigationPanel
                selectedSymbol={selectedSymbolInvestigation}
                onClose={() => setSelectedSymbolInvestigation(null)}
                t={t}
                localeTag={localeTag}
                formatDateTimeFn={formatDateTime}
              />
            )}
          </div>
        ) : activeBoardTab === 'campaigns' ? (
          <>
            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 lg:grid-cols-4">
              <label className="text-xs text-slate-400">
                {t('whaleHub.filterSide')}
                <select
                  value={campaignSideFilter}
                  onChange={(event) => setCampaignSideFilter(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                >
                  <option value="all">{t('whaleHub.filterAll')}</option>
                  <option value="buy">{t('whaleHub.bigBuy')}</option>
                  <option value="sell">{t('whaleHub.bigSell')}</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                {t('whaleHub.filterType')}
                <select
                  value={campaignTypeFilter}
                  onChange={(event) => setCampaignTypeFilter(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                >
                  <option value="all">{t('whaleHub.filterAll')}</option>
                  <option value="accumulation">{t('whaleHub.campaignTypeAccumulation')}</option>
                  <option value="distribution">{t('whaleHub.campaignTypeDistribution')}</option>
                  <option value="mixed">{t('whaleHub.campaignTypeMixed')}</option>
                </select>
              </label>
              <label className="text-xs text-slate-400 lg:col-span-2">
                {t('whaleHub.filterMinStrength')}: {campaignMinStrength}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={campaignMinStrength}
                  onChange={(event) => setCampaignMinStrength(Number(event.target.value || 0))}
                  className="mt-2 w-full"
                />
              </label>
            </div>

            {filteredCampaigns.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
                {t('whaleHub.noCampaigns')}
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {filteredCampaigns.map((item) => (
                    <CampaignCard
                      key={item.campaign_id}
                      item={item}
                      t={t}
                      localeTag={localeTag}
                      formatDateTimeFn={formatDateTime}
                      onOpenDetail={setSelectedCampaign}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{t('whaleHub.showingCampaigns', { count: filteredCampaigns.length })}</span>
                  {campaignHasMore ? (
                    <button
                      type="button"
                      onClick={handleLoadMoreCampaigns}
                      disabled={campaignLoadingMore}
                      className="btn-secondary"
                    >
                      {campaignLoadingMore ? t('whaleHub.loadingMore') : t('whaleHub.loadMoreCampaigns')}
                    </button>
                  ) : (
                    <span>{t('whaleHub.campaignAllLoaded')}</span>
                  )}
                </div>
              </>
            )}
          </>
        ) : aggregateFeed.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
            {t('whaleHub.noEvents')}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {aggregateFeed.map((item) => (
                <AggregateFeedCard
                  key={buildAggregateEventKey(item)}
                  item={item}
                  t={t}
                  localeTag={localeTag}
                  formatDateTimeFn={formatDateTime}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {t('whaleHub.showingSignals', {
                  count: aggregateDisplayedCount,
                  totalCount: aggregateTotalCount,
                  source: aggregateSourceMeta.label.toLowerCase(),
                })}
                <span className="ml-2 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  {t('whaleHub.countBasisLargeOrders')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {aggregateFeed.length > 12 && (
                  <button type="button" onClick={handleHideLess} className="btn-secondary">
                    {t('whaleHub.hideLess')}
                  </button>
                )}
                {aggregateHasMore && (
                  <button type="button" onClick={handleLoadMore} disabled={aggregateLoadingMore} className="btn-secondary">
                    {aggregateLoadingMore ? t('whaleHub.loadingMore') : t('whaleHub.loadMore')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 px-5 py-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="card-section px-5 py-4">
          <p className="text-label">{t('whaleHub.shortcutBySymbol')}</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">{t('whaleHub.trackedSymbolsTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {t('whaleHub.trackedSymbolsDesc')}
          </p>

          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-900" />
              ))}
            </div>
          ) : symbolShortcuts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
              {t('whaleHub.noTrackedShortcuts')}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {symbolShortcuts
                .filter((symbol) => (symbolStatsMap[symbol]?.count ?? 0) > 0)
                .map((symbol) => (
                  <TrackedSymbolCard
                    key={symbol}
                    symbol={symbol}
                    stats={symbolStatsMap[symbol]}
                    t={t}
                    localeTag={localeTag}
                    formatDateTimeFn={formatDateTime}
                  />
                ))}
            </div>
          )}

        </article>

        <article className="card-section px-5 py-4">
          <p className="text-label">{t('whaleHub.featureScope')}</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">{t('whaleHub.featureTitle')}</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              {t('whaleHub.feature1')}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              {t('whaleHub.feature2')}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              {t('whaleHub.feature3')}
            </div>
          </div>
        </article>
      </section>

      <CampaignDetailModal
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        t={t}
        localeTag={localeTag}
        formatDateTimeFn={formatDateTime}
      />

    </div>
  );
}