import React from 'react';
import { ShellDashboardPage } from '@vninvest/web';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createPackageShellBootstrapLoader,
  packageShellHostEnv,
  packageShellHostFetch,
} from './packageShellHostRuntime';

export default function DashboardShellHost() {
  const { ability, authStateReady, userIdentity, userPlan } = usePortfolio();
  const bootstrapLoader = createPackageShellBootstrapLoader({
    userIdentity,
    userPlan,
    ability,
  });

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-3xl border border-sky-800/40 bg-sky-950/20 px-5 py-4 text-sky-50 shadow-[0_24px_60px_rgba(2,132,199,0.16)]">
          <div className="max-w-4xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">Package shell host</p>
            <h1 className="mt-2 text-2xl font-semibold text-sky-50">Dashboard shell chạy trong frontend thật</h1>
            <p className="mt-2 text-sm leading-7 text-sky-100/80">
              Route này mount trực tiếp ShellDashboardPage từ @vninvest/web để kiểm tra lane dashboard trong runtime thật, dùng cùng bootstrap của package shell thay vì đi qua dispatcher Dashboard legacy.
            </p>
          </div>
        </section>

        <ShellDashboardPage
          autoLoad={authStateReady}
          bootstrapLoader={bootstrapLoader}
          env={packageShellHostEnv}
          fetchImpl={packageShellHostFetch}
        />
      </div>
    </div>
  );
}