from django.apps import AppConfig


class PortfolioConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'portfolio'
    verbose_name = 'Quản lý Danh mục Đầu tư'

    def ready(self):
        from .vnstock_compat import patch_vnstock_finance_init, disable_vnstock_upgrade_notice
        from .opencore_signals import create_dpi_license_for_new_user  # Register signals
        from .signals import invalidate_runtime_vnstock_cache_on_save  # Register signals

        patch_vnstock_finance_init()
        disable_vnstock_upgrade_notice()

        # Khởi tạo các giá trị SystemSetting mặc định (chỉ insert nếu chưa có)
        try:
            from .system_settings import ensure_defaults
            ensure_defaults()
        except Exception:
            # Bỏ qua khi DB chưa migrate (fresh install, testing, v.v.)
            pass
