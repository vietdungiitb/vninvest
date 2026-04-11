function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
}
const ADVISORY_INVALIDATION_EVENT = 'vninvest:advisory_updated';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { init as klineChartInit, dispose as klineChartDispose } from 'klinecharts';
import { Link, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  addTrackedSymbol,
  addWatchlistItem,
  createPriceAlert,
  deleteTrackedSymbol,
  deleteWatchlistItem,
  getUserConfig,
  getIntradayMatched,
  getPriceBoard,
  getSectorBreadth,
  getStockFinancials,
  getStockAIAdvisorySession,
  getStockAIAdvisoryObservability,
  postStockAIAdvisoryObservabilityEvent,
  refreshStockAIAdvisorySession,
  generateStockAIAdvisoryComponents,
  getStockOrderFlow,
  getStockPriceChart,
  getStockWorkspaceOverview,
  getWatchlistGroups,
  getWhaleFeed,
  deleteStockAIAdvisoryComponent,
  clearDeletedStockAIAdvisoryComponents,
  regenerateStockAIExecutiveSummary,
  deleteStockAIExecutiveSummary,
  restoreStockAIAdvisoryComponent,
  refreshStockAIAdvisoryComponent,
  toggleStockAIAdvisoryComponentInclude,
} from '../api/client';
import { WhaleFeedPanel, BubbleOrderChart, MoneyFlowDonut } from './WhaleAlertsDashboard';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import { useI18n } from '../context/LangContext';
import {
  getAdvisoryConflictRetryDelayMs,
  resolveAdvisoryConflictState,
  shouldAutoRetryAdvisoryConflict,
} from './stockDetailAdvisoryUtils';

// Giá hiển thị theo chuẩn bảng giá: en-US, 2 chữ số thập phân, không kèm đơn vị trong từng ô.

