# Quality Constitution - Whale Alerts Symbol Kline Refactor

## 1. Purpose

Chất lượng của feature pack này không được định nghĩa bằng việc “build pass” đơn thuần. Chất lượng ở đây nghĩa là:

1. `whale-alerts/:symbol` phải cho người dùng một nguồn sự thật duy nhất theo phiên giao dịch.
2. Hành vi bubble chart của modern dashboard phải được bảo toàn tuyệt đối vì đây là module nguồn bất biến.
3. Mọi tín hiệu cá mập, CVD và strength phải đúng timestamp; đúng-looking nhưng sai bucket được xem là lỗi nghiêm trọng hơn empty state.
4. Mọi AI/coder session đụng vào feature này phải để lại bằng chứng đủ để người khác audit lại mà không cần đoán.

Nguyên lý áp dụng:

- Deming: chất lượng phải được xây vào workflow slice, không chờ đến cuối mới “soát lỗi”.
- Juran: feature chỉ đạt chuẩn khi phù hợp mục đích sử dụng thật của nhà đầu tư, tức là xem đúng phiên, đúng tín hiệu, đúng ngữ cảnh.
- Crosby: chi phí sửa một regression ở modern dashboard hoặc sai ngữ cảnh bubble sau release cao hơn rất nhiều so với việc chặn nó ngay từ protocol self-audit.

## 2. Coverage Targets

| Subsystem | Target | Why |
|---|---:|---|
| Whale Alerts route composition | 90% risk coverage | Đây là route đích của refactor; mọi regression ở layout, selected session hoặc cutover path đều lộ trực tiếp cho người dùng |
| Kline technical pane + tooltip semantics | 95% risk coverage | Sai bucket hoặc sai metric theo nến sẽ tạo quyết định đầu tư sai dù UI trông vẫn hợp lý |
| Shark icon viewport selection | 95% risk coverage | Nếu top 10% được tính sai theo toàn dataset thay vì viewport, người dùng sẽ bị dẫn hướng sai mật độ cá mập hiện tại |
| Bubble copy-only adapter | 95% risk coverage | Rủi ro lớn nhất là vô tình sửa module nguồn và gây regression cho modern dashboard |
| Stock Detail radar relocation | 85% risk coverage | Đây là regression lân cận có khả năng bị bỏ sót sau khi tách/copy chart logic |
| Backend session selector / session metrics | 90% risk coverage | Sai selector phiên sẽ phá toàn bộ selected-session bubble và tooltip semantics |

## 3. Coverage Theater Prevention

Những thứ sau không được tính là bằng chứng chất lượng:

1. Chỉ chứng minh `npm run build` pass mà không có screenshot hoặc payload proof cho selected-session sync.
2. Chỉ viết test presence như “component render thành công” nhưng không assert bubble đổi theo phiên click.
3. Chỉ test source bubble module hiện hữu mà không test namespace copy dành riêng cho whale-alerts/symbol.
4. Chỉ ghi “không sửa modern dashboard” mà không có diff proof cho 3 immutable source files.
5. Chỉ kiểm icon cá mập xuất hiện, nhưng không kiểm nó thay đổi theo zoom/pan/view window.

## 4. Fitness-to-Purpose Scenarios

### Scenario F1 - Selected session bubble lệch ngày giao dịch

What can go wrong:
- Người dùng click nến cuối tuần hoặc phiên gần ngày nghỉ; bubble chart lấy ngày lịch gần nhất thay vì phiên giao dịch gần nhất có dữ liệu. UI vẫn hiện bubble nên lỗi khó phát hiện.

Where to inspect:
- Route whale-alerts/symbol selected-session adapter.
- API `getWhaleAnalyticsSnapshot(...trade_date=...)` và latest-session fallback.

How to verify:
- Mở route ngoài giờ giao dịch, kiểm latest valid session.
- Click ít nhất hai phiên khác nhau và đối chiếu payload `trade_date`.

### Scenario F2 - Bubble source module bị sửa trực tiếp

What can go wrong:
- Đội code tiện tay chỉnh `frontend/src/components/WhaleBubbleChart.jsx` để giải quyết yêu cầu route mới. Modern dashboard sẽ regress dù feature chính nhìn như đã xong.

