# CODE QUALITY CONSTITUTION — Stock Detail SaaS Native VNStockChart Redesign

## 1. Purpose

Chất lượng của workstream này không được định nghĩa bằng việc “chart nhìn xịn hơn”.  
Chất lượng ở đây nghĩa là user đọc đúng phiên, đúng flow, đúng ngữ cảnh, và UI mới không mở đường cho kiến trúc drift khỏi SaaS-native.

Redesign chỉ đạt chuẩn khi:

1. Hero chart thực sự là workspace trung tâm.
2. `selectedSession` là một nguồn truth duy nhất.
3. `OrderFlowRadarPanel` là block ngay dưới chart, không trôi thành panel phụ.
4. Frontend không dựng fake truths cho `news`/`financials`.
5. Backend không bị lôi vào shortcut legacy để nuôi layout mới.

---

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Hero chart hierarchy | 95% | Đây là giá trị cốt lõi của redesign |
| Selected-session truth | 95% | Sai session sẽ làm mọi panel nói dối |
| Order-flow placement and sync | 95% | Đây là hard rule lớn nhất sau chart shell |
| Adapter contract integrity | 90% | Tránh direct fetch / legacy drift |
| Backend no-drift policy | 95% | Một shortcut backend sẽ phá kiến trúc đích |
| Degraded states for stubs | 90% | Nếu không khóa chặt, đội code dễ dựng giả |

---

## 3. Coverage theater prevention

Những thứ sau không được tính là bằng chứng chất lượng:

1. Chỉ có screenshot đẹp nhưng `OrderFlowRadarPanel` vẫn nằm lệch vị trí.
2. Chỉ pass build mà selected session chưa sync tới advisory/order flow.
3. Chỉ sửa `StockDetailPage.js` mà bỏ adapter contract hoặc shell check.
4. Chỉ có degraded copy chung chung kiểu “không có dữ liệu” cho `news`/`financials` dù backend thực tế là stub/unavailable.
5. Chỉ sửa frontend mà lén thêm legacy `/api/*` business shortcut ở backend.

---

## 4. Fitness-to-purpose scenarios

### Scenario Q1 — Giao diện giống ảnh nhưng sai business pane semantics

What can go wrong:
- Team copy shell đẹp, nhưng pane phụ lại dùng RSI/MACD như ảnh thay vì `CVD` và `Strength`.

How to verify:
- Frontend review against frontend design doc + chart screenshot audit.

### Scenario Q2 — Selected session drift

What can go wrong:
- User click một phiên, chart đổi nhưng order flow hoặc advisory vẫn dùng session cũ.

How to verify:
- Session-switch smoke trên ít nhất 2 phiên khác nhau.

### Scenario Q3 — Order flow bị hạ cấp thành side card

What can go wrong:
- Vì tối ưu bố cục, dev đẩy `OrderFlowRadarPanel` ra cạnh phải hoặc xuống sâu dưới context deck.

How to verify:
- Desktop/laptop screenshot audit.

### Scenario Q4 — Fake content để lấp stub backend

What can go wrong:
- `news`/`financials` render bằng mock/fallback data nhìn “ổn” nhưng không phải server truth.

How to verify:
- UI state audit + adapter/backed diff review.

### Scenario Q5 — Đúng UI nhưng sai đích kiến trúc

What can go wrong:
- Trang nhìn đẹp nhưng canonical data path vẫn là legacy client hoặc legacy route.

How to verify:
- Architecture compliance review + shell check + grep no direct fetch.

---

## 5. Hard rules for implementers

1. Không hy sinh chart hierarchy để nhét thêm card phụ.
2. Không tạo second truth cho session ở bất kỳ child component nào.
3. Không thêm fetch mới ngoài adapter như shortcut tạm thời.
4. Không fabricate content cho module deferred.
5. Không merge nếu thiếu ledger/progress/modified-files/module-tree updates.

---

## 6. SaaS-native non-negotiables

1. Không có nghiệm thu hợp lệ nếu stock-detail end-state vẫn neo vào `frontend/src/api/client.js` hoặc runtime legacy path.
2. Không có nghiệm thu hợp lệ nếu backend fix nằm ngoài `packages/core/backend/`.
3. Không có nghiệm thu hợp lệ nếu contract change thiếu OpenAPI/tests.
4. Không có nghiệm thu hợp lệ nếu team giữ bridge legacy mà không owner + expiry.
