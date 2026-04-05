/**
 * components/LoginModal.jsx
 * Form auth JWT với 2 chế độ đăng nhập và đăng ký.
 */
import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';

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

const INITIAL_FORM = {
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

function normalizeErrorMessage(errorData, fallbackMessage) {
  if (!errorData) return fallbackMessage;

  if (typeof errorData.detail === 'string') {
    return errorData.detail;
  }

  if (typeof errorData.message === 'string') {
    return errorData.message;
  }

  const firstEntry = Object.values(errorData).find((value) => Array.isArray(value) && value.length > 0);
  if (firstEntry) {
    return firstEntry[0];
  }

  return fallbackMessage;
}

function normalizeFieldErrors(errorData) {
  if (!errorData || typeof errorData !== 'object') {
    return {};
  }

  return Object.entries(errorData).reduce((acc, [key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      acc[key] = value[0];
    }
    return acc;
  }, {});
}

function validateRegisterForm(form, t) {
  const errors = {};
  const trimmedUsername = form.username.trim();
  const trimmedEmail = form.email.trim();

  if (!trimmedUsername) {
    errors.username = t('auth.validation.usernameRequired');
  } else if (!USERNAME_PATTERN.test(trimmedUsername)) {
    errors.username = t('auth.validation.usernamePattern');
  }

  if (!trimmedEmail) {
    errors.email = t('auth.validation.emailRequired');
  }

  if (!form.password) {
    errors.password = t('auth.validation.passwordRequired');
  } else if (form.password.length < 8) {
    errors.password = t('auth.validation.passwordMinLength');
  }

  if (!form.passwordConfirm) {
    errors.password_confirm = t('auth.validation.passwordConfirmRequired');
  } else if (form.password !== form.passwordConfirm) {
    errors.password_confirm = t('auth.validation.passwordConfirmMismatch');
  }

  return errors;
}

export default function LoginModal({ onSuccess }) {
  const { login, register, resendVerification } = usePortfolio();
  const { t } = useI18n();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingIdentifier, setPendingIdentifier] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRegisterMode = mode === 'register';

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({
      ...prev,
      [key]: '',
      ...(key === 'passwordConfirm' ? { password_confirm: '' } : {}),
    }));
  };

  const switchMode = (nextMode) => {
    if (loading) {
      return;
    }
    setMode(nextMode);
    setError('');
    setNotice('');
    setFieldErrors({});
    setForm((prev) => ({
      ...prev,
      password: '',
      passwordConfirm: '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setFieldErrors({});

    if (loading) {
      return;
    }

    if (isRegisterMode) {
      const validationErrors = validateRegisterForm(form, t);
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        const response = await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          passwordConfirm: form.passwordConfirm,
        });
        setPendingIdentifier(response.email || form.email.trim() || form.username.trim());
        setNotice(response.message || t('auth.registerSuccess'));
        setMode('login');
        setForm({
          username: form.username.trim(),
          email: form.email.trim(),
          password: '',
          passwordConfirm: '',
        });
      } else {
        await login(form.username.trim(), form.password);
        onSuccess?.();
      }
    } catch (err) {
      const errorData = err.response?.data;
      setFieldErrors(normalizeFieldErrors(errorData));
      if (!isRegisterMode && form.username.trim()) {
        setPendingIdentifier(form.username.trim());
      }
      setError(
        normalizeErrorMessage(
          errorData,
          isRegisterMode
            ? t('auth.registerError')
            : t('auth.loginError'),
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const identifier = pendingIdentifier || form.email.trim() || form.username.trim();
    if (!identifier || resendLoading) {
      return;
    }

    setResendLoading(true);
    setError('');
    try {
      const response = await resendVerification(identifier);
      setNotice(response.message || t('auth.resendVerificationSuccess'));
    } catch (err) {
      const errorData = err.response?.data;
      setError(normalizeErrorMessage(errorData, t('auth.resendVerificationError')));
    } finally {
      setResendLoading(false);
    }
  };

  const submitDisabled = loading || (!isRegisterMode
    ? !form.username.trim() || !form.password
    : !form.username.trim() || !form.email.trim() || !form.password || !form.passwordConfirm || form.password !== form.passwordConfirm);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-brand-500 mb-1">VNInvest</h1>
        <p className="text-gray-400 text-sm mb-6">
          {isRegisterMode ? t('auth.registerCta') : t('auth.loginCta')}
        </p>

        <div className="grid grid-cols-2 gap-2 p-1 mb-6 bg-gray-950 rounded-lg border border-gray-800">
          <button
            type="button"
            onClick={() => switchMode('login')}
            disabled={loading}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              !isRegisterMode ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t('auth.login')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            disabled={loading}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isRegisterMode ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t('auth.register')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{t('auth.username')}</label>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => updateField('username', e.target.value)}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]{3,30}"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                         text-sm text-gray-100 placeholder-gray-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="testuser"
            />
            {fieldErrors.username && <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>}
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                           text-sm text-gray-100 placeholder-gray-600
                           focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="ban@example.com"
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{t('auth.password')}</label>
            <input
              type="password"
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              minLength={8}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                         text-sm text-gray-100
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="••••••••"
            />
            {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{t('auth.passwordConfirm')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.passwordConfirm}
                onChange={(e) => updateField('passwordConfirm', e.target.value)}
                minLength={8}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2
                           text-sm text-gray-100
                           focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="••••••••"
              />
              {(fieldErrors.password_confirm || fieldErrors.passwordConfirm) && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.password_confirm || fieldErrors.passwordConfirm}</p>
              )}
            </div>
          )}

          {notice && <p className="text-emerald-400 text-xs leading-5">{notice}</p>}
          {error && <p className="text-red-400 text-xs leading-5">{error}</p>}

          {!isRegisterMode && pendingIdentifier && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-brand-500 hover:text-white disabled:opacity-50"
            >
              {resendLoading ? t('auth.resendVerificationLoading') : t('auth.resendVerification')}
            </button>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50
                       text-white font-semibold py-2 rounded-md text-sm transition-colors"
          >
            {loading
              ? (isRegisterMode ? t('auth.submitRegisterLoading') : t('auth.submitLoginLoading'))
              : (isRegisterMode ? t('auth.submitRegister') : t('auth.login'))}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          {isRegisterMode ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
          <button
            type="button"
            onClick={() => switchMode(isRegisterMode ? 'login' : 'register')}
            disabled={loading}
            className="text-brand-400 hover:text-brand-300 transition-colors"
          >
            {isRegisterMode ? t('auth.backToLogin') : t('auth.registerNow')}
          </button>
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">{t('auth.or')}</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* OAuth buttons — UI placeholder, chưa kết nối */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled
            title={t('auth.comingSoon')}
            className="w-full flex items-center gap-3 border border-gray-700 rounded-md
                       px-3 py-2 text-sm text-gray-500 cursor-not-allowed opacity-60
                       hover:border-gray-600 transition-colors"
          >
            <GoogleIcon />
            <span className="flex-1 text-left">{isRegisterMode ? t('auth.registerWithGoogle') : t('auth.loginWithGoogle')}</span>
            <span className="text-[10px] bg-gray-800 text-gray-600 px-1.5 py-0.5 rounded-full">
              {t('auth.comingSoon')}
            </span>
          </button>
          <button
            type="button"
            disabled
            title={t('auth.comingSoon')}
            className="w-full flex items-center gap-3 border border-gray-700 rounded-md
                       px-3 py-2 text-sm text-gray-500 cursor-not-allowed opacity-60
                       hover:border-gray-600 transition-colors"
          >
            <FacebookIcon />
            <span className="flex-1 text-left">{isRegisterMode ? t('auth.registerWithFacebook') : t('auth.loginWithFacebook')}</span>
            <span className="text-[10px] bg-gray-800 text-gray-600 px-1.5 py-0.5 rounded-full">
              {t('auth.comingSoon')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}


