/**
 * components/AllocationPieChart.jsx
 * Biểu đồ tròn (Pie Chart) phân bổ danh mục — toggle Theo mã / Theo ngành.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { getAllocation, getAllocationBySector } from '../api/client';
import { useI18n } from '../context/LangContext';

// Bảng màu tối phù hợp dark theme
const COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899',
  '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6',
  '#f97316', '#a855f7',
];

function normalizeAllocationRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  return [];
}

function formatVND(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function CustomTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const name = mode === 'sector' ? d.sector : d.symbol;
  return (
    <div style={{
      backgroundColor: 'rgba(10, 18, 35, 0.96)',
      border: '1px solid rgba(71, 85, 105, 0.72)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(2, 6, 23, 0.5)',
      minWidth: 170,
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {mode === 'sector' ? 'Nhóm ngành' : 'Mã chứng khoán'}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>{name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>Giá trị (nghìn VND)</span>
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 12 }}>{formatVND(d.value)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>Tỷ trọng</span>
        <span style={{ color: '#34d399', fontWeight: 800, fontSize: 12 }}>{d.percentage.toFixed(2)}%</span>
      </div>
    </div>
  );
}

// CustomLegend removed — data shown via tooltip on hover

export default function AllocationPieChart({ portfolioId }) {
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [hhi, setHhi] = useState(null);
  const [mode, setMode] = useState('symbol'); // 'symbol' | 'sector'
  const [loading, setLoading] = useState(false);

  const fetchAllocation = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      if (mode === 'sector') {
        const res = await getAllocationBySector(portfolioId);
        setData(normalizeAllocationRows(res.data));
        setHhi(res.data.hhi_score ?? null);
      } else {
        const res = await getAllocation(portfolioId);
        setData(normalizeAllocationRows(res.data));
        setHhi(null);
      }
    } catch (err) {
      console.error('Load allocation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, mode]);

  useEffect(() => { fetchAllocation(); }, [fetchAllocation]);

  const nameKey = mode === 'sector' ? 'sector' : 'symbol';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header - title only */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {t('allocation.title')}
        </h2>
        <p className="mt-1 text-[11px] text-gray-500">{t('allocation.priceUnitHint')}</p>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-800 rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
          {t('allocation.empty')}
        </div>
      ) : (
        <>
          {/* Centered donut chart */}
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                nameKey={nameKey}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${mode === 'sector' ? entry.sector : entry.symbol}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip mode={mode} />} />
            </PieChart>
          </ResponsiveContainer>

          {/* HHI score */}
          {mode === 'sector' && hhi !== null && (
            <div className="flex items-center gap-2 justify-center mb-3">
              <span className="text-xs text-gray-500">{t('allocation.hhi')}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                hhi < 1500 ? 'bg-green-900 text-green-300'
                : hhi < 2500 ? 'bg-yellow-900 text-yellow-300'
                : 'bg-red-900 text-red-300'
              }`}>
                {hhi.toFixed(0)}
              </span>
              <span className="text-xs text-gray-600">
                {hhi < 1500 ? t('allocation.hhiDiversified') : hhi < 2500 ? t('allocation.hhiMedium') : t('allocation.hhiConcentrated')}
              </span>
            </div>
          )}

          {/* Mode toggle buttons at bottom-right */}
          <div className="flex justify-end mt-3">
            <div className="flex rounded-md overflow-hidden border border-gray-700 text-xs">
              {['symbol', 'sector'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 transition-colors font-medium ${
                    mode === m
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {m === 'symbol' ? t('allocation.bySymbol') : t('allocation.bySector')}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
