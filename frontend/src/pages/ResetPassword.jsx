import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, requestPasswordReset } from '../api/auth';
import { useI18n } from '../context/LangContext';

function normalizeErrorMessage(errorData, fallback) {
  if (!errorData) {
    return fallback;
  }
  if (typeof errorData.detail === 'string') {
    return errorData.detail;
  }
  if (typeof errorData.message === 'string') {
    return errorData.message;
  }
  const tokenErrors = errorData.token;
  if (Array.isArray(tokenErrors) && tokenErrors.length) {
    return tokenErrors[0];
  }
  const firstEntry = Object.values(errorData).find((value) => Array.isArray(value) && value.length > 0);
  return firstEntry ? firstEntry[0] : fallback;
}

export default function ResetPassword() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isConfirmMode = Boolean(token);

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await requestPasswordReset(identifier.trim());
      setMessage(response.data?.message || t('resetPassword.requestSuccess'));
    } catch (err) {
      setError(normalizeErrorMessage(err?.response?.data, t('resetPassword.requestError')));
    } finally {
      setLoading(false);
    }
  };

  const submitConfirm = async (e) => {
    e.preventDefault();
    if (!newPassword || !newPasswordConfirm || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await confirmPasswordReset(token, newPassword, newPasswordConfirm);
      setMessage(response.data?.message || t('resetPassword.confirmSuccess'));
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      setError(normalizeErrorMessage(err?.response?.data, t('resetPassword.confirmError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-brand-500">VNInvest</h1>
        <p className="mt-2 text-sm text-gray-400">
          {isConfirmMode ? t('resetPassword.confirmTitle') : t('resetPassword.requestTitle')}
        </p>

        <form onSubmit={isConfirmMode ? submitConfirm : submitRequest} className="mt-6 space-y-4">
          {!isConfirmMode && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{t('resetPassword.identifier')}</label>
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={t('resetPassword.identifierPlaceholder')}
              />
            </div>
          )}

          {isConfirmMode && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t('resetPassword.newPassword')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t('resetPassword.newPasswordConfirm')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          {message && <p className="text-emerald-400 text-xs leading-5">{message}</p>}
          {error && <p className="text-red-400 text-xs leading-5">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors"
          >
            {loading
              ? (isConfirmMode ? t('resetPassword.confirmLoading') : t('resetPassword.requestLoading'))
              : (isConfirmMode ? t('resetPassword.confirmSubmit') : t('resetPassword.requestSubmit'))}
          </button>
        </form>

        <div className="mt-6">
          <Link to="/login" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            {t('resetPassword.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
