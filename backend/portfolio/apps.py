from django.apps import AppConfig
import logging
import threading
import time


class PortfolioConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'portfolio'
    verbose_name = 'Quản lý Danh mục Đầu tư'

    def ready(self):
        from .vnstock_compat import patch_vnstock_finance_init, disable_vnstock_upgrade_notice
        from .opencore_signals import create_dpi_license_for_new_user  # Register signals
        from .signals import invalidate_runtime_vnstock_cache_on_save, invalidate_holdings_cache_on_transaction  # Register signals

        patch_vnstock_finance_init()
        disable_vnstock_upgrade_notice()

        # Khởi tạo các giá trị SystemSetting mặc định (chỉ insert nếu chưa có)
        try:
            from .system_settings import ensure_defaults
            ensure_defaults()
        except Exception:
            # Bỏ qua khi DB chưa migrate (fresh install, testing, v.v.)
            pass

        # Initialize realtime cache on startup.
        # Retry in background because AppConfig.ready can run before DB is available.
        try:
            from .warmup_cache import run_warmup_cache, PREFETCH_META_KEY
            from django.core.cache import cache

            def _warmup_retry_loop():
                for attempt in range(1, 7):
                    try:
                        run_warmup_cache()
                        if cache.get(PREFETCH_META_KEY):
                            return
                    except Exception as exc:  # pragma: no cover - safety net
                        logging.warning('Cache warmup retry %s failed: %s', attempt, exc)
                    time.sleep(10)

            thread = threading.Thread(target=_warmup_retry_loop, name='prefetch-warmup-retry', daemon=True)
            thread.start()
        except Exception as exc:
            logging.warning('Cache warmup on startup failed: %s', exc)
