# VNInvest Module Tree (Auto-generated)

> Do not edit manually. Regenerate with `python scripts/ops/generate_module_tree.py`.

Generated at: `2026-05-12 07:54:10`

## Summary

- Total modules: 1038
- Python modules: 538
- JS/TS modules: 500
- Total classes: 862
- Total functions: 2855
- Total top-level variables: 4538

## Python Modules

### `backend/audit_whale_logic.py`

- Top-level variables:
  - `cutoff`, `symbol`, `whale_threshold_vnd`, `whale_ticks_qs`

### `backend/benchmark_api.py`

- Functions:
  - `bench_concurrent`, `bench_sequential`, `login`, `main`, `print_table`, `timed_get`
- Top-level variables:
  - `BASE_URL`, `CONCURRENCY`, `PASSWORD`, `ROUNDS`, `SEP`, `SYMBOLS`, `USERNAME`

### `backend/brain_check_digest.py`

- Functions:
  - `run_check`

### `backend/check_dpi_plans.py`

- Top-level variables:
  - `plans`

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
  - `_derive_cache_redis_url`, `_env_bool`, `_env_float`, `_env_int`, `_get_throttle_rate`, `_redis_url_with_db`
- Top-level variables:
  - `ADVISORY_AUTO_GENERATION_BATCH_SIZE`, `ADVISORY_AUTO_GENERATION_ENABLED`, `ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES`, `ALLOWED_HOSTS`, `ASGI_APPLICATION`, `AUTH_PASSWORD_VALIDATORS`, `BASE_DIR`, `CELERY_ACCEPT_CONTENT`, `CELERY_BEAT_SCHEDULE`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_RESULT_SERIALIZER`, `CELERY_TASK_SERIALIZER`, `CELERY_TIMEZONE`, `CHANNEL_LAYER_CAPACITY`, `CHANNEL_LAYER_EXPIRY`, `CHANNEL_LAYER_GROUP_EXPIRY`, `CHANNEL_LAYER_TICKER_CAPACITY`, `CORS_ALLOWED_ORIGINS`, `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`, `DB_ENGINE`, `DEBUG`, `DEFAULT_AUTO_FIELD`, `DEFAULT_FROM_EMAIL`, `EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS`, `ENABLE_NEW_MARKET_VIEWS`, `ENABLE_NEW_TRADING_VIEWS`, `ENABLE_REALTIME_CONNECTION_MANAGER`, `FEATURE_FLAGS`, `FRONTEND_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URI`, `HOLISTIC_ADVISORY_V1_COHORT_MODE`, `HOLISTIC_ADVISORY_V1_COHORT_USERNAMES`, `HOLISTIC_ADVISORY_V1_ENABLED`, `HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD`, `HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD`, `HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD`, `INSTALLED_APPS`, `INTRADAY_STALE_MAX_SECONDS_DEFAULT`, `INTRADAY_STALE_MAX_SECONDS_VN30`, `INTRADAY_TICK_KEEP_DAYS`, `LANGUAGE_CODE`, `LOGGING`, `MARKET_OBSERVABILITY_ENABLED`, `MARKET_OBSERVABILITY_LATENCY_WINDOW`, `MARKET_VIEWS_CANARY_PERCENT`, `MIDDLEWARE`, `MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND`, `MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO`, `MISSION_CONTROL_ANOMALY_BASELINE_MINUTES`, `MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES`, `MISSION_CONTROL_ANOMALY_MIN_ADVISORIES`, `MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS`, `MISSION_CONTROL_ANOMALY_MONITOR_ENABLED`, `MISSION_CONTROL_ANOMALY_MONITOR_INTERVAL_SECONDS`, `MISSION_CONTROL_ANOMALY_SPIKE_RATIO`, `MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT`, `MISSION_CONTROL_SCHEDULED_ROLLOUTS_ENABLED`, `MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS`, `OFFPEAK_VNSTOCK_INGEST_CRON_HOUR`, `OFFPEAK_VNSTOCK_INGEST_CRON_MINUTE`, `OFFPEAK_VNSTOCK_INGEST_DAYS`, `OFFPEAK_VNSTOCK_INGEST_ENABLED`, `OFFPEAK_VNSTOCK_INGEST_MAX_SYMBOLS`, `ONBOARDING_TRIAL_APPLY_ON_SIGNUP`, `ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE`, `ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED`, `ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES`, `OPENCLAW_API_KEY`, `OPENCLAW_BASE_URL`, `OPENCLAW_MODEL`, `OPEN_CORE_QUOTA_CAPS_BY_TIER`, `OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED`, `ORDER_FLOW_DETECTION_ENABLED`, `ORDER_FLOW_DETECTION_INTERVAL_SECONDS`, `PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS`, `PORTFOLIO_NEWS_DIGEST_BATCH_SIZE`, `PORTFOLIO_NEWS_DIGEST_ENABLED`, `REALTIME_BROADCAST_DEGRADE_BATCH_THRESHOLD`, `REALTIME_BROADCAST_DEGRADE_ENABLED`, `REALTIME_BROADCAST_DEGRADE_PENDING_THRESHOLD`, `REALTIME_BROADCAST_FORCE_INTERVAL_S`, `REALTIME_BROADCAST_MIN_CHANGE_PCT`, `REALTIME_CHANNEL_LAYER`, `REALTIME_DEFAULT_WHALE_THRESHOLD`, `REALTIME_ENABLED`, `REALTIME_INTRADAY_POLL_ENABLED`, `REALTIME_INTRADAY_POLL_SYMBOL_LIMIT`, `REALTIME_INTRADAY_SKIP_IF_PREFETCH_FRESH_ENABLED`, `REALTIME_INTRADAY_SKIP_IF_PREFETCH_FRESH_SECONDS`, `REALTIME_REDIS_URL`, `REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED`, `REALTIME_STREAM_PENDING_RECLAIM_ENABLED`, `REALTIME_TICKER_CACHE_ONLY`, `REALTIME_WS_AUTH_CACHE_ENABLED`, `REALTIME_WS_AUTH_CACHE_TTL_SECONDS`, `REALTIME_WS_PLAN_CACHE_ENABLED`, `REST_FRAMEWORK`, `REVERSAL_DETECTION_ENABLED`, `REVERSAL_DETECTION_INTERVAL_SECONDS`, `ROOT_URLCONF`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`, `SECURE_HSTS_SECONDS`, `SECURE_PROXY_SSL_HEADER`, `SECURE_SSL_REDIRECT`, `SENTIMENT_SYNC_ENABLED`, `SENTIMENT_SYNC_INTERVAL_MINUTES`, `SESSION_COOKIE_SECURE`, `SIGNAL_VERIFICATION_ENABLED`, `STARTER_PORTFOLIOS_CANARY_PERCENT`, `STARTER_PORTFOLIOS_ENABLED`, `STATIC_ROOT`, `STATIC_URL`, `STOCK_AI_ADVISORY_BENCHMARKS_ENABLED`, `STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE`, `STOCK_AI_ADVISORY_SESSION_V2_ENABLED`, `STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER`, `STOCK_PROFILE_SYNC_ENABLED`, `STREAM_BLOCK_MS`, `STREAM_CONSUMER_BATCH`, `STREAM_CONSUMER_INTERVAL`, `STREAM_MAX_LEN`, `STREAM_MAX_LEN_HARD_CAP`, `STREAM_PENDING_RECLAIM_BATCH`, `STREAM_PENDING_RECLAIM_IDLE_MS`, `STREAM_REDIS_URL`, `STREAM_SNAPSHOT_TTL`, `STREAM_STALE_AFTER_SECONDS`, `SYSTEM_EMAIL_FALLBACK_ENABLED`, `SYSTEM_EMAIL_FALLBACK_FROM_EMAIL`, `SYSTEM_EMAIL_FALLBACK_FROM_NAME`, `SYSTEM_EMAIL_FALLBACK_HOST`, `SYSTEM_EMAIL_FALLBACK_PASSWORD`, `SYSTEM_EMAIL_FALLBACK_PORT`, `SYSTEM_EMAIL_FALLBACK_REPLY_TO`, `SYSTEM_EMAIL_FALLBACK_TIMEOUT_SECONDS`, `SYSTEM_EMAIL_FALLBACK_USERNAME`, `SYSTEM_EMAIL_FALLBACK_USE_SSL`, `SYSTEM_EMAIL_FALLBACK_USE_TLS`, `TEMPLATES`, `TICKER_CACHE_MISS_ALLOW_DEGRADED`, `TICKER_CACHE_MISS_STATUS_CODE`, `TICKER_FRESHNESS_SECONDS`, `TICKER_PREFETCH_BATCH_SIZE_COLD`, `TICKER_PREFETCH_BATCH_SIZE_HOT`, `TICKER_PREFETCH_BATCH_SIZE_WARM`, `TICKER_PREFETCH_COLD_INTERVAL_SECONDS`, `TICKER_PREFETCH_COLD_SHARDS`, `TICKER_PREFETCH_EMERGENCY_DISABLE_COLD`, `TICKER_PREFETCH_EMERGENCY_INTERVAL_MULTIPLIER`, `TICKER_PREFETCH_EMERGENCY_OVERRIDE_ENABLED`, `TICKER_PREFETCH_HOT_INTERVAL_SECONDS`, `TICKER_PREFETCH_HOT_LIMIT`, `TICKER_PREFETCH_HOT_SHARDS`, `TICKER_PREFETCH_SHARD_SCHEDULER_ENABLED`, `TICKER_PREFETCH_WARM_INTERVAL_SECONDS`, `TICKER_PREFETCH_WARM_LIMIT`, `TICKER_PREFETCH_WARM_SHARDS`, `TICKER_STALE_SERVE_SECONDS`, `TICKER_UNIVERSE_REFRESH_SECONDS`, `TICKER_UNIVERSE_SYMBOL_LIMIT`, `TICKER_UPSTREAM_HARD_CAP_PER_MINUTE`, `TICKER_UPSTREAM_SOFT_CAP_PER_MINUTE`, `TICKER_UPSTREAM_WARNING_CAP_PER_MINUTE`, `TIME_ZONE`, `USE_I18N`, `USE_TZ`, `USE_X_FORWARDED_HOST`, `USE_X_FORWARDED_PORT`, `VNSTOCK_BOOTSTRAP_LOG_SUPPRESS_ENABLED`, `VNSTOCK_CLIENT_CACHE_ENABLED`, `VNSTOCK_CLIENT_CACHE_MAXSIZE`, `VNSTOCK_CLIENT_CACHE_TTL_SECONDS`, `VNSTOCK_PROVIDER_CACHE_ENABLED`, `VNSTOCK_PROVIDER_CACHE_TTL_SECONDS`, `WATCHLIST_INDICATORS_ENABLED`, `WATCHLIST_SYNC_DAYS`, `WATCHLIST_SYNC_ENABLED`, `WATCHLIST_SYNC_MINUTES`, `WHALE_ADVISORY_COOLDOWN_SECONDS`, `WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER`, `WHALE_ALERT_DETECTION_ENABLED`, `WHALE_ALERT_DETECTION_INTERVAL_SECONDS`, `WHALE_SCORE_PROFILE`, `WSGI_APPLICATION`, `X_FRAME_OPTIONS`, `_CACHE_REDIS_URL`, `_OPENCORE_ENABLED`, `_REALTIME_ENABLED_FLAG`, `_TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS`, `_secret_key_env`

### `backend/config/urls.py`

- Functions:
  - `api_root`
- Top-level variables:
  - `urlpatterns`

### `backend/config/wsgi.py`

- Top-level variables:
  - `application`

### `backend/core_pat_auth.py`

- Classes:
  - `LegacyCorePATAuthentication` -> methods: `authenticate`, `authenticate_header`
- Functions:
  - `_hash_pat_secret`, `_issue_pat_for_user`, `_resolve_user_from_pat`
- Top-level variables:
  - `User`, `_PAT_PREFIX`, `_PEPPER`, `_PREFIX_LEN`

### `backend/create_test_users.py`

- Top-level variables:
  - `TEST_PASSWORD`, `config_pro`, `ent_free`, `ent_pro`, `free_plan`, `license_free`, `license_pro`, `lifecycle_pro`, `pro_plan`, `user_free`, `user_pro`

### `backend/debug_dark_money.py`

- Top-level variables:
  - `cutoff`, `factory`, `raw_ticks`, `request`, `response`, `user`

### `backend/manage.py`

- Functions:
  - `main`

### `backend/portfolio/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/adapters/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/adapters/cache_adapter.py`

- Functions:
  - `get_cache`, `is_rate_limited_error`, `is_vnbroker_rate_limited`, `mark_vnbroker_rate_limited`, `set_cache`, `vnbroker_rate_limit_cache_key`

### `backend/portfolio/adapters/vnbroker_adapter.py`

- Functions:
  - `_apply_provider_quality_order`, `_attach_common_source_columns`, `_bootstrap_log_suppress_enabled`, `_build_stock_client`, `_client_cache_enabled`, `_client_cache_maxsize`, `_client_cache_ttl_seconds`, `_coerce_fundamental_snapshot_df`, `_coerce_insider_deals_df`, `_coerce_price_board_numeric_columns`, `_empty_schema_df`, `_ensure_quote_prices_canonical_thousand_vnd`, `_evict_vnbroker_cache_locked`, `_get_cached_stock_client`, `_get_gate`, `_get_runtime_settings`, `_get_vnbroker_provider`, `_import_vnbroker`, `_invalidate_stock_client_cache`, `_is_missing_data_key_error`, `_log_upstream_payload_warning`, `_normalize_intraday_dataframe`, `_normalize_period`, `_normalize_price_board_column`, `_normalize_price_board_dataframe`, `_normalize_source`, `_normalize_symbol`, `_now_epoch`, `_price_board_dataframe_is_parseable`, `_provider_cache_enabled`, `_provider_cache_ttl_seconds`, `_read_bool_env`, `_resolve_financial_ratio_sources`, `_resolve_float_env`, `_resolve_history_sources`, `_resolve_int_env`, `_resolve_intraday_sources`, `_resolve_listing_sources`, `_resolve_price_board_sources`, `_resolve_runtime_sources`, `_resolve_timeout`, `_run_with_timeout`, `_series_from_col`, `_to_dataframe`, `fetch_financial_ratio_dataframe`, `fetch_fundamental_snapshot_dataframe`, `fetch_heatmap_snapshot`, `fetch_history_dataframe`, `fetch_industry_benchmark_dataframe`, `fetch_industry_peers_dataframe`, `fetch_industry_rank_dataframe`, `fetch_insider_deals_dataframe`, `fetch_intraday_dataframe`, `fetch_listing_symbols_dataframe`, `fetch_price_board_dataframe`, `fetch_price_depth_dataframe`, `fetch_symbols_by_exchange_dataframe`, `fetch_symbols_by_group_series`, `fetch_symbols_by_industries_dataframe`, `read_stream_intraday_ticks`
- Top-level variables:
  - `_FUNDAMENTAL_SNAPSHOT_SCHEMA`, `_INSIDER_DEALS_SCHEMA`, `_KBS_FLAT_MAPPING`, `_PRICE_BOARD_FIELDS_BY_SECTION`, `_VNBROKER_CACHE_LOCK`, `_VNBROKER_GATE_BY_LIMIT`, `_VNBROKER_GATE_LOCK`, `_VNBROKER_PROVIDER_CACHE`, `_VNBROKER_STOCK_CLIENT_CACHE`, `logger`

### `backend/portfolio/admin.py`

- Classes:
  - `AccountSnapshotAdmin`
  - `AICommandCenterAuditLogAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`
  - `DailyPriceAdmin` -> methods: `workspace_link`
  - `DNSECredentialAdmin` -> methods: `api_key_configured_display`, `username_configured_display`
  - `GlobalScreenerRuleAdmin`
  - `IntradayTickAdmin`
  - `LegalPageAdmin` -> methods: `activate_selected_legal_page`, `has_add_permission`, `has_change_permission`, `has_delete_permission`, `save_model`
  - `MarketGroupSyncLogAdmin` -> methods: `duration_display`, `has_add_permission`, `has_change_permission`
  - `OnboardingPlanPolicyAdmin` -> methods: `activate_selected_policy`, `save_model`
  - `PlanAssignmentLogAdmin` -> methods: `has_add_permission`, `has_change_permission`
  - `PortfolioAdmin` -> methods: `subaccount_count`
  - `PriceAlertRuleAdmin`
  - `RuntimeVnbrokerConfigAdmin` -> methods: `has_add_permission`
  - `ScreenerRuleAdmin`
  - `ScreenerScheduleConfigAdmin`
  - `SecuritiesGroupAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `item_count`, `sync_shared_market_groups`, `sync_shared_market_groups_clear`
  - `SecuritiesItemAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `workspace_link`
  - `SecuritiesItemInline` -> methods: `has_add_permission`, `workspace_link`
  - `StockProfileAdmin` -> methods: `change_view`, `workspace_link`
  - `StockProfileSyncLogAdmin` -> methods: `duration_display`, `has_add_permission`, `has_change_permission`
  - `SubAccountAdmin`
  - `SystemAISettingsAdmin` -> methods: `_build_admin_snapshot`, `api_key_status`, `effective_model_display`, `mark_as_active`, `reset_prefetch_time_policy_to_default`, `save_model`, `test_connection_for_selected`
  - `SystemAISettingsAdminForm` -> methods: `__init__`, `clean_prefetch_runtime_settings_json`, `clean_prefetch_time_policy_json`, `save`
  - `SystemAISettingsAuditLogAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`
  - `SystemEmailAccountAdmin` -> methods: `get_urls`, `google_callback_view`, `google_client_secret_status`, `google_connect_view`, `google_refresh_token_status`, `google_revoke_view`, `mark_as_default`, `oauth_actions`, `password_status`, `send_test_email_to_selected_accounts`
  - `SystemEmailAccountAdminForm` -> methods: `clean`, `save`
  - `SystemSettingAdmin` -> methods: `description_short`, `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `save_model`
  - `TrackedSymbolAdmin` -> methods: `has_add_permission`
  - `TransactionAdmin` -> methods: `total_value_display`
  - `TransactionInline`
  - `UserAlertHistoryAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`
  - `UserConfigAdmin` -> methods: `change_view`, `get_urls`, `resend_verification_email_to_selected_users`, `resend_verification_view`, `save_model`, `verification_status`
  - `WatchlistGroupAdmin` -> methods: `item_count`
  - `WatchlistItemAdmin`
  - `WatchlistItemInline`
  - `WhaleAdvisoryAdmin` -> methods: `has_add_permission`, `has_view_permission`
  - `WhaleConfigApprovalAdmin` -> methods: `has_add_permission`, `has_change_permission`, `has_delete_permission`, `has_view_permission`, `save_model`
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
  - `_build_dark_flow_context_for_prompt`, `_build_fundamental_context_for_prompt`, `_build_market_context_for_prompt`, `_build_ownership_context_for_prompt`, `_build_sector_context_for_prompt`, `_build_technical_context_for_prompt`, `_build_whale_context_for_prompt`, `_compute_bollinger_snapshot`, `_compute_macd_series`, `_compute_rsi_series`, `_extract_prompt_sources`, `_fetch_live_price_anchor`, `_fetch_news_context_for_advisory`, `_format_billion`, `_format_dt_short`, `_format_price_level`, `_market_session_label`, `_parse_prompt_config`, `_resolve_price_scale_factor`, `_safe_float`, `_sanitize_for_prompt`, `_sprint17_build_component_templates`, `_sprint17_compute_summary_from_components`, `_sprint17_enforce_summary_narrative_policy`, `_sprint17_extract_json_block`, `_sprint17_generate_component_templates_with_ai`, `_sprint17_generate_executive_synthesis_with_ai`, `_sprint17_normalize_ai_component_payload`, `_sprint17_serialize_stock_advisory_session`, `_sprint17_suggested_action_from_status`, `_sprint29_get_enabled_indicators`, `_sprint29_pick_primary_indicator`, `_sprint29_render_chart_context_block`
- Top-level variables:
  - `VALID_TECHNICAL_INDICATORS`, `_PROMPT_CONFIG_DEFAULTS`, `_PROMPT_CONFIG_REGISTRY`, `_PROMPT_INJECT_PATTERNS`, `_SAFE_INDICATOR_RE`, `_SAFE_SYMBOL_RE`, `_SAFE_TIMEFRAME_RE`, `logger`

### `backend/portfolio/ai_context.py`

- Functions:
  - `_build_side_stats`, `_empty_side_stats`, `_to_float`, `build_symbol_ai_context`, `render_concise_context_for_prompt`, `render_context_for_prompt`

### `backend/portfolio/ai_options.py`

- Functions:
  - `_entry_supports`, `build_provider_model_map`, `get_advisory_provider_failover_chain`, `get_default_model`, `get_model_entries`, `get_model_entry`, `get_models_for_capability`, `is_model_allowed_for_capability`, `is_valid_model`, `is_valid_provider`
- Top-level variables:
  - `ADVISORY_CAPABILITY`, `ADVISORY_PROVIDER_FAILOVER_CHAIN_DEFAULTS`, `AVAILABLE_MODELS`, `DEFAULT_MODELS`, `MODEL_CATALOG`, `PROVIDER_CHOICES`

### `backend/portfolio/ai_prompt_config_ssot.py`

- Functions:
  - `_is_initialized_prompt_config`, `ensure_ai_prompt_config_ssot`, `mirror_ai_prompt_config_to_legacy`

### `backend/portfolio/ai_runtime_config.py`

- Functions:
  - `_build_not_ready_payload`, `_normalize_provider`, `_resolve_api_key`, `resolve_ai_runtime_config`

### `backend/portfolio/ai_service.py`

- Functions:
  - `_build_signal_prompt_intro`, `_call_provider_and_split`, `_claude_completion`, `_language_instruction`, `_openai_compatible_completion`, `_resolve_output_language`, `_resolve_provider_api_key`, `_split_digest_sections`, `generate_advisory_concise`, `generate_portfolio_digest`, `generate_whale_text`, `test_ai_connection`
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
  - `CapabilitySnapshotView` -> methods: `get`
  - `EmailDeliveryFailed`
  - `GoogleOAuthSerializer`
  - `GoogleOAuthView` -> methods: `_generate_username`, `post`
  - `PasswordResetConfirmSerializer` -> methods: `validate`
  - `PasswordResetConfirmView` -> methods: `post`
  - `PasswordResetRequestSerializer`
  - `PasswordResetRequestView` -> methods: `post`
  - `PATLoginView` -> methods: `post`
  - `PATTokenRefreshView` -> methods: `post`
  - `RegisterSerializer` -> methods: `create`, `validate`, `validate_email`, `validate_username`
  - `RegisterView` -> methods: `create`
  - `ResendVerificationEmailView` -> methods: `post`
  - `ResendVerificationSerializer`
  - `UserMeView` -> methods: `get`
  - `VerifyEmailSerializer`
  - `VerifyEmailView` -> methods: `post`
- Functions:
  - `_build_current_capability_snapshot`, `_request_ip`, `_resolve_auth_bootstrap_state`
- Top-level variables:
  - `logger`

### `backend/portfolio/authentication_partner.py`

- Classes:
  - `CorePartnerPATAuthentication` -> methods: `authenticate`, `authenticate_header`

### `backend/portfolio/baseline_cache_service.py`

- Classes:
  - `BaselineCacheService` -> methods: `__init__`, `fetch_symbol_baseline`, `get_adv_relative`, `get_cached_baseline`, `get_or_refresh_baseline`, `get_session_percentile`, `redis`, `refresh_symbol_baseline`, `set_cached_baseline`
- Functions:
  - `_get_redis_client`, `enrich_campaign_with_baseline`, `get_baseline_cache_service`
- Top-level variables:
  - `_BASELINE_CACHE_TTL`, `_BASELINE_ENABLED`, `_KEY_PREFIX`, `_service`, `logger`

### `backend/portfolio/baseline_service.py`

- Classes:
  - `BaselineService` -> methods: `__init__`, `calculate_abnormality_score`, `get_session_percentile`, `get_symbol_baseline`, `get_whale_symbol_summary`
- Top-level variables:
  - `logger`

### `backend/portfolio/consumers.py`

- Classes:
  - `RealtimeConsumer` -> methods: `_authenticate_user`, `_build_auth_snapshot`, `_cache_get`, `_cache_set`, `_get_query_token`, `_get_user_plan`, `_resolve_pat_user`, `_resolve_user_plan_for_connection`, `_subscribe_symbols`, `_unsubscribe_symbols`, `connect`, `dark_flow_alert`, `disconnect`, `heartbeat`, `market_discovery_event`, `news_digest`, `receive_json`, `screener_matched`, `ticker_update`, `whale_advisory`, `whale_alert`
  - `WSAuthPrincipal`
- Top-level variables:
  - `logger`

### `backend/portfolio/coobservation_service.py`

- Classes:
  - `CoObservationService` -> methods: `__init__`, `_apply_sort`, `_assess_conviction`, `_build_investigation_timeline`, `_build_timeline_groups`, `_correlate_campaigns_and_signals`, `_enrich_campaigns_with_correlations`, `_enrich_signals_with_correlations`, `_filter_campaigns_by_time`, `_get_dark_signals`, `_max_corr`, `_normalize_campaigns_for_investigation`, `_normalize_signals_for_investigation`, `_reverse_correlations`, `_to_dt`, `get_symbol_investigation`
  - `CorrelationOptimizer` -> methods: `calculate_confidence`
  - `TimeWindowResolver` -> methods: `get_bounds`
- Functions:
  - `get_symbol_investigation`

### `backend/portfolio/domain_constants.py`

- Functions:
  - `classify_whale_size_class`, `resolve_user_whale_threshold_vnd`
- Top-level variables:
  - `ORDER_FLOW_BUCKET_LT_200M_MAX_VND`, `ORDER_FLOW_BUCKET_LT_2B_MAX_VND`, `ORDER_FLOW_BUCKET_LT_500M_MAX_VND`, `ORDER_FLOW_BUCKET_LT_50M_MAX_VND`, `ORDER_FLOW_LARGE_ORDER_THRESHOLD_VND`, `ORDER_FLOW_PRICE_LOCK_THRESHOLD_PCT`, `ORDER_FLOW_SMALL_ORDER_THRESHOLD_VND`, `SHARK_THRESHOLD_VND`, `VND_PER_MILLION`, `WHALE_AGGREGATE_VNBROKER_MAX_SYMBOLS_DEFAULT`, `WHALE_ALERT_DEFAULT_THRESHOLD_MILLION`, `WHALE_ALERT_DEFAULT_THRESHOLD_VND`, `WHALE_CONFIG_VERSION`, `WHALE_SIZE_CLASS_SHARK_MIN_VND`, `WHALE_SIZE_CLASS_WHALE_MIN_VND`, `WHALE_THRESHOLD_VND`

### `backend/portfolio/email_verification.py`

- Functions:
  - `_verification_expiry_label`, `build_email_verification_url`, `generate_email_verification_token`, `resolve_email_verification_token`, `send_verification_email`
- Top-level variables:
  - `EMAIL_VERIFICATION_SALT`

### `backend/portfolio/encryption_utils.py`

- Functions:
  - `_build_fernet`, `decrypt_text`, `encrypt_text`, `hash_with_pepper`

### `backend/portfolio/exceptions.py`

- Classes:
  - `BusinessLogicRuleException`
  - `ExternalSystemException`
  - `MarketDataValidationException`
  - `PortfolioAppException` -> methods: `__init__`

### `backend/portfolio/global_signal_policy_helpers.py`

- Functions:
  - `_coerce_bool`, `_coerce_int`, `_coerce_positive_id_list`, `_coerce_retention_severity`, `_coerce_symbol_list`, `_read_json_setting`, `_write_json_setting`, `build_global_signal_control_center_ownership`, `coerce_global_signal_retention_policy`, `coerce_global_signal_services_config`, `coerce_global_signal_universe_policy`, `default_global_signal_retention_policy`, `default_global_signal_services_config`, `default_global_signal_universe_policy`, `get_global_signal_retention_policy`, `get_global_signal_services_config`, `get_global_signal_universe_policy`, `invalidate_global_signal_universe_cache`, `set_global_signal_retention_policy`, `set_global_signal_services_config`, `set_global_signal_universe_policy`
- Top-level variables:
  - `GLOBAL_SIGNAL_RETENTION_POLICY_KEY`, `GLOBAL_SIGNAL_SERVICES_CONFIG_KEY`, `GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY`, `logger`

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
  - `_build_env_fallback_email_account`, `_humanize_gmail_error`, `build_email_connection`, `build_sender_address`, `get_active_email_account`, `send_system_email`, `send_test_email`

### `backend/portfolio/management/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/management/commands/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/management/commands/backfill_intraday_tick_side.py`

- Classes:
  - `Command` -> methods: `_get_previous_close`, `_normalize_side`, `add_arguments`, `handle`

### `backend/portfolio/management/commands/backfill_starter_portfolios.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Top-level variables:
  - `User`

### `backend/portfolio/management/commands/create_default_subaccount.py`

- Classes:
  - `Command` -> methods: `handle`

### `backend/portfolio/management/commands/finalize_price_unit_migration.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/generate_advisory_baseline_report.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/initialize_dpi_plans.py`

- Classes:
  - `Command` -> methods: `handle`

### `backend/portfolio/management/commands/normalize_daily_prices.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Top-level variables:
  - `DIVISOR`, `PRICE_THRESHOLD`

### `backend/portfolio/management/commands/normalize_intraday_tick_price_unit.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/prune_system_ai_audit_logs.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/realtime_tick.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `backend/portfolio/management/commands/replay_advisory_trace.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`
- Functions:
  - `_matches_trace`, `_safe_int`

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
  - `Command` -> methods: `_resolve_demo_tick_datetimes`, `add_arguments`, `handle`

### `backend/portfolio/management/commands/seed_environment.py`

- Classes:
  - `Command` -> methods: `_build_command_plan`, `_log_execution`, `_resolve_actor`, `add_arguments`, `handle`
- Top-level variables:
  - `User`

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

### `backend/portfolio/management/commands/set_user_ai_token.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

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

### `backend/portfolio/market_calendar.py`

- Functions:
  - `is_market_closed_day`, `normalize_market_holiday_dates`, `previous_trading_day`, `resolve_default_market_holiday_dates`, `resolve_market_holiday_dates`, `resolve_market_local_date`, `resolve_market_local_now`, `resolve_market_phase`, `resolve_market_timezone`, `resolve_market_timezone_name`

### `backend/portfolio/market_data_service.py`

- Classes:
  - `MarketDataService` -> methods: `_allow_vnbroker_aggregate_fallback`, `_apply_campaign_cursor`, `_build_aggregate_event_payload`, `_build_aggregate_event_payload_from_record`, `_build_aggregate_record_response`, `_build_aggregate_response`, `_build_campaign_next_cursor`, `_build_canonical_whale_event_records`, `_build_empty_aggregate_response`, `_build_empty_whale_feed_response`, `_build_intraday_backoff_response`, `_build_intraday_db_fallback`, `_build_intraday_stale_payload`, `_build_market_top_tier_whale_unified`, `_build_next_cursor_from_db_row`, `_build_next_cursor_from_record`, `_build_price_status`, `_build_stock_workspace_overview_base`, `_build_stream_aggregate_records`, `_build_stream_trades`, `_build_tick_timestamp`, `_build_unified_alerts_next_cursor`, `_build_vnbroker_aggregate_records`, `_build_whale_order_payload`, `_classify_signal_size`, `_compute_rsi`, `_compute_stock_workspace_technical`, `_compute_unified_priority_rank`, `_dataframe_has_threshold_hits`, `_decode_campaign_cursor`, `_decode_unified_alerts_cursor`, `_decode_whale_feed_cursor`, `_decorate_intraday_response_contract`, `_encode_whale_feed_cursor`, `_format_time`, `_get_exchange_price_band`, `_get_market_clock_context`, `_get_user_symbol_threshold_overrides_vnd`, `_get_user_whale_threshold_vnd`, `_get_user_whale_threshold_with_source_vnd`, `_group_events_into_campaigns`, `_intraday_last_good_cache_key`, `_intraday_vn30_cache_key`, `_is_event_timestamp_in_window`, `_is_tick_row_in_window`, `_is_vn30_symbol`, `_log_mdsu`, `_normalize_aggregate_event_records`, `_normalize_chart_timeframe`, `_normalize_chart_timestamp`, `_normalize_historical_quote_price`, `_normalize_intraday_price_vnd`, `_normalize_quote_price`, `_normalize_side`, `_parse_aggregate_window`, `_parse_boolean_flag`, `_parse_campaign_limit`, `_parse_campaign_sort`, `_parse_cursor_datetime`, `_parse_cursor_matched_value`, `_parse_intraday_event_datetime`, `_parse_limit`, `_parse_sort`, `_parse_unified_severity_min`, `_price_map_from_ticker_cache`, `_record_source_observability`, `_redis_key`, `_resolve_campaign_gap_minutes`, `_resolve_chart_lookback_days`, `_resolve_intraday_dataframe_source_event_at`, `_resolve_intraday_stale_threshold_seconds`, `_resolve_intraday_stream_source_event_at`, `_resolve_latest_session_close`, `_resolve_quote_price_scale`, `_resolve_whale_feed_symbols`, `_row_float`, `_safe_float`, `_safe_int`, `_safe_parse_unified_alert_ts`, `_safe_round`, `_sanitize_unified_alert_item`, `_select_preferred_intraday_fallback`, `_technical_bias_meta`, `_to_float`, `_to_intraday_event_iso`, `_unified_severity_rank`, `_window_start_datetime`, `get_depth_chart`, `get_financial_metrics`, `get_historical_indicators`, `get_intraday_matched`, `get_latest_snapshot`, `get_ohlcv_batch`, `get_price_board`, `get_realtime_ticker`, `get_realtime_tickers`, `get_rvol`, `get_sector_breadth`, `get_stock_workspace_chart`, `get_stock_workspace_overview`, `get_unified_alerts`, `get_universe_symbols`, `get_whale_campaigns`, `get_whale_feed`, `get_whale_feed_aggregate`, `normalize_page_size`, `normalize_symbol`
- Top-level variables:
  - `ONDEMAND_TICKER_LOCK_PREFIX`, `PREFETCH_ENQUEUE_LOCK_KEY`, `logger`, `market_data_service`

