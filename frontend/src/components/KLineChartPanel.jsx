import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { init as klineChartInit, dispose as klineChartDispose, IndicatorSeries, LineType } from 'klinecharts';
import { useI18n } from '../context/LangContext';
import { toCanonicalMinute } from '../utils/whaleTimeAdapter';

function normalizeTradeDate(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(rawValue)) {
    return rawValue.slice(0, 10);
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function buildMinuteLookup(series = [], valueResolver = (item) => item?.value) {
  const lookup = new Map();

  (Array.isArray(series) ? series : []).forEach((item) => {
    if (!item) {
      return;
    }

    const minuteKey = toCanonicalMinute(item?.ts ?? item?.bucket_ts ?? item?.timestamp ?? item?.time ?? item?.date);
    if (minuteKey == null) {
      return;
    }

    const rawValue = valueResolver(item);
    const numericValue = Number(rawValue);
    if (rawValue == null || !Number.isFinite(numericValue)) {
      return;
    }

    lookup.set(String(minuteKey), numericValue);
  });

  return lookup;
}

export default function KLineChartPanel({ data, activePeriod, activeTimeframe: activeTimeframeProp, onPeriodChange, onTimeframeChange, onVisibleRangeChange, onActiveIndicatorsChange, onSessionChange, flowData = null }) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const indicatorPaneMapRef = useRef({});
  const lastVisibleRangeRef = useRef({ from_ts: null, to_ts: null });
  const [activeIndicators, setActiveIndicators] = useState({ MA: true, VOL: true, MACD: true, CVD: true, STRENGTH: true, WHALE_FLOW: false });
  const [fullScreen, setFullScreen] = useState(false);

  const MAIN_PANE_INDICATORS = new Set(['MA', 'EMA', 'BOLL', 'SAR']);
  const SUB_PANE_CANDIDATES = ['volume_pane', 'indicator_pane', 'whale_cvd_pane', 'whale_strength_pane', 'whale_flow_pane'];

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
      id: 'CVD',
      labelOn: t('whaleAlertsDashboard.hideCvdPane', { defaultValue: 'Ẩn CVD' }),
      labelOff: t('whaleAlertsDashboard.showCvdPane', { defaultValue: 'Hiện CVD' }),
      title: t('whaleAlertsDashboard.cvdPaneTitle', { defaultValue: 'Pane CVD' }),
    },
    {
      id: 'STRENGTH',
      labelOn: t('whaleAlertsDashboard.hideStrengthPane', { defaultValue: 'Ẩn sức mạnh' }),
      labelOff: t('whaleAlertsDashboard.showStrengthPane', { defaultValue: 'Hiện sức mạnh' }),
      title: t('whaleAlertsDashboard.strengthPaneTitle', { defaultValue: 'Pane sức mạnh' }),
    },
    {
      id: 'WHALE_FLOW',
      labelOn: t('whaleAlertsDashboard.hideWhaleBuySellPane', { defaultValue: 'Ẩn mua/bán cá mập' }),
      labelOff: t('whaleAlertsDashboard.showWhaleBuySellPane', { defaultValue: 'Hiện mua/bán cá mập' }),
      title: t('whaleAlertsDashboard.whaleBuySellPaneTitle', { defaultValue: 'Pane mua/bán cá mập' }),
    },
  ];

  const customIndicatorDefs = useMemo(() => {
    const cvdLookup = buildMinuteLookup(flowData?.cvd_series, (item) => item?.cvd ?? item?.cumulative_cvd ?? item?.value);
    const strengthLookup = buildMinuteLookup(flowData?.strength_series, (item) => item?.strength ?? item?.value);
    const institutionalStrengthLookup = buildMinuteLookup(flowData?.institutional_strength_series, (item) => item?.strength ?? item?.value);

    const hasCvdData = cvdLookup.size > 0;
    const hasStrengthData = strengthLookup.size > 0 || institutionalStrengthLookup.size > 0;
    const hasWhaleFlowData = cvdLookup.size > 0 && strengthLookup.size > 0;

    const cvdTemplate = hasCvdData ? {
      name: 'WHALE_CVD',
      shortName: t('whaleAlertsDashboard.cvdPaneTitle', { defaultValue: 'CVD' }),
      calcParams: [],
      shouldOhlc: false,
      precision: 0,
      series: IndicatorSeries.Normal,
      figures: [
        { key: 'cvd', title: t('whaleAlertsDashboard.cvdPaneTitle', { defaultValue: 'CVD' }), type: 'line' },
        { key: 'baseline', title: '0', type: 'line' },
      ],
      calc: (kLineDataList = []) => kLineDataList.map((item) => {
        const minuteKey = toCanonicalMinute(item?.timestamp ?? item?.date ?? item?.tradeDate);
        const lookupValue = minuteKey == null ? null : cvdLookup.get(String(minuteKey));
        return {
          cvd: Number.isFinite(lookupValue) ? lookupValue : null,
          baseline: 0,
        };
      }),
      styles: {
        lines: [
          { color: '#22d3ee', size: 2, style: LineType.Solid, smooth: true },
          { color: '#64748b', size: 1, style: LineType.Dashed, dashedValue: [4, 2], smooth: false },
        ],
      },
    } : null;

    const strengthTemplate = hasStrengthData ? {
      name: 'WHALE_STRENGTH',
      shortName: t('whaleAlertsDashboard.strengthPaneTitle', { defaultValue: 'Sức mạnh' }),
      calcParams: [],
      shouldOhlc: false,
      precision: 1,
      series: IndicatorSeries.Normal,
      figures: [
        { key: 'strength', title: t('whaleAlertsDashboard.strengthPaneTitle', { defaultValue: 'Sức mạnh' }), type: 'line' },
        { key: 'institutionalStrength', title: t('whaleAlertsDashboard.institutionalStrengthPaneTitle', { defaultValue: 'Sức mạnh tổ chức' }), type: 'line' },
      ],
      calc: (kLineDataList = []) => kLineDataList.map((item) => {
        const minuteKey = toCanonicalMinute(item?.timestamp ?? item?.date ?? item?.tradeDate);
        const lookupValue = minuteKey == null ? null : strengthLookup.get(String(minuteKey));
        const institutionalLookupValue = minuteKey == null ? null : institutionalStrengthLookup.get(String(minuteKey));
        return {
          strength: Number.isFinite(lookupValue) ? lookupValue : null,
          institutionalStrength: Number.isFinite(institutionalLookupValue) ? institutionalLookupValue : null,
        };
      }),
      styles: {
        lines: [
          { color: '#34d399', size: 2, style: LineType.Solid, smooth: true },
          { color: '#f59e0b', size: 2, style: LineType.Solid, smooth: true },
        ],
      },
    } : null;

    const whaleFlowTemplate = hasWhaleFlowData ? {
      name: 'WHALE_FLOW',
      shortName: t('whaleAlertsDashboard.whaleBuySellPaneTitle', { defaultValue: 'Mua/bán cá mập' }),
      calcParams: [],
      shouldOhlc: false,
      precision: 1,
      series: IndicatorSeries.Normal,
      figures: [
        { key: 'buy', title: t('whaleAlertsDashboard.whaleBuyLabel', { defaultValue: 'Whale Buy' }), type: 'line' },
        { key: 'sell', title: t('whaleAlertsDashboard.whaleSellLabel', { defaultValue: 'Whale Sell' }), type: 'line' },
      ],
      calc: (kLineDataList = []) => kLineDataList.map((item) => {
        const minuteKey = toCanonicalMinute(item?.timestamp ?? item?.date ?? item?.tradeDate);
        const lookupKey = minuteKey == null ? null : String(minuteKey);
        const cvdValue = lookupKey == null ? null : cvdLookup.get(lookupKey);
        const strengthValue = lookupKey == null ? null : strengthLookup.get(lookupKey);

        if (!Number.isFinite(cvdValue) || !Number.isFinite(strengthValue)) {
          return { buy: null, sell: null };
        }

        return cvdValue >= 0
          ? { buy: strengthValue, sell: null }
          : { buy: null, sell: strengthValue };
      }),
      styles: {
        lines: [
          { color: '#a3e635', size: 2, style: LineType.Solid, smooth: true },
          { color: '#fb7185', size: 2, style: LineType.Solid, smooth: true },
        ],
      },
    } : null;

    return {
      CVD: cvdTemplate ? { template: cvdTemplate, paneOptions: { id: 'whale_cvd_pane', height: 96, minHeight: 72 } } : null,
      STRENGTH: strengthTemplate ? { template: strengthTemplate, paneOptions: { id: 'whale_strength_pane', height: 96, minHeight: 72 } } : null,
      WHALE_FLOW: whaleFlowTemplate ? { template: whaleFlowTemplate, paneOptions: { id: 'whale_flow_pane', height: 100, minHeight: 76 } } : null,
    };
  }, [flowData, t]);

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
    let paneId = null;
    const customIndicatorDef = customIndicatorDefs[indicatorId];
    if (customIndicatorDef) {
      try {
        const existingPaneId = indicatorPaneMapRef.current[indicatorId];
        if (existingPaneId) {
          chart.overrideIndicator(customIndicatorDef.template, existingPaneId);
          paneId = existingPaneId;
        } else {
          paneId = chart.createIndicator(customIndicatorDef.template, false, customIndicatorDef.paneOptions);
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

  const emitSessionFromChart = useCallback((kLineData = []) => {
    if (!onSessionChange || !kLineData.length) {
      return;
    }

    const latestData = kLineData[kLineData.length - 1];
    const tradeDate = normalizeTradeDate(latestData?.tradeDate ?? latestData?.date ?? latestData?.timestamp);
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

  const handleCandleBarClick = useCallback((action) => {
    const chart = chartRef.current;
    if (!chart || !onSessionChange) {
      return;
    }

    const chartDataList = chart.getDataList?.() || [];
    const clickedData = action?.kLineData || chartDataList?.[action?.dataIndex] || null;
    if (!clickedData) {
      return;
    }

    const tradeDate = normalizeTradeDate(clickedData.tradeDate ?? clickedData.date ?? action?.timestamp ?? clickedData.timestamp);
    if (!tradeDate) {
      return;
    }

    onSessionChange({
      tradeDate,
      timestamp: clickedData.timestamp ?? action?.timestamp ?? null,
      dataIndex: Number.isFinite(action?.dataIndex) ? action.dataIndex : null,
      kLineData: clickedData,
    });
  }, [onSessionChange]);

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

    createIndicatorWithTracking(chart, 'MA');
    createIndicatorWithTracking(chart, 'VOL');
    createIndicatorWithTracking(chart, 'MACD');

    if (typeof chart.subscribeAction === 'function') {
      chart.subscribeAction('onCandleBarClick', handleCandleBarClick);
    }

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (typeof chart.unsubscribeAction === 'function') {
        chart.unsubscribeAction('onCandleBarClick', handleCandleBarClick);
      }
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
    if (!chartRef.current || !data?.length) return;

    const kLineData = data
      .filter((d) => d.date && d.close != null)
      .map((d) => ({
        timestamp: new Date(d.date).getTime(),
        date: d.date,
        tradeDate: normalizeTradeDate(d.date),
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
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    ['CVD', 'STRENGTH', 'WHALE_FLOW'].forEach((indicatorId) => {
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
        if (paneId) {
          chart.overrideIndicator(config.template, paneId);
        } else {
          const createdPaneId = chart.createIndicator(config.template, false, config.paneOptions);
          rememberIndicatorPane(indicatorId, createdPaneId || config.paneOptions.id);
        }
      } catch (error) {
        console.error(`Error syncing custom indicator ${indicatorId}:`, error);
      }
    });
  }, [activeIndicators.CVD, activeIndicators.STRENGTH, activeIndicators.WHALE_FLOW, customIndicatorDefs]);

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
            const isActive = Boolean(activeIndicators[control.id]);
            return (
              <button
                key={control.id}
                onClick={() => handleToggleIndicator(control.id)}
                className={`h-7 px-2 py-1 text-[11px] font-medium rounded transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0f766e] text-white'
                    : 'bg-[#2a2e39] text-[#b2b5be] hover:bg-[#363a45]'
                }`}
                title={control.title}
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