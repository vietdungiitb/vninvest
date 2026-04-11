# Sprint 35 Acceptance Checklist - Unified Alert Center

## A. Product Acceptance
- [ ] Co Unified Alert Strip tren dashboard (critical/high/medium/low).
- [ ] Co Unified Alert Center feed hop nhat whale + dark flow + canh bao khac.
- [ ] Co Hot Symbols chips de nhan dien ma can uu tien.
- [ ] Cac alert item co source + severity + ly do + thoi gian ro rang.
- [ ] Nguoi dung co the click alert de di den trang chi tiet lien quan.

## B. Data Acceptance
- [ ] Whale alerts duoc merge tu realtime + snapshot aggregate feed.
- [ ] Dark flow alerts duoc merge vao feed hop nhat.
- [ ] Price shock synthetic alert duoc tao dung nguong.
- [ ] Stale quote warning duoc hien thi de bao chat luong du lieu.
- [ ] Dedupe hoat dong, khong lap item vo nghia.

## C. UX Acceptance
- [ ] Severity mau sac nhat quan tren strip va item.
- [ ] Empty state thong diep ro rang.
- [ ] Layout hoat dong tot tren desktop va mobile.
- [ ] Contrast dat nguong de doc duoc tren nen toi.

## D. Technical Acceptance
- [ ] Dashboard pass `darkFlowAlerts` xuong panel.
- [ ] DashboardRealtimePanel khong lam vo logic realtime hien tai.
- [ ] i18n vi/en day du key moi, khong co key missing.
- [ ] Khong co runtime error tren dashboard.

## E. Realtime Acceptance
- [ ] Event moi hien thi trong <= 2s o local/staging.
- [ ] Counter strip cap nhat dong bo voi feed.
- [ ] Neu mat WS, fallback polling van giu panel hoat dong.

## F. Rollout Gate
- [ ] Staging smoke test pass.
- [ ] Feature flag rollback da duoc test.
- [ ] KPI baseline da duoc capture truoc rollout 100%.
