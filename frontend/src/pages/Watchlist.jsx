/**
 * pages/Watchlist.jsx
 * Radar thị trường — tách rõ 2 lớp dùng dữ liệu:
 * 1) Nhóm thị trường để quét rộng theo ngành/vốn hóa/chủ đề.
 * 2) Danh sách theo dõi để bám sát realtime.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSecuritiesGroups, seedSecurities, syncSecuritiesPrices,
  getTrackedSymbols, addTrackedSymbol, deleteTrackedSymbol,
  syncStockProfile,
  getPriceAlerts, createPriceAlert, updatePriceAlert, deletePriceAlert, markPriceAlertTriggered,
} from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';

const TYPE_LABELS = { SECTOR: 'Ngành', MARKET_CAP: 'Vốn hóa', CUSTOM: 'Tùy chỉnh' };
const REALTIME_LABELS = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối realtime',
  live: 'Realtime đang chạy',
  polling: 'Fallback polling',
};
const PRICE_ALERT_CONDITION_LABELS = {
  ABOVE: 'Vượt lên trên',
  BELOW: 'Rơi xuống dưới',
};

function mergeTickerIntoItem(item, update) {
  if (item.symbol !== update.symbol) {
    return item;
  }

  return {
    ...item,
    current_price: update.price ?? item.current_price,
    change_value: update.change_value ?? item.change_value,
    change_pct: update.change_pct ?? item.change_pct,
    last_date: update.ts ?? update.last_date ?? item.last_date,
    freshness_seconds: update.freshness_seconds ?? item.freshness_seconds,
    stale: update.stale ?? item.stale,
  };
}

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

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}`;
}

function isPriceAlertMatched(rule, currentPrice) {
  const targetPrice = Number(rule?.target_price);
  const normalizedCurrentPrice = Number(currentPrice);
  if (!Number.isFinite(targetPrice) || !Number.isFinite(normalizedCurrentPrice)) {
    return false;
  }

  return rule.condition === 'ABOVE'
    ? normalizedCurrentPrice >= targetPrice
    : normalizedCurrentPrice <= targetPrice;
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const { userConfig } = usePortfolio();
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState('tracked'); // 'tracked' | number (groupId)
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncingStockProfile, setSyncingStockProfile] = useState(false);

  // Mã Theo dõi state
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [trackedLoading, setTrackedLoading] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [priceAlertsLoading, setPriceAlertsLoading] = useState(false);
  const [priceAlertForm, setPriceAlertForm] = useState({
    symbol: '',
    condition: 'ABOVE',
    targetPrice: '',
    cooldownSeconds: '300',
  });
  const [priceAlertSaving, setPriceAlertSaving] = useState(false);
  const [priceAlertError, setPriceAlertError] = useState('');
  const [priceAlertMsg, setPriceAlertMsg] = useState('');
  const [triggeredPriceAlerts, setTriggeredPriceAlerts] = useState([]);
  const [addingFromGroup, setAddingFromGroup] = useState({});
  const [bulkGroupAction, setBulkGroupAction] = useState(null);
  const [groupTrackedFilter, setGroupTrackedFilter] = useState('all');
  const triggeringAlertIdsRef = useRef(new Set());
  const handleSyncStockProfile = async () => {
    setSyncingStockProfile(true);
    setSyncMsg('');
    try {
      await syncStockProfile();
      setSyncMsg('Đã đồng bộ mã chứng khoán từ thị trường!');
    } catch {
      setSyncMsg('Đồng bộ mã chứng khoán thất bại.');
    } finally {
      setSyncingStockProfile(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  // Form thêm Mã Theo dõi
  const [srcGroupId, setSrcGroupId] = useState('');
  const [addSymbol, setAddSymbol] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [symbolError, setSymbolError] = useState('');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSecuritiesGroups();
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

  const fetchPriceAlerts = useCallback(async () => {
    setPriceAlertsLoading(true);
    try {
      const res = await getPriceAlerts();
      setPriceAlerts(res.data || []);
    } catch (err) {
      console.error('fetchPriceAlerts:', err);
    } finally {
      setPriceAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchTracked();
    fetchPriceAlerts();
  }, [fetchGroups, fetchTracked, fetchPriceAlerts]);

  const allRealtimeSymbols = useMemo(
    () => [
      ...new Set([
        ...groups.flatMap((group) => group.items.map((item) => item.symbol)),
        ...trackedSymbols.map((item) => item.symbol),
        ...priceAlerts.map((rule) => rule.symbol),
      ].filter(Boolean)),
    ],
    [groups, trackedSymbols, priceAlerts],
  );

  const {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt: lastRealtimeAt,
    latestWhaleAlert,
  } = useRealtimeFeed({ symbols: allRealtimeSymbols });

  const groupsWithRealtime = useMemo(
    () => groups.map((group) => ({
      ...group,
      items: group.items.map((item) => mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {})),
    })),
    [groups, quotesBySymbol],
  );

  const trackedSymbolsWithRealtime = useMemo(
    () => trackedSymbols.map((item) => mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {})),
    [trackedSymbols, quotesBySymbol],
  );

  const priceAlertsWithRealtime = useMemo(
    () => priceAlerts.map((rule) => ({
      ...rule,
      current_price: quotesBySymbol[rule.symbol]?.current_price ?? rule.current_price,
      stale: quotesBySymbol[rule.symbol]?.stale ?? false,
    })),
    [priceAlerts, quotesBySymbol],
  );

  const latestTriggeredPriceAlert = triggeredPriceAlerts[0] || null;

  const activeGroup = view !== 'tracked' ? groupsWithRealtime.find((g) => g.id === view) || null : null;

  const groupStats = activeGroup
    ? activeGroup.items.reduce(
        (acc, item) => {
          if (item.change_pct > 0) acc.up++;
          else if (item.change_pct < 0) acc.down++;
          else acc.flat++;
          return acc;
        },
        { up: 0, down: 0, flat: 0 },
      )
    : null;

  const trackedStats = {
    up: trackedSymbolsWithRealtime.filter((t) => t.change_pct > 0).length,
    down: trackedSymbolsWithRealtime.filter((t) => t.change_pct < 0).length,
  };
  const trackedSymbolMap = new Map(trackedSymbolsWithRealtime.map((item) => [item.symbol, item]));
  const trackedSymbolSet = new Set(trackedSymbolsWithRealtime.map((item) => item.symbol));
  const activeGroupItems = activeGroup?.items || [];
  const activeGroupTrackedCount = activeGroupItems.filter((item) => trackedSymbolSet.has(item.symbol)).length;
  const activeGroupTrackedItems = activeGroupItems
    .map((item) => trackedSymbolMap.get(item.symbol))
    .filter(Boolean);
  const filteredActiveGroupItems = activeGroupItems.filter((item) => {
    if (groupTrackedFilter === 'tracked') {
      return trackedSymbolSet.has(item.symbol);
    }
    if (groupTrackedFilter === 'untracked') {
      return !trackedSymbolSet.has(item.symbol);
    }
    return true;
  });
  const activeGroupUntrackedCount = activeGroupItems.filter((item) => !trackedSymbolSet.has(item.symbol)).length;

  const openStockWorkspace = useCallback((symbol) => {
    if (!symbol) {
      return;
    }
    navigate(`/stocks/${symbol}`);
  }, [navigate]);

  const handleMarkPriceAlertTriggered = useCallback(async (rule, currentPrice) => {
    if (!rule?.id || triggeringAlertIdsRef.current.has(rule.id)) {
      return;
    }

    triggeringAlertIdsRef.current.add(rule.id);
    setTriggeredPriceAlerts((prev) => [
      {
        id: rule.id,
        symbol: rule.symbol,
        condition: rule.condition,
        target_price: rule.target_price,
        current_price: currentPrice,
        triggered_at: new Date().toISOString(),
      },
      ...prev.filter((item) => item.id !== rule.id),
    ].slice(0, 5));
    setPriceAlertMsg(`Cảnh báo giá: ${rule.symbol} đã ${rule.condition === 'ABOVE' ? 'vượt lên trên' : 'rơi xuống dưới'} ${Number(rule.target_price).toLocaleString('vi-VN')} VNĐ.`);

    try {
      const res = await markPriceAlertTriggered(rule.id);
      setPriceAlerts((prev) => prev.map((item) => (item.id === rule.id ? res.data : item)));
    } catch (err) {
      console.error('markPriceAlertTriggered:', err);
    } finally {
      triggeringAlertIdsRef.current.delete(rule.id);
      setTimeout(() => setPriceAlertMsg(''), 5000);
    }
  }, []);

  useEffect(() => {
    const now = Date.now();

    priceAlertsWithRealtime.forEach((rule) => {
      if (!rule.is_active || rule.stale) {
        return;
      }

      const currentPrice = Number(rule.current_price);
      if (!Number.isFinite(currentPrice) || !isPriceAlertMatched(rule, currentPrice)) {
        return;
      }

      const lastTriggeredAt = rule.last_triggered_at ? new Date(rule.last_triggered_at).getTime() : null;
      const cooldownMs = Number(rule.cooldown_seconds || 0) * 1000;
      const inCooldown = lastTriggeredAt && now - lastTriggeredAt < cooldownMs;
      if (inCooldown) {
        return;
      }

      handleMarkPriceAlertTriggered(rule, currentPrice);
    });
  }, [priceAlertsWithRealtime, handleMarkPriceAlertTriggered]);

  const handleSeed = async () => {
    setSeeding(true);
    setSyncMsg('');
    try {
      const res = await seedSecurities();
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
      const res = await syncSecuritiesPrices(5);
      setSyncMsg(`Đã sync ${res.data.total_symbols || res.data.total_created} mã.`);
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
    if (!addSymbol) return;
    setAddingSymbol(true);
    setSymbolError('');
    try {
      await addTrackedSymbol(addSymbol, srcGroupId ? Number(srcGroupId) : null);
      setAddSymbol('');
      await fetchTracked();
    } catch (err) {
      setSymbolError(err.response?.data?.detail || `Không thể thêm ${addSymbol}.`);
    } finally {
      setAddingSymbol(false);
    }
  };

  const handleDeleteTracked = async (id, symbol) => {
    if (!window.confirm(`Xóa ${symbol} khỏi danh sách theo dõi cá nhân?`)) return;
    try {
      await deleteTrackedSymbol(id);
      setTrackedSymbols((prev) => prev.filter((t) => t.id !== id));
      setSyncMsg(`Đã bỏ ${symbol} khỏi danh sách theo dõi cá nhân.`);
      setTimeout(() => setSyncMsg(''), 4000);
    } catch {
      alert('Xóa thất bại.');
    }
  };

  const handleAddTrackedFromGroup = async (symbol, groupId) => {
    if (trackedSymbolSet.has(symbol) || addingFromGroup[symbol]) {
      return;
    }

    setAddingFromGroup((prev) => ({ ...prev, [symbol]: true }));
    setSymbolError('');
    try {
      await addTrackedSymbol(symbol, groupId);
      await fetchTracked();
      setSyncMsg(`Đã đưa ${symbol} vào danh sách theo dõi cá nhân.`);
    } catch (err) {
      setSymbolError(err.response?.data?.detail || `Không thể thêm ${symbol} vào danh sách theo dõi cá nhân.`);
    } finally {
      setAddingFromGroup((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleAddAllTrackedFromGroup = async () => {
    if (!activeGroup || bulkGroupAction) {
      return;
    }

    const symbolsToAdd = activeGroup.items
      .map((item) => item.symbol)
      .filter((symbol) => !trackedSymbolSet.has(symbol));

    if (symbolsToAdd.length === 0) {
      setSyncMsg('Toàn bộ mã trong nhóm này đã có trong danh sách theo dõi cá nhân.');
      setTimeout(() => setSyncMsg(''), 4000);
      return;
    }

    setBulkGroupAction('add');
    setSymbolError('');
    try {
      await Promise.all(symbolsToAdd.map((symbol) => addTrackedSymbol(symbol, activeGroup.id)));
      await fetchTracked();
      setSyncMsg(`Đã thêm ${symbolsToAdd.length} mã từ nhóm ${activeGroup.name} vào danh sách theo dõi cá nhân.`);
    } catch (err) {
      setSymbolError(err.response?.data?.detail || 'Không thể thêm toàn bộ mã của nhóm vào danh sách theo dõi cá nhân.');
    } finally {
      setBulkGroupAction(null);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleRemoveAllTrackedFromGroup = async () => {
    if (!activeGroup || bulkGroupAction || activeGroupTrackedItems.length === 0) {
      return;
    }

    if (!window.confirm(`Bỏ ${activeGroupTrackedItems.length} mã của nhóm ${activeGroup.name} khỏi danh sách theo dõi cá nhân?`)) {
      return;
    }

    setBulkGroupAction('remove');
    setSymbolError('');
    try {
      await Promise.all(activeGroupTrackedItems.map((trackedItem) => deleteTrackedSymbol(trackedItem.id)));
      await fetchTracked();
      setSyncMsg(`Đã bỏ ${activeGroupTrackedItems.length} mã của nhóm ${activeGroup.name} khỏi danh sách theo dõi cá nhân.`);
    } catch {
      setSymbolError('Không thể bỏ toàn bộ mã đã theo dõi của nhóm khỏi danh sách theo dõi cá nhân.');
    } finally {
      setBulkGroupAction(null);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleCreatePriceAlert = async (e) => {
    e.preventDefault();
    setPriceAlertSaving(true);
    setPriceAlertError('');
    setPriceAlertMsg('');
    try {
      const payload = {
        symbol: priceAlertForm.symbol.toUpperCase().trim(),
        condition: priceAlertForm.condition,
        target_price: priceAlertForm.targetPrice,
        cooldown_seconds: Number(priceAlertForm.cooldownSeconds || 0),
        is_active: true,
      };
      await createPriceAlert(payload);
      setPriceAlertForm({ symbol: '', condition: 'ABOVE', targetPrice: '', cooldownSeconds: '300' });
      setPriceAlertMsg('Đã tạo cảnh báo giá mới.');
      await fetchPriceAlerts();
    } catch (err) {
      setPriceAlertError(err.response?.data?.detail || 'Không thể tạo cảnh báo giá.');
    } finally {
      setPriceAlertSaving(false);
      setTimeout(() => setPriceAlertMsg(''), 4000);
    }
  };

  const handleTogglePriceAlert = async (rule) => {
    try {
      const res = await updatePriceAlert(rule.id, { is_active: !rule.is_active });
      setPriceAlerts((prev) => prev.map((item) => (item.id === rule.id ? res.data : item)));
      setPriceAlertMsg(`Đã ${rule.is_active ? 'tạm dừng' : 'kích hoạt'} cảnh báo ${rule.symbol}.`);
      setTimeout(() => setPriceAlertMsg(''), 4000);
    } catch (err) {
      setPriceAlertError(err.response?.data?.detail || 'Không thể cập nhật trạng thái cảnh báo.');
    }
  };

  const handleDeletePriceAlert = async (rule) => {
    if (!window.confirm(`Xóa cảnh báo giá cho ${rule.symbol}?`)) {
      return;
    }

    try {
      await deletePriceAlert(rule.id);
      setPriceAlerts((prev) => prev.filter((item) => item.id !== rule.id));
      setPriceAlertMsg(`Đã xóa cảnh báo giá cho ${rule.symbol}.`);
      setTimeout(() => setPriceAlertMsg(''), 4000);
    } catch (err) {
      setPriceAlertError(err.response?.data?.detail || 'Không thể xóa cảnh báo giá.');
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-100">Radar thị trường</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            realtimeStatus === 'live'
              ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300'
              : realtimeStatus === 'connecting'
                ? 'border-amber-700 bg-amber-900/30 text-amber-300'
                : 'border-gray-700 bg-gray-900 text-gray-400'
          }`}>
            {REALTIME_LABELS[realtimeStatus]}
          </span>
          {lastRealtimeAt && (
            <span className="text-xs text-gray-500">
              Sự kiện gần nhất: {new Date(lastRealtimeAt).toLocaleTimeString('vi-VN')}
            </span>
          )}
          <button
            onClick={handleSyncStockProfile}
            disabled={syncingStockProfile}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncingStockProfile ? 'Đang đồng bộ...' : 'Tự động lấy mã chứng khoán'}
          </button>
          {syncMsg && <span className="text-xs text-brand-500">{syncMsg}</span>}

          {groupsWithRealtime.length === 0 && !loading && (
            <button
              onClick={handleSeed} disabled={seeding}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {seeding ? 'Đang tạo...' : 'Nạp nhóm mặc định'}
            </button>
          )}

          <button
            onClick={handleSync} disabled={syncing || groupsWithRealtime.length === 0}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors"
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Lớp 1: Nhóm thị trường</p>
          <h2 className="text-base font-semibold text-gray-100">Dùng để quét rộng toàn thị trường</h2>
          <p className="text-sm text-gray-400 mt-2">
            Mỗi nhóm tập hợp nhiều mã theo ngành, vốn hóa hoặc chủ đề để bạn nhìn breadth, so sánh tương quan và chọn ra cơ hội đáng chú ý.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-brand-300 mb-2">Lớp 2: Danh sách theo dõi cá nhân</p>
          <h2 className="text-base font-semibold text-gray-100">Các mã đang bám sát realtime</h2>
          <p className="text-sm text-gray-400 mt-2">
            Đây là tập hợp các mã bạn thật sự muốn theo dõi realtime mỗi ngày. Luồng hợp lý là quét từ nhóm thị trường rồi chọn mã đưa vào danh sách cá nhân.
          </p>
        </div>
      </div>

      {latestWhaleAlert && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-amber-300 font-semibold">Whale alert</span>
          <span className="text-gray-200 font-bold">{latestWhaleAlert.symbol}</span>
          <span className="text-gray-400">{latestWhaleAlert.side || 'N/A'}</span>
          <span className="text-gray-300 tabular-nums">
            {Number(latestWhaleAlert.matched_value || 0).toLocaleString('vi-VN')} VNĐ
          </span>
          <span className="text-xs text-gray-500">
            Ngưỡng cá nhân: {Number(userConfig?.whale_alert_threshold || latestWhaleAlert.threshold || 0).toLocaleString('vi-VN')} triệu
          </span>
        </div>
      )}

      {latestTriggeredPriceAlert && (
        <div className="bg-blue-950/40 border border-blue-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-blue-300 font-semibold">Price alert</span>
          <span className="text-gray-100 font-bold">{latestTriggeredPriceAlert.symbol}</span>
          <span className="text-gray-400">
            {latestTriggeredPriceAlert.condition === 'ABOVE' ? 'Vượt lên trên' : 'Rơi xuống dưới'}
          </span>
          <span className="text-gray-300 tabular-nums">
            Mục tiêu: {Number(latestTriggeredPriceAlert.target_price || 0).toLocaleString('vi-VN')} VNĐ
          </span>
          <span className="text-xs text-gray-500">
            Giá hiện tại: {Number(latestTriggeredPriceAlert.current_price || 0).toLocaleString('vi-VN')} VNĐ
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : groupsWithRealtime.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-300 font-semibold">Chưa có nhóm thị trường nào</p>
          <p className="text-gray-500 text-sm mt-1">
            Nhấn "Nạp nhóm mặc định" để tạo các nhóm ngành và nhóm vốn hóa từ thị trường
          </p>
          <button
            onClick={handleSeed} disabled={seeding}
            className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {seeding ? 'Đang tạo...' : 'Nạp nhóm mặc định'}
          </button>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0 space-y-0.5">
            {/* Danh sách theo dõi cá nhân */}
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
                  Danh sách theo dõi cá nhân
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 pl-[18px] text-xs">
                <span className="text-gray-600">{trackedSymbols.length} mã</span>
                {trackedStats.up > 0 && <span className="text-green-500">▲{trackedStats.up}</span>}
                {trackedStats.down > 0 && <span className="text-red-500">▼{trackedStats.down}</span>}
              </div>
            </button>

            {/* Divider + Nhóm thị trường label */}
            <div className="pt-3 pb-1 px-1">
              <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Nhóm thị trường</p>
            </div>

            {/* Group list */}
            {groupsWithRealtime.map((g) => {
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

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {view === 'tracked' ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-4 h-4 rounded-full bg-brand-500 flex-shrink-0" />
                  <h2 className="text-base font-bold text-gray-100">Danh sách theo dõi cá nhân</h2>
                  <span className="text-xs text-gray-500">Các mã bạn muốn bám sát realtime</span>
                </div>

                <form onSubmit={handleAddTracked} className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_120px] gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Mã chứng khoán
                      </label>
                      <input
                        value={addSymbol}
                        onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                        placeholder="Ví dụ: FPT"
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Nhóm nguồn
                      </label>
                      <select
                        value={srcGroupId}
                        onChange={(e) => setSrcGroupId(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      >
                        <option value="">Không gắn nhóm thị trường</option>
                        {groupsWithRealtime.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={addingSymbol}
                        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        {addingSymbol ? 'Đang thêm...' : 'Thêm mã'}
                      </button>
                    </div>
                  </div>
                  {symbolError && <p className="text-sm text-red-400 mt-3">{symbolError}</p>}
                </form>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">Cảnh báo giá cá nhân</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Đặt ngưỡng giá cho các mã cần bám sát. Feed realtime sẽ tự phát hiện khi giá chạm ngưỡng.
                      </p>
                    </div>
                    {priceAlertMsg && <span className="text-xs text-blue-300">{priceAlertMsg}</span>}
                  </div>

                  <form onSubmit={handleCreatePriceAlert} className="grid grid-cols-1 lg:grid-cols-[1fr_180px_1fr_180px_140px] gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Mã chứng khoán</label>
                      <input
                        value={priceAlertForm.symbol}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                        placeholder="Ví dụ: FPT"
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Điều kiện</label>
                      <select
                        value={priceAlertForm.condition}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, condition: e.target.value }))}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      >
                        <option value="ABOVE">Vượt lên trên</option>
                        <option value="BELOW">Rơi xuống dưới</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Giá mục tiêu</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceAlertForm.targetPrice}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, targetPrice: e.target.value }))}
                        placeholder="120000"
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Cooldown (giây)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={priceAlertForm.cooldownSeconds}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, cooldownSeconds: e.target.value }))}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={priceAlertSaving}
                        className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        {priceAlertSaving ? 'Đang tạo...' : 'Thêm alert'}
                      </button>
                    </div>
                  </form>

                  {priceAlertError && <p className="text-sm text-red-400">{priceAlertError}</p>}

                  {triggeredPriceAlerts.length > 0 && (
                    <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 px-4 py-3">
                      <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Trigger gần đây</p>
                      <div className="space-y-2 text-sm">
                        {triggeredPriceAlerts.map((alert) => (
                          <div key={`${alert.id}-${alert.triggered_at}`} className="flex flex-wrap items-center gap-3 text-gray-300">
                            <span className="font-semibold text-gray-100">{alert.symbol}</span>
                            <span>{alert.condition === 'ABOVE' ? 'vượt lên trên' : 'rơi xuống dưới'}</span>
                            <span className="tabular-nums">{Number(alert.target_price).toLocaleString('vi-VN')} VNĐ</span>
                            <span className="text-xs text-gray-500">{formatDateTime(alert.triggered_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
                    {priceAlertsLoading ? (
                      <div className="py-8 text-center text-gray-500 text-sm">Đang tải cảnh báo giá...</div>
                    ) : priceAlertsWithRealtime.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 text-sm">Chưa có cảnh báo giá nào.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Mã</th>
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Điều kiện</th>
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Mục tiêu</th>
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Giá hiện tại</th>
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Trạng thái</th>
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Cooldown</th>
                            <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Trigger gần nhất</th>
                            <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tác vụ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                          {priceAlertsWithRealtime.map((rule) => (
                            <tr key={rule.id} className="hover:bg-gray-900/40 transition-colors">
                              <td className="px-4 py-3 font-bold text-blue-300">{rule.symbol}</td>
                              <td className="px-4 py-3 text-gray-300">{PRICE_ALERT_CONDITION_LABELS[rule.condition]}</td>
                              <td className="px-4 py-3 text-gray-300 tabular-nums">{Number(rule.target_price).toLocaleString('vi-VN')} VNĐ</td>
                              <td className="px-4 py-3 text-gray-300 tabular-nums">
                                {rule.current_price ? `${Number(rule.current_price).toLocaleString('vi-VN')} VNĐ` : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  !rule.is_active
                                    ? 'bg-gray-800 text-gray-400'
                                    : isPriceAlertMatched(rule, rule.current_price) && !rule.stale
                                      ? 'bg-blue-900/40 text-blue-300'
                                      : 'bg-emerald-900/30 text-emerald-300'
                                }`}>
                                  {!rule.is_active ? 'Tạm dừng' : isPriceAlertMatched(rule, rule.current_price) && !rule.stale ? 'Đang chạm ngưỡng' : 'Đang theo dõi'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-400">{rule.cooldown_seconds}s</td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(rule.last_triggered_at)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    onClick={() => handleTogglePriceAlert(rule)}
                                    className="text-xs text-gray-300 hover:text-gray-100 font-semibold"
                                  >
                                    {rule.is_active ? 'Tạm dừng' : 'Kích hoạt'}
                                  </button>
                                  <button
                                    onClick={() => handleDeletePriceAlert(rule)}
                                    className="text-xs text-red-400 hover:text-red-300 font-semibold"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {trackedLoading ? (
                    <div className="py-10 text-center text-gray-500 text-sm">Đang tải danh sách theo dõi cá nhân...</div>
                  ) : trackedSymbolsWithRealtime.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">Chưa có mã nào trong danh sách theo dõi cá nhân.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Mã</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Nhóm thị trường nguồn</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Giá</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Thay đổi</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">% thay đổi</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Cập nhật</th>
                          <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tác vụ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {trackedSymbolsWithRealtime.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => openStockWorkspace(item.symbol)}
                                className="font-bold text-sm px-2 py-0.5 rounded bg-brand-900/40 text-brand-300 hover:text-brand-200 transition-colors"
                              >
                                {item.symbol}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {item.source_group_name || 'Tự thêm thủ công'}
                            </td>
                            <td className="px-4 py-3">{formatPrice(item.current_price)}</td>
                            <td className="px-4 py-3"><ChangeCell value={item.change_value} /></td>
                            <td className="px-4 py-3"><PctCell pct={item.change_pct} /></td>
                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                              {item.last_date || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => openStockWorkspace(item.symbol)}
                                  className="text-xs text-blue-300 hover:text-blue-200 font-semibold"
                                >
                                  Mở workspace
                                </button>
                                <button
                                  onClick={() => handleDeleteTracked(item.id, item.symbol)}
                                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                                >
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : activeGroup ? (
              // Group detail table
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
                    Nhóm thị trường · {TYPE_LABELS[activeGroup.group_type]}
                  </span>
                </div>

                {groupStats && activeGroup.items.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
                    <span className="text-gray-500">{activeGroup.items.length} mã</span>
                    <span className="text-green-400">▲ Tăng: {groupStats.up}</span>
                    <span className="text-red-400">▼ Giảm: {groupStats.down}</span>
                    <span className="text-gray-500">— Không đổi: {groupStats.flat}</span>
                    <span className="text-brand-300">Chưa theo dõi: {activeGroupUntrackedCount}</span>
                  </div>
                )}

                {activeGroup.items.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 bg-gray-900/70 border border-gray-800 rounded-lg p-1">
                      {[
                        { key: 'all', label: `Tất cả (${activeGroupItems.length})` },
                        { key: 'untracked', label: `Chưa theo dõi (${activeGroupUntrackedCount})` },
                        { key: 'tracked', label: `Đã theo dõi (${activeGroupTrackedCount})` },
                      ].map((option) => (
                        <button
                          key={option.key}
                          onClick={() => setGroupTrackedFilter(option.key)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            groupTrackedFilter === option.key
                              ? 'bg-blue-700 text-white'
                              : 'text-gray-400 hover:text-gray-100'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleRemoveAllTrackedFromGroup}
                        disabled={!!bulkGroupAction || activeGroupTrackedCount === 0}
                        className="text-sm font-semibold px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-100 transition-colors"
                      >
                        {bulkGroupAction === 'remove' ? 'Đang bỏ cả nhóm...' : 'Bỏ toàn bộ mã đã theo dõi'}
                      </button>
                      <button
                        onClick={handleAddAllTrackedFromGroup}
                        disabled={!!bulkGroupAction || activeGroupUntrackedCount === 0}
                        className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition-colors"
                      >
                        {bulkGroupAction === 'add' ? 'Đang thêm cả nhóm...' : 'Đưa tất cả vào DS theo dõi'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {filteredActiveGroupItems.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">
                      Không có mã nào khớp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            Mã Chứng khoán
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            Giá đóng cửa
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            Thay đổi
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            % thay đổi
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            Ngày
                          </th>
                          <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            Tác vụ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {filteredActiveGroupItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                            onClick={() => openStockWorkspace(item.symbol)}
                          >
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
                            <td className="px-4 py-3 text-right">
                              {trackedSymbolSet.has(item.symbol) ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-900/30 text-brand-300">
                                    Đã theo dõi
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const trackedItem = trackedSymbolMap.get(item.symbol);
                                      if (trackedItem) {
                                        handleDeleteTracked(trackedItem.id, item.symbol);
                                      }
                                    }}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
                                  >
                                    Bỏ khỏi DS theo dõi
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddTrackedFromGroup(item.symbol, activeGroup.id);
                                  }}
                                  disabled={!!addingFromGroup[item.symbol]}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white transition-colors"
                                >
                                  {addingFromGroup[item.symbol] ? 'Đang thêm...' : 'Đưa vào DS theo dõi'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
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

