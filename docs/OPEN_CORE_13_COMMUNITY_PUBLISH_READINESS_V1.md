# OPEN CORE COMMUNITY PUBLISH READINESS V1 (OC-13)

Doc ID: OC-13
Ngay tao: 2026-04-10
Ngay cap nhat: 2026-04-18
Trang thai: Current go/no-go gate for OpenCore public/community lane
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_DISCUSSION.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_08_RISK_REGISTER_V1.md, OPEN_CORE_09_DOCKER_EXPERIENCE_STRATEGY_V1.md, OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md, OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md, OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md, OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md, SPRINT28_LEGAL_CONTENT_EXECUTION_PLAN.md

Nguyen tac docs lane:
1. `docs/` trong repo hien tai duoc xem la private docs.
2. Public docs la mot lane artifact rieng, khong dong nhat voi private docs.

## 1. Muc tieu
- Tong hop trang thai san sang publish phan Community/Open Core de cac phien sau thao luan tren cung mot mat bang.
- Tach ro viec nao da co quyet dinh, viec nao con thieu artifact public, va viec nao la blocker truoc khi mo repo community.

## 2. Ket luan hien tai (2026-04-18)
- Go/no-go hien tai cho public/community repo: NO-GO.
- Go/no-go hien tai cho lane hardening 21 ngay: CONDITIONAL GO neu owner chot 5 quyet dinh con treo.
- Trang thai chinh xac nhat: san pham da co baseline Open Core va da co runtime implementation mot phan, nhung chua du boundary/public-safe/legal-safe de public repo hoac announce rong.

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

5. Runtime OpenCore da ton tai:
- Da co models/API/admin/analytics/billing/task lane trong backend, nen publish readiness phai tinh toi runtime drift that su, khong chi la planning docs.

## 4. Gate table hien tai
| Gate | Trang thai | Ghi chu |
|---|---|---|
| Business direction Open Core | GREEN | OC-02 van dung duoc lam baseline |
| Boundary Community / Pro cap package | YELLOW | Boundary cap y tuong co, boundary cap package/feature_key chua du |
| Quota/trial canonical | RED | Docs va runtime dang lech nhau |
| Legal/publication artifacts | RED | Chua du bundle public |
| Docs lane separation (private/public) | RED | Chua co publication pipeline va allowlist cho public docs |
| Repo hygiene public-safe | RED | Chua du bang chung de mo repo cong khai |
| Docker Community quickstart may sach | YELLOW | Co dinh huong, chua du smoke proof |
| Self-host Pro operating model | RED | Chua khoa cach phan phoi va enforcement |

## 5. Blocker truoc khi public
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

### B5 - Runtime/business drift chua duoc canonical hoa
- Quota business baseline va quota runtime implementation dang lech nhau.
- Ten plan runtime (`free`, `pro`, `enterprise`) chua duoc giai thich ro voi package public.
- Cac tai lieu lich su van ton tai voi thong diep "ready/live", can tiep tuc quan ly authoritative set ro rang.

### B6 - Self-host Pro operating model chua khoa
- Chua ro Pro self-host se duoc phan phoi duoi dang private package, private image, hay service boundary.
- Chua ro online/offline licensing va grace policy cho self-host Pro.

### B7 - Chua tach lane private docs va public docs
- Hien `docs/` dang la bo tai lieu noi bo, chua duoc dong goi cho cong bo.
- Chua co allowlist cho public docs va chua co quy trinh redaction/legal review.
- Neu public raw `docs/` se de lo strategy/risk/backlog noi bo va gay nhiu cho contributor.

## 6. Boundary de thao luan tiep
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

## 7. Publish readiness checklist de chot o phien sau
### Product/package
- [ ] Chot danh sach module Community V1.
- [ ] Chot danh sach module Pro giu private hoac chi expose qua entitlement.
- [ ] Chot thong diep README/landing cho community.
- [ ] Chot package business <-> runtime plan mapping.
- [ ] Chot docs boundary: private docs (noi bo) vs public docs (cong bo).

### Legal/compliance
- [ ] Chot license cuoi cung (target hien tai: Apache-2.0).
- [ ] Chot disclaimer "cong cu ho tro ra quyet dinh" tren docs va onboarding.
- [ ] Chot goi legal content toi thieu truoc public.
- [ ] Chot support policy public/community.

### Engineering/publication
- [ ] Repo khong con file env nhay cam hoac production env dang track.
- [ ] Repo khong con runtime artifacts/build artifacts khong can thiet.
- [ ] Docker quickstart chay duoc tren may sach trong 5-10 phut.
- [ ] Demo seed flow tao duoc gia tri ngay.
- [ ] Feature gating/entitlement khong de lo premium lane mot cach de bypass.
- [ ] Quota/trial canonical docs khop voi runtime hoac co ke hoach chuyen doi ro rang.
- [ ] Chot self-host Pro operating model va enforcement boundary.
- [ ] Co publication pipeline cho public docs (allowlist + sanitize + legal review).
- [ ] Co allowlist public docs V1 duoc owner/legal/tech cung duyet.
- [ ] Co xac nhan `docs/` trong monorepo khong bi dua len public repo mac dinh.
- [ ] Team da ap dung OC-19 lam quy dinh merge gate mac dinh.

### GTM/community ops
- [ ] Co CONTRIBUTING + SECURITY + support expectation ro rang.
- [ ] Co issue triage rule cho community.
- [ ] Co soft-launch cohort truoc khi announce rong.

## 8. De xuat thu tu thuc hien
1. Chot boundary repo Community V1.
2. Chot quota/trial canonical + package/runtime mapping.
3. Tao legal/publication bundle toi thieu.
4. Don repo hygiene va bo tracked env production.
5. Dong goi README + Docker quickstart + demo path.
6. Chay smoke test tu may sach/clone moi.
7. Moi tao repo public hoac community mirror.
8. Chi publish bo public docs da duoc sinh tu publication lane, khong publish raw private docs.

## 9. Cac cau hoi can lock trong phien tiep theo
1. Community repo la monorepo cat giam, hay mirror/subtree rieng?
2. Premium code se:
- o lai trong repo va khoa bang entitlement,
- hay tach sang private package/service,
- hay dong goi thanh private image?
3. License cuoi cung co van la Apache-2.0 khong?
4. Co public ngay Docker image len GHCR khong, hay chi public source truoc?
5. Muc support cho community la best-effort hay issue-only?
6. Quota/trial canonical se theo don vi nao, thong diep nao?
7. Public docs se duoc tao/host theo co che nao khi private docs van giu noi bo?

## 10. Go/No-Go gate de dung cho lan review sau
### Go neu:
- License + disclaimer + repo hygiene + Docker quickstart deu xong.
- Boundary Community/Pro duoc ghi ro trong docs va enforcement duoc kiem tra.
- Package/runtime mapping + quota/trial canonical da duoc lock.
- Lane private docs/public docs da duoc lock va kiem tra.

### No-Go neu:
- Chua chot legal wording.
- Van con env production/secret hygiene mo ho.
- README va package public van mo ta lan giua community va paid.
- Van con do lech nghiem trong giua docs canonical va runtime truth.
- Chua co co che tach private docs khoi public docs.

## 11. Next review checkpoint
- Muc tieu phien tiep theo: chot 5-6 quyet dinh o Muc 9; neu chua chot du thi giu NO-GO cho public lane va chi cho phep hardening noi bo.
