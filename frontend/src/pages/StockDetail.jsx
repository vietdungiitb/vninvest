function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('vi-VN');
}
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
  getIntradayMatched,
  getPriceBoard,
  getSectorBreadth,
  getStockFinancials,
  getStockAIAdvisorySession,
  generateStockAIAdvisoryComponents,
  getStockOrderFlow,
  getStockPriceChart,
  getStockWorkspaceOverview,
  getWatchlistGroups,
  getWhaleFeed,
  deleteStockAIAdvisoryComponent,
  regenerateStockAIExecutiveSummary,
  restoreStockAIAdvisoryComponent,
  refreshStockAIAdvisoryComponent,
  toggleStockAIAdvisoryComponentInclude,
} from '../api/client';
import { WhaleFeedPanel, BubbleOrderChart, MoneyFlowDonut } from './WhaleAlertsDashboard';
import useRealtimeFeed from '../hooks/useRealtimeFeed';

const PERIODS = [30, 90, 180, 365];

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return Number(value).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });
}

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
  return Number(v).toLocaleString('vi-VN');
}

function fmtVol(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('vi-VN');
}

function advisoryStatusLabel(status) {
  const map = {
    overbought: 'Quá mua',
    oversold: 'Quá bán',
    accumulation: 'Đang tích lũy',
    breakout: 'Phá vỡ',
    neutral: 'Trung tính',
  };
  return map[String(status || '').toLowerCase()] || 'Trung tính';
}

function advisoryActionLabel(action) {
  const map = {
    watch: 'Theo dõi',
    buy: 'Mua',
    sell: 'Bán',
    hold_off: 'Đứng ngoài',
  };
  return map[String(action || '').toLowerCase()] || 'Theo dõi';
}

function advisoryRiskLabel(riskLevel) {
  const map = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
  };
  return map[String(riskLevel || '').toLowerCase()] || 'Trung bình';
}

function advisorySynthesisPreferenceLabel(preference) {
  const map = {
    short_term_action: 'Thiên về hành động giao dịch ngắn hạn',
    risk_management: 'Thiên về quản trị rủi ro',
    balanced: 'Cân bằng 50/50 giữa hành động và rủi ro',
  };
  return map[String(preference || '').toLowerCase()] || map.balanced;
}

