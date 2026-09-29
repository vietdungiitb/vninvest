# OPEN CORE THAO LUAN - Vninvest

Doc ID: OC-01
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, LANGUAGE_POLICY_V1.md

Ngay cap nhat: 2026-04-10

## 1. Muc tieu
- Open source phan cot loi de thu hut user + developer trai nghiem.
- Tinh nang nang cao dong vai tro goi tra phi theo chu ky nam.
- Giu can bang: free du dung, paid du gia tri de chuyen doi.

## 2. Mo hinh de xuat
- Mo hinh: Open Core.
- Kenh thu phi uu tien: SaaS (account + entitlement), co the bo sung self-host Pro cho doanh nghiep.

## 3. Pham vi Free va Paid
### Free (Community)
- Quan ly danh muc co ban, watchlist co ban.
- Realtime gia co ban va chart co ban.
- Tin hieu/nhan dinh co ban, gioi han quota.
- Khong SLA, khong uu tien support.

### Paid (Pro hang nam)
- AI advisory nang cao (goi y tong hop, phan tich sau, tai tao tong hop).
- Whale flow nang cao, canh bao thong minh, uu tien do tre.
- Quota cao, toc do cao hon, uu tien he thong.
- Team workspace, role/permission, audit/export nang cao.
- Support uu tien, SLA theo goi.

## 4. Nguyen tac phan lop san pham
- Free phai tao duoc gia tri ngay trong 5-10 phut dau.
- Paid chi mo khoa nhung thu tao gia tri tai chinh ro rang.
- Khong khoa nhung thao tac cot loi den muc free khong dung duoc.

## 5. License va phap ly
- Core repo: Apache-2.0 hoac MIT.
- Pro: Commercial Terms rieng.
- Bat buoc co:
  - Terms of Use
  - Privacy Policy
  - Investment Disclaimer (khong phai loi khuyen dau tu ca nhan)
- Kiem tra license dependency truoc khi goi thuong mai.

## 6. Co che thu phi hang nam
- Entitlement theo user/team.
- Billing cycle: annual.
- Feature flags theo plan.
- Quota/rate limit theo plan.
- Grace period + read-only mode khi het han.

## 7. Chien luoc GitHub
- Public roadmap ro Free vs Paid.
- CONTRIBUTING minh bach cho phan core.
- Quickstart ngan (5 phut) + demo data.
- Khuyen khich plugin/community extension cho lop free.

## 8. KPI can theo doi
- OSS: stars, forks, active contributors.
- Product: active free users, activation rate, conversion to paid.
- Business: ARR annual, renewal rate, churn, CAC payback.
- Tech: API latency, freshness, error rate theo plan.

## 9. Lo trinh 90 ngay de xuat
### 0-30 ngay
- Chot ranh gioi Free/Paid bang ma tran tinh nang.
- Chot license + legal docs.
- Chuan hoa docs public (README, quickstart, architecture).

### 31-60 ngay
- Trien khai entitlement + annual billing + quota.
- Goi Pro v1 (AI advisory nang cao + whale alerts nang cao).
- Bo sung trang pricing va trial annual.

### 61-90 ngay
- Onboarding funnel cho free -> paid.
- A/B test pricing + package limits.
- Dat KPI gia han nam (renewal) va giam churn.

## 10. Rui ro va giai phap
- Rui ro: fork thuong mai.
  - Giai phap: moat o van hanh, data quality, support, ecosystem.
- Rui ro: free qua yeu khong giu duoc user.
  - Giai phap: giu full workflow co ban trong free.
- Rui ro: paid chua du khac biet.
  - Giai phap: uu tien tinh nang tao ROI truc tiep.

## 11. Quyet dinh can chot som
1. Chon Apache-2.0 hay MIT cho core.
2. Chot 3 goi: Community, Pro Individual, Pro Team.
3. Chot danh sach 5 tinh nang paid dau tien.
4. Chot muc gia annual va chinh sach trial.

## 12. Buoc tiep theo de thao luan
- Lap ma tran tinh nang chi tiet theo tung module hien co cua Vninvest.
- Chuyen ma tran thanh de xuat pricing annual cu the.
- Chot bo KPI thanh cong cho 3 thang dau ra mat Open Core.

## 13. Sprint26 execution checkpoint (2026-04-07)
- Trang thai: Da kick off Sprint26, dang chay Day 1.
- Da xac nhan OpenCore foundation da co trong codebase:
  - Router `/api/opencore/*` da duoc mount va expose cac nhom endpoint license/usage/indicators/billing.
  - Plan seeding (`initialize_dpi_plans`) dang dung feature keys theo indicator (sma, rsi, whale_momentum, dark_pool_flow...).
  - Cac endpoint business can uu tien hook gating nam o stock workspace + whale/order-flow.
- Huong trien khai Day 2-Day 3:
  1. Hook `@require_feature()` vao endpoint indicator/flow uu tien.
  2. Bo sung test matrix free/pro/enterprise cho tung endpoint.
  3. Bat dau track quota/usage cho endpoint tai cao.
- Tieu chi xong Sprint26 (DoD toi thieu):
  - Feature gating hoat dong on dinh tren endpoint uu tien.
  - Co test pass cho free/pro/enterprise.
  - Co runbook local + checklist handoff frontend.

## 14. Community publish readiness checkpoint (2026-04-10)
- Trang thai: Can them mot pha hardening truoc khi public.
- Danh gia tam thoi:
  1. San sang ve huong san pham va Free/Pro baseline.
  2. Chua san sang ve artifact public va legal bundle.
  3. Chua nen announce community repo truoc khi don repo hygiene.

- 3 blocker uu tien cao nhat:
  1. Chua co LICENSE artifact duoc commit o root repo.
  2. Chua co bo legal/public content public-ready.
  3. Chua tach ro README/community package voi full commercial scope.

- Huong thao luan phien sau:
  1. Chot boundary Community repo V1.
  2. Chot cach giu private premium moat.
  3. Chot legal package toi thieu de public.
  4. Chot publish strategy: public source truoc hay public source + image.

- Tai lieu tham chieu truc tiep cho lane nay:
  - OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md

## 15. Buoc tiep theo de thao luan
- Dung OC-13 lam checklist trung tam cho cac phien tiep theo.
- Chot 5 cau hoi mo trong OC-13 truoc khi tao repo public/community mirror.
