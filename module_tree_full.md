# VNInvest Module Tree (Auto-generated)

> Do not edit manually. Regenerate with `python scripts/ops/generate_module_tree.py`.

Generated at: `2026-04-09 23:34:47`

## Summary

- Total modules: 210
- Python modules: 130
- JS/TS modules: 80
- Total classes: 323
- Total functions: 869
- Total top-level variables: 1300

## Python Modules

### `backend/benchmark_api.py`

- Functions:
  - `bench_concurrent`, `bench_sequential`, `login`, `main`, `print_table`, `timed_get`
- Top-level variables:
  - `BASE_URL`, `CONCURRENCY`, `PASSWORD`, `ROUNDS`, `SEP`, `SYMBOLS`, `USERNAME`

### `backend/config/__init__.py`

- Top-level variables:
  - `__all__`

### `backend/config/asgi.py`

- Top-level variables:
  - `application`, `django_asgi_app`

### `backend/config/celery.py`

- Top-level variables:
  - `app`

### `backend/config/health.py`

- Functions:
  - `build_prefetch_health_snapshot`, `healthcheck`, `market_observability_health`, `prefetch_health`, `realtime_health`, `streams_health`

### `backend/config/settings.py`

- Functions:
  - `_env_float`, `_env_int`
- Top-level variables:
  - `ADVISORY_AUTO_GENERATION_BATCH_SIZE`, `ADVISORY_AUTO_GENERATION_ENABLED`, `ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES`, `ALLOWED_HOSTS`, `ASGI_APPLICATION`, `AUTH_PASSWORD_VALIDATORS`, `BASE_DIR`, `CELERY_ACCEPT_CONTENT`, `CELERY_BEAT_SCHEDULE`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_RESULT_SERIALIZER`, `CELERY_TASK_SERIALIZER`, `CELERY_TIMEZONE`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `DB_ENGINE`, `DEBUG`, `DEFAULT_AUTO_FIELD`, `EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS`, `ENABLE_NEW_MARKET_VIEWS`, `ENABLE_NEW_TRADING_VIEWS`, `ENABLE_REALTIME_CONNECTION_MANAGER`, `FRONTEND_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URI`, `INSTALLED_APPS`, `LANGUAGE_CODE`, `MARKET_OBSERVABILITY_ENABLED`, `MARKET_OBSERVABILITY_LATENCY_WINDOW`, `MARKET_VIEWS_CANARY_PERCENT`, `MIDDLEWARE`, `MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND`, `MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO`, `MISSION_CONTROL_ANOMALY_BASELINE_MINUTES`, `MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES`, `MISSION_CONTROL_ANOMALY_MIN_ADVISORIES`, `MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS`, `MISSION_CONTROL_ANOMALY_MONITOR_ENABLED`, `MISSION_CONTROL_ANOMALY_MONITOR_INTERVAL_SECONDS`, `MISSION_CONTROL_ANOMALY_SPIKE_RATIO`, `MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT`, `MISSION_CONTROL_SCHEDULED_ROLLOUTS_ENABLED`, `MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS`, `ONBOARDING_TRIAL_APPLY_ON_SIGNUP`, `ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE`, `ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED`, `ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES`, `OPENCLAW_API_KEY`, `OPENCLAW_BASE_URL`, `OPENCLAW_MODEL`, `OPEN_CORE_QUOTA_CAPS_BY_TIER`, `OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED`, `ORDER_FLOW_DETECTION_ENABLED`, `ORDER_FLOW_DETECTION_INTERVAL_SECONDS`, `REALTIME_CHANNEL_LAYER`, `REALTIME_DEFAULT_WHALE_THRESHOLD`, `REALTIME_ENABLED`, `REALTIME_REDIS_URL`, `REST_FRAMEWORK`, `REVERSAL_DETECTION_ENABLED`, `REVERSAL_DETECTION_INTERVAL_SECONDS`, `ROOT_URLCONF`, `SECRET_KEY`, `SECURE_PROXY_SSL_HEADER`, `SIMPLE_JWT`, `STARTER_PORTFOLIOS_CANARY_PERCENT`, `STARTER_PORTFOLIOS_ENABLED`, `STATIC_ROOT`, `STATIC_URL`, `STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE`, `STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER`, `STREAM_BLOCK_MS`, `STREAM_CONSUMER_BATCH`, `STREAM_CONSUMER_INTERVAL`, `STREAM_MAX_LEN`, `STREAM_REDIS_URL`, `STREAM_SNAPSHOT_TTL`, `STREAM_STALE_AFTER_SECONDS`, `TEMPLATES`, `TIME_ZONE`, `USE_I18N`, `USE_TZ`, `USE_X_FORWARDED_HOST`, `USE_X_FORWARDED_PORT`, `WATCHLIST_SYNC_DAYS`, `WATCHLIST_SYNC_ENABLED`, `WATCHLIST_SYNC_MINUTES`, `WHALE_ADVISORY_COOLDOWN_SECONDS`, `WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER`, `WSGI_APPLICATION`, `_CACHE_REDIS_URL`, `_OPENCORE_ENABLED`, `_REALTIME_ENABLED_FLAG`, `_TICKER_PREFETCH_INTERVAL`

### `backend/config/urls.py`

- Top-level variables:
  - `urlpatterns`

### `backend/config/wsgi.py`

- Top-level variables:
  - `application`

### `backend/create_test_users.py`

- Top-level variables:
  - `config_pro`, `ent_free`, `ent_pro`, `license_free`, `license_pro`, `lifecycle_pro`, `user_free`, `user_pro`

### `backend/manage.py`

- Functions:
  - `main`

### `backend/portfolio/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/adapters/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/adapters/cache_adapter.py`

- Functions:
  - `get_cache`, `is_rate_limited_error`, `is_vnstock_rate_limited`, `mark_vnstock_rate_limited`, `set_cache`, `vnstock_rate_limit_cache_key`

### `backend/portfolio/adapters/vnstock_adapter.py`

- Functions:
  - `_build_stock_client`, `_import_vnstock`, `_normalize_price_board_dataframe`, `_resolve_float_env`, `_resolve_int_env`, `_resolve_timeout`, `_run_with_timeout`, `fetch_financial_ratio_dataframe`, `fetch_history_dataframe`, `fetch_intraday_dataframe`, `fetch_listing_symbols_dataframe`, `fetch_price_board_dataframe`, `read_stream_intraday_ticks`
- Top-level variables:
  - `_PRICE_BOARD_FIELDS_BY_SECTION`, `_VNSTOCK_GATE`, `_VNSTOCK_MAX_CONCURRENCY`, `_VNSTOCK_RETRY_ATTEMPTS`, `_VNSTOCK_RETRY_BACKOFF_SECONDS`, `logger`

### `backend/portfolio/admin.py`

- Classes:
  - `AccountSnapshotAdmin`
  - `DailyPriceAdmin` -> methods: `workspace_link`
  - `IntradayTickAdmin`
  - `LegalPageAdmin` -> methods: `activate_selected_legal_page`, `has_add_permission`, `has_change_permission`, `has_delete_permission`, `save_model`
  - `MarketGroupSyncLogAdmin` -> methods: `duration_display`, `has_add_permission`, `has_change_permission`
  - `OnboardingPlanPolicyAdmin` -> methods: `activate_selected_policy`, `save_model`
  - `PlanAssignmentLogAdmin` -> methods: `has_add_permission`, `has_change_permission`
  - `PortfolioAdmin` -> methods: `subaccount_count`
  - `PriceAlertRuleAdmin`
  - `ScreenerRuleAdmin`
  - `SecuritiesGroupAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `item_count`, `sync_shared_market_groups`, `sync_shared_market_groups_clear`
  - `SecuritiesItemAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `workspace_link`
  - `SecuritiesItemInline` -> methods: `has_add_permission`, `workspace_link`
  - `StockProfileAdmin` -> methods: `change_view`, `workspace_link`
  - `StockProfileSyncLogAdmin` -> methods: `duration_display`, `has_add_permission`, `has_change_permission`
  - `SubAccountAdmin`
  - `SystemAISettingsAdmin` -> methods: `api_key_status`, `effective_model_display`, `mark_as_active`, `test_connection_for_selected`
  - `SystemAISettingsAdminForm` -> methods: `save`
  - `SystemAISettingsAuditLogAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`
  - `SystemEmailAccountAdmin` -> methods: `get_urls`, `google_callback_view`, `google_client_secret_status`, `google_connect_view`, `google_refresh_token_status`, `google_revoke_view`, `mark_as_default`, `oauth_actions`, `password_status`, `send_test_email_to_selected_accounts`
  - `SystemEmailAccountAdminForm` -> methods: `clean`, `save`
  - `TrackedSymbolAdmin` -> methods: `has_add_permission`
  - `TransactionAdmin` -> methods: `total_value_display`
  - `TransactionInline`
  - `UserConfigAdmin` -> methods: `change_view`, `get_urls`, `resend_verification_email_to_selected_users`, `resend_verification_view`, `save_model`, `verification_status`
  - `WatchlistGroupAdmin` -> methods: `item_count`
  - `WatchlistItemAdmin`
  - `WatchlistItemInline`
  - `WhaleAdvisoryAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`
  - `WhaleConfigApprovalAdmin` -> methods: `has_view_permission`
  - `WhaleConfigAuditLogAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`
  - `WhaleConfigDraftAdmin` -> methods: `get_readonly_fields`, `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `save_model`, `submit_selected_drafts`
  - `WhaleConfigRolloutAdmin` -> methods: `ack_progress`, `anomaly_signal`, `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `propagation_signal`, `save_model`
  - `WhaleConfigVersionAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `latest_anomaly_signal`, `latest_rollout_signal`, `mark_as_active_version`, `mark_as_rolled_back`
  - `WhaleConfigWorkerAckAdmin` -> methods: `ack_state`, `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`
- Functions:
  - `_admin_market_group_sync_view`, `_admin_resend_latest_verification_view`, `_admin_stock_profile_sync_view`, `_admin_stock_profile_workspace_view`, `_build_candlestick_items`, `_build_mock_depth_levels`, `_build_sparkline_points`, `_duration_display`, `_fetch_live_workspace_data`, `_format_number`, `_format_pct`, `_format_vnd`, `_is_analyst`, `_is_supervisor`, `_log_whale_config_audit`, `_push_market_group_sync_messages`, `_push_stock_profile_sync_messages`, `_push_whale_config_preview_messages`, `_render_signal_badge`, `_resend_verification_for_user_config`, `_resolve_google_oauth_redirect_uri`, `_technical_bias_label`, `_vninvest_admin_get_urls`, `_vninvest_each_context`, `_vninvest_get_app_list`, `_workspace_url_for_symbol`
- Top-level variables:
  - `GOOGLE_OAUTH_REDIRECT_URI_SETTING`, `MAIL_GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS`, `_original_admin_get_urls`, `_original_each_context`, `_original_get_app_list`

### `backend/portfolio/ai_advisory_helpers.py`

- Functions:
  - `_sprint17_build_component_templates`, `_sprint17_compute_summary_from_components`, `_sprint17_extract_json_block`, `_sprint17_generate_component_templates_with_ai`, `_sprint17_generate_executive_synthesis_with_ai`, `_sprint17_normalize_ai_component_payload`, `_sprint17_serialize_stock_advisory_session`, `_sprint17_suggested_action_from_status`, `_sprint29_get_enabled_indicators`, `_sprint29_pick_primary_indicator`, `_sprint29_render_chart_context_block`
- Top-level variables:
  - `logger`

### `backend/portfolio/ai_context.py`

- Functions:
  - `_to_float`, `build_symbol_ai_context`, `render_concise_context_for_prompt`, `render_context_for_prompt`

### `backend/portfolio/ai_options.py`

- Functions:
  - `_entry_supports`, `build_provider_model_map`, `get_default_model`, `get_model_entries`, `get_model_entry`, `get_models_for_capability`, `is_model_allowed_for_capability`, `is_valid_model`, `is_valid_provider`
- Top-level variables:
  - `ADVISORY_CAPABILITY`, `AVAILABLE_MODELS`, `DEFAULT_MODELS`, `MODEL_CATALOG`, `PROVIDER_CHOICES`

### `backend/portfolio/ai_runtime_config.py`

- Functions:
  - `_build_not_ready_payload`, `_normalize_provider`, `_resolve_api_key`, `resolve_ai_runtime_config`

### `backend/portfolio/ai_service.py`

- Functions:
  - `_claude_completion`, `_openai_compatible_completion`, `_resolve_provider_api_key`, `generate_advisory_concise`, `generate_whale_text`, `test_ai_connection`
- Top-level variables:
  - `logger`

### `backend/portfolio/analytics.py`

- Functions:
  - `_wavg_cost_for_symbol`, `build_risk_metrics`, `build_summary`, `compute_allocation`, `compute_allocation_by_sector`, `compute_alpha_beta`, `compute_daily_returns`, `compute_holdings`, `compute_max_drawdown`, `compute_nav_series`, `compute_sharpe`, `compute_sortino`, `compute_twr`, `compute_volatility`, `load_prices_df`, `load_transactions_df`
- Top-level variables:
  - `BUY`, `DIVIDEND`, `FLOAT_ROUND`, `SELL`, `TRADING_DAYS_PER_YEAR`, `VNINDEX_SYMBOL`, `logger`

### `backend/portfolio/apps.py`

- Classes:
  - `PortfolioConfig` -> methods: `ready`

### `backend/portfolio/auth_views.py`

- Classes:
  - `EmailDeliveryFailed`
  - `GoogleOAuthSerializer`
  - `GoogleOAuthView` -> methods: `_generate_username`, `post`
  - `RegisterSerializer` -> methods: `create`, `validate`, `validate_email`, `validate_username`
  - `RegisterView` -> methods: `create`
  - `ResendVerificationEmailView` -> methods: `post`
  - `ResendVerificationSerializer`
  - `UserMeView` -> methods: `get`
  - `VerifiedEmailTokenObtainPairSerializer` -> methods: `validate`
  - `VerifiedEmailTokenObtainPairView`
  - `VerifyEmailSerializer`
  - `VerifyEmailView` -> methods: `post`
- Top-level variables:
  - `logger`

### `backend/portfolio/consumers.py`

- Classes:
  - `RealtimeConsumer` -> methods: `_authenticate_user`, `_get_query_token`, `_get_user`, `_get_user_plan`, `_subscribe_symbols`, `_unsubscribe_symbols`, `connect`, `dark_flow_alert`, `disconnect`, `heartbeat`, `receive_json`, `ticker_update`, `whale_advisory`, `whale_alert`
- Top-level variables:
  - `logger`

### `backend/portfolio/domain_constants.py`

- Functions:
  - `classify_whale_size_class`, `resolve_user_whale_threshold_vnd`
