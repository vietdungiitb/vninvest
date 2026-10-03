# UI V2 Phase 3: Analytics Density + Intelligent Pagination Playbook

Tai lieu nay la huong dan ky thuat chi tiet cho doi code trien khai Phase 3 theo audit giao dien "Bloomberg High-Density", khong can hoi lai PM/Architect.

## 1) Muc tieu va pham vi

Muc tieu bat buoc:
- Them heatmap danh muc toan chieu ngang ngay duoi hang StatCards chinh.
- Chuyen Alert Center tu co che "Load More" sang Pagination co Previous/Next de giu khung nhin co dinh.
- Thu gon mat do StatCards thanh mot hang ngang uu tien KPI chinh.

Ngoai pham vi Phase 3:
- Khong thay doi API contract backend.
- Khong doi logic score whale event o backend.
- Khong doi route va dieu huong chinh cua Dashboard.

## 2) Danh sach file bat buoc can sua

Frontend runtime:
- frontend/src/pages/Dashboard.jsx
- frontend/src/hooks/useUnifiedAlerts.js
- frontend/src/components/UnifiedAlertCenter.jsx

Neu can bo tro style:
- frontend/src/index.css

Kiem thu/bao tri:
- frontend/src/hooks/useUnifiedAlerts.test.js (neu chua co thi tao moi)
- frontend/src/components/UnifiedAlertCenter.test.jsx (neu workspace da co khung test React)

## 3) Thiet ke layout muc tieu (Desktop-first)

So do bo cuc Dashboard:
1. Row A: 4 StatCards chinh (1 hang duy nhat).
2. Row B: Portfolio Heatmap toan chieu ngang (chieu cao de xuat 320-380px).
3. Row C: Unified Alert Bar (severity strip).
4. Row D: Grid 3:1
     - trai: Unified Alert Center (paginated)
     - phai: allocation/quick analytics panel hien co.

Quy tac responsive:
- >= 1280px: giu dung 4 cot KPI + heatmap full row + 3:1 o row cuoi.
- >= 1024px va < 1280px: KPI co the xuong 2x2, nhung heatmap van la full row.
- < 1024px: pagination va heatmap van hoat dong, KPI stack doc theo mobile.

## 4) Portfolio Heatmap integration

Muc tieu hien thi:
- Size block: market_value.
- Mau block: live_change_pct (xanh/duong khi tang, do khi giam, xam khi trung tinh/khong du lieu).
- Tooltip: bat buoc co symbol, market value, change %, unrealized P/L.

Data contract de truyen vao heatmap:
- symbol: string
- market_value: number
- live_change_pct: number | null
- live_unrealized_pl: number | null

Nguon du lieu uu tien:
- Su dung liveHoldings (dang duoc tinh tu quote realtime) de dong bo voi phan thong ke dau trang.

Yeu cau UX:
- Khong de heatmap nhay layout khi du lieu cap nhat.
- Dat min-height de tranh collapse khi danh muc co it ma.
- Hien empty state khi holdings rong: "Chua co du lieu de ve heatmap danh muc".

## 5) Intelligent Pagination cho cursor API

Van de hien tai:
- API tra next_cursor 1 chieu.
- UI can Previous, do do client phai giu lich su cursor da di qua.

Giai phap ky thuat:
- Duy tri cursorStack theo index trang.
- Trang 1 luon co cursor null.
- Khi di Next thanh cong, push next_cursor vao stack (neu chua ton tai o index tiep theo).
- Khi di Prev, dung lai cursor da luu trong stack, khong goi "load append".

State de xuat trong useUnifiedAlerts:
- currentPage: number
- pageSize: number
- cursorStack: (string | null)[]
- hasNextPage: boolean
- isPaginating: boolean
- unifiedAlertsPage: Alert[]

Pseudo-flow (bat buoc):
```js
// pageIndex la 0-based, UI hien thi pageIndex + 1
const [cursorStack, setCursorStack] = useState([null]);
const [currentPage, setCurrentPage] = useState(0);
const [hasNextPage, setHasNextPage] = useState(false);

async function fetchPage(pageIndex) {
    const cursor = cursorStack[pageIndex] ?? null;
    const res = await fetchUnifiedAlerts({ cursor, limit: pageSize, ...filters });

    setUnifiedAlertsPage(normalizeAlerts(res.items));
    setCurrentPage(pageIndex);
    setHasNextPage(Boolean(res.next_cursor));

    if (res.next_cursor) {
        setCursorStack((prev) => {
            const next = [...prev];
            if (!next[pageIndex + 1]) next[pageIndex + 1] = res.next_cursor;
            return next;
        });
    }
}

function goPrev() {
    if (currentPage > 0) fetchPage(currentPage - 1);
}

function goNext() {
    if (hasNextPage) fetchPage(currentPage + 1);
}
```

Rule reset state (rat quan trong):
- Moi khi doi filter (severity/source/audience), reset ve:
    - cursorStack = [null]
    - currentPage = 0
    - goi lai fetchPage(0)

## 6) Refactor Unified Alert Center UI

Thay doi bat buoc:
- Loai bo nut "Load More" o cuoi danh sach.
- Them Pagination Footer co nut:
    - First
    - Previous
    - Trang X
    - Next

Quy tac enable/disable:
- First + Previous disable khi currentPage = 0.
- Next disable khi hasNextPage = false hoac isPaginating = true.

Hanh vi can dat:
- Chuyen trang khong scroll jump ve top window.
- Trong luc loading trang moi, giu khung card cao on dinh (skeleton hoac loading row).
- Khong duoc append du lieu giua cac trang.

## 7) StatCards high-density standard

KPI uu tien (thu tu trai sang phai):
1. Tong gia tri thi truong
2. Lai/Lo chua chot (kem %)
3. Lai/Lo da chot
4. Co tuc da nhan

Yeu cau compact:
- Giam vertical padding card.
- Tieu de uppercase, size nho, tracking rong.
- Gia tri su dung tabular nums de de scan.

## 8) Tieu chi nghiem thu (Definition of Done)

Functional:
- [ ] Heatmap hien thi dung theo liveHoldings.
- [ ] Pagination Previous/Next hoat dong dung voi cursor API.
- [ ] Khong con che do "Load More" trong Alert Center.
- [ ] Doi filter thi quay ve trang 1 va khong lap ban ghi.

Visual:
- [ ] StatCards chinh trong 1 hang desktop.
- [ ] Heatmap nam ngay duoi KPI, nhin thay ngay khi vao trang.
- [ ] Dashboard giu duoc bo cuc compact, khong dai vo han.

Quality:
- [ ] Khong phat sinh error trong console lien quan undefined cursor/page.
- [ ] Khong phat sinh regression i18n (VI la ngon ngu mac dinh).

## 9) Ke hoach trien khai de doi code thuc thi

Buoc 1 - Hook state machine:
- Refactor useUnifiedAlerts.js theo model cursorStack + fetchPage.
- Hoan tat reset logic khi doi filter.

Buoc 2 - Alert Center pagination UI:
- Sua UnifiedAlertCenter.jsx de dung controls Previous/Next.
- Xoa load more append behavior.

Buoc 3 - Dashboard layout + heatmap:
- Dat lai KPI row mot hang.
- Tich hop PortfolioHeatmap ngay ben duoi KPI.
- Kiem tra bo cuc 3:1 o desktop.

Buoc 4 - Test va hardening:
- Test chuyen trang tien/lui.
- Test doi filter giua cac trang.
- Test mobile/desktop khong vo layout.

## 10) Rui ro va rollback

Rui ro:
- Cursor stack sai se gay mismatch du lieu khi Previous.
- Filter reset khong dung se gay lap/nhay trang.

Rollback nhanh:
- Giu branch/commit phien ban truoc Phase 3.
- Neu pagination gay su co, tam thoi rollback ve load-more hien tai trong 1 commit hoan nguyen.

## 11) Tai lieu tham chieu

- docs/UI_V2_BLOOMBERG_MASTER_PLAN_20260417.md
- docs/UI_V2_TECHNICAL_AUDIT_REFACTOR_PLAN.md
- docs/DASHBOARD_LAYOUT_UPGRADE_HINH2_20260417.md

## 12) Lenh thuc thi cho doi code

Do uu tien P0:
- P0.1: Pagination cursorStack + Previous/Next
- P0.2: PortfolioHeatmap vao Dashboard row rieng
- P0.3: StatCards compact 1 hang desktop

Khong can xin phe duyet lai neu thay doi nam trong pham vi tai lieu nay.
