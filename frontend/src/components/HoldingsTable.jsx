/**
 * components/HoldingsTable.jsx
 * Bảng danh sách các vị thế đang nắm giữ.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { formatVND } from './StatCard';
import EmptyState from './EmptyState';

function PLCell({ value, pct }) {
  if (value === null || value === undefined) return <span className="text-gray-500">—</span>;
  const num = parseFloat(value);
  const color = num > 0 ? 'text-brand-500' : num < 0 ? 'text-red-400' : 'text-gray-400';
  const sign = num > 0 ? '+' : '';
  return (
    <span className={color}>
      {sign}{formatVND(value)}
      {pct !== null && pct !== undefined && (
        <span className="ml-1 text-xs opacity-75">
          ({sign}{parseFloat(pct).toFixed(2)}%)
        </span>
      )}
    </span>
  );
}

export default function HoldingsTable({ holdings, loading }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!holdings || holdings.length === 0) {
    return (
      <EmptyState
        title="Chưa có vị thế nào"
        description="Thêm giao dịch MUA đầu tiên và nhấn 'Đồng bộ giá' để xem danh mục."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            {['Mã CK', 'KL', 'Giá vốn TB', 'Giá hiện tại', 'Giá trị TT', 'Lãi/Lỗ chưa chốt', 'Lãi/Lỗ đã chốt', 'Cổ tức'].map((h) => (
              <th key={h} className="pb-2 pr-4 text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {holdings.map((h) => (
            <tr key={h.symbol} className="hover:bg-gray-900/50 transition-colors">
              <td className="py-3 pr-4 font-bold text-brand-400">
                <Link to={`/stocks/${h.symbol}`} className="hover:text-brand-300 transition-colors">
                  {h.symbol}
                </Link>
              </td>
              <td className="py-3 pr-4 text-gray-300">
                {parseFloat(h.quantity).toLocaleString('vi-VN')}
              </td>
              <td className="py-3 pr-4 text-gray-300">{formatVND(h.avg_cost)}</td>
              <td className="py-3 pr-4 text-gray-300">
                {h.current_price ? formatVND(h.current_price) : <span className="text-gray-600">Chưa sync</span>}
              </td>
              <td className="py-3 pr-4 text-gray-300">
                {h.market_value ? formatVND(h.market_value) : '—'}
              </td>
              <td className="py-3 pr-4">
                <PLCell value={h.unrealized_pl} pct={h.unrealized_pl_pct} />
              </td>
              <td className="py-3 pr-4">
                <PLCell value={h.realized_pl} pct={null} />
              </td>
              <td className="py-3 pr-4 text-yellow-400 text-sm">
                {parseFloat(h.dividends_received || 0) > 0
                  ? formatVND(h.dividends_received)
                  : <span className="text-gray-700">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
