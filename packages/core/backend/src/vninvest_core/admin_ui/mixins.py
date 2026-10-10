"""Mixin cho `ModelAdmin` — đặt mặc định ở mức sản phẩm thương mại.

Vì sao cần
----------
Trước khi có `admin_ui`, **34** `ModelAdmin` đều dùng mặc định Django: 100 bản
ghi/trang, không có nút lưu ở đầu trang, bộ lọc đếm chậm trên bảng lớn, trường
rỗng hiện trống trắng. Với bảng vận hành như `RequestTrace` hay
`AdImpressionLog` (mỗi ngày có thể hàng triệu bản ghi) thì mặc định đó là
vấn đề hiệu năng, không chỉ thẩm mỹ.

Nguyên tắc
----------
Mixin **chỉ thêm hành vi mặc định**, không ghi đè thứ mà app đã khai báo.
`ModelAdmin` đọc thuộc tính qua `getattr(self, name)`; mixin đặt giá trị ở
**đầu danh sách MRO** nên class con vẫn ghi đè được bằng cách khai báo thuộc
tính trùng tên.
"""

from __future__ import annotations

from .labels import MODEL_LABELS  # noqa: F401  (re-export cho tiện import)

__all__ = ["VNAdminMixin", "VNReadOnlyMixin"]


class VNAdminMixin:
    """Mặc định hiển thị dùng chung cho mọi `ModelAdmin` của VNInvest.

    Áp dụng bằng cách khai báo trước `admin.ModelAdmin` trong MRO::

        @admin.register(CoreTenant)
        class CoreTenantAdmin(VNAdminMixin, admin.ModelAdmin):
            ...

    Mọi thuộc tính bên dưới đều là **mặc định** — class con ghi đè tự do.

    ⚠ Mixin này **không** đụng tới `_meta.verbose_name`. Việc đổi nhãn model
    nằm ở `branding.apply_model_labels()`, gọi một lần từ
    `vninvest_core/admin.py` — một nơi, một mục đích, dễ kiểm soát hơn là ghi
    trạng thái toàn cục trong `__init__` của từng ModelAdmin.
    """

    #: 100 bản ghi/trang mặc định của Django khiến trang 5000 bản ghi phải
    #: cuộn 50 trang. 50 là mức người vận hành thực tế đọc hết 1 màn hình.
    list_per_page = 50

    #: Nút "Lưu" ở đầu trang: form thay/sửa dài (SystemMailConfig có 5 fieldset)
    #: mà không có nút ở trên ⇒ phải cuộn xuống đáy mới lưu được.
    save_on_top = True

    #: Django mặc định chạy `SELECT COUNT(*)` toàn bảng khi lọc. Trên bảng nhật
    #: ký vận hành, số đếm ấy tốn hơn cả truy vấn danh sách.
    show_full_result_count = False

    #: Trường rỗng hiện gạch dài thay vì khoảng trắng — đọc được "không có"
    #: khác với "bị cắt ngang".
    empty_value_display = "—"


class VNReadOnlyMixin:
    """Chỉ đọc — vẫn xem được nhưng không thêm/sửa/xoá được.

    Dùng cho bảng nhật ký và bảng tổng hợp do hệ thống ghi. Trước đây mỗi app
    tự viết lại 3 hàm `has_*_permission` trả `False` — 6 bảng, 6 bản sao chép
    giống hệt. Ở đây gom một chỗ.

    ⚠ Đây là hành vi **bảo mật**. Thêm model mới thì phải **cố ý** kế thừa mixin
    này; không kế thừa thì model vẫn sửa được như mọi model khác.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
