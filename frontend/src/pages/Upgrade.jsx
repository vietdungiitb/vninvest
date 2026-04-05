import React from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';

const PLAN_DEFS = [
  {
    key: 'basic',
    accent: 'border-slate-700 bg-slate-900/70',
    featureKeys: ['basicFeature1', 'basicFeature2', 'basicFeature3'],
  },
  {
    key: 'pro',
    accent: 'border-cyan-800/70 bg-cyan-950/20',
    featureKeys: ['proFeature1', 'proFeature2', 'proFeature3'],
  },
  {
    key: 'premium',
    accent: 'border-amber-700/70 bg-amber-950/20',
    featureKeys: ['premiumFeature1', 'premiumFeature2', 'premiumFeature3'],
  },
];

export default function Upgrade() {
  const { userPlan } = usePortfolio();
  const { t } = useI18n();

  const plans = PLAN_DEFS.map((plan) => ({
    ...plan,
    name: t(`plans.${plan.key}`),
    features: plan.featureKeys.map((key) => t(`upgrade.${key}`)),
  }));

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5 p-4 xl:px-5">
      <section className="card-section px-5 py-6">
        <p className="text-label">{t('upgrade.accessControl')}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">{t('upgrade.title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          {t('upgrade.description', { plan: userPlan || 'free' })}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/dashboard" className="btn-secondary inline-flex items-center justify-center">
            {t('upgrade.backToDashboard')}
          </Link>
          <Link to="/watchlist" className="btn-primary inline-flex items-center justify-center">
            {t('upgrade.openMarketRadar')}
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <section key={plan.key} className={`card-section px-5 py-5 ${plan.accent}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{plan.name}</h2>
              {userPlan === plan.key && (
                <span className="rounded-full border border-emerald-700/70 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  {t('upgrade.currentPlan')}
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