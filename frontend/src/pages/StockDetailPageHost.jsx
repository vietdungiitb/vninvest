import React from 'react';
import { useParams } from 'react-router-dom';
import { StockDetailPage } from '@vninvest/web';
import { packageShellHostEnv } from './packageShellHostRuntime';

export default function StockDetailPageHost() {
  const { symbol } = useParams();
  const normalizedSymbol = symbol ? String(symbol).trim().toUpperCase() : '';

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px]">
        <StockDetailPage env={packageShellHostEnv} symbol={normalizedSymbol} />
      </div>
    </div>
  );
}
