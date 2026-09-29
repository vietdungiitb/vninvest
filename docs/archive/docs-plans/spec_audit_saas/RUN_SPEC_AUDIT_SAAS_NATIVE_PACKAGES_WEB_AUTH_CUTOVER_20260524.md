# RUN SPEC AUDIT - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

## 1) Audit questions

1. Tat ca auth production pages da nam trong packages/web chua?
2. Adapter layer co la data-plane auth duy nhat khong?
3. Legacy frontend con giu source-of-truth auth hay chi la host tam?
4. Route mapping co khop tech spec va traceability khong?
5. Error envelope render co du detail/code/request_id/field_errors khong?
6. Co bat ky vi pham hard rule AGENTS nao khong?

## 2) Evidence required

1. Diff file list theo task IDs.
2. Test outputs.
3. Runtime smoke outputs.
4. Screenshots luong auth chinh.

## 3) Output format

1. Findings theo severity: CRITICAL/HIGH/MEDIUM/LOW.
2. Moi finding phai co file reference + gate impact.
3. Ket luan: PASS / PASS-WITH-RISK / FAIL.

## 4) Auto-fail rules

1. Scope drift sang feature khac auth.
2. Missing runbook evidence.
3. Vi pham SaaS-native boundary (feature moi o frontend legacy).
