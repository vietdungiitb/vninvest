# Kế hoạch triển khai: Symbol Scope Selector cho Modern Dashboard

**Ngày chốt**: 2026-04-21  
**Trạng thái**: Ready for review  
**Phạm vi**: Modern Dashboard, Modular Position Deck, symbol universe hợp nhất Holdings + TrackedSymbol + WatchlistItem

---

## 1. Mục tiêu

Mở rộng Modern Dashboard để người dùng có thể chọn phạm vi mã chứng khoán dùng chung cho các tab:
- Tổng quan
- Kỹ thuật
- Cá mập
- AI Bot

Phạm vi chọn phải hỗ trợ:
- Holdings
- TrackedSymbol
- WatchlistItem
- All (hợp nhất 3 nguồn trên, loại trùng)

Ngoài ra, người dùng phải chọn được:
- Toàn bộ mã trong scope đang chọn
- Một mã cụ thể trong scope đang chọn

---

## 2. Diễn giải yêu cầu nghiệp vụ

### 2.1 Yêu cầu cốt lõi

Hiện tại Modern Dashboard chỉ vận hành theo universe `holdings`, nên dữ liệu hiển thị ở 4 tab bị giới hạn vào các mã đang nắm giữ thực tế trong danh mục.

Yêu cầu mới là đưa vào một lớp `symbol scope` thống nhất để các tab không còn phụ thuộc cứng vào holdings, mà có thể chạy trên:
- danh mục đang nắm giữ,
- danh sách tracked cá nhân,
- các mã trong watchlist,
- hoặc toàn bộ hợp nhất của cả ba.

### 2.2 Cách hiểu đúng

Không nên hiểu yêu cầu này đơn thuần là "thêm combobox lọc bảng". Đây là thay đổi về data contract và semantics của toàn bộ cụm tab trong Modern Dashboard.

Mô hình đúng là 2 tầng lựa chọn:
- `Nguồn mã`: holdings | tracked | watchlist | all
- `Mã`: all | một mã cụ thể

### 2.3 Nguyên tắc SSOT

Nguồn sự thật cho từng tập symbol:
- Holdings: portfolio transactions -> holdings API
- Tracked: tracked symbols API
- Watchlist: watchlist groups/items API
- All: union + normalize + dedupe từ 3 nguồn trên

Không cho phép mỗi tab tự tạo universe riêng bằng heuristic khác nhau.

---

## 3. Trạng thái hiện tại

### 3.1 Frontend hiện tại

Trang [frontend/src/pages/modern/ModernDashboard.jsx](frontend/src/pages/modern/ModernDashboard.jsx) hiện fetch:
- summary
- holdings
- analytics
- technicals
- digest
- tracked symbols

Nhưng chưa fetch watchlist groups/items cho Modern Dashboard.

Component [frontend/src/components/modern/ModularPositionDeck.jsx](frontend/src/components/modern/ModularPositionDeck.jsx) hiện nhận:
- holdings
- technicals
- alerts
- analytics
- digest

Và mặc định lan truyền logic holdings-only cho cả 4 tab.

### 3.2 Backend hiện tại

Các API đang gắn chặt với portfolio:
- summary: theo `portfolio_id`
- analytics: theo `portfolio_id`
- technicals: theo `portfolio_id`, build từ holdings thực

Digest hiện là cấp user, nhưng nguồn symbols hiện lấy từ watchlist khi job nền tạo digest.

---

## 4. Quyết định thiết kế

## 4.1 UX selector

Đặt một toolbar chung ở đầu `ModularPositionDeck` với 2 selector:

1. `Phạm vi mã`
- Holdings
- Tracked
- Watchlist
- Tất cả

2. `Mã`
- Tất cả mã
- Danh sách mã cụ thể theo scope đang chọn

Rule:
- Đổi scope -> reset symbol về `all`
- Nếu scope đổi làm mã cũ không còn hợp lệ -> fallback về `all`

## 4.2 Semantics theo tab

### Tab Tổng quan
- Không tiếp tục coi mọi dòng đều là holding.
- Cần một bảng monitor thống nhất cho symbol universe.
- Nếu item là holding thì hiển thị thêm dữ liệu vị thế.
- Nếu item chỉ là tracked/watchlist thì hiển thị realtime/profile data và cột vị thế là `—` hoặc ẩn theo schema chung.

### Tab Kỹ thuật
- Phải hỗ trợ symbol universe bất kỳ.
- Cần endpoint backend mới để tính technicals theo list symbol.
- Không tái dùng trực tiếp endpoint technicals theo portfolio nếu scope != holdings.

### Tab Cá mập
- Bubble chart chỉ nên hiển thị 1 mã tại một thời điểm.
- `All` chỉ dùng làm universe cho combobox chọn mã.
- Không render một bubble chart gộp nhiều mã.

### Tab AI Bot
- Health score và analytics portfolio chỉ hợp lệ cho holdings.
- Khi scope != holdings, UI cần chuyển sang chế độ `AI monitor mode` theo universe mã.
- Pha đầu có thể giữ `Health Score` chỉ cho holdings và hiển thị trạng thái chưa hỗ trợ đầy đủ cho non-holdings.

---

## 5. Phạm vi triển khai theo phase

## Phase 1 — Frontend selector + unified symbol universe