- Top-level variables:
  - `ORDER_FLOW_BUCKET_LT_200M_MAX_VND`, `ORDER_FLOW_BUCKET_LT_2B_MAX_VND`, `ORDER_FLOW_BUCKET_LT_500M_MAX_VND`, `ORDER_FLOW_BUCKET_LT_50M_MAX_VND`, `ORDER_FLOW_LARGE_ORDER_THRESHOLD_VND`, `ORDER_FLOW_PRICE_LOCK_THRESHOLD_PCT`, `ORDER_FLOW_SMALL_ORDER_THRESHOLD_VND`, `VND_PER_MILLION`, `WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT`, `WHALE_ALERT_DEFAULT_THRESHOLD_MILLION`, `WHALE_ALERT_DEFAULT_THRESHOLD_VND`, `WHALE_CONFIG_VERSION`, `WHALE_SIZE_CLASS_SHARK_MIN_VND`, `WHALE_SIZE_CLASS_WHALE_MIN_VND`

### `backend/portfolio/email_verification.py`

- Functions:
  - `_verification_expiry_label`, `build_email_verification_url`, `generate_email_verification_token`, `resolve_email_verification_token`, `send_verification_email`
- Top-level variables:
  - `EMAIL_VERIFICATION_SALT`

### `backend/portfolio/encryption_utils.py`

- Functions:
  - `_build_fernet`, `decrypt_text`, `encrypt_text`

### `backend/portfolio/exceptions.py`

- Classes:
  - `BusinessLogicRuleException`
  - `ExternalSystemException`
  - `MarketDataValidationException`
  - `PortfolioAppException` -> methods: `__init__`

### `backend/portfolio/gmail_service.py`

- Functions:
  - `_build_raw_message`, `send_gmail_api_message`

### `backend/portfolio/google_oauth_service.py`

- Functions:
  - `build_google_oauth_authorize_url`, `exchange_google_oauth_code`, `fetch_google_user_email`, `refresh_google_access_token`
- Top-level variables:
  - `GOOGLE_OAUTH_AUTHORIZE_URL`, `GOOGLE_OAUTH_TOKEN_URL`, `GOOGLE_OAUTH_USERINFO_URL`

### `backend/portfolio/legal_views.py`

- Classes:
  - `LegalPagePublicView` -> methods: `get`
- Top-level variables:
  - `DEFAULT_LOCALE_FALLBACK`, `logger`

### `backend/portfolio/mail_service.py`

- Functions:
  - `_humanize_gmail_error`, `build_email_connection`, `build_sender_address`, `get_active_email_account`, `send_system_email`, `send_test_email`

### `backend/portfolio/management/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/management/commands/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/management/commands/backfill_starter_portfolios.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Top-level variables:
  - `User`

### `backend/portfolio/management/commands/create_default_subaccount.py`

- Classes:
  - `Command` -> methods: `handle`

### `backend/portfolio/management/commands/initialize_dpi_plans.py`

- Classes:
  - `Command` -> methods: `handle`

### `backend/portfolio/management/commands/prune_system_ai_audit_logs.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/realtime_tick.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/run_stream_consumers.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Functions:
  - `_handle_sigterm`
- Top-level variables:
  - `_running`, `logger`

### `backend/portfolio/management/commands/seed_comprehensive_demo.py`

- Classes:
  - `Command` -> methods: `_create_ai_advisory_components`, `_create_daily_prices`, `_create_intraday_ticks`, `_create_order_flow_signals`, `_create_price_alerts`, `_create_screener_rules`, `_create_stock_profiles`, `_create_user_portfolios`, `_create_users`, `_create_watchlists_and_trackers`, `_create_whale_advisories`, `_reset_demo_data`, `add_arguments`, `handle`
- Top-level variables:
  - `AI_DESCRIPTIONS`, `BASE_PRICES`, `ORDER_FLOW_SIGNALS`, `SUGGESTED_ACTIONS`, `VN30_SYMBOLS`, `logger`

### `backend/portfolio/management/commands/seed_demo_data.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/seed_securities_groups.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/seed_user.py`

- Classes:
  - `Command` -> methods: `handle`

### `backend/portfolio/management/commands/seed_watchlist.py`

- Classes:
  - `Command` -> methods: `_apply`, `_print_summary`, `_seed_manual`, `add_arguments`, `handle`

### `backend/portfolio/management/commands/seed_whale_mission_control.py`

- Classes:
  - `Command` -> methods: `_ensure_stock_profiles`, `_ensure_user`, `_reset_seeded_data`, `_seed_demo_data`, `add_arguments`, `handle`

### `backend/portfolio/management/commands/sync_prices.py`

- Classes:
  - `Command` -> methods: `_print_result`, `add_arguments`, `handle`

### `backend/portfolio/management/commands/sync_stockprofile.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/sync_watch_assets.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/verify_demo_data.py`

- Functions:
  - `format_number`, `print_section`
- Top-level variables:
  - `active`, `advisories`, `alerts`, `buy_count`, `components`, `daily_prices`, `earliest`, `inactive`, `latest`, `portfolios`, `screeners`, `sell_count`, `signal_types`, `signals`, `stocks`, `ticks`, `top_symbols_qs`, `total_records`, `tracked`, `users`, `watchlists`

### `backend/portfolio/market_data_service.py`

- Classes:
  - `MarketDataService` -> methods: `_allow_vnstock_aggregate_fallback`, `_build_aggregate_event_payload`, `_build_aggregate_event_payload_from_record`, `_build_aggregate_record_response`, `_build_aggregate_response`, `_build_dataframe_trades`, `_build_empty_aggregate_response`, `_build_empty_whale_feed_response`, `_build_intraday_backoff_response`, `_build_next_cursor_from_db_row`, `_build_next_cursor_from_record`, `_build_price_status`, `_build_stock_workspace_overview_base`, `_build_stream_aggregate_records`, `_build_stream_trades`, `_build_tick_timestamp`, `_build_vnstock_aggregate_records`, `_build_whale_order_payload`, `_classify_signal_size`, `_compute_rsi`, `_compute_stock_workspace_technical`, `_dataframe_has_threshold_hits`, `_decode_whale_feed_cursor`, `_encode_whale_feed_cursor`, `_format_time`, `_get_exchange_price_band`, `_get_user_symbol_threshold_overrides_vnd`, `_get_user_whale_threshold_vnd`, `_normalize_aggregate_event_records`, `_normalize_side`, `_parse_cursor_datetime`, `_parse_cursor_matched_value`, `_parse_limit`, `_parse_sort`, `_price_map_from_ticker_cache`, `_record_source_observability`, `_resolve_whale_feed_symbols`, `_row_float`, `_safe_float`, `_safe_int`, `_safe_round`, `_technical_bias_meta`, `_to_float`, `get_depth_chart`, `get_financial_metrics`, `get_intraday_matched`, `get_price_board`, `get_realtime_ticker`, `get_rvol`, `get_sector_breadth`, `get_stock_workspace_chart`, `get_stock_workspace_overview`, `get_whale_feed`, `get_whale_feed_aggregate`, `normalize_page_size`, `normalize_symbol`
- Top-level variables:
  - `logger`, `market_data_service`

### `backend/portfolio/market_views.py`

- Classes:
  - `BaseMarketDataView` -> methods: `handle_exception_response`, `validate_query`
  - `DepthChartView` -> methods: `get`
  - `FinancialMetricsView` -> methods: `get`
  - `IntradayMatchedView` -> methods: `get`
  - `PriceBoardView` -> methods: `get`
  - `RealtimeTickerView` -> methods: `get`
  - `RVOLView` -> methods: `get`
  - `SectorBreadthView` -> methods: `get`
  - `StockWorkspaceChartView` -> methods: `get`
  - `StockWorkspaceOverviewView` -> methods: `get`
  - `WhaleFeedAggregateView` -> methods: `get`
  - `WhaleFeedView` -> methods: `get`

### `backend/portfolio/middleware.py`

- Classes:
  - `MarketObservabilityMiddleware` -> methods: `__call__`, `__init__`

### `backend/portfolio/models.py`

- Classes:
  - `AccountSnapshot` -> methods: `__str__`
  - `AdvisoryTokenLog` -> methods: `__str__`
  - `AIAdvisoryComponentRecord` -> methods: `__str__`
  - `AIAdvisoryExecutiveSummary` -> methods: `__str__`
  - `DailyPrice` -> methods: `__str__`
  - `IntradayTick` -> methods: `__str__`
  - `LegalPage` -> methods: `__str__`
  - `MarketGroupSyncLog` -> methods: `__str__`
  - `OnboardingPlanPolicy` -> methods: `__str__`, `clean`
  - `OrderFlowSignal` -> methods: `__str__`
  - `PlanAssignmentLog` -> methods: `__str__`
  - `Portfolio` -> methods: `__str__`
  - `PriceAlertRule` -> methods: `__str__`
  - `ScreenerRule` -> methods: `__str__`
  - `SecuritiesGroup` -> methods: `__str__`
  - `SecuritiesItem` -> methods: `__str__`
  - `StockProfile` -> methods: `__str__`
  - `StockProfileSyncLog` -> methods: `__str__`
  - `SubAccount` -> methods: `__str__`
  - `SystemAISettings` -> methods: `__str__`, `ai_api_key_configured`, `clean`, `get_active`, `get_ai_api_key`, `get_effective_ai_model`, `save`, `set_ai_api_key`
  - `SystemAISettingsAuditLog` -> methods: `__str__`
  - `SystemEmailAccount` -> methods: `__str__`, `clean`, `clear_google_refresh_token`, `get_google_client_secret`, `get_google_refresh_token`, `get_smtp_password`, `has_google_refresh_token`, `save`, `set_google_client_secret`, `set_google_refresh_token`, `set_smtp_password`
  - `TrackedSymbol` -> methods: `__str__`
  - `Transaction` -> methods: `__str__`, `total_value`
  - `UserConfig` -> methods: `__str__`, `ai_api_key_configured`, `get_ai_api_key`, `get_effective_ai_model`, `set_ai_api_key`
  - `UserPlanLifecycle` -> methods: `__str__`
  - `WatchlistGroup` -> methods: `__str__`
  - `WatchlistItem` -> methods: `__str__`
  - `WhaleAdvisory` -> methods: `__str__`
  - `WhaleConfigApproval` -> methods: `__str__`, `clean`, `save`
  - `WhaleConfigAuditLog` -> methods: `__str__`
  - `WhaleConfigDraft` -> methods: `__str__`
  - `WhaleConfigRollout` -> methods: `__str__`
  - `WhaleConfigVersion` -> methods: `__str__`
  - `WhaleConfigWorkerAck` -> methods: `__str__`
- Top-level variables:
  - `SecuritiesGroupAlias`, `SecuritiesItemAlias`

### `backend/portfolio/observability.py`

- Functions:
  - `_ensure_http_endpoint`, `_latency_window_size`, `_metrics_enabled`, `_percentile`, `get_market_observability_snapshot`, `record_advisory_merge_observation`, `record_ai_chart_context_observation`, `record_market_external_timeout`, `record_market_fallback`, `record_market_http_observation`, `reset_market_observability`
- Top-level variables:
  - `_ADVISORY_MERGE_STATS`, `_AI_CHART_CONTEXT_STATS`, `_FALLBACK_COUNTS`, `_HTTP_STATS`, `_LOCK`, `_STARTED_AT_EPOCH`, `_TIMEOUT_COUNTS`

### `backend/portfolio/onboarding_trial_service.py`

- Classes:
  - `TrialApplyResult`
- Functions:
  - `_create_plan_assignment_log`, `apply_onboarding_trial_for_new_user`, `get_active_onboarding_policy`, `process_expired_onboarding_trials`
- Top-level variables:
  - `logger`

### `backend/portfolio/openclaw_client.py`

- Functions:
  - `_call`, `generate_whale_concise`, `generate_whale_deep`, `generate_whale_summary`
- Top-level variables:
  - `_API_KEY`, `_BASE_URL`, `_DISCLAIMER`, `_MODEL`, `logger`

### `backend/portfolio/opencore_admin.py`

- Classes:
  - `DPIAnalyticsSnapshotAdmin`
  - `DPIAPICallLogAdmin`
  - `DPIAuditLogAdmin`
  - `DPIEntitlementAdmin`
  - `DPIFeatureUsageAdmin`
  - `DPIInvoiceAdmin` -> methods: `status_badge`
  - `DPILicenseAdmin` -> methods: `status_badge`
  - `DPIPaymentAdmin` -> methods: `status_badge`
  - `DPIPlanAdmin`
  - `DPIQuotaTrackerAdmin` -> methods: `quota_percentage`
  - `DPIRevenuePlanAdmin`
  - `DPISubscriptionAdmin` -> methods: `is_active_display`
  - `DPIUsageMetricsAdmin`

### `backend/portfolio/opencore_analytics.py`

- Classes:
  - `DPIAnalyticsSnapshot` -> methods: `__str__`, `cache_hit_rate`
  - `DPIAPICallLog` -> methods: `__str__`, `log_call`
  - `DPIFeatureUsage` -> methods: `__str__`, `increment_usage`
  - `DPIQuotaTracker` -> methods: `__str__`, `add_quota_usage`, `get_or_create_current`, `is_within_quota`
- Functions:
  - `get_monthly_usage_summary`, `track_api_call`
- Top-level variables:
  - `logger`

### `backend/portfolio/opencore_api.py`

- Classes:
  - `DPIAuditLogSerializer`
  - `DPIBillingViewSet` -> methods: `current_bill`, `invoices`, `subscription`
  - `DPIInvoiceSerializer`
  - `DPILicenseSerializer` -> methods: `get_available_features`, `get_days_until_expiry`
  - `DPILicenseViewSet` -> methods: `available_plans`, `get_object`, `get_queryset`, `my_license`, `status`
  - `DPIPlanSerializer` -> methods: `get_features`
  - `DPIPremiumIndicatorsViewSet` -> methods: `available`, `can_use`
  - `DPIQuotaTrackerSerializer` -> methods: `get_is_warning`, `get_quota_percentage`
  - `DPIUsageMetricsSerializer`
  - `DPIUsageViewSet` -> methods: `audit_log`, `quota`, `summary`, `top_features`
- Functions:
  - `require_feature`
- Top-level variables:
  - `logger`

### `backend/portfolio/opencore_celery_tasks.py`

- Functions:
  - `check_overquota_users`, `cleanup_old_audit_logs`, `create_analytics_snapshots`, `generate_monthly_invoices`, `reset_monthly_quotas`, `send_license_warning_email`, `send_quota_exceeded_email`, `send_quota_warning_email`, `sync_all_dpi_licenses`
- Top-level variables:
  - `logger`

### `backend/portfolio/opencore_dpi.py`

- Classes:
  - `DPIAuditLog` -> methods: `__str__`
  - `DPIEntitlement` -> methods: `__str__`, `can_use`, `increment_usage`
  - `DPILicense` -> methods: `__str__`, `can_use_feature`, `days_until_expiry`, `is_valid`
  - `DPIPlan` -> methods: `__str__`, `get_features`, `has_feature`
  - `DPIUsageMetrics` -> methods: `__str__`, `reset_monthly`
