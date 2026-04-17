import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * PortfolioHeatmap
 * Hiển thị tỷ trọng và biến động (heat) của các mã trong danh mục.
 * Dùng Recharts Treemap.
 */
export default function PortfolioHeatmap({ holdings, title }) {
  const HEATMAP_HEIGHT = 360;

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

  // 1. Chuẩn bị dữ liệu cho Treemap
  // Ưu tiên live_market_value nếu > 0, fallback về market_value snapshot.
  const data = (holdings || [])
    .map((h) => {
      const liveValue = toNumber(h.live_market_value);
      const snapshotValue = toNumber(h.market_value);
      const size = liveValue > 0 ? liveValue : snapshotValue;

      return {
        name: String(h.symbol || '').trim().toUpperCase(),
        size,
        original: h,
      };
    })
    .filter((item) => item.name && item.size > 0);

  const treemapData = React.useMemo(() => ([
    {
      name: 'Portfolio',
      children: data,
    },
  ]), [data]);

  const treemapRenderKey = React.useMemo(() => {
    return data
      .map((item) => `${item.name}:${Math.round(Number(item.size) || 0)}`)
      .join('|');
  }, [data]);

  if ((holdings || []).length > 0 && data.length === 0) {
    console.warn('[Heatmap] Holdings present but no drawable data after size fallback.');
  }

  if (!data.length) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-gray-400 text-sm">Chưa có dữ liệu heatmap cho danh mục này.</p>
      </div>
    );
  }

  // 2. Định nghĩa màu sắc dựa trên change_pct
  const getColor = (pct) => {
    if (pct > 2) return '#10b981'; // Xanh lá đậm (Emerald 500)
    if (pct > 0) return '#059669'; // Xanh lá (Emerald 600)
    if (pct < -2) return '#ef4444'; // Đỏ đậm (Red 500)
    if (pct < 0) return '#dc2626'; // Đỏ (Red 600)
    return '#4b5563'; // Xám (Gray 600)
  };

  // 3. Custom content cho cell
  const CustomizedContent = (props) => {
    const { depth, x, y, width, height, payload, name } = props || {};
    if (!payload) return null;
    if (payload?.children && payload.children.length > 0) return null;

    const original = payload?.original || {};
    // FIX: Đảm bảo change_pct là số hợp lệ trước khi gọi toFixed
    const rawChange = original.live_change_pct ?? original.change_pct ?? 0;
    const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
    
    const bgColor = getColor(changePct);

    // Chỉ hiện text nếu cell đủ to
    const showText = width > 50 && height > 30;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: bgColor,
            stroke: '#111827',
            strokeWidth: 2 / ((Number(depth) || 0) + 1),
            strokeOpacity: 1,
            cursor: 'pointer'
          }}
        />
        {showText && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="#fff"
            fontSize={width > 80 ? 12 : 10}
            fontWeight="bold"
          >
            {name || payload?.name || ''}
          </text>
        )}
        {showText && height > 45 && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 15}
            textAnchor="middle"
            fill="#fff"
            fillOpacity={0.8}
            fontSize={10}
          >
            {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
          </text>
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length && payload[0]?.payload) {
      const { name, size, original = {} } = payload[0].payload;
      const rawChange = original.live_change_pct ?? original.change_pct ?? 0;
      const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
      
      return (
        <div className="bg-gray-950 border border-gray-800 p-3 rounded-lg shadow-xl text-xs">
          <p className="font-bold text-gray-100 mb-1">{name}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Giá trị:</span>
              <span className="text-gray-200">{size.toLocaleString('vi-VN')} nghìn đồng</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Biến động:</span>
              <span className={changePct > 0 ? 'text-emerald-400' : changePct < 0 ? 'text-red-400' : 'text-gray-400'}>
                {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl flex flex-col h-full overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/60">
          <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">
            {title}
          </h3>
        </div>
      )}
      <div className="flex-1 min-h-[360px] p-2" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={HEATMAP_HEIGHT}>
          <Treemap
            key={`treemap-${treemapRenderKey}-${data.length}`}
            data={treemapData}
            dataKey="size"
            nameKey="name"
            stroke="#fff"
            fill="#8884d8"
            content={<CustomizedContent />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
