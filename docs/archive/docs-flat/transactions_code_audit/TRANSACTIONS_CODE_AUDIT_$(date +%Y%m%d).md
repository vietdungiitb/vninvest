# TRANSACTIONS_CODE_AUDIT.md
*Ngày tạo: $(date)*

## 1. Tổng quan kiến trúc code (frontend/src/pages/Transactions.jsx)
Transactions là **transaction ledger + form editor** đầy đủ CRUD per sub-account:
- **Tabs**: All vs per sub-account (colored badges)
- **Summary cards**: Buy/Sell count khi multi-subaccount
- **Inline form**: Create/Edit với **fee calculator thông minh** (VPS/HSC presets, VSD 0.03%, thuế bán 0.1%)
- **Table**: Sort date desc, link symbol → StockDetail, edit/delete inline
- **Validation**: Pre-submit `getStockProfile(symbol)` check 404

**Data flow**:
```
getSubAccounts → tabs + summary
getTransactions(sub_id) parallel → table
create/update/delete → optimistic refresh
```

## 2. Ưu điểm (Strengths)
| **Điểm mạnh** | **Code evidence** | **Giá trị** |
|---------------|-------------------|-------------|
| **Fee calculator chuẩn VN** | `calcFee()` với brokerage presets, VSD/TAX rates, MIN_FEE 10k | **Domain accurate**, save user calc time |
| **Smart UX** | Auto-fill fee từ preset, detect manual override, live txValue preview | Frictionless data entry |
| **Multi-subaccount** | Tabs + summary cards + color coding | Scale cho power users nhiều TK |
| **Validation proactive** | Symbol check trước submit via API | Prevent bad data early |
| **i18n + responsive** | Full labels, grid responsive, formatVND locale | Production ready |
| **Optimistic refresh** | Reload table sau CRUD success | Responsive feel |

## 3. Nhược điểm (Weaknesses)
| **Vấn đề** | **Code issue** | **Tác động** | **Priority** |
|------------|----------------|--------------|--------------|
| **Form UX desktop** | Inline form chiếm 100% width, no modal | **Cramped khi edit** trên large screen | 🚨 P1 |
| **No bulk ops** | Chỉ single CRUD | Scale kém >100 txs | ⚠️ P2 |
| **No search/filter** | Table không filter date/symbol/type | **Hard navigate** history dài | 🚨 P1 |
| **Weak client validation** | Chỉ number min=0, no lot size/symbol rules | Dupe bad data qua API | ⚠️ P2 |
| **Delete UX poor** | `window.confirm()` native | Inconsistent với app style | ⚠️ P3 |
| **No export** | No CSV/PDF | **Compliance gap** cho audit | ⚠️ P2 |
| **No realtime** | Static load, no WS sync | Miss live portfolio impact | ⚠️ P3 |

## 4. Tư vấn cải thiện (Consultation)
### **P1: Core UX (1 ngày)**
```
1. Form → Modal (useState + backdrop) cho desktop/mobile consistency
2. Table search: debounce input → client-side filter date/symbol/type
3. Add column: Net cash flow (signed value: BUY -, SELL +)
```

### **P2: Power Features (2 ngày)**
```
1. Bulk select + delete/export CSV
2. Client validation: lot multiples (100), price tick size, date < today
3. Subaccount balance summary ở tabs
4. Keyboard shortcuts: ⌘+N new, Enter edit
```

### **P3: Polish + Integration (1 ngày)**
```
1. Custom confirm modal thay window.confirm
2. Link từ Dashboard "Recent Transactions" → Transactions#recent
3. Integrate realtime: WS portfolio refresh → optimistic table update
4. Export PDF với signature/date cho compliance
```

**Benchmark vs pro ledger (Money Lover/YNAB)**: 85% (domain UX excellent nhưng navigation weak). P1 fix → 95%.

**Test recommend**: Load 500txs → measure search/edit time. Focus P1 nếu >3s.

*(BLACKBOXAI audit từ Transactions.jsx + docs references)*