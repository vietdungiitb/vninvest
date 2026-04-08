# Sprint 12 - GO Decision Template (Starter Portfolios Provisioning)

Date: 2026-04-08
Environment: Staging/Internal test
Build/Commit: 1e830e3e
Decision owner: QA / PM / BE / Ops

## 1) Preconditions checklist

- [ ] Browser QA checklist executed:
  - `docs/SPRINT12_BROWSER_QA_CHECKLIST_STARTER_PORTFOLIOS_20260408.md`
- [ ] All mandatory manual checks PASS.
- [ ] No open blocker Severity 1/2 for signup/provisioning.
- [x] Feature flags configured for rollout target.
- [x] Rollback levers verified:
  - `STARTER_PORTFOLIOS_ENABLED`
  - `STARTER_PORTFOLIOS_CANARY_PERCENT`

## 2) Evidence snapshot

- Automation status: PASS
- Manual QA status: PENDING
- Risk level at release time: MEDIUM (until manual QA completes)

Evidence links:
- `docs/SPRINT12_SIGNOFF_REPORT_STARTER_PORTFOLIOS_20260408.md`
- `docs/SPRINT_EXECUTION_LOG.md`
- `docs/SPRINT12_ACCEPTANCE_CHECKLIST.md`

## 3) GO decision

Final decision: GO
Go live window: Pending QA completion
Rollout mode:
- [ ] 100% immediately
- [x] Canary (enter percent): 10%

Monitoring window after release: 24 hours

## 4) Post-release owners

- QA monitor: QA team (assign on release)
- BE on-call: Backend owner Sprint 12
- PM escalation: PM owner Sprint 12
- Ops rollback owner: DevOps on-call

## 5) Signatures

- QA: ____________________  Date: __________
- BE Lead: ____________________  Date: __________
- PM: ____________________  Date: __________
- Ops/Release: ____________________  Date: __________
