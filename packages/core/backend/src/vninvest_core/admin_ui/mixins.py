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

from django.db import models

from .labels import MODEL_LABELS  # noqa: F401  (re-export cho tiện import)

__all__ = ["VNAdminMixin", "VNReadOnlyMixin"]

#: Thứ tự ưu tiên khi tự suy `date_hierarchy`. Đặt tên phổ biến trước vì chúng
#: có mặc ở đa số model vận hành; danh sách này là **thứ tự đã cố ý**, không
#: phải "thứ nào tìm thấy trước". Thêm tên mới chỉ khi thực sự cần.
_TIME_FIELD_PRIORITY = (
    "created_at",
    "updated_at",
    "occurred_at",
    "session_date",
    "trade_date",
    "as_of_date",
    "triggered_at",
    "run_at",
    "delivered_at",
    "timestamp",
    "date",
)


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

    #: Đặt `True` cho bảng **không có ý nghĩa lọc theo thời gian** (bảng ánh
    #: xạ thuần, không có cột thời gian). Hiện chỉ `CachedSymbolGroupMember`.
    #: Đây là ngoại lệ **có tên**, không phải lỗi bị bỏ qua — gate
    #: `check_admin_ux.py` và test `test_S3_AC2` đều tôn trọng cờ này.
    vn_no_time_filter = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Tự suy `date_hierarchy` nếu admin chưa đặt. Quy tắc sản phẩm: mọi
        # bảng vận hành phải lọc được theo thời gian, nếu không nhân viên vận
        # hành không tìm được bản ghi của hôm. Viết tay cho 114 admin thì chắc
        # chắn sót — nên đặt mặc định ở đây, admin vẫn ghi đè tự do.
        if self.date_hierarchy or self.vn_no_time_filter:
            return
        field_names = {f.name for f in self.model._meta.fields}
        for candidate in _TIME_FIELD_PRIORITY:
            if candidate not in field_names:
                continue
            field = self.model._meta.get_field(candidate)
            # `date_hierarchy` chỉ nhận DateField/DateTimeField — bỏ qua tên
            # trùng nhưng sai kiểu (ví dụ `date` là CharField ở model khác).
            if isinstance(field, (models.DateField, models.DateTimeField)):
                self.date_hierarchy = candidate
            return


class VNReadOnlyMixin(VNAdminMixin):
    """Chỉ đọc — vẫn xem được nhưng không thêm/sửa/xoá được.

    Dùng cho bảng nhật ký và bảng tổng hợp do hệ thống ghi. Trước đây mỗi app
    tự viết lại 3 hàm `has_*_permission` trả `False` — 6 bảng, 6 bản sao chép
    giống hệt. Ở đây gom một chỗ.

    ⚠ Đây là hành vi **bảo mật**. Thêm model mới thì phải **cố ý** kế thừa mixin
    này; không kế thừa thì model vẫn sửa được như mọi model khác.

    Kế thừa `VNAdminMixin` (từ wave 16) vì bảng chỉ đọc vẫn là bảng vận hành:
    nó cũng cần `empty_value_display`, `save_on_top`, `date_hierarchy`.
    Trước đó `class XAdmin(VNReadOnlyMixin, admin.ModelAdmin)` **không** có các
    mặc định đó ⇒ các bảng nhật ký hiển thị lệch với phần còn lại của admin.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
