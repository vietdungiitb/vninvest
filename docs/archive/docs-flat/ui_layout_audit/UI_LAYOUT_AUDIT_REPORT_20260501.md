# VNInvest - UI/UX Audit Report (Layout Template V1 Compliance)

**Ngay thuc hien**: 2026-05-01  
**Trang thai**: DA REMEDIATE P1 CHO NHOM PAGE 3 COT, CON CAC DOT CLEANUP TIEP THEO  
**Tai lieu doi chieu**: [PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md](file:///c:/Mujoco%20Projects/vninvest/docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md)

---

## 1) Tong quan ket qua audit

Sau slice remediation 2026-05-01zd, nhom top-level 3-column shell quan trong da duoc dong bo theo contract chung:

- `minmax(320px, 22%) minmax(420px, 48%) minmax(420px, 30%)` cho desktop `>= 1440px`.
- `300px 1fr 1fr` cho laptop `1024px - 1439px`.
- Utility dung chung hien tai la `.page-body-grid`, `.page-body-grid--auto-height`, `.page-body-grid__main`, `.page-body-grid__side`.

### Cac surface da duoc remediation trong slice nay
- `WhaleAlertsDashboard.jsx` da dung shared shell/grid tu slice truoc va khong con la nguon lech ratio 3 cot.
- `StockDetail.jsx` da chuyen loading shell va main workspace sang shared 22/48/30 utility.
- `LegacyDashboard.jsx` da chuyen outer workspace grid sang shared utility.
- `WhaleAdvisory.jsx` da chuyen ca hai outer 3-column rows sang shared utility.
- `modern/ModernDashboard.jsx` da canh lai outer operator grid theo cung contract 22/48/30.

### Drift con lai sau remediation nay
- **Header contract**: mot so page van chua dung day du `page-header`, `page-title`, `page-description`.
- **Tokenization**: nhieu panel van hard-code mau Tailwind thay vi dung he token CSS.
- **Non-3-column pages**: Watchlist, Support, WhaleAlertsHub, AICommandCenter va mot so operator surfaces khac van can review rieng cho spacing/header/token, nhung khong con nam trong bai toan "cot thu 3 = 30%".

---

## 2) Chi tiet tung trang

### A. Whale Alerts Dashboard (`WhaleAlertsDashboard.jsx`)
- **Trang thai hien tai**: Da remediation shell, header va grid outer theo template V1.
- **Ket qua**: Dung `app-page-shell`, `page-header`, `page-body-grid` va khong con hard-code outer ratio 3 cot.
- **Con lai**: Mot so panel con giu `card-section`/style rieng, nhung khong con vi pham contract cot thu 3.

### B. Stock Detail (`StockDetail.jsx`)
- **Trang thai hien tai**: Da remediation wrapper, loading shell va grid 3 cot outer.
- **Ket qua**: Workspace chinh da dung shared `22 / 48 / 30` thay cho `xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_340px]`.
- **Con lai**: Internal card styling va spacing giua cac module ben trong van chua token hoa day du.

### C. Watchlist / Radar (`Watchlist.jsx`)
- **Trang thai hien tai**: Root shell da duoc normalize, nhung day khong phai page 3 cot theo contract 22/48/30.
- **Con lai**: Typography, semantic color, button/input token va mot so layout con van mang dau vet Tailwind ad-hoc.

### D. Legacy Dashboard (`LegacyDashboard.jsx`)
- **Trang thai hien tai**: Da remediation wrapper va outer 3-column workspace grid.
- **Ket qua**: Khong con `max-w-[1500px]` hay `xl:grid-cols-3` hard-code o top-level shell.
- **Con lai**: Header typography va token panel ben trong can cleanup o dot sau.

### E. Whale Advisory (`WhaleAdvisory.jsx`)
- **Trang thai hien tai**: Da remediation ca hai outer 3-column rows ve shared utility.
- **Ket qua**: Bubble/support row va command/sidebar row cung obey cung mot contract 22/48/30.
- **Con lai**: Bento styling va tab support panel van la mot visual language rieng, can review neu muon token hoa sau.

### F. Modern Dashboard (`modern/ModernDashboard.jsx`)
- **Trang thai hien tai**: Da remediation operator grid ve shared 22/48/30 utility ma van giu full-height workspace.
- **Ket qua**: Cot phu ben phai khong con phu thuoc `xl:grid-cols-3` generic.
- **Con lai**: Day la operator surface dac thu, nen cac internal density/scroll rules can audit tach rieng neu tiep tuc rollout V1 sau nay.

---

## 3) Roadmap con lai

1. **P0 - Header cleanup**: Chuan hoa cac page chua dung `page-header`, `page-title`, `page-description`.
2. **P1 - Da hoan thanh cho nhom page 3 cot**: Contract `22 / 48 / 30` da duoc ap dung cho cac surface 3 cot chinh.
3. **P2 - Tokenization**: Thay the hard-coded colors, borders, radius va spacing bang token trong `index.css`.
4. **P3 - Component audit**: Doi chieu `Card`, `Button`, `Input`, `Select` voi utility/template chung.
5. **P4 - QC gate**: Chup doi chieu 1920 / 1440 / 1280 / 1024 / 768 / 390 sau moi dot rollout.

---

## 4) Checklist kiem tra nhanh cho developer
- [x] Cac page 3 cot chinh da dung shared utility `page-body-grid`.
- [x] Contract cot desktop da la `22 / 48 / 30` thay vi contract cu `39 / 39`.
- [ ] Moi page da dung day du `page-header` / `page-title` / `page-description`.
- [ ] Hard-coded mau va spacing da duoc token hoa day du.
- [ ] Tat ca module da co loading / empty / error state dong bo.
