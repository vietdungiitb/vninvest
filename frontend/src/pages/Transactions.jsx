/**
 * pages/Transactions.jsx
 * Danh sách giao dịch + form thêm giao dịch mới.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { getSubAccounts, getTransactions, createTransaction, deleteTransaction } from '../api/client';
import { formatVND } from '../components/StatCard';

const EMPTY_FORM = {
  symbol: '',
  transaction_type: 'BUY',
  date: new Date().toISOString().slice(0, 10),
  price: '',
  quantity: '',
  fee: '0',
  notes: '',
};

const TYPE_LABELS = { BUY: 'Mua', SELL: 'Bán', DIVIDEND: 'Cổ tức' };
const TYPE_COLORS = {
  BUY: 'text-brand-500',
  SELL: 'text-red-400',
  DIVIDEND: 'text-yellow-400',
};

export default function Transactions() {

  const { activePortfolioId } = usePortfolio();
  const [subAccounts, setSubAccounts] = useState([]);
  const [subAccountId, setSubAccountId] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchSubAccounts = useCallback(async () => {
    if (!activePortfolioId) {
      setSubAccounts([]);
      setSubAccountId('');
      return;
    }

    try {
      const res = await getSubAccounts();
      const filtered = res.data.filter((subAccount) => subAccount.portfolio === activePortfolioId);
      setSubAccounts(filtered);
      setSubAccountId((prev) => {
        if (prev && filtered.some((subAccount) => String(subAccount.id) === String(prev))) {
          return prev;
        }
        return filtered[0] ? String(filtered[0].id) : '';
      });
    } catch (err) {
      console.error('Load subaccounts failed:', err);
      setSubAccounts([]);
      setSubAccountId('');
    }
  }, [activePortfolioId]);

  const fetchTx = useCallback(async () => {
    if (!subAccountId) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getTransactions(subAccountId);
      setTransactions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [subAccountId]);

  useEffect(() => {
    fetchSubAccounts();
  }, [fetchSubAccounts]);

  useEffect(() => {
    fetchTx();
  }, [fetchTx]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'symbol' ? value.toUpperCase() : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createTransaction(subAccountId, {
        ...form,
        price: parseFloat(form.price),
        quantity: parseFloat(form.quantity),
        fee: parseFloat(form.fee || 0),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
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

  if (!activePortfolioId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Chưa có danh mục nào.
      </div>
    );
  }

  if (subAccounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Danh mục này chưa có tiểu khoản. Hãy tạo hoặc seed dữ liệu demo trước.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Lịch sử giao dịch</h1>
        <div className="flex items-center gap-3">
          <select
            value={subAccountId}
            onChange={(e) => setSubAccountId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
          >
            {subAccounts.map((subAccount) => (
              <option key={subAccount.id} value={subAccount.id}>
                {subAccount.name}
              </option>
            ))}
          </select>
        <button
          onClick={() => { setShowForm((v) => !v); setError(''); }}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold
                     px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? 'Huỷ' : '+ Thêm giao dịch'}
        </button>
        </div>
      </div>

      {/* Form thêm giao dịch */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4"
        >
          {[
            { name: 'symbol', label: 'Mã CK', type: 'text', placeholder: 'VNM' },
            { name: 'date', label: 'Ngày', type: 'date' },
            { name: 'price', label: 'Giá (VNĐ)', type: 'number', placeholder: '50000' },
            { name: 'quantity', label: 'Khối lượng', type: 'number', placeholder: '100' },
            { name: 'fee', label: 'Phí (VNĐ)', type: 'number', placeholder: '0' },
          ].map(({ name, label, type, placeholder }) => (
            <div key={name}>
              <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                required={name !== 'fee'}
                min={type === 'number' ? '0' : undefined}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                           text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Loại lệnh</label>
            <select
              name="transaction_type"
              value={form.transaction_type}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                         text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="BUY">Mua</option>
              <option value="SELL">Bán</option>
              <option value="DIVIDEND">Cổ tức tiền mặt</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs text-gray-400 mb-1.5">Ghi chú</label>
            <input
              type="text"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                         text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="col-span-2 md:col-span-3 text-red-400 text-xs bg-red-900/20 rounded-md p-2">
              {error}
            </div>
          )}

          <div className="col-span-2 md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white
                         font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Đang lưu...' : 'Lưu giao dịch'}
            </button>
          </div>
        </form>
      )}

      {/* Bảng giao dịch */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chưa có giao dịch nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Ngày</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Mã CK</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Loại lệnh</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Giá</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Khối lượng</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Phí</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tổng giá trị</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{tx.date}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/stocks/${tx.symbol}`}
                      className="font-bold text-sm px-2 py-0.5 rounded bg-brand-900/40 text-brand-300 hover:text-brand-200 transition-colors"
                    >
                      {tx.symbol}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${TYPE_COLORS[tx.transaction_type]}`}>
                    {TYPE_LABELS[tx.transaction_type]}
                  </td>
                  <td className="px-4 py-3 text-gray-200 tabular-nums whitespace-nowrap">{formatVND(tx.price)}</td>
                  <td className="px-4 py-3 text-gray-200 tabular-nums">{parseFloat(tx.quantity).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-gray-400 tabular-nums">{formatVND(tx.fee)}</td>
                  <td className="px-4 py-3 text-gray-200 tabular-nums whitespace-nowrap">{formatVND(tx.total_value)}</td>
                  <td className="px-4 py-3 text-right">
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
        )}
      </div>
    </div>
  );
}
