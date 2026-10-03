# OPEN CORE PRICING AND PACKAGING DRAFT V1 (OC-06)

Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-18
Trang thai: Baseline pricing hypothesis, chua duoc xem la execution-ready
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md

## 1. Muc tieu
Tao khung pricing annual de test thi truong trong 90 ngay dau, uu tien don gian va de toi uu.

## 2. Cac goi de xuat
1. Community: mien phi
2. Pro Individual: annual cho ca nhan
3. Pro Team: annual theo so seat + team features

## 3. Packaging draft
### Community
- Full onboarding co ban
- Gioi han quota/tan suat
- Khong SLA, khong support uu tien

### Pro Individual
- AI advisory nang cao
- Whale alerts nang cao
- Quota cao hon
- Priority processing co gioi han

### Pro Team
- Toan bo Individual
- Team workspace + role/permission
- Audit log + export nang cao
- Support uu tien, SLA theo policy

## 4. Pricing architecture (chua final)
- Annual-first pricing
- Trial: tai lieu nay tung de xuat 14 ngay, nhung baseline business hien tai trong OC-02/OC-11 dang nghieng ve 7 ngay + grace 7 ngay; can chot canonical truoc khi thong diep ra ben ngoai
- Grace period: 7 ngay sau expiry
- Sau grace: read-only mode

## 5. Rule gia
1. Gia phai de vao cho Pro Individual (de toi uu conversion)
2. Team dinh gia theo seat + base fee
3. Co annual discount ro rang so voi monthly equivalent

## 6. KPI danh gia pricing
1. Free -> trial conversion
2. Trial -> paid annual conversion
3. Renewal rate sau 12 thang
4. ARPA theo tung goi
5. Churn theo cohort

## 7. Bien so can test (A/B)
1. Trial 14 ngay vs premium credits
2. Gioi han quota Free muc A/B/C
3. Bang gia Team theo seat tiers

## 8. Open questions
1. Co can monthly plan cho giai doan dau khong?
2. Co educational/startup discount khong?
3. Muc quota nao la diem can bang giua growth va chi phi?
4. Trial/grace canonical message nao duoc phep dung cong khai?

## 9. Next review checkpoint
- Chot pricing V1 cung trial/grace wording va dong bo sang OC-11/OC-12 truoc khi public bat ky bang gia nao.