Where to inspect:
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`

How to verify:
- Diff source immutable files phải sạch cho feature pack này.

### Scenario F3 - Tooltip trộn metric từ bucket lân cận

What can go wrong:
- Vì pane kỹ thuật và tooltip lấy dữ liệu từ map thời gian khác nhau, hover một nến nhưng tooltip hiển thị CVD/strength của bucket kế bên. Đây là lỗi “đúng-looking but wrong”.

Where to inspect:
- Kline technical pane mapping.
- Tooltip builder / selected data lookup.

How to verify:
- Hover nhiều nến kế nhau, đối chiếu payload bucket time.

### Scenario F4 - Shark icon không recompute theo viewport

What can go wrong:
- Icon cá mập được gắn theo top 10% toàn dataset. Khi zoom vào vùng hẹp, icon vẫn giữ từ dữ liệu ngoài khung nhìn và làm sai cảm nhận mật độ hoạt động hiện tại.

Where to inspect:
- Visible range listener.
- Overlay marker selection logic.

How to verify:
- Zoom in/out, pan ngang, đổi timeframe; so số lượng và vị trí icon.

### Scenario F5 - Bubble advisory dùng sai ngữ cảnh toàn symbol

What can go wrong:
- Advisory text hiển thị như nói về phiên đang click nhưng thực tế lấy advisory toàn symbol hoặc toàn session trước đó.

Where to inspect:
- Advisory adapter từ Stock Detail.
- Request payload / input context cho advisory session.

How to verify:
- Đổi giữa hai phiên có đặc tính whale trái ngược và kiểm advisory thay đổi tương ứng.

### Scenario F6 - Old chart path vẫn còn mount ngầm

What can go wrong:
- Route mới render KlineChart nhưng `DarkMoneyMasterChart` hoặc fetch cũ vẫn mount ngầm, tạo double-fetch và trạng thái race condition.

Where to inspect:
- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- Hook fetch/realtime side effects quanh whale route.

How to verify:
- Audit component tree, network requests và effect cleanup.

### Scenario F7 - Stock Detail bị regress sau khi dời Radar

What can go wrong:
- Việc tách/copy logic chart làm `StockDetail` mất advisory state, layout vỡ hoặc radar polling không còn đúng vị trí/semantics.

Where to inspect:
- `frontend/src/pages/StockDetail.jsx`
- `frontend/src/components/OrderFlowRadarPanel.jsx`

How to verify:
- Chạy build, mở `stocks/:symbol`, kiểm radar vị trí mới và advisory session.

### Scenario F8 - Technical pane hiển thị đúng hình nhưng sai đơn vị

What can go wrong:
- Whale buy/sell, CVD và strength cùng vẽ được nhưng có field sai đơn vị hoặc mixed value/volume, khiến tooltip và pane sai nghiệp vụ.

Where to inspect:
- Backend per-candle metrics contract.
- Frontend adapter mapping.

How to verify:
- So payload thật với tooltip và panel labels; dùng snapshot API để kiểm field-level parity.

## 5. AI Session Quality Discipline

1. Bắt đầu từ file neo gần nhất, không mở rộng bề mặt vô cớ.
2. Sau edit thực chất đầu tiên phải chạy focused validation ngay.
3. Không được sửa source bubble module của modern dashboard để “làm nhanh”.
4. Không đánh dấu slice complete nếu chưa có evidence template và ledger/progress sync.
5. Nếu contract backend chưa rõ, dừng ở plan/adapter contract thay vì hard-code workaround trong UI.

## 6. The Human Gate

Những điểm sau cần human/final auditor quyết định cuối:

1. Advisory text có đủ ngắn và đủ sắc cho nhà đầu tư hay chưa.
2. Compact cards W2+W4 và Dark Money đã đủ cô đọng hay còn dư chữ.
3. Shark icon density có giúp đọc chart hay gây nhiễu ở viewport hẹp.
4. Có cần giữ thêm bất kỳ card trust-context nào ở cột phải hay không sau khi chart mới hoàn tất.