- Functions:
  - `check_feature_access`, `get_or_create_default_license`

### `backend/portfolio/opencore_premium.py`

- Classes:
  - `PremiumFeatureGate` -> methods: `can_calculate_indicator`, `get_api_weight`, `get_available_indicators`, `get_indicator`
  - `PremiumIndicator`
- Functions:
  - `get_plan_features`
- Top-level variables:
  - `ADVANCED_FEATURES_BY_PLAN`, `PREMIUM_INDICATORS`

### `backend/portfolio/opencore_revenue.py`

- Classes:
  - `DPIInvoice` -> methods: `__str__`, `mark_paid`
  - `DPIPayment` -> methods: `__str__`, `mark_completed`
  - `DPIRevenuePlan` -> methods: `__str__`, `calculate_monthly_cost`
  - `DPISubscription` -> methods: `__str__`, `days_until_renewal`, `is_active`
- Functions:
  - `calculate_monthly_bill`, `generate_monthly_invoice`
- Top-level variables:
  - `logger`

### `backend/portfolio/opencore_signals.py`

- Functions:
  - `create_dpi_license_for_new_user`

### `backend/portfolio/order_flow.py`

- Functions:
  - `_bucket_index`, `_fetch_ticks`, `_now_time`, `_time_to_seconds`, `_today`, `compute_cvd_series`, `compute_size_distribution`, `compute_tick_rate`, `detect_absorption`, `detect_dark_flow`, `detect_iceberg_clustering`
- Top-level variables:
  - `DEFAULT_BUCKET_SECONDS`, `DEFAULT_WINDOW_MINUTES`, `LARGE_ORDER_THRESHOLD`, `PRICE_LOCK_THRESHOLD_PCT`, `SMALL_ORDER_THRESHOLD`, `TICK_RATE_CACHE_TTL`

### `backend/portfolio/permissions.py`

- Classes:
  - `IsAdminPlan` -> methods: `has_permission`
  - `IsBasicPlan` -> methods: `has_permission`
  - `IsPremiumPlan` -> methods: `has_permission`
  - `IsProPlan` -> methods: `has_permission`
- Functions:
  - `_get_plan`, `_resolve_quota_caps`, `_resolve_tier`, `_resolve_trial_state`, `build_abilities`, `has_plan`, `resolve_user_entitlements`
- Top-level variables:
  - `DEFAULT_QUOTA_CAPS_BY_TIER`, `PLAN_ORDER`, `PLAN_TIER_MAP`

### `backend/portfolio/proxy_models.py`

- Classes:
  - `SecuritiesGroupProxy`
  - `SecuritiesItemProxy`
  - `StockProfileProxy`

### `backend/portfolio/quota_service.py`

- Functions:
  - `_is_enforcement_enabled`, `_normalize_limit`, `_now_vn`, `_quota_cache_key`, `_quota_reset_at_iso`, `_resolve_limit`, `_seconds_until_vn_midnight`, `build_quota_exceeded_payload`, `consume_quota`, `get_usage`
- Top-level variables:
  - `VN_TZ`

### `backend/portfolio/realtime/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/realtime/collector.py`

- Functions:
  - `collect_and_push`, `collect_intraday_frame`, `collect_symbols_for_user`

### `backend/portfolio/realtime/compute.py`

- Classes:
  - `WhaleSignal`
- Functions:
  - `_build_whale_event_id`, `_classify_signal_size`, `_iso_now`, `_normalize_signal_side`, `build_heartbeat_payload`, `build_ticker_payload`, `build_whale_payload`, `compute_vwap`, `detect_whale_signals`

### `backend/portfolio/realtime/publisher.py`

- Classes:
  - `RealtimePublisher` -> methods: `__init__`, `_channel_to_group`, `next_seq`, `publish`
- Top-level variables:
  - `logger`

### `backend/portfolio/realtime/stream_consumers.py`

- Classes:
  - `AlertEngineConsumer` -> methods: `process_batch`
  - `DbWriterConsumer` -> methods: `process_batch`
  - `TickConsumerBase` -> methods: `__init__`, `client`, `process_batch`, `run_once`, `stream_key`
  - `WsBroadcastConsumer` -> methods: `process_batch`
- Functions:
  - `_get_stream_client`
- Top-level variables:
  - `logger`

### `backend/portfolio/realtime/stream_reader.py`

- Classes:
  - `StreamReader` -> methods: `__init__`, `_from_cache`, `_from_stream`, `_is_stream_payload_stale`, `_snapshot_from_stream`, `get_intraday_ticks`, `get_intraday_with_fallback`, `get_snapshot`, `health`, `producer`, `streams_health`
- Top-level variables:
  - `logger`

### `backend/portfolio/realtime/tick_producer.py`

- Classes:
  - `TickProducer` -> methods: `__init__`, `client`, `ensure_consumer_groups`, `push_intraday_ticks`, `push_price_snapshot`, `read_latest_ticks`, `read_snapshot`, `snapshot_key`, `stream_key`
- Functions:
  - `_get_client`
- Top-level variables:
  - `_CONSUMER_GROUPS`, `logger`

### `backend/portfolio/routing.py`

- Top-level variables:
  - `websocket_urlpatterns`

### `backend/portfolio/screener_helpers.py`

- Functions:
  - `_apply_screener_condition`, `_screener_build_technical`, `_validate_screener_rules`
- Top-level variables:
  - `_SCREENER_ALLOWED_FIELDS`, `_SCREENER_ALLOWED_OPS`, `_SCREENER_NEEDS_HISTORY_FIELDS`

### `backend/portfolio/serializers.py`

- Classes:
  - `AIAdvisoryComponentRecordSerializer`
  - `AIAdvisoryExecutiveSummarySerializer`
  - `ChartPointSerializer`
  - `DailyPriceSerializer`
  - `HoldingSerializer`
  - `LegalPageSerializer`
  - `MarketIntradayQuerySerializer`
  - `MarketStockChartQuerySerializer`
  - `PortfolioSerializer` -> methods: `get_subaccount_count`, `get_transaction_count`
  - `PriceAlertRuleSerializer` -> methods: `validate_cooldown_seconds`, `validate_symbol`
  - `ScreenerRuleSerializer`
  - `SecuritiesGroupCreateSerializer`
  - `SecuritiesGroupDetailSerializer`
  - `SecuritiesItemSerializer` -> methods: `validate_symbol`
  - `StockAIChartContextSerializer` -> methods: `validate`, `validate_ohlcv`, `validate_symbol`
  - `StockAIChartDrawingMetaSerializer`
  - `StockAIChartOHLCVPointSerializer`
  - `StockAIChartVisibleRangeSerializer` -> methods: `validate`
  - `StockProfileSerializer`
  - `StockWorkspaceChartPointSerializer`
  - `StockWorkspaceChartResponseSerializer`
  - `StockWorkspaceGroupRefSerializer`
  - `StockWorkspaceOverviewSerializer`
  - `StockWorkspaceTechnicalSerializer`
  - `StockWorkspaceWatchlistMembershipSerializer`
  - `SubAccountSerializer`
  - `SummarySerializer`
  - `TrackedSymbolSerializer`
  - `TradingSubAccountCreateRequestSerializer`
  - `TransactionSerializer` -> methods: `validate`, `validate_symbol`
  - `UserConfigSerializer` -> methods: `update`, `validate`, `validate_advisory_max_auto_refreshes_per_day`, `validate_ai_provider`, `validate_whale_alert_threshold`
  - `WatchlistGroupSerializer`
  - `WatchlistItemSerializer`
  - `WatchlistItemWithPriceSerializer`
  - `WhaleAdvisorySerializer`

### `backend/portfolio/services.py`

- Functions:
  - `_active_whale_config_json`, `_coerce_float`, `_coerce_int`, `_extract_first`, `_fetch_exchange_lookup`, `_format_preview_value`, `_normalise_ohlcv`, `_normalize_maxrss_to_mb`, `_normalize_symbol_list`, `_ping_redis_url`, `_serialize_whale_config_rollout`, `_serialize_whale_config_version`, `_stable_symbol_percent`, `_to_decimal`, `_to_int`, `activate_due_scheduled_whale_config_rollouts`, `activate_whale_config_version`, `apply_market_group_payload`, `auto_revert_whale_config_rollout`, `build_market_group_payload`, `build_rollout_propagation_snapshot`, `build_stock_profile_payload`, `build_whale_config_diff_preview`, `build_whale_config_runtime_preview`, `build_whale_rollout_anomaly_snapshot`, `build_whale_runtime_score_config`, `build_whale_runtime_thresholds`, `check_whale_config_dependencies`, `ensure_rollout_worker_ack_records`, `fetch_and_save_daily_prices`, `fetch_market_sectors_and_groups`, `find_previous_stable_whale_config_version`, `get_active_runtime_rollout_for_symbol`, `get_active_whale_config_version`, `get_latest_price`, `get_latest_rollout_for_version`, `get_latest_whale_config_anomaly_overview`, `get_live_celery_worker_names`, `get_live_celery_worker_summary`, `get_manual_market_group_payload`, `get_price_changes`, `get_price_series`, `get_whale_advisory_alert_overview`, `get_whale_config_dashboard_overview`, `get_whale_config_propagation_overview`, `initialize_whale_config_rollout`, `monitor_whale_config_rollout_anomalies`, `normalize_whale_config_payload`, `notify_whale_config_auto_revert`, `record_whale_config_worker_ack`, `refresh_rollout_propagation_status`, `resolve_rollout_target_symbols`, `resolve_whale_runtime_config`, `symbol_matches_canary_scope`, `sync_market_groups`, `sync_market_groups_for_user`, `sync_market_groups_for_users`, `sync_portfolio_prices`, `sync_stock_profiles`, `sync_watchlist_prices`, `validate_whale_config_guardrails`
- Top-level variables:
  - `_CAP_GROUP_DEFS`, `_MANUAL_MARKET_GROUPS`, `_SECTOR_COLORS`, `logger`

### `backend/portfolio/starter_portfolio_service.py`

- Classes:
  - `StarterProvisionResult` -> methods: `applied`
- Functions:
  - `provision_starter_portfolios_for_user`, `should_provision_starter_portfolios_for_user`
- Top-level variables:
  - `STARTER_PORTFOLIO_TEMPLATES`, `STARTER_SUBACCOUNT_TEMPLATES`, `STARTER_TEMPLATE_VERSION`

### `backend/portfolio/stock_workspace_helpers.py`

- Functions:
  - `_build_stock_workspace_overview`, `_compute_ema`, `_compute_macd_hist`, `_compute_rsi`, `_compute_stock_workspace_technical`, `_get_exchange_price_band`, `_safe_round`, `_technical_bias_meta`, `_to_float`

### `backend/portfolio/tasks.py`

- Functions:
  - `_accumulate_user_advisory_event`, `_advisory_event_merge_cache_key`, `_collect_prefetch_symbols`, `_compute_advisory_severity`, `_compute_event_side_score`, `_detect_reversal_signal`, `_distinct_symbols`, `_get_auto_generation_count_today`, `_get_remaining_advisory_budget`, `_get_remaining_auto_refreshes`, `_get_tokens_used_today`, `_infer_dark_flow_direction`, `_is_rate_limited_error`, `_mark_price_board_rate_limited`, `_normalize_advisory_source`, `_normalize_symbol`, `_prefetch_retry_countdown`, `_resolve_advisory_threshold_vnd`, `_resolve_next_refresh_at`, `_resolve_side_by_dynamic_score`, `_safe_float`, `_should_use_concise_advisory`, `_store_prefetch_meta`, `_token_log_source_for_advisory_source`, `_whale_thresholds_for_user`, `ack_whale_config_rollout`, `activate_due_whale_config_rollouts`, `auto_generate_advisories_for_all_tracked`, `cleanup_old_intraday_ticks`, `collect_and_publish_realtime`, `detect_and_store_order_flow`, `detect_whale_reversal`, `flush_merged_advisory_event`, `generate_whale_advisory_task`, `monitor_whale_config_anomalies`, `prefetch_ticker_price_board`, `process_expired_onboarding_trials_task`, `process_plan_lifecycle_transitions`, `refresh_whale_config_rollout_status`, `run_stream_consumer_batch`, `sync_all_watch_assets`, `sync_user_watch_assets`, `trim_streams`
- Top-level variables:
  - `ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY`, `ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX`, `ORDER_FLOW_COOLDOWN_SECONDS`, `ORDER_FLOW_MAX_SYMBOLS`, `TICKER_PREFETCH_META_CACHE_KEY`, `VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY`, `logger`

### `backend/portfolio/tests/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/tests/test_adapters.py`

- Classes:
  - `CacheAdapterTests` -> methods: `test_get_cache_happy_path`, `test_get_cache_returns_none_on_exception`, `test_is_vnstock_rate_limited_false_when_key_missing`, `test_is_vnstock_rate_limited_true_when_key_exists`, `test_mark_vnstock_rate_limited_sets_cache`, `test_set_cache_happy_path`, `test_set_cache_swallows_exceptions`
  - `VnstockAdapterTests` -> methods: `test_build_stock_client_raises_vnstock_missing`, `test_fetch_financial_ratio_dataframe_uses_timeout_wrapper`, `test_fetch_history_dataframe_uses_selected_source`, `test_fetch_price_board_dataframe_keeps_raw_vnstock_price_units`, `test_normalize_price_board_dataframe_keeps_raw_vnstock_price_units`, `test_read_stream_intraday_ticks_returns_empty_when_reader_fails`, `test_run_with_timeout_returns_function_result`, `test_run_with_timeout_wraps_generic_exception`

### `backend/portfolio/tests/test_admin_mail_accounts.py`

- Classes:
  - `EmailVerificationRegressionTests` -> methods: `setUp`, `test_send_verification_email_propagates_oauth2_error`, `test_send_verification_email_routes_through_oauth2_account`
  - `GoogleOAuthServiceTests` -> methods: `test_refresh_token_raises_http_status_error_on_401_response`, `test_refresh_token_raises_value_error_on_missing_credentials`, `test_refresh_token_raises_value_error_when_response_has_no_access_token`, `test_refresh_token_returns_access_token_on_success`
  - `SystemEmailAccountAdminTests` -> methods: `setUp`, `test_admin_action_can_send_test_email`, `test_admin_changelist_is_accessible`, `test_google_callback_view_rejects_expired_state`, `test_google_callback_view_rejects_state_mismatch`, `test_google_callback_view_rejects_user_account_payload_mismatch`, `test_google_callback_view_saves_refresh_token`, `test_google_connect_view_redirects_to_google_authorize_url`
  - `SystemEmailAccountModelTests` -> methods: `test_build_email_connection_uses_database_config`, `test_saving_new_default_account_unsets_previous_default`, `test_send_system_email_maps_google_401_error`, `test_send_system_email_maps_google_429_error`, `test_send_system_email_uses_google_oauth2_branch`, `test_send_test_email_updates_latest_status`