function formatChartAxis(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  if (numericValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(1)}M`;
  }
  if (numericValue >= 1_000) {
    return `${(numericValue / 1_000).toFixed(0)}K`;
  }
  return numericValue.toFixed(0);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString(undefined);
}

function fmtVol(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function advisoryStatusLabel(status, t) {
  const map = {
    overbought: t('stockDetail.statusOverbought'),
    oversold: t('stockDetail.statusOversold'),
    accumulation: t('stockDetail.statusAccumulation'),
    breakout: t('stockDetail.statusBreakout'),
    neutral: t('stockDetail.statusNeutral'),
  };
  return map[String(status || '').toLowerCase()] || t('stockDetail.statusNeutral');
}

function advisoryActionLabel(action, t) {
  const map = {
    watch: t('stockDetail.actionWatch'),
    buy: t('stockDetail.actionBuy'),
    sell: t('stockDetail.actionSell'),
    hold_off: t('stockDetail.actionHoldOff'),
  };
  return map[String(action || '').toLowerCase()] || t('stockDetail.actionWatch');
}

function advisoryRiskLabel(riskLevel, t) {
  const map = {
    low: t('stockDetail.riskLow'),
    medium: t('stockDetail.riskMedium'),
    high: t('stockDetail.riskHigh'),
  };
  return map[String(riskLevel || '').toLowerCase()] || t('stockDetail.riskMedium');
}

function advisorySynthesisPreferenceLabel(preference, t) {
  const map = {
    short_term_action: t('stockDetail.preferenceShortTerm'),
    risk_management: t('stockDetail.preferenceRisk'),
    balanced: t('stockDetail.preferenceBalanced'),
  };
  return map[String(preference || '').toLowerCase()] || map.balanced;
}

function advisoryRetryOutcomeLabel(outcome, t) {
  const map = {
    idle: t('stockDetail.retryOutcomeIdle'),
    scheduled: t('stockDetail.retryOutcomeScheduled'),
    recovered: t('stockDetail.retryOutcomeRecovered'),
    exhausted: t('stockDetail.retryOutcomeExhausted'),
    skipped_config: t('stockDetail.retryOutcomeSkippedConfig'),
    request_error: t('stockDetail.retryOutcomeRequestError'),
  };
  return map[String(outcome || '').toLowerCase()] || t('stockDetail.retryOutcomeIdle');
}

function emitAdvisoryInvalidation(symbol, advisory) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) return;
  window.dispatchEvent(new CustomEvent(ADVISORY_INVALIDATION_EVENT, {
    detail: {
      symbol: normalizedSymbol,
      advisoryId: advisory?.id || null,
      createdAt: advisory?.created_at || null,
    },
  }));
}

function advisoryRetryOutcomeBadgeClass(outcome) {
  const key = String(outcome || '').toLowerCase();
  if (key === 'recovered') {
    return 'border-emerald-700/60 bg-emerald-500/10 text-emerald-300';
  }
  if (key === 'scheduled') {
    return 'border-cyan-700/60 bg-cyan-500/10 text-cyan-300';
  }
  if (key === 'exhausted' || key === 'request_error') {
    return 'border-rose-700/60 bg-rose-500/10 text-rose-300';
  }
  if (key === 'skipped_config') {
    return 'border-amber-700/60 bg-amber-500/10 text-amber-300';
  }
  return 'border-slate-700 bg-slate-900/60 text-slate-300';
}

function advisoryGovernanceEndpointLabel(endpoint, t) {
  const map = {
    stock_ai_advisory_session_api: t('stockDetail.governanceEndpointSessionApi'),
    stock_ai_advisory_observability_api: t('stockDetail.governanceEndpointObservabilityApi'),
  };
  return map[String(endpoint || '').toLowerCase()] || endpoint || t('common.notAvailable');
}

function advisoryGovernanceReasonLabel(reason, t) {
  const map = {
    global_disabled: t('stockDetail.governanceReasonGlobalDisabled'),
    allowlist_blocked: t('stockDetail.governanceReasonAllowlistBlocked'),
    staff_only: t('stockDetail.governanceReasonStaffOnly'),
    all: t('stockDetail.governanceReasonAllAllowed'),
  };
  return map[String(reason || '').toLowerCase()] || reason || t('common.notAvailable');
}

function governanceDeltaSeverity(delta, thresholds = {}) {
  const warning = Math.max(0, Number(thresholds.warning ?? 2));
  const critical = Math.max(warning, Number(thresholds.critical ?? 4));
  const cooldown = Math.max(0, Number(thresholds.cooldown ?? 2));
  if (delta >= critical) return 'critical';
  if (delta >= warning) return 'warning';
  if (delta <= -cooldown) return 'cooldown';
  return 'normal';
}

function governanceDeltaSeverityLabel(level, t) {
  const map = {
    critical: t('stockDetail.governanceSeverityCritical'),
    warning: t('stockDetail.governanceSeverityWarning'),
    cooldown: t('stockDetail.governanceSeverityCooldown'),
    normal: t('stockDetail.governanceSeverityNormal'),
  };
  return map[level] || map.normal;
}

function governanceDeltaSeverityClass(level) {
  if (level === 'critical') return 'border-rose-700/70 bg-rose-500/10 text-rose-300';
  if (level === 'warning') return 'border-amber-700/70 bg-amber-500/10 text-amber-300';
  if (level === 'cooldown') return 'border-emerald-700/70 bg-emerald-500/10 text-emerald-300';
  return 'border-slate-700 bg-slate-900/60 text-slate-300';
}

function KLineChartComponent({ data, activePeriod, onPeriodChange, onVisibleRangeChange, onActiveIndicatorsChange }) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const indicatorPaneMapRef = useRef({});
  const lastVisibleRangeRef = useRef({ from_ts: null, to_ts: null });
  const [activeIndicators, setActiveIndicators] = useState({ MA: true, VOL: true, MACD: true });
  const [fullScreen, setFullScreen] = useState(false);

  const MAIN_PANE_INDICATORS = new Set(['MA', 'EMA', 'BOLL', 'SAR']);
  const SUB_PANE_CANDIDATES = ['volume_pane', 'indicator_pane'];

  const AVAILABLE_INDICATORS = [
    { id: 'VOL', name: 'Volume', default: true },
    { id: 'MA', name: t('stockDetail.indicatorMovingAverage'), default: true },
    { id: 'EMA', name: t('stockDetail.indicatorEma') },
    { id: 'BOLL', name: t('stockDetail.indicatorBollingerBands') },
    { id: 'MACD', name: t('stockDetail.indicatorMacd'), default: true },
    { id: 'RSI', name: t('stockDetail.indicatorRsi') },
    { id: 'KDJ', name: t('stockDetail.indicatorKdj') },
    { id: 'STOCH', name: t('stockDetail.indicatorStochastic') },
    { id: 'SAR', name: t('stockDetail.indicatorParabolicSar') },
    { id: 'ATR', name: t('stockDetail.indicatorAtr') },
    { id: 'OBV', name: t('stockDetail.indicatorObv') },
  ];

  const TIMEFRAMES = [
    { id: '1m',  days: 30 },
    { id: '5m',  days: 90 },
    { id: '15m', days: 180 },
    { id: '1H',  days: 365 },
    { id: '2H',  days: 730 },
    { id: '4H',  days: 1460 },
    { id: 'D',   days: 365 },
    { id: 'W',   days: 1095 },
    { id: 'M',   days: 1825 },
    { id: 'Y',   days: 3650 },
  ];
  const [activeTimeframe, setActiveTimeframe] = useState(() => {
    const match = TIMEFRAMES.find(tf => tf.days === activePeriod);
    return match ? match.id : '1H';
  });

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
      throw new Error(`Failed to remove ${indicatorId} from sub panes`);
    }
    forgetIndicatorPane(indicatorId);
  };

  const createIndicatorWithTracking = (chart, indicatorId) => {
    let paneId = null;
    if (indicatorId === 'VOL') {
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
    if (indicatorId === 'VOL') {
      setActiveIndicators(prev => {
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
      setActiveIndicators(prev => {
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
    onPeriodChange?.(tf.days);
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
  }, [onVisibleRangeChange]);

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

  // Khởi tạo chart một lần
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

    // MA trên pane chính
    createIndicatorWithTracking(chart, 'MA');
    // Volume ở pane phụ (chiều cao 20%)
    createIndicatorWithTracking(chart, 'VOL');
    // MACD mặc định để gần hành vi preview hơn.
    createIndicatorWithTracking(chart, 'MACD');

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (containerRef.current) {
        klineChartDispose(containerRef.current);
      }
      indicatorPaneMapRef.current = {};
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
    const match = TIMEFRAMES.find((tf) => tf.days === activePeriod);
    if (match) {
      setActiveTimeframe(match.id);
    }
  }, [activePeriod]);

  useEffect(() => {
    onActiveIndicatorsChange?.(activeIndicators);
  }, [activeIndicators, onActiveIndicatorsChange]);

  // Cập nhật dữ liệu khi prop thay đổi
  useEffect(() => {
    if (!chartRef.current || !data?.length) return;

    const kLineData = data
      .filter((d) => d.date && d.close != null)
      .map((d) => ({
        timestamp: new Date(d.date).getTime(),
        open: d.open != null ? Number(d.open) : Number(d.close),
        high: d.high != null ? Number(d.high) : Number(d.close),
        low: d.low != null ? Number(d.low) : Number(d.close),
        close: Number(d.close),
        volume: d.volume != null ? Number(d.volume) : 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    chartRef.current.applyNewData(kLineData);
    emitVisibleRangeFromChart(kLineData);
  }, [data, emitVisibleRangeFromChart]);

  useEffect(() => {
    if (!chartRef.current || !data?.length || !onVisibleRangeChange) return;
    const timer = window.setInterval(() => {
      const kLineData = data
        .filter((d) => d.date && d.close != null)
        .map((d) => ({ timestamp: new Date(d.date).getTime() }))
        .filter((d) => Number.isFinite(d.timestamp));
      emitVisibleRangeFromChart(kLineData);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [data, emitVisibleRangeFromChart, onVisibleRangeChange]);

  return (
    <div className="flex flex-col w-full h-full bg-[#131722] rounded-lg overflow-hidden border border-[#2a2e39]">
      {/* Toolbar */}
      <div className="bg-[#1e222d] border-b border-[#2a2e39] p-1.5 flex flex-wrap gap-1.5 items-center">
        {/* Timeframes */}
        <div className="flex gap-1 items-center">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => handleTimeframe(tf)}
              className={`h-7 min-w-[34px] px-2 py-1 text-[11px] font-medium rounded transition ${
                activeTimeframe === tf.id
                  ? 'bg-[#2962ff] text-white'
                  : 'bg-[#2a2e39] text-[#b2b5be] hover:bg-[#363a45]'
              }`}
            >
              {tf.id}
            </button>
          ))}
        </div>

        {/* Indicators */}
        <div className="flex gap-1 items-center border-l border-[#2a2e39] pl-2">
          {AVAILABLE_INDICATORS.map(ind => (
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

        {/* Actions */}
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

      {/* Chart Container */}
      <div
        ref={containerRef}
        style={{ width: '100%', flex: 1, background: '#131722', overflow: 'hidden' }}
      />
    </div>
  );
}

function IntradayMatchedPanel({ symbol, liveVolume }) {
  const { t, formatQuotePrice } = useI18n();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef(null);
  const prevVolumeRef = useRef(null);

  const fetchTrades = useCallback(async () => {
    if (!symbol) return;
    setRefreshing(true);
    setError('');
    try {
      const resp = await getIntradayMatched(symbol, 50);
      setTrades(resp.data.trades || []);
      setFetchedAt(resp.data.fetched_at || null);
    } catch (err) {
      setError(err.response?.data?.detail || t('stockDetail.intradayFetchFailed'));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [symbol, t]);

  // Reset khi đổi mã
  useEffect(() => {
    setTrades([]);
    setFetchedAt(null);
    setLoading(true);
    prevVolumeRef.current = null;
    fetchTrades();
  }, [fetchTrades]);

  // Fallback polling mỗi 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTrades, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTrades]);

  // Trigger khi WebSocket phát hiện volume thay đổi (có giao dịch mới)
  // Dùng debounce 3s để tránh gọi API quá nhiều
  useEffect(() => {
    if (!autoRefresh) return;
    const vol = Number(liveVolume);
    if (!Number.isFinite(vol) || vol <= 0) return;
    if (prevVolumeRef.current !== null && vol === prevVolumeRef.current) return;
    if (prevVolumeRef.current !== null && vol > prevVolumeRef.current) {
      // Volume tăng = có lệnh khớp mới → refresh sau 3s debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchTrades();
      }, 3_000);
    }
    prevVolumeRef.current = vol;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [liveVolume, autoRefresh, fetchTrades]);

  const buyCount = trades.filter((t) => t.side === 'buy').length;
  const sellCount = trades.filter((t) => t.side === 'sell').length;
  const totalVol = trades.reduce((sum, t) => sum + (t.volume || 0), 0);

  return (
    <section className="card-section p-4">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('stockDetail.intradayLabel')}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{t('stockDetail.intradayTitle')}</h3>
          {fetchedAt && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {refreshing && <span className="mr-1 inline-block animate-spin">⟳</span>}
              {t('stockDetail.updatedAt')}: {new Date(fetchedAt).toLocaleTimeString(undefined)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              autoRefresh
                ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                : 'border-slate-700 bg-slate-900/50 text-slate-400'
            }`}
          >
            {autoRefresh ? t('stockDetail.autoRefreshOn') : t('stockDetail.autoRefreshOff')}
          </button>
          <button
            onClick={fetchTrades}
            disabled={refreshing}
            className="rounded-full border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            {loading && !refreshing ? '...' : refreshing ? <span className="inline-block animate-spin">⟳</span> : '↻'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {trades.length > 0 && (
        <div className="mt-3 flex gap-3 text-[11px]">
          <span className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-2.5 py-1 text-emerald-300">
            ▲ {t('whaleHub.buy')}: {buyCount}
          </span>
          <span className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-2.5 py-1 text-rose-300">
            ▼ {t('whaleHub.sell')}: {sellCount}
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-slate-300">
            {t('stockDetail.volumeShort')}: {fmtVol(totalVol)}
          </span>
        </div>
      )}

      <div className="mt-3">
        {loading && trades.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-900" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-2.5 text-[12px] text-rose-300">
            {error}
          </div>
        ) : trades.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-500">
            {t('stockDetail.noIntradayData')}
          </p>
        ) : (
          <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
            {/* Header row */}
            <div className="grid grid-cols-[64px_1fr_80px_64px_56px] gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <span>{t('stockDetail.timeHeader')}</span>
              <span>{t('stockDetail.price')}</span>
              <span className="text-right">{t('stockDetail.volumeShort')}</span>
              <span className="text-right">{t('stockDetail.type')}</span>
              <span className="text-right">{t('stockDetail.buySellVolume')}</span>
            </div>
            {trades.map((row, idx) => (
              <div
                key={`${row.time}-${idx}`}
                className={`grid grid-cols-[64px_1fr_80px_64px_56px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] ${
                  row.side === 'buy'
                    ? 'border-emerald-900/30 bg-emerald-950/10'
                    : row.side === 'sell'
                      ? 'border-rose-900/30 bg-rose-950/10'
                      : 'border-slate-800/50 bg-slate-950/30'
                }`}
              >
                <span className="text-slate-500">{row.time}</span>
                <span className={`font-semibold tabular-nums ${row.side === 'buy' ? 'text-emerald-300' : row.side === 'sell' ? 'text-rose-300' : 'text-slate-200'}`}>
                  {row.price != null ? formatQuotePrice(row.price) : '—'}
                </span>
                <span className="text-right text-slate-300 tabular-nums">{fmtVol(row.volume)}</span>
                <span className={`text-right text-[10px] font-medium ${row.side === 'buy' ? 'text-emerald-400' : row.side === 'sell' ? 'text-rose-400' : 'text-slate-400'}`}>
                  {row.match_type || (row.side === 'buy' ? t('stockDetail.matchTypeBu') : row.side === 'sell' ? t('stockDetail.matchTypeSd') : '—')}
                </span>
                <span className={`text-right text-[10px] ${row.side === 'buy' ? 'text-emerald-500' : row.side === 'sell' ? 'text-rose-500' : 'text-slate-500'}`}>
                  {row.side === 'buy' ? t('whaleHub.buy') : row.side === 'sell' ? t('whaleHub.sell') : t('stockDetail.volumeShort')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BreadthMiniPanel({ symbol }) {
  const { t } = useI18n();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    getSectorBreadth(symbol)
      .then((resp) => {
        if (!cancelled) {
          setGroups(resp.data?.groups || []);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || t('stockDetail.breadthFetchFailed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, t]);

  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="h-32 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  if (error || !groups.length) {
    return (
      <section className="card-section p-4">
        <div className="text-label pb-3 border-b border-slate-800">{t('stockDetail.sectorIndex')}</div>
        <div className="mt-3 text-slate-500 text-sm">
          {error || t('stockDetail.noSectorData')}
        </div>
      </section>
    );
  }

  return (
    <section className="card-section p-4">
      <div className="text-label pb-3 border-b border-slate-800">{t('stockDetail.breadthLabel')}</div>
      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const peers = group.peers || [];
          const upCount = peers.filter((p) => p.status === 'up').length;
          const downCount = peers.filter((p) => p.status === 'down').length;
          const flatCount = peers.filter((p) => p.status === 'flat').length;
          const total = peers.length;
          return (
            <div key={group.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{group.name}</span>
                <span className="text-[10px] text-slate-500">{upCount}↑ {downCount}↓ {flatCount}→</span>
              </div>
              <div className="flex h-5 gap-0.5 rounded-md overflow-hidden border border-slate-800 bg-slate-950">
                {upCount > 0 && (
                  <div className="bg-emerald-700/70" style={{ width: `${(upCount / total) * 100}%` }} title={`${upCount} ${t('stockDetail.breadthUpTitle')}`} />
                )}
                {flatCount > 0 && (
                  <div className="bg-slate-700/50" style={{ width: `${(flatCount / total) * 100}%` }} title={`${flatCount} ${t('stockDetail.breadthFlatTitle')}`} />
                )}
                {downCount > 0 && (
                  <div className="bg-rose-700/70" style={{ width: `${(downCount / total) * 100}%` }} title={`${downCount} ${t('stockDetail.breadthDownTitle')}`} />
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {peers.slice(0, 6).map((peer) => (
                  <div
                    key={peer.symbol}
                    className={`text-[10px] px-2 py-1 rounded border breadth-${peer.status}${peer.is_self ? ' ring-1 ring-cyan-500' : ''}`}
                  >
                    <span>{peer.symbol}</span>
                    {peer.change_pct != null && (
                      <span className="ml-1 font-semibold">
                        {peer.change_pct > 0 ? '+' : ''}{peer.change_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
                {peers.length > 6 && (
                  <span className="text-[10px] px-2 py-1 text-slate-500">+{peers.length - 6}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function biasMeta(bias, t) {
  if (bias === 'BULLISH') {
    return {
      label: t('stockDetail.biasBullishLabel'),
      className: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
      description: t('stockDetail.biasBullishDescription'),
    };
  }
  if (bias === 'WEAK') {
    return {
      label: t('stockDetail.biasWeakLabel'),
      className: 'border-rose-700 bg-rose-950/40 text-rose-300',
      description: t('stockDetail.biasWeakDescription'),
    };
  }
  return {
    label: t('stockDetail.biasNeutralLabel'),
    className: 'border-slate-700 bg-slate-900/70 text-slate-300',
    description: t('stockDetail.biasNeutralDescription'),
  };
}

function PriceDepthPanel({ symbol, liveVolume }) {
  const { t, formatQuotePrice } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const prevVolumeRef = useRef(null);
  const debounceRef = useRef(null);
  const inFlightRef = useRef(false);
  const backoffUntilRef = useRef(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    const now = Date.now();
    if (inFlightRef.current) {
      return;
    }
    if (now < backoffUntilRef.current) {
      return;
    }

    inFlightRef.current = true;
    if (isRefresh) setRefreshing(true);
    try {
      const resp = await getPriceBoard(symbol);
      setData(resp.data);
      setError('');
    } catch (err) {
      if (err?.response?.status === 429) {
        // Apply local cool-down to avoid hammering endpoint when server throttles.
        backoffUntilRef.current = Date.now() + 15000;
        setError(t('stockDetail.depthRateLimited'));
      } else {
        setError(err.response?.data?.detail || t('stockDetail.orderbookFetchFailed'));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Trigger khi volume thay đổi (debounce 3s)
  useEffect(() => {
    if (liveVolume && liveVolume !== prevVolumeRef.current) {
      prevVolumeRef.current = liveVolume;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(true), 3000);
    }
  }, [liveVolume, fetchData]);

  // 30s polling
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const depth = data?.depth || [];
  const match = data?.match || {};
  const ref = match.reference_price;

  return (
    <section className="card-section p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('stockDetail.marketDepth')}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{t('stockDetail.orderbook3Levels')}</h3>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          {refreshing ? '⟳' : t('stockDetail.refresh')}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400">{error}</p>
      ) : depth.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('stockDetail.noDepthData')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <span>{t('stockDetail.bidVolume')}</span>
            <span>{t('stockDetail.bidPrice')}</span>
            <span>{t('stockDetail.askPrice')}</span>
            <span className="text-right">{t('stockDetail.askVolume')}</span>
          </div>
          <div className="mt-2 space-y-2">
            {depth.map((row) => (
              <div key={row.level} className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                <span className="text-slate-300">{fmtVol(row.bid_volume)}</span>
                <span className="font-semibold text-emerald-300">{formatQuotePrice(row.bid_price)}</span>
                <span className="font-semibold text-rose-300">{formatQuotePrice(row.ask_price)}</span>
                <span className="text-right text-slate-300">{fmtVol(row.ask_volume)}</span>
              </div>
            ))}
          </div>

          {/* Nước ngoài */}
          {(match.foreign_buy_volume != null || match.foreign_sell_volume != null) && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-[12px]">
              <div>
                <span className="text-slate-500">{t('stockDetail.foreignBuy')} </span>
                <span className="font-semibold text-cyan-300">{fmtVol(match.foreign_buy_volume)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">{t('stockDetail.foreignSell')} </span>
                <span className="font-semibold text-orange-300">{fmtVol(match.foreign_sell_volume)}</span>
              </div>
            </div>
          )}
          {ref && (
            <p className="mt-2 text-right text-[10px] text-slate-600">
              {t('stockDetail.reference')} {formatQuotePrice(ref)} · {data.fetched_at ? new Date(data.fetched_at).toLocaleTimeString(undefined) : ''}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ─── FinancialMetricsPanel ─────────────────────────────────────────────────

function MetricRow({ label, value, unit = '', highlight = false }) {
  const display = value !== null && value !== undefined
    ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`
    : '—';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-[12px] font-medium tabular-nums ${highlight && value ? 'text-emerald-400' : 'text-slate-200'}`}>
        {display}
      </span>
    </div>
  );
}

function FinancialMetricsPanel({ financials, loading, selectedYear, onYearChange }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <section className="card-section p-4 xl:col-span-3">
        <p className="text-label pb-2.5 border-b border-slate-800">{t('stockDetail.financialMetricsYearly')}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-900" />
          ))}
        </div>
      </section>
    );
  }

  const years = financials?.years || [];
  if (!years.length) {
    return (
      <section className="card-section p-4 xl:col-span-3">
        <p className="text-label pb-2.5 border-b border-slate-800">{t('stockDetail.financialMetricsYearly')}</p>
        <p className="mt-4 text-sm text-slate-500">{t('stockDetail.noFinancialData')}</p>
      </section>
    );
  }

  const row = years.find((y) => y.year === selectedYear) || years[0];

  return (
    <section className="card-section p-4 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <p className="text-label">{t('stockDetail.financialMetricsYearly')}</p>
        <div className="flex gap-1.5">
          {years.map((y) => (
            <button
              key={y.year}
              onClick={() => onYearChange(y.year)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                y.year === selectedYear
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {y.year}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Định giá */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-400">{t('stockDetail.valuation')}</p>
          <MetricRow label={t('stockDetail.metricEps')} value={row.eps} />
          <MetricRow label={t('stockDetail.metricPe')} value={row.pe} />
          <MetricRow label={t('stockDetail.metricPb')} value={row.pb} />
          <MetricRow label={t('stockDetail.metricPs')} value={row.ps} />
          <MetricRow label={t('stockDetail.metricBvps')} value={row.bvps} />
          <MetricRow label={t('stockDetail.metricMarketCapBn')} value={row.market_cap_bn} />
        </div>

        {/* Khả năng sinh lời */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">{t('stockDetail.profitability')}</p>
          <MetricRow label={t('stockDetail.metricRoe')} value={row.roe} unit="%" highlight />
          <MetricRow label={t('stockDetail.metricRoa')} value={row.roa} unit="%" highlight />
          <MetricRow label={t('stockDetail.metricNetMargin')} value={row.net_margin} unit="%" highlight />
          <MetricRow label={t('stockDetail.metricDividendYield')} value={row.dividend_yield} unit="%" />
        </div>

        {/* Sức mạnh tài chính */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400">{t('stockDetail.financialStrength')}</p>
          <MetricRow label={t('stockDetail.metricLeverage')} value={row.leverage} />
          <MetricRow label={t('stockDetail.metricDebtEquity')} value={row.debt_equity} />
          <MetricRow label={t('stockDetail.metricCurrentRatio')} value={row.current_ratio} />
          <MetricRow label={t('stockDetail.metricQuickRatio')} value={row.quick_ratio} />
        </div>
      </div>
    </section>
  );
}

function OrderFlowPanel({ symbol, loading, orderFlowData, latestRealtimeAlert, window: selectedWindow, onWindowChange }) {
  const { t } = useI18n();
  const cvdSeries = orderFlowData?.cvd_series || [];
  const darkFlow = orderFlowData?.dark_flow || {};
  const latestSignal = orderFlowData?.latest_signal || null;
  const signals = orderFlowData?.signals || [];
  const tickRate = orderFlowData?.tick_rate || {};
  const sizeDistribution = orderFlowData?.size_distribution || {};

  const chartData = cvdSeries.map((item) => ({
    ...item,
    label: item.bucket_ts ? new Date(item.bucket_ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—',
    cumulative_cvd: Number(item.cumulative_cvd || 0),
  }));

  const liveSignal = latestRealtimeAlert || latestSignal;
  const liveStrength = Number(liveSignal?.strength || darkFlow?.strength || 0);
  const smallOrderRatio = Number(
    liveSignal?.small_order_ratio ?? tickRate?.small_order_ratio ?? sizeDistribution?.small_ratio ?? 0
  );

  if (loading) {
    return <section className="card-section p-4"><div className="h-80 animate-pulse rounded-2xl bg-slate-900" /></section>;
  }

  return (
    <section className="card-section p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('stockDetail.orderFlowRadar')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('stockDetail.darkMoneyFor', { symbol })}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Window selector */}
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
            {['5m', '15m', '30m', '1h'].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onWindowChange?.(w)}
                className={`px-2.5 py-1 transition-colors ${
                  selectedWindow === w
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 uppercase tracking-widest">
              {String(darkFlow?.confidence || liveSignal?.confidence || 'low')}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
              {String(darkFlow?.signal_type || liveSignal?.signal_type || 'none')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('stockDetail.strength')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{liveStrength.toFixed(1)}</p>
          <div className="mt-3 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
              style={{ width: `${Math.max(4, Math.min(100, liveStrength))}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('stockDetail.tickRatePerMin')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{Number(tickRate?.tick_rate_per_min || 0).toFixed(1)}</p>
          <p className="mt-2 text-xs text-slate-400">{t('stockDetail.smallOrders')}: {(smallOrderRatio * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('stockDetail.realtimeEvent')}</p>
          <p className="mt-2 text-sm font-medium text-slate-100">{liveSignal?.description || darkFlow?.components?.absorption?.description || t('stockDetail.noRealtimeEvent')}</p>
          <p className="mt-2 text-[11px] text-slate-500">{liveSignal?.ts ? new Date(liveSignal.ts).toLocaleString(undefined) : '—'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">{t('stockDetail.cvd30m')}</p>
            <span className="text-[11px] text-slate-500">{t('stockDetail.bucketsCount', { count: chartData.length })}</span>
          </div>
          <div className="h-56">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                {t('stockDetail.noIntradayForCvd')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderFlowCvd" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatCompactNumber} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [formatCompactNumber(value), t('stockDetail.cvdSeries')]}
                    labelStyle={{ color: '#cbd5e1' }}
                    contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12 }}
                  />
                  <Area type="monotone" dataKey="cumulative_cvd" stroke="#22d3ee" fill="url(#orderFlowCvd)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm font-semibold text-slate-200">{t('stockDetail.recentSignals')}</p>
          <div className="panel-scrollbar mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
            {signals.length === 0 ? (
              <p className="text-sm text-slate-500">{t('stockDetail.noSavedSignals')}</p>
            ) : signals.map((item) => (
              <div key={item.id || `${item.symbol}-${item.created_at}`} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{item.signal_type}</p>
                  <p className="text-[11px] text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleTimeString(undefined) : '—'}</p>
                </div>
                <p className="mt-1 text-sm text-slate-200">{t('stockDetail.signalStrength')} {Number(item.strength || 0).toFixed(1)} • {item.confidence || 'low'}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t('stockDetail.signalTickRate')} {Number(item.tick_rate || 0).toFixed(1)} • {t('stockDetail.signalSmall')} {formatPercentDelta(Number(item.small_order_ratio || 0) * 100)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StockDetail() {
  const { t, formatQuotePrice } = useI18n();
  const { symbol } = useParams();
  const normalizedSymbol = (symbol || '').toUpperCase();
  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [technical, setTechnical] = useState(null);
  const [watchlistGroups, setWatchlistGroups] = useState([]);
  const [selectedWatchlistGroupId, setSelectedWatchlistGroupId] = useState('');
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [activePeriod, setActivePeriod] = useState(180);
  const [error, setError] = useState('');
  const [whaleFeedData, setWhaleFeedData] = useState(null);
  const [whaleFeedLoading, setWhaleFeedLoading] = useState(true);
  const [financials, setFinancials] = useState(null);
  const [financialsLoading, setFinancialsLoading] = useState(true);
  const [financialsYear, setFinancialsYear] = useState(null);
  const [advisorySession, setAdvisorySession] = useState(null);
  const [advisoryUserProvider, setAdvisoryUserProvider] = useState(null);
  const [advisoryComponents, setAdvisoryComponents] = useState([]);
  const [advisoryDeletedComponents, setAdvisoryDeletedComponents] = useState([]);
  const [advisoryExecutiveSummary, setAdvisoryExecutiveSummary] = useState(null);
  const [advisoryExecutiveSummaries, setAdvisoryExecutiveSummaries] = useState([]);
  const [activeAdvisoryComponentId, setActiveAdvisoryComponentId] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(true);
  const [advisoryComponentBusyId, setAdvisoryComponentBusyId] = useState(null);
  const [advisoryGeneratingComponents, setAdvisoryGeneratingComponents] = useState(false);
  const [advisoryClearingDeleted, setAdvisoryClearingDeleted] = useState(false);
  const [advisoryRegeneratingSummary, setAdvisoryRegeneratingSummary] = useState(false);
  const [advisoryDeletingSummary, setAdvisoryDeletingSummary] = useState(false);
  const [advisorySynthesisPreference, setAdvisorySynthesisPreference] = useState('balanced');
  const [advisoryMessage, setAdvisoryMessage] = useState('');
  const [advisorySessionConflict, setAdvisorySessionConflict] = useState(false);
  const [advisoryRetryTelemetry, setAdvisoryRetryTelemetry] = useState({
    scheduledCount: 0,
    recoveredCount: 0,
    failedCount: 0,
    lastReason: '',
    lastOutcome: 'idle',
    lastEventAt: null,
  });
  const [advisoryAggregate, setAdvisoryAggregate] = useState(null);
  const [advisoryObservability, setAdvisoryObservability] = useState(null);
  const [advisoryObservabilityLoading, setAdvisoryObservabilityLoading] = useState(false);
  const [advisoryObservabilityWindowHours, setAdvisoryObservabilityWindowHours] = useState(48);
  const [advisoryGovernanceBucket, setAdvisoryGovernanceBucket] = useState('hour');
  const [advisoryGovernanceEndpointFilter, setAdvisoryGovernanceEndpointFilter] = useState('all');
  const [advisoryGovernanceReasonFilter, setAdvisoryGovernanceReasonFilter] = useState('all');
  const [retryEventOutcomeFilter, setRetryEventOutcomeFilter] = useState('all');
  const [retryEventReasonFilter, setRetryEventReasonFilter] = useState('all');
  const [retryEventSortMode, setRetryEventSortMode] = useState('newest');
  const [advisoryChartContextState, setAdvisoryChartContextState] = useState({ used: null, warnings: [] });
  const [chartVisibleRange, setChartVisibleRange] = useState({ from_ts: null, to_ts: null });
  const [chartActiveIndicators, setChartActiveIndicators] = useState({ MA: true, VOL: true, MACD: true });
  const [orderFlowData, setOrderFlowData] = useState(null);
  const [orderFlowLoading, setOrderFlowLoading] = useState(true);
  const [orderFlowWindow, setOrderFlowWindow] = useState('30m');
  const advisoryConflictRetryTimeoutRef = useRef(null);
  const advisoryConflictRetryCountRef = useRef(0);
  const advisoryRetryTelemetrySyncKeyRef = useRef('');
  const advisoryInvalidationKeyRef = useRef('');

  const { quotesBySymbol, realtimeStatus, lastEventAt, alerts, darkFlowAlerts, latestWhaleAlert, latestDarkFlowAlert } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  // Lọc alerts và whale signals theo symbol hiện tại
  const symbolAlerts = alerts ? alerts.filter((a) => a.symbol === normalizedSymbol) : [];
  const symbolWhaleAlert = latestWhaleAlert && latestWhaleAlert.symbol === normalizedSymbol ? latestWhaleAlert : null;
  const symbolDarkFlowAlert = latestDarkFlowAlert && latestDarkFlowAlert.symbol === normalizedSymbol ? latestDarkFlowAlert : null;

  const filteredPersistedRetryEvents = useMemo(() => {
    return Array.isArray(advisoryObservability?.retry_events) ? advisoryObservability.retry_events : [];
  }, [advisoryObservability?.retry_events]);

  const retryEventReasonOptions = useMemo(() => {
    const events = Array.isArray(advisoryObservability?.retry_events) ? advisoryObservability.retry_events : [];
    const unique = Array.from(new Set(events.map((event) => String(event?.reason || '').toLowerCase()).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [advisoryObservability?.retry_events]);

  const governanceTrendRows = useMemo(() => {
    const rows = Array.isArray(advisoryObservability?.governance?.rollout_gate_deny_trend)
      ? advisoryObservability.governance.rollout_gate_deny_trend
      : [];
    if (rows.length === 0) {
      return [];
    }
    const maxDeny = Math.max(1, ...rows.map((row) => Number(row?.deny_total || 0)));
    return rows.slice(-8).map((row) => {
      const denyTotal = Number(row?.deny_total || 0);
      const topEndpoint = Object.entries(row?.deny_by_endpoint || {}).sort((a, b) => Number(b?.[1] || 0) - Number(a?.[1] || 0))[0]?.[0] || 'n/a';
      const topReason = Object.entries(row?.deny_by_reason || {}).sort((a, b) => Number(b?.[1] || 0) - Number(a?.[1] || 0))[0]?.[0] || 'n/a';
      const topCohort = Object.entries(row?.deny_by_cohort_mode || {}).sort((a, b) => Number(b?.[1] || 0) - Number(a?.[1] || 0))[0]?.[0] || 'n/a';
      return {
        bucket: row?.bucket || '',
        denyTotal,
        widthPercent: Math.max(8, Math.round((denyTotal / maxDeny) * 100)),
        topEndpoint,
        topReason,
        topCohort,
        tooltipText: [
          `${t('stockDetail.governanceDenyCount')}: ${denyTotal}`,
          `${t('stockDetail.governanceTopEndpoint')}: ${advisoryGovernanceEndpointLabel(topEndpoint, t)}`,
          `${t('stockDetail.governanceTopReason')}: ${advisoryGovernanceReasonLabel(topReason, t)}`,
          `${t('stockDetail.governanceTopCohort')}: ${topCohort}`,
        ].join(' | '),
      };
    });
  }, [advisoryObservability?.governance?.rollout_gate_deny_trend, t]);

  const governanceEndpointOptions = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_endpoint || {};
    return Object.keys(map).sort((a, b) => a.localeCompare(b));
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_endpoint]);

  const governanceReasonOptions = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_reason || {};
    return Object.keys(map).sort((a, b) => a.localeCompare(b));
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_reason]);

  const governanceEndpointBreakdown = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_endpoint || {};
    return Object.entries(map)
      .map(([key, count]) => ({ key, count: Number(count || 0) }))
      .sort((a, b) => b.count - a.count);
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_endpoint]);

  const governanceReasonBreakdown = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_reason || {};
    return Object.entries(map)
      .map(([key, count]) => ({ key, count: Number(count || 0) }))
      .sort((a, b) => b.count - a.count);
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_reason]);

  const governanceSparkline = useMemo(() => {
    if (!governanceTrendRows.length) {
      return null;
    }
    const values = governanceTrendRows.map((row) => Number(row.denyTotal || 0));
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const width = 220;
    const height = 44;
    const pointItems = values.map((value, idx) => {
      const x = values.length === 1 ? 0 : Math.round((idx / (values.length - 1)) * width);
      const y = Math.round(height - ((value / max) * height));
      return {
        x,
        y,
        value,
        bucket: governanceTrendRows[idx]?.bucket || '',
      };
    });
    const polylinePoints = pointItems.map((point) => `${point.x},${point.y}`).join(' ');
    const maxValue = Math.max(...values);
    const maxPoint = pointItems.find((point) => point.value === maxValue) || null;
    const baseline = values.reduce((sum, value) => sum + value, 0) / values.length;
    const baselineY = Math.round(height - ((baseline / max) * height));
    const latest = values[values.length - 1] || 0;
    const previous = values.length > 1 ? values[values.length - 2] : latest;
    const latestDeltaVsBaseline = latest - baseline;
    const thresholds = {
      warning: Number(advisoryObservability?.governance?.delta_thresholds?.warning ?? 2),
      critical: Number(advisoryObservability?.governance?.delta_thresholds?.critical ?? 4),
      cooldown: Number(advisoryObservability?.governance?.delta_thresholds?.cooldown ?? 2),
    };
    const deltaSeverity = governanceDeltaSeverity(latestDeltaVsBaseline, thresholds);
    return {
      pointItems,
      polylinePoints,
      width,
      height,
      min,
      max,
      baseline,
      baselineY,
      latest,
      previous,
      latestDeltaVsBaseline,
      thresholds,
      deltaSeverity,
      maxPoint,
    };
  }, [advisoryObservability?.governance?.delta_thresholds, governanceTrendRows]);

  const refreshWhaleFeed = useCallback(async () => {
    setWhaleFeedLoading(true);
    try {
      const response = await getWhaleFeed(normalizedSymbol);
      setWhaleFeedData(response.data);
    } catch (_) {
    } finally {
      setWhaleFeedLoading(false);
    }
  }, [normalizedSymbol]);

  const fetchAdvisorySession = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) {
      setAdvisoryLoading(true);
    }
    try {
      const retryAttemptsUsed = advisoryConflictRetryCountRef.current;
      const response = await getStockAIAdvisorySession(normalizedSymbol, { contract: 'v2', include_benchmarks: 1 });
      const payload = response?.data || {};
      if (advisoryConflictRetryTimeoutRef.current) {
        clearTimeout(advisoryConflictRetryTimeoutRef.current);
        advisoryConflictRetryTimeoutRef.current = null;
      }
      advisoryConflictRetryCountRef.current = 0;
      if (retryAttemptsUsed > 0) {
        setAdvisoryRetryTelemetry((prev) => ({
          ...prev,
          recoveredCount: prev.recoveredCount + 1,
          lastReason: '',
          lastOutcome: 'recovered',
          lastEventAt: new Date().toISOString(),
        }));
      }
      setAdvisorySessionConflict(false);
      setAdvisorySession(payload.advisory || null);
      setAdvisoryAggregate(payload.aggregate || null);
      setAdvisoryUserProvider(payload.user_ai_provider || null);
      const nextComponents = Array.isArray(payload.components) ? payload.components : [];
      const nextDeletedComponents = Array.isArray(payload.deleted_components) ? payload.deleted_components : [];
      setAdvisoryComponents(nextComponents);
      setAdvisoryDeletedComponents(nextDeletedComponents);
      const nextSummaries = Array.isArray(payload.executive_summaries) ? payload.executive_summaries : [];
      setAdvisoryExecutiveSummaries(nextSummaries);
      setAdvisoryExecutiveSummary(payload.executive_summary || nextSummaries[0] || null);
      setActiveAdvisoryComponentId((prev) => {
        if (prev && nextComponents.some((item) => item.id === prev)) {
          return prev;
        }
        return nextComponents[0]?.id || null;
      });
      if (payload.message) {
        setAdvisoryMessage(payload.message);
      }

      const advisory = payload?.advisory || null;
      const advisoryKey = [
        normalizedSymbol,
        advisory?.id || 'none',
        advisory?.created_at || 'none',
      ].join(':');
      if (advisoryKey !== advisoryInvalidationKeyRef.current) {
        advisoryInvalidationKeyRef.current = advisoryKey;
        emitAdvisoryInvalidation(normalizedSymbol, advisory);
      }
    } catch (err) {
      if (err?.response?.status === 409) {
        const conflictState = resolveAdvisoryConflictState(err?.response?.data, t);
        setAdvisorySession(conflictState.advisory);
        setAdvisoryAggregate(conflictState.aggregate);
        setAdvisoryUserProvider(conflictState.userAiProvider);
        setAdvisoryComponents(conflictState.components);
        setAdvisoryDeletedComponents(conflictState.deletedComponents);
        setAdvisoryExecutiveSummaries(conflictState.executiveSummaries);
        setAdvisoryExecutiveSummary(conflictState.executiveSummary || conflictState.executiveSummaries[0] || null);
        setActiveAdvisoryComponentId((prev) => {
          if (prev && conflictState.components.some((item) => item.id === prev)) {
            return prev;
          }
          return conflictState.components[0]?.id || null;
        });
        const canAutoRetry = shouldAutoRetryAdvisoryConflict(conflictState);
        const attempt = advisoryConflictRetryCountRef.current + 1;
        const maxRetryAttempts = 3;

        if (canAutoRetry && attempt <= maxRetryAttempts) {
          const retryDelayMs = getAdvisoryConflictRetryDelayMs(attempt);
          advisoryConflictRetryCountRef.current = attempt;
          setAdvisoryRetryTelemetry((prev) => ({
            ...prev,
            scheduledCount: prev.scheduledCount + 1,
            lastReason: conflictState.reason || 'conflict',
            lastOutcome: 'scheduled',
            lastEventAt: new Date().toISOString(),
          }));

          if (advisoryConflictRetryTimeoutRef.current) {
            clearTimeout(advisoryConflictRetryTimeoutRef.current);
          }

          advisoryConflictRetryTimeoutRef.current = setTimeout(() => {
            advisoryConflictRetryTimeoutRef.current = null;
            fetchAdvisorySession({ silent: true });
          }, retryDelayMs);

          const retrySeconds = Math.max(1, Math.ceil(retryDelayMs / 1000));
          setAdvisoryMessage(`${conflictState.message} ${t('stockDetail.aiAdvisoryAutoRetryInSeconds', { seconds: retrySeconds })}`);
        } else {
          if (canAutoRetry && attempt > maxRetryAttempts) {
            setAdvisoryRetryTelemetry((prev) => ({
              ...prev,
              failedCount: prev.failedCount + 1,
              lastReason: conflictState.reason || 'conflict',
              lastOutcome: 'exhausted',
              lastEventAt: new Date().toISOString(),
            }));
          } else {
            setAdvisoryRetryTelemetry((prev) => ({
              ...prev,
              lastReason: conflictState.reason || 'ai_not_configured',
              lastOutcome: 'skipped_config',
              lastEventAt: new Date().toISOString(),
            }));
          }
          setAdvisoryMessage(conflictState.message);
        }
        setAdvisorySessionConflict(true);
        return;
      }
      if (advisoryConflictRetryTimeoutRef.current) {
        clearTimeout(advisoryConflictRetryTimeoutRef.current);
        advisoryConflictRetryTimeoutRef.current = null;
      }
      if (advisoryConflictRetryCountRef.current > 0) {
        setAdvisoryRetryTelemetry((prev) => ({
          ...prev,
          failedCount: prev.failedCount + 1,
          lastReason: 'request_error',
          lastOutcome: 'request_error',
          lastEventAt: new Date().toISOString(),
        }));
      }
      advisoryConflictRetryCountRef.current = 0;
      setAdvisorySessionConflict(false);
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.loadAiAdvisoryFailed'));
    } finally {
      if (!silent) {
        setAdvisoryLoading(false);
      }
    }
  }, [normalizedSymbol, t]);

  useEffect(() => () => {
    if (advisoryConflictRetryTimeoutRef.current) {
      clearTimeout(advisoryConflictRetryTimeoutRef.current);
      advisoryConflictRetryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    advisoryConflictRetryCountRef.current = 0;
    if (advisoryConflictRetryTimeoutRef.current) {
      clearTimeout(advisoryConflictRetryTimeoutRef.current);
      advisoryConflictRetryTimeoutRef.current = null;
    }
    advisoryRetryTelemetrySyncKeyRef.current = '';
    setRetryEventOutcomeFilter('all');
    setRetryEventReasonFilter('all');
    setRetryEventSortMode('newest');
    setAdvisoryObservabilityWindowHours(48);
    setAdvisoryGovernanceBucket('hour');
    setAdvisoryGovernanceEndpointFilter('all');
    setAdvisoryGovernanceReasonFilter('all');
    setAdvisoryRetryTelemetry({
      scheduledCount: 0,
      recoveredCount: 0,
      failedCount: 0,
      lastReason: '',
      lastOutcome: 'idle',
      lastEventAt: null,
    });
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    if (!advisoryRetryTelemetry.lastEventAt) return;
    if (advisoryRetryTelemetry.lastOutcome === 'idle') return;

    const syncKey = [
      normalizedSymbol,
      advisoryRetryTelemetry.lastEventAt,
      advisoryRetryTelemetry.lastOutcome,
      advisoryRetryTelemetry.lastReason,
      advisoryRetryTelemetry.scheduledCount,
      advisoryRetryTelemetry.recoveredCount,
      advisoryRetryTelemetry.failedCount,
    ].join('|');

    if (advisoryRetryTelemetrySyncKeyRef.current === syncKey) {
      return;
    }
    advisoryRetryTelemetrySyncKeyRef.current = syncKey;

    postStockAIAdvisoryObservabilityEvent(normalizedSymbol, {
      event_type: 'frontend_retry_telemetry',
      outcome: advisoryRetryTelemetry.lastOutcome,
      client_ts: new Date().toISOString(),
      telemetry: {
        scheduled_count: advisoryRetryTelemetry.scheduledCount,
        recovered_count: advisoryRetryTelemetry.recoveredCount,
        failed_count: advisoryRetryTelemetry.failedCount,
        last_reason: advisoryRetryTelemetry.lastReason,
        last_event_at: advisoryRetryTelemetry.lastEventAt,
      },
    }).catch(() => {
      // Keep telemetry sync best-effort; UX must not fail if logging endpoint is unavailable.
    });
  }, [
    advisoryRetryTelemetry.failedCount,
    advisoryRetryTelemetry.lastEventAt,
    advisoryRetryTelemetry.lastOutcome,
    advisoryRetryTelemetry.lastReason,
    advisoryRetryTelemetry.recoveredCount,
    advisoryRetryTelemetry.scheduledCount,
    normalizedSymbol,
  ]);

  const fetchAdvisoryObservability = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) {
      setAdvisoryObservabilityLoading(true);
    }
    try {
      const params = {
        window_hours: advisoryObservabilityWindowHours,
        limit: 12,
        retry_sort: retryEventSortMode,
        governance_bucket: advisoryGovernanceBucket,
      };
      if (advisoryGovernanceEndpointFilter !== 'all') {
        params.governance_endpoint = advisoryGovernanceEndpointFilter;
      }
      if (advisoryGovernanceReasonFilter !== 'all') {
        params.governance_reason = advisoryGovernanceReasonFilter;
      }
      if (retryEventOutcomeFilter !== 'all') {
        params.retry_outcome = retryEventOutcomeFilter;
      }
      if (retryEventReasonFilter !== 'all') {
        params.retry_reason = retryEventReasonFilter;
      }
      const response = await getStockAIAdvisoryObservability(normalizedSymbol, {
        ...params,
      });
      setAdvisoryObservability(response?.data || null);
    } catch (_) {
      if (!silent) {
        setAdvisoryObservability(null);
      }
    } finally {
      if (!silent) {
        setAdvisoryObservabilityLoading(false);
      }
    }
  }, [advisoryGovernanceBucket, advisoryGovernanceEndpointFilter, advisoryGovernanceReasonFilter, advisoryObservabilityWindowHours, normalizedSymbol, retryEventOutcomeFilter, retryEventReasonFilter, retryEventSortMode]);

  const fetchOrderFlow = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) setOrderFlowLoading(true);
    try {
      const response = await getStockOrderFlow(normalizedSymbol, orderFlowWindow);
      setOrderFlowData(response?.data || null);
    } catch (err) {
      console.error('getStockOrderFlow:', err);
      setOrderFlowData(null);
    } finally {
      if (!silent) setOrderFlowLoading(false);
    }
  }, [normalizedSymbol, orderFlowWindow]);

  useEffect(() => {
    let cancelled = false;

    const fetchWatchlistGroups = async () => {
      try {
        const response = await getWatchlistGroups();
        if (!cancelled) {
          setWatchlistGroups(response.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('getWatchlistGroups:', err);
        }
      }
    };

    fetchWatchlistGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    let cancelled = false;

    const fetchOverview = async () => {
      setLoadingOverview(true);
      setError('');
      try {
        const response = await getStockWorkspaceOverview(normalizedSymbol);
        if (!cancelled) {
          setOverview(response.data);
          if (!selectedWatchlistGroupId && response.data?.watchlist_memberships?.length > 0) {
            setSelectedWatchlistGroupId(String(response.data.watchlist_memberships[0].group_id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || t('stockDetail.loadSymbolDataFailed', { symbol: normalizedSymbol }));
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    };

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, selectedWatchlistGroupId]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    let cancelled = false;

    const fetchChart = async () => {
      setLoadingChart(true);
      try {
        const response = await getStockPriceChart(normalizedSymbol, activePeriod);
        if (!cancelled) {
          setChartData(response.data.points || []);
          setTechnical(response.data.technical || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('getStockPriceChart:', err);
          setChartData([]);
          setTechnical(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingChart(false);
        }
      }
    };

    fetchChart();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, activePeriod]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;
    const runRefresh = async () => {
      setWhaleFeedLoading(true);
      try {
        const response = await getWhaleFeed(normalizedSymbol);
        if (!cancelled) {
          setWhaleFeedData(response.data);
        }
      } catch (_) {
      } finally {
        if (!cancelled) {
          setWhaleFeedLoading(false);
        }
      }
    };
    runRefresh();
    const interval = setInterval(runRefresh, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchAdvisorySession({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchAdvisorySession, normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchAdvisoryObservability({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchAdvisoryObservability, normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchOrderFlow({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchOrderFlow, normalizedSymbol]);

  const prevWhaleRef = useRef(null);
  useEffect(() => {
    if (symbolWhaleAlert && symbolWhaleAlert?.ts !== prevWhaleRef.current) {
      prevWhaleRef.current = symbolWhaleAlert.ts;
      refreshWhaleFeed();
    }
  }, [symbolWhaleAlert, refreshWhaleFeed]);

  const prevDarkFlowRef = useRef(null);
  useEffect(() => {
    if (symbolDarkFlowAlert && symbolDarkFlowAlert?.ts !== prevDarkFlowRef.current) {
      prevDarkFlowRef.current = symbolDarkFlowAlert.ts;
      fetchOrderFlow({ silent: true });
    }
  }, [symbolDarkFlowAlert, fetchOrderFlow]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;
    setFinancialsLoading(true);
    getStockFinancials(normalizedSymbol)
      .then((r) => {
        if (!cancelled) {
          setFinancials(r.data);
          if (r.data?.years?.length) setFinancialsYear(r.data.years[0].year);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFinancialsLoading(false); });
    return () => { cancelled = true; };
  }, [normalizedSymbol]);

  const liveQuote = quotesBySymbol[normalizedSymbol] || {};
  const currentPrice = liveQuote.current_price ?? overview?.current_price ?? overview?.close_price ?? null;
  const changeValue = liveQuote.change_value ?? overview?.change_value ?? null;
  const changePct = liveQuote.change_pct ?? overview?.change_pct ?? null;
  const liveHighPrice = liveQuote.high_price ?? overview?.high_price ?? null;
  const liveLowPrice = liveQuote.low_price ?? overview?.low_price ?? null;
  const liveVolume = liveQuote.volume ?? overview?.volume ?? null;

  const changeClass = useMemo(() => {
    if (changeValue > 0) {
      return 'text-emerald-400';
    }
    if (changeValue < 0) {
      return 'text-rose-400';
    }
    return 'text-slate-300';
  }, [changeValue]);

  const chartPerformance = useMemo(() => {
    if (!chartData.length) {
      return null;
    }
    const firstClose = Number(chartData[0]?.close || 0);
    const lastClose = Number(chartData[chartData.length - 1]?.close || 0);
    if (firstClose <= 0) {
      return null;
    }
    return ((lastClose - firstClose) / firstClose) * 100;
  }, [chartData]);

  const technicalBiasFallback = biasMeta(technical?.bias, t);
  const technicalBias = {
    ...technicalBiasFallback,
    label: technical?.bias_label || technicalBiasFallback.label,
    description: technical?.bias_description || technicalBiasFallback.description,
  };

  const availableWatchlistGroups = useMemo(
    () => watchlistGroups.filter((group) => !overview?.watchlist_memberships?.some((item) => item.group_id === group.id)),
    [overview?.watchlist_memberships, watchlistGroups],
  );

  useEffect(() => {
    if (!selectedWatchlistGroupId && availableWatchlistGroups.length > 0) {
      setSelectedWatchlistGroupId(String(availableWatchlistGroups[0].id));
    }
  }, [availableWatchlistGroups, selectedWatchlistGroupId]);

  const refreshWorkspace = async () => {
    const [overviewResponse, chartResponse] = await Promise.all([
      getStockWorkspaceOverview(normalizedSymbol),
      getStockPriceChart(normalizedSymbol, activePeriod),
    ]);
    setOverview(overviewResponse.data);
    setChartData(chartResponse.data.points || []);
    setTechnical(chartResponse.data.technical || null);
  };

  const showWorkspaceMessage = (message) => {
    setWorkspaceMessage(message);
    setTimeout(() => setWorkspaceMessage(''), 4000);
  };

  const handleToggleTracked = async () => {
    setWorkspaceError('');
    setActionLoading('tracked');
    try {
      if (overview.is_tracked && overview.tracked_symbol_id) {
        await deleteTrackedSymbol(overview.tracked_symbol_id);
        showWorkspaceMessage(t('stockDetail.removedFromShortlist', { symbol: normalizedSymbol }));
      } else {
        const sourceGroupId = overview.market_group_refs?.[0]?.id || null;
        await addTrackedSymbol(normalizedSymbol, sourceGroupId);
        showWorkspaceMessage(t('stockDetail.addedToShortlist', { symbol: normalizedSymbol }));
      }
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.updateShortlistFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleAddToWatchlist = async () => {
    if (!selectedWatchlistGroupId) {
      setWorkspaceError(t('stockDetail.noPersonalWatchlist'));
      return;
    }

    setWorkspaceError('');
    setActionLoading('watchlist-add');
    try {
      await addWatchlistItem(Number(selectedWatchlistGroupId), normalizedSymbol);
      showWorkspaceMessage(t('stockDetail.addedToPersonalWatchlist', { symbol: normalizedSymbol }));
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.addToPersonalWatchlistFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRemoveFromWatchlist = async (itemId, groupName) => {
    setWorkspaceError('');
    setActionLoading(`watchlist-remove-${itemId}`);
    try {
      await deleteWatchlistItem(itemId);
      showWorkspaceMessage(t('stockDetail.removedFromGroup', { symbol: normalizedSymbol, group: groupName }));
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.removeFromPersonalWatchlistFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateAlert = async () => {
    const targetPrice = Number(alertTargetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setWorkspaceError(t('stockDetail.alertPriceMustBePositive'));
      return;
    }

    setWorkspaceError('');
    setActionLoading('alert');
    try {
      await createPriceAlert({
        symbol: normalizedSymbol,
        condition: targetPrice >= Number(currentPrice || 0) ? 'ABOVE' : 'BELOW',
        target_price: targetPrice,
        cooldown_seconds: 300,
        is_active: true,
      });
      setAlertTargetPrice('');
      showWorkspaceMessage(t('stockDetail.priceAlertCreated', { symbol: normalizedSymbol }));
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.createPriceAlertFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRefreshActiveAdvisoryComponent = async (componentId) => {
    if (!componentId) return;
    try {
      const cfgResp = await getUserConfig();
      const cfg = cfgResp?.data || {};
      if (!cfg.ai_ready) {
        setAdvisoryMessage(cfg.ai_config_message || 'Vui lòng cấu hình AI model và API key trước khi dùng AI advisory.');
        return;
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không kiểm tra được cấu hình AI hiện tại.');
      return;
    }
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await refreshStockAIAdvisoryComponent(componentId);
      const payload = response?.data || {};
      const refreshed = payload.component;
      if (refreshed?.id) {
        setAdvisoryComponents((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
        setActiveAdvisoryComponentId(refreshed.id);
      }
      setAdvisoryMessage(payload.message || t('stockDetail.refreshAiTabSuccess'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.refreshAiTabFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const buildChartContextPayload = useCallback(() => {
    const normalizedPoints = (Array.isArray(chartData) ? chartData : [])
      .map((item) => {
        const ts = item?.date ? new Date(item.date).getTime() : null;
        if (!Number.isFinite(ts)) return null;
        return {
          ts,
          o: Number(item?.open ?? item?.close ?? 0),
          h: Number(item?.high ?? item?.close ?? 0),
          l: Number(item?.low ?? item?.close ?? 0),
          c: Number(item?.close ?? 0),
          v: Number(item?.volume ?? 0),
        };
      })
      .filter(Boolean)
      .slice(-300);

    const fallbackFromTs = normalizedPoints[0]?.ts ?? null;
    const fallbackToTs = normalizedPoints[normalizedPoints.length - 1]?.ts ?? null;
    const fromTs = Number.isFinite(Number(chartVisibleRange?.from_ts)) ? Number(chartVisibleRange.from_ts) : fallbackFromTs;
    const toTs = Number.isFinite(Number(chartVisibleRange?.to_ts)) ? Number(chartVisibleRange.to_ts) : fallbackToTs;

    const avgVol = normalizedPoints.length
      ? normalizedPoints.reduce((sum, row) => sum + Number(row.v || 0), 0) / normalizedPoints.length
      : 0;
    const latestVol = normalizedPoints.length ? Number(normalizedPoints[normalizedPoints.length - 1].v || 0) : 0;

    return {
      symbol: normalizedSymbol,
      chart_timeframe: orderFlowWindow || '30m',
      visible_range: {
        from_ts: fromTs,
        to_ts: toTs,
      },
      ohlcv: normalizedPoints,
      active_indicators: chartActiveIndicators,
      computed_metrics: {
        change_visible_pct: Number(chartPerformance ?? 0),
        volatility_visible: Number(technical?.volatility_20 ?? 0),
        volume_ratio_vs_20: avgVol > 0 ? Number((latestVol / avgVol).toFixed(4)) : 0,
        atr_estimate: Number(technical?.atr ?? 0),
      },
      client_generated_at: new Date().toISOString(),
    };
  }, [chartActiveIndicators, chartData, chartPerformance, chartVisibleRange?.from_ts, chartVisibleRange?.to_ts, normalizedSymbol, orderFlowWindow, technical?.atr, technical?.volatility_20]);

  const handleGenerateAdvisoryComponents = async () => {
    if (!normalizedSymbol) return;
    try {
      const cfgResp = await getUserConfig();
      const cfg = cfgResp?.data || {};
      if (!cfg.ai_ready) {
        setAdvisoryMessage(cfg.ai_config_message || 'Vui lòng cấu hình AI model và API key trước khi dùng AI advisory.');
        return;
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không kiểm tra được cấu hình AI hiện tại.');
      return;
    }
    setAdvisoryGeneratingComponents(true);

    // Nếu chưa có advisory gốc, tạo mới trước khi generate components
    let currentSession = advisorySession;
    if (!currentSession) {
      try {
        setAdvisoryMessage('Đang tạo advisory AI gốc, vui lòng đợi...');
        const sessionResp = await refreshStockAIAdvisorySession(normalizedSymbol);
        const sessionPayload = sessionResp?.data || {};
        if (sessionPayload.advisory) {
          // Sync fallback: có advisory ngay
          currentSession = sessionPayload.advisory;
          setAdvisorySession(currentSession);
          emitAdvisoryInvalidation(normalizedSymbol, currentSession);
          if (Array.isArray(sessionPayload.components)) setAdvisoryComponents(sessionPayload.components);
          if (Array.isArray(sessionPayload.executive_summaries)) setAdvisoryExecutiveSummaries(sessionPayload.executive_summaries);
        } else {
          // Async: đã queue, cần đợi
          setAdvisoryMessage(sessionPayload.message || 'Đã gửi yêu cầu tạo advisory AI. Vui lòng đợi vài giây rồi bấm lại.');
          setAdvisoryGeneratingComponents(false);
          // Tự động thử lại sau 5 giây
          setTimeout(() => fetchAdvisorySession({ silent: true }), 5000);
          return;
        }
      } catch (err) {
        setAdvisoryMessage(err?.response?.data?.message || 'Không thể tạo advisory gốc. Vui lòng thử lại.');
        setAdvisoryGeneratingComponents(false);
        return;
      }
    }

    try {
      const response = await generateStockAIAdvisoryComponents(normalizedSymbol, {
        timeframe: orderFlowWindow || '30m',
        chart_context: buildChartContextPayload(),
      });
      const payload = response?.data || {};
      const nextComponents = Array.isArray(payload.components) ? payload.components : [];
      const nextWarnings = Array.isArray(payload.chart_context_warnings) ? payload.chart_context_warnings : [];
      setAdvisoryChartContextState({
        used: typeof payload.chart_context_used === 'boolean' ? payload.chart_context_used : null,
        warnings: nextWarnings,
      });
      setAdvisoryComponents(nextComponents);
      setAdvisoryDeletedComponents([]);
      setActiveAdvisoryComponentId(nextComponents[0]?.id || null);
      const generationSource = payload.generated_by_ai ? 'AI schema' : 'template fallback';
      const contextUsage = payload.chart_context_used
        ? 'Chart context: used'
        : 'Chart context: fallback';
      const warningSuffix = Array.isArray(payload.chart_context_warnings) && payload.chart_context_warnings.length
        ? ` (${payload.chart_context_warnings.join(', ')})`
        : '';
      setAdvisoryMessage(
        payload.message
          || `${t('stockDetail.generateTabsSuccess', { count: payload.created_count || nextComponents.length || 0, source: generationSource })} | ${contextUsage}${warningSuffix}`
      );
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.generateTabsFailed'));
    } finally {
      setAdvisoryGeneratingComponents(false);
    }
  };

  const handleToggleComponentInclude = async (componentId) => {
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await toggleStockAIAdvisoryComponentInclude(componentId);
      const updated = response?.data?.component;
      if (updated) {
        setAdvisoryComponents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.updateIncludeFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleDeleteAdvisoryComponent = async (componentId) => {
    setAdvisoryComponentBusyId(componentId);
    try {
      await deleteStockAIAdvisoryComponent(componentId);
      setAdvisoryComponents((prev) => {
        const deletedComponent = prev.find((item) => item.id === componentId);
        if (deletedComponent) {
          setAdvisoryDeletedComponents((deletedPrev) => [
            { ...deletedComponent, is_deleted: true, include_in_summary: false },
            ...deletedPrev.filter((item) => item.id !== componentId),
          ].slice(0, 20));
        }
        const next = prev.filter((item) => item.id !== componentId);
        if (activeAdvisoryComponentId === componentId) {
          setActiveAdvisoryComponentId(next[0]?.id || null);
        }
        return next;
      });
      setAdvisoryMessage(t('stockDetail.deleteTabSuccess'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.deleteTabFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleRestoreAdvisoryComponent = async (componentId) => {
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await restoreStockAIAdvisoryComponent(componentId);
      const restored = response?.data?.component;
      if (restored) {
        setAdvisoryDeletedComponents((prev) => prev.filter((item) => item.id !== restored.id));
        setAdvisoryComponents((prev) => [restored, ...prev.filter((item) => item.id !== restored.id)]);
        setActiveAdvisoryComponentId(restored.id);
      }
      setAdvisoryMessage(t('stockDetail.restoreTabSuccess'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.restoreTabFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleClearDeletedAdvisoryComponents = async () => {
    if (!normalizedSymbol || advisoryClearingDeleted) return;
    setAdvisoryClearingDeleted(true);
    try {
      const response = await clearDeletedStockAIAdvisoryComponents(normalizedSymbol);
      const deletedCount = Number(response?.data?.deleted_count || advisoryDeletedComponents.length || 0);
      setAdvisoryDeletedComponents([]);
      setAdvisoryMessage(`Deleted tabs cleaned: ${deletedCount}`);
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Khong the xoa Deleted tabs luc nay.');
    } finally {
      setAdvisoryClearingDeleted(false);
    }
  };

  const handleRegenerateExecutiveSummary = async () => {
    if (!normalizedSymbol) return;
    try {
      const cfgResp = await getUserConfig();
      const cfg = cfgResp?.data || {};
      if (!cfg.ai_ready) {
        setAdvisoryMessage(cfg.ai_config_message || 'Vui lòng cấu hình AI model và API key trước khi dùng AI advisory.');
        return;
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không kiểm tra được cấu hình AI hiện tại.');
      return;
    }
    setAdvisoryRegeneratingSummary(true);
    try {
      const activeIds = advisoryComponents.filter((item) => item.include_in_summary).map((item) => item.id);
      const response = await regenerateStockAIExecutiveSummary(normalizedSymbol, {
        component_ids: activeIds,
        synthesis_preference: advisorySynthesisPreference,
      });
      const summary = response?.data?.executive_summary || null;
      setAdvisoryExecutiveSummary(summary);
      if (summary) {
        setAdvisoryExecutiveSummaries((prev) => [summary, ...prev.filter((item) => item.id !== summary.id)].slice(0, 8));
      }
      setAdvisoryMessage(summary ? t('stockDetail.summaryRebuiltVersion', { version: summary.summary_version }) : t('stockDetail.summaryRebuilt'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.summaryRebuildFailed'));
    } finally {
      setAdvisoryRegeneratingSummary(false);
    }
  };

  const handleDeleteExecutiveSummary = async () => {
    if (!normalizedSymbol || !advisoryExecutiveSummary?.id) return;
    setAdvisoryDeletingSummary(true);
    try {
      await deleteStockAIExecutiveSummary(normalizedSymbol, advisoryExecutiveSummary.id);
      setAdvisoryExecutiveSummaries((prev) => {
        const next = prev.filter((item) => item.id !== advisoryExecutiveSummary.id);
        setAdvisoryExecutiveSummary(next[0] || null);
        return next;
      });
      setAdvisoryMessage('Da xoa thong tin tong hop.');
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Khong the xoa thong tin tong hop.');
    } finally {
      setAdvisoryDeletingSummary(false);
    }
  };

  const activeAdvisoryComponent = advisoryComponents.find((item) => item.id === activeAdvisoryComponentId) || advisoryComponents[0] || null;


  if (loadingOverview) {
    return (
      <div className="mx-auto max-w-[1800px] space-y-4 p-4 xl:px-5">
        <div className="h-44 animate-pulse rounded-[24px] bg-slate-900" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className="h-[560px] animate-pulse rounded-[24px] bg-slate-900" />
          <div className="h-[560px] animate-pulse rounded-[24px] bg-slate-900" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-[28px] border border-rose-900/70 bg-rose-950/30 p-8 text-center">
          <p className="text-sm font-semibold text-rose-300">{t('stockDetail.workspaceOpenFailed')}</p>
          <p className="mt-2 text-sm text-slate-400">{error || t('stockDetail.workspaceNotFound', { symbol: normalizedSymbol })}</p>
          <Link to="/watchlist" className="mt-4 inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500 hover:text-white">
            {t('stockDetail.backToRadar')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 p-4 xl:px-5">
      {/* Header Quote Section */}
      <section className="card-section overflow-hidden shadow-[0_18px_60px_rgba(2,6,23,0.45)] border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))]">
        {/* Top bar: breadcrumb + feed status */}
        <div className="border-b border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-label">
              <Link to="/watchlist" className="transition-colors hover:text-slate-300">
                {t('layout.nav.watchlist')}
              </Link>
              <span>/</span>
              <span>{t('stockDetail.stockWorkspace')}</span>
              <span>/</span>
              <span>{overview.symbol}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400">
                {t('stockDetail.feed')} {realtimeStatus === 'live' ? t('stockDetail.statusRealtime') : realtimeStatus === 'polling' ? t('stockDetail.statusFallback') : t('stockDetail.statusConnecting')}
                {lastEventAt ? ` · ${new Date(lastEventAt).toLocaleTimeString(undefined)}` : ''}
              </div>
              <Link
                to={`/whale-alerts/${normalizedSymbol}`}
                className="flex items-center gap-1.5 rounded-full border border-cyan-700/60 bg-cyan-950/30 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/30"
              >
                🦈 {t('stockDetail.whaleDashboard')}
              </Link>
            </div>
          </div>
        </div>

        {/* Quote + key metrics grid */}
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(460px,0.95fr)]">
          <div className="space-y-4">
            {/* Symbol + name + exchange */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-2xl font-bold text-cyan-300">
                {overview.symbol}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{overview.company_name || overview.symbol}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
                  <span>{overview.exchange || t('stockDetail.unknownExchange')}</span>
                  <span className="text-slate-700">•</span>
                  <span>{overview.industry || t('stockDetail.unknownIndustry')}</span>
                  {overview.listed_date ? (
                    <>
                      <span className="text-slate-700">•</span>
                      <span>{t('stockDetail.listedDate', { date: overview.listed_date })}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Current price + change */}
            <div>
              <p className="text-label">{t('stockDetail.currentPrice')}</p>
              <p className="mt-1 text-[11px] text-slate-500">{t('stockDetail.priceUnitHint')}</p>
              <div className="mt-1 flex flex-wrap items-end gap-4">
                <span className="text-5xl font-semibold leading-none text-white">{formatQuotePrice(currentPrice)}</span>
                <span className={`pb-1 text-lg font-semibold ${changeClass}`}>
                  {changeValue > 0 ? '+' : ''}
                  {changeValue !== null && changeValue !== undefined ? formatQuotePrice(Math.abs(changeValue)) : '—'}
                  {' · '}
                  {formatPercent(changePct)}
                </span>
              </div>
            </div>

            {/* Quick tags: shortlist, groups */}
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${overview.is_tracked ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-900/70 text-slate-400'}`}>
                {overview.is_tracked ? t('stockDetail.trackingRealtime') : t('stockDetail.notTrackingRealtime')}
              </span>
              {overview.market_groups.slice(0, 2).map((groupName) => (
                <span key={groupName} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">
                  {groupName}
                </span>
              ))}
            </div>
          </div>

          {/* Key metrics grid on the right */}
          <div className="rounded-[20px] border border-slate-800 bg-black/30 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.refCeilFloor')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(overview.reference_price)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{formatQuotePrice(overview.ceiling_price)} / {formatQuotePrice(overview.floor_price)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.dayRange')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(liveLowPrice)} → {formatQuotePrice(liveHighPrice)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{t('stockDetail.quantityShort')}: {fmtVol(liveVolume)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.range52w')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(overview.week52_low)}</p>
                <p className="mt-1 text-[10px] text-slate-500">→ {formatQuotePrice(overview.week52_high)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.average')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(overview.average_price)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.bias')}</p>
                <p className={`mt-1 text-sm font-medium ${technicalBias.className.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{technicalBias.label}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.thisWindow')}</p>
                <p className={`mt-1 text-sm font-medium ${chartPerformance !== null && chartPerformance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {chartPerformance !== null ? `${chartPerformance >= 0 ? '+' : ''}${chartPerformance.toFixed(2)}%` : '—'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-slate-400">{technicalBias.description}</p>
          </div>
        </div>

        {/* Action bar: shortlist / watchlist / alert */}
        <div className="border-t border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleTracked}
              disabled={!!actionLoading}
              className={`btn-${overview.is_tracked ? 'secondary' : 'primary'} ${!!actionLoading ? 'opacity-50' : ''}`}
            >
              {actionLoading === 'tracked' ? t('stockDetail.updating') : overview.is_tracked ? t('stockDetail.untrack') : t('stockDetail.trackRealtime')}
            </button>

            <div className="flex min-w-[280px] flex-wrap items-center gap-2 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5">
              <select
                value={selectedWatchlistGroupId}
                onChange={(event) => setSelectedWatchlistGroupId(event.target.value)}
                className="min-w-[150px] bg-transparent px-2 py-1 text-sm text-slate-200 outline-none"
              >
                {availableWatchlistGroups.length === 0 ? (
                  <option value="">{t('stockDetail.noMoreWatchlist')}</option>
                ) : availableWatchlistGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddToWatchlist}
                disabled={!!actionLoading || availableWatchlistGroups.length === 0}
                className={`btn-accent ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'watchlist-add' ? t('stockDetail.saving') : t('stockDetail.saveToGroup')}
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5">
              <input
                value={alertTargetPrice}
                onChange={(event) => setAlertTargetPrice(event.target.value)}
                placeholder={t('stockDetail.alertPriceLevel')}
                className="w-32 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                onClick={handleCreateAlert}
                disabled={!!actionLoading}
                className={`btn-success ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'alert' ? t('stockDetail.creating') : t('stockDetail.createAlert')}
              </button>
            </div>

            <div className="ml-auto w-full xl:w-auto xl:min-w-[406px] grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950/75 px-3 py-2 text-[12px]">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">
                <p className="text-label">{t('stockDetail.shortlist')}</p>
                <p className={`mt-0.5 font-medium ${overview.is_tracked ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {overview.is_tracked ? t('stockDetail.tracked') : t('stockDetail.notTracked')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">
                <p className="text-label">{t('stockDetail.groupList', { count: overview.watchlist_memberships.length })}</p>
                {overview.watchlist_memberships.length > 0 ? (
                  <p className="mt-0.5 text-amber-300 truncate" title={overview.watchlist_memberships.map((item) => item.group_name).join(', ')}>
                    {overview.watchlist_memberships.map((item) => item.group_name).join(', ')}
                  </p>
                ) : (
                  <p className="mt-0.5 text-slate-500">{t('stockDetail.noneYet')}</p>
                )}
              </div>
            </div>
          </div>

          {workspaceMessage ? <p className="mt-2 text-sm text-emerald-300">{workspaceMessage}</p> : null}
          {workspaceError ? <p className="mt-2 text-sm text-rose-300">{workspaceError}</p> : null}
        </div>
      </section>

      {/* Main content: chart + panels — 3-column equal grid at xl */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 2 cột trái: Chart + Whale Alerts + BubbleOrderChart */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">{t('stockDetail.klineWorkspace')}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('stockDetail.candlestickFor', { symbol: normalizedSymbol })}</h2>
              </div>
              <div />
            </div>

            <div className="mt-3 h-[520px]">
              {loadingChart ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-900" />
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                  {t('stockDetail.noChartData')}
                </div>
              ) : (
                <KLineChartComponent
                  data={chartData}
                  activePeriod={activePeriod}
                  onPeriodChange={setActivePeriod}
                  onVisibleRangeChange={setChartVisibleRange}
                  onActiveIndicatorsChange={setChartActiveIndicators}
                />
              )}
            </div>
          </section>

          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">{t('stockDetail.advisorySession')}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('stockDetail.aiAdvisoryFor', { symbol: normalizedSymbol })}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {advisoryChartContextState.used !== null ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      advisoryChartContextState.used
                        ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                        : 'border-amber-700 bg-amber-950/40 text-amber-300'
                    }`}
                  >
                    {advisoryChartContextState.used ? 'Chart context: used' : 'Chart context: fallback'}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleGenerateAdvisoryComponents}
                  disabled={advisoryGeneratingComponents || advisoryLoading}
                  className="btn-secondary"
                >
                  {advisoryGeneratingComponents ? t('stockDetail.creatingTabs') : t('stockDetail.createAiTabs')}
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {advisoryLoading ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-900" />
              ) : advisorySession ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 uppercase tracking-widest">
                      {advisoryUserProvider || advisorySession.ai_provider || 'openclaw'}
                    </span>
                    {advisorySession.severity && advisorySession.severity !== 'info' ? (
                      <span className={`rounded-full px-2 py-0.5 font-semibold uppercase ${
                        advisorySession.severity === 'urgent'
                          ? 'border border-rose-700/70 bg-rose-500/10 text-rose-300'
                          : 'border border-amber-700/70 bg-amber-500/10 text-amber-300'
                      }`}>
                        {advisorySession.severity === 'urgent'
                          ? t('stockDetail.severityUrgent')
                          : t('stockDetail.severityWarning')}
                      </span>
                    ) : null}
                    {advisorySession.advisory_type === 'reversal' ? (
                      <span className="rounded-full border border-fuchsia-700/70 bg-fuchsia-500/10 px-2 py-0.5 font-semibold uppercase text-fuchsia-300">
                        {t('stockDetail.advisoryTypeReversal')}
                      </span>
                    ) : null}
                    <span>
                      {advisorySession.created_at ? new Date(advisorySession.created_at).toLocaleString(undefined) : '—'}
                    </span>
                    <span className="text-slate-600">• {t('stockDetail.tabsCount', { count: advisoryComponents.length })}</span>
                    <span className="text-slate-600">• {t('stockDetail.tabsUsedCount', { count: (advisoryComponents.filter((item) => item.include_in_summary)).length })}</span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">H3 observability</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{t('stockDetail.retryWindowHours')}</span>
                        <select
                          value={advisoryObservabilityWindowHours}
                          onChange={(e) => setAdvisoryObservabilityWindowHours(Number(e.target.value) || 48)}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                        >
                          <option value={24}>24h</option>
                          <option value={48}>48h</option>
                          <option value={72}>72h</option>
                          <option value={168}>7d</option>
                        </select>
                        <span className="text-[11px] text-slate-500">{t('stockDetail.governanceBucket')}</span>
                        <select
                          value={advisoryGovernanceBucket}
                          onChange={(e) => setAdvisoryGovernanceBucket(e.target.value)}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                        >
                          <option value="hour">{t('stockDetail.governanceBucketHour')}</option>
                          <option value="day">{t('stockDetail.governanceBucketDay')}</option>
                        </select>
                        <span className="text-[11px] text-slate-500">{t('stockDetail.governanceFilterEndpoint')}</span>
                        <select
                          value={advisoryGovernanceEndpointFilter}
                          onChange={(e) => setAdvisoryGovernanceEndpointFilter(e.target.value)}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                        >
                          <option value="all">{t('stockDetail.retryFilterAll')}</option>
                          {governanceEndpointOptions.map((endpoint) => (
                            <option key={endpoint} value={endpoint}>{advisoryGovernanceEndpointLabel(endpoint, t)}</option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-500">{t('stockDetail.governanceFilterReason')}</span>
                        <select
                          value={advisoryGovernanceReasonFilter}
                          onChange={(e) => setAdvisoryGovernanceReasonFilter(e.target.value)}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                        >
                          <option value="all">{t('stockDetail.retryFilterAll')}</option>
                          {governanceReasonOptions.map((reason) => (
                            <option key={reason} value={reason}>{advisoryGovernanceReasonLabel(reason, t)}</option>
                          ))}
                        </select>
                        {advisoryObservabilityLoading ? (
                          <span className="text-[11px] text-slate-500">Refreshing...</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Severity drift</p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {advisoryAggregate?.observability?.severity_drift_24h?.label || advisoryObservability?.summary?.severity_drift_label || 'stable'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Delta: {advisoryAggregate?.observability?.severity_drift_24h?.delta ?? advisoryObservability?.summary?.severity_delta ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Aggregate quality</p>
                        <p className="mt-1 text-sm font-semibold text-cyan-300">
                          {advisoryAggregate?.observability?.aggregate_quality?.score ?? advisoryObservability?.summary?.avg_aggregate_quality_score ?? '—'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {advisoryAggregate?.observability?.aggregate_quality?.label || 'n/a'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Decision score</p>
                        <p className="mt-1 text-sm font-semibold text-amber-300">
                          {advisoryAggregate?.decision?.score ?? '—'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {advisoryAggregate?.decision?.score_band || 'n/a'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Benchmarks</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-300">
                          RVOL {advisoryAggregate?.benchmarks?.rvol ?? '—'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {advisoryAggregate?.benchmarks?.rvol_regime || 'unknown'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('stockDetail.advisoryRetryTelemetry')}</p>
                        <p className="mt-1 text-sm font-semibold text-violet-300">
                          {t('stockDetail.retryScheduledCount')}: {advisoryObservability?.summary?.retry_scheduled_total ?? advisoryRetryTelemetry.scheduledCount}
                        </p>
                        <p className="text-[11px] text-emerald-300">
                          {t('stockDetail.retryRecoveredCount')}: {advisoryObservability?.summary?.retry_recovered_total ?? advisoryRetryTelemetry.recoveredCount}
                        </p>
                        <p className="text-[11px] text-rose-300">
                          {t('stockDetail.retryFailedCount')}: {advisoryObservability?.summary?.retry_failed_total ?? advisoryRetryTelemetry.failedCount}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {t('stockDetail.retryLast')}: {advisoryRetryOutcomeLabel(advisoryRetryTelemetry.lastOutcome, t)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {t('stockDetail.retryReason')}: {advisoryRetryTelemetry.lastReason || 'n/a'}
                        </p>
                      </div>
                    </div>
                    {Array.isArray(advisoryObservability?.timeline) && advisoryObservability.timeline.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Timeline (latest)</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {advisoryObservability.timeline.slice(0, 5).map((row) => (
                            <span key={row.advisory_id} className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300">
                              #{row.advisory_id} {row.severity} q={row.aggregate_quality?.score}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {governanceTrendRows.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('stockDetail.governanceTrendTitle')}</p>
                          <div className="text-[11px] text-slate-500">
                            {t('stockDetail.governanceDenyTotal')}: {advisoryObservability?.governance?.rollout_gate_deny_total ?? 0}
                          </div>
                        </div>
                        {governanceSparkline ? (
                          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>{t('stockDetail.governanceSparklineTitle')}</span>
                              <span>
                                {t('stockDetail.governanceSparklineLatest')}: {governanceSparkline.latest}
                                {' | '}
                                {t('stockDetail.governanceSparklineRange', {
                                  min: governanceSparkline.min,
                                  max: governanceSparkline.max,
                                })}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <svg
                                width={governanceSparkline.width}
                                height={governanceSparkline.height}
                                viewBox={`0 0 ${governanceSparkline.width} ${governanceSparkline.height}`}
                                className="overflow-visible"
                                role="img"
                                aria-label={t('stockDetail.governanceSparklineTitle')}
                              >
                                <polyline
                                  fill="none"
                                  stroke="rgba(248, 113, 113, 0.95)"
                                  strokeWidth="2"
                                  points={governanceSparkline.polylinePoints}
                                />
                                <line
                                  x1="0"
                                  y1={governanceSparkline.baselineY}
                                  x2={governanceSparkline.width}
                                  y2={governanceSparkline.baselineY}
                                  stroke="rgba(56, 189, 248, 0.85)"
                                  strokeWidth="1"
                                  strokeDasharray="4 3"
                                />
                                {governanceSparkline.pointItems.map((point) => (
                                  <circle
                                    key={`spark-point-${point.bucket}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r="2"
                                    fill="rgba(251, 113, 133, 0.55)"
                                  />
                                ))}
                                {governanceSparkline.maxPoint ? (
                                  <circle
                                    cx={governanceSparkline.maxPoint.x}
                                    cy={governanceSparkline.maxPoint.y}
                                    r="4"
                                    fill="rgba(251, 191, 36, 0.95)"
                                    stroke="rgba(255, 255, 255, 0.85)"
                                    strokeWidth="1"
                                  >
                                    <title>
                                      {`${t('stockDetail.governanceSparklinePeak')}: ${governanceSparkline.maxPoint.bucket} (${governanceSparkline.maxPoint.value})`}
                                    </title>
                                  </circle>
                                ) : null}
                              </svg>
                              <span className={`text-[11px] font-semibold ${governanceSparkline.latest > governanceSparkline.previous ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {governanceSparkline.latest > governanceSparkline.previous ? '▲' : '▼'}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {t('stockDetail.governanceSparklineBaseline')}: {governanceSparkline.baseline.toFixed(2)}
                              {' | '}
                              {t('stockDetail.governanceSparklineDeviation')}: {governanceSparkline.latestDeltaVsBaseline > 0 ? '+' : ''}{governanceSparkline.latestDeltaVsBaseline.toFixed(2)}
                            </p>
                            <div className="mt-1">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${governanceDeltaSeverityClass(governanceSparkline.deltaSeverity)}`}>
                                {t('stockDetail.governanceDeltaThreshold')}: {governanceDeltaSeverityLabel(governanceSparkline.deltaSeverity, t)}
                              </span>
                              <span className="ml-2 text-[10px] text-slate-500">
                                {t('stockDetail.governanceThresholdApplied')}: w={governanceSparkline.thresholds.warning} c={governanceSparkline.thresholds.critical} cd={governanceSparkline.thresholds.cooldown}
                              </span>
                            </div>
                            {governanceSparkline.maxPoint ? (
                              <p className="mt-1 text-[10px] text-slate-500">
                                {t('stockDetail.governanceSparklinePeak')}: {governanceSparkline.maxPoint.bucket} ({governanceSparkline.maxPoint.value})
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {governanceEndpointBreakdown.length > 0 ? (
                          <div className="mt-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('stockDetail.governanceBreakdownEndpoint')}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {governanceEndpointBreakdown.map((item) => {
                                const selected = advisoryGovernanceEndpointFilter === item.key;
                                return (
                                  <button
                                    key={`gov-endpoint-${item.key}`}
                                    type="button"
                                    onClick={() => setAdvisoryGovernanceEndpointFilter(selected ? 'all' : item.key)}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                      selected
                                        ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                                        : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                                    }`}
                                  >
                                    {advisoryGovernanceEndpointLabel(item.key, t)} ({item.count})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {governanceReasonBreakdown.length > 0 ? (
                          <div className="mt-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('stockDetail.governanceBreakdownReason')}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {governanceReasonBreakdown.map((item) => {
                                const selected = advisoryGovernanceReasonFilter === item.key;
                                return (
                                  <button
                                    key={`gov-reason-${item.key}`}
                                    type="button"
                                    onClick={() => setAdvisoryGovernanceReasonFilter(selected ? 'all' : item.key)}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                      selected
                                        ? 'border-amber-500/70 bg-amber-500/10 text-amber-300'
                                        : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                                    }`}
                                  >
                                    {advisoryGovernanceReasonLabel(item.key, t)} ({item.count})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-2 space-y-1.5">
                          {governanceTrendRows.map((row) => (
                            <div key={`gov-trend-${row.bucket}`} className="space-y-1" title={row.tooltipText}>
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span>{row.bucket}</span>
                                <span>{t('stockDetail.governanceDenyCount')}: {row.denyTotal}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-800/80">
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-rose-500"
                                  style={{ width: `${row.widthPercent}%` }}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                                <span>{t('stockDetail.governanceTopEndpoint')}: {advisoryGovernanceEndpointLabel(row.topEndpoint, t)}</span>
                                <span>{t('stockDetail.governanceTopReason')}: {advisoryGovernanceReasonLabel(row.topReason, t)}</span>
                                <span>{t('stockDetail.governanceTopCohort')}: {row.topCohort}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {Array.isArray(advisoryObservability?.retry_events) && advisoryObservability.retry_events.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('stockDetail.retryEventsPersisted')}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500">{t('stockDetail.retryFilterOutcome')}</span>
                            <select
                              value={retryEventOutcomeFilter}
                              onChange={(e) => setRetryEventOutcomeFilter(e.target.value)}
                              className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                            >
                              <option value="all">{t('stockDetail.retryFilterAll')}</option>
                              <option value="scheduled">{advisoryRetryOutcomeLabel('scheduled', t)}</option>
                              <option value="recovered">{advisoryRetryOutcomeLabel('recovered', t)}</option>
                              <option value="exhausted">{advisoryRetryOutcomeLabel('exhausted', t)}</option>
                              <option value="skipped_config">{advisoryRetryOutcomeLabel('skipped_config', t)}</option>
                              <option value="request_error">{advisoryRetryOutcomeLabel('request_error', t)}</option>
                            </select>
                            <span className="text-[11px] text-slate-500">{t('stockDetail.retryFilterReason')}</span>
                            <select
                              value={retryEventReasonFilter}
                              onChange={(e) => setRetryEventReasonFilter(e.target.value)}
                              className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                            >
                              <option value="all">{t('stockDetail.retryFilterAll')}</option>
                              {retryEventReasonOptions.map((reason) => (
                                <option key={reason} value={reason}>{reason}</option>
                              ))}
                            </select>
                            <span className="text-[11px] text-slate-500">{t('stockDetail.retrySort')}</span>
                            <select
                              value={retryEventSortMode}
                              onChange={(e) => setRetryEventSortMode(e.target.value)}
                              className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                            >
                              <option value="newest">{t('stockDetail.retrySortNewest')}</option>
                              <option value="oldest">{t('stockDetail.retrySortOldest')}</option>
                              <option value="most_failed">{t('stockDetail.retrySortMostFailed')}</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{t('stockDetail.retryLegend')}</span>
                          <span className={`rounded-full border px-2 py-0.5 ${advisoryRetryOutcomeBadgeClass('scheduled')}`}>
                            {advisoryRetryOutcomeLabel('scheduled', t)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 ${advisoryRetryOutcomeBadgeClass('recovered')}`}>
                            {advisoryRetryOutcomeLabel('recovered', t)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 ${advisoryRetryOutcomeBadgeClass('exhausted')}`}>
                            {advisoryRetryOutcomeLabel('exhausted', t)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 ${advisoryRetryOutcomeBadgeClass('skipped_config')}`}>
                            {advisoryRetryOutcomeLabel('skipped_config', t)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 ${advisoryRetryOutcomeBadgeClass('request_error')}`}>
                            {advisoryRetryOutcomeLabel('request_error', t)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {filteredPersistedRetryEvents.slice(0, 5).map((event) => (
                            <span
                              key={`retry-${event.log_id}`}
                              className={`rounded-full border px-2 py-0.5 text-[11px] ${advisoryRetryOutcomeBadgeClass(event.outcome)}`}
                            >
                              {advisoryRetryOutcomeLabel(event.outcome, t)} r={event.reason || 'n/a'} s={event.scheduled_count} ok={event.recovered_count} f={event.failed_count}
                            </span>
                          ))}
                          {filteredPersistedRetryEvents.length === 0 ? (
                            <p className="text-[11px] text-slate-500">{t('stockDetail.retryNoEventsForFilter')}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {advisoryDeletedComponents.length > 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t('stockDetail.deletedTabs')}</p>
                        <button
                          type="button"
                          onClick={handleClearDeletedAdvisoryComponents}
                          disabled={advisoryClearingDeleted}
                          className="rounded-full border border-rose-700/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                        >
                          {advisoryClearingDeleted ? 'Clearing...' : 'Clear Deleted Tabs'}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {advisoryDeletedComponents.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleRestoreAdvisoryComponent(item.id)}
                            disabled={advisoryComponentBusyId === item.id}
                            className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500/60 hover:text-cyan-300"
                          >
                            {t('stockDetail.restoreTab')} {item.indicator_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <div className="flex flex-wrap gap-2">
                      {advisoryComponents.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-slate-500">{t('stockDetail.noComponentTabs')}</p>
                      ) : advisoryComponents.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveAdvisoryComponentId(item.id)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            activeAdvisoryComponent?.id === item.id
                              ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                              : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {item.indicator_name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeAdvisoryComponent ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">{activeAdvisoryComponent.indicator_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {activeAdvisoryComponent.created_at ? new Date(activeAdvisoryComponent.created_at).toLocaleString(undefined) : '—'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300">
                            {advisoryStatusLabel(activeAdvisoryComponent.status, t)}
                          </span>
                          <span className="rounded-full border border-amber-700/70 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                            {activeAdvisoryComponent.confidence_score}/10
                          </span>
                          <span className="rounded-full border border-emerald-700/70 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            {advisoryActionLabel(activeAdvisoryComponent.suggested_action, t)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-300 whitespace-pre-line">{activeAdvisoryComponent.rationale_text || t('stockDetail.noExtraDescription')}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleComponentInclude(activeAdvisoryComponent.id)}
                          disabled={advisoryComponentBusyId === activeAdvisoryComponent.id}
                          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800/70"
                        >
                          {activeAdvisoryComponent.include_in_summary ? t('stockDetail.excludeFromSummary') : t('stockDetail.includeInSummary')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRefreshActiveAdvisoryComponent(activeAdvisoryComponent.id)}
                          disabled={advisoryComponentBusyId === activeAdvisoryComponent.id}
                          className="rounded-full border border-cyan-700/60 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20"
                        >
                          {t('stockDetail.refreshTab')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdvisoryComponent(activeAdvisoryComponent.id)}
                          disabled={advisoryComponentBusyId === activeAdvisoryComponent.id}
                          className="rounded-full border border-rose-700/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                        >
                          {t('stockDetail.deleteTab')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{t('stockDetail.summaryInfo')}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {t('stockDetail.currentMode')}: {advisorySynthesisPreferenceLabel(advisorySynthesisPreference, t)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={advisorySynthesisPreference}
                          onChange={(e) => setAdvisorySynthesisPreference(e.target.value)}
                          disabled={advisoryRegeneratingSummary}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 outline-none hover:border-slate-500"
                        >
                          <option value="short_term_action">{t('stockDetail.preferenceShortTerm')}</option>
                          <option value="risk_management">{t('stockDetail.preferenceRisk')}</option>
                          <option value="balanced">{t('stockDetail.preferenceBalanced')}</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleRegenerateExecutiveSummary}
                          disabled={advisoryRegeneratingSummary || advisoryComponents.length === 0}
                          className="btn-secondary"
                        >
                          {advisoryRegeneratingSummary ? t('stockDetail.summarizing') : t('stockDetail.regenerateSummary')}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteExecutiveSummary}
                          disabled={advisoryDeletingSummary || !advisoryExecutiveSummary}
                          className="rounded-full border border-rose-700/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                        >
                          {advisoryDeletingSummary ? 'Dang xoa...' : 'Xoa thong tin tong hop'}
                        </button>
                      </div>
                    </div>
                    {advisoryExecutiveSummary ? (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full border border-cyan-700/70 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                            {advisoryExecutiveSummary.strategy_action}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-slate-300">
                            {t('stockDetail.riskLevel')}: {advisoryRiskLabel(advisoryExecutiveSummary.risk_level, t)}
                          </span>
                          <span className="rounded-full border border-amber-700/70 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                            {t('stockDetail.confidence')}: {advisoryExecutiveSummary.overall_confidence}/10
                          </span>
                          <span className="text-slate-500">v{advisoryExecutiveSummary.summary_version}</span>
                        </div>
                        {advisoryExecutiveSummaries.length > 1 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {advisoryExecutiveSummaries.map((summaryItem) => (
                              <button
                                key={summaryItem.id}
                                type="button"
                                onClick={() => setAdvisoryExecutiveSummary(summaryItem)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                  advisoryExecutiveSummary?.id === summaryItem.id
                                    ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                v{summaryItem.summary_version}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 max-h-56 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
                          <p className="text-sm leading-6 whitespace-pre-line text-slate-200">
                            {advisoryExecutiveSummary.synthesis_text || t('stockDetail.noSummaryContent')}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500">
                            {t('stockDetail.summaryUsesTabs', { count: Array.isArray(advisoryExecutiveSummary.used_component_ids) ? advisoryExecutiveSummary.used_component_ids.length : 0 })}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">{t('stockDetail.noExecutiveSummary')}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  {t('stockDetail.aiGeneratingWait')}
                </p>
              )}

              {advisoryMessage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-cyan-300">{advisoryMessage}</p>
                  {advisorySessionConflict ? (
                    <button
                      type="button"
                      onClick={() => fetchAdvisorySession({ silent: false })}
                      className="rounded-full border border-cyan-700/60 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-500/20"
                    >
                      {t('stockDetail.retryAiAdvisory')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {advisoryChartContextState.warnings.length > 0 ? (
                <p className="text-xs text-amber-300">Chart context warnings: {advisoryChartContextState.warnings.join(', ')}</p>
              ) : null}
            </div>
          </section>

        </div>
        {/* Cột phải: Cảnh báo dòng tiền lớn + Tỷ trọng dòng tiền phiên */}
        <div className="flex flex-col gap-3 md:gap-4 xl:gap-5 xl:min-h-0 xl:h-full">
          <IntradayMatchedPanel symbol={normalizedSymbol} liveVolume={liveVolume} />
          <PriceDepthPanel symbol={normalizedSymbol} liveVolume={liveVolume} />
          <WhaleFeedPanel
            symbol={normalizedSymbol}
            realtimeAlerts={symbolAlerts}
            feedData={whaleFeedData}
            loading={whaleFeedLoading}
            onRefresh={refreshWhaleFeed}
            feedHeightClass="h-[8cm]"
          />
          {/* Tỷ trọng dòng tiền phiên */}
          <MoneyFlowDonut summary={whaleFeedData?.summary} loading={whaleFeedLoading} />
        </div>
        {/* Hàng căn đáy: Order Flow Radar (2 cột) || Phân bổ lệnh lớn (1 cột) */}
        <div className="xl:col-span-2">
          <OrderFlowPanel
            symbol={normalizedSymbol}
            loading={orderFlowLoading}
            orderFlowData={orderFlowData}
            latestRealtimeAlert={symbolDarkFlowAlert}
            window={orderFlowWindow}
            onWindowChange={setOrderFlowWindow}
          />
        </div>
        <BubbleOrderChart orders={whaleFeedData?.whale_orders} loading={whaleFeedLoading} />
        {/* Cảnh báo giá - toàn chiều rộng */}
        {symbolAlerts.length > 0 && (
          <div className="xl:col-span-3">
            <section className="card-section p-4">
              <p className="text-label pb-2.5 border-b border-slate-800">{t('stockDetail.priceAlertsCount', { count: symbolAlerts.length })}</p>
              <div className="mt-3 space-y-2.5">
                {symbolAlerts.map((alert, idx) => (
                  <div key={`${alert.symbol}-${alert.ts}-${idx}`} className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-rose-400 mb-1">🔔 {t('stockDetail.priceAlert')}</p>
                    <p className="text-sm font-semibold text-rose-200">
                      {alert.condition === 'ABOVE' ? `▲ ${t('stockDetail.above')}` : `▼ ${t('stockDetail.below')}`}{' '}
                      {alert.target_price
                        ? formatQuotePrice(alert.target_price)
                        : formatQuotePrice(alert.price)}
                    </p>
                    {alert.ts && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(alert.ts).toLocaleTimeString(undefined)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
      {/* Panel tài chính */}
      <FinancialMetricsPanel
        financials={financials}
        loading={financialsLoading}
        selectedYear={financialsYear}
        onYearChange={setFinancialsYear}
      />
    </div>
  );
}
