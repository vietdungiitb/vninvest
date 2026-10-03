-- Copy core tables from vninvest to core_db (P2-T02)
-- Strategy: selective copy of core-native tables only
-- Skip legacy-only tables (portfolio_*, django_celery_beat not copied here)

-- Run this on core_db via psql:
-- psql -U postgres -d core_db -f scripts/copy_core_tables.sql

BEGIN;

-- Copy identity_access tables (foundation for tenant system)
INSERT INTO identity_access_coretenant 
  SELECT * FROM vninvest.public.identity_access_coretenant 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_access_coreserviceaccount 
  SELECT * FROM vninvest.public.identity_access_coreserviceaccount 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_access_corepatcredential 
  SELECT * FROM vninvest.public.identity_access_corepatcredential 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_access_userprofile 
  SELECT * FROM vninvest.public.identity_access_userprofile 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_access_tenantmember 
  SELECT * FROM vninvest.public.identity_access_tenantmember 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_access_tenantinvite 
  SELECT * FROM vninvest.public.identity_access_tenantinvite 
  ON CONFLICT (id) DO NOTHING;

-- Copy Django auth tables
INSERT INTO auth_user 
  SELECT * FROM vninvest.public.auth_user 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_group 
  SELECT * FROM vninvest.public.auth_group 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_permission 
  SELECT * FROM vninvest.public.auth_permission 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_user_groups 
  SELECT * FROM vninvest.public.auth_user_groups 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_user_user_permissions 
  SELECT * FROM vninvest.public.auth_user_user_permissions 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_group_permissions 
  SELECT * FROM vninvest.public.auth_group_permissions 
  ON CONFLICT (id) DO NOTHING;

-- Copy user_workspace tables
INSERT INTO user_workspace_portfolio 
  SELECT * FROM vninvest.public.user_workspace_portfolio 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO user_workspace_transaction 
  SELECT * FROM vninvest.public.user_workspace_transaction 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO user_workspace_watchlist 
  SELECT * FROM vninvest.public.user_workspace_watchlist 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO user_workspace_watchlistitem 
  SELECT * FROM vninvest.public.user_workspace_watchlistitem 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO user_workspace_pricealert 
  SELECT * FROM vninvest.public.user_workspace_pricealert 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO user_workspace_subaccount 
  SELECT * FROM vninvest.public.user_workspace_subaccount 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO user_workspace_dnsecredential 
  SELECT * FROM vninvest.public.user_workspace_dnsecredential 
  ON CONFLICT (id) DO NOTHING;

-- Copy market_data tables (shared read-only data)
INSERT INTO market_data_stockprofile 
  SELECT * FROM vninvest.public.market_data_stockprofile 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO market_data_dailyprice 
  SELECT * FROM vninvest.public.market_data_dailyprice 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO market_data_intraday_tick 
  SELECT * FROM vninvest.public.market_data_intraday_tick 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO market_data_intraday_bar 
  SELECT * FROM vninvest.public.market_data_intraday_bar 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO market_data_vnbrokerruntimeconfig 
  SELECT * FROM vninvest.public.market_data_vnbrokerruntimeconfig 
  ON CONFLICT (id) DO NOTHING;

-- Copy market_serving tables (analytics pre-computation)
INSERT INTO market_serving_symbolsnapshot 
  SELECT * FROM vninvest.public.market_serving_symbolsnapshot 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO market_serving_sessionfacts 
  SELECT * FROM vninvest.public.market_serving_sessionfacts 
  ON CONFLICT (id) DO NOTHING;

-- Copy signal_intelligence tables (whale alerts, order flow)
INSERT INTO signal_intelligence_unifiedalert 
  SELECT * FROM vninvest.public.signal_intelligence_unifiedalert 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO signal_intelligence_whalealertcanonical 
  SELECT * FROM vninvest.public.signal_intelligence_whalealertcanonical 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO signal_intelligence_orderflowevent 
  SELECT * FROM vninvest.public.signal_intelligence_orderflowevent 
  ON CONFLICT (id) DO NOTHING;

-- Copy commercial tables (subscription, quota, invoice)
INSERT INTO commercial_subscription 
  SELECT * FROM vninvest.public.commercial_subscription 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial_quotarecord 
  SELECT * FROM vninvest.public.commercial_quotarecord 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial_invoice 
  SELECT * FROM vninvest.public.commercial_invoice 
  ON CONFLICT (id) DO NOTHING;

-- Copy advisory tables (AI recommendations)
INSERT INTO advisory_systemaisettings 
  SELECT * FROM vninvest.public.advisory_systemaisettings 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO advisory_advisorysession 
  SELECT * FROM vninvest.public.advisory_advisorysession 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO advisory_advisoryrecord 
  SELECT * FROM vninvest.public.advisory_advisoryrecord 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO advisory_advisorycomponent 
  SELECT * FROM vninvest.public.advisory_advisorycomponent 
  ON CONFLICT (id) DO NOTHING;

-- Copy data_ingest tables (ingest job tracking)
INSERT INTO data_ingest_ingestjob 
  SELECT * FROM vninvest.public.data_ingest_ingestjob 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO data_ingest_ingestrun 
  SELECT * FROM vninvest.public.data_ingest_ingestrun 
  ON CONFLICT (id) DO NOTHING;

-- Copy ops_audit tables (parity logging, request traces)
INSERT INTO ops_audit_auditevent 
  SELECT * FROM vninvest.public.ops_audit_auditevent 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO ops_audit_requesttrace 
  SELECT * FROM vninvest.public.ops_audit_requesttrace 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO ops_audit_parity_log 
  SELECT * FROM vninvest.public.ops_audit_parity_log 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO ops_audit_parity_phase_checkpoint 
  SELECT * FROM vninvest.public.ops_audit_parity_phase_checkpoint 
  ON CONFLICT (id) DO NOTHING;

INSERT INTO ops_audit_parity_report 
  SELECT * FROM vninvest.public.ops_audit_parity_report 
  ON CONFLICT (id) DO NOTHING;

-- Copy tenant_lifecycle tables (tenant state tracking)
INSERT INTO tenant_lifecycle_event 
  SELECT * FROM vninvest.public.tenant_lifecycle_event 
  ON CONFLICT (id) DO NOTHING;

-- Note: NOT copying django_celery_beat or portfolio_* (legacy tables)
-- Those remain in vninvest for backward compat

COMMIT;

-- Verify copy completion
SELECT 'Copy completed' as status, 
       (SELECT COUNT(*) FROM identity_access_coretenant) as tenant_count,
       (SELECT COUNT(*) FROM auth_user) as user_count,
       (SELECT COUNT(*) FROM user_workspace_portfolio) as portfolio_count,
       (SELECT COUNT(*) FROM user_workspace_transaction) as transaction_count;
