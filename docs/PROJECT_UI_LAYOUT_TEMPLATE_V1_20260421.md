# VNInvest - Template Nguyen Tac Thiet Ke Trang Chung (V1)

**Ngay ban hanh**: 2026-04-21  
**Trang thai**: AP DUNG TOAN DU AN  
**Muc tieu**: Dong bo bo cuc, khoang cach, mau sac, va hanh vi UI de tat ca trang theo mot form chuan, khong phan manh.

---

## 1) Layout Contract bat buoc

Tat ca trang frontend phai tuan theo cung mot khung:

1. **Shell chung**
- Sidebar trai co dinh.
- Top navigation co dinh.
- Content bat dau ngay duoi top navigation, khong tao top-gap tuy y theo tung trang.

2. **Thu tu cau truc trang**
- PageHeader (tieu de + mo ta + action chinh).
- PageBody (khu vuc module).
- PageFooterState (neu co thong tin quota/trang thai, hien thi dang thanh ngang gon).

3. **Nguyen tac cuon (scroll)**
- Uu tien cuon noi bo panel/module.
- Han che cuon toan trang qua sau.
- Header va tab bar trong tung cot duoc phep sticky.

4. **Nguyen tac dong nhat**
- Moi trang khong duoc tu dat max-width, padding top, margin top rieng ngoai token chung.
- Moi page phai dung bo token spacing va mau duoi day.

---

## 2) Design Tokens (CSS Variables chuan)

Dat trong file token goc (index.css hoac file token tap trung):

```css
:root {
  /* Shell */
  --layout-sidebar-width: 320px;
  --layout-topnav-height: 72px;
  --layout-content-max-width: 1800px;
  --layout-content-pad-x: 24px;
  --layout-content-pad-y: 16px;

  /* Radius */
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Color system */
  --bg-app: #020b23;
  --bg-panel: #081734;
  --bg-panel-soft: rgba(8, 23, 52, 0.72);
  --bg-panel-strong: rgba(8, 23, 52, 0.9);

  --text-primary: #e6f3ff;
  --text-secondary: #9cb2d1;
  --text-muted: #6d86a8;

  --accent-cyan: #12c7e8;
  --accent-cyan-soft: rgba(18, 199, 232, 0.22);
  --accent-emerald: #16d7a0;
  --accent-rose: #ff5e7e;
  --accent-amber: #ffbf4d;

  --border-default: rgba(80, 120, 168, 0.28);
  --border-strong: rgba(18, 199, 232, 0.38);

  --shadow-panel: 0 8px 30px rgba(0, 0, 0, 0.28);
  --shadow-focus: 0 0 0 2px rgba(18, 199, 232, 0.35);
}
```

---

## 3) Khoang cach va canh le bat buoc

1. **Diem bat dau content**
- Content wrapper cach top nav: `var(--layout-content-pad-y)`.
- Tieu de trang dat sat nhip voi trang Whale Alerts (khong chen hero khoi cao neu khong co ly do nghiep vu).

2. **Khoang cach doc chuan**
- Header -> Body: `var(--space-4)`.
- Giua cac module: `var(--space-4)` hoac `var(--space-6)`.
- Tuyet doi khong dung margin top lon hon `32px` cho khoi dau tien trong body.

3. **Khoang cach ngang chuan**
- Desktop: 24px.
- Tablet: 16px.
- Mobile: 12px.

---

## 4) Page Template chuan (khung JSX)

```jsx
export default function StandardPageTemplate() {
  return (
    <div className="app-page-shell">
      <header className="page-header">
        <div className="page-header__left">
          <p className="page-kicker">TEN NHOM CHUC NANG</p>
          <h1 className="page-title">Tieu de trang</h1>
          <p className="page-description">Mo ta ngan 1-2 dong.</p>
        </div>
        <div className="page-header__right">
          <span className="plan-chip">Goi hien tai</span>
          <button className="btn-primary">Hanh dong chinh</button>
        </div>
      </header>

      <main className="page-body-grid">
        <aside className="col-left">Panel co dinh (danh sach ma/bo loc)</aside>
        <section className="col-center">Tab Group A</section>
        <section className="col-right">Tab Group B</section>
      </main>

      <footer className="page-state-bar">Thong tin trang thai gon</footer>
    </div>
  );
}
```

---

## 5) Template bo cuc 3 cot thong nhat

1. **Desktop >= 1440px**
- Grid: `minmax(320px, 22%) minmax(420px, 39%) minmax(420px, 39%)`.
- Chieu cao vung body: `calc(100vh - topnav - header - paddings)`.

2. **Laptop 1024px - 1439px**
- Grid: `300px 1fr 1fr`.

3. **Tablet 768px - 1023px**
- Grid 2 cot: trai + noi dung hop nhat.
- Tab group gop lai de giam chieu rong.

4. **Mobile < 768px**
- Stack 1 cot.
- Tab bar sticky tren cung vung noi dung.

---

## 6) Template tab module chuan

