# Sprint 33 Implementation Checklist

Status: READY FOR BUILD
Date: 2026-04-10

## 1) Pre-code setup

- [ ] Confirm sprint scope freeze from sprint plan.
- [ ] Confirm API/data contract frozen for V1.
- [ ] Confirm route naming for UserConfig page.
- [ ] Confirm default behavior decision for existing users.
- [ ] Confirm i18n wording freeze for vi/en.

## 2) Backend implementation checklist

### 2.1 Advisory governance early-gating
- [x] Add guard before whale event accumulation path.
- [x] Add guard before dark flow accumulation path.
- [x] Add guard before reversal advisory queue path.
- [x] Keep final advisory task source guard unchanged.
- [x] Verify skip reasons are explicit and traceable in logs.

### 2.2 UserConfig API integrity
- [ ] Verify GET returns all Sprint 33 fields.
- [ ] Verify PUT allows updates for advisory policy fields.
- [ ] Verify write-only handling for ai_api_key remains correct.
- [ ] Verify serializer validation still enforces safe bounds.

### 2.3 Backend tests
- [x] Add event-based OFF coverage for whale path.
- [x] Add event-based OFF coverage for dark flow path.
- [x] Add event-based OFF coverage for reversal path.
- [x] Add event-based ON coverage for normal path.
- [x] Validate no regression in manual and periodic behavior.

## 3) Frontend implementation checklist

### 3.1 UserConfig page
- [x] Add authenticated route.
- [x] Add navigation entry point.
- [x] Build section: General preferences.
- [x] Build section: Market monitoring.
- [x] Build section: AI configuration.
- [x] Build section: AI advisory policy.

### 3.2 Settings migration from Whale Advisory
- [x] Remove primary account-level settings editor from WhaleAdvisory page.
- [x] Keep workflow-level controls relevant to advisory usage.
- [x] Add link/CTA to open UserConfig page.

### 3.3 Login UX hardening
- [x] Map invalid credentials to explicit message.
- [x] Map unverified email to verification guidance.
- [x] Add resend verification action in login failure path.
- [x] Handle network/server fallback separately.

### 3.4 Frontend quality checks
- [ ] UserConfig persistence verified after reload.
- [ ] vi/en labels consistent for policy semantics.
- [ ] No UI regression on desktop/mobile layouts.

## 4) Integration checklist

- [ ] Toggle OFF on UserConfig reflects in backend behavior.
- [ ] Toggle ON on UserConfig reflects in backend behavior.
- [ ] Manual refresh behavior unaffected.
- [ ] Periodic auto-generation behavior unaffected.

## 5) Test execution checklist
- [x] Backend focused suites pass.
- [x] Frontend build passes.
- [ ] Frontend build passes.
- [ ] Staging smoke matrix executed.
- [ ] Acceptance checklist P0 items all pass.

## 6) Release readiness checklist

- [ ] Release runbook reviewed by BE/FE/QA.
- [ ] Rollback owner assigned.
- [ ] Support note prepared for login and settings changes.
- [ ] Sprint execution log updated with final evidence.

## 7) Done criteria

- [ ] All P0 acceptance items complete.
- [ ] No unresolved blocker in sprint taskboard.
- [ ] PM, BE, FE, QA sign-off complete.
