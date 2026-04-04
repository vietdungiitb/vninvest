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

// Bảng màu tối phù hợp dark theme
const COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899',
  '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6',
  '#f97316', '#a855f7',
];

function formatVND(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return new Intl.NumberFormat('vi-VN').format(value);
}

function CustomTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-sm font-bold text-gray-100 mb-1">
        {mode === 'sector' ? d.sector : d.symbol}
      </p>
      <p className="text-xs text-gray-400">{formatVND(d.value)} ₫</p>
      <p className="text-xs font-medium text-brand-400">{d.percentage.toFixed(2)}%</p>
    </div>
  );
}

function CustomLegend({ data, mode }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {data.map((entry, i) => (
        <li key={`${mode === 'sector' ? entry.sector : entry.symbol}-${i}`}
            className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-gray-300 font-medium">
              {mode === 'sector' ? entry.sector : entry.symbol}
            </span>
          </div>
          <span className="text-gray-500 ml-4">{entry.percentage.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function AllocationPieChart({ portfolioId }) {
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
        setData(res.data.items ?? []);
        setHhi(res.data.hhi_score ?? null);
      } else {
        const res = await getAllocation(portfolioId);
        setData(res.data);
        setHhi(null);
      }
    } catch (err) {
      console.error('Lỗi tải phân bổ:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, mode]);

  useEffect(() => { fetchAllocation(); }, [fetchAllocation]);

  const nameKey = mode === 'sector' ? 'sector' : 'symbol';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header + toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Phân bổ danh mục
        </h2>
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
              {m === 'symbol' ? 'Theo mã' : 'Theo ngành'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-gray-800 rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Chưa có dữ liệu phân bổ.
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
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
          {/* HHI badge — chỉ hiện khi theo ngành */}
          {mode === 'sector' && hhi !== null && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">HHI tập trung:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                hhi < 1500 ? 'bg-green-900 text-green-300'
                : hhi < 2500 ? 'bg-yellow-900 text-yellow-300'
                : 'bg-red-900 text-red-300'
              }`}>
                {hhi.toFixed(0)}
              </span>
              <span className="text-xs text-gray-600">
                {hhi < 1500 ? '(đa dạng)' : hhi < 2500 ? '(trung bình)' : '(tập trung cao)'}
              </span>
            </div>
          )}
          {/* Legend */}
          <div className="w-full mt-1">
            <CustomLegend data={data} mode={mode} />
          </div>
        </div>
      )}
    </div>
  );
}
