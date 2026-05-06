import React from 'react';
import { useLocation } from 'react-router-dom';
import { ShellAiAdvisoryPage } from '@vninvest/web';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createPackageShellBootstrapLoader,
  packageShellHostEnv,
  packageShellHostFetch,
} from './packageShellHostRuntime';

export default function AiAdvisoryShellHost() {
  const location = useLocation();
  const { ability, authStateReady, userIdentity, userPlan } = usePortfolio();
  const bootstrapLoader = createPackageShellBootstrapLoader({
    userIdentity,
    userPlan,
    ability,
  });

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px]">
        <ShellAiAdvisoryPage
          autoLoad={authStateReady}
          bootstrapLoader={bootstrapLoader}
          env={packageShellHostEnv}
          fetchImpl={packageShellHostFetch}
          advisorySearch={location.search}
        />
      </div>
    </div>
  );
}