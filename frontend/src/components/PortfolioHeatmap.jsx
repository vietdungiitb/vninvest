import React, { useCallback, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useI18n } from '../context/LangContext';

/**
 * PortfolioHeatmap
 * Hiển thị tỷ trọng và biến động (heat) của các mã trong danh mục.
 * Hỗ trợ chuyển đổi mượt mà giữa Treemap và Sunburst (Hierarchical).
 */
export default function PortfolioHeatmap({ holdings, title }) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState('treemap');
  const [sizeMetric, setSizeMetric] = useState('weight');
  const HEATMAP_HEIGHT = 420;

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

  const hierarchicalData = useMemo(() => {
    if (!holdings?.length) return [];

    const sectors = {};
    (holdings || []).forEach((h) => {
      const liveValue = toNumber(h.live_market_value);
      const snapshotValue = toNumber(h.market_value);
      const marketCap = toNumber(h.live_market_cap || h.market_cap);
      const sizeByWeight = liveValue > 0 ? liveValue : snapshotValue;
      const sizeByCap = marketCap > 0 ? marketCap : sizeByWeight;
      const size = sizeMetric === 'cap' ? sizeByCap : sizeByWeight;
      if (size <= 0) {
        return;
      }

      const rawChange = h.live_change_pct ?? h.change_pct ?? 0;
      const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;

      const symbol = String(h.symbol || h.name || '').trim().toUpperCase();
      if (!symbol) {
        return;
      }

      const industry = String(h.industry || 'Khác').trim() || 'Khác';
      if (!sectors[industry]) {
        sectors[industry] = {
          name: industry,
          children: [],
          value: [0, 0],
          changePct: 0,
          totalWeight: 0,
        };
      }

      const isExtreme = Math.abs(changePct) >= 2;
      const glowColor = changePct > 0 ? 'rgba(16, 185, 129, 0.36)' : 'rgba(244, 63, 94, 0.32)';

      sectors[industry].children.push({
        id: `symbol:${symbol}`,
        name: symbol,
        symbol,
        companyName: String(h.company_name || h.name || symbol).trim(),
        industry,
        isHolding: Boolean(h.is_holding),
        livePrice: toNumber(h.live_current_price || h.current_price),
        marketCap,
        volume: toNumber(h.live_volume || h.volume),
        sparkline24: Array.isArray(h.sparkline24) ? h.sparkline24 : [],
        sizeValue: size,
        changePct,
        value: [size, changePct],
        itemStyle: {
          borderColor: h.is_holding ? 'rgba(250, 204, 21, 0.75)' : 'rgba(15, 23, 42, 0.32)',
          borderWidth: h.is_holding ? 2 : 1,
          shadowBlur: isExtreme ? 14 : 0,
          shadowColor: isExtreme ? glowColor : 'rgba(0, 0, 0, 0)',
        },
      });

      sectors[industry].value[0] += size;
      sectors[industry].totalWeight += size;
      sectors[industry].changePct += size * changePct;
    });

    return Object.values(sectors)
      .map((sector) => {
        const avgChange = sector.totalWeight > 0 ? sector.changePct / sector.totalWeight : 0;
        return {
          id: `industry:${sector.name}`,
          name: sector.name,
          value: sector.totalWeight,
          changePct: avgChange,
          children: sector.children.sort((left, right) => right.value[0] - left.value[0]),
        };
      })
      .sort((left, right) => Number(right.value || 0) - Number(left.value || 0));
  }, [holdings, sizeMetric]);

  const maxLeafSize = useMemo(() => {
    let max = 0;
    hierarchicalData.forEach((industry) => {
      (industry.children || []).forEach((leaf) => {
        const val = Array.isArray(leaf.value) ? toNumber(leaf.value[0]) : toNumber(leaf.value);
        if (val > max) {
          max = val;
        }
      });
    });
    return max || 1;
  }, [hierarchicalData]);

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
    return `{symbol|${leaf.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(2)}%}\n{price|${price > 0 ? Math.round(price).toLocaleString('vi-VN') : '—'} VND}`;
  }, [maxLeafSize]);

  const heatScaleColors = ['#be123c', '#1e3a5f', '#0f766e'];

  const buildTooltipSparkline = useCallback((values, strokeColor) => {
    const points = (Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .slice(-24);

    if (points.length < 2) {
      return '<div class="heatmap-tooltip__spark">Chua du du lieu 24h</div>';
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const width = 176;
    const height = 40;
    const span = Math.max(max - min, 1);
    const linePoints = points
      .map((value, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * width;
        const y = height - 6 - (((value - min) / span) * (height - 12));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const polygon = `0,${height - 4} ${linePoints} ${width},${height - 4}`;
    const latest = points[points.length - 1];

    return `
      <div class="heatmap-tooltip__spark">
        <div class="heatmap-tooltip__spark-caption">Trend 24h • Last: ${Math.round(latest).toLocaleString('vi-VN')}</div>
        <svg width="176" height="40" viewBox="0 0 176 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heatmapSparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35"></stop>
              <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.05"></stop>
            </linearGradient>
          </defs>
          <polygon points="${polygon}" fill="url(#heatmapSparkFill)"></polygon>
          <polyline points="${linePoints}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></polyline>
        </svg>
      </div>
    `;
  }, []);

  const option = useMemo(() => {
    if (!hierarchicalData.length) {
      return null;
    }

    const tooltip = {
      backgroundColor: 'rgba(10, 18, 35, 0.94)',
      borderColor: 'rgba(71, 85, 105, 0.72)',
      borderWidth: 1,
      confine: true,
      extraCssText: 'backdrop-filter: blur(11px); box-shadow: 0 14px 38px rgba(2, 6, 23, 0.44); border-radius: 12px;',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params) => {
        const data = params?.data;
        if (!data) return '';

        if (!data.children) {
          const size = Array.isArray(data.value) ? data.value[0] : Number(data.value || 0);
          const changePct = Array.isArray(data.value) ? data.value[1] : Number(data.changePct || 0);
          const price = toNumber(data.livePrice);
          const cap = toNumber(data.marketCap);
          const volume = toNumber(data.volume);
          const changeColor = changePct > 0 ? '#34d399' : changePct < 0 ? '#fb7185' : '#cbd5e1';

          const sparklineMarkup = buildTooltipSparkline(
            data.sparkline24,
            changePct >= 0 ? '#10b981' : '#f43f5e',
          );

          return `
            <div class="heatmap-tooltip">
              <div class="heatmap-tooltip__header">
                <b>${data.name}</b> - ${data.companyName || data.name}
              </div>
              <div style="border-top:1px solid rgba(71,85,105,0.45); margin:6px 0;"></div>
              <div class="heatmap-tooltip__row">
                <span>Giá</span>
                <span style="color:${changeColor}; font-weight:700;">
                  ${price > 0 ? Math.round(price).toLocaleString('vi-VN') : '—'} VND (${formatPercent(changePct)})
                </span>
              </div>
              <div class="heatmap-tooltip__row">
                <span>Vốn hóa</span>
                <span style="color:#f8fafc; font-weight:700;">${cap > 0 ? (cap / 1000).toFixed(1) : '—'} Tỷ</span>
              </div>
              <div class="heatmap-tooltip__row">
                <span>Khối lượng</span>
                <span style="color:#f8fafc; font-weight:700;">${volume > 0 ? Math.round(volume).toLocaleString('vi-VN') : '—'}</span>
              </div>
              <div class="heatmap-tooltip__row">
                <span>${sizeMetric === 'cap' ? 'Size theo cap' : 'Size theo tỷ trọng'}</span>
                <span style="color:#f8fafc; font-weight:700;">${Math.round(size).toLocaleString('vi-VN')}</span>
              </div>
              ${sparklineMarkup}
            </div>
          `;
        }

        return `
          <div style="min-width: 180px; padding: 4px 2px;">
            <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px;">Nhóm ngành</div>
            <div style="font-size:18px; font-weight:800; color:#ffffff; margin-bottom:10px;">${data.name}</div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span style="color:#94a3b8;">Biến động bình quân</span>
              <span style="color:${data.changePct > 0 ? '#34d399' : data.changePct < 0 ? '#fb7185' : '#cbd5e1'}; font-weight:800;">${formatPercent(data.changePct)}</span>
            </div>
          </div>
        `;
      },
    };

    if (viewMode === 'sunburst') {
      return {
        backgroundColor: 'transparent',
        animationDuration: 350,
        animationDurationUpdate: 900,
        animationEasingUpdate: 'cubicInOut',
        tooltip,
        visualMap: {
          show: false,
          min: -4,
          max: 4,
          dimension: 1,
          inRange: {
            color: heatScaleColors,
          },
        },
        series: [
          {
            type: 'sunburst',
            id: 'portfolio-heatmap-transition',
            data: hierarchicalData,
            sort: 'desc',
            radius: ['7%', '92%'],
            nodeClick: false,
            universalTransition: true,
            emphasis: { focus: 'ancestor' },
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
      animationDuration: 350,
      animationDurationUpdate: 900,
      animationEasingUpdate: 'cubicInOut',
      tooltip,
      visualMap: {
        show: false,
        min: -4,
        max: 4,
        dimension: 1,
        inRange: {
          color: heatScaleColors,
        },
      },
      series: [
        {
          type: 'treemap',
          id: 'portfolio-heatmap-transition',
          data: hierarchicalData,
          roam: false,
          nodeClick: false,
          universalTransition: true,
          breadcrumb: { show: false },
          sort: 'desc',
          squareRatio: 0.75,
          // Show symbol nodes directly; leafDepth=1 causes strip-like drill-preview rendering.
          leafDepth: 2,
          visibleMin: 0,
          childrenVisibleMin: 0,
          emphasis: {
            focus: 'descendant',
            itemStyle: {
              borderColor: '#e2e8f0',
              borderWidth: 2,
              shadowBlur: 20,
              shadowColor: 'rgba(15, 23, 42, 0.45)',
            },
            label: {
              show: true,
            },
          },
          blur: {
            itemStyle: {
              opacity: 0.86,
            },
          },
          label: {
            show: true,
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
              },
              pct: {
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 700,
                fontSize: 11,
                lineHeight: 12,
              },
              price: {
                color: 'rgba(226,232,240,0.95)',
                fontWeight: 600,
                fontSize: 9,
                lineHeight: 10,
              },
            },
          },
          upperLabel: { show: false },
          itemStyle: {
            borderColor: 'rgba(15, 23, 42, 0.45)',
            borderWidth: 1,
            gapWidth: 2,
          },
          levels: [
            {
              itemStyle: {
                borderColor: 'rgba(15, 23, 42, 0.9)',
                borderWidth: 2,
                gapWidth: 2,
              },
              upperLabel: {
                show: true,
                height: 24,
                color: '#f1f5f9',
                fontWeight: 800,
                fontSize: 11,
                padding: [0, 0, 0, 8],
                backgroundColor: 'rgba(2, 6, 23, 0.85)',
              },
            },
            {
              itemStyle: {
                borderColor: 'rgba(2, 6, 23, 0.6)',
                gapWidth: 1,
                borderWidth: 1,
              },
            },
            {
              itemStyle: {
                borderColor: 'rgba(15, 23, 42, 0.42)',
                gapWidth: 1,
                borderWidth: 1,
              },
            },
          ],
        },
      ],
    };
  }, [buildLeafLabel, buildTooltipSparkline, formatPercent, heatScaleColors, hierarchicalData, sizeMetric, viewMode]);

  if (!hierarchicalData.length) {
    return (
      <div className="bg-gray-950/50 backdrop-blur-md border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-4xl mb-3 animate-pulse">📊</div>
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

      <div className="flex-1 p-2.5 relative z-10" style={{ height: HEATMAP_HEIGHT }}>
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={false}
          opts={{ renderer: 'canvas' }}
        />
        
        <div className="absolute bottom-5 right-5 flex items-center gap-4 bg-slate-950/88 px-4 py-1.5 rounded-2xl border border-slate-700/85 shadow-2xl backdrop-blur-xl pointer-events-none transition-transform group-hover:scale-105">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0f766e] shadow-[0_0_8px_rgba(15,118,110,0.55)]" />
            <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendUp', { defaultValue: 'Tăng' })}
            </span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#be123c] shadow-[0_0_8px_rgba(190,18,60,0.5)]" />
            <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendDown', { defaultValue: 'Giảm' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
