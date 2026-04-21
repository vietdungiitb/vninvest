# Implementation Plan: AI Advisory Layout Redesign (2026-04-21)

## 1. Muc tieu nghiep vu
- Toi uu kha nang doc bai tu van AI tren trang AI Advisory khi noi dung dai.
- Dong bo bo cuc voi chuan trang Whale Alerts, tranh tinh trang moi trang mot kieu.
- Giam do sau cuon trang bang cach uu tien panel chinh va cuon noi bo module.

## 2. Ket qua can dat
- WhaleAdvisoryCommandPanel chiem 2 cot ben trai tren desktop.
- WhaleSymbolSidebar nam o cot phai thu 3, co vung cuon rieng.
- Cac module con lai duoc sap xep hai hoa o tang duoi, trong do Whale Bubble la module uu tien.
- Header AI Advisory sat menu ngang theo cung nhip voi Whale Alerts.

## 3. Scope
### In scope
- Refactor bo cuc va hien thi UI cho trang AI Advisory.
- Chuan hoa spacing, top offset, panel height, overflow behavior.
- Bo sung tab phu tro cho module thong tin phu.

### Out of scope
- Khong thay doi thuat toan backend advisory.
- Khong thay doi API contract neu khong co loi chan.
- Khong thay doi luong auth/permission hien tai.

## 4. Kien truc bo cuc muc tieu
### Tang A: Header compact
- Kicker + title + mo ta ngan + action refresh.
- Chieu cao gon, uu tien first viewport cho module chinh.

### Tang B: Main row 3 cot
- Cot 1 + 2: WhaleAdvisoryCommandPanel (span 2 cot).
- Cot 3: WhaleSymbolSidebar.

### Tang C: Support row
- Ben trai rong: WhaleBubbleChart.
- Ben phai: tab phu tro gom Telemetry, Risk Calibration, Recommendation History.

## 5. Responsive contract
- >= 1440px: 3 cot day du (2 cot trai + 1 cot phai).
- 1024-1439px: giu 3 cot, giam gap/padding.
- 768-1023px: 2 cot, sidebar xuong hang thu hai.
- < 768px: stack 1 cot, giu thu tu panel chinh truoc.

## 6. Implementation order theo commit slices
### Slice 1 - Layout shell va top alignment
- Sua wrapper + top spacing + page header trong WhaleAdvisory.
- Dat main grid 3 cot va support row.
- Khong thay doi business logic.

### Slice 2 - Command panel uu tien doc
- Dat CommandPanel span 2 cot trai.
- Tang readability: line-height, khoang cach doan, vung noi dung.

### Slice 3 - Sidebar cot phai
- Chuyen WhaleSymbolSidebar sang cot 3.
- Sticky header trong cot phai, danh sach cuon doc lap.

### Slice 4 - Module tang duoi
- Bubble chart dat o panel trai rong.
- Cum module phu tro dat panel phai theo tab.

### Slice 5 - UX hardening
- Empty/loading/error states nhat quan.
- Giu state tab khi doi symbol.
- Chan trang thai module bien mat khi data rong.

### Slice 6 - QA + rollback gate
- Test matrix desktop/tablet/mobile + entitlement.
- Chot visual parity voi Whale Alerts.
- Tao rollback checklist de quay ve layout truoc neu co issue.

## 7. Phan bo cong viec doi code
- FE Lead: Slice 1, Slice 2.
- FE Member A: Slice 3.
- FE Member B: Slice 4.
- FE + QA: Slice 5, Slice 6.

## 8. Tieu chi nghiem thu bat buoc
- CommandPanel doc duoc bai dai ma khong bi ep ngang.
- Sidebar co dinh ben phai tren desktop.
- Bubble chart va module phu tro hien thi can bang, khong day trang qua sau.
- Khong co runtime error trong console khi thao tac chinh.

## 9. Rui ro va giam thieu
- Rui ro panel cao vuot viewport: giam bang min-height + overflow noi bo.
- Rui ro reset state tab: localStorage va key on dinh theo cot.
- Rui ro lech style he thong: doi chieu voi PROJECT_UI_LAYOUT_TEMPLATE_V1 truoc merge.

## 10. Deliverables
- Code refactor trang AI Advisory da pass QA.
- Bang test checklist da tick day du.
- Cap nhat audit ledger + progress dashboard.
- Build frontend va restart container de review truc quan.