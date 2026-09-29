# OPEN CORE DECISION RECORD V1 (OC-02)

Ngay tao: 2026-04-07
Ngay hieu luc: 2026-04-07
Trang thai: Approved (baseline for execution)
Decision owner: Product Owner (chu tri)
Technical owner: Tech Lead (thuc thi)
Go-to-market owner: Growth Lead (goi va kenh)
Compliance owner: Legal/Compliance (policy va claim)
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_DISCUSSION.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md, OPEN_CORE_08_RISK_REGISTER_V1.md, OPEN_CORE_09_DOCKER_EXPERIENCE_STRATEGY_V1.md, OPEN_CORE_10_VNBROKER_SOURCE_STRATEGY_V1.md, OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md, LANGUAGE_POLICY_V1.md

## 1. Decision scope
Chot bo quyet dinh V1 cho mo hinh Open Core va goi thu phi annual.

Luu y quan tri (2026-04-18):
- Tai lieu nay van la business baseline hop le.
- Tai lieu nay KHONG phai la nguon su that duy nhat cho runtime state, quota unit, hay publish readiness.
- De ra quyet dinh hien tai, doc kem OC-13, OC-14, OC-15, OC-11 va OC-12.

## 2. Approved decisions (V1)
1. Business model
- Chon Open Core: core mo + premium annual.

2. Product packaging
- Community (free): workflow co ban, gioi han quota.
- Pro Individual (annual): AI advisory nang cao, whale alerts nang cao, quota cao.
- Pro Team (annual): team workspace, role/permission, audit/export, support uu tien.

3. Communication principle
- Toan du an dung thong diep: "cong cu ho tro ra quyet dinh".
- Khong dung ngon ngu hua hen ket qua dau tu.

4. Monetization mechanics
- Entitlement theo plan.
- Feature flags + quota theo plan.
- Grace period khi het han.

5. Compliance baseline
- Co Terms/Privacy/Disclaimer truoc khi mo rong marketing.

6. Vnbroker source strategy
- Community (free): dung vnbroker public (PyPI).
- Pro (paid annual): dung vnbroker private da toi uu throughput.
- Van hanh theo dual-source guardrails (tham chieu OC-10).

## 7. Numeric baseline
- Pricing/quota/trial/SLO da duoc lock trong OC-11 cho V1 execution.

## 3. Locked scope for next phase
1. License decision target: Apache-2.0 (final legal confirmation required).
2. Pricing structure: 3-tier (Community / Pro Individual / Pro Team), annual-first.
3. Trial policy target: 7 ngay + grace period 7 ngay + disable premium and keep free flow after grace.
4. Feature boundary lock phai theo OC-05 (V1 matrix).
5. Docker Community MVP scope lock theo OC-09.
6. Vnbroker dual-source lock theo OC-10.

## 4. Approval checklist (baseline)
- Product owner: approved
- Tech lead: approved
- Legal/compliance: conditional approval (final license wording pending)
- Go-to-market owner: approved

## 5. Execution milestones
1. T+7 ngay: lock legal wording + pricing numbers.
2. T+14 ngay: lock entitlement/quota specs for implementation.
3. T+30 ngay: complete Pha 1 goals in OC-03.

## 6. Open items for V1.1 (not blocking baseline)
1. Final support SLA package wording.

## 7. Next review checkpoint
- Review date target: 2026-04-18 governance refresh; neu doi policy lon thi tao OC-02 V2 thay vi rewrite file nay.
