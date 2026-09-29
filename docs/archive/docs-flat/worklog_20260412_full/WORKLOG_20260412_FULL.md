# WORKLOG Tong Hop - 2026-04-12

Nguoi thuc hien: GitHub Copilot
Nhanh lam viec: dev
Muc tieu: Tong hop toan bo cong viec da hoan tat trong session, kem commit va ket qua xac nhan.

---

## 1) Tong quan ket qua

- Da tao wishlist tinh nang tuong lai cho du an.
- Da sua UI StatCard de don vi hien thi nho gon canh gia tri.
- Da hoan tat Sprint 34 (AI News Layer 1 + Layer 2): API tin tuc theo ma, grounding vao advisory, panel frontend, i18n.
- Da hoan tat Sprint 35 (Layer 3): Portfolio Daily News Digest chay theo Celery Beat, luu DB, day WebSocket, API lay digest, panel tren Dashboard.
- Tat ca thay doi chinh da duoc commit va push len nhanh dev.

---

## 2) Timeline cong viec

### Pha A - Wishlist + UI fix nho

1. Tao file wishlist:
- docs/WISHLIST_FUTURE_FEATURES.md
- Noi dung: 10 nhom tinh nang, nhieu y tuong roadmap.

2. Sua StatCard hien thi don vi:
- Muc tieu: "nghin dong" hien thi nho gon va nam canh gia tri.
- Commit: 045f0e34
- Message: fix(dashboard): move unit label inline next to value in StatCard

3. Giai thich ky hieu C2/H1:
- Cx = so canh bao muc Critical
- Hx = so canh bao muc High

### Pha B - Sprint 34: AI News Module (Layer 1 + Layer 2)

4. Tai lieu sprint:
- docs/SPRINT34_AI_NEWS_MODULE_PLAN.md

5. Backend:
- Them endpoint tin tuc theo ma:
  - backend/portfolio/views.py
  - backend/portfolio/urls_stock.py
- Them news grounding cho advisory:
  - backend/portfolio/tasks.py
  - backend/portfolio/ai_service.py

6. Frontend:
- API client:
  - frontend/src/api/client.js
- i18n:
  - frontend/src/i18n/vi.js
  - frontend/src/i18n/en.js
- Component moi:
  - frontend/src/components/StockNewsPanel.jsx
- Tich hop vao trang chi tiet ma:
  - frontend/src/pages/StockDetail.jsx

7. Commit/push:
- Commit: e5083c55
- Message: feat(sprint34): AI news layer1+2 - stock news panel + advisory grounding
- Trang thai: da push origin/dev

### Pha C - Sprint 35: Portfolio Daily News Digest (Layer 3)

8. Database model + migration:
- backend/portfolio/models.py
- backend/portfolio/migrations/0039_sprint35_portfolio_news_digest.py
- Model: PortfolioNewsDigest

9. AI service cho digest:
- backend/portfolio/ai_service.py
- Them ham tao digest SUMMARY/FULL tu tin tuc danh muc.

10. Celery task + scheduler:
- backend/portfolio/tasks.py
  - Task tao digest cho tung user co watchlist
  - Push event WebSocket news_digest
- backend/config/settings.py
  - Beat schedule 16:05 Thu 2-Thu 6 (Asia/Ho_Chi_Minh)

11. Realtime consumer + REST API:
- backend/portfolio/consumers.py (handler news_digest)
- backend/portfolio/views.py (GET /api/stock-management/portfolio/news-digest/)
- backend/portfolio/urls_stock.py (route portfolio/news-digest/)

12. Frontend Dashboard:
- frontend/src/api/client.js
- frontend/src/components/PortfolioDigestPanel.jsx
- frontend/src/pages/Dashboard.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js
- frontend/src/hooks/useRealtimeFeedLegacy.js (xu ly event news_digest)

13. Sua loi build frontend phat sinh:
- frontend/src/components/StockNewsPanel.jsx
- Chuyen sang useI18n noi bo, bo phu thuoc react-i18next.

14. Kiem tra:
- Backend: manage.py check -> pass
- Frontend: npm run build -> pass

15. Commit/push:
- Commit: 169e3a79
- Message: feat(sprint35): portfolio daily news digest layer3 with beat task, ws push, api, dashboard panel
- Trang thai: da push origin/dev

---

## 3) Lich su commit gan day

- 169e3a79 feat(sprint35): portfolio daily news digest layer3 with beat task, ws push, api, dashboard panel
- e5083c55 feat(sprint34): AI news layer1+2 - stock news panel + advisory grounding
- 045f0e34 fix(dashboard): move unit label inline next to value in StatCard
- 293144c4 fix(watchlist): normalize mixed quote units before render and alert checks
- b3a6b336 feat(dashboard): click severity tiles to filter unified alerts

---

## 4) Trang thai hien tai

- Nhanh hien tai: dev
- Dong bo remote: origin/dev
- Working tree: clean (khong co file chua commit)

---

## 5) Ghi chu van hanh

- Da bat dau buoc cap nhat Docker dev bang cach pull origin/dev.
- Ket qua pull: Already up to date.
- Neu can refresh stack ngay: chay start_dev.ps1 tai root workspace.
