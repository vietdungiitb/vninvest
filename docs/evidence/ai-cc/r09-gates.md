# R0.9 gates — tach lop A/B + policy (plan Rev.2 §R0.9, slice cuoi R0)

Branch: `feat/ai-r09-policy` (stack tren ai-r07; PR #177/#178 chua merge luc lam)
Claim: `ai-r09` · Khong migration (khong doi model) · FE co (panel theo staff).

## 1. AC doi chieu

| AC | Plan | Truoc fix | Sau fix |
|---|---|---|---|
| AC1 | Non-staff GET khong co template, co managed_by_platform | **DO**: template tra cho moi user | Nhanh theo is_staff; user co `system_policy` |
| AC2 | Staff GET co template | DO (ai cung co) | Staff giu template |
| AC3/AC4 | policy/ GET+PUT user thuong 403 | **DO**: route chua ton tai (404) | Moi `PolicyView` (IsAdminUser + WorkspacePermission broker_manage) |
| AC5 | Route list co ai-command-center cho user | **DO**: chi staff list | Vao base routes (giam staff dup) |
| AC6 | Ability ai.policy.manage chi staff | **DO**: chua co | Them staff-only (giu `system.ai_command_center.manage` vi FE dung) |
| AC7 | ai_config_message bien mat | **DO**: GET+PUT deu tra | Xoa BE (2 diem) + FE state/render/type + fixture; xoa key i18n `configMessagePrefix` chet |
| AC8 | UI non-staff khong render panel; staff thay | **DO**: panel hien moi user | Gate `usePortfolio` userIdentity (pattern admin pages) + notice `system-prompt-managed` + key vi/en |
| AC9 | 8 test config_isolation xanh | Vang: C-AC5 assert key cu | Rework C-AC5 (doi key theo contract) + F5 (viewer khong thay template); chay that |

## 2. Fail-before (VPS Postgres, wip/r09-red-probe)

9 test moi: **8 FAIL** (template lo · policy 404 · route/ability thieu · message con) +
1 pass hien nhien (AC2 staff-thay-template dung ca truoc fix).
Gate chan push 2 lan, ca hai deu bat loi THAT:
(a) `urls.py` thieu import view moi (openapi-budget do) — quen import khi them route;
(b) SAFE-04 gate: `PolicyView.put` la write method moi → EXPECTED thieu (them 1 dong
+ `required_workspace_permission` tren class).

## 3. GREEN

- Moi: `test_ai_cc_policy_gating` 9/9.
- Hoi quy BE VPS: policy+gating+isolation+mgmt+capability_pav+usage+audit 96/96;
  r06+r07+endpoint+r04+r0+history 56/56. Tong BE **152+9? (9 nam trong 96) OK**.
- FE local: page + contract-smoke + parity **19/19**; `tsc --noEmit` 0;
  `i18n:scan` sach (key moi da them vi+en).
- `makemigrations --check`: No changes. `check-multi-agent` 0 loi.
  `pre-push-gate` 23/23 (can PYTHONUTF8=1 tren cp1252 — bug latent 2 script
  gen-*-catalog, follow-up; endpoint catalog regen 1483→1484).

## 4. Non-goals / follow-up

- Beat schedule cho rollup R0.7 (bao coordinator).
- Bang gia AICostRate (R2.x).
- Sua bug cp1252 trong `gen-model-catalog.py` + `gen-endpoint-catalog.py`
  (in tieng Viet crash console Windows; workaround PYTHONUTF8=1).
- R0 khép kín sau slice này (R0.1–R0.9). M0 review: R1 theo plan Rev.2.
