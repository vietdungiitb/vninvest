# Quality Constitution - Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Purpose

Chất lượng của feature pack này không được định nghĩa bằng việc “build pass” đơn thuần. Chất lượng ở đây nghĩa là:

1. `whale-alerts/:symbol` phải cho người dùng một nguồn sự thật duy nhất theo phiên giao dịch.
2. KLineChart phải là surface phân tích trung tâm; `heatmap`, `pane CVD`, `pane strength`, `whale marker`, `bubble` và `advisory` phải cùng bám vào truth đó.
3. Hành vi bubble chart của modern dashboard phải được bảo toàn tuyệt đối vì đây là module nguồn bất biến.
4. Mọi tín hiệu cá mập, heatmap, CVD và strength phải đúng timestamp; đúng-looking nhưng sai bucket được xem là lỗi nghiêm trọng hơn empty state.
5. Mọi AI/coder session đụng vào feature này phải để lại bằng chứng đủ để người khác audit lại mà không cần đoán.

Nguyên lý áp dụng:

- Deming: chất lượng phải được xây vào workflow slice, không chờ đến cuối mới “soát lỗi”.
- Juran: feature chỉ đạt chuẩn khi phù hợp mục đích sử dụng thật của nhà đầu tư, tức là xem đúng phiên, đúng tín hiệu, đúng ngữ cảnh.
- Crosby: chi phí sửa một regression ở modern dashboard hoặc sai ngữ cảnh bubble sau release cao hơn rất nhiều so với việc chặn nó ngay từ protocol self-audit.

## 2. Coverage Targets

| Subsystem | Target | Why |
|---|---:|---|
| Whale Alerts route composition | 90% risk coverage | Đây là route đích; mọi regression ở layout, selected session hoặc cutover path đều lộ trực tiếp cho người dùng |
| Flow View Model + bucket parity | 95% risk coverage | Tooltip, pane, heatmap và marker chỉ hữu ích nếu cùng bucket với candle |
| Flow technical panes semantics | 95% risk coverage | Trộn CVD chuẩn hóa với strength sai pane, sai bucket hoặc sai baseline sẽ tạo quyết định đầu tư sai |
| Heatmap semantics | 95% risk coverage | Heatmap sai nghĩa sẽ khiến người dùng đọc nhầm vùng nóng/lạnh dòng tiền dù chart rất thuyết phục |
| Shark icon viewport selection | 95% risk coverage | Nếu top 10% được tính sai theo toàn dataset thay vì viewport, người dùng sẽ bị dẫn hướng sai mật độ cá mập hiện tại |
| Bubble copy-only adapter | 95% risk coverage | Rủi ro lớn nhất là vô tình sửa module nguồn và gây regression cho modern dashboard |
| Stock Detail parity | 85% risk coverage | Đây là regression lân cận có khả năng bị bỏ sót sau khi chia sẻ logic chart |
| Backend session selector / quality flags | 90% risk coverage | Sai selector phiên hoặc thiếu degraded-state semantics sẽ phá selected-session truth và làm UI nói dối |

## 3. Coverage Theater Prevention

Những thứ sau không được tính là bằng chứng chất lượng:

1. Chỉ chứng minh `npm run build` pass mà không có screenshot hoặc payload proof cho selected-session sync.
2. Chỉ viết test presence như “component render thành công” nhưng không assert bubble đổi theo phiên click.
3. Chỉ test heatmap có màu mà không assert đúng mode `Net/Buy/Sell` và đúng bucket.
4. Chỉ ghi “không sửa modern dashboard” mà không có diff proof for 3 immutable source files.
5. Chỉ kiểm icon cá mập xuất hiện, nhưng không kiểm nó thay đổi theo zoom/pan/view window.
6. Chỉ assert CVD line có dữ liệu mà không xác nhận `CVD raw` và `CVD normalized` giữ đúng semantics riêng.

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

### Scenario F3 - Tooltip, pane hoặc heatmap trộn metric từ bucket lân cận

What can go wrong:
- Vì tooltip, pane, heatmap hoặc marker lấy dữ liệu từ các map thời gian khác nhau, hover một nến nhưng ít nhất một lớp hiển thị metric của bucket kế bên. Đây là lỗi “đúng-looking but wrong”.

Where to inspect:
- Flow View Model mapping.
- Tooltip builder / selected data lookup.
- Heatmap overlay mapping.

How to verify:
- Hover nhiều nến kế nhau, đổi heatmap mode, đối chiếu payload bucket time.

### Scenario F3b - CVD raw và CVD normalized bị nhập nhằng

What can go wrong:
- Đội code lấy `CVD raw` vẽ chung scale với strength hoặc dùng `CVD normalized` cho tooltip. Chart nhìn mượt nhưng mất tính trung thực dữ liệu, khiến người dùng không phân biệt đâu là cường độ tương đối, đâu là giá trị tích lũy thật.

Where to inspect:
- CVD pane adapter.
- Strength pane adapter.
- Tooltip builder.
- Backend payload fields `cvd_raw`, `cvd_normalized`.

How to verify:
- So payload thật with line values và tooltip values trên cùng bucket.

### Scenario F3c - Heatmap đẹp nhưng sai nghĩa nghiệp vụ

What can go wrong:
- Heatmap dùng màu rất thuyết phục nhưng thực tế chỉ phản ánh volume hoặc matched value thô, không phải net flow/buy heat/sell heat như label đang nói. Đây là lỗi dễ lọt nhất vì chart trông rất “pro”.

Where to inspect:
- Heatmap series builder.
- Payload `heatmap_series`.
- Mode switch logic `Off/Net/Buy/Sell`.

How to verify:
- Chuyển từng mode, đối chiếu payload cùng bucket với màu đang render.

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
- CVD pane normalization path.
- Strength pane mapping path.

How to verify:
- So payload thật với tooltip và panel labels; dùng snapshot API để kiểm field-level parity.

## 5. AI Session Quality Discipline

1. Bắt đầu từ file neo gần nhất, không mở rộng bề mặt vô cớ.
2. Sau edit thực chất đầu tiên phải chạy focused validation ngay.
3. Không được sửa source bubble module của modern dashboard để “làm nhanh”.
4. Không đánh dấu slice complete nếu chưa có evidence template và ledger/progress sync.
5. Nếu contract backend chưa rõ, dừng ở plan/adapter contract thay vì hard-code workaround trong UI.
6. Không thêm heatmap hoặc marker layer trực tiếp vào chart khi chưa khóa `Flow View Model`.
7. Sau mỗi lần sửa code, bắt buộc chạy lệnh build/update docker dev (ví dụ: `docker compose -f ./docker-compose.dev.yml up -d --build frontend backend`) để đảm bảo code mới được cập nhật; nếu không hệ thống sẽ vẫn chạy code cũ.

## 6. The Human Gate

Những điểm sau cần human/final auditor quyết định cuối:

1. Advisory text có đủ ngắn và đủ sắc cho nhà đầu tư hay chưa.
2. Heatmap density có giúp đọc chart hay đang làm chart bẩn.
3. Whale marker density có giúp đọc chart hay gây nhiễu ở viewport hẹp.
4. CVD normalized trên pane đã đủ trực quan mà vẫn không làm mất ý nghĩa của CVD raw.
5. Có cần giữ thêm bất kỳ card trust-context nào ở cột phải hay không sau khi chart intelligence hoàn tất.