### `backend/portfolio/market_views.py`

- Classes:
  - `BaseMarketDataView` -> methods: `handle_exception_response`, `validate_query`
  - `BatchRealtimeTickerView` -> methods: `get`
  - `DepthChartView` -> methods: `get`
  - `FinancialMetricsView` -> methods: `get`
  - `IntradayMatchedView` -> methods: `get`
  - `PriceBoardView` -> methods: `get`
  - `RealtimeTickerView` -> methods: `get`
  - `RVOLView` -> methods: `get`
  - `SectorBreadthView` -> methods: `get`
  - `StockWorkspaceChartView` -> methods: `get`
  - `StockWorkspaceOverviewView` -> methods: `get`
  - `UnifiedAlertsView` -> methods: `get`
  - `WhaleCampaignsView` -> methods: `get`
  - `WhaleFeedAggregateView` -> methods: `get`
  - `WhaleFeedView` -> methods: `get`

### `backend/portfolio/middleware.py`

- Classes:
  - `MarketObservabilityMiddleware` -> methods: `__call__`, `__init__`
- Top-level variables:
  - `logger`

### `backend/portfolio/models.py`

- Classes:
  - `AccountSnapshot` -> methods: `__str__`, `nav`
  - `AdvisoryAggregateAuditLog` -> methods: `__str__`
  - `AdvisoryAggregateSnapshot` -> methods: `__str__`
  - `AdvisoryTokenLog` -> methods: `__str__`
  - `AIAdvisoryComponentRecord` -> methods: `__str__`
  - `AIAdvisoryExecutiveSummary` -> methods: `__str__`
  - `AICommandCenterAuditLog` -> methods: `__str__`
  - `AICommandCenterConfig` -> methods: `__str__`, `ai_api_key_configured`, `clean`, `get_ai_api_key`, `get_effective_ai_model`, `set_ai_api_key`
  - `CorePATCredential` -> methods: `__str__`, `clean`, `effective_status`, `issue_for_service_account`, `resolve_from_raw_secret`, `revoke`, `rotate`, `save`, `tenant_id`
  - `CoreServiceAccount` -> methods: `__str__`, `clean`, `save`, `tenant_id`
  - `CoreTenant` -> methods: `__str__`, `_normalize_tenant_code`, `ensure_for_user`, `tenant_id`
  - `CrawlAuditLog` -> methods: `__str__`
  - `CrawlJob` -> methods: `__str__`
  - `CrawlRun` -> methods: `__str__`
  - `CrawlSchedule` -> methods: `__str__`
  - `DailyPrice` -> methods: `__str__`
  - `DNSECredential` -> methods: `__str__`, `get_password`, `get_username`, `set_password`, `set_username`
  - `IntradayTick` -> methods: `__str__`
  - `LegalPage` -> methods: `__str__`
  - `MarketGroupSyncLog` -> methods: `__str__`
  - `MoneyFlowForensicWindow` -> methods: `__str__`
  - `NewsSourceWeight` -> methods: `__str__`
  - `OnboardingPlanPolicy` -> methods: `__str__`, `clean`
  - `OrderFlowSignal` -> methods: `__str__`
  - `PlanAssignmentLog` -> methods: `__str__`
  - `Portfolio` -> methods: `__str__`
  - `PortfolioNewsDigest` -> methods: `__str__`
  - `PriceAlertRule` -> methods: `__str__`
  - `RuntimeVnbrokerConfig` -> methods: `__str__`, `append_changelog`, `clean`, `default_fallback_sources`, `default_source_config`, `default_timeout_config`, `get_or_create_singleton`, `to_runtime_dict`
  - `ScreenerRule` -> methods: `__str__`
  - `SecuritiesGroup` -> methods: `__str__`
  - `SecuritiesItem` -> methods: `__str__`
  - `SeedExecutionLog` -> methods: `__str__`
  - `SentimentLog` -> methods: `__str__`
  - `SignalServiceRun` -> methods: `__str__`
  - `SignalVerification` -> methods: `__str__`
  - `StockProfile` -> methods: `__str__`
  - `StockProfileSyncLog` -> methods: `__str__`
  - `SubAccount` -> methods: `__str__`
  - `SystemAISettings` -> methods: `__str__`, `ai_api_key_configured`, `clean`, `get_active`, `get_ai_api_key`, `get_effective_ai_model`, `save`, `set_ai_api_key`
  - `SystemAISettingsAuditLog` -> methods: `__str__`
  - `SystemEmailAccount` -> methods: `__str__`, `clean`, `clear_google_refresh_token`, `get_google_client_secret`, `get_google_refresh_token`, `get_smtp_password`, `has_google_refresh_token`, `save`, `set_google_client_secret`, `set_google_refresh_token`, `set_smtp_password`
  - `SystemSetting` -> methods: `__str__`
  - `TelegramProfile` -> methods: `__str__`, `is_muted`
  - `TickerSessionClose` -> methods: `__str__`
  - `TrackedSymbol` -> methods: `__str__`
  - `Transaction` -> methods: `__str__`, `total_value`
  - `UserConfig` -> methods: `__str__`, `ai_api_key_configured`, `get_ai_api_key`, `get_effective_ai_model`, `set_ai_api_key`
  - `UserPlanLifecycle` -> methods: `__str__`
  - `WatchlistGroup` -> methods: `__str__`
  - `WatchlistItem` -> methods: `__str__`
  - `WhaleAdvisory` -> methods: `__str__`
  - `WhaleAlertEvent` -> methods: `__str__`
  - `WhaleConfigApproval` -> methods: `__str__`, `clean`, `save`
  - `WhaleConfigAuditLog` -> methods: `__str__`
  - `WhaleConfigDraft` -> methods: `__str__`
  - `WhaleConfigRollout` -> methods: `__str__`
  - `WhaleConfigVersion` -> methods: `__str__`
  - `WhaleConfigWorkerAck` -> methods: `__str__`
- Functions:
  - `_build_pat_secret`, `_extract_pat_prefix`, `_generate_public_id`, `_hash_pat_secret`
- Top-level variables:
  - `SecuritiesGroupAlias`, `SecuritiesItemAlias`

### `backend/portfolio/models_alert_history.py`

- Classes:
  - `UserAlertHistory` -> methods: `__str__`

### `backend/portfolio/models_screener_admin.py`

- Classes:
  - `GlobalScreenerRule` -> methods: `__str__`
  - `ScreenerScheduleConfig` -> methods: `__str__`

### `backend/portfolio/observability.py`

- Functions:
  - `_build_intraday_freshness_summary_from_counters`, `_build_whale_pipeline_health_summary_from_counters`, `_coerce_freshness_seconds`, `_ensure_http_endpoint`, `_latency_window_size`, `_metrics_enabled`, `_percentile`, `advisory_phase_timer`, `end_advisory_phase`, `end_advisory_session`, `generate_advisory_baseline_report`, `get_market_observability_snapshot`, `get_whale_pipeline_health_summary`, `record_advisory_actionability`, `record_advisory_component`, `record_advisory_confidence`, `record_advisory_error_recovery`, `record_advisory_merge_observation`, `record_advisory_token_usage`, `record_ai_chart_context_observation`, `record_intraday_freshness_observation`, `record_market_external_timeout`, `record_market_fallback`, `record_market_http_observation`, `record_symbol_engagement_event`, `record_whale_dedup_observation`, `record_whale_event_observation`, `reset_advisory_session`, `reset_market_observability`, `start_advisory_phase`, `start_advisory_session`
- Top-level variables:
  - `_ADVISORY_MERGE_STATS`, `_ADVISORY_SESSION_METRICS`, `_AI_CHART_CONTEXT_STATS`, `_FALLBACK_COUNTS`, `_HTTP_STATS`, `_INTRADAY_FRESHNESS_STATS`, `_LOCK`, `_STARTED_AT_EPOCH`, `_SYMBOL_ENGAGEMENT_STATS`, `_TIMEOUT_COUNTS`, `_WHALE_PIPELINE_STATS`, `_advisory_logger`

### `backend/portfolio/onboarding_trial_service.py`

- Classes:
  - `TrialApplyResult`
- Functions:
  - `_create_plan_assignment_log`, `apply_onboarding_trial_for_new_user`, `get_active_onboarding_policy`, `process_expired_onboarding_trials`
- Top-level variables:
  - `logger`

### `backend/portfolio/openclaw_client.py`

- Functions:
  - `_call`, `_language_instruction`, `generate_whale_concise`, `generate_whale_deep`, `generate_whale_summary`
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
- Top-level variables:
  - `logger`

### `backend/portfolio/opencore_premium.py`

- Classes:
  - `PremiumFeatureGate` -> methods: `_get_user_plan`, `can_calculate_indicator`, `can_use_feature`, `get_api_weight`, `get_available_indicators`, `get_indicator`, `mask_symbol`
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
- Top-level variables:
  - `logger`

### `backend/portfolio/order_flow.py`

- Functions:
  - `_bucket_index`, `_build_dark_flow_anomaly_markers`, `_build_dark_flow_bucket_facts`, `_build_dark_flow_session_summary`, `_fetch_ticks`, `_now_time`, `_seconds_to_time`, `_time_to_seconds`, `_today`, `compute_cvd_series`, `compute_size_distribution`, `compute_tick_rate`, `detect_absorption`, `detect_dark_flow`, `detect_iceberg_clustering`
- Top-level variables:
  - `DEFAULT_BUCKET_SECONDS`, `DEFAULT_WINDOW_MINUTES`, `LARGE_ORDER_THRESHOLD`, `PRICE_LOCK_THRESHOLD_PCT`, `SMALL_ORDER_THRESHOLD`, `TICK_RATE_CACHE_TTL`

### `backend/portfolio/order_flow_history.py`

- Functions:
  - `_detect_dark_flow_from_ticks`, `compute_dark_flow_for_trade_date`
- Top-level variables:
  - `logger`

### `backend/portfolio/partner_tenant_context.py`

- Classes:
  - `PartnerTenantContext`
- Functions:
  - `resolve_partner_tenant_context`

### `backend/portfolio/password_reset.py`

- Functions:
  - `_password_reset_expiry_label`, `build_password_reset_url`, `generate_password_reset_token`, `resolve_password_reset_token`, `send_password_reset_email`
- Top-level variables:
  - `PASSWORD_RESET_SALT`

### `backend/portfolio/permissions.py`

- Classes:
  - `IsAdminPlan` -> methods: `has_permission`
  - `IsBasicPlan` -> methods: `has_permission`
  - `IsPremiumPlan` -> methods: `has_permission`
  - `IsProPlan` -> methods: `has_permission`
- Functions:
  - `_get_plan`, `_is_operator_user`, `_resolve_quota_caps`, `_resolve_tier`, `_resolve_trial_state`, `build_abilities`, `has_plan`, `resolve_user_entitlements`
- Top-level variables:
  - `ADMIN_CONSOLE_ABILITIES`, `DEFAULT_QUOTA_CAPS_BY_TIER`, `PLAN_ORDER`, `PLAN_TIER_MAP`

### `backend/portfolio/price_units.py`

- Classes:
  - `MoneyValue` -> methods: `__post_init__`, `__str__`
  - `PriceSource`
  - `QuotePrice` -> methods: `__post_init__`, `__str__`, `to_vnd_for_calculation`
- Functions:
  - `detect_quote_unit_heuristic`, `get_quote_price_in_vnd`, `normalize_money_value_to_canonical`, `normalize_quote_price_to_canonical`, `validate_quote_prices_canonical`
- Top-level variables:
  - `MONEY_UNIT_CANONICAL`, `QUOTE_UNIT_CANONICAL`, `VALID_MONEY_UNITS`, `VALID_QUOTE_UNITS`, `logger`

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
  - `_build_explainability`, `_build_whale_event_id`, `_classify_signal_size`, `_derive_freshness_bucket`, `_derive_source_layer`, `_get_indicator_cache`, `_iso_now`, `_normalize_signal_side`, `_normalize_whale_timestamp`, `build_heartbeat_payload`, `build_ticker_payload`, `build_ticker_payload_native`, `build_whale_payload`, `compute_vwap`, `detect_whale_signals`

### `backend/portfolio/realtime/publisher.py`

- Classes:
  - `RealtimePublisher` -> methods: `__init__`, `_channel_to_group`, `next_seq`, `publish`
- Top-level variables:
  - `logger`

### `backend/portfolio/realtime/redis_pool.py`

- Functions:
  - `get_stream_client`, `get_stream_pool`
- Top-level variables:
  - `_stream_pool`

### `backend/portfolio/realtime/stream_consumers.py`

- Classes:
  - `AlertEngineConsumer` -> methods: `process_batch`
  - `DbWriterConsumer` -> methods: `_parse_stream_timestamp`, `process_batch`
  - `TickConsumerBase` -> methods: `__init__`, `_claim_stale_pending`, `_observe_pending_depth`, `client`, `process_batch`, `run_once`, `stream_key`
  - `WsBroadcastConsumer` -> methods: `__init__`, `_degrade_mode_enabled`, `_should_skip_broadcast`, `process_batch`
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

### `backend/portfolio/runtime_policy_helpers.py`

- Functions:
  - `_coerce_governance_delta_thresholds`, `_coerce_prefetch_runtime_settings`, `_coerce_prefetch_time_policy`, `_default_governance_delta_thresholds`, `_default_prefetch_runtime_settings`, `_default_prefetch_time_policy`, `_get_runtime_governance_delta_thresholds`, `_get_runtime_prefetch_settings`, `_get_runtime_prefetch_time_policy`, `_prefetch_time_policy_rulebook`, `_set_runtime_governance_delta_thresholds`, `_set_runtime_prefetch_settings`, `_set_runtime_prefetch_time_policy`
- Top-level variables:
  - `HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY`, `PREFETCH_RUNTIME_SETTINGS_CACHE_KEY`, `PREFETCH_TIME_POLICY_CACHE_KEY`, `_get_prefetch_runtime_settings`

### `backend/portfolio/screener_helpers.py`

- Functions:
  - `_apply_screener_condition`, `_screener_build_technical`, `_validate_screener_rules`
- Top-level variables:
  - `_SCREENER_ALLOWED_FIELDS`, `_SCREENER_ALLOWED_OPS`, `_SCREENER_NEEDS_HISTORY_FIELDS`

### `backend/portfolio/seed_governance.py`

- Functions:
  - `assert_demo_seed_allowed`, `is_demo_seed_allowed_by_env`, `runtime_environment_name`

### `backend/portfolio/serializers.py`

- Classes:
  - `AIAdvisoryComponentRecordSerializer`
  - `AIAdvisoryExecutiveSummarySerializer`
  - `AICommandCenterConfigSerializer` -> methods: `update`, `validate`, `validate_ai_prompt_config`, `validate_ai_provider`
  - `ChartPointSerializer`
  - `CrawlAuditLogSerializer`
  - `CrawlJobSerializer`
  - `CrawlRunSerializer`
  - `CrawlScheduleSerializer`
  - `DailyPriceSerializer`
  - `DNSECredentialSerializer` -> methods: `get_api_key_configured`, `get_username_configured`
  - `HoldingSerializer`
  - `LegalPageSerializer`
  - `MarketIntradayQuerySerializer`
  - `MarketStockChartQuerySerializer`
  - `PortfolioSerializer` -> methods: `get_subaccount_count`, `get_transaction_count`
  - `PriceAlertRuleSerializer` -> methods: `validate_cooldown_seconds`, `validate_symbol`
  - `RuntimeVnbrokerConfigSerializer` -> methods: `validate`, `validate_fallback_sources`, `validate_price_board_source`, `validate_source_config`, `validate_timeout_config`
  - `ScreenerRuleSerializer`
  - `SecuritiesGroupCreateSerializer`
  - `SecuritiesGroupDetailSerializer`
  - `SecuritiesItemSerializer` -> methods: `validate_symbol`
  - `SignalServiceRunSerializer`
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
  - `TransactionSerializer` -> methods: `create`, `validate`, `validate_symbol`
  - `UserConfigSerializer` -> methods: `validate_advisory_max_auto_refreshes_per_day`, `validate_whale_alert_threshold`
  - `WatchlistGroupSerializer` -> methods: `get_items`
  - `WatchlistItemSerializer` -> methods: `validate_symbol`
  - `WatchlistItemWithPriceSerializer`
  - `WhaleAdvisorySerializer` -> methods: `get_symbol`

### `backend/portfolio/services.py`

- Classes:
  - `WhaleSignalEngine` -> methods: `annotate_queryset_with_threshold`, `calculate_whale_intensity`, `classify_side`, `classify_size`, `get_user_threshold_map`, `is_symbol_discovery_candidate`, `resolve_discovery_bucket`, `resolve_threshold_vnd`
- Functions:
  - `_active_whale_config_json`, `_apply_price_scale`, `_coerce_float`, `_coerce_int`, `_extract_first`, `_fetch_exchange_lookup`, `_format_preview_value`, `_infer_price_unit_from_first_close`, `_normalise_ohlcv`, `_normalize_maxrss_to_mb`, `_normalize_symbol_list`, `_ping_redis_url`, `_resolve_price_scale_to_system_unit`, `_resolve_vnbroker_price_unit`, `_serialize_whale_config_rollout`, `_serialize_whale_config_version`, `_stable_symbol_percent`, `_to_decimal`, `_to_int`, `activate_due_scheduled_whale_config_rollouts`, `activate_whale_config_version`, `apply_market_group_payload`, `auto_revert_whale_config_rollout`, `build_market_group_payload`, `build_rollout_propagation_snapshot`, `build_stock_profile_payload`, `build_whale_config_diff_preview`, `build_whale_config_runtime_preview`, `build_whale_rollout_anomaly_snapshot`, `build_whale_runtime_score_config`, `build_whale_runtime_thresholds`, `check_whale_config_dependencies`, `ensure_rollout_worker_ack_records`, `fetch_and_save_daily_prices`, `fetch_market_sectors_and_groups`, `find_previous_stable_whale_config_version`, `get_active_runtime_rollout_for_symbol`, `get_active_whale_config_version`, `get_latest_price`, `get_latest_rollout_for_version`, `get_latest_whale_config_anomaly_overview`, `get_live_celery_worker_names`, `get_live_celery_worker_summary`, `get_manual_market_group_payload`, `get_price_changes`, `get_price_series`, `get_whale_advisory_alert_overview`, `get_whale_config_dashboard_overview`, `get_whale_config_propagation_overview`, `initialize_whale_config_rollout`, `monitor_whale_config_rollout_anomalies`, `normalize_whale_config_payload`, `notify_whale_config_auto_revert`, `record_whale_config_worker_ack`, `refresh_rollout_propagation_status`, `resolve_rollout_target_symbols`, `resolve_whale_runtime_config`, `symbol_matches_canary_scope`, `sync_market_groups`, `sync_market_groups_for_user`, `sync_market_groups_for_users`, `sync_portfolio_prices`, `sync_stock_profiles`, `sync_watchlist_prices`, `validate_whale_config_guardrails`
- Top-level variables:
  - `_CAP_GROUP_DEFS`, `_MANUAL_MARKET_GROUPS`, `_SECTOR_COLORS`, `_SYSTEM_MONEY_UNIT`, `_SYSTEM_PRICE_UNIT`, `_vnbroker_PRICE_UNIT_THOUSAND`, `_vnbroker_PRICE_UNIT_VND`, `logger`

### `backend/portfolio/services_backfill.py`

- Functions:
  - `_build_queryset`, `_get_previous_close`, `_infer_side_for_rows`, `_normalize_side`, `intraday_side_backfill_apply`, `intraday_side_backfill_preview`

### `backend/portfolio/services_global_screener.py`

- Classes:
  - `GlobalScreenerService` -> methods: `_build_flow_enrichment_map`, `_coerce_snapshot_date`, `_empty_dark_flow_summary`, `_empty_whale_summary`, `_matched_value_from_price_volume`, `_summarize_dark_flow_signals`, `_summarize_whale_ticks`, `match_active_rules`, `precompute_market_snapshot`

### `backend/portfolio/services_global_signal_distribution.py`

- Functions:
  - `deliver_dark_flow_signal`, `deliver_whale_alert_event`, `resolve_signal_audience`

### `backend/portfolio/services_global_signal_universe.py`

- Classes:
  - `GlobalSignalUniverseResolver` -> methods: `_coerce_group_ids`, `_coerce_symbols`, `_normalize_config`, `_tier_shards`, `build_snapshot`, `from_prefetch_runtime_settings`, `load_system_policy`
- Functions:
  - `_build_symbol_count_map`, `_compute_heat_score`, `_normalized_symbol_set`, `_stable_shard_id`

### `backend/portfolio/services_global_whale_alerts.py`

- Functions:
  - `_build_intraday_db_frame`, `_build_stream_frame`, `_build_vnbroker_frame`, `_build_whale_payloads_for_symbol`, `_cache_latest_whale_alert_event`, `_coerce_occurred_at`, `_confidence_from_payload`, `_latest_whale_alert_event_cache_key`, `_normalize_candidate_frame`, `_resolve_global_whale_runtime_settings`, `_resolve_global_whale_symbols`, `build_whale_alert_event_id`, `persist_whale_alert_event`, `run_global_whale_alert_detection`
- Top-level variables:
  - `GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX`, `REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY`

### `backend/portfolio/services_money_flow_retention.py`

- Functions:
  - `_cached_heavy_count`, `_collect_forensic_tick_rows`, `_latest_completed_retention_preview_run`, `_normalize_forensic_timestamp`, `_normalize_retention_policy`, `_preview_run_finished_at`, `_severity_rank`, `build_money_flow_retention_preview`, `build_retention_safety_gate`, `build_selective_forensic_window_preview`, `can_run_money_flow_retention_purge`, `materialize_money_flow_forensic_window`, `materialize_money_flow_forensic_window_from_order_flow_signal`, `materialize_money_flow_forensic_window_from_whale_event`, `purge_expired_money_flow_forensic_windows`, `should_materialize_money_flow_forensic_window`
- Top-level variables:
  - `RETENTION_PREVIEW_FRESHNESS_SECONDS`, `SEVERITY_ORDER`

### `backend/portfolio/services_realtime_adapter.py`

- Functions:
  - `dataframe_has_threshold_hits`, `fetch_financial_ratio_dataframe`, `fetch_intraday_dataframe`, `fetch_price_board_dataframe`, `normalize_symbol`, `resolve_user_whale_threshold_vnd`
- Top-level variables:
  - `logger`

### `backend/portfolio/services_realtime_cache.py`

- Functions:
  - `_cache_get`, `_cache_set`, `_clear_vnbroker_rate_limit`, `_is_vnbroker_rate_limited`, `_mark_vnbroker_rate_limited`
- Top-level variables:
  - `logger`, `vnbroker_RATE_LIMIT_CACHE_PREFIX`, `vnbroker_TIMEOUT_COUNTER_KEY`

### `backend/portfolio/services_realtime_metrics.py`

- Functions:
  - `_metric_cache_key`, `build_prometheus_metrics_text`, `build_realtime_metrics_snapshot`, `get_realtime_metric`, `get_realtime_metrics_summary`, `increment_realtime_metric`, `reset_realtime_metrics_for_test`, `set_realtime_metric`
- Top-level variables:
  - `REALTIME_BASE_METRICS`, `REALTIME_ENDPOINTS`, `REALTIME_ENDPOINT_METRICS`, `REALTIME_METRICS_CACHE_PREFIX`, `REALTIME_STREAM_COUNTER_METRICS`, `REALTIME_STREAM_GAUGE_METRICS`, `REALTIME_STREAM_GROUPS`, `logger`

### `backend/portfolio/services_service_control.py`

- Classes:
  - `TokenSafeLock` -> methods: `__init__`, `release`
- Functions:
  - `_lock_key`, `acquire_job_lock`, `force_release_job_lock`, `release_job_lock`
- Top-level variables:
  - `_LOCK_TTL`, `_REDIS_CLIENT`

### `backend/portfolio/services_signal_run_registry.py`

- Functions:
  - `create_signal_service_run`, `finish_signal_service_run`, `resolve_signal_run_status`, `resolve_signal_run_type`, `start_signal_service_run`

### `backend/portfolio/services_symbol_engagement.py`

- Functions:
  - `activate_symbol_engagement`, `is_intraday_fresh`
- Top-level variables:
  - `logger`

### `backend/portfolio/services_whale_analytics_snapshot.py`

- Functions:
  - `_build_bucket_fact_rows`, `_build_bucket_facts_cache_key`, `_build_bucket_facts_payload`, `_build_flow_compare_series`, `_build_flow_series`, `_build_heatmap_series`, `_build_marker_series`, `_build_percentile_baseline_cache_key`, `_build_percentile_baseline_samples`, `_build_session_summary`, `_build_whale_analytics_cache_revision_key`, `_bump_whale_analytics_cache_revision`, `_calculate_whale_event_score`, `_clamp`, `_combine_dt`, `_compute_percentile_baseline_samples`, `_confidence_label`, `_confidence_score`, `_current_vn_now`, `_effective_session_now`, `_empty_percentile_baseline_samples`, `_floor_bucket`, `_get_or_build_bucket_facts`, `_index_series_by_bucket`, `_latest_trade_date`, `_matched_value_from_price_volume`, `_normalize_tick_side`, `_parse_trade_date`, `_percentile_rank`, `_percentile_value`, `_resolve_bucket_facts_cache_timeout`, `_resolve_degraded_state`, `_resolve_quality_state`, `_resolve_reference_price`, `_resolve_session_levels`, `_resolve_whale_analytics_cache_revision`, `_resolve_window`, `_session_segments`, `_sigmoid`, `_subtract_trading_minutes`, `_to_iso`, `build_snapshot_etag`, `build_whale_analytics_snapshot`, `invalidate_whale_analytics_snapshot_cache`
- Top-level variables:
  - `AFTERNOON_START`, `BUCKET_MINUTES`, `KLINE_INTELLIGENCE_CONTRACT_VERSION`, `MARKET_CLOSE`, `MARKET_OPEN`, `MORNING_END`, `PERCENTILE_BASELINE_CACHE_TIMEOUT_SECONDS`, `PERCENTILE_BASELINE_LOCK_TIMEOUT_SECONDS`, `SHARED_BUCKET_FACTS_CACHE_KEY_VERSION`, `SHARED_BUCKET_FACTS_CACHE_TIMEOUT_SECONDS`, `SHARED_BUCKET_FACTS_LOCK_TIMEOUT_SECONDS`, `SNAPSHOT_CACHE_KEY_VERSION`, `VN_TZ`, `WHALE_ANALYTICS_CACHE_REVISION_KEY_PREFIX`, `WHALE_ANALYTICS_CACHE_REVISION_TTL_SECONDS`, `WINDOW_MINUTES`

### `backend/portfolio/signals.py`

- Functions:
  - `invalidate_global_signal_universe_on_source_change`, `invalidate_holdings_cache_on_transaction`, `invalidate_runtime_vnbroker_cache_on_save`, `trigger_telegram_whale_alert`

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

### `backend/portfolio/system_settings.py`

- Functions:
  - `_cache_key`, `ensure_defaults`, `get_setting`, `get_system_timezone`, `get_zoneinfo`, `set_setting`
- Top-level variables:
  - `DEFAULT_TIMEZONE`, `_CACHE_PREFIX`, `_CACHE_TTL`, `logger`

### `backend/portfolio/tasks.py`

- Functions:
  - `create_next_month_partition`, `warmup_realtime_ticker_cache`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_advisory_helpers.py`

- Functions:
  - `_accumulate_user_advisory_event`, `_advisory_audit_actor_for_source`, `_advisory_audit_reason_for_source`, `_advisory_event_merge_cache_key`, `_build_advisory_aggregate_state_payload`, `_classify_provider_failure`, `_compute_advisory_severity`, `_compute_dark_flow_severity`, `_compute_event_side_score`, `_detect_reversal_signal`, `_estimate_advisory_actionability`, `_estimate_advisory_confidence`, `_get_auto_generation_count_today`, `_get_remaining_advisory_budget`, `_get_remaining_auto_refreshes`, `_get_tokens_used_today`, `_increment_daily_counter`, `_infer_dark_flow_direction`, `_is_failover_eligible_failure`, `_is_language_mismatch`, `_mark_provider_ratelimit`, `_normalize_advisory_source`, `_normalize_symbol`, `_persist_advisory_aggregate_snapshot`, `_persist_advisory_metrics_audit_log`, `_record_failover_event`, `_record_provider_attempt`, `_resolve_advisory_threshold_vnd`, `_resolve_model_for_budget`, `_resolve_next_refresh_at`, `_resolve_side_by_dynamic_score`, `_safe_float`, `_should_use_concise_advisory`, `_token_log_source_for_advisory_source`
- Top-level variables:
  - `ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX`, `_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS`, `_VI_DIACRITIC_PATTERN`, `logger`

### `backend/portfolio/tasks_crawl.py`

- Functions:
  - `_get_mapped_task`, `run_crawl_job`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_dnse.py`

- Functions:
  - `reconcile_all_dnse_transactions_task`, `reconcile_dnse_transactions_task`, `sync_all_dnse_balances_task`, `sync_dnse_accounts_task`, `sync_dnse_balances_task`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_global_screener.py`

- Functions:
  - `run_global_screener_manual_task`, `run_global_screener_scheduled_task`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_lifecycle.py`

- Functions:
  - `process_expired_onboarding_trials_task`, `process_plan_lifecycle_transitions`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_maintenance.py`

- Functions:
  - `cleanup_old_intraday_ticks`, `cleanup_old_signal_service_runs`, `get_intraday_side_backfill_task_status`, `intraday_side_backfill_status_cache_key`, `run_intraday_side_backfill_apply`, `run_stream_consumer_batch`, `run_vnbroker_price_board_benchmark`, `set_intraday_side_backfill_task_status`, `trim_streams`
- Top-level variables:
  - `INTRADAY_SIDE_BACKFILL_STATUS_CACHE_PREFIX`, `INTRADAY_SIDE_BACKFILL_STATUS_TTL_SECONDS`, `logger`

### `backend/portfolio/tasks_news_context.py`

- Functions:
  - `_fetch_google_news_rss`, `_fetch_news_context_for_advisory`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_news_digest.py`

- Functions:
  - `_generate_news_digest_for_user`, `generate_all_portfolio_news_digests_task`, `generate_stock_news_ai_summary_task`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_order_flow.py`

- Functions:
  - `_cache_latest_order_flow_signal`, `_classify_order_flow_signal_severity`, `_latest_order_flow_signal_cache_key`, `_persist_order_flow_signal`, `_resolve_dark_flow_runtime_settings`, `_resolve_order_flow_symbols`, `detect_and_store_order_flow`, `detect_whale_reversal`, `distribute_order_flow_signal`
- Top-level variables:
  - `DARK_FLOW_DISTRIBUTION_MIN_STRENGTH`, `ORDER_FLOW_COOLDOWN_SECONDS`, `ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX`, `ORDER_FLOW_MAX_SYMBOLS`, `REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY`, `logger`

### `backend/portfolio/tasks_prefetch.py`

- Functions:
  - `_acquire_lock`, `_build_scheduler_sample_symbols`, `_build_symbol_count_map`, `_cache_ticker_rows_from_dataframe`, `_cleanup_session_close_retention`, `_coerce_prefetch_time_policy`, `_collect_prefetch_symbols`, `_collect_realtime_symbol_universe`, `_compute_heat_score`, `_distinct_symbols`, `_estimate_upstream_calls_per_minute`, `_extract_row_highest`, `_extract_row_lowest`, `_extract_row_match_price`, `_extract_row_open_price`, `_extract_row_ref_price`, `_extract_row_symbol`, `_extract_row_volume`, `_f`, `_get_prefetch_time_policy`, `_get_vnbroker_runtime_settings`, `_group_tier_by_shard`, `_group_universe_by_tier`, `_i`, `_increment_prefetch_metric`, `_int_env`, `_is_rate_limited_error`, `_mark_price_board_rate_limited`, `_metric_cache_key`, `_normalized_symbol_set`, `_parse_hhmm_to_minutes`, `_prefetch_retry_countdown`, `_prefetch_retry_countdown_with_policy`, `_prefetch_runtime_defaults`, `_prefetch_time_policy_defaults`, `_publish_scheduler_prefetch_meta`, `_read_bool_env`, `_read_offpeak_ingest_history`, `_record_vnbroker_timeout`, `_resolve_effective_prefetch_settings`, `_resolve_prefetch_time_profile`, `_resolve_prefetch_topology`, `_resolve_scheduler_plan`, `_resolve_session_close_date`, `_resolve_ticker_cache_ttl_seconds`, `_row_get_value`, `_safe_cache_delete`, `_snapshot_is_stale`, `_stable_shard_id`, `_store_offpeak_ingest_meta`, `_store_prefetch_meta`, `_store_universe_snapshot`, `_tier_batch_size`, `_tier_enabled`, `_tier_interval_seconds`, `_tier_shards`, `_upsert_session_close_snapshot`, `build_realtime_symbol_universe_snapshot`, `offpeak_vnbroker_ingest`, `prefetch_realtime_ticker_shard`, `schedule_realtime_prefetch_shards`
- Top-level variables:
  - `OFFPEAK_INGEST_HISTORY_CACHE_KEY`, `OFFPEAK_INGEST_HISTORY_MAX_ITEMS`, `OFFPEAK_INGEST_LATEST_META_CACHE_KEY`, `PREFETCH_ENQUEUE_LOCK_KEY`, `PREFETCH_METRIC_CACHE_PREFIX`, `PREFETCH_TIME_POLICY_CACHE_KEY`, `REALTIME_PREFETCH_QUEUE`, `REALTIME_SHARD_CACHE_PREFIX`, `REALTIME_SHARD_LAST_ENQUEUE_PREFIX`, `REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY`, `REALTIME_UNIVERSE_TIER_CACHE_PREFIX`, `TICKER_PREFETCH_META_CACHE_KEY`, `VNBROKER_PRICE_BOARD_RATE_LIMIT_CACHE_KEY`, `VNBROKER_RUNTIME_SETTINGS_CACHE_KEY`, `VNBROKER_TIMEOUT_COUNTER_KEY`, `logger`

### `backend/portfolio/tasks_realtime.py`

- Functions:
  - `_is_prefetch_cache_fresh`, `_whale_thresholds_for_user`, `collect_and_publish_realtime`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_rollout.py`

