# OPEN CORE EXECUTION PLAN 90D (OC-03)

Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-18
Trang thai: Rebaselined for current decision checkpoint
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md, OPEN_CORE_09_DOCKER_EXPERIENCE_STRATEGY_V1.md, OPEN_CORE_10_VNSTOCK_SOURCE_STRATEGY_V1.md, LANGUAGE_POLICY_V1.md

## 0. Tinh hinh hien tai (2026-04-18)
1. Huong san pham Open Core da co baseline business qua OC-02.
2. Lop runtime OpenCore da ton tai o backend (plan, license, analytics, billing, API, admin), nen bai toan hien tai KHONG con la greenfield implementation.
3. Van con do lech giua business baseline va runtime truth, dac biet o quota unit, ten plan runtime, va boundary package Community vs Pro.
4. Public/community lane hien tai nen duoc xem la publish-hardening problem, khong phai announce-ready problem.

## 1. Muc tieu 90 ngay
- Chot va ra mat Open Core V1.
- Van hanh duoc luong Free -> Paid annual.
- Dat bo KPI co so cho conversion va renewal.

## 2. Pha 1 (Ngay 0-21): Canonicalization va governance reset
1. Canonical hoa bo tai lieu quyet dinh hien tai (OC-14, OC-15, OC-13, OC-11, OC-12).
2. Lock lai boundary Community / Pro / Pro Team o muc package va feature_key.
3. Chot quota unit canonical (day hay month) va cach map giua business package voi runtime plan names.
4. Chot legal/publication baseline toi thieu truoc khi noi den mirror/public repo.
5. Xac nhan Docker Community MVP scope theo OC-09 tren tieu chi public-safe.
6. Xac nhan self-host Pro operating model: private package, private image, service boundary, online/offline license policy.

Deliverables:
- OC-15 duoc dung lam decision packet hien tai.
- Danh sach canonical boundary + runtime drift duoc lock.
- Publication checklist duoc chuyen thanh go/no-go gate ro rang.
- Danh sach artifact Community V1 duoc lock o muc package.

## 3. Pha 2 (Ngay 22-45): Hardening cho community/public lane
1. Hardening entitlement/quota da ton tai thay vi viet moi tu dau.
2. Don repo hygiene, secret/config/runtime artifact, va legal/public artifacts.
3. Chuan hoa CTA/upsell theo language policy va legal wording.
4. Dong goi Docker Community onboarding thuc su chay duoc tren may sach trong 5-10 phut.
5. Chot public README, CONTRIBUTING, SECURITY, support expectation.

Deliverables:
- Entitlement/quota runtime contract duoc harden va co tai lieu canonical.
- Repo dat muc public-safe.
- Docker Community quickstart + demo path qua smoke test.
- Community package duoc tai clone moi ma khong lo premium/private lane.

## 4. Pha 3 (Ngay 46-90): Controlled launch va toi uu
1. Soft-launch cho nhom user/cohort dau tien thay vi announce rong ngay lap tuc.
2. Do KPI theo tuan va xem lai cost/conversion.
3. Tinh chinh quota/gia/goi dua tren du lieu su dung thuc.
4. Chot V2 decision backlog.

Deliverables:

## 5. Nhung gi da co san trong codebase
1. Co runtime models cho plan/license/entitlement/analytics/revenue.
2. Co API, admin va celery task cho OpenCore lane.
3. Da co hardening gan day de tranh `DPIPlan.DoesNotExist` va analytics fail-safe.

## 6. Nhung gi chua du dieu kien de public ngay
1. Chua co boundary package Community vs Pro du ro de mirror/subtree an toan.
2. Quota business baseline va quota runtime implementation dang lech nhau.
3. Chua co bo legal/publication/public-support artifacts dat muc go-live.
4. Chua chot operating model cho self-host Pro.

## 7. KPI can theo doi
1. Activation free (D1/D7)
2. Free -> trial conversion
3. Trial -> paid annual conversion
4. Renewal/churn som
5. CAC payback so bo

## 8. RACI toi thieu
- Product owner: pham vi va pricing
- Tech lead: entitlement/flags/quota
- Growth owner: landing + social funnel
- Compliance owner: legal + claim review

## 9. Next review checkpoint
- Governance checkpoint tiep theo: 2026-04-18 / 2026-04-19 de chot co vao lane hardening 21 ngay hay tiep tuc tri hoan public lane.
