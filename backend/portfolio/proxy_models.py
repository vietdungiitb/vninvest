from .models import SecuritiesGroup, SecuritiesItem, StockProfile




class SecuritiesGroupProxy(SecuritiesGroup):
    class Meta:
        proxy = True
        verbose_name = 'Nhóm chứng khoán'
        verbose_name_plural = 'Nhóm chứng khoán'
        app_label = 'Quản lý Danh mục Chứng Khoán'

class SecuritiesItemProxy(SecuritiesItem):
    class Meta:
        proxy = True
        verbose_name = 'Mã chứng khoán thuộc nhóm'
        verbose_name_plural = 'Mã chứng khoán thuộc nhóm'
        app_label = 'Quản lý Danh mục Chứng Khoán'

class StockProfileProxy(StockProfile):
    class Meta:
        proxy = True
        verbose_name = 'Hồ sơ mã chứng khoán'
        verbose_name_plural = 'Hồ sơ mã chứng khoán'
        app_label = 'Quản lý Danh mục Chứng Khoán'
