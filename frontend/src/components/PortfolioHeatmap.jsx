import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useI18n } from '../context/LangContext';

/**
 * PortfolioHeatmap
 * Hiển thị tỷ trọng và biến động (heat) của các mã trong danh mục.
 * Hỗ trợ chuyển đổi mượt mà giữa Treemap và Sunburst (Hierarchical).
 */

// Stable references outside component — prevents useMemo from recomputing on every render
const FINTECH_HEAT_COLORS = {
  upStrong: '#089981',
  upSoft: '#1B5E20',
  downStrong: '#F23645',
  downSoft: '#7F1D1D',
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

export default function PortfolioHeatmap({ holdings, title }) {
  const { t, locale, localeTag } = useI18n();
  const [viewMode, setViewMode] = useState('treemap');
  const [sizeMetric, setSizeMetric] = useState('cap');
  const HEATMAP_HEIGHT = 420;
  const chartComponentRef = useRef(null);
  const chartContainerRef = useRef(null);
  const resizeRafRef = useRef(0);

  const safeResizeChart = useCallback(() => {
    const chart = chartComponentRef.current?.getEchartsInstance?.();
    if (!chart || chart.isDisposed?.()) {
      return;
    }
    // NOTE: Do NOT dispatch hideTip here — it kills the tooltip on every
    // resize / realtime data update, making tooltip permanently invisible.
    chart.resize({
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

    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }

    window.addEventListener('resize', scheduleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = 0;
      }
      
      const chart = chartComponentRef.current?.getEchartsInstance?.();
      if (chart && !chart.isDisposed()) {
        try {
          chart.dispatchAction({ type: 'hideTip' });
        } catch (_) {
          // Ignore tip action errors during unmount race.
        }
      }
    };
  }, [safeResizeChart]);

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

    (holdings || []).forEach((h) => {
      const liveValue = toNumber(h.live_market_value);
      const snapshotValue = toNumber(h.market_value);
      const marketCap = toNumber(h.live_market_cap || h.market_cap);
      
      const sizeByWeight = liveValue > 0 ? liveValue : snapshotValue;
      const sizeByCap = marketCap > 0 ? marketCap : sizeByWeight;
      const size = sizeMetric === 'cap' ? sizeByCap : sizeByWeight;

      if (size <= 0) return;

      const rawChange = h.live_change_pct ?? h.change_pct ?? 0;
      const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
      const symbol = String(h.symbol || h.name || '').trim().toUpperCase();
      if (!symbol) return;

      const industryStr = String(h.industry || 'Khác').trim();
      const industry = (industryStr && industryStr !== 'undefined') ? industryStr : 'Khác';
      
      const isExtreme = Math.abs(changePct) >= 3;
      const tileStyle = resolveHeatTileStyle(changePct);

      const sortMarketCap = marketCap > 0 ? marketCap : sizeByCap;

      const leafNode = {
        id: `symbol:${symbol}`,
        name: symbol,
        symbol,
        companyName: String(h.company_name || h.name || symbol).trim(),
        industry,
        isHolding: Boolean(h.is_holding),
        livePrice: toNumber(h.live_current_price || h.current_price),
        marketCap,
        sortMarketCap,
        volume: toNumber(h.live_volume || h.volume),
        sparkline24: Array.isArray(h.sparkline24) ? h.sparkline24 : [],
        sizeValue: size,
        changePct,
        value: [size, changePct], // [size, change]
        itemStyle: {
          color: tileStyle.fill,
          borderColor: h.is_holding ? 'rgba(250, 204, 21, 0.75)' : 'rgba(15, 23, 42, 0.32)',
          borderWidth: h.is_holding ? 2 : 1,
          shadowBlur: isExtreme ? 10 : 0,
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

    // Calculate Global Normalization (Bloomberg Style)
    // We want to compress huge outliers (VCB/HPG) so they don't eat 90% of the screen,
    // but still clearly indicate their relative rank.
    const allSizes = flatList.map(l => l.sizeValue);
    const minSize = allSizes.length ? Math.min(...allSizes) : 1;
    const sqrtMin = Math.sqrt(Math.max(minSize, 1));

    const normalizeNode = (node) => {
      const sqrtRaw = Math.sqrt(Math.max(node.sizeValue, 1));
      const normalizedDisplaySize = Math.max(sqrtRaw / Math.max(sqrtMin, 1), 1);
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

    if (ratio < 0.18) {
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

  const option = useMemo(() => {
    const dataSet = viewMode === 'sunburst' ? chartData.grouped : chartData.flat;
    if (!dataSet || dataSet.length === 0) return null;

    const fallbackIndustryLabel = t('dashboardRealtime.heatmapTooltipIndustryFallback', { defaultValue: 'Khác' });
    const groupLabel = t('dashboardRealtime.heatmapTooltipGroupLabel', { defaultValue: 'Nhóm ngành' });
    const averageChangeLabel = t('dashboardRealtime.heatmapTooltipAverageChange', { defaultValue: 'Biến động b.quân' });
    const currentPriceLabel = t('dashboardRealtime.heatmapTooltipCurrentPrice', { defaultValue: 'Giá hiện tại' });
    const marketCapLabel = t('dashboardRealtime.heatmapTooltipMarketCap', { defaultValue: 'Vốn hóa' });
    const volumeLabel = t('dashboardRealtime.heatmapTooltipVolume', { defaultValue: 'Khối lượng' });

    const industryLabel = t('dashboardRealtime.heatmapTooltipIndustry', { defaultValue: 'Ngành' });
    const trendLabel = t('dashboardRealtime.heatmapTooltipTrend24h', { defaultValue: 'Xu hướng 24h' });

    const tooltip = {
      show: true,
      trigger: 'item',
      triggerOn: 'mousemove',
      appendToBody: true,
      enterable: false,
      alwaysShowContent: false,
      showDelay: 40,
      hideDelay: 150,
      transitionDuration: 0,
      backgroundColor: 'rgba(10, 18, 35, 0.97)',
      borderColor: 'rgba(71, 85, 105, 0.72)',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      extraCssText: 'pointer-events:none; box-shadow:0 8px 32px rgba(0,0,0,0.72); border-radius:10px; z-index:9999;',
      formatter: (params) => {
        try {
        const data = params?.data;
        if (!data) return `<div style="padding:8px 12px"><b style="color:#f8fafc">${params?.name || ''}</b></div>`;

        // Industry path
        const treePathInfo = params.treePathInfo || [];
        let industryName = '';
        if (treePathInfo.length > 1) {
          industryName = treePathInfo.slice(1, -1).map(p => p.name).join(' / ');
        } else {
          const raw = data.industry;
          industryName = (raw && raw !== 'undefined' && raw !== 'null') ? raw : fallbackIndustryLabel;
        }

        // Sector/Industry group node (has children)
        if (data.children) {
          const secChange = Number(data.changePct || 0);
          const secColor = secChange >= 0 ? '#4ade80' : '#f87171';
          return [
            `<div style="padding:10px 14px;min-width:180px">`,
            `<div style="font-size:13px;font-weight:800;color:#f8fafc;margin-bottom:4px">${data.name}</div>`,
            `<div style="color:#94a3b8;font-size:11px">${averageChangeLabel}:`,
            ` <b style="color:${secColor}">${formatPercent(secChange)}</b></div>`,
            `</div>`,
          ].join('');
        }

        // Leaf (stock) node
        const changePct = Array.isArray(data.value) ? data.value[1] : Number(data.changePct || 0);
        const pctColor = changePct > 0 ? '#4ade80' : changePct < 0 ? '#f87171' : '#94a3b8';
        const pctBg = changePct > 0 ? 'rgba(74,222,128,0.12)' : changePct < 0 ? 'rgba(248,113,113,0.12)' : 'rgba(148,163,184,0.1)';
        const livePrice = toNumber(data.livePrice);
        const mcap = toNumber(data.marketCap);
        const vol = Math.round(toNumber(data.volume));
        const sparkSvg = buildSparklineSvg(data.sparkline24);
        const hasSpark = sparkSvg.length > 0;

        return [
          `<div style="min-width:210px;max-width:260px;font-family:inherit">`,
          // Header bar
          `<div style="background:rgba(15,23,42,0.9);padding:10px 14px 8px;border-bottom:1px solid rgba(71,85,105,0.35)">`,
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">`,
          `<span style="font-size:15px;font-weight:900;color:#f8fafc;letter-spacing:0.04em">${data.name}</span>`,
          `<span style="font-size:12px;font-weight:700;color:${pctColor};background:${pctBg};padding:2px 7px;border-radius:6px">${formatPercent(changePct)}</span>`,
          `</div>`,
          data.companyName && data.companyName !== data.name
            ? `<div style="font-size:10px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${data.companyName}</div>`
            : '',
          `<div style="font-size:10px;color:#475569;margin-top:1px">${industryName}</div>`,
          `</div>`,
          // Sparkline chart area
          hasSpark
            ? `<div style="padding:4px 14px 0;background:rgba(10,18,35,0.7)">${sparkSvg}<div style="font-size:9px;color:#475569;text-align:right;margin-top:-2px;padding-bottom:4px">${trendLabel}</div></div>`
            : '',
          // Stats
          `<div style="padding:8px 14px 10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">`,
          `<div><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">${currentPriceLabel}</div><div style="font-size:12px;font-weight:700;color:#e2e8f0">${livePrice > 0 ? livePrice.toFixed(2) : '—'} <span style="font-size:10px;color:#94a3b8">VND</span></div></div>`,
          `<div><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">${volumeLabel}</div><div style="font-size:12px;font-weight:700;color:#e2e8f0">${vol > 0 ? vol.toLocaleString(localeTag || 'vi-VN') : '—'}</div></div>`,
          mcap > 0
            ? `<div style="grid-column:1/-1"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">${marketCapLabel}</div><div style="font-size:11px;font-weight:600;color:#cbd5e1">${(mcap / 1e9).toFixed(1)}B VND</div></div>`
            : '',
          `</div>`,
          `</div>`,
        ].join('');
        } catch (_err) {
          return `<div style="padding:8px 12px"><b style="color:#f8fafc">${params?.name || ''}</b></div>`;
        }
      },
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
            radius: ['7%', '92%'],
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
              rotate: 'radial',
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
                r0: '7%',
                r: '48%',
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
                r0: '50%',
                r: '92%',
                itemStyle: {
                  borderColor: 'rgba(2, 6, 23, 0.72)',
                  borderWidth: 1.5,
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
            position: 'inside',
            align: 'center',
            verticalAlign: 'middle',
            formatter: buildLeafLabel,
            overflow: 'truncate',
            rich: {
              symbol: {
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 14,
                lineHeight: 16,
                textShadowBlur: 3,
                textShadowColor: 'rgba(2, 6, 23, 0.7)',
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
        <div className="mb-3 h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
        <p className="text-gray-400 text-sm font-medium">{t('dashboardRealtime.heatmapEmpty', { defaultValue: 'Chưa có dữ liệu heatmap cho danh mục này.' })}</p>
      </div>
    );
  }

  return (
    <div className="group relative bg-slate-900/76 backdrop-blur-[12px] border border-slate-700/68 rounded-2xl flex flex-col overflow-hidden transition-all duration-500 hover:border-slate-500/80 shadow-2xl" style={{ minHeight: HEATMAP_HEIGHT + 96 }}>
      {/* Decorative background glow */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/5 rounded-full blur-[96px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-700" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-teal-500/5 rounded-full blur-[96px] pointer-events-none group-hover:bg-teal-500/10 transition-colors duration-700" />

      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-700/55 bg-slate-950/62 flex items-center justify-between z-10">
        <div className="flex flex-col">
          <h3 className="text-[10px] sm:text-xs font-black text-slate-200 uppercase tracking-[0.2em] flex items-center gap-2">
            {title}
            <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </h3>
          <p className="text-[9px] text-slate-400/95 font-bold uppercase mt-0.5 tracking-wider">
            {t('dashboardRealtime.heatmapRealtimeCaption', { defaultValue: 'Biến động theo dõi • Realtime feed' })}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-900/85 p-1 rounded-full border border-slate-700/50 shadow-inner">
            <button
              onClick={() => setSizeMetric('weight')}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all duration-300 ${sizeMetric === 'weight' ? 'bg-cyan-500 text-white shadow-[0_0_16px_rgba(6,182,212,0.35)]' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t('dashboardRealtime.heatmapSizeWeight', { defaultValue: 'Weight' })}
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

      <div ref={chartContainerRef} className="relative z-10" style={{ height: HEATMAP_HEIGHT, padding: '10px' }}>
        <ReactECharts
          key={`${viewMode}-${chartData.flat.length}-${locale}`}
          ref={chartComponentRef}
          option={option}
          style={{ height: HEATMAP_HEIGHT - 20, width: '100%' }}
          notMerge={true}
          lazyUpdate={false}
          opts={{ renderer: 'canvas' }}
          onChartReady={() => {
            safeResizeChart();
          }}
        />
        
        <div className="absolute bottom-5 right-5 flex items-center gap-4 bg-slate-950/88 px-4 py-1.5 rounded-2xl border border-slate-700/85 shadow-2xl backdrop-blur-xl pointer-events-none transition-transform group-hover:scale-105">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#089981] shadow-[0_0_6px_rgba(8,153,129,0.38)]" />
            <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendUp', { defaultValue: 'Tăng' })}
            </span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F23645] shadow-[0_0_6px_rgba(242,54,69,0.36)]" />
            <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendDown', { defaultValue: 'Giảm' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
