#!/bin/bash
# Copy core tables from vninvest to core_db with FK constraint handling
# Disables constraints temporarily to avoid ordering issues

set -e

TABLES=(
  "auth_user"
  "auth_group"
  "auth_permission"
  "auth_user_groups"
  "auth_user_user_permissions"
  "auth_group_permissions"
  "identity_access_coretenant"
  "identity_access_coreserviceaccount"
  "identity_access_corepatcredential"
  "identity_access_userprofile"
  "identity_access_tenantmember"
  "identity_access_tenantinvite"
  "user_workspace_portfolio"
  "user_workspace_transaction"
  "user_workspace_watchlist"
  "user_workspace_watchlistitem"
  "user_workspace_pricealert"
  "user_workspace_subaccount"
  "user_workspace_dnsecredential"
  "market_data_stockprofile"
  "market_data_dailyprice"
  "market_data_intraday_tick"
  "market_data_intraday_bar"
  "market_data_vnbrokerruntimeconfig"
  "market_serving_symbolsnapshot"
  "market_serving_sessionfacts"
  "signal_intelligence_unifiedalert"
  "signal_intelligence_whalealertcanonical"
  "signal_intelligence_orderflowevent"
  "commercial_subscription"
  "commercial_quotarecord"
  "commercial_invoice"
  "advisory_systemaisettings"
  "advisory_advisorysession"
  "advisory_advisoryrecord"
  "advisory_advisorycomponent"
)

echo "Disabling FK constraints in core_db..."
psql -U postgres core_db -c "SET session_replication_role = replica;"

echo "Copying tables from vninvest to core_db..."

for table in "${TABLES[@]}"; do
  echo "  Copying $table..."
  pg_dump -U postgres vninvest --data-only -t "$table" 2>/dev/null | psql -U postgres core_db 2>&1 | grep -i "COPY\|^ERROR" | grep -v "^$" || true
done

echo "Re-enabling FK constraints in core_db..."
psql -U postgres core_db -c "SET session_replication_role = DEFAULT;"

echo "Data copy completed successfully."