- Functions:
  - `ack_whale_config_rollout`, `activate_due_whale_config_rollouts`, `monitor_whale_config_anomalies`, `refresh_whale_config_rollout_status`

### `backend/portfolio/tasks_sentiment.py`

- Functions:
  - `_build_sentiment_prompt`, `_call_sentiment_ai`, `_fetch_headlines_for_symbol`, `_get_default_provider_and_model`, `_get_sector_average_sentiment`, `_get_source_weight`, `_parse_ai_sentiment_response`, `sync_news_sentiment`
- Top-level variables:
  - `_SENTIMENT_MAX_TOKENS`, `_SENTIMENT_SYMBOLS_PER_RUN`, `logger`

### `backend/portfolio/tasks_signal_verification.py`

- Functions:
  - `_get_close_price`, `_get_ipo_trading_day_count`, `_get_n_trading_days_ago`, `_validate_price`, `verify_signals_daily`
- Top-level variables:
  - `_IPO_MIN_TRADING_DAYS`, `_PRICE_VALIDATE_THRESHOLD`, `logger`

### `backend/portfolio/tasks_stock_profile_sync.py`

- Functions:
  - `_chunked`, `heatmap_static_cache_key`, `sync_stock_profiles_from_snapshot`
- Top-level variables:
  - `_HEATMAP_CHUNK_SIZE`, `_HEATMAP_STATIC_TTL`, `logger`

### `backend/portfolio/tasks_symbol_engagement.py`

- Functions:
  - `_persist_df_to_db_directly`, `warmup_symbol_intraday`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_sync.py`

- Functions:
  - `sync_all_watch_assets`, `sync_user_watch_assets`

### `backend/portfolio/tasks_telegram.py`

- Functions:
  - `dispatch_whale_alert`, `send_direct_message`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_watchlist_indicators.py`

- Functions:
  - `_ma20_dist_pct`, `_rsi`, `_rvol`, `compute_indicators_for_symbol`, `compute_watchlist_indicators`, `get_cached_indicators`
- Top-level variables:
  - `INDICATOR_CACHE_PREFIX`, `INDICATOR_CACHE_TTL`, `MA20_PERIODS`, `MIN_RSI_PERIODS`, `RVOL_LOOKBACK`, `logger`

### `backend/portfolio/tasks_whale_advisory.py`

- Functions:
  - `_resolve_flush_advisory_sources`, `build_stock_ai_advisory_summary_payload`, `flush_merged_advisory_event`, `generate_stock_ai_advisory_summary_task`
- Top-level variables:
  - `ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY`, `ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX`, `logger`

### `backend/portfolio/tasks_whale_ai_call.py`

- Functions:
  - `_execute_provider_ai_call`

### `backend/portfolio/tasks_whale_auto_generation.py`

- Functions:
  - `auto_generate_advisories_for_all_tracked`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_bookkeeping.py`

- Functions:
  - `_collect_generation_language_metrics`, `_record_generation_token_usage`, `_resolve_generation_refresh_count`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_broadcast.py`

- Functions:
  - `_broadcast_market_discovery_event`, `_broadcast_screener_matched`, `_broadcast_whale_advisory`

### `backend/portfolio/tasks_whale_execution.py`

- Functions:
  - `_execute_whale_generation_postprovider`

### `backend/portfolio/tasks_whale_finalize_phase.py`

- Functions:
  - `_execute_whale_generation_finalize_phase`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_generation.py`

- Functions:
  - `generate_whale_advisory_task`

### `backend/portfolio/tasks_whale_metrics.py`

- Functions:
  - `_build_whale_generation_result`, `_finalize_whale_generation_metrics`

### `backend/portfolio/tasks_whale_persist_phase.py`

- Functions:
  - `_execute_whale_generation_persist_phase`

### `backend/portfolio/tasks_whale_persistence.py`

- Functions:
  - `_create_advisory_token_log`, `_create_whale_advisory_record`

### `backend/portfolio/tasks_whale_preflight.py`

- Functions:
  - `_build_whale_generation_context_dict`, `_prepare_whale_generation_context`, `_return_with_preflight_profile`, `_unwrap_or_return_skip`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_preflight_ai.py`

- Functions:
  - `_check_ai_runtime_config`, `_check_provider_rate_limit`, `_extract_ai_config_values`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_preflight_cache.py`

- Functions:
  - `_build_preflight_metric_rates`, `_build_preflight_metric_summary`, `_build_skip_response`, `_check_cooldown_skip`, `_check_existing_advisory_skip`, `_check_preflight_cache_skips`, `_increment_preflight_counter`, `_metric_cache_key`, `_read_preflight_metrics`, `_read_preflight_metrics_window`, `_sum_preflight_metrics_window`
- Top-level variables:
  - `METRIC_COOLDOWN_BYPASS_FORCE_REFRESH`, `METRIC_COOLDOWN_HIT`, `METRIC_COOLDOWN_MISS`, `METRIC_EXISTING_ADVISORY_HIT`, `METRIC_EXISTING_ADVISORY_MISS`, `WHALE_PREFLIGHT_KPI_SCHEMA_VERSION`, `WHALE_PREFLIGHT_METRIC_NAMES`, `WHALE_PREFLIGHT_METRIC_PREFIX`, `logger`

### `backend/portfolio/tasks_whale_preflight_guards.py`

- Functions:
  - `_check_user_cfg_guards`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_preflight_language.py`

- Functions:
  - `_resolve_advisory_output_config`, `_resolve_model_for_budget`, `_resolve_output_language`, `_should_use_concise_advisory`
- Top-level variables:
  - `_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS`, `logger`

### `backend/portfolio/tasks_whale_provider_bookkeeping_phase.py`

- Functions:
  - `_execute_whale_provider_bookkeeping_phase`

### `backend/portfolio/tasks_whale_provider_generation.py`

- Functions:
  - `_run_whale_provider_generation`
- Top-level variables:
  - `logger`

### `backend/portfolio/tasks_whale_provider_phase.py`

- Functions:
  - `_execute_whale_provider_phase`

### `backend/portfolio/tasks_whale_quality.py`

- Functions:
  - `_normalize_generated_advisory_metadata`, `_record_generation_quality_metrics`, `_resolve_generated_advisory_severity`

### `backend/portfolio/tasks_whale_service.py`

- Functions:
  - `detect_and_store_global_whale_alerts`, `distribute_whale_alert_event`

### `backend/portfolio/telegram_service.py`

- Functions:
  - `_bot_api`, `_handle_mute`, `_handle_portfolio`, `_handle_start`, `_handle_stock`, `edit_message_text`, `format_whale_alert_message`, `generate_deeplink_token`, `get_deeplink_url`, `get_signal_severity`, `mask_symbol`, `process_webhook_update`, `send_message`, `validate_deeplink_token`
- Top-level variables:
  - `_BOT_TOKEN`, `_BOT_USERNAME`, `_CRITICAL_THRESHOLD_VND`, `_DEEPLINK_CACHE_PREFIX`, `_DEEPLINK_TOKEN_TTL_SECONDS`, `_HIGH_THRESHOLD_VND`, `logger`

### `backend/portfolio/tests/__init__.py`

- No parseable top-level symbols found

### `backend/portfolio/tests/test_adapters.py`

- Classes:
  - `CacheAdapterTests` -> methods: `test_get_cache_happy_path`, `test_get_cache_returns_none_on_exception`, `test_is_vnbroker_rate_limited_false_when_key_missing`, `test_is_vnbroker_rate_limited_true_when_key_exists`, `test_mark_vnbroker_rate_limited_sets_cache`, `test_set_cache_happy_path`, `test_set_cache_swallows_exceptions`
  - `VnbrokerAdapterTests` -> methods: `setUp`, `test_build_stock_client_does_not_cache_when_disabled`, `test_build_stock_client_logs_missing_data_payload_warning`, `test_build_stock_client_maps_rate_limit_error`, `test_build_stock_client_raises_vnbroker_missing`, `test_build_stock_client_reuses_cached_instance_when_enabled`, `test_fetch_financial_ratio_dataframe_fallbacks_to_next_source`, `test_fetch_financial_ratio_dataframe_uses_timeout_wrapper`, `test_fetch_history_dataframe_uses_selected_source`, `test_fetch_intraday_dataframe_fallbacks_to_next_runtime_provider`, `test_fetch_listing_symbols_dataframe_uses_runtime_provider_chain`, `test_fetch_price_board_dataframe_fallbacks_on_rate_limit`, `test_fetch_price_board_dataframe_fallbacks_on_unusable_payload`, `test_fetch_price_board_dataframe_preserves_canonical_multiindex_payload`, `test_fetch_symbols_by_exchange_dataframe_returns_dataframe`, `test_fetch_symbols_by_group_series_returns_series`, `test_fetch_symbols_by_industries_dataframe_uses_adapter_runtime_chain`, `test_normalize_price_board_dataframe_keeps_raw_vnbroker_price_units`, `test_normalize_price_board_dataframe_maps_flat_rows_to_parseable_multiindex`, `test_read_stream_intraday_ticks_returns_empty_when_reader_fails`, `test_resolve_financial_ratio_sources_keeps_order_and_dedup`, `test_resolve_intraday_sources_uses_runtime_config_order`, `test_resolve_price_board_sources_keeps_order_and_dedup`, `test_resolve_price_board_sources_prefers_source_config_primary`, `test_run_with_timeout_returns_function_result`, `test_run_with_timeout_wraps_generic_exception`

### `backend/portfolio/tests/test_admin_crawl_control.py`

- Classes:
  - `AdminCrawlControlTests` -> methods: `setUp`, `tearDown`, `test_run_endpoint_creates_run_and_dispatches_task`, `test_run_inactive_job_forbidden`, `test_stop_endpoint_does_not_release_lock_if_token_mismatches`, `test_stop_endpoint_revokes_task_and_releases_lock`, `test_stop_no_active_run`
- Top-level variables:
  - `User`

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
  - `AdminIntradaySideBackfillAsyncTests` -> methods: `_login`, `setUp`, `test_backfill_apply_returns_503_when_worker_unavailable`, `test_backfill_task_invalidates_whale_snapshot_cache_for_touched_symbols`, `test_staff_can_get_intraday_side_backfill_status`, `test_staff_can_queue_intraday_side_backfill_apply`, `test_staff_without_intraday_permission_cannot_queue_apply`
  - `AdminOpsStatsDataTests` -> methods: `_get_stats`, `setUp`, `test_response_has_all_required_keys`, `test_surface_permissions_default_to_write_locked_for_staff`, `test_ticker_prefetch_payload_present`
  - `AdminOpsStatsPermissionTests` -> methods: `_login`, `setUp`, `test_regular_user_returns_403`, `test_staff_user_returns_200`, `test_unauthenticated_returns_401`
  - `AdminOpsvnbrokerBenchmarkTests` -> methods: `_login`, `setUp`, `test_latest_benchmark_fail_soft_when_loader_errors`, `test_non_staff_cannot_run_benchmark`, `test_staff_can_get_latest_benchmark_report`, `test_staff_can_run_benchmark`
  - `AdminOpsvnbrokerRuntimeConfigTests` -> methods: `_login`, `setUp`, `test_non_staff_forbidden`, `test_staff_can_get_update_and_read_changelog`, `test_staff_can_reset_defaults`, `test_staff_without_write_permission_cannot_update_or_reset`
  - `AdminOpsWarmPrefetchTests` -> methods: `_get_stats`, `setUp`, `test_channel_layer_type_field_is_string`, `test_last_market_group_sync_none_when_no_log`, `test_last_market_group_sync_populated_when_log_exists`, `test_last_stock_profile_sync_none_when_no_log`, `test_offpeak_ingest_history_requires_auth`, `test_offpeak_ingest_history_returns_latest_and_list`, `test_offpeak_ingest_requires_auth`, `test_portfolio_count_is_correct`, `test_redis_ok_field_present_in_response`, `test_staff_can_queue_async_offpeak_ingest`, `test_staff_can_queue_async_prefetch_warm`, `test_sync_offpeak_ingest_returns_payload`, `test_sync_warm_prefetch_returns_payload_without_http_503_on_non_ok`, `test_tracked_symbol_count_is_correct`, `test_user_count_includes_all_users`, `test_warm_prefetch_requires_auth`, `test_watchlist_item_count_is_correct`, `test_whale_dashboard_includes_rollout_postcheck_summary`
- Functions:
  - `_grant_portfolio_permission`
- Top-level variables:
  - `INTRADAY_BACKFILL_APPLY_URL`, `INTRADAY_BACKFILL_STATUS_URL`, `OFFPEAK_INGEST_HISTORY_URL`, `OFFPEAK_INGEST_URL`, `URL`, `WARM_URL`, `vnbroker_BENCHMARK_LATEST_URL`, `vnbroker_BENCHMARK_RUN_URL`, `vnbroker_CHANGELOG_URL`, `vnbroker_CURRENT_URL`, `vnbroker_RESET_URL`, `vnbroker_UPDATE_URL`

### `backend/portfolio/tests/test_admin_screener_admin.py`

- Classes:
  - `AdminGlobalScreenerManualRunTests` -> methods: `setUp`, `test_manual_run_queues_background_task`
  - `AdminGlobalScreenerRuleTests` -> methods: `_rule_payload`, `setUp`, `test_create_update_delete_rule`, `test_list_empty`
  - `AdminScreenerConfigTests` -> methods: `setUp`, `test_get_returns_default_config`, `test_put_updates_config`
  - `AdminScreenerPermissionTests` -> methods: `setUp`, `test_regular_user_config_returns_403`, `test_staff_user_config_returns_200`, `test_unauthenticated_config_returns_401`
- Functions:
  - `_login_staff`
- Top-level variables:
  - `CONFIG_URL`, `RULES_URL`, `RULE_DETAIL_URL`, `RUN_MANUAL_URL`

### `backend/portfolio/tests/test_admin_stockprofile_sync.py`

- Classes:
  - `AdminStockProfileSyncTests` -> methods: `setUp`, `test_admin_navigation_links_to_workspace_from_related_models`, `test_admin_stockprofile_sync_route`, `test_admin_stockprofile_workspace_route`, `test_fetch_live_workspace_data_uses_adapter_price_board`

### `backend/portfolio/tests/test_admin_user_verification.py`

- Classes:
  - `UserConfigAdminVerificationTests` -> methods: `setUp`, `test_admin_action_resends_only_for_unverified_accounts`, `test_admin_index_shows_verification_operations_summary`, `test_admin_route_can_resend_latest_pending_verification_email`, `test_admin_route_warns_when_no_pending_verification_accounts`, `test_userconfig_admin_changelist_is_accessible`, `test_userconfig_change_view_hides_resend_button_for_verified_user`, `test_userconfig_change_view_shows_resend_button_for_unverified_user`, `test_userconfig_detail_route_can_resend_verification_email`, `test_userconfig_detail_route_skips_verified_user`

### `backend/portfolio/tests/test_admin_whale_mission_control.py`

- Classes:
  - `WhaleMissionControlModelTests` -> methods: `_attach_messages`, `_message_texts`, `setUp`, `test_activate_due_scheduled_rollout_marks_version_active`, `test_admin_approval_by_supervisor_writes_audit`, `test_admin_draft_save_creates_audit_log`, `test_admin_role_split_permissions`, `test_anomaly_snapshot_detects_whale_tick_spike`, `test_apply_active_version_blocks_when_dependencies_degraded`, `test_apply_active_version_shows_diff_preview_and_activates_target`, `test_canary_scope_matches_symbol_exchange_and_percentage`, `test_create_draft_and_version`, `test_diff_preview_detects_threshold_and_weight_changes`, `test_guardrail_validator_rejects_dangerous_thresholds`, `test_initialize_rollout_creates_pending_worker_ack_records`, `test_maker_checker_block_same_creator_as_reviewer`, `test_monitor_rollout_anomalies_auto_reverts_to_previous_version`, `test_record_worker_ack_marks_rollout_completed_when_all_workers_ack`, `test_resolve_runtime_config_prefers_canary_and_auto_acks_worker`, `test_rollout_snapshot_marks_stale_worker_version_as_amber`, `test_rollout_worker_ack_and_audit_log`, `test_scheduled_rollout_allows_warning_without_blocking`, `test_submit_selected_drafts_blocks_when_preview_has_blocking_issues`, `test_supervisor_can_approve`, `test_whale_models_are_exposed_in_custom_admin_menu_groups`

### `backend/portfolio/tests/test_ai_advisory_news_integration.py`

- Classes:
  - `TestEdgeCases` -> methods: `setUp`, `test_news_context_with_maximum_headlines`, `test_news_context_with_special_characters`, `test_synthesis_with_ai_not_ready`
  - `TestFetchNewsContextForAdvisory` -> methods: `setUp`, `test_fetch_news_context_cache_miss`, `test_fetch_news_context_empty_news`, `test_fetch_news_context_exception_handling`, `test_fetch_news_context_formatting`, `test_fetch_news_context_invalid_symbol`, `test_fetch_news_context_success`
  - `TestGenerateExecutiveSynthesisWithNews` -> methods: `_get_mock_config`, `setUp`, `test_generate_synthesis_with_news_context`, `test_generate_synthesis_without_news_context`, `test_news_context_injected_into_prompt`, `test_prompt_includes_news_instruction`
  - `TestIntegrationNewsIntoSynthesis` -> methods: `setUp`, `test_full_synthesis_pipeline_with_news`

### `backend/portfolio/tests/test_ai_config_api.py`

- Classes:
  - `AIConfigApiTests` -> methods: `setUp`, `test_ai_command_center_audit_logs_support_filters_and_diff_summary`, `test_ai_command_center_get_hydrates_prompt_config_from_legacy_userconfig`, `test_ai_command_center_put_mirrors_prompt_config_into_legacy_userconfig`, `test_ai_config_get_and_put`, `test_ai_config_get_reports_not_ready_when_command_center_incomplete`, `test_ai_config_get_uses_env_key_for_configured_flag`, `test_ai_config_put_rejects_missing_model`, `test_ai_config_put_rejects_model_not_supported_for_advisory`, `test_ai_options_returns_providers_and_defaults`, `test_ai_prompt_config_accepts_canonical_and_legacy_layouts`, `test_ai_test_connection_endpoint`, `test_ai_test_connection_rejects_missing_api_key`, `test_ai_test_connection_rejects_missing_model`, `test_ai_test_connection_rejects_model_not_supported_for_advisory`, `test_update_user_config_ignores_ai_fields`

### `backend/portfolio/tests/test_ai_context.py`

- Classes:
  - `AIContextTests` -> methods: `setUp`, `test_build_context_contains_market_and_intraday`, `test_build_context_handles_non_numeric_transaction_values`, `test_render_context_for_prompt_has_expected_sections`

### `backend/portfolio/tests/test_ai_runtime_config.py`

- Classes:
  - `AIRuntimeConfigTests` -> methods: `setUp`, `test_resolver_falls_back_to_system_when_user_missing_model_and_key`, `test_resolver_ignores_legacy_user_config_when_command_center_missing`, `test_resolver_prefers_command_center_over_legacy_and_system`

### `backend/portfolio/tests/test_ai_service_prompt.py`

- Classes:
  - `AIServicePromptTests` -> methods: `test_generate_whale_text_buy_side_keeps_order_intro`, `test_generate_whale_text_unknown_side_uses_neutral_intro`

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
  - `ApiRouteSmokeTests` -> methods: `_attach_dpi_license`, `_create_stock_workspace_advisory`, `_detach_dpi_license`, `authenticate`, `authenticate_direct`, `setUp`

### `backend/portfolio/tests/test_api_routes_admin_sync_groups.py`

- Classes:
  - `ApiRouteAdminSyncGroupsTests` -> methods: `authenticate`, `setUp`, `test_admin_sync_stockprofile_endpoint`, `test_stock_management_groups_endpoint`

### `backend/portfolio/tests/test_api_routes_auth_basic.py`

- Classes:
  - `ApiRouteAuthBasicTests` -> methods: `authenticate`, `setUp`, `test_jwt_token_obtain_endpoint`, `test_register_endpoint_creates_unverified_user_and_sends_verification_email`

### `backend/portfolio/tests/test_api_routes_auth_email_verification.py`

- Classes:
  - `ApiRouteAuthEmailVerificationTests` -> methods: `authenticate`, `setUp`, `test_resend_verification_endpoint_uses_username_identifier`, `test_verify_email_endpoint_marks_user_as_verified`, `test_verify_email_endpoint_rejects_invalid_token`

### `backend/portfolio/tests/test_api_routes_auth_oauth_google.py`

- Classes:
  - `ApiRouteAuthOauthGoogleTests` -> methods: `authenticate`, `setUp`, `test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy`, `test_google_oauth_endpoint_existing_user_no_reassignment`, `test_google_oauth_endpoint_fail_soft_when_starter_provisioning_fails`

### `backend/portfolio/tests/test_api_routes_auth_password_reset.py`

- Classes:
  - `ApiRouteAuthPasswordResetTests` -> methods: `authenticate`, `setUp`, `test_password_reset_confirm_logs_invalid_token`, `test_password_reset_confirm_logs_success`, `test_password_reset_confirm_rejects_invalid_token`, `test_password_reset_confirm_updates_password`, `test_password_reset_request_logs_unknown_identifier`, `test_password_reset_request_returns_generic_message_for_unknown_user`, `test_password_reset_request_sends_email_when_user_exists`, `test_password_reset_views_define_dedicated_throttle_scopes`

### `backend/portfolio/tests/test_api_routes_auth_profile.py`

- Classes:
  - `ApiRouteAuthProfileTests` -> methods: `authenticate`, `setUp`, `test_access_capabilities_route_returns_operator_bootstrap_snapshot`, `test_access_capabilities_route_returns_tenant_bootstrap_snapshot`, `test_auth_me_endpoint_returns_community_tier_for_free_plan`, `test_auth_me_endpoint_returns_plan_and_abilities`, `test_auth_me_endpoint_returns_staff_flags_for_superuser`, `test_auth_me_endpoint_treats_staff_user_as_admin_capability_session`, `test_login_allows_unverified_superuser`, `test_login_is_blocked_for_unverified_user`, `test_portfolio_userconfig_endpoint`, `test_register_endpoint_rejects_password_mismatch`

### `backend/portfolio/tests/test_api_routes_auth_register.py`

- Classes:
  - `ApiRouteAuthRegisterTests` -> methods: `authenticate`, `setUp`, `test_register_endpoint_applies_active_onboarding_policy`, `test_register_endpoint_fail_soft_when_starter_provisioning_fails`, `test_register_endpoint_normalizes_email_to_lowercase`, `test_register_endpoint_rejects_duplicate_email_case_insensitive`, `test_register_endpoint_rejects_duplicate_username`, `test_register_endpoint_rejects_invalid_email`, `test_register_endpoint_requires_email`, `test_register_endpoint_respects_signup_trial_feature_flag`

### `backend/portfolio/tests/test_api_routes_stock_ai_advisory_components_chart_context.py`

- Classes:
  - `ApiRouteStockAiAdvisoryComponentsChartContextTests` -> methods: `_attach_dpi_license`, `_create_stock_workspace_advisory`, `authenticate`, `setUp`, `test_stock_ai_advisory_components_generate_accepts_chart_context_and_returns_usage_flags`, `test_stock_ai_advisory_components_generate_chart_context_oversize_points_sets_warning`, `test_stock_ai_advisory_components_generate_invalid_chart_context_sets_warning`, `test_stock_ai_advisory_components_generate_prefers_active_rsi_indicator_from_chart_context`, `test_stock_ai_advisory_components_generate_without_chart_context_has_no_warning`

### `backend/portfolio/tests/test_api_routes_stock_ai_advisory_session.py`

- Classes:
  - `ApiRouteStockAiAdvisorySessionTests` -> methods: `_attach_dpi_license`, `authenticate`, `setUp`, `test_stock_ai_advisory_session_get_accepts_contract_v2_query_override`, `test_stock_ai_advisory_session_get_creates_sync_when_missing`, `test_stock_ai_advisory_session_get_filters_by_trade_date`, `test_stock_ai_advisory_session_get_is_not_blocked_by_api_quota`, `test_stock_ai_advisory_session_get_queues_when_benchmarks_requested_and_missing`, `test_stock_ai_advisory_session_get_returns_200_with_config_issue_when_ai_model_missing`, `test_stock_ai_advisory_session_get_returns_400_for_invalid_contract_query`, `test_stock_ai_advisory_session_get_returns_503_when_queue_unavailable`, `test_stock_ai_advisory_session_get_returns_latest_advisory`, `test_stock_ai_advisory_session_get_returns_v2_contract_when_enabled`, `test_stock_ai_advisory_session_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_session_v2_contract_returns_403_when_holistic_gate_disabled`, `test_stock_ai_advisory_session_v2_contract_returns_403_when_user_not_in_holistic_allowlist`, `test_stock_ai_advisory_session_v2_includes_benchmark_enrichment`

### `backend/portfolio/tests/test_api_routes_stock_ai_advisory_trace.py`

- Classes:
  - `ApiRouteStockAIAdvisoryTraceTests` -> methods: `authenticate`, `setUp`, `test_stock_ai_advisory_trace_export_returns_audit_artifact_bundle`, `test_stock_ai_advisory_trace_list_returns_400_for_invalid_reason_filter`, `test_stock_ai_advisory_trace_list_supports_cursor_pagination`, `test_stock_ai_advisory_trace_list_supports_reason_actor_time_filters`, `test_stock_ai_advisory_trace_returns_snapshot_and_matched_audit_logs`

### `backend/portfolio/tests/test_api_routes_stock_technicals_bulk.py`

- Classes:
  - `ApiRouteStockTechnicalsBulkTests` -> methods: `_seed_daily_prices`, `authenticate`, `setUp`, `test_bulk_technicals_rejects_over_limit_symbols`, `test_bulk_technicals_requires_non_empty_symbols`, `test_bulk_technicals_returns_normalized_deduped_results`

### `backend/portfolio/tests/test_api_routes_stock_workspace_feature_access.py`

- Classes:
  - `ApiRouteStockWorkspaceFeatureAccessTests` -> methods: `_attach_dpi_license`, `authenticate`, `setUp`, `test_check_feature_access_allows_staff_admin_without_dpi_feature`, `test_stock_ai_advisory_components_generate_allows_admin_even_without_pro_feature_license`, `test_stock_ai_advisory_components_generate_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_order_flow_returns_200_when_feature_enabled_for_pro_dpi_license`, `test_stock_order_flow_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_order_flow_returns_429_when_api_quota_exceeded`

### `backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py`

- Classes:
  - `ApiRouteStockWorkspaceRealtimeBulkTests` -> methods: `_attach_dpi_license`, `_create_stock_workspace_advisory`, `_detach_dpi_license`, `authenticate`, `authenticate_direct`, `setUp`, `test_baseline_cache_service_exposes_phase1_interface`, `test_build_whale_payload_includes_trust_metadata_fields`, `test_depth_chart_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_financial_metrics_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_financial_metrics_refactored_returns_502_on_unexpected_exception`, `test_market_group_write_endpoints_are_read_only`, `test_price_alert_rule_crud_and_trigger_endpoint`, `test_price_board_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_price_board_refactored_returns_200_fallback_on_provider_exception`, `test_realtime_intraday_endpoint_rejects_invalid_page_size`, `test_realtime_intraday_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_realtime_intraday_lunch_break_suppresses_stale_warning`, `test_realtime_intraday_refactored_returns_200_fallback_on_provider_exception`, `test_realtime_intraday_stale_contract_keeps_within_threshold_for_non_vn30`, `test_realtime_intraday_stale_contract_marks_over_threshold_for_vn30`, `test_realtime_ticker_cache_miss_does_not_call_on_demand_fetch_and_can_serve_degraded`, `test_realtime_ticker_cache_miss_returns_503_by_default`, `test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_realtime_ticker_fallback_endpoint`, `test_refactored_whale_feed_aggregate_applies_window_filter`, `test_refactored_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements`, `test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db`, `test_refactored_whale_feed_aggregate_rejects_cursor_window_mismatch`, `test_refactored_whale_feed_aggregate_rejects_invalid_cursor`, `test_refactored_whale_feed_aggregate_rejects_invalid_window`, `test_refactored_whale_feed_deduplicates_duplicate_ticks`, `test_refactored_whale_feed_falls_back_to_intraday_tick_db_when_vnbroker_unavailable`, `test_refactored_whale_feed_response_contains_scoring_contract`, `test_rvol_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_rvol_endpoint_uses_same_bucket_20_session_baseline`, `test_sector_breadth_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_stock_ai_advisory_component_clear_deleted_hard_deletes_deleted_records`, `test_stock_ai_advisory_component_delete_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_delete_returns_429_when_api_quota_exceeded`, `test_stock_ai_advisory_component_delete_soft_deletes_record`, `test_stock_ai_advisory_component_delete_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_component_refresh_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_refresh_returns_404_when_component_missing`, `test_stock_ai_advisory_component_refresh_returns_429_when_ai_regenerate_quota_exceeded`, `test_stock_ai_advisory_component_refresh_updates_only_target_component`, `test_stock_ai_advisory_component_refresh_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_component_restore_reactivates_record`, `test_stock_ai_advisory_component_restore_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_restore_returns_429_when_api_quota_exceeded`, `test_stock_ai_advisory_component_restore_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_component_toggle_include_flips_flag`, `test_stock_ai_advisory_component_toggle_include_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_component_toggle_include_returns_429_when_api_quota_exceeded`, `test_stock_ai_advisory_component_toggle_include_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_components_generate_returns_409_when_ai_api_not_configured`, `test_stock_ai_advisory_components_generate_returns_429_when_ai_regenerate_quota_exceeded`, `test_stock_ai_advisory_observability_get_applies_governance_endpoint_reason_filters`, `test_stock_ai_advisory_observability_get_applies_retry_filters_and_sort`, `test_stock_ai_advisory_observability_get_includes_governance_delta_thresholds`, `test_stock_ai_advisory_observability_get_includes_retry_events_from_audit_logs`, `test_stock_ai_advisory_observability_get_includes_rollout_governance_trend`, `test_stock_ai_advisory_observability_get_returns_400_for_invalid_governance_bucket`, `test_stock_ai_advisory_observability_get_supports_governance_day_bucket`, `test_stock_ai_advisory_observability_post_retry_telemetry_creates_audit_log`, `test_stock_ai_advisory_observability_returns_403_when_holistic_gate_disabled`, `test_stock_ai_advisory_observability_returns_403_when_user_not_in_holistic_allowlist`, `test_stock_ai_advisory_observability_returns_summary_and_timeline`, `test_stock_ai_advisory_session_post_returns_429_when_refresh_cooldown_active`, `test_stock_ai_advisory_session_post_returns_503_when_queue_unavailable`, `test_stock_ai_advisory_session_returns_summary_history_desc_by_version`, `test_stock_ai_advisory_summary_delete_removes_selected_summary`, `test_stock_ai_advisory_summary_regenerate_creates_version`, `test_stock_ai_advisory_summary_regenerate_passes_synthesis_preference`, `test_stock_ai_advisory_summary_regenerate_prefers_ai_detailed_synthesis`, `test_stock_ai_advisory_summary_regenerate_returns_403_when_feature_locked_for_free_dpi_license`, `test_stock_ai_advisory_summary_regenerate_returns_429_when_ai_regenerate_quota_exceeded`, `test_stock_ai_advisory_summary_regenerate_returns_429_when_cooldown_active`, `test_stock_ai_advisory_summary_regenerate_usage_tracking_calls_track_api_call`, `test_stock_workspace_chart_endpoint_rejects_invalid_days`, `test_stock_workspace_chart_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_stock_workspace_chart_normalizes_history_points_to_quote_unit`, `test_stock_workspace_overview_and_chart_endpoints`, `test_stock_workspace_overview_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_stock_workspace_overview_fallback_when_base_builder_crashes`, `test_stock_workspace_overview_normalizes_52w_history_to_quote_unit`, `test_stock_workspace_overview_refactored_returns_502_on_unexpected_exception`, `test_stock_workspace_p0_role_matrix_allows_access_for_pro_premium_admin_trial_grace`, `test_stock_workspace_p0_role_matrix_blocks_expired_license`, `test_stock_workspace_p0_role_matrix_blocks_free_dpi_license`, `test_stock_workspace_p1_regression_matrix_matches_current_gating_policy`, `test_tracked_symbol_bulk_threshold_endpoint_updates_multiple_rows`, `test_tracked_symbol_bulk_threshold_endpoint_validates_ids`, `test_tracked_symbol_supports_per_symbol_threshold_create_and_patch`, `test_unified_alerts_endpoint_boosts_recent_whale_against_old_dark_flow`, `test_unified_alerts_endpoint_cursor_pagination_has_no_overlap`, `test_unified_alerts_endpoint_escalates_whale_to_critical_at_three_x_threshold`, `test_unified_alerts_endpoint_includes_market_wide_top_tier_whale`, `test_unified_alerts_endpoint_rejects_cursor_severity_min_mismatch`, `test_unified_alerts_endpoint_rejects_cursor_window_mismatch`, `test_unified_alerts_endpoint_rejects_invalid_cursor`, `test_unified_alerts_endpoint_rejects_invalid_severity_min`, `test_unified_alerts_endpoint_respects_severity_min_filter`, `test_unified_alerts_endpoint_returns_combined_whale_and_dark_flow`, `test_whale_campaigns_applies_baseline_enrichment_hook`, `test_whale_campaigns_groups_events_into_campaigns`, `test_whale_campaigns_rejects_invalid_campaign_limit`, `test_whale_campaigns_supports_cursor_pagination`, `test_whale_feed_aggregate_applies_per_symbol_threshold_override`, `test_whale_feed_aggregate_cursor_is_stable_for_matched_value_sort`, `test_whale_feed_aggregate_cursor_is_stable_for_ts_sort`, `test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements`, `test_whale_feed_aggregate_empty_symbols_returns_empty_payload`, `test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_whale_feed_aggregate_falls_back_to_vnbroker_after_stream_and_db_miss`, `test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x`, `test_whale_feed_aggregate_prefers_canonical_whale_event_store_when_available`, `test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db`, `test_whale_feed_aggregate_rejects_invalid_limit_sort_and_cursor_sort_mismatch`, `test_whale_feed_aggregate_returns_429_when_api_quota_exceeded`, `test_whale_feed_aggregate_sets_threshold_source_per_symbol`, `test_whale_feed_aggregate_skips_vnbroker_fallback_for_large_symbol_sets`, `test_whale_feed_aggregate_supports_scope_param_and_meta_payload`, `test_whale_feed_aggregate_supports_watchlist_filter`, `test_whale_feed_aggregate_symbols_are_deduplicated`, `test_whale_feed_cache_key_scopes_by_user_and_threshold`, `test_whale_feed_db_fallback_keeps_older_threshold_hits_beyond_latest_500_ticks`, `test_whale_feed_endpoint_uses_refactored_market_view_when_flag_enabled`, `test_whale_feed_falls_back_to_intraday_tick_db_when_stream_and_vnbroker_unavailable`, `test_whale_feed_falls_back_to_intraday_tick_db_when_stream_has_no_threshold_hits`, `test_whale_feed_response_contains_scoring_contract`
