import React from 'react';
import { PortfoliosPage } from '@vninvest/web';
import { packageShellHostEnv } from './packageShellHostRuntime';

export default function PortfoliosShellHost() {
  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px]">
        <PortfoliosPage env={packageShellHostEnv} />
      </div>
    </div>
  );
}