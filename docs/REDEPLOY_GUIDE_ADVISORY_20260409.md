# Advisory Upgrade Redeploy Guide (2026-04-09)

## Pham vi thay doi

Ban release nay gom cac nang cap lon cho he thong AI Advisory:

1. Auto-refresh scheduling per user
- UserConfig co them gioi han so lan auto-refresh/ngay.
- Scheduler va task advisory da enforce ca token budget va auto-refresh budget.

2. Advisory metadata va API
- Advisory response co them fields: next_refresh_at, refresh_count, is_auto_generated, source, severity, advisory_type.
- Them endpoint auto refresh info:
  - GET /api/portfolio/whale-advisory/<symbol>/auto-refresh-info/
- List advisory ho tro filter:
  - refresh_status=ready|pending|recent
  - watchlist_only=true

3. Severity + Reversal advisory
- Advisory co severity: urgent, warning, info.
- Advisory co advisory_type: default, reversal.
- Them task detect_whale_reversal, trigger advisory reversal voi severity urgent.

4. Frontend cap nhat
- WhaleAdvisory page:
  - panel cau hinh lich auto generation
  - hien quota auto-refresh/token theo symbol
  - hien badge severity va reversal
  - watchlist-only toggle
- StockDetail page:
  - hien badge severity va reversal trong Advisory Session.
- I18n da dong bo cho vi/en.

## Migrations moi

- 0030_phase1_advisory_autogen_and_refresh.py
- 0031_userconfig_advisory_max_auto_refreshes_per_day.py
- 0032_whaleadvisory_severity.py
- 0033_whaleadvisory_advisory_type.py

## Bien moi truong can co

Can cap nhat env theo file portainer-nginx-proxy.env.example:

- ADVISORY_AUTO_GENERATION_ENABLED
- ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES
- ADVISORY_AUTO_GENERATION_BATCH_SIZE
- ADVISORY_AUTO_GENERATION_JOB_LOCK_SECONDS
- ADVISORY_AUTO_GENERATION_QUEUE_LOCK_SECONDS
- ADVISORY_AUTO_GENERATION_ESTIMATED_TOKENS
- ADVISORY_AUTO_GENERATION_JITTER_MIN_SECONDS
- ADVISORY_AUTO_GENERATION_JITTER_MAX_SECONDS
- ADVISORY_CONCISE_BUDGET_THRESHOLD

- REVERSAL_DETECTION_ENABLED
- REVERSAL_DETECTION_INTERVAL_SECONDS
- REVERSAL_WINDOW_MINUTES
- REVERSAL_MIN_CONSECUTIVE_BUY
- REVERSAL_MIN_SELL_VALUE_VND
- REVERSAL_COOLDOWN_SECONDS

## Redeploy checklist

1. Pull code moi tren server.
2. Cap nhat env file theo danh sach tren.
3. Chay migration:
   - python manage.py migrate
4. Restart backend + celery worker + celery beat.
5. Smoke test:
   - GET /api/portfolio/whale-advisory/
   - GET /api/portfolio/whale-advisory/<symbol>/auto-refresh-info/
   - POST /api/portfolio/whale-advisory/<symbol>/refresh/
6. Verify UI:
   - WhaleAdvisory: schedule panel, quota, severity/reversal badge
   - StockDetail: severity/reversal badge

## Validation da chay local

- Backend advisory regression tests: PASS
- Frontend build: PASS
- makemigrations --check --dry-run: no changes detected

## Ops evidence script

- Sprint 29 deploy evidence:
  - `powershell -File scripts/ops/sprint29_collect_deploy_evidence.ps1`
- Advisory auth smoke:
  - `powershell -File scripts/ops/sprint29_advisory_auth_smoke.ps1 -Username <user_or_email> -Password <password> -Symbol FPT`
  - Hoac dung token co san:
  - `powershell -File scripts/ops/sprint29_advisory_auth_smoke.ps1 -AccessToken <jwt> -Symbol FPT`