- Functions:
  - `_build_http_status_error`

### `backend/portfolio/tests/test_admin_market_group_sync.py`

- Classes:
  - `AdminMarketGroupSyncTests` -> methods: `setUp`, `test_admin_sync_route_supports_global_scope`, `test_admin_sync_route_supports_username_scope`, `test_market_group_admin_blocks_manual_add_and_change`

### `backend/portfolio/tests/test_admin_ops.py`

- Classes:
  - `AdminOpsStatsDataTests` -> methods: `_get_stats`, `setUp`, `test_response_has_all_required_keys`, `test_ticker_prefetch_payload_present`
  - `AdminOpsStatsPermissionTests` -> methods: `_login`, `setUp`, `test_regular_user_returns_403`, `test_staff_user_returns_200`, `test_unauthenticated_returns_401`
  - `AdminOpsWarmPrefetchTests` -> methods: `_get_stats`, `setUp`, `test_channel_layer_type_field_is_string`, `test_last_market_group_sync_none_when_no_log`, `test_last_market_group_sync_populated_when_log_exists`, `test_last_stock_profile_sync_none_when_no_log`, `test_portfolio_count_is_correct`, `test_redis_ok_field_present_in_response`, `test_staff_can_queue_async_prefetch_warm`, `test_tracked_symbol_count_is_correct`, `test_user_count_includes_all_users`, `test_warm_prefetch_requires_auth`, `test_watchlist_item_count_is_correct`, `test_whale_dashboard_includes_rollout_postcheck_summary`
- Top-level variables:
  - `URL`, `WARM_URL`

### `backend/portfolio/tests/test_admin_stockprofile_sync.py`

- Classes:
  - `AdminStockProfileSyncTests` -> methods: `setUp`, `test_admin_navigation_links_to_workspace_from_related_models`, `test_admin_stockprofile_sync_route`, `test_admin_stockprofile_workspace_route`

### `backend/portfolio/tests/test_admin_user_verification.py`

- Classes:
  - `UserConfigAdminVerificationTests` -> methods: `setUp`, `test_admin_action_resends_only_for_unverified_accounts`, `test_admin_index_shows_verification_operations_summary`, `test_admin_route_can_resend_latest_pending_verification_email`, `test_admin_route_warns_when_no_pending_verification_accounts`, `test_userconfig_admin_changelist_is_accessible`, `test_userconfig_change_view_hides_resend_button_for_verified_user`, `test_userconfig_change_view_shows_resend_button_for_unverified_user`, `test_userconfig_detail_route_can_resend_verification_email`, `test_userconfig_detail_route_skips_verified_user`

### `backend/portfolio/tests/test_admin_whale_mission_control.py`

- Classes:
  - `WhaleMissionControlModelTests` -> methods: `_attach_messages`, `_message_texts`, `setUp`, `test_activate_due_scheduled_rollout_marks_version_active`, `test_admin_approval_by_supervisor_writes_audit`, `test_admin_draft_save_creates_audit_log`, `test_admin_role_split_permissions`, `test_anomaly_snapshot_detects_whale_tick_spike`, `test_apply_active_version_blocks_when_dependencies_degraded`, `test_apply_active_version_shows_diff_preview_and_activates_target`, `test_canary_scope_matches_symbol_exchange_and_percentage`, `test_create_draft_and_version`, `test_diff_preview_detects_threshold_and_weight_changes`, `test_guardrail_validator_rejects_dangerous_thresholds`, `test_initialize_rollout_creates_pending_worker_ack_records`, `test_maker_checker_block_same_creator_as_reviewer`, `test_monitor_rollout_anomalies_auto_reverts_to_previous_version`, `test_record_worker_ack_marks_rollout_completed_when_all_workers_ack`, `test_resolve_runtime_config_prefers_canary_and_auto_acks_worker`, `test_rollout_snapshot_marks_stale_worker_version_as_amber`, `test_rollout_worker_ack_and_audit_log`, `test_scheduled_rollout_allows_warning_without_blocking`, `test_submit_selected_drafts_blocks_when_preview_has_blocking_issues`, `test_supervisor_can_approve`, `test_whale_models_are_exposed_in_custom_admin_menu_groups`

### `backend/portfolio/tests/test_ai_config_api.py`

- Classes:
  - `AIConfigApiTests` -> methods: `setUp`, `test_ai_config_get_and_put`, `test_ai_config_get_uses_env_key_for_configured_flag`, `test_ai_config_get_uses_system_fallback_when_user_missing_config`, `test_ai_config_put_rejects_missing_model`, `test_ai_config_put_rejects_model_not_supported_for_advisory`, `test_ai_options_returns_providers_and_defaults`, `test_ai_test_connection_endpoint`, `test_ai_test_connection_rejects_missing_api_key`, `test_ai_test_connection_rejects_missing_model`, `test_ai_test_connection_rejects_model_not_supported_for_advisory`, `test_update_user_config_with_provider_and_model`

### `backend/portfolio/tests/test_ai_context.py`

- Classes:
  - `AIContextTests` -> methods: `setUp`, `test_build_context_contains_market_and_intraday`, `test_render_context_for_prompt_has_expected_sections`

### `backend/portfolio/tests/test_ai_runtime_config.py`

- Classes:
  - `AIRuntimeConfigTests` -> methods: `setUp`, `test_resolver_falls_back_to_system_when_user_missing_model_and_key`, `test_resolver_prefers_user_config_over_system`

### `backend/portfolio/tests/test_analytics_advanced.py`

- Classes:
  - `TestBuildRiskMetrics` -> methods: `setUp`, `test_build_risk_metrics_empty_portfolio_returns_none_values`, `test_build_risk_metrics_max_drawdown_non_positive`, `test_build_risk_metrics_period_days_matches_input`, `test_build_risk_metrics_returns_expected_keys`, `test_build_risk_metrics_values_are_numeric_or_none`
  - `TestComputeDailyReturns` -> methods: `test_basic_returns_calculated_correctly`, `test_empty_nav_returns_empty_series`, `test_single_value_returns_empty_series`
  - `TestComputeMaxDrawdown` -> methods: `test_deep_drawdown`, `test_empty_returns_zero`, `test_known_drawdown`, `test_monotonically_increasing_has_zero_drawdown`
  - `TestComputeSharpe` -> methods: `test_empty_returns_zero`, `test_few_returns_returns_zero`, `test_negative_sharpe_for_bad_portfolio`, `test_positive_sharpe_for_good_portfolio`, `test_zero_volatility_returns_zero`
  - `TestComputeSortino` -> methods: `test_empty_returns_zero`, `test_no_negative_days_returns_sentinel`, `test_sortino_higher_than_sharpe_when_asymmetric`
  - `TestComputeTwr` -> methods: `test_empty_returns_zero`, `test_flat_nav_twr_zero`, `test_known_twr`, `test_negative_trend_twr_negative`, `test_positive_trend_twr_positive`
  - `TestComputeVolatility` -> methods: `test_empty_returns_zero`, `test_volatility_annualized_correctly`, `test_zero_returns_zero_volatility`
- Functions:
  - `_make_nav_df`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_api_routes.py`

- Classes:
  - `ApiRouteSmokeTests` -> methods: `_attach_dpi_license`, `_create_stock_workspace_advisory`, `_detach_dpi_license`, `authenticate`, `setUp`, `test_admin_sync_stockprofile_endpoint`, `test_auth_me_endpoint_returns_community_tier_for_free_plan`, `test_auth_me_endpoint_returns_plan_and_abilities`, `test_delete_current_whale_advisory_endpoint_deletes_latest_for_symbol`, `test_delete_current_whale_advisory_endpoint_returns_404_when_missing`, `test_delete_current_whale_advisory_endpoint_returns_business_403_for_community`, `test_depth_chart_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_financial_metrics_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_financial_metrics_refactored_returns_502_on_unexpected_exception`, `test_financial_metrics_returns_502_on_unexpected_provider_exception`, `test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy`, `test_google_oauth_endpoint_existing_user_no_reassignment`, `test_google_oauth_endpoint_fail_soft_when_starter_provisioning_fails`, `test_intraday_legacy_returns_200_fallback_on_provider_exception`, `test_jwt_token_obtain_endpoint`, `test_login_allows_unverified_superuser`, `test_login_is_blocked_for_unverified_user`, `test_market_group_write_endpoints_are_read_only`, `test_portfolio_endpoint_uses_refactored_trading_view_when_flag_enabled`, `test_portfolio_userconfig_endpoint`, `test_price_alert_rule_crud_and_trigger_endpoint`, `test_price_board_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_price_board_legacy_returns_200_fallback_on_provider_exception`, `test_price_board_refactored_returns_200_fallback_on_provider_exception`, `test_realtime_intraday_endpoint_rejects_invalid_page_size`, `test_realtime_intraday_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_realtime_intraday_refactored_returns_200_fallback_on_provider_exception`, `test_realtime_ticker_endpoint_uses_legacy_view_when_canary_percent_zero`, `test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_realtime_ticker_fallback_endpoint`, `test_refactored_portfolio_delete_cascades_subaccounts_and_transactions`, `test_refactored_portfolio_delete_rejects_foreign_portfolio`, `test_refactored_portfolio_detail_allows_owner`, `test_refactored_portfolio_detail_rejects_foreign_portfolio`, `test_refactored_portfolio_list_returns_only_owner_portfolios`, `test_refactored_portfolio_update_allows_owner`, `test_refactored_portfolio_update_rejects_foreign_portfolio`, `test_refactored_subaccount_create_rejects_foreign_portfolio`, `test_refactored_subaccount_create_returns_400_when_user_has_no_portfolio`, `test_refactored_subaccount_create_uses_requested_owned_portfolio`, `test_refactored_subaccount_create_without_portfolio_falls_back_to_first_portfolio`, `test_refactored_subaccount_delete_rejects_foreign_subaccount`, `test_refactored_subaccount_detail_allows_owner`, `test_refactored_subaccount_detail_rejects_foreign_subaccount`, `test_refactored_subaccount_list_returns_only_owner_subaccounts`, `test_refactored_subaccount_update_rejects_foreign_subaccount`, `test_refactored_transaction_create_rejects_foreign_sub_account`, `test_refactored_transaction_delete_rejects_foreign_transaction`, `test_refactored_transaction_update_rejects_foreign_transaction`, `test_refactored_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements`, `test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db`, `test_refactored_whale_feed_aggregate_rejects_invalid_cursor`, `test_refactored_whale_feed_falls_back_to_intraday_tick_db_when_vnstock_unavailable`, `test_refactored_whale_feed_response_contains_scoring_contract`, `test_register_endpoint_applies_active_onboarding_policy`, `test_register_endpoint_creates_unverified_user_and_sends_verification_email`, `test_register_endpoint_fail_soft_when_starter_provisioning_fails`, `test_register_endpoint_normalizes_email_to_lowercase`, `test_register_endpoint_rejects_duplicate_email_case_insensitive`, `test_register_endpoint_rejects_duplicate_username`, `test_register_endpoint_rejects_invalid_email`, `test_register_endpoint_rejects_password_mismatch`, `test_register_endpoint_requires_email`, `test_register_endpoint_respects_signup_trial_feature_flag`, `test_resend_verification_endpoint_uses_username_identifier`, `test_rvol_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_sector_breadth_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_stock_ai_advisory_component_clear_deleted_hard_deletes_deleted_records`, `test_stock_ai_advisory_component_delete_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_delete_returns_429_when_api_quota_exceeded`, `test_stock_ai_advisory_component_delete_soft_deletes_record`, `test_stock_ai_advisory_component_delete_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_component_refresh_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_refresh_returns_404_when_component_missing`, `test_stock_ai_advisory_component_refresh_returns_429_when_ai_regenerate_quota_exceeded`, `test_stock_ai_advisory_component_refresh_updates_only_target_component`, `test_stock_ai_advisory_component_refresh_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_component_restore_reactivates_record`, `test_stock_ai_advisory_component_restore_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_restore_returns_429_when_api_quota_exceeded`, `test_stock_ai_advisory_component_restore_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_component_toggle_include_flips_flag`, `test_stock_ai_advisory_component_toggle_include_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_toggle_include_returns_429_when_api_quota_exceeded`, `test_stock_ai_advisory_component_toggle_include_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_components_generate_accepts_chart_context_and_returns_usage_flags`, `test_stock_ai_advisory_components_generate_chart_context_oversize_points_sets_warning`, `test_stock_ai_advisory_components_generate_creates_component_records`, `test_stock_ai_advisory_components_generate_invalid_chart_context_sets_warning`, `test_stock_ai_advisory_components_generate_prefers_active_rsi_indicator_from_chart_context`, `test_stock_ai_advisory_components_generate_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_components_generate_returns_409_when_ai_api_not_configured`, `test_stock_ai_advisory_components_generate_returns_429_when_ai_regenerate_quota_exceeded`, `test_stock_ai_advisory_components_generate_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_components_generate_without_chart_context_has_no_warning`, `test_stock_ai_advisory_session_get_creates_sync_when_missing`, `test_stock_ai_advisory_session_get_is_not_blocked_by_api_quota`, `test_stock_ai_advisory_session_get_returns_409_when_ai_model_missing`, `test_stock_ai_advisory_session_get_returns_503_when_queue_unavailable`, `test_stock_ai_advisory_session_get_returns_latest_advisory`, `test_stock_ai_advisory_session_post_returns_429_when_refresh_cooldown_active`, `test_stock_ai_advisory_session_post_returns_503_when_queue_unavailable`, `test_stock_ai_advisory_session_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_session_returns_summary_history_desc_by_version`, `test_stock_ai_advisory_session_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_summary_delete_removes_selected_summary`, `test_stock_ai_advisory_summary_regenerate_creates_version`, `test_stock_ai_advisory_summary_regenerate_passes_synthesis_preference`, `test_stock_ai_advisory_summary_regenerate_prefers_ai_detailed_synthesis`, `test_stock_ai_advisory_summary_regenerate_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_summary_regenerate_returns_429_when_ai_regenerate_quota_exceeded`, `test_stock_ai_advisory_summary_regenerate_returns_429_when_cooldown_active`, `test_stock_ai_advisory_summary_regenerate_usage_tracking_calls_track_api_call`, `test_stock_management_groups_endpoint`, `test_stock_order_flow_returns_200_when_feature_enabled_for_pro_dpi_license`, `test_stock_order_flow_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_order_flow_returns_429_when_api_quota_exceeded`, `test_stock_order_flow_usage_tracking_calls_track_api_call`, `test_stock_workspace_chart_endpoint_rejects_invalid_days`, `test_stock_workspace_chart_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_stock_workspace_overview_and_chart_endpoints`, `test_stock_workspace_overview_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_stock_workspace_overview_fallback_when_base_builder_crashes`, `test_stock_workspace_overview_refactored_returns_502_on_unexpected_exception`, `test_stock_workspace_p0_role_matrix_allows_access_for_pro_premium_admin_trial_grace`, `test_stock_workspace_p0_role_matrix_blocks_expired_license`, `test_stock_workspace_p0_role_matrix_blocks_free_dpi_license`, `test_stock_workspace_p1_regression_matrix_matches_current_gating_policy`, `test_tracked_symbol_bulk_threshold_endpoint_updates_multiple_rows`, `test_tracked_symbol_bulk_threshold_endpoint_validates_ids`, `test_tracked_symbol_supports_per_symbol_threshold_create_and_patch`, `test_verify_email_endpoint_marks_user_as_verified`, `test_verify_email_endpoint_rejects_invalid_token`, `test_whale_advisory_auto_refresh_info_returns_no_advisory_for_tracked_symbol`, `test_whale_advisory_auto_refresh_info_returns_status_and_budget`, `test_whale_advisory_endpoint_can_filter_ready_for_refresh`, `test_whale_advisory_endpoint_masks_detail_for_pro`, `test_whale_advisory_endpoint_requires_pro`, `test_whale_advisory_endpoint_returns_detail_for_premium`, `test_whale_advisory_refresh_endpoint_queues_task_for_pro`, `test_whale_advisory_refresh_endpoint_queues_when_existing`, `test_whale_advisory_refresh_endpoint_returns_409_when_ai_api_key_missing`, `test_whale_advisory_refresh_endpoint_returns_409_when_ai_model_missing`, `test_whale_advisory_refresh_endpoint_returns_429_when_ai_regenerate_quota_exceeded`, `test_whale_advisory_refresh_endpoint_returns_429_when_manual_cooldown_active`, `test_whale_advisory_refresh_endpoint_returns_503_when_no_worker_and_sync_fallback_disabled`, `test_whale_advisory_refresh_endpoint_returns_business_403_for_community_plan`, `test_whale_advisory_refresh_endpoint_runs_sync_fallback_when_worker_unavailable`, `test_whale_advisory_refresh_endpoint_runs_sync_when_no_existing`, `test_whale_advisory_refresh_endpoint_uses_system_fallback_when_user_ai_missing`, `test_whale_advisory_severity_tag_returned_in_list`, `test_whale_advisory_watchlist_only_filter`, `test_whale_feed_aggregate_applies_per_symbol_threshold_override`, `test_whale_feed_aggregate_cursor_is_stable_for_matched_value_sort`, `test_whale_feed_aggregate_cursor_is_stable_for_ts_sort`, `test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements`, `test_whale_feed_aggregate_empty_symbols_returns_empty_payload`, `test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_whale_feed_aggregate_falls_back_to_vnstock_after_stream_and_db_miss`, `test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db`, `test_whale_feed_aggregate_rejects_invalid_limit_sort_and_cursor_sort_mismatch`, `test_whale_feed_aggregate_returns_429_when_api_quota_exceeded`, `test_whale_feed_aggregate_skips_vnstock_fallback_for_large_symbol_sets`, `test_whale_feed_aggregate_supports_scope_param_and_meta_payload`, `test_whale_feed_aggregate_supports_watchlist_filter`, `test_whale_feed_aggregate_symbols_are_deduplicated`, `test_whale_feed_cache_key_scopes_by_user_and_threshold`, `test_whale_feed_db_fallback_keeps_older_threshold_hits_beyond_latest_500_ticks`, `test_whale_feed_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_whale_feed_falls_back_to_intraday_tick_db_when_stream_and_vnstock_unavailable`, `test_whale_feed_falls_back_to_intraday_tick_db_when_stream_has_no_threshold_hits`, `test_whale_feed_response_contains_scoring_contract`

### `backend/portfolio/tests/test_backfill_starter_portfolios_command.py`

- Classes:
  - `BackfillStarterPortfoliosCommandTests` -> methods: `setUp`, `test_backfill_username_creates_starter_data`, `test_dry_run_does_not_create_data`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_email_verification_templates.py`