function KLineChartComponent({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [activeIndicators, setActiveIndicators] = useState({ MA: true, VOL: true });
  const [drawingMode, setDrawingMode] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);

  const AVAILABLE_INDICATORS = [
    { id: 'MA', name: 'Moving Average', default: true },
    { id: 'EMA', name: 'EMA' },
    { id: 'BOLL', name: 'Bollinger Bands' },
    { id: 'MACD', name: 'MACD' },
    { id: 'RSI', name: 'RSI' },
    { id: 'KDJ', name: 'KDJ' },
    { id: 'STOCH', name: 'Stochastic' },
    { id: 'SAR', name: 'Parabolic SAR' },
    { id: 'ATR', name: 'Average True Range' },
    { id: 'OBV', name: 'On-Balance Volume' },
  ];

  const DRAWING_TOOLS = [
    { id: 'line', name: '📏 Line' },
    { id: 'rect', name: '📦 Rectangle' },
    { id: 'polygon', name: '🔺 Polygon' },
    { id: 'text', name: '📝 Text' },
  ];

  const handleToggleIndicator = (indicatorId) => {
    if (indicatorId === 'VOL') {
      setActiveIndicators(prev => ({ ...prev, [indicatorId]: !prev[indicatorId] }));
    } else {
      setActiveIndicators(prev => {
        const newState = { ...prev, [indicatorId]: !prev[indicatorId] };
        if (chartRef.current) {
          if (newState[indicatorId]) {
            setTimeout(() => {
              try {
                chartRef.current.createIndicator(indicatorId, false, { id: 'candle_pane' });
              } catch (e) {
                console.error(`Error creating indicator ${indicatorId}:`, e);
              }
            }, 100);
          } else {
            try {
              chartRef.current.removeIndicator('candle_pane', indicatorId);
            } catch (e) {
              console.error(`Error removing indicator ${indicatorId}:`, e);
            }
          }
        }
        return newState;
      });
    }
  };

  const handleDrawingMode = (toolId) => {
    const chart = chartRef.current;
    if (!chart) return;

    const legacySetDrawingMode = typeof chart.setDrawingMode === 'function';
    const hasCreateOverlay = typeof chart.createOverlay === 'function';

    if (legacySetDrawingMode) {
      if (drawingMode === toolId) {
        chart.setDrawingMode(false);
        setDrawingMode(null);
      } else {
        const modeMap = {
          line: 'line',
          rect: 'rect',
          polygon: 'polygon',
          text: 'text',
        };
        chart.setDrawingMode(modeMap[toolId]);
        setDrawingMode(toolId);
      }
      return;
    }

    if (hasCreateOverlay) {
      const overlayMap = {
        line: 'segment',
        rect: 'rect',
        polygon: 'priceChannelLine',
        text: 'text',
      };
      const overlayName = overlayMap[toolId] || 'segment';
      try {
        chart.createOverlay(overlayName);
        setDrawingMode(toolId);
      } catch (e) {
        console.error('Error creating overlay:', e);
      }
      return;
    }

    console.warn('Drawing API is not available on this klinecharts instance.');
  };

  const handleClearDrawings = () => {
    const chart = chartRef.current;
    if (!chart) return;

    if (typeof chart.removeAllGraphicMarks === 'function') {
      chart.removeAllGraphicMarks();
      return;
    }
    if (typeof chart.removeOverlay === 'function') {
      try {
        // klinecharts v9 overlay API can clear by calling removeOverlay with no id.
        chart.removeOverlay();
      } catch (e) {
        console.error('Error clearing overlays:', e);
      }
    }
  };

  const handleScreenshot = () => {
    if (chartRef.current) {
      const canvas = chartRef.current.getConvertPx2PixelRatio();
      const image = chartRef.current.getImage({
        type: 'png',
        backgroundColor: '#0f172a'
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
      timezone: 'Asia/Ho_Chi_Minh',
      styles: {
        grid: {
          horizontal: { show: true, size: 1, color: '#1e293b', style: 'dashed' },
          vertical: { show: false },
        },
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#22c55e',
            downColor: '#f43f5e',
            noChangeColor: '#94a3b8',
            upBorderColor: '#16a34a',
            downBorderColor: '#be123c',
            noChangeBorderColor: '#94a3b8',
            upWickColor: '#16a34a',
            downWickColor: '#be123c',
            noChangeWickColor: '#94a3b8',
          },
          tooltip: {
            showRule: 'follow_cross',
            showType: 'rect',
            labels: ['T', 'M', 'C', 'Đ', 'T', 'KL'],
            values: null,
            defaultValue: 'n/a',
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
              borderColor: '#1e293b',
              color: '#0f172a',
            },
            text: { size: 11, family: 'inherit', weight: 'normal', color: '#94a3b8', marginLeft: 8 },
          },
        },
        xAxis: {
          show: true,
          axisLine: { show: true, color: '#1e293b', size: 1 },
          tickLine: { show: true, size: 1, length: 3, color: '#1e293b' },
          tickText: { show: true, color: '#64748b', size: 11, family: 'inherit' },
        },
        yAxis: {
          show: true,
          type: 'normal',
          position: 'right',
          axisLine: { show: true, color: '#1e293b', size: 1 },
          tickLine: { show: true, size: 1, length: 3, color: '#1e293b' },
          tickText: { show: true, color: '#64748b', size: 11, family: 'inherit' },
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#475569' },
            text: { show: true, style: 'fill', color: '#e2e8f0', size: 11, borderRadius: 4, borderColor: '#1e293b', backgroundColor: '#0f172a' },
          },
          vertical: {
            show: true,
            line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#475569' },
            text: { show: true, style: 'fill', color: '#e2e8f0', size: 11, borderRadius: 4, borderColor: '#1e293b', backgroundColor: '#0f172a' },
          },
        },
        separator: {
          size: 1,
          color: '#1e293b',
          fill: true,
          activeBackgroundColor: 'rgba(30,41,59,0.3)',
        },
      },
    });

    // MA trên pane chính
    chart.createIndicator('MA', false, { id: 'candle_pane' });
    // Volume ở pane phụ (chiều cao 20%)
    chart.createIndicator('VOL', false, { height: 80, minHeight: 40 });

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
      chartRef.current = null;
    };
  }, []);

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
  }, [data]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 p-3 flex flex-wrap gap-2">
        {/* Indicators */}
        <div className="flex gap-1">
          {AVAILABLE_INDICATORS.map(ind => (
            <button
              key={ind.id}
              onClick={() => handleToggleIndicator(ind.id)}
              className={`px-2 py-1 text-xs rounded transition ${
                activeIndicators[ind.id]
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
              title={ind.name}
            >
              {ind.id}
            </button>
          ))}
        </div>

        {/* Drawing Tools */}
        <div className="flex gap-1 border-l border-slate-600 pl-2">
          {DRAWING_TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => handleDrawingMode(tool.id)}
              className={`px-2 py-1 text-xs rounded transition ${
                drawingMode === tool.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
              title={tool.name}
            >
              {tool.name}
            </button>
          ))}
          <button
            onClick={handleClearDrawings}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
            title="Clear all drawings"
          >
            🗑️ Clear
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-1 border-l border-slate-600 pl-2 ml-auto">
          <button
            onClick={handleScreenshot}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
            title="Take screenshot"
          >
            📸 Screenshot
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="px-2 py-1 text-xs bg-slate-700 text-gray-400 rounded hover:bg-slate-600 transition"
            title="Fullscreen"
          >
            ⛶ Fullscreen
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={containerRef}
        style={{ width: '100%', flex: 1, background: '#0f172a', overflow: 'hidden' }}
      />
    </div>
  );
}

