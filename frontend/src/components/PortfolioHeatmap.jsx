import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { SunburstChart, TreemapChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/LangContext';

echarts.use([TreemapChart, SunburstChart, CanvasRenderer]);

/**
 * PortfolioHeatmap
 * Hiển thị tỷ trọng và biến động (heat) của các mã trong danh mục.
 * Hỗ trợ chuyển đổi mượt mà giữa Treemap và Sunburst (Hierarchical).
 */

// Stable references outside component — prevents useMemo from recomputing on every render
const FINTECH_HEAT_COLORS = {
  upStrong: '#00FFBB',   // Neon Emerald
  upSoft: '#00CC99',
  downStrong: '#FF3344', // Electric Red
  downSoft: '#FF6677',
  neutral: '#2A2E39',
};

const HEAT_SCALE_COLORS = [
  FINTECH_HEAT_COLORS.downStrong,
  FINTECH_HEAT_COLORS.downSoft,
  FINTECH_HEAT_COLORS.neutral,
  FINTECH_HEAT_COLORS.upSoft,
  FINTECH_HEAT_COLORS.upStrong,
];

const PIECEWISE_VISUAL_MAP = {
  show: false,
  type: 'continuous',
  dimension: 1,
  min: -6,
  max: 6,
  inRange: {
    color: HEAT_SCALE_COLORS,
    colorAlpha: [0.45, 0.92],
  },
  outOfRange: {
    color: [FINTECH_HEAT_COLORS.neutral],
    colorAlpha: 0.4,
  },
};

const TREEMAP_LEVELS = [
  {
    itemStyle: {
      borderWidth: 0,
      gapWidth: 5,
    },
  },
  {
    itemStyle: {
      borderColor: 'rgba(15, 23, 10, 0.55)',
      borderWidth: 1.5,
      gapWidth: 1.5,
    },
  },
];

export default function PortfolioHeatmap({ holdings, title, compact }) {
  const { t, locale, localeTag } = useI18n();
  const [viewMode, setViewMode] = useState('treemap');
  const [sizeMetric, setSizeMetric] = useState('cap');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [detailAnchor, setDetailAnchor] = useState(null);
  const HEATMAP_MIN_HEIGHT = compact
    ? (viewMode === 'sunburst' ? 300 : 300)
    : (viewMode === 'sunburst' ? 500 : 460);
  const chartComponentRef = useRef(null);
  const chartContainerRef = useRef(null);
  const heatmapShellRef = useRef(null);
  const detailCardRef = useRef(null);
  const resizeRafRef = useRef(0);

  const safeResizeChart = useCallback(() => {
    const chart = chartComponentRef.current?.getEchartsInstance?.();
    if (!chart || chart.isDisposed?.()) {
      return;
    }
    // NOTE: Do NOT dispatch hideTip here — it kills the tooltip on every
    // resize / realtime data update, making tooltip permanently invisible.
    // No padding subtraction — container has no padding so full width is correct.
    const container = chartContainerRef.current;
    const explicitWidth = container ? Math.max(Math.floor(container.getBoundingClientRect().width), 120) : undefined;
    const explicitHeight = container ? Math.max(Math.floor(container.getBoundingClientRect().height), 200) : undefined;
    chart.resize({
      width: explicitWidth,
      height: explicitHeight,
      animation: {
        duration: 0,
      },
    });
  }, []);

  useEffect(() => {
    const scheduleResize = () => {
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        safeResizeChart();
      });
    };

    const observer = new ResizeObserver(() => {
      scheduleResize();
    });

    const container = chartContainerRef.current;
    if (container) {
      observer.observe(container);
      if (container.parentElement) {
        observer.observe(container.parentElement);
      }
    }

    // Initial render can race with flex/grid sizing; retry a few times to
    // ensure ECharts hitbox matches visual tiles.
    const settleTimer = window.setInterval(scheduleResize, 180);
    const settleStopTimer = window.setTimeout(() => {
      window.clearInterval(settleTimer);
    }, 2200);

    window.addEventListener('resize', scheduleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.clearInterval(settleTimer);
      window.clearTimeout(settleStopTimer);
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = 0;
      }
      
    };
  }, [safeResizeChart]);

  useEffect(() => {
    if (!selectedSymbol) {
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      if (!heatmapShellRef.current?.contains(event.target)) {
        setSelectedSymbol(null);
        setDetailAnchor(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [selectedSymbol]);

  const toNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim();
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const formatPercent = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0.00%';
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(2)}%`;
  }, []);

  const getVolatilityLevelLabel = useCallback((changePct) => {
    const absChange = Math.abs(toNumber(changePct));
    if (absChange >= 5) return t('dashboardRealtime.heatmapTooltipVolatilityVeryHigh', { defaultValue: 'Rất cao' });
    if (absChange >= 3) return t('dashboardRealtime.heatmapTooltipVolatilityHigh', { defaultValue: 'Cao' });
    if (absChange >= 1) return t('dashboardRealtime.heatmapTooltipVolatilityMedium', { defaultValue: 'Vừa' });
    return t('dashboardRealtime.heatmapTooltipVolatilityLow', { defaultValue: 'Thấp' });
  }, [t]);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const hexToRgba = (hexColor, alpha = 1) => {
    const hex = String(hexColor || '').replace('#', '');
    if (hex.length !== 6) return `rgba(42, 46, 57, ${alpha})`;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const resolveHeatTileStyle = (changePct) => {
    const magnitude = clamp(Math.abs(toNumber(changePct)) / 5, 0, 1);
    const alpha = 0.42 + (magnitude * 0.46);

    if (changePct > 0) {
      const base = changePct >= 2.5 ? FINTECH_HEAT_COLORS.upStrong : FINTECH_HEAT_COLORS.upSoft;
      return {
        fill: hexToRgba(base, alpha),
        glow: hexToRgba(FINTECH_HEAT_COLORS.upStrong, 0.24),
      };
    }
    if (changePct < 0) {
      const base = changePct <= -2.5 ? FINTECH_HEAT_COLORS.downStrong : FINTECH_HEAT_COLORS.downSoft;
      return {
        fill: hexToRgba(base, alpha),
        glow: hexToRgba(FINTECH_HEAT_COLORS.downStrong, 0.22),
      };
    }
    return {
      fill: hexToRgba(FINTECH_HEAT_COLORS.neutral, 0.52),
      glow: 'rgba(0, 0, 0, 0)',
    };
  };

  const chartData = useMemo(() => {
    if (!holdings?.length) return { grouped: [], flat: [] };

    const sectors = {};
    const flatList = [];

    // Pre-pass: tính avg giá trị danh mục của holdings để làm nominal cho watchlist (weight mode)
    const holdingPortfolioValues = (holdings || [])
      .filter(h => h.is_holding)
      .map(h => {
        const v = toNumber(h.live_market_value);
        const s = toNumber(h.market_value);
        return v > 0 ? v : s;
      })
      .filter(v => v > 0);
    const avgHoldingPortfolioValue = holdingPortfolioValues.length > 0
      ? holdingPortfolioValues.reduce((acc, v) => acc + v, 0) / holdingPortfolioValues.length
      : 1;
    // Watchlist trong weight mode: nominal = 15% avg holding → hiển thị rõ nhưng nhỏ hơn holdings
    const watchlistNominalWeight = Math.max(avgHoldingPortfolioValue * 0.15, 1);

    (holdings || []).forEach((h) => {
      const liveValue = toNumber(h.live_market_value);
      const snapshotValue = toNumber(h.market_value);
      // market_cap_bn (tỷ VND) từ static profile sync — nguồn chính xác nhất
      const marketCapFromProfile = toNumber(h.market_cap_bn) * 1e9; // tỷ → VND
      const marketCapFromFeed = toNumber(h.live_market_cap || h.market_cap);
      const priceProxy = toNumber(h.live_current_price || h.current_price);
      const qtyProxy = toNumber(h.quantity || h.shares);
      const portfolioValue = h.is_holding ? (liveValue > 0 ? liveValue : snapshotValue) : 0;
      const estimatedCap = priceProxy > 0 && qtyProxy > 0 ? priceProxy * qtyProxy : portfolioValue;

      let size;
      if (sizeMetric === 'cap') {
        // Vốn hóa: ưu tiên profile > realtime feed > ước tính.
        // Watchlist-only symbols thường chưa có quantity/market_value, nên nếu cap chưa hydrate
        // thì vẫn cần một nominal size để heatmap không biến mất hoàn toàn.
        size = marketCapFromProfile > 0 ? marketCapFromProfile
             : marketCapFromFeed > 0 ? marketCapFromFeed
             : estimatedCap > 0 ? estimatedCap
             : h.is_holding ? Math.max(portfolioValue, 1)
             : watchlistNominalWeight;
      } else {
        // Tỷ trọng: holdings theo giá trị danh mục thực; watchlist hiển thị nominal bằng nhau
        size = h.is_holding ? portfolioValue : watchlistNominalWeight;
      }

      if (size <= 0) return;

      const rawChange = h.live_change_pct ?? h.change_pct ?? 0;
      const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
      const symbol = String(h.symbol || h.name || '').trim().toUpperCase();
      if (!symbol) return;

      const industryStr = String(h.industry || 'Khác').trim();
      const industry = (industryStr && industryStr !== 'undefined') ? industryStr : 'Khác';
      
      const isExtreme = Math.abs(changePct) >= 3;
      const tileStyle = resolveHeatTileStyle(changePct);

      const resolvedMarketCap = marketCapFromProfile > 0 ? marketCapFromProfile : marketCapFromFeed;
      const sortMarketCap = resolvedMarketCap > 0 ? resolvedMarketCap : estimatedCap;

      const leafNode = {
        id: `symbol:${symbol}`,
        name: symbol,
        symbol,
        companyName: String(h.company_name || h.name || symbol).trim(),
        industry,
        isHolding: Boolean(h.is_holding),
        livePrice: toNumber(h.live_current_price || h.current_price),
        marketCap: resolvedMarketCap,
        sortMarketCap,
        volume: toNumber(h.live_volume || h.volume),
        sparkline24: Array.isArray(h.sparkline24) ? h.sparkline24 : [],
        quantity: h.is_holding ? toNumber(h.quantity) : null,
        avgCost: h.is_holding ? toNumber(h.avg_cost) : null,
        unrealizedPl: h.is_holding ? toNumber(h.live_unrealized_pl ?? h.unrealized_pl) : null,
        unrealizedPlPct: h.is_holding ? toNumber(h.live_unrealized_pl_pct ?? h.unrealized_pl_pct) : null,
        sizeValue: size,
        changePct,
        value: [size, changePct], // [size, change]
        itemStyle: {
          color: tileStyle.fill,
          borderColor: h.is_holding ? 'rgba(250, 204, 21, 0.75)' : 'rgba(15, 23, 42, 0.32)',
          borderWidth: h.is_holding ? 2 : 1,
          shadowBlur: isExtreme ? 15 : 0,
          shadowColor: isExtreme ? tileStyle.glow : 'rgba(0, 0, 0, 0)',
        },
      };

      // Add to flat list
      flatList.push(leafNode);

      // Add to grouped structure
      if (!sectors[industry]) {
        sectors[industry] = {
          name: industry,
          children: [],
          totalSize: 0,
          totalMarketCap: 0,
          weightedChange: 0,
        };
      }
      sectors[industry].children.push(leafNode);
      sectors[industry].totalSize += size;
      sectors[industry].totalMarketCap += sortMarketCap;
      sectors[industry].weightedChange += size * changePct;
    });

    // Rank-score normalization (1–100):
    // - Sắp xếp tất cả mã theo sizeValue tăng dần → gán rank 1..n
    // - Map rank → score trong [RANK_MIN, 100] theo công thức tuyến tính
    // - Tile nhỏ nhất luôn = RANK_MIN (không bao giờ ẩn), lớn nhất = 100
    // - Thứ tự tương đối được bảo toàn (VCB > HPG > MBS)
    // - Tỷ lệ diện tích tối đa là 100/RANK_MIN = 20:1, hợp lý để hiển thị
    const RANK_MIN = 5; // score thấp nhất để tile nhỏ nhất vẫn readable
    const sorted = [...flatList].sort((a, b) => a.sizeValue - b.sizeValue);
    const rankMap = new Map();
    sorted.forEach((node, idx) => {
      const n = sorted.length;
      const score = n === 1
        ? 100
        : RANK_MIN + ((idx) / (n - 1)) * (100 - RANK_MIN);
      rankMap.set(node.id, Math.round(score * 10) / 10); // giữ 1 chữ số thập phân
    });

    const normalizeNode = (node) => {
      const normalizedDisplaySize = rankMap.get(node.id) ?? RANK_MIN;
      return {
        ...node,
        value: [normalizedDisplaySize, node.changePct],
      };
    };

    // 1. Process Flat Data (Treemap)
    const processedFlatData = flatList
      .map(normalizeNode)
      .sort((a, b) => (b.sortMarketCap - a.sortMarketCap) || (b.value[0] - a.value[0]));

    // 2. Process Grouped Data (Sunburst)
    const processedGroupedData = Object.values(sectors).map((sector) => {
      const avgChange = sector.totalSize > 0 ? sector.weightedChange / sector.totalSize : 0;
      const normalizedChildren = sector.children.map(normalizeNode);
      const sectorDisplayTotal = normalizedChildren.reduce((sum, c) => sum + c.value[0], 0);

      return {
        id: `industry:${sector.name}`,
        name: sector.name,
        value: sectorDisplayTotal,
        sortMarketCap: sector.totalMarketCap,
        changePct: avgChange,
        children: normalizedChildren.sort((a, b) => (b.sortMarketCap - a.sortMarketCap) || (b.value[0] - a.value[0])),
      };
    }).sort((a, b) => (b.sortMarketCap - a.sortMarketCap) || (b.value - a.value));

    return { grouped: processedGroupedData, flat: processedFlatData };
  }, [holdings, sizeMetric]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }
    const stillExists = chartData.flat.some((leaf) => leaf.symbol === selectedSymbol);
    if (!stillExists) {
      setSelectedSymbol(null);
      setDetailAnchor(null);
    }
  }, [chartData.flat, selectedSymbol]);

  const selectedLeaf = useMemo(
    () => chartData.flat.find((leaf) => leaf.symbol === selectedSymbol) || null,
    [chartData.flat, selectedSymbol],
  );

  useEffect(() => {
    if (!selectedLeaf || !detailAnchor || !chartContainerRef.current || !detailCardRef.current) {
      return;
    }

    const containerRect = chartContainerRef.current.getBoundingClientRect();
    const cardRect = detailCardRef.current.getBoundingClientRect();
    const padding = 12;
    const clampedLeft = clamp(detailAnchor.left, (cardRect.width / 2) + padding, containerRect.width - (cardRect.width / 2) - padding);
    const clampedTop = clamp(detailAnchor.top, (cardRect.height / 2) + padding, containerRect.height - (cardRect.height / 2) - padding);

    if (Math.abs(clampedLeft - detailAnchor.left) > 1 || Math.abs(clampedTop - detailAnchor.top) > 1) {
      setDetailAnchor({ left: clampedLeft, top: clampedTop });
    }
  }, [detailAnchor, selectedLeaf]);

  useEffect(() => {
    safeResizeChart();
  }, [safeResizeChart, viewMode, sizeMetric, chartData.flat.length]);

  const maxLeafSize = useMemo(() => {
    let max = 0;
    chartData.flat.forEach((leaf) => {
      const val = Array.isArray(leaf.value) ? toNumber(leaf.value[0]) : toNumber(leaf.value);
      if (val > max) {
        max = val;
      }
    });
    return max || 1;
  }, [chartData.flat]);

  const buildLeafLabel = useCallback((params) => {
    const leaf = params?.data;
    if (!leaf || leaf.children) {
      return '';
    }

    const rawCp = Array.isArray(leaf.value) ? leaf.value[1] : Number(leaf.changePct || 0);
    const cp = Number.isFinite(rawCp) ? rawCp : 0;
    const price = toNumber(leaf.livePrice);
    const sizeValue = Array.isArray(leaf.value) ? toNumber(leaf.value[0]) : toNumber(leaf.value);
    const ratio = sizeValue / maxLeafSize;

    if (ratio < 0.3) {
      return `{symbol|${leaf.name}}`;
    }
    if (ratio < 0.42) {
      return `{symbol|${leaf.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(2)}%}`;
    }
    return `{symbol|${leaf.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(2)}%}\n{price|${price > 0 ? price.toFixed(2) : '\u2014'} VND}`;
  }, [maxLeafSize]);

  // Build inline SVG sparkline for tooltip chart
  const buildSparklineSvg = useCallback((values, width = 160, height = 40) => {
    const points = (Array.isArray(values) ? values : [])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0)
      .slice(-24);

    if (points.length < 2) return '';

    const minV = Math.min(...points);
    const maxV = Math.max(...points);
    const range = maxV - minV || 1;
    const padX = 4;
    const padY = 4;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const toX = (i) => (padX + (i / (points.length - 1)) * innerW).toFixed(1);
    const toY = (v) => (padY + innerH - ((v - minV) / range) * innerH).toFixed(1);
    const polyPoints = points.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const lastX = toX(points.length - 1);
    const lastY = toY(points[points.length - 1]);
    const isUp = points[points.length - 1] >= points[0];
    const lineColor = isUp ? '#4ade80' : '#f87171';
    const dotColor = isUp ? '#86efac' : '#fca5a5';
    // Filled area path
    const areaPath = `M${toX(0)},${toY(points[0])} ` +
      points.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ') +
      ` L${lastX},${height} L${padX},${height} Z`;
    return [
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:6px 0 2px">`,
      `<path d="${areaPath}" fill="${lineColor}" fill-opacity="0.12"/>`,
      `<polyline points="${polyPoints}" fill="none" stroke="${lineColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`,
      `<circle cx="${lastX}" cy="${lastY}" r="3" fill="${dotColor}" stroke="rgba(10,18,35,0.8)" stroke-width="1"/>`,
      `</svg>`,
    ].join('');
  }, []);

  const formatCompactNumber = useCallback((value, digits = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '\u2014';
    return new Intl.NumberFormat(localeTag || 'vi-VN', {
      notation: 'compact',
      maximumFractionDigits: digits,
    }).format(numeric);
  }, [localeTag]);

  const dispatchSyncEvent = useCallback((params) => {
    const data = params?.data;
    if (!data || data.children) return; // bỏ qua sector node
    window.dispatchEvent(new CustomEvent('vninvest:sync:interaction', {
      detail: {
        timestamp: Date.now(),
        symbol: data.symbol || data.name,
        source: 'PortfolioHeatmap',
        action: 'select',
      },
    }));
  }, []);

  const handleHeatmapClick = useCallback((params) => {
    const data = params?.data;
    if (!data || data.children) {
      return;
    }

    const nativeEvent = params?.event?.event || params?.event;
    const offsetX = Number(nativeEvent?.offsetX);
    const offsetY = Number(nativeEvent?.offsetY);
    const container = chartContainerRef.current;

    if (container && Number.isFinite(offsetX) && Number.isFinite(offsetY)) {
      setDetailAnchor({ left: offsetX, top: offsetY });
    } else if (container) {
      const rect = container.getBoundingClientRect();
      setDetailAnchor({ left: rect.width / 2, top: rect.height / 2 });
    }

    setSelectedSymbol(data.symbol || data.name);
    dispatchSyncEvent(params);
  }, [dispatchSyncEvent]);

  const option = useMemo(() => {
    const dataSet = viewMode === 'sunburst' ? chartData.grouped : chartData.flat;
    if (!dataSet || dataSet.length === 0) return null;

    const tooltip = {
      show: false,
      trigger: 'item',
      triggerOn: 'none',
    };

    if (viewMode === 'sunburst') {
      return {
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
        animationEasingUpdate: 'linear',
        tooltip,
        series: [
          {
            type: 'sunburst',
            id: 'portfolio-heatmap-transition',
            data: chartData.grouped,
            sort: 'desc',
            center: ['50%', '50%'],
            radius: ['5%', '92%'],
            nodeClick: false,
            universalTransition: false,
            stateAnimation: { duration: 0 },
            emphasis: {
              disabled: false,
              itemStyle: {
                borderWidth: 3,
                borderColor: '#ffffff',
                shadowBlur: 15,
                shadowColor: 'rgba(255, 255, 255, 0.45)',
              },
              label: {
                show: true,
                fontWeight: 'bold',
              },
            },
            itemStyle: {
              borderColor: 'rgba(2, 6, 23, 0.78)',
              borderWidth: 1.5,
            },
            label: {
              rotate: 0,
              align: 'center',
              verticalAlign: 'middle',
              minAngle: 5,
              formatter: (params) => {
                if (params?.data?.children) return params.name;
                return buildLeafLabel(params);
              },
              rich: {
                symbol: {
                  color: '#f8fafc',
                  fontWeight: 800,
                  fontSize: 12,
                  lineHeight: 14,
                  textShadowBlur: 2,
                  textShadowColor: 'rgba(2, 6, 23, 0.6)',
                },
                pct: {
                  color: 'rgba(241,245,249,0.95)',
                  fontSize: 10,
                  lineHeight: 11,
                },
                price: {
                  color: 'rgba(226,232,240,0.95)',
                  fontSize: 9,
                  lineHeight: 10,
                },
              },
            },
            levels: [
              {
                itemStyle: {
                  borderWidth: 0,
                },
              },
              {
                r0: '5%',
                r: '46%',
                itemStyle: {
                  borderColor: 'rgba(2, 6, 23, 0.82)',
                  borderWidth: 2,
                },
                label: {
                  rotate: 0,
                  color: '#e2e8f0',
                  fontWeight: 800,
                  fontSize: 13,
                },
              },
              {
                r0: '48%',
                r: '92%',
                itemStyle: {
                  borderColor: 'rgba(2, 6, 23, 0.72)',
                  borderWidth: 1.5,
                },
                label: {
                  rotate: 0,
                  align: 'center',
                  verticalAlign: 'middle',
                },
              },
            ],
          },
        ],
      };
    }

    return {
      backgroundColor: 'transparent',
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      animationEasingUpdate: 'linear',
      tooltip,
      series: [
        {
          type: 'treemap',
          id: 'portfolio-heatmap-transition',
          data: chartData.flat,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: false,
          universalTransition: false,
          stateAnimation: { duration: 0 },
          breadcrumb: { show: false },
          sort: 'desc',
          squareRatio: 0.5,
          visibleMin: 1,
          childrenVisibleMin: 0,
          levels: TREEMAP_LEVELS,
          emphasis: {
            disabled: false,
            itemStyle: {
              borderWidth: 2,
              borderColor: '#ffffff',
              shadowBlur: 12,
              shadowColor: 'rgba(255, 255, 255, 0.4)',
            },
            label: {
              show: true,
              fontWeight: '900',
            },
          },
          label: {
            show: true,
            position: ['50%', '50%'],
            align: 'center',
            verticalAlign: 'middle',
            padding: 0,
            formatter: buildLeafLabel,
            overflow: 'truncate',
            rich: {
              symbol: {
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 14,
                lineHeight: 16,
                textShadowBlur: 3,
                textShadowColor: 'rgba(0, 0, 0, 0.7)',
                align: 'center',
              },
              pct: {
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 700,
                fontSize: 11,
                lineHeight: 12,
                align: 'center',
              },
              price: {
                color: 'rgba(226,232,240,0.95)',
                fontWeight: 600,
                fontSize: 9,
                lineHeight: 10,
                align: 'center',
              },
            },
          },
          upperLabel: { show: false },
        },
      ],
    };
  }, [viewMode, chartData, buildLeafLabel, buildSparklineSvg, formatPercent, localeTag, t]);

  if (!chartData.flat.length) {
    return (
      <div className="bg-gray-950/50 backdrop-blur-md border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-400">
          ⊞
        </div>
        <p className="text-gray-400 text-sm font-medium">{t('dashboardRealtime.heatmapEmpty', { defaultValue: 'Chưa có dữ liệu heatmap cho danh mục này.' })}</p>
      </div>
    );
  }

  return (
    <div ref={heatmapShellRef} className="group relative h-full min-h-0 bg-slate-900/76 backdrop-blur-[12px] border border-slate-700/68 rounded-2xl flex flex-col overflow-hidden transition-all duration-500 hover:border-slate-500/80 shadow-2xl">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/5 rounded-full blur-[96px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-700" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-teal-500/5 rounded-full blur-[96px] pointer-events-none group-hover:bg-teal-500/10 transition-colors duration-700" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/55 bg-slate-950/62 flex flex-col gap-4 z-10">
        {/* Row 1: Title */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-[10px] sm:text-xs font-black text-slate-200 uppercase tracking-[0.2em] flex items-center gap-2">
              {title}
              <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </h3>
            <p className="text-[9px] text-slate-400/95 font-bold uppercase mt-0.5 tracking-wider">
              {t('dashboardRealtime.heatmapRealtimeCaption', { defaultValue: 'Biến động theo dõi • Realtime feed' })}
            </p>
          </div>
          <div className="text-[9px] text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/50">
             LIVE FEED
          </div>
        </div>

        {/* Row 2: Controls */}
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-900/85 p-1 rounded-full border border-slate-700/50 shadow-inner">
            <button
              onClick={() => setSizeMetric('weight')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all duration-300 ${sizeMetric === 'weight' ? 'bg-cyan-500 text-white shadow-[0_0_16px_rgba(6,182,212,0.35)]' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t('dashboardRealtime.heatmapSizeWeight', { defaultValue: 'Giá trị' })}
            </button>
            <button
              onClick={() => setSizeMetric('cap')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all duration-300 ${sizeMetric === 'cap' ? 'bg-cyan-500 text-white shadow-[0_0_16px_rgba(6,182,212,0.35)]' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t('dashboardRealtime.heatmapSizeCap', { defaultValue: 'Cap' })}
            </button>
          </div>
          <div className="flex bg-slate-900/84 p-1 rounded-xl border border-slate-700/55 shadow-inner">
            <button 
              onClick={() => setViewMode('treemap')}
              className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'treemap' ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)] scale-[1.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <span style={{ fontSize: '14px' }}>⊞</span>
              {t('dashboardRealtime.heatmapModeTreemap', { defaultValue: 'Treemap' })}
            </button>
            <button 
              onClick={() => setViewMode('sunburst')}
              className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'sunburst' ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)] scale-[1.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <span style={{ fontSize: '14px' }}>◎</span>
              {t('dashboardRealtime.heatmapModeSunburst', { defaultValue: 'Sunburst' })}
            </button>
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} className="relative z-10 flex-1 min-h-0" style={{ minHeight: HEATMAP_MIN_HEIGHT }}>
        <ReactEChartsCore
          echarts={echarts}
          key={`${viewMode}-${sizeMetric}-${locale}`}
          ref={chartComponentRef}
          option={option}
          style={{ height: '100%', minHeight: HEATMAP_MIN_HEIGHT, width: '100%' }}
          notMerge={false}
          lazyUpdate={true}
          opts={{ renderer: 'canvas' }}
          onEvents={{ click: handleHeatmapClick }}
          onChartReady={() => {
            // Immediate attempt + progressive fallbacks:
            // flex layout may not be complete when onChartReady fires.
            safeResizeChart();
            requestAnimationFrame(() => {
              safeResizeChart();
              requestAnimationFrame(safeResizeChart);
            });
            // setTimeout 150ms catches cases where flex/grid settles late
            setTimeout(safeResizeChart, 150);
            setTimeout(safeResizeChart, 420);
            setTimeout(safeResizeChart, 900);
          }}
        />

        {selectedLeaf && detailAnchor && (
          <div
            ref={detailCardRef}
            className="absolute z-20 w-[240px] max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-600/80 bg-slate-950/95 shadow-[0_18px_48px_rgba(2,6,23,0.72)] backdrop-blur-xl"
            style={{ left: detailAnchor.left, top: detailAnchor.top }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/stocks/${selectedLeaf.symbol}`}
                    className="text-sm font-black tracking-[0.14em] text-slate-50 underline decoration-slate-500/60 underline-offset-2 transition-colors hover:text-cyan-300"
                    title={t('dashboardRealtime.heatmapTooltipOpenStockDetail', { defaultValue: 'Mở trang chi tiết cổ phiếu' })}
                  >
                    {selectedLeaf.symbol}
                  </Link>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${selectedLeaf.changePct > 0 ? 'bg-emerald-500/15 text-emerald-300' : selectedLeaf.changePct < 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-700/60 text-slate-300'}`}>
                    {formatPercent(selectedLeaf.changePct)}
                  </span>
                </div>
                {selectedLeaf.companyName && selectedLeaf.companyName !== selectedLeaf.symbol && (
                  <div className="truncate text-[10px] text-slate-400">{selectedLeaf.companyName}</div>
                )}
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">{selectedLeaf.industry || t('dashboardRealtime.heatmapTooltipIndustryFallback', { defaultValue: 'Khác' })}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSymbol(null);
                  setDetailAnchor(null);
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-black text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
              >
                {t('common.close', { defaultValue: 'Đóng' })}
              </button>
            </div>

            {Array.isArray(selectedLeaf.sparkline24) && selectedLeaf.sparkline24.length > 1 && (
              <div className="border-b border-slate-800/70 bg-slate-950/60 px-3 pt-2 pb-1.5">
                <div dangerouslySetInnerHTML={{ __html: buildSparklineSvg(selectedLeaf.sparkline24, 214, 42) }} />
                <div className="-mt-0.5 text-right text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {t('dashboardRealtime.heatmapTooltipTrend24h', { defaultValue: 'Xu hướng 24h' })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-[11px]">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('dashboardRealtime.heatmapTooltipCurrentPrice', { defaultValue: 'Giá hiện tại' })}</div>
                <div className="mt-0.5 font-bold text-slate-100">{selectedLeaf.livePrice > 0 ? `${selectedLeaf.livePrice.toFixed(2)} VND` : '\u2014'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('dashboardRealtime.heatmapTooltipVolume', { defaultValue: 'Khối lượng' })}</div>
                <div className="mt-0.5 font-bold text-slate-100">{selectedLeaf.volume > 0 ? Math.round(selectedLeaf.volume).toLocaleString(localeTag || 'vi-VN') : '\u2014'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('dashboardRealtime.heatmapTooltipMarketCap', { defaultValue: 'Vốn hóa' })}</div>
                <div className="mt-0.5 font-bold text-slate-100">{formatCompactNumber(selectedLeaf.marketCap || selectedLeaf.sortMarketCap)}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {t('dashboardRealtime.heatmapTooltipVolatilityLevel', { defaultValue: 'Mức độ biến động' })}
                </div>
                <div className="mt-0.5 font-bold text-slate-100">{`${getVolatilityLevelLabel(selectedLeaf.changePct)} (${formatPercent(selectedLeaf.changePct)})`}</div>
              </div>
            </div>

            {selectedLeaf.isHolding && (selectedLeaf.quantity > 0 || selectedLeaf.avgCost > 0 || selectedLeaf.unrealizedPl !== null) && (
              <div className="mx-3 mb-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
                <div className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
                  {t('dashboardRealtime.heatmapTooltipHoldingTag', { defaultValue: 'Đang nắm giữ' })}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('dashboardRealtime.heatmapTooltipQuantity', { defaultValue: 'Số lượng CP' })}</div>
                    <div className="mt-0.5 font-bold text-slate-100">{selectedLeaf.quantity > 0 ? selectedLeaf.quantity.toLocaleString(localeTag || 'vi-VN') : '\u2014'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('dashboardRealtime.heatmapTooltipAvgCost', { defaultValue: 'Giá vốn TB' })}</div>
                    <div className="mt-0.5 font-bold text-slate-100">{selectedLeaf.avgCost > 0 ? `${selectedLeaf.avgCost.toFixed(2)} VND` : '\u2014'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('dashboardRealtime.heatmapTooltipUnrealizedPl', { defaultValue: 'Lãi/Lỗ chưa TH' })}</div>
                    <div className={`mt-0.5 inline-flex rounded-md px-2 py-1 font-bold ${selectedLeaf.unrealizedPl > 0 ? 'bg-emerald-500/15 text-emerald-300' : selectedLeaf.unrealizedPl < 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-700/60 text-slate-300'}`}>
                      {selectedLeaf.unrealizedPl !== null
                        ? `${selectedLeaf.unrealizedPl > 0 ? '+' : ''}${formatCompactNumber(Math.abs(selectedLeaf.unrealizedPl), 2)} (${selectedLeaf.unrealizedPlPct > 0 ? '+' : ''}${selectedLeaf.unrealizedPlPct.toFixed(2)}%)`
                        : '\u2014'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="absolute bottom-5 right-5 flex items-center gap-4 bg-slate-950/88 px-4 py-1.5 rounded-2xl border border-slate-700/85 shadow-2xl backdrop-blur-xl pointer-events-none transition-transform group-hover:scale-105">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00FFBB] shadow-[0_0_8px_rgba(0,255,187,0.45)]" />
            <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendUp', { defaultValue: 'Tăng' })}
            </span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF3344] shadow-[0_0_8px_rgba(255,51,68,0.45)]" />
            <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendDown', { defaultValue: 'Giảm' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
