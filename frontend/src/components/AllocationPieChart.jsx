/**
 * components/AllocationPieChart.jsx
 * Biểu đồ tròn (Pie Chart) phân bổ danh mục theo giá trị thị trường.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { getAllocation } from '../api/client';

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

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-sm font-bold text-gray-100 mb-1">{d.symbol}</p>
      <p className="text-xs text-gray-400">{formatVND(d.value)} ₫</p>
      <p className="text-xs font-medium text-brand-400">{d.percentage.toFixed(2)}%</p>
    </div>
  );
}

function CustomLegend({ data }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {data.map((entry, i) => (
        <li key={entry.symbol} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-gray-300 font-medium">{entry.symbol}</span>
          </div>
          <span className="text-gray-500 ml-4">{entry.percentage.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function AllocationPieChart({ portfolioId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAllocation = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const res = await getAllocation(portfolioId);
      setData(res.data);
    } catch (err) {
      console.error('Lỗi tải phân bổ:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { fetchAllocation(); }, [fetchAllocation]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        Phân bổ danh mục
      </h2>

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
                nameKey="symbol"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.symbol}
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend tùy chỉnh phía dưới */}
          <div className="w-full mt-1">
            <CustomLegend data={data} />
          </div>
        </div>
      )}
    </div>
  );
}