### Mục tiêu
- Có selector hoạt động trên UI.
- Có symbol universe hợp nhất từ holdings, tracked, watchlist.
- Tab Tổng quan và Cá mập dùng được selector mới.

### Công việc
- Fetch watchlist groups/items tại Modern Dashboard.
- Xây utility normalize + dedupe + annotate symbol source.
- Thêm state `symbolScope` + `selectedSymbol`.
- Refactor ModularPositionDeck để nhận `symbolUniverse` thay vì chỉ holdings.
- Tạo `UnifiedSymbolTable` cho tab Tổng quan.
- Refactor WhaleBubbleChart để nhận options symbols từ universe mới.

### Kết quả mong đợi
- User đổi scope và thấy danh sách mã thay đổi đúng.
- Overview hiển thị đúng cho holdings/tracked/watchlist/all.
- Whale tab chọn được bất kỳ mã thuộc scope đã chọn.

## Phase 2 — Technicals bulk by symbol universe

### Mục tiêu
- Tab Kỹ thuật chạy được với holdings, tracked, watchlist, all.

### Công việc
- Thêm endpoint backend `technicals by symbols`.
- Reuse logic `_screener_build_technical` nhưng bỏ phụ thuộc `portfolio_id`.
- Thêm validation symbol list và limit số lượng.
- Frontend gọi endpoint theo scope hiện tại.

### Kết quả mong đợi
- Tab Kỹ thuật không còn holdings-only.

## Phase 3 — AI monitor mode

### Mục tiêu
- AI tab phản ánh đúng semantics theo scope.

### Công việc
- Giữ health score/analytics cho holdings.
- Với non-holdings, hiển thị AI monitor summary theo symbol universe.
- Nếu chưa đủ backend, hiển thị degraded mode rõ ràng thay vì dữ liệu sai nghĩa.

### Kết quả mong đợi
- AI tab không còn trộn lẫn `portfolio metrics` với `watchlist/tracked` mà không có phân biệt.

---

## 6. Thiết kế dữ liệu frontend

## 6.1 View model đề xuất

```javascript
{
  symbol: 'FPT',
  in_holdings: true,
  in_tracked: true,
  in_watchlist: false,
  source_tags: ['holdings', 'tracked'],
  watchlist_group_names: [],
  quantity: 100,
  avg_cost: 91200,
  market_value: 9450000,
  current_price: 94500,
  change_pct: 1.72,
  industry: 'Công nghệ',
  company_name: 'FPT Corp',
}
```

## 6.2 State đề xuất

```javascript
const [symbolScope, setSymbolScope] = useState('holdings');
const [selectedSymbol, setSelectedSymbol] = useState('all');
```

Derived selectors:
- `symbolUniverseByScope`
- `filteredSymbols`
- `filteredOverviewRows`
- `filteredWhaleSymbolOptions`
- `effectiveTechnicalSymbols`

---

## 7. API/backend changes bắt buộc

## 7.1 Cần giữ nguyên
- summary theo portfolio
- analytics theo portfolio

## 7.2 Cần endpoint mới

Đề xuất:

`POST /api/stock-management/technicals/bulk/`

Request:

```json
{
  "symbols": ["FPT", "HPG", "MWG"]
}
```

Response:

```json
{
  "technicals": [
    {
      "symbol": "FPT",
      "date": "2026-04-21",
      "rsi_14": 58.2,
      "sma20": 91400,
      "sma50": 90120,
      "momentum_20d_pct": 4.12
    }
  ]
}
```

Guardrails:
- normalize uppercase
- dedupe trước khi xử lý
- reject empty list
- cap tối đa số symbol mỗi request

---

## 8. Rủi ro và lưu ý

### R1 — Trộn holdings với non-holdings sai nghĩa
Nếu tái dùng nguyên `HoldingsTable` cho tracked/watchlist, UI sẽ hiển thị cột vị thế không hợp lệ.

### R2 — Whale tab dùng all-symbol chart
Bubble chart nhiều mã cùng lúc sẽ nhiễu và sai semantics.

### R3 — AI tab hiện đang mixed semantics
Digest là cấp user/watchlist trong khi analytics là cấp portfolio. Nếu không tách rõ, user sẽ hiểu sai.

### R4 — Tăng số symbol realtime
Khi scope = all, monitored universe có thể lớn hơn holdings-only; cần reuse cap/guard sẵn có.

---

## 9. Acceptance criteria

### UX
- User nhìn thấy 2 selector chung trên Modular Position Deck.
- Scope đổi thì danh sách mã thay đổi đúng.
- Chọn `all` hoặc một mã cụ thể đều hoạt động nhất quán.

### Functional
- Overview phản ánh đúng source scope.
- Whale tab chọn được mã ngoài holdings nếu thuộc tracked/watchlist.
- Technical tab chạy đúng với symbol universe sau khi phase 2 hoàn tất.

### Data correctness
- Universe `all` không chứa symbol trùng.
- Mỗi symbol có source tag chính xác.
- Không có tab nào hiển thị dữ liệu holdings giả cho non-holdings mà không gắn cờ.

---

## 10. Đề xuất thứ tự thực thi

1. Phase 1: selector + universe + overview + whale
2. Phase 2: technicals bulk API + technical tab
3. Phase 3: AI monitor mode

Khuyến nghị không làm full-stack tất cả tab trong một PR duy nhất. Nên chia thành các slice nhỏ để giảm regression và dễ audit.