- Functions:
  - `_mock_stock_ai_advisory_summary_task_apply_async`

### `backend/portfolio/tests/test_api_routes_stock_workspace_usage_persistence.py`

- Classes:
  - `ApiRouteStockWorkspaceUsagePersistenceTests` -> methods: `_attach_dpi_license`, `_create_stock_workspace_advisory`, `authenticate`, `setUp`, `test_stock_ai_advisory_components_generate_creates_component_records`, `test_stock_ai_advisory_components_generate_persists_component_metrics_audit_log`, `test_stock_ai_advisory_components_generate_usage_tracking_calls_track_api_call`, `test_stock_ai_advisory_session_usage_tracking_calls_track_api_call`, `test_stock_order_flow_usage_tracking_calls_track_api_call`

### `backend/portfolio/tests/test_api_routes_symbol_investigation.py`

- Classes:
  - `ApiRouteSymbolInvestigationTests` -> methods: `authenticate`, `setUp`, `test_symbol_investigation_endpoint_rejects_invalid_sort`, `test_symbol_investigation_endpoint_requires_auth`, `test_symbol_investigation_endpoint_returns_payload`, `test_symbol_investigation_endpoint_supports_include_alias_params`

### `backend/portfolio/tests/test_api_routes_trading_and_p1_13.py`

- Classes:
  - `ApiRouteTradingAndP113Tests` -> methods: `authenticate`, `setUp`, `test_p1_13_campaign_board_returns_valid_structure`, `test_p1_13_search_symbol_investigation_rejects_unauthenticated`, `test_p1_13_symbol_investigation_modal_has_sprint31_fields`, `test_p1_13_window_filter_backward_compat`, `test_portfolio_endpoint_uses_refactored_trading_view_when_flag_enabled`, `test_refactored_portfolio_delete_cascades_subaccounts_and_transactions`, `test_refactored_portfolio_delete_rejects_foreign_portfolio`, `test_refactored_portfolio_detail_allows_owner`, `test_refactored_portfolio_detail_rejects_foreign_portfolio`, `test_refactored_portfolio_list_returns_only_owner_portfolios`, `test_refactored_portfolio_update_allows_owner`, `test_refactored_portfolio_update_rejects_foreign_portfolio`, `test_refactored_subaccount_create_rejects_foreign_portfolio`, `test_refactored_subaccount_create_returns_400_when_user_has_no_portfolio`, `test_refactored_subaccount_create_uses_requested_owned_portfolio`, `test_refactored_subaccount_create_without_portfolio_falls_back_to_first_portfolio`, `test_refactored_subaccount_delete_rejects_foreign_subaccount`, `test_refactored_subaccount_detail_allows_owner`, `test_refactored_subaccount_detail_rejects_foreign_subaccount`, `test_refactored_subaccount_list_returns_only_owner_subaccounts`, `test_refactored_subaccount_update_rejects_foreign_subaccount`, `test_refactored_transaction_create_rejects_foreign_sub_account`, `test_refactored_transaction_delete_rejects_foreign_transaction`, `test_refactored_transaction_update_rejects_foreign_transaction`, `test_whale_advisory_severity_tag_returned_in_list`, `test_whale_advisory_watchlist_only_filter`

### `backend/portfolio/tests/test_api_routes_whale_advisory_access.py`

- Classes:
  - `ApiRouteWhaleAdvisoryAccessTests` -> methods: `authenticate`, `setUp`, `test_whale_advisory_endpoint_can_filter_ready_for_refresh`, `test_whale_advisory_endpoint_masks_detail_for_pro`, `test_whale_advisory_endpoint_requires_pro`, `test_whale_advisory_endpoint_returns_detail_for_premium`

### `backend/portfolio/tests/test_api_routes_whale_advisory_delete_current.py`

- Classes:
  - `ApiRouteWhaleAdvisoryDeleteCurrentTests` -> methods: `authenticate`, `setUp`, `test_delete_current_whale_advisory_endpoint_deletes_latest_for_symbol`, `test_delete_current_whale_advisory_endpoint_returns_404_when_missing`, `test_delete_current_whale_advisory_endpoint_returns_business_403_for_community`

### `backend/portfolio/tests/test_api_routes_whale_advisory_refresh.py`

- Classes:
  - `ApiRouteWhaleAdvisoryRefreshTests` -> methods: `authenticate`, `setUp`, `test_whale_advisory_auto_refresh_info_returns_no_advisory_for_tracked_symbol`, `test_whale_advisory_auto_refresh_info_returns_status_and_budget`, `test_whale_advisory_refresh_endpoint_queues_task_for_pro`, `test_whale_advisory_refresh_endpoint_queues_when_existing`, `test_whale_advisory_refresh_endpoint_returns_409_when_ai_api_key_missing`, `test_whale_advisory_refresh_endpoint_returns_409_when_ai_model_missing`, `test_whale_advisory_refresh_endpoint_returns_429_when_ai_regenerate_quota_exceeded`, `test_whale_advisory_refresh_endpoint_returns_429_when_manual_cooldown_active`, `test_whale_advisory_refresh_endpoint_returns_503_when_no_worker_and_sync_fallback_disabled`, `test_whale_advisory_refresh_endpoint_returns_business_403_for_community_plan`, `test_whale_advisory_refresh_endpoint_runs_sync_fallback_when_worker_unavailable`, `test_whale_advisory_refresh_endpoint_runs_sync_when_no_existing`, `test_whale_advisory_refresh_endpoint_uses_system_fallback_when_user_ai_missing`

### `backend/portfolio/tests/test_backfill_starter_portfolios_command.py`

- Classes:
  - `BackfillStarterPortfoliosCommandTests` -> methods: `setUp`, `test_backfill_username_creates_starter_data`, `test_dry_run_does_not_create_data`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_celery_task_names.py`

- Classes:
  - `CeleryTaskNameStabilityTests` -> methods: `test_public_task_names_remain_stable`

### `backend/portfolio/tests/test_coobservation.py`

- Classes:
  - `CoObservationServiceTests` -> methods: `create_dark_signal`, `setUp`, `test_api_endpoint_validation`, `test_apply_sort_correlation_strength_desc`, `test_apply_sort_created_at_desc`, `test_conviction_assessment_high_confidence_correlations`, `test_conviction_assessment_no_correlations`, `test_conviction_assessment_one_correlation`, `test_correlation_detection_same_time`, `test_dark_signals_filtered_by_symbol`, `test_dark_signals_filtered_by_time_window`, `test_exclude_dark_flow_parameter`, `test_exclude_whale_parameter`, `test_get_symbol_investigation_no_data`, `test_symbol_investigation_returns_compatibility_keys`, `test_timeline_groups_marks_co_observation_bucket`, `test_timeline_ordering`
  - `CorrelationOptimizerTests` -> methods: `test_high_confidence_buy_campaign_with_absorption`, `test_low_confidence_misaligned_side`, `test_medium_confidence_time_delay`, `test_strong_signals_high_confidence`, `test_weak_signals_low_confidence`
  - `EndToEndCoObservationTests` -> methods: `setUp`, `test_scenario_aligned_buy_signals`
  - `TimeWindowResolverTests` -> methods: `test_1h_window`, `test_5d_window`, `test_5m_window`, `test_invalid_window_raises_error`, `test_session_window_before_market_hours`, `test_session_window_during_market_hours`

### `backend/portfolio/tests/test_dark_money_history_api.py`

- Classes:
  - `TestDarkMoneyHistoryApi` -> methods: `setUp`, `test_deduplicates_exact_intraday_ticks_before_whale_aggregation`

### `backend/portfolio/tests/test_dashboard_aggregated_risk_api.py`

- Classes:
  - `DashboardAggregatedRiskApiTests` -> methods: `setUp`, `test_dashboard_aggregated_risk_snapshot_uses_selected_portfolio`

### `backend/portfolio/tests/test_discovery_engine.py`

- Classes:
  - `DiscoveryEngineTests` -> methods: `setUp`, `test_calculate_whale_intensity`, `test_is_symbol_discovery_candidate`, `test_resolve_discovery_bucket`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_dnse_credential_bootstrap.py`

- Classes:
  - `DNSEAdapterBootstrapTests` -> methods: `setUp`, `test_bootstrap_fails_when_no_username`, `test_bootstrap_hides_exception_detail`, `test_bootstrap_returns_stub_when_vnbroker_unavailable`
  - `DNSECredentialModelTests` -> methods: `setUp`, `test_api_key_round_trip`, `test_api_secret_round_trip`, `test_empty_credential_get_returns_empty_string`, `test_hash_is_deterministic_for_same_input`, `test_password_not_stored_as_plaintext`, `test_password_round_trip`, `test_username_hash_is_not_raw_sha256`, `test_username_hash_uses_hmac_pepper`, `test_username_not_stored_as_plaintext`, `test_username_round_trip`

### `backend/portfolio/tests/test_dnse_slice2_sync.py`

- Classes:
  - `DNSESlice2SyncTests` -> methods: `setUp`, `test_sync_dnse_accounts_idempotency`, `test_sync_dnse_accounts_inactive_credential`, `test_sync_dnse_accounts_no_portfolio`

### `backend/portfolio/tests/test_dnse_slice3_balances.py`

- Classes:
  - `DNSESlice3BalanceTests` -> methods: `setUp`, `test_sync_dnse_balances_success`, `test_sync_dnse_balances_update_existing`

### `backend/portfolio/tests/test_dnse_slice4_reconcile.py`

- Classes:
  - `DNSESlice4ReconcileTests` -> methods: `setUp`, `test_reconcile_dnse_transactions_idempotency`, `test_reconcile_dnse_transactions_manual_override`

### `backend/portfolio/tests/test_email_verification_templates.py`

- Classes:
  - `EmailVerificationTemplateTests` -> methods: `test_send_verification_email_uses_rendered_templates`

### `backend/portfolio/tests/test_global_screener_models.py`

- Classes:
  - `GlobalScreenerModelTests` -> methods: `test_global_screener_rule_can_be_created`, `test_screener_schedule_config_defaults_to_enabled`, `test_user_alert_history_repr_and_admin_registration`

### `backend/portfolio/tests/test_global_screener_service.py`

- Classes:
  - `GlobalScreenerServiceTests` -> methods: `tearDown`, `test_precompute_market_snapshot_and_match_active_rules`, `test_scheduled_task_broadcasts_each_matched_symbol`, `test_scheduled_task_can_be_disabled_by_config`

### `backend/portfolio/tests/test_global_signal_distribution_service.py`

- Classes:
  - `GlobalSignalDistributionServiceTests` -> methods: `_create_user`, `test_deliver_dark_flow_signal_persists_history_and_broadcasts_symbol_and_user_groups`, `test_deliver_whale_alert_event_persists_history_and_broadcasts_symbol_and_user_groups`, `test_resolve_signal_audience_unions_tracked_and_watchlist_without_duplicates`

### `backend/portfolio/tests/test_global_signal_policy_helpers.py`

- Classes:
  - `GlobalSignalPolicyHelpersTests` -> methods: `_build_transaction_dependencies`, `_seed_realtime_universe_cache`, `setUp`, `test_coerce_global_signal_services_config_rejects_invalid_strength_order`, `test_ensure_defaults_seeds_global_signal_system_settings`, `test_get_global_signal_retention_policy_returns_defaults_when_setting_missing`, `test_get_global_signal_services_config_returns_defaults_when_setting_missing`, `test_get_global_signal_universe_policy_falls_back_from_invalid_setting`, `test_invalidate_global_signal_universe_cache_returns_deleted_key_matrix`, `test_set_and_get_global_signal_services_config_normalizes_payload`, `test_set_global_signal_retention_policy_normalizes_and_persists`, `test_set_global_signal_universe_policy_invalidates_realtime_universe_cache_keys`, `test_set_global_signal_universe_policy_normalizes_symbols_and_group_ids`, `test_signal_sources_invalidate_global_signal_universe_on_delete`, `test_signal_sources_invalidate_global_signal_universe_on_save`

### `backend/portfolio/tests/test_global_signal_universe.py`

- Classes:
  - `GlobalSignalUniverseResolverTests` -> methods: `setUp`, `test_build_snapshot_loads_system_setting_policy_with_safe_fallback`, `test_build_snapshot_returns_hybrid_effective_universe_contract`, `test_from_prefetch_runtime_settings_keeps_selected_group_symbols_warm`

### `backend/portfolio/tests/test_global_whale_alerts_service.py`

- Classes:
  - `GlobalWhaleAlertsServiceTests` -> methods: `setUp`, `test_build_whale_alert_event_id_is_deterministic_and_symbol_scoped`, `test_detect_and_store_global_whale_alerts_enqueues_distribution_for_created_events`, `test_distribute_whale_alert_event_task_loads_event_and_returns_delivery_result`, `test_persist_whale_alert_event_is_idempotent_by_event_id`, `test_run_global_whale_alert_detection_persists_events_from_effective_universe_snapshot`, `test_run_global_whale_alert_detection_updates_existing_event_instead_of_duplicate_insert`

### `backend/portfolio/tests/test_h2_replay_trace_command.py`

- Classes:
  - `H2ReplayTraceCommandTests` -> methods: `_create_user_with_config`, `test_replay_command_outputs_snapshot_and_audit_trace`

### `backend/portfolio/tests/test_latency.py`

- Classes:
  - `LatencyAuditTest` -> methods: `_build_advisory`, `test_broadcast_latency`

### `backend/portfolio/tests/test_legacy_purge_gate.py`

- Classes:
  - `LegacyPrefetchPurgeGateTests` -> methods: `test_no_legacy_prefetch_symbols_in_runtime_paths`

### `backend/portfolio/tests/test_manual_queue_policy_surfaces.py`

- Classes:
  - `ManualQueuePolicySignalAdminTests` -> methods: `setUp`, `test_signal_admin_job_retry_queues_manual_on_demand_for_dark_flow`, `test_signal_admin_jobs_run_queues_manual_on_demand_for_whale`
  - `ManualQueuePolicyStockNewsTests` -> methods: `setUp`, `test_stock_news_ai_summary_queues_manual_on_demand`

### `backend/portfolio/tests/test_market_data_service.py`

- Classes:
  - `MarketDataServiceParityTest` -> methods: `setUp`, `test_get_historical_indicators_count`, `test_get_historical_indicators_missing_symbol_returns_empty_series`, `test_get_historical_indicators_sorted_asc`, `test_get_latest_snapshot_empty`, `test_get_latest_snapshot_missing_symbol`, `test_get_latest_snapshot_parity`, `test_get_ohlcv_batch`, `test_local_context_cache`

### `backend/portfolio/tests/test_mdsu_gate.py`

- Classes:
  - `MDSUGateTest` -> methods: `test_no_direct_dailyprice_query_in_migrated_files`

### `backend/portfolio/tests/test_observability.py`

- Classes:
  - `AdminRuntimeKPITests` -> methods: `_authenticate`, `setUp`, `test_admin_runtime_kpi_advisory_merge_requires_staff`, `test_admin_runtime_kpi_advisory_merge_returns_structure`, `test_admin_runtime_kpi_anonymous_401`, `test_admin_runtime_kpi_requires_staff`, `test_admin_runtime_kpi_returns_snapshot_structure`, `test_admin_runtime_kpi_whale_pipeline_requires_staff`, `test_admin_runtime_kpi_whale_pipeline_returns_structure`, `test_admin_runtime_kpi_whale_preflight_metrics_accepts_window_days_min_max`, `test_admin_runtime_kpi_whale_preflight_metrics_compact_mode_omits_trend`, `test_admin_runtime_kpi_whale_preflight_metrics_handles_metric_reader_error`, `test_admin_runtime_kpi_whale_preflight_metrics_rejects_invalid_date_format`, `test_admin_runtime_kpi_whale_preflight_metrics_rejects_non_integer_window_days`, `test_admin_runtime_kpi_whale_preflight_metrics_rejects_window_days_out_of_range`, `test_admin_runtime_kpi_whale_preflight_metrics_requires_staff`, `test_admin_runtime_kpi_whale_preflight_metrics_returns_structure`, `test_admin_runtime_kpi_whale_preflight_metrics_supports_window_days`
  - `MarketObservabilityTests` -> methods: `authenticate`, `setUp`, `test_market_observability_health_reports_http_p95`, `test_market_observability_snapshot_contains_intraday_freshness_counters`, `test_whale_aggregate_read_does_not_pollute_whale_pipeline_freshness`, `test_whale_feed_timeout_records_fallback_and_timeout`

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

### `backend/portfolio/tests/test_operator_admin_runtime_api.py`

- Classes:
  - `OperatorAdminRuntimeApiTests` -> methods: `_authenticate`, `setUp`, `test_operator_health_requires_admin`, `test_operator_health_returns_snapshot_structure`, `test_operator_overview_requires_admin`, `test_operator_overview_returns_snapshot_structure`

### `backend/portfolio/tests/test_operator_jobs_audit_api.py`

- Classes:
  - `OperatorJobsAuditApiTests` -> methods: `_authenticate`, `setUp`, `test_operator_audit_request_detail_returns_source_record`, `test_operator_audit_requests_returns_audit_rows`, `test_operator_audit_requests_support_kind_filter`, `test_operator_jobs_requires_admin`, `test_operator_jobs_returns_job_rows`, `test_operator_jobs_support_kind_filter`

### `backend/portfolio/tests/test_operator_tenant_registry_api.py`

- Classes:
  - `OperatorTenantRegistryApiTests` -> methods: `_authenticate`, `setUp`, `test_operator_pats_returns_no_secret_and_anomaly_metadata`, `test_operator_service_accounts_returns_risk_metadata`, `test_operator_tenant_detail_returns_summary_sections`, `test_operator_tenants_requires_admin`, `test_operator_tenants_returns_filtered_registry`, `test_operator_tenants_supports_status_filter`

### `backend/portfolio/tests/test_order_flow.py`

- Classes:
  - `TestComputeCVDSeriesDB` -> methods: `setUp`, `test_bucket_has_required_keys`, `test_cumulative_cvd_accumulates`, `test_empty_symbol_returns_empty_list`, `test_returns_list`, `test_unknown_side_split_half`
  - `TestComputeTickRateDB` -> methods: `setUp`, `tearDown`, `test_result_is_cached`, `test_small_order_ratio_in_range`, `test_tick_rate_positive`, `test_unknown_symbol_returns_zero_rate`
  - `TestDetectAbsorption` -> methods: `_cvd_series`, `test_detected_when_price_locked_and_cvd_surges`, `test_empty_inputs_return_not_detected`, `test_insufficient_buckets_return_not_detected`, `test_price_locked_flag_when_price_stable`, `test_price_not_locked_when_price_moves`, `test_strength_in_range_0_100`
  - `TestDetectDarkFlow` -> methods: `_base_ticks`, `test_components_keys_present`, `test_confidence_high_when_strength_above_70`, `test_detect_dark_flow_propagates_window_minutes`, `test_no_signal_when_no_ticks`, `test_result_has_required_keys`, `test_result_includes_bucket_facts_and_session_summary_from_ticks`, `test_twap_bot_detected_when_high_tick_rate_and_small_orders`
  - `TestDetectIceberg` -> methods: `_make_ticks_at_price`, `test_confidence_low_medium_high`, `test_detected_at_min_repeat`, `test_empty_ticks_returns_not_detected`, `test_not_detected_when_fewer_than_min_repeat`, `test_ticks_outside_window_ignored`, `test_two_price_levels_picks_dominant`
  - `TestInternalHelpers` -> methods: `test_bucket_index`, `test_time_to_seconds`
  - `TestOrderFlowApi` -> methods: `setUp`, `test_order_flow_endpoint_cursor_replay_consistent`, `test_order_flow_endpoint_five_page_traversal_no_duplicate_missing`, `test_order_flow_endpoint_requires_authentication`, `test_order_flow_endpoint_returns_payload`, `test_order_flow_endpoint_supports_cursor_pagination`
  - `TestOrderFlowSignalTask` -> methods: `setUp`, `tearDown`, `test_distribution_task_fans_out_to_watchlist_only_user`, `test_distribution_task_skips_below_threshold_signal`, `test_task_deduplicates_same_event_id`, `test_task_honors_cooldown_lock`, `test_task_reads_symbols_from_effective_universe_snapshot_when_symbol_not_given`, `test_task_skips_when_disabled`, `test_task_stores_signal_when_strength_above_20`, `test_task_uses_dark_flow_severity_mapper_for_persisted_signal`
  - `TestSizeDistribution` -> methods: `_ticks_with_values`, `test_empty_ticks_returns_safe_defaults`, `test_histogram_bucketing`, `test_p95_value`, `test_single_tick`, `test_small_ratio_correct`
- Functions:
  - `_make_tick`, `_t`

### `backend/portfolio/tests/test_order_flow_source_parity.py`

- Classes:
  - `SourceParityTestBase` -> methods: `_compute_severity`, `_create_test_signals`, `setUp`
  - `TestSourceParityContractVersion` -> methods: `test_response_structure`
  - `TestSourceParityErrorHandling` -> methods: `test_invalid_cursor_graceful`, `test_limit_clamping`
  - `TestSourceParityFields` -> methods: `test_required_fields_present`
  - `TestSourceParityIdentity` -> methods: `test_event_id_stable`, `test_severity_valid`
  - `TestSourceParityPrimaryStream` -> methods: `test_cursor_replay_consistent`, `test_five_page_traversal_no_duplicates`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_partner_admin_api.py`

- Classes:
  - `PartnerAdminApiTests` -> methods: `setUp`, `test_free_plan_cannot_access_partner_machine_access`, `test_partner_routes_accept_machine_pat_authentication`, `test_partner_tenant_summary_route_returns_current_tenant_snapshot`, `test_partner_usage_and_billing_read_paths`, `test_pat_issue_list_rotate_and_revoke`, `test_rotating_pat_expires_after_grace_window`, `test_service_account_list_and_create`

### `backend/portfolio/tests/test_password_reset_templates.py`

- Classes:
  - `PasswordResetTemplateTests` -> methods: `test_send_password_reset_email_uses_rendered_templates`

### `backend/portfolio/tests/test_pr1_dark_flow_severity_semantics.py`

- Classes:
  - `TestPR1DarkFlowSeveritySemantics` -> methods: `setUp`, `test_accumulate_dark_flow_event_stores_strength_and_confidence`, `test_flush_defaults_to_whale_signal_when_no_dark_flow_strength`, `test_flush_determines_source_as_dark_flow_when_strength_present`, `test_flush_with_mixed_sources_respects_dark_flow_if_present_and_strong`, `test_merge_dark_flow_event_updates_strength_max`
  - `TestPR1GenerateAdvisoryServicesSeverity` -> methods: `setUp`, `test_dark_flow_severity_calculator_invoked_in_flush_path`

### `backend/portfolio/tests/test_pr2_tickrate_timeframe_fixes.py`

- Classes:
  - `TestPR2TickRateEdgeCases` -> methods: `test_dark_flow_missing_tick_rate`, `test_dark_flow_missing_tick_rate_per_min`, `test_dark_flow_none_components`
  - `TestPR2TickRateFieldMapping` -> methods: `setUp`, `test_dark_flow_returns_correct_tick_rate_structure`, `test_generate_component_templates_reads_tick_rate_per_min`
  - `TestPR2TimeframeAPIIntegration` -> methods: `setUp`, `test_component_generate_api_passes_window_minutes_to_detector`
  - `TestPR2TimeframeConversion` -> methods: `test_case_insensitive`, `test_convert_15m_to_15_minutes`, `test_convert_1d_to_1440_minutes`, `test_convert_1h_to_60_minutes`, `test_convert_30m_to_30_minutes`, `test_convert_4h_to_240_minutes`, `test_invalid_format_defaults_to_30`, `test_minutes_minimum_is_1`

### `backend/portfolio/tests/test_pr3_first_create_threshold.py`

- Classes:
  - `TestPR3EdgeCases` -> methods: `setUp`, `test_symbol_not_found_returns_default`, `test_zero_or_negative_threshold_handled`
  - `TestPR3FirstCreateAdvisoryIntegration` -> methods: `setUp`, `test_first_create_passes_resolved_threshold_to_task`, `test_threshold_source_included_in_payload`
  - `TestPR3ThresholdResolution` -> methods: `setUp`, `test_case_insensitive_symbol_matching`, `test_different_users_different_symbols`, `test_fallback_to_user_default_if_tracked_but_no_override`, `test_threshold_conversion_to_vnd`, `test_use_symbol_override_if_tracked_with_threshold`, `test_use_user_default_if_no_tracked_symbol`

### `backend/portfolio/tests/test_prefetch_health.py`

- Classes:
  - `PrefetchHealthSnapshotTests` -> methods: `test_fresh_ok_meta_with_sample_cache_miss_stays_healthy`, `test_prefetch_health_endpoint_returns_200_for_fresh_sample_cache_miss`, `test_stale_ok_meta_remains_unhealthy_even_when_status_is_ok`

### `backend/portfolio/tests/test_price_board_normalization.py`

- Classes:
  - `PriceBoardNormalizationTests` -> methods: `test_kbs_flat_to_multiindex_mapping`, `test_numeric_coercion_handles_invalid_data`, `test_vci_multiindex_idempotent`

### `backend/portfolio/tests/test_price_unit_normalization.py`

- Classes:
  - `PriceUnitNormalizationTests` -> methods: `test_normalise_ohlcv_keeps_vnd_values_for_daily_price_storage`, `test_normalise_ohlcv_scales_thousand_vnd_to_vnd`, `test_resolve_price_scale_to_system_unit_for_thousand_vnd_input`, `test_resolve_price_scale_to_system_unit_for_vnd_input`, `test_resolve_vnbroker_price_unit_from_dataframe_attrs`

### `backend/portfolio/tests/test_prune_system_ai_audit_logs_command.py`

- Classes:
  - `PruneSystemAIAuditLogsCommandTests` -> methods: `_create_log_with_age_days`, `setUp`, `test_dry_run_does_not_delete_rows`, `test_prune_deletes_only_rows_older_than_cutoff`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_realtime_compute.py`

- Classes:
  - `RealtimeComputeTests` -> methods: `test_build_ticker_payload_computes_vwap`, `test_build_ticker_payload_native_matches_dataframe_path`, `test_build_whale_payload_includes_explainability_fields`, `test_build_whale_payload_sell_side_explainability`, `test_detect_whale_signals_emits_threshold_hits`, `test_detect_whale_signals_selects_highest_matched_threshold_only`

### `backend/portfolio/tests/test_realtime_gateway.py`

- Classes:
  - `RealtimeGatewayTests` -> methods: `setUp`, `test_stream_broadcaster_degrades_payload_when_backpressure_high`, `test_stream_broadcaster_delivers_ticker_payload_shape`, `test_websocket_accepts_valid_token_and_subscribe`, `test_websocket_forwards_dark_flow_alert`, `test_websocket_forwards_screener_matched_event`, `test_websocket_masks_whale_advisory_detail_for_pro_plan`, `test_websocket_rejects_missing_token`

### `backend/portfolio/tests/test_realtime_ops_metrics_api.py`

- Classes:
  - `RealtimeOpsMetricsApiTests` -> methods: `setUp`, `test_increment_realtime_metric_fallback_path_updates_value`, `test_realtime_ops_metrics_requires_staff`, `test_realtime_ops_metrics_returns_json_snapshot_for_staff`, `test_realtime_ops_metrics_returns_prometheus_text_for_staff`, `test_realtime_ops_metrics_throttle_enforced`

### `backend/portfolio/tests/test_screener_api.py`

- Classes:
  - `ScreenerAuthTests` -> methods: `setUp`, `test_authenticated_empty_list`, `test_unauthenticated_list`
  - `ScreenerCRUDTests` -> methods: `_valid_payload`, `setUp`, `test_create_empty_rules_json`, `test_create_invalid_field`, `test_create_invalid_op`, `test_create_non_numeric_value`, `test_create_valid_rule`, `test_create_whale_intensity_rule`, `test_delete_other_user_rule`, `test_delete_own_rule`, `test_get_other_user_rule`, `test_get_own_rule`, `test_update_rule`
  - `ScreenerRunTests` -> methods: `_make_rule`, `_seed_snapshot`, `setUp`, `tearDown`, `test_run_no_data`, `test_run_with_flow_matching_data`, `test_run_with_matching_data`, `test_run_with_no_match`
- Functions:
  - `get_token`
- Top-level variables:
  - `DETAIL_URL`, `LIST_URL`, `RUN_URL`

### `backend/portfolio/tests/test_screener_cache_snapshot_api.py`

- Classes:
  - `ScreenerCacheSnapshotApiTests` -> methods: `_build_rule`, `setUp`, `tearDown`, `test_run_feature_flag_disabled_returns_403`, `test_run_uses_cached_master_snapshot_without_business_db_queries`
- Top-level variables:
  - `RUN_URL`

### `backend/portfolio/tests/test_seed_demo_data_whale_frontend.py`

- Classes:
  - `SeedDemoDataWhaleFrontendTests` -> methods: `test_seed_demo_data_populates_testuser_whale_frontend_data`

### `backend/portfolio/tests/test_seed_environment_standardization.py`

- Classes:
  - `SeedEnvironmentStandardizationTests` -> methods: `test_seed_demo_data_blocked_on_production_without_override`, `test_seed_environment_demo_profile_blocked_on_production_without_override`, `test_seed_environment_demo_profile_dry_run_allowed_with_env_flag`, `test_seed_environment_reference_profile_dry_run_logs_execution`

### `backend/portfolio/tests/test_seed_whale_mission_control_command.py`

- Classes:
  - `SeedWhaleMissionControlCommandTests` -> methods: `test_seed_command_populates_whale_mission_control_models`, `test_seed_command_reset_is_idempotent`

### `backend/portfolio/tests/test_services_vnstock_refactor.py`

- Classes:
  - `ServicesvnbrokerRefactorTests` -> methods: `test_fetch_exchange_lookup_uses_adapter_exchange_wrapper`, `test_fetch_market_sectors_and_groups_falls_back_when_upstream_is_empty`, `test_fetch_market_sectors_and_groups_uses_adapter_listing_wrappers`

### `backend/portfolio/tests/test_signal_admin_api.py`

- Classes:
  - `SignalAdminApiTests` -> methods: `_auth_regular`, `_auth_staff`, `setUp`, `test_cached_heavy_count_reuses_redis_value`, `test_config_preview_normalizes_without_persisting`, `test_job_retry_creates_new_queued_run`, `test_job_retry_rejects_lifecycle_runs`, `test_jobs_list_supports_page_and_page_size`, `test_jobs_run_queues_manual_whale_run_and_list_returns_it`, `test_money_flow_materialization_preview_and_run_return_confirmation_metadata`, `test_recent_events_and_retention_preview_return_expected_shapes`, `test_recent_events_support_page_and_page_size_across_merged_domains`, `test_summary_requires_staff`, `test_summary_returns_whale_dark_flow_and_retention_structure`, `test_universe_apply_requires_confirm_and_persists_policy`, `test_whale_governance_bridge_apply_requires_confirm`, `test_whale_governance_bridge_preview_and_apply_create_pending_draft`

### `backend/portfolio/tests/test_signal_service_run_registry.py`

- Classes:
  - `SignalServiceRunRegistryTests` -> methods: `test_cleanup_old_intraday_ticks_blocks_without_retention_preview`, `test_cleanup_old_intraday_ticks_creates_purge_run`, `test_cleanup_old_signal_service_runs_deletes_only_old_terminal_runs`, `test_detect_and_store_global_whale_alerts_creates_completed_signal_service_run`, `test_detect_and_store_order_flow_creates_completed_signal_service_run`, `test_detect_and_store_order_flow_marks_disabled_run_complete`, `test_materialize_money_flow_forensic_window_from_order_flow_signal_stores_raw_tick_snapshot`, `test_materialize_money_flow_forensic_window_from_whale_event_stores_raw_tick_snapshot`, `test_run_global_screener_scheduled_task_creates_lifecycle_materialization_run`, `test_run_intraday_side_backfill_apply_creates_recompute_run`

### `backend/portfolio/tests/test_starter_portfolio_service.py`

