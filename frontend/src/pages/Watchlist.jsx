/**
 * pages/Watchlist.jsx
 * Nhóm Chứng khoán — duyệt nhóm ngành + quản lý Mã Theo dõi cá nhân.
 *
 * Architecture:
 *   - Sidebar trái: "Mã Theo dõi" (cố định) + 28 nhóm ngành (tham chiếu)
 *   - view === 'tracked'  → panel Mã Theo dõi (TrackedSymbol, có add/delete)
 *   - view === groupId    → panel nhóm tham chiếu (read-only)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  getWatchlistGroups, seedWatchlist, syncWatchlistPrices,
  getTrackedSymbols, addTrackedSymbol, deleteTrackedSymbol,
} from '../api/client';

const TYPE_LABELS = { SECTOR: 'Ngành', MARKET_CAP: 'Vốn hóa', CUSTOM: 'Tùy chỉnh' };

function ChangeCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400';
  return (
    <span className={`${color} font-medium tabular-nums`}>
      {isUp ? '+' : ''}{typeof value === 'number' ? value.toFixed(2) : value}
    </span>
  );
}

function PctCell({ pct }) {
  if (pct === null || pct === undefined) {
    return <span className="text-gray-600 text-xs">Chưa sync</span>;
  }
  const isUp = pct > 0;
  const isDown = pct < 0;
  return (
    <span className={`font-bold tabular-nums ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'}`}>
      {isUp ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function formatPrice(val) {
  if (val === null || val === undefined) return <span className="text-gray-600">—</span>;
  return <span className="text-gray-200 tabular-nums">{Number(val).toLocaleString('vi-VN')}</span>;
}

export default function WatchlistPage() {
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState('tracked'); // 'tracked' | number (groupId)
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Mã Theo dõi state
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [trackedLoading, setTrackedLoading] = useState(false);

  // Form thêm Mã Theo dõi
  const [srcGroupId, setSrcGroupId] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [symbolError, setSymbolError] = useState('');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWatchlistGroups();
      setGroups(res.data);
    } catch (err) {
      console.error('fetchGroups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTracked = useCallback(async () => {
    setTrackedLoading(true);
    try {
      const res = await getTrackedSymbols();
      setTrackedSymbols(res.data);
    } catch (err) {
      console.error('fetchTracked:', err);
    } finally {
      setTrackedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchTracked();
  }, []); // eslint-disable-line

  const activeGroup = view !== 'tracked' ? groups.find((g) => g.id === view) || null : null;

  const groupStats = activeGroup
    ? activeGroup.items.reduce(
        (acc, item) => {
          if (item.change_pct > 0) acc.up++;
          else if (item.change_pct < 0) acc.down++;
          else if (item.change_pct === 0) acc.flat++;
          return acc;
        },
        { up: 0, down: 0, flat: 0 },
      )
    : null;

  const trackedStats = {
    up: trackedSymbols.filter((t) => t.change_pct > 0).length,
    down: trackedSymbols.filter((t) => t.change_pct < 0).length,
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSyncMsg('');
    try {
      const res = await seedWatchlist();
      setSyncMsg(res.data.message || 'Đã nạp nhóm mặc định.');
      await fetchGroups();
    } catch {
      setSyncMsg('Tạo nhóm mặc định thất bại.');
    } finally {
      setSeeding(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await syncWatchlistPrices(5);
      setSyncMsg(`Đã sync ${res.data.total_symbols} mã.`);
      await fetchGroups();
      await fetchTracked();
    } catch {
      setSyncMsg('Đồng bộ thất bại.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleAddTracked = async (e) => {
    e.preventDefault();
    if (!selectedSymbol) return;
    setAddingSymbol(true);
    setSymbolError('');
    try {
      await addTrackedSymbol(selectedSymbol, srcGroupId ? Number(srcGroupId) : null);
      setSelectedSymbol('');
      await fetchTracked();
    } catch (err) {
      setSymbolError(err.response?.data?.detail || `Không thể thêm ${selectedSymbol}.`);
    } finally {
      setAddingSymbol(false);
    }
  };

  const handleDeleteTracked = async (id, symbol) => {
    if (!window.confirm(`Xóa ${symbol} khỏi Mã Theo dõi?`)) return;
    try {
      await deleteTrackedSymbol(id);
      setTrackedSymbols((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert('Xóa thất bại.');
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-100">Nhóm Chứng khoán</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && <span className="text-xs text-brand-500">{syncMsg}</span>}

          {groups.length === 0 && !loading && (
            <button
              onClick={handleSeed} disabled={seeding}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white
                         text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {seeding ? 'Đang tạo...' : 'Nạp nhóm mặc định'}
            </button>
          )}

          <button
            onClick={handleSync} disabled={syncing || groups.length === 0}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40
                       border border-gray-700 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            {syncing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-brand-500 rounded-full animate-spin inline-block" />
                Đang sync...
              </>
            ) : 'Đồng bộ giá'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-300 font-semibold">Chưa có nhóm chứng khoán nào</p>
          <p className="text-gray-500 text-sm mt-1">
            Nhấn "Nạp nhóm mặc định" để tạo 28 nhóm ngành Việt Nam
          </p>
          <button
            onClick={handleSeed} disabled={seeding}
            className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold
                       px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {seeding ? 'Đang tạo...' : 'Nạp nhóm mặc định'}
          </button>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* ── Sidebar ── */}
          <aside className="w-52 flex-shrink-0 space-y-0.5">
            {/* Mã Theo dõi — top fixed item */}
            <button
              onClick={() => setView('tracked')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
                view === 'tracked'
                  ? 'bg-brand-900/40 border-brand-700'
                  : 'border-transparent hover:bg-gray-900/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-brand-500" />
                <span className={`text-sm font-semibold truncate ${
                  view === 'tracked' ? 'text-brand-300' : 'text-gray-300'
                }`}>
                  Mã Theo dõi
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 pl-[18px] text-xs">
                <span className="text-gray-600">{trackedSymbols.length} mã</span>
                {trackedStats.up > 0 && <span className="text-green-500">▲{trackedStats.up}</span>}
                {trackedStats.down > 0 && <span className="text-red-500">▼{trackedStats.down}</span>}
              </div>
            </button>

            {/* Divider + Nhóm CK label */}
            <div className="pt-3 pb-1 px-1">
              <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Nhóm CK</p>
            </div>

            {/* Group list */}
            {groups.map((g) => {
              const isActive = g.id === view;
              const upCount = g.items.filter((i) => i.change_pct > 0).length;
              const downCount = g.items.filter((i) => i.change_pct < 0).length;
              return (
                <button
                  key={g.id}
                  onClick={() => setView(g.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors border ${
                    isActive ? 'bg-gray-800 border-gray-600' : 'border-transparent hover:bg-gray-900/70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className={`text-sm font-medium truncate ${
                      isActive ? 'text-gray-100' : 'text-gray-400'
                    }`}>
                      {g.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-[18px] text-xs">
                    <span className="text-gray-600">{g.items.length} mã</span>
                    {upCount > 0 && <span className="text-green-500">▲{upCount}</span>}
                    {downCount > 0 && <span className="text-red-500">▼{downCount}</span>}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {view === 'tracked' ? (
              /* ===================== Mã Theo dõi panel ===================== */
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-4 h-4 rounded-full bg-brand-500 flex-shrink-0" />
                  <h2 className="text-base font-bold text-gray-100">Mã Theo dõi</h2>
                  <span className="text-xs text-gray-500">Danh sách cá nhân của bạn</span>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {trackedLoading ? (
                    <div className="py-12 text-center">
                      <span className="w-5 h-5 border-2 border-gray-600 border-t-brand-500 rounded-full animate-spin inline-block" />
                    </div>
                  ) : trackedSymbols.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-sm">
                      Chưa có mã nào. Thêm mã từ nhóm ngành bên dưới.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {['Mã Chứng khoán', 'Nhóm nguồn', 'Giá đóng cửa', 'Thay đổi', '% thay đổi', 'Ngày', ''].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {trackedSymbols.map((t) => {
                          const isUp = t.change_pct > 0;
                          const isDown = t.change_pct < 0;
                          const rowBg = isUp
                            ? 'hover:bg-green-900/10'
                            : isDown
                            ? 'hover:bg-red-900/10'
                            : 'hover:bg-gray-800/40';
                          return (
                            <tr key={t.id} className={`transition-colors ${rowBg}`}>
                              <td className="px-4 py-3">
                                <span className="font-bold text-sm px-2 py-0.5 rounded bg-brand-900/30 text-brand-300">
                                  {t.symbol}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{t.source_group_name || '—'}</td>
                              <td className="px-4 py-3">{formatPrice(t.current_price)}</td>
                              <td className="px-4 py-3"><ChangeCell value={t.change_value} /></td>
                              <td className="px-4 py-3"><PctCell pct={t.change_pct} /></td>
                              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                                {t.last_date || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleDeleteTracked(t.id, t.symbol)}
                                  className="text-gray-700 hover:text-red-400 text-xs transition-colors"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Form thêm Mã Theo dõi */}
                  <div className="border-t border-gray-800 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-2">Thêm Mã Theo dõi</p>
                    <form onSubmit={handleAddTracked} className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nhóm Chứng khoán</label>
                        <select
                          value={srcGroupId}
                          onChange={(e) => {
                            setSrcGroupId(e.target.value);
                            setSelectedSymbol('');
                            setSymbolError('');
                          }}
                          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5
                                     text-sm text-gray-100 w-48 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">— Chọn nhóm —</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Mã Chứng khoán</label>
                        <select
                          value={selectedSymbol}
                          onChange={(e) => { setSelectedSymbol(e.target.value); setSymbolError(''); }}
                          disabled={!srcGroupId}
                          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5
                                     text-sm text-gray-100 w-36 focus:outline-none focus:ring-1 focus:ring-brand-500
                                     disabled:opacity-40"
                        >
                          <option value="">— Chọn mã —</option>
                          {srcGroupId &&
                            (() => {
                              const srcGroup = groups.find((g) => String(g.id) === String(srcGroupId));
                              const existingSymbols = new Set(trackedSymbols.map((t) => t.symbol));
                              return (srcGroup?.items || [])
                                .filter((i) => !existingSymbols.has(i.symbol))
                                .sort((a, b) => a.symbol.localeCompare(b.symbol))
                                .map((i) => (
                                  <option key={i.symbol} value={i.symbol}>
                                    {i.symbol}
                                  </option>
                                ));
                            })()}
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={addingSymbol || !selectedSymbol}
                        className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white
                                   text-xs font-semibold px-3 py-1.5 rounded-md transition-colors mb-0.5"
                      >
                        {addingSymbol ? '...' : 'Thêm'}
                      </button>
                      {symbolError && (
                        <span className="text-red-400 text-xs self-end mb-1">{symbolError}</span>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            ) : activeGroup ? (
              /* ===================== Group reference panel (read-only) ===================== */
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: activeGroup.color }}
                  />
                  <div>
                    <h2 className="text-base font-bold text-gray-100">{activeGroup.name}</h2>
                    {activeGroup.description && (
                      <p className="text-xs text-gray-500">{activeGroup.description}</p>
                    )}
                  </div>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[activeGroup.group_type]}
                  </span>
                </div>

                {groupStats && activeGroup.items.length > 0 && (
                  <div className="flex items-center gap-4 mb-3 text-xs">
                    <span className="text-gray-500">{activeGroup.items.length} mã</span>
                    <span className="text-green-400">▲ Tăng: {groupStats.up}</span>
                    <span className="text-red-400">▼ Giảm: {groupStats.down}</span>
                    <span className="text-gray-500">— Không đổi: {groupStats.flat}</span>
                  </div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {activeGroup.items.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">
                      Nhóm này chưa có dữ liệu.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {['Mã Chứng khoán', 'Giá đóng cửa', 'Thay đổi', '% thay đổi', 'Ngày'].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {activeGroup.items.map((item) => {
                          const isUp = item.change_pct > 0;
                          const isDown = item.change_pct < 0;
                          const rowBg = isUp
                            ? 'hover:bg-green-900/10'
                            : isDown
                            ? 'hover:bg-red-900/10'
                            : 'hover:bg-gray-800/40';
                          return (
                            <tr key={item.id} className={`transition-colors ${rowBg}`}>
                              <td className="px-4 py-3">
                                <span
                                  className="font-bold text-sm px-2 py-0.5 rounded"
                                  style={{
                                    backgroundColor: activeGroup.color + '22',
                                    color: activeGroup.color,
                                  }}
                                >
                                  {item.symbol}
                                </span>
                              </td>
                              <td className="px-4 py-3">{formatPrice(item.current_price)}</td>
                              <td className="px-4 py-3"><ChangeCell value={item.change_value} /></td>
                              <td className="px-4 py-3"><PctCell pct={item.change_pct} /></td>
                              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                                {item.last_date || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}


