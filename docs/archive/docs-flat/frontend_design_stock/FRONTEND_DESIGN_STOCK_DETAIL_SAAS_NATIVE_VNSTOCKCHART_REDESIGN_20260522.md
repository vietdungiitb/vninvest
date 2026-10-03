# FRONTEND DESIGN — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Scope**: Khóa chặt hierarchy, wireframe, responsive behavior, component-level acceptance criteria và design language để đội frontend không diễn giải lệch.

---

## 1. Design intent

Trang stock detail mới phải trả lời được 4 câu hỏi trong vài giây đầu:

1. Cổ phiếu đang ở ngữ cảnh giá nào và timeframe nào?
2. Phiên nào đang được chọn làm truth cho toàn trang?
3. Dòng tiền và order flow đang nói gì ngay lúc này?
4. Tôi có thể theo dõi / thêm watchlist / tạo cảnh báo / đọc advisory ở đâu?

Mapping:

- Hero chart workspace trả lời câu 1 và 2.
- `OrderFlowRadarPanel` trả lời câu 3.
- Command bar + context deck trả lời câu 4.

---

## 2. Visual anchor từ ảnh VNStockChart

Ảnh tham chiếu được dùng như visual anchor cho shell, không phải để sao chép nguyên indicator semantics.

### Phải giữ từ ảnh tham chiếu

1. Control bar nằm trong shell của chart.
2. Meta strip OHLC/indicator nằm ngay dưới toolbar.
3. Price pane chiếm ưu thế rõ ràng.
4. Pane phụ xếp dọc gọn, đồng bộ trục X.
5. Footer có range presets và action shortcuts.
6. Giao diện analytical, sạch, scan nhanh, ít card trang trí.

### Không được hiểu sai từ ảnh tham chiếu

1. Ảnh có RSI/MA chỉ là visual shell reference; ở VNInvest, pane phụ bắt buộc là `CVD` và `Strength`.
2. Không bê nguyên indicator set của ảnh tham chiếu để thay business chart semantics.
3. Không biến chart thành khu vực demo kỹ thuật; chart phải phục vụ smart-money-flow reading.

---

## 3. Information hierarchy

### Tier 1 — Hero workspace

1. `StockDetailHeaderBar`
2. `StockPrimaryQuoteCard`
3. `StockChartWorkspaceCard`

### Tier 2 — Session interpretation

1. `StockSessionWitnessStrip`
2. `StockOrderFlowLane`

### Tier 3 — Contextual support

1. `StockIntradayMatchedPanel`
2. `StockDepthOrLiquidityPanel`
3. `StockUserStatePanel`
4. `StockAlertSummaryPanel`
5. `StockAdvisoryPanel`

### Tier 4 — Deferred reading

1. `StockNewsPanelNative`
2. `StockFundamentalsPanelNative`
3. company/profile modules nếu có

---

## 4. Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header bar: symbol · price · % change · market cap · actions              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Hero chart workspace                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Toolbar: symbol | timeframe | chart type | compare | replay | panes   │ │
│ │ Meta strip: O H L C Vol + indicator summary                            │ │
│ │ Price pane + overlays                                                   │ │
│ │ Volume pane                                                             │ │
│ │ CVD pane                                                                │ │
│ │ Strength pane                                                           │ │
│ │ Footer: 1D 5D 1M 3M YTD 1Y All | Kịch bản | Cảnh báo | Giao dịch       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ OrderFlowRadarPanel full-width                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Context deck: intraday matched | liquidity/depth | alert/advisory summary │
├─────────────────────────────────────────────────────────────────────────────┤
│ Deferred modules: news | financials | profile                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Absolute rules

1. Chart phải rộng hơn mọi module khác.
2. Không có fixed right rail mặc định ở desktop 1440px/1366px nếu điều đó làm chart bị hẹp.
3. `OrderFlowRadarPanel` luôn ở ngay dưới chart, không chen ngang.

---

## 5. Panel-by-panel design rules

### 5.1 `StockChartToolbar`

Must keep:

1. timeframe selector
2. chart type selector
3. compare trigger
4. replay trigger
5. panes manager
6. live venue badge

Must not do:

1. lấn chiều cao chart bằng hai hàng controls
2. biến thành command center nặng chữ hơn chart

### 5.2 `StockChartMetaStrip`

Must keep:

1. O/H/L/C
2. volume
3. visible bars count nếu có
4. 2-4 indicator values scan nhanh

Must not do:

1. wrap thành nhiều dòng trên desktop mặc định
2. render quá nhiều chip màu làm user mất tập trung

### 5.3 Hero chart panes

Acceptance rules:

1. `Price pane` nhìn vào là thấy ngay đây là bề mặt chính.
2. `CVD` và `Strength` dễ đọc nhưng không lấn át `Price`.
3. Whale bubbles, shark icons, heatmap bands phải tăng giá trị đọc chart, không làm chart bẩn.

### 5.4 `StockOrderFlowLane`

Primary purpose: giải thích flow theo phiên đã chọn.

Must keep:

1. CVD 30m / radar / recent signals / absorption context nếu hiện có
2. session witness rõ ràng

Must not do:

1. lấy session riêng
2. hiển thị như card phụ nằm bên lề

### 5.5 Context deck

Primary purpose: hỗ trợ quyết định sau khi user đã đọc chart + flow.

Rules:

1. Các card phải thấp hơn chart về độ nhấn thị giác.
2. Alert summary và advisory là hai lớp khác nhau; không gộp một cách mơ hồ.
3. `news`/`financials` là deferred modules, không leo lên trên chart lane.

---

## 6. Color and semantic language

1. Buy strength: xanh lục sáng.
2. Institutional strength: cyan/xanh lam sáng.
3. Net buy heat: xanh lục với alpha.
4. Net sell heat: đỏ hồng với alpha.
5. Stealth/whale action: hổ phách.
6. Stale data: neutral/amber status chip, không dùng màu thành công.

Không dùng màu chỉ vì đẹp; mọi màu phải bám semantics dữ liệu.

---

## 7. Responsive behavior

### 1440px+

1. hero chart full-width
2. order flow full-width
3. context deck 3 cột nếu đủ rộng

### 1366px / 1280px

1. chart vẫn phải ưu tiên chiều ngang
2. context deck chuyển 2 cột nếu cần
3. không có side rail cố định

### 1024px / 768px

1. control bar rút gọn qua overflow menus
2. chart shell vẫn giữ hierarchy rõ
3. order flow vẫn nằm ngay dưới chart

### Mobile

```text
Header
Quote / actions
Hero chart workspace
Order flow lane
Context deck
Deferred modules
```

---

## 8. UI state matrix

| State | Expected behavior |
|---|---|
| `loading-blocking` | skeleton shell nhưng giữ height chart ổn định |
| `loading-deferred` | chart dùng được, modules dưới chart skeleton riêng |
| `stale` | badge stale ở witness strip hoặc module |
| `empty` | nêu rõ module nào chưa có dữ liệu |
| `partial-failure` | panel lỗi độc lập, chart và phần khác vẫn dùng được |
| `not-found` | symbol invalid có state riêng, không render chart giả |

---

## 9. Reject conditions cho reviewer frontend

1. Chart không còn là bề mặt chiếm ưu thế.
2. `OrderFlowRadarPanel` không nằm dưới chart.
3. UI giống ảnh tham chiếu nhưng lại dùng sai pane semantics.
4. `news`/`financials` được dựng như có thật dù backend chưa có truth.
5. Layout quay về kiểu dashboard nhiều card ngang hàng.
