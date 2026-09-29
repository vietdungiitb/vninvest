# RUN SPEC AUDIT — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## Mục đích

Spec audit là bước kiểm tra cuối cùng trước khi feature được merge vào main. Auditor đọc spec (Tech Spec + Frontend Design) và đối chiếu với implementation thực tế.

---

## 1. Layout spec audit

Đối chiếu `TECH_SPEC_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` Section 1:

| Spec | Thực tế | Pass? |
|------|---------|-------|
| CSS Grid 2 cột: `1fr 320px` | Kiểm tra DevTools → Elements | [ ] |
| KLine height: 55vh–60vh | Đo trong DevTools | [ ] |
| AnalyticsTabDeck min-height: 260px | Đo trong DevTools | [ ] |
| Tab height: 36px, padding: 8px 20px | Đo trong DevTools | [ ] |
| Tab animation: 0.18s ease-out | Kiểm tra CSS declaration | [ ] |
| Sidebar width: 320px (expanded) | Đo trong DevTools | [ ] |

---

## 2. Component tree audit

Đối chiếu `TECH_SPEC_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` Section 2:

| Spec | Thực tế | Pass? |
|------|---------|-------|
| `StockDetailUnifiedPage` là page root | Kiểm tra router | [ ] |
| `CommandCenterTopBar` là con trực tiếp | React DevTools | [ ] |
| `KLineChartPanel` trong left column | React DevTools | [ ] |
| `AnalyticsTabDeck` nằm dưới KLine | React DevTools | [ ] |
| `PriceDepthPanel` trong right sidebar | React DevTools | [ ] |
| `IntradayMatchedPanel` trong right sidebar | React DevTools | [ ] |

---

## 3. State contract audit

Đối chiếu `TECH_SPEC_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` Section 3:

| Spec | Thực tế | Pass? |
|------|---------|-------|
| `selectedTradeDate` định nghĩa tại `StockDetailUnifiedPage` | React DevTools State | [ ] |
| `selectedTimeframe` định nghĩa tại `StockDetailUnifiedPage` | React DevTools State | [ ] |
| `handleKlineSessionChange` được truyền vào `KLineChartPanel.onSessionChange` | Code review | [ ] |
| `AnalyticsTabDeck` nhận `selectedTradeDate` qua props | Code review | [ ] |
| Không có local `selectedTradeDate` trong `AnalyticsTabDeck` | Code review | [ ] |

---

## 4. i18n spec audit

| Spec | Thực tế | Pass? |
|------|---------|-------|
| Key `commandCenter.tab.whale` tồn tại | `grep -r "commandCenter.tab.whale" frontend/src/locales/` | [ ] |
| Key `commandCenter.tab.orderflow` tồn tại | grep | [ ] |
| Key `commandCenter.tab.advisory` tồn tại | grep | [ ] |
| Không có text VN hardcode trong JSX | `grep -r "Cá Mập\|Order Flow\|AI Advisory" frontend/src/components/AnalyticsTabDeck.jsx` | [ ] |

---

## 5. Redirect spec audit

| Spec | Thực tế | Pass? |
|------|---------|-------|
| Route `/whale-alerts/:symbol` trỏ đến redirect component | Code review router config | [ ] |
| Redirect về `/stocks/:symbol` (không phải hardcode `/stocks/BMP`) | Code review | [ ] |
| Không có duplicate route cho `/whale-alerts/` | Code review | [ ] |

---

## 6. Immutable source audit (quan trọng nhất)

```bash
# Chạy và paste output vào bảng dưới:
git show HEAD:frontend/src/components/WhaleBubbleChart.jsx | md5sum
git show HEAD~[N]:frontend/src/components/WhaleBubbleChart.jsx | md5sum

# Nếu md5sum giống nhau → PASS. Khác nhau → FAIL, rollback ngay.
```

| File | Hash trước | Hash sau | Match? |
|------|-----------|---------|--------|
| `WhaleBubbleChart.jsx` | ___ | ___ | [ ] |
| `WhaleAnalyticsTab.jsx` | ___ | ___ | [ ] |
| `ModularPositionDeck.jsx` | ___ | ___ | [ ] |

---

## 7. Spec audit sign-off

Auditor phải ký tên xác nhận:

- **Auditor**: ___
- **Ngày audit**: ___
- **Kết quả**: `PASS` / `FAIL — [mô tả vấn đề]`

Nếu FAIL, phải tạo follow-up task và không được merge cho đến khi fix xong.