- Classes:
  - `EmailVerificationTemplateTests` -> methods: `test_send_verification_email_uses_rendered_templates`

### `backend/portfolio/tests/test_observability.py`

- Classes:
  - `AdminRuntimeKPITests` -> methods: `_authenticate`, `setUp`, `test_admin_runtime_kpi_advisory_merge_requires_staff`, `test_admin_runtime_kpi_advisory_merge_returns_structure`, `test_admin_runtime_kpi_anonymous_401`, `test_admin_runtime_kpi_requires_staff`, `test_admin_runtime_kpi_returns_snapshot_structure`
  - `MarketObservabilityTests` -> methods: `authenticate`, `setUp`, `test_market_observability_health_reports_http_p95`, `test_whale_feed_timeout_records_fallback_and_timeout`

### `backend/portfolio/tests/test_onboarding_trial_service.py`

- Classes:
  - `OnboardingTrialServiceTests` -> methods: `setUp`, `test_apply_onboarding_trial_for_new_user_sets_plan_and_log`, `test_process_expired_onboarding_trials_downgrades_eligible_users`, `test_process_expired_onboarding_trials_is_idempotent`, `test_process_expired_onboarding_trials_respects_lock_and_auto_downgrade`, `test_process_expired_onboarding_trials_task_wraps_service_result`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_openclaw_client.py`

- Classes:
  - `OpenClawClientTests` -> methods: `test_call_raises_clear_error_when_httpx_missing`, `test_generate_summary_returns_placeholder_without_httpx_import`

### `backend/portfolio/tests/test_opencore_lifecycle.py`

- Classes:
  - `OpenCoreLifecycleTransitionTests` -> methods: `setUp`, `test_expired_plan_returns_in_entitlements`, `test_grace_active_returns_in_entitlements`, `test_no_double_transition_grace_to_grace`, `test_task_handles_missing_user_config`, `test_task_returns_error_count`, `test_transition_grace_to_expired`, `test_transition_trial_to_grace`, `test_trial_active_returns_in_entitlements`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_order_flow.py`

- Classes:
  - `TestComputeCVDSeriesDB` -> methods: `setUp`, `test_bucket_has_required_keys`, `test_cumulative_cvd_accumulates`, `test_empty_symbol_returns_empty_list`, `test_returns_list`, `test_unknown_side_split_half`
  - `TestComputeTickRateDB` -> methods: `setUp`, `tearDown`, `test_result_is_cached`, `test_small_order_ratio_in_range`, `test_tick_rate_positive`, `test_unknown_symbol_returns_zero_rate`
  - `TestDetectAbsorption` -> methods: `_cvd_series`, `test_detected_when_price_locked_and_cvd_surges`, `test_empty_inputs_return_not_detected`, `test_insufficient_buckets_return_not_detected`, `test_price_locked_flag_when_price_stable`, `test_price_not_locked_when_price_moves`, `test_strength_in_range_0_100`
  - `TestDetectDarkFlow` -> methods: `_base_ticks`, `test_components_keys_present`, `test_confidence_high_when_strength_above_70`, `test_no_signal_when_no_ticks`, `test_result_has_required_keys`, `test_twap_bot_detected_when_high_tick_rate_and_small_orders`
  - `TestDetectIceberg` -> methods: `_make_ticks_at_price`, `test_confidence_low_medium_high`, `test_detected_at_min_repeat`, `test_empty_ticks_returns_not_detected`, `test_not_detected_when_fewer_than_min_repeat`, `test_ticks_outside_window_ignored`, `test_two_price_levels_picks_dominant`
  - `TestInternalHelpers` -> methods: `test_bucket_index`, `test_time_to_seconds`
  - `TestOrderFlowApi` -> methods: `setUp`, `test_order_flow_endpoint_requires_authentication`, `test_order_flow_endpoint_returns_payload`
  - `TestOrderFlowSignalTask` -> methods: `setUp`, `tearDown`, `test_task_honors_cooldown_lock`, `test_task_skips_when_disabled`, `test_task_stores_signal_when_strength_above_20`
  - `TestSizeDistribution` -> methods: `_ticks_with_values`, `test_empty_ticks_returns_safe_defaults`, `test_histogram_bucketing`, `test_p95_value`, `test_single_tick`, `test_small_ratio_correct`
- Functions:
  - `_make_tick`, `_t`

### `backend/portfolio/tests/test_prune_system_ai_audit_logs_command.py`

- Classes:
  - `PruneSystemAIAuditLogsCommandTests` -> methods: `_create_log_with_age_days`, `setUp`, `test_dry_run_does_not_delete_rows`, `test_prune_deletes_only_rows_older_than_cutoff`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_realtime_compute.py`

- Classes:
  - `RealtimeComputeTests` -> methods: `test_build_ticker_payload_computes_vwap`, `test_detect_whale_signals_emits_threshold_hits`

### `backend/portfolio/tests/test_realtime_gateway.py`

- Classes:
  - `RealtimeGatewayTests` -> methods: `setUp`, `test_stream_broadcaster_delivers_ticker_payload_shape`, `test_websocket_accepts_valid_token_and_subscribe`, `test_websocket_forwards_dark_flow_alert`, `test_websocket_masks_whale_advisory_detail_for_pro_plan`, `test_websocket_rejects_missing_token`

### `backend/portfolio/tests/test_screener_api.py`

- Classes:
  - `ScreenerAuthTests` -> methods: `setUp`, `test_authenticated_empty_list`, `test_unauthenticated_list`
  - `ScreenerCRUDTests` -> methods: `_valid_payload`, `setUp`, `test_create_empty_rules_json`, `test_create_invalid_field`, `test_create_invalid_op`, `test_create_non_numeric_value`, `test_create_valid_rule`, `test_delete_other_user_rule`, `test_delete_own_rule`, `test_get_other_user_rule`, `test_get_own_rule`, `test_update_rule`
  - `ScreenerRunTests` -> methods: `_make_rule`, `setUp`, `test_run_no_data`, `test_run_with_matching_data`, `test_run_with_no_match`
- Functions:
  - `get_token`
- Top-level variables:
  - `DETAIL_URL`, `LIST_URL`, `RUN_URL`

### `backend/portfolio/tests/test_seed_demo_data_whale_frontend.py`

- Classes:
  - `SeedDemoDataWhaleFrontendTests` -> methods: `test_seed_demo_data_populates_testuser_whale_frontend_data`

### `backend/portfolio/tests/test_seed_whale_mission_control_command.py`

- Classes:
  - `SeedWhaleMissionControlCommandTests` -> methods: `test_seed_command_populates_whale_mission_control_models`, `test_seed_command_reset_is_idempotent`

### `backend/portfolio/tests/test_starter_portfolio_service.py`

- Classes:
  - `StarterPortfolioServiceTests` -> methods: `setUp`, `test_existing_subaccount_is_not_overwritten`, `test_provision_creates_default_portfolios_and_subaccounts`, `test_provision_is_idempotent`, `test_should_provision_disabled_flag_returns_false`, `test_should_provision_respects_global_enabled_flag_and_canary`, `test_should_provision_zero_canary_returns_false`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_system_ai_admin_api.py`

- Classes:
  - `SystemAIAdminApiTests` -> methods: `setUp`, `test_admin_audit_logs_reject_invalid_datetime_filter`, `test_admin_audit_logs_reject_invalid_order`, `test_admin_can_filter_audit_logs_by_action`, `test_admin_can_filter_audit_logs_by_date_window`, `test_admin_can_get_system_ai_audit_logs`, `test_admin_can_order_audit_logs_ascending`, `test_admin_can_paginate_audit_logs`, `test_admin_can_test_system_ai_connection`, `test_admin_test_connection_returns_400_when_runtime_not_ready`, `test_get_returns_default_settings_for_admin`, `test_put_updates_system_ai_settings`, `test_requires_admin_permission`

### `backend/portfolio/tests/test_ticker_prefetch_task.py`

- Classes:
  - `PrefetchTickerPriceBoardNormalizationTests` -> methods: `setUp`, `test_prefetch_normalizes_vci_prices_to_vnd_before_caching`

### `backend/portfolio/tests/test_watch_sync.py`

- Classes:
  - `WatchAssetSyncTests` -> methods: `setUp`, `test_sync_watchlist_prices_collects_union_of_all_watch_sources`

### `backend/portfolio/tests/test_whale_advisory_task.py`

- Classes:
  - `WhaleAdvisoryTaskTests` -> methods: `_create_user_config`, `setUp`, `test_auto_generate_task_queues_missing_and_stale_tracked_symbols`, `test_auto_generate_task_respects_daily_auto_refresh_limit`, `test_auto_generation_skips_if_existing_advisory`, `test_compute_advisory_severity_thresholds`, `test_detect_whale_reversal_queues_reversal_advisory`, `test_flush_merged_event_passes_primary_and_sources`, `test_force_refresh_generates_new_advisory_even_if_existing`, `test_generate_task_persists_merge_metadata`, `test_merge_window_180s_schedules_single_flush_for_whale_and_dark_flow`, `test_periodic_job_uses_concise_mode_and_logs_tokens`, `test_task_generates_provider_aware_placeholder_when_staff_key_missing`, `test_task_persists_threshold_and_broadcast_metadata`, `test_task_sets_severity_based_on_value_threshold_ratio`, `test_task_skips_when_daily_auto_refresh_limit_exceeded`, `test_task_skips_when_daily_budget_exceeded`, `test_task_skips_when_user_has_no_ai_model`, `test_task_uses_env_api_key_when_staff_config_has_no_saved_key`

### `backend/portfolio/tests/test_whale_scoring.py`

- Classes:
  - `WhaleScoringTests` -> methods: `test_classify_severity_uses_band_contract`, `test_display_score_applies_time_decay_and_severity`, `test_event_score_is_deterministic_for_same_input`, `test_whale_payload_includes_scoring_contract_fields`

### `backend/portfolio/trading_service.py`

- Classes:
  - `TradingService` -> methods: `create_portfolio`, `create_sub_account`, `create_transaction`, `portfolio_queryset_for_user`, `sub_account_queryset_for_user`, `transaction_queryset_for_sub_account`, `transaction_queryset_for_user`

### `backend/portfolio/trading_views.py`

- Classes:
  - `PortfolioDetailView` -> methods: `get_queryset`
  - `PortfolioListCreateView` -> methods: `get_queryset`, `perform_create`
  - `SubAccountDetailView` -> methods: `get_queryset`
  - `SubAccountListCreateView` -> methods: `create`, `get_queryset`, `perform_create`
  - `TransactionDetailView` -> methods: `get_queryset`
  - `TransactionListCreateView` -> methods: `get_queryset`, `perform_create`

### `backend/portfolio/urls.py`

- Functions:
  - `_toggle_trading_view`
- Top-level variables:
  - `opencore_router`, `urlpatterns`

### `backend/portfolio/urls_admin_sync.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `backend/portfolio/urls_realtime.py`

- Functions:
  - `_toggle_market_view`
- Top-level variables:
  - `app_name`, `urlpatterns`

### `backend/portfolio/urls_stock.py`

- Functions:
  - `_toggle_market_view`
- Top-level variables:
  - `app_name`, `urlpatterns`

### `backend/portfolio/view_helpers.py`

