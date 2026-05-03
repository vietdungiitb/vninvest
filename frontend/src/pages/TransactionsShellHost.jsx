import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShellTransactionsPage } from '@vninvest/web';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createPackageShellBootstrapLoader,
  packageShellHostEnv,
  packageShellHostFetch,
} from './packageShellHostRuntime';

export default function TransactionsShellHost() {
  const location = useLocation();
  const { t } = useI18n();
  const { ability, authStateReady, userIdentity, userPlan } = usePortfolio();
  const bootstrapLoader = createPackageShellBootstrapLoader({
    userIdentity,
    userPlan,
    ability,
  });

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-3xl border border-amber-800/40 bg-amber-950/20 px-5 py-4 text-amber-50 shadow-[0_24px_60px_rgba(180,83,9,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                {t('transactionsShellHost.eyebrow', { defaultValue: 'Package shell host' })}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-amber-50">
                {t('transactionsShellHost.title', { defaultValue: 'Giao dịch shell chạy trong frontend thật' })}
              </h1>
              <p className="mt-2 text-sm leading-7 text-amber-100/80">
                {t('transactionsShellHost.description', {
                  defaultValue: 'Route này mount trực tiếp ShellTransactionsPage từ @vninvest/web, dùng JWT hiện tại cho /api và gọi core stub qua same-origin /core/v1 proxy để kiểm tra lane giao dịch trong runtime thật thay vì chỉ qua SSR proof.',
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/transactions${location.search || ''}`}
                className="rounded-full border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-300 hover:text-white"
              >
                {t('transactionsShellHost.back', { defaultValue: 'Quay lại giao dịch' })}
              </Link>
            </div>
          </div>
        </section>

        <ShellTransactionsPage
          autoLoad={authStateReady}
          bootstrapLoader={bootstrapLoader}
          env={packageShellHostEnv}
          fetchImpl={packageShellHostFetch}
        />
      </div>
    </div>
  );
}