# OPEN CORE DOCKER EXPERIENCE STRATEGY V1 (OC-09)

Ngay tao: 2026-04-07
Trang thai: Draft for discussion
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md

## 1. Muc tieu
Xay dung trai nghiem "run in 5 minutes" cho Community Open Core de tang activation, dong thoi giu duoc ranh gioi thuong mai cua goi Pro annual.

## 2. Why Docker trong Open Core
1. Giam rao can cai dat cho user va developer.
2. Tang kha nang demo, onboarding va conversion Free -> Paid.
3. Chuan hoa moi truong de giam loi "works on my machine".
4. Tang co hoi dong gop tu cong dong (PR, issue reproduction).

## 3. Scope de xuat
### 3.1 Community Docker (public)
- Backend
- Frontend
- Postgres
- Redis
- Demo seed data
- Tai khoan demo

### 3.2 Premium boundary
- Khong public ma premium.
- Premium duoc mo khoa qua entitlement/API key.
- Neu self-host Pro: private image/registry va commercial terms.

## 4. Nguyen tac thiet ke
1. One-command startup (docker compose up) cho local trial.
2. Co profile cho dev va profile cho demo.
3. Co healthcheck cho cac service chinh.
4. Co script seed demo data de user nhin thay gia tri ngay.

## 5. Docker artifact can co (V1)
1. Dockerfile cho backend.
2. Dockerfile cho frontend.
3. docker-compose.yml cho stack Community.
4. .env.example cho container mode.
5. docs quickstart docker (5-10 phut).

## 6. Security va legal baseline
1. Khong commit secret that.
2. Co Notice ve data source va gioi han su dung.
3. Co disclaimer "cong cu ho tro ra quyet dinh" trong onboarding.
4. Co policy telemetry ro rang neu thu thap usage metrics.

## 7. KPI danh gia Docker strategy
1. Time-to-first-run (TFR) < 10 phut.
2. % user run thanh cong sau lan dau.
3. So issue cai dat / 100 user.
4. % dong gop PR tu cong dong sau khi public.

## 8. Risk register lien quan
1. Docker image qua nang -> startup cham.
2. User confusion Free vs Pro -> ky vong sai.
3. Chi phi support tang do setup env.

Mitigation:
- Keep compose minimum.
- Message ro tren docs va app ve pham vi Community.
- Checklist troubleshoot ngan gon.

## 9. Lo trinh de xuat
### Pha A (1-2 tuan)
- Docker compose Community MVP
- Quickstart 5 phut
- Seed data

### Pha B (2-4 tuan)
- Healthcheck + startup scripts
- GHCR image publish (community)
- Troubleshooting docs

### Pha C (4-8 tuan)
- Optimize image size/start time
- Telemetry (opt-in)
- Conversion funnel tu docker demo sang Pro trial

## 10. Quyết dinh can chot o workshop tiep theo
1. Muc do day du cua Community Docker V1.
2. Co publish image len GHCR ngay V1 khong.
3. Chinh sach entitlement cho premium khi self-host.
4. KPI "go/no-go" truoc khi cong bo rong rai.

## 11. Next review checkpoint
- Dua OC-09 vao workshop agenda de lock scope Docker V1 va owner.
