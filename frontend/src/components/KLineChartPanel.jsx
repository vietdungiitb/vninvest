import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { init as klineChartInit, dispose as klineChartDispose, ActionType, IndicatorSeries, LineType, OverlayMode, PolygonType, TooltipShowRule, registerIndicator, registerOverlay } from 'klinecharts';
import { useI18n } from '../context/LangContext';
import { toCanonicalMinute } from '../utils/whaleTimeAdapter';
import {
  buildAutoFocusZoomScales,
  buildWhaleAnalyticsBucketMinuteKeys,
  normalizeTradeDateKey,
  resolveFlowBucketForCandle,
  resolveMatchingWhaleCandleMinuteKey,
  resolveTradeDateIndexRange,
} from '../utils/whaleKlineAlignment';

function buildFlowBucketLookup(viewModel, flowTimeframe) {
  const lookup = new Map();

  (Array.isArray(viewModel?.buckets) ? viewModel.buckets : []).forEach((bucket) => {
    const minuteKey = toCanonicalMinute(bucket?.ts ?? bucket?.bucket_ts ?? bucket?.timestamp ?? bucket?.time ?? bucket?.date);
    if (minuteKey == null) {
      return;
    }

    buildWhaleAnalyticsBucketMinuteKeys(minuteKey, flowTimeframe).forEach((candidateMinuteKey) => {
      if (!lookup.has(candidateMinuteKey)) {
        lookup.set(candidateMinuteKey, bucket);
      }
    });
  });

  return lookup;
}

function formatTooltipValue(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }

  return Number(value).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatTooltipTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined || Number.isNaN(Number(timestamp))) {
    return '--';
  }

  return new Date(Number(timestamp)).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function normalizeWhaleSignalSide(signal) {
  const rawSide = String(signal?.side ?? signal?.signal_type ?? signal?.direction ?? '').trim().toLowerCase();
  if (rawSide.includes('buy')) {
    return 'buy';
  }
  if (rawSide.includes('sell')) {
    return 'sell';
  }
  return 'neutral';
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, Number(value)));
}

function resolveHeatmapMetric(bucket, mode = 'net') {
  const normalizedMode = String(mode || 'net').trim().toLowerCase();
  if (normalizedMode === 'off') {
    return null;
  }

  if (normalizedMode === 'buy') {
    const buyHeat = Number(bucket?.buyHeat);
    if (!Number.isFinite(buyHeat) || buyHeat <= 0) {
      return null;
    }
    return {
      kind: 'buy',
      intensity: buyHeat,
      signedValue: buyHeat,
    };
  }

  if (normalizedMode === 'sell') {
    const sellHeat = Number(bucket?.sellHeat);
    if (!Number.isFinite(sellHeat) || sellHeat <= 0) {
      return null;
    }
    return {
      kind: 'sell',
      intensity: sellHeat,
      signedValue: -sellHeat,
    };
  }

  const netHeat = Number(bucket?.netHeat);
  const whaleScore = Number(bucket?.whaleScore);
  const intensity = Math.max(
    Number.isFinite(netHeat) ? Math.abs(netHeat) : 0,
    Number.isFinite(whaleScore) ? whaleScore : 0,
  );
  if (intensity <= 0) {
    return null;
  }

  return {
    kind: Math.abs(netHeat) < 12 && whaleScore >= 45 ? 'whale' : netHeat >= 0 ? 'buy' : 'sell',
    intensity,
    signedValue: Number.isFinite(netHeat) ? netHeat : 0,
  };
}

function buildHeatmapBandColor(bucket, mode = 'net') {
  const metric = resolveHeatmapMetric(bucket, mode);
  if (!metric) {
    return null;
  }

  const magnitude = clamp(metric.intensity, 0, 100) / 100;
  const alpha = (0.08 + magnitude * 0.26).toFixed(3);

  if (metric.kind === 'whale') {
    return `rgba(245, 158, 11, ${alpha})`;
  }
  if (metric.kind === 'buy') {
    return `rgba(34, 197, 94, ${alpha})`;
  }
  return `rgba(244, 63, 94, ${alpha})`;
}

function resolveQualityBadgeTone(qualityState) {
  const normalizedState = String(qualityState || '').trim().toUpperCase();
  if (normalizedState === 'READY') {
    return 'bg-[#052e2b] text-[#5eead4] border border-[#115e59]';
  }
  if (normalizedState.startsWith('DEGRADED')) {
    return 'bg-[#3f1d0f] text-[#fdba74] border border-[#9a3412]';
  }
  return 'bg-[#1f2937] text-[#cbd5e1] border border-[#334155]';
}

function buildVisibleWhaleSharkMarkers({ candles = [], signals = [], visibleRange = null, signalTimeframe = '15m' }) {
  if (!Array.isArray(candles) || !candles.length || !Array.isArray(signals) || !signals.length) {
    return [];
  }

  const candleByMinute = new Map();
  const candleMinuteKeys = new Set();
  candles.forEach((candle) => {
    const minuteKey = toCanonicalMinute(candle?.timestamp ?? candle?.date ?? candle?.tradeDate);
    const candleTimestamp = Number(candle?.timestamp);
    if (minuteKey == null || !Number.isFinite(candleTimestamp)) {
      return;
    }
    const normalizedMinuteKey = String(minuteKey);
    candleByMinute.set(normalizedMinuteKey, candle);
    candleMinuteKeys.add(normalizedMinuteKey);
  });

  const visibleFrom = Number(visibleRange?.from_ts);
  const visibleTo = Number(visibleRange?.to_ts);
  const hasVisibleRange = Number.isFinite(visibleFrom) && Number.isFinite(visibleTo);
  const minVisibleTs = hasVisibleRange ? Math.min(visibleFrom, visibleTo) : null;
  const maxVisibleTs = hasVisibleRange ? Math.max(visibleFrom, visibleTo) : null;

  const bestSignalByMinute = new Map();
  signals.forEach((signal) => {
    const minuteKey = toCanonicalMinute(signal?.ts ?? signal?.bucket_ts ?? signal?.timestamp ?? signal?.time ?? signal?.date);
    if (minuteKey == null) {
      return;
    }

    const matchedMinuteKey = resolveMatchingWhaleCandleMinuteKey(minuteKey, candleMinuteKeys, signalTimeframe);
    const candle = matchedMinuteKey == null ? null : candleByMinute.get(matchedMinuteKey);
    if (!candle) {
      return;
    }

    const candleTimestamp = Number(candle?.timestamp);
    if (!Number.isFinite(candleTimestamp)) {
      return;
    }

    if (minVisibleTs != null && candleTimestamp < minVisibleTs) {
      return;
    }

    if (maxVisibleTs != null && candleTimestamp > maxVisibleTs) {
      return;
    }

    const rawStrength = Number(signal?.matched_value ?? signal?.value ?? signal?.strength ?? 0);
    const strength = Number.isFinite(rawStrength) ? Math.abs(rawStrength) : 0;
    if (!strength) {
      return;
    }

    const side = normalizeWhaleSignalSide(signal);
    const bestExisting = bestSignalByMinute.get(String(minuteKey));
    if (!bestExisting || strength > bestExisting.strength) {
      bestSignalByMinute.set(String(minuteKey), {
        minuteKey: String(minuteKey),
        candle,
        candleTimestamp,
        strength,
        side,
      });
    }
  });

  const rankedSignals = Array.from(bestSignalByMinute.values());
  if (!rankedSignals.length) {
    return [];
  }

  const targetCount = Math.max(1, Math.ceil(rankedSignals.length * 0.1));
  return rankedSignals
    .sort((left, right) => right.strength - left.strength || left.candleTimestamp - right.candleTimestamp)
    .slice(0, targetCount)
    .sort((left, right) => left.candleTimestamp - right.candleTimestamp)
    .map((signal) => {
      const isBuy = signal.side === 'buy';
      const referencePrice = Number(isBuy ? signal.candle?.low : signal.candle?.high);
      const fallbackPrice = Number(signal.candle?.close ?? signal.candle?.open ?? 0);
      const adjustedPrice = Number.isFinite(referencePrice)
        ? referencePrice * (isBuy ? 0.998 : 1.002)
        : fallbackPrice;

      return {
        id: `shark_${signal.minuteKey}_${signal.side}_${signal.candleTimestamp}`,
        timestamp: signal.candleTimestamp,
        value: Number.isFinite(adjustedPrice) ? adjustedPrice : fallbackPrice,
        label: isBuy ? '🟢🦈' : '🔴🦈',
      };
    });
}

