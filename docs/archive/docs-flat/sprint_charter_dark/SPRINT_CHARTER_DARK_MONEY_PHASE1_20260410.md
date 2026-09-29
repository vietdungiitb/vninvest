# Sprint Charter - Dark Money Integrity & Usability Phase 1 (2026-04-10)

## 1) Muc tieu sprint

Dat muc release candidate cho lop correctness cua Dark Money Flow, dam bao:
- Tin hieu dung va nhat quan tren cac nguon du lieu.
- Pagination aggregate tin cay, khong duplicate/missing.
- Severity dark_flow co phan tang hop ly de trader hieu va xu ly.

## 2) Pham vi sprint (in-scope)

Bat buoc:
1. A1 - Deterministic event identity.
2. A2 - Pagination contract v2.
3. B1 - Dark flow severity remap (non-AI).

Co dieu kien (chi lam neu con capacity):
1. A3 - Threshold policy unification (mot phan).

## 3) Out-of-scope

1. C3, C4, D2.
2. Thay doi UI cosmetics khong lien quan triage/correctness.
3. Tat ca hang muc AI.

## 4) KPI sprint

KPI bat buoc:
1. Duplicate event rate < 1% tren tap pilot.
2. Pagination consistency > 99.9%.
3. Ti le dark_flow severity=info giam ve muc baseline moi da chot.

KPI theo doi them:
1. Merge over-count incidents.
2. Alert ignore rate (lam baseline cho phase sau).

## 5) Team va ownership

1. BE-Lead: A1, A2, B1.
2. QA-Lead: contract matrix, regression gate cho scope sprint.
3. PM-Lead: chot rulebook severity + go/no-go gate.
4. FE-Lead: ho tro contract alignment (neu can update parser/contract handling).
5. DevOps-Lead: ho tro metric collection dashboard can thiet.

## 6) Milestone va gate

1. Gate G1 (Giua sprint):
- A1 draft hoan tat, event key spec duoc review.
- Contract matrix A2 ban dau duoc QA/FE xac nhan.

2. Gate G2 (Cuoi sprint):
- A1 + A2 + B1 pass acceptance.
- Khong con blocker critical > 48h.
- KPI correctness dat muc tieu toi thieu.

## 7) Risk chinh va ung pho

1. R1 - Scope creep do chen task UI:
- Ung pho: freeze in-scope, moi thay doi scope can PM approve.

2. R2 - Contract khong on dinh giua sources:
- Ung pho: uu tien A2 truoc moi enhancement UX.

3. R3 - KPI baseline chua ro:
- Ung pho: chot baseline trong 2 ngay dau sprint.

## 8) Definition of Sprint Done

Sprint Phase 1 duoc xem la hoan tat khi:
1. A1, A2, B1 dong ticket theo acceptance gate.
2. Regression checks cho scope sprint da pass.
3. Da cap nhat bao cao ket qua va de xuat phase tiep theo trong roadmap.