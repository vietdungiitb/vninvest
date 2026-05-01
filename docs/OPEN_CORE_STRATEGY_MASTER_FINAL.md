# CHIEN LUOC OPEN CORE VNINVEST (OC-14)

Tai lieu nay la executive summary duoc cap nhat de phan anh dung tinh hinh hien tai cua Open Core trong repo VNInvest.

> **Link ky thuat:** Community lane duoc trien khai thong qua Build Variants (`REACT_APP_BUILD_TARGET=community`). Xem chi tiet tai [REPO_STRATEGY - Build Variants](file:///c:/Mujoco%20Projects/vninvest/docs/REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md). Frontend Community, SaaS va VIP dung chung 1 source code, phan biet bang compile-time flags.
Trang thai: Ready for decision review, chua duoc xem la final implementation order  
Ngay lap: 2026-04-18  
Tai lieu lien quan: OC-02, OC-05, OC-11, OC-12, OC-13, OC-15

---

## 1. Executive conclusion

1. Huong Open Core van la huong dung cho VNInvest.
2. Tuy nhien, du an hien tai chua san sang public/community release ngay.
3. OpenCore trong repo da ton tai o muc runtime implementation mot phan; bai toan hien tai la canonicalization + hardening + package boundary, khong phai bat dau tu trang giay trang.
4. Quyet dinh hop ly nhat luc nay khong phai la "co Open Core hay khong", ma la "co phe duyet lane hardening 21 ngay de chot boundary va publish gate hay tiep tuc delay".

## 2. Tam nhin van dung

Mo hinh Open Core cua VNInvest nham dat 2 muc tieu song song:
1. Community lane:
- Tro thanh bo san pham tracking/analysis co the self-host, de onboarding nhanh, de tao traction va trust.

2. Commercial lane:
- Ban ra gia tri phan tich/co van mang tinh intelligence, khong chi la UI/hosting, de tao paid moat that su.

## 3. Nhung gi da lock o muc chien luoc

1. Community phai co gia tri su dung that, khong chi la ban demo cat giam.
2. Paid lane phai tap trung vao intelligence: AI advisory nang cao, whale/dark-flow intelligence, quota/throughput cao hon, va cac nang luc team/compliance.
3. Dual-lane SaaS + self-host van la huong phu hop.
4. Communication principle van phai la "cong cu ho tro ra quyet dinh", tranh claim dau tu.

## 4. Nhung gi CHUA duoc lock nhung rat quan trong

1. Quota canonical theo ngay hay theo thang.
2. Mapping giua ten package kinh doanh va ten plan runtime (`free`, `pro`, `enterprise`).
3. Community package V1 chinh xac gom nhung module/endpoint nao.
4. Self-host Pro se duoc phan phoi theo private package, private image, hay service boundary.
5. Co che license/self-host Pro online-offline/grace se duoc thiet ke ra sao.

## 5. Feature boundary o muc san pham

Boundary de nghi hien tai van hop ly neu doc o muc san pham:

### Community
1. Watchlist/dashboard/workspace ca nhan co ban.
2. Realtime quote co quota hoac tan suat hop ly.
3. Chart co ban va indicator co ban.
4. Docker Community path + demo seed co gia tri ngay.

### Paid / Pro
1. AI advisory nang cao, thesis, watch levels, digests.
2. Whale alerts nang cao, dark-flow intelligence, reliability/scoring.
3. Throughput/quota cao va uu tien thong luong.
4. Team workspace, role/permission, audit/export, SLA/support.

Luu y:
- Boundary o tren la boundary cap product.
- Boundary cap technical package/feature_key/endpoint van chua duoc khoa hoan tat.

## 6. Repo va package strategy can noi dung muc te hon

Khong nen mac dinh rang co the cat 1 thu muc `/core` roi mirror ngay.

Tinh hinh thuc te hon la:
1. Private monorepo hien dang la nguon goc dung.
2. Truoc khi co public repo, can tao duoc Community distribution package ro rang.
3. Sau khi package boundary du sach, moi quyet dinh mirror/subtree/polyrepo mechanism.

Noi ngan gon:
- Truoc: package boundary.
- Sau: mirroring automation.

## 6.1 Docs governance (private vs public)

1. Thu muc `docs/` trong repo hien tai la private docs phuc vu phat trien noi bo.
2. Public docs khong duoc suy dien tu dong tu `docs/`; phai co publication lane rieng.
3. Neu OpenCore duoc public, can co mot bo public docs da duoc bien tap/lint/legal-review, duoc tao tu private docs theo allowlist.
4. Khong public raw private docs de tranh ro ri strategy, risk, backlog noi bo, va noise governance.

## 7. Hybrid operating model

### SaaS
1. Day la kenh de kiem soat entitlement, usage, onboarding, analytics va upsell tot nhat.
2. Phu hop de toi uu conversion va van hanh tap trung.

### Self-host Community
1. Can phai run duoc tren may sach trong 5-10 phut.
2. Chi nen chua nhung artifact public-safe, khong chua moat thuong mai that su.

### Self-host Pro
1. Co the dung private package/private image/private service boundary.
2. Khong nen coi compiled module hay hardware fingerprinting la giai phap chinh neu operating model chua khoa.
3. Moat ben vung hon la data processing quality, scoring pipeline, prompt chain, entitlement/ops quality, va su khac biet ROI cua paid lane.

## 8. Moat thuong mai nen dat o dau

Nen uu tien:
1. Data quality va normalization pipeline.
2. Whale/dark-flow scoring logic.
3. AI advisory orchestration/prompt chaining.
4. Throughput, support, SLA, managed experience.
5. Entitlement va operational excellence.

Khong nen dat qua nhieu ky vong vao:
1. Chi compiled package la du de bao ve moat.
2. Chi hardware fingerprinting la du de giai bai toan self-host commercial control.

## 9. De xuat roadmap thuc te hon

### Giai doan A - Governance reset va canonicalization
1. Chot quota/trial canonical.
2. Chot package/runtime mapping.
3. Chot self-host Pro operating model.
4. Chot authoritative doc set.

### Giai doan B - Publish hardening
1. Legal/publication artifacts.
2. Repo hygiene public-safe.
3. Docker Community quickstart + smoke test may sach.
4. Package allowlist cho Community.

### Giai doan C - Controlled launch
1. Soft-launch cohort.
2. KPI va cost review.
3. Neu gate xanh moi public/announce rong.

## 10. Khuyen nghi cho quyet dinh tiep theo

Khuyen nghi hien tai:
1. Khong announce public/community repo ngay.
2. Phe duyet mot lane hardening ngan han de chot 5 quyet dinh con treo.
3. Sau khi 5 quyet dinh nay duoc khoa, moi danh gia lai go/no-go cho public lane.
4. Chot som docs governance: private docs giu nguyen trong repo noi bo, public docs tao thanh bo rieng theo publication pipeline.

## 11. Tai lieu nay dung de lam gi

Tai lieu nay dung de:
1. Gioi thieu cho stakeholder/PO/leadership logic Open Core hien tai.
2. Dinh vi lai ky vong: chua phai launch-ready, dang o giai doan decision-ready.
3. Dan huong sang bo tai lieu canonical chi tiet hon (OC-13, OC-15, OC-11, OC-12).

---
IMPORTANT:
Tai lieu nay khong tu than khoa numeric quota hoac runtime contract. Moi quyet dinh co tinh thuc thi phai doi chieu voi OC-13, OC-15, OC-11 va OC-12.