- Classes:
  - `StarterPortfolioServiceTests` -> methods: `setUp`, `test_existing_subaccount_is_not_overwritten`, `test_provision_creates_default_portfolios_and_subaccounts`, `test_provision_is_idempotent`, `test_should_provision_disabled_flag_returns_false`, `test_should_provision_respects_global_enabled_flag_and_canary`, `test_should_provision_zero_canary_returns_false`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_symbol_engagement.py`

- Classes:
  - `TestSymbolEngagement` -> methods: `setUp`, `test_activate_symbol_engagement_guard`, `test_is_intraday_fresh_market_closed`, `test_is_intraday_fresh_no_ticks`, `test_is_intraday_fresh_with_recent_ticks`, `test_warmup_task_direct_db_persist`, `test_warmup_task_locking`

### `backend/portfolio/tests/test_symbol_engagement_e2e.py`

- Classes:
  - `TestTrackedSymbolEngagementHook` -> methods: `setUp`, `test_duplicate_tracked_symbol_no_engagement`, `test_tracked_symbol_add_triggers_engagement`
  - `TestTransactionEngagementHook` -> methods: `setUp`, `test_transaction_buy_triggers_engagement`, `test_transaction_other_user_subaccount_forbidden`
  - `TestWatchlistItemEngagementHook` -> methods: `setUp`, `test_watchlist_add_triggers_engagement`, `test_watchlist_add_wrong_user_forbidden`
- Functions:
  - `_make_user`
- Top-level variables:
  - `User`

### `backend/portfolio/tests/test_system_ai_admin_api.py`

- Classes:
  - `SystemAIAdminApiTests` -> methods: `setUp`, `test_admin_audit_logs_reject_invalid_datetime_filter`, `test_admin_audit_logs_reject_invalid_order`, `test_admin_can_filter_audit_logs_by_action`, `test_admin_can_filter_audit_logs_by_date_window`, `test_admin_can_get_operator_ai_runtime_snapshot`, `test_admin_can_get_system_ai_audit_logs`, `test_admin_can_order_audit_logs_ascending`, `test_admin_can_paginate_audit_logs`, `test_admin_can_test_system_ai_connection`, `test_admin_test_connection_returns_400_when_runtime_not_ready`, `test_get_returns_default_settings_for_admin`, `test_operator_ai_runtime_requires_admin_permission`, `test_put_rejects_invalid_governance_delta_thresholds`, `test_put_rejects_invalid_prefetch_runtime_settings`, `test_put_rejects_invalid_prefetch_time_policy`, `test_put_updates_governance_delta_thresholds`, `test_put_updates_prefetch_runtime_settings`, `test_put_updates_prefetch_time_policy`, `test_put_updates_system_ai_settings`, `test_requires_admin_permission`

### `backend/portfolio/tests/test_tasks_realtime.py`

- Classes:
  - `TasksRealtimeTests` -> methods: `setUp`, `test_collect_and_publish_realtime_skips_when_intraday_disabled`, `test_is_prefetch_cache_fresh_false_when_payload_old`, `test_is_prefetch_cache_fresh_true_for_recent_prefetch_payload`

### `backend/portfolio/tests/test_tick_producer.py`

- Classes:
  - `_FakePipeline` -> methods: `__init__`, `execute`, `xadd`
  - `_FakeRedisClient` -> methods: `__init__`, `pipeline`
  - `TickProducerTests` -> methods: `test_push_intraday_ticks_pushes_oldest_first_so_latest_stream_entry_is_newest_trade`, `test_stream_max_len_is_clamped_by_hard_cap`

### `backend/portfolio/tests/test_ticker_prefetch_task.py`

- Classes:
  - `PrefetchPolicyGuardAndMetricTests` -> methods: `setUp`, `test_increment_prefetch_metric_increments_counter`, `test_prefetch_retry_countdown_with_policy_applies_multiplier_and_clamp`
  - `PrefetchSchedulerCanonicalConfigTests` -> methods: `test_celery_beat_uses_canonical_shard_scheduler_only`, `test_schedule_realtime_prefetch_shards_enqueues_due_shards`
  - `PrefetchTimePolicyResolverTests` -> methods: `test_effective_settings_follow_active_profile`, `test_resolve_profile_holiday_offhours`, `test_resolve_profile_pre_open`, `test_resolve_profile_weekend_offhours`
  - `RealtimeUniverseAndShardSchedulerTests` -> methods: `setUp`, `test_collect_realtime_symbol_universe_assigns_tier_and_stable_shard`, `test_collect_realtime_symbol_universe_includes_admin_selected_groups`, `test_resolve_scheduler_plan_degrades_cold_before_warm`, `test_resolve_scheduler_plan_emergency_override_relaxes_cadence`
  - `SessionCloseCalendarTests` -> methods: `setUp`, `test_cleanup_retention_uses_market_local_date`, `test_resolve_session_close_date_rolls_back_holiday_and_weekend`

### `backend/portfolio/tests/test_vnbroker_provider_quality.py`

- Classes:
  - `VnbrokerProviderQualityTests` -> methods: `setUp`, `test_build_runtime_recommendation_uses_current_market_phase_when_not_provided`, `test_build_runtime_recommendation_uses_quality_ranked_provider`, `test_calculate_provider_quality_score_uses_weighted_formula`, `test_price_board_sources_preserve_explicit_source`, `test_price_board_sources_use_quality_order_when_no_explicit_source`, `test_resolve_provider_order_keeps_market_phase_selections_isolated`, `test_resolve_provider_order_keeps_selected_provider_within_hysteresis`, `test_resolve_provider_order_prefers_highest_scored_provider`, `test_resolve_provider_order_uses_current_market_phase_when_not_provided`

### `backend/portfolio/tests/test_vnstock_adapter_standardized_methods.py`

- Classes:
  - `_FakeCompany` -> methods: `insider_deals`
  - `_FakeFinance` -> methods: `fundamental_snapshot`, `industry_benchmark`, `industry_peers`, `industry_rank`
  - `_FakeStockClient`
  - `vnbrokerAdapterStandardizedMethodsTests` -> methods: `_run_inline`, `test_fundamental_snapshot_returns_canonical_schema`, `test_industry_methods_attach_source_columns`, `test_insider_deals_returns_canonical_schema`

### `backend/portfolio/tests/test_watch_sync.py`

- Classes:
  - `WatchAssetSyncTests` -> methods: `setUp`, `test_sync_watchlist_prices_collects_union_of_all_watch_sources_for_admin_scope`, `test_sync_watchlist_prices_defaults_to_user_symbols_only`
  - `WatchSyncApiCooldownTests` -> methods: `setUp`, `test_watchlist_sync_endpoint_enforces_user_cooldown`

### `backend/portfolio/tests/test_whale_advisory_task.py`

- Classes:
  - `WhaleAdvisoryTaskTests` -> methods: `_create_user_config`, `setUp`, `test_auto_generate_task_filters_to_matched_symbols`, `test_auto_generate_task_queues_missing_and_stale_tracked_symbols`, `test_auto_generate_task_respects_daily_auto_refresh_limit`, `test_auto_generation_skips_if_existing_advisory`, `test_collect_realtime_prefers_symbol_override_threshold`, `test_collect_realtime_uses_user_threshold_when_symbol_override_missing`, `test_compute_advisory_severity_thresholds`, `test_detect_whale_reversal_queues_reversal_advisory`, `test_detect_whale_reversal_skips_when_event_based_disabled`, `test_flush_merged_event_passes_primary_and_sources`, `test_force_refresh_generates_new_advisory_even_if_existing`, `test_generate_task_persists_merge_metadata`, `test_merge_window_180s_schedules_single_flush_for_whale_and_dark_flow`, `test_periodic_job_uses_concise_mode_and_logs_tokens`, `test_periodic_task_metrics_use_scheduler_audit_labels`, `test_resolve_advisory_threshold_prefers_tracked_symbol_override`, `test_resolve_advisory_threshold_uses_explicit_tracked_threshold_value`, `test_task_generates_provider_aware_placeholder_when_staff_key_missing`, `test_task_persists_metrics_into_aggregate_audit_log`, `test_task_persists_snapshot_with_monotonic_sequence`, `test_task_persists_threshold_and_broadcast_metadata`, `test_task_sets_severity_based_on_value_threshold_ratio`, `test_task_skips_when_daily_auto_refresh_limit_exceeded`, `test_task_skips_when_daily_budget_exceeded`, `test_task_skips_when_event_based_advisory_disabled_for_user`, `test_task_skips_when_user_has_no_ai_model`, `test_task_uses_env_api_key_when_staff_config_has_no_saved_key`

### `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`

- Classes:
  - `WhaleAnalyticsSnapshotApiTestCase` -> methods: `setUp`, `test_invalidate_whale_analytics_snapshot_cache_bumps_symbol_revision`, `test_shared_bucket_facts_cache_reuses_raw_tick_query_across_calls`, `test_snapshot_endpoint_falls_back_to_latest_completed_session_for_weekend_trade_date`, `test_snapshot_endpoint_falls_back_to_latest_daily_price_session_for_holiday_data_gap`, `test_snapshot_endpoint_keeps_all_threshold_ticks_even_if_whale_feed_only_contains_top_subset`, `test_snapshot_endpoint_maps_auction_events_to_bucket_start`, `test_snapshot_endpoint_marks_missing_session_levels_when_price_context_incomplete`, `test_snapshot_endpoint_returns_contract_and_headers`, `test_snapshot_endpoint_returns_percentile_fields_when_historical_baseline_exists`, `test_snapshot_endpoint_reuses_cached_payload_for_identical_request`, `test_snapshot_endpoint_reuses_payload_published_by_another_request_while_lock_held`, `test_snapshot_endpoint_sets_degraded_metadata_when_intraday_ticks_missing`, `test_snapshot_endpoint_sets_degraded_metadata_when_reference_price_missing`, `test_snapshot_endpoint_skips_live_whale_feed_for_historical_trade_date`, `test_snapshot_endpoint_skips_percentile_baseline_when_disabled`, `test_snapshot_endpoint_supports_conditional_etag`, `test_snapshot_endpoint_uses_same_day_snapshot_cache_policy_after_market_close`
- Top-level variables:
  - `VN_TZ`

### `backend/portfolio/tests/test_whale_analytics_snapshot_flow_series.py`

- Classes:
  - `WhaleAnalyticsSnapshotFlowSeriesTestCase` -> methods: `_bucket`, `test_buy_strength_does_not_false_saturate_on_small_clean_bucket`, `test_buy_strength_rises_for_truly_abnormal_bucket`, `test_flow_compare_series_normalizes_cvd_around_neutral_baseline`, `test_heatmap_and_marker_series_follow_bucket_side_and_score_bounds`, `test_institutional_strength_uses_whale_context_not_buy_strength_clone`
- Top-level variables:
  - `VN_TZ`

### `backend/portfolio/tests/test_whale_broadcast.py`

- Classes:
  - `WhaleBroadcastTests` -> methods: `_create_user`, `test_broadcast_screener_matched_persists_history_and_sends_alert`

### `backend/portfolio/tests/test_whale_orders_ssot_parity.py`

- Classes:
  - `WhaleOrdersReferencePriceLookupTests` -> methods: `test_reference_price_fallback_uses_close_price_when_prev_close_missing`, `test_reference_price_falls_back_to_latest_session_not_newer_than_trade_date`
  - `WhaleOrdersSsotParityTests` -> methods: `setUp`, `test_whale_orders_endpoint_uses_canonical_feed_and_returns_orders_without_ref_price`, `test_whale_orders_filters_by_timeframe`

### `backend/portfolio/tests/test_whale_preflight_refactor.py`

- Classes:
  - `WhalePreflightCacheRefactorTests` -> methods: `test_build_preflight_metric_rates_returns_expected_percentages`, `test_build_preflight_metric_summary_returns_dashboard_fields`, `test_build_skip_response_returns_expected_shape`, `test_check_cooldown_skip_records_hit_metric`, `test_check_preflight_cache_skips_cooldown`, `test_check_preflight_cache_skips_existing_advisory_first`, `test_increment_preflight_counter_ignores_unknown_metric`, `test_kpi_schema_version_is_stable_string`, `test_metric_cache_key_uses_prefix_and_day`, `test_read_preflight_metrics_returns_zero_on_cache_error`, `test_read_preflight_metrics_window_builds_oldest_to_newest`, `test_sum_preflight_metrics_window_aggregates_numeric_values`
  - `WhalePreflightContextAssemblyTests` -> methods: `test_build_whale_generation_context_dict_keeps_legacy_aliases`, `test_prepare_whale_generation_context_uses_symbol_only_lock_key`, `test_return_with_preflight_profile_logs_skip`, `test_unwrap_or_return_skip_for_payload_tuple`, `test_unwrap_or_return_skip_for_skip_dict`

### `backend/portfolio/tests/test_whale_scoring.py`

- Classes:
  - `WhaleScoringTests` -> methods: `test_classify_severity_uses_band_contract`, `test_display_score_applies_time_decay_and_severity`, `test_event_score_is_deterministic_for_same_input`, `test_profile_v1_keeps_default_contract`, `test_profile_v2_reduces_near_threshold_buy_boost`, `test_profile_v2_uses_stricter_extreme_band`, `test_whale_payload_includes_scoring_contract_fields`

### `backend/portfolio/tests/test_whale_signal_engine.py`

- Classes:
  - `WhaleSignalEngineTestCase` -> methods: `setUp`, `test_annotate_queryset_with_threshold`, `test_classify_side`, `test_classify_size`, `test_get_user_threshold_map`, `test_resolve_threshold_default`, `test_resolve_threshold_override`

### `backend/portfolio/throttles.py`

- Classes:
  - `RealtimeOpsMetricsRateThrottle`

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

### `backend/portfolio/urls_crawl.py`

- Top-level variables:
  - `app_name`, `router`, `urlpatterns`

### `backend/portfolio/urls_realtime.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `backend/portfolio/urls_stock.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `backend/portfolio/view_helpers.py`

- Functions:
  - `_build_group_response`, `_build_price_alert_rule_row`, `_price_alert_is_triggered`

### `backend/portfolio/views.py`

- Functions:
  - `_resolve_first_create_threshold_vnd`
- Top-level variables:
  - `logger`

### `backend/portfolio/views_admin_runtime.py`

- Functions:
  - `_build_operator_advisory_audit_row`, `_build_operator_audit_rows`, `_build_operator_crawl_audit_row`, `_build_operator_crawl_job_row`, `_build_operator_health_snapshot`, `_build_operator_jobs_snapshot`, `_build_operator_overview_snapshot`, `_build_operator_pat_list_snapshot`, `_build_operator_pat_snapshot`, `_build_operator_service_account_list_snapshot`, `_build_operator_service_account_snapshot`, `_build_operator_signal_job_row`, `_build_operator_system_ai_settings_audit_row`, `_build_operator_tenant_detail_snapshot`, `_build_operator_tenant_list_snapshot`, `_build_operator_tenant_snapshot`, `_build_operator_tenant_usage_snapshot`, `_build_operator_whale_config_audit_row`, `_build_recent_operator_actions`, `_forbidden_surface_response`, `_has_surface_write_permission`, `_http_request`, `_is_celery_worker_available`, `_operator_request_id`, `_operator_tenant_queryset`, `_paginate_operator_rows`, `_parse_bool_query_param`, `_parse_multi_query_param`, `_parse_operator_limit`, `_parse_optional_positive_int`, `_resolve_operator_audit_request_record`, `_resolve_operator_tenant`, `_resolve_service_account_rotation_risk`, `_response_payload`, `_split_operator_request_id`, `_text_contains`, `_worst_risk_state`, `admin_intraday_side_backfill_apply_api`, `admin_intraday_side_backfill_preview_api`, `admin_intraday_side_backfill_status_api`, `admin_intraday_universe_warm_now_api`, `admin_runtime_kpi_advisory_merge_api`, `admin_runtime_kpi_advisory_metrics_api`, `admin_runtime_kpi_api`, `admin_runtime_kpi_whale_pipeline_api`, `admin_runtime_kpi_whale_preflight_metrics_api`, `admin_system_ai_audit_logs_api`, `admin_system_ai_settings_api`, `admin_system_ai_test_connection_api`, `admin_vnbroker_runtime_config_changelog_api`, `admin_vnbroker_runtime_config_current_api`, `admin_vnbroker_runtime_config_reset_api`, `admin_vnbroker_runtime_config_update_api`, `offpeak_vnbroker_ingest_api`, `offpeak_vnbroker_ingest_history_api`, `operator_ai_runtime_api`, `operator_audit_request_detail_api`, `operator_audit_requests_api`, `operator_health_api`, `operator_jobs_api`, `operator_overview_api`, `operator_tenant_detail_api`, `operator_tenant_pats_api`, `operator_tenant_service_accounts_api`, `operator_tenants_api`, `warm_ticker_prefetch_api`

### `backend/portfolio/views_admin_sync.py`

- Functions:
  - `sync_market_groups_api`, `sync_stock_profiles_from_snapshot_api`, `sync_stockprofile_api`

### `backend/portfolio/views_admin_vnbroker_benchmark.py`

- Functions:
  - `_count_inspect_tasks`, `_run_benchmark_background`, `admin_vnbroker_price_board_benchmark_latest_api`, `admin_vnbroker_price_board_benchmark_run_api`
- Top-level variables:
  - `_BENCHMARK_CELERY_MAX_QUEUE_DEPTH`, `_BENCHMARK_RUNNING_MAX_SECONDS`, `logger`

### `backend/portfolio/views_ai_advisory_components_summary.py`

- Functions:
  - `_build_component_generation_key`, `_estimate_component_generation_actionability`, `_estimate_component_generation_confidence`, `_legacy_views_module`, `_persist_component_generation_metrics_audit_log`, `_timeframe_to_minutes`, `stock_ai_advisory_component_clear_deleted_api`, `stock_ai_advisory_component_delete_api`, `stock_ai_advisory_component_refresh_api`, `stock_ai_advisory_component_restore_api`, `stock_ai_advisory_component_toggle_include_api`, `stock_ai_advisory_components_generate_api`, `stock_ai_advisory_summary_delete_api`, `stock_ai_advisory_summary_regenerate_api`

### `backend/portfolio/views_ai_advisory_management.py`

- Classes:
  - `WhaleAdvisoryListView` -> methods: `get_permissions`, `get_queryset`, `get_serializer_class`, `list`
- Functions:
  - `_build_advisory_canonical_payload`, `_extract_confidence_from_summary`, `_is_celery_worker_available`, `_legacy_views_module`, `_submit_advisory_generation_with_fallback`, `ai_advisory_canonical_symbol_api`, `delete_current_whale_advisory_api`, `refresh_whale_advisory_api`, `whale_advisory_auto_refresh_info_api`

### `backend/portfolio/views_ai_advisory_session.py`

- Functions:
  - `_build_session_v2_aggregate_quality_metrics`, `_build_session_v2_benchmark_enrichment`, `_build_session_v2_decision_digest`, `_build_session_v2_observability`, `_get_holistic_advisory_v1_gate_status`, `_is_holistic_advisory_v1_enabled_for_user`, `_legacy_views_module`, `_log_holistic_rollout_gate_deny`, `stock_ai_advisory_session_api`

### `backend/portfolio/views_ai_advisory_trace.py`

- Functions:
  - `_build_advisory_trace_payload_for_user`, `_legacy_views_module`, `stock_ai_advisory_observability_api`, `stock_ai_advisory_trace_api`, `stock_ai_advisory_trace_export_api`, `stock_ai_advisory_trace_list_api`

### `backend/portfolio/views_ai_runtime_stats.py`

- Functions:
  - `_ai_command_center_snapshot`, `_build_audit_diff_summary`, `_collect_audit_diff`, `_create_ai_command_center_audit_log`, `_format_audit_value`, `_get_ai_runtime_config_status`, `_get_or_create_ai_command_center_config`, `_parse_positive_int`, `ai_command_center_audit_logs_api`, `ai_config_api`, `ai_options_api`, `ai_test_connection_api`, `whale_advisory_symbol_stats_api`

### `backend/portfolio/views_analytics_extended.py`

- Classes:
  - `BulkTechnicalBySymbolsView` -> methods: `post`
  - `PortfolioTechnicalView` -> methods: `get`
- Functions:
  - `_build_symbol_technicals`, `_normalize_symbol_list`

### `backend/portfolio/views_backtest.py`

- Functions:
  - `_user_has_backtest_access`, `backtest_stats_api`
- Top-level variables:
  - `_MIN_SIGNALS_FOR_DISPLAY`, `logger`

### `backend/portfolio/views_core_compat.py`

- Classes:
  - `CoreAuthMeView` -> methods: `get`
  - `CoreCapabilitiesView` -> methods: `get`
- Functions:
  - `core_health`

### `backend/portfolio/views_crawl.py`

- Classes:
  - `CrawlAuditLogViewSet`
  - `CrawlJobViewSet` -> methods: `run`, `stop`
  - `CrawlRunViewSet`
  - `CrawlScheduleViewSet`

### `backend/portfolio/views_dark_money_history.py`

- Functions:
  - `_build_reference_price_by_trade_date`, `_build_strategy_table`, `_compute_moving_averages`, `_compute_smfi`, `_deduplicate_intraday_tick_frame`, `_floor_intraday_bucket`, `_normalize_chart_quote_price`, `_normalize_interval`, `_normalize_tick_side`, `_resolve_period_days`, `_to_unix_seconds`, `dark_money_history_api`
- Top-level variables:
  - `INTERVAL_ALIASES`, `INTRADAY_MAX_DAYS`, `MA_WINDOWS`, `PERIOD_DAYS_MAP`, `SMFI_LOOKBACK_SESSIONS`, `TRUNC_FN_MAP`, `VALID_INTERVALS`, `logger`, `vnbroker_INTERVAL_MAP`

### `backend/portfolio/views_dashboard_risk.py`

- Functions:
  - `_build_dark_flow`, `_build_stale_positions`, `_build_whale_exposure`, `_coerce_float`, `_coerce_int`, `_coerce_iso_datetime`, `_resolve_dashboard_portfolio`, `dashboard_aggregated_risk_api`
- Top-level variables:
  - `MAX_TOP_SYMBOLS`, `RISK_LOOKBACK_DAYS`, `logger`

### `backend/portfolio/views_notifications.py`

- Functions:
  - `_verify_telegram_signature`, `preferred_symbols_delete`, `preferred_symbols_list`, `telegram_generate_link`, `telegram_settings_update`, `telegram_status`, `telegram_unlink`, `telegram_webhook`
- Top-level variables:
  - `_MAX_PREFERRED_SYMBOLS`, `logger`

### `backend/portfolio/views_partner_admin.py`

- Classes:
  - `PartnerPATIssueSerializer`
  - `PartnerPATRevokeSerializer`
  - `PartnerPATRotateSerializer`
  - `PartnerServiceAccountCreateSerializer`
- Functions:
  - `_apply_cursor`, `_build_audit_metadata`, `_build_list_payload`, `_build_plan_lifecycle_summary`, `_build_quota_snapshot_row`, `_build_subscription_summary`, `_build_usage_meter_row`, `_error`, `_paginate_list`, `_request_auth_context`, `_request_id`, `_request_ip`, `_require_idempotency_key`, `_resolve_owned_pat`, `_resolve_owned_service_account`, `_resolve_period_bounds`, `_resolve_risk_state`, `_resolve_subscription_status`, `_resolve_user_config`, `_response`, `_serialize_invoice_summary`, `_serialize_pat_credential`, `_serialize_service_account`, `_serialize_tenant_summary`, `partner_billing_invoices_api`, `partner_billing_subscription_api`, `partner_pat_issue_api`, `partner_pat_list_api`, `partner_pat_revoke_api`, `partner_pat_rotate_api`, `partner_service_accounts_api`, `partner_tenant_api`, `partner_usage_meters_api`, `partner_usage_quotas_api`
- Top-level variables:
  - `PARTNER_AUTH_CLASSES`, `PARTNER_USAGE_METERS`, `partner_authentication_classes`

### `backend/portfolio/views_portfolio_watchlist.py`

- Classes:
  - `AllocationView` -> methods: `get`
  - `ChartDataView` -> methods: `get`
  - `EquityCurveView` -> methods: `get`
  - `HoldingsView` -> methods: `get`
  - `PortfolioAnalyticsView` -> methods: `get`
  - `PortfolioDetailView` -> methods: `get_queryset`
  - `PortfolioListCreateView` -> methods: `get_queryset`, `perform_create`
  - `SubAccountDetailView` -> methods: `get_queryset`
  - `SubAccountListCreateView` -> methods: `create`, `get_queryset`, `perform_create`
  - `SummaryView` -> methods: `get`
  - `SyncPricesView` -> methods: `post`
  - `TransactionDetailView` -> methods: `get_queryset`
  - `TransactionListCreateView` -> methods: `get_queryset`, `perform_create`
  - `UserConfigView` -> methods: `get_object`
  - `WatchlistGroupDetailView` -> methods: `get_permissions`, `get_queryset`
  - `WatchlistGroupListCreateView` -> methods: `get_permissions`, `get_queryset`, `perform_create`
  - `WatchlistItemCreateView` -> methods: `perform_create`
  - `WatchlistItemDeleteView` -> methods: `get_queryset`
  - `WatchlistSeedView` -> methods: `post`
  - `WatchlistSyncView` -> methods: `post`
- Functions:
  - `_acquire_sync_cooldown`, `_sync_cooldown_seconds_for_user`

### `backend/portfolio/views_realtime_aggregate_campaigns.py`

- Classes:
  - `WhaleCampaignsView` -> methods: `get`
  - `WhaleFeedAggregateView` -> methods: `get`
- Top-level variables:
  - `logger`

### `backend/portfolio/views_realtime_depth_financial.py`

- Classes:
  - `DepthChartView` -> methods: `get`
  - `FinancialMetricsView` -> methods: `get`
- Top-level variables:
  - `logger`

### `backend/portfolio/views_realtime_ops.py`

- Functions:
  - `realtime_metrics_ops_api`

### `backend/portfolio/views_realtime_symbol.py`

- Functions:
  - `symbol_investigation_api`, `whale_symbol_summary_api`
- Top-level variables:
  - `logger`

### `backend/portfolio/views_screener.py`

- Classes:
  - `ScreenerRuleDetailView` -> methods: `_get_rule`, `delete`, `get`, `put`
  - `ScreenerRuleListCreateView` -> methods: `get`, `post`
  - `ScreenerRuleRunView` -> methods: `post`
- Functions:
  - `_build_cached_match_payload`, `_build_response_from_cached_snapshot`, `_extract_master_snapshot_rows`

### `backend/portfolio/views_screener_admin.py`

- Classes:
  - `AdminGlobalScreenerRuleDetailView` -> methods: `_get_rule`, `delete`, `put`
  - `AdminGlobalScreenerRuleListView` -> methods: `get`, `post`
  - `AdminGlobalScreenerRunManualView` -> methods: `post`
  - `AdminScreenerConfigView` -> methods: `get`, `put`
  - `GlobalScreenerRuleSerializer` -> methods: `validate_name`, `validate_rules_json`
  - `ScreenerScheduleConfigSerializer` -> methods: `validate_cron_expression`
- Functions:
  - `_get_schedule_config`

### `backend/portfolio/views_sentiment.py`

- Functions:
  - `_score_to_status`, `_user_has_sentiment_access`, `sentiment_detail_api`
- Top-level variables:
  - `_SCORE_LABELS`, `logger`

### `backend/portfolio/views_signal_admin.py`

- Functions:
  - `_build_config_changes`, `_build_effective_value_preview_contract`, `_build_money_flow_freshness_snapshot`, `_build_money_flow_materialization_preview_contract`, `_build_retention_preview`, `_build_summary_domain_payload`, `_build_whale_governance_bridge_preview_contract`, `_build_whale_governance_snapshot`, `_cached_heavy_count`, `_extract_whale_governance_bridge_config`, `_latest_dark_flow_cache_payload`, `_latest_run`, `_latest_whale_cache_payload`, `_normalize_recent_events`, `_parse_bounded_positive_int`, `_parse_iso_datetime`, `_parse_money_flow_materialization_request`, `_serialize_run`, `_serialize_whale_governance_draft`, `_serialize_whale_governance_rollout`, `_serialize_whale_governance_version`, `_truthy`, `signal_admin_config_api`, `signal_admin_config_preview_api`, `signal_admin_job_retry_api`, `signal_admin_jobs_api`, `signal_admin_jobs_run_api`, `signal_admin_money_flow_materialization_preview_api`, `signal_admin_money_flow_materialization_run_api`, `signal_admin_recent_events_api`, `signal_admin_retention_preview_api`, `signal_admin_summary_api`, `signal_admin_universe_apply_api`, `signal_admin_universe_preview_api`, `signal_admin_whale_governance_bridge_apply_api`, `signal_admin_whale_governance_bridge_preview_api`
- Top-level variables:
  - `HEAVY_COUNT_CACHE_KEY_PREFIX`, `HEAVY_COUNT_CACHE_TTL_SECONDS`

### `backend/portfolio/views_stock_catalog.py`

- Classes:
  - `SecuritiesGroupListView` -> methods: `get_queryset`
  - `SecuritiesItemListView` -> methods: `get_queryset`
  - `StockProfileListView` -> methods: `get_queryset`

### `backend/portfolio/views_stock_management.py`

- Classes:
  - `PriceAlertRuleDetailView` -> methods: `delete`, `get_object`, `patch`
  - `PriceAlertRuleListCreateView` -> methods: `get`, `post`
  - `PriceAlertRuleTriggerView` -> methods: `post`
  - `SecuritiesGroupDetailView` -> methods: `delete`, `get_object`, `patch`
  - `SecuritiesGroupListCreateView` -> methods: `get`, `post`
  - `SecuritiesItemCreateView` -> methods: `post`
  - `SecuritiesItemDeleteView` -> methods: `delete`
  - `SecuritiesSeedView` -> methods: `post`
  - `SecuritiesSyncView` -> methods: `post`
  - `TrackedSymbolBulkThresholdView` -> methods: `post`
  - `TrackedSymbolDeleteView` -> methods: `_build_row`, `delete`, `patch`
  - `TrackedSymbolListCreateView` -> methods: `_enrich`, `get`, `post`
- Functions:
  - `_parse_tracked_symbol_threshold_million`
- Top-level variables:
  - `logger`

### `backend/portfolio/views_stock_news.py`

- Functions:
  - `portfolio_news_digest_api`, `stock_news_ai_summary_api`, `stock_news_api`

### `backend/portfolio/views_stock_order_flow.py`

- Functions:
  - `_enforce_opencore_feature_for_stock_endpoint`, `_enforce_opencore_quota_for_stock_endpoint`, `_timeframe_to_minutes`, `_track_opencore_stock_endpoint_usage`, `market_discovery_hub_api`, `stock_order_flow_api`, `whale_advisory_symbol_stats_api`
- Top-level variables:
  - `_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS`, `_OPENCORE_STOCK_FEATURE_KEYS`, `logger`

### `backend/portfolio/views_stock_workspace_admin.py`

- Classes:
  - `AdminOpsStatsView` -> methods: `get`
  - `StockProfileDetailView`
  - `StockWorkspaceChartView` -> methods: `get`
  - `StockWorkspaceOverviewView` -> methods: `get`
- Functions:
  - `_legacy_views_module`

### `backend/portfolio/views_whale_analytics.py`

- Functions:
  - `_build_snapshot_cache_key`, `_build_snapshot_lock_key`, `_get_or_build_snapshot_payload`, `_resolve_cache_control`, `_resolve_snapshot_cache_timeout`, `whale_analytics_snapshot_api`

### `backend/portfolio/views_whale_orders.py`

- Functions:
  - `_calculate_bubbles`, `_categorize_orders`, `_get_extreme_threshold`, `_get_reference_price`, `_get_session_start_time`, `whale_orders_by_symbol_api`
- Top-level variables:
  - `MARKET_CLOSE_HOUR`, `MARKET_OPEN_HOUR`, `TIMEZONE_VN`

### `backend/portfolio/vnbroker_compat.py`

- Functions:
  - `disable_vnbroker_upgrade_notice`, `patch_vnbroker_finance_init`
- Top-level variables:
  - `logger`

### `backend/portfolio/vnbroker_provider_benchmark.py`

- Classes:
  - `_Counter` -> methods: `merge`
- Functions:
  - `_benchmark_single_provider_concurrency`, `_build_quality_metrics_from_benchmark`, `_normalize_concurrency_levels`, `_normalize_providers`, `_normalize_runs`, `_pick_best_result`, `_run_worker_once`, `_utc_now_iso`, `build_runtime_recommendation`, `get_latest_price_board_benchmark_report`, `run_price_board_provider_benchmark`, `set_latest_price_board_benchmark_report`
- Top-level variables:
  - `BENCHMARK_CACHE_KEY`, `BENCHMARK_CACHE_TTL_SECONDS`, `DEFAULT_CONCURRENCY_LEVELS`, `DEFAULT_PROVIDERS`

### `backend/portfolio/vnbroker_provider_quality.py`

- Functions:
  - `_clamp_percent`, `_normalize_channel`, `_normalize_component_weights`, `_normalize_market_phase`, `_normalize_provider`, `_score_snapshot_sort_key`, `_selection_cache_key`, `_snapshot_cache_key`, `build_provider_quality_snapshot`, `cache_provider_quality_selection`, `cache_provider_quality_snapshot`, `calculate_provider_quality_score`, `get_provider_quality_selection`, `get_provider_quality_snapshot`, `resolve_provider_order`
- Top-level variables:
  - `PROVIDER_QUALITY_CACHE_PREFIX`, `PROVIDER_QUALITY_CACHE_TTL_SECONDS`, `PROVIDER_QUALITY_HYSTERESIS_DELTA`, `PROVIDER_QUALITY_SELECTION_CACHE_PREFIX`, `PROVIDER_QUALITY_SELECTION_TTL_SECONDS`, `QUALITY_COMPONENT_WEIGHTS`

### `backend/portfolio/vnbroker_runtime_config.py`

- Functions:
  - `coerce_vnbroker_runtime_settings`, `coerce_vnbroker_source_config`, `default_vnbroker_runtime_settings`, `default_vnbroker_source_config`, `get_vnbroker_runtime_settings`, `invalidate_vnbroker_runtime_cache`
- Top-level variables:
  - `ALLOWED_VNBROKER_SOURCES`, `SOURCE_CONFIG_DEFAULT_PRIMARY_BY_CHANNEL`, `TIMEOUT_CHANNELS`, `VNBROKER_RUNTIME_CACHE_KEY`, `VNBROKER_RUNTIME_CACHE_TTL_SECONDS`, `logger`

### `backend/portfolio/warmup_cache.py`

- Functions:
  - `_set_startup_prefetch_meta`, `run_warmup_cache`, `should_run_warmup`, `trigger_warmup_async`
- Top-level variables:
  - `PREFETCH_META_KEY`, `WARMUP_COMPLETED_KEY`, `WARMUP_IN_PROGRESS_KEY`, `logger`

### `backend/portfolio/whale_feed_helpers.py`

- Functions:
  - `_allow_vnbroker_aggregate_fallback`, `_build_aggregate_event_payload`, `_build_aggregate_event_payload_from_record`, `_build_stream_aggregate_records`, `_build_tick_timestamp`, `_build_vnbroker_aggregate_records`, `_build_whale_order_payload`, `_cache_get`, `_cache_set`, `_classify_signal_size`, `_dataframe_has_threshold_hits`, `_decode_whale_feed_cursor`, `_encode_whale_feed_cursor`, `_get_user_symbol_threshold_overrides_vnd`, `_get_user_whale_threshold_vnd`, `_is_event_timestamp_in_window`, `_is_rate_limited_error`, `_is_tick_row_in_window`, `_is_vnbroker_rate_limited`, `_mark_vnbroker_rate_limited`, `_normalize_aggregate_event_records`, `_normalize_signal_side`, `_parse_aggregate_window`, `_parse_cursor_datetime`, `_parse_cursor_matched_value`, `_resolve_user_whale_threshold_vnd`, `_resolve_whale_feed_symbols`, `_vnbroker_rate_limit_cache_key`, `_window_start_datetime`
- Top-level variables:
  - `WHALE_AGGREGATE_WINDOW_OPTIONS`, `logger`

### `backend/portfolio/whale_scoring.py`

- Functions:
  - `_aggression_bonus_for_side`, `_clamp`, `_normalize_weights`, `_resolve_scoring_profile`, `_safe_cache_get`, `calculate_display_score`, `calculate_event_score`, `classify_severity`, `resolve_whale_score_config`
- Top-level variables:
  - `_CACHE_KEY`, `_DEFAULT_SCORE_CONFIG`, `_PROFILE_DEFAULTS`

### `backend/support/__init__.py`

- No parseable top-level symbols found

### `backend/support/admin.py`

- Classes:
  - `SupportTicketAdmin`
  - `SupportTicketCounterAdmin`
  - `TicketAttachmentAdmin`
  - `TicketAttachmentInline`
  - `TicketAuditLogAdmin`
  - `TicketMessageAdmin`
  - `TicketMessageInline`

### `backend/support/apps.py`

- Classes:
  - `SupportConfig`

### `backend/support/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `backend/support/migrations/0002_alter_supportticketcounter_options_and_more.py`

