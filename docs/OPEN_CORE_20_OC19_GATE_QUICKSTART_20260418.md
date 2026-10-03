# OPEN CORE OC-19 GATE QUICKSTART (OC-20)

Doc ID: OC-20
Ngay tao: 2026-04-18
Trang thai: Team onboarding quick guide
Related docs: OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md

## 1. Muc tieu

Giup dev moi pass OC-19 gate trong 5 phut khi lam PR co tac dong OpenCore.

## 2. Check nhanh truoc khi push

1. Xac dinh PR co tac dong OpenCore khong:
- Boundary Free/Pro
- Entitlement/quota/trial/grace
- Docs governance private/public

2. Neu co tac dong OpenCore, bat buoc cap nhat:
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md

3. Cap nhat docs theo trigger:
- T2: OPEN_CORE_05 hoac OPEN_CORE_13 hoac OPEN_CORE_15
- T3: OPEN_CORE_11 hoac OPEN_CORE_12 hoac OPEN_CORE_13 hoac OPEN_CORE_15
- T4: OPEN_CORE_17 hoac OPEN_CORE_18 hoac OPEN_CORE_13 hoac OPEN_CORE_15

## 3. Local self-check truoc khi tao PR

Chay lenh:

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\quality\check_opencore_doc_sync.ps1 -EventName pull_request -BaseRef dev

Neu PASS thi mo PR.

## 4. PR checklist bat buoc

1. Mo ta ro Runtime truth impact trong PR template.
2. Tick du checklist OC-19 trong .github/pull_request_template.md.
3. Ghi ro audit entry ID moi trong PR description.

## 5. Loi thuong gap va cach fix

1. Thieu docs/CODE_CHANGE_AUDIT_LEDGER.md
- Them entry moi voi muc tieu + danh sach file + noi dung cap nhat.

2. Thieu PROGRESS_DASHBOARD.md
- Them block AUDIT FILE LIST cho dot thay doi hien tai.

3. Thieu docs theo trigger T2/T3/T4
- Cap nhat it nhat 1 file docs hop le theo trigger bi danh dau.

## 6. Dinh nghia PASS/FAIL

1. PASS:
- Script check_opencore_doc_sync.ps1 PASS.
- PR workflow OpenCore Doc Sync Gate xanh.

2. FAIL:
- Thieu audit evidence.
- Thieu doc theo trigger mapping.
- Reviewer xac nhan van con doc-runtime drift.

## 7. Next review checkpoint

- Neu team thay gate dang qua chat/qua long, de xuat cap nhat OC-19 bang phien ban moi (khong sua mat lich su).
