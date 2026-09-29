# IMPLEMENTATION PLAN - PHASE 3 UI POLISH + WHALE SCORING AUDIT (2026-04-17)

## 1. Business objective

- Van de can giai quyet:
  - Phase 2 da on dinh logic, nhung giao dien Dashboard V2 chua dat muc pixel-perfect dark terminal va can audit lai whale scoring de dam bao muc Critical phan anh dot bien thuc su.
- KPI/ket qua ky vong:
  - UI: Dat visual consistency >= 95% theo checklist spacing/color/typography tren Dashboard V2 desktop + mobile.
  - Scoring: Giam false-critical (co the canh bao cao nhung khong dot bien) it nhat 30% tren tap mau danh gia noi bo.
  - Van hanh: Khong phat sinh compile/lint regression tren backend/frontend files duoc sua.

## 2. Scope and non-scope

- In-scope:
  - Phase 3A: Pixel-perfect polish cho Dashboard V2 (UnifiedAlertBar, UnifiedAlertCenter, Analytics sidebar, dark mode tone).
  - Phase 3B: Audit logic whale scoring, de xuat tuning severity band/weights + test strategy.
- Out-of-scope:
  - Refactor toan bo cac trang ngoai Dashboard.
  - DB schema migration lon.
  - Thay doi API auth/session.

## 3. Current-state assessment

- Frontend:
  - Dashboard da dung UnifiedAlertBar + UnifiedAlertCenter + layout 3:1.
  - Theme dark mode da co, nhung chua chuan hoa spacing/tone bang mot bo visual token ro rang.
- Backend:
  - Whale event_id va dedup channel da harden o Phase 2.
  - Whale scoring hien tai nam tai `backend/portfolio/whale_scoring.py` voi:
    - `weights`: size_impact/aggression_bonus/concentration_ratio.
    - `severity_bands`: low/medium/high/extreme.
    - `display_score` su dung decay theo half-life.
- Constraint:
  - Phai giu backward compatibility cho payload whale_alert.
  - Khong duoc pha vo on dinh realtime vua dat duoc.

## 4. Target design

- Target frontend design:
  - Thiet lap visual token cho dashboard V2: spacing scale, border alpha scale, text hierarchy, alert tone hierarchy.
  - Dam bao tap trung vao nhanh-doc: thong tin quan trong co contrast cao, thong tin phu co contrast vua du.
- Target scoring design:
  - Dinh nghia lai rubric danh gia Critical bang du lieu:
    - Event score component.
    - Display score decay theo age.
    - Relationship giua threshold ratio va severity.
  - Tuning co feature flag (neu can) de rollback nhanh.

## 5. Execution phases

- Phase 0: Planning + guardrails
  - Tao audit baseline scoring va visual QA checklist.
  - File du kien: docs planning/audit files.
  - Rollback: khong can (tai lieu only).

- Phase 1: UI polish tokenization (Phase 3A.1)
  - Chuan hoa class/style cho UnifiedAlertBar, UnifiedAlertCenter, Dashboard wrapper.
  - File du kien:
    - `frontend/src/pages/Dashboard.jsx`
    - `frontend/src/components/UnifiedAlertBar.jsx`
    - `frontend/src/components/UnifiedAlertCenter.jsx`
    - `frontend/src/index.css`
  - Rollback: revert commit UI polish.

- Phase 2: UI polish interaction/details (Phase 3A.2)
  - Fine tune spacing, density, responsive breakpoints, states hover/focus.
  - Rollback: revert commit interaction polish.

- Phase 3: Whale scoring audit + recommendation (Phase 3B.1)
  - Phan tich cong thuc score hien tai, severity bands, decay.
  - Tao de xuat tuning + acceptance criteria.
  - File du kien: docs audit report.
  - Rollback: khong can (tai lieu only).

- Phase 4: Whale scoring safe tuning (Phase 3B.2)
  - Ap dung tuning nho, co defensive defaults + tests.
  - File du kien:
    - `backend/portfolio/whale_scoring.py`
    - `backend/config/settings.py` (neu can flag)
    - test files lien quan whale/realtime.
  - Rollback: tat flag hoac revert commit tuning.

- Phase 5: Verify + governance closeout
  - Run error checks/tests.
  - Cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `PROGRESS_DASHBOARD.md`.

## 6. API and data contract changes

- Du kien khong thay doi REST endpoint contract.
- Whale payload contract giu nguyen field set.
- Neu co them feature flag scoring: chi anh huong server-side scoring internals, khong doi payload shape.

## 7. Scheduling and operations

- Khong them scheduler moi.
- Neu bat flag scoring canary:
  - Enable tren dev truoc.
  - Theo doi metric false-critical trend.
- Guardrails:
  - Keep fallback defaults in `resolve_whale_score_config`.
  - Khong cho phep weight invalid (sum <= 0).

## 8. Testing and verification

- Frontend:
  - No compile errors tren files sua.
  - Manual visual QA desktop/mobile theo checklist.
- Backend scoring:
  - Unit test classify_severity/calculate_event_score/calculate_display_score.
  - Scenario test: ratio cao + side buy/sell + age decay.
- Exit criteria:
  - UI pass visual checklist.
  - Khong regression payload.
  - Test + error check pass.

## 9. Observability and alerting

- UI:
  - Khong them metric moi bat buoc.
- Scoring:
  - De xuat log sampling cho severity transitions (high->extreme, extreme->high sau decay) trong giai doan canary.

## 10. Security and governance

- Khong thay doi permission model.
- Bat buoc ghi lai moi thay doi trong audit ledger.
- Secrets/config:
  - Neu them feature flag scoring, khai bao ro trong env example/settings.

## 11. Release plan

- Step 1: Merge UI polish slices vao dev, test visual.
- Step 2: Merge scoring tuning slice vao dev voi verification.
- Step 3: Canary verification, neu on dinh thi de xuat release gate.
- Backout:
  - UI: revert commit.
  - Scoring: disable flag or revert commit.

## 12. Ownership and timeline

- Owner implementation: Copilot coding agent.
- Reviewer/Auditor: User (Antigravity process).
- Timeline de xuat:
  - 2026-04-17: Phase 0 + Phase 1 kickoff.
  - 2026-04-18: Phase 2 + Phase 3 audit completion.
  - 2026-04-19: Phase 4 tuning + Phase 5 closeout.

## Definition of Ready

- Plan file nay da tao theo policy 12 muc.
- Scope/non-scope, rollback, test strategy da ro.

## Definition of Done

- Hoan tat theo phases + verify pass.
- Cap nhat day du ledger/progress voi file list trung tam.
