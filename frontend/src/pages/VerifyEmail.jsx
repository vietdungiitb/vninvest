import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('Dang xac thuc email...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage('Khong tim thay token xac thuc trong duong dan.');
      return;
    }

    let active = true;
    verifyEmail(token)
      .then((response) => {
        if (!active) {
          return;
        }
        setSuccess(true);
        setMessage(response.data.message || 'Xac thuc email thanh cong.');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setSuccess(false);
        setMessage(error.response?.data?.token?.[0] || error.response?.data?.detail || 'Xac thuc email that bai.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-brand-500">VNInvest</h1>
        <p className="mt-2 text-sm text-gray-400">Kich hoat tai khoan bang email</p>

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
            Ve trang dang nhap
          </Link>
        </div>
      </div>
    </div>
  );
}