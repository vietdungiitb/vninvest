import React, { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getEquityCurve } from '../api/client';
import { useI18n } from '../context/LangContext';

function getPeriods(t) {
  return [
    { label: t('portfolioLineChart.periods.p1m'), days: 30 },
    { label: t('portfolioLineChart.periods.p3m'), days: 90 },
    { label: t('portfolioLineChart.periods.p6m'), days: 180 },
    { label: t('portfolioLineChart.periods.p1y'), days: 365 },
  ];
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value != null ? `${p.value > 0 ? '+' : ''}${p.value.toFixed(2)}%` : '—'}
        </p>
      ))}
    </div>
  );
}

function PctAxisTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#6b7280" fontSize={10}>
      {payload.value > 0 ? `+${payload.value}%` : `${payload.value}%`}
    </text>
  );
}

export default function EquityVsBenchmarkChart({ portfolioId }) {
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [hasBenchmark, setHasBenchmark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activePeriod, setActivePeriod] = useState(180);
  const periods = getPeriods(t);

  const fetchCurve = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const res = await getEquityCurve(portfolioId, activePeriod);
      setData(res.data.points || []);
      setHasBenchmark(res.data.has_benchmark || false);
    } catch (_) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, activePeriod]);

  useEffect(() => { fetchCurve(); }, [fetchCurve]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {t('equityVsBenchmark.title')}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasBenchmark ? t('equityVsBenchmark.subtitleWithBenchmark') : t('equityVsBenchmark.subtitle')}
          </p>
        </div>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p.days}
              onClick={() => setActivePeriod(p.days)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activePeriod === p.days
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-52 animate-pulse rounded-xl bg-gray-800" />
      ) : data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
          {t('equityVsBenchmark.noData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPort" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradBench" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={<PctAxisTick />}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            {hasBenchmark && (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#9ca3af' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="portfolio_pct"
              name={t('equityVsBenchmark.seriesPortfolio')}
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#gradPort)"
              dot={false}
              activeDot={{ r: 4, fill: '#06b6d4' }}
            />
            {hasBenchmark && (
              <Area
                type="monotone"
                dataKey="benchmark_pct"
                name={t('equityVsBenchmark.seriesBenchmark')}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                fill="url(#gradBench)"
                dot={false}
                activeDot={{ r: 3, fill: '#f59e0b' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
