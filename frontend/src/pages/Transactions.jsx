/**
 * pages/Transactions.jsx
 * Quản lý giao dịch: thêm, sửa, xóa, phân loại theo tiểu khoản.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import {
  getSubAccounts,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getStockProfile,
} from '../api/client';
import { formatVND } from '../components/StatCard';
import { useI18n } from '../context/LangContext';

const ALL_TAB = '__all__';

// Biểu phí chuẩn thị trường Việt Nam
// Phí môi giới: tuỳ CTCK; Phí VSD: 0.03% (cố định); Thuế TNCN (BÁN): 0.1%
const FEE_PRESET_KEYS = ['vps', 'hsc', 'other', 'manual'];
const FEE_PRESETS = [
  { key: 'vps', brokerage: 0.0015 },
  { key: 'hsc', brokerage: 0.002 },
  { key: 'other', brokerage: 0.0025 },
  { key: 'manual', brokerage: null },
];
const VSD_RATE = 0.0003;      // 0.03% — phí VSD cố định
const TAX_SELL_RATE = 0.001;  // 0.1%  — thuế TNCN chỉ khi BÁN
const MIN_FEE = 10_000;       // 10,000 VNĐ phí tối thiểu

function calcFee(price, quantity, txType, brokerageRate) {
  const priceParsed = parseFloat(price);
  const qtyParsed = parseFloat(quantity);
  if (!brokerageRate || !priceParsed || !qtyParsed || priceParsed <= 0 || qtyParsed <= 0) return null;
  const txValue = priceParsed * qtyParsed;
  const brokerageFee = Math.max(MIN_FEE, txValue * brokerageRate);
  const vsdFee = txValue * VSD_RATE;
  const taxFee = txType === 'SELL' ? txValue * TAX_SELL_RATE : 0;
  return { brokerageFee, vsdFee, taxFee, total: Math.round(brokerageFee + vsdFee + taxFee) };
}

const EMPTY_FORM = {
  sub_account_id: '',
  symbol: '',
  transaction_type: 'BUY',
  date: new Date().toISOString().slice(0, 10),
  price: '',
  quantity: '',
  fee: '0',
  notes: '',
};

const TYPE_BG = {
  BUY: 'bg-emerald-950/40 text-emerald-300',
  SELL: 'bg-red-950/40 text-red-300',
  DIVIDEND: 'bg-yellow-950/40 text-yellow-300',
};
const SA_COLORS = [
  'bg-brand-900/50 text-brand-300',
  'bg-purple-900/50 text-purple-300',
  'bg-amber-900/50 text-amber-300',
  'bg-teal-900/50 text-teal-300',
  'bg-pink-900/50 text-pink-300',
];

export default function Transactions() {
  const { activePortfolioId } = usePortfolio();
  const { t, locale, formatNumber } = useI18n();
  const [subAccounts, setSubAccounts] = useState([]);
  const [activeTab, setActiveTab] = useState(ALL_TAB); // sub_account id hoặc ALL_TAB
  const [txBySubAccount, setTxBySubAccount] = useState({}); // { subAccountId: [...txs] }
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null); // null = tạo mới
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feePresetIdx, setFeePresetIdx] = useState(0); // index vào FEE_PRESETS
  const [feeAutoManual, setFeeAutoManual] = useState(false); // true = user đã tự nhập phí

  const feePresetLabels = useMemo(() => {
    return FEE_PRESET_KEYS.reduce((acc, key) => {
      acc[key] = t(`transactions.feePresets.${key}`);
      return acc;
    }, {});
  }, [t]);

  const typeLabels = useMemo(() => ({
    BUY: t('transactions.buy'),
    SELL: t('transactions.sell'),
    DIVIDEND: t('transactions.dividend'),
  }), [t]);

  // ---------- Load sub-accounts ----------
  const fetchSubAccounts = useCallback(async () => {
    if (!activePortfolioId) { setSubAccounts([]); return; }
    try {
      const res = await getSubAccounts();
      const filtered = res.data.filter((sa) => sa.portfolio === activePortfolioId);
      setSubAccounts(filtered);
    } catch (err) {
      console.error('Load subaccounts failed:', err);
      setError(t('transactions.loadSubAccountsFailed'));
      setSubAccounts([]);
    }
  }, [activePortfolioId, t]);

  // ---------- Load giao dịch ----------
  const fetchTx = useCallback(async () => {
    if (!subAccounts.length) { setTxBySubAccount({}); return; }
    setLoading(true);
    try {
      const targets =
        activeTab === ALL_TAB
          ? subAccounts
          : subAccounts.filter((sa) => String(sa.id) === activeTab);
      const results = await Promise.all(
        targets.map((sa) =>
          getTransactions(sa.id).then((res) => ({ id: sa.id, txs: res.data }))
        )
      );
      const map = {};
      results.forEach(({ id, txs }) => { map[id] = txs; });
      setTxBySubAccount(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [subAccounts, activeTab]);

  useEffect(() => { fetchSubAccounts(); }, [fetchSubAccounts]);
  useEffect(() => { fetchTx(); }, [fetchTx]);

  // Refresh when user comes back to the page after creating/updating accounts elsewhere.
  useEffect(() => {
    const handleRefresh = () => {
      fetchSubAccounts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSubAccounts();
      }
    };

    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchSubAccounts]);

  // ---------- Flat list để hiển thị ----------
  const displayTx = useMemo(() => {
    const list =
      activeTab === ALL_TAB
        ? subAccounts.flatMap((sa) =>
            (txBySubAccount[sa.id] || []).map((tx) => ({
              ...tx,
              _sa_name: sa.name,
              _sa_id: sa.id,
            }))
          )
        : (txBySubAccount[activeTab] || []).map((tx) => {
            const sa = subAccounts.find((s) => String(s.id) === activeTab);
            return { ...tx, _sa_name: sa?.name, _sa_id: sa?.id };
          });
    return list.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [txBySubAccount, subAccounts, activeTab]);

  const saColorMap = useMemo(() => {
    const map = {};
    subAccounts.forEach((sa, i) => { map[sa.id] = SA_COLORS[i % SA_COLORS.length]; });
    return map;
  }, [subAccounts]);

  // ---------- Fee auto-calc ----------
  const feeBreakdown = useMemo(() => {
    const preset = FEE_PRESETS[feePresetIdx];
    if (!preset?.brokerage || feeAutoManual) return null;
    return calcFee(form.price, form.quantity, form.transaction_type, preset.brokerage);
  }, [form.price, form.quantity, form.transaction_type, feePresetIdx, feeAutoManual]);

  // Auto-fill fee field khi feeBreakdown thay đổi
  useEffect(() => {
    if (!feeAutoManual && feeBreakdown) {
      setForm((prev) => ({ ...prev, fee: String(feeBreakdown.total) }));
    }
  }, [feeBreakdown, feeAutoManual]);

  // ---------- Handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'fee') {
      // User đang tự nhập phí => tắt auto
      setFeeAutoManual(true);
    }
    if (name === 'price' || name === 'quantity' || name === 'transaction_type') {
      // Khi giá/KL/loại thay đổi, nếu preset đang bật thì reset về auto
      if (FEE_PRESETS[feePresetIdx]?.brokerage) setFeeAutoManual(false);
    }
    setForm((prev) => ({ ...prev, [name]: name === 'symbol' ? value.toUpperCase() : value }));
  };

  const handleFeePresetChange = (idx) => {
    setFeePresetIdx(idx);
    const preset = FEE_PRESETS[idx];
    if (preset.brokerage) {
      setFeeAutoManual(false);
    } else {
      // preset "Nhập tay" => bật manual
      setFeeAutoManual(true);
    }
  };

  const openCreate = () => {
    const defaultSa =
      activeTab !== ALL_TAB ? activeTab : subAccounts[0] ? String(subAccounts[0].id) : '';
    setForm({ ...EMPTY_FORM, sub_account_id: defaultSa });
    setEditId(null);
    setError('');
    setFeePresetIdx(0);
    setFeeAutoManual(false);
    setShowForm(true);
  };

  const openEdit = (tx) => {
    setForm({
      sub_account_id: String(tx._sa_id),
      symbol: tx.symbol,
      transaction_type: tx.transaction_type,
      date: tx.date,
      price: String(tx.price),
      quantity: String(tx.quantity),
      fee: String(tx.fee ?? 0),
      notes: tx.notes || '',
    });
    setEditId(tx.id);
    setError('');
    setFeePresetIdx(3); // Nhập tay khi sửa
    setFeeAutoManual(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const normalizedSymbol = (form.symbol || '').trim().toUpperCase();

    try {
      await getStockProfile(normalizedSymbol);
    } catch (err) {
      if (err.response?.status === 404) {
        setError(t('transactions.stockNotFound'));
      } else {
        setError(t('transactions.stockVerifyFailed'));
      }
      setSubmitting(false);
      return;
    }

    const payload = {
      symbol: normalizedSymbol,
      transaction_type: form.transaction_type,
      date: form.date,
      price: parseFloat(form.price),
      quantity: parseFloat(form.quantity),
      fee: parseFloat(form.fee || 0),
      notes: form.notes,
    };
    try {
      if (editId) {
        await updateTransaction(editId, payload);
      } else {
        await createTransaction(form.sub_account_id, payload);
      }
      cancelForm();
      fetchTx();
    } catch (err) {
      const data = err.response?.data;
      setError(data ? JSON.stringify(data) : t('transactions.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('transactions.deleteConfirm'))) return;
    try {
      await deleteTransaction(id);
      fetchTx();
    } catch {
      alert(t('transactions.deleteFailed'));
    }
  };

  // ---------- Early returns ----------
  if (!activePortfolioId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
        <div className="text-4xl">📁</div>
        <div>
          <p className="text-gray-300 font-semibold mb-1">{t('transactions.emptyNoPortfolioTitle')}</p>
          <p className="text-sm text-gray-500">{t('transactions.emptyNoPortfolioDescription')}</p>
        </div>
        <Link
          to="/portfolios"
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {t('transactions.emptyNoPortfolioCta')}
        </Link>
      </div>
    );
  }

  if (subAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
        <div className="text-4xl">🏦</div>
        <div>
          <p className="text-gray-300 font-semibold mb-1">{t('transactions.emptyNoSubAccountTitle')}</p>
          <p className="text-sm text-gray-500">{t('transactions.emptyNoSubAccountDescription')}</p>
        </div>
        <Link
          to="/portfolios"
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {t('transactions.emptyNoSubAccountCta')}
        </Link>
      </div>
    );
  }

  const activeSaName =
    activeTab !== ALL_TAB
      ? subAccounts.find((sa) => String(sa.id) === activeTab)?.name
      : null;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* ---- Header ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{t('transactions.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('transactions.count', { count: formatNumber(displayTx.length) })}
            {activeSaName ? ` · ${activeSaName}` : ` · ${t('transactions.allSubAccounts')}`}
          </p>
        </div>
        <button
          onClick={showForm ? cancelForm : openCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? (editId ? t('transactions.cancelEdit') : t('transactions.cancel')) : t('transactions.add')}
        </button>
      </div>

      {/* ---- Sub-account tabs ---- */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab(ALL_TAB)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            activeTab === ALL_TAB
              ? 'border-brand-500 bg-brand-950/60 text-brand-300'
              : 'border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          {t('transactions.all')}
          <span className="ml-1.5 opacity-60">{displayTx.length}</span>
        </button>
        {subAccounts.map((sa, i) => {
          const count = (txBySubAccount[sa.id] || []).length;
          return (
            <button
              key={sa.id}
              onClick={() => setActiveTab(String(sa.id))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                activeTab === String(sa.id)
                  ? 'border-brand-500 bg-brand-950/60 text-brand-300'
                  : 'border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {sa.name}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ---- Summary cards khi xem tất cả (nhiều hơn 1 tiểu khoản) ---- */}
      {activeTab === ALL_TAB && subAccounts.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {subAccounts.map((sa, i) => {
            const txs = txBySubAccount[sa.id] || [];
            const buyCount = txs.filter((t) => t.transaction_type === 'BUY').length;
            const sellCount = txs.filter((t) => t.transaction_type === 'SELL').length;
            return (
              <button
                key={sa.id}
                onClick={() => setActiveTab(String(sa.id))}
                className="text-left rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 hover:border-brand-700 transition-colors"
              >
                <div className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full inline-block mb-1 ${SA_COLORS[i % SA_COLORS.length]}`}>
                  {sa.name}
                </div>
                <div className="text-2xl font-bold text-gray-100">{txs.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className="text-emerald-400">{buyCount} {t('transactions.buy')}</span>
                  {' · '}
                  <span className="text-red-400">{sellCount} {t('transactions.sell')}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Form thêm / sửa ---- */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4"
        >
          <h2 className="col-span-2 md:col-span-3 text-sm font-semibold text-gray-200 mb-0">
            {editId ? `✏️ ${t('transactions.editTransaction')}` : t('transactions.addTransaction')}
          </h2>

          {/* Tiểu khoản */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{t('transactions.subAccount')}</label>
            <select
              name="sub_account_id"
              value={form.sub_account_id}
              onChange={handleChange}
              disabled={!!editId}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            >
              {subAccounts.map((sa) => (
                <option key={sa.id} value={String(sa.id)}>{sa.name}</option>
              ))}
            </select>
          </div>

          {/* Loại lệnh */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{t('transactions.orderType')}</label>
            <select
              name="transaction_type"
              value={form.transaction_type}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="BUY">{t('transactions.buy')}</option>
              <option value="SELL">{t('transactions.sell')}</option>
              <option value="DIVIDEND">{t('transactions.cashDividend')}</option>
            </select>
          </div>

          {/* Mã CK, Ngày */}
          {[
            { name: 'symbol', label: t('transactions.symbol'), type: 'text', placeholder: 'VNM' },
            { name: 'date', label: t('transactions.date'), type: 'date' },
          ].map(({ name, label, type, placeholder }) => (
            <div key={name}>
              <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}

          {/* Giá */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{t('transactions.price')}</label>
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="50000"
              required
              min="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Khối lượng */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{t('transactions.quantity')}</label>
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              placeholder="100"
              required
              min="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {form.price && form.quantity && (
              <p className="text-[10px] text-gray-500 mt-1">
                {t('transactions.transactionValue')}: <span className="text-gray-300 font-semibold">{formatNumber(parseFloat(form.price) * parseFloat(form.quantity))} đ</span>
              </p>
            )}
          </div>

          {/* Phí môi giới — preset + auto-calc */}
          <div className="col-span-2 md:col-span-3 bg-gray-800/40 rounded-xl border border-gray-700/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className="text-xs font-semibold text-gray-300">{t('transactions.fees')}</span>
              <div className="flex flex-wrap gap-1.5">
                {FEE_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleFeePresetChange(i)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                      feePresetIdx === i
                        ? 'border-brand-500 bg-brand-950/60 text-brand-300'
                        : 'border-gray-700 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {feePresetLabels[p.key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            {feeBreakdown && (
              <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
                <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-gray-500">{t('transactions.brokerageFee')}</div>
                  <div className="text-gray-200 font-semibold mt-0.5">{formatNumber(Math.round(feeBreakdown.brokerageFee))} đ</div>
                </div>
                <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-gray-500">{t('transactions.vsdFee')}</div>
                  <div className="text-gray-200 font-semibold mt-0.5">{formatNumber(Math.round(feeBreakdown.vsdFee))} đ</div>
                </div>
                <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-gray-500">
                    {form.transaction_type === 'SELL' ? t('transactions.personalIncomeTaxSell') : t('transactions.personalIncomeTaxSellOnly')}
                  </div>
                  <div className={`font-semibold mt-0.5 ${form.transaction_type === 'SELL' ? 'text-red-300' : 'text-gray-600'}`}>
                    {formatNumber(Math.round(feeBreakdown.taxFee))} đ
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1.5">
                  {t('transactions.totalFee')}
                  {feeBreakdown && !feeAutoManual && (
                    <span className="ml-2 text-brand-400 text-[10px]">✓ {t('transactions.autoFee')}</span>
                  )}
                  {feeAutoManual && (
                    <span className="ml-2 text-amber-400 text-[10px]">
                      ✎ {t('transactions.manualFee')}
                      <button
                        type="button"
                        onClick={() => handleFeePresetChange(feePresetIdx)}
                        className="ml-1.5 underline hover:text-amber-300"
                        disabled={!FEE_PRESETS[feePresetIdx]?.brokerage}
                      >
                        {t('transactions.reset')}
                      </button>
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  name="fee"
                  value={form.fee}
                  onChange={handleChange}
                  min="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs text-gray-400 mb-1.5">{t('transactions.notes')}</label>
            <input
              type="text"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="col-span-2 md:col-span-3 text-red-400 text-xs bg-red-900/20 rounded-md p-2">
              {error}
            </div>
          )}

          <div className="col-span-2 md:col-span-3 flex items-center justify-between">
            <button
              type="button"
              onClick={cancelForm}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              {t('transactions.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
            >
              {submitting ? t('transactions.saving') : editId ? t('transactions.updateTransaction') : t('transactions.saveTransaction')}
            </button>
          </div>
        </form>
      )}

      {/* ---- Bảng giao dịch ---- */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">{t('transactions.loading')}</div>
        ) : displayTx.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('transactions.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.date')}</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.symbol')}</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.type')}</th>
                  {activeTab === ALL_TAB && (
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.subAccount')}</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.price')}</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.quantity')}</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.fee')}</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.totalValue')}</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('transactions.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {displayTx.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-gray-800/50 transition-colors ${editId === tx.id ? 'bg-brand-950/20 ring-1 ring-inset ring-brand-800/40' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/stocks/${tx.symbol}`}
                        className="font-bold text-sm px-2 py-0.5 rounded bg-brand-900/40 text-brand-300 hover:text-brand-200 transition-colors"
                      >
                        {tx.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${TYPE_BG[tx.transaction_type]}`}>
                        {typeLabels[tx.transaction_type]}
                      </span>
                    </td>
                    {activeTab === ALL_TAB && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${saColorMap[tx._sa_id] || 'bg-gray-800 text-gray-400'}`}>
                          {tx._sa_name}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-200 tabular-nums text-right whitespace-nowrap">{formatVND(tx.price, locale)}</td>
                    <td className="px-4 py-3 text-gray-200 tabular-nums text-right">{formatNumber(tx.quantity)}</td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums text-right">{formatVND(tx.fee, locale)}</td>
                    <td className="px-4 py-3 text-gray-200 tabular-nums text-right whitespace-nowrap">{formatVND(tx.total_value, locale)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(tx)}
                        className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors mr-3"
                      >
                        {t('transactions.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
                      >
                        {t('transactions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

