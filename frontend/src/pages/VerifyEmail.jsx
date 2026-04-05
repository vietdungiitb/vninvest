import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { useI18n } from '../context/LangContext';

export default function VerifyEmail() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState(t('verifyEmail.loading'));

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage(t('verifyEmail.missingToken'));
      return;
    }

    let active = true;
    verifyEmail(token)
      .then((response) => {
        if (!active) {
          return;
        }
        setSuccess(true);
        setMessage(response.data.message || t('verifyEmail.success'));
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setSuccess(false);
        setMessage(error.response?.data?.token?.[0] || error.response?.data?.detail || t('verifyEmail.error'));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [searchParams, t]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-brand-500">VNInvest</h1>
        <p className="mt-2 text-sm text-gray-400">{t('verifyEmail.title')}</p>

        <div className={`mt-6 rounded-lg border px-4 py-4 text-sm leading-6 ${
          loading
            ? 'border-gray-700 bg-gray-950 text-gray-300'
            : success
              ? 'border-emerald-800/70 bg-emerald-950/20 text-emerald-200'
              : 'border-rose-800/70 bg-rose-950/20 text-rose-200'
        }`}>
          {message}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link to="/login" className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            {t('verifyEmail.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}