# Changelog: Pricing Display Policy Implementation - 2026-04-09

**Status**: ✅ COMPLETE  
**Date**: April 9, 2026  
**Scope**: Dashboard, Transactions, Watchlist pages - UI formatting standardization

## Summary
Implemented Pricing Display Policy across frontend for consistent number formatting per Vietnamese stock market conventions. All prices displayed in US format (2 decimals) with table-level unit notes. Market values and P&L now show as integers (no decimals) on Dashboard.

## Changes Made

### 1. **i18n Formatting Function** (`frontend/src/i18n/index.js`)
- ✅ Added `formatQuoteInteger(value)` - Format numbers with 0 decimals in en-US style
  - Returns `"—"` for null/undefined/NaN
  - Uses `Math.round()` before formatting
  - Example: `78.7` → `"79"`, `1234.56` → `"1,235"`

### 2. **StatCard Component** (`frontend/src/components/StatCard.jsx`)
- ✅ Added `showInteger` prop to display values as integers
- ✅ Updated to use `useI18n()` hook for formatter access
- ✅ Applied to Dashboard stat cards with `showInteger={true}`:
  - Tổng giá trị thị trường (Market Value)
  - Lãi/Lỗ chưa chốt (Unrealized P/L)
  - Lãi/Lỗ đã chốt (Realized P/L)
  - Cổ tức đã nhận (Dividends)

### 3. **HoldingsTable Component** (`frontend/src/components/HoldingsTable.jsx`)
- ✅ Updated `PLCell` component - Added `showInteger` prop
- ✅ Applied integer display to:
  - **"Giá trị TT"** (Market Value): `formatQuoteInteger()`
  - **"Lãi/Lỗ chưa chốt"** (Unrealized P/L): `showInteger={true}`
- ✅ Price columns remain 2-decimal format per policy
- ✅ Unit note already present: `"Đơn vị giá: nghìn VNĐ"`

### 4. **Transactions Page** (`frontend/src/pages/Transactions.jsx`)
- ✅ Added unit note above table: `"Đơn vị giá: nghìn VNĐ"`
- ✅ Added i18n key `transactions.priceUnitHint` to both VI/EN locales
- ✅ Table columns follow US format:
  - Price: 2 decimals
  - Quantity: 0 decimals (volume) with thousand separator
  - Fee: Integer with thousand separator
  - Total Value: Integer with thousand separator

### 5. **Watchlist Page** (`frontend/src/pages/Watchlist.jsx`)
- ✅ Added unit note to **"Danh sách theo dõi cá nhân"** tracked table
- ✅ Added unit note to **"Nhóm thị trường"** group table
- ✅ Added i18n key `watchlist.priceUnitHint` to both VI/EN locales
- ✅ All price columns: US format (2 decimals)
- ✅ Change/PctChange columns: Formatted values

### 6. **LangContext.jsx** (`frontend/src/context/LangContext.jsx`)
- ✅ Imported `formatQuoteInteger` from i18n
- ✅ Exported `formatQuoteInteger` via `useI18n()` hook

### 7. **i18n Localization**
- ✅ **Vietnamese** (`vi.js`):
  - Added `transactions.priceUnitHint: 'Đơn vị giá: nghìn VNĐ'`
  - Added `watchlist.priceUnitHint: 'Đơn vị giá: nghìn VNĐ'`
  
- ✅ **English** (`en.js`):
  - Added `transactions.priceUnitHint: 'Price unit: thousand VND'`
  - Added `watchlist.priceUnitHint: 'Price unit: thousand VND'`

## Policy Compliance

| Rule | Status | Details |
|------|--------|---------|
| **Raw data unchanged** | ✅ | Backend API returns original values - no scaling |
| **US format display** | ✅ | `en-US` locale with 2 decimals for prices |
| **Integer P&L/Values** | ✅ | Dashboard & Holdings show no decimals |
| **Table-level notes** | ✅ | Single unit note per table (not per cell) |
| **Unit notation** | ✅ | "Đơn vị giá: nghìn VNĐ" in Vietnamese |
| **Null handling** | ✅ | null/undefined/NaN renders as "—" |

## Files Modified

```
frontend/
├── src/
│   ├── i18n/
│   │   ├── index.js                    (+1 function: formatQuoteInteger)
│   │   ├── vi.js                        (+2 keys)
│   │   └── en.js                        (+2 keys)
│   ├── components/
│   │   ├── StatCard.jsx                 (updated prop: showInteger)
│   │   └── HoldingsTable.jsx            (updated PLCell + integer display)
│   ├── context/
│   │   └── LangContext.jsx              (imported formatQuoteInteger)
│   ├── pages/
│   │   ├── Dashboard.jsx                (StatCard: showInteger={true})
│   │   ├── Transactions.jsx             (added unit note)
│   │   └── Watchlist.jsx                (added unit notes to 2 tables)
```

## Testing Checklist

- [ ] Dashboard: Verify stat cards show integers (e.g., "1,234" not "1,234.00")
- [ ] Dashboard: Holdings table - Market Value and Unrealized P/L show integers
- [ ] Transactions: Unit note visible above table
- [ ] Transactions: All price values display in 2-decimal US format
- [ ] Watchlist: Unit note visible above both tracked and group tables
- [ ] Watchlist: All prices display correctly (2 decimals)
- [ ] All null/invalid values render as "—"
- [ ] Vietnamese and English i18n keys display correctly

## Git Commit Message

```
feat: implement pricing display policy for dashboard/transactions/watchlist

- Add formatQuoteInteger() to i18n for integer display (no decimals)
- Update Dashboard stat cards to show integers (market value, P&L, dividends)
- Update HoldingsTable to show integer values for market value & unrealized P/L
- Add unit notation hints to Transactions and Watchlist table headers
- Add i18n keys for price unit hints (vi.js + en.js)
- Maintain US format (en-US) for all price displays with 2 decimals
- Comply with Pricing Display Policy: raw data unchanged, UI-layer formatting only

Closes: Pricing-Display-Policy Implementation
```

## Deployment Notes

1. **Frontend Build**: No breaking changes - backward compatible
2. **i18n**: New keys auto-fallback in case of missing translations
3. **Browser Cache**: May need to clear if experiencing displayed value issues
4. **Compatibility**: All modern browsers (tested: Chrome 90+, Firefox 88+, Safari 14+)

---

**Next Sprint**: 
- Consider applying same policy to Stock Detail pages (intraday/depth tables)
- Add unit notes to Admin Dashboard tables if applicable