- Classes:
  - `Migration`

### `backend/support/migrations/__init__.py`

- No parseable top-level symbols found

### `backend/support/models.py`

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

### `backend/support/permissions.py`

- Classes:
  - `IsStaffUser` -> methods: `has_permission`
  - `IsTicketOwnerOrStaff` -> methods: `has_object_permission`

### `backend/support/serializers.py`

- Classes:
  - `CreateTicketSerializer` -> methods: `validate_category`
  - `StaffTicketUpdateSerializer` -> methods: `validate`
  - `SupportTicketListSerializer`
  - `TicketAttachmentSerializer`
  - `TicketAuditLogSerializer`
  - `TicketMessageSerializer`
  - `TicketReplySerializer`

### `backend/support/services.py`

- Functions:
  - `build_ticket_deep_link`, `get_staff_recipients`, `queue_new_ticket_email`, `queue_ticket_reply_email`

### `backend/support/tasks.py`

- Functions:
  - `send_ticket_email`

### `backend/support/urls.py`

- Top-level variables:
  - `urlpatterns`

### `backend/support/views.py`

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

### `backend/test_pr4_migration_skeleton.py`

- Classes:
  - `TestAdvisoryAggregateAuditLogModel` -> methods: `setUp`, `test_audit_log_actor_enum_choices`, `test_audit_log_actor_id_tracks_executor_identity`, `test_audit_log_instantiation_with_required_fields`, `test_audit_log_metadata_json_supports_nested_data`, `test_audit_log_multi_user_isolation`, `test_audit_log_reason_enum_choices`
  - `TestAdvisoryAggregateSnapshotModel` -> methods: `setUp`, `test_snapshot_allows_different_seq_for_same_symbol`, `test_snapshot_expires_at_auto_set`, `test_snapshot_instantiation_with_required_fields`, `test_snapshot_json_field_stores_complex_structures`, `test_snapshot_multi_user_isolation`, `test_snapshot_unique_constraint_on_user_symbol_seq`
  - `TestEdgeCasesAndConstraints` -> methods: `setUp`, `test_audit_log_ordering_by_created_at`, `test_audit_log_with_null_composite_state`, `test_snapshot_ordering_by_seq`, `test_snapshot_with_empty_state`
  - `TestMigrationIntegration` -> methods: `test_migration_file_exists_and_is_valid_python`, `test_models_can_be_migrated_in_sequence`, `test_models_have_correct_meta_options`

### `backend/test_pr5_baseline_metrics_instrumentation.py`

- Classes:
  - `TestAdvisorySessionManagement` -> methods: `setUp`, `test_session_end_returns_metrics`, `test_session_initialization`, `test_session_reset_clears_all_metrics`, `test_session_start_flag`
  - `TestBaselineReportGeneration` -> methods: `setUp`, `test_baseline_component_participation`, `test_baseline_empty_samples_returns_empty_dict`, `test_baseline_latency_percentiles`, `test_baseline_token_statistics`, `test_generate_baseline_report_basic`
  - `TestComponentTracking` -> methods: `setUp`, `test_component_failure_recording`, `test_duplicate_component_not_repeated`, `test_record_multiple_components`, `test_record_successful_component`
  - `TestErrorRecovery` -> methods: `setUp`, `test_error_recovery_recording`, `test_multiple_error_recovery`
  - `TestPhaseTimerDecorator` -> methods: `setUp`, `test_decorator_measures_function_execution`, `test_decorator_uses_function_name_as_default_phase`
  - `TestPhaseTiming` -> methods: `setUp`, `test_multiple_phases_in_sequence`, `test_nested_phase_timing_overwrite`, `test_phase_start_stop`
  - `TestQualityScoring` -> methods: `setUp`, `test_actionability_score_bounds`, `test_actionability_with_factors`, `test_confidence_score_bounds`, `test_record_actionability_score`, `test_record_confidence_score`
  - `TestSessionIntegration` -> methods: `test_full_session_workflow`
  - `TestTokenUsageRecording` -> methods: `setUp`, `test_record_multiple_token_increments`, `test_record_single_token_usage`, `test_token_breakdown_by_source`, `test_token_zero_for_disabled_metrics`

### `backend/tests/test_adapter_canonical.py`

- Classes:
  - `TestAdapterCanonicalOutput` -> methods: `test_ensure_prices_canonical_all_price_columns`, `test_ensure_prices_canonical_empty_dataframe`, `test_ensure_prices_canonical_handles_nan_values`, `test_ensure_prices_canonical_kbs_source_detects_vnd`, `test_ensure_prices_canonical_resets_attrs`, `test_ensure_prices_canonical_vci_source_passthrough`, `test_normalize_then_canonicalize_workflow`
  - `TestAdapterParseable` -> methods: `test_canonical_dataframe_is_parseable`

### `backend/tests/test_ai_advisory_e2e_integration.py`

- Classes:
  - `AIAdvisoryPromptConfigBackendIntegrationTests` -> methods: `setUp`, `tearDown`, `test_1_regenerate_with_prompt_config_only_enabled_sources_build_context`, `test_2_regenerate_with_minimal_prompt_config_merges_with_defaults`, `test_3_regenerate_with_all_sources_disabled_uses_fallback_defaults`, `test_4_regenerate_with_invalid_indicators_filters_gracefully`, `test_5_regenerate_without_prompt_config_uses_old_behavior`, `test_6_roundtrip_frontend_sends_prompt_config_backend_processes_correctly`, `test_7_verify_lookback_clamping_in_backend`
  - `AIAdvisoryPromptConfigParserTests` -> methods: `test_parse_prompt_config_all_invalid_indicators_fallback`, `test_parse_prompt_config_clamps_lookback`, `test_parse_prompt_config_filters_invalid_indicators`, `test_parse_prompt_config_merges_with_defaults`, `test_parse_prompt_config_none_returns_defaults`
- Top-level variables:
  - `_AI_STATUS`, `_CACHE_GET`, `_FEATURE_ENFORCE`, `_QUOTA_ENFORCE`, `_SYNTHESIS`

### `backend/tests/test_ai_advisory_prompt_config.py`

- Functions:
  - `run_all`, `test_build_fundamental_context_empty_symbol`, `test_build_ownership_context_empty_symbol`, `test_build_sector_context_empty_symbol`, `test_parse_prompt_config_all_invalid_indicators_fallback`, `test_parse_prompt_config_clamp_lookback`, `test_parse_prompt_config_invalid_indicators`, `test_parse_prompt_config_none`, `test_parse_prompt_config_override`, `test_valid_technical_indicators_set`

### `backend/tests/test_price_units_canonical.py`

- Classes:
  - `TestDetectQuoteUnitHeuristic` -> methods: `test_detect_boundary_1_million`, `test_detect_boundary_below_1_million`, `test_detect_thousand_vnd_small_number`, `test_detect_vnd_large_number`
  - `TestGetQuotePriceInVND` -> methods: `test_convert_invalid_type_raises`, `test_convert_numeric_thousand_vnd`, `test_convert_quote_price_object`, `test_portfolio_value_calculation`
  - `TestIntegrationRealWorldScenarios` -> methods: `test_scenario_portfolio_value_calculation`, `test_scenario_vnstock_daily_price_ingestion`, `test_scenario_whale_transfer_threshold`
  - `TestMoneyValueClass` -> methods: `test_create_valid_money_value`, `test_money_value_invalid_unit_raises`, `test_money_value_negative_raises`, `test_money_value_to_string`
  - `TestNormalizeMoneyValue` -> methods: `test_normalize_invalid_money_unit_raises`, `test_normalize_negative_money_raises`, `test_normalize_vnd_money`
  - `TestNormalizeQuotePrice` -> methods: `test_normalize_decimal_precision`, `test_normalize_invalid_unit_raises`, `test_normalize_negative_price_raises`, `test_normalize_non_numeric_raises`, `test_normalize_thousand_vnd_passthrough`, `test_normalize_vnd_to_thousand_vnd`, `test_normalize_with_timestamp`, `test_normalize_zero_price`
  - `TestPriceSourceEnum` -> methods: `test_all_sources_defined`, `test_source_values`
  - `TestQuotePriceClass` -> methods: `test_create_valid_quote_price`, `test_quote_price_invalid_unit_raises`, `test_quote_price_negative_raises`, `test_quote_price_non_numeric_raises`, `test_quote_price_to_string`, `test_quote_price_to_vnd_conversion`, `test_quote_price_warning_on_extreme_values`, `test_quote_price_with_all_fields`
  - `TestValidateQuotePricesCanonical` -> methods: `test_validate_empty_dict`, `test_validate_fails_on_wrong_unit`, `test_validate_list_of_quote_prices`, `test_validate_warns_on_extreme_numeric_values`

### `backend/tests/test_support_api.py`

- Classes:
  - `SupportTicketApiTests` -> methods: `setUp`, `test_create_and_list_own_ticket`, `test_staff_dashboard_requires_staff_permission`, `test_staff_dashboard_returns_queue_and_sla_metrics`, `test_staff_patch_and_reply_updates_ticket`, `test_user_cannot_view_other_users_ticket`, `test_user_reply_reopens_resolved_ticket`

### `packages/core/backend/manage.py`

- Functions:
  - `main`

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

### `packages/core/backend/src/advisory/serializers.py`

- Classes:
  - `AdvisoryRecordSerializer`
  - `SystemAISettingsSerializer`

### `packages/core/backend/src/advisory/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/advisory/views.py`

- Classes:
  - `AdvisoryHistoryView` -> methods: `get`
  - `AdvisoryLatestView` -> methods: `get`
  - `AdvisoryRefreshView` -> methods: `post`
- Functions:
  - `_get_tenant`, `_manual_trigger_period`, `_manual_trigger_priority`, `_manual_trigger_quota_limit`, `_record_manual_trigger_audit`
- Top-level variables:
  - `_MANUAL_TRIGGER_BLOCKED_STATUSES`, `_MANUAL_TRIGGER_PLAN_LIMITS`, `_MANUAL_TRIGGER_PRIORITY`

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

### `packages/core/backend/src/commercial/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/commercial/models.py`

- Classes:
  - `Invoice` -> methods: `__str__`
  - `QuotaRecord` -> methods: `__str__`
  - `Subscription` -> methods: `__str__`

### `packages/core/backend/src/commercial/public_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/commercial/serializers.py`

- Classes:
  - `InvoiceSerializer`
  - `QuotaRecordSerializer`
  - `SubscriptionSerializer`

### `packages/core/backend/src/commercial/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/commercial/views.py`

- Classes:
  - `InvoiceListView` -> methods: `get_queryset`
  - `PublicLegalPagesView` -> methods: `get`
  - `QuotaListView` -> methods: `get_queryset`
  - `SubscriptionDetailView` -> methods: `get_object`

### `packages/core/backend/src/data_ingest/__init__.py`

- Classes:
  - `DataIngestConfig` -> methods: `ready`

### `packages/core/backend/src/data_ingest/apps.py`

- Classes:
  - `DataIngestConfig`

### `packages/core/backend/src/data_ingest/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/data_ingest/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/data_ingest/models.py`

- Classes:
  - `IngestJob` -> methods: `__str__`
  - `IngestRun` -> methods: `__str__`

### `packages/core/backend/src/data_ingest/tasks.py`

- Functions:
  - `fetch_and_upsert_price_board`, `sync_market_groups`
- Top-level variables:
  - `logger`

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
  - `UserProfileAdmin`

### `packages/core/backend/src/identity_access/api_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/identity_access/apps.py`

- Classes:
  - `IdentityAccessConfig`

### `packages/core/backend/src/identity_access/authentication.py`

- Classes:
  - `CorePATAuthentication` -> methods: `authenticate`, `authenticate_header`

### `packages/core/backend/src/identity_access/commercial_partner_views.py`

- Classes:
  - `PartnerBillingInvoicesView` -> methods: `get`
  - `PartnerBillingSubscriptionView` -> methods: `get`
  - `PartnerUsageMetersView` -> methods: `get`
  - `PartnerUsageQuotasView` -> methods: `get`
- Functions:
  - `_get_tenant`

### `packages/core/backend/src/identity_access/management/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/management/commands/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/management/commands/issue_vnstockchart_pat.py`

- Classes:
  - `Command` -> methods: `add_arguments`, `handle`

### `packages/core/backend/src/identity_access/management/commands/migrate_userprofiles_to_core.py`

- Classes:
  - `Command` -> methods: `_fetch_legacy_userconfigs`, `add_arguments`, `handle`

### `packages/core/backend/src/identity_access/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0002_userprofile.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/0003_alter_coretenant_plan.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/identity_access/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/identity_access/models.py`

- Classes:
  - `CorePATCredential` -> methods: `__str__`, `effective_status`, `issue_for_service_account`, `resolve_from_raw_secret`, `revoke_pat`, `save`
  - `CoreServiceAccount` -> methods: `__str__`, `clean`, `save`
  - `CoreTenant` -> methods: `__str__`, `save`, `tenant_id`
  - `UserProfile` -> methods: `__str__`
- Functions:
  - `_build_pat_secret`, `_extract_pat_prefix`, `_generate_public_id`, `_hash_pat_secret`

### `packages/core/backend/src/identity_access/partner_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/identity_access/permissions.py`

- Classes:
  - `IsCoreOperator` -> methods: `has_permission`

### `packages/core/backend/src/identity_access/serializers.py`

- Classes:
  - `CorePATCredentialSerializer`
  - `CorePATIssueResponseSerializer`
  - `CoreServiceAccountSerializer`
  - `CoreTenantSerializer`

### `packages/core/backend/src/identity_access/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/identity_access/views.py`

- Classes:
  - `PartnerUsageMetersView` -> methods: `list`
  - `PATListView` -> methods: `get_queryset`
  - `ServiceAccountDetailView` -> methods: `get_object`, `get_queryset`
  - `ServiceAccountListView` -> methods: `get_queryset`, `perform_create`
  - `TenantDetailView` -> methods: `get_object`
  - `UserProfileView` -> methods: `get`, `patch`
- Functions:
  - `issue_pat`, `partner_issue_pat`, `partner_revoke_pat`, `partner_rotate_pat`

### `packages/core/backend/src/identity_access/views_auth.py`

- Functions:
  - `_build_abilities`, `_build_auth_payload`, `_build_capabilities_payload`, `_build_entitlements`, `_build_navigation`, `_build_target`, `_current_user_config`, `_make_token`, `_normalize_user_config_payload`, `_service_account_payload`, `_tenant_payload`, `_token_expired`, `_user_payload`, `capabilities_view`, `login_view`, `logout_view`, `password_reset_confirm_view`, `password_reset_request_view`, `profile_view`, `refresh_token_view`, `register_view`, `user_config_view`, `verify_email_view`
- Top-level variables:
  - `User`, `_DEFAULT_USER_CONFIG`, `_EMAIL_VERIFY_TOKENS`, `_PASSWORD_RESET_TOKENS`, `_TOKEN_TTL_HOURS`, `_USER_CONFIG_STORE`

### `packages/core/backend/src/market_data/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/market_data/admin.py`

- Classes:
  - `DailyPriceAdmin`
  - `StockProfileAdmin`
  - `VnstockRuntimeConfigAdmin`

### `packages/core/backend/src/market_data/apps.py`

- Classes:
  - `MarketDataConfig`

### `packages/core/backend/src/market_data/legacy_views.py`

- Classes:
  - `PriceAlertDetailView` -> methods: `delete`, `patch`
  - `PriceAlertsView` -> methods: `get`, `post`
  - `PriceAlertTriggerView` -> methods: `post`
  - `StockManagementGroupsView` -> methods: `get`
  - `StockManagementLegacyBridgeView` -> methods: `_bridge`, `delete`, `get`, `patch`, `post`, `put`
  - `StockManagementSeedView` -> methods: `post`
  - `StockManagementSyncView` -> methods: `post`
  - `TrackedSymbolBulkThresholdView` -> methods: `post`
  - `TrackedSymbolDetailView` -> methods: `delete`, `patch`
  - `TrackedSymbolsView` -> methods: `get`, `post`
- Functions:
  - `_build_stock_management_group_payload`, `_build_stock_management_item_payload`, `_empty_list`, `_empty_paginated`, `_legacy_bridge_or_none_on_unavailable`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`

### `packages/core/backend/src/market_data/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_data/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/market_data/models.py`

- Classes:
  - `DailyPrice` -> methods: `__str__`
  - `StockProfile` -> methods: `__str__`
  - `VnstockRuntimeConfig` -> methods: `__str__`

### `packages/core/backend/src/market_data/public_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_data/serializers.py`

- Classes:
  - `DailyPriceSerializer`
  - `StockProfileSerializer`

### `packages/core/backend/src/market_data/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_data/views.py`

- Classes:
  - `DailyPriceListView` -> methods: `get`
  - `StockProfileDetailView` -> methods: `get`
  - `StockProfileListView` -> methods: `get`
  - `TrackedSymbolsView` -> methods: `get`, `post`

### `packages/core/backend/src/market_data/vnstock_adapter.py`

- Classes:
  - `VnstockAdapterError`
- Functions:
  - `fetch_listing_symbols`, `fetch_price_board_snapshot`, `get_active_config`, `warm_up_symbols`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/market_serving/__init__.py`

- Top-level variables:
  - `default_app_config`

### `packages/core/backend/src/market_serving/admin.py`

- Classes:
  - `SessionFactsAdmin`
  - `SymbolSnapshotAdmin`

### `packages/core/backend/src/market_serving/api_urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_serving/apps.py`

- Classes:
  - `MarketServingConfig`

### `packages/core/backend/src/market_serving/legacy_views.py`

- Classes:
  - `RealtimeLegacyBridgeView` -> methods: `_bridge`, `get`
  - `RealtimeUnifiedAlertsView` -> methods: `_apply_cursor`, `_apply_window_filter`, `_build_next_cursor`, `_compute_priority_rank`, `_decode_cursor`, `_normalize_severity`, `_normalize_symbols`, `_parse_boolean_flag`, `_parse_limit`, `_parse_severity_min`, `_parse_watchlist_group_ids`, `_parse_window`, `_resolve_scope`, `_safe_parse_ts`, `_sanitize_item`, `_serialize_alerts`, `get`
  - `RealtimeWhaleCampaignsView` -> methods: `_apply_campaign_cursor`, `_build_campaign_next_cursor`, `_build_campaign_response`, `_decode_campaign_cursor`, `_group_events_into_campaigns`, `_parse_campaign_limit`, `_parse_campaign_sort`, `_resolve_campaign_gap_minutes`, `get`
  - `RealtimeWhaleFeedAggregateView` -> methods: `_apply_whale_window_filter`, `_build_entitlements`, `_build_next_cursor`, `_build_response`, `_classify_signal_size`, `_cursor_datetime`, `_decode_cursor`, `_extract_tracked_symbols`, `_has_explicit_scope`, `_parse_sort`, `_resolve_scope`, `_resolve_tracked_symbols`, `_resolve_watchlist_symbols`, `_serialize_whale_record`, `get`
- Functions:
  - `_build_stock_management_group_payload`, `_build_stock_management_item_payload`, `_empty_list`, `_empty_paginated`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`

### `packages/core/backend/src/market_serving/materializers.py`

- Functions:
  - `_fetch_from_legacy`, `_get_legacy_db_url`, `backfill_symbol_snapshots`, `materialize_session_facts`, `materialize_symbol_snapshot`, `materialize_unified_alerts`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/market_serving/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/market_serving/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/market_serving/models.py`

- Classes:
  - `SessionFacts` -> methods: `__str__`
  - `SymbolSnapshot` -> methods: `__str__`

### `packages/core/backend/src/market_serving/serializers.py`

- Classes:
  - `SessionFactsSerializer`
  - `SymbolSnapshotSerializer`

### `packages/core/backend/src/market_serving/tasks.py`

- Top-level variables:
  - `__all__`

### `packages/core/backend/src/market_serving/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/market_serving/views.py`

- Classes:
  - `SessionFactsDetailView` -> methods: `get_object`, `retrieve`
  - `SessionFactsListView` -> methods: `get_queryset`
  - `SymbolSnapshotDetailView` -> methods: `get_object`, `retrieve`
  - `SymbolSnapshotListView` -> methods: `get_queryset`
- Functions:
  - `_session_facts_cache_key`, `_snapshot_cache_key`
- Top-level variables:
  - `_SESSION_FACTS_TTL`, `_SNAPSHOT_TTL`

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

### `packages/core/backend/src/ops_audit/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/ops_audit/urls_parity.py`

- Top-level variables:
  - `app_name`, `urlpatterns`

### `packages/core/backend/src/ops_audit/views.py`

- Classes:
  - `AuditLogListView` -> methods: `get_queryset`, `get_serializer_class`

### `packages/core/backend/src/ops_audit/views_parity.py`

- Classes:
  - `ParityLogListView` -> methods: `get_queryset`
  - `ParityPhaseCheckpointSignOffView` -> methods: `sign_off`
  - `ParityReportListView` -> methods: `get_queryset`
  - `ParityStatusView` -> methods: `get`

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

### `packages/core/backend/src/signal_intelligence/api_urls.py`

- Top-level variables:
  - `urlpatterns`

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

### `packages/core/backend/src/signal_intelligence/materializers.py`

- Functions:
  - `_deterministic_uuid`, `_fetch_from_legacy`, `_get_legacy_db_url`, `_map_alert_type`, `_map_direction`, `_map_severity`, `materialize_unified_alerts`, `materialize_whale_feed_aggregate`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/signal_intelligence/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/0002_orderflow_event.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/signal_intelligence/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/signal_intelligence/models.py`

- Classes:
  - `OrderFlowEvent` -> methods: `__str__`
  - `UnifiedAlert` -> methods: `__str__`
  - `WhaleAlertCanonical` -> methods: `__str__`

### `packages/core/backend/src/signal_intelligence/serializers.py`

- Classes:
  - `OrderFlowEventSerializer`
  - `UnifiedAlertSerializer`
  - `WhaleAlertCanonicalSerializer`

### `packages/core/backend/src/signal_intelligence/tasks.py`

- Functions:
  - `run_signal_detection_job`
- Top-level variables:
  - `__all__`

### `packages/core/backend/src/signal_intelligence/tasks_parity.py`

- Functions:
  - `_compare_json_structure`, `_compare_responses`, `_compare_structure_recursive`, `_compute_payload_hash`, `_extract_row_count`, `_make_core_shadow_request`, `shadow_run_daily_parity_report`, `shadow_run_parity_check_task`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/signal_intelligence/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/signal_intelligence/views.py`

- Classes:
  - `OrderFlowEventListView` -> methods: `get_queryset`
  - `UnifiedAlertListView` -> methods: `get_queryset`
  - `WhaleFeedAggregateView` -> methods: `get_queryset`

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
  - `UserWorkspaceConfig`

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
  - `_build_stock_management_group_payload`, `_build_stock_management_item_payload`, `_empty_list`, `_empty_paginated`
- Top-level variables:
  - `_STOCK_MANAGEMENT_COLOR_PALETTE`, `_STOCK_MANAGEMENT_DEFAULT_GROUPS`, `_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP`

### `packages/core/backend/src/user_workspace/migrations/0001_initial.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0002_add_subaccount.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/0003_dnse_lightspeed_credential_v2.py`

- Classes:
  - `Migration`

### `packages/core/backend/src/user_workspace/migrations/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/user_workspace/models.py`

- Classes:
  - `AccountSnapshot` -> methods: `__str__`, `nav`
  - `DNSECredential` -> methods: `__str__`, `get_client_id`, `get_client_secret`, `has_credentials`, `set_client_id`, `set_client_secret`
  - `Portfolio` -> methods: `__str__`
  - `SubAccount` -> methods: `__str__`
  - `Transaction` -> methods: `__str__`
  - `Watchlist` -> methods: `__str__`
  - `WatchlistItem` -> methods: `__str__`

### `packages/core/backend/src/user_workspace/serializers.py`

- Classes:
  - `DNSECredentialSerializer` -> methods: `get_is_configured`
  - `PortfolioSerializer`
  - `SubAccountSerializer`
  - `TransactionSerializer`
  - `WatchlistItemSerializer`
  - `WatchlistSerializer`

### `packages/core/backend/src/user_workspace/tasks.py`

- Functions:
  - `reconcile_all_dnse_transactions_task`, `reconcile_dnse_transactions_task`, `sync_all_dnse_balances_task`, `sync_dnse_accounts_task`, `sync_dnse_balances_task`
- Top-level variables:
  - `logger`

### `packages/core/backend/src/user_workspace/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/user_workspace/views.py`

- Classes:
  - `PortfolioDetailView` -> methods: `delete`, `get`, `patch`
  - `PortfolioListCreateView` -> methods: `get`, `post`
  - `TransactionDetailView` -> methods: `delete`, `patch`
  - `TransactionListCreateView` -> methods: `get`, `post`
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
  - `AdminOpsVnstockBenchmarkLatestView` -> methods: `get`
  - `AdminOpsVnstockBenchmarkRunView` -> methods: `post`
  - `AdminOpsVnstockConfigChangelogView` -> methods: `get`
  - `AdminOpsVnstockConfigCurrentView` -> methods: `get`, `patch`
  - `AdminOpsVnstockConfigResetView` -> methods: `post`
- Functions:
  - `_append_vnstock_changelog`, `_build_config_changes`, `_build_market_observability_snapshot`, `_build_prefetch_health_snapshot`, `_build_prefetch_runtime_settings`, `_build_prefetch_time_policy`, `_build_signal_domain_summary`, `_build_signal_freshness_snapshot`, `_build_signal_materialization_preview_contract`, `_build_signal_preview_contract`, `_build_signal_retention_preview`, `_build_signal_summary_snapshot`, `_build_signal_universe_snapshot`, `_build_signal_whale_governance_snapshot`, `_build_stats_snapshot`, `_calc_p95`, `_channel_layer_type`, `_coerce_signal_retention_policy`, `_coerce_signal_services_config`, `_coerce_signal_universe_policy`, `_deep_merge_dict`, `_derive_ai_provider`, `_get_celery_active_queues`, `_get_or_create_active_ai_settings`, `_get_or_create_active_vnstock_config`, `_is_celery_alive`, `_latest_signal_run`, `_legacy_admin_bridge_enabled`, `_legacy_admin_bridge_headers`, `_legacy_admin_bridge_response`, `_legacy_backend_url`, `_normalize_signal_recent_events`, `_normalize_symbol_list`, `_normalized_bridge_payload`, `_now_iso`, `_parse_positive_int`, `_parse_signal_materialization_request`, `_probe_cache_health`, `_record_audit_event`, `_serialize_signal_run`, `_serialize_system_ai_settings`, `_serialize_vnstock_rulebook`, `_serialize_vnstock_settings`, `_signal_freshness_state`, `_signal_ownership_snapshot`, `_signal_portfolio_symbols`, `_signal_retention_policy`, `_signal_run_queryset`, `_signal_services_config`, `_signal_universe_policy`, `_signal_watchlist_symbols`, `_signal_write_guard`, `_source_counts`, `_validate_governance_thresholds`, `_validate_vnstock_payload`, `_vnstock_extra`
- Top-level variables:
  - `DEFAULT_GOVERNANCE_DELTA_RULEBOOK`, `DEFAULT_GOVERNANCE_DELTA_THRESHOLDS`, `DEFAULT_PREFETCH_RUNTIME_RULEBOOK`, `DEFAULT_PREFETCH_RUNTIME_SETTINGS`, `DEFAULT_PREFETCH_TIME_POLICY`, `DEFAULT_PREFETCH_TIME_POLICY_RULEBOOK`, `DEFAULT_SIGNAL_OWNERSHIP`, `DEFAULT_SIGNAL_RETENTION_POLICY`, `DEFAULT_SIGNAL_SERVICES_CONFIG`, `DEFAULT_SIGNAL_UNIVERSE_POLICY`, `DEFAULT_VNSTOCK_EXTRA`, `DEFAULT_VNSTOCK_TIMEOUT_CONFIG`, `LEGACY_ADMIN_BRIDGE_TIMEOUT`, `LEGACY_BRIDGE_REQUIRED_MESSAGE`, `SIGNAL_CONFIG_WRITE_BLOCK_MESSAGE`, `SIGNAL_JOB_WRITE_BLOCK_MESSAGE`, `VNSTOCK_ALLOWED_SOURCES`, `logger`

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

### `packages/core/backend/src/vninvest_core/legacy_http_bridge.py`

- Functions:
  - `_normalized_bridge_payload`, `build_legacy_bridge_headers`, `legacy_bridge_enabled`, `legacy_bridge_response`
- Top-level variables:
  - `LEGACY_HTTP_BRIDGE_TIMEOUT`

### `packages/core/backend/src/vninvest_core/legacy_proxy.py`

- Functions:
  - `legacy_proxy_view`
- Top-level variables:
  - `PROXY_TIMEOUT`, `logger`

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

### `packages/core/backend/src/vninvest_core/queue_policy.py`

- Functions:
  - `build_celery_task_queues`, `build_scheduler_queue_map`, `build_task_routes`
- Top-level variables:
  - `CELERY_TASK_QUEUES`, `QUEUE_DOMAIN_MATRIX`, `QUEUE_NAMES`, `SCHEDULER_QUEUE_MAP`, `TASK_ROUTES`

### `packages/core/backend/src/vninvest_core/settings.py`

- Top-level variables:
  - `ADVISORY_TOKEN_BUDGET`, `ALLOWED_HOSTS`, `ASGI_APPLICATION`, `BASE_DIR`, `CACHES`, `CELERY_ACCEPT_CONTENT`, `CELERY_BEAT_SCHEDULE`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_RESULT_SERIALIZER`, `CELERY_TASK_ROUTES`, `CELERY_TASK_SERIALIZER`, `CELERY_TIMEZONE`, `CHANNEL_LAYERS`, `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_ALL_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `DATABASES`, `DATABASE_ROUTERS`, `DEBUG`, `DEFAULT_AUTO_FIELD`, `DEFAULT_FROM_EMAIL`, `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_HOST_PASSWORD`, `EMAIL_HOST_USER`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `INSTALLED_APPS`, `LANGUAGE_CODE`, `LEGACY_BACKEND_URL`, `LOGGING`, `MIDDLEWARE`, `OPENAI_API_KEY`, `OPENAI_DEFAULT_MODEL`, `REDIS_URL`, `REST_FRAMEWORK`, `ROOT_URLCONF`, `SECRET_KEY`, `SECURE_PROXY_SSL_HEADER`, `STATIC_ROOT`, `STATIC_URL`, `TEMPLATES`, `TIME_ZONE`, `USE_I18N`, `USE_TZ`, `USE_X_FORWARDED_HOST`, `WSGI_APPLICATION`, `_allowed_hosts_raw`, `_cors_origins_default`, `_cors_origins_raw`, `_csrf_trusted_origins_default`, `_csrf_trusted_origins_raw`, `_legacy_db_url`, `_redis_url`, `_secret_key_default`, `_sentry_dsn`

### `packages/core/backend/src/vninvest_core/stub_heartbeat.py`

- Functions:
  - `_health_file`, `_health_max_age_seconds`, `_now_isoformat`, `run_healthcheck`, `write_heartbeat`

### `packages/core/backend/src/vninvest_core/urls.py`

- Top-level variables:
  - `urlpatterns`

### `packages/core/backend/src/vninvest_core/utils/__init__.py`

- No parseable top-level symbols found

### `packages/core/backend/src/vninvest_core/utils/encryption.py`

- Functions:
  - `_build_fernet`, `decrypt_string`, `encrypt_string`, `hash_with_pepper`

### `packages/core/backend/src/vninvest_core/utils/legacy_stubs.py`

- Classes:
  - `GenericEmptyListView` -> methods: `get`, `post`
  - `GenericEmptyStaffView` -> methods: `get`, `post`, `put`
- Functions:
  - `_build_stock_management_group_payload`, `_build_stock_management_item_payload`, `_empty_list`, `_empty_paginated`
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
  - `AdminOpsContractApiTests` -> methods: `setUp`, `test_admin_ops_routes_resolve_to_native_contract_views`, `test_bridge_backed_admin_ops_routes_delegate_to_legacy_backend`, `test_bridge_backed_admin_ops_routes_fail_soft_without_bridge`, `test_prefetch_warm_async_dispatches_native_ingest_task`, `test_prefetch_warm_sync_returns_native_payload`, `test_runtime_kpi_aggregates_request_trace_snapshot`, `test_stats_returns_core_snapshot_shape`, `test_system_ai_settings_updates_governance_thresholds_and_blocks_prefetch_writers`, `test_vnstock_config_update_reset_and_changelog_are_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_admin_ops_signals_contract_api.py`