function buildVisibleHeatmapBands({ candles = [], flowBucketLookup, visibleRange = null, heatmapMode = 'net' }) {
  if (!Array.isArray(candles) || !candles.length || !(flowBucketLookup instanceof Map) || !flowBucketLookup.size) {
    return [];
  }

  if (String(heatmapMode || 'net').trim().toLowerCase() === 'off') {
    return [];
  }

  const visibleFrom = Number(visibleRange?.from_ts);
  const visibleTo = Number(visibleRange?.to_ts);
  const hasVisibleRange = Number.isFinite(visibleFrom) && Number.isFinite(visibleTo);
  const minVisibleTs = hasVisibleRange ? Math.min(visibleFrom, visibleTo) : null;
  const maxVisibleTs = hasVisibleRange ? Math.max(visibleFrom, visibleTo) : null;

  return candles.flatMap((candle, index) => {
    const candleTimestamp = Number(candle?.timestamp);
    if (!Number.isFinite(candleTimestamp)) {
      return [];
    }
    if (minVisibleTs != null && candleTimestamp < minVisibleTs) {
      return [];
    }
    if (maxVisibleTs != null && candleTimestamp > maxVisibleTs) {
      return [];
    }

    const minuteKey = toCanonicalMinute(candleTimestamp);
    const bucket = minuteKey == null ? null : flowBucketLookup.get(String(minuteKey));
    if (!bucket) {
      return [];
    }

    const color = buildHeatmapBandColor(bucket, heatmapMode);
    if (!color) {
      return [];
    }

    const previousTimestamp = Number(candles[index - 1]?.timestamp);
    const nextTimestamp = Number(candles[index + 1]?.timestamp);
    const leftSpacing = Number.isFinite(previousTimestamp)
      ? Math.max((candleTimestamp - previousTimestamp) / 2, 1000)
      : Number.isFinite(nextTimestamp)
        ? Math.max((nextTimestamp - candleTimestamp) / 2, 1000)
        : 30000;
    const rightSpacing = Number.isFinite(nextTimestamp)
      ? Math.max((nextTimestamp - candleTimestamp) / 2, 1000)
      : Number.isFinite(previousTimestamp)
        ? Math.max((candleTimestamp - previousTimestamp) / 2, 1000)
        : 30000;
    const anchorValue = Number(candle?.close ?? candle?.open ?? candle?.high ?? candle?.low ?? 0);

    return [{
      id: `heat_${minuteKey}`,
      startTimestamp: candleTimestamp - leftSpacing,
      endTimestamp: candleTimestamp + rightSpacing,
      anchorValue,
      color,
    }];
  });
}

const HEATMAP_OVERLAY_NAME = 'whaleHeatmapBand';
let heatmapOverlayRegistered = false;
const FLOW_CUSTOM_INDICATOR_IDS = ['FLOW_CVD', 'FLOW_STRENGTH'];

function ensureHeatmapOverlayRegistered() {
  if (heatmapOverlayRegistered) {
    return;
  }

  registerOverlay({
    name: HEATMAP_OVERLAY_NAME,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return [];
      }

      const leftX = Math.min(coordinates[0].x, coordinates[1].x);
      const rightX = Math.max(coordinates[0].x, coordinates[1].x);
      const color = overlay?.extendData?.color || 'rgba(15, 23, 42, 0.14)';

      return [{
        type: 'rect',
        attrs: { x: leftX, y: 0, width: Math.max(2, rightX - leftX), height: bounding.height },
        styles: {
          style: PolygonType.Fill,
          color,
          borderColor: color,
          borderSize: 0,
          borderStyle: LineType.Solid,
          borderDashedValue: [0, 0],
          borderRadius: 0,
        },
        ignoreEvent: true,
      }];
    },
  });

  heatmapOverlayRegistered = true;
}

const CHART_RIGHT_OFFSET_DISTANCE = 20;

