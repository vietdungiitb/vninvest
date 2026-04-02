/**
 * AdminOps.jsx — Trang quản trị hệ thống (chỉ dành cho is_staff).
 * Route: /admin-ops
 *
 * Panels:
 *  - Thống kê hệ thống: user/portfolio/symbol/watchlist counts
 *  - Trạng thái realtime: channel layer, redis health
 *  - Lần sync cuối: market groups, stock profiles
 *  - Shortcuts đồng bộ nhanh
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminOpsStats, syncMarketGroups, syncStockProfile, syncWatchlistPrices } from '../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ ok }) {
  if (ok === null || ok === undefined)
    return <span className="text-xs text-gray-400">N/A</span>;
  return ok
    ? <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">OK</span>
    : <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300">FAIL</span>;
}

function SyncRow({ label, log }) {
  if (!log) return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-xs text-gray-400">Chưa có dữ liệu</span>
    </div>
  );
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400">Mode: {log.mode} · {fmtDateTime(log.started_at)}</p>
        {log.message && <p className="text-xs text-gray-400 truncate max-w-xs">{log.message}</p>}
      </div>
      <StatusBadge ok={log.success} />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminOps() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStates, setSyncStates] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminOpsStats();
      setStats(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 || status === 401) {
        setError('403');
      } else if (status === 429) {
        setError('429');
      } else {
        setError(err.message || 'Lỗi không xác định');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = useCallback(async (key, apiFn, ...args) => {
    setSyncStates((s) => ({ ...s, [key]: 'loading' }));
    try {
      await apiFn(...args);
      setSyncStates((s) => ({ ...s, [key]: 'ok' }));
      await load();
    } catch {
      setSyncStates((s) => ({ ...s, [key]: 'error' }));
    }
  }, [load]);

  // ─── Render states ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error === '403') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-lg font-semibold text-red-500">Bạn không có quyền truy cập trang này.</p>
        <button
          className="text-blue-500 hover:underline text-sm"
          onClick={() => navigate('/dashboard')}
        >
          ← Trở về Dashboard
        </button>
      </div>
    );
  }

  if (error === '429') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-yellow-600 dark:text-yellow-400 font-semibold">429 — Quá nhiều yêu cầu</p>
        <p className="text-sm text-gray-500">Server đang bận hoặc rate limit tạm thời. Vui lòng chờ vài giây rồi thử lại.</p>
        <button className="text-blue-500 hover:underline text-sm" onClick={load}>Thử lại</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button className="text-blue-500 hover:underline text-sm" onClick={load}>Thử lại</button>
      </div>
    );
  }

  if (!stats) return null;

  const syncBtn = (key, label, fn, ...args) => {
    const st = syncStates[key];
    return (
      <button
        disabled={st === 'loading'}
        onClick={() => handleSync(key, fn, ...args)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          st === 'loading'
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            : st === 'ok'
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : st === 'error'
            ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {st === 'loading' ? 'Đang sync...' : st === 'ok' ? 'Xong ✓' : st === 'error' ? 'Lỗi ✗' : label}
      </button>
    );
  };

  // ─── Full render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Ops</h1>
        <button
          onClick={load}
          className="text-xs text-blue-500 hover:underline"
        >
          Làm mới
        </button>
      </div>

      {/* Thống kê hệ thống */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Thống kê hệ thống</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Người dùng" value={stats.user_count} />
          <StatCard label="Danh mục" value={stats.portfolio_count} />
          <StatCard label="Mã theo dõi" value={stats.tracked_symbol_count} />
          <StatCard label="Watchlist items" value={stats.watchlist_item_count} />
        </div>
      </section>

      {/* Trạng thái Realtime */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Trạng thái Realtime</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Channel layer</span>
            <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{stats.channel_layer_type}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Realtime enabled</span>
            <StatusBadge ok={stats.realtime_enabled} />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Redis</span>
            <StatusBadge ok={stats.redis_ok} />
          </div>
        </div>
      </section>

      {/* Lần sync cuối */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Lần đồng bộ cuối</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 px-5">
          <SyncRow label="Market Groups" log={stats.last_market_group_sync} />
          <SyncRow label="Stock Profiles" log={stats.last_stock_profile_sync} />
        </div>
      </section>

      {/* Shortcuts đồng bộ */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Đồng bộ nhanh</h2>
        <div className="flex flex-wrap gap-3">
          {syncBtn('stockprofile', 'Sync Stock Profiles', syncStockProfile)}
          {syncBtn('watchlist', 'Sync Watchlist Prices', syncWatchlistPrices, 5)}
          {syncBtn('marketgroups', 'Đồng bộ Nhóm Thị trường', syncMarketGroups)}
        </div>
      </section>
    </div>
  );
}