- Functions:
  - `_build_group_response`, `_build_price_alert_rule_row`, `_price_alert_is_triggered`

### `backend/portfolio/views.py`

- Classes:
  - `AdminOpsStatsView` -> methods: `get`
  - `AllocationView` -> methods: `get`
  - `ChartDataView` -> methods: `get`
  - `DepthChartView` -> methods: `get`
  - `EquityCurveView` -> methods: `get`
  - `FinancialMetricsView` -> methods: `get`
  - `HoldingsView` -> methods: `get`
  - `IntradayMatchedView` -> methods: `get`
  - `PortfolioAnalyticsView` -> methods: `get`
  - `PortfolioDetailView` -> methods: `get_queryset`
  - `PortfolioListCreateView` -> methods: `get_queryset`, `perform_create`
  - `PriceAlertRuleDetailView` -> methods: `delete`, `get_object`, `patch`
  - `PriceAlertRuleListCreateView` -> methods: `get`, `post`
  - `PriceAlertRuleTriggerView` -> methods: `post`
  - `PriceBoardView` -> methods: `get`
  - `RealtimeTickerView` -> methods: `get`
  - `RVOLView` -> methods: `get`
  - `ScreenerRuleDetailView` -> methods: `_get_rule`, `delete`, `get`, `put`
  - `ScreenerRuleListCreateView` -> methods: `get`, `post`
  - `ScreenerRuleRunView` -> methods: `post`
  - `SectorBreadthView` -> methods: `get`
  - `SecuritiesGroupDetailView` -> methods: `delete`, `get_object`, `patch`
  - `SecuritiesGroupListCreateView` -> methods: `get`, `post`
  - `SecuritiesGroupListView` -> methods: `get_queryset`
  - `SecuritiesItemCreateView` -> methods: `post`
  - `SecuritiesItemDeleteView` -> methods: `delete`
  - `SecuritiesItemListView` -> methods: `get_queryset`
  - `SecuritiesSeedView` -> methods: `post`
  - `SecuritiesSyncView` -> methods: `post`
  - `StockProfileDetailView`
  - `StockProfileListView` -> methods: `get_queryset`
  - `StockWorkspaceChartView` -> methods: `get`
  - `StockWorkspaceOverviewView` -> methods: `get`
  - `SubAccountDetailView` -> methods: `get_queryset`
  - `SubAccountListCreateView` -> methods: `create`, `get_queryset`, `perform_create`
  - `SummaryView` -> methods: `get`
  - `SyncPricesView` -> methods: `post`
  - `TrackedSymbolBulkThresholdView` -> methods: `post`
  - `TrackedSymbolDeleteView` -> methods: `_build_row`, `delete`, `patch`
  - `TrackedSymbolListCreateView` -> methods: `_enrich`, `get`, `post`
  - `TransactionDetailView` -> methods: `get_queryset`
  - `TransactionListCreateView` -> methods: `get_queryset`, `perform_create`
  - `UserConfigView` -> methods: `get_object`
  - `WatchlistGroupDetailView` -> methods: `get_queryset`
  - `WatchlistGroupListCreateView` -> methods: `get_queryset`, `perform_create`
  - `WatchlistItemCreateView` -> methods: `perform_create`
  - `WatchlistItemDeleteView` -> methods: `get_queryset`
  - `WatchlistSeedView` -> methods: `post`
  - `WatchlistSyncView` -> methods: `post`
  - `WhaleAdvisoryListView` -> methods: `get_queryset`, `list`
  - `WhaleFeedAggregateView` -> methods: `get`
  - `WhaleFeedView` -> methods: `get`
- Functions:
  - `_enforce_opencore_feature_for_stock_endpoint`, `_enforce_opencore_quota_for_stock_endpoint`, `_get_ai_runtime_config_status`, `_is_celery_worker_available`, `_parse_tracked_symbol_threshold_million`, `_track_opencore_stock_endpoint_usage`, `admin_runtime_kpi_advisory_merge_api`, `admin_runtime_kpi_api`, `admin_system_ai_audit_logs_api`, `admin_system_ai_settings_api`, `admin_system_ai_test_connection_api`, `ai_config_api`, `ai_options_api`, `ai_test_connection_api`, `delete_current_whale_advisory_api`, `refresh_whale_advisory_api`, `stock_ai_advisory_component_clear_deleted_api`, `stock_ai_advisory_component_delete_api`, `stock_ai_advisory_component_refresh_api`, `stock_ai_advisory_component_restore_api`, `stock_ai_advisory_component_toggle_include_api`, `stock_ai_advisory_components_generate_api`, `stock_ai_advisory_session_api`, `stock_ai_advisory_summary_delete_api`, `stock_ai_advisory_summary_regenerate_api`, `stock_order_flow_api`, `sync_market_groups_api`, `sync_stockprofile_api`, `warm_ticker_prefetch_api`, `whale_advisory_auto_refresh_info_api`
- Top-level variables:
  - `_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS`, `_OPENCORE_STOCK_FEATURE_KEYS`, `logger`

### `backend/portfolio/vnstock_compat.py`

- Functions:
  - `disable_vnstock_upgrade_notice`, `patch_vnstock_finance_init`
- Top-level variables:
  - `logger`

### `backend/portfolio/whale_feed_helpers.py`

- Functions:
  - `_allow_vnstock_aggregate_fallback`, `_build_aggregate_event_payload`, `_build_aggregate_event_payload_from_record`, `_build_stream_aggregate_records`, `_build_tick_timestamp`, `_build_vnstock_aggregate_records`, `_build_whale_order_payload`, `_cache_get`, `_cache_set`, `_classify_signal_size`, `_dataframe_has_threshold_hits`, `_decode_whale_feed_cursor`, `_encode_whale_feed_cursor`, `_get_user_symbol_threshold_overrides_vnd`, `_get_user_whale_threshold_vnd`, `_is_rate_limited_error`, `_is_vnstock_rate_limited`, `_mark_vnstock_rate_limited`, `_normalize_aggregate_event_records`, `_normalize_signal_side`, `_parse_cursor_datetime`, `_parse_cursor_matched_value`, `_resolve_whale_feed_symbols`, `_vnstock_rate_limit_cache_key`
- Top-level variables:
  - `logger`

### `backend/portfolio/whale_scoring.py`

- Functions:
  - `_clamp`, `_normalize_weights`, `_safe_cache_get`, `calculate_display_score`, `calculate_event_score`, `classify_severity`, `resolve_whale_score_config`
- Top-level variables:
  - `_CACHE_KEY`, `_DEFAULT_SCORE_CONFIG`

### `backend/test_opencore.py`

- Top-level variables:
  - `available`, `can_whale`, `license`, `metrics`, `plans`

### `backend/test_opencore_api.py`

- Functions:
  - `make_request`
- Top-level variables:
  - `access_token`, `base_url`, `client`, `refresh`, `response`, `test_endpoints`

### `backend/test_opencore_visual.py`

- Functions:
  - `main`, `print_header`, `test_10_admin_access`, `test_1_dpi_plans`, `test_2_auto_license`, `test_3_feature_gating_free`, `test_4_tier_comparison`, `test_5_license_lifecycle`, `test_6_tier_upgrade`, `test_7_usage_metrics`, `test_8_api_weights`, `test_9_entitlements`

### `scripts/ops/generate_module_tree.py`

- Classes:
  - `ClassInfo`
  - `ModuleInfo`
- Functions:
  - `is_ignored`, `iter_source_files`, `main`, `module_has_symbols`, `parse_js_ts_module`, `parse_module`, `parse_python_module`, `pick_first_group`, `render_markdown`, `unique_sorted`
- Top-level variables:
  - `IGNORE_DIR_NAMES`, `IGNORE_PATH_PARTS`, `INCLUDE_DIRS`, `JS_ARROW_RE`, `JS_CLASS_RE`, `JS_EXTS`, `JS_FUNC_EXPR_RE`, `JS_FUNC_RE`, `JS_VAR_RE`, `OUTPUT`, `PY_EXTS`, `ROOT`, `VAR_NAME_RE`

## JS/TS Modules

### `frontend/postcss.config.js`

- No parseable top-level symbols found

### `frontend/src/api/auth.js`

- Functions:
  - `getUserConfig`, `login`, `refreshToken`, `register`, `resendVerification`, `updateUserConfig`, `verifyEmail`

### `frontend/src/api/client.js`

- Functions:
  - `addTrackedSymbol`, `addWatchlistItem`, `bulkUpdateTrackedSymbolThreshold`, `clearDeletedStockAIAdvisoryComponents`, `createPortfolio`, `createPriceAlert`, `createScreenerRule`, `createSubAccount`, `createTransaction`, `createWatchlistGroup`, `deleteCurrentWhaleAdvisory`, `deletePortfolio`, `deletePriceAlert`, `deleteScreenerRule`, `deleteStockAIAdvisoryComponent`, `deleteStockAIExecutiveSummary`, `deleteSubAccount`, `deleteTrackedSymbol`, `deleteTransaction`, `deleteWatchlistGroup`, `deleteWatchlistItem`, `fetchLegalPages`, `generateStockAIAdvisoryComponents`, `getAIConfig`, `getAIOptions`, `getAdminOpsStats`, `getAdminRuntimeKPI`, `getAdvisoryAutoRefreshInfo`, `getAggregateWhaleFeed`, `getAllocation`, `getAllocationBySector`, `getAnalytics`, `getChartData`, `getDepthChart`, `getEquityCurve`, `getHoldings`, `getIntradayMatched`, `getPortfolio`, `getPortfolioUserConfig`, `getPortfolios`, `getPriceAlerts`, `getPriceBoard`, `getRVOL`, `getRealtimeHealth`, `getRealtimeTicker`, `getRealtimeWebSocketUrl`, `getScreenerRules`, `getSectorBreadth`, `getSecuritiesGroups`, `getStockAIAdvisorySession`, `getStockFinancials`, `getStockOrderFlow`, `getStockPriceChart`, `getStockProfile`, `getStockWorkspaceOverview`, `getSubAccounts`, `getSummary`, `getTrackedSymbols`, `getTransactions`, `getWatchlistGroups`, `getWhaleAdvisories`, `getWhaleFeed`, `markPriceAlertTriggered`, `refreshAccessToken`, `refreshStockAIAdvisoryComponent`, `refreshStockAIAdvisorySession`, `refreshWhaleAdvisory`, `regenerateStockAIExecutiveSummary`, `restoreStockAIAdvisoryComponent`, `runScreenerRule`, `seedSecurities`, `seedWatchlist`, `syncMarketGroups`, `syncPrices`, `syncSecuritiesPrices`, `syncStockProfile`, `syncWatchlistPrices`, `testAIConnection`, `toggleStockAIAdvisoryComponentInclude`, `updateAIConfig`, `updatePortfolio`, `updatePortfolioUserConfig`, `updatePriceAlert`, `updateScreenerRule`, `updateSubAccount`, `updateTrackedSymbol`, `updateTransaction`, `updateWatchlistGroup`, `warmTickerPrefetch`
- Top-level variables:
  - `apiBaseURL`, `apiClient`, `customBase`, `getUserConfig`, `isDevFrontendPort`, `normalizedToken`, `originalRequest`, `params`, `protocol`, `publicApiClient`, `query`, `queryString`, `refreshToken`, `response`, `suffix`, `token`, `updateUserConfig`

### `frontend/src/App.jsx`

- Functions:
  - `LoginPage`, `ProtectedLayout`
- Top-level variables:
  - `navigate`

### `frontend/src/components/advisory/ActionChecklist.jsx`

- Functions:
  - `handleProceed`, `handleToggle`
- Top-level variables:
  - `DEFAULT_ITEMS`, `allChecked`, `resolvedItems`

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

### `frontend/src/components/AllocationPieChart.jsx`

- Functions:
  - `CustomLegend`, `CustomTooltip`, `formatVND`
- Top-level variables:
  - `COLORS`, `d`, `fetchAllocation`, `nameKey`, `res`

### `frontend/src/components/Can.jsx`

- Top-level variables:
  - `ability`

### `frontend/src/components/DashboardRealtimePanel.jsx`

- Functions:
  - `fmtBil`, `formatNumberSafe`, `loadSnapshotAlerts`, `severityTone`, `sizeClassEmoji`, `stats`, `toNumber`
- Top-level variables:
  - `avgCost`, `cancelled`, `combined`, `computedLiveMarketValue`, `costBasis`, `eventAgeSeconds`, `fallbackUnrealizedPL`, `id`, `impliedCostBasis`, `intervalId`, `isBig`, `isBuy`, `isDown`, `isEventStale`, `isUp`, `key`, `leftTs`, `liveMarketValue`, `livePrice`, `liveQuote`, `liveVsSnapshotDelta`, `marketStats`, `mergedAlerts`, `monitoredKey`, `parsed`, `quantity`, `quoteList`, `realtimeLabels`, `realtimePortfolioStats`, `response`, `rightTs`, `seen`, `severity`, `side`, `sizeClass`, `snapshotMarketValue`, `snapshotUnrealizedPL`, `statusClasses`, `unrealizedPL`, `v`

### `frontend/src/components/EmptyState.jsx`

- No parseable top-level symbols found

### `frontend/src/components/EquityVsBenchmarkChart.jsx`

- Functions:
  - `CustomTooltip`, `PctAxisTick`, `getPeriods`
- Top-level variables:
  - `fetchCurve`, `periods`, `res`

### `frontend/src/components/FinancialChart.jsx`

- No parseable top-level symbols found

### `frontend/src/components/HoldingsTable.jsx`

- Functions:
  - `PLCell`
- Top-level variables:
  - `color`, `displayValue`, `headers`, `num`, `sign`

### `frontend/src/components/Layout.jsx`

- Top-level variables:
  - `currentPlanLabel`, `loadLegal`, `navItems`, `pages`, `stockManagementItems`, `stockMgmtItems`, `toolItems`, `toolItemsSeed`

### `frontend/src/components/LoginModal.jsx`

- Functions:
  - `FacebookIcon`, `GoogleIcon`, `handleResendVerification`, `handleSubmit`, `normalizeErrorMessage`, `normalizeFieldErrors`, `switchMode`, `updateField`, `validateRegisterForm`
- Top-level variables:
  - `INITIAL_FORM`, `USERNAME_PATTERN`, `errorData`, `errors`, `firstEntry`, `identifier`, `isRegisterMode`, `loadLegalPages`, `pages`, `response`, `submitDisabled`, `trimmedEmail`, `trimmedUsername`, `validationErrors`

### `frontend/src/components/PortfolioAnalyticsPanel.jsx`

- Functions:
  - `MetricCard`, `fmt`, `getPeriodOptions`, `scoreColor`
- Top-level variables:
  - `fetchMetrics`, `noData`, `periodOptions`, `res`

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

### `frontend/src/components/RuntimeKPIPanel.jsx`

- Functions:
  - `KPIRow`, `StatusDot`, `fmtCount`, `fmtMs`, `fmtPct`, `toneFor5xx`, `toneForP95`
