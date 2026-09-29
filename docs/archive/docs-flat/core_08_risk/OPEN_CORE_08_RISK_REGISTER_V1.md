# OPEN CORE RISK REGISTER V1 (OC-08)

Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-18
Trang thai: Active risk register for decision checkpoint
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md

## 1. Thang do
- Probability: Low / Medium / High
- Impact: Low / Medium / High
- Priority: P1 (cao nhat) -> P3

## 2. Risk list
| ID | Risk | Probability | Impact | Priority | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R1 | Public/community lane duoc mo khi boundary package chua ro | High | High | P1 | Chot package-level allowlist + feature_key map truoc khi noi den mirror/public repo | Tech lead + Product |
| R2 | Tai lieu cu kieu "ready/live/production" gay quyet dinh sai | High | High | P1 | Hien tai da ha cap tai lieu lich su, chi dung bo OC-13/14/15 de ra quyet dinh | Product owner |
| R3 | Quota business baseline va quota runtime implementation lech nhau | High | High | P1 | Chot canonical quota unit, cap nhat doc + code + contract | Tech lead |
| R4 | Self-host Pro operating model mo ho, dan den moat yeu hoac do phuc tap van hanh qua cao | Medium | High | P1 | Chot som private package/image/service boundary va license policy | Leadership + Tech |
| R5 | Claim marketing vuot qua policy, rui ro phap ly | Medium | High | P1 | Bat buoc review theo Language Policy V1 va legal bundle truoc khi publish | Compliance |
| R6 | Repo hygiene/legal artifacts chua dat muc public-safe | High | High | P1 | Gate OC-13, khong public truoc khi xong license/disclaimer/README/support docs | Tech + Compliance |
| R7 | Free qua han che, activation thap | Medium | High | P2 | Dam bao workflow co ban + Docker quickstart + demo path co gia tri that | Product |
| R8 | Paid khong du khac biet, conversion thap | Medium | High | P2 | Khoa 5 premium capabilities tao ROI ro va giu ngoai community package | Product + Growth |
| R9 | Chi phi van hanh cao do quota mo rong som | Medium | Medium | P2 | Quota by plan + monitor cost per active user | Tech |
| R10 | Gia annual khong phu hop thi truong | Medium | Medium | P2 | Chay cohort pricing/trial sau khi hardening xong | Growth |

## 3. Trigger can theo doi
1. Activation free < muc muc tieu 2 tuan lien tiep
2. Trial -> paid conversion < nguong canh bao
3. So ticket support tang dot bien
4. Chi phi he thong/active user vuot nguong
5. Van con tai lieu authoritative noi OpenCore "ready/live" du gate OC-13 chua xanh
6. Community package khong clone/run duoc tren may sach trong 5-10 phut

## 4. Next review checkpoint
- Review risk ngay o checkpoint governance tiep theo; neu R1/R2/R3/R6 chua giam thi giu trang thai no-go cho public lane.
