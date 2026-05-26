import React from 'react';
import { ShellMailConfigPage } from '@vninvest/web';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createPackageShellBootstrapLoader,
  packageShellHostEnv,
  packageShellHostFetch,
} from './packageShellHostRuntime';

export default function MailConfigShellHost() {
  const { ability, authStateReady, userIdentity, userPlan } = usePortfolio();
  const bootstrapLoader = createPackageShellBootstrapLoader({
    userIdentity,
    userPlan,
    ability,
  });

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px]">
        <ShellMailConfigPage
          autoLoad={authStateReady}
          bootstrapLoader={bootstrapLoader}
          env={packageShellHostEnv}
          fetchImpl={packageShellHostFetch}
        />
      </div>
    </div>
  );
}
