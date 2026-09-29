# EXECUTION EVIDENCE TEMPLATE — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## Hướng dẫn sử dụng template này

Copy file này thành file evidence riêng cho từng slice:
`EXECUTION_EVIDENCE_UNIFIED_STOCK_COMMAND_CENTER_S1_20260520.md`

Điền đủ thông tin. Không được mark slice DONE nếu chưa có evidence pack đầy đủ.

---

## Evidence Pack — [Slice ID: ___] [Slice Name: ___]

### Thông tin cơ bản
- **Slice ID**: ___
- **Owner**: ___
- **Ngày thực hiện**: ___
- **Commit hash**: ___
- **PR link**: ___

---

### 1. Build Evidence

```
# Paste output của: npm run build 2>&1 | tail -20
___
```

**Result**: `PASS` / `FAIL`

---

### 2. Test Evidence

```
# Paste output của: npm test -- --watchAll=false 2>&1 | tail -30
___
```

**Result**: `PASS` / `FAIL` | Tests: ___ passed, ___ failed

---

### 3. Immutable Source Check

```bash
# Output của:
# git diff HEAD -- frontend/src/components/WhaleBubbleChart.jsx
# git diff HEAD -- frontend/src/components/WhaleAnalyticsTab.jsx
# git diff HEAD -- frontend/src/components/modern/ModularPositionDeck.jsx
___
```

**Result**: `CLEAN (no changes)` / `VIOLATION — STOP`

---

### 4. Functional Test Screenshots/Video

#### 4.1 Layout (điền link hoặc đính kèm)
- Desktop screenshot (1440px+): ___
- Sidebar collapsed screenshot: ___

#### 4.2 Session sync
- KLine → click nến → Tab Cá Mập update: ___
- Video tab switching (3 tab): ___

#### 4.3 Redirect (S5 only)
- Screenshot URL bar: `/whale-alerts/BMP` → `/stocks/BMP`: ___

---

### 5. Payload Snapshot

```json
// API response từ getWhaleAnalyticsSnapshot hoặc relevant endpoint
// Symbol: BMP, tradeDate: [ngày test]
{
  "___": "___"
}
```

---

### 6. Residual Risk Notes

Liệt kê bất kỳ vấn đề chưa giải quyết hoặc edge case cần theo dõi:

1. ___
2. ___

---

### 7. Acceptance Sign-off

- [ ] Owner self-review: **PASS**
- [ ] Reviewer approval: **PASS**
- [ ] QA smoke test: **PASS**

**Status**: `READY TO MERGE` / `BLOCKED — [lý do]`
