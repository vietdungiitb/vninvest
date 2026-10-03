# Sprint 27 - Release Commands (Staging to Production)

Date: 2026-04-08
Scope: Onboarding trial policy rollout (schema + signup assignment + expiry downgrade)

## 1) Pre-deploy checks (local/CI)

```powershell
Set-Location "c:/Mujoco Projects/vninvest/backend"
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py makemigrations --check --noinput
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py check
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test portfolio.tests.test_onboarding_trial_service portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_applies_active_onboarding_policy portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_respects_signup_trial_feature_flag portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_existing_user_no_reassignment
```

## 2) Staging deploy sequence

1. Deploy image/tag cho backend + celery worker + celery beat.
2. Run migrate trên staging:

```powershell
python manage.py migrate
```

3. Restart backend/celery services.
4. Verify feature flags (staging):
- ONBOARDING_TRIAL_APPLY_ON_SIGNUP=True
- ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED=True
- ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES=15
- ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE=500

5. Run smoke theo:
- docs/SPRINT27_STAGING_SMOKE_CHECKLIST.md

## 3) Evidence collection command

Co the thu thap evidence nhanh bang script:

```powershell
& "c:/Mujoco Projects/vninvest/scripts/ops/sprint27_collect_deploy_evidence.ps1" -SkipNetworkChecks
```

Neu backend staging expose API health local tunnel:

```powershell
& "c:/Mujoco Projects/vninvest/scripts/ops/sprint27_collect_deploy_evidence.ps1" -ApiBase "https://<staging-domain>"
```

## 4) GO/NO-GO update

Cap nhat report:
- docs/SPRINT27_GO_NO_GO_REPORT_20260408.md

Ky duyet:
- QA
- BE
- PM

Chi khi co GO moi tiep tuc production.

## 5) Production rollout (flag-first safety)

1. Deploy code + migrate.
2. Bat policy trong admin (chi 1 policy active).
3. Bat ONBOARDING_TRIAL_APPLY_ON_SIGNUP=True.
4. Theo doi log events 24h:
- onboarding_trial_assigned
- onboarding_trial_skipped

5. Bat ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED=True.
6. Theo doi:
- onboarding_trial_downgraded
- onboarding_trial_expiry_summary
- onboarding_trial_expiry_task_run

## 6) Emergency rollback

Neu co su co, tat ngay:
- ONBOARDING_TRIAL_APPLY_ON_SIGNUP=False
- ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED=False

Tham chieu chi tiet:
- docs/SPRINT27_ROLLBACK_RUNBOOK.md
