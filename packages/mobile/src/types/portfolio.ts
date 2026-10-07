export type PortfolioItem = {
  id: number;
  name: string;
  description?: string | null;
  is_default?: boolean;
  opening_balance?: string | null;
  opening_balance_source?: string | null;
};

/**
 * Field names mirror `PortfolioSummaryView` in
 * `user_workspace/portfolio_analytics_views.py:267-307`.
 *
 * The old names (`total_unrealized_pl`, `total_realized_pl`, `total_dividends`,
 * `last_updated`) do not exist in any backend payload: the view emits
 * `total_unrealized_pnl`, `realized_pnl`, `dividend_income` and `as_of`. Every
 * one of those read `undefined` and was coerced to 0, which is why the mobile
 * P&L was always a flat zero.
 */
export type PortfolioSummary = {
  portfolio_name?: string;
  total_market_value?: number | string;
  total_cost?: number | string;
  total_unrealized_pl?: number | string;
  total_unrealized_pl_pct?: number | string;
  total_realized_pl?: number | string;
  total_dividends?: number | string;
  /** `null` when the backend declined to compute NAV — see `nav_reason`. */
  nav?: number | string | null;
  nav_reason?: string;
  cash?: number | string;
  stock_value?: number | string | null;
  num_holdings?: number | string;
  reconciliation_required?: boolean;
  as_of?: string;
};

export type HoldingItem = {
  symbol: string;
  quantity?: number | string;
  avg_cost?: number | string;
  current_price?: number | string;
  market_value?: number | string;
  unrealized_pl?: number | string;
  unrealized_pl_pct?: number | string;
};

export type AllocationItem = {
  symbol: string;
  value: number;
  percentage: number;
};