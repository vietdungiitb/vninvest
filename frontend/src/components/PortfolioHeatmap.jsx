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
      const size = liveValue > 0 ? liveValue : snapshotValue;
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
        industry,
        isHolding: Boolean(h.is_holding),
        changePct,
        value: [size, changePct],
        itemStyle: {
          borderColor: h.is_holding ? 'rgba(250, 204, 21, 0.75)' : 'rgba(15, 23, 42, 0.32)',
          borderWidth: h.is_holding ? 2 : 1,
          shadowBlur: isExtreme ? 14 : 0,
          shadowColor: isExtreme ? glowColor : 'transparent',
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
          value: [sector.totalWeight, avgChange],
          changePct: avgChange,
          children: sector.children.sort((left, right) => right.value[0] - left.value[0]),
        };
      })
      .sort((left, right) => right.value[0] - left.value[0]);
  }, [holdings]);

  const option = useMemo(() => {
    if (!hierarchicalData.length) {
      return null;
    }

    const heatScaleColors = ['#ef4444', '#f97316', '#94a3b8', '#22c55e', '#10b981'];

    const tooltip = {
      backgroundColor: 'rgba(2, 6, 23, 0.92)',
      borderColor: 'rgba(51, 65, 85, 0.7)',
      borderWidth: 1,
      confine: true,
      extraCssText: 'backdrop-filter: blur(10px); box-shadow: 0 12px 32px rgba(2, 6, 23, 0.45);',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params) => {
        const data = params?.data;
        if (!data) return '';

        if (!data.children) {
          const size = Array.isArray(data.value) ? data.value[0] : Number(data.value || 0);
          const changePct = Array.isArray(data.value) ? data.value[1] : Number(data.changePct || 0);
          const changeColor = changePct > 0 ? '#34d399' : changePct < 0 ? '#fb7185' : '#cbd5e1';

          return `
            <div style="min-width: 210px; padding: 4px 2px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
                <strong style="font-size:16px; color:#ffffff;">${data.name}</strong>
                <span style="font-size:11px; color:${data.isHolding ? '#facc15' : '#94a3b8'}; font-weight:700;">
                  ${data.isHolding ? 'Đang nắm giữ' : 'Trong watchlist'}
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; margin-bottom:6px;">
                <span style="color:#94a3b8;">Nhóm ngành</span>
                <span style="color:#f8fafc; font-weight:600;">${data.industry || 'Khác'}</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; margin-bottom:6px;">
                <span style="color:#94a3b8;">Trọng số hiển thị</span>
                <span style="color:#f8fafc; font-weight:700;">${Math.round(size).toLocaleString('vi-VN')}</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; padding-top:8px; border-top:1px solid rgba(148,163,184,0.18);">
                <span style="color:#94a3b8;">Biến động</span>
                <span style="color:${changeColor}; font-weight:800;">${formatPercent(changePct)}</span>
              </div>
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
          min: -3,
          max: 3,
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
                const cp = Array.isArray(params?.data?.value) ? params.data.value[1] : Number(params?.data?.changePct || 0);
                return `{symbol|${params.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(1)}%}`;
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
        min: -3,
        max: 3,
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
          leafDepth: 1,
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
            formatter: (params) => {
              if (params?.data?.children) return '';
              const cp = Array.isArray(params?.data?.value) ? params.data.value[1] : Number(params?.data?.changePct || 0);
              return `{symbol|${params.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(1)}%}`;
            },
            overflow: 'truncate',
            rich: {
              symbol: {
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 12,
                lineHeight: 16,
                textShadowBlur: 3,
                textShadowColor: 'rgba(2, 6, 23, 0.7)',
              },
              pct: {
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 700,
                fontSize: 10,
                lineHeight: 12,
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
              colorSaturation: [0.4, 0.8],
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
              colorSaturation: [0.5, 0.9],
              itemStyle: {
                borderColor: 'rgba(2, 6, 23, 0.6)',
                gapWidth: 1,
                borderWidth: 1,
              },
            },
          ],
        },
      ],
    };
  }, [formatPercent, hierarchicalData, viewMode]);

  if (!hierarchicalData.length) {
    return (
      <div className="bg-gray-950/50 backdrop-blur-md border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-4xl mb-3 animate-pulse">📊</div>
        <p className="text-gray-400 text-sm font-medium">{t('dashboardRealtime.heatmapEmpty', { defaultValue: 'Chưa có dữ liệu heatmap cho danh mục này.' })}</p>
      </div>
    );
  }

  return (
    <div className="group relative bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl flex flex-col overflow-hidden transition-all duration-700 hover:border-gray-700/80 shadow-2xl" style={{ minHeight: HEATMAP_HEIGHT + 85 }}>
      {/* Decorative background glow */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-brand-500/10 transition-colors duration-1000" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-brand-500/10 transition-colors duration-1000" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800/50 bg-gray-950/40 flex items-center justify-between z-10">
        <div className="flex flex-col">
          <h3 className="text-[10px] sm:text-xs font-black text-gray-300 uppercase tracking-[0.2em] flex items-center gap-2">
            {title}
            <span className="flex h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
          </h3>
          <p className="text-[9px] text-gray-500 font-bold uppercase mt-1 tracking-wider">
            {t('dashboardRealtime.heatmapRealtimeCaption', { defaultValue: 'Biến động theo dõi • Realtime feed' })}
          </p>
        </div>
        
        <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-800/50 shadow-inner">
          <button 
            onClick={() => setViewMode('treemap')}
            className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'treemap' ? 'bg-brand-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-[1.02]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
          >
            <span style={{ fontSize: '14px' }}>⊞</span>
            {t('dashboardRealtime.heatmapModeTreemap', { defaultValue: 'Treemap' })}
          </button>
          <button 
            onClick={() => setViewMode('sunburst')}
            className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'sunburst' ? 'bg-brand-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-[1.02]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
          >
            <span style={{ fontSize: '14px' }}>◎</span>
            {t('dashboardRealtime.heatmapModeSunburst', { defaultValue: 'Sunburst' })}
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 relative z-10" style={{ height: HEATMAP_HEIGHT }}>
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge={false}
          lazyUpdate={false}
          opts={{ renderer: 'canvas' }}
        />
        
        <div className="absolute bottom-6 right-6 flex items-center gap-4 bg-gray-950/90 px-4 py-2 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-xl pointer-events-none transition-transform group-hover:scale-105">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.6)]" />
            <span className="text-[9px] text-gray-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendUp', { defaultValue: 'Tăng' })}
            </span>
          </div>
          <div className="w-px h-3 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff003c] shadow-[0_0_8px_rgba(255,0,60,0.6)]" />
            <span className="text-[9px] text-gray-400 font-black tracking-tighter uppercase">
              {t('dashboardRealtime.heatmapLegendDown', { defaultValue: 'Giảm' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
