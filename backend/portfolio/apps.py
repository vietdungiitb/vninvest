from django.apps import AppConfig


class PortfolioConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'portfolio'
    verbose_name = 'Quản lý Danh mục Đầu tư'

    def ready(self):
        from .vnstock_compat import patch_vnstock_finance_init, disable_vnstock_upgrade_notice

        patch_vnstock_finance_init()
        disable_vnstock_upgrade_notice()
