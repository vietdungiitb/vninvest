import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShellSettingsPage } from '@vninvest/web';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createPackageShellBootstrapLoader,
  packageShellHostEnv,
  packageShellHostFetch,
} from './packageShellHostRuntime';

export default function SettingsShellHost() {
  const location = useLocation();
  const { ability, authStateReady, userIdentity, userPlan } = usePortfolio();
  const bootstrapLoader = createPackageShellBootstrapLoader({
    userIdentity,
    userPlan,
    ability,
  });

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-3xl border border-cyan-800/40 bg-cyan-950/20 px-5 py-4 text-cyan-50 shadow-[0_24px_60px_rgba(8,145,178,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Package shell host</p>
              <h1 className="mt-2 text-2xl font-semibold text-cyan-50">Cài đặt shell chạy trong frontend thật</h1>
              <p className="mt-2 text-sm leading-7 text-cyan-100/80">
                Route này mount trực tiếp `ShellSettingsPage` từ `@vninvest/web`, dùng JWT hiện tại cho `/api` và gọi core stub qua same-origin `/core/v1` proxy để kiểm tra lane cài đặt hệ thống trong runtime thật thay vì chỉ qua SSR proof.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/settings${location.search || ''}`}
                className="rounded-full border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white"
              >
                Quay lại cài đặt
              </Link>
            </div>
          </div>
        </section>

        <ShellSettingsPage
          autoLoad={authStateReady}
          bootstrapLoader={bootstrapLoader}
          env={packageShellHostEnv}
          fetchImpl={packageShellHostFetch}
        />
      </div>
    </div>
  );
}