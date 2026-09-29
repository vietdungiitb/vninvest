# SELF AUDIT AND TEST PROTOCOL - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

## Checklist A - Scope discipline

1. Chi sua auth flow lien quan packages/web.
2. Khong chen tinh nang ngoai auth (dashboard/signals).
3. Khong mo rong backend contract ngoai nhu cau cutover.

## Checklist B - Architecture compliance

1. Khong tao feature moi trong frontend legacy.
2. Auth page production nam trong packages/web.
3. Adapter coreApiAdapter la auth data-plane duy nhat.

## Checklist C - Correctness

1. Login success luu token dung key.
2. Refresh tu dong hoat dong khi 401.
3. Register/verify/resend hien thi dung message.
4. Verify route xu ly token missing/invalid/success.

## Checklist D - Quality gate

1. Unit test adapter auth pass.
2. Component tests auth pages pass.
3. Integration route auth pass.
4. start_dev runtime smoke pass.

## Checklist E - Documentation and evidence

1. Cap nhat ledger + progress.
2. Co execution evidence cho tung slice.
3. Co residual risk note ro rang.

## Fail conditions (block merge)

1. Con import auth UI production tu frontend legacy.
2. Con direct fetch auth trong page code.
3. Khong co evidence runbook.
