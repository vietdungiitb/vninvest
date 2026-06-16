# VNInvest Module Tree (Auto-generated)

> Do not edit manually. Regenerate with `python scripts/ops/generate_module_tree.py`.

Generated at: `2026-06-16 14:59:15`

## Summary

- Total modules: 2059
- Python modules: 449
- JS/TS modules: 1610
- Total classes: 1264
- Total functions: 5924
- Total top-level variables: 19331

## Python Modules

### `packages/core/backend/manage.py`

- Functions:
  - `main`

### `packages/core/backend/scripts/migrate_legacy_portfolio_complete.py`

- Classes:
  - `MigrationExecutor` -> methods: `__init__`, `_get_user_tenant`, `_migrate_portfolios`, `_migrate_pricealerts`, `_migrate_watchlists`, `_print_summary`, `_validate_migration`, `run`
- Top-level variables:
  - `backend_dir`, `src_dir`

### `packages/core/backend/src/advertising/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/advertising/admin.py`

- Classes:
  - `AdCampaignAdmin`
  - `AdClickLogAdmin` -> methods: `has_add_permission`
  - `AdDailySummaryAdmin` -> methods: `has_add_permission`
  - `AdImpressionLogAdmin` -> methods: `has_add_permission`

### `packages/core/backend/src/advertising/api_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/advertising/apps.py`

- Classes:
  - `AdvertisingConfig` -> methods: `ready`

### `packages/core/backend/src/advertising/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/advertising/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/advertising/models.py`

- Classes:
  - `AdCampaign` -> methods: `__str__`, `clean`
  - `AdClickLog`
  - `AdDailySummary` -> methods: `__str__`
  - `AdImpressionLog`

### `packages/core/backend/src/advertising/serializers.py`

- Classes:
  - `AdCampaignSerializer`
  - `AdDailySummarySerializer`

### `packages/core/backend/src/advertising/signals.py`

- Functions:
  - `on_campaign_changed`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/advertising/tasks.py`

- Functions:
  - `_get_redis_client`, `aggregate_ad_metrics`, `rebuild_ads_cache_index`
- Top-level variables:
  - `CACHE_TTL`, `CONSUMER_GROUP`, `CONSUMER_NAME`, `STREAM_BATCH_LIMIT`, `logger`

### `packages/core/backend/src/advertising/urls.py`

- Classes:
  - `NoFormatSuffixRouter` -> methods: `get_urls`
- Top-level variables:
  - `router`, `urlpatterns`

### `packages/core/backend/src/advertising/views.py`

- Classes:
  - `AdvertisingAnonRateThrottle`
  - `AdvertisingUserRateThrottle`
  - `BaseMetricsLogView` -> methods: `queue_event`, `verify_request`
  - `ContentDisplayView` -> methods: `get`
  - `MetricsLogClickView` -> methods: `post`
  - `MetricsLogViewView` -> methods: `post`
  - `OperatorAdCampaignViewSet`
  - `OperatorAdDailySummaryViewSet`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/advisory/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/advisory/admin.py`

- Classes:
  - `AdvisoryComponentInline`
  - `AdvisoryRecordAdmin`
  - `AdvisorySessionAdmin`
  - `SystemAISettingsAdmin`

### `packages/core/backend/src/advisory/apps.py`

- Classes:
  - `AdvisoryConfig`

### `packages/core/backend/src/advisory/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/advisory/migrations/0002_add_advisory_session_component.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/advisory/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/advisory/models.py`

- Classes:
  - `AdvisoryComponent` -> methods: `__str__`
  - `AdvisoryRecord` -> methods: `__str__`
  - `AdvisorySession` -> methods: `__str__`, `budget_exceeded`
  - `SystemAISettings` -> methods: `__str__`

### `packages/core/backend/src/advisory/orchestrator.py`

- Classes:
  - `AdvisoryOrchestrator` -> methods: `run`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/advisory/serializers.py`

- Classes:
  - `AdvisoryRecordSerializer`
  - `SystemAISettingsSerializer`

### `packages/core/backend/src/advisory/tasks.py`

- Functions:
  - `_sanitize_effective_context_for_session`, `generate_advisory_task`, `reset_daily_token_budgets`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/advisory/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/advisory/views.py`

- Classes:
  - `AdvisoryHistoryView` -> methods: `get`
  - `AdvisoryLatestView` -> methods: `get`
  - `AdvisoryRefreshView` -> methods: `post`
- Functions:
  - `_get_or_create_active_ai_settings`, `_get_tenant`, `_manual_trigger_period`, `_manual_trigger_priority`, `_manual_trigger_quota_limit`, `_record_manual_trigger_audit`, `_validate_symbol`
- Top-level variables:
  - `_MANUAL_TRIGGER_BLOCKED_STATUSES`, `_MANUAL_TRIGGER_PLAN_LIMITS`, `_MANUAL_TRIGGER_PRIORITY`, `_SYMBOL_RE`, `logger`

### `packages/core/backend/src/check_shadow_run.py`

- Top-level variables:
  - `latest_date`, `recent_runs`, `total_count`

### `packages/core/backend/src/commercial/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/commercial/admin.py`

- Classes:
  - `InvoiceAdmin`
  - `QuotaRecordAdmin`
  - `SubscriptionAdmin`

### `packages/core/backend/src/commercial/apps.py`

- Classes:
  - `CommercialConfig`

### `packages/core/backend/src/commercial/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/commercial/migrations/0002_invoice_status_past_due.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/commercial/migrations/0003_vnpayipnlog_paymenttransaction.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/commercial/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/commercial/models.py`

- Classes:
  - `Invoice` -> methods: `__str__`
  - `PaymentTransaction` -> methods: `__str__`
  - `QuotaRecord` -> methods: `__str__`
  - `Subscription` -> methods: `__str__`
  - `VNPayIPNLog` -> methods: `__str__`

### `packages/core/backend/src/commercial/public_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/commercial/serializers.py`

- Classes:
  - `InvoiceSerializer`
  - `QuotaRecordSerializer`
  - `SubscriptionSerializer`

### `packages/core/backend/src/commercial/tasks.py`

- Functions:
  - `_cache_get_int`, `_current_billing_period`, `_extract_tenant_id_from_key`, `_invoice_number_for`, `_iter_quota_counter_keys`, `_normalize_cache_key`, `_subscription_amount_due`, `check_overdue_invoices`, `flush_quota_counters`, `generate_monthly_invoices`, `manage_subscriptions_lifecycle`, `send_quota_warning`
- Top-level variables:
  - `FLUSH_QUOTA_LOCK_KEY`, `FLUSH_QUOTA_LOCK_SECONDS`, `FLUSH_QUOTA_MIN_INTERVAL_SECONDS`, `FLUSH_QUOTA_THROTTLE_KEY`, `logger`

### `packages/core/backend/src/commercial/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/commercial/views.py`

- Classes:
  - `CreateVNPayPaymentView` -> methods: `post`
  - `InvoiceListView` -> methods: `get_queryset`
  - `PaymentStatusCheckView` -> methods: `get`
  - `PublicLegalPagesView` -> methods: `get`
  - `QuotaCursorPagination`
  - `QuotaListView` -> methods: `get_queryset`
  - `SubscriptionDetailView` -> methods: `get_object`
  - `VNPayIPNWebhookView` -> methods: `get`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/commercial/vnpay_service.py`

- Classes:
  - `VNPayService` -> methods: `generate_payment_url`, `get_hash_secret`, `get_payment_url`, `get_return_url`, `get_tmn_code`, `verify_ipn_signature`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/data_ingest/__init__.py`

- Classes:
  - `DataIngestConfig` -> methods: `ready`

### `packages/core/backend/src/data_ingest/apps.py`

- Classes:
  - `DataIngestConfig`

### `packages/core/backend/src/data_ingest/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/data_ingest/migrations/0002_rename_data_ingest_job_id_idx_data_ingest_job_id_4d6b96_idx_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/data_ingest/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/data_ingest/models.py`

- Classes:
  - `IngestJob` -> methods: `__str__`
  - `IngestRun` -> methods: `__str__`

### `packages/core/backend/src/data_ingest/serializers.py`

- Classes:
  - `IngestJobSerializer` -> methods: `get_last_run`
  - `IngestRunSerializer`
  - `IngestTriggerResponseSerializer`
  - `TriggerIngestRequestSerializer` -> methods: `validate_symbols`

### `packages/core/backend/src/data_ingest/tasks.py`

- Functions:
  - `_attach_ingest_run_to_service_run_log`, `_b01_clear_inflight_cache`, `_b02_mark_run_failed_on_crash`, `_b08_finalize_stale_running_runs`, `_build_default_daily_price_plan_items`, `_build_intraday_bar_payloads`, `_build_intraday_symbol_plan`, `_classify_daily_price_rows`, `_compute_latency_percentile_ms`, `_empty_result_counts`, `_extract_intraday_datasets_from_plan_items`, `_extract_symbols_from_plan_items`, `_fetch_and_upsert_bucket`, `_fetch_daily_history_with_retry`, `_floor_intraday_bucket`, `_get_default_global_registry_symbols`, `_hydrate_intraday_symbols`, `_normalize_daily_plan_items`, `_normalize_intraday_side`, `_normalize_intraday_trade_row`, `_normalize_symbols`, `_refresh_coverage_for_symbols`, `_resolve_history_date_range_from_window`, `_resolve_history_days_from_window`, `_resolve_intraday_page_size_from_window`, `_synthesize_bars_from_db_ticks`, `backfill_daily_prices`, `backfill_intraday_tick_system`, `backfill_intraday_tick_user`, `backfill_pre5y_to_market_inception`, `enqueue_dnse_quarterly_backfill`, `execute_provisioning_consumer`, `fetch_and_upsert_price_board`, `ingest_daily_prices`, `process_outbox_events`, `run_global_market_data_planner`, `run_vnbroker_price_board_benchmark`, `send_email_verification_token`, `send_password_reset_email`, `sync_market_groups`, `synthesize_intraday_bars_from_ticks`, `trigger_email_verification_flow`, `warm_intraday_universe`
- Top-level variables:
  - `_B08_STALE_GRACE_SECONDS`, `_B08_STALE_RUNNING_TTL_SECONDS`, `_BACKFILL_BATCH_SIZE`, `_DAILY_HISTORY_RETRY_ATTEMPTS`, `_DAILY_HISTORY_RETRY_BACKOFF_MAX_SECONDS`, `_DAILY_HISTORY_RETRY_BACKOFF_SECONDS`, `_DEFAULT_INTER_SYMBOL_DELAY`, `_DNSE_BACKFILL_COUNTDOWN_SECS`, `_DNSE_TASK_RATE_LIMIT`, `_HISTORY_PROVIDERS`, `_INTRADAY_BAR_TIMEFRAMES`, `_INTRADAY_PAGE_SIZE_BY_DEPTH_TIER`, `_INTRADAY_PLAN_DATASETS`, `_MAX_BACKFILL_DAYS`, `_PROVIDER_INTER_SYMBOL_DELAY`, `_USER_BACKFILL_MAX_DAYS`, `logger`

### `packages/core/backend/src/data_ingest/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/data_ingest/tests/test_backfill_integration.py`

- Classes:
  - `BackfillSystemIntegrationTest` -> methods: `setUp`, `test_system_backfill_idempotent`, `test_system_backfill_writes_ticks`
  - `BackfillUserIntegrationTest` -> methods: `setUp`, `test_user_backfill_writes_ticks`
- Functions:
  - `_make_ticks`
- Top-level variables:
  - `User`

### `packages/core/backend/src/data_ingest/tests/test_backfill_tasks.py`

- Classes:
  - `BackfillViewTests` -> methods: `setUp`, `test_system_backfill_admin_accepted`, `test_system_backfill_requires_admin`, `test_user_backfill_old_date_returns_400`, `test_user_backfill_valid_date_accepted`
  - `RateLimitDetectionTests` -> methods: `test_c8_rate_limit_watcher_ignores_other_warnings`, `test_c8_rate_limit_watcher_triggers_on_warning`, `test_c9_fetch_no_rate_limit_returns_empty_list`, `test_c9_fetch_raises_dnse_rate_limit_error`
  - `SynthesizeBarsFromTicksTests` -> methods: `_make_ticks`, `test_d1_empty_when_no_ticks`, `test_d2_builds_intraday_bars_from_db_ticks`, `test_d3_idempotent_second_run_skips_all`, `test_d4_task_calls_helper`, `test_d5_system_chain_includes_bar_synthesis`
  - `SystemBackfillTaskTests` -> methods: `test_abort_when_no_system_credentials`, `test_ok_creates_intraday_ticks`, `test_skip_when_data_already_exists`
  - `UserBackfillTaskTests` -> methods: `setUp`, `test_error_when_no_user_credential`, `test_skip_when_data_exists`
- Top-level variables:
  - `SAMPLE_TICKS`, `TEST_FERNET_KEY`

### `packages/core/backend/src/data_ingest/tests/test_tasks.py`

- Classes:
  - `DataIngestBackfillTaskTests` -> methods: `setUpTestData`, `test_backfill_daily_prices_auto_closes_stale_running_records_before_new_run`, `test_backfill_daily_prices_consumes_plan_items_with_detailed_counts`, `test_backfill_daily_prices_defaults_to_global_symbol_registry_when_symbols_missing`, `test_backfill_daily_prices_does_not_close_fresh_running_records`, `test_backfill_pre5y_to_market_inception_dispatches_pre5y_window_plan`, `test_fetch_and_upsert_bucket_retries_with_bounded_attempts`, `test_fetch_and_upsert_bucket_uses_adapter_ssot`, `test_fetch_and_upsert_price_board_consumes_plan_items`, `test_fetch_and_upsert_price_board_defaults_to_global_symbol_registry_when_symbols_missing`, `test_fetch_and_upsert_price_board_updates_service_run_log_when_provided`, `test_ingest_daily_prices_runs_backfill_inline`, `test_ingest_daily_prices_updates_service_run_log_when_provided`, `test_warm_intraday_universe_applies_intraday_page_size_from_plan_window`, `test_warm_intraday_universe_consumes_plan_items_and_persists_rows`, `test_warm_intraday_universe_defaults_to_global_symbol_registry_when_symbols_missing`

### `packages/core/backend/src/data_ingest/tests/test_views.py`

- Classes:
  - `DataIngestAdminViewTests` -> methods: `setUp`, `setUpTestData`, `test_trigger_daily_prices_creates_service_run_log`, `test_trigger_price_board_creates_service_run_log`
- Top-level variables:
  - `User`

### `packages/core/backend/src/data_ingest/urls.py`

- Top-level variables:
  - `data_ingest_task_status`, `data_ingest_trigger_daily_prices`, `data_ingest_trigger_price_board`, `ingest_job_detail`, `ingest_job_list`, `ingest_run_detail`, `ingest_run_list`, `urlpatterns`

### `packages/core/backend/src/data_ingest/views.py`

- Classes:
  - `DataIngestAdminViewSet` -> methods: `task_status`, `trigger_daily_prices`, `trigger_price_board`
  - `IngestAdminThrottle`
  - `IngestJobViewSet`
  - `IngestRunViewSet` -> methods: `get_queryset`
  - `SystemBackfillThrottle`
  - `SystemBackfillTriggerView` -> methods: `post`
  - `UserBackfillThrottle`
  - `UserBackfillTriggerView` -> methods: `post`
- Functions:
  - `_build_trading_date_range`, `_resolve_backfill_symbols`
- Top-level variables:
  - `_SYSTEM_BACKFILL_MAX_DATE_RANGE_DAYS`, `_SYSTEM_BACKFILL_SUPPORTED_DATASETS`, `_VALID_MODES`, `logger`

### `packages/core/backend/src/identity_access/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/identity_access/admin.py`

- Classes:
  - `CorePATCredentialAdmin`
  - `CorePATCredentialInline`
  - `CoreServiceAccountAdmin`
  - `CoreServiceAccountInline`
  - `CoreTenantAdmin`
  - `SystemMailConfigAdmin` -> methods: `get_urls`, `google_callback_view`, `google_client_secret_status`, `google_connect_view`, `google_refresh_token_status`, `google_revoke_view`, `google_service_account_json_status`, `mark_as_default`, `oauth_actions`, `save_model`, `send_test_email_to_selected_accounts`, `smtp_password_status`
  - `SystemMailConfigAdminForm` -> methods: `clean`
  - `TenantInviteAdmin`
  - `TenantMemberAdmin`
  - `UserProfileAdmin`
- Functions:
  - `_resolve_google_oauth_redirect_uri`

### `packages/core/backend/src/identity_access/apps.py`

- Classes:
  - `IdentityAccessConfig` -> methods: `ready`
- Functions:
  - `cors_allow_api_requests`

### `packages/core/backend/src/identity_access/authentication.py`

- Classes:
  - `CorePATAuthentication` -> methods: `authenticate`, `authenticate_header`
  - `CorePATAuthenticationScheme` -> methods: `get_security_definition`

### `packages/core/backend/src/identity_access/commercial_partner_views.py`

- Classes:
  - `PartnerBillingInvoicesView` -> methods: `get`
  - `PartnerBillingSubscriptionView` -> methods: `get`
  - `PartnerUsageMetersView` -> methods: `get`
  - `PartnerUsageQuotasView` -> methods: `get`
- Functions:
  - `_get_tenant`
- Top-level variables:
  - `TENANT_PERMISSION_CLASSES`, `logger`

### `packages/core/backend/src/identity_access/dnse_credential_views.py`

- Classes:
  - `DNSECredentialView` -> methods: `delete`, `get`, `post`
- Functions:
  - `_safe_serialize`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/identity_access/gmail_service.py`

- Functions:
  - `_build_raw_message`, `send_gmail_api_message`

### `packages/core/backend/src/identity_access/google_oauth_service.py`

- Functions:
  - `build_google_oauth_authorize_url`, `exchange_google_oauth_code`, `fetch_google_user_email`, `refresh_google_access_token`
- Top-level variables:
  - `GOOGLE_OAUTH_AUTHORIZE_URL`, `GOOGLE_OAUTH_TOKEN_URL`, `GOOGLE_OAUTH_USERINFO_URL`

### `packages/core/backend/src/identity_access/mail_service.py`

- Functions:
  - `_humanize_gmail_error`, `_send_via_google_dwd`, `_send_via_google_oauth2`, `build_email_connection`, `build_sender_address`, `get_active_mail_config`, `send_system_email`, `send_test_email`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/identity_access/management/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/management/commands/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/management/commands/backfill_missing_tenants.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Top-level variables:
  - `User`, `logger`

### `packages/core/backend/src/identity_access/management/commands/issue_vnbrokerchart_pat.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `packages/core/backend/src/identity_access/management/commands/migrate_userprofiles_to_core.py`

- Classes:
  - `Command` -> methods: `_fetch_legacy_userconfigs`, `add_arguments`, `handle`

### `packages/core/backend/src/identity_access/management/commands/rotate_mail_credential_key.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/identity_access/middleware.py`

- Classes:
  - `TenantQuotaMiddleware` -> methods: `__call__`, `__init__`, `_build_counter_key`, `_get_tenant_quota_limit`, `_increment_daily_counter`, `_is_exempt_path`, `_resolve_tenant_quota`
  - `TenantResolutionMiddleware` -> methods: `__call__`, `__init__`, `_get_user_from_pat`, `_is_exempt_path`, `_resolve_by_header`, `_resolve_superuser_tenant`, `_resolve_tenant`

### `packages/core/backend/src/identity_access/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0002_userprofile.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0003_alter_coretenant_plan.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0004_tenantmember_tenantinvite.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0005_dnse_credential.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0006_corepatcredential_is_human_session.py`

- Classes:
  - `Migration`
- Functions:
  - `revoke_legacy_human_marker_pats`

### `packages/core/backend/src/identity_access/migrations/0007_canonicalize_service_account_scope_codes.py`

- Classes:
  - `Migration`
- Functions:
  - `_normalize_identifier_list`, `_policy_ids_to_scope_codes`, `_scope_codes_to_policy_ids`, `canonicalize_policy_backed_scopes`
- Top-level variables:
  - `POLICY_TO_SCOPE_CODES`, `SCOPE_CODE_TO_POLICY`

### `packages/core/backend/src/identity_access/migrations/0008_outboxevent_processedevent_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0009_emailverificationtoken.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0010_systemmailconfig_oauth2_and_test_fields.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0011_enforce_tenant_not_null_real.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/models.py`

- Classes:
  - `CorePATCredential` -> methods: `__str__`, `effective_status`, `issue_for_service_account`, `mark_rotating`, `resolve_from_raw_secret`, `revoke_pat`, `save`
  - `CoreServiceAccount` -> methods: `__str__`, `clean`, `save`
  - `CoreTenant` -> methods: `__str__`, `save`, `tenant_id`
  - `EmailVerificationToken` -> methods: `__str__`
  - `MailConfigAuditLog` -> methods: `__str__`
  - `OutboxEvent` -> methods: `__str__`
  - `PasswordResetToken` -> methods: `__str__`, `cleanup_expired`, `generate_and_save`, `is_expired`, `is_valid`, `verify_and_mark_used`
  - `ProcessedEvent` -> methods: `__str__`
  - `SystemMailConfig` -> methods: `__str__`, `clean`, `clear_google_refresh_token`, `get_google_client_secret`, `get_google_refresh_token`, `get_google_service_account_json`, `get_smtp_password`, `has_google_oauth_credentials`, `has_google_refresh_token`, `has_google_service_account`, `set_google_client_secret`, `set_google_refresh_token`, `set_google_service_account_json`, `set_smtp_password`
  - `TenantInvite` -> methods: `__str__`, `generate_token`, `is_expired`, `save`
  - `TenantMember` -> methods: `__str__`, `save`
  - `UserDNSECredential` -> methods: `__str__`, `get_api_key`, `get_api_secret`, `set_credentials`
  - `UserProfile` -> methods: `__str__`
- Functions:
  - `_build_pat_secret`, `_decrypt_credential`, `_encrypt_credential`, `_extract_pat_prefix`, `_generate_public_id`, `_get_fernet`, `_hash_pat_secret`, `get_system_provider_credentials`

### `packages/core/backend/src/identity_access/onboarding_views.py`

- Classes:
  - `RegisterTenantSerializer`
- Functions:
  - `_enqueue_welcome_email`, `register_tenant_view`

### `packages/core/backend/src/identity_access/partner_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/identity_access/permissions.py`

- Classes:
  - `IsCoreOperator` -> methods: `has_permission`
  - `IsTenantActive` -> methods: `has_permission`
- Functions:
  - `_normalize_scope_codes`, `is_machine_pat_request`, `require_human_session`, `require_pat_scopes_or_human_session`

### `packages/core/backend/src/identity_access/security.py`

- Functions:
  - `_get_fernet_key`, `decrypt_user_api_key`, `encrypt_user_api_key`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/identity_access/serializers.py`

- Classes:
  - `CorePATCredentialSerializer` -> methods: `get_object`, `get_status`
  - `CorePATIssueResponseSerializer`
  - `CoreServiceAccountSerializer` -> methods: `_merge_metadata`, `create`, `to_representation`, `update`, `validate`
  - `CoreTenantSerializer`
  - `PartnerPATIssueSerializer` -> methods: `validate`
  - `PartnerPATRevokeSerializer`
  - `PartnerPATRotateSerializer` -> methods: `validate`
  - `SaaSRegisterSerializer` -> methods: `_verify_turnstile`, `validate`, `validate_email`, `validate_username`
  - `TenantInviteCreateSerializer`
  - `TenantInviteSerializer` -> methods: `get_is_expired`
  - `TenantMemberSerializer`
- Functions:
  - `_normalize_identifier_list`, `_policy_ids_to_scope_codes`, `_scope_codes_to_policy_ids`
- Top-level variables:
  - `POLICY_TO_SCOPE_CODES`, `SCOPE_CODE_TO_POLICY`, `User`, `logger`

### `packages/core/backend/src/identity_access/tenant_member_views.py`

- Classes:
  - `TenantInviteAcceptView` -> methods: `post`
  - `TenantInvitesCombinedView` -> methods: `get`, `post`
  - `TenantMemberListView` -> methods: `get`
  - `TenantMemberRemoveView` -> methods: `delete`
- Functions:
  - `_get_request_tenant`, `_get_request_tenant_role`, `_require_tenant_role`

### `packages/core/backend/src/identity_access/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/tests/test_admin_mail_oauth.py`

- Classes:
  - `AdminMailOAuthCallbackTests` -> methods: `_callback_url`, `_seed_session`, `setUp`, `test_callback_rejects_expired_state`, `test_callback_rejects_mismatched_state`, `test_callback_rejects_oauth_error_param`, `test_callback_saves_refresh_token_and_audit_log`
  - `AdminMailOAuthConnectTests` -> methods: `_connect_url`, `setUp`, `test_connect_view_redirects_to_google`, `test_connect_view_rejects_missing_client_secret`, `test_connect_view_rejects_non_gmail_provider`, `test_connect_view_sets_session_state`, `test_non_staff_cannot_access_connect_view`
  - `AdminMailOAuthRevokeTests` -> methods: `_revoke_url`, `setUp`, `test_revoke_clears_oauth_timestamps`, `test_revoke_clears_refresh_token`, `test_revoke_creates_audit_log`
  - `AdminSendTestEmailActionTests` -> methods: `setUp`, `test_send_test_email_action_calls_send_test_email`, `test_send_test_email_action_no_email_shows_error`
- Functions:
  - `_make_signed_state`
- Top-level variables:
  - `TEST_FERNET_KEY`, `User`

### `packages/core/backend/src/identity_access/tests/test_capabilities_soc.py`

- Classes:
  - `ServiceOpsCenterCapabilityTests` -> methods: `setUp`, `test_capability_bootstrap_includes_operations_center_route`, `test_internal_admin_includes_service_ops_center_ability`, `test_internal_admin_navigation_includes_operations_center_route`

### `packages/core/backend/src/identity_access/tests/test_dnse_credential.py`

- Classes:
  - `DNSECredentialViewTests` -> methods: `setUp`, `test_admin_can_set_system_provider`, `test_delete_removes_credential`, `test_get_returns_metadata_only`, `test_non_admin_cannot_set_system_provider`, `test_post_creates_credential_without_leaking_secrets`, `test_post_missing_fields_returns_400`, `test_unauthenticated_returns_401`
  - `UserDNSECredentialModelTests` -> methods: `setUp`, `test_get_system_provider_credentials_none_when_no_system`, `test_get_system_provider_credentials_returns_tuple`, `test_set_and_get_credentials_round_trip`, `test_stored_bytes_are_not_plaintext`
- Top-level variables:
  - `TEST_FERNET_KEY`

### `packages/core/backend/src/identity_access/tests/test_dnse_credential_integration.py`

- Classes:
  - `DNSECredentialEncryptionTest` -> methods: `setUp`, `test_credential_round_trip`, `test_encrypted_bytes_differ_from_plaintext`, `test_get_system_provider_credentials_found`, `test_get_system_provider_credentials_not_found`

### `packages/core/backend/src/identity_access/tests/test_email_tasks.py`

- Classes:
  - `EmailTaskIntegrationTests` -> methods: `setUp`, `tearDown`, `test_password_reset_view_calls_async_task`, `test_register_view_calls_async_task`
  - `EmailVerificationTokenTaskTests` -> methods: `setUp`, `test_send_email_verification_token_default_frontend_url`, `test_send_email_verification_token_failure`, `test_send_email_verification_token_success`
  - `PasswordResetEmailTaskTests` -> methods: `setUp`, `test_send_password_reset_email_default_frontend_url`, `test_send_password_reset_email_failure`, `test_send_password_reset_email_success`

### `packages/core/backend/src/identity_access/tests/test_login_upgrade.py`

- Classes:
  - `SaaSUserLoginUpgradeTests` -> methods: `setUp`, `test_login_inactive_user`, `test_login_invalid_credentials`, `test_login_rate_limiting_ip`, `test_login_rate_limiting_user`, `test_login_service_account_inactive`, `test_login_success_email`, `test_login_success_username`, `test_login_tenant_not_found`, `test_login_validation_missing_fields`, `test_refresh_token_invalid`, `test_refresh_token_missing`, `test_refresh_token_success`
- Top-level variables:
  - `User`

### `packages/core/backend/src/identity_access/tests/test_operator_mail_config.py`

- Classes:
  - `OperatorMailConfigAPITests` -> methods: `setUp`, `test_activate_config_and_concurrency_deactivation`, `test_create_gmail_dwd_configuration`, `test_create_smtp_configuration`, `test_delete_active_config_blocked`, `test_permission_gates`, `test_retrieve_and_update_configuration`, `test_test_connection_endpoint`, `test_validation_errors`
- Top-level variables:
  - `TEST_FERNET_KEY`, `User`

### `packages/core/backend/src/identity_access/tests/test_password_reset.py`

- Classes:
  - `PasswordResetTokenModelTests` -> methods: `setUp`, `test_cleanup_expired`, `test_generate_and_save_creates_token`, `test_is_expired_property`, `test_is_valid_property`, `test_token_hash_uniqueness`, `test_token_persists_across_sessions`, `test_verify_and_mark_used_already_used`, `test_verify_and_mark_used_expired`, `test_verify_and_mark_used_invalid_token`, `test_verify_and_mark_used_success`
  - `PasswordResetViewTests` -> methods: `setUp`, `test_password_reset_confirm_already_used`, `test_password_reset_confirm_expired_token`, `test_password_reset_confirm_invalid_token`, `test_password_reset_confirm_short_password`, `test_password_reset_confirm_success`, `test_password_reset_flow_end_to_end`, `test_password_reset_request_creates_db_token`, `test_password_reset_request_no_user_enumeration`

### `packages/core/backend/src/identity_access/tests/test_register_upgrade.py`

- Classes:
  - `SaaSUserRegistrationSpamProtectionTests` -> methods: `setUp`, `test_backfill_missing_tenants_command`, `test_disposable_domain_validation_blocked`, `test_happy_path_registration_atomic_provisioning`, `test_honeypot_field_validation_blocked`, `test_tc_chaos_failover_02_google_api_crash_fallback`, `test_tc_concurrency_01_active_mail_config_constraint`, `test_tc_migration_key_05_credential_rotation`, `test_tc_outbox_atomic_03_atomic_failure_rollback`, `test_tc_outbox_consume_04_idempotent_event_processing`, `test_turnstile_token_invalid_blocked`
- Top-level variables:
  - `TEST_FERNET_KEY`, `User`

### `packages/core/backend/src/identity_access/tests/test_tenant_resolution_middleware.py`

- Classes:
  - `TenantResolutionMiddlewareIntegrationTests` -> methods: `setUp`, `test_middleware_sets_tenant_and_role_on_request`, `test_middleware_with_different_roles`
  - `TenantResolutionMiddlewareTests` -> methods: `_create_request`, `setUp`, `test_deprovisioned_tenant_returns_403`, `test_exempt_path_bypasses_middleware`, `test_fallback_to_first_member`, `test_fallback_to_tenant_owner`, `test_invalid_x_tenant_id_header_returns_403`, `test_no_tenant_for_user_returns_403`, `test_pat_authentication_disabled_service_account_bypasses`, `test_pat_authentication_invalid_token_bypasses`, `test_pat_authentication_resolves_user`, `test_pat_authentication_revoked_token_bypasses`, `test_superuser_bypass_with_header`, `test_superuser_fallback_to_member_tenant`, `test_superuser_fallback_to_owned_tenant`, `test_suspended_tenant_returns_403`, `test_unauthenticated_user_bypasses_middleware`, `test_valid_x_tenant_id_header_with_member`, `test_valid_x_tenant_id_header_with_owner`, `test_x_tenant_id_header_user_not_member_returns_403`
- Functions:
  - `_parse_json_response`
- Top-level variables:
  - `User`

### `packages/core/backend/src/identity_access/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/identity_access/views/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/views/helpers.py`

- Classes:
  - `AuthBootstrapThrottle`
- Functions:
  - `_build_abilities`, `_build_auth_payload`, `_build_capabilities_payload`, `_build_entitlements`, `_build_navigation`, `_build_target`, `_current_user_config`, `_human_session_pat_expires_at`, `_human_session_pat_lifetime`, `_normalize_user_config_payload`, `_resolve_request_service_account`, `_service_account_payload`, `_tenant_payload`, `_user_payload`, `success_response`
- Top-level variables:
  - `DEFAULT_HUMAN_SESSION_PAT_HOURS`, `TENANT_PERMISSION_CLASSES`, `_DEFAULT_USER_CONFIG`, `_USER_CONFIG_STORE`, `logger`

### `packages/core/backend/src/identity_access/views/login.py`

- Functions:
  - `login_view`, `logout_view`, `refresh_token_view`
- Top-level variables:
  - `User`, `logger`

### `packages/core/backend/src/identity_access/views/password_reset.py`

- Functions:
  - `password_reset_confirm_view`, `password_reset_request_view`
- Top-level variables:
  - `User`, `logger`

### `packages/core/backend/src/identity_access/views/profile.py`

- Functions:
  - `capabilities_view`, `profile_view`, `user_config_view`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/identity_access/views/register.py`

- Functions:
  - `register_view`, `resend_email_verification_view`, `verify_email_view`
- Top-level variables:
  - `User`, `logger`

### `packages/core/backend/src/identity_access/views_auth.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/views_operator.py`

- Classes:
  - `MailConfigCursorPagination`
  - `OperatorMailConfigActivateView` -> methods: `post`
  - `OperatorMailConfigDetailView` -> methods: `_get_config`, `delete`, `get`, `patch`
  - `OperatorMailConfigListView` -> methods: `get`, `post`
  - `OperatorMailConfigTestView` -> methods: `post`
- Functions:
  - `success_response`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/identity_access/views_tenant.py`

- Classes:
  - `PartnerUsageMetersView` -> methods: `list`
  - `PATListView` -> methods: `get_queryset`
  - `ServiceAccountDetailView` -> methods: `_ensure_not_last_active_service_account`, `get_object`, `get_queryset`, `perform_destroy`, `perform_update`
  - `ServiceAccountListView` -> methods: `get_queryset`, `perform_create`
  - `TenantDetailView` -> methods: `get_object`
  - `UserProfileView` -> methods: `get`, `patch`
- Functions:
  - `_get_request_tenant`, `_get_request_tenant_role`, `_is_human_session_pat`, `_normalize_scope_codes`, `_reject_human_session_markers`, `_require_partner_scope`, `_require_tenant_role`, `_resolve_issue_target_service_account`, `_serialize_partner_pat`, `_validate_requested_pat_scopes`, `issue_pat`, `partner_issue_pat`, `partner_revoke_pat`, `partner_rotate_pat`
- Top-level variables:
  - `HUMAN_SESSION_PAT_AUDIT_REASON`, `HUMAN_SESSION_PAT_LABEL_PREFIX`, `PARTNER_SCOPE_MANAGE_PATS`, `PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS`, `PARTNER_SCOPE_MANAGE_TENANT`, `TENANT_PERMISSION_CLASSES`

### `packages/core/backend/src/market_data/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/market_data/admin.py`

- Classes:
  - `DailyPriceAdmin`
  - `StockProfileAdmin`
  - `VnbrokerRuntimeConfigAdmin`

### `packages/core/backend/src/market_data/admin_sync_views.py`

- Classes:
  - `AdminOpsMarketGroupsPreviewView` -> methods: `get`
  - `AdminOpsMarketGroupsSyncView` -> methods: `post`
  - `AdminOpsSystemDefaultsSeedView` -> methods: `post`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/market_data/apps.py`

- Classes:
  - `MarketDataConfig`

### `packages/core/backend/src/market_data/core_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_data/default_groups.py`

- Functions:
  - `_build_item_payload`, `build_group_payload`, `get_color_palette`, `get_default_groups`, `get_group_lookup`, `get_system_default_group_ids`
- Top-level variables:
  - `STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`, `_SYSTEM_DEFAULT_SYMBOL_GROUP_IDS`

### `packages/core/backend/src/market_data/global_symbol_coverage.py`

- Functions:
  - `_build_daily_prices_payload`, `_build_intraday_payload`, `_build_missing_ranges`, `_build_priority_reason`, `_build_requested_window`, `_build_session_facts_payload`, `_build_snapshot_payload`, `_normalize_dt`, `_normalize_requested_datasets`, `_normalize_requested_symbols`, `_resolve_daily_price_bootstrap_days`, `_resolve_daily_price_state`, `_resolve_intraday_state`, `_resolve_next_action`, `_resolve_planner_reason`, `_resolve_registry`, `_resolve_session_facts_state`, `_resolve_snapshot_state`, `_should_plan_dataset`, `_trade_date_to_datetime`, `_upsert_coverage_row`, `build_gap_inventory`, `build_global_coverage_summary`, `build_global_planner_preview`, `build_symbol_coverage_detail`, `compute_gap_score`, `refresh_gap_scores`, `refresh_global_symbol_coverage`
- Top-level variables:
  - `DATASET_ORDER`, `FRESHNESS_ORDER`, `PLANNER_PROVIDER_CHAIN_BY_DATASET`, `PLANNER_SUPPORTED_MODES`, `TOP_GAP_ORDER`, `_DAILY_PRICE_FRESH_DAYS`, `_DAILY_PRICE_WARM_DAYS`, `_DATASET_WEIGHT`, `_DEMAND_WEIGHT`, `_FRESHNESS_PENALTY`, `_INTRADAY_FRESH_WINDOW`, `_INTRADAY_WARM_WINDOW`, `_NEXT_ACTION_BY_DATASET`, `_SESSION_FACTS_FRESH_WINDOW`, `_SESSION_FACTS_WARM_WINDOW`, `_SNAPSHOT_FRESH_WINDOW`, `_SNAPSHOT_WARM_WINDOW`, `_TIER_WEIGHT`

### `packages/core/backend/src/market_data/global_symbol_planner.py`

- Functions:
  - `_apply_intraday_depth_policy`, `_build_parent_run_log_input`, `_format_run_id`, `_normalize_execution_mode`, `_partition_plan_items`, `create_global_planner_run`, `execute_global_planner_run`
- Top-level variables:
  - `INTRADAY_DEPTH_POLICY_BY_QUEUE_TIER`, `SUPPORTED_EXECUTION_DATASETS`, `SUPPORTED_EXECUTION_MODES`

### `packages/core/backend/src/market_data/global_symbol_registry.py`

- Functions:
  - `_build_raw_system_default_source_ref`, `_build_registry_projection`, `_build_registry_state_payload`, `_coerce_metadata`, `_get_decay_days`, `_normalize_source_ref`, `_normalize_source_type`, `_resolve_priority_tier`, `_resolve_registry_drift_fields`, `_resolve_weight`, `_serialize_date`, `_serialize_datetime`, `_summarize_coverage`, `build_admin_group_source_ref`, `build_global_symbol_registry_detail`, `build_global_symbol_registry_reconcile_preview`, `build_global_symbol_registry_summary`, `build_holding_source_ref`, `build_price_alert_source_ref`, `build_system_default_source_ref`, `build_tracked_symbol_source_ref`, `build_watchlist_source_ref`, `deactivate_global_symbol_demand`, `normalize_symbol`, `refresh_global_symbol_registry`, `sync_admin_group_symbol_set`, `sync_global_source_symbol_set`, `sync_holding_demand_for_portfolio_symbol`, `sync_price_alert_demand`, `sync_system_default_symbol_group`, `sync_tracked_symbol_demand`, `sync_watchlist_item_demand`, `upsert_global_symbol_demand`
- Top-level variables:
  - `COVERAGE_STATE_ORDER`, `FRESHNESS_RANK`, `FRESHNESS_STATE_ORDER`, `HOT_SOURCE_TYPES`, `PRIORITY_TIER_ORDER`, `REGISTRY_PROJECTION_FIELDS`, `SYSTEM_DEFAULT_GROUP_ID_ALIASES`, `VALID_SOURCE_TYPES`, `WARM_SOURCE_TYPES`

### `packages/core/backend/src/market_data/legacy_views.py`

- Classes:
  - `PriceAlertDetailView` -> methods: `delete`, `patch`
  - `PriceAlertsView` -> methods: `get`, `post`
  - `PriceAlertTriggerView` -> methods: `post`
  - `StockManagementGroupsView` -> methods: `get`
  - `StockManagementSeedView` -> methods: `post`
  - `StockManagementSyncView` -> methods: `post`
  - `TrackedSymbolBulkThresholdView` -> methods: `post`
  - `TrackedSymbolDetailView` -> methods: `delete`, `patch`
  - `TrackedSymbolsView` -> methods: `get`, `post`
- Functions:
  - `_empty_list`, `_empty_paginated`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`

### `packages/core/backend/src/market_data/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_data/migrations/0002_intradaybar_intradaytick_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_data/migrations/0003_globalsymbolregistry_globalsymbolcoverage_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_data/migrations/0004_add_gap_score_fields.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_data/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/market_data/models.py`

- Classes:
  - `DailyPrice` -> methods: `__str__`
  - `GlobalSymbolCoverage` -> methods: `__str__`
  - `GlobalSymbolDemandSource` -> methods: `__str__`
  - `GlobalSymbolRegistry` -> methods: `__str__`
  - `IntradayBar` -> methods: `__str__`
  - `IntradayTick` -> methods: `__str__`
  - `StockProfile` -> methods: `__str__`
  - `VnbrokerRuntimeConfig` -> methods: `__str__`

### `packages/core/backend/src/market_data/promotion_fast_path.py`

- Functions:
  - `_get_sla_countdown`, `enqueue_promotion_repair`, `handle_symbol_promotion`, `should_enqueue_promotion_repair`
- Top-level variables:
  - `_DEDUP_WINDOW_SECONDS`, `_PROMOTION_SLA_SECONDS`, `logger`

### `packages/core/backend/src/market_data/public_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_data/serializers.py`

- Classes:
  - `DailyPriceSerializer`
  - `StockProfileSerializer`

### `packages/core/backend/src/market_data/stock_mgmt_native_views.py`

- Classes:
  - `StockManagementAdvisoryCompDetailView` -> methods: `delete`, `get`
  - `StockManagementAdvisoryCompRefreshView` -> methods: `post`
  - `StockManagementAdvisoryCompRestoreView` -> methods: `post`
  - `StockManagementAdvisoryCompToggleView` -> methods: `post`
  - `StockManagementAIAdvisoryComponentsDeletedView` -> methods: `delete`, `get`
  - `StockManagementAIAdvisoryComponentsGenerateView` -> methods: `post`
  - `StockManagementAIAdvisoryObservabilityView` -> methods: `get`, `post`
  - `StockManagementAIAdvisorySessionView` -> methods: `get`, `post`
  - `StockManagementAIAdvisorySummaryDetailView` -> methods: `delete`
  - `StockManagementAIAdvisorySummaryRegenerateView` -> methods: `post`
  - `StockManagementChartView` -> methods: `get`
  - `StockManagementDarkMoneyHistoryView` -> methods: `get`
  - `StockManagementDetailView` -> methods: `get`
  - `StockManagementFinancialsView` -> methods: `get`
  - `StockManagementGroupDetailView` -> methods: `delete`, `get`, `patch`
  - `StockManagementGroupItemsView` -> methods: `get`
  - `StockManagementGroupsView` -> methods: `get`
  - `StockManagementItemDetailView` -> methods: `delete`, `get`
  - `StockManagementNewsAISummaryView` -> methods: `get`, `post`
  - `StockManagementNewsView` -> methods: `get`
  - `StockManagementOHLCVBarsView` -> methods: `get`
  - `StockManagementOrderFlowView` -> methods: `get`
  - `StockManagementOverviewView` -> methods: `get`
  - `StockManagementPortfolioNewsDigestView` -> methods: `get`
  - `StockManagementPriceAlertDetailView` -> methods: `delete`, `patch`
  - `StockManagementPriceAlertsView` -> methods: `get`, `post`
  - `StockManagementPriceAlertTriggerView` -> methods: `post`
  - `StockManagementSeedView` -> methods: `post`
  - `StockManagementStockListView` -> methods: `get`
  - `StockManagementSyncView` -> methods: `post`
  - `StockManagementTechnicalsView` -> methods: `_build_response`, `_parse_symbols`, `get`, `post`
  - `StockManagementTrackedSymbolBulkThresholdView` -> methods: `post`
  - `StockManagementTrackedSymbolDetailView` -> methods: `delete`, `patch`
  - `StockManagementTrackedSymbolsView` -> methods: `get`, `post`
- Functions:
  - `_aggregate_daily_rows`, `_aggregate_daily_to_ohlcv_bars`, `_ai_context_snapshot`, `_build_ai_session_payload`, `_build_dark_money_strategy_table`, `_build_native_observability_payload`, `_build_observability_snapshot`, `_build_price_change_map`, `_build_profile_map`, `_build_summary_from_components`, `_build_tick_distribution_payload`, `_build_watchlist_membership_payload`, `_compute_chart_technical_payload`, `_compute_rsi14`, `_compute_simple_moving_average`, `_default_chart_technical_payload`, `_default_component_templates`, `_dict_list`, `_dt_to_unix_ms`, `_ensure_advisory_record_for_symbol`, `_extract_signal_strength`, `_fetch_ohlcv_bars_after`, `_fetch_ohlcv_bars_before`, `_fetch_ohlcv_bars_window`, `_fetch_symbol_snapshot_payload`, `_find_component_context`, `_find_component_record`, `_find_symbol_advisory_record`, `_float_value`, `_floor_dark_money_bucket`, `_get_price_alert_or_404_for_user`, `_get_table_column_names`, `_get_tracked_symbol_or_404_for_user`, `_get_watchlist_item_or_404_for_user`, `_get_watchlist_or_404_for_user`, `_group_sort_key`, `_int_value`, `_interval_for_timeframe`, `_latest_ai_record`, `_normalize_ai_symbol`, `_normalize_component_collection`, `_normalize_component_item`, `_normalize_dark_money_interval`, `_normalize_dark_money_period`, `_normalize_order_flow_window`, `_normalize_timeframe`, `_ohlcv_bar_from_daily`, `_ohlcv_bar_from_intraday`, `_parse_cooldown_seconds`, `_parse_ohlcv_ts`, `_parse_price_alert_condition`, `_parse_price_alert_target`, `_parse_tracked_symbol_threshold_million`, `_price_alerts_queryset_for_user`, `_resolve_user_tenant`, `_round_or_none`, `_safe_numeric`, `_save_advisory_context`, `_serialize_price_alert_row`, `_serialize_price_point`, `_serialize_stock_management_group`, `_serialize_stock_management_item`, `_serialize_stock_order_flow_signal`, `_serialize_tracked_symbol_row`, `_symbol_exists_for_stock_chart`, `_to_float`, `_to_int`, `_to_unix_seconds`, `_tracked_symbols_queryset_for_user`, `_update_component_lists`, `_upsert_ai_components`, `_validate_stock_symbol`, `_watchlist_items_queryset_for_user`, `_watchlists_queryset_for_user`, `clean_nan`, `seed_default_watchlist_groups`
- Top-level variables:
  - `TENANT_PERMISSION_CLASSES`, `_DARK_MONEY_INTERVAL_ALIASES`, `_DARK_MONEY_INTRADAY_MAX_DAYS`, `_DARK_MONEY_PERIOD_DAYS`, `_OHLCV_BAR_LIMIT_DEFAULT`, `_OHLCV_BAR_LIMIT_MAX`, `_OHLCV_INTRADAY_TIMEFRAMES`, `_OHLCV_VALID_TIMEFRAMES`, `_PORTFOLIO_NEWS_DIGEST_SCHEMA`, `_STOCK_CHART_SCHEMA`, `_STOCK_DARK_MONEY_HISTORY_SCHEMA`, `_STOCK_FINANCIALS_SCHEMA`, `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`, `_STOCK_MANAGEMENT_GROUP_LIST_SCHEMA`, `_STOCK_MANAGEMENT_GROUP_SCHEMA`, `_STOCK_MANAGEMENT_ITEM_SCHEMA`, `_STOCK_NEWS_AI_SUMMARY_SCHEMA`, `_STOCK_NEWS_STUB_SCHEMA`, `_STOCK_ORDER_FLOW_SCHEMA`, `_STOCK_OVERVIEW_SCHEMA`, `_STOCK_PROFILE_SCHEMA`, `_SYSTEM_DEFAULT_SYMBOL_GROUP_IDS`, `_TRACKED_SYMBOL_BULK_THRESHOLD_REQUEST_SCHEMA`, `_TRACKED_SYMBOL_BULK_THRESHOLD_RESPONSE_SCHEMA`, `_TRACKED_SYMBOL_CREATE_REQUEST_SCHEMA`, `_TRACKED_SYMBOL_LIST_SCHEMA`, `_TRACKED_SYMBOL_PATCH_REQUEST_SCHEMA`, `_TRACKED_SYMBOL_SCHEMA`

### `packages/core/backend/src/market_data/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/market_data/tests/test_gap_first_planner.py`

- Classes:
  - `GapFirstPlannerSortTest` -> methods: `setUp`, `test_fresh_symbols_may_be_skipped`, `test_gap_score_attached_to_items`, `test_gap_score_ordering`, `test_missing_coverage_row_gets_default_score`
- Functions:
  - `_coverage`, `_registry`

### `packages/core/backend/src/market_data/tests/test_gap_inventory.py`

- Classes:
  - `BuildGapInventoryTest` -> methods: `setUp`, `test_demand_source_filter`, `test_limit_respected`, `test_min_score_filter`, `test_result_contains_expected_fields`, `test_returns_sorted_by_gap_score`
  - `ComputeGapScoreTest` -> methods: `test_fresh_symbol_hot_tier_baseline`, `test_gap_days_adds_points`, `test_missing_symbol_low_tier`, `test_score_capped_at_100`, `test_score_minimum_zero`
  - `RefreshGapScoresTest` -> methods: `setUp`, `test_missing_symbol_gets_higher_score_than_fresh`, `test_priority_reason_populated`, `test_refresh_updates_scores`
- Functions:
  - `_make_coverage`, `_make_registry`

### `packages/core/backend/src/market_data/tests/test_global_symbol_coverage.py`

- Classes:
  - `GlobalSymbolCoverageServiceTestCase` -> methods: `_ensure_registry`, `test_build_global_coverage_summary_aggregates_by_dataset`, `test_build_global_planner_preview_bootstraps_missing_daily_prices_with_days_window`, `test_build_global_planner_preview_clamps_daily_bootstrap_to_max`, `test_build_global_planner_preview_falls_back_to_default_for_invalid_bootstrap_setting`, `test_build_global_planner_preview_requires_explicit_force_refresh`, `test_build_global_planner_preview_strict_fresh_includes_warm_daily_only`, `test_build_global_planner_preview_uses_gap_window_for_stale_non_daily_and_trade_date_for_force`, `test_build_global_planner_preview_uses_missing_only_policy`, `test_refresh_global_symbol_coverage_marks_snapshot_and_session_facts_warm`, `test_refresh_global_symbol_coverage_marks_stale_and_missing_datasets`, `test_refresh_global_symbol_coverage_populates_all_dataset_rows`

### `packages/core/backend/src/market_data/tests/test_global_symbol_planner.py`

- Classes:
  - `GlobalSymbolPlannerRunTests` -> methods: `_create_intraday_gaps`, `_create_registry_with_daily_gap`, `_create_session_facts_gap`, `_create_snapshot_gap`, `setUpTestData`, `test_create_global_planner_run_applies_queue_tier_intraday_depth_policy`, `test_create_global_planner_run_carries_scheduler_context_and_queue`, `test_create_global_planner_run_executes_intraday_sync`, `test_create_global_planner_run_executes_price_board_snapshot_sync`, `test_create_global_planner_run_executes_session_facts_sync`, `test_create_global_planner_run_executes_sync_and_updates_audit`, `test_create_global_planner_run_queues_async_run_log`

### `packages/core/backend/src/market_data/tests/test_global_symbol_registry.py`

- Classes:
  - `GlobalSymbolRegistrySignalTestCase` -> methods: `setUp`, `test_admin_group_sync_deactivates_removed_symbols`, `test_deactivate_rejects_invalid_source_contract`, `test_price_alert_signal_syncs_and_deactivates_demand_edge`, `test_sync_global_source_symbol_set_normalizes_and_validates_source_contract`, `test_system_default_sync_canonicalizes_vn100_and_deactivates_top100_alias`, `test_tracked_symbol_signal_syncs_and_deactivates_demand_edge`, `test_transaction_signals_sync_holdings_per_portfolio_symbol`, `test_upsert_rejects_empty_source_ref`, `test_upsert_rejects_invalid_source_type`, `test_watchlist_item_signal_creates_and_decays_registry_edge`
- Top-level variables:
  - `User`

### `packages/core/backend/src/market_data/tests/test_intraday_prices_api.py`

- Classes:
  - `IntradayPricesApiTestCase` -> methods: `setUp`, `setUpTestData`, `test_intraday_prices_reads_db_bars_without_provider_call`, `test_intraday_prices_returns_empty_payload_when_db_missing`
- Top-level variables:
  - `User`

### `packages/core/backend/src/market_data/tests/test_intraday_tape_api.py`

- Classes:
  - `IntradayTapeApiTestCase` -> methods: `setUp`, `setUpTestData`, `test_intraday_tape_reads_latest_db_session_without_provider_call`, `test_intraday_tape_returns_safe_empty_payload_when_db_missing`
- Top-level variables:
  - `User`

### `packages/core/backend/src/market_data/tests/test_intraday_tick_presence.py`

- Classes:
  - `IntradayTickPresenceTest` -> methods: `_create_tick`, `test_bulk_create_ignore_conflicts`, `test_empty_ticks_no_db_write`, `test_filter_by_timestamp_date`

### `packages/core/backend/src/market_data/tests/test_ohlcv_bars_native_api.py`

- Classes:
  - `OHLCVBarsAuthTestCase` -> methods: `test_unauthenticated_returns_401`
  - `OHLCVBarsCursorAfterTestCase` -> methods: `_ts_for_date`, `setUp`, `setUpTestData`, `test_cursor_after_returns_bars_after_timestamp`, `test_has_more_before_true_when_data_before_cutoff`
  - `OHLCVBarsCursorBeforeTestCase` -> methods: `_ts_for_date`, `setUp`, `setUpTestData`, `test_cursor_before_returns_bars_before_timestamp`, `test_has_more_after_false_when_no_newer_data`, `test_has_more_before_true_when_more_data_exists`, `test_iso8601_before_accepted`, `test_limit_is_respected`
  - `OHLCVBarsDefaultModeTestCase` -> methods: `setUp`, `setUpTestData`, `test_bars_are_ascending_by_timestamp`, `test_bars_have_required_fields`, `test_default_returns_200_with_bar_shape`, `test_snapshot_id_echoed_back`
  - `OHLCVBarsIntradayTestCase` -> methods: `setUp`, `setUpTestData`, `test_bars_timestamp_is_unix_ms`, `test_intraday_bars_returned_for_1h_timeframe`
  - `OHLCVBarsValidationTestCase` -> methods: `setUp`, `setUpTestData`, `test_30m_timeframe_not_valid_for_bars`, `test_invalid_after_timestamp_returns_400`, `test_invalid_before_timestamp_returns_400`, `test_invalid_limit_string_returns_400`, `test_invalid_timeframe_returns_400`, `test_limit_exceeds_max_returns_400`, `test_limit_zero_returns_400`, `test_mode_conflict_before_and_after_returns_400`, `test_mode_conflict_window_and_before_returns_400`, `test_unknown_symbol_returns_404`, `test_window_mode_missing_to_returns_400`
  - `OHLCVBarsWeeklyTestCase` -> methods: `setUp`, `setUpTestData`, `test_weekly_bars_aggregated`
  - `OHLCVBarsWindowModeTestCase` -> methods: `_ts_for_date`, `setUp`, `setUpTestData`, `test_window_mode_returns_bars_in_range`, `test_window_returns_has_more_both_directions`
- Functions:
  - `_make_daily_row`, `_make_intraday_bar`
- Top-level variables:
  - `User`, `_URL`

### `packages/core/backend/src/market_data/tests/test_promotion_fast_path.py`

- Classes:
  - `EnqueuePromotionRepairTest` -> methods: `test_cold_does_not_enqueue`, `test_hot_enqueues_with_mock`, `test_warm_enqueues_with_countdown`
  - `HandleSymbolPromotionTest` -> methods: `test_cold_to_hot_enqueues`, `test_demotion_not_triggered`, `test_new_symbol_no_previous_tier`, `test_no_tier_change_not_triggered`
  - `ShouldEnqueueTest` -> methods: `test_cold_tier_returns_false`, `test_fresh_coverage_returns_false`, `test_no_coverage_row_returns_true`, `test_recently_verified_dedup_returns_false`, `test_stale_hot_returns_true`
  - `SlaCountdownTest` -> methods: `test_case_insensitive`, `test_cold_returns_minus1`, `test_empty_returns_minus1`, `test_hot_is_immediate`, `test_warm_is_300s`
- Functions:
  - `_coverage`, `_registry`

### `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py`

- Classes:
  - `StockManagementNativeApiTestCase` -> methods: `setUp`, `setUpTestData`, `test_ai_advisory_generate_routes_to_native_manual_trigger`, `test_ai_advisory_session_reads_native_advisory_record`, `test_core_v1_ai_advisory_component_route_rejects_malformed_advisory_id`, `test_core_v1_ai_advisory_component_routes_require_advisory_id_when_ids_collide`, `test_core_v1_ai_advisory_generate_routes_to_native_manual_trigger`, `test_core_v1_ai_advisory_routes_block_suspended_tenant`, `test_core_v1_ai_advisory_session_does_not_leak_other_users_record`, `test_core_v1_ai_advisory_session_post_routes_to_native_manual_trigger`, `test_core_v1_ai_advisory_session_reads_native_advisory_record`, `test_core_v1_ai_advisory_support_routes_are_native`, `test_core_v1_groups_list_route_matches_public_contract`, `test_core_v1_groups_route_blocks_suspended_tenant`, `test_core_v1_groups_route_blocks_suspended_tenant_member`, `test_core_v1_groups_seed_detail_and_items_routes_are_native`, `test_core_v1_market_data_technicals_bulk_route_returns_native_contract`, `test_core_v1_portfolio_news_digest_route_matches_public_contract`, `test_core_v1_price_alert_routes_are_native`, `test_core_v1_stock_chart_route_matches_public_contract`, `test_core_v1_stock_dark_money_history_route_matches_public_contract`, `test_core_v1_stock_financials_route_matches_public_contract`, `test_core_v1_stock_management_mutation_and_detail_routes_block_suspended_tenant`, `test_core_v1_stock_news_ai_summary_route_matches_public_contract`, `test_core_v1_stock_news_route_matches_public_contract`, `test_core_v1_stock_order_flow_route_matches_public_contract`, `test_core_v1_stock_overview_route_matches_public_contract`, `test_core_v1_stock_profile_route_matches_public_contract`, `test_core_v1_sync_route_user_scope_through_global_planner`, `test_core_v1_tracked_symbol_create_accepts_daily_price_only_symbol`, `test_core_v1_tracked_symbol_mutation_routes_are_native`, `test_core_v1_tracked_symbols_list_route_matches_public_contract`, `test_core_v1_tracked_symbols_list_route_requires_authentication`, `test_groups_seed_detail_and_items_are_native`, `test_price_alert_endpoints_are_native`, `test_stock_chart_accepts_30m_timeframe_alias`, `test_stock_chart_reads_daily_prices_with_native_envelope`, `test_stock_chart_reads_intraday_bars_from_native_core_tables`, `test_stock_chart_returns_envelope_when_no_native_candles`, `test_stock_chart_returns_not_found_when_symbol_absent_from_all_sources`, `test_stock_chart_uses_market_data_even_when_profile_missing`, `test_stock_dark_money_history_returns_native_envelope`, `test_stock_management_technicals_bulk_returns_compatible_technical_payload`, `test_stock_order_flow_returns_empty_shape_without_alerts`, `test_stock_order_flow_returns_radar_contract_fields`, `test_stock_overview_maps_native_watchlist_tracking_fields`, `test_stock_overview_prefers_native_tracked_symbol_source_group`, `test_stock_overview_returns_object_envelope_without_snapshot`, `test_stock_overview_works_without_profile_if_daily_price_exists`, `test_stock_search_is_native_and_paginated`, `test_sync_routes_user_scope_through_global_planner`, `test_tracked_symbol_endpoints_are_native`
- Top-level variables:
  - `User`

### `packages/core/backend/src/market_data/tests/test_vnbroker_adapter_history.py`

- Classes:
  - `FetchIntradayTapeHistoryErrorTests` -> methods: `test_constructor_exception_returns_empty`, `test_returns_empty_list_on_dnse_exception`, `test_returns_empty_list_when_dnse_returns_empty_df`, `test_returns_empty_list_when_dnse_returns_none`
  - `FetchIntradayTapeHistoryShapeTests` -> methods: `test_returns_list_of_dicts_with_required_keys`, `test_source_label_propagated`
  - `FetchIntradayTapeHistorySideTests` -> methods: `_run_with_side`, `test_b_normalized_to_buy`, `test_bu_normalized_to_buy`, `test_buy_string_normalized`, `test_empty_side_normalized`, `test_s_normalized_to_sell`, `test_sd_normalized_to_sell`, `test_sell_string_normalized`, `test_unknown_side_normalized`
  - `FetchIntradayTapeHistoryTimestampTests` -> methods: `test_naive_utc_timestamp_gets_utc_tzinfo`, `test_tz_aware_timestamp_converted_to_utc`
- Functions:
  - `_make_trades_df`

### `packages/core/backend/src/market_data/tests/test_vnbroker_benchmark.py`

- Classes:
  - `VnbrokerBenchmarkTests` -> methods: `test_run_price_board_provider_benchmark_builds_cached_report`

### `packages/core/backend/src/market_data/tests/test_vnbroker_daily_history_guard.py`

- Classes:
  - `VnbrokerDailyHistoryGuardTests` -> methods: `test_explicit_dnse_source_is_hard_disabled_and_never_reaches_provider`, `test_runtime_dnse_source_falls_back_to_vci_for_daily_history`

### `packages/core/backend/src/market_data/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_data/views.py`

- Classes:
  - `DailyPriceListView` -> methods: `get`
  - `IntradayPricesView` -> methods: `get`
  - `IntradayTapeView` -> methods: `get`
  - `StockChartView` -> methods: `get`
  - `StockProfileDetailView` -> methods: `get`
  - `StockProfileListView` -> methods: `get`
  - `TrackedSymbolsView` -> methods: `get`, `post`

### `packages/core/backend/src/market_data/vnbroker_adapter.py`

- Classes:
  - `_RateLimitWatcher` -> methods: `__init__`, `emit`
  - `DnseRateLimitError`
  - `VnbrokerAdapterError`
- Functions:
  - `_build_intraday_source_candidates`, `_build_listing_seed_rows`, `_extract_listing_records`, `_fetch_intraday_frame`, `_fetch_realtime_price_with_quote_class`, `_load_listing_adapter_class`, `_load_quote_class`, `_normalize_intraday_trade_rows`, `_normalize_listing_rows`, `_normalize_supported_source`, `_publish_intraday_stream`, `_resolve_daily_history_source`, `_resolve_realtime_source`, `_slice_listing_symbols`, `fetch_company_financials`, `fetch_company_info`, `fetch_daily_history`, `fetch_intraday_ohlcv`, `fetch_intraday_tape`, `fetch_intraday_tape_history`, `fetch_listing_symbols`, `fetch_price_board_snapshot`, `fetch_price_board_snapshots_batch`, `fetch_realtime_price`, `fetch_rss_news`, `fetch_symbol_group_members`, `get_active_config`, `warm_up_intraday_symbols`
- Top-level variables:
  - `_DAILY_HISTORY_ALLOWED_SOURCES`, `_DAILY_HISTORY_DISABLED_WARN_CODE`, `_DAILY_HISTORY_FALLBACK_SOURCE`, `_DNSE_SIDE_BUY`, `_DNSE_SIDE_SELL`, `_EXCHANGE_BASED_GROUPS`, `_INTRADAY_FALLBACK_SOURCES`, `_LISTING_GROUP_ALIASES`, `_LISTING_SEED_DATA`, `_SUPPORTED_PROVIDER_SOURCES`, `logger`

### `packages/core/backend/src/market_data/vnbroker_benchmark.py`

- Classes:
  - `_Counter` -> methods: `merge`
- Functions:
  - `_benchmark_single_provider_concurrency`, `_is_rate_limited_error`, `_normalize_concurrency_levels`, `_normalize_providers`, `_normalize_runs`, `_pick_best_result`, `_run_worker_once`, `build_runtime_recommendation`, `clear_latest_price_board_benchmark_report`, `get_latest_price_board_benchmark_report`, `run_price_board_provider_benchmark`, `set_latest_price_board_benchmark_report`, `utc_now_iso`
- Top-level variables:
  - `BENCHMARK_CACHE_KEY`, `BENCHMARK_CACHE_TTL_SECONDS`, `DEFAULT_CONCURRENCY_LEVELS`, `DEFAULT_PROVIDERS`, `SUPPORTED_PROVIDERS`

### `packages/core/backend/src/market_serving/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/market_serving/admin.py`

- Classes:
  - `SessionFactsAdmin`
  - `SymbolSnapshotAdmin`

### `packages/core/backend/src/market_serving/apps.py`

- Classes:
  - `MarketServingConfig`

### `packages/core/backend/src/market_serving/legacy_views.py`

- Classes:
  - `RealtimeUnifiedAlertsView` -> methods: `_apply_cursor`, `_apply_window_filter`, `_build_next_cursor`, `_compute_priority_rank`, `_decode_cursor`, `_normalize_severity`, `_normalize_symbols`, `_parse_boolean_flag`, `_parse_limit`, `_parse_severity_min`, `_parse_watchlist_group_ids`, `_parse_window`, `_resolve_scope`, `_safe_parse_ts`, `_sanitize_item`, `_serialize_alerts`, `get`
  - `RealtimeWhaleCampaignsView` -> methods: `_apply_campaign_cursor`, `_build_campaign_next_cursor`, `_build_campaign_response`, `_decode_campaign_cursor`, `_group_events_into_campaigns`, `_parse_campaign_limit`, `_parse_campaign_sort`, `_resolve_campaign_gap_minutes`, `get`
  - `RealtimeWhaleFeedAggregateView` -> methods: `_apply_whale_window_filter`, `_build_entitlements`, `_build_next_cursor`, `_build_response`, `_classify_signal_size`, `_cursor_datetime`, `_decode_cursor`, `_extract_tracked_symbols`, `_has_explicit_scope`, `_parse_sort`, `_resolve_scope`, `_resolve_tracked_symbols`, `_resolve_watchlist_symbols`, `_serialize_whale_record`, `get`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`, `logger`

### `packages/core/backend/src/market_serving/materializers.py`

- Functions:
  - `materialize_pre_open_snapshots`, `materialize_session_facts`, `materialize_symbol_snapshot`, `materialize_unified_alerts`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/market_serving/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_serving/migrations/0002_add_high_low_open_to_symbol_snapshot.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_serving/migrations/0003_add_snapshot_quote_columns_and_backfill.py`

- Classes:
  - `Migration`
- Functions:
  - `_hose_tick_size`, `_round_ceiling_price`, `_round_floor_price`, `add_snapshot_quote_columns_if_missing`, `backfill_snapshot_quote_columns`

### `packages/core/backend/src/market_serving/migrations/0004_add_session_facts_series_by_window.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_serving/migrations/0005_session_facts_bucket_table.py`

- Classes:
  - `Migration`
- Functions:
  - `backfill_session_facts_buckets`

### `packages/core/backend/src/market_serving/migrations/0006_rename_sessionfactsbucket_indexes.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_serving/migrations/0007_sessionfactsbucket_strength_fields.py`

- Classes:
  - `Migration`
- Functions:
  - `_clamp`, `_compute_strength_map`, `_floor_bucket`, `_sigmoid`, `backfill_session_facts_bucket_strengths`
- Top-level variables:
  - `_BASELINE_WINDOW`, `_EPS`, `_WHALE_THRESHOLD_VND`, `_WINDOW_TO_BUCKET_MINUTES`

### `packages/core/backend/src/market_serving/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/market_serving/models.py`

- Classes:
  - `SessionFacts` -> methods: `__str__`
  - `SessionFactsBucket` -> methods: `__str__`
  - `SymbolSnapshot` -> methods: `__str__`

### `packages/core/backend/src/market_serving/native_views.py`

- Classes:
  - `RealtimeBreadthView` -> methods: `get`
  - `RealtimeDataThrottle`
  - `RealtimeDepthChartView` -> methods: `get`
  - `RealtimeIntradayView` -> methods: `get`
  - `RealtimePriceBoardView` -> methods: `get`
  - `RealtimeRvolView` -> methods: `get`
  - `RealtimeSymbolInvestigationView` -> methods: `get`
  - `RealtimeTickerListView` -> methods: `get`
  - `RealtimeTickerView` -> methods: `get`
  - `RealtimeWhaleFeedView` -> methods: `get`
- Functions:
  - `_normalize_trade`, `_serialize_intraday_tick`
- Top-level variables:
  - `_INTRADAY_SIDE_MAP`

### `packages/core/backend/src/market_serving/realtime_prefetch.py`

- Functions:
  - `_acquire_lock`, `_build_universe_snapshot`, `_collect_universe_symbols`, `_get_topology`, `_increment_prefetch_metric`, `_read_int_env`, `_safe_cache_delete`, `_snapshot_is_stale`, `_stable_shard_id`, `prefetch_realtime_ticker_shard`, `schedule_realtime_prefetch_shards`
- Top-level variables:
  - `DEFAULT_COLD_INTERVAL_SECONDS`, `DEFAULT_COLD_SHARDS`, `DEFAULT_HOT_HYDRATE_INTERVAL_SECONDS`, `DEFAULT_HOT_INTERVAL_SECONDS`, `DEFAULT_HOT_SHARDS`, `DEFAULT_UNIVERSE_REFRESH_SECONDS`, `DEFAULT_WARM_HYDRATE_INTERVAL_SECONDS`, `DEFAULT_WARM_INTERVAL_SECONDS`, `DEFAULT_WARM_SHARDS`, `PREFETCH_METRIC_CACHE_PREFIX`, `REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX`, `REALTIME_PREFETCH_QUEUE`, `REALTIME_SHARD_CACHE_PREFIX`, `REALTIME_SHARD_LAST_ENQUEUE_PREFIX`, `REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY`, `__all__`, `logger`

### `packages/core/backend/src/market_serving/serializers.py`

- Classes:
  - `SessionFactsSerializer` -> methods: `get_delta_strength_pct`
  - `SymbolSnapshotSerializer`

### `packages/core/backend/src/market_serving/session_facts_engine.py`

- Functions:
  - `_build_bucket_rows`, `_clamp`, `_compute_session_facts_from_rows`, `_floor_bucket`, `_load_session_rows`, `_percentile`, `_sigmoid`, `compute_session_facts`, `compute_session_facts_for_all_active`
- Top-level variables:
  - `_BASELINE_WINDOW`, `_BUCKET_MINUTES`, `_EPS`, `_SERIES_WINDOWS_BY_LABEL`, `_WHALE_THRESHOLD_VND`, `logger`

### `packages/core/backend/src/market_serving/tasks.py`

- Top-level variables:
  - `__all__`

### `packages/core/backend/src/market_serving/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/market_serving/tests/test_native_views.py`

- Classes:
  - `RealtimeIntradayViewTestCase` -> methods: `setUp`, `setUpTestData`, `test_realtime_intraday_reads_latest_db_session_without_provider_call`, `test_realtime_intraday_returns_safe_empty_payload_when_db_missing`
  - `SessionFactsCvdViewTestCase` -> methods: `setUp`, `setUpTestData`, `test_returns_empty_payload_when_session_facts_missing`, `test_returns_empty_payload_when_window_has_no_bucket_rows`
- Top-level variables:
  - `User`

### `packages/core/backend/src/market_serving/tests/test_realtime_prefetch.py`

- Classes:
  - `RealtimePrefetchHydrateLegTestCase` -> methods: `setUp`, `test_hydrate_enqueued_after_interval_expires`, `test_hydrate_enqueued_when_threshold_elapsed`, `test_hydrate_throttled_within_interval`
  - `RealtimePrefetchUniverseTestCase` -> methods: `setUp`, `test_collect_universe_symbols_uses_global_registry_ssot`

### `packages/core/backend/src/market_serving/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_serving/views.py`

- Classes:
  - `MarketDataThrottle`
  - `SessionFactsCvdView` -> methods: `get`
  - `SessionFactsDetailView` -> methods: `get_object`, `retrieve`
  - `SessionFactsListView` -> methods: `get_queryset`
  - `SymbolSnapshotDetailView` -> methods: `get_object`, `retrieve`
  - `SymbolSnapshotListView` -> methods: `get_queryset`
- Functions:
  - `_build_empty_cvd_payload`, `_delta_strength_pct_from_facts`, `_get_materialized_session_fact_buckets`, `_get_materialized_session_facts`, `_parse_trade_date_param`, `_session_facts_cache_key`, `_snapshot_cache_key`
- Top-level variables:
  - `_CVD_SERIES_CACHE_TTL`, `_SESSION_FACTS_TTL`, `_SNAPSHOT_TTL`, `_WINDOW_TO_BUCKET_MINUTES`, `logger`

### `packages/core/backend/src/market_serving/vnbroker_materializer.py`

- Functions:
  - `_hose_tick_size`, `_normalize_target_symbols`, `_round_ceiling_price`, `_round_floor_price`, `fetch_realtime_tickers_from_vnbroker`, `materialize_symbol_snapshot_from_vnbroker`
- Top-level variables:
  - `_SNAPSHOT_COMPARE_FIELDS`, `logger`

### `packages/core/backend/src/ops_audit/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/ops_audit/admin.py`

- Classes:
  - `AuditEventAdmin` -> methods: `has_add_permission`, `has_change_permission`
  - `RequestTraceAdmin` -> methods: `has_add_permission`, `has_change_permission`

### `packages/core/backend/src/ops_audit/apps.py`

- Classes:
  - `OpsAuditConfig`

### `packages/core/backend/src/ops_audit/middleware.py`

- Classes:
  - `RequestTraceMiddleware` -> methods: `__call__`, `__init__`, `_record_access_event`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/ops_audit/middleware_shadow_run.py`

- Classes:
  - `ShadowRunDualReadMiddleware` -> methods: `__call__`, `__init__`, `_extract_response_body`, `_extract_safe_headers`, `_queue_parity_check`, `_should_monitor`
- Functions:
  - `_compare_structure_recursive`, `compare_json_structure`, `compute_payload_hash`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/ops_audit/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/ops_audit/migrations/0002_phase3_parity_models.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/ops_audit/migrations/0003_delete_paritylog_delete_parityphasecheckpoint_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/ops_audit/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/ops_audit/models.py`

- Classes:
  - `AuditEvent` -> methods: `__str__`
  - `RequestTrace` -> methods: `__str__`

### `packages/core/backend/src/ops_audit/models_parity.py`

- Classes:
  - `ParityLog` -> methods: `__str__`
  - `ParityPhaseCheckpoint` -> methods: `__str__`
  - `ParityReport` -> methods: `__str__`

### `packages/core/backend/src/ops_audit/serializers.py`

- Classes:
  - `AuditEventSerializer`
  - `TenantLifecycleEventSerializer` -> methods: `get_actor_user`, `get_actor_username`

### `packages/core/backend/src/ops_audit/serializers_parity.py`

- Classes:
  - `ParityLogSerializer`
  - `ParityPhaseCheckpointSerializer`
  - `ParityReportSerializer`

### `packages/core/backend/src/ops_audit/tasks.py`

- Functions:
  - `_upload_to_s3`, `daily_db_backup`
- Top-level variables:
  - `_MAX_BACKUP_SIZE_BYTES`, `logger`

### `packages/core/backend/src/ops_audit/tests/test_audit_logs_api.py`

- Classes:
  - `PartnerAuditLogsViewIntegrationTests` -> methods: `_create_request`, `setUp`, `test_api_endpoint_requires_auth`, `test_api_endpoint_with_pat_auth`, `test_api_endpoint_with_session_auth`
  - `PartnerAuditLogsViewTests` -> methods: `_create_request`, `_get_response_data`, `setUp`, `test_actor_username_fallback_to_actor_type`, `test_actor_username_populated`, `test_cross_tenant_access_blocked`, `test_filter_by_date_range`, `test_filter_by_end_date`, `test_filter_by_event_type`, `test_filter_by_start_date`, `test_list_audit_logs_member`, `test_list_audit_logs_owner`, `test_pagination`, `test_response_structure`, `test_unauthenticated_access_blocked`
- Top-level variables:
  - `User`

### `packages/core/backend/src/ops_audit/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/ops_audit/urls_parity.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `packages/core/backend/src/ops_audit/views.py`

- Classes:
  - `AuditLogListView` -> methods: `get_queryset`, `get_serializer_class`
  - `PartnerAuditLogsView` -> methods: `get_queryset`

### `packages/core/backend/src/ops_audit/views_parity.py`

- Classes:
  - `ParityLogListView` -> methods: `get_queryset`
  - `ParityPhaseCheckpointSignOffView` -> methods: `sign_off`
  - `ParityReportListView` -> methods: `get_queryset`
  - `ParityStatusView` -> methods: `get`

### `packages/core/backend/src/run_p3_shadow_test.py`

- Top-level variables:
  - `active_symbols`, `price_counts`, `recent_runs`

### `packages/core/backend/src/service_ops/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/service_ops/apps.py`

- Classes:
  - `ServiceOpsConfig` -> methods: `ready`

### `packages/core/backend/src/service_ops/dataops_market_data.py`

- Functions:
  - `_build_anomaly_guard`, `_build_daily_parity_gate_direction`, `_build_daily_parity_gate_history`, `_build_daily_parity_gate_window`, `_build_daily_parity_gate_window_with_trend`, `_build_market_data_fail_rate_window`, `_build_parity_history_from_persisted_snapshots`, `_build_parity_history_from_scheduler_logs`, `_build_retention_health_trend`, `_get_recovery_queryset_filter`, `_select_market_data_bootstrap_listing_symbols`, `build_market_data_observability_summary`, `build_market_data_parity_snapshot`, `build_market_data_queue_tier_queryset`, `build_market_data_queue_tier_snapshot`, `cleanup_market_data_parity_snapshots`, `count_market_data_queue_tier_symbols`, `ensure_market_data_system_default_baseline`, `get_market_data_queue_tier_config`, `get_market_data_queue_tier_datasets`, `get_market_data_queue_tier_execution_queue`, `get_market_data_runtime_config`, `persist_market_data_parity_snapshot`, `resolve_market_data_queue_tier`, `select_market_data_queue_tier_symbols`
- Top-level variables:
  - `DATAOPS_MARKET_DATA_DOMAIN`, `LISTING_BOOTSTRAP_PROVIDER_SOURCES`, `PLANNABLE_FRESHNESS_STATES`, `PRIORITY_TIER_TO_QUEUE_TIER`, `QUEUE_TIER_DATASETS`, `QUEUE_TIER_EXECUTION_QUEUES`, `QUEUE_TIER_ORDER`, `QUEUE_TIER_STARVATION_MULTIPLIER`, `RECOVERY_COVERAGE_STATES`, `RECOVERY_FRESHNESS_STATES`, `RETENTION_RUN_STALENESS_THRESHOLD_HOURS`, `SYSTEM_DEFAULT_BOOTSTRAP_GROUP_IDS`, `SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID`, `logger`

### `packages/core/backend/src/service_ops/domain_configs/__init__.py`

- Top-level variables:
  - `__all__`

### `packages/core/backend/src/service_ops/domain_configs/market_data.py`

- Classes:
  - `MarketDataRuntimeConfig` -> methods: `from_dict`, `to_dict`, `validate`
  - `QueueTierRuntimeConfig` -> methods: `from_dict`, `to_dict`, `validate`

### `packages/core/backend/src/service_ops/domain_configs/prefetch.py`

- Classes:
  - `PrefetchTimePolicyConfig` -> methods: `from_dict`, `get_interval_for_profile`, `to_dict`, `validate`
- Top-level variables:
  - `VALID_PROFILES`

### `packages/core/backend/src/service_ops/domain_configs/screener.py`

- Classes:
  - `ScreenerDomainConfig` -> methods: `from_dict`, `to_dict`, `validate`
- Top-level variables:
  - `VALID_RULE_TYPES`

### `packages/core/backend/src/service_ops/domain_configs/signals.py`

- Classes:
  - `SignalServicesDomainConfig` -> methods: `from_dict`, `to_dict`, `validate`

### `packages/core/backend/src/service_ops/domain_configs/vnbroker.py`

- Classes:
  - `VnbrokerDomainConfig` -> methods: `from_dict`, `to_dict`, `validate`
  - `VnbrokerProviderConfig` -> methods: `from_dict`, `to_dict`, `validate`
  - `VnbrokerTimeoutConfig` -> methods: `from_dict`, `to_dict`, `validate`
- Functions:
  - `_is_number`, `_normalize_provider_list`
- Top-level variables:
  - `DEFAULT_FALLBACK_PROVIDERS`, `DEFAULT_VNBROKER_PREFERRED_PROVIDER`, `SUPPORTED_VNBROKER_PROVIDERS`

### `packages/core/backend/src/service_ops/matrix_coordinator.py`

- Classes:
  - `MatrixCoordinator` -> methods: `__init__`, `abort_cycle`, `create_cycle`, `get_cycle_summary`, `mark_cell_done`, `mark_cell_failed`, `mark_cell_working`, `try_claim_cell`
- Functions:
  - `generate_cycle_id`, `get_latest_monitor_cycle`, `normalize_provider_list`, `normalize_symbol_group_ids`
- Top-level variables:
  - `DEFAULT_MATRIX_PROVIDERS`, `DEFAULT_SYMBOL_GROUPS`, `PREDEFINED_SYMBOL_GROUPS`, `SYMBOL_GROUP_ID_ALIASES`

### `packages/core/backend/src/service_ops/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/0002_add_scrape_matrix_models.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/0003_add_custom_symbol_group.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/0004_add_market_data_parity_snapshot.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/0005_add_dataops_domain_choice.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/0006_add_backfill_execution_models.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/0007_rename_svc_beb_run_state_idx_service_ops_run_id_0c8c61_idx_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/service_ops/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/service_ops/models.py`

- Classes:
  - `BackfillExecutionBatch` -> methods: `__str__`, `failed_symbols_count`
  - `BackfillExecutionRun` -> methods: `__str__`, `duration_seconds`, `progress_pct`
  - `ConfigChangeAudit` -> methods: `__str__`
  - `CustomSymbolGroup` -> methods: `__str__`, `clean_symbols`, `group_id`
  - `MarketDataParitySnapshot` -> methods: `__str__`
  - `OwnershipRecord` -> methods: `__str__`, `get_write_block_reason`, `is_writable`
  - `ScrapeMatrix` -> methods: `__str__`, `progress_pct`
  - `ScrapeMatrixCell` -> methods: `__str__`
  - `ServiceConfig` -> methods: `__str__`, `save`
  - `ServiceDefinition` -> methods: `__str__`
  - `ServiceHealth` -> methods: `__str__`
  - `ServiceRunLog` -> methods: `__str__`

### `packages/core/backend/src/service_ops/operator_urls.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `packages/core/backend/src/service_ops/ownership.py`

- Classes:
  - `ServiceOwnershipMatrix` -> methods: `__init__`, `all_domains`, `get_domain_ownership`, `get_write_block_reason`, `is_domain_writable`, `to_response_dict`
- Functions:
  - `build_ownership_matrix_from_db`, `get_ownership_matrix`
- Top-level variables:
  - `DEFAULT_DOMAIN_OWNERSHIP`, `SOC_APPLY_MODES`, `WRITABLE_MODES`, `_default_matrix`

### `packages/core/backend/src/service_ops/provider_catalog.py`

- Functions:
  - `build_provider_status`, `find_unsupported_provider_ids`, `get_default_provider_ids`, `get_missing_runtime_envs`, `get_supported_provider_ids`, `get_unready_provider_messages`, `list_provider_statuses`, `normalize_provider_id`, `normalize_provider_ids`
- Top-level variables:
  - `PROVIDERS_BY_ID`, `PROVIDER_CATALOG`

### `packages/core/backend/src/service_ops/registry.py`

- Functions:
  - `_build_default_config_payloads`, `_sync_ownership_records`, `bootstrap_service_registry`, `ensure_service_registry`, `get_registered_service`, `get_service_lookup_keys`, `sync_service_registry`
- Top-level variables:
  - `CANONICAL_SOC_SERVICES`, `DEFAULT_SERVICE_HEALTH`, `REQUIRED_SERVICE_KEYS`, `SERVICE_KEY_ALIASES`, `SOC_DOMAIN_PRIMARY_SERVICE_KEYS`

### `packages/core/backend/src/service_ops/scheduler_catalog.py`

- Functions:
  - `_derive_status`, `_freshness_state`, `_schedule_label`, `build_scheduler_catalog`, `build_scheduler_health_summary`
- Top-level variables:
  - `CATALOG_JOB_METADATA`, `_FRESHNESS_FRESH_SECONDS`, `_FRESHNESS_WARM_SECONDS`, `logger`

### `packages/core/backend/src/service_ops/serializers.py`

- Classes:
  - `ConfigChangeAuditSerializer`
  - `OwnershipRecordSerializer`
  - `ScrapeMatrixCellSerializer`
  - `ScrapeMatrixSerializer`
  - `ServiceConfigSerializer`
  - `ServiceDefinitionSerializer`
  - `ServiceHealthSerializer`
  - `ServiceRunLogSerializer`

### `packages/core/backend/src/service_ops/services/backfill_service.py`

- Classes:
  - `BackfillService` -> methods: `serialize_batch`, `serialize_run`, `trigger_backfill`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/service_ops/tasks.py`

- Functions:
  - `_build_service_runtime_guardrails`, `_create_child_run_log`, `_fetch_symbols_from_provider`, `_get_latest_queue_tier_run`, `_get_queue_tier_stale_timeout_seconds`, `_get_redis_queue_depth`, `_get_symbols_for_group`, `_has_inflight_child_run`, `_is_celery_task_live`, `_mark_run_log_finished`, `_mark_run_log_running`, `_probe_service_health`, `_queue_tier_due`, `_recover_inflight_child_runs`, `_recover_linked_ingest_run`, `_recover_stale_queue_tier_run`, `_task_in_redis_queue`, `_upsert_retention_health_alert`, `cleanup_market_data_parity_snapshots_task`, `create_signal_job_run_log`, `health_check_all_services`, `monitor_market_data_parity_retention_health_task`, `reconcile_stale_running_service_run_logs`, `run_market_data_queue_tier_scheduler`, `run_scrape_cycle`, `run_signal_session_facts_materialization`, `run_signal_unified_alert_materialization`, `run_signal_whale_materialization`, `run_signals_detection_workflow`, `scrape_cell_task`
- Top-level variables:
  - `QUEUE_TIER_ORPHAN_GRACE_SECONDS`, `QUEUE_TIER_RECOVERY_COOLDOWN_SECONDS`, `QUEUE_TIER_STALE_INFLIGHT_MIN_SECONDS`, `QUEUE_TIER_STALE_INFLIGHT_MULTIPLIER`, `REALTIME_PREFETCH_MAX_QUEUE_DEPTH`, `STRICT_FRESH_MODE_QUEUE_TIERS`, `logger`

### `packages/core/backend/src/service_ops/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/service_ops/tests/test_scheduler_action.py`

- Classes:
  - `SchedulerJobActionOwnershipTests` -> methods: `setUp`, `setUpTestData`, `test_action_accepted_reflects_action_name`, `test_action_invalid_action_value_returns_400`, `test_action_missing_action_field_returns_400`, `test_action_platform_domain_blocked_returns_403`, `test_action_requires_admin`, `test_action_requires_auth`, `test_action_response_has_required_fields`, `test_action_unknown_job_returns_404`, `test_action_valid_job_valid_action_returns_202`, `test_action_with_reason_is_accepted`, `test_beat_read_only_allows_only_run_now`, `test_platform_managed_control_mode_has_no_allowed_actions`
  - `SchedulerJobActionS03ExecutionTests` -> methods: `setUp`, `setUpTestData`, `test_abort_backfill_job_uses_catalog_service_key_mapping`, `test_abort_returns_202_with_revoke_message`, `test_disable_toggles_periodic_task`, `test_enable_toggles_periodic_task`, `test_run_now_accepted_with_patched_broker`
- Top-level variables:
  - `User`, `_ACTION_URL`

### `packages/core/backend/src/service_ops/tests/test_scheduler_b02.py`

- Classes:
  - `BackfillExecutionBatchModelTests` -> methods: `setUp`, `test_create_batch`, `test_failed_symbols_count_property`, `test_unique_together_run_provider`
  - `BackfillExecutionRunModelTests` -> methods: `test_create_run_and_defaults`, `test_duration_seconds_none_when_not_finished`, `test_progress_pct_calculation`, `test_progress_pct_zero_when_no_plan`, `test_str_representation`
  - `BackfillTaskInstrumentationTests` -> methods: `setUpTestData`, `test_batch_rows_created_per_provider`, `test_exec_run_created_on_task_start`, `test_run_finalized_with_correct_counters`, `test_run_status_partial_when_failed_symbols`, `test_skipped_returns_early_no_run_created`
- Functions:
  - `_make_bucket_result`

### `packages/core/backend/src/service_ops/tests/test_scheduler_b07.py`

- Classes:
  - `BackfillRunNowViewTest` -> methods: `_post`, `setUp`, `test_deep_bootstrap_mode_accepted`, `test_invalid_mode_returns_400`, `test_missing_mode_returns_400`, `test_symbols_normalized_to_uppercase`, `test_valid_mode_enqueues`
  - `BackfillTaskModeParamTest` -> methods: `_create_run_directly`, `setUpTestData`, `test_daily_delta_mode_stored`, `test_repair_missing_mode_stored`, `test_targeted_symbol_repair_mode_stored`

### `packages/core/backend/src/service_ops/tests/test_scheduler_b08.py`

- Classes:
  - `AnomalyGuardReturnStructureTest` -> methods: `test_empty_db_returns_empty_lists`, `test_returns_all_required_keys`
  - `CriticalGapSymbolsTest` -> methods: `test_fresh_symbol_excluded_even_with_high_score`, `test_high_gap_score_stale_symbol_appears`, `test_low_gap_score_symbol_excluded`, `test_sorted_by_gap_score_desc`
  - `HotTierBreachTest` -> methods: `test_cold_symbol_with_gap_days_excluded`, `test_hot_symbol_with_few_gap_days_excluded`, `test_hot_symbol_with_many_gap_days_appears`
  - `PromotionBacklogTest` -> methods: `test_cold_stale_not_counted`, `test_hot_fresh_not_counted`, `test_hot_warm_stale_counted`
- Functions:
  - `_coverage`, `_registry`

### `packages/core/backend/src/service_ops/tests/test_scheduler_catalog.py`

- Classes:
  - `SchedulerCatalogUnitTests` -> methods: `setUpTestData`, `test_catalog_beat_registered_false_when_no_periodic_task`, `test_catalog_capabilities_from_metadata`, `test_catalog_domain_filter`, `test_catalog_empty_schedule_returns_empty`, `test_catalog_freshness_missing_when_never_run`, `test_catalog_job_disabled_when_schedule_def_says_false`, `test_catalog_job_has_required_fields`, `test_catalog_job_key_matches_schedule_key`, `test_catalog_returns_list`, `test_catalog_schedule_label_interval`, `test_catalog_unknown_job_gets_default_metadata`, `test_daily_backfill_reports_daily_threshold_when_truly_stale`, `test_daily_backfill_uses_daily_freshness_window`, `test_hourly_job_uses_hourly_freshness_window`, `test_weekly_job_uses_weekly_freshness_window`
  - `SchedulerHealthApiTests` -> methods: `setUp`, `setUpTestData`, `test_health_has_required_fields`, `test_health_jobs_total_is_int`, `test_health_requires_auth`, `test_health_returns_200`
  - `SchedulerHealthSummaryUnitTests` -> methods: `test_health_summary_has_required_fields`, `test_health_summary_healthy_when_empty_catalog`, `test_health_summary_jobs_total`, `test_health_summary_overall_health_degraded_when_unregistered`, `test_health_summary_unregistered_equals_total_when_no_periodic_tasks`
  - `SchedulerJobHistoryApiTests` -> methods: `setUp`, `setUpTestData`, `test_history_known_job_returns_200`, `test_history_response_has_count_and_results`, `test_history_unknown_job_returns_404`
  - `SchedulerPlanApiTests` -> methods: `setUp`, `setUpTestData`, `test_plan_domain_filter_query_param`, `test_plan_has_required_envelope_fields`, `test_plan_jobs_is_list`, `test_plan_jobs_total_matches_jobs_length`, `test_plan_requires_admin`, `test_plan_requires_auth`, `test_plan_returns_200`
- Top-level variables:
  - `User`, `_CRON_SCHEDULE`, `_MINIMAL_SCHEDULE`

### `packages/core/backend/src/service_ops/tests/test_scheduler_s04.py`

- Classes:
  - `B01BackfillJobServiceKeyTests` -> methods: `test_backfill_service_definition_exists`, `test_daily_backfill_has_service_key`, `test_deep_history_bootstrap_has_service_key`, `test_deep_history_service_definition_exists`, `test_pre5y_backfill_has_service_key`, `test_pre5y_history_service_definition_exists`
  - `B01HistoryEndpointBackfillTests` -> methods: `setUp`, `setUpTestData`, `test_daily_backfill_history_result_items_have_trigger_field`, `test_daily_backfill_history_returns_results`, `test_deep_history_bootstrap_history_returns_results`
  - `B01InflightCacheCleared` -> methods: `setUpTestData`, `test_b01_clear_inflight_cache_deletes_key`, `test_b01_clear_inflight_cache_noop_on_none`, `test_backfill_task_clears_cache_on_skipped`
  - `B01RunNowCreatesRunLogTests` -> methods: `_post_run_now`, `setUp`, `setUpTestData`, `test_run_now_daily_backfill_creates_run_log`, `test_run_now_deep_history_creates_run_log`, `test_run_now_passes_service_run_log_id_to_task`, `test_run_now_run_log_starts_queued_with_job_key`
  - `B10StuckRunDetectionTests` -> methods: `_make_running_log`, `setUp`, `setUpTestData`, `tearDown`, `test_catalog_dict_has_stuck_fields`, `test_catalog_flags_stuck_when_exceeded_max_run_time`, `test_catalog_job_without_max_expected_never_stuck`, `test_catalog_not_stuck_within_expected_run_time`, `test_daily_backfill_has_max_expected_run_seconds`, `test_deep_history_has_max_expected_run_seconds`, `test_derive_status_not_stuck_returns_running`, `test_derive_status_stuck_returns_degraded`
  - `SchedulerCatalogInflightEnrichmentTests` -> methods: `setUpTestData`, `test_inflight_is_false_when_no_running_logs`, `test_inflight_is_true_when_running_run_log_exists`
  - `SchedulerJobHistoryS04Tests` -> methods: `setUp`, `setUpTestData`, `test_history_count_is_int`, `test_history_page_size_param_respected`, `test_history_result_items_have_required_fields`, `test_history_results_is_list`, `test_history_returns_pagination_fields`, `test_history_shows_run_log_when_service_key_mapped`, `test_history_unknown_job_returns_404`
- Top-level variables:
  - `User`, `_HISTORY_URL`

### `packages/core/backend/src/service_ops/tests/test_screener_rule_crud.py`

- Classes:
  - `ScreenerRuleCRUDTestCase` -> methods: `_create_rule`, `setUp`, `setUpTestData`, `test_create_rule_persists_to_config`, `test_create_rule_returns_201`, `test_delete_rule_not_found_returns_404`, `test_delete_rule_removes_from_list`, `test_delete_rule_returns_204`, `test_update_rule_not_found_returns_404`, `test_update_rule_returns_200`
- Top-level variables:
  - `User`

### `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py`

- Classes:
  - `DataOpsDomainApiTestCase` -> methods: `test_coverage_endpoint_returns_dataset_state_counts_and_top_gaps`, `test_observability_endpoint_returns_backlog_fail_rate_and_starvation`, `test_observability_parity_history_prefers_persisted_snapshot_store`, `test_operator_canonical_dataops_routes_appear_in_openapi_schema`, `test_operator_canonical_observability_endpoint_matches_soc_alias`, `test_operator_canonical_planner_preview_matches_soc_alias`, `test_operator_canonical_registry_summary_endpoint_matches_soc_alias`, `test_operator_canonical_runtime_config_endpoint_applies_market_data_config`, `test_operator_canonical_runtime_config_endpoint_matches_soc_alias`, `test_planner_preview_endpoint_returns_missing_only_plan_and_skips`, `test_planner_run_abort_endpoint_revokes_queued_task_and_marks_run_skipped`, `test_planner_run_endpoint_creates_audited_manual_on_demand_run`, `test_queue_tiers_endpoint_returns_default_cadence_and_symbol_distribution`, `test_queue_tiers_endpoint_uses_current_matrix_runtime_config_overrides`, `test_registry_detail_endpoint_returns_demand_sources_coverage_and_queue_tier`, `test_registry_reconcile_preview_flags_drift_without_mutating_registry`, `test_registry_summary_endpoint_returns_foundation_aggregates`, `test_run_logs_endpoint_returns_paginated_market_data_parent_runs`, `test_runtime_config_audit_returns_paginated_change_history`, `test_runtime_config_endpoint_applies_market_data_config_with_ownership_payload`, `test_runtime_config_get_endpoint_returns_current_config_and_ownership_payload`, `test_runtime_config_preview_validates_without_saving`
  - `MatrixDomainApiTestCase` -> methods: `test_matrix_providers_reflect_active_cycle`, `test_matrix_routes_appear_in_openapi_schema`, `test_start_monitor_and_abort_matrix_cycle`
  - `OverviewDomainApiTestCase` -> methods: `test_overview_routes_appear_in_openapi_schema`, `test_overview_summary_endpoint_returns_grouped_health_snapshot`, `test_service_health_check_endpoint_queues_manual_probe_run_log`
  - `PrefetchDomainApiTestCase` -> methods: `test_apply_prefetch_config_updates_schedule_and_universe`, `test_prefetch_apply_alias_and_ownership_endpoint_match_contract`, `test_prefetch_default_config_response_has_stable_metadata`, `test_prefetch_routes_appear_in_openapi_schema`, `test_prefetch_warm_now_queues_run_log`, `test_profiles_cache_and_purge_endpoints_return_contract`
  - `RegistryBootstrapTestCase` -> methods: `test_ensure_service_registry_recreates_canonical_rows`
  - `ScreenerDomainApiTestCase` -> methods: `setUpTestData`, `test_manual_scan_creates_dispatch_run_log`, `test_results_and_history_use_runtime_signal_alerts`, `test_rules_endpoint_uses_current_screener_config`, `test_rules_run_alias_queues_manual_scan`, `test_screener_default_config_response_has_stable_metadata`, `test_screener_ownership_endpoint_returns_native_write_status`, `test_screener_routes_appear_in_openapi_schema`
  - `SOCAdminApiTestCase` -> methods: `setUp`, `setUpTestData`
  - `VnbrokerDomainApiTestCase` -> methods: `test_get_vnbroker_config_returns_seeded_payload`, `test_post_vnbroker_config_creates_current_config_and_audit`, `test_vnbroker_apply_alias_and_ownership_endpoint_match_contract`, `test_vnbroker_apply_audit_captures_before_and_after_snapshots`, `test_vnbroker_health_endpoint_returns_unknown_snapshot_when_missing`, `test_vnbroker_preview_returns_validation_envelope`, `test_vnbroker_routes_appear_in_openapi_schema`
- Functions:
  - `_load_openapi_schema`
- Top-level variables:
  - `User`

### `packages/core/backend/src/service_ops/tests/test_soc_api_integration.py`

- Classes:
  - `ConfigApplyEndToEndTestCase` -> methods: `test_apply_vnbroker_config_keeps_single_current_version`, `test_apply_vnbroker_config_workflow_updates_config_history_and_audit`
  - `ErrorHandlingIntegrationTestCase` -> methods: `test_invalid_json_returns_400`, `test_nonexistent_service_returns_404_with_standard_envelope`, `test_validation_error_uses_standard_error_envelope`
  - `MultiDomainWorkflowTestCase` -> methods: `test_bridge_write_domain_remains_forbidden`, `test_native_write_domains_apply_through_alias_routes`, `test_services_list_and_detail_routes_use_primary_service_keys`
  - `PaginationIntegrationTestCase` -> methods: `setUpTestData`, `test_history_and_audit_routes_are_paginated`, `test_service_list_pagination`
  - `SOCIntegrationBaseTestCase` -> methods: `setUp`, `setUpTestData`
- Top-level variables:
  - `User`

### `packages/core/backend/src/service_ops/tests/test_soc_api_overview.py`

- Classes:
  - `OverviewApiBaseTestCase` -> methods: `setUp`, `setUpTestData`
  - `OverviewAuthContractTestCase` -> methods: `test_non_admin_requests_are_forbidden_with_standard_error_envelope`, `test_unauthenticated_requests_use_standard_error_envelope`
  - `OverviewContractTestCase` -> methods: `test_current_config_endpoint_returns_current_config`, `test_global_run_logs_and_change_audit_endpoints_are_paginated`, `test_health_status_endpoint_is_not_shadowed_by_service_routes`, `test_overview_summary_returns_health_breakdown`, `test_service_audit_and_history_endpoints_are_paginated`, `test_service_detail_includes_current_config_health_and_ownership`, `test_service_health_check_trigger_creates_queued_run_log`, `test_service_health_endpoint_returns_unknown_when_missing`, `test_service_not_found_returns_standard_error_envelope`, `test_services_list_returns_paginated_services`
- Top-level variables:
  - `User`

### `packages/core/backend/src/service_ops/tests/test_soc_api_signals.py`

- Classes:
  - `SignalsApiBaseTestCase` -> methods: `setUp`, `setUpTestData`
  - `SignalsApiContractTestCase` -> methods: `test_apply_alias_remains_blocked_for_bridge_write_even_with_db_override`, `test_direct_apply_methods_on_config_route_are_blocked`, `test_get_signal_config_returns_bridge_write_metadata`, `test_preview_returns_validation_envelope_without_apply_permission`, `test_retention_materialization_universe_and_job_routes_return_contract`, `test_runtime_read_endpoints_return_current_payloads`, `test_signals_routes_appear_in_openapi_schema`, `test_summary_aggregates_alerts_and_events_from_current_session`
  - `SignalsAuthenticationTestCase` -> methods: `setUp`, `test_non_admin_user_is_forbidden`, `test_unauthenticated_requests_return_401`
- Functions:
  - `_load_openapi_schema`
- Top-level variables:
  - `User`

### `packages/core/backend/src/service_ops/tests/test_soc_domain_configs.py`

- Classes:
  - `DomainConfigValidationTestCase` -> methods: `test_default_domain_configs_validate_cleanly`, `test_market_data_runtime_config_from_dict_accepts_partial_queue_overrides`, `test_market_data_runtime_config_validation_rejects_invalid_queue_settings`, `test_prefetch_validation_rejects_invalid_profile_and_intervals`, `test_screener_validation_requires_valid_rules_and_prefix`, `test_signals_validation_rejects_bad_thresholds`, `test_vnbroker_from_dict_builds_nested_timeout_schema_and_accepts_legacy_aliases`, `test_vnbroker_timeout_validation_rejects_out_of_range_values`

### `packages/core/backend/src/service_ops/tests/test_soc_matrix.py`

- Classes:
  - `MatrixApiBaseTestCase` -> methods: `setUp`, `setUpTestData`
  - `MatrixCoordinatorAtomicClaimTestCase` -> methods: `_claim_cell`, `test_try_claim_cell_allows_only_one_concurrent_winner`
  - `MatrixCoordinatorTestCase` -> methods: `test_mark_cell_done_skips_other_cells_in_same_row`, `test_try_claim_cell_rejects_second_claim_after_first_claim`
  - `MatrixProviderCatalogApiTestCase` -> methods: `test_monitor_returns_idle_when_only_terminal_cycle_exists`, `test_operator_canonical_provider_endpoint_matches_soc_alias`, `test_operator_canonical_start_cycle_dispatches_same_matrix_workflow`, `test_provider_gate_still_applies_when_active_cycle_exists`, `test_providers_endpoint_exposes_kbs_vci_dnse_catalog`, `test_start_cycle_allows_vci_and_kbs`, `test_start_cycle_dispatches_scrape_workflow`, `test_start_cycle_rejects_removed_or_unready_providers`
- Top-level variables:
  - `User`

### `packages/core/backend/src/service_ops/tests/test_soc_models.py`

- Classes:
  - `ConfigChangeAuditModelTestCase` -> methods: `setUp`, `test_config_change_audit_persists_before_and_after_snapshots`
  - `MarketDataParitySnapshotModelTestCase` -> methods: `setUp`, `test_unique_scheduler_task_id_and_window_hours`
  - `OwnershipRecordModelTestCase` -> methods: `test_ownership_record_writability_and_block_reason`
  - `ScrapeMatrixModelTestCase` -> methods: `test_scrape_matrix_progress_pct_and_cell_string`
  - `ServiceConfigModelTestCase` -> methods: `setUp`, `test_applied_at_is_set_on_create`, `test_new_current_config_marks_previous_config_inactive`
  - `ServiceDefinitionModelTestCase` -> methods: `test_service_definition_creation_and_string`
  - `ServiceHealthModelTestCase` -> methods: `setUp`, `test_service_health_creation_and_detail`
  - `ServiceRunLogModelTestCase` -> methods: `setUp`, `test_service_run_log_tracks_output_and_failure_detail`

### `packages/core/backend/src/service_ops/tests/test_soc_ownership.py`

- Classes:
  - `ServiceOwnershipMatrixTestCase` -> methods: `test_build_ownership_matrix_from_db_allows_native_write_override`, `test_build_ownership_matrix_from_db_preserves_bridge_write_block`, `test_default_matrix_allows_native_write_and_blocks_bridge_write`, `test_to_response_dict_exposes_writer_and_locked_fields`, `test_unknown_domain_returns_explicit_block_reason`

### `packages/core/backend/src/service_ops/tests/test_soc_tasks.py`

- Classes:
  - `ReconcileStaleRunningRunLogsTaskTestCase` -> methods: `setUpTestData`, `test_reconcile_marks_failed_for_orphan_pending_and_clears_inflight_cache`, `test_reconcile_marks_failed_for_stale_queued_log`, `test_reconcile_marks_success_when_celery_state_is_success`
  - `ServiceOpsTasksTestCase` -> methods: `setUpTestData`, `test_cleanup_market_data_parity_snapshots_task_applies_retention_policy`, `test_create_signal_job_run_log_uses_primary_signals_service`, `test_health_check_all_services_updates_service_health`, `test_market_data_queue_tier_scheduler_backfills_listing_baseline_when_registry_non_empty`, `test_market_data_queue_tier_scheduler_bootstraps_system_defaults_when_registry_empty`, `test_market_data_queue_tier_scheduler_dispatches_due_tiers_with_runtime_policy`, `test_market_data_queue_tier_scheduler_enforces_max_dispatch_per_cycle_quota`, `test_market_data_queue_tier_scheduler_includes_session_facts_for_warm_tier`, `test_market_data_queue_tier_scheduler_keeps_inflight_when_child_run_exists`, `test_market_data_queue_tier_scheduler_recovers_orphaned_inflight_tier_immediately`, `test_market_data_queue_tier_scheduler_recovers_stale_child_runs_with_parent`, `test_market_data_queue_tier_scheduler_recovers_stale_inflight_tier`, `test_market_data_queue_tier_scheduler_skips_recent_inflight_tier`, `test_monitor_retention_health_task_emits_alert_when_threshold_exceeded`, `test_monitor_retention_health_task_no_alert_when_within_threshold`, `test_run_scrape_cycle_dispatches_each_group_provider_cell`, `test_scrape_cell_task_claims_fetches_and_marks_done`, `test_scrape_cell_task_skips_cell_when_row_already_done`, `test_scrape_cell_task_uses_provider_specific_snapshot_source`, `test_session_facts_materialization_task_updates_run_log`, `test_signals_detection_workflow_creates_tracked_child_runs`, `test_unified_alert_materialization_task_updates_run_log`, `test_whale_materialization_task_updates_run_log`
  - `VnbrokerAdapterTaskBridgeTestCase` -> methods: `test_fetch_daily_history_uses_requested_source_quote_class`, `test_fetch_listing_symbols_uses_requested_source_listing_adapter`, `test_fetch_price_board_snapshot_passes_explicit_source`, `test_fetch_realtime_price_uses_requested_source_quote_class`, `test_fetch_symbol_group_members_uses_requested_source_group`

### `packages/core/backend/src/service_ops/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/service_ops/views/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/service_ops/views/base.py`

- Classes:
  - `SOCBaseView` -> methods: `_stringify_error_detail`, `error_response`, `get_paginated_response`, `get_request_id`, `handle_exception`, `paginate_queryset`
  - `SOCOperatorReadThrottle`
  - `SOCRegistryBootstrapMixin` -> methods: `initial`

### `packages/core/backend/src/service_ops/views/dataops.py`

- No parseable top-level symbols found

### `packages/core/backend/src/service_ops/views/dataops_backfill.py`

- Classes:
  - `BackfillRunDetailView` -> methods: `get`
  - `BackfillRunListView` -> methods: `get`
  - `BackfillRunNowView` -> methods: `post`
- Top-level variables:
  - `_B07_ALLOWED_MODES`

### `packages/core/backend/src/service_ops/views/dataops_base.py`

- Classes:
  - `DataOpsOwnershipSerializer`
- Functions:
  - `_build_market_data_ownership_payload`, `_build_market_data_run_summary`, `_build_market_data_write_denied_response`, `_format_market_data_run_id`, `_get_reference_trade_date`, `_get_request_datasets`, `_get_request_force_refresh`, `_get_request_symbols`, `_parse_market_data_run_id`, `_serialize_market_data_run_log`
- Top-level variables:
  - `RUN_SUMMARY_KEYS`

### `packages/core/backend/src/service_ops/views/dataops_config.py`

- Classes:
  - `DataOpsRuntimeConfigApplyRequestSerializer`
  - `DataOpsRuntimeConfigAuditResponseSerializer`
  - `DataOpsRuntimeConfigAuditSerializer`
  - `DataOpsRuntimeConfigAuditView` -> methods: `get`
  - `DataOpsRuntimeConfigPreviewRequestSerializer`
  - `DataOpsRuntimeConfigPreviewResponseSerializer`
  - `DataOpsRuntimeConfigPreviewView` -> methods: `post`
  - `DataOpsRuntimeConfigResponseSerializer`
  - `DataOpsRuntimeConfigView` -> methods: `get`, `post`

### `packages/core/backend/src/service_ops/views/dataops_inventory.py`

- Classes:
  - `DataOpsInventoryView` -> methods: `get`

### `packages/core/backend/src/service_ops/views/dataops_observability.py`

- Classes:
  - `DataOpsCoverageResponseSerializer`
  - `DataOpsCoverageView` -> methods: `get`
  - `DataOpsObservabilityResponseSerializer`
  - `DataOpsObservabilityView` -> methods: `get`
  - `DataOpsQueueTiersResponseSerializer`
  - `DataOpsQueueTiersView` -> methods: `get`

### `packages/core/backend/src/service_ops/views/dataops_planner.py`

- Classes:
  - `DataOpsPlannerAbortResponseSerializer`
  - `DataOpsPlannerPreviewRequestSerializer`
  - `DataOpsPlannerPreviewResponseSerializer`
  - `DataOpsPlannerPreviewView` -> methods: `post`
  - `DataOpsPlannerRunAbortView` -> methods: `post`
  - `DataOpsPlannerRunRequestSerializer`
  - `DataOpsPlannerRunResponseSerializer`
  - `DataOpsPlannerRunView` -> methods: `post`
  - `DataOpsRunLogsPurgeView` -> methods: `post`
  - `DataOpsRunLogsResponseSerializer`
  - `DataOpsRunLogsView` -> methods: `get`

### `packages/core/backend/src/service_ops/views/dataops_registry.py`

- Classes:
  - `DataOpsRegistryDetailResponseSerializer`
  - `DataOpsRegistryDetailView` -> methods: `get`
  - `DataOpsRegistryReconcilePreviewRequestSerializer`
  - `DataOpsRegistryReconcilePreviewResponseSerializer`
  - `DataOpsRegistryReconcilePreviewView` -> methods: `post`
  - `DataOpsRegistrySummaryResponseSerializer`
  - `DataOpsRegistrySummaryView` -> methods: `get`

### `packages/core/backend/src/service_ops/views/matrix.py`

- Classes:
  - `MatrixCellListResponseSerializer`
  - `MatrixCellListView` -> methods: `get`
  - `MatrixCellsSummarySerializer`
  - `MatrixCycleAbortView` -> methods: `post`
  - `MatrixCycleDetailResponseSerializer`
  - `MatrixCycleDetailView` -> methods: `get`
  - `MatrixCycleListResponseSerializer`
  - `MatrixCycleListView` -> methods: `get`
  - `MatrixCycleStartRequestSerializer`
  - `MatrixCycleStartView` -> methods: `post`
  - `MatrixCycleSummarySerializer`
  - `MatrixMonitorResponseSerializer`
  - `MatrixMonitorView` -> methods: `get`
  - `MatrixProvidersResponseSerializer`
  - `MatrixProviderStatusSerializer`
  - `MatrixProvidersView` -> methods: `get`
- Functions:
  - `_serialize_cells_summary`, `_serialize_cycle_detail`
- Top-level variables:
  - `PAGINATION_PARAMETERS`

### `packages/core/backend/src/service_ops/views/mixins.py`

- Classes:
  - `ConfigApplyMixin` -> methods: `apply_config`

### `packages/core/backend/src/service_ops/views/overview.py`

- Classes:
  - `ChangeAuditListView` -> methods: `get`
  - `HealthCheckTriggerResponseSerializer`
  - `HealthStatusResponseSerializer`
  - `HealthStatusView` -> methods: `get`
  - `OverviewCountsSerializer`
  - `OverviewSummaryResponseSerializer`
  - `OverviewSummaryView` -> methods: `get`
  - `PaginatedConfigChangeAuditResponseSerializer`
  - `PaginatedServiceConfigResponseSerializer`
  - `PaginatedServiceDefinitionResponseSerializer`
  - `PaginatedServiceRunLogResponseSerializer`
  - `RunLogListView` -> methods: `get`
  - `ServiceAuditView` -> methods: `get`
  - `ServiceConfigHistoryView` -> methods: `get`
  - `ServiceCurrentConfigSnapshotSerializer`
  - `ServiceCurrentConfigView` -> methods: `get`
  - `ServiceDetailResponseSerializer`
  - `ServiceDetailView` -> methods: `get`
  - `ServiceHealthCheckTriggerView` -> methods: `post`
  - `ServiceHealthSnapshotSerializer`
  - `ServiceHealthView` -> methods: `get`
  - `ServiceListView` -> methods: `get`
  - `ServiceOwnershipPayloadSerializer`
  - `ServiceOwnershipView` -> methods: `get`
  - `ServiceRunLogsView` -> methods: `get`
  - `ServiceSummaryRowSerializer`
- Functions:
  - `_get_current_config`, `_get_ownership_payload`, `_get_service_or_error`, `_serialize_health`, `_serialize_service_detail`
- Top-level variables:
  - `STANDARD_PAGINATION_PARAMETERS`

### `packages/core/backend/src/service_ops/views/prefetch.py`

- Classes:
  - `PrefetchCacheStatusResponseSerializer`
  - `PrefetchCacheStatusView` -> methods: `get`
  - `PrefetchConfigPayloadSerializer`
  - `PrefetchConfigRequestSerializer`
  - `PrefetchConfigResponseSerializer`
  - `PrefetchConfigView` -> methods: `get`, `post`
  - `PrefetchOwnershipResponseSerializer`
  - `PrefetchOwnershipView` -> methods: `get`
  - `PrefetchProfilesResponseSerializer`
  - `PrefetchProfilesView` -> methods: `get`
  - `PrefetchPurgeCacheRequestSerializer`
  - `PrefetchPurgeCacheResponseSerializer`
  - `PrefetchPurgeCacheView` -> methods: `post`
  - `PrefetchRedisStatusSerializer`
  - `PrefetchScheduleItemSerializer`
  - `PrefetchTaskScheduleResponseSerializer`
  - `PrefetchTaskScheduleView` -> methods: `get`
  - `PrefetchUniverseGroupSerializer`
  - `PrefetchUniverseGroupsResponseSerializer`
  - `PrefetchUniverseGroupsView` -> methods: `get`
  - `PrefetchWarmNowResponseSerializer`
  - `PrefetchWarmNowView` -> methods: `post`
- Functions:
  - `_build_default_prefetch_config_response`, `_build_prefetch_ownership_payload`, `_get_prefetch_config`

### `packages/core/backend/src/service_ops/views/scheduler.py`

- Classes:
  - `SchedulerHealthResponseSerializer`
  - `SchedulerHealthView` -> methods: `get`
  - `SchedulerJobActionRequestSerializer`
  - `SchedulerJobActionResponseSerializer`
  - `SchedulerJobActionView` -> methods: `post`
  - `SchedulerJobHistoryResponseSerializer`
  - `SchedulerJobHistoryView` -> methods: `get`
  - `SchedulerJobSerializer`
  - `SchedulerPlanResponseSerializer`
  - `SchedulerPlanView` -> methods: `get`
- Functions:
  - `_execute_scheduler_action`, `_get_client_ip`
- Top-level variables:
  - `VALID_ACTIONS`, `_ALLOWED_ACTIONS_BY_CONTROL_MODE`, `_DOMAIN_WRITE_BLOCKED`, `_DOMAIN_WRITE_ENABLED`

### `packages/core/backend/src/service_ops/views/screener.py`

- Classes:
  - `ScreenerAlertHistoryResponseSerializer`
  - `ScreenerAlertHistoryView` -> methods: `get`
  - `ScreenerAlertSerializer`
  - `ScreenerConfigPayloadSerializer`
  - `ScreenerConfigRequestSerializer`
  - `ScreenerConfigResponseSerializer`
  - `ScreenerConfigView` -> methods: `get`, `post`
  - `ScreenerManualScanRequestSerializer`
  - `ScreenerManualScanResponseSerializer`
  - `ScreenerManualScanView` -> methods: `post`
  - `ScreenerOwnershipResponseSerializer`
  - `ScreenerOwnershipView` -> methods: `get`
  - `ScreenerResultsResponseSerializer`
  - `ScreenerResultsView` -> methods: `get`
  - `ScreenerRuleCreateRequestSerializer`
  - `ScreenerRuleCreateResponseSerializer`
  - `ScreenerRuleDeleteView` -> methods: `delete`
  - `ScreenerRuleSerializer`
  - `ScreenerRulesResponseSerializer`
  - `ScreenerRulesRunView` -> methods: `post`
  - `ScreenerRulesView` -> methods: `get`, `post`
  - `ScreenerRuleUpdateRequestSerializer`
  - `ScreenerRuleUpdateView` -> methods: `put`
- Functions:
  - `_build_default_screener_config_response`, `_build_screener_ownership_payload`, `_get_recent_signal_alerts`, `_get_screener_config`, `_save_screener_rules_config`, `_serialize_signal_alert`
- Top-level variables:
  - `PAGINATION_PARAMETERS`

### `packages/core/backend/src/service_ops/views/signals.py`

- Classes:
  - `SignalsBridgeWriteDeniedResponseSerializer`
  - `SignalsConfigApplyView` -> methods: `post`
  - `SignalsConfigPayloadSerializer`
  - `SignalsConfigPreviewRequestSerializer`
  - `SignalsConfigPreviewResponseSerializer`
  - `SignalsConfigPreviewView` -> methods: `post`
  - `SignalsConfigResponseSerializer`
  - `SignalsConfigView` -> methods: `get`
  - `SignalsDarkPoolRecentItemSerializer`
  - `SignalsDarkPoolRecentResponseSerializer`
  - `SignalsDarkPoolRecentView` -> methods: `get`
  - `SignalsDarkPoolResponseSerializer`
  - `SignalsDarkPoolView` -> methods: `get`
  - `SignalsJobRunRequestSerializer`
  - `SignalsJobRunResponseSerializer`
  - `SignalsJobRunView` -> methods: `post`
  - `SignalsJobStatusResponseSerializer`
  - `SignalsJobStatusView` -> methods: `get`
  - `SignalsMaterializationExecutionPlanItemSerializer`
  - `SignalsMaterializationPreviewRequestSerializer`
  - `SignalsMaterializationPreviewResponseSerializer`
  - `SignalsMaterializationPreviewView` -> methods: `post`
  - `SignalsMaterializationResponseSerializer`
  - `SignalsMaterializationView` -> methods: `get`
  - `SignalsMaterializerStatusSerializer`
  - `SignalsOwnershipSerializer`
  - `SignalsOwnershipView` -> methods: `get`
  - `SignalsPerformanceMetricsResponseSerializer`
  - `SignalsPerformanceMetricsView` -> methods: `get`
  - `SignalsRecentAlertSerializer`
  - `SignalsRecentResponseSerializer`
  - `SignalsRetentionPolicyResponseSerializer`
  - `SignalsRetentionPolicyView` -> methods: `get`
  - `SignalsRetentionPreviewResponseSerializer`
  - `SignalsRetentionPreviewView` -> methods: `post`
  - `SignalsScreenerRecentView` -> methods: `get`
  - `SignalsScreenerResponseSerializer`
  - `SignalsScreenerView` -> methods: `get`
  - `SignalsSummaryResponseSerializer`
  - `SignalsSummaryView` -> methods: `get`
  - `SignalsUniverseResponseSerializer`
  - `SignalsUniverseUpdateRequestSerializer`
  - `SignalsUniverseUpdateView` -> methods: `post`
  - `SignalsUniverseView` -> methods: `get`
  - `SignalsWhaleRecentItemSerializer`
  - `SignalsWhaleRecentResponseSerializer`
  - `SignalsWhaleRecentView` -> methods: `get`
  - `SignalsWhaleResponseSerializer`
  - `SignalsWhaleTestRequestSerializer`
  - `SignalsWhaleTestResponseSerializer`
  - `SignalsWhaleTestView` -> methods: `post`
  - `SignalsWhaleView` -> methods: `get`
- Functions:
  - `_build_bridge_write_denied_response`, `_build_materialization_execution_plan`, `_build_signals_ownership_payload`, `_compute_avg_signal_latency_ms`, `_get_latest_signal_job_run`, `_get_signals_domain_config`, `_latest_signal_session_date`, `_materializer_status`, `_serialize_recent_alert`

### `packages/core/backend/src/service_ops/views/symbol_groups.py`

- Classes:
  - `SymbolGroupDetailView` -> methods: `_get_group_or_404`, `delete`, `get`, `put`
  - `SymbolGroupListView` -> methods: `get`, `post`
- Functions:
  - `_serialize_custom_group`, `_slugify`

### `packages/core/backend/src/service_ops/views/vnbroker.py`

- Classes:
  - `ProviderStatusSerializer`
  - `VnbrokerBenchmarkRequestSerializer`
  - `VnbrokerBenchmarkResponseSerializer`
  - `VnbrokerBenchmarkView` -> methods: `get`, `post`
  - `VnbrokerCircuitBreakerResponseSerializer`
  - `VnbrokerCircuitBreakerSummarySerializer`
  - `VnbrokerCircuitBreakerView` -> methods: `get`
  - `VnbrokerConfigPayloadSerializer`
  - `VnbrokerConfigPreviewView` -> methods: `post`
  - `VnbrokerConfigRequestSerializer`
  - `VnbrokerConfigResponseSerializer`
  - `VnbrokerConfigView` -> methods: `get`, `post`
  - `VnbrokerHealthResponseSerializer`
  - `VnbrokerHealthView` -> methods: `get`
  - `VnbrokerOwnershipResponseSerializer`
  - `VnbrokerOwnershipView` -> methods: `get`
  - `VnbrokerPreviewImpactSerializer`
  - `VnbrokerPreviewResponseSerializer`
  - `VnbrokerProviderConfigSerializer`
  - `VnbrokerProvidersResponseSerializer`
  - `VnbrokerProvidersView` -> methods: `get`
  - `VnbrokerTestConnectionRequestSerializer`
  - `VnbrokerTestConnectionResponseSerializer`
  - `VnbrokerTestConnectionView` -> methods: `post`
  - `VnbrokerTimeoutSerializer`
- Functions:
  - `_build_vnbroker_ownership_payload`, `_get_active_vnbroker_provider_ids`, `_sanitize_vnbroker_config_payload`
- Top-level variables:
  - `DEFAULT_VNBROKER_FALLBACK_PROVIDERS`, `DEFAULT_VNBROKER_PRIMARY_PROVIDER`

### `packages/core/backend/src/signal_intelligence/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/signal_intelligence/admin.py`

- Classes:
  - `OrderFlowEventAdmin`
  - `UnifiedAlertAdmin`
  - `WhaleAlertCanonicalAdmin`
  - `WhaleAlertCanonicalInline`

### `packages/core/backend/src/signal_intelligence/admin_views.py`

- Classes:
  - `SignalAdminFlushView` -> methods: `post`
  - `SignalAdminStatsView` -> methods: `get`

### `packages/core/backend/src/signal_intelligence/apps.py`

- Classes:
  - `SignalIntelligenceConfig`

### `packages/core/backend/src/signal_intelligence/consumers.py`

- Classes:
  - `MarketTickerConsumer` -> methods: `connect`, `disconnect`, `market_update`, `receive`
- Functions:
  - `_authenticate_token`, `_sanitize_symbol`
- Top-level variables:
  - `_SYMBOL_RE`, `logger`

### `packages/core/backend/src/signal_intelligence/delivery_service.py`

- Functions:
  - `_allowed_transition`, `_delivery_state_rank`, `acknowledge_delivery`, `apply_user_delivery_policy`, `mark_delivery_seen`, `resolve_user_delivery_symbols`, `resolve_user_whale_threshold_vnd`, `sync_user_delivery_rows`, `transition_delivery_state`, `upsert_user_alert_preference`

### `packages/core/backend/src/signal_intelligence/materializers.py`

- Functions:
  - `_build_alert_evidence`, `_build_snapshot_evidence`, `_map_alert_type`, `_map_direction`, `_map_severity`, `_native_whale_detect`, `_resolve_confidence_from_matched_value`, `_upsert_advisory_signal_event`, `_upsert_market_anomaly_event`, `materialize_ai_signal_alerts`, `materialize_market_anomaly_alerts`, `materialize_stale_quote_alerts`, `materialize_unified_alerts`, `materialize_whale_feed_aggregate`
- Top-level variables:
  - `_MARKET_ANOMALY_PCT_THRESHOLD`, `_MAX_ALERTS_PER_RUN`, `_WHALE_VALUE_MAX_VND`, `_WHALE_VALUE_MIN_VND`, `_WHALE_VOLUME_THRESHOLD`, `logger`

### `packages/core/backend/src/signal_intelligence/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/0002_orderflow_event.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/0003_unifiedalert_source_ref_nonempty_unique.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/0004_unifiedalert_read_model_fields.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/0005_advisorysignalevent_marketanomalyevent_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/signal_intelligence/models.py`

- Classes:
  - `AdvisorySignalEvent` -> methods: `__str__`
  - `MarketAnomalyEvent` -> methods: `__str__`
  - `OrderFlowEvent` -> methods: `__str__`
  - `UnifiedAlert` -> methods: `__str__`
  - `UserAlertDelivery` -> methods: `__str__`
  - `UserAlertPreference` -> methods: `__str__`
  - `WhaleAlertCanonical` -> methods: `__str__`

### `packages/core/backend/src/signal_intelligence/order_flow_engine.py`

- Functions:
  - `_cvd_cache_key`, `_cvd_cache_ttl`, `compute_cvd_buckets_df`, `compute_size_distribution`, `detect_absorption`, `detect_dark_flow_windows`, `detect_iceberg_clustering`, `detect_whale_ticks`, `get_cvd_series_list`, `invalidate_cvd_cache`, `load_session_ticks_df`
- Top-level variables:
  - `CVD_DEFAULT_BUCKET_MINUTES`, `DARK_FLOW_BUY_RATIO_MIN`, `DARK_FLOW_PRICE_CV_MAX`, `DARK_FLOW_VALUE_MIN_VND`, `LARGE_ORDER_THRESHOLD`, `PRICE_LOCK_THRESHOLD_PCT`, `SMALL_ORDER_THRESHOLD`, `WHALE_VALUE_MIN_VND`, `_CVD_CACHE_KEY_PREFIX`, `_CVD_CACHE_TTL_CLOSED`, `_CVD_CACHE_TTL_INTRADAY`, `logger`

### `packages/core/backend/src/signal_intelligence/outbound_notification_service.py`

- No parseable top-level symbols found

### `packages/core/backend/src/signal_intelligence/serializers.py`

- Classes:
  - `OrderFlowEventSerializer`
  - `UnifiedAlertSerializer` -> methods: `get_alert_family`, `get_lane`, `get_summary`
  - `WhaleAlertCanonicalSerializer`

### `packages/core/backend/src/signal_intelligence/tasks.py`

- Functions:
  - `_bulk_write_whale_canonical`, `_get_latest_session_date`, `_upsert_order_flow_event`, `detect_and_store_global_whale_alerts`, `detect_order_flow`, `run_signal_detection_job`
- Top-level variables:
  - `_TICK_MAX_SYMBOLS_PER_RUN`, `__all__`, `logger`

### `packages/core/backend/src/signal_intelligence/tasks_parity.py`

- Functions:
  - `_compare_json_structure`, `_compare_responses`, `_compare_structure_recursive`, `_compute_payload_hash`, `_extract_row_count`, `_make_core_shadow_request`, `shadow_run_daily_parity_report`, `shadow_run_parity_check_task`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/signal_intelligence/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/signal_intelligence/tests/test_ai_signal_lane.py`

- Classes:
  - `AISignalLaneTests` -> methods: `setUp`, `test_ai_signal_materialization_goes_to_ai_lane_only`

### `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py`

- Classes:
  - `AlertCenterAPITests` -> methods: `_create_alert`, `setUp`, `test_ai_feed_and_ai_summary_lane`, `test_feed_summary_detail_context_endpoints`, `test_symbol_stats_matches_summary_scope_ai_lane`, `test_symbol_stats_matches_summary_scope_main_lane`, `test_timeframe_filter_5m_applies_consistently`

### `packages/core/backend/src/signal_intelligence/tests/test_delivery_service.py`

- Classes:
  - `DeliveryServiceTests` -> methods: `_create_alert`, `setUp`, `test_apply_user_delivery_policy_filters_by_threshold_and_preferences`, `test_sync_user_delivery_rows_is_idempotent`, `test_transition_seen_then_acknowledged`, `test_upsert_user_alert_preference_updates_scope`

### `packages/core/backend/src/signal_intelligence/tests/test_detect_historical.py`

- Classes:
  - `DetectHistoricalSessionDateTests` -> methods: `_call`, `test_session_date_invalid_returns_error`, `test_session_date_no_data_skips_gracefully`, `test_session_date_none_uses_latest`, `test_session_date_valid_overrides_latest`

### `packages/core/backend/src/signal_intelligence/tests/test_market_anomaly_events.py`

- Classes:
  - `MarketAnomalyEventTests` -> methods: `setUp`, `test_price_shock_family_emits_from_materializer`, `test_stale_quote_family_emits_from_materializer`

### `packages/core/backend/src/signal_intelligence/tests/test_materializers.py`

- Classes:
  - `UnifiedAlertMaterializerTests` -> methods: `test_alert_center_ack_and_mute_flow`, `test_alert_center_feed_filters_by_user_symbols_and_threshold`, `test_alert_center_feed_supports_alert_family_filter_and_summary_payload`, `test_alert_center_routes_are_registered_under_core_v1`, `test_legacy_unified_alert_routes_are_removed`, `test_materialize_ai_signal_alerts_creates_ai_lane_alert`, `test_materialize_market_anomaly_alerts_creates_signal_alert_from_snapshot`, `test_materialize_stale_quote_alerts_creates_system_alert_from_snapshot`, `test_materialize_unified_alerts_creates_dark_flow_alert_from_order_flow_event`, `test_materialize_unified_alerts_is_idempotent_for_dark_flow_event`, `test_unified_alert_list_view_defaults_to_main_lane_and_supports_ai_lane`
  - `WhaleMaterializerTests` -> methods: `test_materialize_whale_feed_aggregate_is_idempotent_for_existing_event`, `test_materialize_whale_feed_aggregate_skips_incomplete_native_facts`, `test_materialize_whale_feed_aggregate_uses_order_flow_facts_only`

### `packages/core/backend/src/signal_intelligence/tests/test_user_alert_delivery.py`

- Classes:
  - `UserAlertDeliveryAPITests` -> methods: `setUp`, `test_ack_and_mute_flow_for_user_scope`, `test_cross_user_ack_is_blocked_by_scope`

### `packages/core/backend/src/signal_intelligence/tests/test_websocket_consumer.py`

- Classes:
  - `MarketTickerConsumerTests` -> methods: `test_consume_sanitizes_symbol_from_url_kwargs`, `test_group_name_construction_uses_sanitized_symbol`, `test_symbol_sanitization_preserves_alphanumeric`, `test_symbol_validation_accepts_max_length`, `test_symbol_validation_rejects_long_symbols`
  - `SymbolSanitizationTests` -> methods: `test_sanitize_symbol_alphanumeric`, `test_sanitize_symbol_asterisks_removed`, `test_sanitize_symbol_colons_removed`, `test_sanitize_symbol_dots_removed`, `test_sanitize_symbol_empty_string`, `test_sanitize_symbol_max_length`, `test_sanitize_symbol_none`, `test_sanitize_symbol_numbers_only`, `test_sanitize_symbol_only_special_chars`, `test_sanitize_symbol_redis_injection_attempt`, `test_sanitize_symbol_single_char`, `test_sanitize_symbol_slashes_removed`, `test_sanitize_symbol_spaces_removed`, `test_sanitize_symbol_special_chars_removed`, `test_sanitize_symbol_too_long`, `test_sanitize_symbol_valid_lowercase`, `test_sanitize_symbol_valid_mixed`, `test_sanitize_symbol_valid_uppercase`

### `packages/core/backend/src/signal_intelligence/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/signal_intelligence/views.py`

- Classes:
  - `_BaseAlertSummaryView` -> methods: `get`, `get_scoped_queryset`
  - `_BaseAlertSymbolStatsView` -> methods: `get`, `get_scoped_queryset`
  - `AIAlertsFeedView` -> methods: `get_queryset`
  - `AIAlertsSummaryView`
  - `AIAlertsSymbolStatsView`
  - `AlertCenterAcknowledgeView` -> methods: `post`
  - `AlertCenterEventDetailView` -> methods: `get`
  - `AlertCenterFeedCursorPagination`
  - `AlertCenterFeedView` -> methods: `get_queryset`
  - `AlertCenterMutePreferenceRequestSerializer` -> methods: `validate`
  - `AlertCenterMutePreferenceView` -> methods: `post`
  - `AlertCenterSummaryResponseSerializer`
  - `AlertCenterSummaryView`
  - `AlertCenterSymbolContextSerializer`
  - `AlertCenterSymbolContextView` -> methods: `get`
  - `AlertCenterSymbolStatsResponseSerializer`
  - `AlertCenterSymbolStatsView`
  - `AlertFeedBaseListView` -> methods: `get_queryset`
  - `CursorPaginatedOrderFlowEventResponseSerializer`
  - `CursorPaginatedUnifiedAlertResponseSerializer`
  - `OrderFlowEventListView` -> methods: `get_queryset`
  - `SymbolStatsItemSerializer`
  - `UserAlertDeliveryStateSerializer`
  - `UserScopedAlertFeedBaseView` -> methods: `get_queryset`, `list`
  - `WhaleAlertCursorPagination`
  - `WhaleFeedAggregateItemSerializer`
  - `WhaleFeedAggregateResponseSerializer`
  - `WhaleFeedAggregateSummarySerializer`
  - `WhaleFeedAggregateView` -> methods: `get`
- Functions:
  - `_apply_common_alert_filters`, `_build_summary_payload`, `_build_symbol_stats_payload`, `_type_priority_annotation`, `_whale_size_class`
- Top-level variables:
  - `_WHALE_SIDE_MAP`

### `packages/core/backend/src/support/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/support/apps.py`

- Classes:
  - `SupportConfig`

### `packages/core/backend/src/support/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/support/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/support/models.py`

- Classes:
  - `SenderRole`
  - `SupportTicket` -> methods: `__str__`, `_next_ticket_code`, `can_transition`, `save`
  - `SupportTicketCounter`
  - `TicketAttachment`
  - `TicketAuditLog`
  - `TicketCategory`
  - `TicketMessage`
  - `TicketPriority`
  - `TicketStatus`
- Functions:
  - `ticket_attachment_upload_path`

### `packages/core/backend/src/support/permissions.py`

- Classes:
  - `IsStaffUser` -> methods: `has_permission`
  - `IsTicketOwnerOrStaff` -> methods: `has_object_permission`

### `packages/core/backend/src/support/serializers.py`

- Classes:
  - `CreateTicketSerializer` -> methods: `validate_category`
  - `StaffTicketUpdateSerializer` -> methods: `validate`
  - `SupportTicketListSerializer`
  - `TicketAttachmentSerializer`
  - `TicketAuditLogSerializer`
  - `TicketMessageSerializer`
  - `TicketReplySerializer`

### `packages/core/backend/src/support/services.py`

- Functions:
  - `build_ticket_deep_link`, `get_staff_recipients`, `queue_new_ticket_email`, `queue_ticket_reply_email`

### `packages/core/backend/src/support/tasks.py`

- Functions:
  - `send_ticket_email`

### `packages/core/backend/src/support/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/support/views.py`

- Classes:
  - `StaffSupportDashboardView` -> methods: `get`
  - `StaffTicketListView` -> methods: `get`
  - `StaffTicketPatchView` -> methods: `patch`
  - `StaffTicketReplyView` -> methods: `post`
  - `StandardResultsSetPagination`
  - `TicketDetailView` -> methods: `get`
  - `TicketListCreateView` -> methods: `get`, `post`
  - `TicketReopenView` -> methods: `post`
  - `TicketReplyView` -> methods: `post`
- Functions:
  - `_ticket_query_for_user`, `_validate_and_create_attachments`, `_write_audit`
- Top-level variables:
  - `ALLOWED_ATTACHMENT_EXTENSIONS`, `ALLOWED_ATTACHMENT_MIME_PREFIXES`, `MAX_ATTACHMENTS_PER_MESSAGE`, `MAX_ATTACHMENT_SIZE_BYTES`

### `packages/core/backend/src/tenant_lifecycle/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/tenant_lifecycle/admin.py`

- Classes:
  - `TenantLifecycleEventAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`

### `packages/core/backend/src/tenant_lifecycle/apps.py`

- Classes:
  - `TenantLifecycleConfig` -> methods: `ready`

### `packages/core/backend/src/tenant_lifecycle/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/tenant_lifecycle/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/tenant_lifecycle/models.py`

- Classes:
  - `TenantLifecycleEvent`

### `packages/core/backend/src/tenant_lifecycle/signals.py`

- Functions:
  - `capture_original_status`, `log_status_change`

### `packages/core/backend/src/tenant_lifecycle/tasks.py`

- Functions:
  - `_enqueue_trial_warning_email`, `auto_deprovision_stale`, `auto_expire_trials`, `auto_suspend_quota_overflow`, `send_trial_expiry_warning`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/tenant_lifecycle/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/tenant_lifecycle/tests/test_models.py`

- Classes:
  - `TenantLifecycleEventModelTests` -> methods: `test_event_model_persists_metadata`

### `packages/core/backend/src/tenant_lifecycle/tests/test_signals.py`

- Classes:
  - `TenantLifecycleSignalsTests` -> methods: `setUp`, `test_signal_noop_when_status_unchanged`, `test_status_change_creates_lifecycle_event`

### `packages/core/backend/src/tenant_lifecycle/tests/test_tasks.py`

- Classes:
  - `TenantLifecycleTasksTests` -> methods: `setUp`, `test_auto_deprovision_stale_marks_tenant_deprovisioned`, `test_auto_expire_trials_suspends_tenant_and_logs_event`, `test_auto_suspend_quota_overflow_suspends_tenant`, `test_send_trial_expiry_warning_enqueues_once_per_milestone`

### `packages/core/backend/src/user_workspace/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/user_workspace/admin.py`

- Classes:
  - `PortfolioAdmin`
  - `TransactionAdmin`
  - `TransactionInline`
  - `WatchlistAdmin`
  - `WatchlistItemAdmin`
  - `WatchlistItemInline`

### `packages/core/backend/src/user_workspace/apps.py`

- Classes:
  - `UserWorkspaceConfig` -> methods: `ready`

### `packages/core/backend/src/user_workspace/dnse_adapter.py`

- Classes:
  - `DNSEAdapterError`
  - `DNSECredentialMissingError`
  - `DNSEVnbrokerUnavailableError`
- Functions:
  - `_build_vnbroker_dnse_client`, `bootstrap_dnse_session`
- Top-level variables:
  - `DNSE_TOKEN_ENDPOINT`, `logger`

### `packages/core/backend/src/user_workspace/legacy_views.py`

- Classes:
  - `BulkTechnicalBySymbolsView` -> methods: `get`
  - `LegacyWatchlistGroupDetailView` -> methods: `_get`, `delete`, `get`, `patch`
  - `LegacyWatchlistGroupListView` -> methods: `get`, `post`
  - `LegacyWatchlistItemCreateView` -> methods: `post`
  - `LegacyWatchlistItemDeleteView` -> methods: `delete`
  - `PortfolioAnalyticsStubView` -> methods: `get`, `post`
  - `PortfolioListAnalyticsStubView` -> methods: `get`, `post`
  - `PortfolioUserConfigView` -> methods: `_get_profile`, `get`, `put`
  - `PriceAlertRuleListCreateView` -> methods: `get`
  - `SecuritiesGroupDetailView` -> methods: `get`
  - `SecuritiesGroupListCreateView` -> methods: `get`
  - `SecuritiesSeedView` -> methods: `post`
  - `SecuritiesSyncView` -> methods: `post`
  - `TrackedSymbolListCreateView` -> methods: `get`
- Functions:
  - `_empty_list`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`

### `packages/core/backend/src/user_workspace/management/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/user_workspace/management/commands/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/user_workspace/management/commands/audit_orphans.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `packages/core/backend/src/user_workspace/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0002_add_subaccount.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0003_dnse_lightspeed_credential_v2.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0004_add_tenant_fk_and_pricealert.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0005_backfill_portfolio_tenant.py`

- Classes:
  - `Migration`
- Functions:
  - `backfill_portfolio_tenant`, `reverse_backfill_portfolio_tenant`

### `packages/core/backend/src/user_workspace/migrations/0006_backfill_watchlist_tenant.py`

- Classes:
  - `Migration`
- Functions:
  - `backfill_watchlist_tenant`, `reverse_backfill_watchlist_tenant`

### `packages/core/backend/src/user_workspace/migrations/0007_add_tenant_fk_transaction_subaccount.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0008_backfill_transaction_subaccount_tenant.py`

- Classes:
  - `Migration`
- Functions:
  - `backfill_subaccount_tenant`, `backfill_transaction_tenant`, `reverse_backfill`

### `packages/core/backend/src/user_workspace/migrations/0009_trackedsymbol_and_price_alert_cooldown.py`

- Classes:
  - `Migration`
- Functions:
  - `backfill_tracked_symbols_from_default_watchlists`, `noop_reverse`

### `packages/core/backend/src/user_workspace/migrations/0010_remove_subaccount_user_ws_subaccount_tenant_user_idx_and_more.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0011_enforce_tenant_not_null.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0012_enforce_tenant_not_null_real.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0013_screenerrule.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/user_workspace/models.py`

- Classes:
  - `AccountSnapshot` -> methods: `__str__`, `nav`
  - `DNSECredential` -> methods: `__str__`, `get_client_id`, `get_client_secret`, `has_credentials`, `set_client_id`, `set_client_secret`
  - `Portfolio` -> methods: `__str__`
  - `PriceAlert` -> methods: `__str__`
  - `QuarantinedRecord` -> methods: `__str__`
  - `ScreenerRule` -> methods: `__str__`
  - `SubAccount` -> methods: `__str__`
  - `TrackedSymbol` -> methods: `__str__`
  - `Transaction` -> methods: `__str__`
  - `Watchlist` -> methods: `__str__`
  - `WatchlistItem` -> methods: `__str__`

### `packages/core/backend/src/user_workspace/permissions.py`

- Classes:
  - `TenantScopePermission` -> methods: `has_permission`
- Functions:
  - `_resolve_tenant`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`

- Classes:
  - `PortfolioAIAdvisoryAutoRefreshInfoView` -> methods: `get`
  - `PortfolioAIAdvisoryCanonicalView` -> methods: `get`
  - `PortfolioAIAdvisoryCurrentView` -> methods: `get`
  - `PortfolioAIAdvisoryRefreshView` -> methods: `post`
  - `PortfolioAICommandCenterTestView` -> methods: `post`
  - `PortfolioAICommandCenterView` -> methods: `get`, `put`
  - `PortfolioAllocationView` -> methods: `get`
  - `PortfolioAnalyticsView` -> methods: `get`
  - `PortfolioChartView` -> methods: `get`
  - `PortfolioEquityCurveView` -> methods: `get`
  - `PortfolioHoldingsView` -> methods: `get`
  - `PortfolioMarketDiscoveryHubView` -> methods: `get`
  - `PortfolioScreenerRuleDetailView` -> methods: `_get_rule`, `delete`, `get`, `put`
  - `PortfolioScreenerRuleRunView` -> methods: `post`
  - `PortfolioSummaryView` -> methods: `get`
  - `PortfolioSyncView` -> methods: `post`
  - `PortfolioTechnicalsView` -> methods: `get`
  - `PortfolioWhaleAnalyticsView` -> methods: `get`
  - `PortfolioWhaleBacktestStatsView` -> methods: `get`
- Functions:
  - `_combine_trade_datetime`, `_compute_holdings`, `_datetime_in_bounds`, `_ensure_localized_datetime`, `_get_user_portfolio`, `_isoformat_local`, `_resolve_bucket_rows_with_fallback`, `_resolve_whale_bucket_window`, `_resolve_whale_time_bounds`, `_strength_confidence`, `_unwrap_django_request`
- Top-level variables:
  - `_WHALE_ANALYTICS_TIMEFRAMES`

### `packages/core/backend/src/user_workspace/screener_helpers.py`

- Functions:
  - `_apply_screener_condition`, `_compute_macd_hist`, `_compute_rsi`, `_safe_round`, `_screener_build_technical`, `_validate_screener_rules`
- Top-level variables:
  - `_SCREENER_ALLOWED_FIELDS`, `_SCREENER_ALLOWED_OPS`

### `packages/core/backend/src/user_workspace/serializers.py`

- Classes:
  - `DNSECredentialSerializer` -> methods: `get_is_configured`
  - `PortfolioSerializer`
  - `ScreenerRuleSerializer`
  - `SubAccountSerializer`
  - `TransactionSerializer` -> methods: `get_total_value`
  - `WatchlistItemSerializer`
  - `WatchlistSerializer`

### `packages/core/backend/src/user_workspace/signals.py`

- Functions:
  - `auto_populate_tenant_from_user`, `auto_populate_transaction_tenant`, `capture_previous_transaction_symbol`, `sync_price_alert_registry_on_delete`, `sync_price_alert_registry_on_save`, `sync_tracked_symbol_registry_on_delete`, `sync_tracked_symbol_registry_on_save`, `sync_transaction_registry_on_delete`, `sync_transaction_registry_on_save`, `sync_watchlist_item_registry_on_delete`, `sync_watchlist_item_registry_on_save`

### `packages/core/backend/src/user_workspace/tasks.py`

- Functions:
  - `reconcile_all_dnse_transactions_task`, `reconcile_dnse_transactions_task`, `sync_all_dnse_balances_task`, `sync_dnse_accounts_task`, `sync_dnse_balances_task`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/user_workspace/test_portfolio_analytics_native_routes.py`

- Classes:
  - `PortfolioAnalyticsNativeRoutesApiTestCase` -> methods: `_assert_native_matches_legacy`, `setUp`, `test_core_v1_workspace_portfolio_analytics_routes_enforce_user_ownership`, `test_core_v1_workspace_portfolio_analytics_routes_match_legacy_contracts`, `test_core_v1_workspace_portfolio_analytics_routes_require_authentication`
- Top-level variables:
  - `User`

### `packages/core/backend/src/user_workspace/test_portfolio_whale_analytics_compat.py`

- Classes:
  - `PortfolioWhaleAnalyticsCompatApiTestCase` -> methods: `setUp`, `test_whale_analytics_route_returns_snapshot_contract_from_native_core_data`
- Top-level variables:
  - `User`

### `packages/core/backend/src/user_workspace/test_portfolio_whale_analytics_native.py`

- Classes:
  - `PortfolioWhaleAnalyticsNativeApiTestCase` -> methods: `setUp`, `test_core_v1_workspace_whale_analytics_route_returns_snapshot_contract`, `test_whale_analytics_rebuilds_cvd_when_session_facts_missing`
- Top-level variables:
  - `User`

### `packages/core/backend/src/user_workspace/tests.py`

- Classes:
  - `PortfolioIsolationTest` -> methods: `setUp`, `test_portfolio_bulk_query_efficiency_with_tenant_scope`, `test_portfolio_cascade_delete_on_tenant_deprovisioning`, `test_portfolio_query_isolation_single_tenant`
  - `PriceAlertIsolationTest` -> methods: `setUp`, `test_pricealert_bulk_active_query_with_tenant_scope`, `test_pricealert_cascade_delete_on_tenant_deprovisioning`, `test_pricealert_cross_tenant_isolation`
  - `TenantDataIsolationBoundaryTest` -> methods: `setUp`, `test_multi_tenant_user_isolation`, `test_portfolio_without_tenant_assignment_fails_isolation_query`
  - `WatchlistIsolationTest` -> methods: `setUp`, `test_watchlist_cross_tenant_isolation`, `test_watchlist_item_cascade_delete_on_tenant_deprovisioning`

### `packages/core/backend/src/user_workspace/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/user_workspace/views.py`

- Classes:
  - `PortfolioDetailView` -> methods: `delete`, `get`, `patch`
  - `PortfolioListCreateView` -> methods: `get`, `post`
  - `ScreenerRuleListCreateAPIView` -> methods: `get`, `post`
  - `SubAccountDetailAPIView` -> methods: `delete`, `get`, `get_object`, `patch`
  - `SubAccountListCreateAPIView` -> methods: `get`, `post`
  - `SubAccountTransactionsAPIView` -> methods: `get`, `get_sub_account`, `post`
  - `TransactionDetailView` -> methods: `delete`, `patch`
  - `TransactionListCreateView` -> methods: `get`, `post`
  - `WatchlistDetailView` -> methods: `_get_watchlist`, `delete`, `get`, `patch`
  - `WatchlistItemDeleteView` -> methods: `delete`
  - `WatchlistItemListCreateView` -> methods: `get`, `post`
  - `WatchlistListCreateView` -> methods: `get`, `post`
- Functions:
  - `_get_portfolio_or_404`, `_get_transaction_or_404`, `_get_watchlist_or_404`

### `packages/core/backend/src/user_workspace/views_dnse.py`

- Functions:
  - `_extract_trading_token`, `_get_active_dnse_client`, `_to_bool`, `dnse_config_api`, `dnse_create_trading_token_api`, `dnse_place_order_api`, `dnse_reconcile_transactions_api`, `dnse_send_email_otp_api`, `dnse_sync_accounts_api`, `dnse_sync_balances_api`, `dnse_token_status_api`

### `packages/core/backend/src/user_workspace/vnbroker_dnse_compat.py`

- Functions:
  - `_coerce_list`, `_dataframe_to_records`, `_to_float`, `build_dnse_client`, `fetch_account_balance`, `fetch_order_history`, `fetch_sub_accounts`

### `packages/core/backend/src/vninvest_core/__init__.py`

- Functions:
  - `__getattr__`
- Top-level variables:
  - `__all__`

### `packages/core/backend/src/vninvest_core/api_stub.py`

- Classes:
  - `_CoreApiStubHandler` -> methods: `_write_cors_headers`, `_write_json`, `do_GET`, `do_OPTIONS`, `log_message`
- Functions:
  - `_ability_rules`, `_build_target`, `_capability_bootstrap_payload`, `_env_flag`, `_env_int`, `_health_payload`, `_now_isoformat`, `_session_payload`, `_user_identity`, `_visible_groups`, `_visible_routes`, `main`
- Top-level variables:
  - `ROUTE_HANDLERS`

### `packages/core/backend/src/vninvest_core/app_manifest.py`

- Functions:
  - `get_core_manifest`
- Top-level variables:
  - `CORE_APP_MANIFEST`, `CORE_CONTRACT_NAMESPACES`, `CORE_SERVICE_NAMES`

### `packages/core/backend/src/vninvest_core/apps.py`

- Classes:
  - `VninvestCoreConfig`

### `packages/core/backend/src/vninvest_core/asgi.py`

- Top-level variables:
  - `_django_asgi_app`, `application`

### `packages/core/backend/src/vninvest_core/beat_stub.py`

- Functions:
  - `main`

### `packages/core/backend/src/vninvest_core/celery.py`

- Functions:
  - `_set_result_backend`
- Top-level variables:
  - `app`

### `packages/core/backend/src/vninvest_core/contracts/__init__.py`

- Top-level variables:
  - `CONTRACT_NAMESPACES`, `__all__`

### `packages/core/backend/src/vninvest_core/contracts/access/__init__.py`

- Top-level variables:
  - `NAMESPACE`, `__all__`

### `packages/core/backend/src/vninvest_core/contracts/admin_ops/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/contracts/admin_ops/urls.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py`

- Classes:
  - `AdminOpsIntradaySideBackfillApplyView` -> methods: `post`
  - `AdminOpsIntradaySideBackfillPreviewView` -> methods: `post`
  - `AdminOpsIntradaySideBackfillStatusView` -> methods: `get`
  - `AdminOpsIntradayUniverseWarmNowView` -> methods: `post`
  - `AdminOpsMarketGroupsSyncView` -> methods: `post`
  - `AdminOpsPrefetchWarmView` -> methods: `post`
  - `AdminOpsRuntimeKPIView` -> methods: `get`
  - `AdminOpsSignalsConfigPreviewView` -> methods: `post`
  - `AdminOpsSignalsConfigView` -> methods: `get`, `put`
  - `AdminOpsSignalsJobRetryView` -> methods: `post`
  - `AdminOpsSignalsJobsRunView` -> methods: `post`
  - `AdminOpsSignalsJobsView` -> methods: `get`
  - `AdminOpsSignalsMaterializationPreviewView` -> methods: `post`
  - `AdminOpsSignalsRecentEventsView` -> methods: `get`
  - `AdminOpsSignalsRetentionPreviewView` -> methods: `post`
  - `AdminOpsSignalsSummaryView` -> methods: `get`
  - `AdminOpsSignalsUniverseApplyView` -> methods: `post`
  - `AdminOpsSignalsUniversePreviewView` -> methods: `post`
  - `AdminOpsStatsView` -> methods: `get`
  - `AdminOpsSystemAiSettingsView` -> methods: `get`, `put`
  - `AdminOpsVnbrokerBenchmarkLatestView` -> methods: `get`
  - `AdminOpsVnbrokerBenchmarkRunView` -> methods: `post`
  - `AdminOpsVnbrokerConfigChangelogView` -> methods: `get`
  - `AdminOpsVnbrokerConfigCurrentView` -> methods: `get`, `patch`
  - `AdminOpsVnbrokerConfigResetView` -> methods: `post`
- Functions:
  - `_append_vnbroker_changelog`, `_build_config_changes`, `_build_market_observability_snapshot`, `_build_prefetch_health_snapshot`, `_build_prefetch_runtime_settings`, `_build_prefetch_time_policy`, `_build_signal_domain_summary`, `_build_signal_freshness_snapshot`, `_build_signal_materialization_preview_contract`, `_build_signal_preview_contract`, `_build_signal_retention_preview`, `_build_signal_summary_snapshot`, `_build_signal_universe_snapshot`, `_build_signal_whale_governance_snapshot`, `_build_stats_snapshot`, `_calc_p95`, `_coerce_signal_retention_policy`, `_coerce_signal_services_config`, `_coerce_signal_universe_policy`, `_deep_merge_dict`, `_derive_ai_provider`, `_get_celery_active_queues`, `_get_or_create_active_ai_settings`, `_get_or_create_active_vnbroker_config`, `_is_celery_alive`, `_latest_signal_run`, `_legacy_admin_bridge_enabled`, `_legacy_admin_bridge_headers`, `_legacy_admin_bridge_response`, `_legacy_backend_url`, `_normalize_signal_recent_events`, `_normalize_symbol_list`, `_normalized_bridge_payload`, `_now_iso`, `_parse_positive_int`, `_parse_signal_materialization_request`, `_probe_cache_health`, `_record_audit_event`, `_run_vnbroker_benchmark_background`, `_serialize_signal_run`, `_serialize_system_ai_settings`, `_serialize_vnbroker_rulebook`, `_serialize_vnbroker_settings`, `_signal_freshness_state`, `_signal_ownership_snapshot`, `_signal_portfolio_symbols`, `_signal_retention_policy`, `_signal_run_queryset`, `_signal_services_config`, `_signal_universe_policy`, `_signal_watchlist_symbols`, `_signal_write_guard`, `_source_counts`, `_validate_governance_thresholds`, `_validate_vnbroker_payload`, `_vnbroker_extra`
- Top-level variables:
  - `DEFAULT_GOVERNANCE_DELTA_RULEBOOK`, `DEFAULT_GOVERNANCE_DELTA_THRESHOLDS`, `DEFAULT_PREFETCH_RUNTIME_RULEBOOK`, `DEFAULT_PREFETCH_RUNTIME_SETTINGS`, `DEFAULT_PREFETCH_TIME_POLICY`, `DEFAULT_PREFETCH_TIME_POLICY_RULEBOOK`, `DEFAULT_SIGNAL_OWNERSHIP`, `DEFAULT_SIGNAL_RETENTION_POLICY`, `DEFAULT_SIGNAL_SERVICES_CONFIG`, `DEFAULT_SIGNAL_UNIVERSE_POLICY`, `DEFAULT_VNBROKER_EXTRA`, `DEFAULT_VNBROKER_TIMEOUT_CONFIG`, `LEGACY_ADMIN_BRIDGE_TIMEOUT`, `SIGNAL_CONFIG_WRITE_BLOCK_MESSAGE`, `SIGNAL_JOB_WRITE_BLOCK_MESSAGE`, `VNBROKER_ALLOWED_SOURCES`, `_BENCHMARK_RUNNING_MAX_SECONDS`, `logger`

### `packages/core/backend/src/vninvest_core/contracts/market/__init__.py`

- Top-level variables:
  - `NAMESPACE`, `__all__`

### `packages/core/backend/src/vninvest_core/contracts/operator/__init__.py`

- Top-level variables:
  - `NAMESPACE`, `__all__`

### `packages/core/backend/src/vninvest_core/contracts/operator/urls.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `packages/core/backend/src/vninvest_core/contracts/operator/views.py`

- Classes:
  - `OperatorHealthView` -> methods: `get`
  - `OperatorOverviewView` -> methods: `get`
- Functions:
  - `_build_operator_components`

### `packages/core/backend/src/vninvest_core/contracts/partner/__init__.py`

- Top-level variables:
  - `NAMESPACE`, `__all__`

### `packages/core/backend/src/vninvest_core/db_router.py`

- Classes:
  - `CoreRouter` -> methods: `allow_migrate`, `db_for_read`, `db_for_write`
- Top-level variables:
  - `_CORE_APPS`

### `packages/core/backend/src/vninvest_core/env_validation.py`

- Functions:
  - `get_frontend_url`, `get_optional_env`, `get_required_env`, `validate_production_settings`

### `packages/core/backend/src/vninvest_core/exceptions.py`

- Classes:
  - `AuthenticationErrorException`
  - `ConflictErrorException`
  - `CoreAPIException` -> methods: `__init__`, `get_envelope`
  - `InternalErrorException`
  - `NotFoundErrorException`
  - `PermissionErrorException`
  - `RateLimitErrorException`
  - `StandardErrorEnvelope` -> methods: `__init__`, `to_dict`, `to_response`
  - `ValidationErrorException`
- Functions:
  - `core_api_exception_handler`

### `packages/core/backend/src/vninvest_core/management/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/management/commands/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `packages/core/backend/src/vninvest_core/management/commands/sync_scheduler_queues.py`

- Classes:
  - `Command` -> methods: `handle`

### `packages/core/backend/src/vninvest_core/monitoring/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/monitoring/queue_metrics.py`

- Functions:
  - `_estimated_calls_per_minute`, `_freshness_state`, `_normalize_queue_name`, `build_scheduler_queue_metrics_snapshot`
- Top-level variables:
  - `FRESHNESS_FRESH_THRESHOLD_SECONDS`, `FRESHNESS_WARM_THRESHOLD_SECONDS`

### `packages/core/backend/src/vninvest_core/pagination.py`

- Classes:
  - `AlertCursorPagination`
  - `AuditCursorPagination`
  - `CoreCursorPagination`
  - `OrderFlowCursorPagination`
  - `SnapshotCursorPagination`
  - `StandardPageNumberPagination` -> methods: `get_paginated_response`

### `packages/core/backend/src/vninvest_core/queue_policy.py`

- Functions:
  - `build_celery_task_queues`, `build_scheduler_queue_map`, `build_task_routes`
- Top-level variables:
  - `CELERY_TASK_QUEUES`, `QUEUE_DOMAIN_MATRIX`, `QUEUE_NAMES`, `SCHEDULER_QUEUE_MAP`, `TASK_ROUTES`

### `packages/core/backend/src/vninvest_core/settings.py`

- Top-level variables:
  - `ADVISORY_TOKEN_BUDGET`, `ALLOWED_HOSTS`, `ASGI_APPLICATION`, `BASE_DIR`, `BLOCKED_DISPOSABLE_DOMAINS`, `CACHES`, `CELERY_ACCEPT_CONTENT`, `CELERY_BEAT_SCHEDULE`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_RESULT_SERIALIZER`, `CELERY_TASK_ROUTES`, `CELERY_TASK_SERIALIZER`, `CELERY_TIMEZONE`, `CHANNEL_LAYERS`, `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_ALL_ORIGINS`, `CORS_API_DYNAMIC_ALLOW`, `CSRF_TRUSTED_ORIGINS`, `DATABASES`, `DATABASE_ROUTERS`, `DEBUG`, `DEFAULT_AUTO_FIELD`, `DEFAULT_FROM_EMAIL`, `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_HOST_PASSWORD`, `EMAIL_HOST_USER`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_VERIFICATION_LOCKOUT_TIMEOUT`, `EMAIL_VERIFICATION_MAX_ATTEMPTS`, `EMAIL_VERIFICATION_RESEND_COOLDOWN`, `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`, `FRONTEND_URL`, `GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS`, `GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_DEFAULT`, `GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MAX`, `GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MIN`, `INSTALLED_APPS`, `LANGUAGE_CODE`, `LEGACY_BACKEND_URL`, `LOGGING`, `LOGIN_IP_LIMIT_THRESHOLD`, `LOGIN_SUBNET_LIMIT_THRESHOLD`, `LOGIN_USER_LIMIT_THRESHOLD`, `MIDDLEWARE`, `OPENAI_API_KEY`, `OPENAI_DEFAULT_MODEL`, `REDIS_URL`, `REGISTER_EMAIL_LIMIT_THRESHOLD`, `REGISTER_IP_LIMIT_THRESHOLD`, `REGISTER_SUBNET_LIMIT_THRESHOLD`, `REST_FRAMEWORK`, `ROOT_URLCONF`, `SECRET_KEY`, `SECURE_PROXY_SSL_HEADER`, `SPECTACULAR_SETTINGS`, `STATIC_ROOT`, `STATIC_URL`, `STORAGES`, `STRICT_TURNSTILE_ENFORCEMENT`, `TEMPLATES`, `TIME_ZONE`, `TURNSTILE_SECRET_KEY`, `USE_I18N`, `USE_TZ`, `USE_X_FORWARDED_HOST`, `WSGI_APPLICATION`, `_allowed_hosts_raw`, `_cors_origins_default`, `_cors_origins_raw`, `_csrf_trusted_origins_default`, `_csrf_trusted_origins_raw`, `_legacy_db_url`, `_redis_url`, `_secret_key_default`, `_sentry_dsn`

### `packages/core/backend/src/vninvest_core/stub_heartbeat.py`

- Functions:
  - `_health_file`, `_health_max_age_seconds`, `_now_isoformat`, `run_healthcheck`, `write_heartbeat`

### `packages/core/backend/src/vninvest_core/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/tests/test_env_validation.py`

- Classes:
  - `GetFrontendUrlTests` -> methods: `test_get_frontend_url_dev_returns_localhost`, `test_get_frontend_url_dev_uses_env_if_set`, `test_get_frontend_url_prod_requires_env`, `test_get_frontend_url_strips_trailing_slash`
  - `GetOptionalEnvTests` -> methods: `test_get_optional_env_returns_default`, `test_get_optional_env_returns_value`, `test_get_optional_env_strips_whitespace`
  - `GetRequiredEnvTests` -> methods: `test_get_required_env_includes_description`, `test_get_required_env_raises_if_empty`, `test_get_required_env_raises_if_missing`, `test_get_required_env_returns_value`, `test_get_required_env_strips_whitespace`
  - `ValidateProductionSettingsTests` -> methods: `test_validate_production_settings_requires_frontend_url`, `test_validate_production_settings_skips_in_dev`

### `packages/core/backend/src/vninvest_core/tests/test_exception_handling.py`

- Classes:
  - `DatabaseExceptionHandlingTests` -> methods: `setUp`, `test_duplicate_registration_returns_conflict_or_bad_request`, `test_endpoint_with_nonexistent_resource_returns_proper_error`
  - `ExceptionContextTests` -> methods: `setUp`, `test_request_id_in_error_response`, `test_request_id_unique_per_request`
  - `ExceptionEdgeCasesTests` -> methods: `setUp`, `test_exception_with_none_values`, `test_exception_with_special_characters`, `test_exception_with_very_long_input`
  - `ExceptionEnvelopeFormatTests` -> methods: `setUp`, `test_envelope_on_401_unauthorized`, `test_envelope_on_rate_limit_error`, `test_envelope_on_validation_error`
  - `ExceptionLoggingTests` -> methods: `setUp`, `test_rate_limit_exception_returns_429`, `test_validation_exception_returns_proper_response`
  - `NoSilentFailureTests` -> methods: `setUp`, `test_all_auth_endpoints_return_error_not_500`, `test_invalid_requests_dont_return_500`
  - `SignalPropagationTests` -> methods: `setUp`, `test_exception_handler_invoked_on_auth_error`, `test_exception_handler_invoked_on_validation_error`
- Top-level variables:
  - `User`

### `packages/core/backend/src/vninvest_core/tests/test_exception_handling_a6.py`

- Classes:
  - `A61_StandardErrorEnvelopeFormatTests` -> methods: `setUp`, `test_rate_limit_error_has_proper_envelope`, `test_validation_error_has_proper_envelope`
  - `A62_ProperHttpSemanticsTests` -> methods: `setUp`, `test_missing_required_fields_returns_400_not_500`, `test_password_reset_returns_proper_response`, `test_validation_error_returns_400_not_500`
  - `A63_RequestIdCaptureTests` -> methods: `setUp`, `test_request_id_present_on_error_responses`, `test_request_ids_are_unique`
  - `A64_NoSilentFailuresTests` -> methods: `setUp`, `test_all_invalid_auth_requests_return_4xx_not_500`, `test_none_values_dont_cause_500`, `test_special_characters_handled`
  - `A65_RateLimitErrorEnvelopeTests` -> methods: `setUp`, `test_login_rate_limit_429_with_envelope`, `test_register_rate_limit_429_with_envelope`
- Top-level variables:
  - `User`

### `packages/core/backend/src/vninvest_core/tests/test_rate_limiting.py`

- Classes:
  - `RateLimitDecoratorComplianceTests` -> methods: `test_checklist_h2_login_rate_limit`, `test_checklist_h2_password_reset_rate_limit`, `test_checklist_h2_register_rate_limit`
  - `RateLimitLoginEndpointTests` -> methods: `setUp`, `test_login_rate_limit_error_envelope`, `test_login_sixth_request_rate_limited`, `test_login_within_limit`
  - `RateLimitPasswordResetEndpointTests` -> methods: `setUp`, `test_password_reset_different_emails_independent_limits`, `test_password_reset_fourth_request_rate_limited`, `test_password_reset_rate_limit_error_envelope`, `test_password_reset_within_limit`
  - `RateLimitRegisterEndpointTests` -> methods: `setUp`, `test_register_fourth_request_rate_limited`, `test_register_rate_limit_error_envelope`, `test_register_within_limit`
  - `RateLimitWindowExpiryTests` -> methods: `setUp`, `test_password_reset_limit_expires_after_window`, `test_register_limit_expires_after_window`
- Top-level variables:
  - `User`

### `packages/core/backend/src/vninvest_core/tests/test_status_codes_and_errors.py`

- Classes:
  - `ErrorEnvelopeConsistencyTests` -> methods: `setUp`, `test_error_envelope_has_iso8601_timestamp`, `test_error_envelope_has_request_id`, `test_success_response_preserves_envelope_compatibility`, `test_validation_error_has_standard_envelope`
  - `StandardErrorEnvelopeTests` -> methods: `test_envelope_creation_with_defaults`, `test_envelope_to_dict`, `test_envelope_to_response`, `test_envelope_with_field_errors`
  - `StatusCodeSemanticsTests` -> methods: `setUp`, `test_duplicate_email_returns_409_conflict`, `test_duplicate_username_returns_409_conflict`, `test_invalid_register_returns_400_bad_request`, `test_password_reset_confirm_invalid_token_returns_400_bad_request`, `test_password_reset_confirm_valid_token_returns_200_ok`, `test_password_reset_nonexistent_email_returns_200_ok`, `test_password_reset_request_returns_200_ok`, `test_register_returns_201_created`
- Top-level variables:
  - `User`

### `packages/core/backend/src/vninvest_core/tests/test_tenant_isolation_b3.py`

- Classes:
  - `B31_TransactionTenantIsolationTests` -> methods: `setUp`, `test_tenant_1_and_tenant_2_transactions_are_separate`, `test_transaction_cannot_exist_without_portfolio`, `test_transaction_model_has_portfolio_relation`, `test_user_cannot_query_other_tenant_transactions_via_portfolio`
  - `B32_PortfolioTenantIsolationTests` -> methods: `setUp`, `test_portfolio_list_shows_only_own_portfolios`, `test_portfolio_model_has_tenant_and_user_fks`, `test_portfolio_retrieve_access_control`
  - `B33_WatchlistTenantIsolationTests` -> methods: `setUp`, `test_watchlist_list_shows_only_own_watchlists`, `test_watchlist_model_has_user_and_tenant_fks`, `test_watchlist_retrieve_access_control`
  - `B34_CommercialTenantIsolationTests` -> methods: `setUp`, `test_invoice_scoped_to_tenant`, `test_quota_record_scoped_to_tenant`, `test_subscription_scoped_to_tenant`
  - `B35_TenantFilteringAtQueryLayer` -> methods: `setUp`, `test_query_filters_by_portfolio_user`, `test_query_filters_by_tenant_explicit_fk`, `test_query_never_returns_other_tenant_data`
  - `B36_NoLeakageThroughQueryLayer` -> methods: `setUp`, `test_portfolio_query_by_tenant_no_other_tenant_data`, `test_transaction_query_by_user_no_other_tenant_data`, `test_watchlist_query_by_tenant_no_other_tenant_data`
  - `TenantIsolationSetupMixin` -> methods: `setUp_multi_tenant`
- Top-level variables:
  - `User`

### `packages/core/backend/src/vninvest_core/tests/test_user_workspace_tenant_isolation.py`

- Classes:
  - `UserWorkspaceTenantIsolationTests` -> methods: `setUp`, `setUpTestData`, `test_T01_portfolio_isolation_user1_cannot_see_user2_portfolio`, `test_T02_portfolio_filter_by_tenant_a`, `test_T03_portfolio_filter_by_tenant_b`, `test_T04_transaction_filtered_by_portfolio_tenant`, `test_T05_transaction_cross_tenant_access_returns_404`, `test_T06_user3_sees_only_tenant_a_when_scoped`, `test_T07_watchlist_filtered_by_tenant`, `test_T08_watchlist_item_not_accessible_cross_tenant`, `test_T09_subaccount_filtered_by_tenant`, `test_T10_subaccount_cross_tenant_blocked`, `test_T11_portfolio_list_pagination_format`, `test_T12_transaction_list_pagination_with_filter`, `test_T13_401_returns_standard_envelope`, `test_T14_404_returns_standard_envelope`, `test_T15_400_field_errors_in_envelope`, `test_T16_create_portfolio_sets_tenant`, `test_T17_create_transaction_inherits_portfolio_tenant`, `test_T18_database_query_isolation`, `test_T19_legacy_watchlist_group_list_isolation`, `test_T20_legacy_watchlist_group_detail_isolation`, `test_T21_legacy_watchlist_item_create_isolation`, `test_T22_legacy_watchlist_item_delete_isolation`, `test_T23_legacy_securities_group_list_isolation`, `test_T24_tenant_member_inactive_status_blocked`, `test_T25_multi_tenant_user_can_select_tenant_by_query_hint`, `test_T26_invalid_tenant_hint_is_forbidden`

### `packages/core/backend/src/vninvest_core/urls.py`

- Functions:
  - `admin_ops_gone`
- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/vninvest_core/utils/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/utils/crypto.py`

- Functions:
  - `decrypt_secret`, `encrypt_secret`, `get_crypto_cipher`

### `packages/core/backend/src/vninvest_core/utils/encryption.py`

- Functions:
  - `_build_fernet`, `decrypt_string`, `encrypt_string`, `hash_with_pepper`

### `packages/core/backend/src/vninvest_core/utils/legacy_bridge.py`

- Functions:
  - `legacy_bridge_response`

### `packages/core/backend/src/vninvest_core/utils/legacy_stubs.py`

- Classes:
  - `GenericEmptyListView` -> methods: `get`, `post`
  - `GenericEmptyStaffView` -> methods: `get`, `post`, `put`
- Functions:
  - `_empty_list`, `_empty_paginated`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`

### `packages/core/backend/src/vninvest_core/views_health.py`

- Functions:
  - `capability_bootstrap`, `health`

### `packages/core/backend/src/vninvest_core/worker_stub.py`

- Functions:
  - `main`

### `packages/core/backend/src/vninvest_core/wsgi.py`

- Top-level variables:
  - `application`

### `packages/core/backend/tests/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/tests/test_admin_ops_contract_api.py`

- Classes:
  - `AdminOpsContractApiTests` -> methods: `setUp`, `test_admin_ops_routes_resolve_to_native_contract_views`, `test_benchmark_latest_returns_cached_native_report`, `test_benchmark_latest_returns_native_empty_state_without_report`, `test_benchmark_routes_remain_native_even_when_legacy_bridge_is_configured`, `test_benchmark_run_dispatches_native_task`, `test_bridge_backed_admin_ops_routes_delegate_to_legacy_backend`, `test_market_groups_sync_remains_native_without_bridge`, `test_prefetch_warm_async_dispatches_native_ingest_task`, `test_prefetch_warm_sync_returns_native_payload`, `test_runtime_kpi_aggregates_request_trace_snapshot`, `test_stats_returns_core_snapshot_shape`, `test_system_ai_settings_updates_governance_thresholds_and_blocks_prefetch_writers`, `test_vnbroker_config_update_reset_and_changelog_are_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_admin_ops_signals_contract_api.py`

- Classes:
  - `AdminOpsSignalsContractApiTests` -> methods: `setUp`, `test_signal_events_jobs_and_guarded_writes`, `test_signal_preview_routes_return_native_contract_payloads`, `test_signal_routes_resolve_to_native_contract_views`, `test_signal_routes_stay_native_when_legacy_bridge_enabled`, `test_signal_summary_and_config_return_native_payload`, `test_signal_summary_keeps_native_ownership_when_legacy_bridge_enabled`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_admin_route.py`

- Classes:
  - `CoreAdminRouteTests` -> methods: `test_admin_login_page_is_servable`, `test_admin_root_redirects_to_login`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_advertising.py`

- Classes:
  - `AdServingAPITests` -> methods: `test_anonymous_and_free_serve_returns_ads`, `test_premium_serve_disables_ads`
  - `AdvertisingBaseTests` -> methods: `setUp`
  - `CachingAndCeleryTaskTests` -> methods: `test_aggregate_ad_metrics_consumes_and_updates_db`, `test_rebuild_ads_cache_index`
  - `MetricsTrackingAPITests` -> methods: `get_valid_sig`, `test_log_view_rejects_expired_signature`, `test_log_view_verifies_signature_and_queues`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_advisory_api_routes.py`

- Classes:
  - `AdvisoryManualTriggerApiTests` -> methods: `_create_quota_record`, `_current_period`, `setUp`, `test_advisory_refresh_enforces_cooldown_between_manual_triggers`, `test_advisory_refresh_rejects_suspended_tenant`, `test_advisory_refresh_rejects_when_quota_is_exhausted`, `test_advisory_refresh_route_triggers_pending_job_and_records_audit`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_advisory_ssot.py`

- Classes:
  - `AdvisorySsotContextMergeTests` -> methods: `_create_quota_record`, `_current_period`, `setUp`, `test_advisory_refresh_falls_back_to_system_api_key`, `test_advisory_refresh_materializes_session_and_components`, `test_advisory_refresh_merges_context_correctly`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_advisory_tasks.py`

- Classes:
  - `AdvisoryTasksTests` -> methods: `setUp`, `test_reset_daily_token_budgets_resets_counters`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_audit_logs_api.py`

- Classes:
  - `PartnerAuditLogsAPITests` -> methods: `_authenticate_with_pat`, `_authenticate_with_session`, `setUp`, `test_actor_username_populated`, `test_cross_tenant_access_returns_403`, `test_event_structure_has_required_fields`, `test_filter_by_date_range`, `test_filter_by_end_date`, `test_filter_by_event_type`, `test_filter_by_start_date`, `test_list_audit_logs_returns_tenant_logs`, `test_member_can_access_audit_logs`, `test_pagination_works`, `test_suspended_tenant_cannot_access`, `test_unauthenticated_request_returns_401`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_byok_security.py`

- Classes:
  - `BYOKSecurityTests` -> methods: `test_decrypt_empty_returns_empty_string`, `test_decrypt_invalid_token_raises_runtime_error`, `test_decrypt_with_different_key_raises_runtime_error`, `test_encrypt_and_decrypt_returns_original_plaintext`, `test_encrypt_empty_raises_value_error`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_commercial_tasks.py`

- Classes:
  - `_QuotaCacheStub` -> methods: `__init__`, `add`, `get`
  - `_ScanCacheClient` -> methods: `__init__`, `scan_iter`
  - `CommercialTaskScheduleTests` -> methods: `test_commercial_tasks_route_to_default_queue`
  - `CommercialTasksTests` -> methods: `setUp`, `test_check_overdue_invoices_marks_past_due_and_suspends_tenant`, `test_flush_quota_counters_writes_db_and_is_idempotent`, `test_generate_monthly_invoices_creates_rows_for_active_subscriptions`, `test_send_quota_warning_deduplicates_per_day`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_global_symbol_registry_workspace_integration.py`

- Classes:
  - `GlobalSymbolRegistryWorkspaceIntegrationTests` -> methods: `setUp`, `test_legacy_watchlist_item_paths_sync_registry`, `test_workspace_transaction_symbol_change_and_delete_resync_registry`, `test_workspace_watchlist_item_create_and_delete_sync_registry`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_identity_access.py`

- Classes:
  - `CorePartnerPATApiTests` -> methods: `setUp`, `test_cross_tenant_pat_issue_is_blocked`, `test_issue_pat_allows_staff_without_tenant_using_service_account_id`, `test_issue_pat_blocks_non_staff_without_tenant`, `test_issue_pat_rejects_disabled_service_account`, `test_issue_pat_rejects_scopes_outside_service_account_policy`, `test_issue_pat_returns_frontend_contract_and_secret_authenticates`, `test_partner_pat_list_excludes_human_session_credentials`, `test_revoke_human_session_pat_returns_not_found`, `test_revoke_pat_invalidates_token`, `test_rotate_human_session_pat_returns_not_found`, `test_rotate_pat_returns_nested_new_token_and_keeps_old_token_in_grace_window`
  - `CorePartnerServiceAccountApiTests` -> methods: `setUp`, `test_service_account_list_uses_created_at_cursor_pagination_and_create_succeeds`
  - `CorePATCredentialModelTests` -> methods: `setUp`, `test_issue_pat_returns_credential_and_raw_secret`, `test_pat_token_prefix_is_12_chars`, `test_resolve_from_raw_secret`, `test_resolve_returns_none_for_invalid_secret`, `test_revoke_pat`
  - `CoreServiceAccountModelTests` -> methods: `setUp`, `test_create_service_account`, `test_service_account_belongs_to_tenant`
  - `CoreTenantModelTests` -> methods: `setUp`, `test_create_tenant`, `test_tenant_auto_uuid`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_identity_access_api_routes.py`

- Classes:
  - `IdentityAccessApiRouteTests` -> methods: `_login_and_authenticate`, `setUp`, `test_login_me_capabilities_and_userconfig_routes_are_native`, `test_login_session_pat_has_expiry_and_refresh_rotates_secret`, `test_partner_pat_routes_are_native_and_list_never_leaks_secret`, `test_partner_service_accounts_route_is_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_identity_access_permissions.py`

- Classes:
  - `IsTenantActivePermissionTests` -> methods: `_request_for_user`, `setUp`, `test_active_tenant_allowed`, `test_deprovisioned_tenant_blocked`, `test_superuser_bypasses_tenant_status`, `test_suspended_tenant_blocked`, `test_trial_tenant_allowed`, `test_user_without_tenant_allowed`
  - `IsTenantActiveRouteTests` -> methods: `setUp`, `test_public_legal_pages_route_unchanged`, `test_superuser_bypasses_suspended_tenant_on_partner_service_accounts_route`, `test_suspended_tenant_blocks_partner_service_accounts_route`
  - `PartnerScopeGuardRouteTests` -> methods: `setUp`, `test_cannot_delete_last_active_service_account`, `test_cannot_disable_last_active_service_account`, `test_forged_human_markers_without_human_session_flag_do_not_bypass_scope_guard`, `test_human_login_pat_bypasses_partner_scope_guard`, `test_machine_pat_cannot_inherit_operator_access_from_staff_owner`, `test_machine_pat_cannot_issue_scope_outside_its_own_grants`, `test_machine_pat_cannot_spoof_human_login_markers`, `test_machine_pat_cannot_use_refresh_flow`, `test_machine_pat_is_forbidden_on_dnse_credential_route`, `test_machine_pat_with_manage_pats_scope_can_access_partner_pat_routes`, `test_machine_pat_with_manage_tenant_scope_can_access_partner_billing_route`, `test_machine_pat_without_manage_pats_scope_is_forbidden`, `test_machine_pat_without_manage_tenant_scope_is_forbidden_on_partner_billing_route`, `test_machine_pat_without_manage_tenant_scope_is_forbidden_on_tenant_members_route`, `test_pat_from_disabled_service_account_cannot_authenticate`, `test_refresh_token_from_disabled_service_account_is_rejected`, `test_service_account_detail_route_requires_manage_service_accounts_scope`, `test_staff_human_session_pat_keeps_operator_access`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_market_data_api_routes.py`

- Classes:
  - `IntradayApiRouteTests` -> methods: `setUp`, `test_intraday_prices_bridges_to_legacy_chart`, `test_intraday_prices_graceful_degradation`, `test_intraday_prices_requires_auth`, `test_intraday_prices_route_resolves`, `test_intraday_tape_bridges_to_legacy_intraday`, `test_intraday_tape_graceful_degradation`, `test_intraday_tape_requires_auth`, `test_intraday_tape_route_resolves`, `test_symbol_is_uppercased_prices`, `test_symbol_is_uppercased_tape`
  - `MarketDataApiRouteTests` -> methods: `setUp`, `test_daily_price_route_is_native`, `test_stock_profile_routes_are_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_market_data_intraday_native.py`

- Classes:
  - `IntradayModelTests` -> methods: `setUp`, `test_create_intraday_bar`, `test_create_intraday_tick`, `test_intraday_bar_unique_constraint`, `test_query_intraday_bars_by_symbol_and_timeframe`, `test_query_intraday_ticks_by_symbol_and_timestamp_range`
  - `IntradayNativeViewTests` -> methods: `setUp`, `setUpTestData`, `test_intraday_prices_auth_required`, `test_intraday_prices_nonexistent_symbol`, `test_intraday_prices_returns_correct_schema`, `test_intraday_prices_route_resolves`, `test_intraday_prices_success`, `test_intraday_prices_with_days_param`, `test_intraday_prices_with_timeframe_param`, `test_intraday_tape_auth_required`, `test_intraday_tape_cache_first_pattern`, `test_intraday_tape_nonexistent_symbol`, `test_intraday_tape_returns_correct_schema`, `test_intraday_tape_route_resolves`, `test_intraday_tape_success`, `test_intraday_tape_with_page_size_param`
  - `VnbrokerAdapterPhase2Tests` -> methods: `setUp`, `test_fetch_intraday_ohlcv_returns_dict`, `test_fetch_intraday_ohlcv_with_days_filter`, `test_fetch_intraday_tape_returns_dict`

### `packages/core/backend/tests/test_market_serving.py`

- Classes:
  - `SessionFactsModelTests` -> methods: `test_create_session_facts`
  - `SymbolSnapshotModelTests` -> methods: `test_create_snapshot`, `test_unique_together_symbol_session_date`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_market_serving_api_routes.py`

- Classes:
  - `MarketServingApiRouteTests` -> methods: `setUp`, `test_session_facts_list_and_detail_routes_are_native`, `test_symbol_snapshot_list_and_detail_routes_are_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_onboarding_views.py`

- Classes:
  - `OnboardingRegisterTenantTest` -> methods: `setUp`, `test_register_tenant_creates_lifecycle_event`, `test_register_tenant_duplicate_409`, `test_register_tenant_max_length_display_name`, `test_register_tenant_missing_display_name_400`, `test_register_tenant_over_max_length_display_name`, `test_register_tenant_response_has_required_fields`, `test_register_tenant_success_creates_trial`, `test_register_tenant_unauthenticated_401`, `test_register_tenant_with_whitespace_display_name`
- Top-level variables:
  - `User`

### `packages/core/backend/tests/test_operator_contract_api.py`

- Classes:
  - `OperatorContractApiTests` -> methods: `setUp`, `test_operator_routes_resolve_and_return_supported_snapshots`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_ops_audit.py`

- Classes:
  - `AuditEventModelTests` -> methods: `test_create_audit_event`
  - `RequestTraceMiddlewareTests` -> methods: `setUp`, `test_generates_uuid_when_no_header`, `test_injects_x_request_id_from_header`, `test_records_access_audit_event_for_regular_requests`, `test_response_always_has_x_request_id_header`, `test_skips_audit_log_self_requests`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_public_bootstrap_routes.py`

- Classes:
  - `NativePublicBootstrapRouteTests` -> methods: `setUp`, `test_public_legal_pages_route_resolves_and_returns_results_envelope`, `test_tracked_symbols_route_remains_native_when_legacy_url_configured`, `test_tracked_symbols_route_resolves_and_returns_empty_list`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_realtime_compat_api_routes.py`

- Classes:
  - `RealtimeCompatApiRouteTests` -> methods: `setUp`, `test_realtime_routes_bridge_to_legacy_backend`, `test_realtime_routes_resolve_to_bridge_view`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_realtime_unified_alerts_native_api.py`

- Classes:
  - `RealtimeUnifiedAlertsNativeApiTests` -> methods: `setUp`, `test_unified_alerts_accepts_watchlist_group_ids_from_core_watchlists`, `test_unified_alerts_falls_back_to_legacy_bridge_when_core_scope_is_empty`, `test_unified_alerts_respects_severity_min_and_cursor_pagination`, `test_unified_alerts_returns_legacy_contract_from_core_tables`, `test_unified_alerts_route_resolves_to_native_compat_view`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_realtime_whale_campaigns_native_api.py`

- Classes:
  - `RealtimeWhaleCampaignsNativeApiTests` -> methods: `_create_whale_event`, `_tracked_bridge_side_effect`, `setUp`, `test_whale_campaigns_groups_core_events_into_native_campaigns`, `test_whale_campaigns_reject_invalid_campaign_limit`, `test_whale_campaigns_return_native_empty_for_default_tracked_scope_without_route_fallback`, `test_whale_campaigns_route_resolves_to_native_compat_view`, `test_whale_campaigns_support_cursor_pagination`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_realtime_whale_feed_aggregate_native_api.py`

- Classes:
  - `RealtimeWhaleFeedAggregateNativeApiTests` -> methods: `setUp`, `test_whale_feed_aggregate_accepts_watchlist_group_ids_from_core_watchlists`, `test_whale_feed_aggregate_defaults_to_tracked_symbols_via_legacy_bridge_input`, `test_whale_feed_aggregate_falls_back_to_legacy_bridge_when_core_scope_is_empty`, `test_whale_feed_aggregate_respects_matched_value_cursor_pagination`, `test_whale_feed_aggregate_returns_legacy_contract_from_core_tables`, `test_whale_feed_aggregate_returns_native_empty_for_default_tracked_scope_without_route_fallback`, `test_whale_feed_aggregate_route_resolves_to_native_compat_view`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_runtime_baseline.py`

- Classes:
  - `CoreRuntimeBaselineTests` -> methods: `test_capability_bootstrap_exposes_saas_routes_and_snapshot_version`, `test_healthcheck_accepts_fresh_written_file`, `test_manifest_exposes_core_topology`
  - `DjangoHealthViewTests` -> methods: `setUp`, `test_api_health_compat_route_returns_ok`, `test_capability_bootstrap_returns_navigation`, `test_health_view_returns_ok`, `test_x_request_id_generated_when_absent`, `test_x_request_id_propagated`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_saas14_materializers.py`

- Classes:
  - `TestCursorPaginationClasses` -> methods: `test_alert_cursor_pagination_ordering`, `test_audit_cursor_pagination_page_size`, `test_core_cursor_pagination_defaults`
  - `TestMaterializePreOpenSnapshots` -> methods: `setUp`, `test_pre_open_snapshot_materializer_populates_core_snapshot`
  - `TestMaterializeSessionFactsNative` -> methods: `test_materializer_persists_bucket_strengths_for_requested_symbol`, `test_no_whale_data_returns_native_empty_result`
  - `TestMaterializeSymbolSnapshotNoLegacyUrl` -> methods: `test_no_legacy_url_returns_skipped`
  - `TestMaterializeUnifiedAlertsDedup` -> methods: `test_duplicate_event_rows_are_deduped_before_upsert`

### `packages/core/backend/tests/test_scheduler_management_commands.py`

- Classes:
  - `CheckSchedulerQueueDriftTestCase` -> methods: `setUp`, `test_drift_detected_with_warn_only`, `test_drift_detected_without_warn_only_exits`, `test_ignores_unknown_tasks`, `test_multiple_drifts_detected`, `test_no_drift_detected`, `test_queue_policy_ssot_is_shared_by_commands`
  - `SyncSchedulerQueuesTestCase` -> methods: `setUp`, `test_sync_ignores_unknown_tasks`, `test_sync_multiple_tasks`, `test_sync_single_task`, `test_sync_with_correct_queue_no_update`

### `packages/core/backend/tests/test_session_facts_api.py`

- Classes:
  - `SessionFactsCvdApiTests` -> methods: `setUp`, `test_cvd_400_when_trade_date_is_invalid`, `test_cvd_404_when_no_materialized_data_exists`, `test_cvd_404_when_requested_trade_date_is_missing`, `test_cvd_404_when_requested_window_is_not_materialized`, `test_cvd_returns_exact_requested_trade_date`, `test_cvd_returns_materialized_series`
  - `SessionFactsDetailHappyPathTests` -> methods: `setUp`, `test_delta_strength_pct_computed_correctly`, `test_delta_strength_pct_zero_when_no_volume`, `test_detail_has_required_fields`, `test_detail_returns_200`, `test_detail_returns_exact_requested_trade_date`, `test_detail_source_header_present`, `test_detail_symbol_uppercased`
  - `SessionFactsListHappyPathTests` -> methods: `setUp`, `test_list_filter_by_symbol`, `test_list_filter_symbol_uppercased`, `test_list_returns_200`
  - `SessionFactsNotFoundTests` -> methods: `setUp`, `test_detail_404_error_envelope_has_standard_fields`, `test_detail_404_when_no_materialized_data_exists`, `test_detail_404_when_requested_trade_date_is_missing`
  - `SessionFactsOpenApiMetadataTests` -> methods: `test_detail_view_has_extend_schema`
  - `SessionFactsThrottleTests` -> methods: `test_cvd_view_has_market_data_throttle`, `test_detail_view_has_market_data_throttle`, `test_list_view_has_market_data_throttle`, `test_throttle_rate_is_60_per_min`
  - `SessionFactsUnauthorizedTests` -> methods: `setUp`, `test_detail_401_when_unauthenticated`, `test_list_401_when_unauthenticated`
  - `SessionFactsValidationTests` -> methods: `setUp`, `test_detail_400_when_trade_date_is_invalid`
- Functions:
  - `_attach_bucket_series`, `_make_facts`, `_make_series_payload`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_signal_intelligence_api_routes.py`

- Classes:
  - `SignalIntelligenceApiRouteTests` -> methods: `setUp`, `test_alert_center_feed_tenant_isolation`, `test_order_flow_route_is_native_and_returns_list`, `test_unified_alert_route_is_native_and_cursor_paginated`, `test_whale_feed_route_is_native_and_returns_list`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_signal_materializer_schedule.py`

- Classes:
  - `SignalMaterializerScheduleTests` -> methods: `test_pre_open_snapshot_materializer_routes_to_offhours_queue`, `test_runtime_and_settings_schedule_use_market_serving_materializer`, `test_runtime_schedule_does_not_double_schedule_whale_feed_materialization`, `test_signal_intelligence_critical_tasks_route_to_target_queues`

### `packages/core/backend/tests/test_stock_management_api_routes.py`

- Classes:
  - `StockManagementCompatApiRouteTests` -> methods: `setUp`, `test_groups_seed_sync_and_remaining_stock_routes_are_native`, `test_seed_populates_groups_and_groups_view_returns_renderable_shape`, `test_stock_management_detail_and_price_alert_routes_are_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_tenant_lifecycle_schedule.py`

- Classes:
  - `TenantLifecycleScheduleTests` -> methods: `test_tenant_lifecycle_app_is_registered`, `test_tenant_lifecycle_periodic_schedules_exist`, `test_tenant_lifecycle_tasks_route_to_celery_queue`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_tenant_member_views.py`

- Classes:
  - `TenantMemberInviteTest` -> methods: `setUp`, `test_accept_invite_already_accepted_409`, `test_accept_invite_email_mismatch_403`, `test_accept_invite_expired_410`, `test_accept_invite_with_valid_token`, `test_invite_creates_lifecycle_event`, `test_invite_duplicate_email_409`, `test_invite_member_creates_tenantinvite_with_token`, `test_invite_member_non_owner_403`, `test_list_invites`, `test_list_members`, `test_remove_member_cannot_remove_owner`, `test_remove_member_cannot_remove_self`, `test_remove_member_deletes_and_logs_event`, `test_unique_tenant_user_constraint`
- Top-level variables:
  - `User`

### `packages/core/backend/tests/test_tenant_quota_middleware.py`

- Classes:
  - `_InMemoryQuotaCache` -> methods: `__init__`, `add`, `incr`
  - `TenantQuotaMiddlewareTests` -> methods: `_middleware`, `_request`, `_run_with_cache`, `setUp`, `test_auth_path_is_exempt`, `test_exceeded_limit_returns_429`, `test_health_path_is_exempt`, `test_public_path_is_exempt_even_for_authenticated_user`, `test_resolve_tenant_quota_uses_active_quota_record`, `test_settings_register_middleware_after_authentication`, `test_superuser_request_is_not_counted`, `test_unauthenticated_request_is_not_counted`, `test_unlimited_quota_counts_but_never_blocks`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_tenant_resolution_middleware.py`

- Classes:
  - `TenantResolutionMiddlewareTests` -> methods: `_middleware`, `_request`, `setUp`, `test_cross_tenant_header_returns_403`, `test_deprovisioned_tenant_returns_403`, `test_exempt_paths_bypass_resolution`, `test_header_invalid_tenant_returns_403`, `test_header_valid_tenant_resolves_correct_tenant`, `test_member_cross_tenant_header_returns_403`, `test_member_role_admin`, `test_member_role_viewer`, `test_no_header_fallback_member_resolved`, `test_no_header_fallback_owner_resolved`, `test_superuser_bypass_with_header`, `test_superuser_fallback_to_owned_tenant`, `test_suspended_tenant_returns_403`, `test_unauthenticated_request_passes_through`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_user_workspace_api_routes.py`

- Classes:
  - `UserWorkspaceAdvisoryCompatRouteTests` -> methods: `_create_quota_record`, `_current_period`, `setUp`, `test_portfolio_ai_advisory_get_routes_delegate_to_native_advisory_view`, `test_portfolio_ai_advisory_refresh_route_delegates_to_native_advisory_view`
  - `UserWorkspaceApiRouteTests` -> methods: `setUp`, `test_portfolio_routes_are_native_and_return_results_envelope`, `test_watchlist_routes_are_native_and_item_delete_works`
- Top-level variables:
  - `_src_dir`

### `packages/vip-app/local-backend/api_stub.py`

- Classes:
  - `_VipAppApiStubHandler` -> methods: `_dispatch`, `_read_json_body`, `_write_json`, `do_GET`, `do_POST`, `log_message`
  - `ApiError` -> methods: `__init__`
- Functions:
  - `_capability_bootstrap_payload`, `_health_payload`, `_list_audit_logs`, `_list_users`, `_login`, `_logout`, `_manifest_payload`, `_reset_session`, `_route_list`, `_session_payload`, `_upsert_user`, `main`
- Top-level variables:
  - `ROUTE_HANDLERS`, `STATE_STORE`

### `packages/vip-app/local-backend/store.py`

- Classes:
  - `VipAppStateStore` -> methods: `__init__`, `_ability_rules_locked`, `_active_username_locked`, `_allocate_user_id_locked`, `_anonymous_session_record`, `_append_audit_log_locked`, `_build_session_record_locked`, `_default_state`, `_get_active_user_locked`, `_get_user_by_id_from_state`, `_get_user_by_id_locked`, `_get_user_by_username_locked`, `_identity_payload_locked`, `_load_or_initialize_state`, `_normalize_state`, `_normalize_tenant_record`, `_normalize_user_record`, `_persist_locked`, `_resolve_seed_user_locked`, `_seed_tenant_record`, `_seed_user_record`, `_visible_groups_locked`, `_visible_routes_locked`, `get_build_target`, `get_capability_bootstrap_payload`, `get_health_payload`, `get_manifest_payload`, `get_plan`, `get_session_payload`, `get_state_summary`, `list_audit_logs`, `list_users`, `login`, `logout`, `reset_session`, `upsert_user`
- Functions:
  - `_coerce_bool`, `_hash_password`, `_identity_flags`, `_normalize_role_keys`, `_now_isoformat`, `_strip_secret_fields`
- Top-level variables:
  - `ROLE_KEYS`

### `packages/web/fix_newlines.py`

- No parseable top-level symbols found

### `scripts/check_core_api_route.py`

- No parseable top-level symbols found

### `scripts/diagnose_auth_issue.py`

- Top-level variables:
  - `authed`

### `scripts/migrate_portfolios_to_core.py`

- Functions:
  - `get_connection`, `get_core_user_id`, `main`, `migrate_portfolios`

### `scripts/migrate_users_to_core.py`

- Functions:
  - `fetch_legacy_users`, `get_connection`, `main`, `migrate_user`

### `scripts/ops/generate_module_tree.py`

- Classes:
  - `ClassInfo`
  - `ModuleInfo`
- Functions:
  - `is_ignored`, `iter_source_files`, `main`, `module_has_symbols`, `parse_js_ts_module`, `parse_module`, `parse_python_module`, `pick_first_group`, `render_markdown`, `unique_sorted`
- Top-level variables:
  - `IGNORE_DIR_NAMES`, `IGNORE_PATH_PARTS`, `INCLUDE_DIRS`, `JS_ARROW_RE`, `JS_CLASS_RE`, `JS_EXTS`, `JS_FUNC_EXPR_RE`, `JS_FUNC_RE`, `JS_VAR_RE`, `OUTPUT`, `PY_EXTS`, `ROOT`, `VAR_NAME_RE`

### `scripts/ops/realtime_ticker_load_test.py`

- Classes:
  - `RequestResult`
- Functions:
  - `_single_request`, `main`, `percentile`

### `scripts/PHASE3_DEPLOYMENT_CONFIG_PATCHER_20260510.py`

- Functions:
  - `backup_file`, `main`, `patch_celery_config`, `patch_django_settings`, `patch_docker_compose`, `patch_urls`, `validate_syntax`

### `scripts/pre_decommission_gates_check.py`

- Functions:
  - `check_gate_a_data_parity`, `check_gate_b_api_coverage`, `check_gate_c_zero_legacy_traffic`, `check_gate_d_sentry_alerts`, `check_gate_e_backup_restore`, `check_gate_f_load_test`, `check_gate_g_celery_queue`, `main`

### `scripts/rewrite_pages_no_jsx.py`

- Top-level variables:
  - `PORTFOLIOS_PAGE`, `STOCK_DETAIL`, `TRANSACTIONS_PAGE`, `USER_SETTINGS_PAGE`, `files`, `root`

### `scripts/seed_system_default_groups.py`

- Functions:
  - `main`, `seed_exchange_groups`, `seed_index_groups`, `seed_system_defaults`
- Top-level variables:
  - `backend_path`

## JS/TS Modules

### `frontend/postcss.config.js`

- No parseable top-level symbols found

### `frontend/src/__tests__/AIAdvisoryPromptConfig.api.test.js`

- Functions:
  - `_getDefaultPromptConfig`, `buildApiPayload`, `clampLookback`, `filterPayloadEnabledSources`, `validatePayloadStructure`
- Top-level variables:
  - `LOOKBACK_BOUNDS`, `VALID_INDICATORS`, `body`, `bounds`, `config`, `data`, `defaults`, `deserialized`, `disabledByDefault`, `enabledByDefault`, `enabledCount`, `expectedSchema`, `expectedSources`, `filtered`, `invalidIndicators`, `payload`, `pc`, `response`, `serialized`, `source`, `testCases`

### `frontend/src/__tests__/AIAdvisoryPromptConfig.e2e.test.js`

- Functions:
  - `_getDefaultPromptConfig`, `_loadAdvisoryPromptConfigFromStorage`, `_saveAdvisoryPromptConfigToStorage`, `localStorageMock`
- Top-level variables:
  - `config`, `config1`, `config2`, `defaults`, `expectedSources`, `final`, `key`, `loaded`, `loaded1`, `loaded2`, `newConfig`, `originalSetItem`, `parsed`, `recheck1`, `reloaded`, `store`, `stored`, `symbol`, `symbol1`, `symbol2`

### `frontend/src/__tests__/socApi.dataops.test.js`

- Functions:
  - `mockOkResponse`
- Top-level variables:
  - `config`, `getItemSpy`, `payload`

### `frontend/src/__tests__/StockDetail.prompt_config.test.js`

- Functions:
  - `AIAdvisoryPromptConfigDrawer`, `StockDetailMock`, `handleRegenerateSummary`
- Top-level variables:
  - `button`, `checkbox`, `enabledByDefault`, `fundamentalToggle`, `newConfig`, `payload`, `payloadElement`, `settingsButton`

### `frontend/src/api/auth.js`

- Functions:
  - `confirmPasswordReset`, `getCapabilitySnapshot`, `getUserConfig`, `login`, `refreshToken`, `register`, `requestPasswordReset`, `resendVerification`, `updateUserConfig`, `verifyEmail`, `wrapAdapterPayload`

### `frontend/src/api/client.coreRoutes.test.js`

- Top-level variables:
  - `addTrackedSymbol`, `axiosModule`, `bulkUpdateTrackedSymbolThreshold`, `clearDeletedStockAIAdvisoryComponents`, `createPriceAlert`, `deletePriceAlert`, `deleteStockAIAdvisoryComponent`, `deleteStockAIExecutiveSummary`, `deleteTrackedSymbol`, `generateStockAIAdvisoryComponents`, `generateStockNewsAISummary`, `getPriceAlerts`, `getSecuritiesGroups`, `getSessionFacts`, `getSessionFactsCvd`, `getStockAIAdvisoryObservability`, `getStockAIAdvisorySession`, `getStockDarkMoneyHistory`, `getStockFinancials`, `getStockNews`, `getStockOrderFlow`, `getStockPriceChart`, `getStockProfile`, `getStockWorkspaceOverview`, `markPriceAlertTriggered`, `mockApiClient`, `originalApiBaseURL`, `originalCoreApiBaseURL`, `postStockAIAdvisoryObservabilityEvent`, `refreshStockAIAdvisoryComponent`, `refreshStockAIAdvisorySession`, `regenerateStockAIExecutiveSummary`, `restoreStockAIAdvisoryComponent`, `seedSecurities`, `syncSecuritiesPrices`, `toggleStockAIAdvisoryComponentInclude`, `updatePriceAlert`, `updateTrackedSymbol`

### `frontend/src/api/client.js`

- Functions:
  - `acceptTenantInvite`, `addTrackedSymbol`, `addWatchlistItem`, `attachCoreRequestId`, `buildIdempotencyKey`, `bulkUpdateTrackedSymbolThreshold`, `clearDeletedStockAIAdvisoryComponents`, `coreApiBaseURL`, `createAdminGlobalScreenerRule`, `createPortfolio`, `createPriceAlert`, `createScreenerRule`, `createSubAccount`, `createTenantInvite`, `createTenantServiceAccount`, `createTransaction`, `createWatchlistGroup`, `deleteAdminGlobalScreenerRule`, `deleteCurrentWhaleAdvisory`, `deleteDNSEDataCredential`, `deletePortfolio`, `deletePriceAlert`, `deleteScreenerRule`, `deleteStockAIAdvisoryComponent`, `deleteStockAIExecutiveSummary`, `deleteSubAccount`, `deleteTrackedSymbol`, `deleteTransaction`, `deleteWatchlistGroup`, `deleteWatchlistItem`, `fetchLegalPages`, `generateStockAIAdvisoryComponents`, `generateStockNewsAISummary`, `getAICommandCenterAuditLogs`, `getAICommandCenterConfig`, `getAIOptions`, `getAdminAuditLog`, `getAdminCrawlAuditLogs`, `getAdminCrawlJobs`, `getAdminCrawlRuns`, `getAdminGlobalScreenerRules`, `getAdminScreenerConfig`, `getAdvisoryAutoRefreshInfo`, `getAggregateWhaleFeed`, `getAlertCenterFeed`, `getAllocation`, `getAllocationBySector`, `getAnalytics`, `getBulkTechnicalsBySymbols`, `getCanonicalAIAdvisory`, `getChartData`, `getCoreOperatorAuditRequestDetail`, `getCoreOperatorAuditRequests`, `getCoreOperatorHealth`, `getCoreOperatorJobs`, `getCoreOperatorOverview`, `getCoreOperatorTenantDetail`, `getCoreOperatorTenantPATs`, `getCoreOperatorTenantServiceAccounts`, `getCoreOperatorTenants`, `getCoreRequestId`, `getDNSEConfig`, `getDNSEDataCredential`, `getDNSETokenStatus`, `getDepthChart`, `getEquityCurve`, `getHoldings`, `getIntradayMatched`, `getMarketDiscoveryHub`, `getPortfolio`, `getPortfolioNewsDigest`, `getPortfolioTechnicals`, `getPortfolioUserConfig`, `getPortfolios`, `getPriceAlerts`, `getPriceBoard`, `getRVOL`, `getRealtimeHealth`, `getRealtimeTicker`, `getRealtimeTickers`, `getRealtimeWebSocketUrl`, `getScreenerRules`, `getSectorBreadth`, `getSecuritiesGroups`, `getSessionFacts`, `getSessionFactsCvd`, `getStockAIAdvisoryObservability`, `getStockAIAdvisorySession`, `getStockDarkMoneyHistory`, `getStockFinancials`, `getStockNews`, `getStockOrderFlow`, `getStockPriceChart`, `getStockProfile`, `getStockWorkspaceOverview`, `getSubAccounts`, `getSummary`, `getTenantBillingInvoices`, `getTenantBillingSubscription`, `getTenantInvites`, `getTenantMembers`, `getTenantPATs`, `getTenantServiceAccounts`, `getTenantSummary`, `getTenantUsageMeters`, `getTenantUsageQuotas`, `getTrackedSymbols`, `getTransactions`, `getWatchlistGroups`, `getWhaleAdvisories`, `getWhaleAdvisorySymbolStats`, `getWhaleAnalyticsSnapshot`, `getWhaleFeed`, `hasAuthTokens`, `isAuthPublicEndpoint`, `issueTenantPAT`, `markPriceAlertTriggered`, `normalizeChartTimeframe`, `normalizeCoreApiBaseURL`, `normalizeListResponse`, `normalizeTenantPatWritePayload`, `normalizeTenantServiceAccountWritePayload`, `placeDNSEOrder`, `postStockAIAdvisoryObservabilityEvent`, `refreshAccessToken`, `refreshStockAIAdvisoryComponent`, `refreshStockAIAdvisorySession`, `refreshWhaleAdvisory`, `regenerateStockAIExecutiveSummary`, `removeTenantMember`, `requestTokenRefresh`, `restoreStockAIAdvisoryComponent`, `revokeTenantPAT`, `rotateTenantPAT`, `runAdminCrawlJob`, `runAdminGlobalScreenerManual`, `runScreenerRule`, `saveDNSEDataCredential`, `seedSecurities`, `seedWatchlist`, `stopAdminCrawlJob`, `syncDNSEAccounts`, `syncPrices`, `syncSecuritiesPrices`, `syncStockProfile`, `syncWatchlistPrices`, `testAICommandCenterConnection`, `toggleStockAIAdvisoryComponentInclude`, `triggerSystemBackfill`, `triggerUserBackfill`, `updateAICommandCenterConfig`, `updateAdminGlobalScreenerRule`, `updateAdminScreenerConfig`, `updateDNSEConfig`, `updatePortfolio`, `updatePortfolioUserConfig`, `updatePriceAlert`, `updateScreenerRule`, `updateSubAccount`, `updateTrackedSymbol`, `updateTransaction`, `updateWatchlistGroup`, `withCoreBase`, `withDefaultAuditReason`
- Top-level variables:
  - `AUTH_PUBLIC_ENDPOINT_PATTERN`, `REQUEST_TIMEOUT_MS`, `WATCHLIST_GROUPS_CACHE_TTL`, `access`, `aliasMap`, `apiBaseURL`, `apiClient`, `customBase`, `explicitCoreBaseURL`, `getAIConfig`, `getSymbolInvestigation`, `getUnifiedAlerts`, `getWhaleCampaigns`, `isDevFrontendPort`, `nextAccessToken`, `nextCursor`, `nextUrl`, `normalized`, `normalizedSymbols`, `normalizedToken`, `now`, `origin`, `originalRequest`, `params`, `payload`, `protocol`, `publicApiClient`, `query`, `queryString`, `rawRows`, `refresh`, `refreshRequestPromise`, `refreshToken`, `requestId`, `requestUrl`, `response`, `rows`, `scopedResults`, `scopes`, `severity`, `status`, `suffix`, `symbolList`, `token`, `updateAIConfig`, `upperValue`, `value`, `watchlistGroupsCache`, `watchlistGroupsCacheTimestamp`

### `frontend/src/api/client.test.js`

- No parseable top-level symbols found

### `frontend/src/api/client.unifiedAlerts.test.js`

- Top-level variables:
  - `axiosModule`, `getAlertCenterFeed`, `getUnifiedAlerts`, `mockApiClient`, `mockGetAlertCenterFeed`, `response`

### `frontend/src/api/socApi.js`

- Functions:
  - `fetch`, `getAccessToken`, `handleResponse`, `normalizeConfigEnvelope`, `normalizeVnbrokerHealth`
- Top-level variables:
  - `BASE_URL`, `CANONICAL_DATAOPS_BASE_URL`, `accessToken`, `alertsTriggered`, `config`, `data`, `errorData`, `errorRateByStatus`, `headers`, `health`, `latency`, `params`, `payload`, `query`, `resp`, `socApi`, `status`, `symbolsScanned`

### `frontend/src/api/support.js`

- Functions:
  - `createSupportTicket`, `getStaffSupportDashboard`, `getSupportTicketDetail`, `listStaffSupportTickets`, `listSupportTickets`, `patchStaffSupportTicket`, `reopenSupportTicket`, `replyStaffSupportTicket`, `replySupportTicket`

### `frontend/src/App.jsx`

- Functions:
  - `AdminCoreShell`, `ProtectedLayout`, `WhaleAlertsSymbolRedirect`
- Top-level variables:
  - `debugPagesEnabled`, `hasStoredTokens`, `location`, `packageShellHostEnabled`

### `frontend/src/App.test.jsx`

- No parseable top-level symbols found

### `frontend/src/components/advisory/ActionChecklist.jsx`

- Functions:
  - `handleProceed`, `handleToggle`
- Top-level variables:
  - `DEFAULT_ITEMS`, `allChecked`, `resolvedItems`

### `frontend/src/components/advisory/AgenticThoughtStream.jsx`

- Top-level variables:
  - `addChars`, `phaseTimer`, `phases`, `prevContentRef`, `timer`

### `frontend/src/components/advisory/DataFreshnessBadge.jsx`

- Functions:
  - `update`
- Top-level variables:
  - `diff`, `formattedAge`, `id`, `statusLabel`

### `frontend/src/components/advisory/RecommendationCardExplainability.jsx`

- Functions:
  - `confidence`, `handleToggle`
- Top-level variables:
  - `confidenceColor`, `hasSufficientData`, `isStale`, `match`, `next`

### `frontend/src/components/advisory/RecommendationHistoryMini.jsx`

- Functions:
  - `OutcomeBadge`
- Top-level variables:
  - `cancelled`, `color`, `num`

### `frontend/src/components/advisory/RiskModeSelector.jsx`

- Functions:
  - `handleSelect`
- Top-level variables:
  - `MODES`, `isActive`

### `frontend/src/components/advisory/TrustTelemetryPanel.jsx`

- Functions:
  - `getEventLabel`, `onEvent`, `safeParse`
- Top-level variables:
  - `COUNTER_KEY`, `EVENT_KEYS`, `LOG_KEY`, `eventLabel`, `nextCounters`, `nextLog`, `reload`, `totalEvents`

### `frontend/src/components/advisory/WhaleAdvisoryBentoHeader.jsx`

- No parseable top-level symbols found

### `frontend/src/components/advisory/WhaleAdvisoryCommandPanel.jsx`

- Functions:
  - `fmtCompact`, `fmtTime`
- Top-level variables:
  - `advisory`, `hasAdvisory`, `isBuy`, `resolvedSymbol`, `side`, `symbol`

### `frontend/src/components/advisory/WhaleSymbolSidebar.jsx`

- Top-level variables:
  - `filteredStats`, `isActive`, `list`, `pagedStats`, `search`, `start`

### `frontend/src/components/AIAdvisoryPromptConfigDrawer.jsx`

- Functions:
  - `handleIndicatorToggle`, `handleLookbackChange`, `handleSourceToggle`
- Top-level variables:
  - `SOURCES_METADATA`, `TECHNICAL_INDICATORS`, `clamped`, `currentIndicators`, `enabledIndicators`, `enabledSources`, `isDefault`, `isEnabled`, `isSelected`, `lookbackDays`, `sourceLabelById`, `updated`

### `frontend/src/components/AlertBadge.jsx`

- Top-level variables:
  - `computedTitle`

### `frontend/src/components/AlertBadge.test.jsx`

- Top-level variables:
  - `badge`

### `frontend/src/components/AllocationPieChart.jsx`

- Functions:
  - `CustomTooltip`, `formatVND`, `normalizeAllocationRows`
- Top-level variables:
  - `COLORS`, `d`, `fetchAllocation`, `name`, `nameKey`, `res`

### `frontend/src/components/AnalyticsTabDeck.jsx`

- Top-level variables:
  - `TABS`, `handleTabChange`, `mountedTabs`, `syncTimestamp`

### `frontend/src/components/BubbleOrderChart.jsx`

- Functions:
  - `BubbleOrderChart`, `CustomBubble`, `bubbleData`, `fmtBil`, `fmtPrice`, `fmtVol`, `severityLabel`, `sideColor`, `sizeClassEmoji`
- Top-level variables:
  - `d`, `fill`, `n`, `normalizedSeverity`, `r`

### `frontend/src/components/Can.jsx`

- Top-level variables:
  - `ability`

### `frontend/src/components/chart/layers/IndicatorLayer.js`

- Functions:
  - `getIndicatorSeries`
- Top-level variables:
  - `series`

### `frontend/src/components/chart/layers/PriceLayer.js`

- Functions:
  - `getPriceSeries`, `getVolumeSeries`
- Top-level variables:
  - `p`, `values`

### `frontend/src/components/chart/TechnicalChartContainer.jsx`

- Functions:
  - `handleResize`
- Top-level variables:
  - `TechnicalChartContainer`, `chartInstance`, `chartRef`, `dates`, `option`, `values`

### `frontend/src/components/CompactDarkMoneyFlow.jsx`

- Functions:
  - `addSeriesCompat`, `cvd`, `strength`
- Top-level variables:
  - `chart`, `chartContainerRef`, `chartData`, `chartRef`, `cvdSeries`, `cvdSeriesRef`, `handleResize`, `matchingPoint`, `strengthSeries`, `strengthSeriesRef`, `syncedMinute`

### `frontend/src/components/DashboardRealtimePanel.jsx`

- Functions:
  - `playCriticalTone`, `sourceLabel`, `stats`, `toNumber`, `toggleSeverityFilterFromSummary`
- Top-level variables:
  - `aHolding`, `avgCost`, `bHolding`, `candidate`, `cardTone`, `computedLiveMarketValue`, `cooldownMs`, `costBasis`, `criticalAlerts`, `criticalToastCooldownRef`, `ctx`, `eventAgeSeconds`, `fallbackUnrealizedPL`, `gain`, `holdingSymbolSet`, `id`, `isActive`, `isEventStale`, `isUnread`, `liveMarketValue`, `livePrice`, `liveQuote`, `liveVsSnapshotDelta`, `marketStats`, `nowTs`, `observabilityMetricChips`, `oscillator`, `parsed`, `prioritized`, `quantity`, `realtimeLabels`, `realtimePortfolioStats`, `severity`, `snapshotMarketValue`, `sourceTone`, `statusClasses`, `timeoutId`, `toastId`, `toastTtlMs`, `typeTone`, `unreadCount`, `unrealizedPL`

### `frontend/src/components/DashboardRealtimePanel.test.jsx`

- Top-level variables:
  - `mockGetRealtimeHealth`, `mockUseAlertCenterFeed`, `mockUseI18n`, `mockUsePersistentAlertState`, `observabilityButton`

### `frontend/src/components/DepthChartPanel.jsx`

- Functions:
  - `DepthChartPanel`, `fmtPrice`, `fmtVol`
- Top-level variables:
  - `asks`, `bids`, `chartData`, `fetch`, `n`, `points`, `r`

### `frontend/src/components/DNSEConnectionPanel.jsx`

- Functions:
  - `DNSEConnectionPanel`, `fetchConfig`, `handleSave`, `handleSync`
- Top-level variables:
  - `res`

### `frontend/src/components/EmptyState.jsx`

- No parseable top-level symbols found

### `frontend/src/components/EquityVsBenchmarkChart.jsx`

- Functions:
  - `CustomTooltip`, `PctAxisTick`, `getPeriods`, `normalizeCurvePoints`
- Top-level variables:
  - `fetchCurve`, `periods`, `res`

### `frontend/src/components/FactsFirstWhaleAnalyticsTab.jsx`

- Top-level variables:
  - `TIMEFRAME_OPTIONS`, `availableSymbols`, `degradedBadgeLabel`, `isDegraded`, `isStale`, `smfi`, `sourceSymbols`, `staleReason`, `strength`, `symbols`

### `frontend/src/components/FactsFirstWhaleAnalyticsTab.test.jsx`

- Top-level variables:
  - `analyticsData`

### `frontend/src/components/FactsFirstWhaleBubbleChart.jsx`

- Functions:
  - `handleTimeframeChange`, `toErrorMessage`
- Top-level variables:
  - `bubbleOrdersForFlow`, `combinedError`, `combinedLoading`, `factsFirstFlowData`, `hasPrefetchedAnalyticsState`, `normalizedTradeDate`, `resolvedAnalyticsData`, `resolvedAnalyticsError`, `resolvedAnalyticsLoading`, `resolvedSymbol`, `timeframe`

### `frontend/src/components/FactsFirstWhaleBubbleChart.test.jsx`

- Top-level variables:
  - `mockWhaleBubbleChart`, `props`

### `frontend/src/components/FinancialChart.jsx`

- No parseable top-level symbols found

### `frontend/src/components/HoldingsTable.jsx`

- Functions:
  - `MiniSparkline`, `PerformanceBar`, `formatWhaleMatchedValue`, `renderSkeleton`, `resolveWhaleAlertBadgeTone`, `resolveWhaleAlertIcon`, `resolveWhaleAlertRowTone`, `resolveWhaleAlertSeverityLabel`, `resolveWhaleAlertSideLabel`, `toX`, `toY`
- Top-level variables:
  - `clampedPct`, `currentPrice`, `isFresh`, `isPositive`, `isUp`, `marketValue`, `max`, `min`, `normalizedSeverity`, `normalizedSide`, `normalizedSizeClass`, `numericPct`, `numericValue`, `pathData`, `plPct`, `range`, `symbolKey`, `whaleAlert`, `whaleBadgeTone`, `whaleIcon`, `whaleMatchedValueLabel`, `whaleRowTone`, `whaleSeverityLabel`, `whaleSideLabel`, `widthStr`

### `frontend/src/components/KLineChartPanel.jsx`

- Functions:
  - `buildFlowBucketLookup`, `buildHeatmapBandColor`, `buildVisibleHeatmapBands`, `buildVisibleWhaleSharkMarkers`, `clamp`, `createIndicatorWithTracking`, `domClickListener`, `ensureHeatmapOverlayRegistered`, `findIndicatorPaneIds`, `forgetIndicatorPane`, `formatTooltipTimestamp`, `formatTooltipValue`, `handleScreenshot`, `handleTimeframe`, `handleToggleFullscreen`, `handleToggleIndicator`, `handleToggleTooltip`, `normalizeWhaleSignalSide`, `onFullscreenChange`, `rememberIndicatorPane`, `removeIndicatorFromAnySubPane`, `resolveFlowValues`, `resolveHeatmapMetric`, `resolveQualityBadgeTone`
- Top-level variables:
  - `AVAILABLE_INDICATORS`, `CHART_RIGHT_OFFSET_DISTANCE`, `FLOW_CUSTOM_INDICATOR_IDS`, `HEATMAP_OVERLAY_NAME`, `MAIN_PANE_INDICATORS`, `SUB_PANE_CANDIDATES`, `TIMEFRAMES`, `adjustedPrice`, `allIndicators`, `alpha`, `anchorValue`, `bestExisting`, `bestSignalByMinute`, `bucket`, `buyHeat`, `candle`, `candleByMinute`, `candleMinuteKeys`, `candleTimestamp`, `candleTooltipCustom`, `candleTooltipStyles`, `chart`, `chartRef`, `clearHeatmapOverlays`, `clearSharkMarkers`, `clickedData`, `color`, `config`, `containerRef`, `createdPaneId`, `crosshair`, `currentVisibleBarCount`, `customIndicatorDef`, `customIndicatorDefs`, `deepFlowPaneControls`, `dynamicPaneIds`, `emitSessionFromChart`, `emitVisibleRangeFromChart`, `existingPaneId`, `fallbackFrom`, `fallbackPrice`, `fallbackTo`, `flowBucket`, `flowBucketLookup`, `flowBuckets`, `flowCvdTemplate`, `flowSessionTradeDate`, `flowStrengthTemplate`, `flowTimeframe`, `flowValues`, `flowViewModel`, `focusChartOnTradeDate`, `focusSignature`, `fromIndex`, `fromIndexRaw`, `handleChartClick`, `handleVisibleRangeAction`, `hasActiveFlowPane`, `hasFlowCompareData`, `hasHeatmapData`, `hasVisibleRange`, `heatmapModes`, `heatmapOverlayIdsRef`, `heatmapOverlayRegistered`, `heatmapOverlaySignatureRef`, `image`, `indicatorPaneMapRef`, `intensity`, `isActive`, `isBuy`, `isNextEnabled`, `isReady`, `isVisible`, `kLineData`, `lastAutoFocusedTradeDateRef`, `lastVisibleRangeRef`, `latestData`, `leftSpacing`, `leftX`, `link`, `lookup`, `lookupKey`, `magnitude`, `markers`, `match`, `matchedMinuteKey`, `matchedValue`, `maxVisibleTs`, `metric`, `minVisibleTs`, `minuteKey`, `netHeat`, `newState`, `nextFrom`, `nextSignature`, `nextTimestamp`, `nextTo`, `normalizedFlowTradeDate`, `normalizedMinuteKey`, `normalizedMode`, `normalizedState`, `onSessionChangeRef`, `overlays`, `paneId`, `paneIds`, `paneIdsToTry`, `previousTimestamp`, `qualityState`, `rankedSignals`, `rawSide`, `rawStrength`, `referencePrice`, `rememberedPaneId`, `removed`, `rightSpacing`, `rightX`, `ro`, `seen`, `selectedTimeframe`, `sellHeat`, `sharkMarkerSignatureRef`, `sharkOverlayIdsRef`, `side`, `strength`, `syncHeatmapOverlays`, `syncHeatmapOverlaysRef`, `syncSharkMarkers`, `syncSharkMarkersRef`, `targetCount`, `targetRange`, `targetVisibleBarCount`, `toIndex`, `toIndexRaw`, `tradeDate`, `visibleFrom`, `visibleRange`, `visibleTo`, `whaleMarkerSignals`, `whaleScore`

### `frontend/src/components/Layout.jsx`

- Top-level variables:
  - `dashboardModeClassName`, `loadLegal`, `pages`

### `frontend/src/components/LoginModal.jsx`

- Functions:
  - `FacebookIcon`, `GoogleIcon`, `handleResendVerification`, `handleSubmit`, `normalizeErrorMessage`, `normalizeFieldErrors`, `resolveLoginError`, `switchMode`, `updateField`, `validateRegisterForm`
- Top-level variables:
  - `INITIAL_FORM`, `USERNAME_PATTERN`, `detail`, `errorData`, `errors`, `firstEntry`, `identifier`, `isRegisterMode`, `isUnverifiedEmail`, `loadLegalPages`, `loginError`, `pages`, `response`, `status`, `submitDisabled`, `trimmedEmail`, `trimmedUsername`, `validationErrors`

### `frontend/src/components/LoginModal.test.jsx`

- Functions:
  - `mockT`, `renderLoginModal`
- Top-level variables:
  - `forgotLink`, `mockI18nContext`, `mockPortfolioContext`, `onSuccess`, `passwordInput`, `registerButton`, `resendButton`, `submitButton`, `usernameInput`

### `frontend/src/components/modern/AIAdvisorAlertPanel.jsx`

- Functions:
  - `playAlertTone`
- Top-level variables:
  - `ctx`, `expandedSizingClass`, `gain`, `hasStrongAlert`, `newsItems`, `oscillator`, `recommendationsEnabled`

### `frontend/src/components/modern/FactsFirstModularPositionDeck.jsx`

- Functions:
  - `fmtNumber`, `fmtSignedPercent`, `handlePageSizeChange`, `handleTabChange`
- Top-level variables:
  - `FactsFirstWhaleAnalyticsTab`, `PAGE_SIZE_OPTIONS`, `activeSymbolSet`, `aiMonitorSummary`, `aiScopeTitle`, `alpha`, `alphaScore`, `bearishCount`, `bullishCount`, `color`, `counts`, `ddScore`, `filteredOverviewRows`, `filteredTechnicals`, `grade`, `hasAnalytics`, `healthStats`, `isAITab`, `isHoldingsScope`, `isOverviewTab`, `isTechnicalTab`, `maxDD`, `needsHealthStats`, `needsTechnicalsView`, `neutralCount`, `numeric`, `option`, `pagedOverviewRows`, `pagedTechnicals`, `scopeOptions`, `scopedUniverse`, `sharpe`, `sharpeScore`, `sign`, `sourceBadgeClass`, `sourceBadgeLabel`, `start`, `symbolOptions`, `symbolsCount`, `tabs`, `total`, `val`

### `frontend/src/components/modern/ModernPortfolioDigest.jsx`

- Top-level variables:
  - `isBearish`, `isBullish`, `newsItems`

### `frontend/src/components/modern/ModernSidebar.jsx`

- Functions:
  - `SidebarChartFallback`
- Top-level variables:
  - `AllocationPieChart`, `EquityVsBenchmarkChart`, `filteredAlerts`, `metrics`, `trackedSymbolSet`

### `frontend/src/components/modern/ModularPositionDeck.jsx`

- Functions:
  - `fmtNumber`, `fmtSignedPercent`, `handlePageSizeChange`, `handleTabChange`
- Top-level variables:
  - `PAGE_SIZE_OPTIONS`, `WhaleAnalyticsTab`, `activeSymbolSet`, `aiMonitorSummary`, `aiScopeTitle`, `alpha`, `alphaScore`, `bearishCount`, `bullishCount`, `color`, `counts`, `ddScore`, `filteredOverviewRows`, `filteredTechnicals`, `grade`, `hasAnalytics`, `healthStats`, `isAITab`, `isHoldingsScope`, `isOverviewTab`, `isTechnicalTab`, `maxDD`, `needsHealthStats`, `needsTechnicalsView`, `neutralCount`, `numeric`, `option`, `pagedOverviewRows`, `pagedTechnicals`, `scopeOptions`, `scopedUniverse`, `sharpe`, `sharpeScore`, `sign`, `sourceBadgeClass`, `sourceBadgeLabel`, `start`, `symbolOptions`, `symbolsCount`, `tabs`, `total`

### `frontend/src/components/modern/OptimizationModal.jsx`

- Functions:
  - `toggleAcknowledge`
- Top-level variables:
  - `count`, `projectedScore`, `tickedCount`

### `frontend/src/components/modern/SmartStatsHeader.jsx`

- Top-level variables:
  - `breadthTotal`, `compactMetrics`, `dayPL`, `dayPLPct`, `marketValue`

### `frontend/src/components/MoneyFlowDonut.jsx`

- Functions:
  - `MoneyFlowDonut`, `fmtBil`
- Top-level variables:
  - `DONUT_COLORS`, `abs`, `amountByIndex`, `centerLabel`, `donutData`, `flowNet`, `n`, `netColor`

### `frontend/src/components/OrderFlowRadarPanel.jsx`

- Functions:
  - `OrderFlowRadarPanel`, `fmtCompact`, `formatPercentDelta`, `getICTTime`
- Top-level variables:
  - `chartData`, `cvdSeries`, `d`, `darkFlow`, `filteredCvdSeries`, `filteredSignals`, `formatter`, `hourPart`, `hours`, `ict`, `ictDate`, `itemTs`, `latestSignal`, `liveSignal`, `liveStrength`, `maxTs`, `minutePart`, `minutes`, `n`, `numericValue`, `parts`, `signals`, `sizeDistribution`, `smallOrderRatio`, `tickRate`, `utc`

### `frontend/src/components/PortfolioAnalyticsPanel.jsx`

- Functions:
  - `MetricCard`, `fmt`, `getPeriodOptions`, `scoreColor`
- Top-level variables:
  - `fetchMetrics`, `noData`, `periodOptions`, `res`

### `frontend/src/components/PortfolioDigestPanel.jsx`

- Functions:
  - `handlePageSizeChange`, `run`
- Top-level variables:
  - `PAGE_SIZE_OPTIONS`, `POLL_INTERVAL_MS`, `alive`, `digestLines`, `fetchDigest`, `list`, `pagedLines`, `res`, `symbolsText`, `text`, `timer`, `totalPages`

### `frontend/src/components/PortfolioHeatmap.jsx`

- Functions:
  - `clamp`, `handlePointerDownOutside`, `hexToRgba`, `normalizeNode`, `resolveHeatTileStyle`, `scheduleResize`, `toNumber`, `toX`, `toY`
- Top-level variables:
  - `FINTECH_HEAT_COLORS`, `HEATMAP_MIN_HEIGHT`, `HEAT_SCALE_COLORS`, `PIECEWISE_VISUAL_MAP`, `RANK_MIN`, `TREEMAP_LEVELS`, `absChange`, `alpha`, `areaPath`, `avgChange`, `avgHoldingPortfolioValue`, `b`, `base`, `buildLeafLabel`, `buildSparklineSvg`, `cardRect`, `changePct`, `chart`, `chartComponentRef`, `chartContainerRef`, `chartData`, `clampedLeft`, `clampedTop`, `container`, `containerRect`, `cp`, `data`, `dataSet`, `detailCardRef`, `dispatchSyncEvent`, `dotColor`, `estimatedCap`, `explicitHeight`, `explicitWidth`, `flatList`, `formatCompactNumber`, `formatPercent`, `g`, `getVolatilityLevelLabel`, `handleHeatmapClick`, `heatmapShellRef`, `hex`, `holdingPortfolioValues`, `industry`, `industryStr`, `innerH`, `innerW`, `isExtreme`, `isUp`, `lastX`, `lastY`, `leaf`, `leafNode`, `lineColor`, `liveValue`, `magnitude`, `marketCapFromFeed`, `marketCapFromProfile`, `max`, `maxLeafSize`, `maxV`, `minV`, `n`, `nativeEvent`, `normalized`, `normalizedChildren`, `normalizedDisplaySize`, `numeric`, `observer`, `offsetX`, `offsetY`, `option`, `padX`, `padY`, `padding`, `parsed`, `points`, `polyPoints`, `portfolioValue`, `price`, `priceProxy`, `processedFlatData`, `processedGroupedData`, `qtyProxy`, `r`, `range`, `rankMap`, `ratio`, `rawChange`, `rawCp`, `rect`, `resizeRafRef`, `resolvedMarketCap`, `s`, `safeResizeChart`, `score`, `sectorDisplayTotal`, `sectors`, `selectedLeaf`, `settleStopTimer`, `settleTimer`, `size`, `sizeValue`, `snapshotValue`, `sortMarketCap`, `sorted`, `stillExists`, `symbol`, `tileStyle`, `tooltip`, `v`, `val`, `watchlistNominalWeight`

### `frontend/src/components/PortfolioLineChart.jsx`

- Functions:
  - `CustomTooltip`, `formatAxisVND`, `formatTooltipVND`, `getPeriods`
- Top-level variables:
  - `changePct`, `dt`, `fetchChart`, `firstVal`, `formatted`, `isUp`, `lastVal`, `periods`, `res`

### `frontend/src/components/ProtectedRoute.jsx`

- Top-level variables:
  - `ability`

### `frontend/src/components/RealtimeDebugPanel.jsx`

- Functions:
  - `formatClock`, `formatSeverity`, `formatValue`
- Top-level variables:
  - `connectionState`, `debugParam`, `event`, `eventTypeLabel`, `statusColor`, `urlParams`

### `frontend/src/components/RealtimeQuoteTable/columnPresets.js`

- Functions:
  - `filterQuotesByFreshness`, `filterQuotesByMovement`, `filterQuotesBySearch`, `getTotalPages`, `paginateQuotes`, `sortQuotes`
- Top-level variables:
  - `COLUMN_PRESETS`, `aVal`, `bVal`, `change`, `end`, `sorted`, `start`, `term`

### `frontend/src/components/RealtimeQuoteTable/index.js`

- No parseable top-level symbols found

### `frontend/src/components/RealtimeQuoteTable/QuoteTableRow.jsx`

- Top-level variables:
  - `QuoteTableRow`, `actionsEqual`, `columnsEqual`, `defaultRenderers`, `handlersEqual`, `isDown`, `isUp`, `quotesEqual`

### `frontend/src/components/RealtimeQuoteTable/RealtimeQuoteTable.jsx`

- Top-level variables:
  - `aVal`, `bVal`, `handleSort`, `isCurrentSort`, `isSortable`, `sortIndicator`, `sorted`, `sortedQuotes`

### `frontend/src/components/RealtimeQuoteTable/RealtimeQuoteTableDemo.jsx`

- Top-level variables:
  - `mockActions`, `mockQuotes`

### `frontend/src/components/RVOLChartPanel.jsx`

- Functions:
  - `CustomBarShape`, `RVOLChartPanel`, `baseline2xRaw`, `fetch`, `fmtExact`, `fmtVol`
- Top-level variables:
  - `baseline`, `baseline2xPlot`, `baselinePlot`, `baselineRaw`, `buckets`, `cancelled`, `chartData`, `fill`, `maxSpike`, `maxVolume`, `n`, `opacity`, `point`, `r`, `renderTooltip`, `rvol`, `volumeDomainMax`, `volumeRaw`

### `frontend/src/components/shared/PaginationBar.jsx`

- Functions:
  - `CursorPaginationBar`, `IconFirst`, `IconLast`, `IconNext`, `IconPrev`, `IconSpinner`, `OffsetPaginationBar`
- Top-level variables:
  - `NAV_BTN_BASE`, `NAV_BTN_DEFAULT`, `NAV_BTN_NEXT`, `PAGE_SIZE_OPTIONS`, `from`, `to`, `totalPages`

### `frontend/src/components/shared/SharkIcon.jsx`

- No parseable top-level symbols found

### `frontend/src/components/Sidebar.jsx`

- Functions:
  - `normalizeTrackedSymbols`
- Top-level variables:
  - `cancelled`

### `frontend/src/components/SidebarWatchlist.jsx`

- Functions:
  - `toSymbolList`
- Top-level variables:
  - `SidebarTickerRow`, `currentPrice`, `filteredSymbols`, `freshnessSeconds`, `industry`, `industryOptions`, `isDown`, `isUp`, `next`, `normalizedTrackedSymbols`, `pct`, `quotesBySymbol`, `realtimeFeed`, `safeItems`, `set`, `symbol`, `symbolIndustryMap`, `symbols`, `timer`

### `frontend/src/components/soc/BackfillProgressPanel.jsx`

- Functions:
  - `BatchRow`, `ProgressBar`, `RunDetailDrawer`, `batchStateTone`, `fmt`, `fmtSec`, `runStatusTone`
- Top-level variables:
  - `BATCH_STATE_TONE`, `RUN_STATUS_TONE`, `STATUS_OPTIONS`, `color`, `data`, `load`, `m`, `result`, `sec`

### `frontend/src/components/soc/ConfigPreviewModal.jsx`

- Functions:
  - `getChangedKeys`
- Top-level variables:
  - `ConfigPreviewModal`, `allKeys`, `changed`, `changedKeys`, `hasValidationErrors`, `validationEntries`

### `frontend/src/components/soc/DataOpsPanel.jsx`

- Functions:
  - `BackfillCenterSection`, `DataInventorySection`, `DataOpsPanel`, `active`, `buildChangeSummary`, `buildImpactWarnings`, `buildPlannerPayload`, `fmtDate`, `fmtNum`, `getMatrixReadyProviderIds`, `getMatrixSelectedProviders`, `getMatrixStatusLabel`, `getMatrixStatusTone`, `getNextActionLabelKey`, `handleAbortActiveRun`, `handleApply`, `handleAuditPageChange`, `handleCreateGroup`, `handleDeleteGroup`, `handleMatrixAbortCycle`, `handleMatrixCycleComplete`, `handleMatrixGroupToggle`, `handleMatrixProviderToggle`, `handleMatrixStartCycle`, `handlePlannerPreview`, `handlePlannerRun`, `handlePreview`, `handlePurgeRunLogs`, `handleRun`, `handleRunLogsPageChange`, `hasTierRuntimeChange`, `loadActiveRun`, `loadData`, `normalizeMatrixSymbolGroups`, `parseSymbolsInput`, `toggleDataset`, `updateManualRunForm`
- Top-level variables:
  - `ACTIVE_MATRIX_STATUSES`, `BACKFILL_DATASETS`, `BACKFILL_DATASET_FIELDS`, `BACKFILL_SYMBOL_GROUPS`, `CONFIG_LABEL_KEYS`, `COVERAGE_STATE_ORDER`, `DATAOPS_SUB_TABS`, `DATASET_LABEL_KEYS`, `DEFAULT_AUDIT_ENVELOPE`, `DEFAULT_BACKFILL_FORM`, `DEFAULT_MANUAL_RUN_FORM`, `DEFAULT_MATRIX_SYMBOL_GROUPS`, `DEFAULT_OBSERVABILITY_SUMMARY`, `DEFAULT_RUN_LOGS_ENVELOPE`, `FRESHNESS_LABEL_KEYS`, `GAPS_PAGE_SIZE`, `MANUAL_RUN_DATASET_OPTIONS`, `MATRIX_POLL_MS`, `MATRIX_SYMBOL_GROUPS_OPTIONS`, `NEXT_ACTION_LABEL_KEYS`, `PLANNER_PREVIEW_PAGE_SIZE`, `PLANNER_SUPPORTED_DATASET_KEYS`, `RUN_STATUS_LABEL_KEYS`, `TIER_LABEL_KEYS`, `allGroups`, `appliedPayload`, `auditPayload`, `checked`, `coverageUpdatedAt`, `created`, `currentConfig`, `currentPage`, `data`, `defaults`, `deletedRows`, `gId`, `groups`, `hasFull`, `hasPartial`, `heightPx`, `intervalId`, `isActive`, `isCustom`, `isExchange`, `isSelected`, `isStarved`, `keys`, `lastUpdated`, `latestRun`, `maxPage`, `maxRows`, `monitorProviders`, `name`, `nextConfig`, `nextMatrixStatus`, `nextTier`, `nextValidationErrors`, `nextValue`, `normalized`, `ownership`, `parityHistory`, `parityTrend`, `parityWindow`, `parsed`, `payload`, `pct`, `plannerDatasets`, `pointRelaxedPct`, `pointSequence`, `pointStrictPct`, `previewPayload`, `previousTier`, `providerList`, `readyIds`, `relaxedParity`, `relaxedTrendDelta`, `relaxedTrendDirection`, `relaxedTrendTone`, `result`, `retainedRows`, `retentionBars`, `retentionDeletedDelta`, `retentionHistory`, `retentionLatestRunAgeHours`, `retentionPeakDeletedRows`, `retentionRetainedDelta`, `retentionStatus`, `retentionStatusLabel`, `retentionStatusTone`, `retentionThresholdTone`, `retentionTrend`, `runId`, `runLogsPayload`, `runPayload`, `secondsSince`, `seenSymbols`, `strictParity`, `strictTrendDelta`, `strictTrendDirection`, `strictTrendTone`, `symbols`, `tierNames`, `tones`, `total`, `totalRowsBefore`, `totalSymbols`, `uniqueSymbols`, `visibleItems`, `warnings`, `windowData`

### `frontend/src/components/soc/DNSEBackfillPanel.jsx`

- Functions:
  - `DNSEBackfillPanel`, `SystemBackfillSection`, `UserBackfillSection`, `handleSubmit`, `toggleDataset`, `validate`
- Top-level variables:
  - `DEFAULT_SYSTEM_FORM`, `DEFAULT_USER_FORM`, `DNSE_DATASETS`, `SYMBOL_GROUPS`, `TODAY`, `active`, `payload`, `resp`, `supportedSelected`, `validationError`

### `frontend/src/components/soc/MatrixPanel.jsx`

- Functions:
  - `MatrixPanel`, `activeCycleProviders`, `getReadyProviderIds`, `getSelectedProviders`, `getStatusLabel`, `getStatusTone`, `handleAbortCycle`, `handleCycleComplete`, `handleProviderToggle`, `handleStartCycle`, `loadMatrixContext`, `normalizeSymbolGroups`
- Top-level variables:
  - `ACTIVE_MATRIX_STATUSES`, `DEFAULT_MATRIX_SYMBOL_GROUPS`, `MATRIX_CELL_RETRY_DELAY_SECONDS`, `MATRIX_CELL_TASK`, `MATRIX_DATA_CONTRACT`, `MATRIX_DISPATCH_TASK`, `MATRIX_MONITOR_POLL_INTERVAL_SECONDS`, `data`, `defaultProviders`, `groupId`, `groups`, `isSelected`, `monitorProviders`, `nextStatus`, `normalizedGroups`, `providerList`, `readyProviderIds`, `statusKey`, `statusKeyByValue`, `toneByStatus`

### `frontend/src/components/soc/MatrixScrapeMonitor.jsx`

- Functions:
  - `MatrixScrapeMonitor`, `getStatusColor`, `pollMatrix`
- Top-level variables:
  - `cell`, `cells`, `cellsByKey`, `colors`, `data`, `interval`, `isMounted`, `providerIds`, `status`, `symbolGroupIds`

### `frontend/src/components/soc/OverviewPanel.jsx`

- Functions:
  - `OverviewPanel`, `fetchOverview`
- Top-level variables:
  - `healthStatus`, `nextHealthMap`, `summary`

### `frontend/src/components/soc/OwnershipBadgeRow.jsx`

- Functions:
  - `OwnershipBadgeRow`
- Top-level variables:
  - `MODE_COLORS`, `canApply`, `colors`

### `frontend/src/components/soc/PrefetchPanel.jsx`

- Functions:
  - `PrefetchPanel`, `buildChangeSummary`, `handleApply`, `handleFieldChange`, `handleOpenPreview`, `handlePurgeCache`, `handleWarmNow`
- Top-level variables:
  - `CORE_NUMBER_FIELDS`, `PROFILE_FIELDS`, `c`, `changed`, `covered`, `draftWithGroups`, `fetchData`, `hasData`, `isCustom`, `isHintOnly`, `isRegistryTier`, `isSelected`, `keys`, `latestDate`, `pct`, `preSelected`, `result`, `total`

### `frontend/src/components/soc/RuntimeKPIPanel.jsx`

- Functions:
  - `RuntimeKPIPanel`

### `frontend/src/components/soc/SchedulerBoard.jsx`

- Functions:
  - `ActionConfirmModal`, `JobActionButtons`, `JobHistoryDrawer`, `SchedulerHealthStrip`, `btn`, `formatLag`, `freshTone`, `normalizedCaps`, `statusTone`
- Top-level variables:
  - `DOMAIN_FILTER_OPTIONS`, `FRESHNESS_TONE`, `RISKY_ACTIONS`, `STATUS_TONE`, `activeDomainFilter`, `bannerRef`, `d`, `data`, `embedded`, `executeAction`, `executeActionRef`, `filteredJobs`, `h`, `handleAction`, `isDisabled`, `isRunning`, `load`, `lockedByRunning`, `m`, `mapped`, `mode`, `rawCaps`, `rem`, `result`, `rh`, `s`, `supported`

### `frontend/src/components/soc/ScreenerPanel.jsx`

- Functions:
  - `ScreenerPanel`, `handleApplyConfig`, `handleDeleteRule`, `handleManualScan`, `handleOpenConfigPreview`, `handleSaveRule`, `openEditRule`, `openNewRule`, `parseRuleValue`
- Top-level variables:
  - `CONFIG_FIELDS`, `DEFAULT_RULE_FORM`, `PAGE_SIZE`, `RULE_TYPES`, `c`, `changeSummary`, `fetchData`, `pagedRules`, `payload`, `result`, `symbols`, `totalRulesPages`

### `frontend/src/components/soc/ServiceHealthCard.jsx`

- Functions:
  - `ServiceHealthCard`
- Top-level variables:
  - `STATUS_COLORS`, `STATUS_TEXT_KEYS`, `colors`, `lastCheckAt`, `latency`, `status`

### `frontend/src/components/soc/SignalsPanel.jsx`

- Functions:
  - `SignalsPanel`, `fetchData`

### `frontend/src/components/soc/SOCComponents.test.jsx`

- Top-level variables:
  - `confirmButton`, `onConfirm`, `onCycleComplete`, `onDomainChange`, `t`, `user`

### `frontend/src/components/soc/SOCDomainTabs.jsx`

- Functions:
  - `SOCDomainTabs`
- Top-level variables:
  - `domains`

### `frontend/src/components/soc/VnbrokerPanel.jsx`

- Functions:
  - `VnbrokerPanel`, `buildChangeSummary`, `buildOptimizedConfigFromBenchmark`, `buildProviderOptimizationFromBenchmarkResult`, `clampNumber`, `getBenchmarkErrorPct`, `getBenchmarkLatencyMs`, `handleApply`, `handleBenchmark`, `handleOpenOptimizedPreview`, `handleOpenPreview`, `handleResetToDefaults`, `normalizeProviderId`, `pickBestBenchmarkResult`, `roundHalf`, `setField`, `setPerProviderField`, `setPerProviderTimeout`, `setTimeoutField`, `toggleProviderExpand`, `uniqueProviders`
- Top-level variables:
  - `DEFAULT_PROVIDER_OPTIONS`, `baseTimeoutSeconds`, `benchmarkResults`, `bestResult`, `connectTimeout`, `currentConfig`, `directLatency`, `errorPct`, `explicitErrorPct`, `fallbackFromCurrent`, `fallbackFromRecommendation`, `fallbackFromReport`, `fetchData`, `generatedProviderConfig`, `hasOverride`, `isExpanded`, `keys`, `latencyMs`, `latestReport`, `matched`, `maxRetries`, `nextOptimizedDraft`, `normalized`, `orderedFallbackProviders`, `output`, `p50LatencySeconds`, `p95LatencySeconds`, `payloadToApply`, `perProviderConfig`, `poolTimeout`, `preferredProvider`, `preview`, `previewAfterConfig`, `primaryProvider`, `providerCatalog`, `providerCfg`, `providerConfig`, `providerId`, `providerOptions`, `rateLimitFactor`, `rateLimited`, `rateLimitedDelta`, `rateLimitedPct`, `readTimeout`, `recommendation`, `recommendedFallbacks`, `recommendedPrimary`, `recommendedSingleFallback`, `report`, `requestsPerMinuteObserved`, `result`, `results`, `retryDelay`, `rpm`, `rpmDelta`, `safeBurstLimit`, `safeRequestsPerMinute`, `selectableProviders`, `selectedPrimary`, `sorted`, `success`, `successPct`, `timeout`, `timeoutCfg`, `timeoutSafetyFactor`, `updated`, `warnings`, `writeTimeout`

### `frontend/src/components/soc/WriteGuardBanner.jsx`

- Functions:
  - `WriteGuardBanner`

### `frontend/src/components/StatCard.jsx`

- Functions:
  - `formatVND`
- Top-level variables:
  - `areaPoints`, `displayValue`, `icon`, `iconByKey`, `max`, `min`, `points`, `strokeColor`, `trendByKey`, `trendPoints`, `valueColor`, `x`, `y`

### `frontend/src/components/StickyAlertBar.jsx`

- Functions:
  - `normalizeSymbol`, `severityLabel`, `timeLabel`
- Top-level variables:
  - `cardTone`, `displayTime`, `normalized`, `result`, `severity`, `severityTone`, `sourceAlerts`, `symbol`, `targetHref`, `topAlerts`, `uniqueSymbols`

### `frontend/src/components/StickyAlertBar.test.jsx`

- Top-level variables:
  - `mockUseI18n`

### `frontend/src/components/StockNewsPanel.jsx`

- Functions:
  - `NewsItem`, `formatPublishedAt`
- Top-level variables:
  - `POLL_INTERVAL_MS`, `cachedLabel`, `d`, `dateStr`, `detail`, `diagnostics`, `fetchAiSummary`, `fetchNews`, `fetchedAt`, `items`, `pollTimerRef`, `reason`, `res`, `unavailable`, `username`

### `frontend/src/components/support/StaffTicketActions.jsx`

- No parseable top-level symbols found

### `frontend/src/components/support/SupportOpsDashboard.jsx`

- Functions:
  - `StatCard`, `fmtDuration`
- Top-level variables:
  - `hours`, `minutes`, `total`

### `frontend/src/components/support/SupportQueueFilters.jsx`

- No parseable top-level symbols found

### `frontend/src/components/support/SupportTicketList.jsx`

- Functions:
  - `statusClass`
- Top-level variables:
  - `active`, `priorities`

### `frontend/src/components/support/TicketComposer.jsx`

- Functions:
  - `handleSubmit`

### `frontend/src/components/support/TicketCreationForm.jsx`

- Functions:
  - `submit`
- Top-level variables:
  - `categories`

### `frontend/src/components/support/TicketMetaPanel.jsx`

- Top-level variables:
  - `canReopen`

### `frontend/src/components/support/TicketThread.jsx`

- Functions:
  - `roleStyle`

### `frontend/src/components/TopNav.jsx`

- Functions:
  - `NavGroup`, `canNavigateTo`, `groupLinkClass`, `handleOutsideClick`, `handleSearch`
- Top-level variables:
  - `canReadSOC`, `canReadTenantBilling`, `canReadTenantCapabilities`, `canReadTenantHome`, `canReadTenantMembers`, `canReadTenantPATs`, `canReadTenantServiceAccounts`, `canReadTenantUsage`, `capabilityMenus`, `hasCapabilityMenus`, `navigate`, `portfolioItems`, `ref`, `signalItems`, `systemItems`, `tenantItems`, `tenantSurfaceEnabled`, `visibleRoutes`

### `frontend/src/components/UnifiedAlertBar.jsx`

- Functions:
  - `SummaryChip`

### `frontend/src/components/UnifiedAlertCenter.jsx`

- Functions:
  - `SummaryChip`, `sourceLabel`
- Top-level variables:
  - `cardTone`, `isUnread`, `safeAlerts`, `severity`, `severityFilters`, `sourceTone`, `typeTone`, `unreadAlertCount`

### `frontend/src/components/VNStockChartPanel.jsx`

- Functions:
  - `HeatmapBandOverlay`, `ViewportSharkMarkersOverlay`, `buildFlowBucketLookup`, `buildHeatmapBandColor`, `clamp`, `pad`, `resolveHeatmapMetric`
- Top-level variables:
  - `TIMEFRAMES`, `alpha`, `barWidth`, `bucket`, `buyHeat`, `chartAdapter`, `color`, `customPanes`, `dateStr`, `draw`, `drawY`, `dx`, `emoji`, `endIndex`, `enrichedBars`, `flowBucketLookup`, `flowTimeframe`, `flowViewModel`, `handleClick`, `handleVisibleRangeChange`, `idx`, `intensity`, `isBuy`, `item`, `lookup`, `magnitude`, `mappedCvdSeries`, `mappedWhaleOrders`, `metric`, `minuteKey`, `netHeat`, `normalizedMode`, `offset`, `parsedDate`, `price`, `sellHeat`, `signalsOrders`, `startIndex`, `threshold`, `timestamp`, `topCount`, `val`, `values`, `visibleBars`, `whaleScore`, `x`, `y`

### `frontend/src/components/vnstockcharts/csv.d.ts`

- Top-level variables:
  - `content`

### `frontend/src/components/vnstockcharts/d3-format.d.ts`

- Functions:
  - `format`, `timeFormat`

### `frontend/src/components/vnstockcharts/demo/__tests__/chartRange.test.ts`

- Functions:
  - `buildBars`
- Top-level variables:
  - `data`

### `frontend/src/components/vnstockcharts/demo/__tests__/demoData.test.ts`

- Functions:
  - `makeResponse`
- Top-level variables:
  - `bars`, `currentBars`, `fetchMock`, `firstPage`, `merged`, `olderBars`, `secondPage`

### `frontend/src/components/vnstockcharts/demo/__tests__/heikinAshi.test.ts`

- Functions:
  - `makeBar`
- Top-level variables:
  - `bars`, `expectedSecondOpen`, `firstClose`, `input`, `result`, `secondClose`, `snapshot`

### `frontend/src/components/vnstockcharts/demo/__tests__/historyFetchQueue.test.ts`

- Top-level variables:
  - `job`, `q`

### `frontend/src/components/vnstockcharts/demo/__tests__/historySchedulerPolicy.test.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/__tests__/historyWindowPlanner.test.ts`

- Top-level variables:
  - `data`, `loaded`, `next`, `previous`, `result`, `seg`, `target`, `viewport`, `window`

### `frontend/src/components/vnstockcharts/demo/__tests__/i18n.test.tsx`

- Functions:
  - `DemoI18nProbe`
- Top-level variables:
  - `DemoI18nBoundary`, `act`, `container`, `createRoot`, `originalConsoleError`, `probe`, `reactActEnvironment`, `root`, `setLanguageForTest`, `useDemoI18n`

### `frontend/src/components/vnstockcharts/demo/__tests__/LibraryShowcaseDemo.statusBadge.test.ts`

- Functions:
  - `t`
- Top-level variables:
  - `badge`

### `frontend/src/components/vnstockcharts/demo/__tests__/PaneSettingsModal.test.tsx`

- Functions:
  - `noop`
- Top-level variables:
  - `DemoI18nBoundary`, `PaneSettingsModal`, `act`, `container`, `createRoot`, `mockPaneState`, `onShowDrawingPriceMarkersChange`, `originalConsoleError`, `reactActEnvironment`, `root`, `toggleButton`

### `frontend/src/components/vnstockcharts/demo/__tests__/PATTokenModal.test.tsx`

- Functions:
  - `changeInputValue`
- Top-level variables:
  - `apiBaseInput`, `client`, `container`, `fetchMock`, `loginButton`, `onClose`, `onConfigChange`, `onSaved`, `onSourceChange`, `passwordInput`, `patInput`, `reactActEnvironment`, `root`, `saveButton`, `sourceButtons`, `usernameInput`, `valueSetter`

### `frontend/src/components/vnstockcharts/demo/__tests__/styleOverridesPersistence.test.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/__tests__/VNSymbolSearch.test.tsx`

- Top-level variables:
  - `client`, `container`, `input`, `onChange`, `reactActEnvironment`, `root`

### `frontend/src/components/vnstockcharts/demo/__tests__/WhalePanel.test.tsx`

- Top-level variables:
  - `DemoI18nBoundary`, `WhalePanel`, `act`, `consoleErrorSpy`, `container`, `createRoot`, `reactActEnvironment`, `root`, `sampleWhaleData`

### `frontend/src/components/vnstockcharts/demo/ChartPaneSplitter.tsx`

- Functions:
  - `handlePointerDown`, `handlePointerMove`, `stopDragging`
- Top-level variables:
  - `applyDragDeltaRef`, `availableRef`, `drag`, `dragRef`, `node`, `rootRef`, `totalDelta`

### `frontend/src/components/vnstockcharts/demo/chartRange.ts`

- Functions:
  - `normalizeDate`, `resolveChartRangeExtents`, `resolveChartRangeStart`, `subtractDays`, `subtractMonths`, `subtractYears`
- Top-level variables:
  - `CHART_RANGES`, `CHART_RANGE_LABEL_KEYS`, `DEFAULT_CHART_RANGE`, `dayOfMonth`, `first`, `last`, `lastDayOfMonth`, `next`, `rangeStart`, `single`

### `frontend/src/components/vnstockcharts/demo/components/DataSourceSwitcher.tsx`

- Functions:
  - `DataSourceSwitcher`
- Top-level variables:
  - `sources`

### `frontend/src/components/vnstockcharts/demo/components/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/components/PATTokenModal.tsx`

- Functions:
  - `PATTokenModal`, `applyApiBaseInput`, `handleBackdropClick`, `handleClearToken`, `handleFileChange`, `handleLogin`, `handleSaveBase`, `handleSaveToken`, `parseCSVBars`
- Top-level variables:
  - `accessToken`, `backdropRef`, `bars`, `changed`, `cols`, `currentBase`, `data`, `dataLines`, `file`, `fileInputRef`, `firstField`, `hasHeader`, `lines`, `open`, `p`, `reader`, `res`, `text`, `token`, `trimmed`, `ts`, `u`

### `frontend/src/components/vnstockcharts/demo/components/VNSymbolSearch.tsx`

- Functions:
  - `VNSymbolSearch`, `commitRawQuery`, `handleClick`, `handleFocus`, `handleInputChange`, `handleKeyDown`, `handleSelect`, `handleSelectSymbol`, `readRecentItems`, `saveRecentItem`
- Top-level variables:
  - `EXCHANGE_OPTIONS`, `MAX_RECENT`, `RECENT_SYMBOLS_KEY`, `VN30_SYMBOLS`, `debounceRef`, `deduped`, `exchange`, `item`, `mapped`, `q`, `raw`, `searchSymbols`, `selected`, `showEmptyPanel`, `showResultsPanel`, `stocks`, `symbol`, `updated`, `wrapperRef`

### `frontend/src/components/vnstockcharts/demo/components/WhalePanel.tsx`

- Functions:
  - `WhalePanel`, `formatBillion`
- Top-level variables:
  - `billion`, `isNetPositive`, `netFlow`, `rows`

### `frontend/src/components/vnstockcharts/demo/dataSources/__tests__/vninvest.test.ts`

- Top-level variables:
  - `bars`, `calledUrl`, `client`, `ds`, `fetchMock`, `mockResponse`, `results`

### `frontend/src/components/vnstockcharts/demo/dataSources/__tests__/VNInvestWebSocketClient.test.ts`

- Functions:
  - `connectAndFlush`, `createMockWebSocket`
- Top-level variables:
  - `MockWS`, `client`, `instance`, `lastCreatedSocket`, `msgs`, `onTicker`, `onWhale`, `payload`, `socket`, `socket1`

### `frontend/src/components/vnstockcharts/demo/dataSources/index.ts`

- Classes:
  - `DemoDataSource`, `VNInvestDataSource`
- Functions:
  - `vniBarToRawOHLCV`
- Top-level variables:
  - `all`, `bars`, `q`, `stocks`

### `frontend/src/components/vnstockcharts/demo/dataSources/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/dataSources/VNInvestClient.ts`

- Classes:
  - `VNInvestClient`
- Functions:
  - `asNumber`, `asObject`, `buildEndpoints`, `extractChartPoints`, `isWhaleFeedResponse`, `normalizeApiBase`, `normalizeChartBars`, `normalizeChartPoint`, `normalizeTimeframe`, `parseDateValue`, `resolveApiBase`, `resolveTechnical`
- Top-level variables:
  - `API_BASE_STORAGE_KEY`, `DEFAULT_API_BASE`, `PAT_STORAGE_KEY`, `TIMEFRAME_MAP`, `bars`, `candidates`, `close`, `data`, `dateRaw`, `dateValue`, `endpoints`, `globalScope`, `headers`, `high`, `low`, `nestedData`, `normalized`, `numeric`, `obj`, `open`, `params`, `parsed`, `payload`, `point`, `points`, `rawBars`, `response`, `stored`, `technical`, `text`, `trimmed`, `url`, `urlParams`, `volume`

### `frontend/src/components/vnstockcharts/demo/dataSources/VNInvestWebSocketClient.ts`

- Classes:
  - `VNInvestWebSocketClient`
- Top-level variables:
  - `available`, `hostname`, `httpBase`, `normalized`, `parsed`, `resolved`, `response`, `symbols`, `url`, `wsBase`, `wsPath`

### `frontend/src/components/vnstockcharts/demo/demoData.ts`

- Functions:
  - `computeIndicators`, `fetchBinanceKlinePage`, `fetchHistoricalDemoBars`, `fetchLiveDemoBars`, `fetchLiveDemoData`, `formatBinanceKlineBars`, `formatBinanceKlines`, `getOfflineDemoBars`, `getOfflineDemoData`, `mergeBarsByDate`, `normalizeBars`, `parseCsvRow`, `parseDateTime`, `sortBars`, `toTimeValue`
- Top-level variables:
  - `BINANCE_BASE`, `BINANCE_INTERVAL_MAP`, `BINANCE_MAX_LIMIT`, `BOLLINGER_BAND_OPTIONS`, `DEMO_CANONICAL_SERIES`, `DEMO_WINDOW`, `bars`, `binanceInterval`, `deduped`, `endTimeValue`, `json`, `lastBar`, `merged`, `nextEndTime`, `pageBars`, `params`, `response`, `sorted`, `startTimeValue`, `url`

### `frontend/src/components/vnstockcharts/demo/DemoPageShell.tsx`

- Top-level variables:
  - `frameClassNameValue`, `pageClassName`

### `frontend/src/components/vnstockcharts/demo/FullDemo.tsx`

- Functions:
  - `FullDemoContent`, `LegendRow`, `MetricTile`, `createOrigin`, `formatSigned`, `getInitialExtents`, `handleBrush`, `handleResetView`, `handleResize`, `normalizeBrushExtents`, `updateWidth`
- Top-level variables:
  - `axisTheme`, `bearishColor`, `bollingerAppearance`, `bottomXAxisTheme`, `bullishColor`, `cancelled`, `chartData`, `chartHeight`, `chartSurfaceRef`, `controller`, `coordinateTheme`, `dateFormat`, `ema20Stroke`, `ema50Stroke`, `emaTrendUp`, `endDate`, `endIndex`, `gridWidth`, `integerFormat`, `latest`, `macdAppearance`, `macdHeight`, `macdOrigin`, `margin`, `node`, `observer`, `offlineData`, `overviewHeight`, `overviewOrigin`, `percentFormat`, `plotHeight`, `previous`, `priceChange`, `priceChangePercent`, `priceFormat`, `priceHeight`, `priceYAxisTheme`, `resolvedChartWidth`, `rsiAppearance`, `rsiOrigin`, `rsiPanelHeight`, `rsiValue`, `sign`, `sourceStatusLabel`, `sourceTone`, `startDate`, `startIndex`, `themeFontFamily`, `tooltipDisplayTexts`, `topXAxisTheme`, `volumeFormat`, `volumeHeight`, `volumeOrigin`, `volumeYAxisTheme`

### `frontend/src/components/vnstockcharts/demo/heikinAshi.ts`

- Functions:
  - `transformHeikinAshi`
- Top-level variables:
  - `bar`, `close`, `high`, `low`, `open`, `result`

### `frontend/src/components/vnstockcharts/demo/historyFetchQueue.ts`

- Classes:
  - `HistoryFetchQueue`
- Functions:
  - `makeId`
- Top-level variables:
  - `candidates`, `existing`, `job`

### `frontend/src/components/vnstockcharts/demo/historySchedulerPolicy.ts`

- Functions:
  - `canRunHistoryScheduler`

### `frontend/src/components/vnstockcharts/demo/historyWindowPlanner.ts`

- Functions:
  - `computeLoadedWindow`, `computeMissingSegments`, `computeTargetWindow`, `shouldScheduleFetch`
- Top-level variables:
  - `leftMissing`, `leftRatio`, `leftTrigger`, `maxMs`, `minMs`, `ms`, `rightMissing`, `rightRatio`, `rightTrigger`, `span`

### `frontend/src/components/vnstockcharts/demo/i18n.tsx`

- Functions:
  - `DemoI18nBoundary`, `DemoI18nProvider`, `interpolate`, `readStoredLanguage`, `translate`, `useDemoI18n`
- Top-level variables:
  - `DEMO_LANGUAGE_STORAGE_KEY`, `DemoI18nContext`, `context`, `defaultContextValue`, `getPaneLabel`, `key`, `paneLabelKeys`, `setLanguage`, `stored`, `t`, `template`, `translations`, `value`

### `frontend/src/components/vnstockcharts/demo/index.tsx`

- Top-level variables:
  - `container`, `root`

### `frontend/src/components/vnstockcharts/demo/LibraryShowcaseDemo.tsx`

- Functions:
  - `ToolIcon`, `clonePoint`, `fetchOrderFlow`, `formatBarsHeld`, `formatSignedPrice`, `getSelectedDrawingId`, `handleDrawingShortcuts`, `handleEscape`, `handler`, `isEditableTarget`, `isYAxisSide`, `klineBarToRawOHLCV`, `loadChartType`, `loadDemoSettings`, `normalizeDate`, `normalizeVNITimeframe`, `paneTemplate`, `persistStyleOverrides`, `readSize`, `readStoredString`, `resolveDrawingPlacementForPane`, `resolveTimeframeMs`, `saveDemoSettings`, `sortDrawings`, `writeStoredValue`
- Top-level variables:
  - `BACKFILL_MAX_PAGES`, `BACKFILL_PAGE_LIMIT`, `BINANCE_TIMEFRAMES`, `CANDLE_TYPE_STORAGE_KEY`, `CHART_TYPES`, `CHART_TYPE_TO_SERIES`, `DAY_MS`, `DEFAULT_DEMO_SETTINGS`, `DEFAULT_MAX_VISIBLE_BARS`, `DEFAULT_MAX_VISIBLE_PANES`, `DEMO_SETTINGS_STORAGE_KEY`, `DRAWING_PANEL_WIDTH`, `DRAWING_TOOL_FLYOUT_BUTTON_SIZE`, `DRAWING_TOOL_FLYOUT_GAP`, `DRAWING_TOOL_FLYOUT_MARGIN`, `DRAWING_TOOL_FLYOUT_PADDING`, `DRAWING_TOOL_FLYOUT_WIDTH`, `INITIAL_HISTORY_MAX_PAGES`, `INITIAL_HISTORY_TARGET_BARS`, `MAIN_PRICE_SERIES_TYPES`, `MOBILE_DRAWING_TOOL_BREAKPOINT`, `MOBILE_DRAWING_TOOL_FLYOUT_BUTTON_SIZE`, `PERCENT_FORMAT`, `REPLAY_SPEEDS`, `SCHEDULER_TICK_MS`, `TOOL_GROUPS`, `TOOL_ICON_ALIASES`, `VNI_SYMBOL_STORAGE_KEY`, `VNI_TIMEFRAMES`, `VNI_TIMEFRAME_STORAGE_KEY`, `abortController`, `activeInGroup`, `activeSourceRef`, `adapter`, `addPane`, `allPrices`, `applyDelta`, `available`, `averageBarsHeld`, `averagePnl`, `backfillDebounceRef`, `backfillInFlightRef`, `bars`, `bestTrade`, `bringSelectedToFront`, `cancelled`, `candleTypeLabel`, `candleWidth`, `canvasBg`, `chartAdapter`, `chartData`, `chartRangeRef`, `chartReady`, `chartTimeframe`, `client`, `clipboardDrawing`, `cloneSelectedDrawing`, `closeDrawingContextMenu`, `closePaperTradePosition`, `closeReplayContextMenu`, `closeSettings`, `closedTrade`, `compactFlyoutButtonSize`, `controller`, `copySelectedDrawing`, `currentBars`, `currentItem`, `currentPosition`, `currentVisibleDomain`, `data`, `dataAdapter`, `dateFormat`, `deleteDrawingById`, `desiredType`, `domain`, `drawingClipboardRef`, `drawingContextMenuDrawing`, `drawingInspectorLabels`, `drawingInspectorPosition`, `drawingInteraction`, `drawingListPanelLabels`, `drawingListPosition`, `drawingPanelX`, `drawingStorage`, `drawingTextEditorLabels`, `earliestBar`, `enrichedData`, `ensureRangeHistory`, `estimatedFlyoutHeight`, `estimatedFlyoutWidth`, `existing`, `fallbackHeight`, `fallbackTop`, `file`, `first`, `firstBar`, `flyoutStyle`, `from`, `generation`, `h`, `handleAddPane`, `handleCancelTextEdit`, `handleChartRangeChange`, `handleChartTypeChange`, `handleClearDrawings`, `handleCloseDrawingInspector`, `handleCommitTextEdit`, `handleDrawingContextMenu`, `handleDrawingToolUsed`, `handleExportDrawings`, `handleFileLoaded`, `handleImportButtonClick`, `handleImportFileChange`, `handleLoadDrawings`, `handleLoadVNIChart`, `handlePATSaved`, `handlePaneAddSeriesRequest`, `handlePaperTradeClick`, `handlePaperTradeReset`, `handleReplayContextMenu`, `handleReplayFromHere`, `handleReplayJumpLatest`, `handleReplayRewind`, `handleReplaySpeedChange`, `handleReplayStepBack`, `handleReplayStepForward`, `handleReplayToggle`, `handleResetSettings`, `handleSourceSwitch`, `handleStartTextEdit`, `handleTickerUpdate`, `handleTimeframeChange`, `handleVisibleDomainChange`, `handleVniConfigChange`, `handleVniSymbolChange`, `hasWidgetData`, `iconId`, `importInputRef`, `inFlyout`, `inToolbar`, `indicatorLegendLabels`, `indicatorSeries`, `initialDemoSettings`, `initialWarmupRequestedRef`, `innerHeight`, `innerWidth`, `intervalId`, `isCompactDrawingToolbarViewport`, `isEditingText`, `isNearOldestEdge`, `isOpen`, `job`, `last`, `lastBar`, `lastClick`, `lastPaperTradeClickRef`, `lastPaperTradeSignatureRef`, `lastViewportMissingRef`, `lastVisibleBar`, `latestBar`, `latestBars`, `layout`, `leftBufferMs`, `leftZ`, `liveDataRef`, `liveMeasurementLabels`, `loaded`, `localCacheAdapter`, `localizePane`, `localizedMessage`, `localizedPane`, `losses`, `maxPrice`, `maxZ`, `message`, `minPrice`, `minZ`, `missing`, `mountedRef`, `msg`, `nativeEvent`, `neededStart`, `newHigh`, `newLow`, `newPrice`, `nextClone`, `nextDrawings`, `nextLabel`, `nextLeft`, `nextPaste`, `nextPosition`, `nextTop`, `nextWhaleData`, `node`, `normalizeDomain`, `normalizedDomain`, `now`, `observer`, `offlineBars`, `ohlcStatusLabel`, `olderBars`, `oldestBar`, `openPATModal`, `openSettings`, `page`, `pagesLoaded`, `paneHeaderLabels`, `paneHeights`, `paneLabel`, `paneOverlayLayout`, `paneState`, `panesMenuRef`, `paperTradeJournal`, `paperTradePanelVisible`, `paperTradePositionRef`, `paperTradeRealizedPnl`, `paperTradeReportVisible`, `paperTradeSummary`, `paperTradeUnrealizedPnl`, `parsed`, `pasteCopiedDrawing`, `pat`, `plotData`, `preferredSide`, `priceFormat`, `priceIsUp`, `priceOffset`, `pricePane`, `primary`, `profileMenuRef`, `queueRef`, `ratio`, `raw`, `realizedPnl`, `rect`, `renderWidgetPaneSplitter`, `renderWidgetPaneToolbar`, `replayController`, `replayControllerRef`, `replayFinished`, `replayProgressLabel`, `replayToggleTitle`, `replayVisibleData`, `requestId`, `requestOlderHistoryPage`, `resetToDefault`, `rightZ`, `saved`, `scheduleForViewport`, `schedulerGenerationRef`, `second`, `selectDrawingById`, `selectedDrawing`, `selectedDrawingId`, `selectedPane`, `selectedSymbol`, `sendSelectedToBack`, `shellNode`, `shellRef`, `shortcut`, `shouldEvaluateViewportBackfill`, `showOhlcMetrics`, `signature`, `snapshot`, `snapshotMap`, `sortedDrawings`, `stepPx`, `storageToolbarPosition`, `stored`, `supportsDrawingOverlays`, `supportsInteractiveChartOverlays`, `supportsMeasurementOverlay`, `sym`, `symbol`, `tagName`, `target`, `targetDrawing`, `targetSides`, `targetStart`, `timeOffset`, `timeframeMs`, `timer`, `to`, `toggleDrawingLockedById`, `toggleDrawingVisibleById`, `toggleSelectedLock`, `toggleSelectedVisible`, `toolLabel`, `toolbarRef`, `topbarStatusBadge`, `totalTrades`, `transformed`, `triggerBackfillDebounced`, `unsubscribeDrawings`, `unsubscribeSeries`, `updateSelectedDrawing`, `viewport`, `viewportStart`, `visibleDomainRef`, `visiblePanes`, `vniClientRef`, `vniRequestIdRef`, `vniSnapshotIdRef`, `vniSymbolRef`, `vniTimeframeRef`, `vniWsRef`, `volumeFormat`, `w`, `warmupInFlightRef`, `warmupInitialBinanceHistory`, `widgetData`, `widgetMessages`, `wins`, `worstTrade`, `ws`, `x`, `xExtents`, `y`

### `frontend/src/components/vnstockcharts/demo/LiveDemo.tsx`

- Functions:
  - `LiveDemoContent`
- Top-level variables:
  - `cancelled`, `height`, `margin`, `sourceLabel`, `width`

### `frontend/src/components/vnstockcharts/demo/OriginalLikeDemo.tsx`

- Functions:
  - `OriginalLikeDemoContent`, `createOrigin`, `ema12Accessor`, `ema26Accessor`, `handleBrush`, `handleResetView`, `handleResize`, `handleVisibleDomainChange`, `macdAccessor`, `updateWidth`, `xAxisTickFormat`
- Top-level variables:
  - `BRUSH_TYPE`, `EMA12_SERIES`, `EMA26_SERIES`, `MACD_SERIES`, `axisTheme`, `bearishColor`, `bullishColor`, `calculatedData`, `chartHeight`, `chartSurfaceRef`, `coordinateTheme`, `ema12Stroke`, `ema26Stroke`, `endIndex`, `initialXExtents`, `isZoomedIn`, `left`, `macdAppearance`, `macdDateFormat`, `macdFormat`, `macdFormat3`, `macdHeight`, `macdOrigin`, `macdYAxisTheme`, `macdYAxisTickFormat`, `macdYAxisTicks`, `margin`, `node`, `observer`, `priceFormat`, `priceFormat1`, `priceFormat3`, `priceHeight`, `priceYAxisTheme`, `priceYAxisTickFormat`, `priceYAxisTicks`, `rawData`, `resolvedChartWidth`, `right`, `smaVolume10`, `startIndex`, `themeFontFamily`, `tickDatum`, `tickIndex`, `tooltipDateFormat`, `tooltipDisplayTexts`, `visibleBars`, `visibleDomainLabel`, `volumeAxisFormat`, `volumeFormat`, `volumeHeight`, `volumeMouseFormat`, `volumeOrigin`, `volumeYAxisTheme`, `xScaleProvider`

### `frontend/src/components/vnstockcharts/demo/PaneSettingsModal.tsx`

- Functions:
  - `PaneSettingsModal`, `describeSeries`, `getIndicatorSetLabel`, `handleAddSeries`, `handleApplyIndicatorSet`, `handleBackdropMouseDown`, `handleDeleteIndicatorSet`, `handleDeletePane`, `handleImportIndicatorSetChange`, `handleImportIndicatorSetClick`, `handleKeyDown`, `handleSaveCurrentIndicatorSet`, `handleSeriesParamChange`, `paneLabel`, `parseNumber`, `renderField`, `renderIndicatorSetsSection`, `renderIndicatorsSection`, `renderLayoutSection`, `renderResetSection`, `renderSeriesParams`, `renderSetCard`, `renderThemeSection`
- Top-level variables:
  - `availableSeriesTypes`, `builtinSets`, `canAddPane`, `canMoveDown`, `canMoveUp`, `colorPicker`, `composerEntry`, `currentValue`, `dialogRef`, `entry`, `fast`, `fields`, `file`, `gridClassName`, `hidden`, `importInputRef`, `imported`, `indicatorSets`, `isDefaultPane`, `isSelected`, `label`, `next`, `nextSelectedPaneId`, `numeric`, `overLimit`, `rawValue`, `resolvedComposerType`, `revealEnabled`, `saved`, `sectionLabels`, `selectedPane`, `set`, `slow`, `subColorSection`, `subComponents`, `userSets`, `visibleCount`, `visibleIndex`

### `frontend/src/components/vnstockcharts/demo/styleOverridesPersistence.ts`

- Functions:
  - `getStorage`, `isEmptyOverrides`, `isPlainRecord`, `loadPersistedStyleOverrides`, `normalizeStyleMap`, `restorePersistedStyleOverrides`, `saveCurrentStyleOverrides`, `snapshotStyleOverrides`
- Top-level variables:
  - `STYLE_OVERRIDES_STORAGE_KEY`, `overrides`, `parsed`, `raw`, `resolvedStorage`

### `frontend/src/components/vnstockcharts/demo/topbarStatusBadge.ts`

- Functions:
  - `resolveDemoTopbarStatusBadge`
- Top-level variables:
  - `message`

### `frontend/src/components/vnstockcharts/demo/usePaneLayout.ts`

- Functions:
  - `applyDelta`, `loadRatio`, `pxToRatio`, `ratioToPx`, `sanitize`, `saveRatio`, `usePaneLayout`
- Top-level variables:
  - `DEFAULT_RATIO`, `LS_KEY`, `MIN_PX`, `PANE_MARGIN_V`, `applyDragDelta`, `available`, `k`, `momentumH`, `newA`, `newB`, `newMomentumH`, `newPriceH`, `newVolumeH`, `overflow`, `priceH`, `px`, `r`, `resetLayout`, `stored`, `sum`, `total`, `volumeH`

### `frontend/src/components/vnstockcharts/demo/vninvest/__tests__/adapters.test.ts`

- Top-level variables:
  - `points`, `result`

### `frontend/src/components/vnstockcharts/demo/vninvest/adapters.ts`

- Functions:
  - `chartPointsToRawOHLCV`
- Top-level variables:
  - `date`, `result`

### `frontend/src/components/vnstockcharts/demo/vninvest/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/vninvest/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/vninvest/VNInvestClient.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/index.ts`

- Top-level variables:
  - `version`

### `frontend/src/components/vnstockcharts/lib/adapters/adapters.test.ts`

- Classes:
  - `MockSocket`
- Functions:
  - `createResponse`
- Top-level variables:
  - `adapter`, `bars`, `fetchMock`, `from`, `moreBars`, `onBar`, `onOrderbook`, `onTrade`, `sampleBars`, `sampleSymbols`, `symbols`, `to`, `unsubscribeBar`, `unsubscribeOrderbook`, `unsubscribeTrades`, `url`

### `frontend/src/components/vnstockcharts/lib/adapters/BaseAdapter.ts`

- Top-level variables:
  - `cached`, `fallbackOrigin`, `now`, `rawDate`, `response`, `url`, `value`

### `frontend/src/components/vnstockcharts/lib/adapters/BinanceAdapter.test.ts`

- Top-level variables:
  - `adapter`, `capturedUrl`, `mockKlines`, `result`

### `frontend/src/components/vnstockcharts/lib/adapters/BinanceAdapter.ts`

- Classes:
  - `BinanceAdapter`
- Functions:
  - `parseKlines`, `resolveInterval`, `validateSymbol`
- Top-level variables:
  - `BINANCE_BASE`, `BINANCE_INTERVALS`, `INTERVAL_MAP`, `MAX_LIMIT`, `SYMBOL_RE`, `_BINANCE_ORIGIN`, `bars`, `binanceAdapter`, `json`, `mapped`, `response`, `safeInterval`, `safeLimit`, `safeSymbol`, `upper`, `urlParams`

### `frontend/src/components/vnstockcharts/lib/adapters/DataAdapter.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/adapters/DjangoVnstockAdapter.ts`

- Classes:
  - `DjangoVnstockAdapter`
- Functions:
  - `createRestAdapter`, `normalizeOrderbook`, `normalizeTrade`
- Top-level variables:
  - `cacheKey`, `params`, `rawBar`, `rawBars`, `rawSnapshot`, `rawTrade`, `socket`

### `frontend/src/components/vnstockcharts/lib/adapters/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/adapters/LocalCacheAdapter.test.ts`

- Top-level variables:
  - `adapter`, `bars`, `btcResult`, `cutoff`, `ethResult`, `makeBars`, `result`

### `frontend/src/components/vnstockcharts/lib/adapters/LocalCacheAdapter.ts`

- Classes:
  - `LocalCacheAdapter`
- Functions:
  - `cacheKey`, `isValidBar`
- Top-level variables:
  - `bars`, `before`, `key`, `slice`, `sorted`

### `frontend/src/components/vnstockcharts/lib/adapters/MockAdapter.ts`

- Classes:
  - `MockAdapter`
- Functions:
  - `cloneBar`, `createMockBars`, `createSampleBars`, `emitNext`, `emitSnapshot`, `emitTrade`
- Top-level variables:
  - `bar`, `bars`, `close`, `cursor`, `drift`, `high`, `low`, `normalizedQuery`, `open`, `snapshotIndex`, `timerId`, `tradeIndex`

### `frontend/src/components/vnstockcharts/lib/adapters/StockDataAdapter.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/adapters/VNStocksAdapter.test.ts`

- Functions:
  - `createResponse`, `createStorageMock`
- Top-level variables:
  - `adapter`, `fetchMock`, `result`, `store`, `url`

### `frontend/src/components/vnstockcharts/lib/adapters/VNStocksAdapter.ts`

- Classes:
  - `VNStocksAdapter`
- Functions:
  - `buildHeaders`, `clampDays`, `extractRawPoints`, `normalizeApiBase`, `normalizeInterval`, `normalizePoint`, `parseNumber`, `parseTimestamp`, `readStorageValue`, `resolveApiBase`, `resolveDays`, `resolveIntervalMs`, `resolvePatToken`, `validateSymbol`
- Top-level variables:
  - `API_BASE_STORAGE_KEY`, `DAY_MS`, `DEFAULT_API_BASE`, `MAX_DAYS`, `PAT_STORAGE_KEY`, `SYMBOL_RE`, `allBars`, `anchorWindowMs`, `backwardAnchor`, `bars`, `base`, `close`, `data`, `days`, `globalScope`, `high`, `intervalMs`, `low`, `normalized`, `numeric`, `open`, `parsed`, `patToken`, `payload`, `point`, `rawDate`, `requestedWindowMs`, `response`, `safeInterval`, `safeLimit`, `safeSymbol`, `stored`, `timestamp`, `trimmed`, `url`, `volume`

### `frontend/src/components/vnstockcharts/lib/algorithm/index.ts`

- Top-level variables:
  - `algorithm`, `calculator`, `defaultAlgorithm`, `newData`, `windowSize`

### `frontend/src/components/vnstockcharts/lib/annotation/Annotate.tsx`

- Classes:
  - `Annotate`
- Functions:
  - `helper`
- Top-level variables:
  - `data`

### `frontend/src/components/vnstockcharts/lib/annotation/BarAnnotation.tsx`

- Classes:
  - `BarAnnotation`
- Functions:
  - `getArrowForTextIcon`, `helper`
- Top-level variables:
  - `arrows`, `xFunc`, `yFunc`

### `frontend/src/components/vnstockcharts/lib/annotation/index.ts`

- Functions:
  - `buyPath`, `sellPath`
- Top-level variables:
  - `bottomWidth`, `halfWidth`, `height`

### `frontend/src/components/vnstockcharts/lib/annotation/Label.tsx`

- Classes:
  - `Label`
- Functions:
  - `drawOnCanvas`, `drawOnCanvas2`, `getText`, `getYScale`
- Top-level variables:
  - `radians`

### `frontend/src/components/vnstockcharts/lib/annotation/LabelAnnotation.tsx`

- Classes:
  - `LabelAnnotation`
- Functions:
  - `helper`
- Top-level variables:
  - `defaultProps`, `xFunc`, `yFunc`

### `frontend/src/components/vnstockcharts/lib/annotation/SvgPathAnnotation.tsx`

- Classes:
  - `SvgPathAnnotation`
- Functions:
  - `helper`
- Top-level variables:
  - `xFunc`, `yFunc`

### `frontend/src/components/vnstockcharts/lib/axes/Axis.tsx`

- Classes:
  - `Axis`
- Functions:
  - `Tick`, `axisLineSVG`, `axisTicksSVG`, `drawAxisLine`, `drawEachTick`, `drawEachTickLabel`, `drawTicks`, `tickHelper`
- Top-level variables:
  - `GenericChartComponentAny`, `baseFormat`, `baseTickValues`, `d`, `domain`, `format`, `nodes`, `result`, `sign`, `simulation`, `tickProps`, `tickSpacing`, `tickValues`, `ticks`, `x`, `xAxis`, `y`, `zip`, `zoomCapture`

### `frontend/src/components/vnstockcharts/lib/axes/AxisLine.tsx`

- Classes:
  - `AxisLine`
- Functions:
  - `d3_scaleExtent`, `d3_scaleRange`
- Top-level variables:
  - `d`, `sign`, `start`, `xAxis`

### `frontend/src/components/vnstockcharts/lib/axes/AxisTicks.tsx`

- Classes:
  - `AxisTicks`, `Tick`
- Functions:
  - `tickTransform_svg_axisX`, `tickTransform_svg_axisY`
- Top-level variables:
  - `baseFormat`, `format`, `origin`, `result`, `sign`, `tickSpacing`, `tickTransform`, `ticks`, `xAxis`

### `frontend/src/components/vnstockcharts/lib/axes/AxisZoomCapture.tsx`

- Classes:
  - `AxisZoomCapture`
- Top-level variables:
  - `center`, `cursor`, `diff`, `mouseXY`, `newDomain`, `startScale`, `startXY`, `tempRange`

### `frontend/src/components/vnstockcharts/lib/axes/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/axes/XAxis.tsx`

- Classes:
  - `XAxis`
- Functions:
  - `getXScale`, `helper`
- Top-level variables:
  - `axisLocation`, `moreProps`, `trueDomain`, `trueRange`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/axes/YAxis.tsx`

- Classes:
  - `YAxis`
- Functions:
  - `getYScale`, `helper`
- Top-level variables:
  - `axisLocation`, `trueDomain`, `trueRange`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/BackgroundText.tsx`

- Classes:
  - `BackgroundText`
- Top-level variables:
  - `contexts`, `interval`, `props`, `text`

### `frontend/src/components/vnstockcharts/lib/calculator/atr.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `atrAlgorithm`, `atrValue`, `d`, `newData`, `options`, `prev`, `prevATR`, `source`, `tr`, `trueRangeAlgorithm`

### `frontend/src/components/vnstockcharts/lib/calculator/bollingerband.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `avg`, `bollingerBandAlgorithm`, `meanAlgorithm`, `options`, `source`, `stdDev`, `tuples`, `zip`

### `frontend/src/components/vnstockcharts/lib/calculator/change.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `absoluteChange`, `algo`, `newData`, `options`, `percentChange`

### `frontend/src/components/vnstockcharts/lib/calculator/compare.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `b`, `base`, `compareData`, `first`, `firsts`, `options`, `result`

### `frontend/src/components/vnstockcharts/lib/calculator/defaultOptionsForComputation.ts`

- Top-level variables:
  - `ATR`, `BollingerBand`, `Change`, `Compare`, `EMA`, `ElderImpulse`, `ElderRay`, `ForceIndex`, `FullStochasticOscillator`, `Kagi`, `MACD`, `PointAndFigure`, `RSI`, `Renko`, `SAR`, `SMA`, `SmoothedForceIndex`, `TMA`, `WMA`

### `frontend/src/components/vnstockcharts/lib/calculator/elderRay.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `bearPower`, `bullPower`, `meanAlgorithm`, `newData`, `ohlc`, `options`, `zip`

### `frontend/src/components/vnstockcharts/lib/calculator/ema.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `alpha`, `initialAccumulator`, `initialValue`, `nextValue`, `options`, `previous`, `skip`, `source`, `v`

### `frontend/src/components/vnstockcharts/lib/calculator/forceIndex.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `forceIndex`, `forceIndexCalulator`, `options`, `source`, `volume`

### `frontend/src/components/vnstockcharts/lib/calculator/heikinAshi.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `algorithm`, `close`, `high`, `low`, `open`, `source`

### `frontend/src/components/vnstockcharts/lib/calculator/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/calculator/kagi.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `atrAlgorithm`, `atrCalculator`, `dateAccessor`, `dateMutator`, `dir`, `kagiData`, `line`, `nextChangePoint`, `nextLineOpen`, `options`, `prevPeak`, `priceMovement`, `reversalThreshold`, `source`, `startAs`

### `frontend/src/components/vnstockcharts/lib/calculator/macd.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `fastEMA`, `macdArray`, `macdCalculator`, `macdResult`, `options`, `signalArray`, `signalEMA`, `slowEMA`, `undefinedArray`, `zip`

### `frontend/src/components/vnstockcharts/lib/calculator/pointAndFigure.ts`

- Functions:
  - `calculator`, `createBox`, `updateColumns`
- Top-level variables:
  - `box`, `column`, `columnData`, `dateAccessor`, `dateMutator`, `downwardMovement`, `noOfBoxes`, `options`, `prevBoxClose`, `pricingMethod`, `source`, `upwardMovement`

### `frontend/src/components/vnstockcharts/lib/calculator/renko.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `atrAlgorithm`, `atrCalculator`, `brick`, `brickSize`, `dateAccessor`, `dateMutator`, `index`, `j`, `newBrick`, `noOfBricks`, `options`, `prevCloseToHigh`, `pricingMethod`, `renkoData`, `source`

### `frontend/src/components/vnstockcharts/lib/calculator/rsi.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `avgGain`, `avgLoss`, `change`, `gainsAndLosses`, `gainsAndLossesCalculator`, `now`, `options`, `prev`, `prevAvgGain`, `relativeStrength`, `rsiAlgorithm`, `rsiData`, `rsiValue`, `source`

### `frontend/src/components/vnstockcharts/lib/calculator/sar.ts`

- Functions:
  - `calc`, `calculator`
- Top-level variables:
  - `algorithm`, `calculatedData`, `current`, `fallingEp`, `fallingSar`, `options`, `risingEp`, `risingSar`, `use`

### `frontend/src/components/vnstockcharts/lib/calculator/sma.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `average`, `options`

### `frontend/src/components/vnstockcharts/lib/calculator/smoothedForceIndex.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `algo`, `force`, `forceMA`, `ma`, `merge`, `options`, `smoothed`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/calculator/sto.ts`

- Functions:
  - `calculator`, `high`
- Top-level variables:
  - `currentClose`, `dData`, `dWindow`, `highestHigh`, `indicatorData`, `k`, `kData`, `kSmoothed`, `kWindow`, `lowestLow`, `options`, `source`, `stoAlgorithm`

### `frontend/src/components/vnstockcharts/lib/calculator/tma.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `n`, `options`, `total`, `triaverage`, `weight`

### `frontend/src/components/vnstockcharts/lib/calculator/wma.ts`

- Functions:
  - `calculator`
- Top-level variables:
  - `options`, `total`, `waverage`, `weight`

### `frontend/src/components/vnstockcharts/lib/CanvasContainer.tsx`

- Classes:
  - `CanvasContainer`
- Top-level variables:
  - `log`

### `frontend/src/components/vnstockcharts/lib/Chart.tsx`

- Functions:
  - `Chart`, `listener`
- Top-level variables:
  - `chartConfig`

### `frontend/src/components/vnstockcharts/lib/ChartCanvas.tsx`

- Classes:
  - `ChartCanvas`
- Functions:
  - `calculateFullData`, `calculateState`, `getCursorStyle`, `getDimensions`, `getXScaleDirection`, `isValidDomainValue`, `resetChart`, `setXRange`, `shouldResetChart`, `updateChart`
- Top-level variables:
  - `CANDIDATES_FOR_RESET`, `MIN_VISIBLE_BARS`, `c`, `candleWidth`, `canvases`, `chartConfig`, `clickState`, `contextValue`, `currentCharts`, `currentItem`, `cursor`, `cursorStyle`, `cx`, `dataEnd`, `dataStart`, `dimensions`, `direction`, `dragableComponents`, `dx`, `endIndex`, `endValue`, `extent`, `fallback`, `firstItem`, `firstNewItem`, `firstOldItem`, `indexOffset`, `initialPlotData`, `interaction`, `isSpuriousReset`, `item`, `lastItem`, `lastItemWasVisible`, `lastItemX`, `lastOldItem`, `log`, `newCalc`, `newData`, `newDomEnd`, `newDomStart`, `newDomain`, `newDomainExtent`, `newEndBar`, `newFirstDate`, `newStart`, `newStartBar`, `nextLength`, `nextVisibleRange`, `oldData`, `oldEndDate`, `oldEndIdx`, `oldFirstDate`, `oldFirstInNew`, `oldStartDate`, `oldStartIdx`, `plotData`, `prevLength`, `previousVisibleRange`, `recovered`, `renderContextValue`, `reset`, `response`, `result`, `s`, `sizeChanged`, `startIndex`, `startValue`, `state`, `tooltipStyle`, `updatedScale`, `updatedXScale`, `useWholeData`, `visibleRange`, `xScaleForUpdate`

### `frontend/src/components/vnstockcharts/lib/ChartContext.tsx`

- Functions:
  - `useChart`
- Top-level variables:
  - `ChartContext`, `ChartProvider`, `context`

### `frontend/src/components/vnstockcharts/lib/coordinates/CrossHairCursor.tsx`

- Classes:
  - `CrossHairCursor`
- Functions:
  - `customX`, `helper`
- Top-level variables:
  - `dashArray`, `line1`, `line2`, `lines`, `originX`, `originY`, `safeLines`, `x`

### `frontend/src/components/vnstockcharts/lib/coordinates/CurrentCoordinate.tsx`

- Classes:
  - `CurrentCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `circle`, `fillColor`, `x`, `xValue`, `y`, `yValue`

### `frontend/src/components/vnstockcharts/lib/coordinates/Cursor.tsx`

- Classes:
  - `Cursor`
- Functions:
  - `customSnapX`
- Top-level variables:
  - `centerX`, `cursors`, `dashArray`, `originX`, `originY`, `safeCursors`, `shapeWidth`, `x`, `xCursor`, `xPos`, `xShape`, `xShapeFill`, `xShapeStroke`, `xValue`, `yCursor`

### `frontend/src/components/vnstockcharts/lib/coordinates/EdgeCoordinate.tsx`

- Classes:
  - `EdgeCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `coordinateBase`, `edge`, `edgeCoordinate`, `edgeCoordinateBase`, `edgeLine`, `edgeXRect`, `line`, `path`, `textAnchor`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/coordinates/EdgeCoordinateV2.tsx`

- Functions:
  - `drawOnCanvas`, `helper`, `renderSVG`
- Top-level variables:
  - `coordinateBase`, `edge`, `edgeCoordinate`, `edgeCoordinateBase`, `edgeLine`, `edgeXRect`, `line`, `path`, `textAnchor`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/coordinates/EdgeCoordinateV3.tsx`

- Functions:
  - `drawOnCanvas`, `helper`, `renderSVG`, `roundRect`
- Top-level variables:
  - `coordinate`, `coordinateBase`, `dashArray`, `dy`, `edge`, `edgeCoordinate`, `edgeCoordinateBase`, `edgeLine`, `edgeXRect`, `halfHeight`, `line`, `path`, `textAnchor`, `width`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/coordinates/EdgeIndicator.tsx`

- Classes:
  - `EdgeIndicator`
- Functions:
  - `getEdge`, `helper`
- Top-level variables:
  - `edge`, `edgeX`, `item`, `props`, `x1`, `yValue`

### `frontend/src/components/vnstockcharts/lib/coordinates/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/coordinates/MouseCoordinateX.tsx`

- Classes:
  - `MouseCoordinateX`
- Functions:
  - `customX`, `helper`
- Top-level variables:
  - `coordinate`, `coordinateProps`, `edgeAt`, `hideLine`, `props`, `type`, `x`, `y1`

### `frontend/src/components/vnstockcharts/lib/coordinates/MouseCoordinateXV2.tsx`

- Classes:
  - `MouseCoordinateXV2`
- Functions:
  - `drawCoordinate`, `getXCoordinateInfo`, `xPosition`
- Top-level variables:
  - `defaultProps`, `halfWidth`, `height`, `pad`, `propTypes`, `shape`, `sign`, `t`, `textWidth`, `x`, `xValue`, `y`

### `frontend/src/components/vnstockcharts/lib/coordinates/MouseCoordinateY.tsx`

- Classes:
  - `MouseCoordinateY`
- Functions:
  - `getYCoordinate`, `helper`
- Top-level variables:
  - `coordinate`, `coordinateProps`, `edgeAt`, `hideLine`, `props`, `type`, `x1`, `y`

### `frontend/src/components/vnstockcharts/lib/coordinates/PriceCoordinate.tsx`

- Classes:
  - `PriceCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `coordinate`, `coordinateProps`, `edgeAt`, `hideLine`, `props`, `show`, `type`, `width`, `x1`, `y`, `yScale`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/DynamicChart.seriesWiring.test.ts`

- Functions:
  - `makeDatum`
- Top-level variables:
  - `datum`, `indicatorValues`, `leftKey`, `ma21Key`, `pane`, `rightKey`, `slot`, `slots`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/DynamicChart.xAxisFormatter.test.tsx`

- Functions:
  - `createBars`, `createDynamicChartProps`, `resetCapturedCalls`, `xAccessor`
- Top-level variables:
  - `DynamicChart`, `React`, `act`, `close`, `consoleErrorSpy`, `container`, `createRoot`, `data`, `date`, `firstDate`, `lastDate`, `mouseCoordinateProps`, `mouseCoordinateXCalls`, `open`, `pane`, `paneTooltipCalls`, `reactActEnvironment`, `root`, `tooltipProps`, `xAxisCalls`, `xAxisProps`, `yAxisCalls`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/gap1-viewport-event.test.tsx`

- Functions:
  - `alterBarValues`, `createBars`, `createCanvasContextMock`, `createChartCanvasProps`, `createChartChildren`, `createDynamicChartProps`, `xAccessor`
- Top-level variables:
  - `Chart`, `ChartCanvas`, `DynamicChart`, `act`, `bars`, `canvasContext`, `close`, `consoleErrorSpy`, `container`, `createRoot`, `date`, `getContextSpy`, `onVisibleDomainChange`, `onVisibleRangeChange`, `open`, `pane`, `reactActEnvironment`, `root`, `xExtents`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/gap2-canvas-overlay.test.tsx`

- Classes:
  - `Boundary`
- Functions:
  - `Probe`, `createBars`, `createCanvasContextMock`, `createRenderContext`
- Top-level variables:
  - `act`, `bars`, `canvas`, `canvasContext`, `caughtError`, `close`, `consoleErrorSpy`, `container`, `contextValue`, `createRoot`, `date`, `draw`, `events`, `getContextSpy`, `open`, `reactActEnvironment`, `root`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/gap3-scroll-zoom-api.test.tsx`

- Functions:
  - `createBars`, `createCanvasContextMock`, `createDynamicChartProps`, `xAccessor`
- Top-level variables:
  - `ChartCanvas`, `DynamicChart`, `act`, `bars`, `canvasContext`, `chartRef`, `close`, `consoleErrorSpy`, `container`, `createRoot`, `date`, `getContextSpy`, `open`, `pane`, `reactActEnvironment`, `root`, `setXExtentsSpy`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/IndicatorLegend.test.tsx`

- Functions:
  - `createPane`
- Top-level variables:
  - `IndicatorLegend`, `act`, `chips`, `container`, `createRoot`, `eyeButtons`, `onRemoveSeries`, `onToggleSeries`, `originalConsoleError`, `reactActEnvironment`, `removeButtons`, `root`

### `frontend/src/components/vnstockcharts/lib/core/__tests__/seriesValueResolver.test.ts`

- Functions:
  - `makeDatum`
- Top-level variables:
  - `accessors`, `datum`, `ema21`, `ema34`, `ema50`, `ma21`, `series`, `value`

### `frontend/src/components/vnstockcharts/lib/core/calculators/__tests__/enrichData.test.ts`

- Top-level variables:
  - `bar`, `bar13`, `bar20`, `bigData`, `cumulative`, `ema13Only`, `ema20Only`, `enriched`, `result`, `series`, `singleBar`, `startedAt`

### `frontend/src/components/vnstockcharts/lib/core/calculators/calcCVDApprox.ts`

- Functions:
  - `calcCVDApprox`
- Top-level variables:
  - `buyVol`, `cumulative`, `delta`, `range`, `sellVol`

### `frontend/src/components/vnstockcharts/lib/core/calculators/calcStrengthElder.ts`

- Functions:
  - `blankUntil`, `calcStrengthElder`
- Top-level variables:
  - `closes`, `ema`, `ema13`

### `frontend/src/components/vnstockcharts/lib/core/calculators/calcWhaleApprox.ts`

- Functions:
  - `calcWhaleApprox`
- Top-level variables:
  - `buyDollar`, `buyShare`, `dollarVolume`, `next`, `range`, `sellDollar`, `sellShare`

### `frontend/src/components/vnstockcharts/lib/core/calculators/enrichData.ts`

- Functions:
  - `enrichData`, `normalizeOptions`
- Top-level variables:
  - `aoColors`, `firstBias`, `firstBrar`, `firstCci`, `firstCr`, `firstDma`, `firstDmi`, `firstEmv`, `firstKdj`, `firstMtm`, `firstPsy`, `firstRoc`, `firstTrix`, `indicatorValues`, `options`, `plan`, `result`

### `frontend/src/components/vnstockcharts/lib/core/calculators/enrichDataWithCanonicalStore.test.ts`

- Top-level variables:
  - `baseline`, `canonicalStore`, `initialSize`, `pane1Result`, `pane2Result`, `result`, `result1`, `result2`, `sampleData`, `seriesConfig`, `store`, `withStoreParam`, `withoutStore`

### `frontend/src/components/vnstockcharts/lib/core/calculators/enrichDataWithCanonicalStore.ts`

- Functions:
  - `enrichDataWithCanonicalStore`, `seriesConfigHash`
- Top-level variables:
  - `aParamsStr`, `aoColors`, `bParamsStr`, `cachedEntry`, `dataSignature`, `firstBias`, `firstBrar`, `firstCci`, `firstCr`, `firstDma`, `firstDmi`, `firstEmv`, `firstKdj`, `firstMtm`, `firstPsy`, `firstRoc`, `firstTrix`, `indicatorValues`, `plan`, `result`, `sorted`, `storeKeyInput`, `typeOrder`

### `frontend/src/components/vnstockcharts/lib/core/calculators/fixtures/mockData.ts`

- Top-level variables:
  - `base`, `close`, `drift`, `high`, `low`, `mockOHLCV300`, `open`, `volume`

### `frontend/src/components/vnstockcharts/lib/core/calculators/indicatorComputation.ts`

- Functions:
  - `blankUntil`, `buildIndicatorComputationPlan`, `computeIndicatorComputationResult`, `defaultSeries`, `indicatorKey`, `materializeIndicatorValues`, `mergeBand`, `numberParam`
- Top-level variables:
  - `adx`, `ama`, `amaValues`, `ao`, `aoEnabled`, `aoKey`, `ar`, `bbi`, `bbiEnabled`, `biasByPeriod`, `biasPeriods`, `bollingerByKey`, `bollingerConfigs`, `br`, `brarByPeriod`, `brarPeriods`, `cciByPeriod`, `cciPeriods`, `closes`, `cr`, `crByKey`, `crConfigs`, `cvd`, `d`, `ddd`, `dddValues`, `defaultBollingerKey`, `defaultBollingerSeries`, `defaultMacdKey`, `defaultMacdSeries`, `defaultWhaleKey`, `defaultWhaleSeries`, `dmaByKey`, `dmaConfigs`, `dmiByPeriod`, `dmiPeriods`, `emaByPeriod`, `emaPeriods`, `emv`, `emvByPeriod`, `emvPeriods`, `histogramLine`, `histogramValue`, `indicatorValues`, `j`, `k`, `kdjByKey`, `kdjConfigs`, `key`, `ma1`, `ma2`, `ma3`, `ma4`, `macd`, `macdByKey`, `macdConfigs`, `macdLine`, `macdValue`, `minusDI`, `mtm`, `mtmByKey`, `mtmConfigs`, `obv`, `obvEnabled`, `plusDI`, `psy`, `psyByKey`, `psyConfigs`, `pvt`, `pvtEnabled`, `pvtKey`, `rocByPeriod`, `rocPeriods`, `rsiByPeriod`, `rsiPeriods`, `sarByKey`, `series`, `signal`, `signalLine`, `signalValue`, `signalValues`, `smaByPeriod`, `smaPeriods`, `strength`, `trix`, `trixByKey`, `trixConfigs`, `trixValues`, `value`, `vrByPeriod`, `vrPeriods`, `warmup`, `whaleByKey`, `whaleThresholds`, `wrByPeriod`, `wrPeriods`

### `frontend/src/components/vnstockcharts/lib/core/calculators/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/core/canonicalSeriesStore.ts`

- Functions:
  - `createCanonicalSeriesStore`, `stableStringify`
- Top-level variables:
  - `entries`, `store`

### `frontend/src/components/vnstockcharts/lib/core/canvas/ChartRenderContext.ts`

- Functions:
  - `useChartRenderContext`
- Top-level variables:
  - `ChartRenderContext`, `context`

### `frontend/src/components/vnstockcharts/lib/core/canvas/OverlayCanvas.tsx`

- Functions:
  - `OverlayCanvas`
- Top-level variables:
  - `canvas`, `canvasRef`, `context`, `physicalHeight`, `physicalWidth`, `renderContext`

### `frontend/src/components/vnstockcharts/lib/core/ChartPane.tsx`

- Functions:
  - `ChartPane`
- Top-level variables:
  - `chartScales`, `mainCanvasRef`, `mergedStyle`, `overlayCanvasRef`, `resolvedHeight`, `resolvedWidth`, `syncValue`

### `frontend/src/components/vnstockcharts/lib/core/ChartSplitter.tsx`

- Functions:
  - `ChartSplitter`, `handlePointerDown`, `handlePointerMove`, `stopDragging`
- Top-level variables:
  - `availableRef`, `cls`, `commitRef`, `drag`, `dragRef`, `node`, `rootRef`, `totalDelta`

### `frontend/src/components/vnstockcharts/lib/core/ChartTerminal.tsx`

- Functions:
  - `ChartTerminal`
- Top-level variables:
  - `mergedStyle`, `paneState`

### `frontend/src/components/vnstockcharts/lib/core/context/ChartSyncContext.ts`

- Functions:
  - `ChartSyncProvider`, `useChartSync`
- Top-level variables:
  - `ChartSyncContext`, `context`

### `frontend/src/components/vnstockcharts/lib/core/context/DataContext.ts`

- Functions:
  - `DataProvider`, `useDataContext`
- Top-level variables:
  - `DataContext`, `context`

### `frontend/src/components/vnstockcharts/lib/core/context/PaneManagerContext.ts`

- Functions:
  - `PaneManagerProvider`, `usePaneManagerContext`
- Top-level variables:
  - `PaneManagerContext`, `context`

### `frontend/src/components/vnstockcharts/lib/core/DynamicChart.tsx`

- Functions:
  - `accessor`, `axisFormatForSeriesTypes`, `buildChartSlots`, `buildPriceTooltipEntries`, `buildTooltipEntriesForSeries`, `buildYExtents`, `candleBodyWidth`, `computeExtentsForIndex`, `createChartSlot`, `createKlineXAxisFormatter`, `createSmartDateFormatter`, `dashPatternToSeriesDasharray`, `fieldAccessor`, `finiteExtent`, `formatParts`, `getSeriesStyleOverrideForSeries`, `inferMinimumPositiveDateDiffMs`, `origin`, `pad`, `renderDynamicChartChildren`, `renderSeries`, `resolveScaleSlotIdForSeries`, `resolveSeriesDisplayColor`, `sc`, `structured`, `withAlpha`
- Top-level variables:
  - `BAR_SERIES_TYPES`, `DynamicChartComponent`, `INNER_PANE_GAP`, `ONE_DAY_MS`, `OSCILLATOR_SERIES`, `PRICE_SERIES`, `VOLUME_SERIES`, `accessors`, `activeSeries`, `adaptiveDateFormat`, `adxColor`, `arColor`, `barCount`, `bbBotRaw`, `bbMidColor`, `bbTopRaw`, `brColor`, `canvas`, `chartCanvasRef`, `chartChildren`, `chartId`, `chartSlots`, `clampedIndex`, `currentBar`, `currentMs`, `d`, `dColor`, `dashArray`, `date`, `dateMap`, `diff`, `divergeColor`, `downColor`, `end`, `endDate`, `entry`, `extents`, `fillColor`, `fillOpacity`, `finiteValues`, `first`, `formatter`, `fullData`, `gap`, `groupingMode`, `half`, `handleVisibleRangeChange`, `hasBottomAxis`, `hasExplicitScaleSlotIds`, `hour`, `index`, `isDiscontinuousScale`, `isInnerPane`, `isIntraday`, `isLastSlot`, `jColor`, `kColor`, `lineColor`, `lineWidth`, `macdColor`, `maxSafeWidth`, `maxValue`, `min`, `minDiff`, `minValue`, `minimumDateDiffMs`, `minusColor`, `orderedScaleSlotIds`, `paneHeight`, `paneIndex`, `paneSlotCounter`, `paramColor`, `params`, `parts`, `plusColor`, `previousBar`, `previousMs`, `ratio`, `rsiLine`, `rsiMid`, `rsiOB`, `rsiOS`, `sampleXValue`, `scaleSlotId`, `second`, `seriesKey`, `seriesTypes`, `signalColor`, `slotInPane`, `slotSeries`, `slotsByScaleSlotId`, `start`, `startDate`, `stepPx`, `strokeOpacity`, `styleOverride`, `targetWidth`, `tooltip`, `tooltipY`, `type`, `tz`, `upColor`, `visibleBarCount`, `whale`, `xAxisDateFormat`, `yAxisFormat`, `yExtents`, `yScaleId`

### `frontend/src/components/vnstockcharts/lib/core/hooks/__tests__/useDynamicPanes.test.ts`

- Functions:
  - `createMockStorage`
- Top-level variables:
  - `blocked`, `blockedPane`, `customPane`, `customPaneId`, `defaultState`, `hiddenPane`, `next`, `panes`, `payload`, `pricePane`, `restoredPane`, `rsi`, `state`, `storage`, `sum`, `value`

### `frontend/src/components/vnstockcharts/lib/core/hooks/useCanvasResize.ts`

- Functions:
  - `updateSize`, `useCanvasResize`
- Top-level variables:
  - `element`, `observer`, `ref`

### `frontend/src/components/vnstockcharts/lib/core/hooks/useChartTheme.ts`

- Functions:
  - `useChartTheme`
- Top-level variables:
  - `STORAGE_KEY`, `setTheme`, `stored`, `toggleTheme`

### `frontend/src/components/vnstockcharts/lib/core/hooks/useDynamicPanes.ts`

- Functions:
  - `clonePane`, `clonePaneList`, `cloneSeries`, `createDefaultPaneLayout`, `createId`, `createScaleSlotId`, `createSeriesId`, `dynamicPanesReducer`, `getVisiblePanes`, `heightsToRatios`, `loadPaneLayout`, `makeDefaultLayout`, `mutateVisibleRatio`, `normalizeDefaultPane`, `normalizeLoadedPaneLayout`, `normalizeStoredPane`, `normalizeStoredSeries`, `normalizeStoredSeriesType`, `normalizeVisibleRatios`, `ratiosToHeights`, `readStoredPaneLayout`, `reorderVisiblePanes`, `replacePaneLayout`, `resolveSeriesIndex`, `sanitizeLayout`, `savePaneLayout`, `syncSplitScale`, `useDynamicPanes`, `validatePane`, `visibleCount`, `visibleIndices`, `writeStoredPaneLayout`
- Top-level variables:
  - `FRAME_VERTICAL_MARGIN`, `MIN_PANE_HEIGHT`, `activeSeries`, `addPane`, `addSeries`, `allocated`, `anyVisible`, `applyDelta`, `available`, `bottomHeight`, `bottomPane`, `byId`, `cloned`, `cursor`, `customPanes`, `defaultPanes`, `deletePane`, `height`, `heights`, `indices`, `layout`, `maxVisiblePanes`, `minBottom`, `minTop`, `next`, `nextBottom`, `nextLabel`, `nextTop`, `orderedVisible`, `pairTotal`, `pane`, `parsed`, `ratio`, `raw`, `removePane`, `removeSeries`, `renamePane`, `reorderPanes`, `replaceLayout`, `replacement`, `resetToDefault`, `restorePane`, `series`, `seriesIndex`, `stored`, `toggleSeriesVisible`, `toggleVisible`, `topHeight`, `topPane`, `total`, `type`, `updateSeriesColor`, `updateSeriesParams`, `updateSeriesSubColor`, `updateSeriesYAxis`, `updated`, `visible`, `visibleCursor`, `visiblePanes`, `visibleSlots`

### `frontend/src/components/vnstockcharts/lib/core/hooks/useIndicatorSets.ts`

- Functions:
  - `mergeSets`, `pickStorage`, `readFileAsText`, `useIndicatorSets`
- Top-level variables:
  - `allowedSeriesTypes`, `applySet`, `blob`, `builtinSets`, `deleteSet`, `exportSet`, `getSetById`, `importSet`, `imported`, `link`, `loaded`, `merged`, `nextSet`, `parsed`, `reader`, `removed`, `renameSet`, `renamed`, `saveCurrentAsSet`, `set`, `sets`, `storage`, `text`, `trimmed`, `url`

### `frontend/src/components/vnstockcharts/lib/core/hooks/usePaneManager.test.ts`

- Top-level variables:
  - `nextState`, `pricePane`, `volumePane`

### `frontend/src/components/vnstockcharts/lib/core/hooks/usePaneManager.ts`

- Functions:
  - `clampHeight`, `createPaneId`, `normalizePane`, `paneManagerReducer`, `usePaneManager`
- Top-level variables:
  - `addIndicator`, `addPane`, `normalizedPane`, `paneIdSeed`, `removeIndicator`, `removePane`, `resizePane`, `updateIndicator`

### `frontend/src/components/vnstockcharts/lib/core/hooks/usePaneSizes.ts`

- Functions:
  - `applyDeltaBetween`, `loadRatios`, `normalise`, `pxToRatios`, `ratiosToPx`, `sanitize`, `saveRatios`, `sum`, `usePaneSizes`
- Top-level variables:
  - `a`, `applyDelta`, `available`, `b`, `consumed`, `count`, `defaultRatios`, `defaultRatiosRef`, `heights`, `minA`, `minB`, `minH`, `minHRef`, `minTotal`, `n`, `newA`, `newB`, `px`, `reset`, `result`, `stored`, `sum`, `total`, `updated`

### `frontend/src/components/vnstockcharts/lib/core/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/core/IndicatorLegend.tsx`

- Functions:
  - `IndicatorLegend`, `paramNumber`, `seriesLabel`
- Top-level variables:
  - `PRIMARY_CHART_TYPES`, `SERIES_LABELS`, `base`, `chipStyle`, `chips`, `fast`, `hidden`, `seriesIndex`, `shortLabel`, `slow`, `value`

### `frontend/src/components/vnstockcharts/lib/core/PaneHeader.tsx`

- Functions:
  - `PaneHeader`
- Top-level variables:
  - `style`

### `frontend/src/components/vnstockcharts/lib/core/PaneLabel.tsx`

- Functions:
  - `PaneLabel`
- Top-level variables:
  - `style`

### `frontend/src/components/vnstockcharts/lib/core/paneScaleSlotDomains.ts`

- Functions:
  - `buildAxisAccessors`, `computeAxisDomain`, `computePaneScaleSlotDomains`, `finiteExtent`, `isSeriesVisible`
- Top-level variables:
  - `BAR_SERIES_TYPES`, `accessors`, `axisSeries`, `domains`, `finiteValues`, `leftDomain`, `maxValue`, `minValue`, `rightDomain`, `styleOverride`, `values`

### `frontend/src/components/vnstockcharts/lib/core/PaneSplitter.tsx`

- Functions:
  - `PaneSplitter`, `clamp`, `handleMove`, `handlePointerDown`, `handleUp`
- Top-level variables:
  - `availableHeight`, `bottomPaneElement`, `deltaY`, `dragState`, `dragStateRef`, `mergedStyle`, `nextHeight`, `splitterElement`, `startTopHeight`, `topPaneElement`

### `frontend/src/components/vnstockcharts/lib/core/PaneTooltip.tsx`

- Functions:
  - `PaneTooltip`, `defaultDateValue`, `toDisplayValue`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `lines`, `rawValue`, `renderSVG`, `resolvedOrigin`

### `frontend/src/components/vnstockcharts/lib/core/registry/__tests__/SeriesRegistry.test.ts`

- Top-level variables:
  - `entry`, `phaseOneTypes`, `registered`

### `frontend/src/components/vnstockcharts/lib/core/registry/registerAll.ts`

- Functions:
  - `initRegistry`

### `frontend/src/components/vnstockcharts/lib/core/registry/SeriesRegistry.test.ts`

- Top-level variables:
  - `global`, `perInstance`, `unsubscribeGlobal`, `unsubscribeInstance`

### `frontend/src/components/vnstockcharts/lib/core/registry/SeriesRegistry.ts`

- Functions:
  - `clearRegistry`, `clearSeriesStyleOverride`, `clearSeriesStyleOverrides`, `cloneSeriesStyleOverride`, `colorFromConfig`, `dashPatternToStrokeDasharray`, `getSeries`, `getSeriesStyleOverride`, `listRegistered`, `listSeriesStyleOverrides`, `normalizeSeriesStyleOverride`, `notifyAllSeriesStyleChanges`, `notifySeriesStyleChange`, `overrideSeriesStyle`, `periodFromConfig`, `registerLineSeries`, `registerPhaseOneSeries`, `registerSeries`, `subscribeSeriesStyle`, `subscribeSeriesStyleChanges`
- Top-level variables:
  - `current`, `dashPattern`, `entry`, `listeners`, `next`, `normalized`, `period`, `registry`, `seriesStyleChangeListeners`, `seriesStyleListeners`, `seriesStyleOverrides`

### `frontend/src/components/vnstockcharts/lib/core/replay/BarReplayController.test.ts`

- Functions:
  - `createBar`
- Top-level variables:
  - `controller`, `states`, `unsubscribe`

### `frontend/src/components/vnstockcharts/lib/core/replay/BarReplayController.ts`

- Classes:
  - `BarReplayController`
- Functions:
  - `clampIndex`, `intervalForSpeed`, `toTimeValue`
- Top-level variables:
  - `foundIndex`, `nextStartIndex`, `state`, `targetTime`

### `frontend/src/components/vnstockcharts/lib/core/scales/computeScales.ts`

- Functions:
  - `collectAxisExtents`, `computeScales`, `finiteExtent`, `mergeExtents`
- Top-level variables:
  - `computed`, `definition`, `extents`, `finiteValues`, `flattened`, `hasRightAxis`, `leftScale`, `leftSeriesExtents`, `leftValues`, `maxValue`, `minValue`, `rightScale`, `rightSeriesExtents`, `rightValues`

### `frontend/src/components/vnstockcharts/lib/core/SeriesPicker.tsx`

- Functions:
  - `SeriesPicker`, `buildDefaultSeries`, `handleKeyDown`, `handleMouseDown`, `updatePosition`
- Top-level variables:
  - `active`, `anchor`, `anchorRect`, `clickInsideAnchor`, `clickInsidePicker`, `container`, `containerRect`, `entry`, `picker`, `pickerRef`, `seriesTypes`, `target`

### `frontend/src/components/vnstockcharts/lib/core/seriesValueResolver.ts`

- Functions:
  - `asNumber`, `buildIndicatorSeriesKey`, `exactLegacyValue`, `numberParam`, `resolveSeriesDatumValue`, `resolveSeriesStructuredValue`, `resolveSeriesValue`, `resolveSeriesValueAccessors`
- Top-level variables:
  - `fast`, `fastPeriod`, `key`, `m1`, `m2`, `m3`, `m4`, `period`, `signal`, `signalPeriod`, `slow`, `slowPeriod`, `stdDev`, `threshold`, `value`, `whale`

### `frontend/src/components/vnstockcharts/lib/core/sets/__tests__/indicatorSetCodec.test.ts`

- Functions:
  - `createMockStorage`
- Top-level variables:
  - `exported`, `imported`, `layout`, `loaded`, `next`, `original`, `payload`, `samplePane`, `savedSet`, `set`, `storage`, `value`

### `frontend/src/components/vnstockcharts/lib/core/sets/builtins.ts`

- Top-level variables:
  - `BUILTIN_INDICATOR_SETS`

### `frontend/src/components/vnstockcharts/lib/core/sets/indicatorSetCodec.ts`

- Functions:
  - `buildIndicatorSetFileName`, `cloneIndicatorSet`, `clonePane`, `cloneSeries`, `createId`, `createIndicatorSet`, `createSeriesId`, `indicatorSetToPaneLayout`, `isPaneDescriptor`, `isPlainObject`, `isSeriesConfig`, `isSeriesTypeId`, `isTooltipMode`, `isYAxisSide`, `loadIndicatorSets`, `sanitizeIndicatorSet`, `sanitizeIndicatorSetsStorage`, `saveIndicatorSets`, `stringifyIndicatorSet`
- Top-level variables:
  - `allowed`, `byId`, `parsed`, `payload`, `raw`, `sanitized`, `slug`, `stamp`

### `frontend/src/components/vnstockcharts/lib/core/types/__tests__/pane-descriptor.test.ts`

- Top-level variables:
  - `ids`, `sum`, `visible`

### `frontend/src/components/vnstockcharts/lib/core/types/chart.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/core/types/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/core/types/indicator-catalog.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/core/types/indicator-set.ts`

- Top-level variables:
  - `INDICATOR_SETS_STORAGE_KEY`

### `frontend/src/components/vnstockcharts/lib/core/types/pane-descriptor.ts`

- Functions:
  - `isDefaultPaneId`, `normalizeSeriesTypeId`
- Top-level variables:
  - `DEFAULT_PANES`, `DEFAULT_PANE_ID_SET`, `KNOWN_SERIES_TYPE_SET`, `LEGACY_SERIES_TYPE_ALIASES`, `PANE_LAYOUT_STORAGE_KEY`, `PANE_MAX_VISIBLE`, `SERIES_TYPE_IDS`, `canonicalType`

### `frontend/src/components/vnstockcharts/lib/core/types/seriesComponents.ts`

- Top-level variables:
  - `SERIES_SUB_COMPONENTS`

### `frontend/src/components/vnstockcharts/lib/drawing/actionHandles.test.ts`

- Functions:
  - `makeHLine`, `makeScales`, `makeTrendLine`, `makeVLine`
- Top-level variables:
  - `bbox`, `ctx`, `deleteX`, `deleteY`, `drawing`, `hitRadius`, `now`, `result`, `scales`

### `frontend/src/components/vnstockcharts/lib/drawing/AlertNotificationToast.tsx`

- Functions:
  - `AlertNotificationToast`, `playAlertChime`
- Top-level variables:
  - `AudioContextClass`, `borderLeftColor`, `containerStyle`, `ctx`, `elapsed`, `gain`, `isCrossAbove`, `latest`, `osc`, `remaining`, `timer`, `toastStyle`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/abcdPattern.ts`

- Functions:
  - `calculateAbcdPatternMetrics`
- Top-level variables:
  - `AbcdPattern`, `ab`, `bc`, `cd`, `points`, `priceAB`, `priceBC`, `priceCD`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/arrow.ts`

- Top-level variables:
  - `Arrow`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/channel.ts`

- Top-level variables:
  - `Channel`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/cycles.test.ts`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`, `geo`, `points`, `scales`, `updated`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/cycles.ts`

- Functions:
  - `calculateCycleGeometry`
- Top-level variables:
  - `CyclicLines`, `SineLine`, `TimeCycles`, `amplitude`, `count`, `p1`, `p2`, `pts`, `rawAmp`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/dateAndPriceRange.ts`

- Top-level variables:
  - `DateAndPriceRange`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/elliottWaves.test.ts`

- Functions:
  - `makeDrawing`, `makePoint`
- Top-level variables:
  - `draft`, `drawing`, `geo`, `next`, `points`, `scales`, `start`, `updated`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/elliottWaves.ts`

- Functions:
  - `calculateElliottWaveGeometry`, `makeElliottTool`
- Top-level variables:
  - `ELLIOTT_LABELS`, `ELLIOTT_POINT_COUNT`, `ElliottCorrection`, `ElliottDoubleCombo`, `ElliottImpulse`, `ElliottTriangle`, `ElliottTripleCombo`, `labels`, `pixels`, `pointCount`, `waveType`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/extendedLine.ts`

- Top-level variables:
  - `ExtendedLine`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/fibArc.ts`

- Functions:
  - `calculateFibArcGeometry`
- Top-level variables:
  - `DEFAULT_FIB_ARC_LEVELS`, `FibArc`, `baseRadius`, `center`, `levels`, `reference`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/fibExtended.test.ts`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`, `draft`, `geo`, `points`, `scales`, `start`, `updated`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/fibExtended.ts`

- Functions:
  - `calculateFibExtendedGeometry`, `createTool`
- Top-level variables:
  - `FIB_EXTENDED_LEVELS`, `FIB_FAN_RATIOS`, `FibChannel`, `FibCircles`, `FibSpeedResistanceArcs`, `FibSpeedResistanceFan`, `FibSpiral`, `FibWedge`, `Pitchfan`, `THREE_POINT`, `TWO_POINT`, `TrendBasedFibTime`, `p1`, `p2`, `p3`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/fibExtension.ts`

- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_CONFIGS`, `FibExtension`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/fibonacci.ts`

- Top-level variables:
  - `DEFAULT_FIB_LEVEL_CONFIGS`, `Fibonacci`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/fibTimeZone.ts`

- Functions:
  - `calculateFibTimeZoneGeometry`
- Top-level variables:
  - `DEFAULT_FIB_TIME_ZONE_LEVELS`, `FibTimeZone`, `end`, `levels`, `start`, `stepX`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/gannAdvanced.test.ts`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`, `draft`, `geo`, `h`, `points`, `scales`, `updated`, `w`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/gannAdvanced.ts`

- Functions:
  - `calculateGannAdvancedGeometry`
- Top-level variables:
  - `GANN_FRACTIONS`, `GannBox`, `GannSquare`, `GannSquareFixed`, `p1`, `p2`, `side`, `size`, `sizeInPx`, `x2`, `y2`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/gannFan.ts`

- Functions:
  - `calculateGannFanGeometry`, `clampToBoundary`
- Top-level variables:
  - `GANN_RATIOS`, `GannFan`, `dx`, `dy`, `lines`, `t`, `tMax`, `tx`, `ty`, `unitBarX`, `unitPriceY`, `vx`, `vy`, `x2`, `y2`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/harmonicPatterns.test.ts`

- Functions:
  - `makeDrawing`, `makePoint`
- Top-level variables:
  - `draft`, `drawing`, `geo`, `next`, `points`, `scales`, `start`, `updated`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/harmonicPatterns.ts`

- Functions:
  - `calculateHarmonicPatternGeometry`, `makeHarmonicTool`
- Top-level variables:
  - `CypherPattern`, `HeadAndShoulders`, `PATTERN_HAS_CLOSING_LINE`, `PATTERN_POINT_COUNT`, `PATTERN_POINT_LABELS`, `ThreeDrivesPattern`, `TrianglePattern`, `XabcdPattern`, `hasClosingLine`, `labels`, `patternType`, `pixels`, `pointCount`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/hLine.ts`

- Top-level variables:
  - `HLine`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/longPosition.ts`

- Functions:
  - `calculateRiskReward`
- Top-level variables:
  - `LongPosition`, `updated`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/parallelChannel.ts`

- Functions:
  - `calculateParallelChannelGeometry`
- Top-level variables:
  - `ParallelChannel`, `dx`, `dy`, `end`, `length`, `normal`, `offsetAnchor`, `offsetDistance`, `start`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/pitchfork.ts`

- Functions:
  - `calculatePitchforkGeometry`
- Top-level variables:
  - `Pitchfork`, `leftSwing`, `midpoint`, `pivot`, `rightSwing`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/polyline.ts`

- Top-level variables:
  - `Polyline`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/ray.ts`

- Top-level variables:
  - `Ray`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/rectangle.ts`

- Top-level variables:
  - `Rectangle`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/regressionChannel.ts`

- Functions:
  - `calculateRegressionChannelMetrics`, `toTimeValue`
- Top-level variables:
  - `RegressionChannel`, `barTime`, `bars`, `closes`, `denominator`, `end`, `endPrice`, `endTime`, `endX`, `intercept`, `leftBar`, `meanY`, `n`, `rSquared`, `residuals`, `rightBar`, `slope`, `ssRes`, `ssTot`, `start`, `startPrice`, `startTime`, `startX`, `stdDev`, `sumX`, `sumXX`, `sumXY`, `sumY`, `xs`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/shortPosition.ts`

- Functions:
  - `calculateRiskReward`
- Top-level variables:
  - `ShortPosition`, `updated`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/text.ts`

- Top-level variables:
  - `Text`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/trendLine.ts`

- Top-level variables:
  - `TrendLine`

### `frontend/src/components/vnstockcharts/lib/drawing/builtin/vLine.ts`

- Top-level variables:
  - `VLine`

### `frontend/src/components/vnstockcharts/lib/drawing/clipboard.test.ts`

- Top-level variables:
  - `drawing`, `offset`, `snapshot`

### `frontend/src/components/vnstockcharts/lib/drawing/clipboard.ts`

- Functions:
  - `cloneDrawingSnapshot`, `offsetDrawingByPixels`
- Top-level variables:
  - `now`, `snapshot`

### `frontend/src/components/vnstockcharts/lib/drawing/contextMenu.test.tsx`

- Top-level variables:
  - `button`, `container`, `onClose`, `onSelect`, `reactActEnvironment`, `root`

### `frontend/src/components/vnstockcharts/lib/drawing/contextMenu.tsx`

- Functions:
  - `DrawingContextMenu`, `handleKeyDown`, `resolvePalette`
- Top-level variables:
  - `backdropStyle`, `isCompactViewport`, `itemListStyle`, `overlayStyle`, `palette`, `panelStyle`, `titleStyle`

### `frontend/src/components/vnstockcharts/lib/drawing/coordinateBridge.ts`

- Functions:
  - `buildRenderScalesFromBridge`, `chartPointToPixelWithBridge`, `isFiniteNumber`, `measurementPointToPixelWithBridge`, `resolveChartPointWithBridge`, `resolveMeasurementPointWithBridge`, `resolveReferenceDate`, `resolveReferencePrice`, `toBridgePixel`, `toDate`
- Top-level variables:
  - `bridgeReferencePixel`, `candidates`, `fromBridgePixel`, `pixel`, `pixelOffset`, `referenceDate`, `referencePixel`, `referencePoint`, `referencePrice`, `resolved`

### `frontend/src/components/vnstockcharts/lib/drawing/coordinateUtils.test.ts`

- Top-level variables:
  - `containerRect`, `pixel`, `point`, `scales`

### `frontend/src/components/vnstockcharts/lib/drawing/coordinateUtils.ts`

- Functions:
  - `chartPointToPixel`, `pixelToChartPoint`
- Top-level variables:
  - `localX`, `localY`

### `frontend/src/components/vnstockcharts/lib/drawing/drawing.test.ts`

- Functions:
  - `createTextObject`, `createTrendLineObject`
- Top-level variables:
  - `arrow`, `completeState`, `draft`, `drawing`, `drawingState`, `editingState`, `first`, `history`, `initialHistory`, `movingState`, `nextPoint`, `pushedHistory`, `rectangle`, `redoneHistory`, `resizingState`, `second`, `selectedState`, `serializedDrawing`, `serializedDrawings`, `serializedHistory`, `startPoint`, `text`, `tool`, `toolNames`, `trendLine`, `undoneHistory`, `updatedDraft`, `updatedState`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingActionSurface.ts`

- Functions:
  - `createDrawingContextMenuItems`
- Top-level variables:
  - `items`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingAlerts.test.ts`

- Functions:
  - `makeHLine`
- Top-level variables:
  - `drawing`, `events`, `now`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingDock.tsx`

- Functions:
  - `handleHeaderMouseDown`, `handleMouseMove`, `handleMouseUp`
- Top-level variables:
  - `dragStartRef`, `left`, `resolvedContent`, `top`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingInspector.test.tsx`

- Top-level variables:
  - `buttons`, `cancelButton`, `checkedRadio`, `container`, `drawing`, `editButton`, `extendedRadio`, `flags`, `labels`, `lineTypeLabels`, `onCancel`, `onChange`, `onCommit`, `onStartEdit`, `onUpdate`, `radios`, `reactActEnvironment`, `root`, `saveButton`, `strokeInput`, `textLabels`, `textarea`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingInspector.tsx`

- Functions:
  - `DrawingAlertPanel`, `addNewFibLevel`, `dashPatternFromStyle`, `handleDeleteTemplate`, `handleLoadTemplate`, `handleSaveTemplate`, `isColorString`, `setCondition`, `toggleEnabled`, `updateStyle`, `validateAndMapXCoordinate`
- Top-level variables:
  - `FIB_TOOLS_WITH_LEVEL_CONFIGS`, `T`, `barTime`, `condition`, `configs`, `cooldownSec`, `currentColor`, `currentValue`, `dateVal`, `diff`, `direction`, `effectiveDrawing`, `enabled`, `fieldLabel`, `labelText`, `left`, `locked`, `mappedX`, `minDiff`, `name`, `nearestBar`, `newLevelInputRef`, `next`, `nextPoints`, `parsed`, `pointLabel`, `ratio`, `reward`, `risk`, `rr`, `segStyle`, `segVisible`, `strokeDasharray`, `style`, `tempStyle`, `timeString`, `top`, `updated`, `updatedList`, `val`, `visible`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingInteractionBridge.test.ts`

- Functions:
  - `createBridge`
- Top-level variables:
  - `bridge`, `context`, `hoverContext`, `line`, `plotData`, `resolved`, `snap`, `snapContext`, `trend`, `xScale`, `yScale`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingInteractionBridge.ts`

- Functions:
  - `findHitDrawingWithContext`, `findSnapPointWithContext`, `hitTestDrawingWithContext`, `resolveDrawingInteractionContext`, `resolveDrawingPointWithContext`, `sortVisibleDrawings`
- Top-level variables:
  - `chartPoint`, `offsetX`, `offsetY`, `orderedDrawings`, `renderScales`, `snap`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingLayer.hover.test.tsx`

- Top-level variables:
  - `actual`, `baseChartConfig`, `baseMoreProps`, `capturedProps`, `container`, `drawing`, `interaction`, `momentumChartConfig`, `onToolUsed`, `reactActEnvironment`, `root`, `xScale`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingLayer.test.ts`

- Top-level variables:
  - `line`, `moved`, `nextDrawings`, `position`, `untouched`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingLayer.tsx`

- Functions:
  - `calculatePositionRiskReward`, `constrainResizePoint`, `currentDrawing`, `findHitDrawing`, `getSelectedDrawingId`, `getVisibleDrawings`, `handleKeyDown`, `handleModifierKeyChange`, `handlePointerUp`, `handleSelect`, `isMultiStepTool`, `resetSelectionModifier`, `resizeDrawing`, `resizeDrawingsByIds`, `resolveDrawingInteractionContextForDrawing`, `resolveDrawingInteractionContextFromMoreProps`, `sortVisibleDrawings`, `syncSelectionModifierPressed`, `toDrawingPoint`, `translateDrawing`, `translateDrawingsByIds`, `withChartTranslation`
- Top-level variables:
  - `MEASURE_TOOLS`, `actionHandle`, `allIds`, `anchorIndex`, `anchorPoint`, `barsText`, `base`, `baseChartConfig`, `baseDrawings`, `bridge`, `canDragSelectedDrawing`, `canGroupDrag`, `canvasOptions`, `chartConfig`, `chartCursorClass`, `chartWidth`, `clampChartConfig`, `clampedPoint`, `cloned`, `completed`, `constrainedPoint`, `context`, `ctx`, `ctx2`, `currentChartPoint`, `deltaX`, `deltaY`, `draft`, `draftChartConfig`, `draftObj`, `dragPreviewRef`, `dragSessionRef`, `draggableIds`, `drawToCanvas`, `drawings`, `dx`, `dy`, `finalUpdated`, `handleClick`, `handleContextMenu`, `handleDoubleClick`, `handleDrag`, `handleDragComplete`, `handleDragStart`, `handleHover`, `handleIndex`, `handleMouseDown`, `handleMouseMove`, `handleUnHover`, `hasInvalidPoints`, `hit`, `hoveredSemanticHandleIdxRef`, `interactionRef`, `isHover`, `lastIndex`, `lastMovePropsRef`, `leftHeadroom`, `matchingIds`, `measurement`, `midX`, `midY`, `modifierEvent`, `moreProps`, `nativeClick`, `nativeDown`, `nativeEvent`, `newIdx`, `nextInteriorIdx`, `nextSelectedIds`, `p0`, `p1`, `pctText`, `pendingResizeHandleRef`, `pointerDeviceRef`, `previewDrawings`, `priceDeltaText`, `pt`, `px`, `py`, `rect`, `renderScales`, `resizeCtx`, `resizeHandleIndex`, `resized`, `resolved`, `rightHeadroom`, `rubberBandJustCommittedRef`, `rubberBandRef`, `selectedCursorClass`, `selectedDrawing`, `selectedDrawingId`, `selectedObjectIdSet`, `selectedObjectIds`, `session`, `shouldDisablePan`, `shouldDisablePanOnMouseDown`, `sign`, `snap`, `snapRef`, `startChartPoint`, `startPoint`, `targetIndex`, `tool`, `toolName`, `updated`, `xMax`, `xMaxR`, `xMin`, `xMinR`, `xy`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingListPanel.test.ts`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingListPanel.tsx`

- Functions:
  - `filterDrawings`, `formatTimestamp`, `generateDrawingLabel`, `loadCollapsedGroups`, `renderDrawingItem`, `reorderDrawings`, `saveCollapsedGroups`
- Top-level variables:
  - `STORAGE_KEY`, `TOOL_LABELS`, `customLabel`, `displayedCount`, `existing`, `filteredDrawings`, `fromIdx`, `groupLabel`, `grouped`, `isCollapsed`, `isDragOver`, `isHidden`, `isLocked`, `isSearching`, `isSelected`, `left`, `map`, `next`, `parsed`, `q`, `raw`, `rawType`, `result`, `toIdx`, `toggleGroup`, `toolLabel`, `top`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingSemanticPointLegend.tsx`

- Top-level variables:
  - `isActive`, `pointLabels`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingStorage.test.ts`

- Functions:
  - `createStorageMock`
- Top-level variables:
  - `adapter`, `drawing`, `payload`, `store`

### `frontend/src/components/vnstockcharts/lib/drawing/DrawingStorage.ts`

- Classes:
  - `DrawingImportError`
- Functions:
  - `createLocalStorageAdapter`, `getStorage`, `getStorageKey`, `isCycleParams`, `isDrawingType`, `isFibLevelConfig`, `isHarmonicRatioConfig`, `isPoint`, `isRecord`, `isRiskReward`, `isStyle`, `migrateFibLevelConfigs`, `normalizeDasharray`, `normalizeDrawingObject`, `normalizeDrawings`, `parseAlertCondition`
- Top-level variables:
  - `DEFAULT_DRAWING_STORAGE_KEY_PREFIX`, `DRAWING_TOOL_TYPES`, `converted`, `cooldownMs`, `createdAt`, `direction`, `enabled`, `normalized`, `parsed`, `raw`, `style`, `triggeredAt`, `updatedAt`, `validDirections`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingStyleRegistry.test.ts`

- Top-level variables:
  - `drawing`, `global`, `perDrawing`, `unsubscribeGlobal`, `unsubscribeInstance`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingStyleRegistry.ts`

- Functions:
  - `applyDrawingTemplate`, `clearDrawingStyleOverride`, `clearDrawingStyleOverrides`, `clearDrawingTemplate`, `cloneDrawingStyleOverride`, `dashPatternToStrokeDasharray`, `getDrawingStyleOverride`, `listDrawingStyleOverrides`, `loadDrawingTemplate`, `normalizeDrawingStyleOverride`, `notifyAllDrawingStyleChanges`, `notifyDrawingStyleChange`, `overrideDrawingStyle`, `resolveDrawingStyle`, `saveDrawingTemplate`, `subscribeDrawingStyle`, `subscribeDrawingStyleChanges`, `validateDrawingStyleTemplate`
- Top-level variables:
  - `HEX_COLOR_RE`, `TEMPLATE_STORAGE_KEY_PREFIX`, `current`, `dashPattern`, `drawingStyleChangeListeners`, `drawingStyleListeners`, `drawingStyleOverrides`, `listeners`, `normalized`, `obj`, `override`, `parsed`, `raw`, `result`, `template`, `valid`, `validated`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingTemplate.test.ts`

- Functions:
  - `localStorageMock`
- Top-level variables:
  - `base`, `loaded`, `result`, `saved`, `store`, `style`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingTemplateStorage.ts`

- Functions:
  - `deleteTemplate`, `exportAllTemplates`, `importAllTemplates`, `listTemplates`, `loadTemplate`, `saveTemplate`
- Top-level variables:
  - `all`, `filtered`, `indices`, `key`, `list`, `parsed`, `parts`, `raw`, `templateName`, `toolType`, `validated`

### `frontend/src/components/vnstockcharts/lib/drawing/drawingToolIcons.tsx`

- Top-level variables:
  - `drawingToolIcons`

### `frontend/src/components/vnstockcharts/lib/drawing/engineCompat.ts`

- Functions:
  - `applyCanvasStyle`, `deleteDrawingGroup`, `distanceSquared`, `drawArrowHead`, `drawLine`, `drawRectangle`, `drawText`, `findNearestOverlayEndpointSnap`, `isFiniteNumber`, `measurementPointToPixelFromScales`, `renderOverlayPrimitiveToCanvas`, `resolveDasharray`, `resolveDrawingGroupMemberIds`, `resolveMeasurementPointFromValues`, `summarizeMeasurement`, `toDate`
- Top-level variables:
  - `MAGNET_TOLERANCE`, `angle`, `bestDate`, `bestDistance`, `bestIndex`, `bestMatch`, `candidateDate`, `candidateTime`, `chartHeight`, `chartWidth`, `distance`, `dx`, `dy`, `height`, `left`, `priceDelta`, `size`, `targetTime`, `toleranceSquared`, `top`, `width`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/drawing/evaluateDrawingAlerts.ts`

- Functions:
  - `detectPriceCross`, `evaluateDrawingAlerts`, `isCooldownElapsed`, `resolveReferencePriceForAlert`
- Top-level variables:
  - `DEFAULT_COOLDOWN_MS`, `activeConditions`, `actualDirection`, `cooldown`, `crossedAbove`, `crossedBelow`, `dx`, `fired`, `p1`, `p2`, `refPrice`, `triggered`

### `frontend/src/components/vnstockcharts/lib/drawing/fibLevelManager.test.ts`

- Functions:
  - `makeFibLevelConfigs`, `makeLegacyFibDrawing`
- Top-level variables:
  - `configs`, `corrupted`, `isDuplicate`, `legacyLevels`, `newCfg`, `newRatio`, `original`, `parsed`, `updated`, `value`, `visibleLevels`

### `frontend/src/components/vnstockcharts/lib/drawing/FloatingSelectionToolbar.tsx`

- Functions:
  - `FloatingSelectionToolbar`, `handleMultiColorSelect`, `onMove`, `onUp`, `renderActionButton`, `renderActionIcon`, `renderSemanticPointButtons`, `resolvePalette`
- Top-level variables:
  - `activePrice`, `barStyle`, `base`, `baseStyle`, `btnStyle`, `containerStyle`, `countBadgeStyle`, `divStyle`, `dividerStyle`, `dragHandleStyle`, `dragStartRef`, `effectiveMultiPos`, `effectivePos`, `groupStyle`, `handleDragMouseDown`, `isActive`, `isCompactViewport`, `isDanger`, `lastDrawingIdRef`, `multiBarStyle`, `palette`

### `frontend/src/components/vnstockcharts/lib/drawing/gannFan.test.ts`

- Top-level variables:
  - `chartHeight`, `chartWidth`, `dx`, `dy`, `geometry`, `labels`, `nonPrincipal`, `principal`, `ratio`

### `frontend/src/components/vnstockcharts/lib/drawing/harmonicRatioValidation.ts`

- Functions:
  - `classifyHarmonicDeviation`, `computeHarmonicRatioLabels`, `formatHarmonicRatioLabel`
- Top-level variables:
  - `COLOR_ACCEPTABLE`, `COLOR_NEUTRAL`, `COLOR_OUTSIDE`, `COLOR_WITHIN`, `actual`, `color`, `denominator`, `deviation`, `deviationPct`, `hr`, `label`, `labels`, `legs`, `max`, `min`, `numerator`, `p0`, `p1`, `pts`, `range`, `result`, `sign`, `target`, `targetRatios`

### `frontend/src/components/vnstockcharts/lib/drawing/history.ts`

- Functions:
  - `cloneDrawings`, `createDrawingHistory`, `historyReducer`
- Top-level variables:
  - `nextPast`, `previousPresent`

### `frontend/src/components/vnstockcharts/lib/drawing/hitTest.ts`

- Functions:
  - `distanceToPolyline`, `distanceToSegment`, `getDrawingBoundingBox`, `getResizeHandleIndex`, `getTextBounds`, `hitTestAbcdPattern`, `hitTestActionHandles`, `hitTestChannelLike`, `hitTestDrawing`, `hitTestFibArc`, `hitTestFibTimeZone`, `hitTestFibonacciLike`, `hitTestLineLike`, `hitTestParallelChannel`, `hitTestPitchfork`, `hitTestPositionZones`, `hitTestRayLike`, `hitTestRectangleLike`, `hitTestRegressionChannel`, `isDrawingInRect`, `pathBounds`, `pointInRect`, `toOverlayPrimitive`, `toPixel`
- Top-level variables:
  - `ACTION_HANDLE_RADIUS`, `HIT_TOLERANCE`, `bbox`, `best`, `clipped`, `distance`, `distanceFromCenter`, `dx`, `dy`, `effectiveDrawing`, `end`, `fontSize`, `geo`, `geometry`, `handles`, `height`, `hitRadius`, `leftFork`, `length`, `lengthSquared`, `lower`, `maxX`, `maxY`, `median`, `metrics`, `middle`, `minX`, `minY`, `normal`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `origin`, `overlayPrimitive`, `p`, `pixel`, `pixelDelta`, `pixels`, `point`, `priceDelta`, `primitiveStyle`, `pts`, `pts2`, `px1`, `px2`, `radius`, `rightFork`, `start`, `style`, `t`, `text`, `tolerance`, `upper`, `width`, `x`, `x1`, `x2`, `xL`, `xR`, `xs`, `y`, `y1`, `y2`, `yB`, `yT`, `ys`

### `frontend/src/components/vnstockcharts/lib/drawing/hitTestTolerance.test.ts`

- Functions:
  - `makeHLine`, `makeRectangle`, `makeScales`, `makeText`, `makeTrendLine`, `makeVLine`
- Top-level variables:
  - `allTypes`, `drawing`, `hLine`, `invisible`, `mouseX`, `mouseY`, `now`, `options`, `rectangle`, `scales`, `text`, `vLine`, `xScale`, `yScale`

### `frontend/src/components/vnstockcharts/lib/drawing/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/drawing/liveMeasurement.test.ts`

- Functions:
  - `makeScales`
- Top-level variables:
  - `T0`, `T1`, `T2`, `T3`, `T4`, `T5`, `badScales`, `dates`, `p0`, `p1`, `plotData`, `result`, `scales`

### `frontend/src/components/vnstockcharts/lib/drawing/m3.test.ts`

- Functions:
  - `createSimpleDrawing`
- Top-level variables:
  - `completed`, `dateAndPriceRange`, `deleted`, `draft`, `endPoint`, `extendedLine`, `extendedLineElements`, `fibExtension`, `first`, `flatPoint`, `initial`, `longPosition`, `names`, `options`, `polyline`, `preview`, `ray`, `scales`, `second`, `selected`, `shortPosition`, `startPoint`

### `frontend/src/components/vnstockcharts/lib/drawing/m4.test.ts`

- Functions:
  - `createSimpleDrawing`
- Top-level variables:
  - `abcd`, `drawing`, `endPoint`, `fibArc`, `fibTimeZone`, `metrics`, `midPoint`, `names`, `options`, `parallel`, `pitchfork`, `plotData`, `regression`, `regressionElements`, `scales`, `startPoint`

### `frontend/src/components/vnstockcharts/lib/drawing/measuring.test.ts`

- Top-level variables:
  - `moreProps`, `pixelPoint`, `plotData`, `point`, `summary`, `xScale`, `yScale`

### `frontend/src/components/vnstockcharts/lib/drawing/measuring.ts`

- Functions:
  - `computeLiveMeasurement`, `measurementPointToPixel`, `resolveChartConfig`, `resolveMeasurementPoint`, `summarizeMeasurement`
- Top-level variables:
  - `avgBarMs`, `barCount`, `chartConfig`, `chartConfigList`, `currentItem`, `dateValue`, `dates`, `first`, `last`, `priceDelta`, `pricePct`, `priceValue`, `px0`, `px1`, `t0`, `t1`, `tMax`, `tMin`, `timeDeltaMs`, `totalMs`, `v`, `xValue`

### `frontend/src/components/vnstockcharts/lib/drawing/morePropsCoordinateBridge.test.ts`

- Functions:
  - `createMoreProps`
- Top-level variables:
  - `adjusted`, `drawing`, `moreProps`, `plotData`, `point`, `priceYScale`, `renderScales`, `volumeYScale`, `xScale`

### `frontend/src/components/vnstockcharts/lib/drawing/morePropsCoordinateBridge.ts`

- Functions:
  - `buildRenderScalesFromMoreProps`, `createDrawingCoordinateBridgeFromMoreProps`, `getAdjustedMousePosition`, `getChartConfigList`, `resolveActiveChartConfig`, `resolveBaseChartConfig`, `resolveBridgePixelOffset`, `resolveChartPaneId`, `resolveChartPointDirect`, `resolveChartPointFromMoreProps`, `resolveChartScaleDomain`, `resolveDrawingChartConfig`
- Top-level variables:
  - `adjustedMousePosition`, `barIndex`, `baseChartConfig`, `bridge`, `chartConfigList`, `currentCharts`, `currentMatch`, `dateValue`, `datum`, `domain`, `effectivePoint`, `exactMatch`, `match`, `offset`, `pData`, `paneChartConfigs`, `pixel`, `plotData`, `rawDate`, `renderScales`, `sampleX`, `targetChartConfig`, `xAcc`, `xValue`, `yValue`

### `frontend/src/components/vnstockcharts/lib/drawing/multiSelectBatch.ts`

- Functions:
  - `applyBatchColor`, `applyBatchDelete`, `applyBatchLock`, `applyBatchVisible`, `resolveNextLockState`, `resolveNextVisibleState`
- Top-level variables:
  - `idSet`, `selected`

### `frontend/src/components/vnstockcharts/lib/drawing/priceLabel.test.ts`

- Top-level variables:
  - `coordinate`, `drawing`, `labels`, `markerElements`, `renderedCoordinate`

### `frontend/src/components/vnstockcharts/lib/drawing/priceLabel.tsx`

- Functions:
  - `DrawingPriceLabels`, `addPriceMarker`, `collectPointPriceMarkers`, `isFinitePrice`, `resolveDrawingPriceMarkers`, `resolveFibExtensionMarkers`, `resolveFibonacciMarkers`
- Top-level variables:
  - `effectiveDrawing`, `firstPoint`, `highlightFill`, `labelFill`, `labelStroke`, `labelStrokeWidth`, `labelTextFill`, `lastPoint`, `levels`, `markers`, `normalized`, `priceDelta`, `riskReward`, `seen`

### `frontend/src/components/vnstockcharts/lib/drawing/registry.test.ts`

- Functions:
  - `makePlugin`
- Top-level variables:
  - `first`, `plugin`, `second`, `warn`

### `frontend/src/components/vnstockcharts/lib/drawing/registry.ts`

- Functions:
  - `createDraftFromTool`, `createTool`, `getDrawingPlugin`, `isDrawingToolName`, `listDrawingPlugins`, `listDrawingTools`, `registerDrawingPlugin`, `registerDrawingTool`
- Top-level variables:
  - `_pluginTools`, `draft`, `drawingToolRegistry`, `tool`

### `frontend/src/components/vnstockcharts/lib/drawing/renderCanvas.ts`

- Functions:
  - `applyLineStyle`, `clipSegmentToBox`, `computeBoundingBox`, `drawAbcdPattern`, `drawArrow`, `drawChannel`, `drawCycleTools`, `drawDateAndPriceRange`, `drawElliottWave`, `drawExtendedLine`, `drawFibArc`, `drawFibExtended`, `drawFibTimeZone`, `drawFibonacci`, `drawFilledRect`, `drawGannAdvanced`, `drawGannFan`, `drawHLine`, `drawHarmonicPattern`, `drawLine`, `drawLongPosition`, `drawParallelChannel`, `drawPitchfork`, `drawPolygonFill`, `drawPolyline`, `drawPolylineTool`, `drawPositionZones`, `drawRay`, `drawRectangle`, `drawRegressionChannel`, `drawSelectionHandles`, `drawSemanticPointAffordance`, `drawShortPosition`, `drawStrokedRect`, `drawText`, `drawTextLabel`, `drawTrendLine`, `drawVLine`, `drawYAxisPriceTag`, `extendLineThroughBox`, `numberFormatter`, `renderDrawingActionHandles`, `renderDrawingAlertIcon`, `renderDrawingShape`, `renderDrawingToCanvas`, `renderMeasurementLabel`, `renderRubberBand`, `resolveSemanticPointLabels`, `strokeDasharrayForStyle`, `toPixel`, `toPrimitiveStyle`
- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_LEVELS`, `DEFAULT_FIB_LEVELS`, `FIBS`, `FONT`, `LINE_HEIGHT`, `PADDING`, `PHI`, `abcdPts`, `abcdSegKeys`, `angle0`, `apex`, `badge`, `badgeHeight`, `badgeStyle`, `badgeWidth`, `badgeX`, `badgeY`, `bars`, `base`, `baseRadius`, `bbox`, `bottom`, `boxH`, `boxW`, `bx`, `by`, `canvasH`, `canvasHeight`, `channelDy`, `clipped`, `closingKey`, `closingStyle`, `cx`, `distance`, `dx`, `dy`, `edges`, `effectiveDrawing`, `elliottSegKeys`, `end`, `entryY`, `ext`, `extX`, `extY`, `extensionPrice`, `fill`, `fillAlpha`, `fillColor`, `first`, `fontSize`, `gannSegKeys`, `geo`, `geometry`, `gx`, `gy`, `h`, `halfPeriod`, `handles`, `harmonicLabels`, `headLength`, `headWidth`, `height`, `hrLabels`, `isArcs`, `key`, `label`, `labelX`, `labelY`, `labels`, `last`, `left`, `leftFork`, `length`, `levelStyle`, `levels`, `lineY1`, `lineY2`, `lines`, `lower`, `lx`, `ly`, `maxWidth`, `median`, `metrics`, `midX`, `midY`, `middle`, `nl`, `normal`, `nr`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `offsetY`, `opacity`, `origin`, `p`, `p0`, `p1`, `padX`, `padY`, `percent`, `period`, `pixel`, `pixelDelta`, `pixels`, `point`, `posBC`, `posCD`, `price`, `priceAtRight`, `priceDelta`, `priceDiff`, `px`, `py`, `r`, `r0`, `radius`, `ratio`, `ratioAB`, `ratioBC`, `ratioLabelStyle`, `ratioStyle`, `reward`, `right`, `rightFork`, `ringRadius`, `risk`, `riskReward`, `segKey`, `segKeys`, `segStyle`, `seqKeys`, `slBounds`, `slFill`, `start`, `steps`, `stopY`, `stroke`, `strokeWidth`, `t`, `t0`, `t1`, `tagH`, `tagW`, `tagX`, `tagY`, `targetY`, `text`, `textWidth`, `theta`, `top`, `totalWidth`, `tpBounds`, `tpFill`, `turns`, `tx`, `ty`, `upper`, `ux`, `uy`, `vector`, `vx`, `w`, `width`, `x`, `xs`, `y`, `yAtRight`, `ys`

### `frontend/src/components/vnstockcharts/lib/drawing/renderSvg.test.ts`

- Functions:
  - `createExtendedDrawing`
- Top-level variables:
  - `arrow`, `circleElements`, `drawing`, `elements`, `lineElements`, `options`, `rectangle`, `scales`, `textElements`

### `frontend/src/components/vnstockcharts/lib/drawing/renderSvg.ts`

- Functions:
  - `circleElement`, `clipSegmentToBox`, `extendLineThroughBox`, `interactiveProps`, `lineElement`, `numberFormatter`, `pathElement`, `polygonElement`, `polylineElement`, `rectElement`, `renderAbcdPattern`, `renderArrow`, `renderChannel`, `renderDateAndPriceRange`, `renderDrawingToSvg`, `renderExtendedLine`, `renderFibArc`, `renderFibExtension`, `renderFibTimeZone`, `renderFibonacci`, `renderHLine`, `renderLineWithHandles`, `renderLongPosition`, `renderParallelChannel`, `renderPitchfork`, `renderPolyline`, `renderPositionZones`, `renderRay`, `renderRectangle`, `renderRegressionChannel`, `renderShortPosition`, `renderText`, `renderTrendLine`, `renderVLine`, `selectionHandles`, `strokeDasharrayForStyle`, `textElement`, `toPixel`
- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_LEVELS`, `DEFAULT_FIB_LEVELS`, `abStyle`, `arcs`, `badge`, `badgeProps`, `badgeText`, `bars`, `base`, `baseLineProps`, `bcStyle`, `bottom`, `cdStyle`, `centerStyle`, `clipped`, `dashedStroke`, `distance`, `dx`, `dy`, `edges`, `effectiveDrawing`, `element`, `elements`, `end`, `entryLine`, `entryY`, `extensionPrice`, `fibConfig`, `fill`, `geometry`, `headLength`, `headWidth`, `height`, `labels`, `left`, `leftFork`, `leftForkStyle`, `leftX`, `length`, `levelStroke`, `levels`, `line`, `lineProps`, `lowerStyle`, `median`, `medianStyle`, `metrics`, `middle`, `middleStyle`, `negativeBoundary`, `normal`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `path`, `percent`, `pixel`, `pixelDelta`, `pixels`, `point`, `polygon`, `positiveBoundary`, `price`, `priceDelta`, `primaryStyle`, `primaryVisible`, `px`, `py`, `r`, `ratio`, `ratioAB`, `ratioBC`, `rect`, `regressionElements`, `reward`, `right`, `rightFork`, `rightForkStyle`, `rightX`, `risk`, `riskReward`, `secondaryStyle`, `secondaryVisible`, `slZone`, `slZoneClass`, `start`, `stopLine`, `stopY`, `stroke`, `t0`, `t1`, `targetLine`, `targetY`, `text`, `top`, `tpZone`, `tpZoneClass`, `upperStyle`, `ux`, `uy`, `vector`, `width`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/drawing/rubberBand.test.ts`

- Functions:
  - `makeScales`, `makeTrendLine`
- Top-level variables:
  - `action`, `drawing`, `idle`, `next`, `rect`, `rubberBandState`, `scales`, `selectedMultiple`

### `frontend/src/components/vnstockcharts/lib/drawing/segmentRegistry.ts`

- Functions:
  - `getSegmentKeys`, `hasSubSegments`, `isSegmentVisible`, `resolveSegmentStyle`
- Top-level variables:
  - `SEGMENT_KEYS_BY_TYPE`, `keys`, `override`

### `frontend/src/components/vnstockcharts/lib/drawing/serialization.ts`

- Functions:
  - `deserializeDrawingHistory`, `deserializeDrawingObject`, `deserializeDrawings`, `exportDrawingsJSON`, `importDrawingsJSON`, `migrateDrawings`, `serializeDrawingHistory`, `serializeDrawingObject`, `serializeDrawings`
- Top-level variables:
  - `DRAWING_SCHEMA_VERSION`, `parsed`, `payload`, `result`

### `frontend/src/components/vnstockcharts/lib/drawing/shared.ts`

- Functions:
  - `appendPoint`, `clonePoint`, `createDrawingId`, `createDrawingObject`, `replaceLastPoint`, `replaceNextPoint`, `replacePoint`
- Top-level variables:
  - `defaultDrawingStyle`, `drawingIdSeed`, `now`, `placeholderIndex`, `startPoint`, `targetIndex`

### `frontend/src/components/vnstockcharts/lib/drawing/shortcutMap.test.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/drawing/shortcutMap.ts`

- Functions:
  - `normalizeShortcutKey`, `resolveDrawingShortcut`
- Top-level variables:
  - `DRAWING_SHORTCUTS`, `hasModifier`, `key`

### `frontend/src/components/vnstockcharts/lib/drawing/snap.test.ts`

- Functions:
  - `makeScales`, `makeTrendLine`
- Top-level variables:
  - `drawing`, `scales`, `snap`, `xScale`, `yScale`

### `frontend/src/components/vnstockcharts/lib/drawing/snap.ts`

- Functions:
  - `collectFibLevelSnapCandidates`, `findFibLevelSnap`, `findNearestBar`, `findSnapPoint`, `getDatumDate`, `pickEndpointSnap`, `toDate`
- Top-level variables:
  - `MAGNET_TOLERANCE`, `best`, `bestDist`, `bestDistance`, `bestOhlc`, `candidates`, `date`, `dist`, `distance`, `fibSnap`, `isStrong`, `nearestBar`, `p0y`, `p1y`, `pixelPoint`, `pixelX`, `pixelY`, `price`, `snap`, `value`, `xAccessor`, `xTolerance`, `yTolerance`

### `frontend/src/components/vnstockcharts/lib/drawing/stateMachine.ts`

- Functions:
  - `drawingReducer`, `getSelectedObjectIds`, `isLineFamilyType`, `lineTypeFlagsFor`, `normalizeSelectedObjectIds`, `selectionStateFor`
- Top-level variables:
  - `LINE_FAMILY_TYPES`, `normalized`

### `frontend/src/components/vnstockcharts/lib/drawing/touchStylus.test.ts`

- Functions:
  - `hasPinchGesture`, `resolvePointerDeviceType`
- Top-level variables:
  - `pt`

### `frontend/src/components/vnstockcharts/lib/drawing/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/drawing/uiTokens.ts`

- Functions:
  - `createDrawingUiStyleVars`
- Top-level variables:
  - `DRAWING_UI_TOKENS`

### `frontend/src/components/vnstockcharts/lib/drawing/useCompactViewport.ts`

- Functions:
  - `resolveViewportMatch`, `updateViewportMatch`, `useCompactViewport`
- Top-level variables:
  - `DEFAULT_MAX_WIDTH`

### `frontend/src/components/vnstockcharts/lib/drawing/useDrawingAlertEvaluator.ts`

- Functions:
  - `useDrawingAlertEvaluator`
- Top-level variables:
  - `currentPrice`, `fired`, `lastBar`, `now`, `prevBar`, `prevPriceRef`, `previousPrice`

### `frontend/src/components/vnstockcharts/lib/drawing/useDrawingInteraction.test.ts`

- Functions:
  - `DrawingGroupProbe`, `DrawingInteractionProbe`, `createTrendLineDrawing`, `makeDrawings`, `renderGroupProbe`, `renderInteractionProbe`
- Top-level variables:
  - `completeState`, `container`, `currentInteraction`, `currentRoot`, `d1`, `d2`, `d3`, `deletedSnapshot`, `drawing`, `drawingState`, `nextPoint`, `pushedState`, `reactActEnvironment`, `root`, `selectedSnapshot`, `selectedState`, `snapshot`, `snapshotPoints`, `startPoint`

### `frontend/src/components/vnstockcharts/lib/drawing/useDrawingInteraction.ts`

- Functions:
  - `cloneDrawingPoints`, `createDrawingInteractionState`, `deleteSelectedInteractionState`, `drawingInteractionReducer`, `getSelectedObjectIds`, `isHistoryAction`, `patchDrawing`, `replaceDrawingById`, `useDrawingInteraction`
- Top-level variables:
  - `cancelDrawing`, `deleteGroup`, `deleteSelected`, `didChange`, `nextDrawings`, `nextHistory`, `redo`, `replaceDrawings`, `selectGroup`, `selectObject`, `selectedDrawings`, `selectedObjectIds`, `setSelectedObjects`, `startEditing`, `startMoving`, `startResizing`, `undo`, `updateDrawing`

### `frontend/src/components/vnstockcharts/lib/drawing/useDrawingStorage.ts`

- Functions:
  - `useDrawingStorage`
- Top-level variables:
  - `anchor`, `blob`, `clearAll`, `exportJSON`, `hydratedRef`, `importJSON`, `imported`, `isEnabled`, `loaded`, `payload`, `storage`, `timeoutId`, `url`

### `frontend/src/components/vnstockcharts/lib/drawing/useLongPress.test.ts`

- Functions:
  - `Probe`, `makePointerEvent`, `renderHook`
- Top-level variables:
  - `act`, `cb`, `container`, `createElement`, `createRoot`, `reactActEnvironment`, `root`, `store`, `useLongPress`

### `frontend/src/components/vnstockcharts/lib/drawing/useLongPress.ts`

- Functions:
  - `clearTimer`, `onPointerCancel`, `onPointerDown`, `onPointerMove`, `onPointerUp`, `useLongPress`
- Top-level variables:
  - `callbackRef`, `captured`, `dx`, `dy`, `startPosRef`, `timerRef`

### `frontend/src/components/vnstockcharts/lib/drawing/workspace/selectionToolbar.ts`

- Functions:
  - `clamp`, `createDrawingSelectionToolbarModel`, `resolveDrawingSelectionToolbarPosition`, `resolveNearestVisibleIndex`, `resolvePaneSnapshot`, `resolveScaleDomain`, `resolveVisiblePlotData`, `resolveVisibleTimeBounds`
- Top-level variables:
  - `DEFAULT_TOOLBAR_SIZE`, `EDGE_PADDING`, `VERTICAL_OFFSET`, `bottomY`, `boundedX`, `boundedY`, `centerX`, `distance`, `domain`, `domainEnd`, `domainStart`, `fallbackY`, `filtered`, `indexRatio`, `indexSpan`, `matchedSnapshot`, `nearestDistance`, `nearestIndex`, `nearestVisibleIndex`, `paneBottom`, `paneId`, `paneTop`, `pointPixels`, `preferredPaneId`, `preferredScaleIds`, `preferredY`, `primaryActions`, `scaleDomain`, `secondaryActions`, `snapshot`, `timeBounds`, `timeRatio`, `timeSpan`, `topY`, `value`, `valueSpan`, `visiblePlotData`, `yRatio`

### `frontend/src/components/vnstockcharts/lib/drawing/workspace/useDrawingWorkspaceController.ts`

- Functions:
  - `areDrawingsEqual`, `cloneDrawings`, `getSelectedDrawing`, `useDrawingWorkspaceController`
- Top-level variables:
  - `allDrawings`, `clearClipboard`, `cloneClipboard`, `closeDock`, `copySelected`, `handleStorageLoad`, `initialDrawingsRef`, `interaction`, `isControlled`, `nextDrawings`, `openDock`, `replaceDrawings`, `selectDrawing`, `selectedDrawing`, `selectedIds`, `setDockTab`, `state`, `storage`, `storageAdapter`, `syncingFromExternalRef`

### `frontend/src/components/vnstockcharts/lib/EventCapture.test.tsx`

- Top-level variables:
  - `EventCapture`, `actual`, `capture`, `event`, `nextState`, `node`, `onClick`, `onDoubleClick`, `onMouseDown`, `pointerMock`

### `frontend/src/components/vnstockcharts/lib/EventCapture.tsx`

- Classes:
  - `EventCapture`
- Top-level variables:
  - `className`, `currentCharts`, `dx`, `dxdy`, `dy`, `eSnapshot`, `interactionProps`, `mouseXY`, `newPos`, `normalizedPanConditions`, `pan`, `panConditions`, `rect`, `touchXY`, `win`, `yZoom`, `zoomDir`

### `frontend/src/components/vnstockcharts/lib/GenericChartComponent.tsx`

- Classes:
  - `GenericChartComponent`
- Functions:
  - `GenericChartComponentWrapper`
- Top-level variables:
  - `ALWAYS_TRUE_TYPES`, `canvasOriginX`, `canvasOriginY`, `chartConfig`, `chartContext`, `chartId`

### `frontend/src/components/vnstockcharts/lib/GenericComponent.tsx`

- Classes:
  - `GenericComponent`
- Functions:
  - `getAxisCanvas`, `getMouseCanvas`
- Top-level variables:
  - `aliases`, `contextXScale`, `ctx`, `draggable`, `moreProps`, `newType`, `prevHover`, `proceed`, `style`, `suffix`, `type`

### `frontend/src/components/vnstockcharts/lib/helper/fitDimensions.tsx`

- Classes:
  - `ResponsiveComponent`
- Functions:
  - `getDimensions`, `getDisplayName`
- Top-level variables:
  - `backingStoreRatio`, `context`, `devicePixelRatio`, `dimensions`, `h`, `name`, `node`, `ratio`, `ref`, `w`

### `frontend/src/components/vnstockcharts/lib/helper/fitWidth.tsx`

- Classes:
  - `ResponsiveComponent`
- Functions:
  - `getDisplayName`
- Top-level variables:
  - `backingStoreRatio`, `context`, `devicePixelRatio`, `el`, `name`, `ratio`, `ref`, `w`

### `frontend/src/components/vnstockcharts/lib/helper/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/helper/SaveChartAsImage.ts`

- Top-level variables:
  - `SaveChartAsImage`, `a`, `canvas`, `canvasList`, `context`, `dx`, `dy`, `each`, `image`, `parent`, `rect`

### `frontend/src/components/vnstockcharts/lib/helper/TypeChooser.tsx`

- Classes:
  - `TypeChooser`

### `frontend/src/components/vnstockcharts/lib/indicator/atr.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/baseIndicator.ts`

- Functions:
  - `baseIndicator`
- Top-level variables:
  - `accessor`, `echo`, `fill`, `i`, `id`, `stroke`, `type`

### `frontend/src/components/vnstockcharts/lib/indicator/bollingerBand.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/change.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/compare.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/defaultOptionsForAppearance.ts`

- Top-level variables:
  - `BollingerBand`, `ElderImpulse`, `FullStochasticOscillator`, `MACD`, `themes`

### `frontend/src/components/vnstockcharts/lib/indicator/elderImpulse.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `currEMA`, `currMACDDivergence`, `indicator`, `macdSource`, `mergedAlgorithm`, `newData`, `prevEMA`, `prevMACDDivergence`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/elderRay.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/ema.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/forceIndex.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/heikinAshi.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/indicator/kagi.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/macd.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/pointAndFigure.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/renko.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/rsi.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/sar.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/sma.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/stochasticOscillator.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/tma.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicator/wma.ts`

- Top-level variables:
  - `ALGORITHM_TYPE`, `base`, `indicator`, `mergedAlgorithm`, `underlyingAlgorithm`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/__tests__/ce15.test.ts`

- Functions:
  - `makeBar`
- Top-level variables:
  - `bars`, `result`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/__tests__/ce16.test.ts`

- Functions:
  - `constantBars`, `makeBar`
- Top-level variables:
  - `bars`, `result`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/ao.ts`

- Top-level variables:
  - `AO`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/bbi.ts`

- Top-level variables:
  - `BBI`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/bias.ts`

- Top-level variables:
  - `BIAS`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/bollinger.ts`

- Top-level variables:
  - `BOLLINGER`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/brar.ts`

- Top-level variables:
  - `BRAR`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/cci.ts`

- Top-level variables:
  - `CCI`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/cr.ts`

- Top-level variables:
  - `CR`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/cvd.ts`

- Top-level variables:
  - `CVD`, `cumulative`, `delta`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/dma.ts`

- Top-level variables:
  - `DMA`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/dmi.ts`

- Top-level variables:
  - `DMI`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/ema.ts`

- Top-level variables:
  - `EMA`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/emv.ts`

- Top-level variables:
  - `EMV`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/kdj.ts`

- Top-level variables:
  - `KDJ`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/ma.ts`

- Top-level variables:
  - `MA`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/macd.ts`

- Top-level variables:
  - `MACD`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/mtm.ts`

- Top-level variables:
  - `MTM`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/obv.ts`

- Top-level variables:
  - `OBV`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/psy.ts`

- Top-level variables:
  - `PSY`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/pvt.ts`

- Top-level variables:
  - `PVT`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/roc.ts`

- Top-level variables:
  - `ROC`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/rsi.ts`

- Top-level variables:
  - `RSI`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/sar.ts`

- Top-level variables:
  - `SAR`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/sma.ts`

- Top-level variables:
  - `SMA`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/trix.ts`

- Top-level variables:
  - `TRIX`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/volume.ts`

- Top-level variables:
  - `VOLUME`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/vr.ts`

- Top-level variables:
  - `VR`

### `frontend/src/components/vnstockcharts/lib/indicators/builtin/wr.ts`

- Top-level variables:
  - `WR`

### `frontend/src/components/vnstockcharts/lib/indicators/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/__tests__/CVDIndicator.test.tsx`

- Top-level variables:
  - `data`, `elem`, `props`, `visibleRange`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/__tests__/whaleDetector.test.ts`

- Top-level variables:
  - `data`, `event`, `events`, `threshold`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/__tests__/WhaleMarketBubbleOverlay.test.tsx`

- Functions:
  - `createMockContextValue`
- Top-level variables:
  - `act`, `contextValue`, `createRoot`, `elem`, `events`, `props`, `visibleRange`, `whaleEvent`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/CVDIndicator.tsx`

- Functions:
  - `CVDIndicator`
- Top-level variables:
  - `barHeight`, `barIndex`, `barStartY`, `barWidth`, `barX`, `cvdApprox`, `cvdYScale`, `drawCVD`, `isPositive`, `maxCVD`, `minCVD`, `normalized`, `paddedMax`, `paddedMin`, `rangeCV`, `visibleData`, `zeroY`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/DarkFlowBadge.tsx`

- Functions:
  - `DarkFlowBadge`, `strengthTier`
- Top-level variables:
  - `SIGNAL_LABELS`, `sigLabel`, `tier`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/ExternalCVDOverlay.tsx`

- Functions:
  - `ExternalCVDOverlay`, `drawOverlay`
- Top-level variables:
  - `cvdY`, `draw`, `fillColor`, `grad`, `hi`, `isPositive`, `lastPt`, `lineColor`, `lo`, `maxCvd`, `minCvd`, `padded`, `pts`, `span`, `ySpan`, `zeroY`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/WhaleBubbleOverlay.tsx`

- Functions:
  - `WhaleBubbleOverlay`
- Top-level variables:
  - `alpha`, `bar`, `barDate`, `barsByTimestamp`, `dateValue`, `draw`, `fillColor`, `radius`, `rawRadius`, `strokeColor`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/whaleDetector.ts`

- Functions:
  - `detectWhaleEvents`, `formatVolume`, `formatWhaleEvent`, `getBubbleColor`, `getBubbleRadius`, `getBubbleStrokeColor`
- Top-level variables:
  - `abs`, `buyVol`, `netDelta`, `radiusMap`, `sellVol`, `side`, `sizeCategory`

### `frontend/src/components/vnstockcharts/lib/indicators/overlays/WhaleMarketBubbleOverlay.tsx`

- Functions:
  - `WhaleMarketBubbleOverlay`, `formatBubbleLabel`
- Top-level variables:
  - `abs`, `bar`, `bubbleY`, `candleX`, `candleY`, `close`, `drawBubbles`, `radius`, `visibleEvents`, `volumeLabel`

### `frontend/src/components/vnstockcharts/lib/indicators/registry.test.ts`

- Top-level variables:
  - `bollingerIndicator`, `customIndicator`, `emaIndicator`, `macdIndicator`, `names`, `sampleBars`

### `frontend/src/components/vnstockcharts/lib/indicators/registry.ts`

- Functions:
  - `getIndicator`, `listIndicators`, `normalizeIndicatorName`, `registerIndicator`
- Top-level variables:
  - `indicatorRegistry`

### `frontend/src/components/vnstockcharts/lib/indicators/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/indicators/utils.ts`

- Functions:
  - `aoColorSeries`, `aoSeries`, `bbiSeries`, `biasSeries`, `bollingerSeries`, `brarSeries`, `cciSeries`, `collectNumbers`, `crSeries`, `dmaSeries`, `dmiSeries`, `emaSeries`, `emaSeriesSkipNaN`, `emvSeries`, `isFiniteNumber`, `kdjSeries`, `macdSeries`, `meanAbsoluteDeviationSeries`, `midpointSeries`, `mtmSeries`, `numericExtent`, `obvSeries`, `psySeries`, `pvtSeries`, `risingVolumeColor`, `rocSeries`, `rollingStandardDeviation`, `rsiSeries`, `sarSeries`, `smaSeries`, `smaSeriesSkipNaN`, `trixSeries`, `typicalPriceSeries`, `vrSeries`, `wilderSeries`, `wilderSeriesSkipNaN`, `wrSeries`
- Top-level variables:
  - `adx`, `af`, `ar`, `arDenominator`, `arNumerator`, `average`, `averageGain`, `averageLoss`, `bar`, `boxRatio`, `br`, `brDenominator`, `brNumerator`, `change`, `close`, `closes`, `cr`, `cumulative`, `current`, `currentIndex`, `currentMid`, `d`, `dValue`, `ddd`, `delta`, `denom`, `denominator`, `deviation`, `divisor`, `downMove`, `dx`, `ema1`, `ema2`, `ema3`, `emv`, `ep`, `fast`, `fastEma`, `finiteCount`, `finiteValues`, `gain`, `gainAverage`, `hh`, `highestHigh`, `histogram`, `hm`, `isUpTrend`, `j`, `k`, `ll`, `loss`, `lossAverage`, `lower`, `lowestLow`, `ma12`, `ma24`, `ma3`, `ma6`, `macd`, `mad`, `maxValue`, `mean`, `meanDeviation`, `middle`, `midpoints`, `minValue`, `minus`, `minusDI`, `minusDm`, `movingAverage`, `mtm`, `numerator`, `open`, `plusDI`, `plusDm`, `prevSar`, `previous`, `previousEma`, `previousMid`, `psy`, `queue`, `range`, `relativeStrength`, `removed`, `result`, `rollingSum`, `rsv`, `sar`, `series`, `signal`, `slice`, `slow`, `slowEma`, `sma`, `sma34`, `sma5`, `smoothMinus`, `smoothPlus`, `smoothTr`, `smoothing`, `startIndex`, `tp`, `tr`, `trix`, `up`, `upCount`, `upMove`, `upper`, `variance`, `window`

### `frontend/src/components/vnstockcharts/lib/interactive/Brush.tsx`

- Classes:
  - `Brush`
- Top-level variables:
  - `dashArray`, `height`, `shouldBrush`, `width`, `x`, `x1y1`, `xValue`, `y`

### `frontend/src/components/vnstockcharts/lib/interactive/ClickCallback.tsx`

- Classes:
  - `ClickCallback`

### `frontend/src/components/vnstockcharts/lib/interactive/components/ChannelWithArea.tsx`

- Classes:
  - `ChannelWithArea`
- Functions:
  - `getLines`, `getPath`, `helper`
- Top-level variables:
  - `area`, `ctx`, `line`, `line1`, `line1Hovering`, `line2`, `line2Hovering`, `lines`, `x1`, `x2`, `y1`, `y2`

### `frontend/src/components/vnstockcharts/lib/interactive/components/ClickableCircle.tsx`

- Classes:
  - `ClickableCircle`
- Functions:
  - `helper`
- Top-level variables:
  - `hover`, `r`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/interactive/components/ClickableShape.tsx`

- Classes:
  - `ClickableShape`
- Functions:
  - `helper`
- Top-level variables:
  - `end1`, `end2`, `halfWidth`, `start1`, `start2`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/interactive/components/GannFan.tsx`

- Classes:
  - `GannFan`
- Functions:
  - `getLineCoordinates`, `helper`
- Top-level variables:
  - `bottom`, `ctx`, `dx`, `dy`, `end`, `halfX`, `halfY`, `hovering`, `isWithinLineBounds`, `left`, `line1`, `lineCoods`, `lines`, `oneEighthX`, `oneEighthY`, `oneFourthX`, `oneFourthY`, `oneThirdX`, `oneThirdY`, `pairsOfLines`, `right`, `top`

### `frontend/src/components/vnstockcharts/lib/interactive/components/HoverTextNearMouse.tsx`

- Classes:
  - `HoverTextNearMouse`
- Functions:
  - `helper`
- Top-level variables:
  - `MIN_WIDTH`, `PADDING`, `cx`, `cy`, `numberOrString`, `rect`, `text`, `textMetaData`, `textNode`

### `frontend/src/components/vnstockcharts/lib/interactive/components/InteractiveText.tsx`

- Classes:
  - `InteractiveText`
- Functions:
  - `helper`
- Top-level variables:
  - `rect`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/interactive/components/InteractiveYCoordinate.tsx`

- Classes:
  - `InteractiveYCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `newEdge`, `rect`, `values`, `y`, `yCoord`, `yValue`

### `frontend/src/components/vnstockcharts/lib/interactive/components/LinearRegressionChannelWithArea.tsx`

- Classes:
  - `LinearRegressionChannelWithArea`
- Functions:
  - `edge1Provider`, `edge2Provider`, `helper`
- Top-level variables:
  - `a`, `array`, `b`, `combine`, `ctx`, `dy`, `endIndex`, `hovering`, `line`, `n`, `newy1`, `newy2`, `startIndex`, `stdDev`, `x1`, `x2`, `xSquareds`, `xs`, `xys`, `y1`, `y2`, `yDiffs`, `ys`

### `frontend/src/components/vnstockcharts/lib/interactive/components/MouseLocationIndicator.tsx`

- Classes:
  - `MouseLocationIndicator`
- Top-level variables:
  - `pos`, `x`, `xValue`, `y`, `yValue`

### `frontend/src/components/vnstockcharts/lib/interactive/components/StraightLine.tsx`

- Classes:
  - `StraightLine`
- Functions:
  - `generateLine`, `getLineCoordinates`, `getRayCoordinates`, `getSlope`, `getXLineCoordinates`, `getYIntercept`, `helper`, `isHovering`, `isHovering2`
- Top-level variables:
  - `b`, `end`, `hovering`, `line`, `lineWidth`, `m`, `modLine`, `start`, `x1`, `x2`, `y`, `y1`, `y2`

### `frontend/src/components/vnstockcharts/lib/interactive/components/Text.tsx`

- Classes:
  - `Text`

### `frontend/src/components/vnstockcharts/lib/interactive/DrawingObjectSelector.tsx`

- Classes:
  - `DrawingObjectSelector`
- Top-level variables:
  - `allSelected`, `interactiveNodes`, `interactives`, `item`, `key`, `morePropsForChart`, `objects`, `selected`, `valueArray`, `valuePresent`

### `frontend/src/components/vnstockcharts/lib/interactive/EquidistantChannel.tsx`

- Classes:
  - `EquidistantChannel`
- Top-level variables:
  - `b`, `dy`, `eachAppearance`, `m`, `newChannels`, `overrideIndex`, `tempChannel`, `y`

### `frontend/src/components/vnstockcharts/lib/interactive/FibonacciRetracement.tsx`

- Classes:
  - `FibonacciRetracement`
- Top-level variables:
  - `currentRetracement`, `dx`, `eachAppearance`, `eachHoverText`, `hoverTextWidthDefault`, `newRetracements`, `overrideIndex`

### `frontend/src/components/vnstockcharts/lib/interactive/GannFan.tsx`

- Classes:
  - `GannFan`
- Top-level variables:
  - `eachAppearance`, `newfans`, `overrideIndex`, `tempChannel`

### `frontend/src/components/vnstockcharts/lib/interactive/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/interactive/InteractiveText.tsx`

- Classes:
  - `InteractiveText`
- Top-level variables:
  - `defaultHoverText`, `newText`, `newTextList`, `props`, `selected`, `xyValue`

### `frontend/src/components/vnstockcharts/lib/interactive/InteractiveYCoordinate.tsx`

- Classes:
  - `InteractiveYCoordinate`
- Top-level variables:
  - `draggedAlert`, `newAlertList`, `props`, `selected`

### `frontend/src/components/vnstockcharts/lib/interactive/StandardDeviationChannel.tsx`

- Classes:
  - `StandardDeviationChannel`
- Top-level variables:
  - `eachAppearance`, `eachDefaultAppearance`, `eachHoverText`, `hoverTextDefault`, `newChannels`, `tempLine`

### `frontend/src/components/vnstockcharts/lib/interactive/TrendLine.tsx`

- Classes:
  - `TrendLine`
- Top-level variables:
  - `eachAppearance`, `hoverTextWithDefault`, `newTrends`, `tempLine`

### `frontend/src/components/vnstockcharts/lib/interactive/utils.ts`

- Functions:
  - `getMorePropsForChart`, `getMouseXY`, `getSelected`, `getValueFromOverride`, `isHover`, `isHoverForInteractiveType`, `saveNodeType`, `terminate`
- Top-level variables:
  - `chartConfig`, `hovering`, `interactive`, `mouseXY`, `objects`, `selecedNodes`, `selected`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachEquidistantChannel.tsx`

- Classes:
  - `EachEquidistantChannel`
- Top-level variables:
  - `dx`, `dy`, `hoverHandler`, `line1Edge`, `line2Edge`, `newDy`, `newX1Value`, `newX2Value`, `newY1Value`, `newY2Value`, `x1`, `x2`, `y1`, `y2`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachFibRetracement.tsx`

- Classes:
  - `EachFibRetracement`
- Functions:
  - `helper`, `xyProvider`
- Top-level variables:
  - `dir`, `dragHandler`, `dx`, `dy`, `edge1DragHandler`, `edge2DragHandler`, `firstOrLast`, `hoverHandler`, `interactiveCursorClass`, `interactiveEdgeCursorClass`, `lineType`, `lines`, `newX1Value`, `newX2Value`, `newY1Value`, `newY2Value`, `retracements`, `text`, `x`, `x1`, `x2`, `y`, `y1`, `y2`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachGannFan.tsx`

- Classes:
  - `EachGannFan`
- Top-level variables:
  - `dx`, `dy`, `hoverHandler`, `line1Edge`, `newDy`, `newX1Value`, `newX2Value`, `newY1Value`, `newY2Value`, `x1`, `x2`, `y1`, `y2`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachInteractiveYCoordinate.tsx`

- Classes:
  - `EachInteractiveYCoordinate`
- Top-level variables:
  - `dragProps`, `dy`, `hoverHandler`, `newYValue`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachLinearRegressionChannel.tsx`

- Classes:
  - `EachLinearRegressionChannel`
- Functions:
  - `getNewXY`
- Top-level variables:
  - `currentItem`, `hoverHandler`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachText.tsx`

- Classes:
  - `EachText`
- Top-level variables:
  - `dx`, `dy`, `hoverHandler`, `xValue`, `xyValue`

### `frontend/src/components/vnstockcharts/lib/interactive/wrapper/EachTrendLine.tsx`

- Classes:
  - `EachTrendLine`
- Functions:
  - `getNewXY`
- Top-level variables:
  - `dx`, `dy`, `mouseY`, `newX1Value`, `newX2Value`, `newY`, `newY1Value`, `newY2Value`, `x`, `x1`, `x2`, `y`, `y1`, `y2`

### `frontend/src/components/vnstockcharts/lib/scale/discontinuousTimeScaleProvider.ts`

- Functions:
  - `discontinuousTimeScaleProviderBuilder`, `doStuff`, `evaluateLevel`
- Top-level variables:
  - `calculate`, `currentFormatters`, `date`, `dateAccessor`, `discontinuousIndexCalculator`, `discontinuousIndexCalculatorLocalTime`, `discontinuousTimeScaleProvider`, `finalData`, `i`, `index`, `initialIndex`, `inputDateAccessor`, `inputIndex`, `level`, `mergedData`, `offsetInMillis`, `response`, `row`, `startOf15Minutes`, `startOf30Minutes`, `startOf30Seconds`, `startOf5Minutes`, `startOfDay`, `startOfEighthOfADay`, `startOfHalfDay`, `startOfHour`, `startOfMinute`, `startOfMonth`, `startOfQuarter`, `startOfQuarterDay`, `startOfWeek`, `startOfYear`, `xScale`

### `frontend/src/components/vnstockcharts/lib/scale/evaluator.ts`

- Functions:
  - `canShowTheseManyPeriods`, `extentsWrapper`, `filterData`, `getFilteredResponse`, `getNewEnd`, `showMax`, `showMaxThreshold`, `showMinThreshold`
- Top-level variables:
  - `chartWidth`, `clampedDomain`, `filteredData`, `firstItem`, `lastItem`, `lastItemXValue`, `left`, `log`, `newEnd`, `newLeftIndex`, `newRightIndex`, `newWidth`, `newXScale`, `plotData`, `realInputDomain`, `right`, `width`, `xScale`

### `frontend/src/components/vnstockcharts/lib/scale/financeDiscontinuousScale.ts`

- Functions:
  - `scale`
- Top-level variables:
  - `MAX_LEVEL`, `backingTicks`, `d`, `desiredTickCount`, `distance`, `end`, `inverted`, `leftPoint`, `levelPoint`, `point`, `rightPoint`, `start`, `temp`, `tickValues`, `ticks`, `ticksAtLevel`, `ticksMap`, `ticksSet`, `unsortedTicks`

### `frontend/src/components/vnstockcharts/lib/scale/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/scale/levels.ts`

- Top-level variables:
  - `defaultFormatters`, `levelDefinition`

### `frontend/src/components/vnstockcharts/lib/series/AlternatingFillAreaSeries.tsx`

- Classes:
  - `AlternatingFillAreaSeries`
- Top-level variables:
  - `id1`, `id2`, `style1`, `style2`

### `frontend/src/components/vnstockcharts/lib/series/AreaOnlySeries.tsx`

- Classes:
  - `AreaOnlySeries`
- Top-level variables:
  - `areaSeries`, `d`, `newBase`, `newClassName`

### `frontend/src/components/vnstockcharts/lib/series/AreaSeries.tsx`

- Functions:
  - `AreaSeries`

### `frontend/src/components/vnstockcharts/lib/series/BarSeries.tsx`

- Classes:
  - `BarSeries`
- Functions:
  - `getBars`
- Top-level variables:
  - `bars`, `getBase`, `getFill`, `h`, `offset`, `width`, `widthFunctor`, `x`, `y`, `yValue`

### `frontend/src/components/vnstockcharts/lib/series/BollingerSeries.tsx`

- Classes:
  - `BollingerSeries`

### `frontend/src/components/vnstockcharts/lib/series/CandlestickSeries.tsx`

- Classes:
  - `CandlestickSeries`
- Functions:
  - `drawOnCanvas`, `getCandleData`, `getCandlesSVG`, `getWicksSVG`
- Top-level variables:
  - `candleData`, `d`, `fill`, `height`, `offset`, `ohlc`, `stroke`, `wickStroke`, `width`, `widthFunctor`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/series/CircleMarker.tsx`

- Functions:
  - `Circle`
- Top-level variables:
  - `radius`

### `frontend/src/components/vnstockcharts/lib/series/ElderRaySeries.tsx`

- Classes:
  - `ElderRaySeries`
- Top-level variables:
  - `y`

### `frontend/src/components/vnstockcharts/lib/series/GroupedBarSeries.tsx`

- Classes:
  - `GroupedBarSeries`
- Functions:
  - `postProcessor`

### `frontend/src/components/vnstockcharts/lib/series/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/series/KagiSeries.tsx`

- Classes:
  - `KagiSeries`
- Functions:
  - `drawOnCanvas`, `helper`
- Top-level variables:
  - `begin`, `d`, `dataSeries`, `idx`, `kagi`, `kagiLine`, `last`, `lastPlot`, `pathD`, `paths`, `prevX`

### `frontend/src/components/vnstockcharts/lib/series/LineSeries.tsx`

- Classes:
  - `LineSeries`
- Top-level variables:
  - `d`, `dataSeries`, `hoverProps`

### `frontend/src/components/vnstockcharts/lib/series/MACDSeries.tsx`

- Functions:
  - `MACDSeries`, `yAccessorForDivergence`, `yAccessorForDivergenceBase`, `yAccessorForMACD`, `yAccessorForSignal`
- Top-level variables:
  - `fillConfig`, `strokeConfig`

### `frontend/src/components/vnstockcharts/lib/series/OHLCSeries.tsx`

- Classes:
  - `OHLCSeries`
- Functions:
  - `drawOnCanvas`, `getOHLCBars`
- Top-level variables:
  - `barData`, `barWidth`, `bars`, `classNameFunc`, `ohlc`, `strokeFunc`, `strokeWidth`, `wickNest`, `width`, `x`, `y1`

### `frontend/src/components/vnstockcharts/lib/series/OverlayBarSeries.tsx`

- Classes:
  - `OverlayBarSeries`
- Functions:
  - `getBars`
- Top-level variables:
  - `b`, `bars`, `getBase`, `getClassName`, `getFill`, `h`, `innerBars`, `offset`, `width`, `widthFunctor`, `x`, `xValue`, `y`, `yValue`

### `frontend/src/components/vnstockcharts/lib/series/PointAndFigureSeries.tsx`

- Classes:
  - `PointAndFigureSeries`
- Functions:
  - `drawOnCanvas`, `getColumns`
- Top-level variables:
  - `anyBox`, `boxHeight`, `boxes`, `columnWidth`, `columns`, `width`, `xOffset`

### `frontend/src/components/vnstockcharts/lib/series/RenkoSeries.tsx`

- Classes:
  - `RenkoSeries`
- Functions:
  - `drawOnCanvas`, `getRenko`
- Top-level variables:
  - `candleWidth`, `candles`, `ohlc`, `svgfill`, `width`, `x`

### `frontend/src/components/vnstockcharts/lib/series/RSISeries.tsx`

- Functions:
  - `RSISeries`, `renderClip`
- Top-level variables:
  - `clipId1`, `clipId2`, `defaultOpacity`, `defaultStroke`, `defaultStrokeDasharray`, `defaultStrokeWidth`, `opacityConfig`, `strokeConfig`, `strokeDasharrayConfig`, `strokeWidthConfig`

### `frontend/src/components/vnstockcharts/lib/series/SARSeries.tsx`

- Classes:
  - `SARSeries`
- Top-level variables:
  - `centerX`, `centerY`, `color`, `currentY`, `d`, `hoverProps`, `radius`, `width`, `y`

### `frontend/src/components/vnstockcharts/lib/series/ScatterSeries.tsx`

- Classes:
  - `ScatterSeries`
- Functions:
  - `drawOnCanvas`, `helper`
- Top-level variables:
  - `fill`, `groupedByFill`, `mProps`, `points`, `stroke`

### `frontend/src/components/vnstockcharts/lib/series/SquareMarker.tsx`

- Functions:
  - `Square`
- Top-level variables:
  - `w`, `x`, `y`

### `frontend/src/components/vnstockcharts/lib/series/StackedBarSeries.tsx`

- Classes:
  - `StackedBarSeries`
- Functions:
  - `convertToArray`, `doStuff`, `drawOnCanvas2`, `drawOnCanvasHelper`, `getBars`, `getBarsSVG2`, `identityStack`, `rotateXY`, `stack`, `svgHelper`
- Top-level variables:
  - `appearance`, `array`, `arrays`, `barWidth`, `bars`, `d`, `data`, `ds`, `eachBarWidth`, `fillStyle`, `getBase`, `getClassName`, `getFill`, `groupedByFill`, `h`, `key`, `keys`, `modifiedXAccessor`, `modifiedXScale`, `modifiedYAccessor`, `modifiedYScale`, `newData`, `offset`, `postProcessor`, `response`, `stackFn`, `width`, `widthFunctor`, `y`

### `frontend/src/components/vnstockcharts/lib/series/StochasticSeries.tsx`

- Classes:
  - `StochasticSeries`

### `frontend/src/components/vnstockcharts/lib/series/StraightLine.tsx`

- Classes:
  - `StraightLine`
- Functions:
  - `getLineCoordinates`
- Top-level variables:
  - `lineCoordinates`

### `frontend/src/components/vnstockcharts/lib/series/SVGComponent.tsx`

- Classes:
  - `SVGComponent`

### `frontend/src/components/vnstockcharts/lib/series/TriangleMarker.tsx`

- Functions:
  - `Triangle`, `getFillColor`, `getRotationInDegrees`, `getStrokeColor`, `getTrianglePoints`
- Top-level variables:
  - `directionVal`, `fillColor`, `innerHypotenuse`, `innerOpposite`, `points`, `rotate`, `rotation`, `rotationDeg`, `strokeColor`, `w`

### `frontend/src/components/vnstockcharts/lib/series/VolumeProfileSeries.tsx`

- Classes:
  - `VolumeProfileSeries`
- Functions:
  - `base`, `drawOnCanvas`, `helper`
- Top-level variables:
  - `allRects`, `begin`, `d`, `directionComparator`, `dx`, `finish`, `histogram2`, `rects`, `sessionBg`, `sessionBgSvg`, `sessionBuilder`, `sessionWidth`, `sessions`, `totalVolume`, `totalVolumeX`, `totalVolumes`, `totalsByDirection`, `values`, `volumeInBins`, `volumeValues`, `w1`, `w2`, `widthValue`, `ws`, `x`, `xScale`

### `frontend/src/components/vnstockcharts/lib/StockChartContext.tsx`

- Functions:
  - `useStockChart`
- Top-level variables:
  - `StockChartContext`, `StockChartProvider`, `context`

### `frontend/src/components/vnstockcharts/lib/tooltip/BollingerBandTooltip.tsx`

- Classes:
  - `BollingerBandTooltip`
- Top-level variables:
  - `currentItem`, `item`, `origin`, `tooltipLabel`, `tooltipValue`, `top`

### `frontend/src/components/vnstockcharts/lib/tooltip/displayValuesFor.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/tooltip/GroupTooltip.tsx`

- Classes:
  - `GroupTooltip`, `SingleTooltip`
- Functions:
  - `orig`
- Top-level variables:
  - `VALID_LAYOUTS`, `comp`, `currentItem`, `dx`, `dy`, `groupTextAnchor`, `singleTooltip`, `textAnchor`, `xPos`, `xyPos`, `yDisplayValue`, `yPos`, `yValue`

### `frontend/src/components/vnstockcharts/lib/tooltip/HoverTooltip.tsx`

- Classes:
  - `HoverTooltip`
- Functions:
  - `backgroundShapeCanvas`, `backgroundShapeSVG`, `calculateTooltipSize`, `drawOnCanvas`, `helper`, `measureText`, `normalizeX`, `normalizeY`, `origin`, `sumSizes`, `tooltipCanvas`, `tooltipSVG`
- Top-level variables:
  - `PADDING`, `X`, `Y`, `bgShape`, `bgSize`, `canvas`, `centerX`, `chartIndex`, `content`, `originX`, `originY`, `pointWidth`, `pointer`, `safePointer`, `startY`, `textY`, `tspans`, `x`, `xValue`, `y`, `yValue`

### `frontend/src/components/vnstockcharts/lib/tooltip/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/tooltip/MACDTooltip.tsx`

- Classes:
  - `MACDTooltip`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `divergence`, `macd`, `macdValue`, `origin`, `signal`

### `frontend/src/components/vnstockcharts/lib/tooltip/MovingAverageTooltip.tsx`

- Classes:
  - `MovingAverageTooltip`, `SingleMAToolTip`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `origin`, `tooltipLabel`, `translate`, `yDisplayValue`, `yValue`

### `frontend/src/components/vnstockcharts/lib/tooltip/OHLCTooltip.tsx`

- Classes:
  - `OHLCTooltip`
- Functions:
  - `defaultDisplay`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `displayDate`, `displayTextsDefault`, `item`, `itemsToDisplay`, `origin`

### `frontend/src/components/vnstockcharts/lib/tooltip/RSITooltip.tsx`

- Classes:
  - `RSITooltip`
- Top-level variables:
  - `currentItem`, `origin`, `rsi`, `tooltipLabel`, `value`

### `frontend/src/components/vnstockcharts/lib/tooltip/SingleValueTooltip.tsx`

- Classes:
  - `SingleValueTooltip`
- Top-level variables:
  - `currentItem`, `origin`, `xDisplayValue`, `yDisplayValue`

### `frontend/src/components/vnstockcharts/lib/tooltip/StochasticTooltip.tsx`

- Classes:
  - `StochasticTooltip`
- Top-level variables:
  - `D`, `K`, `currentItem`, `origin`, `stochastic`

### `frontend/src/components/vnstockcharts/lib/tooltip/ToolTipText.tsx`

- Classes:
  - `ToolTipText`

### `frontend/src/components/vnstockcharts/lib/tooltip/ToolTipTSpanLabel.tsx`

- Functions:
  - `ToolTipTSpanLabel`

### `frontend/src/components/vnstockcharts/lib/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/types/adapter.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/types/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/types/indicator.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/types/ohlcv.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/types/pane.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/utils/accumulatingWindow.ts`

- Top-level variables:
  - `accumulateTill`, `accumulatedWindow`, `accumulatingWindowFn`, `accumulatorIdx`, `d`, `i`, `response`

### `frontend/src/components/vnstockcharts/lib/utils/barWidth.ts`

- Functions:
  - `plotDataLengthBarWidth`, `timeIntervalBarWidth`
- Top-level variables:
  - `first`, `totalWidth`, `width`

### `frontend/src/components/vnstockcharts/lib/utils/ChartDataUtil.ts`

- Functions:
  - `getChartConfigWithUpdatedYScales`, `getChartOrigin`, `getCurrentCharts`, `getCurrentItem`, `getDimensions`, `getNewChartConfig`, `getXValue`, `isArraySize2AndNumber`, `setRange`, `values`, `yDomainFromYExtents`
- Top-level variables:
  - `allYValues`, `another`, `bottom`, `chartHeight`, `chartProps`, `combine`, `currentCharts`, `d`, `domain`, `newYScale`, `obj`, `originCoordinates`, `prevChartConfig`, `realYDomain`, `top`, `updatedChartConfig`, `xValue`, `yDomainDY`, `yDomains`, `yExtents`, `yScale`, `yValues`

### `frontend/src/components/vnstockcharts/lib/utils/identity.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/utils/index.ts`

- Functions:
  - `capitalizeFirst`, `clearCanvas`, `createVerticalLinearGradient`, `d3Window`, `degrees`, `find`, `forOwn`, `functor`, `getClosestItem`, `getClosestItemIndexes`, `getClosestItemIndexes2`, `getClosestValue`, `getLogger`, `getTouchProps`, `head`, `hexToRGBA`, `isDefined`, `isNotDefined`, `isObject`, `last`, `mapObject`, `mapValue`, `mousePosition`, `path`, `radians`, `replaceAtIndex`, `sign`, `tail`, `toObject`, `touchPosition`, `yes`
- Top-level variables:
  - `MOUSEENTER`, `MOUSELEAVE`, `MOUSEMOVE`, `MOUSEUP`, `TOUCHEND`, `TOUCHMOVE`, `b`, `closest`, `container`, `d3win`, `diff`, `first`, `g`, `grd`, `hex`, `index`, `isArray`, `isProduction`, `item`, `key`, `left`, `length`, `lo`, `logger`, `mappedValue`, `mid`, `multiplier`, `object`, `overlayColors`, `props`, `r`, `rect`, `result`, `right`, `value`, `values`

### `frontend/src/components/vnstockcharts/lib/utils/mappedSlidingWindow.ts`

- Top-level variables:
  - `accumulatorIdx`, `mapped`, `mappedSlidingWindowFn`, `result`, `size`, `undef`, `undefinedValue`, `windowData`

### `frontend/src/components/vnstockcharts/lib/utils/merge.ts`

- Functions:
  - `mergeCompute`
- Top-level variables:
  - `algorithm`, `result`, `zip`

### `frontend/src/components/vnstockcharts/lib/utils/noop.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/lib/utils/PureComponent.ts`

- Classes:
  - `PureComponent`

### `frontend/src/components/vnstockcharts/lib/utils/rebind.ts`

- Functions:
  - `createReboundMethod`
- Top-level variables:
  - `method`, `value`

### `frontend/src/components/vnstockcharts/lib/utils/shallowEqual.ts`

- Functions:
  - `isDate`, `isEqual`
- Top-level variables:
  - `numKeysA`

### `frontend/src/components/vnstockcharts/lib/utils/slidingWindow.ts`

- Top-level variables:
  - `accumulatorIdx`, `size`, `slidingWindowFn`, `sourceFunction`, `undef`, `undefinedValue`, `windowData`

### `frontend/src/components/vnstockcharts/lib/utils/strokeDasharray.ts`

- Functions:
  - `getStrokeDasharray`, `getStrokeDasharrayCanvas`
- Top-level variables:
  - `a`, `strokeDashTypes`

### `frontend/src/components/vnstockcharts/lib/utils/timezoneFormatter.ts`

- Functions:
  - `formatWithTimezone`, `getCachedFormatter`, `getGlobalTimezone`, `setGlobalTimezone`
- Top-level variables:
  - `cacheKey`, `d`, `extendedOptions`, `fallbackOptions`, `formatter`, `formatterCache`, `globalTimezone`, `tz`

### `frontend/src/components/vnstockcharts/lib/utils/zipper.ts`

- Functions:
  - `d3_zipLength`, `zip`
- Top-level variables:
  - `combine`, `i`, `m`, `n`

### `frontend/src/components/vnstockcharts/lib/utils/zoomBehavior.ts`

- Functions:
  - `lastVisibleItemBasedZoomAnchor`, `mouseBasedZoomAnchor`, `rightDomainBasedZoomAnchor`
- Top-level variables:
  - `currentItem`, `lastItem`

### `frontend/src/components/vnstockcharts/lib/withContext.tsx`

- Functions:
  - `withChart`, `withChartAndStockChart`, `withStockChart`
- Top-level variables:
  - `chartContext`, `context`, `stockChartContext`

### `frontend/src/components/vnstockcharts/lib/ZoomButtons.tsx`

- Classes:
  - `ZoomButtons`
- Top-level variables:
  - `c`, `centerX`, `cx`, `foo`, `hLength`, `left`, `resetX`, `right`, `textY`, `wLength`, `y`, `zoomIn`, `zoomInX`, `zoomOut`, `zoomOutX`

### `frontend/src/components/vnstockcharts/vendor.d.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/widget/__tests__/VNStockChart.contract.test.tsx`

- Functions:
  - `ThrowingChild`, `createAdapter`, `createDeferred`, `emitPaneHover`, `flushMicrotasks`, `resolveMockForkHoveredPaneId`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `VNStockChart`, `WidgetErrorBoundary`, `WidgetI18nProvider`, `abortSpy`, `act`, `adapter`, `bottom`, `bridge`, `capabilities`, `chartPixel`, `chartPoint`, `chartPointToPixelWithBridge`, `clientX`, `clientY`, `close`, `container`, `createDrawingObject`, `createRoot`, `darkFlowBadge`, `data`, `ema13`, `ema20`, `emaDefault`, `engineHostPropsHistory`, `enginePanes`, `engineSurface`, `fetchDeferred`, `firstAdapter`, `firstFetch`, `forkEngineSnapshots`, `forkRuntimeData`, `getContextSpy`, `handleClick`, `handleContextMenu`, `handleCoordinateBridgeChange`, `handlePaneAddSeriesRequest`, `handlePaneHover`, `handlePaneSnapshotsChange`, `handlePaneToggleSeriesRequest`, `handlePaneToggleVisibleRequest`, `handleRuntimeCapabilitiesChange`, `handleVisibleDomainChange`, `handleVisibleRangeChange`, `host`, `hoveredSnapshot`, `latestHostProps`, `legacyCapabilities`, `legacyChild`, `localX`, `localY`, `measurementOverlay`, `measurementPointToPixelWithBridge`, `mockVisibleRange`, `mountedContainer`, `normalizePaneDescriptorsForExplicitScaleSlots`, `open`, `originalConsoleError`, `overlay`, `paneSnapshots`, `panes`, `pixel`, `point`, `pricePane`, `priceSnapshot`, `promise`, `reactActEnvironment`, `rect`, `ref`, `reject`, `resolve`, `resolveChartPointWithBridge`, `resolveMeasurementPointWithBridge`, `right`, `root`, `secondAdapter`, `secondFetch`, `selectedDrawing`, `seriesData`, `snapshots`, `splitters`, `surface`, `toolbar`, `value`, `widgetRoot`

### `frontend/src/components/vnstockcharts/widget/__tests__/VNStockChart.scaleSlotContract.test.tsx`

- Top-level variables:
  - `normalizedPanes`, `rawFirstSeries`, `rawPanes`

### `frontend/src/components/vnstockcharts/widget/context/__tests__/WidgetI18nContext.test.tsx`

- Functions:
  - `WidgetI18nProbe`
- Top-level variables:
  - `WidgetI18nProvider`, `act`, `container`, `createRoot`, `originalConsoleError`, `probe`, `reactActEnvironment`, `root`, `setLocaleForTest`, `useWidgetI18n`

### `frontend/src/components/vnstockcharts/widget/context/WidgetI18nContext.tsx`

- Functions:
  - `WidgetI18nProvider`, `interpolate`, `isWidgetLocale`, `resolveInitialLocale`, `useWidgetI18n`
- Top-level variables:
  - `WidgetI18nContext`, `defaultValue`, `documentLocale`, `primaryDictionary`, `resolvedLocale`, `secondaryDictionary`, `setLocale`, `t`, `template`, `value`

### `frontend/src/components/vnstockcharts/widget/DrawingPriceLabelsOverlay.tsx`

- Functions:
  - `clamp`, `resolveDrawingSnapshot`, `resolvePreferredScaleSlotId`
- Top-level variables:
  - `anchorPoint`, `effectiveDrawing`, `fillColor`, `highlightFill`, `labelFill`, `markers`, `pixel`, `scaleSlotId`, `side`, `snapshot`, `strokeColor`, `targetedSnapshot`, `textColor`, `top`, `visibleScaleSlotIds`

### `frontend/src/components/vnstockcharts/widget/forkRuntimeCompat.ts`

- Functions:
  - `clamp`, `resolvePaneDataIndexAtPixel`, `resolvePanePixelAtDataIndex`, `resolvePanePixelAtValue`, `resolvePaneValueAtPixel`, `resolvePlotSpan`, `resolveScaleDomain`
- Top-level variables:
  - `domain`, `from`, `height`, `left`, `maxIndex`, `ratio`, `span`, `to`, `top`, `width`

### `frontend/src/components/vnstockcharts/widget/history/chunkStore.ts`

- Functions:
  - `createHistoryChunkStore`, `currentSnapshot`, `makePatch`, `sortAndDedup`
- Top-level variables:
  - `bar`, `barMs`, `bars`, `end`, `existingIdx`, `headCount`, `headMs`, `newBars`, `next`, `out`, `revision`, `sorted`, `tailCount`, `tailIdx`, `tailMs`

### `frontend/src/components/vnstockcharts/widget/history/historyWindowPlanner.ts`

- Functions:
  - `computeMissingSegments`, `computeResidentTarget`, `computeTrimWindow`
- Top-level variables:
  - `hysteresisPadMs`, `rawSpan`, `segments`, `span`

### `frontend/src/components/vnstockcharts/widget/i18n/messages.en.ts`

- Top-level variables:
  - `widgetMessagesEn`

### `frontend/src/components/vnstockcharts/widget/i18n/messages.vi.ts`

- Top-level variables:
  - `widgetMessagesVi`

### `frontend/src/components/vnstockcharts/widget/i18n/types.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/widget/index.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/widget/MeasurementOverlay.tsx`

- Classes:
  - `MeasurementOverlayImpl`
- Functions:
  - `BridgeMeasurementOverlay`, `MeasurementOverlayWithI18n`, `drawMeasurementLabel`, `drawPoint`, `drawRoundedRect`, `formatSignedPrice`, `resolveBridgeMeasurementPoint`, `resolvePaneSnapshotAtPixel`, `resolvePreferredScaleSlotId`
- Top-level variables:
  - `accentColor`, `bottom`, `boxHeight`, `boxWidth`, `boxX`, `boxY`, `canvas`, `canvasRef`, `chartConfig`, `ctx`, `drawOn`, `endPixel`, `handleCommit`, `handlePointerDown`, `handlePointerLeave`, `handlePointerMove`, `hoverPixel`, `hoverPoint`, `labels`, `lineHeight`, `lines`, `nextPoint`, `paddingX`, `paddingY`, `pixelRatio`, `point`, `rect`, `resolveLocalPosition`, `right`, `scaleSlotId`, `selection`, `snapshot`, `startPixel`, `summary`, `visibleScaleSlotIds`

### `frontend/src/components/vnstockcharts/widget/paneNormalization.test.js`

- Top-level variables:
  - `panes`

### `frontend/src/components/vnstockcharts/widget/paneNormalization.ts`

- Functions:
  - `normalizePaneDescriptorsForExplicitScaleSlots`
- Top-level variables:
  - `activeSeries`, `hasLeftAxis`, `hasRightAxis`, `normalizedSeries`, `normalizedType`

### `frontend/src/components/vnstockcharts/widget/VNStockChart.tsx`

- Functions:
  - `arePaneSnapshotsEqual`, `areRuntimeCapabilitiesEqual`, `asTimeValue`, `buildLegacyPaneSnapshots`, `clampIndex`, `computeLoadedHistoryWindow`, `createWidgetCoordinateBridge`, `findNearestDateIndex`, `findPaneSnapshotAtPosition`, `findPlotDataIndex`, `findPlotDataIndexByTime`, `inferAxisSideFromScaleSlotId`, `lookbackDays`, `mergeBarPagesByDate`, `mergeBarsByDate`, `mergePaneSnapshotDomains`, `normalizeForkVisibleRange`, `resetHistorySessionControllerRefs`, `resolveDate`, `resolveDateDomainFromDiscontinuous`, `resolveDiscontinuousXExtents`, `resolveEngineSeriesValueForRuntime`, `resolveFetchWindow`, `resolveHoveredPaneId`, `resolvePreferredScaleSlotId`, `resolveRetentionWindow`, `resolveTimeframeMs`, `resolveVisiblePanes`, `trimBarsToRetentionWindow`
- Top-level variables:
  - `CHART_MARGIN`, `HISTORY_BACKFILL_PAGE_LIMIT`, `HISTORY_RECONCILE_MAX_PAGES`, `NORMALIZED_DEFAULT_PANES`, `PANE_HEADER_HEIGHT`, `VNStockChart`, `VNStockChartContent`, `activeHistoryRequestKey`, `activeHistoryRequestKeyRef`, `activeHistorySessionRevisionRef`, `activeLocale`, `activeSnapshots`, `activeSymbol`, `activeTimeframe`, `adapterLabel`, `afterTimestamp`, `axisStroke`, `axisTickFill`, `barsRef`, `beforeTimestamp`, `bottom`, `buy`, `callbackChanged`, `candidate`, `candidatePanes`, `canonicalStore`, `canvas`, `chartInnerHeight`, `chartPoint`, `chartSurfaceReady`, `columns`, `computedXExtents`, `contentRuntimeKey`, `context`, `controller`, `currentCharts`, `currentHistorySessionRequestKey`, `currentHistorySessionRevision`, `currentState`, `cvdData`, `dataIndex`, `dateFormat`, `datum`, `defaultEnd`, `defaultLegacyVisibleRange`, `defaultStart`, `diff`, `disposed`, `drawingChromeNode`, `drawingWorkspace`, `earliestBar`, `effectiveRuntime`, `emitCoordinateBridge`, `emitHoveredPaneId`, `emitPaneSnapshots`, `endBar`, `endIndex`, `engine`, `engineDataSource`, `engineInstanceRef`, `engineOptions`, `enginePanes`, `engineSeriesData`, `engineTheme`, `enrichedData`, `epoch`, `existingIndex`, `firstBar`, `firstIndexValue`, `forkCoordinateBridge`, `forkDegradeNotifiedRef`, `forkPaneSnapshotsRef`, `forkVisibleRangeRef`, `handleBoundaryError`, `handleEngineReady`, `handleForkClick`, `handleForkContextMenu`, `handleForkVisibleRangeChange`, `handleLegacyVisibleDomainChange`, `handleLegacyVisibleRangeChange`, `handleRuntimeDegraded`, `handleWidgetPointerLeave`, `handleWidgetPointerMove`, `hasExternalData`, `hasLeftAxis`, `hasNewerBars`, `hasOlderBars`, `hasRenderedPixels`, `hasRightAxis`, `headerBottom`, `headerTop`, `height`, `high`, `historyBackfillBeforeRef`, `historyChunkStoreRef`, `historyForwardAfterRef`, `historySession`, `historySessionMode`, `historySessionRef`, `historyWindowSyncInFlightRef`, `hoveredPaneIdRef`, `hoveredSnapshot`, `index`, `isControlledHistorySession`, `isDark`, `lastBar`, `lastDataIndex`, `lastDrawingWorkspaceSubscriberRef`, `lastEmittedDrawingWorkspaceRef`, `lastEmittedPaneSnapshotsRef`, `lastIndex`, `lastPaneSnapshotsSubscriberRef`, `lastRuntimeCapabilitiesRef`, `lastRuntimeCapabilitiesSubscriberRef`, `latestBar`, `latestDrawingWorkspaceSubscriberRef`, `left`, `leftBounds`, `legacyChartScale`, `legacyCoordinateBridge`, `legacyPaneSnapshots`, `liveResidentTarget`, `liveVisibleSpanMs`, `loadedWindow`, `localX`, `localY`, `low`, `mapped`, `matchedValue`, `mergedSnapshots`, `mid`, `midTime`, `minDiff`, `missingSegments`, `nearestIdx`, `needsLeftFill`, `needsRightFill`, `newerBars`, `nextPanes`, `nextVisibleDomain`, `nextWorkspace`, `normalizedRange`, `normalizedVisibleRange`, `olderBars`, `oneDay`, `pagesLoaded`, `paneHeights`, `paneSnapshotMap`, `paneSplitterNodes`, `paneToolbarNodes`, `pendingVisibleDomainRef`, `pixel`, `plotData`, `plotWidth`, `previousTheme`, `priceFormat`, `progressed`, `queueVisibleHistoryWindowSync`, `rawEndIndex`, `rawStartIndex`, `ready`, `reconcileVisibleHistoryWindow`, `rect`, `refreshedWindow`, `requestKey`, `requestedRuntime`, `resolveForkEventPayload`, `resolveWidgetChartPoint`, `resolveWidgetPointPixel`, `resolvedDomain`, `resolvedLegacyVisibleRange`, `resolvedResidentTarget`, `resolvedScaleSlotId`, `resolvedSelectedDrawing`, `resolvedTheme`, `resolvedVisibleDomain`, `resolvedVisibleSpanMs`, `resolvedXExtents`, `retentionWindow`, `right`, `rightBounds`, `root`, `rows`, `runtimeCapabilities`, `safeXAccessor`, `scaleProvider`, `scaleSlotBounds`, `scaleSlotDomains`, `scaleSlotIds`, `scaleSlotStates`, `scaled`, `scaledData`, `scaledXAccessor`, `sell`, `series`, `seriesId`, `seriesValuesById`, `sessionRevision`, `snapshot`, `snapshotTop`, `snapshotsChanged`, `spanMs`, `startBar`, `startIndex`, `subscriberChanged`, `targetTz`, `targetWindow`, `themeState`, `timer`, `timestamp`, `to`, `top`, `trimmedBars`, `ts`, `unsubscribe`, `useForkRuntime`, `value`, `values`, `visibleDomain`, `visibleDomainRef`, `visibleEndMs`, `visiblePanes`, `visibleScaleSlotIds`, `visibleSpanMs`, `visibleStartMs`, `volumeFormat`, `whaleEvents`, `workingBars`, `x`, `y`

### `frontend/src/components/vnstockcharts/widget/WidgetEmptyState.tsx`

- Functions:
  - `WidgetEmptyState`
- Top-level variables:
  - `copy`

### `frontend/src/components/vnstockcharts/widget/WidgetErrorBoundary.tsx`

- Classes:
  - `WidgetErrorBoundary`

### `frontend/src/components/watchlist/PriceAlertModule.jsx`

- Top-level variables:
  - `matched`

### `frontend/src/components/watchlist/SmartRadarTable.jsx`

- Functions:
  - `QuickAlertPopover`, `StrategyFilterBar`, `TableHeader`, `handleSubmit`, `usePriceFlash`
- Top-level variables:
  - `FlashPriceCell`, `STRATEGY_FILTERS`, `TrackedRow`, `cols`, `current`, `flashClass`, `isActive`, `prev`, `prevPriceRef`, `price`, `showIndicators`, `timer`, `totalCols`

### `frontend/src/components/watchlist/WatchlistCells.jsx`

- Functions:
  - `ChangeCell`, `Ma20DistCell`, `PctCell`, `RsiCell`, `RvolCell`, `SparklineCell`
- Top-level variables:
  - `badge`, `color`, `colorClass`, `isDown`, `isHigh`, `isNear`, `isPos`, `isUp`, `max`, `min`, `num`, `pts`, `range`, `stroke`, `valid`, `x`, `y`

### `frontend/src/components/watchlist/WatchlistManagementPanel.jsx`

- No parseable top-level symbols found

### `frontend/src/components/WhaleAnalytics.degraded.test.jsx`

- Top-level variables:
  - `ActualWhaleBubbleChart`

### `frontend/src/components/WhaleAnalyticsAdvisoryModal.jsx`

- Functions:
  - `formatConfidence`, `handleRefresh`, `load`
- Top-level variables:
  - `active`, `firstSummary`, `normalizedSymbol`, `numericValue`, `payload`, `response`

### `frontend/src/components/WhaleAnalyticsTab.jsx`

- Top-level variables:
  - `TIMEFRAME_OPTIONS`, `availableSymbols`, `degradedBadgeLabel`, `isDegraded`, `isStale`, `smfi`, `sourceSymbols`, `staleReason`, `strength`, `symbols`

### `frontend/src/components/WhaleBubbleChart.jsx`

- Functions:
  - `applyThreshold`, `buildEndLabel`, `buildHoverPanelData`, `buildPriceContextSeries`, `formatAxisTime`, `formatBubbleThresholdLabel`, `formatCompactSignedValue`, `formatCurrentQuotePrice`, `formatOverlayPrice`, `formatPanelSeriesValue`, `formatPanelTimestamp`, `formatSpeedValue`, `formatTooltipMoney`, `formatTooltipPriceDelta`, `getDegradedModeCopy`, `getPanelLineItems`, `getSeriesPointTimestampMs`, `handleExportCSV`, `renderPercentileBar`, `resolveCurrentQuotePrice`, `sliderValueToThreshold`, `thresholdToSliderValue`
- Top-level variables:
  - `BUBBLE_FILTER_PRESETS`, `COLORS`, `MAX_BUBBLE_FILTER_THRESHOLD`, `MIN_BUBBLE_FILTER_THRESHOLD`, `TIMEFRAME_OPTIONS`, `WHALE_BUBBLE_UPGRADE_ENABLED`, `a`, `absValue`, `all`, `allBubbles`, `availableSymbols`, `avg`, `billionValue`, `blob`, `bottomGrid`, `bubbleSeries`, `bubbles`, `buyStrengthAtBucket`, `buyStrengthByTimestamp`, `candidates`, `chartInstance`, `chartOption`, `clampedThreshold`, `clampedValue`, `csvHeaders`, `csvRows`, `currentQuotePrice`, `cvdMap`, `cvdVal`, `date`, `degradedModeCopy`, `echartsRef`, `epochSec`, `error`, `exponent`, `fallback`, `fetchOrders`, `flowBuyStrengthSeries`, `flowCvdNegSeries`, `flowCvdPosSeries`, `flowCvdSeries`, `flowData`, `flowSellStrengthSeries`, `flowSeries`, `flowSpeedSeries`, `flowStrengthSeries`, `hasAnyChartData`, `hasAnyFlowData`, `infoPanelLineItems`, `institutionalStrengthAtBucket`, `institutionalStrengthByTimestamp`, `isDegradedMode`, `isValue`, `latestBubbleWithBaseline`, `latestBuyStrengthPoint`, `latestCvdPoint`, `latestInstitutionalStrengthPoint`, `latestPricePoint`, `latestSpeedPoint`, `layeredBubblePoints`, `leftSize`, `levelValue`, `loading`, `logMax`, `logMin`, `maData`, `message`, `meta`, `normalized`, `numericSlider`, `numericThreshold`, `numericValue`, `onEvents`, `orderData`, `overlayConfigs`, `pointValue`, `priceAtBucket`, `priceByTimestamp`, `priceContextSeries`, `priceContextTimeline`, `priceLineSeries`, `rawThreshold`, `rawValue`, `response`, `rightSize`, `series`, `sessionLevels`, `setSymbol`, `setTimeframe`, `sideLabel`, `sign`, `snapshot`, `sourceSymbols`, `speedAtBucket`, `speedByTimestamp`, `staleReason`, `symbol`, `symbols`, `syncValueMs`, `timeframe`, `timeframeWindow`, `timestampMs`, `timestampSec`, `timestamps`, `tooltipFormatter`, `topGrid`, `totalOrders`, `url`, `visibleBubbleCount`, `visibleBubbleGroups`, `window`, `windowSize`, `yAxisLabel`, `yDataKey`

### `frontend/src/components/WhaleBubbleChart.sync.test.jsx`

- Functions:
  - `buildWhaleSnapshot`, `createAbortableSnapshotQueue`, `handleAbort`
- Top-level variables:
  - `ReactLocal`, `abortError`, `abortSignal`, `actual`, `mockReactEChartsCore`, `promise`, `rejectPromise`, `request`, `requests`, `resolvePromise`, `routerFuture`, `startIso`, `totalOrdersLabel`

### `frontend/src/components/WhaleBubbleChart.tooltip.test.jsx`

- Functions:
  - `t`
- Top-level variables:
  - `formatter`, `html`

### `frontend/src/components/WhaleFeedPanel.jsx`

- Functions:
  - `AlertFeedCard`, `WhaleFeedPanel`, `buildFeedEventKey`, `fmtBil`, `fmtPrice`, `fmtVol`, `inSessionWindow`, `matchesTradeDate`, `normalizeEventTimestamp`, `severityLabel`, `severityTone`, `sizeClassEmoji`
- Top-level variables:
  - `SESSION_WINDOWS`, `activeData`, `alertKind`, `cancelled`, `count`, `d`, `dd`, `dedupedHistoryOrders`, `dedupedOrders`, `endMin`, `eventId`, `feedViewportStyle`, `fetch`, `h`, `handleRefresh`, `isBig`, `isBuy`, `isControlled`, `isDarkFlow`, `key`, `keys`, `loading`, `m`, `matchedValue`, `mm`, `n`, `normalizedSeverity`, `orders`, `parsed`, `prevCountRef`, `realtimeEventKeys`, `realtimeItems`, `resp`, `roundedMatchedValue`, `seen`, `severity`, `severityClass`, `side`, `sourceMeta`, `src`, `startMin`, `timestamp`, `totalMin`, `unique`, `vn`, `w`, `yyyy`

### `frontend/src/components/WhaleFeedPanel.test.jsx`

- No parseable top-level symbols found

### `frontend/src/context/AbilityContext.js`

- Functions:
  - `createAbilityFromRules`, `useAbility`
- Top-level variables:
  - `AbilityContext`

### `frontend/src/context/InterfaceContext.jsx`

- Functions:
  - `InterfaceProvider`, `toggleModernLeftSidebar`, `toggleUiMode`, `useInterface`
- Top-level variables:
  - `InterfaceContext`, `context`, `saved`

### `frontend/src/context/LangContext.jsx`

- Functions:
  - `LangProvider`, `getInitialLocale`, `useI18n`
- Top-level variables:
  - `LANG_STORAGE_KEY`, `LangContext`, `context`, `localeTag`, `nextLocale`, `setLanguage`, `t`, `value`

### `frontend/src/context/PortfolioContext.jsx`

- Functions:
  - `PortfolioProvider`, `bootstrap`, `shouldSuppressAuthBootstrapError`, `usePortfolio`
- Top-level variables:
  - `PortfolioContext`, `activeRefreshToken`, `authFailed`, `cancelled`, `contextValue`, `createPortfolio`, `createSubAccount`, `ctx`, `deletePortfolio`, `deleteSubAccount`, `fetchPortfolios`, `hasInitialTokens`, `initialAccessToken`, `initialRefreshToken`, `login`, `logout`, `mePayload`, `message`, `next`, `nextPortfolios`, `nextRefresh`, `ok`, `payload`, `refreshAccessToken`, `register`, `res`, `resendVerification`, `response`, `saveTokens`, `status`, `syncAuthState`, `tokenPayload`, `updatePortfolio`, `updateSubAccount`, `updateUserConfig`

### `frontend/src/context/RealtimeContext.jsx`

- Functions:
  - `RealtimeProvider`, `alerts`, `createConsumerId`, `darkFlowAlerts`, `register`, `toSymbolsKey`, `toUniqueSymbols`, `unregister`, `update`, `useRealtimeFeedFromManager`
- Top-level variables:
  - `RealtimeContext`, `aggregatedSymbols`, `baseFeed`, `consumerCount`, `consumerIdRef`, `contextValue`, `dedupSavedSymbols`, `feed`, `maxAlerts`, `next`, `normalizedSymbols`, `pollInterval`, `quotesBySymbol`, `requestedSymbolCount`, `symbolsKey`, `union`, `value`, `values`

### `frontend/src/hooks/useAIAdvisor.js`

- Functions:
  - `loadAiConfig`, `resolveScoringPolicy`, `totalValue`
- Top-level variables:
  - `DEFAULT_AI_CONFIG`, `SCORING_POLICY_REGISTRY`, `SCORING_POLICY_VERSION`, `action`, `allSymbolsSet`, `cancelled`, `h`, `holdingMap`, `indicators`, `logics`, `ma20Dist`, `promptConfig`, `reasons`, `recommendations`, `response`, `rsi`, `score`, `sourceCfg`, `strategyParams`, `symbol`, `tech`, `techs`, `weight`, `whaleAlertCounts`, `whaleCount`

### `frontend/src/hooks/useAlertCenterFeed.js`

- Functions:
  - `fetchUnifiedPage`, `fmtBil`, `formatNumberSafe`, `goToFirstUnifiedPage`, `goToLastUnifiedPage`, `goToNextUnifiedPage`, `goToPreviousUnifiedPage`, `localizeUnifiedDetail`, `localizeUnifiedHeadline`, `normalizeAlertText`, `normalizeSeverity`, `normalizedAlerts`, `passesSeverity`, `toStableAlertTimestamp`
- Top-level variables:
  - `DEFAULT_ALERT_CENTER_FEED_PAGE_SIZE`, `aScore`, `activeStack`, `alertSummary`, `bScore`, `base`, `current`, `cursor`, `filteredUnifiedAlerts`, `formattedValue`, `hasMore`, `holdingsSet`, `hotSymbols`, `incoming`, `intervalId`, `lastKnownIndex`, `loadMoreUnifiedSnapshot`, `localUnifiedAlerts`, `mappings`, `mergedMap`, `mergedUnifiedAlerts`, `messageCandidate`, `monitoredKey`, `nextCursor`, `normalized`, `normalizedDetail`, `normalizedHeadline`, `normalizedSeverity`, `priceShockMatch`, `quoteList`, `rawValue`, `resetStack`, `response`, `severity`, `severityDiff`, `severityRank`, `source`, `staleMatch`, `summary`, `symbol`, `symbolMap`, `text`, `timeDelta`, `timeDiff`, `trackedSet`, `translated`, `ts`, `unifiedAlerts`, `v`, `value`, `whaleValueMatch`

### `frontend/src/hooks/useDashboardAlerts.js`

- Functions:
  - `buildPriorityAlerts`, `buildRecentWhaleAlertMap`, `normalizeAlertTimestamp`, `normalizeSymbol`, `recentAlerts`
- Top-level variables:
  - `RECENT_ALERT_WINDOW_MS`, `current`, `deduped`, `key`, `leftSeverity`, `leftTs`, `matchedValue`, `parsedTime`, `priorityAlerts`, `rightSeverity`, `rightTs`, `seen`, `severity`, `side`, `sideSource`, `sizeClass`, `symbol`, `timestamp`, `whaleAlertsBySymbol`

### `frontend/src/hooks/useDashboardAlerts.test.js`

- Top-level variables:
  - `alerts`, `now`, `result`

### `frontend/src/hooks/useOrderBubbleCoordinates.js`

- Functions:
  - `alignPriceUnits`, `baseColorBySide`, `clamp`, `formatTimeFromMinutes`, `formatVND`, `hexToRgba`, `useOrderBubbleCoordinates`
- Top-level variables:
  - `BUBBLE_DIAMETER_PER_BILLION`, `BUBBLE_MAX_DIAMETER`, `BUBBLE_MIN_DIAMETER`, `MARKET_OPEN_HOUR`, `ONE_BILLION_VND`, `b`, `baseAlpha`, `bubble`, `bubbles`, `categorized`, `g`, `hasReferencePrice`, `hours`, `hoverAlpha`, `larger`, `magnitudeGap`, `matchedValue`, `maxVolume`, `minVolume`, `mins`, `normalized`, `normalizedSide`, `orderTime`, `orderVolumes`, `priceNum`, `r`, `rawDiameter`, `rawPriceNum`, `rawRefPriceNum`, `referenceNum`, `sessionStartDate`, `sideHex`, `size`, `smaller`, `strokeAlpha`, `volume`, `volumeNorm`, `xEpoch`, `yPct`, `yVnd`

### `frontend/src/hooks/usePersistentAlertState.js`

- Functions:
  - `loadCriticalSoundEnabled`, `loadMutedSymbols`, `loadReadAlertIds`, `safeParse`
- Top-level variables:
  - `ALERT_SOUND_KEY`, `LEGACY_SOUND_ENABLED_KEY`, `MUTED_SYMBOLS_KEY`, `READ_ALERTS_KEY`, `cleaned`, `isMutedSymbol`, `legacyRaw`, `markAlertAsRead`, `muteSymbolFor30m`, `mutedUntil`, `next`, `normalized`, `now`, `parsed`, `persistMutedSymbols`, `persistReadAlerts`, `raw`, `serialized`, `toggleCriticalSound`, `until`, `value`

### `frontend/src/hooks/usePersistentAlertState.test.js`

- No parseable top-level symbols found

### `frontend/src/hooks/useRealtimeFeed.js`

- Top-level variables:
  - `EMPTY_FEED`, `managedFeed`

### `frontend/src/hooks/useRealtimeFeedCore.js`

- Functions:
  - `cleanup`, `computeNextBackoffMs`, `computeReconnectDelayMs`, `connect`, `decodeJwtPayload`, `getHttpStatus`, `getQuoteBySymbol`, `hydrateQuotes`, `isTokenExpiringSoon`, `isValidQuotePrice`, `mergeQuote`, `normalizeAlert`, `normalizeChangePct`, `normalizeDarkFlowAlert`, `normalizeEventTimestamp`, `normalizePollSymbolCandidates`, `normalizeSymbol`, `nowIso`, `pickPollBatch`, `poll`, `readEventField`, `resolveImpliedChangePct`, `resolveRealtimePollIntervalMs`, `scheduleReconnect`, `sendAction`, `shouldSuppressPollingError`, `start`, `toFiniteNumber`
- Top-level variables:
  - `MAX_WS_SUB_SYMBOLS`, `POLL_BATCH_SIZE`, `STALE_RESYNC_RETRY_MS`, `WS_HEALTHY_MIN_POLL_INTERVAL_MS`, `WS_HEALTHY_POLL_BATCH_SIZE`, `WS_HEALTHY_RECOVERY_BATCH_SIZE`, `WS_HEALTHY_RECOVERY_MIN_CANDIDATES`, `WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS`, `ageSeconds`, `applyAlert`, `applyDarkFlowAlert`, `applyMarketDiscoveryEvent`, `applyTickerUpdate`, `applyTickerUpdateThrottled`, `asFraction`, `asPercent`, `base`, `base64`, `batch`, `bootstrapBatchSize`, `cache`, `cancelled`, `candidateResult`, `circuitOpenUntilRef`, `consecutiveFailuresRef`, `currentAccessToken`, `decoded`, `dedupKey`, `dedupWindowMs`, `delayMs`, `destroyed`, `distanceFraction`, `distancePercent`, `effectiveIntervalMs`, `eventAgeSeconds`, `eventId`, `eventTimestamp`, `existing`, `expSeconds`, `fallbackRatioPct`, `filtered`, `flushTickerUpdates`, `fresh`, `freshToken`, `freshnessSeconds`, `hasOverThreshold`, `hasOverThresholdCandidates`, `hasRecoveryCandidates`, `idx`, `impliedPct`, `inferredFreshness`, `initTimer`, `intervalId`, `isMissing`, `isOffhoursSessionClose`, `isStale`, `jitter`, `lastPollAtRef`, `lastProcessedEventIdsRef`, `latency`, `message`, `next`, `nextAgeSeconds`, `nextAlert`, `nextBackoffMs`, `nextChangePct`, `nextChangePctUnit`, `nextChangeValue`, `nextCurrentPrice`, `nextEvent`, `nextKey`, `nextPrevPrice`, `nextWs`, `normalized`, `normalizedAttempt`, `normalizedChange`, `normalizedCurrent`, `normalizedPayload`, `normalizedPrev`, `normalizedPreviousPct`, `normalizedQuotes`, `normalizedRaw`, `normalizedSymbol`, `normalizedSymbols`, `normalizedTs`, `now`, `numeric`, `ok`, `openUntilTs`, `padded`, `parts`, `payload`, `pendingTickerUpdatesRef`, `pollBackoffMsRef`, `pollBackoffUntilRef`, `pollCandidates`, `pollCursorRef`, `pollIntervalRef`, `pollingTotal`, `quote`, `quotes`, `quotesBySymbolRef`, `realtimeStatusRef`, `reconnectAttemptRef`, `reconnectTimer`, `refreshedToken`, `remaining`, `res`, `shouldSkipDuplicateEvent`, `shouldTryAuthRefresh`, `side`, `size`, `sorted`, `staleCount`, `staleOrMissing`, `staleOverThreshold`, `staleRatioPct`, `start`, `startTimer`, `status`, `symbol`, `symbols`, `symbolsForWs`, `symbolsKey`, `symbolsRef`, `syms`, `targetIntervalMs`, `tickerRafIdRef`, `tickersMap`, `token`, `ts`, `uiRefreshP95Ms`, `update`, `updates`, `ws`, `wsHealthy`, `wsHealthyRef`, `wsUrl`

### `frontend/src/hooks/useRealtimeFeedCore.test.js`

- Top-level variables:
  - `intervalMs`, `result`

### `frontend/src/hooks/useSessionFactsCvdSeries.js`

- Functions:
  - `buildMissingCacheKey`, `getHttpStatus`, `normalizeTradeDate`
- Top-level variables:
  - `fetchPayloads`, `missingKeyCacheRef`, `normalizedInputTradeDatesKey`, `normalizedSelectedTradeDate`, `normalizedSymbol`, `normalizedTradeDates`, `normalizedValue`, `normalizedValues`, `pendingTradeDates`, `rejectedResponse`, `rejectedResponses`, `requestId`, `requestIdRef`, `requestedTradeDates`, `responses`, `sessionFactsWindow`, `status`, `successfulPayloads`, `uniqueTradeDates`

### `frontend/src/hooks/useSessionFactsCvdSeries.test.js`

- Top-level variables:
  - `notFoundError`

### `frontend/src/hooks/useTrustTelemetry.js`

- Top-level variables:
  - `COUNTER_KEY`, `LOG_KEY`, `appendToLocalStorage`, `counters`, `currentCount`, `currentLog`, `detail`, `emit`, `nextLog`, `trackActionAttemptBlocked`, `trackActionChecklistCompleted`, `trackExplainabilityInsufficient`, `trackExplainabilityOpened`, `trackHistoryOpened`, `trackRiskModeChanged`

### `frontend/src/hooks/useUnifiedAlerts.js`

- No parseable top-level symbols found

### `frontend/src/hooks/useWatchlistProcessor.js`

- Functions:
  - `activeGroupSymbols`
- Top-level variables:
  - `MAX_SPARKLINE_BUFFER`, `activeDir`, `activeGroup`, `activeGroupItems`, `activeGroupTrackedCount`, `activeGroupTrackedItems`, `activeGroupUntrackedCount`, `activeKey`, `alertSymbols`, `allRealtimeSymbols`, `buf`, `filteredGroupItems`, `filteredTracked`, `getGroupSortIndicator`, `getSparklinePrices`, `getTrackedSortIndicator`, `group`, `groupCurrentPage`, `groupStats`, `groupTotalPages`, `groupsWithRealtime`, `keyword`, `normalized`, `pagedGroupItems`, `pagedTracked`, `prevDir`, `prevKey`, `price`, `priceAlertsWithRealtime`, `priceHistoryRef`, `rows`, `sortedGroupItems`, `sortedTracked`, `splitIndex`, `start`, `toggleGroupSort`, `toggleTrackedSort`, `tracked`, `trackedCurrentPage`, `trackedStats`, `trackedSymbolMap`, `trackedSymbolSet`, `trackedSymbolsWithRealtime`, `trackedTotalPages`, `trackedWithOverrideCount`, `trackedWithUserDefaultCount`

### `frontend/src/hooks/useWhaleAdvisoryData.js`

- Functions:
  - `buildFallbackSymbolStats`, `normalizeAdvisoryItem`, `onDiscoveryUpdate`, `onInvalidated`, `toList`, `useWhaleAdvisoryData`
- Top-level variables:
  - `ADVISORY_INVALIDATION_EVENT`, `advisories`, `advisory`, `advisoryBySymbol`, `advisoryResp`, `baseline`, `baselineTs`, `candidateSymbols`, `currentTs`, `dataItems`, `fallbackSymbols`, `fetchData`, `fetchDataSnapshot`, `fetchWhaleStats`, `handleDeleteAdvisory`, `handleRefreshAdvisory`, `hasAdvisoryBackedStats`, `holdings`, `interval`, `latest`, `loadNativeSymbolUniverse`, `loadRefreshInfo`, `next`, `resp`, `responses`, `side`, `stats`, `success`, `symbol`, `symbols`, `trackedSymbols`

### `frontend/src/hooks/useWhaleAdvisoryData.test.js`

- Top-level variables:
  - `mockTranslate`

### `frontend/src/hooks/useWhaleAnalyticsData.js`

- Functions:
  - `createEmptyAnalyticsData`, `handleVisibilityChange`, `handleWindowFocus`
- Top-level variables:
  - `fetchData`, `firstRejected`, `includeBaseline`, `intervalId`, `normalizedSnapshots`, `normalizedTradeDate`, `requestId`, `requestIdRef`, `requestedTradeDates`, `requestedTradeDatesKey`, `selectedTradeDate`, `skip`, `snapshot`, `snapshotRes`, `snapshotResults`, `timeframeWindow`

### `frontend/src/hooks/useWhaleAnalyticsData.test.js`

- Functions:
  - `createDeferred`
- Top-level variables:
  - `consoleErrorSpy`, `firstRequest`, `merged`, `normalized`, `normalizedFirst`, `normalizedSecond`, `promise`, `reject`, `resolve`, `secondRequest`, `snapshot`

### `frontend/src/i18n/en.js`

- Top-level variables:
  - `en`

### `frontend/src/i18n/index.js`

- Functions:
  - `createTranslator`, `formatCurrency`, `formatDate`, `formatDateTime`, `formatNumber`, `formatPriceVND`, `formatQuoteInteger`, `formatQuotePrice`, `formatQuoteVolume`, `formatTime`, `getLocaleTag`, `getNestedValue`, `normalizeLocale`
- Top-level variables:
  - `DEFAULT_LOCALE`, `QUOTE_LOCALE_TAG`, `date`, `defaultValue`, `dictionaries`, `dictionary`, `fallbackDictionary`, `hasDefaultValue`, `inThousands`, `localeTags`, `normalized`, `normalizedLocale`, `template`, `vars`, `vnd`

### `frontend/src/i18n/index.test.js`

- Top-level variables:
  - `t`

### `frontend/src/i18n/vi.js`

- Top-level variables:
  - `vi`

### `frontend/src/index.js`

- Top-level variables:
  - `root`

### `frontend/src/pages/admin/tenant/TenantAdminHome.jsx`

- Functions:
  - `InfoRow`, `MetricCard`, `formatQuotaValue`
- Top-level variables:
  - `abilityCount`, `entitlements`, `planLabel`, `quotaCaps`, `quotaCount`, `tenantCanInspect`, `tenantCanManageMembers`, `tenantCanManagePATs`, `tenantCanManageServiceAccounts`, `tenantCanOpen`, `tenantCanReadBilling`, `tenantCanReadUsage`

### `frontend/src/pages/admin/tenant/TenantBilling.jsx`

- Functions:
  - `FieldCard`, `SummaryCard`, `bootstrap`, `formatCurrency`, `formatDate`, `loadData`, `resolveBillingCycleLabel`, `resolveErrorMessage`, `resolveInvoiceStateLabel`, `resolveSubscriptionStatusLabel`
- Top-level variables:
  - `canReadUsage`, `cancelled`, `invoiceStateLabel`, `pastDueCount`, `renewalLabel`, `statusLabel`

### `frontend/src/pages/admin/tenant/TenantCapabilities.jsx`

- Functions:
  - `ListPanel`, `SummaryTile`, `formatQuotaValue`
- Top-level variables:
  - `abilities`, `abilityCount`, `abilityItems`, `accessFlag`, `entitlements`, `quotaCaps`, `quotaCount`, `quotaItems`

### `frontend/src/pages/admin/tenant/TenantMembers.jsx`

- Functions:
  - `SummaryCard`, `bootstrap`, `formatDateTime`, `handleInviteSubmit`, `handleRemoveMember`, `loadData`, `resolveErrorMessage`
- Top-level variables:
  - `canInvite`, `canRead`, `canRemove`, `canRemoveMember`, `cancelled`, `confirmed`, `ownerEmail`, `removableMembers`

### `frontend/src/pages/admin/tenant/TenantMembers.test.jsx`

- Functions:
  - `mockAbility`, `mockTranslations`
- Top-level variables:
  - `inviteButton`, `labels`, `mockCreateTenantInvite`, `mockGetTenantInvites`, `mockGetTenantMembers`, `mockRemoveTenantMember`, `removeButtons`, `user`

### `frontend/src/pages/admin/tenant/TenantPATs.jsx`

- Functions:
  - `SummaryCard`, `bootstrap`, `formatDateTime`, `handleBulkRevoke`, `handleCopyToken`, `handleIssue`, `handleRevoke`, `handleRotate`, `loadData`, `normalizeCommaList`, `normalizeSecretReveal`, `resolveErrorMessage`, `resolvePatSecret`, `toggleSelectAll`, `toggleTokenSelection`
- Top-level variables:
  - `activeCount`, `allCurrentPageSelectableSelected`, `canIssue`, `canRevoke`, `canRotate`, `cancelled`, `confirmed`, `currentPageSelectableTokens`, `isSelected`, `newSelected`, `nextSecretReveal`, `nextSelected`, `nextServiceAccounts`, `nextTokens`, `paginatedTokens`, `response`, `revokedCount`, `rotating`, `rotatingCount`, `secret`, `serviceAccount`, `serviceAccountMap`, `tokenIdsList`, `tokenPrefix`, `tokenValue`, `totalPages`, `visibleTokens`

### `frontend/src/pages/admin/tenant/TenantPATs.test.jsx`

- Functions:
  - `mockTranslations`
- Top-level variables:
  - `labels`, `mockGetTenantPATs`, `mockGetTenantServiceAccounts`, `mockIssueTenantPAT`, `mockRotateTenantPAT`, `tokens`, `user`

### `frontend/src/pages/admin/tenant/TenantServiceAccounts.jsx`

- Functions:
  - `SummaryCard`, `bootstrap`, `formatDateTime`, `handleSubmit`, `loadServiceAccounts`, `normalizeCommaList`, `resolveErrorMessage`
- Top-level variables:
  - `activeCount`, `canCreate`, `cancelled`, `environmentCount`, `response`

### `frontend/src/pages/admin/tenant/TenantUsage.jsx`

- Functions:
  - `SummaryCard`, `UsageBar`, `bootstrap`, `formatDateTime`, `formatNumber`, `loadData`, `resolveErrorMessage`, `resolveRiskLabel`, `resolveToneClass`
- Top-level variables:
  - `canReadBilling`, `cancelled`, `criticalCount`, `entitledAmount`, `quotaByMeterCode`, `quotaSnapshot`, `ratio`, `totalRemaining`, `warningCount`

### `frontend/src/pages/AdminCoreAuditTrace.jsx`

- Functions:
  - `DetailBlock`, `MetricCard`, `Panel`, `ValueRow`, `clearFilters`, `formatDateTimeValue`, `kindLabel`, `loadDetail`, `openNextPage`, `openPrevPage`, `refresh`, `stringifyValue`, `submitFilters`, `toneClasses`
- Top-level variables:
  - `DEFAULT_FILTERS`, `DEFAULT_LIMIT`, `cancelled`, `hasMore`, `isSelected`, `lastFetchedLabel`, `loadAuditRequests`, `nextCursor`, `nextRows`, `nextSnapshot`, `normalized`, `params`, `prevCursor`, `response`, `rows`, `selectedRequest`, `sourceRecord`, `summaryCards`

### `frontend/src/pages/AdminCoreAuditTrace.test.jsx`

- Top-level variables:
  - `detailButtons`, `mockGetCoreOperatorAuditRequestDetail`, `mockGetCoreOperatorAuditRequests`

### `frontend/src/pages/AdminCoreBilling.jsx`

- Functions:
  - `MetricCard`, `Panel`, `ValueRow`, `bootstrap`, `formatCurrency`, `formatDateTime`, `refresh`, `toneClasses`
- Top-level variables:
  - `cancelled`, `commercialSummary`, `currentUsageRisk`, `nextInvoiceDate`, `normalized`, `pastDueMeterCount`, `renewalLabel`, `response`, `securitySummary`, `tenantSummary`, `usageMeters`

### `frontend/src/pages/AdminCoreBilling.test.jsx`

- Top-level variables:
  - `mockGetCoreOperatorTenantDetail`

### `frontend/src/pages/AdminCoreJobs.jsx`

- Functions:
  - `DetailBlock`, `MetricCard`, `Panel`, `ValueRow`, `clearFilters`, `formatDateTimeValue`, `formatPercentValue`, `kindLabel`, `kindTone`, `openNextPage`, `openPrevPage`, `refresh`, `submitFilters`, `toneClasses`
- Top-level variables:
  - `DEFAULT_FILTERS`, `DEFAULT_LIMIT`, `hasMore`, `isSelected`, `jobs`, `lastFetchedLabel`, `loadJobs`, `nextCursor`, `nextJobs`, `nextSnapshot`, `normalized`, `numeric`, `params`, `prevCursor`, `response`, `selectedJob`, `summaryCards`

### `frontend/src/pages/AdminCoreJobs.test.jsx`

- Top-level variables:
  - `detailButtons`, `mockGetCoreOperatorJobs`

### `frontend/src/pages/AdminCoreOverview.jsx`

- Functions:
  - `HealthCard`, `KeyValue`, `MetricCard`, `Panel`, `toneClasses`
- Top-level variables:
  - `aiRuntime`, `degradedComponents`, `healthCards`, `healthy`, `lastFetchedLabel`, `loadOverview`, `normalized`, `overallStatus`, `runtimeKpi`, `sources`, `status`, `summaryCards`, `timerId`

### `frontend/src/pages/AdminCoreOverview.test.jsx`

- Top-level variables:
  - `mockGetCoreOperatorHealth`, `mockGetCoreOperatorOverview`

### `frontend/src/pages/AdminCorePATs.jsx`

- Functions:
  - `MetricCard`, `Panel`, `ValueRow`, `bootstrap`, `clearFilters`, `formatDateTime`, `refresh`, `submitFilters`, `toneClasses`
- Top-level variables:
  - `canIssue`, `canRevoke`, `canRotate`, `cancelled`, `clearedFilters`, `commercialSummary`, `headerTenantLabel`, `isSelected`, `nextServiceAccounts`, `nextTokens`, `normalized`, `securitySummary`, `selectedServiceAccount`, `selectedToken`, `serviceAccount`, `serviceAccountMap`, `tenantSummary`

### `frontend/src/pages/AdminCorePATs.test.jsx`

- Top-level variables:
  - `issueButton`, `mockGetCoreOperatorTenantDetail`, `mockGetCoreOperatorTenantPATs`, `mockGetCoreOperatorTenantServiceAccounts`, `revokeButton`, `rotateButtons`

### `frontend/src/pages/AdminCoreServiceAccounts.jsx`

- Functions:
  - `MetricCard`, `Panel`, `ValueRow`, `bootstrap`, `clearFilters`, `formatDateTime`, `refresh`, `submitFilters`, `toneClasses`
- Top-level variables:
  - `canCreate`, `canUpdate`, `cancelled`, `clearedFilters`, `commercialSummary`, `isSelected`, `listLabel`, `nextServiceAccounts`, `normalized`, `securitySummary`, `selectedServiceAccount`, `tenantSummary`

### `frontend/src/pages/AdminCoreServiceAccounts.test.jsx`

- Top-level variables:
  - `createButton`, `editButton`, `mockGetCoreOperatorTenantDetail`, `mockGetCoreOperatorTenantServiceAccounts`

### `frontend/src/pages/AdminCoreTenants.jsx`

- Functions:
  - `MetricCard`, `Panel`, `ValueRow`, `clearFilters`, `submitFilters`, `toneClasses`
- Top-level variables:
  - `isSelected`, `lastFetchedLabel`, `loadDetail`, `loadRegistry`, `navigate`, `normalized`, `recentActions`, `response`, `selectedCommercial`, `selectedSecurity`, `selectedTenant`, `summaryCards`, `tenants`

### `frontend/src/pages/AdminCoreTenants.test.jsx`

- Top-level variables:
  - `mockGetCoreOperatorTenantDetail`, `mockGetCoreOperatorTenants`

### `frontend/src/pages/AdminCoreUsage.jsx`

- Functions:
  - `MetricCard`, `Panel`, `UsageBar`, `ValueRow`, `bootstrap`, `formatDateTime`, `formatNumber`, `refresh`, `toneClasses`
- Top-level variables:
  - `cancelled`, `commercialSummary`, `criticalCount`, `detail`, `isSelected`, `nextMeters`, `normalized`, `ratio`, `response`, `securitySummary`, `selectedMeter`, `tenantSummary`, `totalRemaining`, `usageRisk`, `warningCount`

### `frontend/src/pages/AdminCoreUsage.test.jsx`

- Top-level variables:
  - `mockGetCoreOperatorTenantDetail`

### `frontend/src/pages/AdminCrawlControl.jsx`

- Functions:
  - `StatusPill`, `handleRun`, `handleStop`
- Top-level variables:
  - `activeRun`, `activeRunByJobId`, `activeRunStatus`, `activeStatuses`, `canRun`, `canStop`, `entry`, `existing`, `fetchAll`, `hasActiveRun`, `interval`, `job`, `jobsData`, `map`, `normalizedStatus`, `runsData`, `sCode`, `started`

### `frontend/src/pages/AiAdvisoryShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`, `location`

### `frontend/src/pages/AICommandCenter.jsx`

- Functions:
  - `AICommandCenter`, `PromptSourceTabs`, `applyAuditFilters`, `applyPromptPreset`, `applyTechnicalPreset`, `buildPromptConfigPreset`, `changePromptSourceLookback`, `clampInt`, `classNames`, `createDefaultPromptConfig`, `createDefaultSourceConfig`, `extractPromptSourceBucket`, `fetchConfig`, `fetchUserRuntimeConfig`, `getSourceDefinition`, `handleModelSelectChange`, `handleProviderChange`, `handleSave`, `loadAuditLogs`, `normalizePromptConfig`, `resetAuditFilters`, `savePromptConfig`, `testConnection`, `togglePromptSource`, `toggleTechnicalIndicator`, `updatePromptConfigSource`
- Top-level variables:
  - `AUDIT_ACTION_OPTIONS`, `AUDIT_PAGE_SIZE`, `DEFAULT_AI_CONFIG`, `DEFAULT_AUDIT_FILTERS`, `PROMPT_SOURCE_DEFINITIONS`, `PROVIDER_MODELS`, `TECHNICAL_INDICATOR_OPTIONS`, `activeSourceCount`, `afterSnapshot`, `apiKey`, `baseConfig`, `beforeSnapshot`, `currentConfig`, `currentPromptConfig`, `currentProvider`, `currentSource`, `definition`, `displayModelValue`, `effectiveRuntimeMessage`, `effectiveRuntimeModel`, `effectiveRuntimeProvider`, `effectiveRuntimeSource`, `enabled`, `eventBasedAdvisoryDisabled`, `eventBasedAdvisoryEnabled`, `eventBasedAdvisoryLabel`, `indicatorCount`, `indicators`, `isCustomModel`, `isSelected`, `legacyStockAdvisory`, `legacyTasks`, `limit`, `models`, `modelsForSelectedProvider`, `nextConfig`, `nextFilters`, `nextIndicators`, `nextModel`, `nextModelVal`, `nextPromptConfig`, `nextProvider`, `nextSource`, `normalized`, `normalizedPromptConfig`, `offset`, `parsed`, `payload`, `rawIndicators`, `rawSource`, `resp`, `responseData`, `runtimePolicySummary`, `runtimeSummaryCards`, `selectedIndicators`, `sourceBucket`, `sourceConfig`, `stockAdvisory`, `totalAuditPages`

### `frontend/src/pages/AICommandCenterShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/DashboardShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/MailConfigShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/modern/ModernDashboard.jsx`

- Functions:
  - `SidebarPanelFallback`, `buildFallbackSparkline`, `flush`, `normalizeSymbol`, `scheduleAuxFetch`, `toArr`
- Top-level variables:
  - `AIAdvisorAlertPanel`, `EXCLUDED_MARKET_GROUPS`, `analyticsResult`, `avgPositionSize`, `base`, `baseSymbolUniverse`, `bulkResp`, `bulkSymbols`, `changePct`, `clearDeferredAuxFetch`, `cp`, `current`, `deferredAuxIdleRef`, `deferredAuxTimerRef`, `delta`, `digestFetchInFlightRef`, `digestResp`, `elapsed`, `fallbackResp`, `fetchData`, `fetchRequestTokenRef`, `heatmapData`, `heatmapSymbols`, `held`, `holdingsMap`, `holdingsRequest`, `industry`, `lastUpdateRef`, `liveHoldings`, `loadAuxiliaryDashboardData`, `monitoredSymbols`, `name`, `nextHoldings`, `nextTracked`, `nextWatchlistGroups`, `nominalSize`, `now`, `pendingQuotesRef`, `prev`, `quote`, `realtimeMarketBreadth`, `requestPortfolioDigest`, `requestToken`, `results`, `sparkline24`, `summaryRequest`, `symbol`, `symbolSet`, `symbolUniverse`, `symbolsSet`, `throttleDelay`, `throttleTimeoutRef`, `toggleSeverityFilterFromSummary`, `totalHeldValue`, `trackedInfo`, `trackedMap`, `trackedSymbolNames`, `unreadUnifiedCount`

### `frontend/src/pages/PackageDashboardHost.jsx`

- Functions:
  - `DashboardPanelFallback`, `buildFallbackSparkline`
- Top-level variables:
  - `AIAdvisorAlertPanel`, `EMPTY`, `EXCLUDED_MARKET_GROUPS`, `avgPositionSize`, `base`, `baseSymbolUniverse`, `changePct`, `cp`, `current`, `delta`, `digestFetchInFlightRef`, `fallbackChangePct`, `handleDataReady`, `heatmapData`, `heatmapSymbols`, `held`, `holdingsMap`, `industry`, `liveHoldings`, `mergedHeatmapData`, `monitoredSymbols`, `name`, `nominalSize`, `numericFallback`, `prev`, `quote`, `realtimeBreadth`, `renderAiPanel`, `renderAlertLane`, `renderDeck`, `renderHeatmap`, `renderStats`, `requestPortfolioDigest`, `response`, `sparkline24`, `symbolUniverse`, `symbolsSet`, `technicalChangeBySymbol`, `totalHeldValue`, `trackedInfo`, `trackedMap`, `trackedSymbolNames`, `unreadUnifiedCount`

### `frontend/src/pages/packageShellHostRuntime.js`

- Functions:
  - `buildFrontendSessionId`, `cloneAbilityRules`, `createPackageShellBootstrapLoader`, `isAdminShellIdentity`, `normalizePackageShellIdentity`, `normalizePackageShellNavigation`, `normalizePackageShellSurfaces`, `packageShellHostFetch`, `shouldAttachApiToken`
- Top-level variables:
  - `abilityRules`, `accessToken`, `bootstrapPayload`, `capabilities`, `hasFrontendIdentity`, `headers`, `isAdminIdentity`, `navigation`, `normalizedIdentity`, `packageShellHostEnv`, `path`, `requestUrl`, `resolvedUrl`, `session`, `sessionSubject`, `surfaces`, `visibleGroups`, `visibleRoutes`

### `frontend/src/pages/PortfolioManagement.jsx`

- Functions:
  - `Badge`, `DeleteConfirmModal`, `PortfolioCard`, `PortfolioFormModal`, `SubAccountFormModal`, `SubAccountList`, `closeModal`, `getSubAccountTypeOptions`, `handleCreatePortfolio`, `handleCreateSA`, `handleDeletePortfolio`, `handleDeleteSA`, `handleSubmit`, `handleUpdatePortfolio`, `handleUpdateSA`, `saTypeColor`
- Top-level variables:
  - `CONFIRM_KEYWORD`, `isEdit`, `loadSubAccounts`, `map`, `match`, `mine`, `parsedMarginRatio`, `res`, `saCount`, `subAccountTypeOptions`, `trimmed`

### `frontend/src/pages/PortfoliosShellHost.jsx`

- No parseable top-level symbols found

### `frontend/src/pages/ResetPassword.jsx`

- Functions:
  - `normalizeErrorMessage`, `submitConfirm`, `submitRequest`
- Top-level variables:
  - `firstEntry`, `isConfirmMode`, `response`, `token`, `tokenErrors`

### `frontend/src/pages/ResetPassword.test.jsx`

- Functions:
  - `renderWithRoute`
- Top-level variables:
  - `mockI18n`, `passwordInputs`

### `frontend/src/pages/Screener.jsx`

- Functions:
  - `ConditionRow`, `ResultsTable`, `RuleEditor`, `addCond`, `deleteCond`, `fmtNum`, `handleDelete`, `handleRun`, `handleSave`, `update`, `updateCond`
- Top-level variables:
  - `EMPTY_COND`, `FIELD_OPTIONS`, `OP_OPTIONS`, `f`, `fKey`, `fieldId`, `loadRules`, `op`, `opId`, `opKey`, `res`, `valueId`

### `frontend/src/pages/SettingsShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/SOCPage.jsx`

- Functions:
  - `SOCPage`, `fetchServices`, `handleDomainChange`
- Top-level variables:
  - `VALID_DOMAINS`, `activeDomain`, `data`, `nextParams`, `pageT`, `panels`, `requestedTab`

### `frontend/src/pages/SOCPage.test.jsx`

- Functions:
  - `LocationProbe`, `renderSOCPage`
- Top-level variables:
  - `location`, `user`

### `frontend/src/pages/StockDetail.jsx`

- Functions:
  - `BreadthMiniPanel`, `FinancialMetricsPanel`, `IntradayMatchedPanel`, `MetricRow`, `PriceDepthPanel`, `_getDefaultPromptConfig`, `_normalizeAdvisoryPromptConfig`, `advisoryActionLabel`, `advisoryGovernanceEndpointLabel`, `advisoryGovernanceReasonLabel`, `advisoryPromptSourceLabel`, `advisoryRetryOutcomeBadgeClass`, `advisoryRetryOutcomeLabel`, `advisoryRiskLabel`, `advisoryStatusLabel`, `advisorySynthesisPreferenceLabel`, `biasMeta`, `buildFactsFirstFlowCompareSeries`, `buildKlineFactsFirstFlowData`, `emitAdvisoryInvalidation`, `fetchChart`, `fetchOverview`, `fetchTickerSnapshot`, `fetchWatchlistGroups`, `finiteNumberOrNull`, `fmtPrice`, `fmtVol`, `formatChartAxis`, `formatPercent`, `formatPercentDelta`, `governanceDeltaSeverity`, `governanceDeltaSeverityClass`, `governanceDeltaSeverityLabel`, `handleAddToWatchlist`, `handleClearDeletedAdvisoryComponents`, `handleCreateAlert`, `handleDeleteAdvisoryComponent`, `handleDeleteExecutiveSummary`, `handleGenerateAdvisoryComponents`, `handleRefreshActiveAdvisoryComponent`, `handleRegenerateExecutiveSummary`, `handleRemoveFromWatchlist`, `handleRestoreAdvisoryComponent`, `handleToggleComponentInclude`, `handleToggleTracked`, `isRealtimeQuoteScaleCompatible`, `loadPromptConfig`, `persistPromptConfig`, `pickRealtimeQuoteCandidate`, `refreshWorkspace`, `run`, `runRefresh`, `shouldSuppressTransportError`, `showWorkspaceMessage`
- Top-level variables:
  - `ADVISORY_INVALIDATION_EVENT`, `STALE_RESYNC_RETRY_MS`, `ability`, `activeAdvisoryComponent`, `activeIds`, `advisory`, `advisoryConflictRetryCountRef`, `advisoryConflictRetryTimeoutRef`, `advisoryInvalidationKeyRef`, `advisoryKey`, `advisoryParams`, `advisoryPromptConfigLastSavedRef`, `advisoryPromptConfigLoadedRef`, `advisoryRetryTelemetrySyncKeyRef`, `asks`, `attempt`, `availableWatchlistGroups`, `averagePrice`, `avgVol`, `backoffUntilRef`, `baseline`, `baselinePrice`, `baselineY`, `bids`, `bucketTs`, `buildChartContextPayload`, `buyCount`, `canAutoRetry`, `canViewAdvancedTab`, `cancelled`, `candidatePrice`, `ceilingPrice`, `cfg`, `cfgResp`, `changeClass`, `changePct`, `changeValue`, `chartPerformance`, `chartWindowHint`, `close`, `conflictState`, `contextUsage`, `cooldown`, `critical`, `cumulativeCvd`, `currentComponents`, `currentPrice`, `currentSession`, `cvdData`, `debounceRef`, `deletedComponent`, `deletedCount`, `deltaSeverity`, `denyTotal`, `depth`, `display`, `downCount`, `effectiveOrderFlowData`, `events`, `factsFirstFlowCompareSeries`, `fallback`, `fallbackFromTs`, `fallbackToTs`, `fallbackWhaleAnalyticsData`, `fetchAdvisoryObservability`, `fetchAdvisorySession`, `fetchData`, `fetchOrderFlow`, `fetchTrades`, `filteredPersistedRetryEvents`, `firstClose`, `flatCount`, `flattenedSnapshotOrders`, `floorPrice`, `flowViewModel`, `fromTs`, `generatedPayload`, `generatedResp`, `generationSource`, `governanceEndpointBreakdown`, `governanceEndpointOptions`, `governanceReasonBreakdown`, `governanceReasonOptions`, `governanceSparkline`, `governanceTrendRows`, `handleKlineSessionChange`, `handleKlineTimeframeChange`, `height`, `id`, `inFlightRef`, `incomingTrades`, `interval`, `intervalId`, `isTransientEmpty`, `isUpstreamUnavailable`, `key`, `klineFlowData`, `lastClose`, `latest`, `latestDeltaVsBaseline`, `latestVol`, `liveAveragePrice`, `liveCeilingPrice`, `liveChangeValue`, `liveCurrentPrice`, `liveFloorPrice`, `liveHighPrice`, `liveLowPrice`, `liveQuote`, `liveReferencePrice`, `liveVolume`, `map`, `marketGroups`, `max`, `maxDeny`, `maxPoint`, `maxRetryAttempts`, `maxValue`, `message`, `min`, `next`, `nextComponents`, `nextDeletedComponents`, `nextSummaries`, `nextWarnings`, `normalizedConfig`, `normalizedPoints`, `normalizedSources`, `normalizedSymbol`, `now`, `numericValue`, `orderFlowPayload`, `overviewChangeValue`, `overviewClosePrice`, `overviewCurrentPrice`, `params`, `parsed`, `payload`, `peers`, `pointItems`, `points`, `polylinePoints`, `prevDarkFlowRef`, `prevVolumeRef`, `prevWhaleRef`, `previous`, `promptConfig`, `qualityFlags`, `ratio`, `ref`, `referencePrice`, `refreshWhaleFeed`, `refreshed`, `resolvedRealtimeQuote`, `resp`, `response`, `responseConfig`, `restored`, `retryAttemptsUsed`, `retryDelayMs`, `retryEventReasonOptions`, `retrySeconds`, `row`, `rows`, `selectedSessionMaterialization`, `selectedSessionReadPath`, `selectedTradeDate`, `sellCount`, `serializedConfig`, `sessionAdvisory`, `sessionContext`, `sessionDate`, `sessionPayload`, `sessionResp`, `snapshotOrders`, `sortedTrades`, `source`, `sourceGroupId`, `status`, `summary`, `symbolAlerts`, `symbolDarkFlowAlert`, `symbolWhaleAlert`, `syncKey`, `targetPrice`, `technicalBias`, `technicalBiasFallback`, `thresholds`, `tickerData`, `timer`, `toTs`, `topCohort`, `topEndpoint`, `topReason`, `total`, `totalVol`, `tradesCountRef`, `ts`, `unique`, `upCount`, `updated`, `values`, `visibleChartPoints`, `vol`, `warning`, `warningSuffix`, `watchlistMemberships`, `whaleAnalyticsSnapshot`, `whaleSignalsForChart`, `width`, `withinRange`, `x`, `y`, `years`

### `frontend/src/pages/stockDetailAdvisoryUtils.js`

- Functions:
  - `getAdvisoryConflictRetryDelayMs`, `resolveAdvisoryConflictState`, `shouldAutoRetryAdvisoryConflict`, `translate`
- Top-level variables:
  - `baseDelayMs`, `computed`, `configIssue`, `fallbackMessage`, `payload`, `reason`, `safeAttempt`, `value`

### `frontend/src/pages/stockDetailAdvisoryUtils.test.js`

- Functions:
  - `t`
- Top-level variables:
  - `map`, `state`

### `frontend/src/pages/StockDetailPageHost.jsx`

- Top-level variables:
  - `normalizedSymbol`

### `frontend/src/pages/StockDetailPageHost.test.jsx`

- No parseable top-level symbols found

### `frontend/src/pages/Support.jsx`

- Functions:
  - `handleCreateTicket`, `handleReopen`, `handleReply`, `handleSelectTicket`, `handleStaffFilterChange`, `handleStaffPatch`, `loadStaffOpsDashboard`, `loadTicketDetail`, `loadTickets`
- Top-level variables:
  - `isStaffUser`, `matched`, `messages`, `response`, `rows`, `selectedTicketId`, `ticket`

### `frontend/src/pages/Support.test.jsx`

- Functions:
  - `renderPage`
- Top-level variables:
  - `baseThread`, `baseTicket`

### `frontend/src/pages/SupportShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/Transactions.jsx`

- Functions:
  - `calcFee`, `cancelForm`, `formatUsDecimalInput`, `formatUsIntegerInput`, `handleChange`, `handleDelete`, `handleFeePresetChange`, `handleNumericBlur`, `handleRefresh`, `handleSubmit`, `handleVisibilityChange`, `isValidUsPriceInput`, `isValidUsQuantityInput`, `openCreate`, `openEdit`, `parseUsNumber`
- Top-level variables:
  - `ALL_TAB`, `EMPTY_FORM`, `FEE_PRESETS`, `FEE_PRESET_KEYS`, `MIN_FEE`, `SA_COLORS`, `TAX_SELL_RATE`, `TYPE_BG`, `US_PRICE_PATTERN`, `US_QUANTITY_PATTERN`, `VSD_RATE`, `activeSaName`, `brokerageFee`, `buyCount`, `count`, `data`, `dec`, `defaultSa`, `digits`, `displayTx`, `feeBreakdown`, `feePresetLabels`, `fetchSubAccounts`, `fetchTx`, `filtered`, `firstDot`, `intDigits`, `intFormatted`, `list`, `map`, `nextFieldErrors`, `normalized`, `normalizedSymbol`, `parsed`, `parsedPrice`, `parsedQuantity`, `payload`, `preset`, `priceParsed`, `qtyParsed`, `raw`, `res`, `results`, `sa`, `saColorMap`, `sanitized`, `sellCount`, `targets`, `taxFee`, `txValue`, `txs`, `typeLabels`, `vsdFee`

### `frontend/src/pages/TransactionsShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/Upgrade.jsx`

- Top-level variables:
  - `PLAN_DEFS`, `plans`

### `frontend/src/pages/UserConfig.jsx`

- Functions:
  - `loadData`, `onField`, `removeDNSECreds`, `saveDNSECreds`, `saveGeneralSettings`
- Top-level variables:
  - `mounted`, `resp`, `userCfg`, `userResp`

### `frontend/src/pages/UserConfig.test.jsx`

- Functions:
  - `getLanguageSelect`, `mockT`, `renderUserConfig`
- Top-level variables:
  - `languageSelect`, `mockI18nContext`, `mockUserConfig`, `saveButton`, `thresholdInput`, `translations`

### `frontend/src/pages/VerifyEmail.jsx`

- Top-level variables:
  - `active`, `token`

### `frontend/src/pages/Watchlist.jsx`

- Functions:
  - `PctCell`, `activeGroupSymbols`, `formatPrice`, `handleAddAllTrackedFromGroup`, `handleAddTracked`, `handleAddTrackedFromGroup`, `handleBulkClearTrackedThreshold`, `handleBulkSetTrackedThreshold`, `handleCancelTrackedThresholdEdit`, `handleCreatePriceAlert`, `handleDeletePriceAlert`, `handleDeleteTracked`, `handleRemoveAllTrackedFromGroup`, `handleSaveTrackedThreshold`, `handleSeed`, `handleStartTrackedThresholdEdit`, `handleSyncStockProfile`, `handleTogglePriceAlert`, `safeDate`, `safeNumber`, `safeString`, `scoreDate`, `scoreNumber`, `scoreThreshold`
- Top-level variables:
  - `MAX_WATCHLIST_RT_SYMBOLS`, `SIDEBAR_PAGE_SIZE`, `activeDirection`, `activeGroup`, `activeGroupItems`, `activeGroupTrackedCount`, `activeGroupTrackedItems`, `activeGroupUntrackedCount`, `activeKey`, `ad`, `ak`, `alertSymbols`, `allRealtimeSymbols`, `buf`, `clearSyncCooldownTimer`, `compare`, `cooldownMs`, `cooldownSeconds`, `currentPrice`, `d`, `downCount`, `dt`, `eventThresholdMillion`, `eventThresholdVnd`, `fetchPriceAlerts`, `fetchTracked`, `filteredActiveGroupItems`, `filteredByDataActiveGroupItems`, `filteredByDataTrackedSymbolsWithRealtime`, `filteredTrackedSymbolsWithRealtime`, `getGroupSortIndicator`, `getSparklinePrices`, `getTrackedSortIndicator`, `group`, `groupCurrentPage`, `groupStats`, `groupTotalPages`, `groupsWithRealtime`, `handleMarkPriceAlertTriggered`, `handleQuickCreatePriceAlert`, `handleSync`, `inCooldown`, `initial`, `isActive`, `isDown`, `isUp`, `justAddedSymbol`, `keyword`, `lastTriggeredAt`, `latestTriggeredPriceAlert`, `loadGroups`, `navigate`, `next`, `nextValue`, `normalized`, `normalizedPrev`, `normalizedSymbol`, `normalizedThreshold`, `now`, `openStockWorkspace`, `pagedActiveGroupItems`, `pagedGroups`, `pagedTrackedSymbolsWithRealtime`, `parsed`, `parsedThreshold`, `payload`, `prevDir`, `prevKey`, `price`, `priceAlertConditionLabels`, `priceAlertsWithRealtime`, `priceHistoryRef`, `realtimeLabels`, `res`, `retryAfter`, `rows`, `s`, `searchedActiveGroupItems`, `searchedTrackedSymbolsWithRealtime`, `shouldAutoClearMessage`, `si`, `sortedActiveGroupItems`, `sortedTrackedSymbolsWithRealtime`, `splitIndex`, `start`, `startSyncCooldown`, `strategyFilteredTracked`, `symbolsToAdd`, `syncCooldownIntervalRef`, `targetPrice`, `targets`, `thresholdInUseMillion`, `thresholdValue`, `toggleGroupSort`, `toggleTrackedSort`, `totalSidebarPages`, `tracked`, `trackedCurrentPage`, `trackedItem`, `trackedStats`, `trackedSymbolMap`, `trackedSymbolSet`, `trackedSymbolsWithRealtime`, `trackedTotalPages`, `trackedWithOverrideCount`, `trackedWithUserDefaultCount`, `triggeringAlertIdsRef`, `trimmed`, `typeLabels`, `upCount`, `updatedMap`, `updatedRows`, `useSymbolOverride`, `userThresholdMillion`

### `frontend/src/pages/WatchlistShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/WhaleAdvisory.jsx`

- Functions:
  - `fmtTime`
- Top-level variables:
  - `activeItem`, `advisoryShellHostHref`, `filteredStats`, `list`, `packageShellHostEnabled`, `params`, `q`, `query`, `refreshInfo`, `resolvedSymbol`, `stillExists`

### `frontend/src/pages/WhaleAlertsDashboard.jsx`

- Functions:
  - `fetchChart`, `fmtBil`, `normalizeSymbol`, `symbolAlerts`, `symbolDarkFlowAlerts`
- Top-level variables:
  - `BUBBLE_TIMEFRAME_OPTIONS`, `MAX_CHART_FLOW_TRADE_DATES`, `advisoryParams`, `advisoryRequestIdRef`, `bubbleFactsFirstFlowData`, `bubbleOrdersForFlow`, `cancelled`, `chartAnalyticsTimeframe`, `chartFactsFirstFlowData`, `chartHistoryTradeDates`, `conflictState`, `darkFlowItems`, `feedRequestIdRef`, `feedResp`, `fetchAdvisorySession`, `fetchFeed`, `fetchOverview`, `flattenedSnapshotOrders`, `historyTradeDates`, `id`, `liveBoardAlerts`, `lt`, `n`, `nextChartData`, `normalizedSymbol`, `overviewRequestIdRef`, `overviewResp`, `payload`, `prevWhaleRef`, `requestId`, `response`, `rt`, `selectedTradeDate`, `symbolDarkFlowAlert`, `symbolWhaleAlert`, `whaleItems`, `whaleSignalsForChart`

### `frontend/src/pages/WhaleAlertsShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`, `location`

### `frontend/src/setupProxy.js`

- No parseable top-level symbols found

### `frontend/src/types/vnstockcharts-compat.d.ts`

- No parseable top-level symbols found

### `frontend/src/utils/alertTaxonomy.js`

- Functions:
  - `alertCardTone`, `alertSeveritySummaryTone`, `alertSourceBadgeTone`, `alertTypeBadgeTone`, `alertTypeLabel`, `deriveAlertType`, `normalizeAlertSeverity`, `normalizeAlertType`, `severityWeight`
- Top-level variables:
  - `ALERT_TYPE_VALUES`, `baseMap`, `normalized`, `normalizedHeadline`, `normalizedSeverity`, `normalizedSide`, `normalizedSource`, `normalizedType`, `pct`

### `frontend/src/utils/dashboardRealtimeSelectors.js`

- Functions:
  - `buildLiveHoldingsOverlay`, `buildLiveSummaryFromHoldings`, `resolveLiveChangePct`, `toFiniteNumber`, `toNumber`, `totals`
- Top-level variables:
  - `avgCost`, `costBasis`, `hasLivePrice`, `impliedCostBasis`, `liveChangePct`, `liveMarketValue`, `livePrice`, `liveUnrealizedPL`, `liveUnrealizedPLPct`, `normalizedLivePrice`, `normalizedPrevPrice`, `normalizedQuoteChangePct`, `parsed`, `quantity`, `quote`, `snapshotMarketValue`

### `frontend/src/utils/dashboardRealtimeSelectors.test.js`

- Top-level variables:
  - `result`

### `frontend/src/utils/dashboardRealtimeViewModel.js`

- Functions:
  - `buildDashboardRealtimeQuote`, `buildDashboardRealtimeQuoteList`, `computeChangePct`, `isPositiveNumber`, `normalizeSymbol`, `resolveDisplayPrice`, `resolveDisplaySemantic`, `toFiniteNumber`
- Top-level variables:
  - `OFFHOURS_PHASES`, `derivedPrevPrice`, `displaySemantic`, `displayState`, `hasDisplayPrice`, `holding`, `holdingLivePrice`, `holdingSnapshotPrice`, `holdingsBySymbol`, `isOffhoursLike`, `normalizedPhase`, `normalizedSymbol`, `parsed`, `quote`, `quoteChangePct`, `quoteCurrentPrice`, `quotePrevPrice`, `resolvedAgeSeconds`, `resolvedChangePct`, `resolvedFreshnessSeconds`, `resolvedStale`, `resolvedThresholdSeconds`, `staleOverThreshold`

### `frontend/src/utils/dashboardRealtimeViewModel.test.js`

- Top-level variables:
  - `list`, `record`

### `frontend/src/utils/modernDashboardSymbolUniverse.js`

- Functions:
  - `addSourceTag`, `buildModernDashboardSymbolUniverse`, `ensureArray`, `filterUniverseByScope`, `getOrCreateEntry`, `normalizeSymbol`
- Top-level variables:
  - `entries`, `entry`, `groupId`, `groupName`, `quote`, `symbol`

### `frontend/src/utils/orderFlowFallback.js`

- Functions:
  - `buildBaseOrderFlowData`, `buildEffectiveOrderFlowData`, `hasObjectContent`, `hasSeriesData`, `mergeOrderFlowDataWithWhaleAnalytics`, `resolveFallbackTradeDate`
- Top-level variables:
  - `fallbackCvdSeries`, `fallbackDarkFlow`, `fallbackFlow`, `fallbackTradeDate`, `orderFlowData`, `sessionContext`

### `frontend/src/utils/orderFlowFallback.test.js`

- Top-level variables:
  - `merged`, `orderFlowData`, `whaleAnalyticsData`

### `frontend/src/utils/requestCancellation.js`

- Functions:
  - `isRequestCanceled`
- Top-level variables:
  - `code`, `message`, `name`

### `frontend/src/utils/sessionFactsFlowAdapter.js`

- Functions:
  - `buildFactsFirstFlowData`, `filterSeriesByTimeframeWindow`, `flattenBubbleOrders`, `mapSessionFactsWindowFromAnalyticsTimeframe`, `mergeSeriesByKey`, `normalizeSessionFactsSeriesItem`, `normalizeTimeframeWindow`, `resolveSeriesMinute`, `sortSeriesByTime`, `toFiniteNumber`
- Top-level variables:
  - `cumulativeCvd`, `cvdSeries`, `derivedWindow`, `endMs`, `explicitEndMs`, `explicitStartMs`, `factsFirstFlowCompareSeries`, `fallbackWindow`, `filteredFlowCompareSeries`, `filteredHeatmapSeries`, `filteredMarkerSeries`, `filteredSpeedSeries`, `flowViewModel`, `institutionalStrengthSeries`, `key`, `latestSessionDate`, `leftTs`, `lookup`, `lowerBound`, `minute`, `normalizedTimeframe`, `normalizedTimeframeWindow`, `numericValue`, `qualityFlags`, `referenceDate`, `rightTs`, `sessionContext`, `sessionDates`, `startMs`, `strengthSeries`, `timestampMs`, `timestampsMs`, `upperBound`

### `frontend/src/utils/sessionFactsFlowAdapter.test.js`

- Top-level variables:
  - `baseFlowData`, `result`, `sessionFactPayloads`, `timeframeWindow`

### `frontend/src/utils/VNInvestSignalAdapter.js`

- Functions:
  - `mapToCvdSeries`, `mapToOHLCVBars`, `mapToWhaleOrders`
- Top-level variables:
  - `matchedValue`, `parsedDate`

### `frontend/src/utils/watchlistHelpers.js`

- Functions:
  - `applyStrategyFilter`, `extractApiErrorMessage`, `isPriceAlertMatched`, `mergeTickerIntoItem`, `resolveWatchlistPriceScale`, `safeDate`, `safeNumber`, `safeString`, `scoreDate`, `scoreNumber`, `scoreThreshold`, `severityLabel`, `severityTone`, `sortGroupRows`, `sortTrackedRows`, `toFiniteNumber`
- Top-level variables:
  - `compare`, `current`, `dt`, `firstField`, `normalizedCurrentPrice`, `normalizedSeverity`, `parsed`, `payload`, `prev`, `realtimeDate`, `sorted`, `targetPrice`, `threshold`

### `frontend/src/utils/whaleAnalyticsSnapshotAdapter.js`

- Functions:
  - `buildWindowFromSnapshot`, `mergeBubbleOrders`, `mergeSeriesByKey`, `mergeTimeframeWindows`, `mergeWhaleAnalyticsSnapshots`, `normalizeWhaleAnalyticsSnapshot`, `resolveOrderKey`, `sortSeriesByTime`
- Top-level variables:
  - `aggregatedQualityFlags`, `allBubbleOrders`, `allValues`, `bubbleOrders`, `bubbleSeries`, `bubbleWindow`, `buyStrengthSeries`, `cvdSeries`, `endDate`, `endEpochSec`, `endMs`, `endValue`, `fallback`, `flattenedBubbleOrders`, `flowCompareSeries`, `flowViewModel`, `flowWindow`, `heatmapSeries`, `institutionalStrengthSeries`, `key`, `latestInstitutional`, `latestSnapshot`, `latestTradeDate`, `latestWindow`, `leftTradeDate`, `leftTs`, `lookup`, `markerSeries`, `mergedCvdSeries`, `mergedFlowCompareSeries`, `mergedFlowViewModel`, `mergedHeatmapSeries`, `mergedInstitutionalStrengthSeries`, `mergedMarkerSeries`, `mergedOrders`, `mergedPriceSeries`, `mergedSessionContext`, `mergedSpeedSeries`, `mergedStrengthSeries`, `normalizedCvdSeries`, `normalizedFlowCompareSeries`, `normalizedHeatmapSeries`, `normalizedInstitutionalStrengthSeries`, `normalizedMarkerSeries`, `normalizedPriceSeries`, `normalizedSide`, `normalizedSpeedSeries`, `normalizedStrengthSeries`, `order`, `priceSeries`, `rightTradeDate`, `rightTs`, `sessionContext`, `sessionLevels`, `snapshotQualityFlags`, `snapshots`, `speedSeries`, `staleReason`, `startDate`, `startEpochSec`, `startMs`, `startValue`, `timeframeWindow`, `validWindows`

### `frontend/src/utils/whaleAnalyticsSnapshotAdapter.test.js`

- Top-level variables:
  - `normalized`, `snapshot`

### `frontend/src/utils/whaleFlowViewModel.js`

- Functions:
  - `buildFallbackFlowCompareSeries`, `buildFallbackMarkerSeries`, `buildLookup`, `buildWhaleFlowViewModel`, `clamp`, `percentileRank`, `percentileValue`, `resolveBucketTimestamp`, `resolveMinuteKey`, `toFiniteNumber`
- Top-level variables:
  - `bucketKeys`, `bucketLookup`, `buckets`, `compareLookup`, `comparePoint`, `current`, `cvdLookup`, `cvdPoint`, `cvdRaw`, `cvdScale`, `effectiveFlowCompareSeries`, `effectiveMarkerSeries`, `eventScores`, `groupedOrders`, `hasFlowData`, `hasHeatmapData`, `heatmapLookup`, `heatmapPoint`, `index`, `institutionalLookup`, `lastIndex`, `lookup`, `markerLookup`, `markerPoint`, `matchedValue`, `minute`, `minuteKey`, `numericTarget`, `numericValue`, `numericValues`, `resolvedTradeDate`, `safeQuantile`, `side`, `strengthLookup`, `totals`

### `frontend/src/utils/whaleKlineAlignment.js`

- Functions:
  - `buildAutoFocusZoomScales`, `buildWhaleAnalyticsBucketMinuteKeys`, `mapChartTimeframeToWhaleAnalyticsTimeframe`, `normalizeTradeDateKey`, `resolveChartHistoryTradeDates`, `resolveChartTimeframeMinutes`, `resolveFlowBucketForCandle`, `resolveMatchingWhaleCandleMinuteKey`, `resolveTradeDateIndexRange`, `resolveWhaleAnalyticsBucketMinutes`
- Top-level variables:
  - `ANALYTICS_TIMEFRAME_BY_CHART_TIMEFRAME`, `CHART_TIMEFRAME_MINUTES`, `allTradeDates`, `bucketMinuteKey`, `bucketMinutes`, `candidateKeys`, `candleEndExclusive`, `candleMinuteKey`, `candleTradeDate`, `chartMinutes`, `count`, `effectiveVisibleTradeDates`, `estimatedVisibleBarCount`, `firstIndex`, `flowBucketMinutes`, `hasVisibleRange`, `lastIndex`, `matchedBucket`, `matchedBucketMinuteKey`, `maxVisibleTs`, `mergedTradeDates`, `minVisibleTs`, `nextScale`, `normalized`, `normalizedMaximum`, `normalizedMinimum`, `normalizedTargetVisibleBarCount`, `normalizedTradeDate`, `normalizedVisibleBarCount`, `numericValue`, `parsed`, `pointTimestamp`, `pointTradeDate`, `recentTradeDates`, `scales`, `startMinute`, `step`, `visibleFrom`, `visibleTo`, `visibleTradeDates`

### `frontend/src/utils/whaleKlineAlignment.test.js`

- Top-level variables:
  - `buckets`, `candleMinuteKeys`, `candles`, `chartData`

### `frontend/src/utils/whaleTimeAdapter.js`

- Functions:
  - `buildClockDate`, `cloneAtMinute`, `formatMinuteLabel`, `getEffectiveMarketNow`, `getMarketSessionSegments`, `isWithinMarketSession`, `resolveWhaleTimeframeWindow`, `subtractTradingMinutes`, `toCanonicalMinute`
- Top-level variables:
  - `AFTERNOON_START`, `MORNING_END`, `MORNING_START`, `ROLLING_WINDOW_MINUTES`, `SESSION_END`, `activeSegment`, `afternoonStart`, `anchor`, `canonical`, `cloned`, `cursor`, `d`, `date`, `effectiveNow`, `endDate`, `minutesAvailable`, `morningEnd`, `morningStart`, `normalizedTimeframe`, `now`, `numericTs`, `remainingMinutes`, `safeEnd`, `safeStart`, `secondsInDay`, `segments`, `sessionEnd`, `startDate`, `trimmed`, `vnOffsetSeconds`, `vnTimeMinutes`

### `frontend/src/utils/whaleTooltipFormatter.js`

- Functions:
  - `createWhaleTooltipFormatter`, `formatAxisTime`, `formatCompactSignedValue`, `formatTooltipMoney`, `formatTooltipPriceDelta`, `getSeriesPointTimestampMs`
- Top-level variables:
  - `COLORS`, `absValue`, `axisValue`, `buyStrengthAtBucket`, `date`, `formattedValue`, `institutionalStrengthAtBucket`, `meta`, `numericValue`, `pointTimestampMs`, `pointTimestampSec`, `pointValue`, `priceAtBucket`, `rawValue`, `seriesName`, `sideColor`, `sideLabel`, `sign`, `speedAtBucket`, `timeLabel`

### `frontend/src/workers/sparkline.worker.js`

- Functions:
  - `computePoints`
- Top-level variables:
  - `H`, `W`, `max`, `min`, `points`, `range`, `step`, `x`, `y`

### `frontend/tailwind.config.js`

- No parseable top-level symbols found

### `mobile-app/App.tsx`

- No parseable top-level symbols found

### `mobile-app/index.ts`

- No parseable top-level symbols found

### `mobile-app/metro.config.js`

- Top-level variables:
  - `config`, `path`, `projectRoot`

### `mobile-app/src/app/AppRoot.tsx`

- Functions:
  - `AppRoot`
- Top-level variables:
  - `bootstrap`, `isLoading`, `localeBootstrap`, `styles`, `user`

### `mobile-app/src/components/BottomTabBar.tsx`

- Functions:
  - `BottomTabBar`
- Top-level variables:
  - `t`

### `mobile-app/src/i18n/en.ts`

- Top-level variables:
  - `en`

### `mobile-app/src/i18n/index.ts`

- No parseable top-level symbols found

### `mobile-app/src/i18n/vi.ts`

- Top-level variables:
  - `vi`

### `mobile-app/src/screens/AuthScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/screens/DashboardScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/screens/HomeScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/screens/ProfileScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/screens/TransactionsScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/screens/WatchlistScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/screens/WhaleScreen.tsx`

- No parseable top-level symbols found

### `mobile-app/src/services/authApi.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/config.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/http.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/portfolioApi.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/realtime.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/tokenStorage.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/transactionApi.ts`

- No parseable top-level symbols found

### `mobile-app/src/services/watchlistApi.ts`

- No parseable top-level symbols found

### `mobile-app/src/store/authStore.ts`

- No parseable top-level symbols found

### `mobile-app/src/store/localeStore.ts`

- No parseable top-level symbols found

### `mobile-app/src/theme/colors.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/auth.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/portfolio.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/transaction.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/watchlist.ts`

- No parseable top-level symbols found

### `packages/mobile/src/components/MobileBottomTabBar.js`

- Functions:
  - `MobileBottomTabBar`
- Top-level variables:
  - `active`, `styles`

### `packages/mobile/src/i18n/index.ts`

- Functions:
  - `createTranslator`, `formatNumber`, `formatTime`, `getLocaleTag`
- Top-level variables:
  - `LOCALES`, `LOCALE_LABELS`, `LOCALE_TAGS`, `SUPPORTED_LOCALES`, `date`, `dict`, `en`, `node`, `parsed`, `parts`, `result`, `safeValue`, `vi`

### `packages/mobile/src/index.js`

- No parseable top-level symbols found

### `packages/mobile/src/navigation/mobileNavigation.js`

- Functions:
  - `findMobileTabDefinition`, `isMobileTabKey`
- Top-level variables:
  - `DEFAULT_ACTIVE_TAB`, `MOBILE_TAB_DEFS`, `MOBILE_TAB_KEYS`

### `packages/mobile/src/runtimeConfig.js`

- Functions:
  - `createMobileRuntimeConfig`, `normalizeBaseUrl`
- Top-level variables:
  - `API_BASE_URL`, `API_PREFIX`, `DEMO_PASSWORD`, `DEMO_USERNAME`, `WS_BASE_URL`, `apiBaseUrl`, `mobileRuntimeConfig`, `trimmed`, `wsBaseUrl`

### `packages/mobile/src/screens/AuthScreen.tsx`

- Functions:
  - `AuthScreen`, `fillTestAccount`, `onSubmit`
- Top-level variables:
  - `clearMessages`, `errorMessage`, `hasDemoCredentials`, `infoMessage`, `isLoading`, `login`, `normalizedUsername`, `register`, `styles`, `submitLabel`, `success`, `t`

### `packages/mobile/src/screens/DashboardScreen.tsx`

- Functions:
  - `DashboardScreen`
- Top-level variables:
  - `formatPct`, `formatVnd`, `isFirst`, `loadDashboard`, `locale`, `logout`, `num`, `onLogout`, `onOpenProfile`, `onOpenSettings`, `onToggleLanguage`, `parsed`, `plColor`, `portfolioId`, `portfolios`, `setLocale`, `styles`, `t`, `toNumber`, `topAllocation`, `topHoldings`, `user`

### `packages/mobile/src/screens/HomeScreen.tsx`

- Functions:
  - `HomeScreen`
- Top-level variables:
  - `styles`, `t`

### `packages/mobile/src/screens/ProfileScreen.tsx`

- Functions:
  - `ProfileScreen`
- Top-level variables:
  - `locale`, `logout`, `nextLocale`, `setLocale`, `styles`, `t`, `user`

### `packages/mobile/src/screens/TransactionsScreen.tsx`

- Functions:
  - `TransactionsScreen`, `onDelete`, `onEdit`, `onPickSubAccount`, `onSubmit`, `pickSuggestion`, `resetForm`
- Top-level variables:
  - `TRANSACTION_TYPE_LABEL_KEYS`, `TX_TYPES`, `accounts`, `active`, `activeSubAccount`, `bootstrap`, `day`, `debounceRef`, `defaultId`, `emptyForm`, `formatNumber`, `isValidSymbol`, `loadTransactions`, `locale`, `month`, `normalized`, `now`, `parsed`, `payload`, `raw`, `results`, `styles`, `symbol`, `t`, `toDecimal`, `todayString`, `txs`

### `packages/mobile/src/screens/WatchlistScreen.tsx`

- Functions:
  - `WatchlistScreen`, `onAddSymbol`, `onDeleteSymbol`
- Top-level variables:
  - `bootstrap`, `clone`, `direction`, `flashDirection`, `flashTimeoutsRef`, `formatPct`, `loadData`, `nextPrev`, `nextValue`, `num`, `onRefresh`, `parsed`, `positive`, `prefix`, `prevChangePctRef`, `prevValue`, `styles`, `symbol`, `t`, `toNumber`

### `packages/mobile/src/screens/WhaleScreen.tsx`

- Functions:
  - `WhaleScreen`, `initSocket`, `onRefreshAdvisory`
- Top-level variables:
  - `accessToken`, `active`, `bootstrap`, `cancelled`, `clearPolling`, `closeSocket`, `connectionText`, `date`, `deduped`, `eventType`, `exists`, `filteredAlerts`, `formatTime`, `formatVnd`, `id`, `isAppActive`, `loadData`, `loadWhaleSnapshot`, `locale`, `matchedValue`, `nextAlert`, `normalizeWhaleAlert`, `normalized`, `onRefresh`, `parsed`, `payload`, `pollingRef`, `response`, `result`, `selectedAdvisories`, `startPolling`, `styles`, `subscription`, `symbol`, `symbolRaw`, `t`, `toNumber`, `trackedSymbolCodes`, `ts`, `ws`, `wsRef`

### `packages/mobile/src/services/authApi.ts`

- Functions:
  - `getMe`, `login`, `logout`, `register`, `restoreSession`
- Top-level variables:
  - `accessToken`, `response`

### `packages/mobile/src/services/coreApiClient.ts`

- Functions:
  - `generateRequestId`, `getAlertCenterFeed`, `getSessionFacts`, `getSymbolSnapshot`, `getWhaleFeedAggregate`
- Top-level variables:
  - `CORE_API_PREFIX`, `coreClient`, `getUnifiedAlerts`, `query`, `r`, `response`, `search`, `token`

### `packages/mobile/src/services/http.ts`

- Functions:
  - `drainRefreshQueue`
- Top-level variables:
  - `accessToken`, `authClient`, `isRefreshing`, `newAccessToken`, `originalRequest`, `refreshQueue`, `refreshResponse`, `refreshToken`, `statusCode`

### `packages/mobile/src/services/portfolioApi.ts`

- Functions:
  - `getAllocation`, `getHoldings`, `getPortfolios`, `getSummary`, `loadPortfolioTransactions`
- Top-level variables:
  - `avgCost`, `buildHoldingsFromTransactions`, `bySymbol`, `current`, `fee`, `holdings`, `marketValue`, `parsed`, `price`, `quantity`, `response`, `sellQty`, `side`, `symbol`, `toNumber`, `total`, `totalMarketValue`, `transactions`, `value`

### `packages/mobile/src/services/realtime.ts`

- Top-level variables:
  - `buildRealtimeWebSocketUrl`, `normalizeWsBase`, `trimmed`, `wsBase`

### `packages/mobile/src/services/tokenStorage.ts`

- Functions:
  - `clearTokens`, `getAccessToken`, `getRefreshToken`, `saveAccessToken`, `saveRefreshToken`, `saveTokens`
- Top-level variables:
  - `ACCESS_TOKEN_KEY`, `REFRESH_TOKEN_KEY`

### `packages/mobile/src/services/transactionApi.ts`

- Functions:
  - `createTransaction`, `deleteTransaction`, `getSubAccounts`, `getTransactions`, `searchStocks`, `updateTransaction`, `validateStockSymbol`
- Top-level variables:
  - `mapToMobileTransaction`, `portfolios`, `response`, `rows`, `search`, `transactions`

### `packages/mobile/src/services/watchlistApi.ts`

- Functions:
  - `addTrackedSymbol`, `deleteTrackedSymbol`, `ensureDefaultWatchlist`, `getAggregateWhaleFeed`, `getTrackedSymbols`, `getWatchlistGroups`, `getWhaleAdvisories`, `loadTrackedFromWatchlist`, `refreshWhaleAdvisory`
- Top-level variables:
  - `coreResponse`, `createdResponse`, `listResponse`, `preferred`, `response`, `row`, `rows`, `tracked`, `trackedSymbolIndex`, `watchlist`, `watchlists`

### `packages/mobile/src/store/authStore.ts`

- Top-level variables:
  - `data`, `fallback`, `firstKey`, `firstValue`, `readApiError`, `result`, `useAuthStore`, `user`

### `packages/mobile/src/store/localeStore.ts`

- Top-level variables:
  - `STORAGE_KEY`, `resolved`, `stored`, `useLocaleStore`

### `packages/mobile/src/theme/colors.ts`

- Top-level variables:
  - `colors`

### `packages/mobile/src/types/auth.ts`

- No parseable top-level symbols found

### `packages/mobile/src/types/portfolio.ts`

- No parseable top-level symbols found

### `packages/mobile/src/types/transaction.ts`

- No parseable top-level symbols found

### `packages/mobile/src/types/watchlist.ts`

- No parseable top-level symbols found

### `packages/web/jest.config.js`

- Top-level variables:
  - `config`

### `packages/web/src/adapters/core/__tests__/commercial.test.js`

- Top-level variables:
  - `client`, `coreGet`, `corePost`

### `packages/web/src/adapters/core/auth.js`

- Functions:
  - `createAuthClient`
- Top-level variables:
  - `refreshValue`, `responsePayload`, `tokenPayload`

### `packages/web/src/adapters/core/commercial.js`

- Functions:
  - `createCommercialClient`
- Top-level variables:
  - `query`, `searchParams`, `url`

### `packages/web/src/adapters/core/coreAdapter.js`

- Classes:
  - `CoreAdapterHttpError`
- Functions:
  - `appendQuery`, `createCoreAdvisorySessionClient`, `createCoreWhaleAnalyticsSnapshotClient`, `getAiAdvisorySessionWithFallback`, `readJsonBody`, `requestJson`, `resolveCoreBaseUrl`, `resolveFetchImpl`, `resolvePortfolioApiBaseUrl`
- Top-level variables:
  - `contentType`, `coreAdapter`, `coreBase`, `normalizedRequestOptions`, `normalizedSymbol`, `params`, `payload`, `queryString`, `request`, `response`

### `packages/web/src/adapters/core/index.js`

- No parseable top-level symbols found

### `packages/web/src/adapters/core/market.js`

- Functions:
  - `createMarketClient`
- Top-level variables:
  - `days`, `interval`, `params`, `period`, `q`, `query`, `symbolList`, `timeframe`

### `packages/web/src/adapters/core/transport.js`

- Classes:
  - `CoreApiRequestError`
- Functions:
  - `clearBrowserStorageToken`, `coreDelete`, `coreGet`, `corePatch`, `corePost`, `corePut`, `createCoreTransport`, `generateRequestId`, `getAuthorizationHeader`, `getBrowserStorageToken`, `normalizeRefreshResponsePayload`, `publicPost`, `requestTokenRefresh`, `requestWithAuth`, `resolveCoreApiBase`, `resolvePublicApiBase`, `setBrowserStorageToken`, `shouldTryRefresh`, `toCoreApiRequestError`
- Top-level variables:
  - `authTokenStorage`, `base`, `code`, `detail`, `directAccess`, `directRefresh`, `fallbackText`, `fieldErrors`, `nestedData`, `nextAccessToken`, `payload`, `r`, `refreshPromise`, `refreshToken`, `requestId`, `response`, `text`, `token`, `tokenPayload`

### `packages/web/src/adapters/core/workspace.js`

- Functions:
  - `createWorkspaceClient`
- Top-level variables:
  - `query`

### `packages/web/src/adapters/coreApiAdapter.js`

- Functions:
  - `createCoreApiAdapter`
- Top-level variables:
  - `authClient`, `commercialClient`, `coreApiAdapter`, `defaultCoreApiAdapter`, `marketClient`, `persistTokens`, `transport`, `workspaceClient`

### `packages/web/src/adapters/coreApiAdapter.test.js`

- Functions:
  - `mockErrorJsonResponse`, `mockErrorResponse`, `mockErrorResponseWithBody`, `mockOkResponse`
- Top-level variables:
  - `adapter`, `clearTokens`, `fetchMock`, `payload`, `result`, `setTokens`

### `packages/web/src/adapters/vip-app/index.js`

- No parseable top-level symbols found

### `packages/web/src/adapters/vip-app/vipAppAdapter.js`

- Functions:
  - `appendQuery`, `buildJsonRequest`, `createVipAppControlClient`, `requestJson`, `resolveFetchImpl`, `resolveVipAppBaseUrl`
- Top-level variables:
  - `params`, `queryString`, `request`, `response`, `vipAppAdapter`

### `packages/web/src/app/navigationCatalog.js`

- Functions:
  - `getNavigationForBuildTarget`, `getNavigationGroupIds`
- Top-level variables:
  - `ALL_BUILD_TARGETS`, `navigationCatalog`, `normalizedTarget`

### `packages/web/src/app/routeCatalog.js`

- Functions:
  - `getRouteCatalogIds`, `getRoutesForBuildTarget`
- Top-level variables:
  - `ALL_BUILD_TARGETS`, `normalizedTarget`, `routeCatalog`

### `packages/web/src/components/alert-center/AlertCard.js`

- Functions:
  - `AlertCard`, `renderEvidenceList`
- Top-level variables:
  - `directionClass`, `e`, `entries`

### `packages/web/src/components/alert-center/DetailDrawer.js`

- Functions:
  - `DetailDrawer`
- Top-level variables:
  - `e`

### `packages/web/src/components/alert-center/SummaryMetrics.js`

- Functions:
  - `SummaryMetrics`, `renderSummaryCard`
- Top-level variables:
  - `e`

### `packages/web/src/components/alert-center/SymbolStatsTable.js`

- Functions:
  - `SymbolStatsTable`
- Top-level variables:
  - `buyPercent`, `e`, `freqClass`, `neutralPercent`, `sellPercent`

### `packages/web/src/components/auth/TurnstileWidget.js`

- Functions:
  - `TurnstileWidget`, `resolveSiteKey`
- Top-level variables:
  - `siteKey`

### `packages/web/src/components/DNSEConnectionPanel.js`

- Functions:
  - `DNSEConnectionPanel`, `useDNSEStatus`
- Top-level variables:
  - `e`, `handleCreateTradingToken`, `handlePlaceOrder`, `handleReconcileTransactions`, `handleSave`, `handleSendOtp`, `handleSync`, `handleSyncBalances`, `isConfigured`, `mountedRef`, `normalizedSymbol`, `price`, `quantity`, `reload`, `res`, `token`

### `packages/web/src/components/OrderFlowRadarPanel.js`

- Functions:
  - `OrderFlowRadarPanel`, `fmtCompact`, `formatPercentDelta`, `getICTTime`, `useI18n`
- Top-level variables:
  - `chartData`, `cvdSeries`, `d`, `darkFlow`, `e`, `filteredCvdSeries`, `filteredSignals`, `formatter`, `hourPart`, `hours`, `ict`, `ictDate`, `itemTs`, `latestSignal`, `liveSignal`, `liveStrength`, `map`, `maxTs`, `minutePart`, `minutes`, `n`, `numericValue`, `parts`, `recentSignalNodes`, `signals`, `sizeDistribution`, `smallOrderRatio`, `tickRate`, `timeFilterButtons`, `utc`

### `packages/web/src/components/PolicyCheckboxes.js`

- Functions:
  - `PolicyCheckboxes`, `handleToggle`, `policyIdsToScopeCodes`, `scopeCodesToPolicyIds`
- Top-level variables:
  - `POLICIES`, `POLICY_TO_SCOPE_CODES`, `SCOPE_CODE_TO_POLICY`, `newSelected`, `policyId`, `policyIds`, `scopeCodes`, `scopes`, `seen`, `selectedSet`

### `packages/web/src/components/ShellPageTemplate.js`

- Functions:
  - `ShellField`, `ShellMetric`, `ShellPageChrome`, `ShellPanel`, `ShellSelectField`, `joinClassNames`, `renderElement`, `renderShellField`, `renderShellMetric`, `renderShellPageChrome`, `renderShellPanel`, `renderShellSelectField`
- Top-level variables:
  - `SHELL_PAGE_TEMPLATE_STYLES`

### `packages/web/src/components/support/StaffTicketActions.js`

- Top-level variables:
  - `e`

### `packages/web/src/components/support/SupportOpsDashboard.js`

- Functions:
  - `StatCard`, `fmtDuration`
- Top-level variables:
  - `e`, `hours`, `minutes`, `total`

### `packages/web/src/components/support/SupportQueueFilters.js`

- Top-level variables:
  - `e`

### `packages/web/src/components/support/SupportTicketList.js`

- Functions:
  - `statusClass`
- Top-level variables:
  - `active`, `e`, `priorities`

### `packages/web/src/components/support/TicketComposer.js`

- Functions:
  - `handleSubmit`
- Top-level variables:
  - `e`

### `packages/web/src/components/support/TicketCreationForm.js`

- Functions:
  - `submit`
- Top-level variables:
  - `categories`, `e`

### `packages/web/src/components/support/TicketMetaPanel.js`

- Top-level variables:
  - `canReopen`, `e`

### `packages/web/src/components/support/TicketThread.js`

- Functions:
  - `roleStyle`
- Top-level variables:
  - `e`

### `packages/web/src/components/vninvestcharts/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/bridge/paneDescriptorBridge.js`

- Functions:
  - `buildScaleSlots`, `buildSeriesSpecs`, `createPaneSpecFromDescriptor`, `createPaneSpecsFromDescriptors`, `createScaleSlotId`, `inferPaneKind`
- Top-level variables:
  - `PANE_KIND_BY_ID`, `activeSeries`, `fallbackScaleSlotId`, `hasLeftAxis`, `hasRightAxis`, `scaleSlots`, `slotBySide`, `slotSides`, `style`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/bridge/paneDescriptorBridge.test.js`

- Top-level variables:
  - `paneSpec`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/AxisGridRenderCache.js`

- Classes:
  - `AxisGridRenderCache`
- Functions:
  - `buildAxisGridCacheKey`, `cacheDimensions`, `safeDomain`
- Top-level variables:
  - `existing`, `leftWidth`, `offscreen`, `offscreenCtx`, `rightWidth`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/AxisGridRenderCache.test.js`

- Classes:
  - `FakeOffscreenCanvas`
- Functions:
  - `createContextMock`, `makeOptions`
- Top-level variables:
  - `cache`, `ctx`, `first`, `isMiss`, `options`, `originalOffscreenCanvas`, `renderer`, `second`, `third`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/AxisGridRenderer.js`

- Classes:
  - `AxisGridRenderer`
- Functions:
  - `calculateTicks`, `formatAxisLabel`, `normalizeDomain`, `renderAxisLabels`, `resolveThemePalette`, `yForValue`
- Top-level variables:
  - `abs`, `base`, `delta`, `domain`, `epsilon`, `firstTick`, `gridDomain`, `label`, `palette`, `plotBounds`, `power`, `range`, `ratio`, `rawInterval`, `step`, `targetTickCount`, `themeMode`, `ticks`, `x`, `y`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/AxisGridRenderer.test.js`

- Functions:
  - `createCanvasContextMock`
- Top-level variables:
  - `ctx`, `renderer`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/BarRenderer.js`

- Classes:
  - `BarRenderer`
- Functions:
  - `resolveColor`, `toRoundedPixel`
- Top-level variables:
  - `barWidth`, `baselineY`, `datum`, `fallback`, `halfBarWidth`, `height`, `left`, `negativeColor`, `opacity`, `positiveColor`, `rawHeight`, `roundedX`, `roundedY`, `top`, `value`, `valueAccessor`, `x`, `xAccessor`, `y`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/BarRenderer.test.js`

- Functions:
  - `createContextMock`
- Top-level variables:
  - `ctx`, `data`, `renderer`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/CandlestickRenderer.js`

- Classes:
  - `CandlestickRenderer`
- Functions:
  - `resolveColor`, `toRoundedPixel`
- Top-level variables:
  - `DEFAULT_DOWN_COLOR`, `DEFAULT_UP_COLOR`, `barWidth`, `bodyBottom`, `bodyHeight`, `bodyTop`, `close`, `closeAccessor`, `closeY`, `datum`, `directionColor`, `fillColor`, `halfWidth`, `high`, `highAccessor`, `highY`, `isUp`, `left`, `low`, `lowAccessor`, `lowY`, `mode`, `opacity`, `open`, `openAccessor`, `openY`, `strokeColor`, `strokeWidth`, `wickBottom`, `wickColor`, `wickTop`, `x`, `xAccessor`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/CandlestickRenderer.test.js`

- Classes:
  - `SoftwareRasterContext`
- Functions:
  - `createContextMock`, `createPixelContext`, `renderCanonicalBaselinePng`
- Top-level variables:
  - `actualPng`, `alpha`, `bars`, `baseData`, `baselinePath`, `blue`, `bottom`, `color`, `context`, `ctx`, `dx`, `dy`, `endX`, `endY`, `error`, `expectedPng`, `green`, `hex`, `left`, `normalized`, `offset`, `png`, `previous`, `red`, `renderer`, `right`, `startX`, `startY`, `sx`, `sy`, `top`, `twiceError`, `x0`, `x1`, `y0`, `y1`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/CrosshairRenderer.js`

- Classes:
  - `CrosshairRenderer`
- Top-level variables:
  - `strokeColor`, `x`, `y`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/CrosshairRenderer.test.js`

- Functions:
  - `createContextMock`
- Top-level variables:
  - `ctx`, `renderer`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/LineAreaRenderer.js`

- Classes:
  - `LineAreaRenderer`
- Functions:
  - `resolveColor`, `toRoundedPixel`
- Top-level variables:
  - `barWidth`, `baselineY`, `datum`, `existing`, `firstPoint`, `halfBarWidth`, `height`, `left`, `lineWidth`, `mode`, `next`, `opacity`, `pointCount`, `points`, `rawPoints`, `shouldUseWebGL`, `top`, `value`, `valueAccessor`, `webglRenderer`, `x`, `xAccessor`, `xyPoints`, `y`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/LineAreaRenderer.test.js`

- Functions:
  - `createContextMock`
- Top-level variables:
  - `badData`, `canvas`, `context`, `ctx`, `mixedData`, `renderer`, `sampleData`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/WebGLLineRenderer.js`

- Classes:
  - `WebGLLineRenderer`
- Functions:
  - `buildThickLineVertices`, `hexToRgba`
- Top-level variables:
  - `FRAGMENT_SHADER_SOURCE`, `VERTEX_SHADER_SOURCE`, `a`, `b`, `dx`, `dy`, `fragmentShader`, `g`, `half`, `length`, `normalized`, `nx`, `ny`, `ox`, `oy`, `program`, `r`, `shader`, `vertexShader`, `vertices`, `webglCanvas`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/canvas/WebGLLineRenderer.test.js`

- Functions:
  - `createCanvasWithoutWebGL`
- Top-level variables:
  - `canvas`, `renderer`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/coordinateBridge.js`

- Functions:
  - `clampIndexFloat`, `clampIndexInt`, `resolvePaneDataIndexAtPixel`, `resolvePanePixelAtDataIndex`, `resolvePanePixelAtValue`, `resolvePaneValueAtPixel`, `visibleRangeFromPlotBounds`
- Top-level variables:
  - `clampedIndex`, `index`, `projector`, `scaleSlotState`, `y`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/coordinateBridge.test.js`

- Top-level variables:
  - `hitTestedIndex`, `leftOffscreenPixel`, `projectedPixel`, `rangeWithNegative`, `rightOffscreenPixel`, `snapshot`, `visibleRange`, `xFromFractionalIndex`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/legacyForkParityHarness.test.js`

- Functions:
  - `createLegacyProjectorOracle`
- Top-level variables:
  - `cameraFrames`, `domain`, `forkProjector`, `fractionalFrame`, `from`, `legacyProjector`, `maxValue`, `minValue`, `pixel`, `projector`, `roundTripIndex`, `roundTripValue`, `sampleIndices`, `samplePixels`, `sampleValues`, `sampleYPixels`, `snapshot`, `span`, `to`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/paneProjector.js`

- Functions:
  - `clampSharedEnvelopeIndex`, `createPaneProjector`, `indexToPixelX`, `pixelXToIndex`, `pixelYToValue`, `resolveScaleDomain`, `resolveVisibleBounds`, `valueToPixelY`
- Top-level variables:
  - `SHARED_ENVELOPE_MAX_ABS_INDEX`, `SHARED_ENVELOPE_MIN_SPAN`, `domain`, `ratio`, `rawFrom`, `rawSpan`, `rawTo`, `scaleSlotState`, `span`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/paneProjector.test.js`

- Top-level variables:
  - `leftOffscreen`, `projector`, `rightOffscreen`, `snapshot`, `visibleRange`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/projectorInvariants.test.js`

- Top-level variables:
  - `candleX`, `centerIndex`, `centerPixel`, `drawingX`, `index`, `indicatorX`, `invalidProjector`, `offscreenIndices`, `pixel`, `projector`, `reversedProjector`, `roundTrip`, `roundTripPixel`, `snapshot`, `visibleRange`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/timeIndexMap.js`

- Functions:
  - `createDateTimeIndexMap`, `createTimeIndexMap`, `resolveInterpolatedIndexByTime`, `resolveInterpolatedTimeByIndex`
- Top-level variables:
  - `firstTime`, `high`, `lastTime`, `leftIndex`, `leftTime`, `low`, `mid`, `midTime`, `penultimateTime`, `ratio`, `rightIndex`, `rightTime`, `secondTime`, `timestamps`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/coordinates/timeIndexMap.test.js`

- Top-level variables:
  - `afterLast`, `beforeFirst`, `data`, `map`, `midTime`, `resolved`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/CandlestickLodWorkerLane.js`

- Classes:
  - `CandlestickLodWorkerLane`
- Functions:
  - `toCandlestickLodData`, `toCandlestickLodWorkerInput`
- Top-level variables:
  - `abortController`, `activeRequest`, `cached`, `domain`, `firstX`, `lastX`, `lodData`, `pending`, `requestKey`, `workerInput`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/CandlestickLodWorkerLane.test.js`

- Functions:
  - `createCandles`
- Top-level variables:
  - `aggregateSpy`, `cache`, `data`, `lane`, `resolution`, `schedulePlotRender`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/derivedCache.js`

- Functions:
  - `appendTailCache`, `buildBuckets`, `computeBucket`, `createDerivedCache`, `prependHeadCache`, `queryYRange`, `replaceAllCache`
- Top-level variables:
  - `DEFAULT_BUCKET_SIZE`, `buckets`, `end`, `found`, `headBuckets`, `lastBucketIndex`, `max`, `min`, `recomputedBuckets`, `shiftedTail`, `stableBuckets`, `v`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/derivedCache.test.js`

- Functions:
  - `makeBars`
- Top-level variables:
  - `allBars`, `bars`, `bars2`, `bucket0Before`, `bucket1Before`, `bucketsRef`, `cache`, `cache2`, `emptyCache`, `newBars`, `prependBars`, `r1`, `r2`, `result`, `stableHeadBuckets`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/dirtyMask.js`

- Top-level variables:
  - `DirtyFlag`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/indicatorAccessors.js`

- Functions:
  - `buildIndicatorValuesKey`, `get`, `getAccessorFor`, `num`, `numParam`
- Top-level variables:
  - `INDICATOR_ACCESSORS`, `af`, `b`, `baseType`, `bear`, `bull`, `delta`, `dotIndex`, `f`, `fp`, `key`, `m1`, `m2`, `max`, `obj`, `p`, `rt`, `s`, `sd`, `sg`, `sl`, `sp`, `subField`, `t`, `v`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/indicatorAccessors.test.js`

- Functions:
  - `datum`
- Top-level variables:
  - `acc`, `acc13`, `acc20`, `d`, `empty`, `mod`, `result`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/KernelEngine.js`

- Classes:
  - `KernelEngine`
- Functions:
  - `clampOverlayIndex`, `clampUnit`, `cloneDrawingPrimitiveInput`, `cloneDrawingPrimitiveState`, `cloneLogicalMeasurementPoint`, `cloneLogicalMeasurementSelection`, `cloneOverlayCanvasPoint`, `cloneOverlayCanvasPrimitive`, `cloneOverlayInputs`, `cloneOverlayState`, `flush`, `normalizeHexColor`, `projectPoint`, `resolvePreferredMeasurementScaleSlotId`, `resolvePreferredPriceLabelScaleSlotId`, `resolveVisibleScaleSlotIds`, `withAlpha`
- Top-level variables:
  - `CAMERA_RANGE_MAX_ABS_INDEX`, `DEFAULT_HEIGHT`, `DEFAULT_LOCALE`, `DEFAULT_OVERLAY_INPUTS`, `DEFAULT_THEME`, `DEFAULT_VISIBLE_RANGE`, `DEFAULT_WIDTH`, `MAX_VISIBLE_BARS`, `SHARED_ENVELOPE_MAX_BAR_SPACE_PX`, `SHARED_ENVELOPE_MIN_BAR_SPACE_PX`, `accessors`, `aggregate`, `aggregates`, `anchorSpan`, `asArea`, `axisCacheKey`, `b`, `barStep`, `barWidth`, `baseColor`, `baseLineWidth`, `bestDistance`, `bottom`, `bottomSnapshot`, `boundedLength`, `bucketCenter`, `bucketEnd`, `bucketProjector`, `c`, `cache`, `cacheKey`, `cached`, `candleWidthRatio`, `canvas`, `center`, `centerX`, `channel`, `clampedFrom`, `clampedSpan`, `clippedPrimitives`, `close`, `color`, `combinedValues`, `configuredBarFill`, `context`, `ctx`, `current`, `currentDomain`, `currentSpan`, `customDomain`, `d`, `data`, `dataIndex`, `dataLen`, `datum`, `delta`, `diffY`, `direct`, `distance`, `domain`, `domains`, `drawingPrimitive`, `drawingPrimitives`, `effectiveDataLen`, `end`, `existing`, `expanded`, `fallbackAccessor`, `fill`, `fillMode`, `fillOpacity`, `fillStyle`, `finiteValues`, `from`, `fromIndex`, `fromWorker`, `g`, `gradient`, `halfSpan`, `hasManualScale`, `height`, `hex3`, `hex6`, `hex8`, `high`, `hit`, `hoverPoint`, `hoveredDataIndex`, `hoveredSnapshot`, `index`, `indexDelta`, `isDerivedSubSeries`, `labels`, `lastIndex`, `leftAxis`, `leftSlot`, `levels`, `lineWidth`, `listeners`, `lodBarWidth`, `lodBucketSize`, `lodData`, `lodRequestKey`, `lodResolution`, `low`, `lower`, `lowerPoints`, `lowerValues`, `mask`, `match3`, `match8`, `matchedValueCount`, `matchedValueSum`, `max`, `maxBarWidth`, `maxHigh`, `maxSpan`, `maxValue`, `maxY`, `maxZoomSpan`, `min`, `minLow`, `minSpan`, `minValue`, `minY`, `missingValueFallback`, `mode`, `modeMap`, `newDomain`, `newFrom`, `newSpan`, `newTo`, `nextArcLevels`, `nextBaseRadius`, `nextLabelPos`, `nextLabels`, `nextLevelLines`, `nextOverlayState`, `nextPaths`, `nextPoint`, `nextPointMarkers`, `nextPoints`, `nextPolygons`, `nextRadius`, `nextSegments`, `nextSemanticBadges`, `nextSpan`, `nextVerticalMarkers`, `normalizedHex`, `normalizedMax`, `normalizedMin`, `oldSpan`, `open`, `overlapSpan`, `overlayCanvas`, `overlayLodBucketSize`, `overlayState`, `overlayStateKey`, `paddedMax`, `paddedMin`, `panePrimitives`, `paneSnapshotsKey`, `paneSpec`, `paramsAwareAccessor`, `parts`, `pivotFraction`, `pivotIndex`, `pixelsPerBar`, `plotBounds`, `points`, `position`, `prevLength`, `price`, `priceShift`, `primaryPane`, `projected`, `projector`, `px`, `py`, `r`, `range`, `ratio`, `raw`, `rawDeltaBars`, `rawDomain`, `rawFillColor`, `rawMode`, `rawOpacity`, `rawVals`, `result`, `rgbaMatch`, `right`, `rightAxis`, `rightSlot`, `runtimeSeriesData`, `runtimeWindow`, `safeAlpha`, `safeCount`, `sampleValues`, `scaleSlotId`, `scaled`, `scaledSpan`, `seenIndices`, `selectedPriceLabels`, `sharesCandlestickLane`, `side`, `slice`, `sliced`, `slot`, `slotDomain`, `slotDomains`, `snapshot`, `span`, `start`, `state`, `step`, `stepPx`, `strokeWidth`, `style`, `subColor`, `subColorKey`, `subColors`, `surface`, `t`, `targetFrom`, `targetTo`, `tickCount`, `ticks`, `to`, `toIndex`, `toIndexExclusive`, `totalDeltaPx`, `type`, `unclippedPrimitives`, `upper`, `upperPoints`, `upperValues`, `value`, `values`, `visibleBarCount`, `visibleBars`, `visibleCount`, `visibleScaleSlotIds`, `wasMeasurementEnabled`, `width`, `window`, `windowLength`, `x`, `xViewport`, `y`, `yScale`, `zoomDirection`, `zoomMultiplier`, `zoomScale`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/KernelEngine.test.js`

- Functions:
  - `createCanvasContextMock`, `createPointerEvent`, `createTrackingCanvasContextMock`, `renderAtRange`
- Top-level variables:
  - `accessorSpy`, `after`, `afterZoomOutRange`, `allBars`, `appendedBars`, `bars`, `base`, `before`, `bollingerPanes`, `cam`, `camera`, `cameraBaseline`, `candleCall`, `candleData`, `candleOptions`, `candlePanes`, `candleRenderSpy`, `candleSpy`, `canvas`, `canvases`, `clearRectMock`, `committedAfterZoom`, `committedBeforeZoom`, `container`, `context`, `contextMock`, `crosshairCallIndex`, `current`, `currentRange`, `dash`, `deepZoomRange`, `defaultWidth`, `domain`, `draftMeasurement`, `drawingPriceLabels`, `drawingPrimitives`, `dualAxisPanes`, `dualEmaPanes`, `emaPanes`, `emitted`, `engine`, `enrichedBars`, `event`, `expectedBarWidth`, `extendedBaseline`, `extendedRange`, `fillRectCalls`, `fillStyles`, `firstFillRectCall`, `getContextSpy`, `hit`, `initialTicks`, `interactionListener`, `kdjPanes`, `latestCall`, `latestLeavePayload`, `latestMovePayload`, `leftDomain`, `leftHigh`, `lineCall`, `linePane`, `lineSpy`, `lineWidths`, `macdPanes`, `mask`, `measurementAfterLeave`, `moreBars`, `moveEvent`, `origStroke`, `originalCancelRaf`, `originalRaf`, `overlay`, `overlayContext`, `overlayPoints`, `overlayStateListener`, `paneListener`, `panes`, `panesWithCandleAndVolume`, `panesWithSeries`, `pannedTicks`, `plotBounds`, `plotContext`, `plotWidth`, `prependedBars`, `priceBodies`, `priceBody`, `pricePlot`, `primitiveInputs`, `range`, `rangeAfter`, `rangeAfterAppend`, `rangeBefore`, `rangeBeforeAppend`, `rangeListener`, `renderedData`, `replayedCamera`, `replayedRange`, `restoreMock`, `rightDomain`, `rightLow`, `runtimeData`, `setLineDashMock`, `shrunkBars`, `smallZoomOutEvent`, `snapshots`, `span`, `strokeCallCount`, `strokeCalls`, `strokeStyles`, `superShrunkBars`, `transientBars`, `validBars`, `values`, `visibleBarCount`, `volumeBodies`, `volumeBody`, `volumePlot`, `wheelEvent`, `width`, `widths`, `y`, `zoomInEvent`, `zoomedTicks`, `zoomedWidth`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/KernelEngine.workerLod.test.js`

- Functions:
  - `createCanvasContextMock`
- Top-level variables:
  - `bars`, `candlePanes`, `container`, `contextMock`, `engine`, `getContextSpy`, `resolveSpy`, `workerLodData`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/LodBucketizer.js`

- Functions:
  - `aggregateOhlc`, `chooseLodBucketSize`
- Top-level variables:
  - `bucketSize`, `c`, `candlesPerPixel`, `end`, `first`, `high`, `i`, `last`, `low`, `minBucketSize`, `result`, `volume`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/LodBucketizer.test.js`

- Functions:
  - `makeCandle`
- Top-level variables:
  - `bucket`, `candles`, `result`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/LodBucketizer.worker.js`

- Top-level variables:
  - `response`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/LodBucketizerAsync.js`

- Functions:
  - `aggregateOhlcAsync`, `cleanup`, `createAbortError`, `createLodBucketizerWorker`, `handleAbort`, `resolveWorkerError`, `runWorkerAggregation`, `settle`, `shouldUseLodWorker`
- Top-level variables:
  - `LOD_WORKER_THRESHOLD`, `error`, `nextLodWorkerRequestId`, `requestId`, `settled`, `useWorker`, `worker`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/LodBucketizerAsync.test.js`

- Classes:
  - `MockLodWorker`
- Functions:
  - `createCandle`
- Top-level variables:
  - `candles`, `controller`, `promise`, `requestId`, `result`, `worker`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/MemoryBudgetPolicy.js`

- Classes:
  - `MemoryBudgetPolicy`
- Top-level variables:
  - `keysToEvict`, `remaining`, `sorted`, `total`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/MemoryBudgetPolicy.test.js`

- Functions:
  - `makeChunk`
- Top-level variables:
  - `chunks`, `chunks2`, `plan`, `planA`, `planB`, `policy`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/PerfHarness.js`

- Classes:
  - `PerfHarness`
- Functions:
  - `computeStats`
- Top-level variables:
  - `OVERLAY_MASK`, `PLOT_AXIS_GRID_MASK`, `durations`, `max`, `overlayOnlyFrames`, `p50`, `p95`, `report`, `total`, `totalAxisGridCalls`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/engine/PerfHarness.test.js`

- Functions:
  - `makeFrame`
- Top-level variables:
  - `AXIS`, `FULL`, `OVERLAY`, `PLOT`, `harness`, `json`, `parsed`, `report`, `reports`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/index.js`

- Functions:
  - `createEngine`
- Top-level variables:
  - `version`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/indicator/canonicalSeriesStore.js`

- Classes:
  - `CanonicalSeriesStore`
- Functions:
  - `createCanonicalSeriesStore`
- Top-level variables:
  - `globalCanonicalSeriesStore`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/indicator/indicatorCatalog.js`

- Functions:
  - `_clearCatalogForTests`, `getDefaultIndicatorParams`, `listIndicators`, `lookupIndicator`, `registerIndicator`, `registerIndicators`, `resolveIndicatorParams`
- Top-level variables:
  - `_catalog`, `defaults`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/indicator/indicatorKernel.test.js`

- Top-level variables:
  - `a`, `b`, `base`, `defaults`, `diffPeriod`, `diffType`, `entry`, `ids`, `input`, `input1`, `input2`, `key`, `other`, `pane1Input`, `pane2Input`, `resolved`, `result`, `series`, `store`, `structured`, `viaInput`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/indicator/indicatorSeriesKey.js`

- Functions:
  - `buildIndicatorSeriesKey`, `buildIndicatorSeriesKeyString`, `indicatorSeriesKeyToString`, `indicatorSeriesKeysEqual`, `normalizeIndicatorParams`
- Top-level variables:
  - `normalizedEntries`, `normalizedParams`, `sortedKeys`, `transformKey`, `value`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/interaction/InteractionController.js`

- Classes:
  - `InteractionController`
- Functions:
  - `createInteractionCommand`
- Top-level variables:
  - `DRAG_START_THRESHOLD_PX`, `context`, `delta`, `deltaFromPress`, `deltaFromPressY`, `deltaX`, `deltaY`, `eventWithOffsets`, `midpointClientX`, `midpointClientY`, `nextDistance`, `pinchPair`, `pivotX`, `pivotY`, `rect`, `scaleRatio`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/interaction/InteractionController.test.js`

- Functions:
  - `createPointerEvent`, `expectPointerContext`, `makeCallbacks`, `makeCanvas`
- Top-level variables:
  - `callbacks`, `cancel`, `canvas`, `click`, `command`, `contextMenu`, `controller`, `doubleClick`, `down`, `event`, `move`, `pointer`, `up`, `wheelEvent`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasGroupOps.js`

- Functions:
  - `deleteDrawingGroup`, `resolveDrawingGroupMemberIds`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasGroupOps.test.js`

- Top-level variables:
  - `drawings`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasMeasurement.js`

- Functions:
  - `measurementPointToPixelFromScales`, `resolveMeasurementIndex`, `resolveMeasurementPointFromValues`, `summarizeMeasurement`, `toDate`
- Top-level variables:
  - `bars`, `bestDistance`, `bestIndex`, `candidateDate`, `distance`, `index`, `priceDelta`, `priceDeltaPercent`, `x`, `xValue`, `y`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasMeasurement.test.js`

- Top-level variables:
  - `pixelPoint`, `plotData`, `point`, `xScale`, `yScale`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlayGeometry.js`

- Functions:
  - `clipOverlaySegmentToBox`, `measureOverlayCalloutBox`, `measureOverlayPriceLabelTag`, `pointInOverlayTriangle`, `triangleSign`
- Top-level variables:
  - `d1`, `d2`, `d3`, `dx`, `dy`, `edges`, `hasNegative`, `hasPositive`, `height`, `label`, `paddingX`, `paddingY`, `r`, `t0`, `t1`, `width`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlayHitTest.js`

- Functions:
  - `distanceToPolyline`, `distanceToSegment`, `hitTestBarsCountLike`, `hitTestCalloutLike`, `hitTestCircleLike`, `hitTestDateRangeLike`, `hitTestEllipseLike`, `hitTestExtendedLineLike`, `hitTestFibArcLevels`, `hitTestHorizontalLevelSet`, `hitTestHorizontalLine`, `hitTestLineLike`, `hitTestOverlayPrimitive`, `hitTestPathSet`, `hitTestPolygonSet`, `hitTestPriceLabelLike`, `hitTestPriceRangeLike`, `hitTestRectangleLike`, `hitTestSegmentSet`, `hitTestTextLike`, `hitTestTriangleLike`, `hitTestVerticalLine`, `hitTestVerticalMarkerSet`, `isAngleWithinArc`, `isOverlayPrimitiveHitTestSupported`, `normalizeAngle`, `pointInPolygon`, `pointInRect`
- Top-level variables:
  - `SUPPORTED_PRIMITIVE_TYPES`, `angle`, `best`, `bounds`, `box`, `centerX`, `centerY`, `clipped`, `distance`, `distanceFromCenter`, `dx`, `dy`, `end`, `extensionDistance`, `fontSize`, `full`, `height`, `inside`, `intersects`, `lengthSquared`, `normalized`, `normalizedTolerance`, `point`, `prior`, `radius`, `radiusX`, `radiusY`, `start`, `t`, `tag`, `tagY`, `text`, `width`, `x`, `x1`, `x2`, `y`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlayHitTest.test.js`

- Functions:
  - `primitive`
- Top-level variables:
  - `abcdPattern`, `barsCount`, `callout`, `channel`, `circle`, `cyclicLines`, `dateRange`, `elliottImpulse`, `ellipse`, `extendedLine`, `fibArc`, `fibArcs`, `fibCircles`, `fibExtension`, `fibFan`, `fibSpiral`, `fibTime`, `fibTimeZone`, `fibonacci`, `gannBox`, `gannFan`, `headAndShoulders`, `hit`, `longPosition`, `options`, `parallelChannel`, `pitchfork`, `polyline`, `priceLabel`, `priceRange`, `ray`, `rect`, `regressionChannel`, `text`, `triangle`, `xabcdPattern`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlayRenderer.js`

- Functions:
  - `applyLineStyle`, `drawArrow`, `drawArrowhead`, `drawBarsCount`, `drawCallout`, `drawCircle`, `drawDateAndPriceRange`, `drawDateRange`, `drawEllipse`, `drawExtendedLine`, `drawFibArcLevels`, `drawHorizontalLevelSet`, `drawHorizontalLine`, `drawLine`, `drawOverlayLabels`, `drawOverlayPaths`, `drawOverlayPointMarkers`, `drawOverlayPolygons`, `drawOverlaySegments`, `drawOverlaySemanticBadges`, `drawPolyline`, `drawPolylinePrimitive`, `drawPriceLabel`, `drawPriceRange`, `drawRay`, `drawRectangle`, `drawSelectionHandles`, `drawText`, `drawTextPrimitive`, `drawTrendLine`, `drawTriangle`, `drawVerticalLine`, `drawVerticalMarkerSet`, `mergeStyle`, `renderOverlayPrimitiveToCanvas`, `resolveLineExtension`, `safeArc`, `safeEllipse`, `safeRoundRect`, `strokeDasharrayForStyle`
- Top-level variables:
  - `accent`, `arcLevels`, `arrowHead`, `arrowY`, `badgeHeight`, `badgeWidth`, `badgeX`, `badgeY`, `bandHeight`, `bandWidth`, `base`, `bottom`, `box`, `centerX`, `centerY`, `clipped`, `color`, `dx`, `dy`, `extensionDistance`, `fillBase`, `fontSize`, `headLength`, `headWidth`, `height`, `isFocused`, `isUp`, `label`, `labelHeight`, `labelPosition`, `labelWidth`, `labelX`, `labelY`, `left`, `length`, `levels`, `markers`, `midX`, `midY`, `padX`, `px`, `py`, `radius`, `radiusX`, `radiusY`, `right`, `ringRadius`, `tag`, `tagY`, `textWidth`, `tickHeight`, `top`, `ux`, `uy`, `width`, `x`, `x1`, `x2`, `y`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlayRenderer.test.js`

- Functions:
  - `createContextMock`, `primitive`
- Top-level variables:
  - `context`, `ctx`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlaySnap.js`

- Functions:
  - `findNearestOverlayEndpointSnap`
- Top-level variables:
  - `MAGNET_TOLERANCE`, `best`, `distance`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/overlay/canvasOverlaySnap.test.js`

- Top-level variables:
  - `snap`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/pane/PaneLayoutEngine.js`

- Classes:
  - `PaneLayoutEngine`
- Functions:
  - `cloneBounds`, `clonePaneRuntimeSnapshot`, `cloneScaleSlotRuntimeState`, `collectVisibleScaleSlots`, `createScaleSlotRuntimeState`, `normalizeVisiblePanes`
- Top-level variables:
  - `DEFAULT_AXIS_WIDTH`, `axisBounds`, `bounds`, `cursorTop`, `globalLeftAxisWidth`, `globalRightAxisWidth`, `hasAnyLeftAxis`, `hasAnyRightAxis`, `isLastPane`, `leftAxisWidth`, `leftBounds`, `leftSlots`, `paneHeight`, `plotBounds`, `plotWidth`, `remainingHeight`, `rightAxisWidth`, `rightBounds`, `rightSlots`, `scaleSlotBounds`, `scaleSlotStates`, `top`, `totalRatio`, `visiblePanes`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/pane/PaneLayoutEngine.test.js`

- Top-level variables:
  - `layout`, `panes`, `snapshots`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/src/upstream.js`

- Top-level variables:
  - `UPSTREAM_BASELINE`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-core/tsup.config.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/src/EngineHost.js`

- Functions:
  - `EngineHost`
- Top-level variables:
  - `hostStyle`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/src/EngineHost.test.js`

- Functions:
  - `createMockEngine`
- Top-level variables:
  - `canvas`, `container`, `host`, `mockOverlayState`, `mockPaneSnapshots`, `mockVisibleRange`, `mountedSurface`, `onClick`, `onContextMenu`, `onDoubleClick`, `onOverlayStateChange`, `onPaneHover`, `onPaneSnapshotsChange`, `onPointerCancel`, `onPointerDown`, `onPointerLeave`, `onPointerMove`, `onPointerUp`, `onVisibleRangeChange`, `panes`, `reactActEnvironment`, `root`, `subscribe`, `surface`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/src/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/src/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/src/useEngineHost.js`

- Functions:
  - `resolveHoveredPaneId`, `resolvePointerContext`, `useEffectEvent`, `useEngineHost`
- Top-level variables:
  - `DEFAULT_OVERLAY_INPUTS`, `LONG_PRESS_DELAY_MS`, `LONG_PRESS_MOVE_THRESHOLD_PX`, `PANE_HEADER_HEIGHT`, `bottom`, `clearLongPress`, `container`, `containerRef`, `context`, `deltaX`, `deltaY`, `emitContextMenu`, `engine`, `engineRef`, `headerBottom`, `headerTop`, `hoveredPaneIdRef`, `hoveredSnapshot`, `localX`, `localY`, `longPressContextRef`, `longPressPointerIdRef`, `longPressStartRef`, `longPressTimerRef`, `notifyEngineDispose`, `notifyEngineReady`, `notifyPaneHover`, `observer`, `pendingContext`, `rect`, `ref`, `resolvedOverlayInputs`, `right`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/src/usePaneChromeBridge.js`

- Functions:
  - `useEffectEvent`, `usePaneChromeBridge`
- Top-level variables:
  - `lastOverlayStateKeyRef`, `lastPaneSnapshotsKeyRef`, `lastVisibleRangeRef`, `nextOverlayState`, `nextOverlayStateKey`, `nextSnapshots`, `nextSnapshotsKey`, `nextVisibleRange`, `ref`, `serializeOverlayState`, `serializePaneSnapshots`, `syncOverlayState`, `syncPaneSnapshots`, `syncVisibleRange`, `unsubscribeOverlayState`, `unsubscribePanes`, `unsubscribeVisibleRange`

### `packages/web/src/components/vninvestcharts/packages/vn-kline-engine-react/tsup.config.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/chartRange.test.js`

- Functions:
  - `buildBars`
- Top-level variables:
  - `data`, `end`, `fetchStart`, `insufficientData`, `satisfiedData`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/demoData.test.js`

- Functions:
  - `makeResponse`
- Top-level variables:
  - `bars`, `currentBars`, `fetchMock`, `firstPage`, `merged`, `olderBars`, `secondPage`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/heikinAshi.test.js`

- Functions:
  - `makeBar`
- Top-level variables:
  - `bars`, `expectedSecondOpen`, `firstClose`, `input`, `result`, `secondClose`, `snapshot`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/historyFetchQueue.test.js`

- Top-level variables:
  - `job`, `q`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/historySchedulerPolicy.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/historyWindowPlanner.test.js`

- Top-level variables:
  - `data`, `loaded`, `next`, `previous`, `result`, `seg`, `target`, `viewport`, `window`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/i18n.test.js`

- Functions:
  - `DemoI18nProbe`
- Top-level variables:
  - `DemoI18nBoundary`, `act`, `container`, `createRoot`, `originalConsoleError`, `probe`, `reactActEnvironment`, `root`, `setLanguageForTest`, `useDemoI18n`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/LibraryShowcaseDemo.runtimeSelection.test.js`

- Top-level variables:
  - `persisted`, `settings`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/LibraryShowcaseDemo.statusBadge.test.js`

- Functions:
  - `t`
- Top-level variables:
  - `badge`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/maxVisibleBarsIntegration.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/mobileToolLongPress.test.js`

- Top-level variables:
  - `vibrate`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/PaneSettingsModal.test.js`

- Functions:
  - `noop`
- Top-level variables:
  - `DemoI18nBoundary`, `PaneSettingsModal`, `act`, `container`, `createRoot`, `mockPaneState`, `onShowDrawingPriceMarkersChange`, `originalConsoleError`, `reactActEnvironment`, `root`, `toggleButton`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/PATTokenModal.test.js`

- Functions:
  - `changeInputValue`
- Top-level variables:
  - `apiBaseInput`, `client`, `container`, `fetchMock`, `loginButton`, `onClose`, `onConfigChange`, `onSaved`, `onSourceChange`, `passwordInput`, `patInput`, `reactActEnvironment`, `root`, `saveButton`, `sourceButtons`, `usernameInput`, `valueSetter`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/replayHelpers.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/residentWindowPolicy.test.js`

- Functions:
  - `createBars`
- Top-level variables:
  - `bars`, `next`, `visibleStart`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/runtimeInvalidationBatch.test.js`

- Functions:
  - `cancelFrame`, `createManualFrameScheduler`, `flushAll`, `flushFrame`, `scheduleFrame`
- Top-level variables:
  - `batcher`, `cancelFrameSpy`, `capabilityCalls`, `capabilitySpy`, `flush`, `idSeed`, `paneCalls`, `paneSpy`, `scheduled`, `scheduledBeforeDispose`, `scheduler`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/runtimePolicy.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/runtimeQueryParams.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/SettingsRangeSlider.test.js`

- Top-level variables:
  - `container`, `labels`, `onChange`, `range`, `root`, `setInputValue`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/styleOverridesPersistence.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/useStockChartAdapter.integration.test.js`

- Functions:
  - `Harness`, `createWidgetBar`, `flushMicrotasks`, `makeSemantics`
- Top-level variables:
  - `adapter`, `backwardBars`, `bars`, `captureAdapter`, `container`, `dataAdapter`, `fetchBarsBefore`, `fetchBarsInRange`, `filtered`, `getBars`, `incoming`, `loaded`, `loadedRange`, `nowMs`, `offlineBars`, `rangeBars`, `reactActEnvironment`, `resident`, `root`, `semantics`, `staleFiltered`, `staleReplay`, `tooOldFiltered`, `tooOldReplay`, `weekendResident`, `weekendSegments`, `widgetBars`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/useStockChartAdapter.test.js`

- Functions:
  - `Harness`, `createDataAdapter`, `createWidgetBar`
- Top-level variables:
  - `adapter`, `captureAdapter`, `container`, `dataAdapter`, `firstAdapter`, `initialBars`, `nextBars`, `reactActEnvironment`, `root`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/VNSymbolSearch.test.js`

- Top-level variables:
  - `client`, `container`, `input`, `onChange`, `reactActEnvironment`, `root`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/WhalePanel.test.js`

- Top-level variables:
  - `WhalePanel`, `WidgetI18nProvider`, `act`, `consoleErrorSpy`, `container`, `createRoot`, `reactActEnvironment`, `root`, `sampleWhaleData`

### `packages/web/src/components/vninvestcharts/src/demo/__tests__/widgetVisibleDomainAuthority.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/ChartPaneSplitter.js`

- Functions:
  - `handlePointerDown`, `handlePointerMove`, `stopDragging`
- Top-level variables:
  - `applyDragDeltaRef`, `availableRef`, `drag`, `dragRef`, `node`, `rootRef`, `totalDelta`

### `packages/web/src/components/vninvestcharts/src/demo/chartRange.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/components/DataSourceSwitcher.js`

- Functions:
  - `DataSourceSwitcher`
- Top-level variables:
  - `sources`

### `packages/web/src/components/vninvestcharts/src/demo/components/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/components/PATTokenModal.js`

- Functions:
  - `PATTokenModal`, `applyApiBaseInput`, `handleBackdropClick`, `handleClearToken`, `handleFileChange`, `handleLogin`, `handleSaveBase`, `handleSaveToken`, `parseCSVBars`
- Top-level variables:
  - `accessToken`, `backdropRef`, `bars`, `changed`, `cols`, `currentBase`, `data`, `dataLines`, `file`, `fileInputRef`, `firstField`, `hasHeader`, `lines`, `open`, `p`, `reader`, `res`, `text`, `token`, `trimmed`, `ts`, `u`

### `packages/web/src/components/vninvestcharts/src/demo/config/toolGroups.js`

- Top-level variables:
  - `TOOL_GROUPS_V2`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/__tests__/barsPagingPolicy.test.js`

- Top-level variables:
  - `meta`, `request`, `sampleBars`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/__tests__/vninvest.test.js`

- Top-level variables:
  - `bars`, `calledUrl`, `client`, `ds`, `fetchMock`, `mockResponse`, `payload`, `report`, `response`, `responses`, `results`, `telemetryAfter`, `telemetryBefore`, `telemetryDelta`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/__tests__/VNInvestDataAdapter.test.js`

- Functions:
  - `makeMockClient`, `makeWhaleOrder`
- Top-level variables:
  - `adapter`, `cutoff`, `events`, `mockClient`, `newTs`, `oldTs`, `result`, `signal`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/__tests__/VNInvestWebSocketClient.test.js`

- Functions:
  - `connectAndFlush`, `createMockWebSocket`
- Top-level variables:
  - `MockWS`, `client`, `instance`, `lastCreatedSocket`, `msgs`, `onTicker`, `onWhale`, `payload`, `socket`, `socket1`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/barsPagingPolicy.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/demoDataSource.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/index.js`

- Classes:
  - `DemoDataSource`, `VNInvestDataSource`
- Functions:
  - `vniBarToRawOHLCV`
- Top-level variables:
  - `all`, `bars`, `q`, `stocks`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/VNInvestClient.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/VNInvestDataAdapter.js`

- Classes:
  - `VNInvestDataAdapter`
- Top-level variables:
  - `feed`, `flow`, `result`, `threshold`

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/vninvestDataSource.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/dataSources/VNInvestWebSocketClient.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/demoData.js`

- Functions:
  - `fetchBinanceKlinePage`, `fetchHistoricalDemoBars`, `formatBinanceKlineBars`, `getMs`, `getOfflineDemoBars`, `isBackfillGapExcessive`, `mergeBarsByDate`, `normalizeBars`, `parseCsvRow`, `parseDateTime`, `sortBars`, `toTimeValue`
- Top-level variables:
  - `BINANCE_BASE`, `BINANCE_INTERVAL_MAP`, `BINANCE_MAX_LIMIT`, `DEMO_WINDOW`, `INTERVAL_MS_MAP`, `MAX_CONTIGUOUS_GAP_MULTIPLIER`, `bars`, `binanceInterval`, `deduped`, `endTimeValue`, `gapMs`, `intervalMs`, `json`, `lastBar`, `merged`, `newestOlderTs`, `nextEndTime`, `oldestCurrentTs`, `pageBars`, `params`, `response`, `sorted`, `startTimeValue`, `url`

### `packages/web/src/components/vninvestcharts/src/demo/DemoPageShell.js`

- Top-level variables:
  - `frameClassNameValue`, `pageClassName`

### `packages/web/src/components/vninvestcharts/src/demo/demoSettings.js`

- Functions:
  - `isDemoRuntimeLane`, `isValidWidgetTimezone`, `loadDemoSettings`, `migrateRuntimeLaneToFork`, `normalizeDemoSettings`, `normalizeMaxVisibleBars`, `saveDemoSettings`
- Top-level variables:
  - `DEFAULT_DEMO_SETTINGS`, `DEFAULT_MAX_VISIBLE_BARS`, `DEFAULT_MAX_VISIBLE_PANES`, `DEMO_SETTINGS_STORAGE_KEY`, `LEGACY_DEMO_SETTINGS_STORAGE_KEY`, `MAX_VISIBLE_BARS_OPTIONS`, `PREVIOUS_DEMO_SETTINGS_STORAGE_KEY`, `VALID_WIDGET_TIMEZONES`, `floored`, `legacyRaw`, `migratedSettings`, `previousRaw`, `raw`

### `packages/web/src/components/vninvestcharts/src/demo/flyoutPosition.js`

- Functions:
  - `resolveFlyoutPosition`
- Top-level variables:
  - `estimatedFlyoutHeight`, `estimatedFlyoutWidth`, `maxLeft`, `maxTop`, `minLeft`, `minTop`, `nextLeft`, `nextTop`, `preferredTop`, `viewportHeight`, `viewportLeft`, `viewportTop`, `viewportWidth`

### `packages/web/src/components/vninvestcharts/src/demo/heikinAshi.js`

- Functions:
  - `transformHeikinAshi`
- Top-level variables:
  - `bar`, `close`, `high`, `low`, `open`, `result`

### `packages/web/src/components/vninvestcharts/src/demo/historyFetchQueue.js`

- Classes:
  - `HistoryFetchQueue`
- Functions:
  - `makeId`
- Top-level variables:
  - `candidates`, `existing`, `job`

### `packages/web/src/components/vninvestcharts/src/demo/historySchedulerPolicy.js`

- Functions:
  - `canRunHistoryScheduler`

### `packages/web/src/components/vninvestcharts/src/demo/historyWindowPlanner.js`

- Functions:
  - `computeLoadedWindow`, `computeMissingSegments`, `computeTargetWindow`, `shouldScheduleFetch`
- Top-level variables:
  - `leftMissing`, `leftRatio`, `leftTrigger`, `maxMs`, `minMs`, `ms`, `rightMissing`, `rightRatio`, `rightTrigger`, `span`

### `packages/web/src/components/vninvestcharts/src/demo/i18n.js`

- Functions:
  - `DemoI18nBoundary`, `DemoI18nProvider`, `formatSeriesDisplayName`, `formatSeriesSuffix`, `interpolate`, `numberParam`, `readStoredLanguage`, `translate`, `useDemoI18n`
- Top-level variables:
  - `DEMO_LANGUAGE_STORAGE_KEY`, `DemoI18nContext`, `SERIES_ABBREVIATIONS`, `abbreviation`, `baseLabel`, `context`, `defaultContextValue`, `getPaneLabel`, `key`, `paneLabelKeys`, `seriesLabelKeys`, `setLanguage`, `stored`, `suffix`, `t`, `template`, `translations`, `value`, `withSuffix`

### `packages/web/src/components/vninvestcharts/src/demo/index.js`

- Top-level variables:
  - `container`, `isStandalone`, `params`, `root`

### `packages/web/src/components/vninvestcharts/src/demo/LibraryShowcaseDemo.js`

- Functions:
  - `ToolIcon`, `areDrawingSnapshotsEqual`, `clonePoint`, `drawingChrome`, `fetchOrderFlow`, `fetchTape`, `formatBarsHeld`, `formatSignedPrice`, `getGroupMenuKey`, `getSelectedDrawingId`, `handleApplyTemplate`, `handleClearTemplate`, `handleDrawingShortcuts`, `handleEscape`, `handleKeyDown`, `handleKeyUp`, `handleWindowBlur`, `handler`, `isEditableTarget`, `isYAxisSide`, `normalizeDate`, `paneTemplate`, `persistStyleOverrides`, `readSize`, `resolveDrawingPlacementForPane`, `sortDrawings`
- Top-level variables:
  - `ALL_DRAWING_TOOL_IDS`, `ALL_DRAWING_TOOL_SET`, `BACKFILL_MAX_PAGES`, `BACKFILL_PAGE_LIMIT`, `DRAWING_PANEL_WIDTH`, `DRAWING_TOOL_FLYOUT_BUTTON_SIZE`, `DRAWING_TOOL_FLYOUT_GAP`, `DRAWING_TOOL_FLYOUT_MARGIN`, `DRAWING_TOOL_FLYOUT_PADDING`, `DRAWING_TOOL_FLYOUT_WIDTH`, `INITIAL_HISTORY_MAX_PAGES`, `INITIAL_HISTORY_TARGET_BARS`, `MOBILE_DRAWING_TOOL_FLYOUT_BUTTON_SIZE`, `MORE_TOOLS_FLYOUT_ID`, `PERCENT_FORMAT`, `REPLAY_SPEEDS`, `SCHEDULER_TICK_MS`, `TOOL_GROUPS`, `TOOL_SHORTCUT_BADGE`, `abortController`, `active`, `activeEl`, `activeInGroup`, `activeSourceRef`, `adapter`, `addPane`, `adjustedViewport`, `allPrices`, `altShortcutPressedRef`, `apiBase`, `applyActiveTool`, `applyDelta`, `applyResidentWindow`, `available`, `averageBarsHeld`, `averagePnl`, `backfillDebounceRef`, `backfillInFlightRef`, `bars`, `bestTrade`, `bringSelectedToFront`, `cancelled`, `candleTypeLabel`, `candleWidth`, `canvasBg`, `chartAdapter`, `chartData`, `chartRangeRef`, `chartReady`, `chartTimeframe`, `cleanSmokeMode`, `client`, `clipboardDrawing`, `cloneSelectedDrawing`, `closeDrawingContextMenu`, `closePaperTradePosition`, `closeReplayContextMenu`, `closeSettings`, `closedTrade`, `controller`, `copySelectedDrawing`, `currentBars`, `currentItem`, `currentLiveData`, `currentPosition`, `currentState`, `currentVisibleDomain`, `customIcon`, `data`, `dataAdapter`, `deleteDrawingById`, `demoRuntimePolicy`, `desiredType`, `dirLabel`, `domain`, `drawingClipboardRef`, `drawingContextMenuDrawing`, `drawingCountRef`, `drawingDockLabels`, `drawingDockPosition`, `drawingDockState`, `drawingInspectorLabels`, `drawingInteraction`, `drawingListPanelLabels`, `drawingPanelX`, `drawingSelectionSemanticPoints`, `drawingSelectionToolbarLabels`, `drawingSelectionToolbarModel`, `drawingSelectionToolbarPosition`, `drawingSemanticPointLegendLabels`, `drawingSnapshotsRef`, `drawingStorage`, `drawingTextEditorLabels`, `drawingUiStyleVars`, `earliestBar`, `effectiveRuntimeCapabilities`, `effectiveRuntimeLane`, `enrichedData`, `ensureRangeHistory`, `entry`, `existing`, `fallbackHeight`, `fallbackSelectedId`, `fallbackTop`, `file`, `first`, `firstBar`, `flyoutStyle`, `fresh`, `from`, `generation`, `getToolTouchHandlers`, `h`, `handleAddPane`, `handleCancelTextEdit`, `handleChartRangeChange`, `handleChartTypeChange`, `handleClearDrawings`, `handleCloseDrawingDock`, `handleCommitTextEdit`, `handleDrawingContextMenu`, `handleDrawingToolUsed`, `handleDrawingWorkspaceChange`, `handleExportDrawings`, `handleFileLoaded`, `handleImportButtonClick`, `handleImportFileChange`, `handleLoadDrawings`, `handleLoadVNIChart`, `handlePATSaved`, `handlePaneAddSeriesRequest`, `handlePaperTradeClick`, `handlePaperTradeClose`, `handlePaperTradeReset`, `handleReplayContextMenu`, `handleReplayFromHere`, `handleReplayJumpLatest`, `handleReplayRewind`, `handleReplaySpeedChange`, `handleReplayStepBack`, `handleReplayStepForward`, `handleReplayToggle`, `handleResetSettings`, `handleSelectionToolbarAction`, `handleSemanticPointFocusChange`, `handleSourceSwitch`, `handleStartTextEdit`, `handleTickerUpdate`, `handleTimeframeChange`, `handleToggleDrawingDock`, `handleToolbarToolPressEnd`, `handleToolbarToolPressStart`, `handleToolbarToolTap`, `handleVisibleDomainChange`, `handleVniConfigChange`, `handleVniSymbolChange`, `handleWidgetBarsChange`, `handleWidgetDrawingsChange`, `handleWidgetError`, `handleWidgetSelectedDrawingChange`, `hasAltModifier`, `hasDrawingSelection`, `hasTemplate`, `hasWidgetData`, `iconId`, `importInputRef`, `inFlyout`, `inToolbar`, `indicatorLegendLabels`, `indicatorSeries`, `initialDemoSettings`, `initialWarmupRequestedRef`, `innerHeight`, `innerWidth`, `intervalId`, `isAltRightClick`, `isCoarsePointerContext`, `isCompactDrawingToolbarViewport`, `isContextTrigger`, `isDrawingDockOpen`, `isEditingText`, `isInput`, `isMultiSelect`, `isNearOldestEdge`, `isObjectsDockActive`, `isOpen`, `isTouchLongPress`, `isTouchPointerContext`, `job`, `known`, `labels`, `last`, `lastBar`, `lastClick`, `lastPaperTradeClickRef`, `lastPaperTradeSignatureRef`, `lastViewportMissingRef`, `lastVisibleBar`, `latestBar`, `latestBars`, `layout`, `leftBufferMs`, `leftDrawing`, `leftZ`, `liveDataRef`, `liveMeasurementLabels`, `loaded`, `localCacheAdapter`, `localizePane`, `localizedMessage`, `localizedPane`, `losses`, `maxPrice`, `maxZ`, `message`, `minPrice`, `minZ`, `missing`, `mountedRef`, `msg`, `multiAllHidden`, `multiAllLocked`, `multiSelectedDrawings`, `nativeEvent`, `neededStart`, `newHigh`, `newLow`, `newPrice`, `nextBars`, `nextClone`, `nextDrawings`, `nextLabel`, `nextPaste`, `nextPosition`, `nextStartIndex`, `nextToast`, `nextWhaleData`, `node`, `normalizeDomain`, `normalizedBars`, `normalizedDomain`, `now`, `observer`, `offlineBars`, `ohlcStatusLabel`, `olderBars`, `oldestBar`, `openPATModal`, `openSettings`, `page`, `pagesLoaded`, `paneHeaderLabels`, `paneHeights`, `paneLabel`, `paneOverlayLayout`, `paneState`, `panesMenuRef`, `paperTradeJournal`, `paperTradePanelVisible`, `paperTradePositionRef`, `paperTradeRealizedPnl`, `paperTradeReportVisible`, `paperTradeSummary`, `paperTradeUnrealizedPnl`, `pasteCopiedDrawing`, `pat`, `patch`, `pendingChartRangeSyncRef`, `plotData`, `preferredSide`, `previousCount`, `previousSelectedDrawingIdRef`, `previousVisibleDomain`, `priceIsUp`, `priceOffset`, `pricePane`, `prices`, `primary`, `profileMenuRef`, `queueRef`, `railFavoriteTools`, `ratio`, `rawSegs`, `rawStyle`, `realizedPnl`, `rect`, `releaseWidgetVisibleDomainControlRef`, `renderWidgetPaneSplitter`, `renderWidgetPaneToolbar`, `replayController`, `replayControllerRef`, `replayFinished`, `replayProgressLabel`, `replayToggleTitle`, `replayVisibleData`, `requestId`, `requestOlderHistoryPage`, `resetToDefault`, `resolveToolFlyoutPosition`, `resolvedActiveTool`, `resolvedRuntimeForBadge`, `resolvedSelectedDrawing`, `resp`, `rightDrawing`, `rightZ`, `runtimeSelectedDrawingType`, `runtimeStatusBadge`, `scheduleForViewport`, `schedulerGenerationRef`, `second`, `segData`, `selectDrawingById`, `selectedDrawing`, `selectedDrawingId`, `selectedIds`, `selectedPane`, `selectedSymbol`, `sendSelectedToBack`, `shellNode`, `shellRef`, `shortcut`, `shouldControlWidgetSelection`, `shouldEvaluateViewportBackfill`, `showOhlcMetrics`, `signature`, `snapshot`, `snapshotMap`, `sortedDrawings`, `sourceEvent`, `stepPx`, `storageToolbarPosition`, `stored`, `styleData`, `supportsDrawingOverlays`, `supportsInteractiveChartOverlays`, `supportsMeasurementOverlay`, `suppressToolTapRef`, `sym`, `symbol`, `tagName`, `target`, `targetDrawing`, `targetId`, `targetReplayDate`, `targetSides`, `targetStart`, `templatesContent`, `timeOffset`, `timeframeMs`, `timer`, `to`, `toggleDrawingLockedById`, `toggleDrawingVisibleById`, `toggleSelectedLock`, `toggleSelectedVisible`, `toolLabel`, `toolLongPressTimerRef`, `toolTooltipAutoHideTimerRef`, `toolType`, `toolbarRef`, `topbarStatusBadge`, `totalTrades`, `transformed`, `triggerBackfillDebounced`, `unsubscribe`, `unsubscribeDrawings`, `unsubscribeSeries`, `updateSelectedDrawing`, `updateVisibleDomain`, `useWidgetOwnedHistory`, `viewport`, `viewportMetrics`, `viewportStart`, `visibleDomainRef`, `visiblePanes`, `vniClientRef`, `vniRequestIdRef`, `vniSnapshotIdRef`, `vniSymbolRef`, `vniTimeframeRef`, `vniWsRef`, `w`, `warmupInFlightRef`, `warmupInitialBinanceHistory`, `widgetData`, `widgetDrawingDockOpen`, `widgetDrawingUiEnabled`, `widgetMessages`, `widgetSelectedDrawing`, `wins`, `workspaceSelectedIds`, `worstTrade`, `ws`, `x`, `xExtents`, `y`

### `packages/web/src/components/vninvestcharts/src/demo/libraryShowcaseDomain.js`

- Functions:
  - `klineBarToRawOHLCV`, `loadChartType`, `normalizeVNITimeframe`, `readStoredString`, `resolveTimeframeMs`, `writeStoredValue`
- Top-level variables:
  - `BINANCE_TIMEFRAMES`, `CANDLE_TYPE_STORAGE_KEY`, `CHART_TYPES`, `CHART_TYPE_TO_SERIES`, `DAY_MS`, `MAIN_PRICE_SERIES_TYPES`, `VNI_SYMBOL_STORAGE_KEY`, `VNI_TIMEFRAMES`, `VNI_TIMEFRAME_STORAGE_KEY`, `dateFormat`, `priceFormat`, `saved`, `volumeFormat`

### `packages/web/src/components/vninvestcharts/src/demo/MaxVisibleBarsSlider.js`

- Functions:
  - `MaxVisibleBarsSlider`, `formatMaxVisibleBarsLabel`
- Top-level variables:
  - `selectedIndex`, `selectedValue`

### `packages/web/src/components/vninvestcharts/src/demo/mobileToolLongPress.js`

- Functions:
  - `triggerTooltipHapticFeedback`
- Top-level variables:
  - `TOOL_LONG_PRESS_DELAY_MS`, `TOOL_TOOLTIP_AUTO_HIDE_MS`

### `packages/web/src/components/vninvestcharts/src/demo/PaneSettingsModal.js`

- Functions:
  - `PaneSettingsModal`, `colorPicker`, `describeSeries`, `getIndicatorSetLabel`, `handleAddSeries`, `handleApplyIndicatorSet`, `handleBackdropMouseDown`, `handleDeleteIndicatorSet`, `handleDeletePane`, `handleImportIndicatorSetChange`, `handleImportIndicatorSetClick`, `handleKeyDown`, `handleSaveCurrentIndicatorSet`, `handleSeriesParamChange`, `paneLabel`, `parseNumber`, `renderField`, `renderIndicatorSetsSection`, `renderIndicatorsSection`, `renderLayoutSection`, `renderResetSection`, `renderSeriesParams`, `renderSetCard`, `renderThemeSection`, `supportsSeriesLineWidth`
- Top-level variables:
  - `LINE_WIDTH_SERIES_TYPES`, `TECHNICAL_INDICATORS`, `availableSeriesTypes`, `builtinSets`, `canAddPane`, `canMoveDown`, `canMoveUp`, `composerEntry`, `currentValue`, `dialogRef`, `entry`, `fields`, `file`, `gridClassName`, `hidden`, `importInputRef`, `imported`, `indicatorSets`, `isDefaultPane`, `isSelected`, `lineWidthControl`, `next`, `nextSelectedPaneId`, `numeric`, `overLimit`, `rawValue`, `resolvedComposerType`, `revealEnabled`, `saved`, `sectionLabels`, `selectedPane`, `set`, `subColorSection`, `subComponents`, `userSets`, `visibleCount`, `visibleIndex`

### `packages/web/src/components/vninvestcharts/src/demo/replayHelpers.js`

- Functions:
  - `resolveReplayStartIndexOnDataSync`, `shouldOpenReplayContextMenu`

### `packages/web/src/components/vninvestcharts/src/demo/residentWindowPolicy.js`

- Functions:
  - `applyResidentWindowPolicy`, `resolveDateMs`, `resolveTrimStartIndex`
- Top-level variables:
  - `DEFAULT_RESIDENT_WINDOW_POLICY`, `firstVisibleIndex`, `maxTrimPreservingContext`, `targetTrimCount`, `trimStartIndex`, `visibleStartMs`

### `packages/web/src/components/vninvestcharts/src/demo/runtimeInvalidationBatch.js`

- Functions:
  - `createRuntimeInvalidationBatcher`, `defaultCancelFrame`, `defaultScheduleFrame`, `ensureFrame`, `flush`
- Top-level variables:
  - `LAYER_PANE_SNAPSHOTS`, `LAYER_RUNTIME_CAPABILITIES`, `cancelFrame`, `dirtyMask`, `disposed`, `frameHandle`, `latestPaneSnapshots`, `latestRuntimeCapabilities`, `mask`, `scheduleFrame`

### `packages/web/src/components/vninvestcharts/src/demo/runtimePolicy.js`

- Functions:
  - `isDrawingIntentActive`, `resolveDemoRuntimePolicy`
- Top-level variables:
  - `drawingRuntimeRequested`, `drawingUiEnabled`

### `packages/web/src/components/vninvestcharts/src/demo/runtimeQueryParams.js`

- Functions:
  - `isCleanSmokeModeEnabled`
- Top-level variables:
  - `params`

### `packages/web/src/components/vninvestcharts/src/demo/SettingsRangeSlider.js`

- Functions:
  - `SettingsRangeSlider`, `areValuesClose`, `clamp`
- Top-level variables:
  - `activeTolerance`, `clampedValue`, `hasActiveMark`, `hasMarks`, `nextValue`, `percent`

### `packages/web/src/components/vninvestcharts/src/demo/StandaloneEmbedDemo.js`

- Top-level variables:
  - `chartAdapter`, `isDark`, `panes`

### `packages/web/src/components/vninvestcharts/src/demo/styleOverridesPersistence.js`

- Functions:
  - `getStorage`, `isEmptyOverrides`, `isPlainRecord`, `loadPersistedStyleOverrides`, `normalizeStyleMap`, `restorePersistedStyleOverrides`, `saveCurrentStyleOverrides`, `snapshotStyleOverrides`
- Top-level variables:
  - `STYLE_OVERRIDES_STORAGE_KEY`, `overrides`, `parsed`, `raw`, `resolvedStorage`

### `packages/web/src/components/vninvestcharts/src/demo/topbarStatusBadge.js`

- Functions:
  - `resolveDemoRuntimeStatusBadge`, `resolveDemoTopbarStatusBadge`
- Top-level variables:
  - `message`, `title`

### `packages/web/src/components/vninvestcharts/src/demo/usePaneLayout.js`

- Functions:
  - `applyDelta`, `loadRatio`, `pxToRatio`, `ratioToPx`, `sanitize`, `saveRatio`, `usePaneLayout`
- Top-level variables:
  - `DEFAULT_RATIO`, `LS_KEY`, `MIN_PX`, `PANE_MARGIN_V`, `applyDragDelta`, `available`, `k`, `momentumH`, `newA`, `newB`, `newMomentumH`, `newPriceH`, `newVolumeH`, `overflow`, `priceH`, `px`, `r`, `resetLayout`, `stored`, `sum`, `total`, `volumeH`

### `packages/web/src/components/vninvestcharts/src/demo/useStockChartAdapter.js`

- Functions:
  - `buildExactRangeBackwardCoverage`, `buildExactRangeWindowCoverage`, `callGetBars`, `cloneWidgetBar`, `createFallbackSemantics`, `mapKLineBarToWidgetBar`, `resolveEffectiveMaxBarsPerRequest`, `useStockChartAdapter`
- Top-level variables:
  - `DEFAULT_PAGE_LIMIT`, `anchorTs`, `bars`, `firstTs`, `fromTs`, `lastBackfillCoverageRef`, `lastRangeCoverageRef`, `lastTs`, `mappedBars`, `newestTs`, `oldestTs`, `requested`, `result`, `sourceLimit`, `sourceSemantics`, `toTs`, `widgetDataRef`

### `packages/web/src/components/vninvestcharts/src/demo/useViewportMetrics.js`

- Functions:
  - `readViewportMetrics`, `update`, `useViewportMetrics`
- Top-level variables:
  - `keyboardInsetBottom`, `viewport`

### `packages/web/src/components/vninvestcharts/src/demo/useWidgetRuntimeInvalidationBatch.js`

- Functions:
  - `useWidgetRuntimeInvalidationBatch`
- Top-level variables:
  - `batchingEnabled`, `handleWidgetPaneSnapshotsChange`, `handleWidgetRuntimeCapabilitiesChange`, `hasMountedRuntimeLaneRef`, `params`, `runtimeInvalidationBatcher`

### `packages/web/src/components/vninvestcharts/src/demo/vninvest/__tests__/adapters.test.js`

- Top-level variables:
  - `points`, `result`

### `packages/web/src/components/vninvestcharts/src/demo/vninvest/__tests__/VNInvestClient.test.js`

- Top-level variables:
  - `bars`, `client`, `setItem`

### `packages/web/src/components/vninvestcharts/src/demo/vninvest/adapters.js`

- Functions:
  - `chartPointsToRawOHLCV`
- Top-level variables:
  - `date`, `result`

### `packages/web/src/components/vninvestcharts/src/demo/vninvest/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/vninvest/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/vninvest/VNInvestClient.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/demo/widgetVisibleDomainAuthority.js`

- Functions:
  - `resolvePendingChartRangeSync`, `shouldReleaseDemoVisibleDomainControl`, `shouldRetainDemoVisibleDomainControl`, `shouldUseWidgetOwnedHistory`

### `packages/web/src/components/vninvestcharts/src/index.js`

- Top-level variables:
  - `version`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/__tests__/getBarsCanonical.test.js`

- Functions:
  - `makeBar`
- Top-level variables:
  - `BASE_PARAMS`, `adapter`, `bars`, `initParams`, `params`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/adapters.test.js`

- Classes:
  - `MockSocket`
- Functions:
  - `createResponse`
- Top-level variables:
  - `adapter`, `bars`, `fetchMock`, `from`, `moreBars`, `onBar`, `onOrderbook`, `onTrade`, `sampleBars`, `sampleSymbols`, `symbols`, `to`, `unsubscribeBar`, `unsubscribeOrderbook`, `unsubscribeTrades`, `url`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/BaseAdapter.js`

- Classes:
  - `BaseAdapter`
- Top-level variables:
  - `cached`, `fallbackOrigin`, `now`, `rawDate`, `response`, `url`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/BinanceAdapter.js`

- Classes:
  - `BinanceAdapter`
- Functions:
  - `buildBinanceCoverage`, `fetchBinancePage`, `parseKlines`, `resolveInterval`, `validateSymbol`
- Top-level variables:
  - `BINANCE_BASE`, `BINANCE_INTERVALS`, `INTERVAL_MAP`, `MAX_LIMIT`, `SYMBOL_RE`, `_BINANCE_ORIGIN`, `bars`, `binanceAdapter`, `collectedBars`, `coverage`, `covered`, `endTime`, `json`, `lastBarTimestamp`, `mapped`, `newestTs`, `nextStartTime`, `oldestTs`, `pageBars`, `response`, `result`, `safeInterval`, `safeLimit`, `safeSymbol`, `startTime`, `upper`, `urlParams`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/BinanceAdapter.test.js`

- Top-level variables:
  - `adapter`, `capturedUrl`, `fetchSpy`, `firstPage`, `mockKlines`, `result`, `secondPage`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/DataAdapter.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/adapters/DjangoVnstockAdapter.js`

- Classes:
  - `DjangoVnstockAdapter`
- Functions:
  - `createRestAdapter`, `normalizeOrderbook`, `normalizeTrade`
- Top-level variables:
  - `cacheKey`, `params`, `rawBar`, `rawBars`, `rawSnapshot`, `rawTrade`, `socket`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/adapters/LocalCacheAdapter.js`

- Classes:
  - `LocalCacheAdapter`
- Functions:
  - `buildLocalCacheCoverage`, `cacheKey`, `isValidBar`
- Top-level variables:
  - `anchorTs`, `bars`, `before`, `coverage`, `key`, `newestTs`, `oldestTs`, `slice`, `sorted`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/LocalCacheAdapter.test.js`

- Functions:
  - `makeBars`
- Top-level variables:
  - `adapter`, `bars`, `btcResult`, `cutoff`, `ethResult`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/MockAdapter.js`

- Classes:
  - `MockAdapter`
- Functions:
  - `cloneBar`, `createMockBars`, `createSampleBars`, `emitNext`, `emitSnapshot`, `emitTrade`
- Top-level variables:
  - `bar`, `bars`, `close`, `cursor`, `drift`, `high`, `low`, `normalizedQuery`, `open`, `snapshotIndex`, `timerId`, `tradeIndex`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/StockDataAdapter.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/adapters/UDFDataAdapter.js`

- Classes:
  - `UDFDataAdapter`
- Top-level variables:
  - `bar`, `bars`, `beforeSec`, `data`, `from`, `fromSec`, `item`, `key`, `len`, `now`, `resolution`, `response`, `searchUrl`, `socket`, `sub`, `subscription`, `symbolsUrl`, `toSec`, `url`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/UDFDataAdapter.test.js`

- Top-level variables:
  - `adapter`, `bars`, `before`, `from`, `mockBaseUrl`, `mockResponse`, `mockSearchResponse`, `results`, `to`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/VNStocksAdapter.js`

- Classes:
  - `VNStocksAdapter`
- Functions:
  - `buildHeaders`, `buildVNStocksCoverage`, `clampDays`, `extractRawPoints`, `normalizeApiBase`, `normalizeInterval`, `normalizePoint`, `parseNumber`, `parseTimestamp`, `readStorageValue`, `resolveApiBase`, `resolveDays`, `resolveIntervalMs`, `resolvePatToken`, `validateSymbol`
- Top-level variables:
  - `API_BASE_STORAGE_KEY`, `DAY_LOOKBACK_MS`, `DAY_MS`, `DEFAULT_API_BASE`, `MAX_DAYS`, `PAT_STORAGE_KEY`, `SYMBOL_RE`, `allBars`, `anchorWindowMs`, `backwardAnchor`, `bars`, `base`, `close`, `coverage`, `covered`, `data`, `days`, `globalScope`, `high`, `intervalMs`, `low`, `newestTs`, `normalized`, `numeric`, `oldestTs`, `open`, `parsed`, `patToken`, `payload`, `point`, `rawDate`, `requestedWindowMs`, `response`, `safeInterval`, `safeLimit`, `safeSymbol`, `stored`, `timestamp`, `trimmed`, `url`, `volume`

### `packages/web/src/components/vninvestcharts/src/lib/adapters/VNStocksAdapter.test.js`

- Functions:
  - `createResponse`, `createStorageMock`
- Top-level variables:
  - `adapter`, `fetchMock`, `result`, `store`, `url`

### `packages/web/src/components/vninvestcharts/src/lib/advisory/__tests__/AdvisoryPanel.test.js`

- Functions:
  - `renderPanel`
- Top-level variables:
  - `MOCK_AGENTS`, `MOCK_RESULT`, `badge`, `bg`, `btn`, `container`, `empty`, `onRefresh`, `panel`, `reactActEnv`, `root`, `sellResult`

### `packages/web/src/components/vninvestcharts/src/lib/advisory/AdvisoryPanel.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/algorithm/index.js`

- Functions:
  - `algorithm`
- Top-level variables:
  - `calculator`, `defaultAlgorithm`, `newData`, `windowSize`

### `packages/web/src/components/vninvestcharts/src/lib/annotation/Annotate.js`

- Classes:
  - `Annotate`
- Functions:
  - `helper`
- Top-level variables:
  - `data`

### `packages/web/src/components/vninvestcharts/src/lib/annotation/BarAnnotation.js`

- Classes:
  - `BarAnnotation`
- Functions:
  - `getArrowForTextIcon`, `helper`
- Top-level variables:
  - `arrows`, `xFunc`, `yFunc`

### `packages/web/src/components/vninvestcharts/src/lib/annotation/index.js`

- Functions:
  - `buyPath`, `sellPath`
- Top-level variables:
  - `bottomWidth`, `halfWidth`, `height`

### `packages/web/src/components/vninvestcharts/src/lib/annotation/Label.js`

- Classes:
  - `Label`
- Functions:
  - `drawOnCanvas`, `drawOnCanvas2`, `getText`, `getYScale`
- Top-level variables:
  - `radians`

### `packages/web/src/components/vninvestcharts/src/lib/annotation/LabelAnnotation.js`

- Classes:
  - `LabelAnnotation`
- Functions:
  - `helper`
- Top-level variables:
  - `defaultProps`, `xFunc`, `yFunc`

### `packages/web/src/components/vninvestcharts/src/lib/annotation/SvgPathAnnotation.js`

- Classes:
  - `SvgPathAnnotation`
- Functions:
  - `helper`
- Top-level variables:
  - `xFunc`, `yFunc`

### `packages/web/src/components/vninvestcharts/src/lib/axes/Axis.js`

- Classes:
  - `Axis`
- Functions:
  - `Tick`, `axisLineSVG`, `axisTicksSVG`, `drawAxisLine`, `drawEachTick`, `drawEachTickLabel`, `drawTicks`, `tickHelper`
- Top-level variables:
  - `GenericChartComponentAny`, `baseFormat`, `baseTickValues`, `d`, `domain`, `format`, `nodes`, `result`, `sign`, `simulation`, `tickProps`, `tickSpacing`, `tickValues`, `ticks`, `x`, `xAxis`, `y`, `zip`, `zoomCapture`

### `packages/web/src/components/vninvestcharts/src/lib/axes/AxisLine.js`

- Classes:
  - `AxisLine`
- Functions:
  - `d3_scaleExtent`, `d3_scaleRange`
- Top-level variables:
  - `d`, `sign`, `start`, `xAxis`

### `packages/web/src/components/vninvestcharts/src/lib/axes/AxisTicks.js`

- Classes:
  - `AxisTicks`, `Tick`
- Functions:
  - `tickTransform_svg_axisX`, `tickTransform_svg_axisY`
- Top-level variables:
  - `baseFormat`, `format`, `origin`, `result`, `sign`, `tickSpacing`, `tickTransform`, `ticks`, `xAxis`

### `packages/web/src/components/vninvestcharts/src/lib/axes/AxisZoomCapture.js`

- Classes:
  - `AxisZoomCapture`
- Top-level variables:
  - `center`, `cursor`, `diff`, `mouseXY`, `newDomain`, `startScale`, `startXY`, `tempRange`

### `packages/web/src/components/vninvestcharts/src/lib/axes/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/axes/XAxis.js`

- Classes:
  - `XAxis`
- Functions:
  - `getXScale`, `helper`
- Top-level variables:
  - `axisLocation`, `moreProps`, `trueDomain`, `trueRange`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/axes/YAxis.js`

- Classes:
  - `YAxis`
- Functions:
  - `getYScale`, `helper`
- Top-level variables:
  - `axisLocation`, `trueDomain`, `trueRange`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/BackgroundText.js`

- Classes:
  - `BackgroundText`
- Top-level variables:
  - `contexts`, `interval`, `props`, `text`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/atr.js`

- Functions:
  - `calculator`, `source`
- Top-level variables:
  - `atrAlgorithm`, `atrValue`, `d`, `newData`, `options`, `prev`, `prevATR`, `tr`, `trueRangeAlgorithm`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/bollingerband.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `avg`, `bollingerBandAlgorithm`, `meanAlgorithm`, `options`, `source`, `stdDev`, `tuples`, `zip`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/change.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `absoluteChange`, `algo`, `newData`, `options`, `percentChange`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/compare.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `b`, `base`, `compareData`, `first`, `firsts`, `options`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/defaultOptionsForComputation.js`

- Top-level variables:
  - `ATR`, `BollingerBand`, `Change`, `Compare`, `EMA`, `ElderImpulse`, `ElderRay`, `ForceIndex`, `FullStochasticOscillator`, `Kagi`, `MACD`, `PointAndFigure`, `RSI`, `Renko`, `SAR`, `SMA`, `SmoothedForceIndex`, `TMA`, `WMA`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/elderRay.js`

- Functions:
  - `calculator`, `ohlc`
- Top-level variables:
  - `bearPower`, `bullPower`, `meanAlgorithm`, `newData`, `options`, `zip`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/ema.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `alpha`, `initialAccumulator`, `initialValue`, `nextValue`, `options`, `previous`, `skip`, `source`, `v`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/forceIndex.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `forceIndex`, `forceIndexCalulator`, `options`, `source`, `volume`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/heikinAshi.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `algorithm`, `close`, `high`, `low`, `open`, `source`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/calculator/kagi.js`

- Functions:
  - `calculator`, `dateAccessor`, `dateMutator`
- Top-level variables:
  - `atrAlgorithm`, `atrCalculator`, `dir`, `kagiData`, `line`, `nextChangePoint`, `nextLineOpen`, `options`, `prevPeak`, `priceMovement`, `reversalThreshold`, `source`, `startAs`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/macd.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `fastEMA`, `macdArray`, `macdCalculator`, `macdResult`, `options`, `signalArray`, `signalEMA`, `slowEMA`, `undefinedArray`, `zip`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/pointAndFigure.js`

- Functions:
  - `calculator`, `createBox`, `dateAccessor`, `dateMutator`, `updateColumns`
- Top-level variables:
  - `box`, `column`, `columnData`, `downwardMovement`, `noOfBoxes`, `options`, `prevBoxClose`, `pricingMethod`, `source`, `upwardMovement`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/renko.js`

- Functions:
  - `calculator`, `dateAccessor`, `dateMutator`
- Top-level variables:
  - `atrAlgorithm`, `atrCalculator`, `brick`, `brickSize`, `index`, `j`, `newBrick`, `noOfBricks`, `options`, `prevCloseToHigh`, `pricingMethod`, `renkoData`, `source`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/rsi.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `avgGain`, `avgLoss`, `change`, `gainsAndLosses`, `gainsAndLossesCalculator`, `now`, `options`, `prev`, `prevAvgGain`, `relativeStrength`, `rsiAlgorithm`, `rsiData`, `rsiValue`, `source`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/sar.js`

- Functions:
  - `calc`, `calculator`
- Top-level variables:
  - `algorithm`, `calculatedData`, `current`, `fallingEp`, `fallingSar`, `options`, `risingEp`, `risingSar`, `use`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/sma.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `average`, `options`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/smoothedForceIndex.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `algo`, `force`, `forceMA`, `ma`, `merge`, `options`, `smoothed`, `underlyingAlgorithm`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/sto.js`

- Functions:
  - `calculator`, `high`, `source`
- Top-level variables:
  - `currentClose`, `dData`, `dWindow`, `highestHigh`, `indicatorData`, `k`, `kData`, `kSmoothed`, `kWindow`, `lowestLow`, `options`, `stoAlgorithm`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/tma.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `n`, `options`, `total`, `triaverage`, `weight`

### `packages/web/src/components/vninvestcharts/src/lib/calculator/wma.js`

- Functions:
  - `calculator`
- Top-level variables:
  - `options`, `total`, `waverage`, `weight`

### `packages/web/src/components/vninvestcharts/src/lib/calendars/calendarRegistry.js`

- Functions:
  - `getCalendar`
- Top-level variables:
  - `REGISTRY`

### `packages/web/src/components/vninvestcharts/src/lib/calendars/ExchangeCalendar.js`

- Functions:
  - `dayOfWeekICT`, `isTradingDayICT`, `isVNTradingTime`, `midnightICT`, `secondsOfDayICT`, `vnHasAnyTradingTime`
- Top-level variables:
  - `DAY_MS`, `ICT_OFFSET_MS`, `SESSION_WINDOWS`, `dayEnd`, `dayStart`, `dow`, `ictMs`, `midnightMs`, `sessionFromMs`, `sessionToMs`, `sod`, `vnExchangeCalendar`

### `packages/web/src/components/vninvestcharts/src/lib/calendars/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/CanvasContainer.js`

- Classes:
  - `CanvasContainer`
- Top-level variables:
  - `log`

### `packages/web/src/components/vninvestcharts/src/lib/Chart.js`

- Functions:
  - `Chart`, `listener`
- Top-level variables:
  - `chartConfig`

### `packages/web/src/components/vninvestcharts/src/lib/ChartCanvas.js`

- Classes:
  - `ChartCanvas`
- Functions:
  - `calculateFullData`, `calculateState`, `getCursorStyle`, `getDimensions`, `getXScaleDirection`, `isValidDomainValue`, `resetChart`, `setXRange`, `shouldResetChart`, `updateChart`
- Top-level variables:
  - `CANDIDATES_FOR_RESET`, `MIN_VISIBLE_BARS`, `c`, `candleWidth`, `canvases`, `chartConfig`, `clickState`, `contextValue`, `currentCharts`, `currentItem`, `cursor`, `cursorStyle`, `cx`, `dataEnd`, `dataStart`, `dimensions`, `direction`, `dragableComponents`, `dx`, `endIndex`, `endValue`, `extent`, `fallback`, `firstItem`, `firstNewItem`, `firstOldItem`, `indexOffset`, `initialPlotData`, `interaction`, `isSpuriousReset`, `item`, `lastItem`, `lastItemWasVisible`, `lastItemX`, `lastOldItem`, `log`, `newCalc`, `newData`, `newDomEnd`, `newDomStart`, `newDomain`, `newDomainExtent`, `newEndBar`, `newFirstDate`, `newStart`, `newStartBar`, `nextLength`, `nextVisibleRange`, `oldData`, `oldEndDate`, `oldEndIdx`, `oldFirstDate`, `oldFirstInNew`, `oldStartDate`, `oldStartIdx`, `plotData`, `prevLength`, `previousVisibleRange`, `recovered`, `renderContextValue`, `reset`, `response`, `result`, `s`, `sizeChanged`, `startIndex`, `startValue`, `state`, `tooltipStyle`, `updatedScale`, `updatedXScale`, `useWholeData`, `visibleRange`, `xScaleForUpdate`

### `packages/web/src/components/vninvestcharts/src/lib/ChartContext.js`

- Functions:
  - `useChart`
- Top-level variables:
  - `ChartContext`, `ChartProvider`, `context`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/CrossHairCursor.js`

- Classes:
  - `CrossHairCursor`
- Functions:
  - `customX`, `helper`
- Top-level variables:
  - `dashArray`, `line1`, `line2`, `lines`, `originX`, `originY`, `safeLines`, `x`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/CurrentCoordinate.js`

- Classes:
  - `CurrentCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `circle`, `fillColor`, `x`, `xValue`, `y`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/Cursor.js`

- Classes:
  - `Cursor`
- Functions:
  - `customSnapX`
- Top-level variables:
  - `centerX`, `cursors`, `dashArray`, `originX`, `originY`, `safeCursors`, `shapeWidth`, `x`, `xCursor`, `xPos`, `xShape`, `xShapeFill`, `xShapeStroke`, `xValue`, `yCursor`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/EdgeCoordinate.js`

- Classes:
  - `EdgeCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `coordinateBase`, `edge`, `edgeCoordinate`, `edgeCoordinateBase`, `edgeLine`, `edgeXRect`, `line`, `path`, `textAnchor`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/EdgeCoordinateV2.js`

- Functions:
  - `drawOnCanvas`, `helper`, `renderSVG`
- Top-level variables:
  - `coordinateBase`, `edge`, `edgeCoordinate`, `edgeCoordinateBase`, `edgeLine`, `edgeXRect`, `line`, `path`, `textAnchor`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/EdgeCoordinateV3.js`

- Functions:
  - `drawOnCanvas`, `helper`, `renderSVG`, `roundRect`
- Top-level variables:
  - `coordinate`, `coordinateBase`, `dashArray`, `dy`, `edge`, `edgeCoordinate`, `edgeCoordinateBase`, `edgeLine`, `edgeXRect`, `halfHeight`, `line`, `path`, `textAnchor`, `width`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/EdgeIndicator.js`

- Classes:
  - `EdgeIndicator`
- Functions:
  - `getEdge`, `helper`
- Top-level variables:
  - `edge`, `edgeX`, `item`, `props`, `x1`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/MouseCoordinateX.js`

- Classes:
  - `MouseCoordinateX`
- Functions:
  - `customX`, `helper`
- Top-level variables:
  - `coordinate`, `coordinateProps`, `edgeAt`, `hideLine`, `props`, `type`, `x`, `y1`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/MouseCoordinateXV2.js`

- Classes:
  - `MouseCoordinateXV2`
- Functions:
  - `drawCoordinate`, `getXCoordinateInfo`, `xPosition`
- Top-level variables:
  - `defaultProps`, `halfWidth`, `height`, `pad`, `propTypes`, `shape`, `sign`, `t`, `textWidth`, `x`, `xValue`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/MouseCoordinateY.js`

- Classes:
  - `MouseCoordinateY`
- Functions:
  - `getYCoordinate`, `helper`
- Top-level variables:
  - `coordinate`, `coordinateProps`, `edgeAt`, `hideLine`, `props`, `type`, `x1`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/coordinates/PriceCoordinate.js`

- Classes:
  - `PriceCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `coordinate`, `coordinateProps`, `edgeAt`, `hideLine`, `props`, `show`, `type`, `width`, `x1`, `y`, `yScale`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/DynamicChart.seriesWiring.test.js`

- Functions:
  - `makeDatum`
- Top-level variables:
  - `datum`, `indicatorValues`, `leftKey`, `ma21Key`, `pane`, `rightKey`, `slot`, `slots`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/DynamicChart.xAxisFormatter.test.js`

- Functions:
  - `createBars`, `createDynamicChartProps`, `resetCapturedCalls`, `xAccessor`
- Top-level variables:
  - `DynamicChart`, `React`, `act`, `close`, `consoleErrorSpy`, `container`, `createRoot`, `data`, `date`, `firstDate`, `lastDate`, `mouseCoordinateProps`, `mouseCoordinateXCalls`, `open`, `pane`, `paneTooltipCalls`, `reactActEnvironment`, `root`, `tooltipProps`, `xAxisCalls`, `xAxisProps`, `yAxisCalls`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/gap1-viewport-event.test.js`

- Functions:
  - `alterBarValues`, `createBars`, `createCanvasContextMock`, `createChartCanvasProps`, `createChartChildren`, `createDynamicChartProps`, `xAccessor`
- Top-level variables:
  - `Chart`, `ChartCanvas`, `DynamicChart`, `act`, `bars`, `canvasContext`, `close`, `consoleErrorSpy`, `container`, `createRoot`, `date`, `getContextSpy`, `onVisibleDomainChange`, `onVisibleRangeChange`, `open`, `pane`, `reactActEnvironment`, `root`, `xExtents`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/gap2-canvas-overlay.test.js`

- Classes:
  - `Boundary`
- Functions:
  - `Probe`, `createBars`, `createCanvasContextMock`, `createRenderContext`
- Top-level variables:
  - `act`, `bars`, `canvas`, `canvasContext`, `caughtError`, `close`, `consoleErrorSpy`, `container`, `contextValue`, `createRoot`, `date`, `draw`, `events`, `getContextSpy`, `open`, `reactActEnvironment`, `root`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/gap3-scroll-zoom-api.test.js`

- Functions:
  - `createBars`, `createCanvasContextMock`, `createDynamicChartProps`, `xAccessor`
- Top-level variables:
  - `ChartCanvas`, `DynamicChart`, `act`, `bars`, `canvasContext`, `chartRef`, `close`, `consoleErrorSpy`, `container`, `createRoot`, `date`, `getContextSpy`, `open`, `pane`, `reactActEnvironment`, `root`, `setXExtentsSpy`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/IndicatorLegend.test.js`

- Functions:
  - `createPane`
- Top-level variables:
  - `IndicatorLegend`, `act`, `chips`, `container`, `createRoot`, `eyeButtons`, `onRemoveSeries`, `onToggleSeries`, `originalConsoleError`, `reactActEnvironment`, `removeButtons`, `root`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/seriesValueResolver.test.js`

- Functions:
  - `makeDatum`
- Top-level variables:
  - `accessors`, `datum`, `ema21`, `ema34`, `ema50`, `ma21`, `missingBb`, `missingEma`, `missingMacd`, `series`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/core/__tests__/timezoneIntegration.test.js`

- Functions:
  - `fallbackDateFormat`, `makeIntradayData`
- Top-level variables:
  - `baseTime`, `data`, `firstTick`, `formatted`, `formatter`, `tooltipFormatter`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/__tests__/enrichData.test.js`

- Top-level variables:
  - `bar`, `bar13`, `bar20`, `bigData`, `buyVol`, `cumulative`, `cvdApproxConfig`, `delta`, `ema13`, `ema13Config`, `ema13Only`, `ema20Config`, `ema20Only`, `enriched`, `enrichedBar`, `range`, `result`, `sellVol`, `series`, `singleBar`, `startedAt`, `strength`, `strengthConfig`, `val`, `whale`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/calcCVDApprox.js`

- Functions:
  - `calcCVDApprox`
- Top-level variables:
  - `buyVol`, `cumulative`, `delta`, `range`, `sellVol`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/calcStrengthElder.js`

- Functions:
  - `blankUntil`, `calcStrengthElder`
- Top-level variables:
  - `closes`, `ema`, `ema13`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/calcWhaleApprox.js`

- Functions:
  - `calcWhaleApprox`
- Top-level variables:
  - `buyDollar`, `buyShare`, `dollarVolume`, `next`, `range`, `sellDollar`, `sellShare`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/enrichData.js`

- Functions:
  - `enrichData`, `normalizeOptions`
- Top-level variables:
  - `aoColors`, `firstBias`, `firstBrar`, `firstCci`, `firstCr`, `firstDma`, `firstDmi`, `firstEmv`, `firstKdj`, `firstMtm`, `firstPsy`, `firstRoc`, `firstTrix`, `indicatorValues`, `options`, `plan`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/enrichDataWithCanonicalStore.js`

- Functions:
  - `enrichDataWithCanonicalStore`, `seriesConfigHash`
- Top-level variables:
  - `aParamsStr`, `aoColors`, `bParamsStr`, `cachedEntry`, `dataSignature`, `firstBias`, `firstBrar`, `firstCci`, `firstCr`, `firstDma`, `firstDmi`, `firstEmv`, `firstKdj`, `firstMtm`, `firstPsy`, `firstRoc`, `firstTrix`, `indicatorValues`, `plan`, `result`, `sorted`, `storeKeyInput`, `typeOrder`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/enrichDataWithCanonicalStore.test.js`

- Top-level variables:
  - `baseline`, `canonicalStore`, `initialSize`, `pane1Result`, `pane2Result`, `result`, `result1`, `result2`, `sampleData`, `seriesConfig`, `store`, `withStoreParam`, `withoutStore`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/fixtures/mockData.js`

- Top-level variables:
  - `base`, `close`, `drift`, `high`, `low`, `mockOHLCV300`, `open`, `volume`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/indicatorComputation.js`

- Functions:
  - `blankUntil`, `buildIndicatorComputationPlan`, `computeIndicatorComputationResult`, `defaultSeries`, `indicatorKey`, `mapKeys`, `mapPeriods`, `materializeIndicatorValues`, `mergeBand`, `numberParam`
- Top-level variables:
  - `adx`, `ama`, `amaValues`, `ao`, `aoEnabled`, `aoKey`, `ar`, `bbi`, `bbiEnabled`, `bbiKey`, `biasByPeriod`, `biasPeriods`, `bollingerByKey`, `bollingerConfigs`, `br`, `brarByPeriod`, `brarPeriods`, `cciByPeriod`, `cciPeriods`, `closes`, `cr`, `crByKey`, `crConfigs`, `cvd`, `cvdApproxKey`, `cvdRealtime`, `cvdRealtimeKey`, `d`, `ddd`, `dddValues`, `defaultBollingerKey`, `defaultBollingerSeries`, `defaultMacdKey`, `defaultMacdSeries`, `defaultWhaleKey`, `defaultWhaleSeries`, `dmaByKey`, `dmaConfigs`, `dmiByPeriod`, `dmiPeriods`, `emaByPeriod`, `emaPeriods`, `emv`, `emvByPeriod`, `emvPeriods`, `histogramLine`, `histogramValue`, `indicatorValues`, `j`, `k`, `kdjByKey`, `kdjConfigs`, `key`, `ma1`, `ma2`, `ma3`, `ma4`, `macd`, `macdByKey`, `macdConfigs`, `macdLine`, `macdValue`, `minusDI`, `mtm`, `mtmByKey`, `mtmConfigs`, `obv`, `obvEnabled`, `obvKey`, `plusDI`, `psy`, `psyByKey`, `psyConfigs`, `pvt`, `pvtEnabled`, `pvtKey`, `rawBar`, `rocByPeriod`, `rocPeriods`, `rsiByPeriod`, `rsiPeriods`, `s`, `sarByKey`, `series`, `signal`, `signalLine`, `signalValue`, `signalValues`, `smaByPeriod`, `smaPeriods`, `strength`, `strengthKey`, `trix`, `trixByKey`, `trixConfigs`, `trixValues`, `val`, `value`, `vrByPeriod`, `vrPeriods`, `warmup`, `whaleByKey`, `whaleThresholds`, `wrByPeriod`, `wrPeriods`

### `packages/web/src/components/vninvestcharts/src/lib/core/calculators/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/core/canvas/ChartRenderContext.js`

- Functions:
  - `useChartRenderContext`
- Top-level variables:
  - `ChartRenderContext`, `context`

### `packages/web/src/components/vninvestcharts/src/lib/core/canvas/OverlayCanvas.js`

- Functions:
  - `OverlayCanvas`
- Top-level variables:
  - `canvas`, `canvasRef`, `context`, `physicalHeight`, `physicalWidth`, `renderContext`

### `packages/web/src/components/vninvestcharts/src/lib/core/ChartPane.js`

- Functions:
  - `ChartPane`
- Top-level variables:
  - `chartScales`, `mainCanvasRef`, `mergedStyle`, `overlayCanvasRef`, `resolvedHeight`, `resolvedWidth`, `syncValue`

### `packages/web/src/components/vninvestcharts/src/lib/core/ChartSplitter.js`

- Functions:
  - `ChartSplitter`, `handlePointerDown`, `handlePointerMove`, `stopDragging`
- Top-level variables:
  - `availableRef`, `cls`, `commitRef`, `drag`, `dragRef`, `node`, `rootRef`, `totalDelta`

### `packages/web/src/components/vninvestcharts/src/lib/core/ChartTerminal.js`

- Functions:
  - `ChartTerminal`
- Top-level variables:
  - `mergedStyle`, `paneState`

### `packages/web/src/components/vninvestcharts/src/lib/core/context/ChartSyncContext.js`

- Functions:
  - `ChartSyncProvider`, `useChartSync`
- Top-level variables:
  - `ChartSyncContext`, `context`

### `packages/web/src/components/vninvestcharts/src/lib/core/context/DataContext.js`

- Functions:
  - `DataProvider`, `useDataContext`
- Top-level variables:
  - `DataContext`, `context`

### `packages/web/src/components/vninvestcharts/src/lib/core/context/PaneManagerContext.js`

- Functions:
  - `PaneManagerProvider`, `usePaneManagerContext`
- Top-level variables:
  - `PaneManagerContext`, `context`

### `packages/web/src/components/vninvestcharts/src/lib/core/DynamicChart.js`

- Functions:
  - `accessor`, `axisFormatForSeriesTypes`, `buildChartSlots`, `buildPriceTooltipEntries`, `buildTooltipEntriesForSeries`, `buildYExtents`, `candleBodyWidth`, `computeExtentsForIndex`, `createChartSlot`, `createKlineXAxisFormatter`, `createSmartDateFormatter`, `dashPatternToSeriesDasharray`, `fieldAccessor`, `finiteExtent`, `formatParts`, `getSeriesStyleOverrideForSeries`, `inferMinimumPositiveDateDiffMs`, `origin`, `pad`, `renderDynamicChartChildren`, `renderSeries`, `resolveScaleSlotIdForSeries`, `resolveSeriesDisplayColor`, `sc`, `structured`, `withAlpha`
- Top-level variables:
  - `BAR_SERIES_TYPES`, `DynamicChartComponent`, `INNER_PANE_GAP`, `ONE_DAY_MS`, `OSCILLATOR_SERIES`, `PRICE_SERIES`, `VOLUME_SERIES`, `accessors`, `activeSeries`, `adaptiveDateFormat`, `adxColor`, `arColor`, `barCount`, `bbBotRaw`, `bbFillColor`, `bbFillMode`, `bbFillModeRaw`, `bbFillOpacity`, `bbMidColor`, `bbTopRaw`, `brColor`, `canvas`, `chartCanvasRef`, `chartChildren`, `chartId`, `chartSlots`, `clampedIndex`, `currentBar`, `currentMs`, `d`, `dColor`, `dashArray`, `date`, `dateMap`, `diff`, `divergeColor`, `downColor`, `end`, `endDate`, `entry`, `extents`, `fillColor`, `fillOpacity`, `finiteValues`, `first`, `formatter`, `fullData`, `gap`, `groupingMode`, `half`, `handleVisibleRangeChange`, `hasBottomAxis`, `hasExplicitScaleSlotIds`, `hour`, `index`, `isDiscontinuousScale`, `isInnerPane`, `isIntraday`, `isLastSlot`, `jColor`, `kColor`, `lineColor`, `lineWidth`, `macdColor`, `maxSafeWidth`, `maxValue`, `min`, `minDiff`, `minValue`, `minimumDateDiffMs`, `minusColor`, `orderedScaleSlotIds`, `paneHeight`, `paneIndex`, `paneSlotCounter`, `paramColor`, `params`, `parts`, `plusColor`, `previousBar`, `previousMs`, `ratio`, `rsiLine`, `rsiMid`, `rsiOB`, `rsiOS`, `sampleXValue`, `scaleSlotId`, `second`, `seriesKey`, `seriesTypes`, `signalColor`, `slotInPane`, `slotSeries`, `slotsByScaleSlotId`, `start`, `startDate`, `stepPx`, `strokeOpacity`, `styleOverride`, `targetWidth`, `tooltip`, `tooltipY`, `type`, `tz`, `upColor`, `visibleBarCount`, `whale`, `xAxisDateFormat`, `yAxisFormat`, `yExtents`, `yScaleId`

### `packages/web/src/components/vninvestcharts/src/lib/core/ErrorBoundary.js`

- Classes:
  - `PaneErrorBoundary`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/__tests__/useDynamicPanes.test.js`

- Functions:
  - `createMockStorage`
- Top-level variables:
  - `blocked`, `blockedPane`, `customPane`, `customPaneId`, `defaultState`, `hiddenPane`, `next`, `panes`, `payload`, `restoredPane`, `rsi`, `state`, `storage`, `sum`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/useCanvasResize.js`

- Functions:
  - `updateSize`, `useCanvasResize`
- Top-level variables:
  - `element`, `observer`, `ref`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/useChartTheme.js`

- Functions:
  - `useChartTheme`
- Top-level variables:
  - `STORAGE_KEY`, `setTheme`, `stored`, `toggleTheme`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/useDynamicPanes.js`

- Functions:
  - `clonePane`, `clonePaneList`, `cloneSeries`, `createDefaultPaneLayout`, `createId`, `createScaleSlotId`, `createSeriesId`, `dynamicPanesReducer`, `getVisiblePanes`, `heightsToRatios`, `loadPaneLayout`, `makeDefaultLayout`, `mutateVisibleRatio`, `normalizeDefaultPane`, `normalizeLoadedPaneLayout`, `normalizeVisibleRatios`, `ratiosToHeights`, `readStoredPaneLayout`, `reorderVisiblePanes`, `replacePaneLayout`, `resolveSeriesIndex`, `sanitizeLayout`, `savePaneLayout`, `syncSplitScale`, `useDynamicPanes`, `validatePane`, `visibleCount`, `visibleIndices`, `writeStoredPaneLayout`
- Top-level variables:
  - `FRAME_VERTICAL_MARGIN`, `MIN_PANE_HEIGHT`, `activeSeries`, `addPane`, `addSeries`, `allocated`, `anyVisible`, `applyDelta`, `available`, `bottomHeight`, `bottomPane`, `byId`, `cloned`, `cursor`, `customPanes`, `defaultPanes`, `deletePane`, `dispatch`, `height`, `heights`, `indices`, `isTestEnv`, `layout`, `maxVisiblePanes`, `minBottom`, `minTop`, `next`, `nextBottom`, `nextLabel`, `nextTop`, `orderedVisible`, `pairTotal`, `pane`, `panes`, `parsed`, `ratio`, `raw`, `removePane`, `removeSeries`, `renamePane`, `reorderPanes`, `replaceLayout`, `replacement`, `resetToDefault`, `restorePane`, `series`, `seriesIndex`, `stored`, `toggleSeriesVisible`, `toggleVisible`, `topHeight`, `topPane`, `total`, `updateSeriesColor`, `updateSeriesLineWidth`, `updateSeriesParams`, `updateSeriesSubColor`, `updateSeriesYAxis`, `updated`, `visible`, `visibleCursor`, `visiblePanes`, `visibleSlots`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/useIndicatorSets.js`

- Functions:
  - `mergeSets`, `pickStorage`, `readFileAsText`, `useIndicatorSets`
- Top-level variables:
  - `allowedSeriesTypes`, `applySet`, `blob`, `builtinSets`, `deleteSet`, `exportSet`, `getSetById`, `importSet`, `imported`, `link`, `loaded`, `merged`, `nextSet`, `parsed`, `reader`, `removed`, `renameSet`, `renamed`, `saveCurrentAsSet`, `set`, `sets`, `storage`, `text`, `trimmed`, `url`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/usePaneManager.js`

- Functions:
  - `clampHeight`, `createPaneId`, `normalizePane`, `paneManagerReducer`, `usePaneManager`
- Top-level variables:
  - `addIndicator`, `addPane`, `normalizedPane`, `paneIdSeed`, `removeIndicator`, `removePane`, `resizePane`, `updateIndicator`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/usePaneManager.test.js`

- Top-level variables:
  - `nextState`, `pricePane`, `volumePane`

### `packages/web/src/components/vninvestcharts/src/lib/core/hooks/usePaneSizes.js`

- Functions:
  - `applyDeltaBetween`, `loadRatios`, `normalise`, `pxToRatios`, `ratiosToPx`, `sanitize`, `saveRatios`, `usePaneSizes`
- Top-level variables:
  - `a`, `applyDelta`, `available`, `b`, `consumed`, `count`, `defaultRatios`, `defaultRatiosRef`, `heights`, `minA`, `minB`, `minH`, `minHRef`, `minTotal`, `n`, `newA`, `newB`, `px`, `reset`, `result`, `stored`, `sum`, `total`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/core/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/core/IndicatorLegend.js`

- Functions:
  - `IndicatorLegend`, `paramNumber`, `seriesLabel`
- Top-level variables:
  - `PRIMARY_CHART_TYPES`, `SERIES_LABELS`, `base`, `chipStyle`, `chips`, `hidden`, `seriesIndex`, `shortLabel`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/core/PaneHeader.js`

- Functions:
  - `PaneHeader`
- Top-level variables:
  - `style`

### `packages/web/src/components/vninvestcharts/src/lib/core/PaneLabel.js`

- Functions:
  - `PaneLabel`
- Top-level variables:
  - `style`

### `packages/web/src/components/vninvestcharts/src/lib/core/paneScaleSlotDomains.js`

- Functions:
  - `buildAxisAccessors`, `computeAxisDomain`, `computePaneScaleSlotDomains`, `finiteExtent`, `isSeriesVisible`
- Top-level variables:
  - `BAR_SERIES_TYPES`, `accessors`, `axisSeries`, `domains`, `leftDomain`, `maxValue`, `minValue`, `rightDomain`, `styleOverride`, `values`

### `packages/web/src/components/vninvestcharts/src/lib/core/paneScaleSlotDomains.test.js`

- Functions:
  - `createDatum`
- Top-level variables:
  - `data`, `panes`

### `packages/web/src/components/vninvestcharts/src/lib/core/PaneSplitter.js`

- Functions:
  - `PaneSplitter`, `clamp`, `handleMove`, `handlePointerDown`, `handleUp`
- Top-level variables:
  - `availableHeight`, `bottomPaneElement`, `deltaY`, `dragState`, `dragStateRef`, `mergedStyle`, `nextHeight`, `splitterElement`, `startTopHeight`, `topPaneElement`

### `packages/web/src/components/vninvestcharts/src/lib/core/PaneTooltip.js`

- Functions:
  - `PaneTooltip`, `defaultDateValue`, `toDisplayValue`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `lines`, `rawValue`, `renderSVG`, `resolvedOrigin`

### `packages/web/src/components/vninvestcharts/src/lib/core/registry/__tests__/SeriesRegistry.test.js`

- Top-level variables:
  - `accessors`, `entry`, `phaseOneTypes`, `registered`

### `packages/web/src/components/vninvestcharts/src/lib/core/registry/registerAll.js`

- Functions:
  - `initRegistry`

### `packages/web/src/components/vninvestcharts/src/lib/core/registry/SeriesRegistry.js`

- Functions:
  - `clearRegistry`, `clearSeriesStyleOverride`, `clearSeriesStyleOverrides`, `cloneSeriesStyleOverride`, `colorFromConfig`, `dashPatternToStrokeDasharray`, `getSeries`, `getSeriesStyleOverride`, `listRegistered`, `listSeriesStyleOverrides`, `normalizeSeriesStyleOverride`, `notifyAllSeriesStyleChanges`, `notifySeriesStyleChange`, `overrideSeriesStyle`, `periodFromConfig`, `registerLineSeries`, `registerPhaseOneSeries`, `registerSeries`, `subscribeSeriesStyle`, `subscribeSeriesStyleChanges`
- Top-level variables:
  - `current`, `dashPattern`, `entry`, `listeners`, `next`, `normalized`, `period`, `registry`, `seriesStyleChangeListeners`, `seriesStyleListeners`, `seriesStyleOverrides`

### `packages/web/src/components/vninvestcharts/src/lib/core/registry/SeriesRegistry.test.js`

- Top-level variables:
  - `global`, `perInstance`, `unsubscribeGlobal`, `unsubscribeInstance`

### `packages/web/src/components/vninvestcharts/src/lib/core/replay/BarReplayController.js`

- Classes:
  - `BarReplayController`
- Functions:
  - `clampIndex`, `intervalForSpeed`, `toTimeValue`
- Top-level variables:
  - `foundIndex`, `nextStartIndex`, `state`, `targetTime`

### `packages/web/src/components/vninvestcharts/src/lib/core/replay/BarReplayController.test.js`

- Functions:
  - `createBar`
- Top-level variables:
  - `controller`, `states`, `unsubscribe`

### `packages/web/src/components/vninvestcharts/src/lib/core/scales/computeScales.js`

- Functions:
  - `collectAxisExtents`, `computeScales`, `finiteExtent`, `mergeExtents`
- Top-level variables:
  - `computed`, `definition`, `extents`, `finiteValues`, `flattened`, `hasRightAxis`, `leftScale`, `leftSeriesExtents`, `leftValues`, `maxValue`, `minValue`, `rightScale`, `rightSeriesExtents`, `rightValues`

### `packages/web/src/components/vninvestcharts/src/lib/core/SeriesPicker.js`

- Functions:
  - `SeriesPicker`, `buildDefaultSeries`, `formatSeriesLabel`, `handleKeyDown`, `handleMouseDown`, `paramNumber`, `updatePosition`
- Top-level variables:
  - `SERIES_LABELS`, `active`, `anchor`, `anchorRect`, `base`, `clickInsideAnchor`, `clickInsidePicker`, `container`, `containerRect`, `entry`, `picker`, `pickerRef`, `seriesTypes`, `target`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/core/seriesValueResolver.js`

- Functions:
  - `asNumber`, `buildIndicatorSeriesKey`, `numberParam`, `resolveSeriesDatumValue`, `resolveSeriesStructuredValue`, `resolveSeriesValue`, `resolveSeriesValueAccessors`
- Top-level variables:
  - `key`, `value`, `whale`

### `packages/web/src/components/vninvestcharts/src/lib/core/sets/__tests__/indicatorSetCodec.test.js`

- Functions:
  - `createMockStorage`
- Top-level variables:
  - `exported`, `imported`, `layout`, `loaded`, `next`, `original`, `payload`, `samplePane`, `savedSet`, `set`, `storage`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/core/sets/builtins.js`

- Top-level variables:
  - `BUILTIN_INDICATOR_SETS`

### `packages/web/src/components/vninvestcharts/src/lib/core/sets/indicatorSetCodec.js`

- Functions:
  - `buildIndicatorSetFileName`, `cloneIndicatorSet`, `clonePane`, `cloneSeries`, `createId`, `createIndicatorSet`, `createSeriesId`, `indicatorSetToPaneLayout`, `isPaneDescriptor`, `isPlainObject`, `isSeriesConfig`, `isSeriesTypeId`, `isTooltipMode`, `isYAxisSide`, `loadIndicatorSets`, `sanitizeIndicatorSet`, `sanitizeIndicatorSetsStorage`, `saveIndicatorSets`, `stringifyIndicatorSet`
- Top-level variables:
  - `allowed`, `byId`, `parsed`, `payload`, `raw`, `sanitized`, `slug`, `stamp`

### `packages/web/src/components/vninvestcharts/src/lib/core/types/__tests__/pane-descriptor.test.js`

- Top-level variables:
  - `ids`, `sum`, `visible`

### `packages/web/src/components/vninvestcharts/src/lib/core/types/chart.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/core/types/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/core/types/indicator-catalog.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/core/types/indicator-set.js`

- Top-level variables:
  - `INDICATOR_SETS_STORAGE_KEY`

### `packages/web/src/components/vninvestcharts/src/lib/core/types/pane-descriptor.js`

- Functions:
  - `isDefaultPaneId`
- Top-level variables:
  - `DEFAULT_PANES`, `DEFAULT_PANE_ID_SET`, `PANE_LAYOUT_STORAGE_KEY`, `PANE_MAX_VISIBLE`

### `packages/web/src/components/vninvestcharts/src/lib/core/types/seriesComponents.js`

- Top-level variables:
  - `SERIES_SUB_COMPONENTS`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/actionHandles.test.js`

- Functions:
  - `makeCircle`, `makeHLine`, `makeScales`, `makeTrendLine`, `makeVLine`
- Top-level variables:
  - `bbox`, `ctx`, `deleteX`, `deleteY`, `drawing`, `hitRadius`, `now`, `result`, `scales`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/AlertNotificationToast.js`

- Functions:
  - `AlertNotificationToast`, `playAlertChime`
- Top-level variables:
  - `AudioContextClass`, `borderLeftColor`, `containerStyle`, `ctx`, `elapsed`, `gain`, `isCrossAbove`, `latest`, `osc`, `remaining`, `timer`, `toastStyle`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/abcdPattern.js`

- Functions:
  - `calculateAbcdPatternMetrics`
- Top-level variables:
  - `AbcdPattern`, `ab`, `bc`, `cd`, `points`, `priceAB`, `priceBC`, `priceCD`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/abcdPattern.test.js`

- Functions:
  - `flatScale`, `makeAbcd`, `mockScales`
- Top-level variables:
  - `drawing`, `metrics`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/arrow.js`

- Top-level variables:
  - `Arrow`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/barsCount.js`

- Functions:
  - `arrowhead`, `hitTestBarsCount`, `renderBarsCount`
- Top-level variables:
  - `BarsCount`, `ah`, `color`, `fontSize`, `label`, `labelH`, `labelW`, `labelY`, `midX`, `padX`, `tickH`, `x1`, `x2`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/calloutShape.js`

- Functions:
  - `dashForStyle`, `distanceToSegment`, `hitTestCallout`, `measureCalloutBox`, `pointInRect`, `renderCallout`
- Top-level variables:
  - `CalloutShape`, `box`, `dx`, `dy`, `fontSize`, `height`, `label`, `lengthSquared`, `paddingX`, `paddingY`, `t`, `width`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/channel.js`

- Top-level variables:
  - `Channel`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/circleShape.js`

- Functions:
  - `dashForStyle`, `hitTestCircle`, `renderCircle`
- Top-level variables:
  - `CircleShape`, `distance`, `radius`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/cycles.js`

- Functions:
  - `calculateCycleGeometry`
- Top-level variables:
  - `CyclicLines`, `SineLine`, `TimeCycles`, `amplitude`, `count`, `p1`, `p2`, `pts`, `rawAmp`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/cycles.test.js`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`, `geo`, `points`, `scales`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/dateAndPriceRange.js`

- Top-level variables:
  - `DateAndPriceRange`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/dateRange.js`

- Functions:
  - `hitTestDateRange`, `renderDateRange`
- Top-level variables:
  - `DateRange`, `ah`, `arrowY`, `bandW`, `fillBase`, `fontSize`, `label`, `labelH`, `labelW`, `lx`, `ly`, `midX`, `padX`, `x1`, `x2`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/elliottWaves.js`

- Functions:
  - `calculateElliottWaveGeometry`, `makeElliottTool`
- Top-level variables:
  - `ELLIOTT_LABELS`, `ELLIOTT_POINT_COUNT`, `ElliottCorrection`, `ElliottDoubleCombo`, `ElliottImpulse`, `ElliottTriangle`, `ElliottTripleCombo`, `labels`, `pixels`, `pointCount`, `waveType`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/elliottWaves.test.js`

- Functions:
  - `makeDrawing`, `makePoint`
- Top-level variables:
  - `draft`, `drawing`, `geo`, `next`, `points`, `scales`, `start`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/ellipseShape.js`

- Functions:
  - `dashForStyle`, `hitTestEllipse`, `renderEllipse`
- Top-level variables:
  - `EllipseShape`, `centerX`, `centerY`, `distance`, `dx`, `dy`, `normalizedTolerance`, `radiusX`, `radiusY`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/extendedLine.js`

- Top-level variables:
  - `ExtendedLine`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/fibArc.js`

- Functions:
  - `calculateFibArcGeometry`
- Top-level variables:
  - `DEFAULT_FIB_ARC_LEVELS`, `FibArc`, `baseRadius`, `center`, `levels`, `reference`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/fibExtended.js`

- Functions:
  - `calculateFibExtendedGeometry`, `createTool`
- Top-level variables:
  - `FIB_EXTENDED_LEVELS`, `FIB_FAN_RATIOS`, `FibChannel`, `FibCircles`, `FibSpeedResistanceArcs`, `FibSpeedResistanceFan`, `FibSpiral`, `FibWedge`, `Pitchfan`, `THREE_POINT`, `TWO_POINT`, `TrendBasedFibTime`, `p1`, `p2`, `p3`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/fibExtended.test.js`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`, `draft`, `geo`, `points`, `scales`, `start`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/fibExtension.js`

- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_CONFIGS`, `FibExtension`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/fibonacci.js`

- Top-level variables:
  - `DEFAULT_FIB_LEVEL_CONFIGS`, `Fibonacci`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/fibTimeZone.js`

- Functions:
  - `calculateFibTimeZoneGeometry`
- Top-level variables:
  - `DEFAULT_FIB_TIME_ZONE_LEVELS`, `FibTimeZone`, `end`, `levels`, `start`, `stepX`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/gannAdvanced.js`

- Functions:
  - `calculateGannAdvancedGeometry`
- Top-level variables:
  - `GANN_FRACTIONS`, `GannBox`, `GannSquare`, `GannSquareFixed`, `p1`, `p2`, `side`, `size`, `sizeInPx`, `x2`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/gannAdvanced.test.js`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `d`, `draft`, `geo`, `h`, `points`, `scales`, `updated`, `w`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/gannFan.js`

- Functions:
  - `calculateGannFanGeometry`, `clampToBoundary`
- Top-level variables:
  - `GANN_RATIOS`, `GannFan`, `dx`, `dy`, `lines`, `t`, `tMax`, `tx`, `ty`, `unitBarX`, `unitPriceY`, `vx`, `vy`, `x2`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/harmonicPatterns.js`

- Functions:
  - `calculateHarmonicPatternGeometry`, `makeHarmonicTool`
- Top-level variables:
  - `CypherPattern`, `HeadAndShoulders`, `PATTERN_HAS_CLOSING_LINE`, `PATTERN_POINT_COUNT`, `PATTERN_POINT_LABELS`, `ThreeDrivesPattern`, `TrianglePattern`, `XabcdPattern`, `hasClosingLine`, `labels`, `patternType`, `pixels`, `pointCount`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/harmonicPatterns.test.js`

- Functions:
  - `makeDrawing`, `makePoint`
- Top-level variables:
  - `draft`, `drawing`, `geo`, `next`, `points`, `scales`, `start`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/hLine.js`

- Top-level variables:
  - `HLine`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/longPosition.js`

- Functions:
  - `calculateRiskReward`
- Top-level variables:
  - `LongPosition`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/measurement.test.js`

- Top-level variables:
  - `draft`, `p0`, `p1`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/parallelChannel.js`

- Functions:
  - `calculateParallelChannelGeometry`
- Top-level variables:
  - `ParallelChannel`, `dx`, `dy`, `end`, `length`, `normal`, `offsetAnchor`, `offsetDistance`, `start`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/pitchfork.js`

- Functions:
  - `calculatePitchforkGeometry`
- Top-level variables:
  - `Pitchfork`, `leftSwing`, `midpoint`, `pivot`, `rightSwing`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/polyline.js`

- Top-level variables:
  - `Polyline`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/priceLabelShape.js`

- Functions:
  - `distanceToSegment`, `hitTestPriceLabel`, `measurePriceLabelTag`, `pointInRect`, `renderPriceLabel`
- Top-level variables:
  - `PriceLabelShape`, `dx`, `dy`, `fontSize`, `height`, `label`, `lengthSquared`, `paddingX`, `paddingY`, `t`, `tag`, `tagY`, `width`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/priceRange.js`

- Functions:
  - `hitTestPriceRange`, `renderPriceRange`
- Top-level variables:
  - `PriceRange`, `bandH`, `fillBase`, `fontSize`, `isUp`, `label`, `labelH`, `labelW`, `lx`, `ly`, `midY`, `padX`, `rx`, `ry`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/ray.js`

- Top-level variables:
  - `Ray`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/rectangle.js`

- Top-level variables:
  - `Rectangle`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/regressionChannel.js`

- Functions:
  - `calculateRegressionChannelMetrics`, `projectIndexX`, `toTimeValue`
- Top-level variables:
  - `RegressionChannel`, `barTime`, `bars`, `closes`, `denominator`, `end`, `endPrice`, `endTime`, `endX`, `intercept`, `leftBar`, `meanY`, `n`, `rSquared`, `residuals`, `rightBar`, `slope`, `ssRes`, `ssTot`, `start`, `startPrice`, `startTime`, `startX`, `stdDev`, `sumX`, `sumXX`, `sumXY`, `sumY`, `xs`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/shapes.test.js`

- Top-level variables:
  - `box`, `draft`, `tag`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/shortPosition.js`

- Functions:
  - `calculateRiskReward`
- Top-level variables:
  - `ShortPosition`, `updated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/text.js`

- Top-level variables:
  - `Text`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/trendLine.js`

- Top-level variables:
  - `TrendLine`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/triangleShape.js`

- Functions:
  - `dashForStyle`, `distanceToSegment`, `hitTestTriangle`, `pointInTriangle`, `renderTriangle`, `sign`
- Top-level variables:
  - `TriangleShape`, `d1`, `d2`, `d3`, `dx`, `dy`, `hasNegative`, `hasPositive`, `lengthSquared`, `t`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/builtin/vLine.js`

- Top-level variables:
  - `VLine`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/clipboard.js`

- Functions:
  - `cloneDrawingSnapshot`, `offsetDrawingByPixels`
- Top-level variables:
  - `now`, `snapshot`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/clipboard.test.js`

- Top-level variables:
  - `drawing`, `offset`, `snapshot`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/contextMenu.js`

- Functions:
  - `DrawingContextMenu`, `handleKeyDown`, `resolvePalette`
- Top-level variables:
  - `backdropStyle`, `isCompactViewport`, `itemListStyle`, `overlayStyle`, `palette`, `panelStyle`, `titleStyle`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/contextMenu.test.js`

- Top-level variables:
  - `button`, `container`, `menu`, `onClose`, `onSelect`, `originalInnerWidth`, `reactActEnvironment`, `root`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/coordinateBridge.js`

- Functions:
  - `buildRenderScalesFromBridge`, `chartPointToPixelWithBridge`, `fromBridgePixel`, `isFiniteNumber`, `measurementPointToPixelWithBridge`, `resolveChartPointWithBridge`, `resolveMeasurementPointWithBridge`, `resolveReferenceDate`, `resolveReferencePrice`, `toBridgePixel`, `toDate`
- Top-level variables:
  - `bridgeReferencePixel`, `candidates`, `pixel`, `pixelOffset`, `referenceDate`, `referencePixel`, `referencePoint`, `referencePrice`, `referenceTimeMs`, `resolved`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/coordinateBridge.test.js`

- Top-level variables:
  - `bridge`, `pixel`, `scales`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/coordinateUtils.js`

- Functions:
  - `chartPointToPixel`, `pixelToChartPoint`
- Top-level variables:
  - `anchor`, `localX`, `localY`, `x`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/coordinateUtils.test.js`

- Top-level variables:
  - `containerRect`, `pixel`, `point`, `scales`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawing.test.js`

- Functions:
  - `createTextObject`, `createTrendLineObject`
- Top-level variables:
  - `arrow`, `completeState`, `draft`, `drawing`, `drawingState`, `editingState`, `first`, `history`, `imported`, `initialHistory`, `movingState`, `nextPoint`, `pushedHistory`, `rectangle`, `redoneHistory`, `resizingState`, `second`, `selectedState`, `serializedDrawing`, `serializedDrawings`, `serializedHistory`, `startPoint`, `text`, `tool`, `toolNames`, `trendLine`, `undoneHistory`, `updatedDraft`, `updatedState`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingActionSurface.js`

- Functions:
  - `createDrawingContextMenuItems`
- Top-level variables:
  - `items`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingActionSurface.test.js`

- Top-level variables:
  - `callbacks`, `drawing`, `items`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingAlerts.test.js`

- Functions:
  - `makeHLine`
- Top-level variables:
  - `drawing`, `events`, `events1`, `events2`, `now`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingInteractionBridge.js`

- Functions:
  - `createDrawingFrameSnapshot`, `createDrawingInteractionCommand`, `findHitDrawingWithContext`, `findSnapPointWithContext`, `hitTestDrawingWithContext`, `normalizePointerDeviceType`, `resolveDrawingInteractionContext`, `resolveDrawingManipulationIntentWithContext`, `resolveDrawingPointWithContext`, `sortVisibleDrawings`
- Top-level variables:
  - `chartPoint`, `command`, `offsetX`, `offsetY`, `orderedDrawings`, `renderScales`, `resizeHandleIndex`, `snap`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingInteractionBridge.test.js`

- Functions:
  - `createBridge`
- Top-level variables:
  - `bridge`, `command`, `context`, `frame`, `hoverContext`, `line`, `missContext`, `moveContext`, `plotData`, `pointer`, `resizeContext`, `resolved`, `snap`, `snapContext`, `trend`, `xScale`, `yScale`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/DrawingLayer.hover.test.js`

- Top-level variables:
  - `actual`, `baseChartConfig`, `baseMoreProps`, `capturedProps`, `container`, `drawing`, `interaction`, `momentumChartConfig`, `onToolUsed`, `reactActEnvironment`, `root`, `xScale`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/DrawingLayer.js`

- Functions:
  - `calculatePositionRiskReward`, `constrainResizePoint`, `currentDrawing`, `findHitDrawing`, `getSelectedDrawingId`, `getVisibleDrawings`, `handleKeyDown`, `handleModifierKeyChange`, `handlePointerUp`, `handleSelect`, `isMultiStepTool`, `resetSelectionModifier`, `resizeDrawing`, `resizeDrawingsByIds`, `resolveDrawingInteractionContextForDrawing`, `resolveDrawingInteractionContextFromMoreProps`, `sortVisibleDrawings`, `syncSelectionModifierPressed`, `toDrawingPoint`, `translateDrawing`, `translateDrawingsByIds`, `withChartTranslation`
- Top-level variables:
  - `MEASURE_TOOLS`, `actionHandle`, `allIds`, `anchorIndex`, `anchorPoint`, `anchorTimeMsHint`, `anchorX`, `anchorY`, `anchorYPrice`, `barsText`, `base`, `baseChartConfig`, `baseDrawings`, `bridge`, `canDragSelectedDrawing`, `canGroupDrag`, `canvasOptions`, `chartConfig`, `chartCursorClass`, `chartWidth`, `clampChartConfig`, `clampedPoint`, `cloned`, `completed`, `constrainedPoint`, `context`, `ctx`, `ctx2`, `currentChartPoint`, `currentDrawingState`, `currentPoint`, `deltaX`, `deltaY`, `draft`, `draftChartConfig`, `draftObj`, `dragPreviewRef`, `dragSessionRef`, `draggableIds`, `drawToCanvas`, `drawingStateRef`, `drawings`, `dx`, `dy`, `finalUpdated`, `handleClick`, `handleContextMenu`, `handleDoubleClick`, `handleDrag`, `handleDragComplete`, `handleDragStart`, `handleHover`, `handleIndex`, `handleMouseDown`, `handleMouseMove`, `handleUnHover`, `hasInvalidPoints`, `hit`, `hoveredSemanticHandleIdxRef`, `interactionRef`, `isHover`, `lastIndex`, `lastMovePropsRef`, `leftHeadroom`, `matchingIds`, `measurement`, `midX`, `midY`, `modifierEvent`, `moreProps`, `nativeClick`, `nativeDown`, `nativeEvent`, `newIdx`, `nextInteriorIdx`, `nextSelectedIds`, `normalizedPoint`, `p0`, `p1`, `pctText`, `pendingResizeHandleRef`, `pointerDeviceRef`, `previewDrawings`, `priceDeltaText`, `pt`, `px`, `py`, `rect`, `renderScales`, `resizeCtx`, `resizeHandleIndex`, `resized`, `resolved`, `rightHeadroom`, `rubberBandJustCommittedRef`, `rubberBandRef`, `selectedCursorClass`, `selectedDrawing`, `selectedDrawingId`, `selectedObjectIdSet`, `selectedObjectIds`, `session`, `shouldDisablePan`, `shouldDisablePanOnMouseDown`, `sign`, `snap`, `snapRef`, `startChartPoint`, `startPoint`, `targetIndex`, `tool`, `toolName`, `updated`, `xMax`, `xMaxR`, `xMin`, `xMinR`, `xy`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/DrawingLayer.test.js`

- Top-level variables:
  - `hLine`, `line`, `moved`, `nextDrawings`, `position`, `trendLine`, `untouched`, `vLine`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/DrawingStorage.js`

- Classes:
  - `DrawingImportError`
- Functions:
  - `cloneNormalizedPoint`, `createLocalStorageAdapter`, `createRESTStorageAdapter`, `getStorage`, `getStorageKey`, `isCycleParams`, `isDrawingType`, `isFibLevelConfig`, `isHarmonicRatioConfig`, `isPoint`, `isRecord`, `isRiskReward`, `isStyle`, `migrateFibLevelConfigs`, `normalizeDasharray`, `normalizeDrawingObject`, `normalizeDrawings`, `parseAlertCondition`
- Top-level variables:
  - `DEFAULT_DRAWING_STORAGE_KEY_PREFIX`, `DRAWING_TOOL_TYPES`, `converted`, `cooldownMs`, `createdAt`, `data`, `direction`, `enabled`, `headers`, `normalized`, `parsed`, `raw`, `response`, `style`, `triggeredAt`, `updatedAt`, `validDirections`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/DrawingStorage.test.js`

- Functions:
  - `createStorageMock`
- Top-level variables:
  - `adapter`, `drawing`, `drawings`, `loaded`, `mockResponse`, `payload`, `restAdapter`, `store`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingStyleRegistry.js`

- Functions:
  - `applyDrawingTemplate`, `applyDrawingTemplateToDrawing`, `clearDrawingStyleOverride`, `clearDrawingStyleOverrides`, `clearDrawingTemplate`, `cloneDrawingSegmentStylesTemplate`, `cloneDrawingSegmentVisibleTemplate`, `cloneDrawingStyleOverride`, `cloneDrawingTemplateData`, `dashPatternToStrokeDasharray`, `getDrawingStyleOverride`, `listDrawingStyleOverrides`, `loadDrawingTemplate`, `loadDrawingTemplateData`, `mergeDrawingSegmentStyles`, `normalizeDrawingStyleOverride`, `notifyAllDrawingStyleChanges`, `notifyDrawingStyleChange`, `overrideDrawingStyle`, `resolveDrawingStyle`, `saveDrawingTemplate`, `subscribeDrawingStyle`, `subscribeDrawingStyleChanges`, `validateDrawingSegmentStylesTemplate`, `validateDrawingSegmentVisibleTemplate`, `validateDrawingStyleTemplate`, `validateDrawingTemplateData`
- Top-level variables:
  - `HEX_COLOR_RE`, `TEMPLATE_STORAGE_KEY_PREFIX`, `current`, `dashPattern`, `directStyle`, `drawingStyleChangeListeners`, `drawingStyleListeners`, `drawingStyleOverrides`, `keys`, `listeners`, `merged`, `normalized`, `obj`, `override`, `parsed`, `payload`, `raw`, `result`, `segmentStyles`, `segmentVisible`, `style`, `template`, `valid`, `validated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingStyleRegistry.test.js`

- Top-level variables:
  - `drawing`, `global`, `perDrawing`, `unsubscribeGlobal`, `unsubscribeInstance`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingTemplate.test.js`

- Functions:
  - `localStorageMock`
- Top-level variables:
  - `applied`, `base`, `data`, `draft`, `exported`, `loaded`, `result`, `saved`, `store`, `storeKeys`, `style`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingTemplateStorage.js`

- Functions:
  - `deleteTemplate`, `exportAllTemplates`, `importAllTemplates`, `listTemplates`, `loadTemplate`, `loadTemplateData`, `saveTemplate`, `validateNamedTemplateData`
- Top-level variables:
  - `all`, `directStyle`, `filtered`, `indices`, `key`, `list`, `obj`, `parsed`, `parts`, `payload`, `raw`, `segmentStyles`, `segmentVisible`, `style`, `templateName`, `toolType`, `validated`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/drawingToolIcons.js`

- Top-level variables:
  - `drawingToolIcons`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/evaluateDrawingAlerts.js`

- Functions:
  - `detectPriceCross`, `evaluateDrawingAlerts`, `isCooldownElapsed`, `resolveReferencePriceForAlert`
- Top-level variables:
  - `DEFAULT_COOLDOWN_MS`, `activeConditions`, `actualDirection`, `cooldown`, `crossedAbove`, `crossedBelow`, `dx`, `fired`, `p1`, `p2`, `refPrice`, `triggered`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/fibLevelManager.test.js`

- Functions:
  - `makeFibLevelConfigs`, `makeLegacyFibDrawing`
- Top-level variables:
  - `configs`, `corrupted`, `isDuplicate`, `legacyLevels`, `newCfg`, `newRatio`, `original`, `parsed`, `updated`, `value`, `visibleLevels`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/FloatingSelectionToolbar.js`

- Functions:
  - `FloatingSelectionToolbar`, `btnStyle`, `handleMultiColorSelect`, `onEnd`, `onMove`, `onUp`, `renderActionButton`, `renderActionIcon`, `renderSemanticPointButtons`, `resolvePalette`
- Top-level variables:
  - `activePrice`, `barStyle`, `base`, `baseStyle`, `btnStyle`, `containerStyle`, `countBadgeStyle`, `divStyle`, `dividerStyle`, `dragHandleStyle`, `dragStartRef`, `effectiveMultiPos`, `effectivePos`, `groupStyle`, `handleDragEnd`, `handleDragMouseDown`, `handleDragMove`, `handleDragStart`, `handleDragTouchStart`, `isActive`, `isCompactViewport`, `isDanger`, `lastDrawingIdRef`, `multiBarStyle`, `palette`, `t`, `touch`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/FloatingSelectionToolbar.test.js`

- Top-level variables:
  - `container`, `dragHandle`, `drawing`, `mockModel`, `originalInnerWidth`, `reactActEnvironment`, `root`, `toolbar`, `touchEndEvent`, `touchMoveEvent`, `touchStartEvent`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/gannFan.test.js`

- Top-level variables:
  - `chartHeight`, `chartWidth`, `dx`, `dy`, `geometry`, `labels`, `nonPrincipal`, `principal`, `ratio`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/harmonicRatioValidation.js`

- Functions:
  - `classifyHarmonicDeviation`, `computeHarmonicRatioLabels`, `formatHarmonicRatioLabel`
- Top-level variables:
  - `COLOR_ACCEPTABLE`, `COLOR_NEUTRAL`, `COLOR_OUTSIDE`, `COLOR_WITHIN`, `actual`, `color`, `denominator`, `deviation`, `deviationPct`, `hr`, `label`, `labels`, `legs`, `max`, `min`, `numerator`, `p0`, `p1`, `pts`, `range`, `result`, `sign`, `target`, `targetRatios`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/harmonicRatioValidation.test.js`

- Functions:
  - `makeHarmonicDrawing`
- Top-level variables:
  - `drawing`, `label`, `labels`, `text`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/history.js`

- Functions:
  - `cloneDrawings`, `createDrawingHistory`, `historyReducer`
- Top-level variables:
  - `nextPast`, `previousPresent`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/hitTest.js`

- Functions:
  - `distanceToPolyline`, `distanceToSegment`, `getDrawingBoundingBox`, `getResizeHandleIndex`, `getTextBounds`, `hitTestAbcdPattern`, `hitTestActionHandles`, `hitTestChannelLike`, `hitTestDrawing`, `hitTestFibArc`, `hitTestFibTimeZone`, `hitTestFibonacciLike`, `hitTestLineLike`, `hitTestParallelChannel`, `hitTestPitchfork`, `hitTestPositionZones`, `hitTestRayLike`, `hitTestRectangleLike`, `hitTestRegressionChannel`, `isDrawingInRect`, `pathBounds`, `pointInRect`, `toPixel`
- Top-level variables:
  - `AABB_SAFE_TYPES`, `ACTION_HANDLE_RADIUS`, `HIT_TOLERANCE`, `bbox`, `best`, `center`, `clipped`, `distance`, `distanceFromCenter`, `dx`, `dy`, `edge`, `effectiveDrawing`, `end`, `fontSize`, `geo`, `geometry`, `handles`, `height`, `hitRadius`, `leftFork`, `length`, `lengthSquared`, `lower`, `maxX`, `maxY`, `median`, `metrics`, `middle`, `minX`, `minY`, `normal`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `overlayPrimitive`, `p`, `pixel`, `pixelDelta`, `pixels`, `point`, `priceDelta`, `radius`, `rightFork`, `start`, `t`, `text`, `tolerance`, `upper`, `width`, `x`, `x1`, `x2`, `xs`, `y`, `y1`, `y2`, `ys`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/hitTestTolerance.test.js`

- Functions:
  - `makeAbcdPattern`, `makeBarsCount`, `makeCallout`, `makeChannel`, `makeCircle`, `makeCyclicLines`, `makeDateAndPriceRange`, `makeDateRange`, `makeElliottCorrection`, `makeElliottImpulse`, `makeEllipse`, `makeExtendedLine`, `makeFibArc`, `makeFibChannel`, `makeFibCircles`, `makeFibExtension`, `makeFibSpeedResistanceArcs`, `makeFibSpeedResistanceFan`, `makeFibSpiral`, `makeFibTimeZone`, `makeFibWedge`, `makeFibonacci`, `makeGannFan`, `makeGannSquareFixed`, `makeHLine`, `makeHeadAndShoulders`, `makeLongPosition`, `makeParallelChannel`, `makePitchfan`, `makePitchfork`, `makePolyline`, `makePriceLabel`, `makePriceRange`, `makeRay`, `makeRectangle`, `makeRegressionChannel`, `makeScales`, `makeText`, `makeTrendBasedFibTime`, `makeTrendLine`, `makeTriangle`, `makeVLine`, `makeXabcdPattern`
- Top-level variables:
  - `STATIC_NOW`, `abcdPattern`, `allTypes`, `barsCount`, `callout`, `channel`, `circle`, `cyclicLines`, `dateRange`, `drawing`, `elliottCorrection`, `elliottImpulse`, `ellipse`, `extendedLine`, `fibArc`, `fibChannel`, `fibCircles`, `fibExtension`, `fibSpeedResistanceArcs`, `fibSpeedResistanceFan`, `fibSpiral`, `fibTimeZone`, `fibWedge`, `fibonacci`, `gannFan`, `gannSquareFixed`, `hLine`, `headAndShoulders`, `invisible`, `longPosition`, `mouseX`, `mouseY`, `now`, `options`, `parallelChannel`, `pitchfan`, `pitchfork`, `polyline`, `priceLabel`, `priceRange`, `range`, `ray`, `rectangle`, `regressionChannel`, `regressionPlotData`, `scales`, `text`, `trendBasedFibTime`, `triangle`, `vLine`, `xScale`, `xabcdPattern`, `yScale`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/hooks/recentFavorites.test.js`

- Functions:
  - `loadStored`, `localStorageMock`, `saveStored`, `simulatePushRecent`, `simulateToggle`
- Top-level variables:
  - `FAV_KEY`, `MAX_RECENT`, `RECENT_KEY`, `favs`, `list`, `raw`, `store`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/hooks/useFavoriteTools.js`

- Functions:
  - `loadFavorites`, `saveFavorites`, `useFavoriteTools`
- Top-level variables:
  - `STORAGE_KEY`, `isFavorite`, `next`, `parsed`, `raw`, `toggleFavorite`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/hooks/useRecentTools.js`

- Functions:
  - `loadRecent`, `saveRecent`, `useRecentTools`
- Top-level variables:
  - `MAX_RECENT`, `STORAGE_KEY`, `clearRecent`, `next`, `parsed`, `pushRecent`, `raw`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/drawing/liveMeasurement.test.js`

- Functions:
  - `makeScales`
- Top-level variables:
  - `T0`, `T1`, `T2`, `T3`, `T4`, `T5`, `badScales`, `dates`, `p0`, `p1`, `plotData`, `result`, `scales`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/m3.test.js`

- Functions:
  - `createSimpleDrawing`
- Top-level variables:
  - `completed`, `dateAndPriceRange`, `deleted`, `draft`, `endPoint`, `extendedLine`, `extendedLineElements`, `fibExtension`, `first`, `flatPoint`, `initial`, `longPosition`, `names`, `options`, `polyline`, `preview`, `ray`, `scales`, `second`, `selected`, `shortPosition`, `startPoint`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/m4.test.js`

- Functions:
  - `createSimpleDrawing`
- Top-level variables:
  - `abcd`, `drawing`, `endPoint`, `fibArc`, `fibTimeZone`, `metrics`, `midPoint`, `names`, `options`, `parallel`, `pitchfork`, `plotData`, `regression`, `regressionElements`, `scales`, `startPoint`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/measuring.js`

- Functions:
  - `computeLiveMeasurement`, `measurementPointToPixel`, `resolveChartConfig`, `resolveMeasurementPoint`, `summarizeMeasurement`
- Top-level variables:
  - `avgBarMs`, `barCount`, `chartConfig`, `chartConfigList`, `currentItem`, `dateValue`, `dates`, `first`, `last`, `priceDelta`, `pricePct`, `priceValue`, `px0`, `px1`, `t0`, `t1`, `tMax`, `tMin`, `timeDeltaMs`, `totalMs`, `v`, `xValue`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/measuring.test.js`

- Top-level variables:
  - `moreProps`, `pixelPoint`, `plotData`, `point`, `summary`, `xScale`, `yScale`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/morePropsCoordinateBridge.js`

- Functions:
  - `buildRenderScalesFromMoreProps`, `createDrawingCoordinateBridgeFromMoreProps`, `getAdjustedMousePosition`, `getChartConfigList`, `resolveActiveChartConfig`, `resolveBaseChartConfig`, `resolveBridgePixelOffset`, `resolveChartPaneId`, `resolveChartPointDirect`, `resolveChartPointFromMoreProps`, `resolveChartScaleDomain`, `resolveDrawingChartConfig`
- Top-level variables:
  - `adjustedMousePosition`, `barIndex`, `baseChartConfig`, `bridge`, `chartConfigList`, `currentCharts`, `currentMatch`, `dateValue`, `datum`, `domain`, `effectivePoint`, `exactMatch`, `match`, `offset`, `pData`, `paneChartConfigs`, `pixel`, `plotData`, `rawDate`, `renderScales`, `sampleX`, `targetChartConfig`, `xAcc`, `xValue`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/morePropsCoordinateBridge.test.js`

- Functions:
  - `createMoreProps`
- Top-level variables:
  - `adjusted`, `bridge`, `discontinuousLikeScale`, `drawing`, `fullPlotData`, `moreProps`, `pixel`, `plotData`, `point`, `priceYScale`, `renderScales`, `volumeYScale`, `xScale`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/multiSelectBatch.js`

- Functions:
  - `applyBatchColor`, `applyBatchDelete`, `applyBatchLock`, `applyBatchVisible`, `resolveNextLockState`, `resolveNextVisibleState`
- Top-level variables:
  - `idSet`, `selected`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/multiSelectBatch.test.js`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `a`, `allHidden`, `allLocked`, `drawingA`, `drawingB`, `drawingC`, `drawings`, `ids`, `result`, `unlocked`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/overlayPrimitiveAdapter.js`

- Functions:
  - `buildAbcdPatternPrimitive`, `buildChannelPrimitive`, `buildCyclePrimitive`, `buildDateAndPriceRangeBadge`, `buildElliottWavePrimitive`, `buildFibArcLevels`, `buildFibExtendedPrimitive`, `buildFibTimeZoneMarkers`, `buildFibonacciLevelLines`, `buildGannAdvancedPrimitive`, `buildGannFanPrimitive`, `buildHarmonicPatternPrimitive`, `buildParallelChannelPrimitive`, `buildPitchforkPrimitive`, `buildPositionPrimitive`, `buildRegressionChannelPrimitive`, `clipSegmentToBox`, `enrichPoint`, `extendLineThroughBox`, `formatOverlayNumber`, `toOverlayPrimitive`, `toOverlayPrimitiveRaw`, `toPixel`, `toPrimitiveSegment`, `toPrimitiveStyle`
- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_LEVELS`, `DEFAULT_FIB_LEVELS`, `TREND_BASED_FIB_TIME_LEVELS`, `anchorSegment`, `angle0`, `apex`, `badge`, `bars`, `baseOpacity`, `baseRadius`, `bottom`, `centerX`, `closingKey`, `count`, `distance`, `dx`, `dy`, `edges`, `end`, `endIndex`, `entryY`, `extX`, `extY`, `extension`, `fallbackLevels`, `fanSegments`, `fill`, `fillAlpha`, `first`, `fontSize`, `geometry`, `halfPeriod`, `height`, `idx`, `key`, `labels`, `last`, `left`, `leftFork`, `leftNeckline`, `length`, `line`, `lineY1`, `lineY2`, `lower`, `median`, `metrics`, `middle`, `normal`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `offsetY`, `origin`, `paths`, `percent`, `period`, `phi`, `pixelDelta`, `pointLabels`, `points`, `price`, `priceDelta`, `priceDiff`, `primitive`, `primitiveStyle`, `px`, `r`, `radius`, `ratio`, `ratioLabels`, `retracementLevels`, `reward`, `right`, `rightFork`, `rightNeckline`, `risk`, `riskReward`, `segmentKeys`, `segmentStyle`, `segments`, `seqKeys`, `start`, `startIndex`, `stepIndex`, `steps`, `stopY`, `style`, `t0`, `t1`, `targetY`, `theta`, `top`, `totalWidth`, `turns`, `tx`, `ty`, `upper`, `valueLabels`, `width`, `x`, `xIndexFloat`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/priceLabel.js`

- Functions:
  - `DrawingPriceLabels`, `addPriceMarker`, `collectPointPriceMarkers`, `isFinitePrice`, `resolveDrawingPriceMarkers`, `resolveFibExtensionMarkers`, `resolveFibonacciMarkers`
- Top-level variables:
  - `effectiveDrawing`, `firstPoint`, `highlightFill`, `labelFill`, `labelStroke`, `labelStrokeWidth`, `labelTextFill`, `lastPoint`, `levels`, `markers`, `normalized`, `priceDelta`, `riskReward`, `seen`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/priceLabel.test.js`

- Top-level variables:
  - `coordinate`, `drawing`, `labels`, `markerElements`, `renderedCoordinate`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/registry.js`

- Functions:
  - `createDraftFromTool`, `createTool`, `getDrawingPlugin`, `isDrawingToolName`, `listDrawingPlugins`, `listDrawingTools`, `registerDrawingPlugin`, `registerDrawingTool`
- Top-level variables:
  - `_pluginTools`, `draft`, `drawingToolRegistry`, `tool`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/registry.test.js`

- Functions:
  - `makePlugin`
- Top-level variables:
  - `first`, `plugin`, `second`, `warn`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/renderCanvas.js`

- Functions:
  - `applyLineStyle`, `clipSegmentToBox`, `computeBoundingBox`, `drawAbcdPattern`, `drawArrow`, `drawChannel`, `drawCycleTools`, `drawDateAndPriceRange`, `drawElliottWave`, `drawExtendedLine`, `drawFibArc`, `drawFibExtended`, `drawFibTimeZone`, `drawFibonacci`, `drawFilledRect`, `drawGannAdvanced`, `drawGannFan`, `drawHLine`, `drawHarmonicPattern`, `drawLine`, `drawLongPosition`, `drawParallelChannel`, `drawPitchfork`, `drawPolygonFill`, `drawPolyline`, `drawPolylineTool`, `drawPositionZones`, `drawRay`, `drawRectangle`, `drawRegressionChannel`, `drawSelectionHandles`, `drawSemanticPointAffordance`, `drawShortPosition`, `drawStrokedRect`, `drawText`, `drawTextLabel`, `drawTrendLine`, `drawVLine`, `drawYAxisPriceTag`, `extendLineThroughBox`, `numberFormatter`, `renderDrawingActionHandles`, `renderDrawingAlertIcon`, `renderDrawingShape`, `renderDrawingToCanvas`, `renderMeasurementLabel`, `renderRubberBand`, `resolveSemanticPointLabels`, `strokeDasharrayForStyle`, `toPixel`
- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_LEVELS`, `DEFAULT_FIB_LEVELS`, `FIBS`, `FONT`, `LINE_HEIGHT`, `PADDING`, `PHI`, `abcdPts`, `abcdSegKeys`, `angle0`, `apex`, `badge`, `badgeHeight`, `badgeStyle`, `badgeWidth`, `badgeX`, `badgeY`, `bars`, `base`, `baseRadius`, `bbox`, `bottom`, `boxH`, `boxW`, `bx`, `by`, `canvasH`, `canvasHeight`, `center`, `channelDy`, `clipped`, `closingKey`, `closingStyle`, `cx`, `distance`, `dx`, `dy`, `edge`, `edges`, `effectiveDrawing`, `elliottSegKeys`, `end`, `entryY`, `ext`, `extX`, `extY`, `fill`, `fillAlpha`, `fillColor`, `first`, `fontSize`, `gannSegKeys`, `geo`, `geometry`, `gx`, `gy`, `h`, `halfPeriod`, `handles`, `harmonicLabels`, `headLength`, `headWidth`, `height`, `hrLabels`, `isArcs`, `key`, `label`, `labelX`, `labelY`, `labels`, `last`, `left`, `leftFork`, `length`, `levelStyle`, `levels`, `lineY1`, `lineY2`, `lines`, `lower`, `lx`, `ly`, `maxWidth`, `median`, `metrics`, `midX`, `midY`, `middle`, `nl`, `normal`, `nr`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `offsetY`, `opacity`, `origin`, `overlayPrimitive`, `p`, `p0`, `p1`, `padX`, `padY`, `percent`, `period`, `pixel`, `pixelDelta`, `pixels`, `point`, `posBC`, `posCD`, `price`, `priceAtRight`, `priceDelta`, `priceDiff`, `px`, `py`, `r`, `r0`, `radius`, `ratio`, `ratioAB`, `ratioBC`, `ratioLabelStyle`, `ratioStyle`, `reward`, `right`, `rightFork`, `ringRadius`, `risk`, `riskReward`, `segKey`, `segKeys`, `segStyle`, `seqKeys`, `slBounds`, `slFill`, `start`, `steps`, `stopY`, `stroke`, `strokeWidth`, `t`, `t0`, `t1`, `tagH`, `tagW`, `tagX`, `tagY`, `targetY`, `text`, `textWidth`, `theta`, `top`, `totalWidth`, `tpBounds`, `tpFill`, `turns`, `tx`, `ty`, `upper`, `ux`, `uy`, `vector`, `vx`, `w`, `width`, `x`, `xs`, `y`, `yAtRight`, `ys`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/renderCanvasPrimitiveBridge.test.js`

- Functions:
  - `makeContext`
- Top-level variables:
  - `ctx`, `drawing`, `plotData`, `scales`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/renderSvg.js`

- Functions:
  - `circleElement`, `clipSegmentToBox`, `extendLineThroughBox`, `interactiveProps`, `lineElement`, `numberFormatter`, `pathElement`, `polygonElement`, `polylineElement`, `rectElement`, `renderAbcdPattern`, `renderArrow`, `renderChannel`, `renderDateAndPriceRange`, `renderDrawingToSvg`, `renderExtendedLine`, `renderFibArc`, `renderFibExtension`, `renderFibTimeZone`, `renderFibonacci`, `renderHLine`, `renderLineWithHandles`, `renderLongPosition`, `renderParallelChannel`, `renderPitchfork`, `renderPolyline`, `renderPositionZones`, `renderRay`, `renderRectangle`, `renderRegressionChannel`, `renderShortPosition`, `renderText`, `renderTrendLine`, `renderVLine`, `selectionHandles`, `strokeDasharrayForStyle`, `textElement`, `toPixel`
- Top-level variables:
  - `DEFAULT_FIB_EXTENSION_LEVELS`, `DEFAULT_FIB_LEVELS`, `abStyle`, `arcs`, `badge`, `badgeProps`, `badgeText`, `bars`, `base`, `baseLineProps`, `bcStyle`, `bottom`, `cdStyle`, `centerStyle`, `clipped`, `dashedStroke`, `distance`, `dx`, `dy`, `edges`, `effectiveDrawing`, `element`, `elements`, `end`, `entryLine`, `entryY`, `extensionPrice`, `fibConfig`, `fill`, `geometry`, `headLength`, `headWidth`, `height`, `labels`, `left`, `leftFork`, `leftForkStyle`, `leftX`, `length`, `levelStroke`, `levels`, `line`, `lineProps`, `lowerStyle`, `median`, `medianStyle`, `metrics`, `middle`, `middleStyle`, `negativeBoundary`, `normal`, `offsetAnchor`, `offsetEnd`, `offsetStart`, `offsetVector`, `path`, `percent`, `pixel`, `pixelDelta`, `pixels`, `point`, `polygon`, `positiveBoundary`, `price`, `priceDelta`, `primaryStyle`, `primaryVisible`, `px`, `py`, `r`, `ratio`, `ratioAB`, `ratioBC`, `rect`, `regressionElements`, `reward`, `right`, `rightFork`, `rightForkStyle`, `rightX`, `risk`, `riskReward`, `secondaryStyle`, `secondaryVisible`, `slZone`, `slZoneClass`, `start`, `stopLine`, `stopY`, `stroke`, `t0`, `t1`, `targetLine`, `targetY`, `text`, `top`, `tpZone`, `tpZoneClass`, `upperStyle`, `ux`, `uy`, `vector`, `width`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/renderSvg.test.js`

- Functions:
  - `createExtendedDrawing`
- Top-level variables:
  - `arrow`, `circleElements`, `drawing`, `elements`, `lineElements`, `options`, `rectangle`, `scales`, `textElements`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/rubberBand.test.js`

- Functions:
  - `makeScales`, `makeTrendLine`
- Top-level variables:
  - `action`, `drawing`, `idle`, `next`, `rect`, `rubberBandState`, `scales`, `selectedMultiple`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/segmentRegistry.js`

- Functions:
  - `getSegmentKeys`, `hasSubSegments`, `isSegmentVisible`, `resolveSegmentStyle`
- Top-level variables:
  - `SEGMENT_KEYS_BY_TYPE`, `keys`, `override`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/segmentRegistry.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/drawing/semanticPointAffordance.test.js`

- Functions:
  - `makeContext`
- Top-level variables:
  - `ctx`, `drawing`, `scales`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/serialization.js`

- Functions:
  - `deserializeDrawingHistory`, `deserializeDrawingObject`, `deserializeDrawings`, `exportDrawingsJSON`, `importDrawingsJSON`, `migrateDrawings`, `serializeDrawingHistory`, `serializeDrawingObject`, `serializeDrawings`
- Top-level variables:
  - `DRAWING_SCHEMA_VERSION`, `parsed`, `payload`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/serialization.test.js`

- Top-level variables:
  - `imported`, `json`, `legacy`, `legacyDrawing`, `legacyPayload`, `mockDrawing`, `parsed`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/shared.js`

- Functions:
  - `appendPoint`, `clonePoint`, `createDrawingId`, `createDrawingObject`, `replaceLastPoint`, `replaceNextPoint`, `replacePoint`, `resolvePointAnchor`
- Top-level variables:
  - `defaultDrawingStyle`, `drawingIdSeed`, `now`, `placeholderIndex`, `startPoint`, `targetIndex`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/shortcutMap.js`

- Functions:
  - `normalizeShortcutKey`, `resolveDrawingShortcut`
- Top-level variables:
  - `DRAWING_SHORTCUTS`, `hasModifier`, `key`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/shortcutMap.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/drawing/snap.js`

- Functions:
  - `collectFibLevelSnapCandidates`, `findFibLevelSnap`, `findNearestBar`, `findSnapPoint`, `getDatumDate`, `pickEndpointSnap`, `toDate`
- Top-level variables:
  - `MAGNET_TOLERANCE`, `best`, `bestDist`, `bestDistance`, `bestOhlc`, `candidates`, `date`, `dist`, `distance`, `fibSnap`, `isStrong`, `nearestBar`, `p0y`, `p1y`, `pixelPoint`, `pixelX`, `pixelY`, `price`, `snap`, `value`, `xAccessor`, `xTolerance`, `yTolerance`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/snap.test.js`

- Functions:
  - `makeFibDrawing`, `makeFibScales`, `makeScales`, `makeTrendLine`
- Top-level variables:
  - `candidates`, `drawing`, `price75`, `scales`, `snap`, `xScale`, `yScale`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/stateMachine.js`

- Functions:
  - `drawingReducer`, `getSelectedObjectIds`, `isLineFamilyType`, `lineTypeFlagsFor`, `normalizeSelectedObjectIds`, `selectionStateFor`
- Top-level variables:
  - `LINE_FAMILY_TYPES`, `normalized`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/touchStylus.test.js`

- Functions:
  - `hasPinchGesture`, `resolvePointerDeviceType`
- Top-level variables:
  - `pt`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/drawing/uiTokens.js`

- Functions:
  - `createDrawingUiStyleVars`
- Top-level variables:
  - `DRAWING_UI_TOKENS`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/uiTokens.test.js`

- Top-level variables:
  - `vars`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useCompactViewport.js`

- Functions:
  - `resolveViewportMatch`, `updateViewportMatch`, `useCompactViewport`
- Top-level variables:
  - `DEFAULT_MAX_WIDTH`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useDrawingAlertEvaluator.js`

- Functions:
  - `useDrawingAlertEvaluator`
- Top-level variables:
  - `currentPrice`, `fired`, `lastBar`, `now`, `prevBar`, `prevPriceRef`, `previousPrice`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useDrawingInteraction.js`

- Functions:
  - `cloneDrawingPoints`, `cloneSegmentStyles`, `createDrawingInteractionState`, `deleteSelectedInteractionState`, `drawingInteractionReducer`, `getSelectedObjectIds`, `isHistoryAction`, `patchDrawing`, `replaceDrawingById`, `useDrawingInteraction`
- Top-level variables:
  - `cancelDrawing`, `deleteGroup`, `deleteSelected`, `didChange`, `nextDrawings`, `nextHistory`, `redo`, `replaceDrawings`, `selectGroup`, `selectObject`, `selectedDrawings`, `selectedObjectIds`, `setSelectedObjects`, `startEditing`, `startMoving`, `startResizing`, `undo`, `updateDrawing`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useDrawingInteraction.test.js`

- Functions:
  - `DrawingGroupProbe`, `DrawingInteractionProbe`, `createTrendLineDrawing`, `makeDrawings`, `renderGroupProbe`, `renderInteractionProbe`
- Top-level variables:
  - `completeState`, `container`, `currentInteraction`, `currentRoot`, `d1`, `d2`, `d3`, `deletedSnapshot`, `drawing`, `drawingState`, `nextPoint`, `pushedState`, `reactActEnvironment`, `root`, `selectedSnapshot`, `selectedState`, `snapshot`, `snapshotPoints`, `startPoint`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useDrawingStorage.js`

- Functions:
  - `useDrawingStorage`
- Top-level variables:
  - `anchor`, `blob`, `clearAll`, `exportJSON`, `hydratedRef`, `importJSON`, `imported`, `isEnabled`, `loaded`, `p`, `payload`, `resolved`, `storage`, `timeoutId`, `url`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useLongPress.js`

- Functions:
  - `clearTimer`, `onPointerCancel`, `onPointerDown`, `onPointerMove`, `onPointerUp`, `useLongPress`
- Top-level variables:
  - `callbackRef`, `captured`, `dx`, `dy`, `startPosRef`, `timerRef`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/useLongPress.test.js`

- Functions:
  - `Probe`, `makePointerEvent`, `renderHook`
- Top-level variables:
  - `act`, `cb`, `container`, `createElement`, `createRoot`, `reactActEnvironment`, `root`, `store`, `useLongPress`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/workspace/__tests__/selectionToolbar.test.js`

- Top-level variables:
  - `drawing`, `model`, `position`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/workspace/selectionToolbar.js`

- Functions:
  - `clamp`, `createDrawingSelectionToolbarModel`, `resolveDrawingSelectionToolbarPosition`, `resolveNearestVisibleIndex`, `resolvePaneSnapshot`, `resolveScaleDomain`, `resolveVisiblePlotData`, `resolveVisibleTimeBounds`
- Top-level variables:
  - `DEFAULT_TOOLBAR_SIZE`, `EDGE_PADDING`, `VERTICAL_OFFSET`, `bottomY`, `boundedX`, `boundedY`, `centerX`, `distance`, `domain`, `domainEnd`, `domainStart`, `fallbackY`, `filtered`, `indexRatio`, `indexSpan`, `matchedSnapshot`, `nearestDistance`, `nearestIndex`, `nearestVisibleIndex`, `paneBottom`, `paneId`, `paneTop`, `pointPixels`, `preferredPaneId`, `preferredScaleIds`, `preferredY`, `primaryActions`, `scaleDomain`, `secondaryActions`, `snapshot`, `timeBounds`, `timeRatio`, `timeSpan`, `topY`, `value`, `valueSpan`, `visiblePlotData`, `yRatio`

### `packages/web/src/components/vninvestcharts/src/lib/drawing/workspace/useDrawingWorkspaceController.js`

- Functions:
  - `areDrawingsEqual`, `cloneDrawings`, `getSelectedDrawing`, `useDrawingWorkspaceController`
- Top-level variables:
  - `allDrawings`, `clearClipboard`, `cloneClipboard`, `closeDock`, `controllerRef`, `copySelected`, `handleStorageLoad`, `initialDrawingsRef`, `interaction`, `isControlled`, `lastControlledDrawingsRef`, `lastEmittedDrawingsRef`, `leftDrawing`, `nextDrawings`, `openDock`, `previousControlledDrawings`, `replaceDrawings`, `rightDrawing`, `selectDrawing`, `selectedDrawing`, `selectedIds`, `setDockTab`, `state`, `storage`, `storageAdapter`, `syncingFromExternalRef`

### `packages/web/src/components/vninvestcharts/src/lib/EventCapture.js`

- Functions:
  - `canPan`, `handleClick`, `handleDrag`, `handleDragEnd`, `handleEnter`, `handleLeave`, `handleMouseDown`, `handleMouseMove`, `handlePan`, `handlePanEnd`, `handlePinchZoom`, `handlePinchZoomEnd`, `handlePointerDown`, `handlePointerMoveLongPress`, `handlePointerUpLongPress`, `handleRightClick`, `handleTouchMove`, `handleTouchStart`, `handleWheel`, `queuePanEnd`, `shouldPan`
- Top-level variables:
  - `EventCapture`, `className`, `clickedRef`, `clickedTimeoutRef`, `currentCharts`, `dragHappenedRef`, `dragInProgressRef`, `dragStartPositionRef`, `dx`, `dxRef`, `dxdy`, `dy`, `dyRef`, `eSnapshot`, `element`, `focusRef`, `interactionProps`, `lastNewPosRef`, `longPressStartPosRef`, `longPressTimerRef`, `mouseInsideRef`, `mouseInteractionRef`, `mouseXY`, `newPos`, `nodeRef`, `normalizedPanConditions`, `pan`, `panConditions`, `panEndTimeoutRef`, `panHappenedRef`, `panStartRef`, `pinchZoomStartRef`, `rect`, `touchXY`, `win`, `yZoom`, `zoomDir`

### `packages/web/src/components/vninvestcharts/src/lib/EventCapture.test.js`

- Top-level variables:
  - `EventCapture`, `actual`, `container`, `event`, `onClick`, `onDoubleClick`, `onMouseDown`, `pointerMock`, `rect`, `root`

### `packages/web/src/components/vninvestcharts/src/lib/GenericChartComponent.js`

- Classes:
  - `GenericChartComponent`
- Functions:
  - `GenericChartComponentWrapper`
- Top-level variables:
  - `ALWAYS_TRUE_TYPES`, `canvasOriginX`, `canvasOriginY`, `chartConfig`, `chartContext`, `chartId`

### `packages/web/src/components/vninvestcharts/src/lib/GenericComponent.js`

- Classes:
  - `GenericComponent`
- Functions:
  - `getAxisCanvas`, `getMouseCanvas`
- Top-level variables:
  - `aliases`, `contextXScale`, `ctx`, `draggable`, `moreProps`, `newType`, `prevHover`, `proceed`, `style`, `suffix`, `type`

### `packages/web/src/components/vninvestcharts/src/lib/helper/fitDimensions.js`

- Classes:
  - `ResponsiveComponent`
- Functions:
  - `getDimensions`, `getDisplayName`
- Top-level variables:
  - `backingStoreRatio`, `context`, `devicePixelRatio`, `dimensions`, `h`, `name`, `node`, `ratio`, `ref`, `w`

### `packages/web/src/components/vninvestcharts/src/lib/helper/fitWidth.js`

- Classes:
  - `ResponsiveComponent`
- Functions:
  - `getDisplayName`
- Top-level variables:
  - `backingStoreRatio`, `context`, `devicePixelRatio`, `el`, `name`, `ratio`, `ref`, `w`

### `packages/web/src/components/vninvestcharts/src/lib/helper/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/helper/SaveChartAsImage.js`

- Functions:
  - `drawImageOnCanvas`
- Top-level variables:
  - `SaveChartAsImage`, `a`, `bg`, `canvas`, `canvasList`, `containerRect`, `context`, `each`, `img`, `ohlcEl`, `ohlcRect`, `pendingSvgs`, `rect`, `relativeX`, `relativeY`, `rx`, `ry`, `startX`, `svg`, `svgBlob`, `svgElementsToDraw`, `svgList`, `svgString`, `symbolText`, `timeframeText`, `url`, `valuesText`, `watermarkHeight`

### `packages/web/src/components/vninvestcharts/src/lib/helper/TypeChooser.js`

- Classes:
  - `TypeChooser`

### `packages/web/src/components/vninvestcharts/src/lib/indicator/defaultOptionsForAppearance.js`

- Top-level variables:
  - `BollingerBand`, `ElderImpulse`, `FullStochasticOscillator`, `MACD`, `themes`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/__tests__/ce15.test.js`

- Functions:
  - `makeBar`
- Top-level variables:
  - `bars`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/__tests__/ce16.test.js`

- Functions:
  - `constantBars`, `makeBar`
- Top-level variables:
  - `bars`, `result`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/ao.js`

- Top-level variables:
  - `AO`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/bbi.js`

- Top-level variables:
  - `BBI`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/bias.js`

- Top-level variables:
  - `BIAS`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/bollinger.js`

- Top-level variables:
  - `BOLLINGER`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/brar.js`

- Top-level variables:
  - `BRAR`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/cci.js`

- Top-level variables:
  - `CCI`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/cr.js`

- Top-level variables:
  - `CR`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/cvd.js`

- Top-level variables:
  - `CVD`, `cumulative`, `delta`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/dma.js`

- Top-level variables:
  - `DMA`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/dmi.js`

- Top-level variables:
  - `DMI`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/ema.js`

- Top-level variables:
  - `EMA`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/emv.js`

- Top-level variables:
  - `EMV`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/kdj.js`

- Top-level variables:
  - `KDJ`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/ma.js`

- Top-level variables:
  - `MA`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/macd.js`

- Top-level variables:
  - `MACD`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/mtm.js`

- Top-level variables:
  - `MTM`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/obv.js`

- Top-level variables:
  - `OBV`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/psy.js`

- Top-level variables:
  - `PSY`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/pvt.js`

- Top-level variables:
  - `PVT`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/roc.js`

- Top-level variables:
  - `ROC`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/rsi.js`

- Top-level variables:
  - `RSI`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/sar.js`

- Top-level variables:
  - `SAR`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/sma.js`

- Top-level variables:
  - `SMA`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/trix.js`

- Top-level variables:
  - `TRIX`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/volume.js`

- Top-level variables:
  - `VOLUME`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/vr.js`

- Top-level variables:
  - `VR`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/builtin/wr.js`

- Top-level variables:
  - `WR`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/__tests__/CVDIndicator.test.js`

- Top-level variables:
  - `data`, `elem`, `props`, `visibleRange`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/__tests__/whaleDetector.test.js`

- Top-level variables:
  - `data`, `event`, `events`, `threshold`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/__tests__/WhaleMarketBubbleOverlay.test.js`

- Functions:
  - `createMockContextValue`
- Top-level variables:
  - `act`, `contextValue`, `createRoot`, `elem`, `events`, `props`, `visibleRange`, `whaleEvent`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/CVDIndicator.js`

- Functions:
  - `CVDIndicator`, `cvdYScale`
- Top-level variables:
  - `barDate`, `barHeight`, `barIndex`, `barStartY`, `barWidth`, `barX`, `cvdApprox`, `drawCVD`, `isPositive`, `maxCVD`, `minCVD`, `normalized`, `paddedMax`, `paddedMin`, `rangeCV`, `visibleData`, `zeroY`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/DarkFlowBadge.js`

- Functions:
  - `DarkFlowBadge`, `strengthTier`
- Top-level variables:
  - `SIGNAL_LABELS`, `sigLabel`, `tier`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/ExternalCVDOverlay.js`

- Functions:
  - `ExternalCVDOverlay`, `cvdY`, `drawOverlay`
- Top-level variables:
  - `draw`, `fillColor`, `grad`, `hi`, `isPositive`, `lastPt`, `lineColor`, `lo`, `maxCvd`, `minCvd`, `padded`, `pts`, `span`, `ySpan`, `zeroY`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/WhaleBubbleOverlay.js`

- Functions:
  - `WhaleBubbleOverlay`
- Top-level variables:
  - `alpha`, `bar`, `barDate`, `barsByTimestamp`, `dateValue`, `draw`, `fillColor`, `radius`, `rawRadius`, `strokeColor`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/whaleDetector.js`

- Functions:
  - `detectWhaleEvents`, `formatVolume`, `formatWhaleEvent`, `getBubbleColor`, `getBubbleRadius`, `getBubbleStrokeColor`
- Top-level variables:
  - `abs`, `buyVol`, `netDelta`, `radiusMap`, `sellVol`, `side`, `sizeCategory`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/overlays/WhaleMarketBubbleOverlay.js`

- Functions:
  - `WhaleMarketBubbleOverlay`, `formatBubbleLabel`
- Top-level variables:
  - `abs`, `bar`, `barDate`, `bubbleY`, `candleX`, `candleY`, `close`, `drawBubbles`, `radius`, `visibleEvents`, `volumeLabel`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/registry.js`

- Functions:
  - `getIndicator`, `listIndicators`, `normalizeIndicatorName`, `registerIndicator`
- Top-level variables:
  - `indicatorRegistry`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/registry.test.js`

- Top-level variables:
  - `bollingerIndicator`, `customIndicator`, `emaIndicator`, `macdIndicator`, `names`, `sampleBars`

### `packages/web/src/components/vninvestcharts/src/lib/indicators/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/indicators/utils.js`

- Functions:
  - `aoColorSeries`, `aoSeries`, `bbiSeries`, `biasSeries`, `bollingerSeries`, `brarSeries`, `cciSeries`, `collectNumbers`, `crSeries`, `dmaSeries`, `dmiSeries`, `emaSeries`, `emaSeriesSkipNaN`, `emvSeries`, `isFiniteNumber`, `kdjSeries`, `macdSeries`, `meanAbsoluteDeviationSeries`, `midpointSeries`, `mtmSeries`, `numericExtent`, `obvSeries`, `psySeries`, `pvtSeries`, `risingVolumeColor`, `rocSeries`, `rollingStandardDeviation`, `rsiSeries`, `sarSeries`, `smaSeries`, `smaSeriesSkipNaN`, `trixSeries`, `typicalPriceSeries`, `vrSeries`, `wilderSeries`, `wilderSeriesSkipNaN`, `wrSeries`
- Top-level variables:
  - `adx`, `af`, `ar`, `arDenominator`, `arNumerator`, `average`, `averageGain`, `averageLoss`, `bar`, `boxRatio`, `br`, `brDenominator`, `brNumerator`, `change`, `close`, `closes`, `cr`, `cumulative`, `current`, `currentIndex`, `currentMid`, `d`, `dValue`, `ddd`, `delta`, `denom`, `denominator`, `deviation`, `divisor`, `downMove`, `dx`, `ema1`, `ema2`, `ema3`, `emv`, `ep`, `fast`, `fastEma`, `finiteCount`, `finiteValues`, `gain`, `gainAverage`, `hh`, `highestHigh`, `histogram`, `hm`, `isUpTrend`, `j`, `k`, `ll`, `loss`, `lossAverage`, `lower`, `lowestLow`, `ma12`, `ma24`, `ma3`, `ma6`, `macd`, `mad`, `maxValue`, `mean`, `meanDeviation`, `middle`, `midpoints`, `minValue`, `minus`, `minusDI`, `minusDm`, `movingAverage`, `mtm`, `numerator`, `open`, `plusDI`, `plusDm`, `prevSar`, `previous`, `previousEma`, `previousMid`, `psy`, `queue`, `range`, `relativeStrength`, `removed`, `result`, `rollingSum`, `rsv`, `sar`, `series`, `signal`, `slice`, `slow`, `slowEma`, `sma`, `sma34`, `sma5`, `smoothMinus`, `smoothPlus`, `smoothTr`, `smoothing`, `startIndex`, `tp`, `tr`, `trix`, `up`, `upCount`, `upMove`, `upper`, `variance`, `window`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/Brush.js`

- Classes:
  - `Brush`
- Top-level variables:
  - `dashArray`, `height`, `shouldBrush`, `width`, `x`, `x1y1`, `xValue`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/ClickCallback.js`

- Classes:
  - `ClickCallback`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/ChannelWithArea.js`

- Classes:
  - `ChannelWithArea`
- Functions:
  - `getLines`, `getPath`, `helper`
- Top-level variables:
  - `area`, `ctx`, `line`, `line1`, `line1Hovering`, `line2`, `line2Hovering`, `lines`, `x1`, `x2`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/ClickableCircle.js`

- Classes:
  - `ClickableCircle`
- Functions:
  - `helper`
- Top-level variables:
  - `hover`, `r`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/ClickableShape.js`

- Classes:
  - `ClickableShape`
- Functions:
  - `helper`
- Top-level variables:
  - `end1`, `end2`, `halfWidth`, `start1`, `start2`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/GannFan.js`

- Classes:
  - `GannFan`
- Functions:
  - `getLineCoordinates`, `helper`
- Top-level variables:
  - `bottom`, `ctx`, `dx`, `dy`, `end`, `halfX`, `halfY`, `hovering`, `isWithinLineBounds`, `left`, `line1`, `lineCoods`, `lines`, `oneEighthX`, `oneEighthY`, `oneFourthX`, `oneFourthY`, `oneThirdX`, `oneThirdY`, `pairsOfLines`, `right`, `top`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/HoverTextNearMouse.js`

- Classes:
  - `HoverTextNearMouse`
- Functions:
  - `helper`
- Top-level variables:
  - `MIN_WIDTH`, `PADDING`, `cx`, `cy`, `numberOrString`, `rect`, `text`, `textMetaData`, `textNode`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/InteractiveText.js`

- Classes:
  - `InteractiveText`
- Functions:
  - `helper`
- Top-level variables:
  - `rect`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/InteractiveYCoordinate.js`

- Classes:
  - `InteractiveYCoordinate`
- Functions:
  - `helper`
- Top-level variables:
  - `newEdge`, `rect`, `values`, `y`, `yCoord`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/LinearRegressionChannelWithArea.js`

- Classes:
  - `LinearRegressionChannelWithArea`
- Functions:
  - `edge1Provider`, `edge2Provider`, `helper`
- Top-level variables:
  - `a`, `array`, `b`, `combine`, `ctx`, `dy`, `endIndex`, `hovering`, `line`, `n`, `newy1`, `newy2`, `startIndex`, `stdDev`, `x1`, `x2`, `xSquareds`, `xs`, `xys`, `y1`, `y2`, `yDiffs`, `ys`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/MouseLocationIndicator.js`

- Classes:
  - `MouseLocationIndicator`
- Top-level variables:
  - `pos`, `x`, `xValue`, `y`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/StraightLine.js`

- Classes:
  - `StraightLine`
- Functions:
  - `generateLine`, `getLineCoordinates`, `getRayCoordinates`, `getSlope`, `getXLineCoordinates`, `getYIntercept`, `helper`, `isHovering`, `isHovering2`
- Top-level variables:
  - `b`, `end`, `hovering`, `line`, `lineWidth`, `m`, `modLine`, `start`, `x1`, `x2`, `y`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/components/Text.js`

- Classes:
  - `Text`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/DrawingObjectSelector.js`

- Classes:
  - `DrawingObjectSelector`
- Top-level variables:
  - `allSelected`, `interactiveNodes`, `interactives`, `item`, `key`, `morePropsForChart`, `objects`, `selected`, `valueArray`, `valuePresent`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/EquidistantChannel.js`

- Classes:
  - `EquidistantChannel`
- Top-level variables:
  - `b`, `dy`, `eachAppearance`, `m`, `newChannels`, `overrideIndex`, `tempChannel`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/FibonacciRetracement.js`

- Classes:
  - `FibonacciRetracement`
- Top-level variables:
  - `currentRetracement`, `dx`, `eachAppearance`, `eachHoverText`, `hoverTextWidthDefault`, `newRetracements`, `overrideIndex`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/GannFan.js`

- Classes:
  - `GannFan`
- Top-level variables:
  - `eachAppearance`, `newfans`, `overrideIndex`, `tempChannel`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/interactive/InteractiveText.js`

- Classes:
  - `InteractiveText`
- Top-level variables:
  - `defaultHoverText`, `newText`, `newTextList`, `props`, `selected`, `xyValue`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/InteractiveYCoordinate.js`

- Classes:
  - `InteractiveYCoordinate`
- Top-level variables:
  - `draggedAlert`, `newAlertList`, `props`, `selected`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/StandardDeviationChannel.js`

- Classes:
  - `StandardDeviationChannel`
- Top-level variables:
  - `eachAppearance`, `eachDefaultAppearance`, `eachHoverText`, `hoverTextDefault`, `newChannels`, `tempLine`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/TrendLine.js`

- Classes:
  - `TrendLine`
- Top-level variables:
  - `eachAppearance`, `hoverTextWithDefault`, `newTrends`, `tempLine`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/utils.js`

- Functions:
  - `getMorePropsForChart`, `getMouseXY`, `getSelected`, `getValueFromOverride`, `isHover`, `isHoverForInteractiveType`, `saveNodeType`, `terminate`
- Top-level variables:
  - `chartConfig`, `hovering`, `interactive`, `mouseXY`, `objects`, `selecedNodes`, `selected`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachEquidistantChannel.js`

- Classes:
  - `EachEquidistantChannel`
- Top-level variables:
  - `dx`, `dy`, `hoverHandler`, `line1Edge`, `line2Edge`, `newDy`, `newX1Value`, `newX2Value`, `newY1Value`, `newY2Value`, `x1`, `x2`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachFibRetracement.js`

- Classes:
  - `EachFibRetracement`
- Functions:
  - `helper`, `xyProvider`
- Top-level variables:
  - `dir`, `dragHandler`, `dx`, `dy`, `edge1DragHandler`, `edge2DragHandler`, `firstOrLast`, `hoverHandler`, `interactiveCursorClass`, `interactiveEdgeCursorClass`, `lineType`, `lines`, `newX1Value`, `newX2Value`, `newY1Value`, `newY2Value`, `retracements`, `text`, `x`, `x1`, `x2`, `y`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachGannFan.js`

- Classes:
  - `EachGannFan`
- Top-level variables:
  - `dx`, `dy`, `hoverHandler`, `line1Edge`, `newDy`, `newX1Value`, `newX2Value`, `newY1Value`, `newY2Value`, `x1`, `x2`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachInteractiveYCoordinate.js`

- Classes:
  - `EachInteractiveYCoordinate`
- Top-level variables:
  - `dragProps`, `dy`, `hoverHandler`, `newYValue`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachLinearRegressionChannel.js`

- Classes:
  - `EachLinearRegressionChannel`
- Functions:
  - `getNewXY`
- Top-level variables:
  - `currentItem`, `hoverHandler`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachText.js`

- Classes:
  - `EachText`
- Top-level variables:
  - `dx`, `dy`, `hoverHandler`, `xValue`, `xyValue`

### `packages/web/src/components/vninvestcharts/src/lib/interactive/wrapper/EachTrendLine.js`

- Classes:
  - `EachTrendLine`
- Functions:
  - `getNewXY`
- Top-level variables:
  - `dx`, `dy`, `mouseY`, `newX1Value`, `newX2Value`, `newY`, `newY1Value`, `newY2Value`, `x`, `x1`, `x2`, `y`, `y1`, `y2`

### `packages/web/src/components/vninvestcharts/src/lib/scale/discontinuousTimeScaleProvider.js`

- Functions:
  - `discontinuousTimeScaleProvider`, `discontinuousTimeScaleProviderBuilder`, `doStuff`, `evaluateLevel`, `inputDateAccessor`
- Top-level variables:
  - `calculate`, `currentFormatters`, `date`, `dateAccessor`, `discontinuousIndexCalculator`, `discontinuousIndexCalculatorLocalTime`, `finalData`, `i`, `index`, `initialIndex`, `inputIndex`, `level`, `mergedData`, `offsetInMillis`, `response`, `row`, `startOf15Minutes`, `startOf30Minutes`, `startOf30Seconds`, `startOf5Minutes`, `startOfDay`, `startOfEighthOfADay`, `startOfHalfDay`, `startOfHour`, `startOfMinute`, `startOfMonth`, `startOfQuarter`, `startOfQuarterDay`, `startOfWeek`, `startOfYear`, `xScale`

### `packages/web/src/components/vninvestcharts/src/lib/scale/evaluator.js`

- Functions:
  - `canShowTheseManyPeriods`, `extentsWrapper`, `filterData`, `getFilteredResponse`, `getNewEnd`, `showMax`, `showMaxThreshold`, `showMinThreshold`
- Top-level variables:
  - `chartWidth`, `clampedDomain`, `filteredData`, `firstItem`, `lastItem`, `lastItemXValue`, `left`, `log`, `newEnd`, `newLeftIndex`, `newRightIndex`, `newWidth`, `newXScale`, `plotData`, `realInputDomain`, `right`, `width`, `xScale`

### `packages/web/src/components/vninvestcharts/src/lib/scale/financeDiscontinuousScale.js`

- Functions:
  - `scale`
- Top-level variables:
  - `MAX_LEVEL`, `backingTicks`, `d`, `desiredTickCount`, `distance`, `end`, `inverted`, `leftPoint`, `levelPoint`, `point`, `rightPoint`, `start`, `temp`, `tickValues`, `ticks`, `ticksAtLevel`, `ticksMap`, `ticksSet`, `unsortedTicks`

### `packages/web/src/components/vninvestcharts/src/lib/scale/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/scale/levels.js`

- Top-level variables:
  - `defaultFormatters`, `levelDefinition`

### `packages/web/src/components/vninvestcharts/src/lib/series/AlternatingFillAreaSeries.js`

- Classes:
  - `AlternatingFillAreaSeries`
- Top-level variables:
  - `id1`, `id2`, `style1`, `style2`

### `packages/web/src/components/vninvestcharts/src/lib/series/AreaOnlySeries.js`

- Classes:
  - `AreaOnlySeries`
- Top-level variables:
  - `areaSeries`, `d`, `newBase`, `newClassName`

### `packages/web/src/components/vninvestcharts/src/lib/series/AreaSeries.js`

- Functions:
  - `AreaSeries`

### `packages/web/src/components/vninvestcharts/src/lib/series/BarSeries.js`

- Classes:
  - `BarSeries`
- Functions:
  - `getBars`
- Top-level variables:
  - `bars`, `getBase`, `getFill`, `h`, `offset`, `width`, `widthFunctor`, `x`, `y`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/series/BollingerSeries.js`

- Classes:
  - `BollingerSeries`

### `packages/web/src/components/vninvestcharts/src/lib/series/CandlestickSeries.js`

- Classes:
  - `CandlestickSeries`
- Functions:
  - `drawOnCanvas`, `getCandleData`, `getCandlesSVG`, `getWicksSVG`
- Top-level variables:
  - `candleData`, `d`, `fill`, `height`, `offset`, `ohlc`, `stroke`, `wickStroke`, `width`, `widthFunctor`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/series/CircleMarker.js`

- Functions:
  - `Circle`
- Top-level variables:
  - `radius`

### `packages/web/src/components/vninvestcharts/src/lib/series/ElderRaySeries.js`

- Classes:
  - `ElderRaySeries`
- Top-level variables:
  - `y`

### `packages/web/src/components/vninvestcharts/src/lib/series/GroupedBarSeries.js`

- Classes:
  - `GroupedBarSeries`
- Functions:
  - `postProcessor`

### `packages/web/src/components/vninvestcharts/src/lib/series/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/series/KagiSeries.js`

- Classes:
  - `KagiSeries`
- Functions:
  - `drawOnCanvas`, `helper`
- Top-level variables:
  - `begin`, `d`, `dataSeries`, `idx`, `kagi`, `kagiLine`, `last`, `lastPlot`, `pathD`, `paths`, `prevX`

### `packages/web/src/components/vninvestcharts/src/lib/series/LineSeries.js`

- Classes:
  - `LineSeries`
- Top-level variables:
  - `d`, `dataSeries`, `hoverProps`

### `packages/web/src/components/vninvestcharts/src/lib/series/MACDSeries.js`

- Functions:
  - `MACDSeries`, `yAccessorForDivergence`, `yAccessorForDivergenceBase`, `yAccessorForMACD`, `yAccessorForSignal`
- Top-level variables:
  - `fillConfig`, `strokeConfig`

### `packages/web/src/components/vninvestcharts/src/lib/series/OHLCSeries.js`

- Classes:
  - `OHLCSeries`
- Functions:
  - `drawOnCanvas`, `getOHLCBars`
- Top-level variables:
  - `barData`, `barWidth`, `bars`, `classNameFunc`, `ohlc`, `strokeFunc`, `strokeWidth`, `wickNest`, `width`, `x`, `y1`

### `packages/web/src/components/vninvestcharts/src/lib/series/OverlayBarSeries.js`

- Classes:
  - `OverlayBarSeries`
- Functions:
  - `getBars`
- Top-level variables:
  - `b`, `bars`, `getBase`, `getClassName`, `getFill`, `h`, `innerBars`, `offset`, `width`, `widthFunctor`, `x`, `xValue`, `y`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/series/PointAndFigureSeries.js`

- Classes:
  - `PointAndFigureSeries`
- Functions:
  - `drawOnCanvas`, `getColumns`
- Top-level variables:
  - `anyBox`, `boxHeight`, `boxes`, `columnWidth`, `columns`, `width`, `xOffset`

### `packages/web/src/components/vninvestcharts/src/lib/series/RenkoSeries.js`

- Classes:
  - `RenkoSeries`
- Functions:
  - `drawOnCanvas`, `getRenko`
- Top-level variables:
  - `candleWidth`, `candles`, `ohlc`, `svgfill`, `width`, `x`

### `packages/web/src/components/vninvestcharts/src/lib/series/RSISeries.js`

- Functions:
  - `RSISeries`, `renderClip`
- Top-level variables:
  - `clipId1`, `clipId2`, `defaultOpacity`, `defaultStroke`, `defaultStrokeDasharray`, `defaultStrokeWidth`, `opacityConfig`, `strokeConfig`, `strokeDasharrayConfig`, `strokeWidthConfig`

### `packages/web/src/components/vninvestcharts/src/lib/series/SARSeries.js`

- Classes:
  - `SARSeries`
- Top-level variables:
  - `centerX`, `centerY`, `color`, `currentY`, `d`, `hoverProps`, `radius`, `width`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/series/ScatterSeries.js`

- Classes:
  - `ScatterSeries`
- Functions:
  - `drawOnCanvas`, `helper`
- Top-level variables:
  - `fill`, `groupedByFill`, `mProps`, `points`, `stroke`

### `packages/web/src/components/vninvestcharts/src/lib/series/SquareMarker.js`

- Functions:
  - `Square`
- Top-level variables:
  - `w`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/series/StackedBarSeries.js`

- Classes:
  - `StackedBarSeries`
- Functions:
  - `convertToArray`, `doStuff`, `drawOnCanvas2`, `drawOnCanvasHelper`, `getBars`, `getBarsSVG2`, `identityStack`, `rotateXY`, `stack`, `svgHelper`
- Top-level variables:
  - `appearance`, `array`, `arrays`, `barWidth`, `bars`, `d`, `data`, `ds`, `eachBarWidth`, `fillStyle`, `getBase`, `getClassName`, `getFill`, `groupedByFill`, `h`, `key`, `keys`, `modifiedXAccessor`, `modifiedXScale`, `modifiedYAccessor`, `modifiedYScale`, `newData`, `offset`, `postProcessor`, `response`, `stackFn`, `width`, `widthFunctor`, `y`

### `packages/web/src/components/vninvestcharts/src/lib/series/StochasticSeries.js`

- Classes:
  - `StochasticSeries`

### `packages/web/src/components/vninvestcharts/src/lib/series/StraightLine.js`

- Classes:
  - `StraightLine`
- Functions:
  - `getLineCoordinates`
- Top-level variables:
  - `lineCoordinates`

### `packages/web/src/components/vninvestcharts/src/lib/series/SVGComponent.js`

- Classes:
  - `SVGComponent`

### `packages/web/src/components/vninvestcharts/src/lib/series/TriangleMarker.js`

- Functions:
  - `Triangle`, `getFillColor`, `getRotationInDegrees`, `getStrokeColor`, `getTrianglePoints`
- Top-level variables:
  - `directionVal`, `fillColor`, `innerHypotenuse`, `innerOpposite`, `points`, `rotate`, `rotation`, `rotationDeg`, `strokeColor`, `w`

### `packages/web/src/components/vninvestcharts/src/lib/series/VolumeProfileSeries.js`

- Classes:
  - `VolumeProfileSeries`
- Functions:
  - `base`, `drawOnCanvas`, `helper`
- Top-level variables:
  - `allRects`, `begin`, `d`, `directionComparator`, `dx`, `finish`, `histogram2`, `rects`, `sessionBg`, `sessionBgSvg`, `sessionBuilder`, `sessionWidth`, `sessions`, `totalVolume`, `totalVolumeX`, `totalVolumes`, `totalsByDirection`, `values`, `volumeInBins`, `volumeValues`, `w1`, `w2`, `widthValue`, `ws`, `x`, `xScale`

### `packages/web/src/components/vninvestcharts/src/lib/StockChartContext.js`

- Functions:
  - `useStockChart`
- Top-level variables:
  - `StockChartContext`, `StockChartProvider`, `context`

### `packages/web/src/components/vninvestcharts/src/lib/tape/__tests__/TapePanel.test.js`

- Functions:
  - `makeEntry`, `render`
- Top-level variables:
  - `badge`, `bg`, `container`, `empty`, `entry`, `loading`, `panel`, `root`, `row`, `rows`, `whale`

### `packages/web/src/components/vninvestcharts/src/lib/tape/TapePanel.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/BollingerBandTooltip.js`

- Classes:
  - `BollingerBandTooltip`
- Top-level variables:
  - `currentItem`, `item`, `origin`, `tooltipLabel`, `tooltipValue`, `top`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/displayValuesFor.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/GroupTooltip.js`

- Classes:
  - `GroupTooltip`, `SingleTooltip`
- Functions:
  - `orig`
- Top-level variables:
  - `VALID_LAYOUTS`, `comp`, `currentItem`, `dx`, `dy`, `groupTextAnchor`, `singleTooltip`, `textAnchor`, `xPos`, `xyPos`, `yDisplayValue`, `yPos`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/HoverTooltip.js`

- Classes:
  - `HoverTooltip`
- Functions:
  - `backgroundShapeCanvas`, `backgroundShapeSVG`, `calculateTooltipSize`, `drawOnCanvas`, `helper`, `measureText`, `normalizeX`, `normalizeY`, `origin`, `sumSizes`, `tooltipCanvas`, `tooltipSVG`
- Top-level variables:
  - `PADDING`, `X`, `Y`, `bgShape`, `bgSize`, `canvas`, `centerX`, `chartIndex`, `content`, `originX`, `originY`, `pointWidth`, `pointer`, `safePointer`, `startY`, `textY`, `tspans`, `x`, `xValue`, `y`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/MACDTooltip.js`

- Classes:
  - `MACDTooltip`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `divergence`, `macd`, `macdValue`, `origin`, `signal`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/MovingAverageTooltip.js`

- Classes:
  - `MovingAverageTooltip`, `SingleMAToolTip`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `origin`, `tooltipLabel`, `translate`, `yDisplayValue`, `yValue`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/OHLCTooltip.js`

- Classes:
  - `OHLCTooltip`
- Functions:
  - `defaultDisplay`
- Top-level variables:
  - `chartConfigList`, `config`, `currentItem`, `displayDate`, `displayTextsDefault`, `item`, `itemsToDisplay`, `origin`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/RSITooltip.js`

- Classes:
  - `RSITooltip`
- Top-level variables:
  - `currentItem`, `origin`, `rsi`, `tooltipLabel`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/SingleValueTooltip.js`

- Classes:
  - `SingleValueTooltip`
- Top-level variables:
  - `currentItem`, `origin`, `xDisplayValue`, `yDisplayValue`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/StochasticTooltip.js`

- Classes:
  - `StochasticTooltip`
- Top-level variables:
  - `D`, `K`, `currentItem`, `origin`, `stochastic`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/ToolTipText.js`

- Classes:
  - `ToolTipText`

### `packages/web/src/components/vninvestcharts/src/lib/tooltip/ToolTipTSpanLabel.js`

- Functions:
  - `ToolTipTSpanLabel`

### `packages/web/src/components/vninvestcharts/src/lib/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/types/adapter.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/types/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/types/indicator.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/types/ohlcv.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/types/pane.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/types/vninvest.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/utils/__tests__/hexToRGBA.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/utils/__tests__/timezoneFormatter.test.js`

- Top-level variables:
  - `elapsed`, `endTime`, `formatted`, `startTime`, `testEpoch`

### `packages/web/src/components/vninvestcharts/src/lib/utils/accumulatingWindow.js`

- Functions:
  - `accumulatingWindowFn`
- Top-level variables:
  - `accumulateTill`, `accumulatedWindow`, `accumulatorIdx`, `d`, `i`, `response`

### `packages/web/src/components/vninvestcharts/src/lib/utils/barWidth.js`

- Functions:
  - `plotDataLengthBarWidth`, `timeIntervalBarWidth`
- Top-level variables:
  - `first`, `totalWidth`, `width`

### `packages/web/src/components/vninvestcharts/src/lib/utils/ChartDataUtil.js`

- Functions:
  - `findAllCharts`, `getChartConfigWithUpdatedYScales`, `getChartOrigin`, `getCurrentCharts`, `getCurrentItem`, `getDimensions`, `getNewChartConfig`, `getXValue`, `isArraySize2AndNumber`, `setRange`, `values`, `yDomainFromYExtents`
- Top-level variables:
  - `allYValues`, `another`, `bottom`, `chartElements`, `chartHeight`, `chartProps`, `charts`, `combine`, `currentCharts`, `d`, `domain`, `isChart`, `newYScale`, `obj`, `originCoordinates`, `prevChartConfig`, `realYDomain`, `top`, `updatedChartConfig`, `xValue`, `yDomainDY`, `yDomains`, `yExtents`, `yScale`, `yValues`

### `packages/web/src/components/vninvestcharts/src/lib/utils/identity.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/utils/index.js`

- Functions:
  - `capitalizeFirst`, `clearCanvas`, `createVerticalLinearGradient`, `d3Window`, `degrees`, `find`, `forOwn`, `functor`, `getClosestItem`, `getClosestItemIndexes`, `getClosestItemIndexes2`, `getClosestValue`, `getLogger`, `getTouchProps`, `head`, `hexToRGBA`, `isDefined`, `isNotDefined`, `isObject`, `last`, `mapObject`, `mapValue`, `mousePosition`, `path`, `radians`, `replaceAtIndex`, `sign`, `tail`, `toObject`, `touchPosition`, `yes`
- Top-level variables:
  - `MOUSEENTER`, `MOUSELEAVE`, `MOUSEMOVE`, `MOUSEUP`, `TOUCHEND`, `TOUCHMOVE`, `b`, `closest`, `container`, `d3win`, `diff`, `first`, `g`, `grd`, `hex`, `index`, `isArray`, `isProduction`, `item`, `key`, `left`, `length`, `lo`, `logger`, `mappedValue`, `mid`, `object`, `overlayColors`, `parts`, `props`, `r`, `rect`, `result`, `rgbaMatch`, `right`, `value`, `values`

### `packages/web/src/components/vninvestcharts/src/lib/utils/mappedSlidingWindow.js`

- Functions:
  - `mappedSlidingWindowFn`
- Top-level variables:
  - `accumulatorIdx`, `mapped`, `result`, `size`, `undef`, `undefinedValue`, `windowData`

### `packages/web/src/components/vninvestcharts/src/lib/utils/merge.js`

- Functions:
  - `mergeCompute`
- Top-level variables:
  - `algorithm`, `result`, `zip`

### `packages/web/src/components/vninvestcharts/src/lib/utils/noop.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/lib/utils/PureComponent.js`

- Classes:
  - `PureComponent`

### `packages/web/src/components/vninvestcharts/src/lib/utils/rebind.js`

- Functions:
  - `createReboundMethod`
- Top-level variables:
  - `method`, `value`

### `packages/web/src/components/vninvestcharts/src/lib/utils/shallowEqual.js`

- Functions:
  - `isDate`, `isEqual`
- Top-level variables:
  - `numKeysA`

### `packages/web/src/components/vninvestcharts/src/lib/utils/slidingWindow.js`

- Functions:
  - `slidingWindowFn`
- Top-level variables:
  - `accumulatorIdx`, `size`, `sourceFunction`, `undef`, `undefinedValue`, `windowData`

### `packages/web/src/components/vninvestcharts/src/lib/utils/strokeDasharray.js`

- Functions:
  - `getStrokeDasharray`, `getStrokeDasharrayCanvas`
- Top-level variables:
  - `a`, `strokeDashTypes`

### `packages/web/src/components/vninvestcharts/src/lib/utils/timezoneFormatter.js`

- Functions:
  - `formatWithTimezone`, `getCachedFormatter`, `getGlobalTimezone`, `setGlobalTimezone`
- Top-level variables:
  - `cacheKey`, `d`, `extendedOptions`, `fallbackOptions`, `formatter`, `formatterCache`, `globalTimezone`, `tz`

### `packages/web/src/components/vninvestcharts/src/lib/utils/zipper.js`

- Functions:
  - `d3_zipLength`, `zip`
- Top-level variables:
  - `combine`, `i`, `m`, `n`

### `packages/web/src/components/vninvestcharts/src/lib/utils/zoomBehavior.js`

- Functions:
  - `lastVisibleItemBasedZoomAnchor`, `mouseBasedZoomAnchor`, `rightDomainBasedZoomAnchor`
- Top-level variables:
  - `currentItem`, `lastItem`

### `packages/web/src/components/vninvestcharts/src/lib/withContext.js`

- Functions:
  - `withChart`, `withChartAndStockChart`, `withStockChart`
- Top-level variables:
  - `chartContext`, `context`, `stockChartContext`

### `packages/web/src/components/vninvestcharts/src/lib/ZoomButtons.js`

- Classes:
  - `ZoomButtons`
- Top-level variables:
  - `c`, `centerX`, `cx`, `foo`, `hLength`, `left`, `resetX`, `right`, `textY`, `wLength`, `y`, `zoomIn`, `zoomInX`, `zoomOut`, `zoomOutX`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/canaryBarFiltering.test.js`

- Functions:
  - `createMockBars`
- Top-level variables:
  - `bars`, `bars10`, `bars3`, `empty`, `info`, `info1`, `info2`, `original`, `result`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/CanaryRollbackHelper.test.js`

- Functions:
  - `createSnapshot`
- Top-level variables:
  - `after`, `before`, `event`, `formatted`, `rec`, `result`, `validation`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/CanaryRolloutConfig.test.js`

- Top-level variables:
  - `baseMetrics`, `formatted`, `invalidParams`, `metrics`, `params10`, `params100`, `params30`, `result`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/DrawingRegistryContract.test.js`

- Functions:
  - `buildToolEvidenceRegex`, `escapeRegex`, `hasRegex`
- Top-level variables:
  - `authoringChecked`, `contractTestContent`, `contractTestPaths`, `coverageMatrix`, `enabledTools`, `escapedTool`, `evidence`, `hasAuthoringTest`, `hasManipulationTest`, `hasTextEditContext`, `hasTextEditSignal`, `hasTextEditTest`, `isReferenced`, `manipulationChecked`, `missingCaps`, `textEditChecked`, `uncoveredTools`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/forkDrawingSupport.test.js`

- Top-level variables:
  - `desc`, `matrix`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.autoForkAuthoring.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `authoringData`, `bottom`, `container`, `createdDrawings`, `currentInputsKey`, `dataIndex`, `endPoint`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleDrawingWorkspaceChange`, `handleDrawingsChange`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastInputsRef`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `pointerContext`, `priceSnapshot`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `startPoint`, `value`, `workspace`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.canaryRollback.test.js`

- Functions:
  - `createBar`, `flushMicrotasks`, `renderChart`
- Top-level variables:
  - `React`, `VNInvestCharts`, `actual`, `adapter`, `container`, `data`, `getContextSpy`, `handleRollback`, `latestRenderedBars`, `reactActEnvironment`, `ref`, `restoreGetContext`, `root`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.contract.test.js`

- Functions:
  - `ThrowingChild`, `clickAt`, `createAdapter`, `createDeferred`, `createMockDrawingPriceLabelsState`, `createMockForkOverlayState`, `createMockMeasurementState`, `emitPaneHover`, `flushMicrotasks`, `getLatestPrimitiveSnapshot`, `mergeTestPaneSnapshotDomains`, `readActionHandles`, `readPrimitive`, `renderChart`, `resolveDrawingPointIndex`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLineBodyPoint`, `resolveTrendLineLockHandlePoint`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `VNInvestCharts`, `WidgetErrorBoundary`, `WidgetI18nProvider`, `abortSpy`, `act`, `actionData`, `actionHandlePoint`, `adapter`, `authoringData`, `baseDrawing`, `bodyPoint`, `bottom`, `capabilities`, `chartPointToPixelWithBridge`, `container`, `contextData`, `contextHitPoint`, `createDrawingObject`, `createRoot`, `createdDrawing`, `createdDrawings`, `currentInputsKey`, `dataIndex`, `drawing`, `drawingPrimitive`, `drawingPrimitives`, `drawings`, `drawingsAfterAuthoring`, `drawingsAfterSecond`, `endPoint`, `endX`, `endY`, `engineHostPropsHistory`, `engineSurface`, `existingDrawing`, `expectedAbsoluteLockPoint`, `expectedLocalLockPoint`, `expectedSecondY`, `fetchBarsBefore`, `fetchBarsInRange`, `fetchDeferred`, `firstAdapter`, `firstBodyPoint`, `firstDrawing`, `firstEnd`, `firstFetch`, `firstHitPoint`, `firstIndex`, `firstPoint`, `firstStart`, `firstX`, `firstY`, `forkEngineSnapshots`, `forkRuntimeData`, `handleDrawingWorkspaceChange`, `handleDrawingsChange`, `handleRuntimeCapabilitiesChange`, `handleRuntimeResolved`, `handleSelectedDrawingChange`, `hit`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `initialDrawingPrimitives`, `initialNonNullWorkspaceCalls`, `initialPrimitive`, `label`, `lastInputsRef`, `latestHostProps`, `localX`, `localY`, `lockCenter`, `lockPrimitive`, `lockToggleUpdate`, `manipulationData`, `measurementPointToPixelWithBridge`, `menuItem`, `mockEngineInstance`, `mockEngineSetHistorySnapshot`, `mockVisibleRange`, `movedDrawing`, `movedDrawings`, `movedFirstDrawing`, `movedSecondDrawing`, `openDock`, `originalConsoleError`, `overlay`, `overlayInputs`, `overlayInputsAfterMultiSelect`, `patternPoints`, `point`, `pointerContext`, `priceDomain`, `priceSnapshot`, `primaryMarker`, `primitive`, `primitiveAfterBlur`, `primitiveAfterRuntimeRoundTrip`, `primitiveBeforeMove`, `primitiveDuringDrag`, `primitiveDuringMove`, `promise`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `reject`, `renderedDrawing`, `resizeEndPoint`, `resizeStartPoint`, `resizedDrawings`, `resolve`, `resolveChartPointWithBridge`, `resolveMeasurementPointWithBridge`, `restoredPrimitive`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `secondAdapter`, `secondBodyPoint`, `secondDrawing`, `secondEnd`, `secondFetch`, `secondHitPoint`, `secondIndex`, `secondPoint`, `secondStart`, `secondX`, `secondY`, `selectedDrawing`, `selectedPriceLabels`, `selectionData`, `selectionHitPoint`, `snapshot`, `staleSelectedDrawing`, `startPoint`, `updatedDrawingPrimitives`, `value`, `volumeSnapshot`, `workspace`, `x`, `y`, `zIndexUpdate`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.cursorSemantics.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `engineHostPropsHistory`, `engineSurface`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleDrawingWorkspaceChange`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastInputsRef`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `pointerContext`, `priceSnapshot`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `value`, `workspace`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.engineHost.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`
- Top-level variables:
  - `React`, `adapter`, `container`, `ema13`, `ema20`, `emaDefault`, `engineHostPropsHistory`, `enginePanes`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `latestHostProps`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `panes`, `pricePane`, `reactActEnvironment`, `ref`, `root`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.extendedRangeReplay.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `readPrimitive`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `baseDrawing`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `drawingData`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `initialPrimitive`, `lastInputsRef`, `latestHostProps`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `overlayInputs`, `pointerContext`, `priceSnapshot`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `restoredPrimitive`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `sharedPrimitive`, `value`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.forkPaneOverlay.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `bottom`, `clientX`, `clientY`, `container`, `currentInputsKey`, `dataIndex`, `drawingPrimitives`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handlePaneHover`, `handlePaneSnapshotsChange`, `hit`, `host`, `hoverLabel`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `labelTexts`, `labels`, `lastInputsRef`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `nodes`, `originalConsoleError`, `overlayInputs`, `pointerContext`, `priceTooltip`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `snapshot`, `snapshots`, `value`, `volumeTooltip`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.fractionalZoomRestore.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `readPrimitive`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `baseDrawing`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `drawingData`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `initialPrimitive`, `lastInputsRef`, `latestHostProps`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `overlayInputs`, `pointerContext`, `priceSnapshot`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `restoredPrimitive`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `value`, `x`, `y`, `zoomedPrimitive`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.historyBackfill.test.js`

- Functions:
  - `createBar`, `emitVisibleDomain`, `flushMicrotasks`, `waitForBarsEmission`, `waitForForkVisibleRangeHandler`, `waitForPredicate`, `waitForVisibleDomainHandler`
- Top-level variables:
  - `React`, `VNInvestCharts`, `actual`, `adapter`, `autoEmitForkVisibleRange`, `backwardCoverage`, `bars`, `barsAfterStaleResolve`, `barsBeforeStaleResolve`, `boundaryBar`, `callCountAfterFirstSession`, `calls`, `container`, `controlledBars`, `emittedBars`, `engineHostPropsHistory`, `fetchBarsBeforeCallCountBeforePan`, `firstBar`, `firstBefore`, `firstOlderBars`, `firstOlderBarsPromise`, `forkEngineSnapshots`, `getContextSpy`, `handleBarsChange`, `handleVisibleDomainChange`, `initialBars`, `initialBars1h`, `initialBars4h`, `initialFetchCount`, `lastBars`, `latestHostProps`, `latestRenderedBars`, `latestVisibleDomainHandler`, `liveBar`, `liveCallback`, `mockEngineInstance`, `mockVisibleRange`, `newerBars`, `olderBars`, `originalTrimToWindow`, `rangeCoverage`, `reactActEnvironment`, `ref`, `requestedBefore`, `resolveFirstOlderBars`, `resolveStaleBackfill`, `restoreGetContext`, `root`, `secondBar`, `secondOlderBars`, `staleBackfillPromise`, `staleOlderBars`, `store`, `thirdOlderBars`, `trimToWindowCalls`, `visibleDomainEmitted`, `visibleDomainHandler`, `visibleRangeHandler`, `warmedBars`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.historySnapshot.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`
- Top-level variables:
  - `React`, `adapter`, `bars`, `bars1`, `bars2`, `callsBefore`, `container`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `lastCall`, `mockEngineInstance`, `mockEngineSetHistorySnapshot`, `mockVisibleRange`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`, `snapshot`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.historySyncQueue.test.js`

- Functions:
  - `createBar`, `emitVisibleDomain`, `flushMicrotasks`, `waitForPredicate`, `waitForVisibleDomainHandler`
- Top-level variables:
  - `React`, `VNInvestCharts`, `actual`, `adapter`, `container`, `firstOlderBars`, `firstOlderBarsPromise`, `getContextSpy`, `initialBars`, `latestVisibleDomainHandler`, `reactActEnvironment`, `ref`, `resolveFirstOlderBars`, `restoreGetContext`, `root`, `secondOlderBars`, `visibleDomainHandler`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.legacyPaneSnapshots.contract.test.js`

- Functions:
  - `Harness`, `createAdapter`, `flushMicrotasks`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `adapter`, `clientX`, `clientY`, `container`, `fetchBarsBefore`, `fetchBarsInRange`, `forkRuntimeData`, `handlePaneHover`, `handlePaneSnapshotsChange`, `hoveredSnapshot`, `originalConsoleError`, `paneSnapshots`, `priceSnapshot`, `reactActEnvironment`, `ref`, `renderCount`, `root`, `snapshots`, `stateHost`, `value`, `widgetRoot`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.measurement.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `createMockMeasurementState`, `emitPaneHover`, `flushMicrotasks`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `bottom`, `bridge`, `chartPixel`, `chartPoint`, `container`, `currentInputsKey`, `dataIndex`, `drawingPrimitives`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `firstBarPixel`, `firstBarPixelFromIndexAnchor`, `forkEngineSnapshots`, `forkRuntimeData`, `fractionalBridge`, `handleCoordinateBridgeChange`, `handlePaneHover`, `hit`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastBarPixel`, `lastInputsRef`, `latestHostProps`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `overlay`, `overlayInputs`, `pixel`, `point`, `pointerContext`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `snapshot`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.menu.test.js`

- Functions:
  - `createBar`, `flushMicrotasks`
- Top-level variables:
  - `React`, `VNInvestCharts`, `actual`, `adapter`, `cancelBtn`, `container`, `createElementSpy`, `data`, `fullscreenBtn`, `getContextSpy`, `img`, `mockDataUrl`, `previewModal`, `reactActEnvironment`, `ref`, `restoreGetContext`, `root`, `saveBtn`, `saveSpy`, `searchBtn`, `settingsBtn`, `snapshotBtn`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.noButtonMove.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `readPrimitive`, `resolveDrawingPointIndex`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLineBodyPoint`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `afterNoButtonMovePrimitive`, `baseDrawing`, `bodyPoint`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `firstIndex`, `firstPoint`, `firstX`, `firstY`, `forkEngineSnapshots`, `forkRuntimeData`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `initialPrimitive`, `lastInputsRef`, `localX`, `localY`, `manipulationData`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `overlayInputs`, `pointerContext`, `priceSnapshot`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `secondIndex`, `secondPoint`, `secondX`, `secondY`, `value`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.nonPrimaryPointer.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `resolveDrawingPointIndex`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLineBodyPoint`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `baseDrawing`, `bodyPoint`, `bottom`, `callsBeforeDrag`, `container`, `currentInputsKey`, `dataIndex`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `firstIndex`, `firstPoint`, `firstX`, `firstY`, `forkEngineSnapshots`, `forkRuntimeData`, `handleDrawingsChange`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastInputsRef`, `localX`, `localY`, `manipulationData`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `pointerContext`, `priceSnapshot`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `secondIndex`, `secondPoint`, `secondX`, `secondY`, `value`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.paneConsumers.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `capabilities`, `container`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handlePaneAddSeriesRequest`, `handlePaneToggleSeriesRequest`, `handlePaneToggleVisibleRequest`, `handleRuntimeCapabilitiesChange`, `mockEngineInstance`, `mockVisibleRange`, `mountedContainer`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`, `splitters`, `toolbar`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.pointer.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `resolveDrawingPointIndex`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLineBodyPoint`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `bottom`, `container`, `contextHitPoint`, `currentInputsKey`, `dataIndex`, `drawing`, `drawingPrimitives`, `engineHostPropsHistory`, `engineSurface`, `fetchBarsBefore`, `fetchBarsInRange`, `firstIndex`, `firstPoint`, `firstX`, `firstY`, `forkEngineSnapshots`, `forkRuntimeData`, `handleClick`, `handleContextMenu`, `hit`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastInputsRef`, `latestEngineHostProps`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `overlayInputs`, `pointerContext`, `priceSnapshot`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `secondIndex`, `secondPoint`, `secondX`, `secondY`, `snapshot`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.regressions.contract.test.js`

- Functions:
  - `ThrowingChild`, `createAdapter`, `createDeferred`, `flushMicrotasks`, `resolveHoveredPaneId`
- Top-level variables:
  - `React`, `abortSpy`, `adapter`, `addSpy`, `alertDiv`, `bottom`, `container`, `currentAbortCalls`, `fetchBarsBefore`, `fetchBarsInRange`, `fetchDeferred`, `firstAdapter`, `firstFetch`, `forkEngineSnapshots`, `hoveredSnapshot`, `localX`, `localY`, `mockEngineInstance`, `mockOnError`, `mockVisibleRange`, `originalConsoleError`, `promise`, `reactActEnvironment`, `rect`, `ref`, `reject`, `removeSpy`, `resolve`, `right`, `root`, `secondAdapter`, `secondFetch`, `testError`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.runtimeMounts.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `capabilities`, `child`, `childSurface`, `container`, `cvdOverlay`, `externalCvdOverlay`, `externalCvdSeries`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleRuntimeCapabilitiesChange`, `host`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`, `value`, `whaleOrders`, `whaleOverlay`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.runtimeParity.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `capabilities`, `container`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleRuntimeCapabilitiesChange`, `handleRuntimeResolved`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.runtimeSelection.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `capabilities`, `close`, `container`, `data`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkCapabilities`, `forkEngineSnapshots`, `forkRuntimeData`, `getContextSpy`, `handleRuntimeCapabilitiesChange`, `host`, `latestHostProps`, `legacyCapabilities`, `mockEngineInstance`, `mockVisibleRange`, `open`, `originalConsoleError`, `panes`, `reactActEnvironment`, `ref`, `root`, `seriesData`, `surface`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.scaleContext.contract.test.js`

- Functions:
  - `ContextCapturer`, `createAdapter`, `flushMicrotasks`
- Top-level variables:
  - `React`, `adapter`, `capturedContext`, `container`, `fetchBarsBefore`, `fetchBarsInRange`, `firstDatumDate`, `forkEngineSnapshots`, `forkRuntimeData`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`, `x10`, `x10_5`, `x11`, `xByDate`, `xByIndexZero`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.scaleSlotContract.test.js`

- Top-level variables:
  - `normalizedPanes`, `rawFirstSeries`, `rawPanes`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.selectionClear.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `baseDrawing`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `drawingData`, `engineHostPropsHistory`, `engineSurface`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleSelectedDrawingChange`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastInputsRef`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `pointerContext`, `priceSnapshot`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `value`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.splitterPointer.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `PointerEventCtor`, `React`, `adapter`, `authoringData`, `bottom`, `container`, `createdDrawings`, `currentInputsKey`, `dataIndex`, `drawings`, `endPoint`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleDrawingWorkspaceChange`, `handleDrawingsChange`, `host`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `lastInputsRef`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `pointerContext`, `priceSnapshot`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `splitterOwner`, `startPoint`, `value`, `workspace`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.tail.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `container`, `darkFlowBadge`, `exported`, `exportedAfterImport`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `initialDrawing`, `legacyChild`, `measurementOverlay`, `mockEngineInstance`, `mockVisibleRange`, `newDrawings`, `onDrawingsChange`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`, `storage`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.visibleRange.contract.test.js`

- Functions:
  - `createAdapter`, `createDenseData`, `flushMicrotasks`, `renderForkChart`
- Top-level variables:
  - `React`, `adapter`, `base`, `container`, `denseData`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `handleVisibleDomainChange`, `handleVisibleRangeChange`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `reactActEnvironment`, `ref`, `root`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.visibleRangeAnchor.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `readPrimitive`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `baseDrawing`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `drawingData`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `initialPrimitive`, `lastInputsRef`, `latestHostProps`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `overlayInputs`, `pannedPrimitive`, `pointerContext`, `priceSnapshot`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `restoredPrimitive`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `value`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.visibleRangeOffGrid.contract.test.js`

- Functions:
  - `createAdapter`, `createMockForkOverlayState`, `emitPaneHover`, `flushMicrotasks`, `mergeTestPaneSnapshotDomains`, `readPrimitive`, `resolveMockForkHoveredDataIndex`, `resolveMockForkHoveredPaneId`, `resolvePointerContext`, `resolveTrendLinePointPixel`, `waitForTruthyValue`
- Top-level variables:
  - `React`, `adapter`, `baseDrawing`, `bottom`, `container`, `currentInputsKey`, `dataIndex`, `drawingData`, `engineHostPropsHistory`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `hoveredDataIndex`, `hoveredPaneId`, `hoveredSnapshot`, `initialPrimitive`, `lastInputsRef`, `latestHostProps`, `localX`, `localY`, `mockEngineInstance`, `mockVisibleRange`, `offGridEnd`, `offGridStart`, `originalConsoleError`, `overlayInputs`, `pannedPrimitive`, `pointerContext`, `priceSnapshot`, `primitive`, `ratio`, `reactActEnvironment`, `rect`, `ref`, `restoredPrimitive`, `right`, `root`, `scaleSlotDomains`, `scaleSlotStates`, `value`, `x`, `y`

### `packages/web/src/components/vninvestcharts/src/widget/__tests__/VNInvestCharts.xExtents.contract.test.js`

- Functions:
  - `createAdapter`, `flushMicrotasks`
- Top-level variables:
  - `React`, `adapter`, `container`, `extendedForkRuntimeData`, `fetchBarsBefore`, `fetchBarsInRange`, `forkEngineSnapshots`, `forkRuntimeData`, `mockEngineInstance`, `mockVisibleRange`, `originalConsoleError`, `prependedData`, `reactActEnvironment`, `ref`, `root`

### `packages/web/src/components/vninvestcharts/src/widget/adapters/barsPagingPolicy.js`

- Functions:
  - `asFiniteNumber`, `buildBackwardPageRequest`, `normalizeBarsPagingMeta`, `resolveOldestBarTimestamp`
- Top-level variables:
  - `before`, `explicitHasMoreAfter`, `explicitHasMoreBefore`, `explicitNextBefore`, `hasMoreAfter`, `hasMoreBefore`, `nextBefore`, `oldest`, `oldestBarTs`, `parsed`, `snapshotId`, `ts`

### `packages/web/src/components/vninvestcharts/src/widget/adapters/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/adapters/VNInvestClient.js`

- Classes:
  - `VNInvestClient`
- Functions:
  - `asNumber`, `asObject`, `buildEndpoints`, `cloneBarsHotWindowTelemetry`, `cloneBarsPageResponse`, `createBarsHotWindowKey`, `diffBarsHotWindowTelemetry`, `evaluateBarsHotWindowLoadGate`, `extractChartPoints`, `isWhaleFeedResponse`, `markBarsHotWindowTelemetry`, `normalizeApiBase`, `normalizeChartBars`, `normalizeChartPoint`, `normalizeTimeframe`, `parseDateValue`, `pruneExpiredBarsHotWindowEntries`, `requestPromise`, `resolveApiBase`, `resolveBrowserOrigin`, `resolveTechnical`
- Top-level variables:
  - `API_BASE_STORAGE_KEY`, `BARS_HOT_WINDOW_TTL_MS`, `DEFAULT_API_BASE`, `DEFAULT_BARS_HOT_WINDOW_LOAD_GATE_THRESHOLDS`, `PAT_STORAGE_KEY`, `TIMEFRAME_MAP`, `bars`, `barsHotWindowCache`, `barsHotWindowInFlight`, `barsHotWindowTelemetry`, `browserOrigin`, `cacheHitRatio`, `cacheKey`, `cachedEntry`, `candidates`, `close`, `collapseRatio`, `data`, `dateRaw`, `dateValue`, `endpoints`, `globalScope`, `headers`, `high`, `inFlight`, `low`, `nestedData`, `networkRequestRatio`, `normalized`, `normalizedOrigin`, `now`, `numeric`, `obj`, `open`, `pagingMeta`, `params`, `parsed`, `payload`, `point`, `points`, `rawBars`, `reasons`, `response`, `savedRequestRatio`, `scope`, `sharedResponse`, `stored`, `technical`, `text`, `totalRequests`, `trimmed`, `url`, `urlParams`, `volume`

### `packages/web/src/components/vninvestcharts/src/widget/adapters/VNInvestDataAdapter.js`

- Classes:
  - `VNInvestDataAdapter`
- Functions:
  - `pageToOHLCV`, `sortBarsByDate`
- Top-level variables:
  - `PAGE_LIMIT`, `allBars`, `bar`, `bars`, `covered`, `initParams`, `items`, `key`, `newestTs`, `oldestTs`, `page`, `params`, `snapshotId`, `subs`, `symbolUpper`

### `packages/web/src/components/vninvestcharts/src/widget/adapters/VNInvestWebSocketClient.js`

- Classes:
  - `VNInvestWebSocketClient`
- Top-level variables:
  - `available`, `hostname`, `httpBase`, `normalized`, `parsed`, `resolved`, `response`, `symbols`, `url`, `wsBase`, `wsPath`

### `packages/web/src/components/vninvestcharts/src/widget/BackfillWorkerFlags.js`

- Functions:
  - `resolveBackfillWorkerFlags`
- Top-level variables:
  - `DEFAULT_BACKFILL_WORKER_FLAGS`, `externalWorkerParam`, `flags`, `lodWorkerParam`

### `packages/web/src/components/vninvestcharts/src/widget/BackfillWorkerFlags.test.js`

- Top-level variables:
  - `flags`, `params`

### `packages/web/src/components/vninvestcharts/src/widget/canaryBarFiltering.js`

- Functions:
  - `applyCanaryFilter`, `getCanarySliceInfo`
- Top-level variables:
  - `keepCount`

### `packages/web/src/components/vninvestcharts/src/widget/CanaryRollbackHelper.js`

- Functions:
  - `createEmergencyRollbackTrigger`, `formatRollbackEvent`, `validateRollbackSafety`
- Top-level variables:
  - `_exhaustive`, `barCountDiff`, `barDiff`, `barDiffStr`, `hasUnexpectedBarLoss`, `isRollingBack`, `severity`, `status`, `workerStateChanged`

### `packages/web/src/components/vninvestcharts/src/widget/CanaryRolloutConfig.js`

- Functions:
  - `formatCanaryMetrics`, `makeCanaryGateRecommendation`, `parseCanaryLevel`, `resolveCanaryLevel`
- Top-level variables:
  - `DEFAULT_CANARY_LEVEL`, `VALID_CANARY_LEVELS`, `level`, `parsed`, `parts`, `thresholds`, `urlLevel`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/__tests__/DrawingDock.test.js`

- Top-level variables:
  - `container`, `labels`, `objectsButton`, `onTabChange`, `reactActEnvironment`, `root`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/__tests__/DrawingInspector.test.js`

- Top-level variables:
  - `buttons`, `cancelButton`, `checkedRadio`, `container`, `drawing`, `editButton`, `extendedRadio`, `flags`, `inputs`, `labels`, `lineStyleSelect`, `lineTypeLabels`, `onCancel`, `onChange`, `onCommit`, `onStartEdit`, `onUpdate`, `opacityInput`, `radios`, `reactActEnvironment`, `root`, `saveButton`, `setInputValue`, `setSelectValue`, `strokeInput`, `strokeWidthInput`, `textLabels`, `textarea`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/__tests__/DrawingListPanel.test.js`

- Functions:
  - `makeDrawing`
- Top-level variables:
  - `a`, `b`, `c`, `d`, `drawings`, `result`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/__tests__/DrawingSemanticPointLegend.test.js`

- Top-level variables:
  - `container`, `drawing`, `firstPointButton`, `labels`, `onPointFocusChange`, `pointButtons`, `reactActEnvironment`, `root`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/DrawingDock.js`

- Functions:
  - `handleHeaderPointerDown`, `handlePointerMove`, `handlePointerUp`
- Top-level variables:
  - `baseLeft`, `baseTop`, `dragStartRef`, `height`, `left`, `maxOffsetX`, `maxOffsetY`, `minOffsetX`, `minOffsetY`, `nextX`, `nextY`, `node`, `resolvedContent`, `rootRef`, `top`, `width`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/DrawingInspector.js`

- Functions:
  - `DrawingAlertPanel`, `addNewFibLevel`, `handleDeleteTemplate`, `handleLoadTemplate`, `handleSaveTemplate`, `isColorString`, `setCondition`, `toggleEnabled`, `updateStyle`, `validateAndMapXCoordinate`
- Top-level variables:
  - `FIB_TOOLS_WITH_LEVEL_CONFIGS`, `T`, `barTime`, `condition`, `configs`, `cooldownSec`, `currentColor`, `currentValue`, `dateVal`, `diff`, `direction`, `effectiveDrawing`, `enabled`, `fieldLabel`, `labelText`, `left`, `locked`, `mappedX`, `minDiff`, `name`, `nearestBar`, `newLevelInputRef`, `next`, `nextPoints`, `parsed`, `pointLabel`, `ratio`, `reward`, `risk`, `rr`, `segStyle`, `segVisible`, `strokeDasharray`, `style`, `template`, `timeString`, `top`, `updated`, `updatedList`, `val`, `visible`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/DrawingListPanel.js`

- Functions:
  - `filterDrawings`, `formatTimestamp`, `generateDrawingLabel`, `loadCollapsedGroups`, `renderDrawingItem`, `reorderDrawings`, `saveCollapsedGroups`
- Top-level variables:
  - `STORAGE_KEY`, `TOOL_LABELS`, `customLabel`, `displayedCount`, `existing`, `filteredDrawings`, `fromIdx`, `groupLabel`, `grouped`, `isCollapsed`, `isDragOver`, `isHidden`, `isLocked`, `isSearching`, `isSelected`, `left`, `map`, `next`, `parsed`, `q`, `raw`, `rawType`, `result`, `toIdx`, `toggleGroup`, `toolLabel`, `top`

### `packages/web/src/components/vninvestcharts/src/widget/components/drawing/DrawingSemanticPointLegend.js`

- Top-level variables:
  - `isActive`, `pointLabels`

### `packages/web/src/components/vninvestcharts/src/widget/components/footer/TimeframeFooter.js`

- Functions:
  - `TimeframeFooter`
- Top-level variables:
  - `RANGES`, `TIMEFRAMES`, `handleRangeClick`, `handleTimeframeClick`, `isActive`, `isDisabled`

### `packages/web/src/components/vninvestcharts/src/widget/components/ForkPaneTooltips.js`

- Functions:
  - `ForkPaneTooltips`
- Top-level variables:
  - `labelColor`, `snapshot`, `snapshotMap`, `textColor`, `tokens`

### `packages/web/src/components/vninvestcharts/src/widget/components/ForkXAxisOverlay.js`

- Functions:
  - `ForkXAxisOverlay`
- Top-level variables:
  - `backgroundColor`, `textColor`, `tickColor`

### `packages/web/src/components/vninvestcharts/src/widget/components/header/OHLCHeader.js`

- Functions:
  - `OHLCHeader`, `formatChange`, `formatPrice`, `formatVolume`
- Top-level variables:
  - `change`, `changeRef`, `diff`, `ohlcRef`, `pct`, `sign`, `volRef`

### `packages/web/src/components/vninvestcharts/src/widget/components/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/components/overlays/AdvisoryPanel.js`

- Functions:
  - `AdvisoryPanel`, `AgentRow`, `SkeletonRow`, `formatConfidence`, `formatTimestamp`, `formatWeight`, `scoreBarColor`, `scoreToPercent`
- Top-level variables:
  - `DECISION_STYLES`, `agentKey`, `barColor`, `decisionKey`, `decisionLabel`, `decisionStyle`, `label`, `pct`

### `packages/web/src/components/vninvestcharts/src/widget/components/overlays/TapePanel.js`

- Functions:
  - `TapePanel`, `formatPrice`, `formatTime`, `formatValue`, `formatVolume`
- Top-level variables:
  - `ROW_HEIGHT`, `SIDE_COLORS`, `WHALE_BG`, `WHALE_BORDER`, `atBottom`, `billions`, `d`, `el`, `filtered`, `h`, `m`, `millions`, `prevLengthRef`, `s`, `scrollRef`, `sideStyle`, `threshold`, `userScrolledRef`

### `packages/web/src/components/vninvestcharts/src/widget/components/overlays/WhalePanel.js`

- Functions:
  - `WhalePanel`, `formatBillion`
- Top-level variables:
  - `billion`, `net`, `rows`

### `packages/web/src/components/vninvestcharts/src/widget/components/replay/ReplayControlBar.js`

- Functions:
  - `ReplayControlBar`
- Top-level variables:
  - `SPEEDS`

### `packages/web/src/components/vninvestcharts/src/widget/components/search/VNSymbolSearch.js`

- Functions:
  - `VNSymbolSearch`, `commitRawQuery`, `handleClick`, `handleFocus`, `handleInputChange`, `handleKeyDown`, `handleSelect`, `readRecentItems`, `saveRecentItem`
- Top-level variables:
  - `EXCHANGE_OPTIONS`, `MAX_RECENT`, `RECENT_SYMBOLS_KEY`, `VN30_SYMBOLS`, `debounceRef`, `deduped`, `effectiveAdapter`, `effectiveClient`, `exchange`, `mapped`, `q`, `raw`, `searchSymbols`, `selected`, `showEmptyPanel`, `showResultsPanel`, `stocks`, `symbol`, `symbols`, `updated`, `wrapperRef`

### `packages/web/src/components/vninvestcharts/src/widget/components/settings/SettingsModal.js`

- Functions:
  - `SettingsModal`, `formatSeriesDisplayName`, `formatSeriesSuffix`, `getIndicatorSetLabel`, `getPaneLabel`, `handleAddSeries`, `handleApplyIndicatorSet`, `handleDeleteIndicatorSet`, `handleImportIndicatorSetChange`, `handleImportIndicatorSetClick`, `handleParamChange`, `handleSaveCurrentIndicatorSet`, `handler`, `numberParam`, `renderIndicatorSetsSection`, `renderIndicatorsSection`, `renderLayoutSection`, `renderResetSection`, `renderSeriesParams`, `renderSetCard`, `renderThemeSection`, `supportsSeriesLineWidth`, `updateTarget`
- Top-level variables:
  - `LINE_WIDTH_SERIES_TYPES`, `SECTIONS`, `SERIES_ABBREVIATIONS`, `SERIES_LABEL_KEYS`, `TECHNICAL_INDICATORS`, `abbreviation`, `activeAlertAudioEnabled`, `activeCvdMode`, `activeEnableCVD`, `activeEnableWhale`, `activeIsDark`, `activeMaxVisibleBars`, `activeMaxVisiblePanes`, `activeOnAlertAudioEnabledChange`, `activeOnCVDModeChange`, `activeOnEnableCVDChange`, `activeOnEnableWhaleChange`, `activeOnMaxVisibleBarsChange`, `activeOnMaxVisiblePanesChange`, `activeOnReset`, `activeOnSelectedPaneIdChange`, `activeOnShowDrawingPriceMarkersChange`, `activeOnShowNonTradingDaysChange`, `activeOnTimezoneChange`, `activeOnWhaleThresholdChange`, `activeSelectedPaneId`, `activeShowDrawingPriceMarkers`, `activeShowNonTradingDays`, `activeTimezone`, `activeToggleTheme`, `activeWhaleThreshold`, `availableSeriesTypes`, `backdropRef`, `baseLabel`, `builtinSets`, `canMoveDown`, `canMoveUp`, `composerEntry`, `currentTheme`, `currentVal`, `entry`, `fields`, `file`, `importInputRef`, `imported`, `indicatorSets`, `isSelected`, `labelKey`, `name`, `nextSelectedPaneId`, `nextTheme`, `root`, `safeT`, `saved`, `selectedPane`, `set`, `suffix`, `userSets`, `val`, `visibleCount`, `visibleIndex`, `visiblePanes`, `withSuffix`

### `packages/web/src/components/vninvestcharts/src/widget/components/settings/SettingsRangeSlider.js`

- Functions:
  - `SettingsRangeSlider`, `areValuesClose`, `clamp`
- Top-level variables:
  - `activeTolerance`, `clampedValue`, `hasActiveMark`, `hasMarks`, `nextValue`, `percent`

### `packages/web/src/components/vninvestcharts/src/widget/components/settings/SnapshotPreviewModal.js`

- Functions:
  - `SnapshotPreviewModal`, `handler`, `safeT`, `updateTarget`
- Top-level variables:
  - `backdropRef`, `val`

### `packages/web/src/components/vninvestcharts/src/widget/components/toolbar/DrawingToolbar.js`

- Functions:
  - `DrawingToolbar`, `ToolIcon`, `handler`
- Top-level variables:
  - `MAGNET_LABELS`, `TOOL_LONG_PRESS_DELAY_MS`, `TOOL_SHORTCUT_BADGE`, `TOOL_TOOLTIP_AUTO_HIDE_MS`, `active`, `activeInGroup`, `customIcon`, `fav`, `getToolTouchHandlers`, `handleMagnetClick`, `handleToolClick`, `handleToolbarToolPressEnd`, `handleToolbarToolPressStart`, `iconId`, `isOpen`, `rect`, `resolvedActiveTool`, `suppressToolTapRef`, `target`, `toolLongPressTimerRef`, `toolTooltipAutoHideTimerRef`, `triggerTooltipHapticFeedback`

### `packages/web/src/components/vninvestcharts/src/widget/components/trading/PaperTradePanel.js`

- Functions:
  - `PaperTradePanel`, `Stat`, `formatPnl`
- Top-level variables:
  - `avgPnl`, `currentPosition`, `losses`, `sign`, `totalPnl`, `totalTrades`, `unrealizedPnl`, `winRate`, `wins`

### `packages/web/src/components/vninvestcharts/src/widget/config/toolGroups.js`

- Top-level variables:
  - `TOOL_GROUPS_V2`

### `packages/web/src/components/vninvestcharts/src/widget/context/__tests__/WidgetI18nContext.test.js`

- Functions:
  - `Probe`, `WidgetI18nProbe`
- Top-level variables:
  - `WidgetI18nProvider`, `act`, `container`, `createRoot`, `originalConsoleError`, `probe`, `reactActEnvironment`, `root`, `setLocaleForTest`, `tFn`, `useWidgetI18n`, `val`

### `packages/web/src/components/vninvestcharts/src/widget/context/HoverEmitter.js`

- Functions:
  - `clearHover`, `createHoverEmitter`, `emitHover`, `handler`, `useHoverState`, `useHoverSubscription`
- Top-level variables:
  - `emitter`, `payload`

### `packages/web/src/components/vninvestcharts/src/widget/context/VNInvestChartsConfigContext.js`

- Functions:
  - `VNInvestChartsConfigProvider`, `useVNInvestChartsConfig`
- Top-level variables:
  - `VNInvestChartsConfigContext`, `defaultValue`

### `packages/web/src/components/vninvestcharts/src/widget/context/VNInvestChartsContext.js`

- Functions:
  - `VNInvestChartsProvider`, `useHoverEmitterRef`
- Top-level variables:
  - `hoverEmitterRef`, `resolvedLocale`, `resolvedTheme`

### `packages/web/src/components/vninvestcharts/src/widget/context/VNInvestChartsStateContext.js`

- Functions:
  - `VNInvestChartsStateProvider`, `useVNInvestChartsState`
- Top-level variables:
  - `VNInvestChartsStateContext`, `activeToolState`, `addPane`, `addSeries`, `ctx`, `defaultValue`, `deletePane`, `drawingInteraction`, `isTestEnv`, `paneState`, `removePane`, `removeSeries`, `renamePane`, `reorderPanes`, `restorePane`, `setActiveTool`, `toggleSeriesVisible`, `toggleVisible`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/context/WidgetI18nContext.js`

- Functions:
  - `WidgetI18nProvider`, `interpolate`, `isWidgetLocale`, `resolveInitialLocale`, `useWidgetI18n`
- Top-level variables:
  - `WidgetI18nContext`, `defaultValue`, `documentLocale`, `primaryDictionary`, `resolvedLocale`, `secondaryDictionary`, `setLocale`, `t`, `template`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/drawingPriceLabelInputs.js`

- Functions:
  - `createSelectedPriceLabelsInput`
- Top-level variables:
  - `anchor`, `anchorPoint`, `highlightFill`, `markers`, `paneId`

### `packages/web/src/components/vninvestcharts/src/widget/drawingPriceLabelInputs.test.js`

- Top-level variables:
  - `drawing`, `hiddenDrawing`

### `packages/web/src/components/vninvestcharts/src/widget/DrawingPriceLabelsOverlay.js`

- Functions:
  - `clamp`, `resolveDrawingSnapshot`, `resolvePreferredScaleSlotId`
- Top-level variables:
  - `anchorPoint`, `effectiveDrawing`, `fillColor`, `highlightFill`, `labelFill`, `markers`, `pixel`, `scaleSlotId`, `side`, `snapshot`, `strokeColor`, `targetedSnapshot`, `textColor`, `top`, `visibleScaleSlotIds`

### `packages/web/src/components/vninvestcharts/src/widget/DrawingPriceLabelsOverlay.test.js`

- Top-level variables:
  - `coordinateBridge`, `drawing`, `markup`, `paneSnapshots`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/abcdPattern.js`

- Functions:
  - `calculateAbcdPatternMetrics`
- Top-level variables:
  - `AbcdPattern`, `ab`, `bc`, `cd`, `points`, `priceAB`, `priceBC`, `priceCD`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/cycles.js`

- Functions:
  - `calculateCycleGeometry`
- Top-level variables:
  - `CyclicLines`, `SineLine`, `TimeCycles`, `amplitude`, `count`, `p1`, `p2`, `pts`, `rawAmp`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/elliottWaves.js`

- Functions:
  - `calculateElliottWaveGeometry`, `makeElliottTool`
- Top-level variables:
  - `ELLIOTT_LABELS`, `ELLIOTT_POINT_COUNT`, `ElliottCorrection`, `ElliottDoubleCombo`, `ElliottImpulse`, `ElliottTriangle`, `ElliottTripleCombo`, `labels`, `pixels`, `pointCount`, `waveType`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/fibArc.js`

- Functions:
  - `calculateFibArcGeometry`
- Top-level variables:
  - `DEFAULT_FIB_ARC_LEVELS`, `FibArc`, `baseRadius`, `center`, `levels`, `reference`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/fibExtended.js`

- Functions:
  - `calculateFibExtendedGeometry`, `createTool`
- Top-level variables:
  - `FIB_EXTENDED_LEVELS`, `FIB_FAN_RATIOS`, `FibChannel`, `FibCircles`, `FibSpeedResistanceArcs`, `FibSpeedResistanceFan`, `FibSpiral`, `FibWedge`, `Pitchfan`, `THREE_POINT`, `TWO_POINT`, `TrendBasedFibTime`, `p1`, `p2`, `p3`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/fibTimeZone.js`

- Functions:
  - `calculateFibTimeZoneGeometry`
- Top-level variables:
  - `DEFAULT_FIB_TIME_ZONE_LEVELS`, `FibTimeZone`, `end`, `levels`, `start`, `stepX`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/gannAdvanced.js`

- Functions:
  - `calculateGannAdvancedGeometry`
- Top-level variables:
  - `GANN_FRACTIONS`, `GannBox`, `GannSquare`, `GannSquareFixed`, `p1`, `p2`, `side`, `size`, `sizeInPx`, `x2`, `y2`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/gannFan.js`

- Functions:
  - `calculateGannFanGeometry`, `clampToBoundary`
- Top-level variables:
  - `GANN_RATIOS`, `GannFan`, `dx`, `dy`, `lines`, `t`, `tMax`, `tx`, `ty`, `unitBarX`, `unitPriceY`, `vx`, `vy`, `x2`, `y2`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/harmonicPatterns.js`

- Functions:
  - `calculateHarmonicPatternGeometry`, `makeHarmonicTool`
- Top-level variables:
  - `CypherPattern`, `HeadAndShoulders`, `PATTERN_HAS_CLOSING_LINE`, `PATTERN_POINT_COUNT`, `PATTERN_POINT_LABELS`, `ThreeDrivesPattern`, `TrianglePattern`, `XabcdPattern`, `hasClosingLine`, `labels`, `patternType`, `pixels`, `pointCount`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/parallelChannel.js`

- Functions:
  - `calculateParallelChannelGeometry`
- Top-level variables:
  - `ParallelChannel`, `dx`, `dy`, `end`, `length`, `normal`, `offsetAnchor`, `offsetDistance`, `start`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/pitchfork.js`

- Functions:
  - `calculatePitchforkGeometry`
- Top-level variables:
  - `Pitchfork`, `leftSwing`, `midpoint`, `pivot`, `rightSwing`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/regressionChannel.js`

- Functions:
  - `calculateRegressionChannelMetrics`, `projectIndexX`, `toTimeValue`
- Top-level variables:
  - `RegressionChannel`, `barTime`, `bars`, `closes`, `denominator`, `end`, `endPrice`, `endTime`, `endX`, `intercept`, `leftBar`, `meanY`, `n`, `rSquared`, `residuals`, `rightBar`, `slope`, `ssRes`, `ssTot`, `start`, `startPrice`, `startTime`, `startX`, `stdDev`, `sumX`, `sumXX`, `sumXY`, `sumY`, `xs`

### `packages/web/src/components/vninvestcharts/src/widget/fork-geometry/regressionChannel.test.js`

- Functions:
  - `createDrawing`
- Top-level variables:
  - `metrics`

### `packages/web/src/components/vninvestcharts/src/widget/forkAnchorReconciliation.js`

- Functions:
  - `reconcileForkDrawingIndexAnchors`, `reconcilePoint`, `resolveAnchorTimestamp`
- Top-level variables:
  - `INDEX_EPSILON`, `UNIX_TIMESTAMP_MIN`, `VALUE_EPSILON`, `changed`, `drawingChanged`, `nextDrawings`, `nextPoint`, `nextPoints`, `reconciled`, `resolvedIndex`, `timestamp`

### `packages/web/src/components/vninvestcharts/src/widget/forkAnchorReconciliation.test.js`

- Top-level variables:
  - `drawing`, `plotData`, `reconciled`, `timeIndexMap`

### `packages/web/src/components/vninvestcharts/src/widget/ForkDrawingsOverlay.js`

- Functions:
  - `createActionHandlePrimitiveInput`, `createForkDrawingActionHandlePrimitiveInputs`, `createForkDrawingPrimitiveInputs`, `createForkDrawingScales`, `getLogicCenter`, `mapAbsoluteXToDataIndex`, `mapAbsoluteYToValue`, `mapDataIndexToAbsoluteX`, `mapValueToAbsoluteY`, `resolveDrawingSnapshot`, `resolvePreferredScaleSlotId`, `resolveRenderableForkDrawings`, `sortDrawingsForHitTest`
- Top-level variables:
  - `absoluteX`, `absoluteY`, `boundingBox`, `dataIndex`, `date`, `fillByHandle`, `fractionalDataIndex`, `from`, `hasFiniteDomain`, `iconByHandle`, `index`, `leftZIndex`, `primitive`, `primitiveInput`, `projected`, `projector`, `ratio`, `rightZIndex`, `scaleSlotDomain`, `scaleSlotId`, `scales`, `selectedDrawingId`, `selectedIdSet`, `snapshot`, `span`, `targetIndex`, `targetedSnapshot`, `timeIndexMap`, `timestamp`, `to`, `value`, `visibleDrawings`, `visibleScaleSlotIds`, `x`, `xIndexFloat`, `y`, `yPrice`

### `packages/web/src/components/vninvestcharts/src/widget/ForkDrawingsOverlay.test.js`

- Functions:
  - `createPaneSnapshot`
- Top-level variables:
  - `basePrimitive`, `farPriceLine`, `first`, `inputs`, `leftAnchoredDrawing`, `linePrimitive`, `plotData`, `second`

### `packages/web/src/components/vninvestcharts/src/widget/forkDrawingSupport.js`

- Functions:
  - `buildToolCoverageMatrix`, `getToolCapabilityDescriptor`, `isForkMultiStepTool`, `isForkSinglePointTool`, `isForkSupportedDrawingAuthoringTool`, `isForkSupportedDrawingManipulationType`
- Top-level variables:
  - `TOOL_CAPABILITY_REGISTRY`, `byPhase`, `byStatus`, `desc`, `rows`

### `packages/web/src/components/vninvestcharts/src/widget/forkInteractionHelpers.js`

- Functions:
  - `hasForkDraftProgress`, `isForkMultiStepTool`, `isForkSinglePointTool`, `isPrimaryPointerPressed`, `resolveForkMultiStepDraftOnClick`
- Top-level variables:
  - `FORK_DRAWING_TOOL_CURSOR_MAP`, `lastIndex`, `nextInteriorIdx`, `startPoint`

### `packages/web/src/components/vninvestcharts/src/widget/history/__tests__/historyFinality.test.js`

- Functions:
  - `bar`
- Top-level variables:
  - `NOW`, `ONE_HOUR`, `correctionLookbackMs`, `existing`, `incoming`, `kept`, `oldTs`, `opts`, `provisionalWindowMs`, `recentTs`, `resident`, `result`, `ts`, `updated`

### `packages/web/src/components/vninvestcharts/src/widget/history/__tests__/sourceClassGolden.test.js`

- Functions:
  - `bar`, `makeSemantics`
- Top-level variables:
  - `D1`, `LOADED_FULL`, `LOADED_LEFT_ONLY`, `LOADED_MIDDLE`, `LOADED_RIGHT_ONLY`, `MON_TRADING_ICT_MS`, `NOW`, `RESIDENT`, `SAT_ICT_MS`, `SUN_ICT_MS`, `all`, `allReasons`, `continuousSemantics`, `fetchable`, `filtered`, `incoming`, `leftSeg`, `loadedEndFriday`, `oldTs`, `opts`, `recentTs`, `resident`, `residentSpanning`, `residentSpanningWeekend`, `rightSeg`, `segments`, `semantics`, `ts`

### `packages/web/src/components/vninvestcharts/src/widget/history/backfillBenchmarkHarness.js`

- Functions:
  - `barsForWindow`, `computePercentile`, `createBenchmarkMetricsState`, `createBenchmarkWindow`, `createDefaultSemantics`, `createInitialControllerState`, `createLoadedWindow`, `createSyntheticBars`, `runBackfillBenchmarkSuite`
- Top-level variables:
  - `BACKFILL_BENCHMARK_PROFILE_BARS`, `bars`, `close`, `controllerState`, `drift`, `elapsedMs`, `endMs`, `fetchSize`, `fetchableSegments`, `finalControllerState`, `high`, `index`, `inflightKeys`, `insetMs`, `iterationsPerProfile`, `label`, `loadedBars`, `loadedWindow`, `low`, `maxBars`, `mergeBars`, `metrics`, `missingBarCount`, `missingSegments`, `open`, `pageBars`, `pageStartMs`, `pages`, `prioritizedSegments`, `profileBars`, `profiles`, `residentTarget`, `retentionFactor`, `sampleBarCount`, `sampleBars`, `sampledAt`, `segmentFrom`, `segmentTo`, `snapshot`, `sorted`, `sourceSemantics`, `spanMs`, `startedAt`, `store`, `timeframeMs`, `timings`, `trimPatch`, `visible`

### `packages/web/src/components/vninvestcharts/src/widget/history/cache/__tests__/LocalCacheMatrix.contract.test.js`

- Functions:
  - `createMockBar`, `createSemanticScope`
- Top-level variables:
  - `badWrite`, `bars`, `cache`, `cacheHit`, `cacheKey`, `changedScope`, `coverage`, `coverageAfterInvalidation`, `coverageAfterPurge`, `factory`, `fullHit`, `indexAfterBadWrite`, `initialIndex`, `inputBars`, `key`, `oldCacheKey`, `originalScope`, `partialHit`, `readResult`, `staleRead`, `writeResult`

### `packages/web/src/components/vninvestcharts/src/widget/history/cache/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/history/cache/IndexedDBCacheMatrix.js`

- Classes:
  - `IndexedDBCacheMatrix`, `LocalCacheMatrixFactoryImpl`
- Functions:
  - `computeMissingTimeRanges`, `createManifestChecksum`, `createSegmentChecksum`, `fnv1a32`, `manifestToSemanticScope`, `normalizeOptionalNumber`, `normalizeOptionalString`, `normalizeRanges`, `semanticScopesEqual`
- Top-level variables:
  - `allMissingRanges`, `barsMap`, `coverage`, `coverageStore`, `current`, `currentCoverage`, `currentRevision`, `currentSegments`, `currentTs`, `cursor`, `data`, `date`, `db`, `deduplicated`, `end`, `existingManifest`, `fromTs`, `hash`, `idb`, `index`, `intersections`, `isBrowser`, `keyParts`, `manifest`, `manifestScope`, `manifestStore`, `manifestWithoutChecksum`, `memIndex`, `memoryDB`, `merged`, `missing`, `missingForTarget`, `neededSegments`, `next`, `nextCoverage`, `nextManifest`, `nextRevision`, `normalized`, `overlapEnd`, `overlapStart`, `payload`, `pending`, `req`, `request`, `resolvedDb`, `result`, `revision`, `segmentData`, `segmentKey`, `segmentMeta`, `segmentStore`, `semanticScope`, `sorted`, `sortedBars`, `start`, `store`, `t`, `toTs`, `tx`, `updatedRanges`, `updatedSegments`, `validated`, `value`

### `packages/web/src/components/vninvestcharts/src/widget/history/cache/LocalCacheMatrix.js`

- Functions:
  - `toCacheKey`, `toCacheSemanticScope`

### `packages/web/src/components/vninvestcharts/src/widget/history/chunkStore.js`

- Functions:
  - `createHistoryChunkStore`, `currentSnapshot`, `makePatch`, `sortAndDedup`
- Top-level variables:
  - `additionalTrimFromHead`, `bar`, `barMs`, `bars`, `existingIdx`, `headCount`, `headMs`, `newBars`, `next`, `nextBars`, `out`, `revision`, `sorted`, `tailCount`, `tailIdx`, `tailMs`, `totalTrimmedFromHead`

### `packages/web/src/components/vninvestcharts/src/widget/history/chunkStore.test.js`

- Functions:
  - `makeBar`, `makeBars`, `tsOf`
- Top-level variables:
  - `anchorTimestamps`, `bars`, `barsBefore`, `existingInAfter`, `headBar`, `initialBars`, `liveBar`, `mixed`, `newBars`, `olderBars`, `overlappingBars`, `patch`, `r0`, `r1`, `r2`, `r3`, `r4`, `result`, `seen`, `snap`, `snap1`, `snapshotAfter`, `snapshotBefore`, `store`, `timestamps`, `ts`, `unsorted`, `updatedBar`, `updatedTail`, `window`

### `packages/web/src/components/vninvestcharts/src/widget/history/externalBarsNormalization.js`

- Functions:
  - `buildExternalDataValidationError`, `normalizeExternalBar`, `normalizeExternalBars`
- Top-level variables:
  - `bar`, `barTime`, `bars`, `close`, `closeVal`, `date`, `dedupedBars`, `detail`, `firstError`, `high`, `highVal`, `invalidCount`, `lastBar`, `low`, `lowVal`, `normalizedBars`, `open`, `openVal`, `rawDate`, `record`, `sortedBars`, `suffix`, `volume`, `volumeVal`

### `packages/web/src/components/vninvestcharts/src/widget/history/externalBarsNormalization.worker.js`

- Top-level variables:
  - `response`

### `packages/web/src/components/vninvestcharts/src/widget/history/externalBarsNormalizationAsync.js`

- Functions:
  - `cleanup`, `createAbortError`, `createExternalBarsNormalizationWorker`, `handleAbort`, `normalizeExternalBarsAsync`, `resolveWorkerError`, `runWorkerNormalization`, `settle`, `shouldUseExternalBarsWorker`
- Top-level variables:
  - `EMPTY_EXTERNAL_BARS_NORMALIZATION_RESULT`, `EXTERNAL_BARS_WORKER_THRESHOLD`, `error`, `nextNormalizationWorkerRequestId`, `requestId`, `settled`, `useWorker`, `worker`

### `packages/web/src/components/vninvestcharts/src/widget/history/externalBarsNormalizationAsync.test.js`

- Classes:
  - `MockNormalizationWorker`
- Functions:
  - `createRawBar`
- Top-level variables:
  - `controller`, `data`, `promise`, `requestId`, `result`, `worker`

### `packages/web/src/components/vninvestcharts/src/widget/history/historyDataUtils.js`

- Functions:
  - `computeLoadedHistoryWindow`, `filterBarsForFinalityMerge`, `isMutableBar`, `lookbackDays`, `mergeBarPagesByDate`, `mergeBarPagesByDateWithFinality`, `mergeBarsByDate`, `mergeBarsByDateWithFinality`, `resolveFetchWindow`, `resolveRetentionWindow`, `resolveTimeframeMs`, `trimBarsToRetentionWindow`
- Top-level variables:
  - `barMs`, `cutoffMs`, `existingIndex`, `incomingEndMs`, `incomingStartMs`, `lastBar`, `lookbackMs`, `nowMs`, `oneDay`, `residentEndMs`, `residentStartMs`, `residentTs`, `retentionWindow`, `spanMs`, `timestamp`, `to`, `trimmedBars`, `visibleEndMs`, `visibleStartMs`, `windowMs`

### `packages/web/src/components/vninvestcharts/src/widget/history/historyWindowPlanner.calendar.test.js`

- Functions:
  - `utcMs`
- Top-level variables:
  - `CRYPTO_SEMANTICS`, `MON_JAN15_UTC_MS`, `VN_EXCHANGE_SEMANTICS`, `cal`, `from`, `loaded`, `resident`, `segments`, `to`, `ts`

### `packages/web/src/components/vninvestcharts/src/widget/history/historyWindowPlanner.js`

- Functions:
  - `clampRetentionFactor`, `classifyGapReason`, `computeMissingSegments`, `computeResidentTarget`, `computeTrimWindow`, `prioritizeMissingSegments`, `reasonFor`, `resolveDensityRetentionFactor`, `resolveResidentRetentionFactor`
- Top-level variables:
  - `RETENTION_FACTOR_MAX`, `RETENTION_FACTOR_MIN`, `baseFactor`, `factor`, `hysteresisPadMs`, `paddingMs`, `rawSpan`, `segments`, `span`

### `packages/web/src/components/vninvestcharts/src/widget/history/historyWindowPlanner.test.js`

- Functions:
  - `makeSemantics`, `res`, `win`
- Top-level variables:
  - `DAY_MS`, `afterFactor`, `beforeFactor`, `continuousFactor`, `end`, `factor`, `fetchableCases`, `left`, `loaded`, `loadedEndFriday`, `loadedMiddle`, `maxPad`, `minSpanMs`, `point`, `priorityQueue`, `resMid`, `resident`, `residentSpan`, `residentWeekend`, `right`, `saturdayIctStartMs`, `segments`, `sessionFactor`, `span`, `start`, `sundayIctStartMs`, `target`, `trim`, `visMid`, `visibleSpan`

### `packages/web/src/components/vninvestcharts/src/widget/history/inflightController.js`

- Functions:
  - `computeAdaptiveInflightControllerState`
- Top-level variables:
  - `CHUNK_BARS_MAX`, `CHUNK_BARS_MIN`, `DEBOUNCE_MAX_MS`, `DEBOUNCE_MIN_MS`, `MAX_INFLIGHT_MAX`, `MAX_INFLIGHT_MIN`, `OVERFETCH_INFLIGHT_CAP`, `RETENTION_FACTOR_MIN`, `chunkBars`, `debounceMs`, `highFrameTimeCount`, `highOverfetchCount`, `lowFrameTimeCount`, `maxInflight`, `retentionFactor`

### `packages/web/src/components/vninvestcharts/src/widget/history/inflightController.test.js`

- Functions:
  - `makeState`
- Top-level variables:
  - `degraded`, `first`, `next`, `second`, `state`

### `packages/web/src/components/vninvestcharts/src/widget/history/requestCoalescing.js`

- Functions:
  - `coalesceAndAdjustSegment`, `isSegmentCoalescedByInflight`, `normalizeSegmentRange`, `parseInflightRequestKey`, `toInflightRequestKey`
- Top-level variables:
  - `adjustedFrom`, `adjustedTo`, `from`, `inflight`, `segmentRange`, `to`

### `packages/web/src/components/vninvestcharts/src/widget/history/requestCoalescing.test.js`

- Top-level variables:
  - `inflightKeys`, `key`, `segment`

### `packages/web/src/components/vninvestcharts/src/widget/history/sessionGuards.js`

- Functions:
  - `buildHistorySessionRequestKey`, `buildSourceRevisionKey`, `normalizeField`

### `packages/web/src/components/vninvestcharts/src/widget/history/sessionGuards.test.js`

- Functions:
  - `makeSemantics`
- Top-level variables:
  - `current`, `first`, `next`, `second`, `semantics`, `sourceRevisionKey`

### `packages/web/src/components/vninvestcharts/src/widget/history/singleWriterLane.js`

- Functions:
  - `createSingleWriterLane`, `drainQueue`
- Top-level variables:
  - `next`, `output`, `queue`, `running`

### `packages/web/src/components/vninvestcharts/src/widget/history/singleWriterLane.test.js`

- Functions:
  - `runWriter`
- Top-level variables:
  - `activeWriters`, `events`, `failing`, `first`, `following`, `lane`, `maxConcurrent`, `second`

### `packages/web/src/components/vninvestcharts/src/widget/history/useExternalBarsNormalization.js`

- Functions:
  - `isExternalBarsNormalizationTestEnv`, `resolveInitialExternalBarsNormalization`, `useExternalBarsNormalization`
- Top-level variables:
  - `controller`, `disposed`, `initialState`

### `packages/web/src/components/vninvestcharts/src/widget/hooks/useWidgetData.js`

- Functions:
  - `commitPendingRange`, `resetHistorySessionControllerRefs`, `schedule`, `startInitialLoad`, `trackFPS`, `useWidgetData`
- Top-level variables:
  - `EMPTY_BACKFILL_LOCK_THRESHOLD`, `abortControllersRef`, `activeCacheKey`, `activeCacheSemanticScope`, `activeEngine`, `activeHistoryRequestKey`, `activeHistoryRequestKeyRef`, `activeHistorySessionRevisionRef`, `activeRange`, `activeRequestsRef`, `activeSourceRevisionKey`, `activeSourceSemantics`, `activeSymbol`, `activeTimeframe`, `adapterLabel`, `afterMetrics`, `backfill`, `backfillBusy`, `beforeMetrics`, `cacheMatrixRef`, `cacheRead`, `cameraState`, `canaryFilteredBars`, `candidate`, `canonicalStore`, `chunkBarsRef`, `consecutiveEmptyBackfillRef`, `controller`, `currentBars`, `currentHistorySessionRequestKey`, `currentHistorySessionRevision`, `currentRange`, `dataLength`, `debounceMsRef`, `delta`, `diff`, `disposed`, `emitHistorySyncBusy`, `engine`, `enginePatch`, `enrichedData`, `firstBarMs`, `firstLoadedBar`, `frameTimesRef`, `handleForkVisibleRangeChange`, `hasExternalData`, `historyBackfillBeforeRef`, `historyChunkStoreRef`, `historyForwardAfterRef`, `historyMergeLaneRef`, `historySession`, `historySessionMode`, `historySessionRef`, `historySyncBusyRef`, `historyWindowSyncInFlightRef`, `inflightControllerStateRef`, `initialVisibleDomain`, `intervalId`, `isControlledHistorySession`, `isHistorySessionRequestCurrent`, `isKeyChanged`, `isRollingBack`, `isTest`, `isTestEnv`, `key`, `lastAppliedForkControlledExtentsKeyRef`, `lastFrameTimeRef`, `lastLoadedBar`, `lastQueuedOverflowHistoryKeyRef`, `lastQueuedVisibleDomainRef`, `lastStableForkSpanRef`, `leftBoundaryReached`, `liveEdgeMsRef`, `liveMinimumResidentSpanMs`, `liveResidentTarget`, `liveTimeframeMs`, `liveVisibleBarCount`, `liveVisibleSpanMs`, `lockedMs`, `mapped`, `matchedValue`, `maxInflightRef`, `metrics`, `minDiff`, `nearestIdx`, `newRange`, `nextBars`, `nextControllerState`, `nextData`, `nextDomain`, `nextEnvelopeMode`, `nextIndex`, `nextRange`, `nextSession`, `normalized`, `normalizedEngineRange`, `normalizedRange`, `normalizedRangeFrom`, `now`, `onVisibleDomainChangeRef`, `onVisibleRangeChangeRef`, `overfetchRatio`, `overfetchRatioRef`, `overflowQueueState`, `p95`, `patch`, `pendingForkVisibleRangeRafRef`, `pendingForkVisibleRangeRef`, `pendingHistoryPatchRef`, `pendingRange`, `pendingVisibleDomainRef`, `plotData`, `plotDataLengthRef`, `plotDataRef`, `prependedCount`, `prevBars`, `prevBarsRef`, `prevCanaryLevelRef`, `prevCanaryMetricsRef`, `prevEnrichedDataRef`, `prevFirstTime`, `prevVisibleSpanMsRef`, `prevVisibleStartMsRef`, `previousLevel`, `previousVisibleDomain`, `previousVisibleRange`, `queueDepthRef`, `queuedVisibleHistorySync`, `rafId`, `rawSnapshot`, `replaced`, `requestKey`, `residentMaxBars`, `resolvedBackfillWorkerFlags`, `resolvedCanaryLevel`, `retentionFactorRef`, `rightBoundaryReached`, `rollbackEvent`, `runHistoryMergeLane`, `samples`, `sessionRevision`, `severity`, `snapshot`, `sorted`, `stabilizedMax`, `stabilizedMin`, `stabilizedRange`, `syncHistoryBusyState`, `targetRange`, `timeframeMsEst`, `ts`, `unsubscribe`, `validation`, `viewportLeftMs`, `visibleBarCount`, `visibleDomain`, `visibleDomainChanged`, `visibleDomainRef`, `visiblePanes`, `visibleRangeChanged`, `whaleEvents`

### `packages/web/src/components/vninvestcharts/src/widget/hooks/useWidgetDataBackfill.js`

- Functions:
  - `runSync`, `useWidgetDataBackfill`
- Top-level variables:
  - `HISTORY_MIN_RESIDENT_BARS`, `adjustedVisibleEndMs`, `adjustedVisibleStartMs`, `afterTimestamp`, `appendPatch`, `backwardBoundaryStopTs`, `backwardCoverage`, `barsToMerge`, `beforeTimestamp`, `boundaryExhaustedByCoverage`, `cacheRead`, `calendar`, `controller`, `controllerKey`, `currentForkRange`, `currentVisibleSpanMs`, `fetchableMissingSegments`, `finalityMergeOpts`, `hasNewerBars`, `hasOlderBars`, `isMovingLeft`, `isPast`, `isSameAsLastQueued`, `isZoomIn`, `latestDomain`, `liveEdgeCap`, `loadedWindow`, `maxRange`, `minRange`, `minimumResidentSpanMs`, `newerBars`, `newerBarsToMerge`, `nextVisibleDomain`, `olderBars`, `prependPatch`, `priorityQueue`, `promises`, `queueVisibleHistoryWindowSync`, `queuedVisibleDomain`, `rangeBoundaryStopTs`, `rangeCoverage`, `rawEndMs`, `rawMissingSegments`, `reconcileVisibleHistoryWindow`, `requestKey`, `requestPromise`, `requestVisibleHistoryWindowSync`, `residentMaxBars`, `resolvedResidentTarget`, `segment`, `sessionRevision`, `shouldLock`, `sourceSemantics`, `targetRange`, `targetWindow`, `timeframeMs`, `totalBarsFetchedRef`, `trimPatch`, `visibleBarCount`, `visibleSpanMs`, `visibleStartMs`, `workingBars`

### `packages/web/src/components/vninvestcharts/src/widget/hooks/useWidgetDrawings.js`

- Functions:
  - `handleKeyDown`, `useWidgetDrawings`
- Top-level variables:
  - `activeElement`, `callback`, `callbackChanged`, `clipboardRaw`, `currentSelectedId`, `drawingStateType`, `drawingWorkspace`, `forkDrawingStateRef`, `hasMultipleDrawingsSelected`, `isCtrlOrCmd`, `isSelectedDrawingControlled`, `lastDrawingWorkspaceSubscriberRef`, `lastEmittedDrawingWorkspaceRef`, `lastEmittedDrawingWorkspaceStateRef`, `lastNotifiedSelectedDrawingIdRef`, `nextDrawings`, `nextSelectedDrawingId`, `nextSelectedId`, `nextWorkspace`, `nextWorkspaceState`, `offset`, `reconciled`, `resolvedDrawings`, `resolvedForkSingleSelection`, `resolvedSelectedDrawing`, `sel`, `selectedDrawing`, `selectedIds`, `snapshot`, `timeIndexMap`, `workspaceChanged`, `workspaceStateChanged`

### `packages/web/src/components/vninvestcharts/src/widget/hooks/useWidgetForkInteraction.js`

- Functions:
  - `currentPaneSnapshots`, `useWidgetForkInteraction`, `visibleRange`
- Top-level variables:
  - `absoluteRect`, `activeTool`, `bottom`, `bridge`, `cancelForkInteraction`, `claimForkPointerOwner`, `clearForkPointerOwner`, `command`, `completedDrawing`, `context`, `currentCharts`, `currentDrawingState`, `currentPaneSnapshots`, `currentSelectedIds`, `dataIndex`, `deltaIndex`, `deltaX`, `deltaY`, `didChange`, `draft`, `draftDrawing`, `dx`, `dy`, `engine`, `forkDrawingStateRef`, `forkManipulationPreviewRef`, `forkManipulationSessionRef`, `forkPointerOwnerRef`, `forkRenderableDrawingMap`, `forkRenderableDrawings`, `forkRubberBandJustCommittedRef`, `forkRubberBandSelection`, `forkRubberBandSelectionRef`, `handleForkClick`, `handleForkContextMenu`, `handleForkDrawingClick`, `handleForkDrawingPointerDown`, `handleForkDrawingPointerMove`, `handleForkHostContextMenu`, `handleForkManipulationPointerDown`, `handleForkManipulationPointerMove`, `handleForkManipulationPointerUp`, `handleForkPointerDown`, `handleForkPointerLeave`, `handleForkPointerMove`, `handleForkPointerUp`, `hitDrawing`, `hitDrawingId`, `hitDrawingState`, `ignoreNextForkDrawingClickRef`, `interactionContext`, `isMultiSelectModifier`, `isReplayShortcut`, `isSelectionModifierPressed`, `lastPointerContextRef`, `localX`, `localY`, `manipulationIntent`, `manipulationSession`, `matchingIds`, `moveTargetIds`, `nextDraft`, `nextDrawing`, `nextSelectedIds`, `normalizedIds`, `normalizedX`, `normalizedY`, `openForkContextMenuAtPosition`, `overSlot`, `paneRect`, `previewDrawings`, `previousForkAuthoringToolRef`, `previousTool`, `range`, `rect`, `releaseForkPointerOwner`, `releaseOnVisibilityChange`, `releasePointerOwner`, `releaseWhenNoButtonsPressed`, `renderScales`, `resolveForkDrawingCommand`, `resolveForkDrawingContext`, `resolveForkEventPayloadAtPosition`, `resolveForkSurfaceCursor`, `resolvedPoint`, `right`, `rubberBand`, `scaleSlotDomain`, `scaleSlotId`, `session`, `sn`, `snapshot`, `suppressNextForkSurfaceClickRef`, `targetDrawing`, `toolCursor`, `yDomain`

### `packages/web/src/components/vninvestcharts/src/widget/hooks/useWidgetInteractionActions.js`

- Functions:
  - `handleModifierChange`, `resetModifierState`, `resetSelectionModifier`, `syncSelectionModifier`, `useWidgetInteractionActions`
- Top-level variables:
  - `bringSelectedToFront`, `clipboardDrawing`, `cloneSelectedDrawing`, `closeForkDrawingContextMenu`, `copySelectedDrawing`, `forkAltShortcutPressedRef`, `maxZIndex`, `minZIndex`, `nextClone`, `nextDrawing`, `normalizedIds`, `onSelectedDrawingChangeRef`, `pasteCopiedDrawing`, `sendSelectedToBack`, `toggleSelectedLock`, `updateForkReadonlySelection`, `updateForkReadonlySelectionByIds`

### `packages/web/src/components/vninvestcharts/src/widget/i18n/messages.en.js`

- Top-level variables:
  - `widgetMessagesEn`

### `packages/web/src/components/vninvestcharts/src/widget/i18n/messages.vi.js`

- Top-level variables:
  - `widgetMessagesVi`

### `packages/web/src/components/vninvestcharts/src/widget/i18n/types.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/iife-entry.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/index.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/injectStyles.js`

- Functions:
  - `injectVNInvestChartsCSS`
- Top-level variables:
  - `VNSC_CSS`, `style`

### `packages/web/src/components/vninvestcharts/src/widget/MeasurementOverlay.js`

- Classes:
  - `MeasurementOverlayImpl`
- Functions:
  - `BridgeMeasurementOverlay`, `EngineMeasurementOverlay`, `MeasurementOverlayWithI18n`, `drawMeasurementLabel`, `drawPoint`, `drawRoundedRect`, `formatSignedPrice`, `resolveBridgeMeasurementPoint`, `resolvePaneSnapshotAtPixel`, `resolvePreferredScaleSlotId`, `toSummarySelection`
- Top-level variables:
  - `accentColor`, `bottom`, `boxHeight`, `boxWidth`, `boxX`, `boxY`, `canvas`, `canvasRef`, `chartConfig`, `ctx`, `drawOn`, `endPixel`, `handleCommit`, `handlePointerDown`, `handlePointerLeave`, `handlePointerMove`, `hoverPixel`, `hoverPoint`, `labels`, `lineHeight`, `lines`, `nextPoint`, `paddingX`, `paddingY`, `pixelRatio`, `point`, `rect`, `resolveLocalPosition`, `right`, `scaleSlotId`, `selection`, `snapshot`, `startPixel`, `summary`, `visibleScaleSlotIds`

### `packages/web/src/components/vninvestcharts/src/widget/paneInteractionUtils.js`

- Functions:
  - `findPaneSnapshotAtPosition`, `resolveHoveredPaneId`
- Top-level variables:
  - `PANE_HEADER_HEIGHT`, `bottom`, `headerBottom`, `headerTop`, `hoveredSnapshot`, `localX`, `localY`, `rect`, `right`

### `packages/web/src/components/vninvestcharts/src/widget/runtimePolicy.js`

- Functions:
  - `evaluateRuntimePolicy`, `resolveRequestedRuntime`, `shouldForceLegacyRuntime`
- Top-level variables:
  - `desc`, `output`, `reasonCode`, `requestedRuntime`

### `packages/web/src/components/vninvestcharts/src/widget/runtimePolicy.test.js`

- No parseable top-level symbols found

### `packages/web/src/components/vninvestcharts/src/widget/utils/chartRange.js`

- Functions:
  - `isChartRangeSatisfied`, `normalizeDate`, `resolveChartRangeExtents`, `resolveChartRangeFetchStart`, `resolveChartRangeStart`, `subtractDays`, `subtractMonths`, `subtractYears`
- Top-level variables:
  - `CHART_RANGES`, `CHART_RANGE_LABEL_KEYS`, `DEFAULT_CHART_RANGE`, `FETCH_PREFETCH_MULTIPLIER`, `dayOfMonth`, `fetchSpanMs`, `first`, `last`, `lastDayOfMonth`, `multiplier`, `next`, `rangeStart`, `single`, `targetStart`, `viewportSpanMs`, `viewportStart`

### `packages/web/src/components/vninvestcharts/src/widget/utils/coordinateBridge.js`

- Functions:
  - `createForkChartRenderContextValue`, `createForkStockChartContextValue`, `createWidgetCoordinateBridge`, `fractionalIndex`, `resolvePaneProjector`, `resolveWidgetChartPoint`, `resolveWidgetPointPixel`, `value`
- Top-level variables:
  - `anchor`, `cacheKey`, `cached`, `candleWidth`, `chartConfig`, `chartPoint`, `dataIndex`, `datum`, `domain`, `endDatum`, `fractionalDataIndex`, `from`, `hasFiniteDomain`, `index`, `normalizedVisibleRange`, `paneSnapshotMap`, `primaryPaneSnapshot`, `primaryScaleSlotId`, `projected`, `projector`, `projectorCache`, `ratio`, `resolvedIndex`, `resolvedScaleSlotId`, `scaleSlotDomain`, `scaleSlotId`, `snapshot`, `span`, `startDatum`, `targetIndex`, `timeIndexMap`, `timestamp`, `to`, `ts`, `useCenteredIndexProjection`, `visibleBarCount`, `x`, `y`, `yScale`

### `packages/web/src/components/vninvestcharts/src/widget/utils/widgetEquality.js`

- Functions:
  - `areAxisBoundsEqual`, `areBoundsEqual`, `areBoundsMapEqual`, `areDomainTupleEqual`, `areHeaderAnchorEqual`, `areLabelAnchorEqual`, `arePaneSnapshotsEqual`, `areRuntimeCapabilitiesEqual`, `areScaleSlotStatesEqual`
- Top-level variables:
  - `leftBounds`, `leftKeys`, `leftSnapshot`, `leftState`, `rightBounds`, `rightKeys`, `rightSnapshot`, `rightState`

### `packages/web/src/components/vninvestcharts/src/widget/utils/widgetHelpers.js`

- Functions:
  - `buildForkTooltipTokens`, `buildLegacyPaneSnapshots`, `findPlotDataIndex`, `findPlotDataIndexByTime`, `formatForkXAxisLabel`, `formatTooltipValue`, `inferAxisSideFromScaleSlotId`, `isPrimaryPriceSeries`, `isWidgetTestEnvironment`, `mergePaneSnapshotDomains`, `normalizePaneDescriptorsForExplicitScaleSlots`, `resolveDate`, `resolveDateDomainFromDiscontinuous`, `resolveDiscontinuousXExtents`, `resolveEngineSeriesValueForRuntime`, `resolveForkChartConfigScaleSlotId`, `resolvePreferredScaleSlotId`, `resolveTooltipSeriesColor`, `resolveVisiblePanes`
- Top-level variables:
  - `CHART_MARGIN`, `FALLBACK_ADAPTER`, `FORK_DEGRADE_PIXEL_CHECK_DELAY_MS`, `FORK_DEGRADE_PIXEL_RECHECK_DELAY_MS`, `FORK_DEGRADE_REQUIRED_BLANK_CHECKS`, `HISTORY_BACKFILL_PAGE_LIMIT`, `HISTORY_MIN_RESIDENT_BARS`, `HISTORY_RECONCILE_MAX_PAGES`, `NORMALIZED_DEFAULT_PANES`, `activeSeries`, `buy`, `candidatePanes`, `currentState`, `dailyAxisFormat`, `dataIndex`, `dateFormat`, `defaultEnd`, `defaultStart`, `endIndex`, `epoch`, `firstIndexValue`, `globalScope`, `hasLeftAxis`, `hasRightAxis`, `height`, `intradayAxisFormat`, `lastDataIndex`, `lastIndex`, `leftBounds`, `mixedAxisFormat`, `nextPanes`, `normalizedSeries`, `paramColor`, `plotWidth`, `preferSnapshotPriceDomains`, `priceFormat`, `rightBounds`, `scaleSlotBounds`, `scaleSlotIds`, `scaleSlotStates`, `sell`, `series`, `shouldPreferComputedDomain`, `snapshotTop`, `startIndex`, `tokens`, `tooltipEntry`, `top`, `value`, `visibleRightScaleSlotId`, `visibleScaleSlotId`, `visibleScaleSlotIds`, `volumeFormat`

### `packages/web/src/components/vninvestcharts/src/widget/visibleRangeBridge.js`

- Functions:
  - `asTimeValue`, `clampIndex`, `clampToRange`, `findNearestDateIndex`, `normalizeEngineVisibleRange`, `normalizeForkVisibleRange`, `normalizeVisibleRangeForEngine`, `resolveForkVisibleRangeFromDateExtents`
- Top-level variables:
  - `endBar`, `endIndex`, `endTime`, `from`, `fromIndex`, `high`, `lastIndex`, `left`, `low`, `lowerTime`, `mid`, `midTime`, `rawEndExclusive`, `rawEndIndex`, `rawStartIndex`, `right`, `startBar`, `startIndex`, `startTime`, `to`, `toExclusive`, `toIndex`, `upperTime`

### `packages/web/src/components/vninvestcharts/src/widget/visibleRangeBridge.test.js`

- Top-level variables:
  - `data`, `normalized`, `range`

### `packages/web/src/components/vninvestcharts/src/widget/visibleRangeDiagnostics.js`

- Functions:
  - `areEngineVisibleRangesEqual`, `areVisibleDomainsEqual`, `isForkRangeTraceEnabled`, `traceForkRange`

### `packages/web/src/components/vninvestcharts/src/widget/visibleRangePolicies.js`

- Functions:
  - `resolveOverflowHistoryQueueState`
- Top-level variables:
  - `maxRange`, `minRange`, `normalizedDataLength`, `overflowKey`

### `packages/web/src/components/vninvestcharts/src/widget/visibleRangePolicies.test.js`

- Top-level variables:
  - `queueState`

### `packages/web/src/components/vninvestcharts/src/widget/VNInvestCharts.js`

- Functions:
  - `activePaneSnapshots`, `activeVisibleRange`, `formatSeriesDisplayName`, `formatSeriesSuffix`, `handleAction`, `handleFullscreenChange`, `handleKeyDown`, `handlePointerMove`, `handlePointerUp`, `numberParam`, `runPixelCheck`, `vr`
- Top-level variables:
  - `VNInvestCharts`, `VNInvestChartsContent`, `a`, `abbreviation`, `action`, `activeAlertAudioEnabled`, `activeCvdMode`, `activeEnableCVD`, `activeEnableWhale`, `activeForkDrawingTool`, `activeForkManipulationDrawing`, `activeHeights`, `activeLocale`, `activeMaxVisibleBars`, `activeMaxVisiblePanes`, `activeOnSettingsClose`, `activePanes`, `activeSettingsOpen`, `activeShowDrawingPriceMarkers`, `activeShowNonTradingDays`, `activeSnapshots`, `activeTimezone`, `activeTool`, `activeWhaleThreshold`, `activeXExtents`, `adapterLabel`, `axisStroke`, `axisTickFill`, `baseLabel`, `bg`, `buffer`, `candidate`, `canvas`, `chartInnerHeight`, `chartSurfaceReady`, `cloned`, `computedXExtents`, `contentRuntimeKey`, `context`, `currentForkSnapshots`, `currentVisibleDomain`, `cvdData`, `d`, `datum`, `defaultLegacyVisibleRange`, `defaultRange`, `deltaX`, `drawingChromeContent`, `drawingChromeNode`, `drawingDockLabels`, `drawingDockNode`, `effectiveForkVisibleRange`, `effectiveRuntime`, `effectiveRuntimeReason`, `emitCoordinateBridge`, `emitHoveredPaneId`, `emitPaneSnapshots`, `engine`, `engineDataSource`, `engineInstanceRef`, `engineOptions`, `enginePanes`, `engineSeriesData`, `engineTheme`, `exists`, `firstBar`, `firstSnapshot`, `forkChartRenderContextValue`, `forkDegradeNotifiedRef`, `forkDrawingContextMenuDrawing`, `forkDrawingContextMenuItems`, `forkDrawingPrimitiveInputs`, `forkHoveredDatum`, `forkMovableSelectionIds`, `forkOverlayInputs`, `forkPaneSnapshotsRef`, `forkStockChartContextValue`, `forkSubscriptionIdRef`, `forkVisibleRangeRef`, `forkXAxisHoverLabel`, `forkXAxisTicks`, `fromIndex`, `getPaneLabel`, `handleBoundaryError`, `handleCancelTextEdit`, `handleCommitTextEdit`, `handleEngineReady`, `handleForkOverlayStateChange`, `handleFullscreenToggle`, `handleLegacyVisibleDomainChange`, `handleLegacyVisibleRangeChange`, `handlePaneAddSeries`, `handlePaneRemove`, `handlePaneRemoveSeries`, `handlePaneToggleSeries`, `handlePaneToggleVisible`, `handleRangeChange`, `handleRuntimeDegraded`, `handleSidebarPointerDown`, `handleSnapshot`, `handleStartTextEdit`, `handleTimeframeChange`, `handleWidgetPointerLeave`, `handleWidgetPointerMove`, `hasExternalData`, `hasRenderedPixels`, `hasRightSidebar`, `hoveredDataIndex`, `hoveredIndex`, `hoveredPaneIdRef`, `incrementSnapshotRevision`, `indicatorLegendLabels`, `initialRangeSpan`, `initialVisibleRange`, `isDark`, `isSelectedDrawingControlled`, `labels`, `lastBar`, `lastEmittedPaneSnapshotsRef`, `lastNotifiedRuntimeResolutionRef`, `lastPaneSnapshotsSubscriberRef`, `lastRuntimeCapabilitiesRef`, `lastRuntimeCapabilitiesSubscriberRef`, `lastStableForkSpanRef`, `legacyChartScale`, `legacyCoordinateBridge`, `legacyPaneSnapshots`, `localizePane`, `localizedPane`, `maxZ`, `mergedSnapshots`, `minZ`, `newWidth`, `nextBlankChecks`, `nextDrawings`, `nextLabel`, `objectsContent`, `onVisibleDomainChangeRef`, `onVisibleRangeChangeRef`, `paneHeaderLabels`, `paneLeft`, `paneRight`, `paneSnapshotMap`, `paneSplitterNodes`, `paneToolbarNodes`, `paneToolbarRight`, `pendingForkVisibleRangeRafRef`, `pendingForkVisibleRangeRef`, `pendingRange`, `position`, `preferSnapshotPriceDomains`, `previous`, `previousTheme`, `propertiesContent`, `range`, `ready`, `reconciled`, `resolvedDomain`, `resolvedForkPriceMarkerSelection`, `resolvedForkPrimitiveSelection`, `resolvedId`, `resolvedLegacyVisibleRange`, `resolvedLegacyVisibleRangeRef`, `resolvedRequestedReason`, `resolvedRequestedRuntime`, `resolvedTheme`, `resolvedXExtents`, `root`, `runtimeCapabilities`, `runtimePolicy`, `safeXAccessor`, `sampleSlotId`, `scaleProvider`, `scaleSlotDomains`, `scaled`, `scaledData`, `scaledXAccessor`, `selectedDrawingFromWorkspace`, `selectedId`, `selectedIdSet`, `series`, `seriesAbbreviations`, `seriesId`, `seriesLabelKeys`, `seriesValuesById`, `settingsModalNode`, `sharedPlotDataRef`, `shouldLockForkPan`, `shouldUseInitialVisibleRange`, `sn`, `snapshot`, `snapshotPreviewModalNode`, `snapshotsChanged`, `startWidth`, `startX`, `subscriberChanged`, `suffix`, `target`, `targetTz`, `themeState`, `timeIndexMap`, `timers`, `toIndexExclusive`, `toolbarModel`, `useForkRuntime`, `val`, `value`, `values`, `visibleBarCount`, `visiblePanes`, `withSuffix`

### `packages/web/src/components/vninvestcharts/src/widget/WidgetEmptyState.js`

- Top-level variables:
  - `WidgetEmptyState`, `copy`

### `packages/web/src/components/vninvestcharts/src/widget/WidgetErrorBoundary.js`

- Classes:
  - `WidgetErrorBoundary`

### `packages/web/src/components/VNStockChartPanel.js`

- Classes:
  - `CoreApiChartAdapter`
- Functions:
  - `ViewportSharkMarkersOverlay`, `pad`, `useI18n`
- Top-level variables:
  - `allBars`, `anchorWindowMs`, `backwardAnchor`, `barDate`, `barTime`, `bars`, `beforeTs`, `buildBarFromQuote`, `candlesForHook`, `chartAdapter`, `chartBody`, `coreAdapter`, `coverage`, `covered`, `customPanes`, `dateStr`, `days`, `draw`, `drawY`, `e`, `emoji`, `endIndex`, `enrichedBars`, `fromTs`, `handleBarsChange`, `handleClick`, `handleVisibleRangeChange`, `hrs`, `idx`, `intervalId`, `intervalLower`, `intervalMs`, `isBuy`, `isDaily`, `item`, `map`, `mapped`, `mappedCvdSeries`, `mappedWhaleOrders`, `mins`, `newestTs`, `nextBar`, `now`, `offset`, `oldestTs`, `parsedDate`, `payload`, `pendingQuoteRef`, `points`, `price`, `quote`, `rawTf`, `realtimeFeed`, `requestedWindowMs`, `safeInterval`, `signalsOrders`, `startIndex`, `tf`, `toTs`, `visibleBars`, `whaleTimes`, `x`, `y`

### `packages/web/src/config/buildTarget.js`

- Functions:
  - `getBuildTarget`, `isBuildTarget`, `normalizeBuildTarget`
- Top-level variables:
  - `BUILD_TARGETS`, `BUILD_TARGET_SET`, `DEFAULT_BUILD_TARGET`, `candidate`

### `packages/web/src/context/AbilityContext.js`

- Functions:
  - `createAbilityFromRules`, `useAbility`
- Top-level variables:
  - `AbilityContext`

### `packages/web/src/context/authReact.js`

- Functions:
  - `ShellAuthProvider`, `createShellAuthContextValue`, `useShellAuth`, `useShellAuthRuntime`
- Top-level variables:
  - `ShellAuthContext`, `ShellAuthRuntimeContext`, `activeRuntime`, `context`, `runtimeRef`, `snapshot`

### `packages/web/src/context/authRuntime.js`

- Functions:
  - `cloneAuthRuntimeState`, `commit`, `createEmptyAuthRuntimeState`, `createEmptyUserIdentity`, `createShellAuthRuntime`, `deriveAuthRuntimeState`, `emit`
- Top-level variables:
  - `adapter`, `bootstrapPayload`, `buildMeta`, `legacyAuthState`, `listeners`, `snapshot`, `state`, `userIdentity`

### `packages/web/src/context/bootstrapClient.js`

- Functions:
  - `createBootstrapClient`, `deriveLegacyAuthState`, `loadShellBootstrap`, `requestJson`, `resolveFetchImpl`, `resolveShellAdapter`
- Top-level variables:
  - `ADAPTER_REGISTRY`, `adapter`, `capabilities`, `client`, `isStaff`, `isSuperuser`, `principalIdentity`, `request`, `response`, `session`

### `packages/web/src/context/LangContext.js`

- Functions:
  - `LangProvider`, `getInitialLocale`, `useI18n`
- Top-level variables:
  - `LANG_STORAGE_KEY`, `LangContext`, `context`, `localeTag`, `nextLocale`, `setLanguage`, `t`, `value`

### `packages/web/src/context/PortfolioContext.js`

- Functions:
  - `PortfolioProvider`, `bootstrap`, `usePortfolio`
- Top-level variables:
  - `PortfolioContext`, `activeRefreshToken`, `cancelled`, `contextValue`, `createPortfolio`, `createSubAccount`, `ctx`, `deletePortfolio`, `deleteSubAccount`, `fetchPortfolios`, `hasInitialTokens`, `initialAccessToken`, `initialRefreshToken`, `login`, `logout`, `mappedConfig`, `next`, `nextPortfolios`, `nextRefresh`, `ok`, `payload`, `profilePayload`, `refreshAccessToken`, `register`, `res`, `resendVerification`, `response`, `rules`, `saveTokens`, `syncAuthState`, `tokenPayload`, `updatePortfolio`, `updateSubAccount`, `updateUserConfig`, `updatedConfig`

### `packages/web/src/context/RealtimeContext.js`

- Functions:
  - `RealtimeProvider`, `alerts`, `createConsumerId`, `darkFlowAlerts`, `register`, `toSymbolsKey`, `toUniqueSymbols`, `unregister`, `update`, `useRealtimeFeedFromManager`
- Top-level variables:
  - `React`, `RealtimeContext`, `aggregatedSymbols`, `baseFeed`, `consumerCount`, `consumerIdRef`, `contextValue`, `dedupSavedSymbols`, `feed`, `maxAlerts`, `next`, `normalizedSymbols`, `pollInterval`, `quotesBySymbol`, `requestedSymbolCount`, `symbolsKey`, `union`, `value`, `values`

### `packages/web/src/features/community/components/index.js`

- Top-level variables:
  - `communityFeatureComponents`

### `packages/web/src/features/community/hooks/index.js`

- Top-level variables:
  - `communityFeatureHooks`

### `packages/web/src/features/community/index.js`

- No parseable top-level symbols found

### `packages/web/src/features/community/pages/index.js`

- Top-level variables:
  - `communityFeaturePages`

### `packages/web/src/features/dashboard/__tests__/AIAdvisorAlertPanel.i18n.test.js`

- No parseable top-level symbols found

### `packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js`

- Functions:
  - `setter`
- Top-level variables:
  - `cleanup`, `effectObj`, `holdings`, `hookResult`, `listA`, `listB`, `mockEffects`, `mockRefCurrent`, `mockStateSetters`, `mockStateVal`, `refKey`, `stateKey`, `stateKeys`, `stateUpdate`, `token`, `trackedSymbols`, `watchlistGroups`, `watchlists`

### `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js`

- Functions:
  - `AIAdvisorAlertPanel`, `createAiAdvisorTranslator`, `fetchFeed`, `formatValue`, `getPulseGlowClass`, `resolveAiAdvisorLocale`, `resolveSeverityLabel`, `resolveTrendLabel`
- Top-level variables:
  - `I18N`, `browserLang`, `dict`, `e`, `glowClass`, `language`, `num`, `res`, `rsi`, `rsiNum`

### `packages/web/src/features/dashboard/useCoreDashboardData.js`

- Functions:
  - `addSymbol`, `collectDashboardSymbols`, `extractTechnicalsResponse`, `load`, `normalizeSymbol`, `safeResults`, `useCoreDashboardData`, `wrapWithErrorCode`
- Top-level variables:
  - `EMPTY_ARRAY`, `EXCLUDED_MARKET_GROUPS`, `abortRef`, `cancelled`, `controller`, `holdings`, `name`, `normalized`, `rawWatchlistGroups`, `rawWatchlists`, `refresh`, `symbol`, `symbolSet`, `symbols`, `techRes`, `technicals`, `technicalsStatus`, `trackedSymbols`, `watchlistGroups`, `watchlists`

### `packages/web/src/features/saas/components/index.js`

- Top-level variables:
  - `saasFeatureComponents`

### `packages/web/src/features/saas/hooks/index.js`

- Top-level variables:
  - `saasFeatureHooks`

### `packages/web/src/features/saas/index.js`

- No parseable top-level symbols found

### `packages/web/src/features/saas/pages/index.js`

- Top-level variables:
  - `saasFeaturePages`

### `packages/web/src/features/stock-detail/__tests__/orderFlowFallback.test.js`

- Top-level variables:
  - `result`

### `packages/web/src/features/stock-detail/__tests__/viewportWhaleMarkers.test.js`

- Top-level variables:
  - `doubleCandles`, `markers`, `panMarkers`, `regularCandles`, `resultClamp`, `resultEmpty`, `resultNull`, `sampleCandles`, `zoomMarkers`

### `packages/web/src/features/stock-detail/components/StockContextDeck.js`

- Functions:
  - `StockContextDeck`, `fmtCompact`, `fmtPrice`
- Top-level variables:
  - `e`, `hasActiveSession`, `institutionalBuy`, `isBuy`, `n`, `retailBuy`, `side`, `totalBuyStrength`

### `packages/web/src/features/stock-detail/components/StockDetailHeader.js`

- Functions:
  - `StockDetailHeader`, `fmtPrice`, `getPriceColorClass`
- Top-level variables:
  - `average`, `ceil`, `change`, `changePct`, `companyName`, `e`, `exchange`, `floor`, `high`, `industry`, `isUp`, `low`, `n`, `open`, `p`, `price`, `priceColorClass`, `ref`, `volume`

### `packages/web/src/features/stock-detail/components/StockDetailTabs.js`

- Functions:
  - `StockDetailTabs`, `fmtCompact`, `fmtPrice`, `getPeriods`, `getRatioValue`, `renderActivePanel`, `renderCoDong`, `renderGiaoDich`, `renderHoSo`, `renderSuKien`, `renderTaiChinh`, `renderThongKe`, `renderTinTuc`, `renderVonCoTuc`, `signalColorClass`, `signalLabel`
- Top-level variables:
  - `balList`, `balPeriods`, `divYield`, `divYieldVal`, `e`, `events`, `firstPeriodKey`, `incList`, `incPeriods`, `keys`, `map`, `n`, `officers`, `overview`, `ratioList`, `row`, `s`, `sessionLabel`, `shareholders`, `tabsList`, `val`

### `packages/web/src/features/stock-detail/components/StockInsightDeck.js`

- Functions:
  - `StockInsightDeck`, `signalColorClass`, `signalLabel`
- Top-level variables:
  - `e`, `map`, `s`, `sessionLabel`

### `packages/web/src/features/stock-detail/components/StockSessionWitness.js`

- Functions:
  - `StockSessionWitness`
- Top-level variables:
  - `e`, `hasActiveSession`, `sessionDateStr`

### `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js`

- Functions:
  - `getLookbackDays`, `loadBlocking`, `loadDeferred`, `normalizeChartBarsPayload`, `useStockDetailPageModel`
- Top-level variables:
  - `DEFAULT_ENV`, `DEFAULT_ORDER_FLOW_WINDOW`, `adapter`, `candidates`, `handleRealtimeSnapshot`, `mountedRef`, `pendingSnapshotRef`, `quote`, `realtimeFeed`, `realtimeTimeoutRef`, `sessionDate`, `setChartBars`, `tf`

### `packages/web/src/features/stock-detail/hooks/useViewportWhaleMarkers.js`

- Functions:
  - `useViewportWhaleMarkers`
- Top-level variables:
  - `candle`, `safeEnd`, `safeStart`, `sorted`, `targetCount`, `visibleCandles`, `volA`, `volB`, `whaleTimes`

### `packages/web/src/features/stock-detail/orderFlowFallback.js`

- Functions:
  - `buildEffectiveOrderFlowData`, `hasObjectContent`, `hasSeriesData`, `normalizeWhaleCvdSeries`, `resolveFallbackTradeDate`
- Top-level variables:
  - `baseOrderFlowData`, `bucketTs`, `fallbackCvdSeries`, `numericValue`, `sessionContext`, `value`

### `packages/web/src/features/vip/components/index.js`

- Top-level variables:
  - `vipFeatureComponents`

### `packages/web/src/features/vip/hooks/index.js`

- Top-level variables:
  - `vipFeatureHooks`

### `packages/web/src/features/vip/index.js`

- No parseable top-level symbols found

### `packages/web/src/features/vip/pages/index.js`

- Top-level variables:
  - `vipFeaturePages`

### `packages/web/src/hooks/useAlertCenterData.js`

- Functions:
  - `load`, `useAlertCenterData`
- Top-level variables:
  - `adapter`, `mountedRef`, `query`

### `packages/web/src/hooks/useRealtimeFeedCore.js`

- Functions:
  - `cleanup`, `computeNextBackoffMs`, `computeReconnectDelayMs`, `connect`, `decodeJwtPayload`, `getHttpStatus`, `getQuoteBySymbol`, `getRealtimeTicker`, `getRealtimeTickers`, `getRealtimeWebSocketUrl`, `hydrateQuotes`, `isRequestCanceled`, `isTokenExpiringSoon`, `isValidQuotePrice`, `mergeQuote`, `normalizeAlert`, `normalizeChangePct`, `normalizeDarkFlowAlert`, `normalizeEventTimestamp`, `normalizePollSymbolCandidates`, `normalizeSymbol`, `nowIso`, `pickPollBatch`, `poll`, `readEventField`, `refreshAccessToken`, `resolveImpliedChangePct`, `resolveRealtimePollIntervalMs`, `scheduleReconnect`, `sendAction`, `shouldSuppressPollingError`, `start`, `toFiniteNumber`
- Top-level variables:
  - `MAX_WS_SUB_SYMBOLS`, `POLL_BATCH_SIZE`, `React`, `STALE_RESYNC_RETRY_MS`, `WS_HEALTHY_MIN_POLL_INTERVAL_MS`, `WS_HEALTHY_POLL_BATCH_SIZE`, `WS_HEALTHY_RECOVERY_BATCH_SIZE`, `WS_HEALTHY_RECOVERY_MIN_CANDIDATES`, `WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS`, `ageSeconds`, `applyAlert`, `applyDarkFlowAlert`, `applyMarketDiscoveryEvent`, `applyTickerUpdate`, `applyTickerUpdateThrottled`, `asFraction`, `asPercent`, `base`, `base64`, `batch`, `bootstrapBatchSize`, `cache`, `cancelled`, `candidateResult`, `circuitOpenUntilRef`, `consecutiveFailuresRef`, `currentAccessToken`, `customBase`, `decoded`, `dedupKey`, `dedupWindowMs`, `delayMs`, `destroyed`, `devPort`, `disableWs`, `distanceFraction`, `distancePercent`, `effectiveIntervalMs`, `eventAgeSeconds`, `eventId`, `eventTimestamp`, `existing`, `expSeconds`, `fallbackRatioPct`, `filtered`, `flushTickerUpdates`, `fresh`, `freshToken`, `freshnessSeconds`, `hasOverThreshold`, `hasOverThresholdCandidates`, `hasRecoveryCandidates`, `idx`, `impliedPct`, `inferredFreshness`, `initTimer`, `intervalId`, `isDevFrontendPort`, `isMissing`, `isOffhoursSessionClose`, `isStale`, `jitter`, `lastPollAtRef`, `lastProcessedEventIdsRef`, `latency`, `message`, `next`, `nextAgeSeconds`, `nextAlert`, `nextBackoffMs`, `nextChangePct`, `nextChangePctUnit`, `nextChangeValue`, `nextCurrentPrice`, `nextEvent`, `nextKey`, `nextPrevPrice`, `nextWs`, `normalized`, `normalizedAttempt`, `normalizedChange`, `normalizedCurrent`, `normalizedPayload`, `normalizedPrev`, `normalizedPreviousPct`, `normalizedQuotes`, `normalizedRaw`, `normalizedSymbol`, `normalizedSymbols`, `normalizedToken`, `normalizedTs`, `now`, `numeric`, `ok`, `openUntilTs`, `padded`, `parts`, `payload`, `pendingTickerUpdatesRef`, `pollBackoffMsRef`, `pollBackoffUntilRef`, `pollCandidates`, `pollCursorRef`, `pollIntervalRef`, `pollingTotal`, `protocol`, `quote`, `quotes`, `quotesBySymbolRef`, `realtimeStatusRef`, `reconnectAttemptRef`, `reconnectTimer`, `refreshedToken`, `remaining`, `res`, `shouldSkipDuplicateEvent`, `shouldTryAuthRefresh`, `side`, `size`, `sorted`, `staleCount`, `staleOrMissing`, `staleOverThreshold`, `staleRatioPct`, `start`, `startTimer`, `status`, `symbol`, `symbols`, `symbolsForWs`, `symbolsKey`, `symbolsRef`, `syms`, `targetIntervalMs`, `tickerRafIdRef`, `tickersMap`, `token`, `ts`, `uiRefreshP95Ms`, `update`, `updates`, `ws`, `wsHealthy`, `wsHealthyRef`, `wsUrl`

### `packages/web/src/i18n/en.js`

- Top-level variables:
  - `en`

### `packages/web/src/i18n/index.js`

- Functions:
  - `createTranslator`, `formatCurrency`, `formatDate`, `formatDateTime`, `formatNumber`, `formatPriceVND`, `formatQuoteInteger`, `formatQuotePrice`, `formatQuoteVolume`, `formatTime`, `getLocaleTag`, `getNestedValue`, `normalizeLocale`
- Top-level variables:
  - `DEFAULT_LOCALE`, `QUOTE_LOCALE_TAG`, `date`, `defaultValue`, `dictionaries`, `dictionary`, `fallbackDictionary`, `hasDefaultValue`, `inThousands`, `localeTags`, `normalized`, `normalizedLocale`, `template`, `vars`, `vnd`

### `packages/web/src/i18n/vi.js`

- Top-level variables:
  - `vi`

### `packages/web/src/index.js`

- Top-level variables:
  - `shellAdapters`

### `packages/web/src/main.js`

- Functions:
  - `App`, `Layout`, `ProtectedRoute`, `handleLogout`, `resolvePageComponent`
- Top-level variables:
  - `component`, `container`, `hasStoredTokens`, `isActive`, `layoutStyles`, `location`, `navigate`, `registryId`, `root`, `sidebarItems`

### `packages/web/src/pages/admin/ShellMailConfigPage.js`

- Functions:
  - `ShellMailConfigPage`, `fetchConfigs`, `handleActivate`, `handleCloseModal`, `handleDelete`, `handleFormChange`, `handleOpenCreate`, `handleOpenEdit`, `handleSubmitForm`, `handleTestConnection`, `renderConfigCard`
- Top-level variables:
  - `EMPTY_FORM`, `PROVIDER_LABELS`, `activeConfig`, `configListContent`, `hostPort`, `metrics`, `modalOverlay`, `parsed`, `payload`, `res`, `rt`, `saJson`, `testPanelContent`

### `packages/web/src/pages/admin/ShellOperationsCenterPage.js`

- Functions:
  - `ShellOperationsCenterPage`
- Top-level variables:
  - `groupFlags`, `metrics`, `operatorAbilities`, `operatorFlags`, `operatorRoutes`, `routeFlags`, `summaryCards`

### `packages/web/src/pages/AICommandCenterPage.js`

- Functions:
  - `AICommandCenterPage`, `handleModelChange`, `handleProviderChange`, `handleSaveSettings`, `loadSettings`, `testConnection`
- Top-level variables:
  - `PROVIDER_MODELS`, `currentModel`, `data`, `defaultModel`, `e`, `finalModel`, `isKnownModel`, `models`, `modelsForProvider`, `modelsForSelectedProvider`, `nextData`, `payload`, `provider`, `providerOptions`, `val`

### `packages/web/src/pages/AlertCenterPage.js`

- Functions:
  - `AlertCenterPage`, `aggregatedSymbols`, `formatAlertTimestamp`, `formatAlertValue`, `handleAcknowledge`, `handleApply`, `handleLoadDetail`, `handleMuteSymbol`, `normalizeSymbol`, `renderPagination`, `toggleEvidence`
- Top-level variables:
  - `DEFAULT_ENV`, `ITEMS_PER_PAGE_FEED`, `ITEMS_PER_PAGE_STATS`, `LANE_OPTIONS`, `SORT_OPTIONS`, `WINDOW_OPTIONS`, `activePageFeed`, `activePageStats`, `adapter`, `aiSuggestCount`, `alerts`, `e`, `el`, `freq`, `highSeverityCount`, `interval`, `mapped`, `numericValue`, `paginatedAlerts`, `paginatedSymbols`, `rawAlerts`, `sortedAlerts`, `startIndexFeed`, `startIndexStats`, `styleEl`, `styleId`, `timeA`, `timeB`, `timestamp`, `totalPagesFeed`, `totalPagesStats`, `triggerManualRefresh`, `valA`, `valB`

### `packages/web/src/pages/AlertCenterPage.styles.js`

- Top-level variables:
  - `CORE_STYLES`

### `packages/web/src/pages/auth/AuthLoginPage.js`

- Functions:
  - `AuthLoginPage`, `handleSubmit`, `readTokenPayload`, `resolveMessage`
- Top-level variables:
  - `destination`, `detail`, `location`, `mounted`, `payload`, `tokenPayload`

### `packages/web/src/pages/auth/AuthPages.test.js`

- Functions:
  - `flushEffects`, `renderAtRoute`
- Top-level variables:
  - `confirmSpy`, `emailInput`, `form`, `initialEntry`, `inputs`, `loginSpy`, `passwordConfirmInput`, `passwordInput`, `registerSpy`, `renderer`, `requestSpy`, `storage`, `usernameInput`, `verifyButton`, `verifySpy`

### `packages/web/src/pages/auth/AuthRegisterPage.js`

- Functions:
  - `AuthRegisterPage`, `handleSubmit`, `parseApiErrors`
- Top-level variables:
  - `EMPTY_FIELD_ERRORS`, `detail`, `fieldErrors`, `firstValue`, `globalMessage`, `parsedError`, `payload`, `payloadFieldErrors`, `successMessage`, `value`

### `packages/web/src/pages/auth/AuthResetPasswordPage.js`

- Functions:
  - `AuthResetPasswordPage`, `normalizeErrorMessage`, `submitConfirm`, `submitRequest`
- Top-level variables:
  - `detail`, `firstArrayValue`, `isConfirmMode`, `payload`, `token`

### `packages/web/src/pages/auth/AuthVerifyEmailPage.js`

- Functions:
  - `AuthVerifyEmailPage`, `resolveVerifyMessage`
- Top-level variables:
  - `detail`, `mounted`, `statusClasses`, `token`, `tokenErrors`

### `packages/web/src/pages/auth/index.js`

- No parseable top-level symbols found

### `packages/web/src/pages/commercial/BillingCenterPage.js`

- Functions:
  - `BillingCenterPage`, `PaymentCreateForm`, `handlePlanSelect`, `handleSubmit`, `loadBillingData`, `useI18n`
- Top-level variables:
  - `BILLING_CUSTOM_STYLES`, `barColor`, `e`, `hasInvoices`, `hasQuota`, `hasSubscription`, `isActive`, `isCompleted`, `isPending`, `isUnlimited`, `limit`, `map`, `payload`, `percent`, `plans`, `response`, `statusClass`, `statusLabel`, `used`

### `packages/web/src/pages/commercial/PaymentReturnPage.js`

- Functions:
  - `PaymentReturnPage`, `checkPaymentStatus`, `useI18n`
- Top-level variables:
  - `RETURN_CUSTOM_STYLES`, `e`, `isSuccess`, `map`, `params`, `response`, `txnRef`

### `packages/web/src/pages/coreShellPageHelpers.js`

- Functions:
  - `buildSurfaceFlags`, `buildVisibilityFlags`, `countFlagsByState`, `createEmptySnapshot`, `createInitialViewState`, `deriveCoreShellSnapshot`, `filterAbilitiesBySubject`, `filterVisibleRoutes`, `getEnabledSurfaceKeys`, `handleRefresh`, `normalizeComparableText`, `normalizePageErrorMessage`, `refreshSnapshot`, `renderAbilityList`, `renderBuildMetaCard`, `renderElement`, `renderFlagList`, `renderHealthStatusPill`, `renderRefreshAction`, `renderSummaryCard`, `renderValueList`, `runInitialLoad`, `useCoreShellPageSnapshot`
- Top-level variables:
  - `active`, `allowedRouteIds`, `bootstrapLoaderRef`, `buildMeta`, `capabilities`, `envRef`, `fallbackErrorMessageRef`, `fetchImplRef`, `health`, `navigation`, `normalizedKeywords`, `session`, `snapshot`, `subject`, `surfaces`

### `packages/web/src/pages/DashboardPage.js`

- Functions:
  - `DashboardPage`, `ErrorBanner`, `LoadingSkeleton`, `NOOP`, `collectUniqueSortedSymbols`
- Top-level variables:
  - `React`, `allAlerts`, `allDark`, `calculatedBreadth`, `change`, `down`, `e`, `feedAlerts`, `feedDark`, `flat`, `hasRealtimeBreadth`, `key`, `mergedAlerts`, `mergedDarkFlowAlerts`, `mergedQuotes`, `prevReadyTokenRef`, `rawList`, `realtimeFeed`, `resolvedBreadth`, `resolvedRenderAlertLane`, `seen`, `showSkeleton`, `symbolString`, `symbols`, `token`, `unique`, `uniqueSorted`, `up`

### `packages/web/src/pages/market/ShellStockDetailPage.js`

- Functions:
  - `ShellStockDetailPage`, `handleStockSymbolChange`, `handleStockSymbolSubmit`, `normalizeStockSymbol`, `resolveRouteParamSymbol`, `resolveStockPathname`, `resolveStockSearch`, `resolveStockSymbolFromPathname`, `resolveStockSymbolFromSearch`, `resolveStockSymbolState`, `syncStockLocation`
- Top-level variables:
  - `DEFAULT_STOCK_SYMBOL`, `STOCK_ROUTE_IDS`, `enabledSurfaces`, `explicitSymbol`, `match`, `metrics`, `nextSymbol`, `nextUrl`, `pathname`, `resolvedStockSymbol`, `resolvedStockSymbolState`, `search`, `stockAbilities`, `stockRoutes`, `summaryCards`

### `packages/web/src/pages/pageRegistry.js`

- Functions:
  - `DeferredPageComponent`, `createDeferredPageComponent`, `getPageComponent`, `getPageLoader`, `getPageRegistryRouteIds`, `makePageEntry`
- Top-level variables:
  - `mountedRef`, `pageEntry`, `pageRegistry`

### `packages/web/src/pages/PortfoliosPage.js`

- Functions:
  - `PortfoliosPage`, `handleCreate`, `handleDelete`, `usePortfolios`
- Top-level variables:
  - `DEFAULT_ENV`, `adapter`, `e`, `mountedRef`, `name`, `reload`, `res`

### `packages/web/src/pages/signals/ShellAiAdvisoryPage.js`

- Functions:
  - `ShellAiAdvisoryPage`, `buildAdvisoryRows`, `buildBenchmarkItems`, `createInitialAdvisoryState`, `handleAdvisorySymbolChange`, `handleAdvisorySymbolSubmit`, `handleRefreshAll`, `normalizeAdvisoryError`, `normalizeAdvisorySymbol`, `refreshAdvisorySession`, `resolveAdvisorySearch`, `resolveAdvisorySymbol`, `resolveAdvisorySymbolFromSearch`, `runAdvisoryLoad`, `syncAdvisorySymbolSearch`
- Top-level variables:
  - `SIGNAL_ROUTE_IDS`, `active`, `advisoryAbilities`, `advisoryEnvRef`, `advisoryFetchRef`, `advisoryLoaderRef`, `advisoryQuality`, `advisoryRows`, `advisorySession`, `benchmarkItems`, `benchmarks`, `decision`, `enabledSurfaces`, `groupFlags`, `metrics`, `nextSymbol`, `nextUrl`, `quality`, `resolvedAdvisorySymbol`, `routeFlags`, `search`, `signalRoutes`, `summaryCards`

### `packages/web/src/pages/signals/ShellWhaleAlertsPage.js`

- Functions:
  - `ShellWhaleAlertsPage`, `buildWhaleSnapshotContextItems`, `buildWhaleSnapshotMaterializationItems`, `buildWhaleSnapshotRows`, `createInitialWhaleSnapshotState`, `handleJumpToLatestValidTradeDate`, `handleRefreshAll`, `handleWhaleSnapshotSubmit`, `handleWhaleSymbolChange`, `handleWhaleTradeDateChange`, `normalizeWhaleSnapshotError`, `normalizeWhaleSymbol`, `normalizeWhaleTradeDate`, `refreshWhaleSnapshot`, `resolveWhaleSearch`, `resolveWhaleSymbolFromSearch`, `resolveWhaleSymbolState`, `resolveWhaleTradeDate`, `resolveWhaleTradeDateFromSearch`, `runWhaleSnapshotLoad`, `syncWhaleSearch`
- Top-level variables:
  - `DEFAULT_WHALE_SYMBOL`, `SIGNAL_ROUTE_IDS`, `active`, `canJumpToLatestValidTradeDate`, `enabledSurfaces`, `explicitSymbol`, `groupFlags`, `latestValidWhaleTradeDate`, `materialization`, `metrics`, `nextSymbol`, `nextTradeDate`, `nextUrl`, `normalized`, `qualityFlags`, `resolvedWhaleSymbol`, `resolvedWhaleSymbolState`, `resolvedWhaleTradeDate`, `routeFlags`, `search`, `searchParams`, `sessionContext`, `signalRoutes`, `summaryCards`, `whaleAbilities`, `whaleEnvRef`, `whaleFetchRef`, `whaleLoaderRef`, `whaleSnapshot`, `whaleSnapshotContextItems`, `whaleSnapshotMaterializationItems`, `whaleSnapshotRows`

### `packages/web/src/pages/StockDetailPage.js`

- Functions:
  - `StockDetailPage`, `fmtCompact`, `fmtPrice`, `signalColorClass`, `signalLabel`
- Top-level variables:
  - `DEFAULT_ENV`, `e`, `handleAlertTrigger`, `handleSessionChange`, `handleTradeTrigger`, `handleVisibleRangeChange`, `handleWatch`, `map`, `n`, `s`, `showToast`, `timer`

### `packages/web/src/pages/SupportPage.js`

- Functions:
  - `SupportPage`, `handleCreateTicket`, `handleReopen`, `handleReply`, `handleSelectTicket`, `handleStaffFilterChange`, `handleStaffPatch`, `loadStaffOpsDashboard`, `loadTicketDetail`, `loadTickets`
- Top-level variables:
  - `e`, `isStaffUser`, `leftPane`, `matched`, `messages`, `response`, `rightPane`, `rows`, `selectedTicketId`, `ticket`

### `packages/web/src/pages/system/ShellAiCommandCenterPage.js`

- Functions:
  - `ShellAiCommandCenterPage`, `handleModelChange`, `handleProviderChange`, `handleSaveSettings`, `loadSettings`, `testConnection`
- Top-level variables:
  - `PROVIDER_MODELS`, `aiAbilities`, `aiFlags`, `aiRoutes`, `currentModel`, `data`, `defaultModel`, `errorData`, `fetchSettingsRef`, `finalModel`, `groupFlags`, `isKnownModel`, `metrics`, `models`, `modelsForProvider`, `modelsForSelectedProvider`, `nextData`, `payload`, `provider`, `providerOptions`, `res`, `routeFlags`, `summaryCards`, `val`

### `packages/web/src/pages/system/ShellSettingsPage.js`

- Functions:
  - `ShellSettingsPage`
- Top-level variables:
  - `enabledSurfaces`, `metrics`, `summaryCards`

### `packages/web/src/pages/system/ShellSupportPage.js`

- Functions:
  - `ShellSupportPage`
- Top-level variables:
  - `SYSTEM_ROUTE_IDS`, `enabledSurfaces`, `groupFlags`, `metrics`, `routeFlags`, `summaryCards`, `supportAbilities`, `systemRoutes`

### `packages/web/src/pages/tenant-admin/TenantAdminHomePage.js`

- Functions:
  - `TenantAdminHomePage`, `loadTenant`
- Top-level variables:
  - `data`, `metrics`, `response`, `summaryCards`

### `packages/web/src/pages/tenant-admin/TenantAdminMembersPage.js`

- Functions:
  - `TenantAdminMembersPage`, `handleInviteSubmit`, `handleRemoveMember`, `loadData`
- Top-level variables:
  - `data`, `errorData`, `metrics`, `response`, `roleLabels`, `statusLabels`

### `packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.js`

- Functions:
  - `TenantAdminServiceAccountsPage`, `handleCreateSubmit`, `handleDeleteSA`, `handleToggleStatus`, `loadServiceAccounts`
- Top-level variables:
  - `data`, `errorData`, `metrics`, `newStatus`, `response`, `statusLabels`

### `packages/web/src/pages/TransactionsPage.js`

- Functions:
  - `TransactionsPage`, `handleCreate`, `handleFormChange`, `useTransactions`
- Top-level variables:
  - `DEFAULT_ENV`, `adapter`, `e`, `mountedRef`, `reload`, `res`

### `packages/web/src/pages/UserSettingsPage.js`

- Functions:
  - `UserSettingsPage`, `handleChange`, `handleSave`, `useUserProfile`
- Top-level variables:
  - `DEFAULT_ENV`, `adapter`, `e`, `mountedRef`, `reload`, `res`

### `packages/web/src/pages/vip/VipLocalControlPage.js`

- Functions:
  - `VipLocalControlPage`, `createCredentials`, `createEmptySnapshot`, `createInitialViewState`, `createUserDraft`, `formatTimestamp`, `getRoleLabel`, `handleLogin`, `handleLogout`, `handleRefresh`, `handleResetSession`, `handleUserSubmit`, `loadControlSnapshot`, `normalizeErrorMessage`, `refreshSnapshot`, `renderAuditItem`, `renderElement`, `renderUserItem`, `runAction`, `runInitialLoad`
- Top-level variables:
  - `ROLE_OPTIONS`, `abilityCount`, `active`, `auditList`, `bootstrapLoaderRef`, `clientRef`, `controlPlaneClient`, `currentSessionId`, `currentSessionUsername`, `envRef`, `fetchImplRef`, `metrics`, `nextPayload`, `nextValue`, `notice`, `payload`, `result`, `roleEntry`, `roleKeys`, `roleText`, `sessionCards`, `snapshot`, `timestamp`, `userList`, `username`, `visibleRouteCount`

### `packages/web/src/pages/WatchlistPage.js`

- Functions:
  - `TrackedThresholdCell`, `WatchlistPage`, `fetchItems`, `fetchPriceAlertsList`, `fetchTechnicals`, `formatTime`, `getActiveDescription`, `getActiveTitle`, `getGroupCounters`, `getMergedData`, `handleAddSymbol`, `handleAddTrackedSymbol`, `handleCreateAlert`, `handleCreateWatchlist`, `handleDeleteAlert`, `handleDeleteWatchlist`, `handlePromoteToTracked`, `handlePromoteToWatchlist`, `handleRemoveSymbol`, `handleRemoveTrackedSymbol`, `handleRenameWatchlist`, `handleSave`, `handleSyncPrices`, `handleSyncStockProfile`, `handleUpdateTrackedThreshold`, `loadAllLists`, `renderSparkline`, `renderTableBody`, `renderTableHeader`
- Top-level variables:
  - `EXCLUDED_MARKET_GROUPS`, `active`, `activeAfterDelete`, `activeGroup`, `activeItems`, `activeList`, `allSymbols`, `avgCost`, `change`, `changePct`, `color`, `companyName`, `counters`, `currentPrice`, `data`, `dir`, `down`, `e`, `flashClass`, `flashState`, `flashTimeoutRefs`, `groupsList`, `history`, `holdingsList`, `holdingsRes`, `industry`, `isActive`, `isAlreadyTracked`, `isDown`, `isEditing`, `isUp`, `lastPrice`, `list`, `ma20Dist`, `marketValue`, `max`, `merged`, `min`, `newMap`, `newWl`, `numVal`, `oldWl`, `path`, `pnl`, `pnlPct`, `points`, `portfolios`, `portfoliosRes`, `prevPrice`, `prevPricesRef`, `price`, `priceHistoryRef`, `qty`, `range`, `realtimeFeed`, `res`, `rsiValue`, `rvolValue`, `showUpDown`, `staticData`, `streamingData`, `symbol`, `symbolUpper`, `symbolsList`, `symbolsSet`, `targetWl`, `trackedList`, `trackedRes`, `typeLabel`, `up`, `updated`, `val`, `volume`, `wl`, `wlList`, `x`, `y`

### `packages/web/src/pages/WhaleAlertsPage.js`

- Functions:
  - `WhaleAlertsPage`, `handleApply`, `load`, `useWhaleAlerts`
- Top-level variables:
  - `DEFAULT_ENV`, `adapter`, `e`, `mountedRef`, `res`

### `packages/web/src/pages/workspace/ShellDashboardPage.js`

- Functions:
  - `ShellDashboardPage`
- Top-level variables:
  - `WORKSPACE_ROUTE_IDS`, `dashboardAbilities`, `enabledSurfaces`, `groupFlags`, `metrics`, `routeFlags`, `summaryCards`, `workspaceRoutes`

### `packages/web/src/pages/workspace/ShellPortfoliosPage.js`

- Functions:
  - `ShellPortfoliosPage`
- Top-level variables:
  - `PORTFOLIO_ROUTE_IDS`, `WORKSPACE_ROUTE_IDS`, `enabledSurfaces`, `groupFlags`, `metrics`, `portfolioAbilities`, `portfolioRoutes`, `routeFlags`, `summaryCards`, `workspaceRoutes`

### `packages/web/src/pages/workspace/ShellTransactionsPage.js`

- Functions:
  - `ShellTransactionsPage`
- Top-level variables:
  - `WORKSPACE_ROUTE_IDS`, `enabledSurfaces`, `groupFlags`, `metrics`, `routeFlags`, `summaryCards`, `transactionAbilities`, `workspaceRoutes`

### `packages/web/src/pages/workspace/ShellWatchlistPage.js`

- Functions:
  - `ShellWatchlistPage`
- Top-level variables:
  - `WORKSPACE_ROUTE_IDS`, `enabledSurfaces`, `groupFlags`, `hasSaasNative`, `metrics`, `routeFlags`, `summaryCards`, `watchlistAbilities`, `workspaceRoutes`

### `packages/web/src/utils/VNInvestSignalAdapter.js`

- Functions:
  - `mapToCvdSeries`, `mapToOHLCVBars`, `mapToWhaleOrders`
- Top-level variables:
  - `matchedValue`, `parsedDate`

### `packages/web/src/utils/whaleTimeAdapter.js`

- Functions:
  - `buildClockDate`, `cloneAtMinute`, `formatMinuteLabel`, `getEffectiveMarketNow`, `getMarketSessionSegments`, `isWithinMarketSession`, `resolveWhaleTimeframeWindow`, `subtractTradingMinutes`, `toCanonicalMinute`
- Top-level variables:
  - `AFTERNOON_START`, `MORNING_END`, `MORNING_START`, `ROLLING_WINDOW_MINUTES`, `SESSION_END`, `activeSegment`, `afternoonStart`, `anchor`, `canonical`, `cloned`, `cursor`, `d`, `date`, `effectiveNow`, `endDate`, `minutesAvailable`, `morningEnd`, `morningStart`, `normalizedTimeframe`, `now`, `numericTs`, `remainingMinutes`, `safeEnd`, `safeStart`, `secondsInDay`, `segments`, `sessionEnd`, `startDate`, `trimmed`, `vnOffsetSeconds`, `vnTimeMinutes`

### `packages/web/vite.config.js`

- Top-level variables:
  - `__dirname`, `__filename`, `proxyTarget`

## Update Workflow

1. After adding/changing functions/classes/variables, run:
   - `python scripts/ops/generate_module_tree.py`
2. Review `module_tree_full.md` diff.
3. Commit source changes and updated tree together.
