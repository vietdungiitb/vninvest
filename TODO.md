# VNInvest - Sprint 2 Completion Plan &amp; Status

## Information Gathered (from thorough file analysis)
**Models structure:**
- `Portfolio.sub_accounts` (1:N)
- `SubAccount.transactions` (1:N) 
- `analytics.py` current: `load_transactions_df(subaccount)` ✓ but `compute_holdings(portfolio)` WRONG param
- `views.py`: PortfolioDetailView → compute_holdings(portfolio) → FAIL (table missing + logic wrong)

**TODO.md current:** 1-4,6 ✅, pending 5️⃣ analytics aggregation + 7️⃣ Pandas test

**DB issue:** SubAccount table missing despite models defined (migration 0001 only applied)

## Plan: Complete Sprint 2
**File level updates:**

1. **backend/portfolio/analytics.py** (primary)
   - Add `aggregate_transactions(portfolio)` → pd.concat([sa.transactions for sa in portfolio.sub_accounts])
   - Update `compute_holdings(portfolio)` → use aggregate_transactions()
   - Update `compute_nav_series(portfolio)`, `build_summary(portfolio)` → same
   - Keep `load_transactions_df(subaccount)` unchanged for subaccount APIs

2. **backend/portfolio/views.py** (minor)
   - HoldingsView, SummaryView, ChartDataView → already call compute_*(portfolio) ✓

3. **backend/portfolio/management/commands/create_default_subaccount.py** (seed data)
   - Create default subaccounts for new users

4. **TODO.md** → mark 5,7 ✅

**Dependent files to edit:**
- `backend/portfolio/analytics.py` (main logic)
- `backend/portfolio/management/commands/create_default_subaccount.py` (test data)

## Follow-up steps:
1. Install no new deps (pandas already there)
2. Test: 
   - `python manage.py migrate` → fix table
   - Create test portfolio + transactions
   - `compute_holdings(portfolio)` → verify WAC/P&L/NAV numbers
   - API `/api/portfolio/portfolios/1/holdings/` → JSON response
3. Update TODO.md → Sprint 3 ready

**Ready to proceed? Y/N**
