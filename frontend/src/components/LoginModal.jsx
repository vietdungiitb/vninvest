/**
 * components/LoginModal.jsx
 * Form đăng nhập JWT Auth + placeholder OAuth (Google/Facebook — sắp ra mắt).
 */
import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

// SVG icons nhỏ gọn cho Google / Facebook
const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

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
              placeholder="••••••••"
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

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">hoặc</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* OAuth buttons — UI placeholder, chưa kết nối */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled
            title="Sắp ra mắt"
            className="w-full flex items-center gap-3 border border-gray-700 rounded-md
                       px-3 py-2 text-sm text-gray-500 cursor-not-allowed opacity-60
                       hover:border-gray-600 transition-colors"
          >
            <GoogleIcon />
            <span className="flex-1 text-left">Đăng nhập với Google</span>
            <span className="text-[10px] bg-gray-800 text-gray-600 px-1.5 py-0.5 rounded-full">
              Sắp ra mắt
            </span>
          </button>
          <button
            type="button"
            disabled
            title="Sắp ra mắt"
            className="w-full flex items-center gap-3 border border-gray-700 rounded-md
                       px-3 py-2 text-sm text-gray-500 cursor-not-allowed opacity-60
                       hover:border-gray-600 transition-colors"
          >
            <FacebookIcon />
            <span className="flex-1 text-left">Đăng nhập với Facebook</span>
            <span className="text-[10px] bg-gray-800 text-gray-600 px-1.5 py-0.5 rounded-full">
              Sắp ra mắt
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}


