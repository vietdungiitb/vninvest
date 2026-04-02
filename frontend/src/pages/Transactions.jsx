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
} from '../api/client';
import { formatVND } from '../components/StatCard';

const ALL_TAB = '__all__';

// Biểu phí chuẩn thị trường Việt Nam
// Phí môi giới: tuỳ CTCK; Phí VSD: 0.03% (cố định); Thuế TNCN (BÁN): 0.1%
const FEE_PRESETS = [
  { label: 'VPS / SSI / MBS (0.15%)', brokerage: 0.0015 },
  { label: 'HSC / VCSC (0.20%)', brokerage: 0.002 },
  { label: 'CTCK khác (0.25%)', brokerage: 0.0025 },
  { label: 'Nhập tay', brokerage: null },
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

const TYPE_LABELS = { BUY: 'Mua', SELL: 'Bán', DIVIDEND: 'Cổ tức' };
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

  // ---------- Load sub-accounts ----------
  const fetchSubAccounts = useCallback(async () => {
    if (!activePortfolioId) { setSubAccounts([]); return; }
    try {
      const res = await getSubAccounts();
      const filtered = res.data.filter((sa) => sa.portfolio === activePortfolioId);
      setSubAccounts(filtered);
    } catch (err) {
      console.error('Load subaccounts failed:', err);
      setSubAccounts([]);
    }
  }, [activePortfolioId]);

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
    const payload = {
      symbol: form.symbol,
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
      setError(data ? JSON.stringify(data) : 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xác nhận xoá giao dịch này?')) return;
    try {
      await deleteTransaction(id);
      fetchTx();
    } catch {
      alert('Xoá thất bại.');
    }
  };

  // ---------- Early returns ----------
  if (!activePortfolioId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Chưa có danh mục nào.
      </div>
    );
  }

  if (subAccounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Danh mục này chưa có tiểu khoản. Hãy tạo hoặc seed dữ liệu demo trước.
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
          <h1 className="text-xl font-bold text-gray-100">Lịch sử giao dịch</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {displayTx.length} giao dịch
            {activeSaName ? ` · ${activeSaName}` : ' · Tất cả tiểu khoản'}
          </p>
        </div>
        <button
          onClick={showForm ? cancelForm : openCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? (editId ? 'Huỷ chỉnh sửa' : 'Huỷ') : '+ Thêm giao dịch'}
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
          Tất cả
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
                  <span className="text-emerald-400">{buyCount} Mua</span>
                  {' · '}
                  <span className="text-red-400">{sellCount} Bán</span>
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
            {editId ? '✏️ Chỉnh sửa giao dịch' : '+ Thêm giao dịch mới'}
          </h2>

          {/* Tiểu khoản */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Tiểu khoản</label>
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
            <label className="block text-xs text-gray-400 mb-1.5">Loại lệnh</label>
            <select
              name="transaction_type"
              value={form.transaction_type}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="BUY">Mua</option>
              <option value="SELL">Bán</option>
              <option value="DIVIDEND">Cổ tức tiền mặt</option>
            </select>
          </div>

          {/* Mã CK, Ngày */}
          {[
            { name: 'symbol', label: 'Mã CK', type: 'text', placeholder: 'VNM' },
            { name: 'date', label: 'Ngày', type: 'date' },
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
            <label className="block text-xs text-gray-400 mb-1.5">Giá (VNĐ)</label>
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
            <label className="block text-xs text-gray-400 mb-1.5">Khối lượng</label>
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
                GT giao dịch: <span className="text-gray-300 font-semibold">{(parseFloat(form.price) * parseFloat(form.quantity)).toLocaleString('vi-VN')} đ</span>
              </p>
            )}
          </div>

          {/* Phí môi giới — preset + auto-calc */}
          <div className="col-span-2 md:col-span-3 bg-gray-800/40 rounded-xl border border-gray-700/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className="text-xs font-semibold text-gray-300">Phí giao dịch</span>
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
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            {feeBreakdown && (
              <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
                <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Phí môi giới</div>
                  <div className="text-gray-200 font-semibold mt-0.5">{Math.round(feeBreakdown.brokerageFee).toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Phí VSD (0.03%)</div>
                  <div className="text-gray-200 font-semibold mt-0.5">{Math.round(feeBreakdown.vsdFee).toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-gray-500">
                    Thuế TNCN {form.transaction_type === 'SELL' ? '(0.1%)' : '(chỉ BÁN)'}
                  </div>
                  <div className={`font-semibold mt-0.5 ${form.transaction_type === 'SELL' ? 'text-red-300' : 'text-gray-600'}`}>
                    {Math.round(feeBreakdown.taxFee).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1.5">
                  Tổng phí (VNĐ)
                  {feeBreakdown && !feeAutoManual && (
                    <span className="ml-2 text-brand-400 text-[10px]">✓ Tự động</span>
                  )}
                  {feeAutoManual && (
                    <span className="ml-2 text-amber-400 text-[10px]">
                      ✎ Nhập tay
                      <button
                        type="button"
                        onClick={() => handleFeePresetChange(feePresetIdx)}
                        className="ml-1.5 underline hover:text-amber-300"
                        disabled={!FEE_PRESETS[feePresetIdx]?.brokerage}
                      >
                        reset
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
            <label className="block text-xs text-gray-400 mb-1.5">Ghi chú</label>
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
              Huỷ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Lưu giao dịch'}
            </button>
          </div>
        </form>
      )}

      {/* ---- Bảng giao dịch ---- */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : displayTx.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chưa có giao dịch nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Ngày</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Mã CK</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Loại</th>
                  {activeTab === ALL_TAB && (
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tiểu khoản</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Giá</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">KL</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Phí</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tổng giá trị</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tác vụ</th>
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
                        {TYPE_LABELS[tx.transaction_type]}
                      </span>
                    </td>
                    {activeTab === ALL_TAB && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${saColorMap[tx._sa_id] || 'bg-gray-800 text-gray-400'}`}>
                          {tx._sa_name}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-200 tabular-nums text-right whitespace-nowrap">{formatVND(tx.price)}</td>
                    <td className="px-4 py-3 text-gray-200 tabular-nums text-right">{parseFloat(tx.quantity).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums text-right">{formatVND(tx.fee)}</td>
                    <td className="px-4 py-3 text-gray-200 tabular-nums text-right whitespace-nowrap">{formatVND(tx.total_value)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(tx)}
                        className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors mr-3"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
                      >
                        Xóa
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

