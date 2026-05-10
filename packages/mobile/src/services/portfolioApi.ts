import authClient from './http';
import type { AllocationItem, HoldingItem, PortfolioItem, PortfolioSummary } from '../types/portfolio';

export async function getPortfolios(): Promise<PortfolioItem[]> {
  const response = await authClient.get<{ results?: PortfolioItem[] }>('/core/v1/workspace/portfolios/');
  return response.data?.results ?? [];
}

type CoreTransaction = {
  symbol: string;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND';
  quantity: number | string;
  price: number | string;
  fee?: number | string;
};

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildHoldingsFromTransactions = (transactions: CoreTransaction[]): HoldingItem[] => {
  const bySymbol = new Map<string, { quantity: number; costBasis: number }>();

  transactions.forEach((tx) => {
    const symbol = String(tx.symbol || '').trim().toUpperCase();
    if (!symbol) {
      return;
    }

    const quantity = Math.max(0, toNumber(tx.quantity));
    const price = Math.max(0, toNumber(tx.price));
    const fee = Math.max(0, toNumber(tx.fee));
    const side = String(tx.transaction_type || '').toUpperCase();

    const current = bySymbol.get(symbol) || { quantity: 0, costBasis: 0 };

    if (side === 'BUY') {
      current.quantity += quantity;
      current.costBasis += quantity * price + fee;
      bySymbol.set(symbol, current);
      return;
    }

    if (side === 'SELL' && current.quantity > 0) {
      const sellQty = Math.min(quantity, current.quantity);
      const avgCost = current.quantity > 0 ? current.costBasis / current.quantity : 0;
      current.quantity -= sellQty;
      current.costBasis = Math.max(0, current.costBasis - sellQty * avgCost);
      bySymbol.set(symbol, current);
    }
  });

  return Array.from(bySymbol.entries())
    .filter(([, value]) => value.quantity > 0)
    .map(([symbol, value]) => {
      const avgCost = value.quantity > 0 ? value.costBasis / value.quantity : 0;
      const marketValue = value.quantity * avgCost;
      return {
        symbol,
        quantity: value.quantity,
        avg_cost: avgCost,
        current_price: avgCost,
        market_value: marketValue,
        unrealized_pl: 0,
        unrealized_pl_pct: 0,
      };
    });
};

async function loadPortfolioTransactions(portfolioId: number): Promise<CoreTransaction[]> {
  const response = await authClient.get<{ results?: CoreTransaction[] }>(
    `/core/v1/workspace/portfolios/${portfolioId}/transactions/`
  );
  return response.data?.results ?? [];
}

export async function getSummary(portfolioId: number): Promise<PortfolioSummary> {
  const transactions = await loadPortfolioTransactions(portfolioId);
  const holdings = buildHoldingsFromTransactions(transactions);
  const totalMarketValue = holdings.reduce((sum, item) => sum + toNumber(item.market_value), 0);

  return {
    total_market_value: totalMarketValue,
    total_unrealized_pl: 0,
    total_unrealized_pl_pct: 0,
    total_realized_pl: 0,
    total_dividends: 0,
    last_updated: new Date().toISOString(),
  };
}

export async function getHoldings(portfolioId: number): Promise<HoldingItem[]> {
  const transactions = await loadPortfolioTransactions(portfolioId);
  return buildHoldingsFromTransactions(transactions);
}

export async function getAllocation(portfolioId: number): Promise<AllocationItem[]> {
  const holdings = await getHoldings(portfolioId);
  const total = holdings.reduce((sum, item) => sum + toNumber(item.market_value), 0);
  if (total <= 0) {
    return [];
  }

  return holdings.map((item) => {
    const value = toNumber(item.market_value);
    return {
      symbol: item.symbol,
      value,
      percentage: (value / total) * 100,
    };
  });
}