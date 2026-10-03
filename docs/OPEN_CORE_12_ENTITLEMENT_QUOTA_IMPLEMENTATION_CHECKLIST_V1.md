# OPEN CORE ENTITLEMENT + QUOTA IMPLEMENTATION CHECKLIST V1 (OC-12)

Doc ID: OC-12
Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-18
Trang thai: Rebaselined after partial implementation in runtime
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md

## 1. Muc tieu
Chuyen OC-11 (pricing/quota/trial/SLO) thanh backlog ky thuat co the code ngay, co acceptance criteria ro rang.

## 2. Hien trang runtime da co (2026-04-18)
1. Da co runtime models/logic cho DPIPlan, DPILicense, DPIEntitlement, usage metrics, analytics, billing, admin va API.
2. Da co runtime plan names `free`, `pro`, `enterprise` trong code OpenCore.
3. Da co quota/accounting lane, nhung representation hien tai nghieng ve monthly counters thay vi chi la daily contract.
4. Da co hardening gan day de fallback tao Free plan an toan khi bang seed chua san.
5. Bai toan hien tai la canonicalization + hardening + package boundary, khong con la draft coding checklist thuần tuy.

## 3. Mapping package/business -> runtime hien tai
1. Community -> `free`
2. Pro Individual -> `pro`
3. Pro Team -> `enterprise`
4. admin giu nguyen la he thong noi bo

Note:
- Mapping tren phan anh runtime truth hien tai.
- Ten `enterprise` trong code KHONG nen tu dong duoc xem la final public packaging name.

## 4. Nhung gi da co gia tri va nen giu
1. Runtime entitlement/quota lane da ton tai va co the tiep tuc harden.
2. Co mo hinh 403/429 + analytics/usage tracking de tiep tuc chuan hoa contract.
3. Co trial/grace/business logic mot phan, nhung chua nen xem la canonical neu chua doi chieu xong tai lieu va runtime.

## 5. Khoang trong canonical can lock truoc khi them code lon
1. Quota unit canonical
- Chot ro API calls/day hay API calls/month la contract chinh.

2. Feature key catalog
- Can co bang canonical feature_key -> package -> endpoint/module -> response/gate mode.

3. Trial/grace contract
- Chot duration, quota ratio, downgrade behavior, message text duoc phep public.

4. Self-host Pro enforcement model
- Chot boundary giua entitlement trong app va commercial moat o package/service/image.

5. Community package boundary
- Chot ro module nao duoc public, module nao chi ton tai private/compiled/service-side.

## 6. Cong viec ky thuat uu tien sau khi da lock canonical decisions
1. Chuan hoa response contract cho 403/429 theo 1 helper trung tam.
2. Doi bo hard-code plan string/indicator gate sang bang entitlement/feature map trung tam.
3. Chot quota accounting service theo don vi canonical va ghi ro reset semantics.
4. Chot trial/grace scheduler contract va test matrix.
5. Them quota snapshot/usage summary co dinh nghia ro cho frontend.

## 7. Danh gia data model hien tai
1. Hien tai da co DPIPlan/DPILicense/DPIEntitlement/DPIQuotaTracker; khong nen them bang moi chi de bua docs khi canonical contract chua lock.
2. Neu quyet dinh canonical quota/day duoc giu, co the can layer chuyen doi hoac them cap reset/accounting ro hon.
3. Neu quyet dinh tiep tuc quota/month la runtime canonical, OC-11 va thong diep pricing/quota phai duoc cap nhat theo huong do.

## 8. Acceptance criteria cho decision checkpoint
1. Team co the chi ra 1 bang map ro giua package business va runtime plan names.
2. Team co the tra loi quota contract chinh la theo ngay hay theo thang ma khong mau thuan giua docs va code.
3. Team co the chi ra module/endpoint nao la Community-safe.
4. Team co the chi ra self-host Pro se duoc phan phoi theo mo hinh nao.
5. Team co the chi ra cac assertion "ready/live/production" nao con gia tri, assertion nao chi la historical artifact.

## 9. Next review checkpoint
- Target review: sau khi owner chot canonical quota/trial/self-host decisions va truoc khi bat ky lane public/community nao duoc green-light.
