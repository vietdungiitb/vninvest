import React from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

const PLANS = [
  {
    name: 'Basic',
    accent: 'border-slate-700 bg-slate-900/70',
    features: ['Screener nang cao', 'Xuat du lieu danh muc', 'Khong co AI advisory'],
  },
  {
    name: 'Pro',
    accent: 'border-cyan-800/70 bg-cyan-950/20',
    features: ['Xem AI summary cho whale signal', 'Truy cap AI Advisory Feed', 'Quan sat whale signal uu tien cao'],
  },
  {
    name: 'Premium',
    accent: 'border-amber-700/70 bg-amber-950/20',
    features: ['Mo khoa AI detail day du', 'Xem phan tich sau theo tung whale event', 'Phu hop cho workflow nghien cuu'],
  },
];

export default function Upgrade() {
  const { userPlan } = usePortfolio();

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5 p-4 xl:px-5">
      <section className="card-section px-5 py-6">
        <p className="text-label">Access control</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Nang cap goi de mo khoa tinh nang</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Tai khoan hien tai dang o goi {userPlan || 'free'}. Route nay duoc dung lam diem roi khi user chua du quyen xem advisory hoac phan tich chi tiet.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/dashboard" className="btn-secondary inline-flex items-center justify-center">
            Ve tong quan
          </Link>
          <Link to="/watchlist" className="btn-primary inline-flex items-center justify-center">
            Mo radar thi truong
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <section key={plan.name} className={`card-section px-5 py-5 ${plan.accent}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{plan.name}</h2>
              {userPlan === plan.name.toLowerCase() && (
                <span className="rounded-full border border-emerald-700/70 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  Dang dung
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {plan.features.map((feature) => (
                <p key={feature}>- {feature}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}