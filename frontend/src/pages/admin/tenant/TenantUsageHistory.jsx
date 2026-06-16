import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getTenantUsageHistory } from '../../../api/client';
import { useI18n } from '../../../context/LangContext';
import { usePortfolio } from '../../../context/PortfolioContext';

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function resolveErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.detail || fallback;
}

function formatNumber(value, locale) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (value < 0) {
    return '∞';
  }
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN').format(value);
}

function formatDate(value, locale) {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function resolveRiskColor(riskState) {
  if (riskState === 'critical') return '#f43f5e'; // rose-500
  if (riskState === 'warning') return '#fbbf24'; // amber-400
  return '#34d399'; // emerald-400
}

export default function TenantUsageHistory() {
  const { t, locale } = useI18n();
  const { ability } = usePortfolio();
  const canReadBilling = ability.can('read', 'TenantBillingView');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMeter, setSelectedMeter] = useState('all');
  const [selectedDays, setSelectedDays] = useState(30);

  const meterOptions = useMemo(() => {
    const meters = [...new Set(history.map(item => item.meter_code))];
    return ['all', ...meters];
  }, [history]);

  const meterLabels = useMemo(() => {
    const map = {};
    history.forEach(item => {
      map[item.meter_code] = item.meter_name;
    });
    return map;
  }, [history]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const params = { days: selectedDays };
      if (selectedMeter !== 'all') {
        params.meter_code = selectedMeter;
      }
      const response = await getTenantUsageHistory(params);
      setHistory(Array.isArray(response.data?.data) ? response.data.data : response.data || []);
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantUsage.loadError')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');
      try {
        const params = { days: selectedDays };
        if (selectedMeter !== 'all') {
          params.meter_code = selectedMeter;
        }
        const response = await getTenantUsageHistory(params);
        if (cancelled) return;
        setHistory(Array.isArray(response.data?.data) ? response.data.data : response.data || []);
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantUsage.loadError')));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [t, selectedMeter, selectedDays]);

  const filteredHistory = useMemo(() => {
    if (selectedMeter === 'all') return history;
    return history.filter(item => item.meter_code === selectedMeter);
  }, [history, selectedMeter]);

  const chartData = useMemo(() => {
    // Group by date and meter for multi-line chart
    const grouped = {};
    filteredHistory.forEach(item => {
      const dateKey = item.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey };
      }
      grouped[dateKey][item.meter_code] = item.consumed_amount;
      grouped[dateKey][`${item.meter_code}_limit`] = item.entitled_amount;
    });
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredHistory]);

  const meterDisplayName = selectedMeter === 'all' 
    ? t('tenantUsage.allMeters') 
    : (meterLabels[selectedMeter] || selectedMeter);

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantUsage.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantUsage.historyTitle')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantUsage.historyDescription')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantUsage.refreshAction')}
              </button>
              {canReadBilling ? (
                <Link
                  to="/tenant-admin/billing"
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20"
                >
                  {t('tenantUsage.openBilling')}
                </Link>
              ) : null}
              <Link
                to="/tenant-admin/home"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantUsage.backToHome')}
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-400">{t('tenantUsage.meterFilterLabel')}</label>
              <select
                value={selectedMeter}
                onChange={(e) => setSelectedMeter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">{t('tenantUsage.allMeters')}</option>
                {meterOptions.filter(m => m !== 'all').map(meter => (
                  <option key={meter} value={meter}>{meterLabels[meter] || meter}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-400">{t('tenantUsage.daysFilterLabel')}</label>
              <select
                value={selectedDays}
                onChange={(e) => setSelectedDays(parseInt(e.target.value, 10))}
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value={7}>{t('tenantUsage.last7Days')}</option>
                <option value={30}>{t('tenantUsage.last30Days')}</option>
                <option value={90}>{t('tenantUsage.last90Days')}</option>
              </select>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {/* Chart Section */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantUsage.chartTitle')}</p>
            {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
          </div>
          
          {!loading && chartData.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500 text-center">
              {t('tenantUsage.noHistoryData')}
            </div>
          ) : (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => formatDate(value, locale)}
                    stroke="#64748b"
                    fontSize={11}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    fontSize={11}
                    tick={{ fill: '#94a3b8' }}
                    tickFormatter={(value) => formatNumber(value, locale)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelFormatter={(value) => formatDate(value, locale)}
                    formatter={(value, name) => [
                      formatNumber(value, locale),
                      name.replace(/_limit$/, ' (Limit)'),
                    ]}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => meterLabels[value] || value}
                  />
                  {selectedMeter === 'all' ? (
                    // Show all meters as separate lines
                    meterOptions.filter(m => m !== 'all').map((meter, index) => (
                      <Line
                        key={meter}
                        type="monotone"
                        dataKey={meter}
                        stroke={resolveRiskColor('normal')}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name={meterLabels[meter] || meter}
                      />
                    ))
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey={selectedMeter}
                        stroke={resolveRiskColor('normal')}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name={t('tenantUsage.consumedAmountLabel')}
                      />
                      <Line
                        type="monotone"
                        dataKey={`${selectedMeter}_limit`}
                        stroke="#64748b"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                        name={t('tenantUsage.entitledAmountLabel')}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Data Table */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantUsage.quotaListTitle')}</p>
            {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left pb-2 font-medium text-slate-400">{t('common.date')}</th>
                  <th className="text-left pb-2 font-medium text-slate-400">{t('tenantUsage.meterListTitle')}</th>
                  <th className="text-right pb-2 font-medium text-slate-400">{t('tenantUsage.consumedAmountLabel')}</th>
                  <th className="text-right pb-2 font-medium text-slate-400">{t('tenantUsage.entitledAmountLabel')}</th>
                  <th className="text-right pb-2 font-medium text-slate-400">{t('tenantUsage.remainingAmountLabel')}</th>
                  <th className="text-center pb-2 font-medium text-slate-400">{t('tenantUsage.hardStop')}</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-5 text-center text-slate-500">
                      {t('tenantUsage.noHistoryData')}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, index) => (
                    <tr key={`${item.date}-${item.meter_code}-${index}`} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                      <td className="py-3 text-slate-300">{formatDate(item.date, locale)}</td>
                      <td className="py-3 text-white font-medium">{item.meter_name}</td>
                      <td className="py-3 text-right text-slate-100">{formatNumber(item.consumed_amount, locale)}</td>
                      <td className="py-3 text-right text-slate-400">{formatNumber(item.entitled_amount, locale)}</td>
                      <td className="py-3 text-right text-slate-100">{formatNumber(item.remaining_amount, locale)}</td>
                      <td className="py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.hard_stop ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-400'}`}>
                          {item.hard_stop ? t('tenantUsage.hardStop') : t('tenantUsage.risk.' + item.risk_state)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}