- Top-level variables:
  - `celery`, `fetchKPI`, `id`, `obs`, `overall`, `prefetch`, `res`, `toneClass`, `topEndpoints`

### `frontend/src/components/StatCard.jsx`

- Functions:
  - `formatVND`
- Top-level variables:
  - `displayValue`, `valueColor`

### `frontend/src/context/AbilityContext.js`

- Functions:
  - `createAbilityFromRules`, `useAbility`
- Top-level variables:
  - `AbilityContext`

### `frontend/src/context/LangContext.jsx`

- Functions:
  - `LangProvider`, `getInitialLocale`, `useI18n`
- Top-level variables:
  - `LANG_STORAGE_KEY`, `LangContext`, `context`, `localeTag`, `nextLocale`, `setLanguage`, `t`, `value`

### `frontend/src/context/PortfolioContext.jsx`

- Functions:
  - `PortfolioProvider`, `bootstrap`, `saveTokens`, `usePortfolio`
- Top-level variables:
  - `PortfolioContext`, `activeRefreshToken`, `authFailed`, `cancelled`, `createPortfolio`, `createSubAccount`, `ctx`, `deletePortfolio`, `deleteSubAccount`, `fetchPortfolios`, `initialAccessToken`, `initialRefreshToken`, `login`, `logout`, `next`, `nextRefresh`, `ok`, `refreshAccessToken`, `register`, `res`, `resendVerification`, `response`, `syncAuthState`, `updatePortfolio`, `updateSubAccount`, `updateUserConfig`

### `frontend/src/context/RealtimeContext.jsx`

- Functions:
  - `RealtimeProvider`, `alerts`, `createConsumerId`, `darkFlowAlerts`, `register`, `toSymbolsKey`, `toUniqueSymbols`, `unregister`, `update`, `useRealtimeFeedFromManager`
- Top-level variables:
  - `ENABLE_REALTIME_CONNECTION_MANAGER`, `RealtimeContext`, `aggregatedSymbols`, `baseFeed`, `consumerCount`, `consumerIdRef`, `contextValue`, `dedupSavedSymbols`, `feed`, `maxAlerts`, `next`, `normalizedSymbols`, `pollInterval`, `quotesBySymbol`, `requestedSymbolCount`, `symbolsKey`, `union`, `value`, `values`

### `frontend/src/hooks/useRealtimeFeed.js`

- Top-level variables:
  - `ENABLE_REALTIME_CONNECTION_MANAGER`, `legacyFeed`, `managedFeed`, `useManager`

### `frontend/src/hooks/useRealtimeFeedLegacy.js`

- Functions:
  - `cleanup`, `computeNextBackoffMs`, `computeReconnectDelayMs`, `connect`, `getHttpStatus`, `mergeQuote`, `normalizeAlert`, `normalizeDarkFlowAlert`, `nowIso`, `pickPollBatch`, `poll`, `readEventField`, `scheduleReconnect`, `sendAction`, `start`
- Top-level variables:
  - `POLL_BATCH_SIZE`, `applyAlert`, `applyDarkFlowAlert`, `applyTickerUpdate`, `base`, `batch`, `circuitOpenUntilRef`, `consecutiveFailuresRef`, `delayMs`, `destroyed`, `fallbackRatioPct`, `filtered`, `freshToken`, `had429`, `idx`, `initTimer`, `intervalId`, `jitter`, `latency`, `next`, `nextAlert`, `nextBackoffMs`, `nextKey`, `nextWs`, `normalizedAttempt`, `normalizedSymbols`, `ok`, `openUntilTs`, `payload`, `pollBackoffMsRef`, `pollBackoffUntilRef`, `pollCursorRef`, `pollIntervalRef`, `pollingTotal`, `quotes`, `realtimeStatusRef`, `reconnectAttemptRef`, `reconnectTimer`, `remaining`, `results`, `size`, `sorted`, `staleCount`, `staleRatioPct`, `start`, `startTimer`, `status`, `symbolsKey`, `symbolsRef`, `syms`, `token`, `uiRefreshP95Ms`, `ws`

### `frontend/src/hooks/useTrustTelemetry.js`

- Top-level variables:
  - `COUNTER_KEY`, `LOG_KEY`, `appendToLocalStorage`, `counters`, `currentCount`, `currentLog`, `detail`, `emit`, `nextLog`, `trackActionAttemptBlocked`, `trackActionChecklistCompleted`, `trackExplainabilityInsufficient`, `trackExplainabilityOpened`, `trackHistoryOpened`, `trackRiskModeChanged`

### `frontend/src/i18n/en.js`

- Top-level variables:
  - `en`

### `frontend/src/i18n/index.js`

- Functions:
  - `createTranslator`, `formatCurrency`, `formatDate`, `formatDateTime`, `formatNumber`, `formatPriceVND`, `formatQuoteInteger`, `formatQuotePrice`, `formatQuoteVolume`, `formatTime`, `getLocaleTag`, `getNestedValue`, `normalizeLocale`
- Top-level variables:
  - `DEFAULT_LOCALE`, `QUOTE_LOCALE_TAG`, `date`, `defaultValue`, `dictionaries`, `dictionary`, `fallbackDictionary`, `hasDefaultValue`, `localeTags`, `normalized`, `normalizedLocale`, `template`, `vnd`

### `frontend/src/i18n/vi.js`

- Top-level variables:
  - `vi`

### `frontend/src/index.js`

- Top-level variables:
  - `root`

### `frontend/src/pages/AdminOps.jsx`

- Functions:
  - `KeyValueRow`, `MiniMetric`, `Pill`, `PrefetchHealthBadge`, `RolloutStatusBadge`, `SignalBadge`, `StatCard`, `StatusBadge`, `SyncRow`, `fmtDateTime`, `fmtNumber`, `syncBtn`, `toneClasses`
- Top-level variables:
  - `alerts`, `anomaly`, `d`, `dashboard`, `handleSync`, `intervalId`, `load`, `navigate`, `normalized`, `prefetch`, `propagation`, `res`, `st`, `status`, `statusValue`, `tone`, `toneMap`, `tones`, `workerRows`, `workerSummary`

### `frontend/src/pages/Dashboard.jsx`

- Functions:
  - `handleSync`
- Top-level variables:
  - `cancelled`, `fetchData`, `holdingSymbols`, `liveHoldings`, `liveSummary`, `marketValue`, `monitoredSymbols`, `realizedPL`, `res`, `syncButtonLabel`, `total`, `trackedSymbolNames`, `unrealizedPL`, `unrealizedPLPctValue`, `unrealizedPLValue`

### `frontend/src/pages/PortfolioManagement.jsx`

- Functions:
  - `Badge`, `DeleteConfirmModal`, `PortfolioCard`, `PortfolioFormModal`, `SubAccountFormModal`, `SubAccountList`, `closeModal`, `getSubAccountTypeOptions`, `handleCreatePortfolio`, `handleCreateSA`, `handleDeletePortfolio`, `handleDeleteSA`, `handleSubmit`, `handleUpdatePortfolio`, `handleUpdateSA`, `saTypeColor`
- Top-level variables:
  - `CONFIRM_KEYWORD`, `isEdit`, `loadSubAccounts`, `map`, `match`, `mine`, `parsedMarginRatio`, `res`, `saCount`, `subAccountTypeOptions`, `trimmed`

### `frontend/src/pages/Screener.jsx`

- Functions:
  - `ConditionRow`, `ResultsTable`, `RuleEditor`, `addCond`, `deleteCond`, `fmtNum`, `handleDelete`, `handleRun`, `handleSave`, `update`, `updateCond`
- Top-level variables:
  - `EMPTY_COND`, `FIELD_OPTIONS`, `OP_OPTIONS`, `f`, `fKey`, `loadRules`, `op`, `opKey`, `res`

### `frontend/src/pages/StockDetail.jsx`

- Functions:
  - `BreadthMiniPanel`, `FinancialMetricsPanel`, `IntradayMatchedPanel`, `KLineChartComponent`, `MetricRow`, `OrderFlowPanel`, `PriceDepthPanel`, `advisoryActionLabel`, `advisoryRiskLabel`, `advisoryStatusLabel`, `advisorySynthesisPreferenceLabel`, `biasMeta`, `createIndicatorWithTracking`, `fetchChart`, `fetchOverview`, `fetchWatchlistGroups`, `findIndicatorPaneIds`, `fmtPrice`, `fmtVol`, `forgetIndicatorPane`, `formatChartAxis`, `formatCompactNumber`, `formatPercent`, `formatPercentDelta`, `handleAddToWatchlist`, `handleClearDeletedAdvisoryComponents`, `handleCreateAlert`, `handleDeleteAdvisoryComponent`, `handleDeleteExecutiveSummary`, `handleGenerateAdvisoryComponents`, `handleRefreshActiveAdvisoryComponent`, `handleRegenerateExecutiveSummary`, `handleRemoveFromWatchlist`, `handleRestoreAdvisoryComponent`, `handleScreenshot`, `handleTimeframe`, `handleToggleComponentInclude`, `handleToggleFullscreen`, `handleToggleIndicator`, `handleToggleTracked`, `onFullscreenChange`, `refreshWorkspace`, `rememberIndicatorPane`, `removeIndicatorFromAnySubPane`, `run`, `runRefresh`, `showWorkspaceMessage`
- Top-level variables:
  - `AVAILABLE_INDICATORS`, `MAIN_PANE_INDICATORS`, `SUB_PANE_CANDIDATES`, `TIMEFRAMES`, `activeAdvisoryComponent`, `activeIds`, `allIndicators`, `availableWatchlistGroups`, `avgVol`, `backoffUntilRef`, `buildChartContextPayload`, `buyCount`, `cancelled`, `cfg`, `cfgResp`, `changeClass`, `changePct`, `changeValue`, `chart`, `chartData`, `chartPerformance`, `chartRef`, `containerRef`, `contextUsage`, `currentPrice`, `currentSession`, `cvdSeries`, `darkFlow`, `debounceRef`, `deletedComponent`, `deletedCount`, `depth`, `display`, `downCount`, `dynamicPaneIds`, `emitVisibleRangeFromChart`, `fallbackFrom`, `fallbackFromTs`, `fallbackTo`, `fallbackToTs`, `fetchAdvisorySession`, `fetchData`, `fetchOrderFlow`, `fetchTrades`, `firstClose`, `flatCount`, `fromIndex`, `fromIndexRaw`, `fromTs`, `generationSource`, `id`, `image`, `inFlightRef`, `indicatorPaneMapRef`, `interval`, `isNextEnabled`, `kLineData`, `lastClose`, `lastVisibleRangeRef`, `latestSignal`, `latestVol`, `link`, `liveHighPrice`, `liveLowPrice`, `liveQuote`, `liveSignal`, `liveStrength`, `liveVolume`, `map`, `match`, `n`, `newState`, `next`, `nextComponents`, `nextDeletedComponents`, `nextFrom`, `nextSummaries`, `nextTo`, `nextWarnings`, `normalizedPoints`, `normalizedSymbol`, `now`, `numericValue`, `paneId`, `paneIds`, `paneIdsToTry`, `payload`, `peers`, `prevDarkFlowRef`, `prevVolumeRef`, `prevWhaleRef`, `ref`, `refreshWhaleFeed`, `refreshed`, `rememberedPaneId`, `removed`, `resp`, `response`, `restored`, `ro`, `row`, `seen`, `sellCount`, `sessionPayload`, `sessionResp`, `signals`, `sizeDistribution`, `smallOrderRatio`, `sourceGroupId`, `summary`, `symbolAlerts`, `symbolDarkFlowAlert`, `symbolWhaleAlert`, `targetPrice`, `technicalBias`, `technicalBiasFallback`, `tickRate`, `timer`, `toIndex`, `toIndexRaw`, `toTs`, `total`, `totalVol`, `ts`, `upCount`, `updated`, `visibleRange`, `vol`, `warningSuffix`, `years`

### `frontend/src/pages/Transactions.jsx`

- Functions:
  - `calcFee`, `cancelForm`, `formatUsDecimalInput`, `formatUsIntegerInput`, `handleChange`, `handleDelete`, `handleFeePresetChange`, `handleNumericBlur`, `handleRefresh`, `handleSubmit`, `handleVisibilityChange`, `isValidUsPriceInput`, `isValidUsQuantityInput`, `openCreate`, `openEdit`, `parseUsNumber`
- Top-level variables:
  - `ALL_TAB`, `EMPTY_FORM`, `FEE_PRESETS`, `FEE_PRESET_KEYS`, `MIN_FEE`, `SA_COLORS`, `TAX_SELL_RATE`, `TYPE_BG`, `US_PRICE_PATTERN`, `US_QUANTITY_PATTERN`, `VSD_RATE`, `activeSaName`, `brokerageFee`, `buyCount`, `count`, `data`, `dec`, `defaultSa`, `digits`, `displayTx`, `feeBreakdown`, `feePresetLabels`, `fetchSubAccounts`, `fetchTx`, `filtered`, `firstDot`, `intDigits`, `intFormatted`, `list`, `map`, `nextFieldErrors`, `normalized`, `normalizedSymbol`, `parsed`, `parsedPrice`, `parsedQuantity`, `payload`, `preset`, `priceParsed`, `qtyParsed`, `raw`, `res`, `results`, `sa`, `saColorMap`, `sanitized`, `sellCount`, `targets`, `taxFee`, `txValue`, `txs`, `typeLabels`, `vsdFee`

### `frontend/src/pages/Upgrade.jsx`

- Top-level variables:
  - `PLAN_DEFS`, `plans`

### `frontend/src/pages/VerifyEmail.jsx`

- Top-level variables:
  - `active`, `token`

### `frontend/src/pages/Watchlist.jsx`

- Functions:
  - `ChangeCell`, `PctCell`, `extractApiErrorMessage`, `formatPrice`, `handleAddAllTrackedFromGroup`, `handleAddTracked`, `handleAddTrackedFromGroup`, `handleBulkClearTrackedThreshold`, `handleBulkSetTrackedThreshold`, `handleCancelTrackedThresholdEdit`, `handleCreatePriceAlert`, `handleDeletePriceAlert`, `handleDeleteTracked`, `handleRemoveAllTrackedFromGroup`, `handleSaveTrackedThreshold`, `handleSeed`, `handleStartTrackedThresholdEdit`, `handleSync`, `handleSyncStockProfile`, `handleTogglePriceAlert`, `isPriceAlertMatched`, `mergeTickerIntoItem`, `safeDate`, `safeNumber`, `safeString`, `scoreDate`, `scoreNumber`, `scoreThreshold`, `severityTone`
