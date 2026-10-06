import authClient from './http';
import type { AllocationItem, HoldingItem, PortfolioItem, PortfolioSummary } from '../types/portfolio';

/**
 * Unwrap the backend envelope.
 *
 * `user_workspace/envelope.py` wraps list payloads as
 * `{data: {count, results}, meta}`, and `services/http.ts` returns the axios
 * response untouched (no response interceptor unwrap — that is deliberate, it
 * also handles the token refresh). So `response.data.results` was always
 * `undefined` and every function here returned an empty array: the mobile
 * portfolio dashboard showed nothing at all.
 *
 * Accepts both shapes so a future backend change that stops wrapping cannot
 * silently return an empty list again.
 */
function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && typeof payload === 'object') {
    const envelope = payload as { data?: unknown; results?: unknown };
    if (Array.isArray(envelope.results)) {
      return envelope.results as T[];
    }
    if (envelope.data && typeof envelope.data === 'object') {
      const inner = envelope.data as { results?: unknown };
      if (Array.isArray(inner.results)) {
        return inner.results as T[];
      }
    }
  }
  return [];
}

function unwrapObject(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const envelope = payload as { data?: unknown };
    if (envelope.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)) {
      return envelope.data as Record<string, unknown>;
    }
    return payload as Record<string, unknown>;
  }
  return {};
}

export async function getPortfolios(): Promise<PortfolioItem[]> {
  const response = await authClient.get('/core/v1/workspace/portfolios/');
  return unwrapList<PortfolioItem>(response.data);
}

const toNumber = (value: unknown): number => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Read the backend summary instead of re-deriving one on the client.
 *
 * This used to rebuild holdings from raw transactions and then report
 * `total_unrealized_pl: 0`, `total_realized_pl: 0` and `total_dividends: 0` as
 * hardcoded zeros — the UI showed a flat zero P&L even when the ledger held
 * real figures. `/summary/` already computes `realized_pnl`, `dividend_income`
 * and `nav` from the ledger (portfolio_analytics_views.py:286-304).
 *
 * Money arrives as strings; convert once, here.
 */
export async function getSummary(portfolioId: number): Promise<PortfolioSummary> {
  const response = await authClient.get(`/core/v1/workspace/portfolios/${portfolioId}/summary/`);
  const raw = unwrapObject(response.data);

  return {
    portfolio_name: typeof raw.portfolio_name === 'string' ? raw.portfolio_name : undefined,
    total_market_value: toNumber(raw.total_market_value),
    total_cost: toNumber(raw.total_cost),
    total_unrealized_pl: toNumber(raw.total_unrealized_pnl),
    total_unrealized_pl_pct: toNumber(raw.total_unrealized_pnl_pct),
    total_realized_pl: toNumber(raw.realized_pnl),
    total_dividends: toNumber(raw.dividend_income),
    // Fail-closed on the wire too: a `nav` the backend refused to compute is
    // surfaced as `null`, not silently turned into 0 by `toNumber`.
    nav: raw.nav === null || raw.nav === undefined ? null : toNumber(raw.nav),
    nav_reason: typeof raw.nav_reason === 'string' && raw.nav_reason ? raw.nav_reason : undefined,
    cash: toNumber(raw.cash),
    stock_value: raw.stock_value === null || raw.stock_value === undefined ? null : toNumber(raw.stock_value),
    num_holdings: toNumber(raw.num_holdings),
    reconciliation_required: raw.reconciliation_required === true,
    as_of: typeof raw.as_of === 'string' ? raw.as_of : undefined,
  };
}

export async function getHoldings(portfolioId: number): Promise<HoldingItem[]> {
  const response = await authClient.get(`/core/v1/workspace/portfolios/${portfolioId}/holdings/`);
  const items = unwrapList<HoldingItem>(response.data);
  return items.map((item) => ({
    symbol: String(item.symbol ?? '').trim().toUpperCase(),
    quantity: toNumber(item.quantity),
    avg_cost: toNumber(item.avg_cost),
    current_price: toNumber(item.current_price),
    market_value: toNumber(item.market_value),
    unrealized_pl: toNumber(item.unrealized_pl),
    unrealized_pl_pct: toNumber(item.unrealized_pl_pct),
  }));
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