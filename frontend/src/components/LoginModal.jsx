/**
 * components/LoginModal.jsx
 * Form đăng nhập JWT Auth.
 */
import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

export default function LoginModal({ onSuccess }) {
  const { login } = usePortfolio();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Đăng nhập thất bại. Username/password: testuser/Test@123456');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-brand-500 mb-1">VNInvest</h1>
        <p className="text-gray-400 text-sm mb-6">Đăng nhập để tiếp tục</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Tên đăng nhập</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                         text-sm text-gray-100 placeholder-gray-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="testuser"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Mật khẩu</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                         text-sm text-gray-100
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Test@123456"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50
                       text-white font-semibold py-2 rounded-md text-sm transition-colors"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