- Top-level variables:
  - `activeDirection`, `activeGroup`, `activeGroupItems`, `activeGroupTrackedCount`, `activeGroupTrackedItems`, `activeGroupUntrackedCount`, `activeKey`, `allRealtimeSymbols`, `color`, `compare`, `cooldownMs`, `cooldownSeconds`, `currentPrice`, `downCount`, `dt`, `eventThresholdMillion`, `eventThresholdVnd`, `fetchGroups`, `fetchPriceAlerts`, `fetchTracked`, `filteredActiveGroupItems`, `filteredByDataActiveGroupItems`, `filteredByDataTrackedSymbolsWithRealtime`, `filteredTrackedSymbolsWithRealtime`, `firstField`, `getGroupSortIndicator`, `getTrackedSortIndicator`, `groupCurrentPage`, `groupStats`, `groupTotalPages`, `groupsWithRealtime`, `handleMarkPriceAlertTriggered`, `inCooldown`, `isActive`, `isDown`, `isUp`, `keyword`, `lastTriggeredAt`, `latestTriggeredPriceAlert`, `navigate`, `next`, `nextValue`, `normalized`, `normalizedCurrentPrice`, `normalizedPrev`, `normalizedSymbol`, `normalizedThreshold`, `now`, `openStockWorkspace`, `pagedActiveGroupItems`, `pagedTrackedSymbolsWithRealtime`, `parsed`, `parsedThreshold`, `payload`, `prevDir`, `prevKey`, `priceAlertConditionLabels`, `priceAlertsWithRealtime`, `realtimeLabels`, `res`, `rows`, `searchedActiveGroupItems`, `searchedTrackedSymbolsWithRealtime`, `sortedActiveGroupItems`, `sortedTrackedSymbolsWithRealtime`, `splitIndex`, `start`, `symbolsToAdd`, `targetPrice`, `targets`, `thresholdInUseMillion`, `thresholdValue`, `toggleGroupSort`, `toggleTrackedSort`, `trackedCurrentPage`, `trackedItem`, `trackedStats`, `trackedSymbolMap`, `trackedSymbolSet`, `trackedSymbolsWithRealtime`, `trackedTotalPages`, `trackedWithOverrideCount`, `trackedWithUserDefaultCount`, `triggeringAlertIdsRef`, `trimmed`, `typeLabels`, `upCount`, `updatedMap`, `updatedRows`, `useSymbolOverride`, `userThresholdMillion`

### `frontend/src/pages/WhaleAdvisory.jsx`

- Functions:
  - `AdvisoryCell`, `SymbolCell`, `TableRow`, `baselineMs`, `buildFallbackModelCatalog`, `buildSymbolStats`, `fetchAiSettings`, `fmtCompact`, `fmtCurrency`, `fmtTime`, `getFreshnessSeconds`, `getRealtimeStatusByFreshness`, `inferConfidence`, `safeDate`, `safeNumber`
- Top-level variables:
  - `ADVISORY_SCOPE`, `FALLBACK_MODELS`, `advisories`, `advisory`, `advisoryRows`, `aiCfgResp`, `avgValue`, `buyRatio`, `capabilities`, `cfg`, `cfgResp`, `confidence`, `currentMs`, `currentPage`, `done`, `ensureAiConfigured`, `entries`, `fetchData`, `fetchDataSnapshot`, `filtered`, `filteredItems`, `filteredRows`, `freshnessSeconds`, `handleDeleteCurrentAdvisory`, `handleLoadRefreshInfo`, `handleRefreshAdvisory`, `handleSaveAiConfig`, `handleSaveSchedule`, `handleTestAiConnection`, `hasAdvisory`, `hasSelectedAiModel`, `id`, `isActive`, `isBuy`, `keyword`, `latest`, `latestBySymbol`, `latestForSymbol`, `latestTs`, `map`, `matched`, `message`, `model`, `modelCatalog`, `modelOptionEntries`, `modelOptions`, `mounted`, `ms`, `n`, `next`, `optionsResp`, `pagedRows`, `parsed`, `payload`, `provider`, `providers`, `ready`, `realtimeStatus`, `resolvedSymbol`, `resp`, `rows`, `searchedRows`, `seen`, `side`, `sorted`, `sortedRows`, `start`, `stats`, `stored`, `summary`, `sym`, `symbol`, `symbolItems`, `symbolStatsMap`, `symbols`, `ta`, `tb`, `totalOrders`, `totalPages`, `tracked`, `trackedSymbolList`, `userCfg`, `userCfgResp`, `whaleAvgPrice`

### `frontend/src/pages/WhaleAlertsDashboard.jsx`

- Functions:
  - `AlertFeedCard`, `BubbleOrderChart`, `CustomBarShape`, `CustomBubble`, `DepthChartPanel`, `MoneyFlowDonut`, `OrderFlowRadarPanel`, `RVOLChartPanel`, `WhaleFeedPanel`, `bubbleData`, `fmtBil`, `fmtCompact`, `fmtPrice`, `fmtVol`, `formatFeedTime`, `formatPercentDelta`, `getFeedSourceMeta`, `maxSpike`, `run`, `severityTone`, `sideColor`, `sizeClassEmoji`, `symbolAlerts`
- Top-level variables:
  - `DONUT_COLORS`, `activeData`, `asks`, `bids`, `cancelled`, `chartData`, `count`, `cvdSeries`, `d`, `darkFlow`, `donutData`, `feedViewportStyle`, `fetch`, `fetchFeed`, `fetchOrderFlow`, `fill`, `flowNet`, `handleRefresh`, `id`, `interval`, `isBig`, `isBuy`, `isControlled`, `latestSignal`, `liveSignal`, `liveStrength`, `loading`, `n`, `netColor`, `normalizedSource`, `normalizedSymbol`, `numericValue`, `orders`, `parsed`, `points`, `prevCountRef`, `prevDarkFlowRef`, `prevWhaleRef`, `r`, `resp`, `response`, `severity`, `severityClass`, `signals`, `sizeDistribution`, `smallOrderRatio`, `sourceMeta`, `symbolDarkFlowAlert`, `symbolWhaleAlert`, `tickRate`, `totalValue`

### `frontend/src/pages/WhaleAlertsHub.jsx`

- Functions:
  - `AdvisoryPreviewCard`, `AggregateFeedCard`, `TrackedSymbolCard`, `buildSymbolStatsFromFeed`, `buildTrackedSymbolBuckets`, `formatCompactMoney`, `formatMoney`, `formatTime`, `getAggregateSourceMeta`, `getFrequencyLabel`, `getSeverityTone`, `getSideTone`, `getSizeClassLabel`
- Top-level variables:
  - `activeWatchlistGroup`, `activeWatchlistGroupId`, `aggregateSourceMeta`, `avgValue`, `buyRatio`, `canReadAdvisory`, `fetchData`, `freq`, `handleLoadMore`, `handleSortChange`, `isBuy`, `loadAggregateFeed`, `map`, `nextItems`, `normalizedSeverity`, `normalizedSide`, `normalizedSource`, `parsed`, `parsedId`, `payload`, `requests`, `response`, `scopeLabel`, `seen`, `severityTone`, `side`, `st`, `sym`, `symbol`, `symbolShortcuts`, `symbolStatsMap`, `tone`, `totalOrders`, `unique`, `watchlistGroupId`, `whaleAvgPrice`

### `frontend/src/setupProxy.js`

- No parseable top-level symbols found

### `frontend/src/utils/dashboardRealtimeSelectors.js`

- Functions:
  - `buildLiveHoldingsOverlay`, `buildLiveSummaryFromHoldings`, `toNumber`, `totals`
- Top-level variables:
  - `avgCost`, `costBasis`, `hasLivePrice`, `impliedCostBasis`, `liveMarketValue`, `livePrice`, `liveUnrealizedPL`, `liveUnrealizedPLPct`, `parsed`, `quantity`, `quote`, `snapshotMarketValue`

### `frontend/tailwind.config.js`

- No parseable top-level symbols found

### `mobile-app/App.tsx`

- No parseable top-level symbols found

### `mobile-app/index.ts`

- No parseable top-level symbols found

### `mobile-app/src/app/AppRoot.tsx`

- Functions:
  - `AppRoot`
- Top-level variables:
  - `bootstrap`, `isLoading`, `localeBootstrap`, `styles`, `user`

### `mobile-app/src/components/BottomTabBar.tsx`

- Functions:
  - `BottomTabBar`
- Top-level variables:
  - `TAB_DEFS`, `active`, `styles`, `t`

### `mobile-app/src/i18n/en.ts`

- Top-level variables:
  - `en`

### `mobile-app/src/i18n/index.ts`

- Functions:
  - `createTranslator`, `formatNumber`, `formatTime`, `getLocaleTag`
- Top-level variables:
  - `LOCALES`, `LOCALE_LABELS`, `LOCALE_TAGS`, `SUPPORTED_LOCALES`, `date`, `dict`, `node`, `parsed`, `parts`, `result`, `safeValue`

### `mobile-app/src/i18n/vi.ts`

- Top-level variables:
  - `vi`

### `mobile-app/src/screens/AuthScreen.tsx`

- Functions:
  - `AuthScreen`, `fillTestAccount`, `onSubmit`
- Top-level variables:
  - `clearMessages`, `errorMessage`, `hasDemoCredentials`, `infoMessage`, `isLoading`, `login`, `normalizedUsername`, `register`, `styles`, `submitLabel`, `success`, `t`

### `mobile-app/src/screens/DashboardScreen.tsx`

- Functions:
  - `DashboardScreen`
- Top-level variables:
  - `formatPct`, `formatVnd`, `isFirst`, `loadDashboard`, `locale`, `logout`, `num`, `onLogout`, `onOpenProfile`, `onOpenSettings`, `onToggleLanguage`, `parsed`, `plColor`, `portfolioId`, `portfolios`, `setLocale`, `styles`, `t`, `toNumber`, `topAllocation`, `topHoldings`, `user`

### `mobile-app/src/screens/HomeScreen.tsx`

- Functions:
  - `HomeScreen`
- Top-level variables:
  - `styles`

### `mobile-app/src/screens/ProfileScreen.tsx`

- Functions:
  - `ProfileScreen`
- Top-level variables:
  - `locale`, `logout`, `nextLocale`, `setLocale`, `styles`, `t`, `user`

### `mobile-app/src/screens/TransactionsScreen.tsx`

- Functions:
  - `TransactionsScreen`, `onDelete`, `onEdit`, `onPickSubAccount`, `onSubmit`, `pickSuggestion`, `resetForm`
- Top-level variables:
  - `TX_TYPES`, `accounts`, `active`, `activeSubAccount`, `bootstrap`, `day`, `debounceRef`, `defaultId`, `emptyForm`, `formatNumber`, `isValidSymbol`, `loadTransactions`, `locale`, `month`, `normalized`, `now`, `parsed`, `payload`, `raw`, `results`, `styles`, `symbol`, `t`, `toDecimal`, `todayString`, `txs`

### `mobile-app/src/screens/WatchlistScreen.tsx`

- Functions:
  - `WatchlistScreen`, `onAddSymbol`, `onDeleteSymbol`
- Top-level variables:
  - `bootstrap`, `clone`, `direction`, `flashDirection`, `flashTimeoutsRef`, `formatPct`, `loadData`, `nextPrev`, `nextValue`, `num`, `onRefresh`, `parsed`, `positive`, `prefix`, `prevChangePctRef`, `prevValue`, `styles`, `symbol`, `t`, `toNumber`

### `mobile-app/src/screens/WhaleScreen.tsx`

- Functions:
  - `WhaleScreen`, `initSocket`, `onRefreshAdvisory`
- Top-level variables:
  - `accessToken`, `active`, `bootstrap`, `cancelled`, `clearPolling`, `closeSocket`, `connectionText`, `date`, `deduped`, `eventType`, `exists`, `filteredAlerts`, `formatTime`, `formatVnd`, `id`, `isAppActive`, `loadData`, `loadWhaleSnapshot`, `locale`, `matchedValue`, `nextAlert`, `normalizeWhaleAlert`, `normalized`, `onRefresh`, `parsed`, `payload`, `pollingRef`, `response`, `result`, `selectedAdvisories`, `startPolling`, `styles`, `subscription`, `symbol`, `symbolRaw`, `t`, `toNumber`, `trackedSymbolCodes`, `ts`, `ws`, `wsRef`

### `mobile-app/src/services/authApi.ts`

- Functions:
  - `getMe`, `login`, `logout`, `register`, `restoreSession`
- Top-level variables:
  - `accessToken`, `response`

### `mobile-app/src/services/config.ts`

- Top-level variables:
  - `API_BASE_URL`, `API_PREFIX`, `DEMO_PASSWORD`, `DEMO_USERNAME`, `WS_BASE_URL`, `normalizeBaseUrl`, `trimmed`

### `mobile-app/src/services/http.ts`

- Functions:
  - `drainRefreshQueue`
- Top-level variables:
  - `accessToken`, `authClient`, `isRefreshing`, `newAccessToken`, `originalRequest`, `refreshQueue`, `refreshResponse`, `refreshToken`, `statusCode`

### `mobile-app/src/services/portfolioApi.ts`

- Functions:
  - `getAllocation`, `getHoldings`, `getPortfolios`, `getSummary`
- Top-level variables:
  - `response`

### `mobile-app/src/services/realtime.ts`

- Top-level variables:
  - `buildRealtimeWebSocketUrl`, `normalizeWsBase`, `trimmed`, `wsBase`

### `mobile-app/src/services/tokenStorage.ts`

- Functions:
  - `clearTokens`, `getAccessToken`, `getRefreshToken`, `saveAccessToken`, `saveRefreshToken`, `saveTokens`
- Top-level variables:
  - `ACCESS_TOKEN_KEY`, `REFRESH_TOKEN_KEY`

### `mobile-app/src/services/transactionApi.ts`

- Functions:
  - `createTransaction`, `deleteTransaction`, `getSubAccounts`, `getTransactions`, `searchStocks`, `updateTransaction`, `validateStockSymbol`
- Top-level variables:
  - `data`, `response`

### `mobile-app/src/services/watchlistApi.ts`

- Functions:
  - `addTrackedSymbol`, `deleteTrackedSymbol`, `getAggregateWhaleFeed`, `getTrackedSymbols`, `getWatchlistGroups`, `getWhaleAdvisories`, `refreshWhaleAdvisory`
- Top-level variables:
  - `query`, `response`, `search`

### `mobile-app/src/store/authStore.ts`

- Top-level variables:
  - `data`, `fallback`, `firstKey`, `firstValue`, `readApiError`, `result`, `useAuthStore`, `user`

### `mobile-app/src/store/localeStore.ts`

- Top-level variables:
  - `STORAGE_KEY`, `resolved`, `stored`, `useLocaleStore`

### `mobile-app/src/theme/colors.ts`

- Top-level variables:
  - `colors`

### `mobile-app/src/types/auth.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/portfolio.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/transaction.ts`

- No parseable top-level symbols found

### `mobile-app/src/types/watchlist.ts`

- No parseable top-level symbols found

## Update Workflow

1. After adding/changing functions/classes/variables, run:
   - `python scripts/ops/generate_module_tree.py`
2. Review `module_tree_full.md` diff.
3. Commit source changes and updated tree together.
