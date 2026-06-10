# Lộ trình Phát hành & Dự phòng: Watchlist SaaS-Native Core
## Rollout, Rollback & Decommissioning Plan

Tài liệu này hướng dẫn chi tiết các bước phát hành tính năng lên môi trường sản xuất theo lộ trình an toàn, cơ chế dự phòng rollback khẩn cấp và các tệp tin legacy cần dọn dẹp sau khi hoàn tất.

---

## 1. Lộ trình Phát hành ba Giai đoạn (Three-Phase Rollout Plan)

Quá trình phát hành tuân thủ quy trình kiểm soát rủi ro nghiêm ngặt của dự án, chia thành 3 giai đoạn độc lập:

```
[Giai đoạn 1: Shadow Run]  ──>  [Giai đoạn 2: Canary Gated (10%)]  ──>  [Giai đoạn 3: 100% Cutover]
  - Chạy ngầm Staging            - Bật cờ "watchlist_saas_native"       - Bật toàn bộ tenants
  - Ghi logs đối đối             - Đánh giá khung hình (>=58 FPS)       - Xóa legacy files
```

### 1.1 Giai đoạn 1: Shadow Run (Chạy thử nghiệm ngầm)
* **Thời gian dự kiến**: 3 ngày (trên môi trường Staging).
* **Hoạt động**:
  1. Triển khai code backend native và giao diện frontend mới ngầm.
  2. Bảng giá watchlist trên trình duyệt của người dùng nội bộ (Internal Users) tự động thực hiện gọi song song cả hai nguồn dữ liệu để ghi nhận logs đối soát (Parity checking).
  3. Đội ngũ kỹ thuật giám sát sát sao logs so khớp, đảm bảo không xảy ra bất kỳ sai lệch dữ liệu hay tăng đột biến CPU nào.

### 1.2 Giai đoạn 2: Canary Gated (Bàn giao phân khúc - 10% Users)
* **Thời gian dự kiến**: 48 giờ liên tiếp (trên môi trường Production).
* **Hoạt động**:
  1. Kích hoạt cờ năng lực tenant (Feature Flag) `"watchlist_saas_native": true` cho phân khúc 10% tenants (Canary).
  2. Hệ thống tự động định tuyến các yêu cầu `/watchlist` của nhóm này sang trang nghiệp vụ native mới (`"core-watchlist"`).
  3. Giám sát các chỉ số hiệu năng: Tốc độ phản hồi UI duy trì $\ge 58$ FPS, trễ xử lý dữ liệu dưới 10ms.

### 1.3 Giai đoạn 3: 100% Cutover (Chuyển đổi hoàn toàn)
* **Thời gian dự kiến**: Hoàn tất ngay sau khi Giai đoạn 2 đạt các tiêu chí PASS.
* **Hoạt động**:
  1. Bật cờ capability cho 100% người dùng trên toàn bộ tenants.
  2. Toàn bộ hệ thống chính thức sử dụng trang native mới.
  3. Bắt đầu giai đoạn dọn dẹp và decommission các mã nguồn legacy cũ.

---

## 2. Kịch bản Dự phòng & Hoàn trả Trạng thái (Rollback & Recovery Playbook)

Trong trường hợp phát hiện sự cố nghiêm trọng ảnh hưởng tới tính liên tục của hệ thống, Ops phải lập tức kích hoạt kịch bản rollback:

1. **Bước 1: Tắt cờ Năng lực (Feature Flag Reset)**
   `CoreTenant.features` là **JSONField lưu dạng list** (không có column `surfaces`). Tắt cờ qua Django shell hoặc Django Admin:
   ```python
   # Django shell: python manage.py shell
   from identity_access.models import CoreTenant
   for t in CoreTenant.objects.all():
       if 'watchlist_saas_native' in t.features:
           t.features = [f for f in t.features if f != 'watchlist_saas_native']
           t.save(update_fields=['features'])
   ```
   Hoặc nếu môi trường Django Admin khả dụng: truy cập `/admin/identity_access/coretenant/`, lọc tenant bị ảnh hưởng, xóa `"watchlist_saas_native"` khỏi field `features`.

   *Kết quả*: Hệ thống tự động định tuyến toàn bộ người dùng trở lại trang shell chẩn đoán và giao diện legacy cũ để cô lập lỗi.
2. **Bước 2: Xử lý nghẽn CPU do HTTP Fallback (nếu có)**
   Nếu hệ thống bị nghẽn do lượng lớn client chuyển sang short-polling, tạm thời nâng thời gian polling từ 30 giây lên 60 giây qua cấu hình biến môi trường của server.
3. **Bước 3: Điều tra Nguyên nhân & Khắc phục**
   Tru xuất logs thông qua các mã Request-ID để xác định nguyên nhân rò rỉ bộ nhớ hoặc xung đột cơ sở dữ liệu.

---

## 3. Danh mục Dọn dẹp Mã nguồn Cũ (Decommissioning Checklist)

Sau khi hệ thống native mới vận hành ổn định 72 giờ trên môi trường sản xuất mà không gặp sự cố, đội ngũ phát triển tiến hành dọn dẹp triệt để các file legacy cũ để giảm nợ kỹ thuật:

* [ ] **Dọn dẹp Backend Legacy Shims**:
  - Tệp tin cần sửa đổi: `packages/core/backend/src/market_data/legacy_views.py`.
  - Tác vụ: Gỡ bỏ hoàn toàn `StockManagementGroupsView`, `StockManagementSeedView`, `StockManagementSyncView` và `TrackedSymbolsView` cũ. Sau đó kiểm tra và gỡ `SecuritiesGroupListCreateView`, `TrackedSymbolListCreateView` khỏi `user_workspace/legacy_views.py`.
* [ ] **Gỡ bỏ Route Compatibility**:
  - Tệp tin cần sửa đổi: `packages/core/backend/src/market_data/` URL config (không phải `user_workspace/urls.py`).
  - Tác vụ: Gỡ bỏ các đường dẫn mapping shim như `/stock-management/groups/` và `/stock-management/tracked-symbols/` tại `market_data/` URL config. Đồng thời dọn sạch các route trong `user_workspace/urls.py` nếu còn tham chiếu tới class đã xóa.
* [ ] **Xóa bỏ Giao diện Legacy**:
  - Tệp tin cần xóa bỏ: `frontend/src/pages/Watchlist.jsx` cũ tại thư mục gốc.
  - Tác vụ: Thực hiện lệnh xóa file vĩnh viễn khỏi Git tree.
