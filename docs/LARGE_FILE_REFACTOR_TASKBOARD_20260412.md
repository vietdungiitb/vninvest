# TASKBOARD THUC THI - LARGE FILE REFACTOR

Cap nhat: 2026-04-12

## Sprint 1 - Dang thuc hien

### Da xong
- [x] Tao guard script: scripts/quality/check_large_files.ps1
- [x] Tao workflow CI: .github/workflows/large-file-guard.yml
- [x] Tao allowlist baseline: scripts/quality/large_file_allowlist.txt
- [x] Tao module moi: backend/portfolio/views_portfolio_watchlist.py
- [x] Re-export symbol trong backend/portfolio/views.py de giu compatibility

### Dang lam
- [ ] Tach views_realtime.py
- [ ] Tach views_stock_workspace.py
- [ ] Chia test_api_routes theo cum domain

## Sprint 2 - Ke tiep

### Backlog uu tien cao
- [ ] Tach views_ai_advisory.py
- [ ] Tach views_admin_runtime.py
- [ ] Di chuyen helper runtime policy sang module rieng

### Backlog uu tien trung binh
- [ ] Chia nho frontend/src/pages/StockDetail.jsx
- [ ] Chia nho frontend/src/pages/Watchlist.jsx
- [ ] Chia nho backend/portfolio/tasks.py

## RACI de xuat

- Responsible: Backend team
- Accountable: Tech lead
- Consulted: QA + DevOps
- Informed: Frontend + Product

## KPI tracking (dien hang ngay)

- views.py lines:
- So file >1200 lines:
- So test patch portfolio.views.*:
- API smoke pass rate:
- So regression issue/sprint:
