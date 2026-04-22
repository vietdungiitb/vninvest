# Tech Spec: AI Advisory Layout Redesign (2026-04-21)

## 1. Tong quan ky thuat
Tai lieu nay dac ta thay doi frontend cho trang AI Advisory de dat bo cuc:
- 2 cot trai cho panel noi dung tu van dai.
- 1 cot phai cho danh sach symbol.
- Cac module phu tro dat o tang duoi theo panel can bang.

## 2. File scope
- frontend/src/pages/WhaleAdvisory.jsx
- frontend/src/components/advisory/WhaleAdvisoryCommandPanel.jsx
- frontend/src/components/advisory/WhaleSymbolSidebar.jsx
- frontend/src/components/WhaleBubbleChart.jsx

## 3. Grid va panel contract
### 3.1 Desktop layout
Main grid:
- col 1: minmax(0, 1.2fr)
- col 2: minmax(0, 1.2fr)
- col 3: minmax(320px, 0.9fr)

Command panel:
- grid-column: 1 / span 2
- min-height: 520px

Sidebar:
- grid-column: 3
- sticky header + scroll body

Support row:
- cot trai: WhaleBubbleChart (uu tien rong hon)
- cot phai: Advisory support tabs

### 3.2 Responsive breakpoints
- xl: 3 cot day du
- lg: 3 cot compact gap
- md: 2 cot (sidebar xuong row tiep theo)
- sm: 1 cot stack

## 4. State model
Them state UI trong WhaleAdvisory:
- activeSupportTab: telemetry | risk | history
- supportTabState persisted bang localStorage

Rule:
- doi activeSymbol khong reset activeSupportTab
- doi tab khong reset data command panel

## 5. Rendering flow
1. Lay du lieu qua useWhaleAdvisoryData.
2. Resolve activeSymbol an toan (neu list rong thi fallback empty).
3. Render Header compact.
4. Render Main grid (CommandPanel + Sidebar).
5. Render Support row (Bubble + tabs phu tro).

## 6. Empty/loading/error conventions
- Command panel: neu khong co advisory thi hien empty state co huong dan.
- Sidebar: neu khong co symbol thi hien empty state co search context.
- Bubble: neu chua co symbol hoac khong co order thi hien empty state ro rang.
- Error fetch: hien retry CTA o khu vuc tong.

## 7. Accessibility
- Tab support co role=tablist, tab, tabpanel.
- Focus state ro rang cho tab/button.
- Contrast dat toi thieu cho text chinh tren nen toi.

## 8. Performance
- Giu useMemo cho activeItem va filteredStats.
- Khong re-fetch du lieu chi vi doi tab UI.
- Han che rerender bubble chart khi doi tab phu tro.

## 9. Regression checklist
- Chon symbol, refresh, delete advisory.
- Chuyen tab ho tro va quay lai van giu state.
- Resize window theo breakpoint va kiem tra overlap.
- Kiem tra scroll page tong va scroll noi bo panel.

## 10. Release guard
Chi merge khi dat du 3 nhom gate:
- Visual gate: dung bo cuc 2 trai + 1 phai.
- Runtime gate: khong co ReferenceError/TypeError moi.
- UX gate: first viewport hien du thong tin cot loi.