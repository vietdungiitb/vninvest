# Sprint 33 QA Test Matrix

Status: READY
Date: 2026-04-10

## 1) Test strategy

Test layers:
- Backend unit and integration tests.
- Frontend smoke and behavior tests.
- End-to-end manual validation on staging.

Priority policy:
- P0 tests block release.
- P1 tests should pass before go-live unless explicitly waived.

## 2) Backend test matrix

### B-P0-01 Event-based OFF blocks whale event enqueue
- Precondition: user has `advisory_whale_signal_enabled = false`.
- Action: emit whale event path.
- Expectation: no advisory enqueue for that user.

### B-P0-02 Event-based OFF blocks dark flow enqueue
- Precondition: same as above.
- Action: trigger dark flow merge path.
- Expectation: no advisory enqueue for that user.

### B-P0-03 Event-based OFF blocks reversal enqueue
- Precondition: same as above.
- Action: trigger reversal detection.
- Expectation: no advisory enqueue for that user.

### B-P0-04 Event-based ON keeps existing behavior
- Precondition: user has `advisory_whale_signal_enabled = true`.
- Action: trigger whale/dark/reversal path.
- Expectation: advisory can enqueue normally subject to other guards.

### B-P0-05 Manual and periodic remain independent
- Precondition: event-based OFF.
- Action: manual refresh and periodic run.
- Expectation: manual and periodic still behave according to their own flags.

### B-P1-01 Defense-in-depth final task guard
- Action: direct call path into advisory task with source event and user toggle OFF.
- Expectation: task skips with correct reason.

## 3) Frontend test matrix

### F-P0-01 Login wrong credentials message
- Action: submit invalid username/password.
- Expectation: explicit invalid credential message.

### F-P0-02 Login unverified account guidance
- Action: submit unverified account credentials.
- Expectation: verification guidance and resend action visible.

### F-P0-03 Login network/server fallback
- Action: simulate network failure or 5xx.
- Expectation: non-misleading technical fallback message.

### F-P0-04 UserConfig persistence
- Action: toggle event-based advisory and reload page.
- Expectation: value persists and UI reflects server state.

### F-P0-05 UserConfig route accessibility
- Action: open `/settings` from sidebar navigation.
- Expectation: page loads for authenticated user without auth redirect loop.

### F-P1-01 WhaleAdvisory settings ownership cleanup
- Action: open WhaleAdvisory page.
- Expectation: no primary account-level settings editor remains there.

### F-P1-02 i18n consistency
- Action: switch vi/en.
- Expectation: labels and advisory source wording are consistent.

## 4) Staging smoke matrix

### S-P0-01 Event toggle OFF behavior
- Toggle OFF -> trigger event input -> verify no advisory queue for test user.

### S-P0-02 Event toggle ON behavior
- Toggle ON -> trigger event input -> verify advisory queue possible.

### S-P0-03 Manual and periodic unaffected
- Validate manual refresh button and periodic job output still work.

### S-P1-01 Login regression
- Validate normal login and verify-email flow still pass.

### S-P1-02 WhaleAdvisory ownership migration
- Validate WhaleAdvisory shows migration panel and no longer hosts primary account-level settings forms.

## 5) Evidence checklist

- Backend test output attached.
- Frontend build output attached.
- Staging smoke logs attached.
- Screenshots for login states and UserConfig toggle behavior.

## 6) Exit criteria

- All P0 rows pass.
- No open P0 blocker in release board.
- PM, FE, BE, QA sign-off aligned with acceptance checklist.
