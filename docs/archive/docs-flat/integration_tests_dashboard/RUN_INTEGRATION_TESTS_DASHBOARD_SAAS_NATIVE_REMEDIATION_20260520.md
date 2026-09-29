# RUN INTEGRATION TESTS — Dashboard SaaS Native Remediation

**Ngày**: 2026-05-20  
**Scope**: Kiểm thử liên thông luồng dữ liệu (Dataflow integration), kiểm thử WebSocket ổn định (Anti-Churn) và tương tác chéo UI.

---

## 1. Suite A — Bắt buộc tự động kiểm thử UI Lifecycle (Slice 6)

> [!IMPORTANT]
> Bộ kiểm thử này **sẽ được tạo mới** trong quá trình thực hiện slice tại đường dẫn:  
> `packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js`

### Các lệnh chạy test tự động:
```powershell
# Chạy bộ test suite UI-Lifecycle bằng script Jest chính thức của package
Push-Location ./packages/web
npm test -- src/features/dashboard/__tests__/dashboard_lifecycle.test.js
Pop-Location
```

### Các ca test kiểm duyệt (Must-Pass):
1. **`Phase2 Fail Isolation Test`**: Giả lập `getBulkTechnicalsBySymbols` trả về lỗi. Khẳng định `useCoreDashboardData` vẫn trả về dữ liệu holdings và summary đầy đủ, đặt `technicalsStatus.status = 'failed'` với mã lỗi `[ERR_CORE_BULK_TECHNICAL_03]`.
2. **`Empty Holdings Ready Trigger Test`**: Giả lập holdings rỗng. Khẳng định `onDataReady` vẫn kích hoạt và truyền dữ liệu khi có readyToken mới.
3. **`SWR Anti-Flicker Hydrate Test`**: Khẳng định sau khi `hasHydrated = true`, các tiến trình loading tiếp theo không kích hoạt vẽ LoadingSkeleton đè lên UI.
4. **`WebSocket Stable Token sorting Test`**: Giả lập thay đổi thứ tự hoặc sắp xếp lại các mã trong watchlist/watchlists. Khẳng định `readyToken` sinh ra giữ nguyên giá trị, ngăn chặn rebind WebSocket churn.

---

## 2. Suite B — Kịch bản thủ công kiểm định Degraded-State & Anti-Churn

### Kịch bản B1: Xác minh Degraded-State phục vụ DataOps
1. Truy cập trang `/dashboard/package-host`.
2. Giả lập chặn hoặc làm trễ API technicals bulk trả về lỗi 504.
3. **Kết quả mong muốn:** Trang tài sản vẫn hiển thị hoàn hảo; console xuất hiện log degraded-state rõ ràng `[ERR_CORE_BULK_TECHNICAL_03]` phục vụ giám sát DataOps.

### Kịch bản B2: Xác minh Stable Token ngăn chặn WebSocket Churn
1. Mở tab Network trong Developer Tools, lọc theo luồng WS (WebSocket).
2. Thực hiện đổi thứ tự ưu tiên hoặc thay đổi vị trí sắp xếp của các mã chứng khoán trong Watchlist.
3. **Kết quả mong muốn:** Không có tín hiệu re-connect hoặc ngắt kết nối WebSocket đột ngột xảy ra. Kết nối ổn định 100%.

### Kịch bản B3: Xác minh tương tác chéo Selected Session (Pha A & B)
1. Bấm vào một cột nến biến động dòng tiền lớn của LPB trên FactsFirst KLine Chart ở dưới cùng.
2. **Kết quả mong muốn:** AI Advisor Panel ở lane phải tự động cập nhật phân tích về LPB tại phiên giao dịch được chọn. Alert lane lọc các chỉ báo dòng tiền cá mập xảy ra trong phiên đó.
