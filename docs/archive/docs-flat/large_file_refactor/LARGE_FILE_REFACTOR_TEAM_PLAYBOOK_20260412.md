# TEAM PLAYBOOK - LARGE FILE REFACTOR

Ngay cap nhat: 2026-04-12
Phien ban: v1

## 1) Muc tieu cho ca doi

- Giu API contract 100% on dinh trong luc tach file.
- Khong merge PR moi vao monolith views.py neu endpoint do da co module moi.
- Moi sprint giam it nhat 800-1200 dong o file legacy uu tien.

## 2) Nguyen tac ky thuat bat buoc

- Tinh tuong thich: giu nguyen ten class/function public trong portfolio.views thong qua re-export.
- Tach theo domain, khong tach theo chu cai.
- 1 PR chi 1 cum domain + test lien quan.
- Rollback-friendly: moi PR phai revert doc lap duoc.

## 3) Quy trinh lam viec chuan cho moi PR refactor

1. Chon 1 cum endpoint theo backlog sprint.
2. Tao file module moi (vi du views_realtime.py).
3. Move code + import toi thieu can thiet.
4. Re-export symbol ve portfolio/views.py.
5. Chay test subset.
6. Update docs allowlist neu line count thay doi.
7. Mo PR voi checklist gate.

## 4) Checklist gate truoc khi merge

- [ ] API path/name khong doi
- [ ] Response schema khong doi (hoac co migration note)
- [ ] Smoke test endpoint pass
- [ ] Khong import cycle
- [ ] Khong them logic moi ngoai refactor
- [ ] Cap nhat line-count report
- [ ] Cap nhat allowlist neu can

## 5) Mapping owner theo module

- views_portfolio_watchlist.py: Backend Core A
- views_realtime.py: Backend Realtime
- views_stock_workspace.py: Backend Market Data
- views_ai_advisory.py: Backend AI
- views_admin_runtime.py: Backend Ops
- test migration: QA/API owner

## 6) Ky luat patch test

Trong giai doan chuyen tiep:
- Cho phep patch portfolio.views.*
- Uu tien patch module moi cho test moi

Sau khi xong sprint 4:
- Cam them patch moi vao portfolio.views.*
- Chuyen hoan toan sang module namespace moi

## 7) Nhiem vu ngay mai (ready-to-run)

- Task 1: Tach views_realtime.py (WhaleFeed/RVOL/Aggregate)
- Task 2: Tach views_stock_workspace.py (overview/chart/financial)
- Task 3: Tao smoke tests cho 8 endpoint realtime quan trong
- Task 4: Giam 30% patch dependency portfolio.views trong test_api_routes

## 8) Dinh nghia hoan thanh chuong trinh refactor

- backend/portfolio/views.py < 1500 dong
- test_api_routes.py duoc chia nho theo domain
- Khong con file > 1200 dong ma khong co ly do hinh hoc ro rang
- CI large-file-guard pass khong can allowlist cho backend/portfolio/views.py