- Classes:
  - `AdminOpsSignalsContractApiTests` -> methods: `setUp`, `test_signal_bridge_delegates_legacy_owned_config_and_jobs`, `test_signal_events_jobs_and_guarded_writes`, `test_signal_preview_routes_return_native_contract_payloads`, `test_signal_routes_resolve_to_native_contract_views`, `test_signal_summary_and_config_return_native_payload`, `test_signal_summary_reports_bridge_write_ownership_when_legacy_bridge_enabled`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_admin_route.py`

- Classes:
  - `CoreAdminRouteTests` -> methods: `test_admin_login_page_is_servable`, `test_admin_root_redirects_to_login`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_advisory_api_routes.py`

- Classes:
  - `AdvisoryManualTriggerApiTests` -> methods: `_create_quota_record`, `_current_period`, `setUp`, `test_advisory_refresh_enforces_cooldown_between_manual_triggers`, `test_advisory_refresh_rejects_suspended_tenant`, `test_advisory_refresh_rejects_when_quota_is_exhausted`, `test_advisory_refresh_route_triggers_pending_job_and_records_audit`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_identity_access.py`

- Classes:
  - `CorePartnerServiceAccountApiTests` -> methods: `setUp`, `test_service_account_list_uses_created_at_cursor_pagination_and_create_succeeds`
  - `CorePATCredentialModelTests` -> methods: `setUp`, `test_issue_pat_returns_credential_and_raw_secret`, `test_pat_token_prefix_is_12_chars`, `test_resolve_from_raw_secret`, `test_resolve_returns_none_for_invalid_secret`, `test_revoke_pat`
  - `CoreServiceAccountModelTests` -> methods: `setUp`, `test_create_service_account`, `test_service_account_belongs_to_tenant`
  - `CoreTenantModelTests` -> methods: `setUp`, `test_create_tenant`, `test_tenant_auto_uuid`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_identity_access_api_routes.py`

- Classes:
  - `IdentityAccessApiRouteTests` -> methods: `_login_and_authenticate`, `setUp`, `test_login_me_capabilities_and_userconfig_routes_are_native`, `test_partner_service_accounts_route_is_native`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_market_data_api_routes.py`

- Classes:
  - `MarketDataApiRouteTests` -> methods: `setUp`, `test_daily_price_route_is_native`, `test_stock_profile_routes_are_native`
- Top-level variables:
  - `_src_dir`

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
  - `NativePublicBootstrapRouteTests` -> methods: `setUp`, `test_public_legal_pages_route_resolves_and_returns_results_envelope`, `test_tracked_symbols_route_bridges_to_legacy_when_enabled`, `test_tracked_symbols_route_resolves_and_returns_empty_list`
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
  - `DjangoHealthViewTests` -> methods: `setUp`, `test_capability_bootstrap_returns_navigation`, `test_health_view_returns_ok`, `test_x_request_id_generated_when_absent`, `test_x_request_id_propagated`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_saas14_materializers.py`

- Classes:
  - `TestBackfillNoLegacyUrl` -> methods: `test_no_legacy_url_returns_skipped`
  - `TestCursorPaginationClasses` -> methods: `test_alert_cursor_pagination_ordering`, `test_audit_cursor_pagination_page_size`, `test_core_cursor_pagination_defaults`
  - `TestMaterializeSessionFactsNoLegacyUrl` -> methods: `test_no_legacy_url_returns_skipped`
  - `TestMaterializeSymbolSnapshotNoLegacyUrl` -> methods: `test_no_legacy_url_returns_skipped`

### `packages/core/backend/tests/test_scheduler_management_commands.py`

- Classes:
  - `CheckSchedulerQueueDriftTestCase` -> methods: `setUp`, `test_drift_detected_with_warn_only`, `test_drift_detected_without_warn_only_exits`, `test_ignores_unknown_tasks`, `test_multiple_drifts_detected`, `test_no_drift_detected`, `test_queue_policy_ssot_is_shared_by_commands`
  - `SyncSchedulerQueuesTestCase` -> methods: `setUp`, `test_sync_ignores_unknown_tasks`, `test_sync_multiple_tasks`, `test_sync_single_task`, `test_sync_with_correct_queue_no_update`

### `packages/core/backend/tests/test_signal_intelligence_api_routes.py`

- Classes:
  - `SignalIntelligenceApiRouteTests` -> methods: `setUp`, `test_order_flow_route_is_native_and_returns_list`, `test_unified_alert_route_is_native_and_cursor_paginated`, `test_whale_feed_route_is_native_and_returns_list`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_signal_materializer_schedule.py`

- Classes:
  - `SignalMaterializerScheduleTests` -> methods: `test_runtime_and_settings_schedule_use_market_serving_materializer`, `test_runtime_schedule_does_not_double_schedule_whale_feed_materialization`, `test_signal_intelligence_critical_tasks_route_to_target_queues`

### `packages/core/backend/tests/test_stock_management_api_routes.py`

- Classes:
  - `StockManagementCompatApiRouteTests` -> methods: `setUp`, `test_groups_seed_sync_and_remaining_stock_routes_bridge_to_legacy`, `test_seed_populates_groups_and_groups_view_returns_renderable_shape`, `test_stock_management_compat_detail_and_price_alert_routes_bridge_to_legacy`
- Top-level variables:
  - `_src_dir`

### `packages/core/backend/tests/test_user_workspace_api_routes.py`

- Classes:
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

### `frontend/src/__tests__/StockDetail.prompt_config.test.js`

- Functions:
  - `AIAdvisoryPromptConfigDrawer`, `StockDetailMock`, `handleRegenerateSummary`
- Top-level variables:
  - `button`, `checkbox`, `enabledByDefault`, `fundamentalToggle`, `newConfig`, `payload`, `payloadElement`, `settingsButton`

### `frontend/src/api/auth.js`

- Functions:
  - `confirmPasswordReset`, `getCapabilitySnapshot`, `getUserConfig`, `login`, `refreshToken`, `register`, `requestPasswordReset`, `resendVerification`, `updateUserConfig`, `verifyEmail`

### `frontend/src/api/client.js`

- Functions:
  - `addTrackedSymbol`, `addWatchlistItem`, `adminIntradaySideBackfillApply`, `adminIntradaySideBackfillPreview`, `adminIntradaySideBackfillStatus`, `adminIntradayUniverseWarmNow`, `applyAdminSignalsUniverse`, `attachCoreRequestId`, `buildIdempotencyKey`, `bulkUpdateTrackedSymbolThreshold`, `clearDeletedStockAIAdvisoryComponents`, `createAdminGlobalScreenerRule`, `createPortfolio`, `createPriceAlert`, `createScreenerRule`, `createSubAccount`, `createTenantServiceAccount`, `createTransaction`, `createWatchlistGroup`, `deleteAdminGlobalScreenerRule`, `deleteCurrentWhaleAdvisory`, `deletePortfolio`, `deletePriceAlert`, `deleteScreenerRule`, `deleteStockAIAdvisoryComponent`, `deleteStockAIExecutiveSummary`, `deleteSubAccount`, `deleteTrackedSymbol`, `deleteTransaction`, `deleteWatchlistGroup`, `deleteWatchlistItem`, `fetchLegalPages`, `generateStockAIAdvisoryComponents`, `generateStockNewsAISummary`, `getAICommandCenterAuditLogs`, `getAICommandCenterConfig`, `getAIOptions`, `getAdminAuditLog`, `getAdminCrawlAuditLogs`, `getAdminCrawlJobs`, `getAdminCrawlRuns`, `getAdminGlobalScreenerRules`, `getAdminOpsStats`, `getAdminPrefetchRuntimeSettings`, `getAdminPrefetchTimePolicy`, `getAdminRuntimeKPI`, `getAdminScreenerConfig`, `getAdminSignalJobs`, `getAdminSignalRecentEvents`, `getAdminSignalsConfig`, `getAdminSignalsSummary`, `getAdminSystemAiSettings`, `getAdminVnstockBenchmarkLatest`, `getAdminVnstockConfigChangelog`, `getAdminVnstockConfigCurrent`, `getAdvisoryAutoRefreshInfo`, `getAggregateWhaleFeed`, `getAllocation`, `getAllocationBySector`, `getAnalytics`, `getBulkTechnicalsBySymbols`, `getCanonicalAIAdvisory`, `getChartData`, `getCoreOperatorAuditRequestDetail`, `getCoreOperatorAuditRequests`, `getCoreOperatorHealth`, `getCoreOperatorJobs`, `getCoreOperatorOverview`, `getCoreOperatorTenantDetail`, `getCoreOperatorTenantPATs`, `getCoreOperatorTenantServiceAccounts`, `getCoreOperatorTenants`, `getCoreRequestId`, `getDNSEConfig`, `getDNSETokenStatus`, `getDepthChart`, `getEquityCurve`, `getHoldings`, `getIntradayMatched`, `getMarketDiscoveryHub`, `getPortfolio`, `getPortfolioNewsDigest`, `getPortfolioTechnicals`, `getPortfolioUserConfig`, `getPortfolios`, `getPriceAlerts`, `getPriceBoard`, `getRVOL`, `getRealtimeHealth`, `getRealtimeTicker`, `getRealtimeTickers`, `getRealtimeWebSocketUrl`, `getScreenerRules`, `getSectorBreadth`, `getSecuritiesGroups`, `getStockAIAdvisoryObservability`, `getStockAIAdvisorySession`, `getStockFinancials`, `getStockNews`, `getStockOrderFlow`, `getStockPriceChart`, `getStockProfile`, `getStockWorkspaceOverview`, `getSubAccounts`, `getSummary`, `getTenantBillingInvoices`, `getTenantBillingSubscription`, `getTenantPATs`, `getTenantServiceAccounts`, `getTenantSummary`, `getTenantUsageMeters`, `getTenantUsageQuotas`, `getTrackedSymbols`, `getTransactions`, `getUnifiedAlerts`, `getWatchlistGroups`, `getWhaleAdvisories`, `getWhaleAdvisorySymbolStats`, `getWhaleAnalyticsSnapshot`, `getWhaleFeed`, `hasAuthTokens`, `isAuthPublicEndpoint`, `issueTenantPAT`, `markPriceAlertTriggered`, `normalizeChartTimeframe`, `normalizeListResponse`, `normalizeTenantPatWritePayload`, `normalizeTenantServiceAccountWritePayload`, `placeDNSEOrder`, `postStockAIAdvisoryObservabilityEvent`, `previewAdminSignalMaterialization`, `previewAdminSignalRetention`, `previewAdminSignalsConfig`, `previewAdminSignalsUniverse`, `refreshAccessToken`, `refreshStockAIAdvisoryComponent`, `refreshStockAIAdvisorySession`, `refreshWhaleAdvisory`, `regenerateStockAIExecutiveSummary`, `requestTokenRefresh`, `resetAdminVnstockConfig`, `restoreStockAIAdvisoryComponent`, `retryAdminSignalJob`, `revokeTenantPAT`, `rotateTenantPAT`, `runAdminCrawlJob`, `runAdminGlobalScreenerManual`, `runAdminSignalJob`, `runAdminVnstockBenchmark`, `runScreenerRule`, `seedSecurities`, `seedWatchlist`, `stopAdminCrawlJob`, `syncDNSEAccounts`, `syncMarketGroups`, `syncPrices`, `syncSecuritiesPrices`, `syncStockProfile`, `syncWatchlistPrices`, `testAICommandCenterConnection`, `toggleStockAIAdvisoryComponentInclude`, `updateAICommandCenterConfig`, `updateAdminGlobalScreenerRule`, `updateAdminPrefetchRuntimeSettings`, `updateAdminPrefetchTimePolicy`, `updateAdminScreenerConfig`, `updateAdminSignalsConfig`, `updateAdminSystemAiSettings`, `updateAdminVnstockConfig`, `updateDNSEConfig`, `updatePortfolio`, `updatePortfolioUserConfig`, `updatePriceAlert`, `updateScreenerRule`, `updateSubAccount`, `updateTrackedSymbol`, `updateTransaction`, `updateWatchlistGroup`, `warmTickerPrefetch`, `withDefaultAuditReason`
- Top-level variables:
  - `AUTH_PUBLIC_ENDPOINT_PATTERN`, `REQUEST_TIMEOUT_MS`, `WATCHLIST_GROUPS_CACHE_TTL`, `access`, `aliasMap`, `apiBaseURL`, `apiClient`, `customBase`, `getAIConfig`, `getSymbolInvestigation`, `getWhaleCampaigns`, `isDevFrontendPort`, `nextAccessToken`, `normalizedToken`, `now`, `originalRequest`, `params`, `payload`, `protocol`, `publicApiClient`, `query`, `queryString`, `rawRows`, `refresh`, `refreshRequestPromise`, `refreshToken`, `requestId`, `requestUrl`, `response`, `rows`, `scopes`, `status`, `suffix`, `symbolList`, `token`, `updateAIConfig`, `upperValue`, `value`, `watchlistGroupsCache`, `watchlistGroupsCacheTimestamp`

### `frontend/src/api/client.test.js`

- No parseable top-level symbols found

### `frontend/src/api/client.unifiedAlerts.test.js`

- Top-level variables:
  - `axiosModule`, `getUnifiedAlerts`, `mockApiClient`, `mockGet`

### `frontend/src/api/support.js`

- Functions:
  - `createSupportTicket`, `getStaffSupportDashboard`, `getSupportTicketDetail`, `listStaffSupportTickets`, `listSupportTickets`, `patchStaffSupportTicket`, `reopenSupportTicket`, `replyStaffSupportTicket`, `replySupportTicket`

### `frontend/src/App.jsx`

- Functions:
  - `AdminCoreShell`, `LoginPage`, `ProtectedLayout`
- Top-level variables:
  - `debugPagesEnabled`, `hasStoredTokens`, `location`, `navigate`, `packageShellHostEnabled`

### `frontend/src/components/adminops/GlobalScreenerAdminPanel.jsx`

- Functions:
  - `RuleToggleBadge`, `createEmptyRuleForm`, `extractApiMessage`, `fmtDateTime`, `parseRuleJson`
- Top-level variables:
  - `DEFAULT_RULE_JSON`, `confirmMessage`, `data`, `date`, `fieldErrors`, `handleDeleteRule`, `handleEditRule`, `handleResetRuleForm`, `handleRunManual`, `handleSaveConfig`, `handleSubmitRule`, `loadConfig`, `loadRules`, `nextConfig`, `normalized`, `parsed`, `payload`, `refreshAll`, `response`

### `frontend/src/components/adminops/SignalControlCenter.jsx`

- Functions:
  - `BoundaryPanel`, `JsonPreview`, `ServiceSummaryCard`, `formatAuditWarning`, `formatDateTimeValue`, `formatNumberValue`, `formatOwnershipConstraint`, `isOwnershipWritable`, `loadInitialState`, `resolvePositiveInteger`, `statusTone`
- Top-level variables:
  - `DEFAULT_PAGE_SIZE`, `WRITABLE_OWNERSHIP_STATUSES`, `applyConfigToForm`, `auditWarnings`, `buildRetentionPayload`, `buildServicesPayload`, `buildUniversePayload`, `canApplyConfig`, `canApplyUniverse`, `canRetry`, `canRunSignalJobs`, `configWriteBlockedReason`, `darkFlowPolicyPanel`, `darkFlowService`, `distribution`, `eventsRes`, `fieldLabel`, `handleApplyConfig`, `handleApplyUniverse`, `handleEventsPageChange`, `handleEventsPageSizeChange`, `handleJobsPageChange`, `handleJobsPageSizeChange`, `handleLoadEvents`, `handleLoadJobs`, `handlePreviewConfig`, `handlePreviewUniverse`, `handleRetryRun`, `handleRunJob`, `jobsRes`, `jobsStatus`, `jobsWriteBlockedReason`, `lifecycle`, `loadEventsPage`, `loadJobsPage`, `loadStaticData`, `materializationPanelPayload`, `normalized`, `numeric`, `ownerLabel`, `ownershipSnapshot`, `parsed`, `rawIntradayKeepDays`, `refreshControlCenter`, `response`, `results`, `retentionPolicy`, `retentionPolicyStatus`, `retryBusy`, `runtimeKeepDays`, `servicesConfig`, `servicesConfigStatus`, `sharedLifecyclePayload`, `statusLabel`, `storageRetentionPanelPayload`, `universePolicy`, `universePolicyStatus`, `universeWriteBlockedReason`, `updateField`, `whaleGovernancePanel`, `whaleGovernanceSnapshot`, `whaleService`, `writeGuardWarnings`

### `frontend/src/components/adminops/SignalControlCenter.test.jsx`

- Functions:
  - `buildConfigPayload`, `buildOwnershipPayload`, `buildSummaryPayload`, `buildWhaleGovernancePayload`, `warningMatcher`
- Top-level variables:
  - `jobsPageSizeSelect`, `readOnlyOwnership`, `retryButton`

### `frontend/src/components/adminops/VnstockBenchmarkPanel.jsx`

- Functions:
  - `fmtNumber`, `parseCsvList`
- Top-level variables:
  - `applyRecommendation`, `estimatedRuntimeSeconds`, `isCompleted`, `isFailed`, `isRunning`, `loadLatest`, `maxWaitMs`, `newReport`, `nextReport`, `onInput`, `payload`, `pollResp`, `pollingRef`, `prevFinishedAt`, `recommendation`, `reportStatus`, `resp`, `rlA`, `rlB`, `rows`, `runBenchmark`, `startedAt`, `topRows`, `value`

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
  - `mockGetRealtimeHealth`, `mockUseI18n`, `mockUsePersistentAlertState`, `mockUseUnifiedAlerts`, `observabilityButton`

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
  - `loadLegal`, `pages`

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
  - `ctx`, `gain`, `hasStrongAlert`, `newsItems`, `oscillator`, `recommendationsEnabled`

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
  - `breadthTotal`, `dayPL`, `dayPLPct`, `marketValue`

### `frontend/src/components/MoneyFlowDonut.jsx`

- Functions:
  - `MoneyFlowDonut`, `fmtBil`
- Top-level variables:
  - `DONUT_COLORS`, `abs`, `amountByIndex`, `centerLabel`, `donutData`, `flowNet`, `n`, `netColor`

### `frontend/src/components/OrderFlowRadarPanel.jsx`

- Functions:
  - `OrderFlowRadarPanel`, `fmtCompact`, `formatPercentDelta`
- Top-level variables:
  - `chartData`, `cvdSeries`, `darkFlow`, `latestSignal`, `liveSignal`, `liveStrength`, `n`, `numericValue`, `signals`, `sizeDistribution`, `smallOrderRatio`, `tickRate`

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

### `frontend/src/components/RuntimeKPIPanel.jsx`

- Functions:
  - `KPIRow`, `StatusDot`, `fmtCount`, `fmtMs`, `fmtPct`, `toneFor5xx`, `toneForP95`
- Top-level variables:
  - `celery`, `fetchKPI`, `id`, `intradayFreshness`, `obs`, `overall`, `prefetch`, `res`, `toneClass`, `topEndpoints`

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
  - `NavGroup`, `canNavigateTo`, `groupLinkClass`, `handleOutsideClick`
- Top-level variables:
  - `canReadAdminOps`, `canReadTenantBilling`, `canReadTenantCapabilities`, `canReadTenantHome`, `canReadTenantPATs`, `canReadTenantServiceAccounts`, `canReadTenantUsage`, `capabilityMenus`, `hasCapabilityMenus`, `portfolioItems`, `ref`, `signalItems`, `systemItems`, `tenantItems`, `tenantSurfaceEnabled`, `visibleRoutes`

### `frontend/src/components/UnifiedAlertBar.jsx`

- Functions:
  - `SummaryChip`

### `frontend/src/components/UnifiedAlertCenter.jsx`

- Functions:
  - `SummaryChip`, `sourceLabel`
- Top-level variables:
  - `cardTone`, `isUnread`, `safeAlerts`, `severity`, `severityFilters`, `sourceTone`, `typeTone`, `unreadAlertCount`

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
  - `AlertFeedCard`, `WhaleFeedPanel`, `buildFeedEventKey`, `fmtBil`, `fmtPrice`, `fmtVol`, `normalizeEventTimestamp`, `severityLabel`, `severityTone`, `sizeClassEmoji`
- Top-level variables:
  - `activeData`, `alertKind`, `count`, `dedupedHistoryOrders`, `dedupedOrders`, `eventId`, `feedViewportStyle`, `fetch`, `handleRefresh`, `isBig`, `isBuy`, `isControlled`, `isDarkFlow`, `key`, `keys`, `loading`, `matchedValue`, `n`, `normalizedSeverity`, `orders`, `parsed`, `prevCountRef`, `realtimeEventKeys`, `realtimeItems`, `resp`, `roundedMatchedValue`, `seen`, `severity`, `severityClass`, `side`, `sourceMeta`, `src`, `timestamp`, `unique`

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
  - `PortfolioContext`, `activeRefreshToken`, `authFailed`, `cancelled`, `contextValue`, `createPortfolio`, `createSubAccount`, `ctx`, `deletePortfolio`, `deleteSubAccount`, `fetchPortfolios`, `hasInitialTokens`, `initialAccessToken`, `initialRefreshToken`, `login`, `logout`, `mePayload`, `message`, `next`, `nextPortfolios`, `nextRefresh`, `ok`, `refreshAccessToken`, `register`, `res`, `resendVerification`, `response`, `saveTokens`, `status`, `syncAuthState`, `updatePortfolio`, `updateSubAccount`, `updateUserConfig`

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
  - `cleanup`, `computeNextBackoffMs`, `computeReconnectDelayMs`, `connect`, `decodeJwtPayload`, `getHttpStatus`, `getQuoteBySymbol`, `hydrateQuotes`, `isTokenExpiringSoon`, `isValidQuotePrice`, `mergeQuote`, `normalizeAlert`, `normalizeDarkFlowAlert`, `normalizeEventTimestamp`, `normalizePollSymbolCandidates`, `normalizeSymbol`, `nowIso`, `pickPollBatch`, `poll`, `readEventField`, `resolveRealtimePollIntervalMs`, `scheduleReconnect`, `sendAction`, `shouldSuppressPollingError`, `start`
- Top-level variables:
  - `MAX_WS_SUB_SYMBOLS`, `POLL_BATCH_SIZE`, `STALE_RESYNC_RETRY_MS`, `WS_HEALTHY_MIN_POLL_INTERVAL_MS`, `WS_HEALTHY_POLL_BATCH_SIZE`, `WS_HEALTHY_RECOVERY_BATCH_SIZE`, `WS_HEALTHY_RECOVERY_MIN_CANDIDATES`, `WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS`, `ageSeconds`, `applyAlert`, `applyDarkFlowAlert`, `applyMarketDiscoveryEvent`, `applyTickerUpdate`, `applyTickerUpdateThrottled`, `base`, `base64`, `batch`, `bootstrapBatchSize`, `cache`, `cancelled`, `candidateResult`, `circuitOpenUntilRef`, `consecutiveFailuresRef`, `currentAccessToken`, `decoded`, `dedupKey`, `dedupWindowMs`, `delayMs`, `destroyed`, `effectiveIntervalMs`, `eventAgeSeconds`, `eventId`, `eventTimestamp`, `existing`, `expSeconds`, `fallbackRatioPct`, `filtered`, `flushTickerUpdates`, `fresh`, `freshToken`, `freshnessSeconds`, `hasOverThreshold`, `hasOverThresholdCandidates`, `hasRecoveryCandidates`, `idx`, `inferredFreshness`, `initTimer`, `intervalId`, `isMissing`, `isOffhoursSessionClose`, `isStale`, `jitter`, `lastPollAtRef`, `lastProcessedEventIdsRef`, `latency`, `message`, `next`, `nextAgeSeconds`, `nextAlert`, `nextBackoffMs`, `nextCurrentPrice`, `nextEvent`, `nextKey`, `nextWs`, `normalized`, `normalizedAttempt`, `normalizedPayload`, `normalizedQuotes`, `normalizedSymbol`, `normalizedSymbols`, `normalizedTs`, `now`, `numeric`, `ok`, `openUntilTs`, `padded`, `parts`, `payload`, `pendingTickerUpdatesRef`, `pollBackoffMsRef`, `pollBackoffUntilRef`, `pollCandidates`, `pollCursorRef`, `pollIntervalRef`, `pollingTotal`, `quote`, `quotes`, `quotesBySymbolRef`, `realtimeStatusRef`, `reconnectAttemptRef`, `reconnectTimer`, `refreshedToken`, `remaining`, `res`, `shouldSkipDuplicateEvent`, `shouldTryAuthRefresh`, `side`, `size`, `sorted`, `staleCount`, `staleOrMissing`, `staleOverThreshold`, `staleRatioPct`, `start`, `startTimer`, `status`, `symbol`, `symbols`, `symbolsForWs`, `symbolsKey`, `symbolsRef`, `syms`, `targetIntervalMs`, `tickerRafIdRef`, `tickersMap`, `token`, `ts`, `uiRefreshP95Ms`, `update`, `updates`, `ws`, `wsHealthy`, `wsHealthyRef`, `wsUrl`

### `frontend/src/hooks/useRealtimeFeedCore.test.js`

- Top-level variables:
  - `intervalMs`, `result`

### `frontend/src/hooks/useTrustTelemetry.js`

- Top-level variables:
  - `COUNTER_KEY`, `LOG_KEY`, `appendToLocalStorage`, `counters`, `currentCount`, `currentLog`, `detail`, `emit`, `nextLog`, `trackActionAttemptBlocked`, `trackActionChecklistCompleted`, `trackExplainabilityInsufficient`, `trackExplainabilityOpened`, `trackHistoryOpened`, `trackRiskModeChanged`

### `frontend/src/hooks/useUnifiedAlerts.js`

- Functions:
  - `backendNormalized`, `darkFlowUnified`, `fetchUnifiedPage`, `fmtBil`, `formatNumberSafe`, `goToFirstUnifiedPage`, `goToLastUnifiedPage`, `goToNextUnifiedPage`, `goToPreviousUnifiedPage`, `loadSnapshotAlerts`, `localizeUnifiedDetail`, `localizeUnifiedHeadline`, `normalizeAlertText`, `normalizeSeverity`, `passesSeverity`, `toStableAlertTimestamp`
- Top-level variables:
  - `DEFAULT_UNIFIED_ALERTS_PAGE_SIZE`, `aScore`, `absPct`, `activeStack`, `alertSummary`, `bScore`, `base`, `cancelled`, `combined`, `combinedWithBackend`, `confidence`, `cursor`, `deduped`, `fallbackId`, `filtered`, `filteredUnifiedAlerts`, `formattedValue`, `hasMore`, `holdingSet`, `hotSymbols`, `incoming`, `intervalId`, `isBuy`, `key`, `lastKnownIndex`, `leftTs`, `mappings`, `mergedAlerts`, `messageCandidate`, `monitoredKey`, `nextCursor`, `normalized`, `normalizedDetail`, `normalizedHeadline`, `normalizedSeverity`, `normalizedTs`, `pct`, `priceShockMatch`, `priceShockUnified`, `quoteList`, `rawValue`, `record`, `resetStack`, `response`, `rightTs`, `scopedUnifiedAlerts`, `seen`, `sev`, `severity`, `severityRank`, `side`, `stableTs`, `staleMatch`, `staleUnified`, `strength`, `symbolMap`, `text`, `timeDelta`, `translated`, `ts`, `unifiedAlerts`, `v`, `value`, `valueText`, `watchlistSet`, `whaleAlerts`, `whaleValueMatch`

### `frontend/src/hooks/useWatchlistProcessor.js`

- Functions:
  - `activeGroupSymbols`
- Top-level variables:
  - `MAX_SPARKLINE_BUFFER`, `activeDir`, `activeGroup`, `activeGroupItems`, `activeGroupTrackedCount`, `activeGroupTrackedItems`, `activeGroupUntrackedCount`, `activeKey`, `alertSymbols`, `allRealtimeSymbols`, `buf`, `filteredGroupItems`, `filteredTracked`, `getGroupSortIndicator`, `getSparklinePrices`, `getTrackedSortIndicator`, `group`, `groupCurrentPage`, `groupStats`, `groupTotalPages`, `groupsWithRealtime`, `keyword`, `normalized`, `pagedGroupItems`, `pagedTracked`, `prevDir`, `prevKey`, `price`, `priceAlertsWithRealtime`, `priceHistoryRef`, `rows`, `sortedGroupItems`, `sortedTracked`, `splitIndex`, `start`, `toggleGroupSort`, `toggleTrackedSort`, `tracked`, `trackedCurrentPage`, `trackedStats`, `trackedSymbolMap`, `trackedSymbolSet`, `trackedSymbolsWithRealtime`, `trackedTotalPages`, `trackedWithOverrideCount`, `trackedWithUserDefaultCount`

### `frontend/src/hooks/useWhaleAdvisoryData.js`

- Functions:
  - `onDiscoveryUpdate`, `onInvalidated`, `useWhaleAdvisoryData`
- Top-level variables:
  - `ADVISORY_INVALIDATION_EVENT`, `advisories`, `advisoryResp`, `baseline`, `baselineTs`, `currentTs`, `dataItems`, `fetchData`, `fetchDataSnapshot`, `fetchWhaleStats`, `handleDeleteAdvisory`, `handleRefreshAdvisory`, `interval`, `latest`, `loadRefreshInfo`, `next`, `resp`, `success`

### `frontend/src/hooks/useWhaleAnalyticsData.js`

- Functions:
  - `createEmptyAnalyticsData`, `handleVisibilityChange`, `handleWindowFocus`
- Top-level variables:
  - `fetchData`, `firstRejected`, `includeBaseline`, `intervalId`, `normalizedSnapshots`, `normalizedTradeDate`, `requestId`, `requestIdRef`, `requestedTradeDates`, `requestedTradeDatesKey`, `selectedTradeDate`, `snapshot`, `snapshotRes`, `snapshotResults`, `timeframeWindow`

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
  - `DEFAULT_LOCALE`, `QUOTE_LOCALE_TAG`, `date`, `defaultValue`, `dictionaries`, `dictionary`, `fallbackDictionary`, `hasDefaultValue`, `localeTags`, `normalized`, `normalizedLocale`, `template`, `vnd`

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
  - `abilityCount`, `entitlements`, `planLabel`, `quotaCaps`, `quotaCount`, `tenantCanInspect`, `tenantCanManagePATs`, `tenantCanManageServiceAccounts`, `tenantCanOpen`, `tenantCanReadBilling`, `tenantCanReadUsage`

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

### `frontend/src/pages/admin/tenant/TenantPATs.jsx`

- Functions:
  - `SummaryCard`, `bootstrap`, `formatDateTime`, `handleIssue`, `handleRevoke`, `handleRotate`, `loadData`, `normalizeCommaList`, `resolveErrorMessage`
- Top-level variables:
  - `activeCount`, `canIssue`, `canRevoke`, `canRotate`, `cancelled`, `nextServiceAccounts`, `nextTokens`, `response`, `rotating`, `rotatingCount`, `serviceAccount`, `serviceAccountMap`

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

### `frontend/src/pages/AdminOps.jsx`

- Functions:
  - `AccessNotice`, `KeyValueRow`, `MiniMetric`, `Pill`, `PrefetchHealthBadge`, `RolloutStatusBadge`, `SignalBadge`, `StatCard`, `StatusBadge`, `SurfaceRedirectCard`, `SyncRow`, `fmtDateTime`, `fmtNumber`, `pageBtnClass`, `parseTime`, `pollTaskStatus`, `readProfile`, `setError`, `syncBtn`, `toneClasses`, `withTimeout`
- Top-level variables:
  - `actionTone`, `activePrefetchPolicy`, `alerts`, `anomaly`, `backfillApplyPollTimerRef`, `canApplyBackfill`, `canOpenLegacyCrawlControl`, `canWriteVnstockConfig`, `cancelled`, `clearBackfillApplyPollTimer`, `clearSyncCooldownTimer`, `cloned`, `completion`, `cooldown`, `count`, `critical`, `current`, `currentCooldown`, `currentSymbol`, `d`, `dashboard`, `dataOpsSurfaceName`, `err`, `fallback`, `fieldErrors`, `governanceRulebook`, `governanceThresholds`, `groupsPayload`, `guard`, `handleApplyVnstockBenchmarkRecommendation`, `handlePrefetchSettingsInput`, `handlePrefetchSettingsSave`, `handlePrefetchTimePolicyInput`, `handlePrefetchTimePolicyReset`, `handlePrefetchTimePolicySave`, `handleSync`, `handleThresholdInput`, `handleThresholdSave`, `handleVnstockConfigInput`, `handleVnstockConfigReset`, `handleVnstockConfigSave`, `handleWarmNow`, `inCooldown`, `initial`, `intervalId`, `intervalMin`, `isoDateRegex`, `jitterMax`, `jitterMin`, `key`, `load`, `lunchBreak`, `market`, `marketOpen`, `maxHolidayDates`, `maxIntervalMin`, `methodSuffix`, `multiplierMin`, `navigate`, `nextErrors`, `normalized`, `normalizedAction`, `numericValues`, `offhours`, `parsed`, `payload`, `phaseLabel`, `policy`, `postClose`, `preClose`, `preOpen`, `prefetch`, `prefetchRulebook`, `prefetchTimePolicyRulebook`, `primary`, `profile`, `profileIntervals`, `profiles`, `propagation`, `res`, `resourceSuffix`, `resp`, `response`, `retryAfter`, `rowsProcessed`, `rowsTotal`, `runtime`, `scalarNums`, `selected`, `st`, `startSyncCooldown`, `statsRes`, `status`, `statusSuffix`, `statusValue`, `surfacePermissions`, `symbolList`, `syncCooldownTimersRef`, `task`, `taskId`, `taskLabel`, `timeRegex`, `timerId`, `tone`, `toneMap`, `tones`, `vnstockSettings`, `vnstockSurfaceName`, `warning`, `workerRows`, `workerSummary`

### `frontend/src/pages/AdminOps.test.jsx`

- Functions:
  - `buildStatsPayload`

### `frontend/src/pages/AdminOpsShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/AiAdvisoryShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`, `location`

### `frontend/src/pages/AICommandCenter.jsx`

- Functions:
  - `AICommandCenter`, `PromptSourceTabs`, `applyAuditFilters`, `applyPromptPreset`, `applyTechnicalPreset`, `buildPromptConfigPreset`, `changePromptSourceLookback`, `clampInt`, `classNames`, `createDefaultPromptConfig`, `createDefaultSourceConfig`, `extractPromptSourceBucket`, `fetchConfig`, `fetchUserRuntimeConfig`, `getSourceDefinition`, `handleSave`, `loadAuditLogs`, `normalizePromptConfig`, `resetAuditFilters`, `savePromptConfig`, `testConnection`, `togglePromptSource`, `toggleTechnicalIndicator`, `updatePromptConfigSource`
- Top-level variables:
  - `AUDIT_ACTION_OPTIONS`, `AUDIT_PAGE_SIZE`, `DEFAULT_AI_CONFIG`, `DEFAULT_AUDIT_FILTERS`, `PROMPT_SOURCE_DEFINITIONS`, `TECHNICAL_INDICATOR_OPTIONS`, `activeSourceCount`, `afterSnapshot`, `apiKey`, `baseConfig`, `beforeSnapshot`, `currentConfig`, `currentPromptConfig`, `currentSource`, `definition`, `effectiveRuntimeMessage`, `effectiveRuntimeModel`, `effectiveRuntimeProvider`, `effectiveRuntimeSource`, `enabled`, `eventBasedAdvisoryDisabled`, `eventBasedAdvisoryEnabled`, `eventBasedAdvisoryLabel`, `indicatorCount`, `indicators`, `isSelected`, `legacyStockAdvisory`, `legacyTasks`, `limit`, `nextConfig`, `nextFilters`, `nextIndicators`, `nextPromptConfig`, `nextSource`, `normalized`, `normalizedPromptConfig`, `offset`, `parsed`, `payload`, `rawIndicators`, `rawSource`, `resp`, `responseData`, `runtimePolicySummary`, `runtimeSummaryCards`, `selectedIndicators`, `sourceBucket`, `sourceConfig`, `stockAdvisory`, `totalAuditPages`

### `frontend/src/pages/AICommandCenterShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/Dashboard.jsx`

- No parseable top-level symbols found

### `frontend/src/pages/DashboardShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`

### `frontend/src/pages/LegacyDashboard.jsx`

- Functions:
  - `DashboardPanelFallback`, `buildFallbackSparkline`, `handleSync`, `hydrateHeatmapSparkline`, `normalizeSymbol`, `scheduleHydration`, `toArray`
- Top-level variables:
  - `AllocationPieChart`, `CONCURRENCY`, `EquityVsBenchmarkChart`, `PortfolioAnalyticsPanel`, `PortfolioDigestPanel`, `avgPositionSize`, `base`, `batch`, `batchResults`, `cancelled`, `changePct`, `current`, `delayTimer`, `delta`, `existing`, `fetchData`, `fetched`, `handleSeverityBarFilter`, `heatmapData`, `held`, `holdingSymbols`, `holdingsMap`, `idleHandle`, `industry`, `industryRaw`, `liveHoldings`, `liveSummary`, `marketValue`, `monitoredQuotes`, `monitoredSymbols`, `next`, `nominalSize`, `payload`, `points`, `prev`, `quote`, `realizedPL`, `realtimeDeltaVsSnapshot`, `realtimeMarketBreadth`, `realtimeStalePositions`, `res`, `resp`, `results`, `settled`, `snapshotMarketValue`, `sparkline24`, `symbolsToHydrate`, `syncButtonLabel`, `total`, `totalHeldValue`, `trackedDisplaySize`, `trackedInfo`, `trackedSymbolMap`, `trackedSymbolNames`, `trades`, `unreadUnifiedCount`, `unrealizedPL`, `unrealizedPLPctValue`, `unrealizedPLValue`

### `frontend/src/pages/modern/ModernDashboard.jsx`

- Functions:
  - `SidebarPanelFallback`, `buildFallbackSparkline`, `normalizeSymbol`, `scheduleAuxFetch`, `toArr`
- Top-level variables:
  - `AIAdvisorAlertPanel`, `ModernSidebar`, `analyticsResult`, `avgPositionSize`, `base`, `baseSymbolUniverse`, `bulkResp`, `bulkSymbols`, `changePct`, `clearDeferredAuxFetch`, `cp`, `current`, `deferredAuxIdleRef`, `deferredAuxTimerRef`, `delta`, `digestFetchInFlightRef`, `digestResp`, `fallbackResp`, `fetchData`, `fetchRequestTokenRef`, `heatmapData`, `held`, `holdingsMap`, `industry`, `liveHoldings`, `loadAuxiliaryDashboardData`, `monitoredSymbols`, `nextHoldings`, `nextTracked`, `nextWatchlistGroups`, `nominalSize`, `prev`, `quote`, `realtimeMarketBreadth`, `requestPortfolioDigest`, `requestToken`, `results`, `sparkline24`, `symbol`, `symbolSet`, `symbolUniverse`, `toggleSeverityFilterFromSummary`, `totalHeldValue`, `trackedInfo`, `trackedMap`, `trackedSymbolNames`, `unreadUnifiedCount`

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

### `frontend/src/pages/StockDetail.jsx`

- Functions:
  - `BreadthMiniPanel`, `FinancialMetricsPanel`, `IntradayMatchedPanel`, `KLineChartComponent`, `MetricRow`, `PriceDepthPanel`, `_getDefaultPromptConfig`, `_normalizeAdvisoryPromptConfig`, `advisoryActionLabel`, `advisoryGovernanceEndpointLabel`, `advisoryGovernanceReasonLabel`, `advisoryPromptSourceLabel`, `advisoryRetryOutcomeBadgeClass`, `advisoryRetryOutcomeLabel`, `advisoryRiskLabel`, `advisoryStatusLabel`, `advisorySynthesisPreferenceLabel`, `biasMeta`, `emitAdvisoryInvalidation`, `fetchChart`, `fetchOverview`, `fetchTickerSnapshot`, `fetchWatchlistGroups`, `finiteNumberOrNull`, `fmtPrice`, `fmtVol`, `formatChartAxis`, `formatPercent`, `formatPercentDelta`, `governanceDeltaSeverity`, `governanceDeltaSeverityClass`, `governanceDeltaSeverityLabel`, `handleAddToWatchlist`, `handleClearDeletedAdvisoryComponents`, `handleCreateAlert`, `handleDeleteAdvisoryComponent`, `handleDeleteExecutiveSummary`, `handleGenerateAdvisoryComponents`, `handleRefreshActiveAdvisoryComponent`, `handleRegenerateExecutiveSummary`, `handleRemoveFromWatchlist`, `handleRestoreAdvisoryComponent`, `handleToggleComponentInclude`, `handleToggleTracked`, `isRealtimeQuoteScaleCompatible`, `loadPromptConfig`, `persistPromptConfig`, `pickRealtimeQuoteCandidate`, `refreshWorkspace`, `run`, `runRefresh`, `shouldSuppressTransportError`, `showWorkspaceMessage`
- Top-level variables:
  - `ADVISORY_INVALIDATION_EVENT`, `STALE_RESYNC_RETRY_MS`, `ability`, `activeAdvisoryComponent`, `activeIds`, `advisory`, `advisoryConflictRetryCountRef`, `advisoryConflictRetryTimeoutRef`, `advisoryInvalidationKeyRef`, `advisoryKey`, `advisoryParams`, `advisoryPromptConfigLastSavedRef`, `advisoryPromptConfigLoadedRef`, `advisoryRetryTelemetrySyncKeyRef`, `asks`, `attempt`, `availableWatchlistGroups`, `averagePrice`, `avgVol`, `backoffUntilRef`, `baseline`, `baselinePrice`, `baselineY`, `bids`, `buildChartContextPayload`, `buyCount`, `canAutoRetry`, `canViewAdvancedTab`, `cancelled`, `candidatePrice`, `ceilingPrice`, `cfg`, `cfgResp`, `changeClass`, `changePct`, `changeValue`, `chartPerformance`, `chartWindowHint`, `close`, `conflictState`, `contextUsage`, `cooldown`, `critical`, `currentComponents`, `currentPrice`, `currentSession`, `debounceRef`, `deletedComponent`, `deletedCount`, `deltaSeverity`, `denyTotal`, `depth`, `display`, `downCount`, `events`, `fallback`, `fallbackFromTs`, `fallbackToTs`, `fetchAdvisoryObservability`, `fetchAdvisorySession`, `fetchData`, `fetchOrderFlow`, `fetchTrades`, `filteredPersistedRetryEvents`, `firstClose`, `flatCount`, `flattenedSnapshotOrders`, `floorPrice`, `fromTs`, `generatedPayload`, `generatedResp`, `generationSource`, `governanceEndpointBreakdown`, `governanceEndpointOptions`, `governanceReasonBreakdown`, `governanceReasonOptions`, `governanceSparkline`, `governanceTrendRows`, `height`, `id`, `inFlightRef`, `incomingTrades`, `interval`, `intervalId`, `isTransientEmpty`, `isUpstreamUnavailable`, `key`, `lastClose`, `latest`, `latestDeltaVsBaseline`, `latestVol`, `liveAveragePrice`, `liveCeilingPrice`, `liveChangeValue`, `liveCurrentPrice`, `liveFloorPrice`, `liveHighPrice`, `liveLowPrice`, `liveQuote`, `liveReferencePrice`, `liveVolume`, `map`, `marketGroups`, `max`, `maxDeny`, `maxPoint`, `maxRetryAttempts`, `maxValue`, `message`, `min`, `next`, `nextComponents`, `nextDeletedComponents`, `nextSummaries`, `nextWarnings`, `normalizedConfig`, `normalizedPoints`, `normalizedSources`, `normalizedSymbol`, `now`, `numericValue`, `overviewChangeValue`, `overviewClosePrice`, `overviewCurrentPrice`, `params`, `parsed`, `payload`, `peers`, `pointItems`, `points`, `polylinePoints`, `prevDarkFlowRef`, `prevVolumeRef`, `prevWhaleRef`, `previous`, `promptConfig`, `ratio`, `ref`, `referencePrice`, `refreshWhaleFeed`, `refreshed`, `resolvedRealtimeQuote`, `resp`, `response`, `responseConfig`, `restored`, `retryAttemptsUsed`, `retryDelayMs`, `retryEventReasonOptions`, `retrySeconds`, `row`, `rows`, `selectedSessionMaterialization`, `selectedSessionReadPath`, `selectedTradeDate`, `sellCount`, `serializedConfig`, `sessionAdvisory`, `sessionPayload`, `sessionResp`, `snapshotOrders`, `sortedTrades`, `source`, `sourceGroupId`, `status`, `summary`, `symbolAlerts`, `symbolDarkFlowAlert`, `symbolWhaleAlert`, `syncKey`, `targetPrice`, `technicalBias`, `technicalBiasFallback`, `thresholds`, `tickerData`, `timer`, `toTs`, `topCohort`, `topEndpoint`, `topReason`, `total`, `totalVol`, `tradesCountRef`, `ts`, `unique`, `upCount`, `updated`, `values`, `visibleChartPoints`, `vol`, `warning`, `warningSuffix`, `watchlistMemberships`, `whaleSignalsForChart`, `width`, `withinRange`, `x`, `y`, `years`

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
  - `loadData`, `onField`, `saveGeneralSettings`
- Top-level variables:
  - `mounted`, `userCfg`, `userResp`

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
  - `BUBBLE_TIMEFRAME_OPTIONS`, `MAX_CHART_FLOW_TRADE_DATES`, `advisoryParams`, `advisoryRequestIdRef`, `cancelled`, `chartAnalyticsTimeframe`, `chartHistoryTradeDates`, `conflictState`, `darkFlowItems`, `feedRequestIdRef`, `feedResp`, `fetchAdvisorySession`, `fetchFeed`, `fetchOverview`, `flattenedSnapshotOrders`, `historyTradeDates`, `id`, `liveBoardAlerts`, `lt`, `n`, `nextChartData`, `normalizedSymbol`, `overviewRequestIdRef`, `overviewResp`, `payload`, `prevWhaleRef`, `requestId`, `response`, `rt`, `selectedTradeDate`, `snapshotOrders`, `symbolDarkFlowAlert`, `symbolWhaleAlert`, `whaleItems`, `whaleSignalsForChart`

### `frontend/src/pages/WhaleAlertsHub.jsx`

- Functions:
  - `AdvisoryPreviewCard`, `AggregateFeedCard`, `CampaignCard`, `CampaignDetailModal`, `SymbolInvestigationPanel`, `TrackedSymbolCard`, `buildAggregateEventKey`, `buildSymbolStatsFromFeed`, `buildTrackedSymbolBuckets`, `formatCompactMoney`, `formatDuration`, `formatMoney`, `formatTime`, `getAggregateSourceMeta`, `getCampaignSideLabel`, `getCampaignTypeLabel`, `getFrequencyLabel`, `getSeverityLabel`, `getSeverityTone`, `getSideTone`, `getSizeClassLabel`, `getThresholdSourceLabel`, `isCountableWhaleOrder`, `loadInitialCampaigns`, `mergeUniqueAggregateEvents`
- Top-level variables:
  - `FEED_PAGE_SIZE_OPTIONS`, `abnormalityScore`, `abnormalityTone`, `activeWatchlistGroup`, `activeWatchlistGroupId`, `advisoryRequest`, `aggregateAbortRef`, `aggregateDisplayedCount`, `aggregateRequestSeqRef`, `aggregateSourceMeta`, `aggregateTotalCount`, `alertTimeRaw`, `avgValue`, `bootstrapRequestSeqRef`, `buyRatio`, `campaignAbortRef`, `campaignRequestSeqRef`, `campaigns`, `canReadAdvisory`, `cancelled`, `candidateTime`, `checkList`, `coObsSummary`, `currentTime`, `fallbackSymbol`, `fetchData`, `filteredCampaigns`, `freq`, `groupedTimeline`, `handleHideLess`, `handleLoadMore`, `handleLoadMoreCampaigns`, `handleSortChange`, `hasExplain`, `hours`, `investigation`, `isBuy`, `isOrderSide`, `key`, `loadAggregateFeed`, `loadCampaigns`, `loadData`, `localController`, `location`, `map`, `merged`, `minutes`, `nextItems`, `normalized`, `normalizedSeverity`, `normalizedSide`, `normalizedSizeClass`, `normalizedSource`, `packageShellHostEnabled`, `params`, `parsed`, `parsedId`, `payload`, `primaryTime`, `query`, `raw`, `requestSeq`, `requestSignal`, `response`, `scopeLabel`, `seen`, `severityTone`, `shellHostHref`, `side`, `sideTone`, `signals`, `sourceKeys`, `sourceMixLabel`, `st`, `strength`, `sym`, `symbol`, `symbolShortcuts`, `symbolStatsMap`, `tone`, `totalOrders`, `trackedSymbolsRequest`, `type`, `unique`, `watchlistGroupId`, `watchlistGroupsRequest`, `whaleAvgPrice`, `whyList`

### `frontend/src/pages/WhaleAlertsHub.test.jsx`

- Functions:
  - `renderPage`, `setupCommonMocks`
- Top-level variables:
  - `campaignA`, `campaignB`, `secondCall`

### `frontend/src/pages/WhaleAlertsShellHost.jsx`

- Top-level variables:
  - `bootstrapLoader`, `location`

### `frontend/src/setupProxy.js`

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

### `frontend/src/utils/requestCancellation.js`

- Functions:
  - `isRequestCanceled`
- Top-level variables:
  - `code`, `message`, `name`

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
  - `generateRequestId`, `getSessionFacts`, `getSymbolSnapshot`, `getUnifiedAlerts`, `getWhaleFeedAggregate`
- Top-level variables:
  - `CORE_API_PREFIX`, `coreClient`, `query`, `r`, `response`, `search`, `token`

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

### `packages/opencore-site/.next/server/app/[locale]/blog/[slug]/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/blog/[slug]/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/blog/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/blog/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/chart/docs/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/chart/docs/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/chart/embed/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/chart/embed/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/chart/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/chart/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/legal/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/legal/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/pricing/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/pricing/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/vnstock/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/vnstock/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/vnstock/playground/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/[locale]/vnstock/playground/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/_not-found/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/_not-found/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/api/bars/[symbol]/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/api/bars/[symbol]/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/api/health/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/api/health/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/api/public/vnstock-data/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/api/public/vnstock-data/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/robots.txt/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/robots.txt/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/sitemap.xml/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/app/sitemap.xml/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/119.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/140.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/331.js`

- Functions:
  - `middleware`

### `packages/opencore-site/.next/server/chunks/589.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/611.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/692.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/789.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/93.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/chunks/931.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/edge-runtime-webpack.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/interception-route-rewrite-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/middleware-build-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/middleware-react-loadable-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/next-font-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/pages/_app.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/pages/_document.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/pages/_error.js`

- Functions:
  - `middleware`

### `packages/opencore-site/.next/server/server-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/server/src/middleware.js`

- Functions:
  - `middleware`

### `packages/opencore-site/.next/server/webpack-runtime.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/blog/[slug]/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/blog/[slug]/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/blog/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/blog/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/chart/docs/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/chart/docs/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/chart/embed/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/chart/embed/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/chart/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/chart/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/legal/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/legal/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/pricing/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/pricing/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/vnstock/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/vnstock/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/vnstock/playground/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/[locale]/vnstock/playground/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/_not-found/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/_not-found/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/api/bars/[symbol]/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/api/bars/[symbol]/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/api/health/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/api/health/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/api/public/vnstock-data/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/api/public/vnstock-data/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/page.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/page_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/robots.txt/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/robots.txt/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/sitemap.xml/route.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/app/sitemap.xml/route_client-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/119.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/140.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/331.js`

- Functions:
  - `middleware`

### `packages/opencore-site/.next/standalone/.next/server/chunks/589.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/611.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/692.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/789.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/93.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/chunks/931.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/edge-runtime-webpack.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/middleware-build-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/middleware-react-loadable-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/next-font-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/pages/_app.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/pages/_document.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/pages/_error.js`

- Functions:
  - `middleware`

### `packages/opencore-site/.next/standalone/.next/server/server-reference-manifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/.next/server/src/middleware.js`

- Functions:
  - `middleware`

### `packages/opencore-site/.next/standalone/.next/server/webpack-runtime.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/standalone/server.js`

- Top-level variables:
  - `__dirname`, `currentPort`, `dir`, `hostname`, `keepAliveTimeout`, `nextConfig`, `require`

### `packages/opencore-site/.next/static/chunks/139.7a5a8e93a21948c1.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/255-4f212684648fcab9.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/280-79d7698a3ebf8cd6.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/4bd1b696-c023c6e3521b1417.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/512-c8015cef61e87835.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/646.f342b7cffc01feb0.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/blog/[slug]/page-125f80b761df6768.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/blog/page-928c813941c4588f.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/chart/docs/page-125f80b761df6768.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/chart/embed/page-125f80b761df6768.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/chart/page-bc51fce55b031529.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/layout-b973aec56e1ffb46.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/legal/page-125f80b761df6768.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/not-found-318f158d5f29695b.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/page-935136e877a79272.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/pricing/page-a6746d9352f3cd5d.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/vnstock/page-928c813941c4588f.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/[locale]/vnstock/playground/page-27f1c7ade2c68249.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/_not-found/page-d2ce7adb7df5b95c.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/api/bars/[symbol]/route-11814a022068cac3.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/api/health/route-11814a022068cac3.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/api/public/vnstock-data/route-11814a022068cac3.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/layout-9835f04c13d213f4.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/page-11814a022068cac3.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/robots.txt/route-11814a022068cac3.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/app/sitemap.xml/route-11814a022068cac3.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/framework-050c1f32293f7182.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/main-981706e99aa11916.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/main-app-cfd387c45702604c.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/pages/_app-82835f42865034fa.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/pages/_error-013f4188946cdd04.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/polyfills-42372ed130431b0a.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/chunks/webpack-a20c9abace18027e.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/I5RTZmnflnvNYaQYeHHOx/_buildManifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/static/I5RTZmnflnvNYaQYeHHOx/_ssgManifest.js`

- No parseable top-level symbols found

### `packages/opencore-site/.next/types/app/[locale]/blog/[slug]/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/blog/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/chart/docs/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/chart/embed/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/chart/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/legal/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/pricing/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/vnstock/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/[locale]/vnstock/playground/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/api/bars/[symbol]/route.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/api/health/route.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/api/public/vnstock-data/route.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/layout.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/app/page.ts`

- Functions:
  - `checkFields`

### `packages/opencore-site/.next/types/cache-life.d.ts`

- Functions:
  - `unstable_cacheLife`

### `packages/opencore-site/.next/types/routes.d.ts`

- No parseable top-level symbols found

### `packages/opencore-site/.next/types/validator.ts`

- Top-level variables:
  - `handler`

### `packages/opencore-site/next-env.d.ts`

- No parseable top-level symbols found

### `packages/opencore-site/next.config.ts`

- Top-level variables:
  - `adminCsp`, `commonHeaders`, `csp`, `isProduction`, `nextConfig`, `withMDX`, `withNextIntl`

### `packages/opencore-site/src/app/[locale]/blog/[slug]/page.tsx`

- Functions:
  - `generateMetadata`, `generateStaticParams`
- Top-level variables:
  - `post`, `source`, `t`

### `packages/opencore-site/src/app/[locale]/blog/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/chart/docs/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/chart/embed/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/chart/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/layout.tsx`

- Functions:
  - `generateStaticParams`
- Top-level variables:
  - `messages`, `metadata`

### `packages/opencore-site/src/app/[locale]/legal/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/not-found.tsx`

- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/pricing/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/vnstock/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/[locale]/vnstock/playground/page.tsx`

