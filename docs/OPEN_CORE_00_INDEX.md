# OPEN CORE DOCUMENT INDEX (OC-00)

Ngay cap nhat: 2026-04-18
Muc tieu: Lam chi muc trung tam cho toan bo tai lieu Open Core va chi ro bo tai lieu nao dang co gia tri quyet dinh thuc te o thoi diem hien tai.

Nguyen tac quan tri tai lieu (bat buoc):
1. Thu muc `docs/` cua repo nay la PRIVATE docs, phuc vu phat trien noi bo.
2. Public docs (neu co) phai duoc dong goi/thiet ke rieng theo lane publication, khong dong nhat voi private docs.
3. Khong coi bat ky file nao trong `docs/` la tai lieu se public mac dinh.

## 1. Quy uoc dat ten
- Dinh dang: OPEN_CORE_XX_<TOPIC>.md
- XX la thu tu logic theo quy trinh ra quyet dinh.
- Moi tai lieu phai co:
  - Doc ID (vi du: OC-02)
  - Related docs
  - Next review checkpoint

## 2. Bo tai lieu canonical hien tai
1. OC-00 (chi muc): OPEN_CORE_00_INDEX.md
2. OC-01 (thao luan nen): OPEN_CORE_DISCUSSION.md
3. OC-02 (quyet dinh V1): OPEN_CORE_02_DECISION_RECORD_V1.md
4. OC-03 (ke hoach trien khai): OPEN_CORE_03_EXECUTION_PLAN_90D.md
5. OC-04 (policy ngon ngu): LANGUAGE_POLICY_V1.md
6. OC-05 (ma tran Free/Pro): OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md
7. OC-06 (pricing draft): OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md
8. OC-07 (agenda workshop): OPEN_CORE_07_DECISION_WORKSHOP_AGENDA_V1.md
9. OC-08 (risk register): OPEN_CORE_08_RISK_REGISTER_V1.md
10. OC-09 (docker experience strategy): OPEN_CORE_09_DOCKER_EXPERIENCE_STRATEGY_V1.md
11. OC-10 (vnstock source strategy): OPEN_CORE_10_VNSTOCK_SOURCE_STRATEGY_V1.md
12. OC-11 (numeric lock sheet): OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md
13. OC-12 (entitlement + quota implementation checklist): OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md
14. OC-13 (community publish readiness): OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md
15. OC-14 (executive strategy refresh): OPEN_CORE_STRATEGY_MASTER_FINAL.md
16. OC-15 (decision packet current): OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md
17. OC-16 (review memo, non-decisional): OPEN_CORE_16_REVIEW_MEMO_20260418.md
18. OC-17 (docs governance private vs public): OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md
19. OC-18 (public docs allowlist v1): OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md
20. OC-19 (default team governance policy): OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md
21. OC-19a (automation gate): .github/workflows/opencore-doc-sync-gate.yml + scripts/quality/check_opencore_doc_sync.ps1
22. OC-20 (OC-19 gate quickstart): OPEN_CORE_20_OC19_GATE_QUICKSTART_20260418.md
23. OC-21 (branch protection setup): OPEN_CORE_21_BRANCH_PROTECTION_OC19_SETUP_20260418.md

## 3. Thu tu doc de ra quyet dinh nhanh
1. Bat dau tu OC-15 neu can mot ban tong hop de ra quyet dinh.
2. Doc OC-14 de hieu logic san pham/chien luoc o muc lanh dao.
3. Doc OC-13 de thay go/no-go gate hien tai cho community/public lane.
4. Doc OC-12 va OC-11 de thay do lech giua business baseline va runtime truth.
5. Doc OC-05 neu can xem boundary feature cap module.
6. Doc OC-16 neu muon co mot memo ngan de nghien cuu truoc khi quyet dinh.
7. Doc OC-17 de lock nguyen tac private docs/public docs truoc khi mo community lane.
8. Doc OC-18 de chot danh sach tai lieu duoc phep cong bo o V1.
9. Doc OC-19 de thuc thi quy dinh mac dinh cho doi code.
10. Kiem tra OC-19a de xac nhan gate tu dong dang bat.
11. Dung OC-20 de onboarding dev moi trong 5 phut.
12. Dung OC-21 de khoa merge gate o cap branch protection.

## 4. Nguon su that theo loai thong tin
1. Business direction baseline:
- OC-02.

2. Hien trang va next-step thuc te:
- OC-15, OC-14, OC-13, OC-16, OC-17, OC-18, OC-19.

3. Boundary cap san pham:
- OC-05.

4. Numeric/business baseline vs runtime drift:
- OC-11, OC-12.

5. Implementation execution lane:
- OC-03.

## 5. Tai lieu lich su, giu lai cho audit nhung KHONG dung de ra quyet dinh hien tai
1. OPENCORE_VERIFICATION_CHECKLIST.md
2. OPENCORE_INTEGRATION_GUIDE.md
3. OPENCORE_VISUAL_REFERENCE.md
4. OPENCORE_VISUAL_TEST_RESULTS.md
5. OPENCORE_VISUAL_TEST_SUMMARY.md
6. OPEN_CORE_IMPLEMENTATION_COMPLETE.md

Ly do: cac tai lieu nay phan anh mot diem thoi gian dau thang 4, co nhieu khang dinh kieu "ready/live/production" khong con duoc xem la authoritative cho quyet dinh Open Core hien tai.

## 6. Luong cap nhat tai lieu
1. Cap nhat OC-01 khi co insight moi.
2. Dung OC-05 de cham diem va lock ranh gioi Free/Pro.
3. Dung OC-06 de chot packaging/pricing annual.
4. Chot thay doi vao OC-02 (quyet dinh da duoc thong qua).
5. Chuyen thanh cong viec trien khai vao OC-03 (task, owner, moc thoi gian).
6. Dong bo thong diep vao OC-04 de giu nhat quan product/legal/marketing.
7. Theo doi rui ro qua OC-08 trong qua trinh rollout.
8. Xac nhan source strategy qua OC-10 cho Community vs Pro.
9. Khoa tham so so hoc qua OC-11 (pricing/quota/trial/SLO).
10. Chuyen OC-11 thanh backlog code qua OC-12 (entitlement/quota/trial).
11. Dung OC-13 de danh gia go/no-go truoc khi public Community repo.
12. Dung OC-15 de tong hop executive decision pack cho tung checkpoint quan tri.
13. Dung OC-16 neu can 1 memo ngan de stakeholder doc truoc khi chot y kien.
14. Dung OC-17 de xac nhan lane docs private/public va artifact packaging truoc publication.
15. Dung OC-18 de lock allowlist public docs va publication checklist.
16. Dung OC-19 lam quy dinh mac dinh trong moi PR OpenCore.
17. Duy tri OC-19a (workflow + script + PR template) de enforcement o cap CI.
18. Ap dung OC-20/OC-21 cho van hanh nhom va hosting enforcement.

## 7. Rule quan tri phien ban
- Voi thay doi lon: tao ban moi, vi du OPEN_CORE_02_DECISION_RECORD_V2.md.
- Khong ghi de lich su quan trong trong cung file neu thay doi policy lon.
- Moi vong quyet dinh phai co ngay hieu luc va owner.

## 8. Next review checkpoint
- Checkpoint tiep theo: review OC-15 + OC-13 de quyet dinh co vao lane hardening/publish hay tiep tuc delay boundary lock.
