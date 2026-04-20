/**
 * components/watchlist/WatchlistCells.jsx
 * Pure display cell components — no side effects.
 */
import React from 'react';

export function ChangeCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400';
  return (
    <span className={`${color} font-medium tabular-nums`}>
      {isUp ? '+' : ''}
      {typeof value === 'number' ? value.toFixed(2) : value}
    </span>
  );
}

export function PctCell({ pct, emptyLabel = '—' }) {
  if (pct === null || pct === undefined) {
    return <span className="text-gray-600 text-xs">{emptyLabel}</span>;
  }
  const isUp = pct > 0;
  const isDown = pct < 0;
  return (
    <span className={`font-bold tabular-nums ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'}`}>
      {isUp ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

export function RsiCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const num = Number(value);
  const colorClass = num > 70
    ? 'text-red-400 font-bold'
    : num < 30
      ? 'text-green-400 font-bold'
      : 'text-gray-300';
  const badge = num > 70 ? 'bg-red-900/30' : num < 30 ? 'bg-green-900/30' : '';
  return (
    <span className={`tabular-nums text-xs px-1.5 py-0.5 rounded ${colorClass} ${badge}`}>
      {num.toFixed(1)}
    </span>
  );
}

export function RvolCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const num = Number(value);
  const isHigh = num >= 2.0;
  return (
    <span className={`tabular-nums text-xs ${isHigh ? 'text-amber-300 font-bold' : 'text-gray-400'}`}>
      {num.toFixed(2)}x
    </span>
  );
}

export function Ma20DistCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const num = Number(value);
  const isPos = num > 0;
  const isNear = Math.abs(num) <= 1.0;
  const colorClass = isNear
    ? 'text-amber-300 font-semibold'
    : isPos
      ? 'text-green-400'
      : 'text-red-400';
  return (
    <span className={`tabular-nums text-xs ${colorClass}`}>
      {isPos ? '+' : ''}{num.toFixed(2)}%
    </span>
  );
}

/**
 * Mini SVG sparkline — renders accumulated price series as an inline chart.
 * @param {number[]} prices - array of prices (oldest first)
 * @param {number} width
 * @param {number} height
 */
export function SparklineCell({ prices, width = 80, height = 24 }) {
  if (!prices || prices.length < 2) {
    return <span className="text-gray-700 text-xs">—</span>;
  }

  const valid = prices.map(Number).filter(Number.isFinite);
  if (valid.length < 2) return <span className="text-gray-700 text-xs">—</span>;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const pts = valid.map((p, i) => {
    const x = (i / (valid.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const isUp = valid[valid.length - 1] >= valid[0];
  const stroke = isUp ? '#4ade80' : '#f87171';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
