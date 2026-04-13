import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminVnstockBenchmarkLatest,
  runAdminVnstockBenchmark,
} from '../../api/client';

function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function parseCsvList(text, parser) {
  return String(text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parser)
    .filter((item) => item !== null && item !== undefined);
}

export default function VnstockBenchmarkPanel({ onApplyRecommendation }) {
  const [form, setForm] = useState({
    symbol: 'VNM',
    duration_seconds: '20',
    timeout_seconds: '8',
    providers: 'KBS,VCI',
    concurrency_levels: '2,4,8,16',
  });
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState(null);
  const pollingRef = React.useRef(null);

  const topRows = useMemo(() => {
    const rows = Array.isArray(report?.results) ? report.results : [];
    return [...rows].sort((a, b) => {
      const rlA = Number(a?.rate_limited_pct || 0);
      const rlB = Number(b?.rate_limited_pct || 0);
      if (rlA !== rlB) return rlA - rlB;
      return Number(b?.requests_per_minute || 0) - Number(a?.requests_per_minute || 0);
    });
  }, [report]);

  const loadLatest = useCallback(async () => {
    try {
      const resp = await getAdminVnstockBenchmarkLatest();
      if (resp.data?.has_report && resp.data?.report) {
        setReport(resp.data.report);
      }
    } catch {
      // fail-soft: panel can still run new benchmark even when latest retrieval fails.
    }
  }, []);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const onInput = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (state !== 'idle') {
      setState('idle');
      setMessage('');
    }
  }, [state]);

  const runBenchmark = useCallback(async (event) => {
    event.preventDefault();

    const payload = {
      symbol: String(form.symbol || 'VNM').trim().toUpperCase(),
      duration_seconds: Number(form.duration_seconds),
      timeout_seconds: Number(form.timeout_seconds),
      providers: parseCsvList(form.providers, (item) => String(item).toUpperCase()),
      concurrency_levels: parseCsvList(form.concurrency_levels, (item) => {
        const value = Number(item);
        return Number.isFinite(value) ? Math.trunc(value) : null;
      }),
    };

    if (Number.isNaN(payload.duration_seconds) || Number.isNaN(payload.timeout_seconds) || payload.providers.length === 0 || payload.concurrency_levels.length === 0) {
      setState('error');
      setMessage('Dữ liệu benchmark không hợp lệ.');
      return;
    }

    setState('running');
    setMessage('Đang chạy benchmark online KBS/VCI...');
    try {
      const resp = await runAdminVnstockBenchmark(payload);
      if (resp.status === 202 || resp.data?.status === 'started') {
        // Async mode: poll /latest/ until a new report appears
        const startedAt = Date.now();
        const prevFinishedAt = report?.finished_at || null;
        const estimatedRuntimeSeconds = Number(payload.duration_seconds) * payload.providers.length * payload.concurrency_levels.length;
        const maxWaitMs = Math.min(20 * 60 * 1000, (estimatedRuntimeSeconds + 180) * 1000);
        setMessage('Benchmark đang chạy nền... đang chờ kết quả.');
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
          try {
            const pollResp = await getAdminVnstockBenchmarkLatest();
            const newReport = pollResp.data?.report || null;
            if (newReport && newReport.finished_at !== prevFinishedAt) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              setReport(newReport);
              setState('success');
              setMessage('Đã hoàn tất benchmark và cập nhật khuyến nghị runtime.');
            } else if (Date.now() - startedAt > maxWaitMs) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              setState('error');
              setMessage('Benchmark đang chạy quá lâu hoặc worker đang nghẽn. Kiểm tra Celery trong Runtime KPI và thử lại.');
            }
          } catch {
            // ignore transient poll errors
          }
        }, 3000);
      } else {
        // Legacy sync response (fallback)
        const nextReport = resp.data?.report || null;
        setReport(nextReport);
        setState('success');
        setMessage('Đã hoàn tất benchmark và cập nhật khuyến nghị runtime.');
      }
    } catch (err) {
      setState('error');
      setMessage(err?.response?.data?.message || 'Benchmark thất bại.');
    }
  }, [form]);

  const applyRecommendation = useCallback(() => {
    const recommendation = report?.recommendation;
    if (!recommendation || typeof onApplyRecommendation !== 'function') {
      return;
    }
    onApplyRecommendation(recommendation);
    setState('success');
    setMessage('Đã áp dụng khuyến nghị benchmark vào form Runtime Vnstock Config.');
  }, [onApplyRecommendation, report]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Benchmark Price Board (KBS/VCI)</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Chạy benchmark online theo concurrency để chọn provider phù hợp và gợi ý cấu hình runtime.
        </p>

        <form onSubmit={runBenchmark} className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Symbol benchmark
            <input
              type="text"
              value={form.symbol}
              onChange={(event) => onInput('symbol', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Duration (giây)
            <input
              type="number"
              min="5"
              max="180"
              value={form.duration_seconds}
              onChange={(event) => onInput('duration_seconds', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout/request (giây)
            <input
              type="number"
              min="1"
              max="30"
              value={form.timeout_seconds}
              onChange={(event) => onInput('timeout_seconds', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300 md:col-span-2">
            Providers (phân tách dấu phẩy)
            <input
              type="text"
              value={form.providers}
              onChange={(event) => onInput('providers', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Concurrency levels
            <input
              type="text"
              value={form.concurrency_levels}
              onChange={(event) => onInput('concurrency_levels', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>

          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={state === 'running'}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${state === 'running' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {state === 'running' ? 'Đang benchmark...' : 'Chạy benchmark'}
            </button>
            <button
              type="button"
              disabled={!report?.recommendation}
              onClick={applyRecommendation}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Áp dụng khuyến nghị vào Runtime Config
            </button>
            {message ? (
              <span className={`text-sm ${state === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {message}
              </span>
            ) : null}
          </div>
        </form>
      </div>

      {report ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Kết quả benchmark gần nhất</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Symbol {report.symbol} · duration {report.duration_seconds}s · completed {report.finished_at || '—'}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Concurrency</th>
                  <th className="py-2 pr-4">Req/min</th>
                  <th className="py-2 pr-4">429%</th>
                  <th className="py-2 pr-4">Success%</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((row, idx) => (
                  <tr key={`${row.provider}-${row.concurrency}-${idx}`} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">{row.provider}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">{row.concurrency}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">{fmtNumber(row.requests_per_minute, 2)}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">{fmtNumber(row.rate_limited_pct, 2)}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">{fmtNumber(row.success_pct, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.recommendation ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <p>
                Khuyến nghị: primary <strong>{report.recommendation.primary_provider}</strong>, fallback <strong>{report.recommendation.fallback_provider}</strong>,
                start concurrency <strong>{report.recommendation.adaptive_start_concurrency}</strong>.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