export default function KLineChartPanel({ data, activePeriod, activeTimeframe: activeTimeframeProp, onPeriodChange, onTimeframeChange, onVisibleRangeChange, onActiveIndicatorsChange, onSessionChange, flowData = null, whaleSignals = [] }) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const lastAutoFocusedTradeDateRef = useRef('');
  const indicatorPaneMapRef = useRef({});
  const heatmapOverlayIdsRef = useRef([]);
  const heatmapOverlaySignatureRef = useRef('');
  const sharkOverlayIdsRef = useRef([]);
  const sharkMarkerSignatureRef = useRef('');
  const lastVisibleRangeRef = useRef({ from_ts: null, to_ts: null });
  const [activeIndicators, setActiveIndicators] = useState({ MA: true, VOL: true, MACD: false, FLOW_CVD: true, FLOW_STRENGTH: true });
  const [heatmapMode, setHeatmapMode] = useState('net');
  const [fullScreen, setFullScreen] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(true);

  const MAIN_PANE_INDICATORS = new Set(['MA', 'EMA', 'BOLL', 'SAR']);
  const SUB_PANE_CANDIDATES = ['volume_pane', 'indicator_pane', 'whale_flow_cvd_pane', 'whale_flow_strength_pane'];

  const AVAILABLE_INDICATORS = [
    { id: 'VOL', name: 'Volume', default: true },
    { id: 'MA', name: t('stockDetail.indicatorMovingAverage'), default: true },
    { id: 'EMA', name: t('stockDetail.indicatorEma') },
    { id: 'BOLL', name: t('stockDetail.indicatorBollingerBands') },
    { id: 'MACD', name: t('stockDetail.indicatorMacd') },
    { id: 'RSI', name: t('stockDetail.indicatorRsi') },
    { id: 'KDJ', name: t('stockDetail.indicatorKdj') },
    { id: 'STOCH', name: t('stockDetail.indicatorStochastic') },
    { id: 'SAR', name: t('stockDetail.indicatorParabolicSar') },
    { id: 'ATR', name: t('stockDetail.indicatorAtr') },
    { id: 'OBV', name: t('stockDetail.indicatorObv') },
  ];

  const TIMEFRAMES = [
    { id: '1m', days: 5 },
    { id: '5m', days: 20 },
    { id: '15m', days: 60 },
    { id: '1H', days: 180 },
    { id: 'D', days: 365 },
    { id: 'W', days: 1095 },
    { id: 'M', days: 1825 },
    { id: 'Y', days: 3650 },
  ];

  const [activeTimeframe, setActiveTimeframe] = useState(() => {
    if (activeTimeframeProp && TIMEFRAMES.some((tf) => tf.id === activeTimeframeProp)) {
      return activeTimeframeProp;
    }
    const match = TIMEFRAMES.find((tf) => tf.days === activePeriod);
    return match ? match.id : '1H';
  });

  const deepFlowPaneControls = [
    {
      id: 'FLOW_CVD',
      labelOn: t('whaleAlertsDashboard.hideCvdPane', { defaultValue: 'Ẩn pane CVD' }),
      labelOff: t('whaleAlertsDashboard.showCvdPane', { defaultValue: 'Hiện pane CVD' }),
      title: t('whaleAlertsDashboard.flowCvdPaneTitle', { defaultValue: 'Pane CVD chuẩn hóa' }),
    },
    {
      id: 'FLOW_STRENGTH',
      labelOn: t('whaleAlertsDashboard.hideStrengthPane', { defaultValue: 'Ẩn pane sức mạnh' }),
      labelOff: t('whaleAlertsDashboard.showStrengthPane', { defaultValue: 'Hiện pane sức mạnh' }),
      title: t('whaleAlertsDashboard.flowStrengthPaneTitle', { defaultValue: 'Pane sức mạnh dòng tiền' }),
    },
  ];

  const flowViewModel = flowData?.view_model || null;
  const flowTimeframe = flowData?.timeframe_window?.timeframe || flowData?.timeframe || '15m';
  const flowSessionTradeDate = flowViewModel?.sessionContext?.selectedTradeDate || flowViewModel?.sessionContext?.defaultTradeDate || null;
  const flowBuckets = useMemo(() => (Array.isArray(flowViewModel?.buckets) ? flowViewModel.buckets : []), [flowViewModel]);
  const flowBucketLookup = useMemo(() => buildFlowBucketLookup(flowViewModel, flowTimeframe), [flowTimeframe, flowViewModel]);
  const qualityState = flowViewModel?.sessionContext?.qualityState || flowData?.session_context?.quality_state || 'UNKNOWN';
  const hasHeatmapData = Boolean(flowViewModel?.qualityFlags?.hasHeatmapData);
  const heatmapModes = useMemo(() => ([
    { id: 'off', label: t('whaleAlertsDashboard.heatmapModeOff', { defaultValue: 'Tắt' }) },
    { id: 'net', label: t('whaleAlertsDashboard.heatmapModeNet', { defaultValue: 'Net' }) },
    { id: 'buy', label: t('whaleAlertsDashboard.heatmapModeBuy', { defaultValue: 'Buy' }) },
    { id: 'sell', label: t('whaleAlertsDashboard.heatmapModeSell', { defaultValue: 'Sell' }) },
  ]), [t]);

  const whaleMarkerSignals = useMemo(() => {
    if (Array.isArray(flowViewModel?.buckets) && flowViewModel.buckets.some((bucket) => bucket?.hasMarker)) {
      return flowViewModel.buckets
        .filter((bucket) => bucket?.markerSide && Number.isFinite(Number(bucket?.markerScore ?? bucket?.markerMatchedValue)))
        .map((bucket) => ({
          ts: bucket?.bucket_ts ?? bucket?.ts,
          bucket_ts: bucket?.bucket_ts ?? null,
          matched_value: Number(bucket?.markerMatchedValue ?? bucket?.markerScore ?? 0),
          score: Number(bucket?.markerScore ?? 0),
          side: bucket?.markerSide,
        }));
    }

    if (!Array.isArray(whaleSignals) || !whaleSignals.length) {
      return [];
    }

    return whaleSignals
      .map((signal) => {
        const minuteKey = toCanonicalMinute(signal?.ts ?? signal?.bucket_ts ?? signal?.timestamp ?? signal?.time ?? signal?.date);
        const matchedValue = Number(signal?.matched_value ?? signal?.value ?? signal?.strength ?? 0);
        if (minuteKey == null || !Number.isFinite(matchedValue)) {
          return null;
        }

        return {
          ...signal,
          minuteKey: String(minuteKey),
          matchedValue,
          side: normalizeWhaleSignalSide(signal),
        };
      })
      .filter(Boolean);
  }, [flowViewModel, whaleSignals]);

  const candleTooltipCustom = useCallback(({ current }) => {
    if (!current) {
      return [];
    }

    const minuteKey = toCanonicalMinute(current?.timestamp ?? current?.date ?? current?.tradeDate);
    const lookupKey = minuteKey == null ? null : String(minuteKey);
    const flowBucket = lookupKey == null ? null : flowBucketLookup.get(lookupKey);

    return [
      { title: t('whaleAlertsDashboard.tooltipTime', { defaultValue: 'Thời gian' }), value: formatTooltipTimestamp(current.timestamp ?? current.date) },
      { title: t('whaleAlertsDashboard.tooltipOpen', { defaultValue: 'Mở' }), value: formatTooltipValue(current.open, 2) },
      { title: t('whaleAlertsDashboard.tooltipHigh', { defaultValue: 'Cao' }), value: formatTooltipValue(current.high, 2) },
      { title: t('whaleAlertsDashboard.tooltipLow', { defaultValue: 'Thấp' }), value: formatTooltipValue(current.low, 2) },
      { title: t('whaleAlertsDashboard.tooltipClose', { defaultValue: 'Đóng' }), value: formatTooltipValue(current.close, 2) },
      { title: t('whaleAlertsDashboard.tooltipVolume', { defaultValue: 'Khối lượng' }), value: formatTooltipValue(current.volume, 0) },
      { title: t('whaleAlertsDashboard.tooltipCvd', { defaultValue: 'CVD' }), value: formatTooltipValue(flowBucket?.cvdRaw, 0) },
      { title: t('whaleAlertsDashboard.tooltipCvdNormalized', { defaultValue: 'CVD chuẩn hóa' }), value: formatTooltipValue(flowBucket?.cvdNormalized, 1) },
      { title: t('whaleAlertsDashboard.tooltipStrength', { defaultValue: 'Sức mạnh' }), value: formatTooltipValue(flowBucket?.buyStrength, 0) },
      { title: t('whaleAlertsDashboard.tooltipInstitutionalStrength', { defaultValue: 'Sức mạnh tổ chức' }), value: formatTooltipValue(flowBucket?.institutionalStrength, 0) },
      { title: t('whaleAlertsDashboard.tooltipNetHeat', { defaultValue: 'Nhiệt ròng' }), value: formatTooltipValue(flowBucket?.netHeat, 1) },
      { title: t('whaleAlertsDashboard.tooltipWhaleScore', { defaultValue: 'Điểm cá mập' }), value: formatTooltipValue(flowBucket?.whaleScore, 1) },
    ];
  }, [flowBucketLookup, t]);

  const candleTooltipStyles = useMemo(() => ({
    showRule: isTooltipVisible ? TooltipShowRule.FollowCross : TooltipShowRule.None,
    showType: 'rect',
    labels: [
      t('whaleAlertsDashboard.tooltipTime', { defaultValue: 'Thời gian' }),
      t('whaleAlertsDashboard.tooltipOpen', { defaultValue: 'Mở' }),
      t('whaleAlertsDashboard.tooltipHigh', { defaultValue: 'Cao' }),
      t('whaleAlertsDashboard.tooltipLow', { defaultValue: 'Thấp' }),
      t('whaleAlertsDashboard.tooltipClose', { defaultValue: 'Đóng' }),
      t('whaleAlertsDashboard.tooltipVolume', { defaultValue: 'Khối lượng' }),
      t('whaleAlertsDashboard.tooltipCvd', { defaultValue: 'CVD' }),
      t('whaleAlertsDashboard.tooltipCvdNormalized', { defaultValue: 'CVD chuẩn hóa' }),
      t('whaleAlertsDashboard.tooltipStrength', { defaultValue: 'Sức mạnh' }),
      t('whaleAlertsDashboard.tooltipInstitutionalStrength', { defaultValue: 'Sức mạnh tổ chức' }),
      t('whaleAlertsDashboard.tooltipNetHeat', { defaultValue: 'Nhiệt ròng' }),
      t('whaleAlertsDashboard.tooltipWhaleScore', { defaultValue: 'Điểm cá mập' }),
    ],
    values: null,
    custom: candleTooltipCustom,
    defaultValue: t('common.notAvailable'),
    rect: {
      position: 'fixed',
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 6,
      offsetLeft: 8,
      offsetTop: 8,
      offsetRight: 8,
      borderRadius: 6,
      borderSize: 1,
      borderColor: '#2a2e39',
      color: '#131722',
    },
    text: { size: 11, family: 'inherit', weight: 'normal', color: '#d1d4dc', marginLeft: 8 },
  }), [candleTooltipCustom, isTooltipVisible, t]);

  const clearSharkMarkers = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !sharkOverlayIdsRef.current.length) {
      sharkOverlayIdsRef.current = [];
      sharkMarkerSignatureRef.current = '';
      return;
    }

    sharkOverlayIdsRef.current.forEach((overlayId) => {
      try {
        chart.removeOverlay(overlayId);
      } catch (error) {
        // Ignore stale overlay removals during rapid viewport changes.
      }
    });
    sharkOverlayIdsRef.current = [];
    sharkMarkerSignatureRef.current = '';
  }, []);

  const clearHeatmapOverlays = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !heatmapOverlayIdsRef.current.length) {
      heatmapOverlayIdsRef.current = [];
      heatmapOverlaySignatureRef.current = '';
      return;
    }

    heatmapOverlayIdsRef.current.forEach((overlayId) => {
      try {
        chart.removeOverlay(overlayId);
      } catch (error) {
        // Ignore stale overlay removals during rapid viewport changes.
      }
    });
    heatmapOverlayIdsRef.current = [];
    heatmapOverlaySignatureRef.current = '';
  }, []);

  const syncHeatmapOverlays = useCallback((visibleRange = null) => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const overlays = buildVisibleHeatmapBands({
      candles: chart.getDataList?.() || [],
      flowBucketLookup,
      visibleRange: visibleRange || lastVisibleRangeRef.current,
      heatmapMode,
    });
    const nextSignature = overlays.map((overlay) => `${overlay.id}:${overlay.color}`).join('|');
    if (nextSignature === heatmapOverlaySignatureRef.current) {
      return;
    }

    clearHeatmapOverlays();

    overlays.forEach((overlay) => {
      try {
        chart.createOverlay({
          id: overlay.id,
          name: HEATMAP_OVERLAY_NAME,
          mode: OverlayMode.Normal,
          lock: true,
          visible: true,
          zLevel: 1,
          extendData: { color: overlay.color },
          points: [
            { timestamp: overlay.startTimestamp, value: overlay.anchorValue },
            { timestamp: overlay.endTimestamp, value: overlay.anchorValue },
          ],
        }, 'candle_pane');
        heatmapOverlayIdsRef.current.push(overlay.id);
      } catch (error) {
        console.error('Error creating heatmap overlay:', error);
      }
    });

    heatmapOverlaySignatureRef.current = nextSignature;
  }, [clearHeatmapOverlays, flowBucketLookup, heatmapMode]);

  const syncSharkMarkers = useCallback((visibleRange = null) => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const markers = buildVisibleWhaleSharkMarkers({
      candles: chart.getDataList?.() || [],
      signals: whaleMarkerSignals,
      visibleRange: visibleRange || lastVisibleRangeRef.current,
      signalTimeframe: flowTimeframe,
    });

    const nextSignature = markers.map((marker) => marker.id).join('|');
    if (nextSignature === sharkMarkerSignatureRef.current) {
      return;
    }

    clearSharkMarkers();

    if (!markers.length) {
      return;
    }

    markers.forEach((marker) => {
      try {
        chart.createOverlay({
          id: marker.id,
          name: 'simpleAnnotation',
          mode: OverlayMode.Normal,
          lock: true,
          visible: true,
          zLevel: 20,
          extendData: marker.label,
          points: [
            { timestamp: marker.timestamp, value: marker.value },
            { timestamp: marker.timestamp, value: marker.value },
          ],
        }, 'candle_pane');
        sharkOverlayIdsRef.current.push(marker.id);
      } catch (error) {
        console.error('Error creating shark marker overlay:', error);
      }
    });

    sharkMarkerSignatureRef.current = nextSignature;
  }, [clearSharkMarkers, flowTimeframe, whaleMarkerSignals]);

  const syncSharkMarkersRef = useRef(syncSharkMarkers);
  useEffect(() => {
    syncSharkMarkersRef.current = syncSharkMarkers;
  }, [syncSharkMarkers]);

  const syncHeatmapOverlaysRef = useRef(syncHeatmapOverlays);
  useEffect(() => {
    syncHeatmapOverlaysRef.current = syncHeatmapOverlays;
  }, [syncHeatmapOverlays]);

  const customIndicatorDefs = useMemo(() => {
    const hasFlowCompareData = flowBuckets.length > 0;
    const resolveFlowValues = (item) => {
      const flowBucket = resolveFlowBucketForCandle(
        item?.timestamp ?? item?.date ?? item?.tradeDate,
        flowBuckets,
        activeTimeframe,
        flowTimeframe,
      );
      return {
        cvdNormalized: Number.isFinite(Number(flowBucket?.cvdNormalized)) ? Number(flowBucket.cvdNormalized) : null,
        buyStrength: Number.isFinite(Number(flowBucket?.buyStrength)) ? Number(flowBucket.buyStrength) : null,
        institutionalStrength: Number.isFinite(Number(flowBucket?.institutionalStrength)) ? Number(flowBucket.institutionalStrength) : null,
        baseline: 50,
      };
    };

    const flowCvdTemplate = hasFlowCompareData ? {
      name: 'FLOW_CVD',
      shortName: t('whaleAlertsDashboard.flowCvdPaneTitle', { defaultValue: 'CVD chuẩn hóa' }),
      calcParams: [],
      shouldOhlc: false,
      precision: 1,
      minValue: 0,
      maxValue: 100,
      series: IndicatorSeries.Normal,
      figures: [
        { key: 'cvdNormalized', title: t('whaleAlertsDashboard.cvdNormalizedPaneTitle', { defaultValue: 'CVD chuẩn hóa' }), type: 'line' },
        { key: 'baseline', title: '50', type: 'line' },
      ],
      calc: (kLineDataList = []) => kLineDataList.map((item) => {
        const flowValues = resolveFlowValues(item);
        return {
          cvdNormalized: flowValues.cvdNormalized,
          baseline: flowValues.baseline,
        };
      }),
      styles: {
        lines: [
          { color: '#22d3ee', size: 2, style: LineType.Solid, dashedValue: [0, 0], smooth: true },
          { color: '#64748b', size: 1, style: LineType.Dashed, dashedValue: [4, 2], smooth: false },
        ],
      },
    } : null;

    const flowStrengthTemplate = hasFlowCompareData ? {
      name: 'FLOW_STRENGTH',
      shortName: t('whaleAlertsDashboard.flowStrengthPaneTitle', { defaultValue: 'Sức mạnh dòng tiền' }),
      calcParams: [],
      shouldOhlc: false,
      precision: 1,
      minValue: 0,
      maxValue: 100,
      series: IndicatorSeries.Normal,
      figures: [
        { key: 'buyStrength', title: t('whaleAlertsDashboard.strengthPaneTitle', { defaultValue: 'Sức mạnh' }), type: 'line' },
        { key: 'institutionalStrength', title: t('whaleAlertsDashboard.institutionalStrengthPaneTitle', { defaultValue: 'Sức mạnh tổ chức' }), type: 'line' },
      ],
      calc: (kLineDataList = []) => kLineDataList.map((item) => {
        const flowValues = resolveFlowValues(item);
        return {
          buyStrength: flowValues.buyStrength,
          institutionalStrength: flowValues.institutionalStrength,
        };
      }),
      styles: {
        lines: [
          { color: '#34d399', size: 2, style: LineType.Solid, dashedValue: [0, 0], smooth: true },
          { color: '#38bdf8', size: 2, style: LineType.Solid, dashedValue: [0, 0], smooth: true },
        ],
      },
    } : null;

    return {
      FLOW_CVD: flowCvdTemplate ? { template: flowCvdTemplate, paneOptions: { id: 'whale_flow_cvd_pane', height: 128, minHeight: 96 } } : null,
      FLOW_STRENGTH: flowStrengthTemplate ? { template: flowStrengthTemplate, paneOptions: { id: 'whale_flow_strength_pane', height: 132, minHeight: 96 } } : null,
    };
  }, [activeTimeframe, flowBuckets, flowTimeframe, t]);

  const rememberIndicatorPane = (indicatorId, paneId) => {
    if (paneId) {
      indicatorPaneMapRef.current[indicatorId] = paneId;
    }
  };

  const forgetIndicatorPane = (indicatorId) => {
    delete indicatorPaneMapRef.current[indicatorId];
  };

  const findIndicatorPaneIds = (chart, indicatorId) => {
    const paneIds = [];
    try {
      const allIndicators = chart.getIndicatorByPaneId?.();
      if (allIndicators instanceof Map) {
        for (const [paneId, indicators] of allIndicators.entries()) {
          if (indicators instanceof Map && indicators.has(indicatorId)) {
            paneIds.push(paneId);
          }
        }
      }
    } catch (e) {
      // fallback handled by static pane candidates below
    }
    return paneIds;
  };

  const removeIndicatorFromAnySubPane = (chart, indicatorId) => {
    const dynamicPaneIds = findIndicatorPaneIds(chart, indicatorId);
    const rememberedPaneId = indicatorPaneMapRef.current[indicatorId];
    const paneIdsToTry = [
      ...(rememberedPaneId ? [rememberedPaneId] : []),
      ...dynamicPaneIds,
      ...SUB_PANE_CANDIDATES,
    ];

    let removed = false;
    const seen = new Set();
    for (const paneId of paneIdsToTry) {
      if (!paneId || seen.has(paneId)) {
        continue;
      }
      seen.add(paneId);
      try {
        chart.removeIndicator(paneId, indicatorId);
        removed = true;
      } catch (e) {
        // keep trying other pane ids for compatibility across klinecharts variants
      }
    }
    if (!removed) {
      if (!rememberedPaneId && dynamicPaneIds.length === 0) {
        forgetIndicatorPane(indicatorId);
        return false;
      }
      throw new Error(`Failed to remove ${indicatorId} from sub panes`);
    }
    forgetIndicatorPane(indicatorId);
    return true;
  };

  const createIndicatorWithTracking = (chart, indicatorId) => {
    if (Object.prototype.hasOwnProperty.call(customIndicatorDefs, indicatorId) && !customIndicatorDefs[indicatorId]?.template) {
      return;
    }

    let paneId = null;
    const customIndicatorDef = customIndicatorDefs[indicatorId];
    if (customIndicatorDef) {
      try {
        registerIndicator(customIndicatorDef.template);
        const existingPaneId = indicatorPaneMapRef.current[indicatorId];
        if (existingPaneId) {
          chart.overrideIndicator(customIndicatorDef.template, existingPaneId);
          paneId = existingPaneId;
        } else {
          paneId = chart.createIndicator(customIndicatorDef.template.name, false, customIndicatorDef.paneOptions);
        }
      } catch (error) {
        console.error(`Error creating custom indicator ${indicatorId}:`, error);
        paneId = null;
      }
    } else if (indicatorId === 'VOL') {
      paneId = chart.createIndicator('VOL', false, { height: 80, minHeight: 40 });
    } else if (MAIN_PANE_INDICATORS.has(indicatorId)) {
      chart.createIndicator(indicatorId, false, { id: 'candle_pane' });
      paneId = 'candle_pane';
    } else {
      paneId = chart.createIndicator(indicatorId, false);
    }
    rememberIndicatorPane(indicatorId, paneId || (MAIN_PANE_INDICATORS.has(indicatorId) ? 'candle_pane' : null));
  };

  const handleToggleIndicator = (indicatorId) => {
    if (Object.prototype.hasOwnProperty.call(customIndicatorDefs, indicatorId) && !customIndicatorDefs[indicatorId]?.template) {
      return;
    }

    if (indicatorId === 'VOL') {
      setActiveIndicators((prev) => {
        const isNextEnabled = !prev[indicatorId];
        if (chartRef.current) {
          try {
            if (isNextEnabled) {
              createIndicatorWithTracking(chartRef.current, 'VOL');
            } else {
              removeIndicatorFromAnySubPane(chartRef.current, 'VOL');
            }
          } catch (e) {
            console.error(`Error toggling indicator ${indicatorId}:`, e);
          }
        }
        return { ...prev, [indicatorId]: isNextEnabled };
      });
    } else {
      setActiveIndicators((prev) => {
        const newState = { ...prev, [indicatorId]: !prev[indicatorId] };
        if (chartRef.current) {
          if (newState[indicatorId]) {
            try {
              createIndicatorWithTracking(chartRef.current, indicatorId);
            } catch (e) {
              console.error(`Error creating indicator ${indicatorId}:`, e);
            }
          } else {
            try {
              if (MAIN_PANE_INDICATORS.has(indicatorId)) {
                chartRef.current.removeIndicator('candle_pane', indicatorId);
                forgetIndicatorPane(indicatorId);
              } else {
                removeIndicatorFromAnySubPane(chartRef.current, indicatorId);
              }
            } catch (e) {
              console.error(`Error removing indicator ${indicatorId}:`, e);
            }
          }
        }
        return newState;
      });
    }
  };

  const handleTimeframe = (tf) => {
    setActiveTimeframe(tf.id);
    onTimeframeChange?.({ timeframe: tf.id, days: tf.days });
    onPeriodChange?.(tf.days);
  };

  const handleToggleTooltip = () => {
    setIsTooltipVisible((prev) => !prev);
  };

  const emitVisibleRangeFromChart = useCallback((kLineData = []) => {
    const chart = chartRef.current;
    if (!chart || !onVisibleRangeChange) return;

    const fallbackFrom = kLineData[0]?.timestamp ?? null;
    const fallbackTo = kLineData[kLineData.length - 1]?.timestamp ?? null;

    let nextFrom = fallbackFrom;
    let nextTo = fallbackTo;

    try {
      const visibleRange = chart.getVisibleRange?.();
      if (visibleRange && kLineData.length) {
        const fromIndexRaw = Number(
          visibleRange.from
          ?? visibleRange.realFrom
          ?? visibleRange.left
          ?? visibleRange.start
        );
        const toIndexRaw = Number(
          visibleRange.to
          ?? visibleRange.realTo
          ?? visibleRange.right
          ?? visibleRange.end
        );

        if (Number.isFinite(fromIndexRaw) && Number.isFinite(toIndexRaw)) {
          const fromIndex = Math.max(0, Math.min(kLineData.length - 1, Math.floor(fromIndexRaw)));
          const toIndex = Math.max(fromIndex, Math.min(kLineData.length - 1, Math.ceil(toIndexRaw)));
          nextFrom = kLineData[fromIndex]?.timestamp ?? fallbackFrom;
          nextTo = kLineData[toIndex]?.timestamp ?? fallbackTo;
        }
      }
    } catch (_) {
      nextFrom = fallbackFrom;
      nextTo = fallbackTo;
    }

    if (
      lastVisibleRangeRef.current.from_ts !== nextFrom
      || lastVisibleRangeRef.current.to_ts !== nextTo
    ) {
      lastVisibleRangeRef.current = { from_ts: nextFrom, to_ts: nextTo };
      onVisibleRangeChange({ from_ts: nextFrom, to_ts: nextTo });
    }
    syncHeatmapOverlaysRef.current?.({ from_ts: nextFrom, to_ts: nextTo });
    syncSharkMarkersRef.current?.({ from_ts: nextFrom, to_ts: nextTo });
  }, [onVisibleRangeChange]);

  const handleVisibleRangeAction = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    emitVisibleRangeFromChart(chart.getDataList?.() || []);
  }, [emitVisibleRangeFromChart]);

  const focusChartOnTradeDate = useCallback((tradeDate) => {
    const chart = chartRef.current;
    if (!chart || !tradeDate) {
      return false;
    }

    const kLineData = chart.getDataList?.() || [];
    const targetRange = resolveTradeDateIndexRange(kLineData, tradeDate);
    if (!targetRange) {
      return false;
    }

    const visibleRange = chart.getVisibleRange?.();
    const currentVisibleBarCount = Number.isFinite(Number(visibleRange?.realTo)) && Number.isFinite(Number(visibleRange?.realFrom))
      ? Math.max(1, Math.ceil(Number(visibleRange.realTo) - Number(visibleRange.realFrom)))
      : kLineData.length;
    const targetVisibleBarCount = Math.max(12, targetRange.count + Math.max(4, Math.ceil(targetRange.count * 0.3)));

    buildAutoFocusZoomScales(currentVisibleBarCount, targetVisibleBarCount).forEach((scale) => {
      chart.zoomAtDataIndex?.(scale, targetRange.centerIndex, 0);
    });

    chart.scrollToDataIndex?.(targetRange.lastIndex, 0);
    emitVisibleRangeFromChart(chart.getDataList?.() || kLineData);
    return true;
  }, [emitVisibleRangeFromChart]);

  const emitSessionFromChart = useCallback((kLineData = []) => {
    if (!onSessionChange || !kLineData.length) {
      return;
    }

    const latestData = kLineData[kLineData.length - 1];
    const tradeDate = normalizeTradeDateKey(latestData?.tradeDate ?? latestData?.date ?? latestData?.timestamp);
    if (!tradeDate) {
      return;
    }

    onSessionChange({
      tradeDate,
      timestamp: latestData?.timestamp ?? null,
      dataIndex: kLineData.length - 1,
      kLineData: latestData,
    });
  }, [onSessionChange]);

  const onSessionChangeRef = useRef(onSessionChange);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  const handleChartClick = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !onSessionChangeRef.current) {
      return;
    }

    const crosshair = chart.getCrosshair?.();
    const clickedData = crosshair?.kLineData;
    if (!clickedData) {
      return;
    }

    const tradeDate = normalizeTradeDateKey(clickedData.tradeDate ?? clickedData.date ?? clickedData.timestamp);
    if (!tradeDate) {
      return;
    }

    onSessionChangeRef.current({
      tradeDate,
      timestamp: clickedData.timestamp ?? null,
      dataIndex: Number.isFinite(crosshair?.dataIndex) ? crosshair.dataIndex : null,
      kLineData: clickedData,
    });
  }, []);

  const handleScreenshot = () => {
    if (chartRef.current) {
      const image = chartRef.current.getImage({
        type: 'png',
        backgroundColor: '#131722'
      });
      if (image) {
        const link = document.createElement('a');
        link.href = image;
        link.download = `chart-${new Date().getTime()}.png`;
        link.click();
      }
    }
  };

  const handleToggleFullscreen = () => {
    if (!fullScreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
      setFullScreen(true);
    } else {
      document.exitFullscreen?.();
      setFullScreen(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = klineChartInit(containerRef.current, {
      locale: 'en-US',
      timezone: 'Asia/Ho_Chi_Minh',
      styles: {
        background: { color: '#131722' },
        grid: {
          horizontal: { show: true, size: 1, color: '#2a2e39', style: 'dashed' },
          vertical: { show: true, size: 1, color: '#2a2e39', style: 'dashed' },
        },
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#26a69a',
            downColor: '#ef5350',
            noChangeColor: '#94a3b8',
            upBorderColor: '#26a69a',
            downBorderColor: '#ef5350',
            noChangeBorderColor: '#94a3b8',
            upWickColor: '#26a69a',
            downWickColor: '#ef5350',
            noChangeWickColor: '#94a3b8',
          },
          tooltip: {
            showRule: 'follow_cross',
            showType: 'rect',
            labels: [
              'Time',
              'Open',
              'High',
              'Low',
              'Close',
              'Volume',
            ],
            values: null,
            defaultValue: t('common.notAvailable'),
            rect: {
              position: 'fixed',
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              offsetLeft: 8,
              offsetTop: 8,
              offsetRight: 8,
              borderRadius: 6,
              borderSize: 1,
              borderColor: '#2a2e39',
              color: '#131722',
            },
            text: { size: 11, family: 'inherit', weight: 'normal', color: '#d1d4dc', marginLeft: 8 },
          },
        },
        xAxis: {
          show: true,
          axisLine: { show: true, color: '#2a2e39', size: 1 },
          tickLine: { show: true, size: 1, length: 3, color: '#2a2e39' },
          tickText: { show: true, color: '#b2b5be', size: 11, family: 'inherit' },
        },
        yAxis: {
          show: true,
          type: 'normal',
          position: 'right',
          axisLine: { show: true, color: '#2a2e39', size: 1 },
          tickLine: { show: true, size: 1, length: 3, color: '#2a2e39' },
          tickText: { show: true, color: '#b2b5be', size: 11, family: 'inherit' },
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#758696' },
            text: { show: true, style: 'fill', color: '#d1d4dc', size: 11, borderRadius: 2, borderColor: '#2a2e39', backgroundColor: '#131722' },
          },
          vertical: {
            show: true,
            line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#758696' },
            text: { show: true, style: 'fill', color: '#d1d4dc', size: 11, borderRadius: 2, borderColor: '#2a2e39', backgroundColor: '#131722' },
          },
        },
        separator: {
          size: 1,
          color: '#2a2e39',
          fill: true,
          dragEnabled: true,
          activeBackgroundColor: 'rgba(67, 70, 81, 0.45)',
        },
      },
    });

    chartRef.current = chart;
    ensureHeatmapOverlayRegistered();
    chart.setOffsetRightDistance(CHART_RIGHT_OFFSET_DISTANCE);

    createIndicatorWithTracking(chart, 'MA');
    createIndicatorWithTracking(chart, 'VOL');
    if (activeIndicators.MACD) {
      createIndicatorWithTracking(chart, 'MACD');
    }
    FLOW_CUSTOM_INDICATOR_IDS.forEach((indicatorId) => {
      if (activeIndicators[indicatorId]) {
        createIndicatorWithTracking(chart, indicatorId);
      }
    });

    if (typeof chart.subscribeAction === 'function') {
      chart.subscribeAction(ActionType.OnVisibleRangeChange, handleVisibleRangeAction);
    }

    const domClickListener = () => {
      handleChartClick();
    };
    containerRef.current.addEventListener('click', domClickListener);

    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (typeof chart.unsubscribeAction === 'function') {
        chart.unsubscribeAction(ActionType.OnVisibleRangeChange, handleVisibleRangeAction);
      }
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', domClickListener);
        klineChartDispose(containerRef.current);
      }
      indicatorPaneMapRef.current = {};
      heatmapOverlayIdsRef.current = [];
      heatmapOverlaySignatureRef.current = '';
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (activeTimeframeProp && TIMEFRAMES.some((tf) => tf.id === activeTimeframeProp)) {
      setActiveTimeframe(activeTimeframeProp);
      return;
    }
    const match = TIMEFRAMES.find((tf) => tf.days === activePeriod);
    if (match) {
      setActiveTimeframe(match.id);
    }
  }, [activePeriod, activeTimeframeProp]);

  useEffect(() => {
    onActiveIndicatorsChange?.(activeIndicators);
  }, [activeIndicators, onActiveIndicatorsChange]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chart.setStyles({
      candle: {
        tooltip: candleTooltipStyles,
      },
    });
  }, [candleTooltipStyles]);

  useEffect(() => {
    if (!chartRef.current || !data?.length) return;

    const kLineData = data
      .filter((d) => d.date && d.close != null)
      .map((d) => ({
        timestamp: new Date(d.date).getTime(),
        date: d.date,
        tradeDate: normalizeTradeDateKey(d.date),
        open: d.open != null ? Number(d.open) : Number(d.close),
        high: d.high != null ? Number(d.high) : Number(d.close),
        low: d.low != null ? Number(d.low) : Number(d.close),
        close: Number(d.close),
        volume: d.volume != null ? Number(d.volume) : 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    chartRef.current.applyNewData(kLineData);
    emitVisibleRangeFromChart(kLineData);
    emitSessionFromChart(kLineData);
  }, [data, emitVisibleRangeFromChart, emitSessionFromChart]);

  useEffect(() => {
    const hasActiveFlowPane = Boolean(activeIndicators.FLOW_CVD || activeIndicators.FLOW_STRENGTH);
    if (!hasActiveFlowPane) {
      lastAutoFocusedTradeDateRef.current = '';
      return;
    }

    const normalizedFlowTradeDate = normalizeTradeDateKey(flowSessionTradeDate);
    if (!normalizedFlowTradeDate) {
      return;
    }

    const focusSignature = `${normalizedFlowTradeDate}:${activeTimeframe}:${data?.length || 0}`;
    if (lastAutoFocusedTradeDateRef.current === focusSignature) {
      return;
    }

    if (focusChartOnTradeDate(normalizedFlowTradeDate)) {
      lastAutoFocusedTradeDateRef.current = focusSignature;
    }
  }, [activeIndicators.FLOW_CVD, activeIndicators.FLOW_STRENGTH, activeTimeframe, data?.length, flowSessionTradeDate, focusChartOnTradeDate]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    FLOW_CUSTOM_INDICATOR_IDS.forEach((indicatorId) => {
      const config = customIndicatorDefs[indicatorId];
      const isVisible = Boolean(activeIndicators[indicatorId]);
      const paneId = indicatorPaneMapRef.current[indicatorId];

      if (!isVisible || !config?.template) {
        if (paneId) {
          try {
            chart.removeIndicator(paneId);
          } catch (error) {
            console.error(`Error removing custom indicator ${indicatorId}:`, error);
          }
          forgetIndicatorPane(indicatorId);
        }
        return;
      }

      try {
        registerIndicator(config.template);
        if (paneId) {
          chart.overrideIndicator(config.template, paneId);
        } else {
          const createdPaneId = chart.createIndicator(config.template.name, false, config.paneOptions);
          rememberIndicatorPane(indicatorId, createdPaneId || config.paneOptions.id);
        }
      } catch (error) {
        console.error(`Error syncing custom indicator ${indicatorId}:`, error);
      }
    });
  }, [activeIndicators.FLOW_CVD, activeIndicators.FLOW_STRENGTH, customIndicatorDefs]);

  useEffect(() => {
    syncHeatmapOverlaysRef.current?.();
    syncSharkMarkersRef.current?.();
  }, [flowBucketLookup, heatmapMode, whaleMarkerSignals]);

  return (
    <div className="flex flex-col w-full h-full bg-[#131722] rounded-lg overflow-hidden border border-[#2a2e39]">
      <div className="bg-[#1e222d] border-b border-[#2a2e39] p-1.5 flex flex-wrap gap-1.5 items-center">
        <div className="flex items-center gap-2 border-r border-[#2a2e39] pr-2">
          <label className="text-[10px] font-bold text-[#8b93a7] uppercase tracking-widest">
            {t('whaleAlertsDashboard.timeframeLabel', { defaultValue: 'Khung thời gian' })}
          </label>
          <select
            value={activeTimeframe}
            onChange={(event) => {
              const selectedTimeframe = TIMEFRAMES.find((tf) => tf.id === event.target.value);
              if (selectedTimeframe) {
                handleTimeframe(selectedTimeframe);
              }
            }}
            className="h-7 min-w-[98px] rounded border border-[#2a2e39] bg-[#0f172a] px-2 py-1 text-[11px] font-medium text-[#d1d4dc] outline-none transition hover:border-[#3b82f6] focus:border-[#3b82f6]"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf.id} value={tf.id}>
                {tf.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 items-center border-r border-[#2a2e39] pr-2">
          <button
            onClick={handleToggleTooltip}
            className={`h-7 px-2 py-1 text-[11px] font-medium rounded transition whitespace-nowrap ${
              isTooltipVisible
                ? 'bg-[#2962ff] text-white'
                : 'bg-[#2a2e39] text-[#b2b5be] hover:bg-[#363a45]'
            }`}
            title={isTooltipVisible
              ? t('whaleAlertsDashboard.hideTooltip', { defaultValue: 'Ẩn tooltip' })
              : t('whaleAlertsDashboard.showTooltip', { defaultValue: 'Hiện tooltip' })}
            aria-pressed={isTooltipVisible}
          >
            {isTooltipVisible
              ? t('whaleAlertsDashboard.hideTooltip', { defaultValue: 'Ẩn tooltip' })
              : t('whaleAlertsDashboard.showTooltip', { defaultValue: 'Hiện tooltip' })}
          </button>
        </div>

        <div className="flex items-center gap-2 border-r border-[#2a2e39] pr-2">
          <label className="text-[10px] font-bold text-[#8b93a7] uppercase tracking-widest">
            {t('whaleAlertsDashboard.heatmapModeLabel', { defaultValue: 'Heatmap' })}
          </label>
          <select
            value={heatmapMode}
            onChange={(event) => setHeatmapMode(event.target.value)}
            className="h-7 min-w-[82px] rounded border border-[#2a2e39] bg-[#0f172a] px-2 py-1 text-[11px] font-medium text-[#d1d4dc] outline-none transition hover:border-[#14b8a6] focus:border-[#14b8a6]"
          >
            {heatmapModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
          <span className={`inline-flex h-7 items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wide ${resolveQualityBadgeTone(qualityState)}`}>
            {qualityState}
          </span>
          {!hasHeatmapData && heatmapMode !== 'off' ? (
            <span className="text-[10px] font-medium text-[#fca5a5]">
              {t('whaleAlertsDashboard.heatmapDataMissing', { defaultValue: 'Thiếu dữ liệu heatmap' })}
            </span>
          ) : null}
        </div>

        <div className="flex gap-1 items-center border-r border-[#2a2e39] pr-2">
          {AVAILABLE_INDICATORS.map((ind) => (
            <button
              key={ind.id}
              onClick={() => handleToggleIndicator(ind.id)}
              className={`h-7 min-w-[38px] px-2 py-1 text-[11px] rounded transition ${
                activeIndicators[ind.id]
                  ? 'bg-[#2962ff] text-white'
                  : 'bg-[#2a2e39] text-[#b2b5be] hover:bg-[#363a45]'
              }`}
              title={ind.name}
            >
              {ind.id}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 items-center border-r border-[#2a2e39] pr-2">
          {deepFlowPaneControls.map((control) => {
            const isReady = Boolean(customIndicatorDefs[control.id]?.template);
            const isActive = isReady && Boolean(activeIndicators[control.id]);
            return (
              <button
                key={control.id}
                onClick={() => handleToggleIndicator(control.id)}
                disabled={!isReady}
                className={`h-7 px-2 py-1 text-[11px] font-medium rounded transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0f766e] text-white'
                    : 'bg-[#2a2e39] text-[#b2b5be] hover:bg-[#363a45]'
                } ${!isReady ? 'opacity-45 cursor-not-allowed' : ''}`}
                title={isReady ? control.title : t('whaleAlertsDashboard.flowDataPending', { defaultValue: 'Đang chờ dữ liệu dòng tiền' })}
                aria-pressed={isActive}
              >
                {isActive ? control.labelOn : control.labelOff}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 border-l border-[#2a2e39] pl-2">
          <button
            onClick={handleScreenshot}
            className="h-7 px-2 py-1 text-[11px] bg-[#2a2e39] text-[#b2b5be] rounded hover:bg-[#363a45] transition"
            title={t('stockDetail.takeScreenshot')}
          >
            Screenshot
          </button>
          <button
            onClick={handleToggleFullscreen}
            className={`h-7 px-2 py-1 text-[11px] rounded transition ${
              fullScreen
                ? 'bg-[#2962ff] text-white'
                : 'bg-[#2a2e39] text-[#b2b5be] hover:bg-[#363a45]'
            }`}
            title={t('stockDetail.fullscreen')}
          >
            Fullscreen
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ width: '100%', flex: 1, background: '#131722', overflow: 'hidden' }}
      />
    </div>
  );
}