# Sprint 33 Acceptance Checklist

## Sprint Meta

- Sprint: Sprint 33 - UserConfig Consolidation and Advisory Governance
- Date baseline: 2026-04-10
- Scope owner: Product plus Engineering
- Release gate: all P0 and P1 items below must pass

## P0 - Must Pass

### A. Login UX clarity
- [ ] Invalid credentials show explicit and user-safe message.
- [ ] Unverified email shows verification-specific message.
- [ ] Unverified email state exposes resend verification action.
- [ ] Network or server errors show fallback technical guidance, not misleading auth text.
- [ ] No hardcoded demo credential hints in production-facing login error copy.

### B. Dedicated UserConfig page
- [ ] New route for UserConfig page is accessible after login.
- [ ] Page contains persistent account-level settings in one place.
- [ ] Language and theme settings are editable on UserConfig page.
- [ ] Whale alert threshold is editable on UserConfig page.
- [ ] AI provider/model/key settings are editable on UserConfig page.
- [ ] Advisory policy settings are editable on UserConfig page.

### C. Advisory policy behavior
- [ ] Manual refresh still works when enabled.
- [ ] Periodic auto-generation still works when enabled.
- [ ] Event-based auto advisory toggle exists and persists correctly.
- [ ] When event-based toggle is OFF, whale event does not enqueue advisory generation for that user.
- [ ] When event-based toggle is OFF, dark flow merge does not enqueue advisory generation for that user.
- [ ] When event-based toggle is OFF, reversal auto queue does not enqueue advisory generation for that user.

### D. Backend efficiency gates
- [x] Early gating implemented before advisory event accumulation for disabled users.
- [x] Early gating implemented before reversal advisory queue for disabled users.
- [x] Existing final guard in advisory task remains intact as defense in depth.

## P1 - Should Pass in Sprint

### E. UX and IA consistency
- [ ] Whale Advisory page no longer acts as primary settings surface.
- [ ] Whale Advisory page clearly explains generation sources and links to UserConfig settings.
- [ ] Copy and labels are consistent in Vietnamese and English.

### F. Regression coverage
- [x] Backend tests cover event-based toggle OFF path.
- [x] Backend tests cover event-based toggle ON path.
- [ ] Frontend smoke tests cover login error states and settings persistence.
- [x] No critical regression in advisory listing and refresh flow.

### G. Operational readiness
- [x] Release notes include behavior changes for advisory trigger policy.
- [x] Runbook updated for support and QA teams.
- [ ] Smoke checklist executed on staging.

## Smoke Test Matrix

### Auth smoke
- [ ] Wrong password -> correct error text.
- [ ] Unverified account -> verify/resend guidance appears.
- [ ] Resend verification success path returns expected notice.

### Advisory smoke
- [ ] Event-based ON + whale event -> advisory can be queued/generated.
- [ ] Event-based OFF + whale event -> no advisory queue for that user.
- [ ] Event-based OFF + dark flow trigger -> no advisory queue for that user.
- [ ] Event-based OFF + reversal trigger -> no advisory queue for that user.
- [ ] Periodic ON -> advisory refreshes by schedule.
- [ ] Manual ON -> user can refresh advisory from UI.

### Settings smoke
- [ ] Toggle changes are persisted after page reload.
- [ ] Toggle changes are reflected in backend behavior within expected delay.
- [ ] Existing users migrate with safe default behavior per product decision.

## Sign-off

- Product sign-off: [ ]
- Backend sign-off: [ ]
- Frontend sign-off: [ ]
- QA sign-off: [ ]
- Release owner sign-off: [ ]
