import React, { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { useI18n } from '../context/LangContext';
import { useNavigate } from 'react-router-dom';

const CustomTooltip = ({ active, payload, t, formatQuoteInteger }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl outline-none">
        <p className="text-sm font-bold text-gray-100">{data.symbol}</p>
        <p className="text-xs text-gray-400 mt-1">
          {t('dashboard.marketValue')}: <span className="text-gray-200">{formatQuoteInteger(data.value)}</span>
        </p>
        <p className={`text-xs font-semibold mt-1 ${Number(data.changePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {t('common.change')}: {Number(data.changePct || 0) >= 0 ? '+' : ''}{Number(data.changePct || 0).toFixed(2)}%
        </p>
      </div>
    );
  }
  return null;
};

const CustomizedContent = (props) => {
  const { x, y, width, height, index, payload, depth, name } = props;
  const changePct = Number(props.changePct || 0);

  // Color intensity based on changePct
  const getFillColor = (pct) => {
    if (pct > 0) {
      const opacity = Math.min(0.9, 0.3 + (pct / 7) * 0.6);
      return `rgba(16, 185, 129, ${opacity})`; // emerald-500
    } else if (pct < 0) {
      const opacity = Math.min(0.9, 0.3 + (Math.abs(pct) / 7) * 0.6);
      return `rgba(244, 63, 94, ${opacity})`; // rose-500
    }
    return '#374151'; // gray-700
  };

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: getFillColor(changePct),
          stroke: '#111827',
          strokeWidth: 2 / (depth + 1),
          strokeOpacity: 1,
        }}
        className="cursor-pointer hover:brightness-110 transition-all"
      />
      {width > 40 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={Math.min(width / 4, 14)}
          fontWeight="bold"
          className="pointer-events-none"
        >
          {name}
        </text>
      )}
      {width > 45 && height > 45 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fillOpacity={0.8}
          fontSize={Math.min(width / 6, 10)}
          className="pointer-events-none"
        >
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
        </text>
      )}
    </g>
  );
};

export default function PortfolioHeatmap({ holdings, quotesBySymbol }) {
  const { t, formatQuoteInteger } = useI18n();
  const navigate = useNavigate();

  const data = useMemo(() => {
    return holdings
      .map((h) => {
        const quote = quotesBySymbol[h.symbol] || {};
        return {
          name: h.symbol,
          symbol: h.symbol,
          value: Number(h.live_market_value ?? h.market_value ?? 0),
          changePct: Number(quote.change_pct ?? 0),
        };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings, quotesBySymbol]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-950/60 border border-white/5 rounded-2xl p-6 h-[370px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-xl">
           🧩
        </div>
        <p className="text-sm font-semibold text-gray-300">{t('allocation.empty')}</p>
        <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{t('holdings.emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950/60 border border-white/5 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
            {t('dashboard.performanceHeatmap')}
          </h3>
          <p className="text-[10px] text-gray-600 font-medium mt-1 uppercase tracking-wider">
            {t('dashboard.heatmapWeightHint')}
          </p>
        </div>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="value"
            ratio={4 / 3}
            stroke="#111827"
            content={<CustomizedContent />}
            onClick={(node) => navigate(`/stocks/${node.symbol}`)}
          >
            <Tooltip content={<CustomTooltip t={t} formatQuoteInteger={formatQuoteInteger} />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
