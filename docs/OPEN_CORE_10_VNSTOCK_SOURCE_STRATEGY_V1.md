# OPEN CORE VNSTOCK SOURCE STRATEGY V1 (OC-10)

Ngay tao: 2026-04-07
Trang thai: Approved candidate
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_08_RISK_REGISTER_V1.md

## 1. Decision summary
Chot mo hinh dual-source theo plan:
1. Community (Free): su dung vnstock public tren PyPI.
2. Pro (Paid annual): su dung vnstock private da toi uu throughput va do on dinh.

## 2. Why this decision
1. Tang toc do onboarding Open Core cho cong dong.
2. Bao toan loi the thuong mai va hieu nang cho goi Pro.
3. Giam rui ro ky thuat khi khong ep ca 2 phan khuc dung cung mot source.

## 3. Guardrails bat buoc
1. Source selection theo environment/plan, khong hardcode lung tung.
2. Community lane va Pro lane co CI smoke test rieng.
3. Khong de premium path chay bang source public trong production Pro.
4. Co fallback/rollback runbook khi provider gap su co.

## 4. Compliance and licensing
1. Community branch phai tuan thu dieu khoan su dung cua vnstock public.
2. Pro branch su dung private source theo policy noi bo va hop dong lien quan.
3. Tat ca noi dung doi ngoai giu thong diep "cong cu ho tro ra quyet dinh".

## 5. KPI de danh gia decision
1. Community activation rate.
2. Free -> Pro conversion rate.
3. P95 latency va error rate tren Pro source.
4. Incident lien quan provider switching.

## 6. Open questions
1. Co can fallback tam thoi sang private neu public source fail tren Community khong?
2. Muc SLO toi thieu cho Pro source trong giai doan V1?

## 7. Next review checkpoint
- Review sau 4 tuan soft launch de xac nhan hieu qua dual-source va de xuat V2 neu can.