function IntradayMatchedPanel({ symbol, liveVolume }) {
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
      setError(err.response?.data?.detail || 'Không lấy được dữ liệu khớp lệnh.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [symbol]);

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
          <p className="text-label">Khớp lệnh trong phiên</p>
          <h3 className="mt-1 text-base font-semibold text-white">Thông tin khớp lệnh thực tế</h3>
          {fetchedAt && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {refreshing && <span className="mr-1 inline-block animate-spin">⟳</span>}
              Cập nhật: {new Date(fetchedAt).toLocaleTimeString('vi-VN')}
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
            {autoRefresh ? '⟳ Tự làm mới' : '⏸ Tạm dừng'}
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
            ▲ Mua: {buyCount}
          </span>
          <span className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-2.5 py-1 text-rose-300">
            ▼ Bán: {sellCount}
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-slate-300">
            KL: {fmtVol(totalVol)}
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
            Chưa có dữ liệu khớp lệnh (ngoài giờ giao dịch hoặc chưa có giao dịch).
          </p>
        ) : (
          <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
            {/* Header row */}
            <div className="grid grid-cols-[64px_1fr_80px_64px_56px] gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <span>Giờ</span>
              <span>Giá</span>
              <span className="text-right">KL</span>
              <span className="text-right">Loại</span>
              <span className="text-right">KL mua/bán</span>
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
                  {row.price != null ? Number(row.price).toLocaleString('vi-VN') : '—'}
                </span>
                <span className="text-right text-slate-300 tabular-nums">{fmtVol(row.volume)}</span>
                <span className={`text-right text-[10px] font-medium ${row.side === 'buy' ? 'text-emerald-400' : row.side === 'sell' ? 'text-rose-400' : 'text-slate-400'}`}>
                  {row.match_type || (row.side === 'buy' ? 'BU' : row.side === 'sell' ? 'SD' : '—')}
                </span>
                <span className={`text-right text-[10px] ${row.side === 'buy' ? 'text-emerald-500' : row.side === 'sell' ? 'text-rose-500' : 'text-slate-500'}`}>
                  {row.side === 'buy' ? 'Mua' : row.side === 'sell' ? 'Bán' : 'KL'}
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
        if (!cancelled) setError(err.response?.data?.detail || 'Không lấy được dữ liệu breadth.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

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
        <div className="text-label pb-3 border-b border-slate-800">Chỉ số ngành</div>
        <div className="mt-3 text-slate-500 text-sm">
          {error || 'Không có dữ liệu nhóm ngành.'}
        </div>
      </section>
    );
  }

  return (
    <section className="card-section p-4">
      <div className="text-label pb-3 border-b border-slate-800">Breadth — Động thái nhóm</div>
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
                  <div className="bg-emerald-700/70" style={{ width: `${(upCount / total) * 100}%` }} title={`${upCount} tăng`} />
                )}
                {flatCount > 0 && (
                  <div className="bg-slate-700/50" style={{ width: `${(flatCount / total) * 100}%` }} title={`${flatCount} ngang`} />
                )}
                {downCount > 0 && (
                  <div className="bg-rose-700/70" style={{ width: `${(downCount / total) * 100}%` }} title={`${downCount} giảm`} />
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

function biasMeta(bias) {
  if (bias === 'BULLISH') {
    return {
      label: 'Tăng',
      className: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
      description: 'Giá đang nằm trên SMA20 và SMA50, động lượng duy trì tích cực.',
    };
  }
  if (bias === 'WEAK') {
    return {
      label: 'Yếu',
      className: 'border-rose-700 bg-rose-950/40 text-rose-300',
      description: 'Giá đang nằm dưới các đường trung bình và động lượng suy yếu.',
    };
  }
  return {
    label: 'Trung tính',
    className: 'border-slate-700 bg-slate-900/70 text-slate-300',
    description: 'Cấu trúc giá chưa nghiêng rõ theo một hướng mạnh.',
  };
}

function PriceDepthPanel({ symbol, liveVolume }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const prevVolumeRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const resp = await getPriceBoard(symbol);
      setData(resp.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Không lấy được sổ lệnh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

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
          <p className="text-label">Độ sâu thị trường</p>
          <h3 className="mt-1 text-base font-semibold text-white">Sổ lệnh 3 mức giá</h3>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          {refreshing ? '⟳' : 'Cập nhật'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400">{error}</p>
      ) : depth.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Chưa có dữ liệu sổ lệnh.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <span>KL Mua</span>
            <span>Giá mua</span>
            <span>Giá bán</span>
            <span className="text-right">KL Bán</span>
          </div>
          <div className="mt-2 space-y-2">
            {depth.map((row) => (
              <div key={row.level} className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                <span className="text-slate-300">{formatCompactNumber(row.bid_volume)}</span>
                <span className="font-semibold text-emerald-300">{formatCurrency(row.bid_price)}</span>
                <span className="font-semibold text-rose-300">{formatCurrency(row.ask_price)}</span>
                <span className="text-right text-slate-300">{formatCompactNumber(row.ask_volume)}</span>
              </div>
            ))}
          </div>

          {/* Nước ngoài */}
          {(match.foreign_buy_volume != null || match.foreign_sell_volume != null) && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-[12px]">
              <div>
                <span className="text-slate-500">NN Mua </span>
                <span className="font-semibold text-cyan-300">{formatCompactNumber(match.foreign_buy_volume)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">NN Bán </span>
                <span className="font-semibold text-orange-300">{formatCompactNumber(match.foreign_sell_volume)}</span>
              </div>
            </div>
          )}
          {ref && (
            <p className="mt-2 text-right text-[10px] text-slate-600">
              Ref {formatCurrency(ref)} · {data.fetched_at ? new Date(data.fetched_at).toLocaleTimeString('vi-VN') : ''}
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
    ? `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}${unit}`
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
  if (loading) {
    return (
      <section className="card-section p-4 xl:col-span-3">
        <p className="text-label pb-2.5 border-b border-slate-800">Chỉ tiêu tài chính (theo năm)</p>
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
        <p className="text-label pb-2.5 border-b border-slate-800">Chỉ tiêu tài chính (theo năm)</p>
        <p className="mt-4 text-sm text-slate-500">Không có dữ liệu tài chính.</p>
      </section>
    );
  }

  const row = years.find((y) => y.year === selectedYear) || years[0];

  return (
    <section className="card-section p-4 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <p className="text-label">Chỉ tiêu tài chính (theo năm)</p>
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
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-400">Định giá</p>
          <MetricRow label="EPS (VND)" value={row.eps} />
          <MetricRow label="P/E" value={row.pe} />
          <MetricRow label="P/B" value={row.pb} />
          <MetricRow label="P/S" value={row.ps} />
          <MetricRow label="BVPS (VND)" value={row.bvps} />
          <MetricRow label="Vốn hóa (Tỷ đ)" value={row.market_cap_bn} />
        </div>

        {/* Khả năng sinh lời */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">Khả năng sinh lời</p>
          <MetricRow label="ROE" value={row.roe} unit="%" highlight />
          <MetricRow label="ROA" value={row.roa} unit="%" highlight />
          <MetricRow label="Biên LN ròng" value={row.net_margin} unit="%" highlight />
          <MetricRow label="Tỷ suất cổ tức" value={row.dividend_yield} unit="%" />
        </div>

        {/* Sức mạnh tài chính */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400">Sức mạnh tài chính</p>
          <MetricRow label="Đòn bẩy TC" value={row.leverage} />
          <MetricRow label="Nợ/VCSH" value={row.debt_equity} />
          <MetricRow label="TT hiện hành" value={row.current_ratio} />
          <MetricRow label="TT nhanh" value={row.quick_ratio} />
        </div>
      </div>
    </section>
  );
}

function OrderFlowPanel({ symbol, loading, orderFlowData, latestRealtimeAlert, window: selectedWindow, onWindowChange }) {
  const cvdSeries = orderFlowData?.cvd_series || [];
  const darkFlow = orderFlowData?.dark_flow || {};
  const latestSignal = orderFlowData?.latest_signal || null;
  const signals = orderFlowData?.signals || [];
  const tickRate = orderFlowData?.tick_rate || {};
  const sizeDistribution = orderFlowData?.size_distribution || {};

  const chartData = cvdSeries.map((item) => ({
    ...item,
    label: item.bucket_ts ? new Date(item.bucket_ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
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
          <p className="text-label">Order Flow Radar</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Dark money detection cho {symbol}</h2>
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
          <p className="text-label">Strength</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{liveStrength.toFixed(1)}</p>
          <div className="mt-3 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
              style={{ width: `${Math.max(4, Math.min(100, liveStrength))}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">Tick rate / min</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{Number(tickRate?.tick_rate_per_min || 0).toFixed(1)}</p>
          <p className="mt-2 text-xs text-slate-400">Lệnh nhỏ: {(smallOrderRatio * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">Realtime event</p>
          <p className="mt-2 text-sm font-medium text-slate-100">{liveSignal?.description || darkFlow?.components?.absorption?.description || 'Chưa có event realtime mới.'}</p>
          <p className="mt-2 text-[11px] text-slate-500">{liveSignal?.ts ? new Date(liveSignal.ts).toLocaleString('vi-VN') : '—'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">CVD 30 phút</p>
            <span className="text-[11px] text-slate-500">{chartData.length} buckets</span>
          </div>
          <div className="h-56">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                Chưa có dữ liệu intraday để dựng CVD.
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
                    formatter={(value) => [formatCompactNumber(value), 'CVD']}
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
          <p className="text-sm font-semibold text-slate-200">Recent signals</p>
          <div className="panel-scrollbar mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
            {signals.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có signal nào được lưu.</p>
            ) : signals.map((item) => (
              <div key={item.id || `${item.symbol}-${item.created_at}`} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{item.signal_type}</p>
                  <p className="text-[11px] text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleTimeString('vi-VN') : '—'}</p>
                </div>
                <p className="mt-1 text-sm text-slate-200">Strength {Number(item.strength || 0).toFixed(1)} • {item.confidence || 'low'}</p>
                <p className="mt-1 text-[11px] text-slate-400">Tick rate {Number(item.tick_rate || 0).toFixed(1)} • Small {formatPercentDelta(Number(item.small_order_ratio || 0) * 100)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StockDetail() {
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
  const [advisoryComponents, setAdvisoryComponents] = useState([]);
  const [advisoryDeletedComponents, setAdvisoryDeletedComponents] = useState([]);
  const [advisoryExecutiveSummary, setAdvisoryExecutiveSummary] = useState(null);
  const [advisoryExecutiveSummaries, setAdvisoryExecutiveSummaries] = useState([]);
  const [activeAdvisoryComponentId, setActiveAdvisoryComponentId] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(true);
  const [advisoryComponentBusyId, setAdvisoryComponentBusyId] = useState(null);
  const [advisoryGeneratingComponents, setAdvisoryGeneratingComponents] = useState(false);
  const [advisoryRegeneratingSummary, setAdvisoryRegeneratingSummary] = useState(false);
  const [advisorySynthesisPreference, setAdvisorySynthesisPreference] = useState('balanced');
  const [advisoryMessage, setAdvisoryMessage] = useState('');
  const [orderFlowData, setOrderFlowData] = useState(null);
  const [orderFlowLoading, setOrderFlowLoading] = useState(true);
  const [orderFlowWindow, setOrderFlowWindow] = useState('30m');

  const { quotesBySymbol, realtimeStatus, lastEventAt, alerts, darkFlowAlerts, latestWhaleAlert, latestDarkFlowAlert } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  // Lọc alerts và whale signals theo symbol hiện tại
  const symbolAlerts = alerts ? alerts.filter((a) => a.symbol === normalizedSymbol) : [];
  const symbolWhaleAlert = latestWhaleAlert && latestWhaleAlert.symbol === normalizedSymbol ? latestWhaleAlert : null;
  const symbolDarkFlowAlert = latestDarkFlowAlert && latestDarkFlowAlert.symbol === normalizedSymbol ? latestDarkFlowAlert : null;

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
      const response = await getStockAIAdvisorySession(normalizedSymbol);
      const payload = response?.data || {};
      setAdvisorySession(payload.advisory || null);
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
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không tải được AI Advisory cho mã này.');
    } finally {
      if (!silent) {
        setAdvisoryLoading(false);
      }
    }
  }, [normalizedSymbol]);

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
          setError(err.response?.data?.detail || `Không tải được dữ liệu cho ${normalizedSymbol}.`);
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

  const technicalBiasFallback = biasMeta(technical?.bias);
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
        showWorkspaceMessage(`Đã bỏ ${normalizedSymbol} khỏi shortlist.`);
      } else {
        const sourceGroupId = overview.market_group_refs?.[0]?.id || null;
        await addTrackedSymbol(normalizedSymbol, sourceGroupId);
        showWorkspaceMessage(`Đã đưa ${normalizedSymbol} vào shortlist.`);
      }
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể cập nhật shortlist cho mã này.');
    } finally {
      setActionLoading('');
    }
  };

  const handleAddToWatchlist = async () => {
    if (!selectedWatchlistGroupId) {
      setWorkspaceError('Chưa có danh sách theo dõi cá nhân để thêm mã.');
      return;
    }

    setWorkspaceError('');
    setActionLoading('watchlist-add');
    try {
      await addWatchlistItem(Number(selectedWatchlistGroupId), normalizedSymbol);
      showWorkspaceMessage(`Đã thêm ${normalizedSymbol} vào danh sách theo dõi cá nhân.`);
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể thêm mã vào danh sách theo dõi cá nhân.');
    } finally {
      setActionLoading('');
    }
  };

  const handleRemoveFromWatchlist = async (itemId, groupName) => {
    setWorkspaceError('');
    setActionLoading(`watchlist-remove-${itemId}`);
    try {
      await deleteWatchlistItem(itemId);
      showWorkspaceMessage(`Đã bỏ ${normalizedSymbol} khỏi ${groupName}.`);
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể bỏ mã khỏi danh sách theo dõi cá nhân.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateAlert = async () => {
    const targetPrice = Number(alertTargetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setWorkspaceError('Mức giá cảnh báo phải lớn hơn 0.');
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
      showWorkspaceMessage(`Đã tạo cảnh báo giá cho ${normalizedSymbol}.`);
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể tạo cảnh báo giá.');
    } finally {
      setActionLoading('');
    }
  };

  const handleRefreshActiveAdvisoryComponent = async (componentId) => {
    if (!componentId) return;
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await refreshStockAIAdvisoryComponent(componentId);
      const payload = response?.data || {};
      const refreshed = payload.component;
      if (refreshed?.id) {
        setAdvisoryComponents((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
        setActiveAdvisoryComponentId(refreshed.id);
      }
      setAdvisoryMessage(payload.message || 'Đã làm mới tab AI đang chọn.');
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không làm mới được tab AI đang chọn.');
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleGenerateAdvisoryComponents = async () => {
    if (!normalizedSymbol) return;
    setAdvisoryGeneratingComponents(true);
    try {
      const response = await generateStockAIAdvisoryComponents(normalizedSymbol, { timeframe: orderFlowWindow || '30m' });
      const payload = response?.data || {};
      const nextComponents = Array.isArray(payload.components) ? payload.components : [];
      setAdvisoryComponents(nextComponents);
      setAdvisoryDeletedComponents([]);
      setActiveAdvisoryComponentId(nextComponents[0]?.id || null);
      const generationSource = payload.generated_by_ai ? 'AI schema' : 'template fallback';
      setAdvisoryMessage(payload.message || `Đã tạo ${payload.created_count || nextComponents.length || 0} tab thành phần (${generationSource}).`);
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không tạo được tab thành phần AI.');
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
      setAdvisoryMessage(err?.response?.data?.message || 'Không cập nhật được trạng thái đưa vào tổng hợp.');
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
      setAdvisoryMessage('Đã xóa tab khỏi phiên tổng hợp.');
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không xóa được tab thành phần.');
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
      setAdvisoryMessage('Đã khôi phục tab thành phần.');
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không khôi phục được tab thành phần.');
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleRegenerateExecutiveSummary = async () => {
    if (!normalizedSymbol) return;
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
      setAdvisoryMessage(summary ? `Đã tổng hợp lại bản tóm tắt v${summary.summary_version}.` : 'Đã tổng hợp lại bản tóm tắt.');
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Tổng hợp lại bản tóm tắt thất bại.');
    } finally {
      setAdvisoryRegeneratingSummary(false);
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
          <p className="text-sm font-semibold text-rose-300">Không mở được workspace mã</p>
          <p className="mt-2 text-sm text-slate-400">{error || `Không tìm thấy dữ liệu cho ${normalizedSymbol}.`}</p>
          <Link to="/watchlist" className="mt-4 inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500 hover:text-white">
            Quay lại Radar thị trường
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
                Radar thị trường
              </Link>
              <span>/</span>
              <span>Stock workspace</span>
              <span>/</span>
              <span>{overview.symbol}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400">
                Feed {realtimeStatus === 'live' ? 'Realtime' : realtimeStatus === 'polling' ? 'Fallback polling' : 'Đang kết nối'}
                {lastEventAt ? ` · ${new Date(lastEventAt).toLocaleTimeString('vi-VN')}` : ''}
              </div>
              <Link
                to={`/whale-alerts/${normalizedSymbol}`}
                className="flex items-center gap-1.5 rounded-full border border-cyan-700/60 bg-cyan-950/30 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/30"
              >
                🦈 Whale Dashboard
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
                  <span>{overview.exchange || 'Chưa rõ sàn'}</span>
                  <span className="text-slate-700">•</span>
                  <span>{overview.industry || 'Chưa rõ ngành'}</span>
                  {overview.listed_date ? (
                    <>
                      <span className="text-slate-700">•</span>
                      <span>Niêm yết {overview.listed_date}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Current price + change */}
            <div>
              <p className="text-label">Giá hiện tại</p>
              <div className="mt-1 flex flex-wrap items-end gap-4">
                <span className="text-5xl font-semibold leading-none text-white">{formatCurrency(currentPrice)}</span>
                <span className={`pb-1 text-lg font-semibold ${changeClass}`}>
                  {changeValue > 0 ? '+' : ''}
                  {changeValue !== null && changeValue !== undefined ? formatCurrency(Math.abs(changeValue)).replace('₫', '').trim() : '—'}
                  {' · '}
                  {formatPercent(changePct)}
                </span>
              </div>
            </div>

            {/* Quick tags: shortlist, groups */}
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${overview.is_tracked ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-900/70 text-slate-400'}`}>
                {overview.is_tracked ? '✓ Theo dõi realtime' : '◇ Theo dõi realtime'}
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
                <p className="text-label">Ref / Ceil / Floor</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.reference_price)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{formatCurrency(overview.ceiling_price)} / {formatCurrency(overview.floor_price)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Range</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(liveLowPrice)} → {formatCurrency(liveHighPrice)}</p>
                <p className="mt-1 text-[10px] text-slate-500">Q: {formatCompactNumber(liveVolume)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">52W Range</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.week52_low)}</p>
                <p className="mt-1 text-[10px] text-slate-500">→ {formatCurrency(overview.week52_high)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Trung bình</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.average_price)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Thiên hướng</p>
                <p className={`mt-1 text-sm font-medium ${technicalBias.className.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{technicalBias.label}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Khung này</p>
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
              {actionLoading === 'tracked' ? 'Cập nhật...' : overview.is_tracked ? 'Bỏ theo dõi' : 'Theo dõi realtime'}
            </button>

            <div className="flex min-w-[280px] flex-wrap items-center gap-2 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5">
              <select
                value={selectedWatchlistGroupId}
                onChange={(event) => setSelectedWatchlistGroupId(event.target.value)}
                className="min-w-[150px] bg-transparent px-2 py-1 text-sm text-slate-200 outline-none"
              >
                {availableWatchlistGroups.length === 0 ? (
                  <option value="">Không còn DS để thêm</option>
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
                {actionLoading === 'watchlist-add' ? 'Lưu...' : 'Lưu vào nhóm'}
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5">
              <input
                value={alertTargetPrice}
                onChange={(event) => setAlertTargetPrice(event.target.value)}
                placeholder="Mức giá cảnh báo"
                className="w-32 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                onClick={handleCreateAlert}
                disabled={!!actionLoading}
                className={`btn-success ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'alert' ? 'Tạo...' : 'Tạo cảnh báo'}
              </button>
            </div>

            <div className="ml-auto w-full xl:w-auto xl:min-w-[406px] grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950/75 px-3 py-2 text-[12px]">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">
                <p className="text-label">Shortlist</p>
                <p className={`mt-0.5 font-medium ${overview.is_tracked ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {overview.is_tracked ? '✓ Theo dõi' : 'Chưa theo dõi'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">
                <p className="text-label">DS nhóm ({overview.watchlist_memberships.length})</p>
                {overview.watchlist_memberships.length > 0 ? (
                  <p className="mt-0.5 text-amber-300 truncate" title={overview.watchlist_memberships.map((item) => item.group_name).join(', ')}>
                    {overview.watchlist_memberships.map((item) => item.group_name).join(', ')}
                  </p>
                ) : (
                  <p className="mt-0.5 text-slate-500">Chưa có</p>
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
                <p className="text-label">Kline Workspace</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Biểu đồ nến {normalizedSymbol}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setActivePeriod(period)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      activePeriod === period
                        ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                        : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {period}D
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 h-[520px]">
              {loadingChart ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-900" />
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                  Chưa có dữ liệu giá để hiển thị biểu đồ nến.
                </div>
              ) : (
                <KLineChartComponent data={chartData} />
              )}
            </div>
          </section>

          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">Phiên tư vấn AI</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Tư vấn AI cho {normalizedSymbol}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAdvisoryComponents}
                  disabled={advisoryGeneratingComponents || advisoryLoading}
                  className="btn-secondary"
                >
                  {advisoryGeneratingComponents ? 'Đang tạo tab...' : 'Tạo tab AI'}
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
                      {advisorySession.ai_provider || 'openclaw'}
                    </span>
                    <span>
                      {advisorySession.created_at ? new Date(advisorySession.created_at).toLocaleString('vi-VN') : '—'}
                    </span>
                    <span className="text-slate-600">• {advisoryComponents.length} tab</span>
                    <span className="text-slate-600">• {(advisoryComponents.filter((item) => item.include_in_summary)).length} tab đang dùng</span>
                  </div>

                  {advisoryDeletedComponents.length > 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tab đã xóa</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {advisoryDeletedComponents.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleRestoreAdvisoryComponent(item.id)}
                            disabled={advisoryComponentBusyId === item.id}
                            className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500/60 hover:text-cyan-300"
                          >
                            Khôi phục {item.indicator_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <div className="flex flex-wrap gap-2">
                      {advisoryComponents.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-slate-500">Chưa có tab thành phần. Bấm "Tạo tab AI" để sinh các góc nhìn.</p>
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
                            {activeAdvisoryComponent.created_at ? new Date(activeAdvisoryComponent.created_at).toLocaleString('vi-VN') : '—'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300">
                            {advisoryStatusLabel(activeAdvisoryComponent.status)}
                          </span>
                          <span className="rounded-full border border-amber-700/70 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                            {activeAdvisoryComponent.confidence_score}/10
                          </span>
                          <span className="rounded-full border border-emerald-700/70 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            {advisoryActionLabel(activeAdvisoryComponent.suggested_action)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-300 whitespace-pre-line">{activeAdvisoryComponent.rationale_text || 'Không có mô tả thêm.'}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleComponentInclude(activeAdvisoryComponent.id)}
                          disabled={advisoryComponentBusyId === activeAdvisoryComponent.id}
                          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800/70"
                        >
                          {activeAdvisoryComponent.include_in_summary ? 'Loại khỏi tổng hợp' : 'Đưa vào tổng hợp'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRefreshActiveAdvisoryComponent(activeAdvisoryComponent.id)}
                          disabled={advisoryComponentBusyId === activeAdvisoryComponent.id}
                          className="rounded-full border border-cyan-700/60 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20"
                        >
                          Làm mới tab
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdvisoryComponent(activeAdvisoryComponent.id)}
                          disabled={advisoryComponentBusyId === activeAdvisoryComponent.id}
                          className="rounded-full border border-rose-700/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                        >
                          Xóa tab
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Thông tin tổng hợp</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Chế độ hiện tại: {advisorySynthesisPreferenceLabel(advisorySynthesisPreference)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={advisorySynthesisPreference}
                          onChange={(e) => setAdvisorySynthesisPreference(e.target.value)}
                          disabled={advisoryRegeneratingSummary}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 outline-none hover:border-slate-500"
                        >
                          <option value="short_term_action">Thiên về hành động giao dịch ngắn hạn</option>
                          <option value="risk_management">Thiên về quản trị rủi ro</option>
                          <option value="balanced">Cân bằng 50/50 giữa hành động và rủi ro</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleRegenerateExecutiveSummary}
                          disabled={advisoryRegeneratingSummary || advisoryComponents.length === 0}
                          className="btn-secondary"
                        >
                          {advisoryRegeneratingSummary ? 'Đang tổng hợp...' : 'Tổng hợp lại'}
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
                            Mức rủi ro: {advisoryRiskLabel(advisoryExecutiveSummary.risk_level)}
                          </span>
                          <span className="rounded-full border border-amber-700/70 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                            Độ tin cậy: {advisoryExecutiveSummary.overall_confidence}/10
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
                            {advisoryExecutiveSummary.synthesis_text || 'Chưa có nội dung tổng hợp.'}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500">
                            Bản tóm tắt sử dụng {Array.isArray(advisoryExecutiveSummary.used_component_ids) ? advisoryExecutiveSummary.used_component_ids.length : 0} tab thành phần
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">Chưa có bản tóm tắt điều hành. Tạo tab AI và bấm "Tổng hợp lại" để tạo nội dung.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Hệ thống đang tạo tư vấn AI cho mã này. Vui lòng đợi trong giây lát.
                </p>
              )}

              {advisoryMessage ? (
                <p className="text-xs text-cyan-300">{advisoryMessage}</p>
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
              <p className="text-label pb-2.5 border-b border-slate-800">Cảnh báo giá ({symbolAlerts.length})</p>
              <div className="mt-3 space-y-2.5">
                {symbolAlerts.map((alert, idx) => (
                  <div key={`${alert.symbol}-${alert.ts}-${idx}`} className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-rose-400 mb-1">🔔 Cảnh báo giá</p>
                    <p className="text-sm font-semibold text-rose-200">
                      {alert.condition === 'ABOVE' ? '▲ Vượt' : '▼ Dưới'}{' '}
                      {alert.target_price
                        ? Number(alert.target_price).toLocaleString('vi-VN') + ' ₫'
                        : formatCurrency(alert.price)}
                    </p>
                    {alert.ts && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(alert.ts).toLocaleTimeString('vi-VN')}
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
