# OPEN CORE DECISION PACKET CURRENT (OC-15)

Doc ID: OC-15
Ngay tao: 2026-04-18
Trang thai: Canonical decision packet for current governance checkpoint
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md, OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, OPEN_CORE_STRATEGY_MASTER_FINAL.md

## 1. Muc tieu

Cho stakeholder/PO/tech lead mot tai lieu duy nhat co the doc nhanh de:
1. Hieu tinh hinh Open Core hien tai.
2. Biet dieu gi da lock, dieu gi chua lock.
3. Ra quyet dinh tiep theo ma khong bi nhieu boi cac tai lieu lich su.

## 2. Mot cau ket luan

Open Core van la huong dung, nhung public/community release hien tai nen de trang thai NO-GO cho den khi boundary, quota/trial canonical, legal/public artifacts va self-host Pro operating model duoc khoa ro rang.

## 3. Dieu gi da dung va co the giu nguyen

1. Business direction Open Core + annual paid tiers.
2. Paid moat xoay quanh AI advisory nang cao, whale/dark-flow intelligence, throughput, team/compliance features.
3. Docker Community onboarding van la muc tieu dung.
4. Runtime OpenCore da ton tai o backend, khong phai y tuong tren giay.

## 4. Dieu gi dang sai hoac de gay quyet dinh sai neu doc nham docs cu

1. Co tai lieu lich su noi OpenCore "ready for production", "fully functional", "live by April 15".
2. Business baseline quota trong docs cu dang o don vi theo ngay, nhung runtime hien tai co bieu dien theo thang.
3. Ten package kinh doanh va ten plan runtime chua duoc giai thich nhat quan.
4. Chua co bang package boundary du ro de tach Community repo an toan.

## 5. Runtime truth ngan gon

1. Backend da co `DPIPlan`, `DPILicense`, `DPIEntitlement`, analytics, billing, admin, API va celery task lane.
2. Runtime plan names hien tai la `free`, `pro`, `enterprise`.
3. Co dau vet hardening moi cho fallback Free plan va analytics/quota fail-safe.
4. Điều nay xac nhan rang project dang o giai doan hardening/canonicalization, khong phai giai doan y tuong.

## 6. 5 quyet dinh phai khoa truoc khi green-light trien khai/public lane

1. Quota canonical se theo ngay hay theo thang?
2. Package business se map vao runtime plan names nhu the nao?
3. Community V1 package cho public gom nhung module/endpoint nao?
4. Self-host Pro se duoc phan phoi/enforce theo mo hinh nao?
5. License/legal/disclaimer/support policy public se duoc chot ra sao?

## 6.1 Quyet dinh bo sung ve docs governance (uu tien cao)

6. Co xac nhan chinh thuc rang thu muc `docs/` la private docs trong moi phien ban va moi branch?
7. Public docs se duoc tao tu lane nao (allowlist/sanitize/legal review) truoc khi dua ra cong dong?
8. Public docs allowlist V1 (pham vi va blocklist) da duoc owner chot chua?
9. Team da thong nhat OC-19 la merge gate mac dinh cho PR OpenCore chua?

## 7. Go/No-Go hien tai

### Public/community repo
- NO-GO

Ly do:
1. Boundary package chua du ro.
2. Quota/trial canonical chua khoa.
3. Legal/publication artifacts chua du.
4. Self-host Pro operating model chua khoa.

### Lane hardening 21 ngay
- CONDITIONAL GO

Dieu kien:
1. Owner phai chot 5 quyet dinh o Muc 6.
2. Team thong nhat authoritative doc set la OC-13, OC-14, OC-15, OC-11, OC-12.
3. Team thong nhat docs governance: `docs/` la private, public docs la artifact lane rieng.

## 8. Bo tai lieu nen doc theo thu tu

1. OC-15: doc nay.
2. OC-14: strategy summary.
3. OC-13: go/no-go publish gate.
4. OC-11: business baseline vs runtime drift.
5. OC-12: ky thuat can canonical hoa va hardening.
6. OC-05: boundary cap san pham.

## 9. Bo tai lieu KHONG nen dung de ra quyet dinh hien tai

1. OPENCORE_VERIFICATION_CHECKLIST.md
2. OPENCORE_INTEGRATION_GUIDE.md
3. OPENCORE_VISUAL_REFERENCE.md
4. OPENCORE_VISUAL_TEST_RESULTS.md
5. OPENCORE_VISUAL_TEST_SUMMARY.md
6. OPEN_CORE_IMPLEMENTATION_COMPLETE.md

Ly do:
- Cac tai lieu nay la point-in-time artifact dau thang 4 va co thong diep qua tu tin so voi gate hien tai.

## 10. De xuat quyet dinh tiep theo

Phe duyet phuong an sau:
1. Khong public repo/nghi launch cong khai ngay.
2. Vao 1 lane hardening ngan han de chot boundary, quota/trial canonical, legal/public artifacts va self-host Pro operating model.
3. Sau lane do, review lai OC-13 de ra quyet dinh go/no-go public lane.

## 11. Next review checkpoint

- Checkpoint tiep theo: khi 5 quyet dinh o Muc 6 da co owner, due date va phuong an ro rang.