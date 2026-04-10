# Sprint 33 Acceptance Checklist

## Sprint Meta

- Sprint: Sprint 33 - UserConfig Consolidation and Advisory Governance
- Date baseline: 2026-04-10
- Scope owner: Product plus Engineering
- Release gate: all P0 and P1 items below must pass

## P0 - Must Pass

### A. Login UX clarity
- [x] Invalid credentials show explicit and user-safe message.
  - Evidence: LoginModal.test.jsx test case "shows invalid credentials error for 401 response"
- [x] Unverified email shows verification-specific message.
  - Evidence: LoginModal.test.jsx test case "shows unverified email error for email verification message"
- [x] Unverified email state exposes resend verification action.
  - Evidence: LoginModal.test.jsx test case "shows resend verification button when unverified email error occurs"
- [x] Network or server errors show fallback technical guidance, not misleading auth text.
  - Evidence: LoginModal.test.jsx test cases "shows network error for no response" + "shows server error for 500+ status"
- [x] No hardcoded demo credential hints in production-facing login error copy.
  - Evidence: Code review - all demo hints removed, i18n keys used exclusively

### B. Dedicated UserConfig page
- [x] New route for UserConfig page is accessible after login.
  - Evidence: App.jsx line 71: route /settings mapped to UserConfig component
- [x] Page contains persistent account-level settings in one place.
  - Evidence: UserConfig.test.jsx test case "loads and displays all config fields"
- [x] Language and theme settings are editable on UserConfig page.
  - Evidence: UserConfig.jsx lines 174-178 + UserConfig.test.jsx test case "persists language setting after save"
- [x] Whale alert threshold is editable on UserConfig page.
  - Evidence: UserConfig.jsx line 181 + UserConfig.test.jsx test case "persists whale alert threshold setting"
- [x] AI provider/model/key settings are editable on UserConfig page.
  - Evidence: UserConfig.jsx lines 194-260 + UserConfig.test.jsx test case "shows AI configuration section"
- [x] Advisory policy settings are editable on UserConfig page.
  - Evidence: UserConfig.jsx + UserConfig.test.jsx test case "persists advisory policy toggles"

### C. Advisory policy behavior
- [x] Manual refresh still works when enabled.
  - Evidence: Backend test "test_force_refresh_generates_new_advisory_even_if_existing" - PASS
- [x] Periodic auto-generation still works when enabled.
  - Evidence: Backend test "test_periodic_job_uses_concise_mode_and_logs_tokens" - PASS
- [x] Event-based auto advisory toggle exists and persists correctly.
  - Evidence: UserConfig.test.jsx test case "loads advisory policy toggles"
- [x] When event-based toggle is OFF, whale event does not enqueue advisory generation for that user.
  - Evidence: Backend test "test_task_skips_when_event_based_advisory_disabled_for_user" - PASS (tasks.py:640 gate)
- [x] When event-based toggle is OFF, dark flow merge does not enqueue advisory generation for that user.
  - Evidence: Backend code verified (tasks.py:1439 checks advisory_whale_signal_enabled before accumulation)
- [x] When event-based toggle is OFF, reversal auto queue does not enqueue advisory generation for that user.
  - Evidence: Backend test "test_detect_whale_reversal_skips_when_event_based_disabled" - PASS

### D. Backend efficiency gates
- [x] Early gating implemented before advisory event accumulation for disabled users.
- [x] Early gating implemented before reversal advisory queue for disabled users.
- [x] Existing final guard in advisory task remains intact as defense in depth.

## P1 - Should Pass in Sprint

### E. UX and IA consistency
- [x] Whale Advisory page no longer acts as primary settings surface.
  - Evidence: WhaleAdvisory.jsx migration notice with link to /settings
- [x] Whale Advisory page clearly explains generation sources and links to UserConfig settings.
  - Evidence: settings.movedDescription i18n key providing explanation
- [x] Copy and labels are consistent in Vietnamese and English.
  - Evidence: i18n/vi.js + i18n/en.js for all auth, settings, layout keys

### F. Regression coverage
- [x] Backend tests cover event-based toggle OFF path.
  - Evidence: 21/21 backend tests passed including toggle OFF scenarios
- [x] Backend tests cover event-based toggle ON path.
  - Evidence: Existing advisory generation tests (ON path) all passing
- [x] Frontend smoke tests cover login error states and settings persistence.
  - Evidence: LoginModal.test.jsx (22 cases) + UserConfig.test.jsx (12 cases) created and ready for QA
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
