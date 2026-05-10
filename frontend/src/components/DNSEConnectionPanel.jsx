import React, { useState, useEffect } from 'react';
import { getDNSEConfig, updateDNSEConfig, syncDNSEAccounts } from '../api/client';
import { Shield, RefreshCw, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

const DNSEConnectionPanel = () => {
  const [config, setConfig] = useState({
    username: '',
    password: '',
    is_active: true
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await getDNSEConfig();
      if (res.data.is_configured) {
        setIsConfigured(true);
        setConfig(prev => ({
          ...prev,
          username: res.data.data.username || '',
          is_active: res.data.data.is_active
        }));
      }
    } catch (err) {
      console.error('Failed to fetch DNSE config', err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await updateDNSEConfig(config);
      setStatus('success');
      setMessage('Cấu hình DNSE đã được lưu.');
      setIsConfigured(true);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
      setMessage('Lỗi khi lưu cấu hình. Vui lòng thử lại.');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncDNSEAccounts();
      if (res.data.ok) {
        setMessage(`Đã đồng bộ ${res.data.synced_count} tiểu khoản.`);
        setStatus('success');
      } else {
        setStatus('error');
        setMessage(res.data.error || 'Đồng bộ thất bại.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Lỗi kết nối khi đồng bộ.');
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div className="dnse-panel glassmorphism p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20 text-orange-500">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Kết nối DNSE Broker</h3>
            <p className="text-sm text-gray-400">Đồng bộ danh mục và giao dịch tự động</p>
          </div>
        </div>
        {isConfigured && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
            <CheckCircle size={14} />
            Đã kết nối
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tên đăng nhập DNSE</label>
            <input
              type="text"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              placeholder="Username tại DNSE"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mật khẩu</label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {status === 'loading' ? <RefreshCw size={18} className="animate-spin" /> : 'Lưu cấu hình'}
            </button>
            
            {isConfigured && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold border border-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {syncing ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Đồng bộ ngay
              </button>
            )}
          </div>

          <a 
            href="https://entrade.com.vn/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            Mở Entrade X <ExternalLink size={14} />
          </a>
        </div>
      </form>

      {message && (
        <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 transition-all ${
          status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
        }`}>
          {status === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          <span className="text-sm font-medium">{message}</span>
        </div>
      )}
    </div>
  );
};

export default DNSEConnectionPanel;
