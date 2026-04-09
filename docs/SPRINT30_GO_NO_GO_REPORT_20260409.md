# Sprint 30 - GO/NO-GO Report (2026-04-09)

Date: 2026-04-09
Environment: staging -> production gate review
Owner: BE / QA / DevOps / PM

## 1) Engineering status

- User-first AI runtime with system fallback: PASS
- System AI Admin settings API + test connection + audit logs: PASS
- Audit retention command and tests: PASS
- AI model catalog/runtime filtering updates: PASS

Notes:
- Core implementation scope is complete.
- Remaining work is release gate validation and sign-off evidence.

## 2) Automated validation snapshot

- `manage.py makemigrations --check --noinput`: PASS
- `manage.py check`: PASS
- Focused Sprint 30 regression suites: PASS (per local run notes)
- Frontend `npm run -s build`: PASS

Evidence / tools:
- `docs/SPRINT30_SYSTEM_AI_UNIFICATION_20260409.md`
- `scripts/ops/sprint30_collect_deploy_evidence.ps1`
- `scripts/ops/sprint30_runtime_kpi_smoke.ps1`
- `scripts/ops/sprint30_run_release_gate.ps1`

## 3) Remaining release gates

- Runtime smoke for `/api/ai-options/`: PENDING
- Runtime smoke for admin endpoints `/api/admin-ops/system-ai-settings/*`: PENDING
- Frontend Whale Advisory model dropdown runtime verification: PENDING
- Staging evidence for fallback scenario (user missing key -> system key): PENDING
- QA sign-off: PENDING
- DevOps sign-off: PENDING
- PM/Product sign-off: PENDING

## 4) Risks and mitigations

- Risk 1: Active system config uses invalid provider/model combination.
  - Mitigation: execute admin test-connection before activation.
- Risk 2: fallback path mismatch in staging data conditions.
  - Mitigation: execute one controlled smoke case with user config intentionally incomplete.
- Risk 3: audit log growth in production.
  - Mitigation: run retention command on schedule and keep dry-run evidence before first prune.
- Risk 4: worker Celery tam thoi khong available lam refresh advisory chi queue ma khong tao record.
  - Mitigation: dung env `WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER` de control fallback dong bo theo moi truong.

## 5) Decision

- Decision: GO FOR STAGING SMOKE / PENDING FINAL PRODUCTION GO
- Rollout mode suggestion: canary validation with quick rollback via `is_active` toggle on system config
- Monitoring window: 24h after staging smoke gate close

## 6) Required evidence before final production GO

1. Run:
   - `powershell -File scripts/ops/sprint30_collect_deploy_evidence.ps1`
   - `$cred = Get-Credential`
   - `powershell -File scripts/ops/sprint30_runtime_kpi_smoke.ps1 -ApiBase <base> -Credential $cred`
  - Hoac mot lenh gate:
     - `powershell -File scripts/ops/sprint30_run_release_gate.ps1 -ApiBase <base> -Credential $cred`
2. Attach staging screenshots/logs for:
   - `/api/ai-options/`
   - `/api/admin-ops/system-ai-settings/`
   - `/api/admin-ops/system-ai-settings/test-connection/`
   - `/api/admin-ops/system-ai-settings/audit-logs/`
3. Attach fallback scenario evidence (user config invalid, system config valid).
4. Attach retention dry-run output (`prune_system_ai_audit_logs --dry-run`).
5. Collect QA/BE/DevOps/PM signatures.
6. Verify env flag da set dung:
  - `WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER=True` (khuyen nghi cho staging va giai doan dau production).
7. Verify contract runtime khi worker dung:
  - Neu flag=True: endpoint refresh tra `200` + `fallback_sync=true`.
  - Neu flag=False: endpoint refresh tra `503` fail-fast.

## 8) Partial-run commands (ops convenience)

- Chi thu thap deploy evidence:
  - `powershell -File scripts/ops/sprint30_run_release_gate.ps1 -SkipRuntimeKpiSmoke`
- Chi runtime KPI smoke:
  - `powershell -File scripts/ops/sprint30_run_release_gate.ps1 -SkipDeployEvidence -Credential $cred`
- Bo qua network checks trong evidence script:
  - `powershell -File scripts/ops/sprint30_run_release_gate.ps1 -SkipNetworkChecks -Credential $cred`

## 7) Signatures

- QA Lead: ____________________  Date: __________
- BE Lead: ____________________  Date: __________
- DevOps Lead: ____________________  Date: __________
- PM / Product-AI: ____________________  Date: __________