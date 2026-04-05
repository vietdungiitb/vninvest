/**
 * components/PortfolioLineChart.jsx
 * Biểu đồ đường (Line Chart) hiển thị tăng trưởng giá trị danh mục theo thời gian.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getChartData } from '../api/client';
import { useI18n } from '../context/LangContext';

function getPeriods(t) {
  return [
    { label: t('portfolioLineChart.periods.p1m'), days: 30 },
    { label: t('portfolioLineChart.periods.p3m'), days: 90 },
    { label: t('portfolioLineChart.periods.p6m'), days: 180 },
    { label: t('portfolioLineChart.periods.p1y'), days: 365 },
  ];
}

function formatAxisVND(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value;
}

function formatTooltipVND(value, localeTag) {
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(value);
}

function CustomTooltip({ active, payload, label, localeTag }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-brand-400">
        {formatTooltipVND(payload[0].value, localeTag)}
      </p>
    </div>
  );
}

export default function PortfolioLineChart({ portfolioId }) {
  const { t, localeTag } = useI18n();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePeriod, setActivePeriod] = useState(90);
  const periods = getPeriods(t);

  const fetchChart = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const res = await getChartData(portfolioId, activePeriod);
      const formatted = res.data.map((d) => ({
        date: d.date,
        value: parseFloat(d.value),
      }));
      setData(formatted);
    } catch (err) {
      console.error('Load chart data failed:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, activePeriod]);

  useEffect(() => { fetchChart(); }, [fetchChart]);

  // Tính % thay đổi so với điểm đầu
  const firstVal = data[0]?.value ?? 0;
  const lastVal = data[data.length - 1]?.value ?? 0;
  const changePct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
  const isUp = changePct >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {t('portfolioLineChart.title')}
          </h2>
          {data.length > 1 && !loading && (
            <p className={`text-xs mt-0.5 font-medium ${isUp ? 'text-brand-500' : 'text-red-400'}`}>
              {t('portfolioLineChart.changeInPeriod', { value: `${isUp ? '+' : ''}${changePct.toFixed(2)}` })}
            </p>
          )}
        </div>
        {/* Bộ chọn kỳ */}
        <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg">
          {periods.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setActivePeriod(days)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                activePeriod === days
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-gray-800 rounded-lg animate-pulse" />
      ) : data.length < 2 ? (
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          {t('portfolioLineChart.notEnoughData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d) => {
                const dt = new Date(d);
                return `${dt.getDate()}/${dt.getMonth() + 1}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatAxisVND}
              width={55}
            />
            <Tooltip content={<CustomTooltip localeTag={localeTag} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#16a34a"
              strokeWidth={2}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