1. **Thanh tab**
- Chieu cao 40-44px.
- Radius pill.
- Active state dung accent cyan, text sang.

2. **Noi dung tab**
- Moi tab panel co min-height nhat quan.
- Moi tab panel co 3 state chuan:
  - Loading state.
  - Empty state (thong diep ro rang, khong de panel trang).
  - Error state (thong diep + nut thu lai).

3. **State persistence**
- Luu active tab theo tung cot vao localStorage.
- Doi symbol khong reset tab.

---

## 7) Typography va mat do hien thi

1. **Typography scale**
- Page title: 40/48 desktop, 32/40 tablet, 26/34 mobile.
- Section title: 20/28.
- Body: 14/22.
- Label chip/tab: 11-12, uppercase co tracking nhe.

2. **Mat do thong tin**
- Uu tien card compact.
- Tranh card qua cao khien module quan trong bi day xuong duoi man hinh dau.

---

## 8) Mau sac va quy tac sematic

1. **Mau theo nghia nghiep vu**
- Buy/Tang: emerald.
- Sell/Giam/Canh bao: rose.
- Discovery/Canh bao trung tinh: amber.
- Hanh dong/chuyen tiep/chon: cyan.

2. **Do tuong phan**
- Text chinh tren nen toi dat WCAG toi thieu 4.5:1 cho noi dung than.

3. **Khong dung tu do**
- Cam dung mau nhan tu phat ngoai token.
- Cam dung gradient qua choi gay ro i noi dung.

---

## 9) Quy tac component chung

1. **Card**
- Border `--border-default`, radius `--radius-lg`, shadow `--shadow-panel`.

2. **Button**
- Primary: nen cyan, text sang, radius pill.
- Secondary: nen trong suot + border.

3. **Input/Select**
- Chieu cao 40-44px.
- Focus ring theo `--shadow-focus`.

4. **Badge/Chip**
- Dung he token mau sematic.
- Khong tu y scale font qua nho duoi 10px.

---

## 10) Checklist nghiem thu cho moi trang

1. Header co sat nhip voi top nav nhu trang chuan Whale Alerts.
2. Khong co khoang trong bat thuong giua top nav va tieu de.
3. Module chinh xuat hien trong first viewport (desktop).
4. Cuon noi bo panel hoat dong, khong khoa scroll sai.
5. Loading/empty/error state day du cho moi tab panel.
6. Mau sematic dung token, khong lech he.
7. Responsive dat yeu cau 1920, 1440, 1280, 1024, 768, 390.

---

## 11) Lo trinh hieu chinh toan du an (template rollout)

1. **P0 - Baseline Shell**
- Chuan hoa wrapper, top spacing, header contract cho tat ca trang chinh.

2. **P1 - Signals Cluster**
- AI Advisory, Whale Alerts, Dashboard theo cung contract 3 cot/tab.

3. **P2 - Portfolio Cluster**
- Cac trang danh muc, stock detail, workspace cap nhat spacing va token.

4. **P3 - Cleanup**
- Loai bo class legacy gay drift spacing/layout.

5. **P4 - QC Gate**
- Chot visual regression checklist + screenshot doi chieu.

---

## 12) Danh sach anti-pattern cam su dung

1. Moi trang tu dat top padding rieng gay lech tieu de.
2. Hero card qua cao lam day module quan trong xuong duoi.
3. Dung hard-code mau ngoai token.
4. Tron nhieu he spacing trong cung mot trang.
5. An module khi khong co du lieu thay vi hien empty state.

---

## 13) Ban mau CSS utility (template su dung nhanh)

```css
.app-page-shell {
  max-width: var(--layout-content-max-width);
  margin: 0 auto;
  padding: var(--layout-content-pad-y) var(--layout-content-pad-x) var(--space-6);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.page-body-grid {
  display: grid;
  grid-template-columns: minmax(320px, 22%) minmax(420px, 39%) minmax(420px, 39%);
  gap: var(--space-4);
  min-height: calc(100vh - var(--layout-topnav-height) - 220px);
}

.page-panel {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-panel-soft);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.page-panel__head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-panel-strong);
  border-bottom: 1px solid var(--border-default);
}

.page-panel__body {
  overflow: auto;
  height: 100%;
}

@media (max-width: 1439px) {
  .page-body-grid {
    grid-template-columns: 300px 1fr 1fr;
  }
}

@media (max-width: 1023px) {
  .app-page-shell {
    padding-inline: 16px;
  }

  .page-body-grid {
    grid-template-columns: 1fr;
    min-height: auto;
  }
}

@media (max-width: 767px) {
  .app-page-shell {
    padding-inline: 12px;
  }
}
```

---

## 14) Quy dinh governance

1. Moi PR thay doi layout phai doi chieu tai lieu nay truoc khi merge.
2. Neu can tao ngoai le, bat buoc ghi ro ly do trong audit ledger.
3. Muc tieu sau cung: tat ca trang ve cung mot "form" ve css, le, margin, mau va bo cuc.
