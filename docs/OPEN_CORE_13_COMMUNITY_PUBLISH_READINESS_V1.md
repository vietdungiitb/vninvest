# OPEN CORE COMMUNITY PUBLISH READINESS V1 (OC-13)

Doc ID: OC-13
Ngay tao: 2026-04-10
Trang thai: Working draft for next discussion
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_DISCUSSION.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_08_RISK_REGISTER_V1.md, OPEN_CORE_09_DOCKER_EXPERIENCE_STRATEGY_V1.md, OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md, SPRINT28_LEGAL_CONTENT_EXECUTION_PLAN.md

## 1. Muc tieu
- Tong hop trang thai san sang publish phan Community/Open Core de cac phien sau thao luan tren cung mot mat bang.
- Tach ro viec nao da co quyet dinh, viec nao con thieu artifact public, va viec nao la blocker truoc khi mo repo community.

## 2. Ket luan tam thoi (2026-04-10)
- Nen coi du an da san sang ve huong san pham Open Core, nhung chua san sang public repo ngay lap tuc.
- Trang thai hien tai phu hop de vao pha "publish hardening" thay vi "announce public".
- Muc tieu thuc te: chot community package + legal/publication artifacts + repo hygiene truoc khi tao repo public hoac mirror community.

## 3. Da san sang gi
1. Huong kinh doanh da lock:
- Open Core + annual paid tiers da duoc phe duyet trong OC-02.

2. Ranh gioi Free/Pro da co baseline:
- Community: watchlist co ban, chart co ban, realtime quote co gioi han.
- Paid: AI advisory nang cao, whale alerts nang cao, team workspace, audit/export, quota cao.

3. Docker Community da co dinh huong dung:
- Muc tieu "run in 5-10 minutes" da duoc lock trong OC-09.

4. Entitlement/quota da co huong ky thuat:
- OC-12 da chuyen numeric/spec thanh backlog code va acceptance criteria.

## 4. Blocker truoc khi public
### B1 - License artifact chua xuat hien o root repo
- OC-02 da target Apache-2.0, nhung repo hien chua co file LICENSE.
- Khong nen public community repo khi chua co artifact license ro rang.

### B2 - Legal/public content chua dong goi xong
- Sprint28 legal content van o trang thai planned.
- Chua co public-ready bundle toi thieu gom:
  - Terms/Usage wording
  - Privacy wording
  - Investment disclaimer
  - About/Open Core positioning

### B3 - Repo hygiene chua dat muc public-safe
- Can loai bo hoac dung track env production file thay vi de file env mode production trong git.
- Can quet lai secret/config/runtime artifacts truoc khi public.
- Can xac nhan dependency va source strategy khong gay hieu nham giua Community va Pro/private lanes.

### B4 - Community package chua du ro cho outsider
- README hien tai van mo ta toan bo san pham, chua tach thong diep Community publish.
- Chua co bo tai lieu public-facing toi thieu: CONTRIBUTING, SECURITY, issue template/bug-report expectation, publish FAQ.

## 5. Boundary de thao luan tiep
### Nen dua vao Community repo V1
1. Dashboard/watchlist/workspace ca nhan co ban.
2. Realtime quote co quota hoac tan suat hop ly.
3. Chart co ban.
4. Demo seed data + demo account local.
5. Docker compose Community stack.
6. Entitlement/quota framework cho Free/Pro boundary.

### Nen giu ngoai Community repo hoac khoa chat bang commercial boundary
1. AI advisory nang cao neu can private moat.
2. Whale alerts nang cao neu can private moat.
3. Team workspace, role/permission, audit/export nang cao.
4. Bat ky source private nao duoc toi uu throughput cho paid tier.
5. Van hanh, support SLA, hoac private images/registry cho self-host Pro.

## 6. Publish readiness checklist de chot o phien sau
### Product/package
- [ ] Chot danh sach module Community V1.
- [ ] Chot danh sach module Pro giu private hoac chi expose qua entitlement.
- [ ] Chot thong diep README/landing cho community.

### Legal/compliance
- [ ] Chot license cuoi cung (target hien tai: Apache-2.0).
- [ ] Chot disclaimer "cong cu ho tro ra quyet dinh" tren docs va onboarding.
- [ ] Chot goi legal content toi thieu truoc public.

### Engineering/publication
- [ ] Repo khong con file env nhay cam hoac production env dang track.
- [ ] Repo khong con runtime artifacts/build artifacts khong can thiet.
- [ ] Docker quickstart chay duoc tren may sach trong 5-10 phut.
- [ ] Demo seed flow tao duoc gia tri ngay.
- [ ] Feature gating/entitlement khong de lo premium lane mot cach de bypass.

### GTM/community ops
- [ ] Co CONTRIBUTING + SECURITY + support expectation ro rang.
- [ ] Co issue triage rule cho community.
- [ ] Co soft-launch cohort truoc khi announce rong.

## 7. De xuat thu tu thuc hien
1. Chot boundary repo Community V1.
2. Tao legal/publication bundle toi thieu.
3. Don repo hygiene va bo tracked env production.
4. Dong goi README + Docker quickstart + demo path.
5. Chay smoke test tu may sach/clone moi.
6. Moi tao repo public hoac community mirror.

## 8. Cac cau hoi can lock trong phien tiep theo
1. Community repo la monorepo cat giam, hay mirror/subtree rieng?
2. Premium code se:
- o lai trong repo va khoa bang entitlement,
- hay tach sang private package/service,
- hay dong goi thanh private image?
3. License cuoi cung co van la Apache-2.0 khong?
4. Co public ngay Docker image len GHCR khong, hay chi public source truoc?
5. Muc support cho community la best-effort hay issue-only?

## 9. Go/No-Go gate de dung cho lan review sau
### Go neu:
- License + disclaimer + repo hygiene + Docker quickstart deu xong.
- Boundary Community/Pro duoc ghi ro trong docs va enforcement duoc kiem tra.

### No-Go neu:
- Chua chot legal wording.
- Van con env production/secret hygiene mo ho.
- README va package public van mo ta lan giua community va paid.

## 10. Next review checkpoint
- Muc tieu phien tiep theo: chot 5 quyet dinh o Muc 8 va doi trang thai tu "Working draft" sang "Approved for execution".