- Functions:
  - `generateMetadata`
- Top-level variables:
  - `t`

### `packages/opencore-site/src/app/admin/route.ts`

- Functions:
  - `GET`
- Top-level variables:
  - `filePath`, `html`

### `packages/opencore-site/src/app/api/bars/[symbol]/route.ts`

- Functions:
  - `GET`, `requestKey`
- Top-level variables:
  - `RATE_LIMIT`, `WINDOW_MS`, `backendUrl`, `feed`, `ipKey`, `params`, `payload`, `requestSymbol`, `timeframe`, `upstream`

### `packages/opencore-site/src/app/api/cms-auth/route.ts`

- Functions:
  - `GET`, `postMessageResponse`, `send`, `start`
- Top-level variables:
  - `CLIENT_ID`, `CLIENT_SECRET`, `accessToken`, `code`, `githubAuthUrl`, `githubUrl`, `html`, `message`, `msg`, `provider`, `tokenData`, `tokenRes`

### `packages/opencore-site/src/app/api/health/route.ts`

- Functions:
  - `GET`

### `packages/opencore-site/src/app/api/public/vnstock-data/route.ts`

- Functions:
  - `GET`, `requestKey`
- Top-level variables:
  - `RATE_LIMIT`, `WINDOW_MS`, `backendUrl`, `dataType`, `feed`, `ipKey`, `params`, `payload`, `period`, `symbol`, `upstream`

### `packages/opencore-site/src/app/layout.tsx`

- Top-level variables:
  - `bodyFont`, `headlineFont`, `metadata`

### `packages/opencore-site/src/app/page.tsx`

- No parseable top-level symbols found

### `packages/opencore-site/src/app/robots.ts`

- Top-level variables:
  - `siteUrl`

### `packages/opencore-site/src/app/sitemap.ts`

- Top-level variables:
  - `now`, `routes`, `siteUrl`

### `packages/opencore-site/src/components/layout/Footer.tsx`

- Functions:
  - `Footer`, `localeHref`
- Top-level variables:
  - `currentLocale`, `pathname`, `t`

### `packages/opencore-site/src/components/layout/LangToggle.tsx`

- Functions:
  - `LangToggle`, `swapLocale`
- Top-level variables:
  - `activeLocale`, `currentLocale`, `href`, `nextLocale`, `pathname`, `segments`, `t`

### `packages/opencore-site/src/components/layout/SiteFrame.tsx`

- Functions:
  - `SiteFrame`

### `packages/opencore-site/src/components/layout/TopNav.tsx`

- Functions:
  - `TopNav`, `localeHref`
- Top-level variables:
  - `REGISTER_URL`, `currentLocale`, `navLinks`, `pathname`, `t`

### `packages/opencore-site/src/components/sections/ChartDemo.tsx`

- Functions:
  - `ChartDemo`, `loadFeed`, `toWidgetBars`
- Top-level variables:
  - `bars`, `cancelled`, `from`, `locale`, `nextFeed`, `noopAdapter`, `t`, `timeframes`, `timerId`, `to`, `whaleEvents`

### `packages/opencore-site/src/components/sections/DashboardPreview.tsx`

- Functions:
  - `DashboardPreview`, `priceToY`
- Top-level variables:
  - `CANDLES`, `SPARKFILL`, `SPARKLINE`, `TICKERS`, `height`, `top`

### `packages/opencore-site/src/components/sections/FeatureGrid.tsx`

- Functions:
  - `FeatureGrid`
- Top-level variables:
  - `ref`, `t`

### `packages/opencore-site/src/components/sections/HeroSection.tsx`

- Functions:
  - `HeroSection`, `localeHref`
- Top-level variables:
  - `common`, `currentLocale`, `pathname`, `t`

### `packages/opencore-site/src/components/sections/PlaygroundPanel.tsx`

- Functions:
  - `PlaygroundPanel`, `resetExample`, `runCode`
- Top-level variables:
  - `cancelled`, `exampleLabel`, `examples`, `nextExample`, `pyodide`, `result`, `t`

### `packages/opencore-site/src/components/sections/PricingTable.tsx`

- Functions:
  - `PricingTable`, `localeHref`
- Top-level variables:
  - `common`, `currentLocale`, `pathname`, `plans`, `ref`, `t`

### `packages/opencore-site/src/components/sections/ProductCards.tsx`

- Functions:
  - `ProductCards`, `localeHref`
- Top-level variables:
  - `PRODUCT_CARDS`, `PRODUCT_ICONS`, `currentLocale`, `pathname`, `products`, `ref`, `t`

### `packages/opencore-site/src/components/sections/StatsStrip.tsx`

- Functions:
  - `StatsStrip`
- Top-level variables:
  - `STATS`, `t`

### `packages/opencore-site/src/hooks/useReveal.ts`

- Functions:
  - `useReveal`
- Top-level variables:
  - `el`, `obs`, `ref`

### `packages/opencore-site/src/i18n/request.ts`

- Top-level variables:
  - `locale`, `messages`, `requestedLocale`

### `packages/opencore-site/src/i18n/routing.ts`

- Functions:
  - `isLocale`
- Top-level variables:
  - `defaultLocale`, `locales`

### `packages/opencore-site/src/lib/api.ts`

- Functions:
  - `fetchChartFeed`, `fetchVnstockData`, `parseJsonResponse`
- Top-level variables:
  - `params`, `response`

### `packages/opencore-site/src/lib/blog.ts`

- Functions:
  - `getBlogPostBySlug`, `getBlogPostSource`, `loadBlogPosts`
- Top-level variables:
  - `CONTENT_DIR`, `blogPosts`, `filePath`, `files`, `raw`, `slug`

### `packages/opencore-site/src/lib/chartFeed.ts`

- Functions:
  - `buildChartFeed`, `deriveWhaleEvents`, `generateSampleBars`, `hashSymbol`
- Top-level variables:
  - `bars`, `buyVolume`, `changePct`, `close`, `drift`, `first`, `high`, `last`, `low`, `open`, `seed`, `sellVolume`, `start`, `threshold`, `volume`, `volumes`, `wave`, `whaleEvents`

### `packages/opencore-site/src/lib/pyodide.ts`

- Functions:
  - `ensureScript`, `loadPyodideRuntime`
- Top-level variables:
  - `baseUrl`, `existing`, `loadPyodide`, `runtimePromise`, `script`

### `packages/opencore-site/src/lib/rateLimit.ts`

- Functions:
  - `allowRequest`, `cleanupBuckets`
- Top-level variables:
  - `bucket`, `buckets`, `now`

### `packages/opencore-site/src/lib/seo.ts`

- Functions:
  - `buildPageMetadata`, `canonicalUrl`
- Top-level variables:
  - `siteUrl`, `url`

### `packages/opencore-site/src/lib/validation.ts`

- Functions:
  - `isAllowedSymbol`, `isAllowedTimeframe`, `normalizeSymbol`, `normalizeTimeframe`
- Top-level variables:
  - `ALLOWED_SYMBOLS`, `ALLOWED_TIMEFRAMES`, `SYMBOL_PATTERN`, `normalized`

### `packages/opencore-site/src/mdx-components.tsx`

- Functions:
  - `useMDXComponents`

### `packages/opencore-site/src/middleware.ts`

- Functions:
  - `middleware`
- Top-level variables:
  - `config`, `firstSegment`, `url`

### `packages/opencore-site/src/types/mdx.d.ts`

- Top-level variables:
  - `MDXComponent`

### `packages/opencore-site/src/types/vnstockcharts.d.ts`

- Top-level variables:
  - `VNStockChart`, `WhaleBubbleOverlay`

### `packages/web/jest.config.js`

- Top-level variables:
  - `config`

### `packages/web/src/adapters/core/coreAdapter.js`

- Classes:
  - `CoreAdapterHttpError`
- Functions:
  - `appendQuery`, `createCoreAdvisorySessionClient`, `createCoreWhaleAnalyticsSnapshotClient`, `getAiAdvisorySessionWithFallback`, `readJsonBody`, `requestJson`, `resolveCoreBaseUrl`, `resolveFetchImpl`, `resolvePortfolioApiBaseUrl`
- Top-level variables:
  - `contentType`, `coreAdapter`, `coreBase`, `normalizedRequestOptions`, `normalizedSymbol`, `params`, `payload`, `queryString`, `request`, `response`

### `packages/web/src/adapters/core/index.js`

- No parseable top-level symbols found

### `packages/web/src/adapters/coreApiAdapter.js`

- Functions:
  - `coreDelete`, `coreGet`, `corePatch`, `corePost`, `generateRequestId`, `getAuthorizationHeader`, `resolveCoreApiBase`
- Top-level variables:
  - `base`, `coreApiAdapter`, `query`, `r`, `requestId`, `response`, `text`, `token`

### `packages/web/src/adapters/coreApiAdapter.test.js`

- Functions:
  - `mockErrorResponse`, `mockOkResponse`
- Top-level variables:
  - `fetchMock`, `payload`, `result`

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

### `packages/web/src/components/DNSEConnectionPanel.js`

- Functions:
  - `DNSEConnectionPanel`, `useDNSEStatus`
- Top-level variables:
  - `e`, `handleCreateTradingToken`, `handlePlaceOrder`, `handleReconcileTransactions`, `handleSave`, `handleSendOtp`, `handleSync`, `handleSyncBalances`, `isConfigured`, `mountedRef`, `normalizedSymbol`, `price`, `quantity`, `reload`, `res`, `token`

### `packages/web/src/components/ShellPageTemplate.js`

- Functions:
  - `joinClassNames`, `renderElement`, `renderShellField`, `renderShellMetric`, `renderShellPageChrome`, `renderShellPanel`, `renderShellSelectField`
- Top-level variables:
  - `SHELL_PAGE_TEMPLATE_STYLES`

### `packages/web/src/config/buildTarget.js`

- Functions:
  - `getBuildTarget`, `isBuildTarget`, `normalizeBuildTarget`
- Top-level variables:
  - `BUILD_TARGETS`, `BUILD_TARGET_SET`, `DEFAULT_BUILD_TARGET`, `candidate`

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

### `packages/web/src/index.js`

- Top-level variables:
  - `shellAdapters`

### `packages/web/src/pages/admin/ShellAdminOpsPage.js`

- Functions:
  - `ShellAdminOpsPage`
- Top-level variables:
  - `adminAbilities`, `adminFlags`, `adminRoutes`, `groupFlags`, `metrics`, `routeFlags`, `summaryCards`

### `packages/web/src/pages/coreShellPageHelpers.js`

- Functions:
  - `buildSurfaceFlags`, `buildVisibilityFlags`, `countFlagsByState`, `createEmptySnapshot`, `createInitialViewState`, `deriveCoreShellSnapshot`, `filterAbilitiesBySubject`, `filterVisibleRoutes`, `getEnabledSurfaceKeys`, `handleRefresh`, `normalizeComparableText`, `normalizePageErrorMessage`, `refreshSnapshot`, `renderAbilityList`, `renderBuildMetaCard`, `renderElement`, `renderFlagList`, `renderHealthStatusPill`, `renderRefreshAction`, `renderSummaryCard`, `renderValueList`, `runInitialLoad`, `useCoreShellPageSnapshot`
- Top-level variables:
  - `active`, `allowedRouteIds`, `bootstrapLoaderRef`, `buildMeta`, `capabilities`, `envRef`, `fallbackErrorMessageRef`, `fetchImplRef`, `health`, `navigation`, `normalizedKeywords`, `session`, `snapshot`, `subject`, `surfaces`

### `packages/web/src/pages/DashboardPage.js`

- Functions:
  - `DashboardPage`, `load`, `useCoreDashboard`
- Top-level variables:
  - `DEFAULT_ENV`, `adapter`, `e`, `mountedRef`

### `packages/web/src/pages/pageRegistry.js`

- Functions:
  - `getPageComponent`, `getPageRegistryRouteIds`
- Top-level variables:
  - `pageEntry`, `pageRegistry`

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
  - `StockDetailPage`, `load`, `useStockDetail`
- Top-level variables:
  - `DEFAULT_ENV`, `adapter`, `e`, `mountedRef`

### `packages/web/src/pages/system/ShellAiCommandCenterPage.js`

- Functions:
  - `ShellAiCommandCenterPage`
- Top-level variables:
  - `aiAbilities`, `aiFlags`, `aiRoutes`, `groupFlags`, `metrics`, `routeFlags`, `summaryCards`

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
  - `WORKSPACE_ROUTE_IDS`, `enabledSurfaces`, `groupFlags`, `metrics`, `routeFlags`, `summaryCards`, `watchlistAbilities`, `workspaceRoutes`

## Update Workflow

1. After adding/changing functions/classes/variables, run:
   - `python scripts/ops/generate_module_tree.py`
2. Review `module_tree_full.md` diff.
3. Commit source changes and updated tree together.
