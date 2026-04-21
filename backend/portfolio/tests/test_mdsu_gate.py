import re
import os
from django.test import SimpleTestCase
from django.conf import settings

class MDSUGateTest(SimpleTestCase):
    """
    Gate Test: Ngăn chặn việc truy vấn trực tiếp DailyPrice.objects 
    trong các module đã được migrate sang MarketDataService.
    """

    MIGRATED_FILES = [
        'backend/portfolio/tasks_watchlist_indicators.py',
        'backend/portfolio/views_analytics_extended.py',
        'backend/portfolio/views_screener.py',
        'backend/portfolio/views_portfolio_watchlist.py',
        'backend/portfolio/views_ai_advisory_session.py',
        'backend/portfolio/views_dark_money_history.py',
        'backend/portfolio/views_stock_workspace_admin.py',
        'backend/portfolio/analytics.py',
        'backend/portfolio/ai_advisory_helpers.py',
        'backend/portfolio/ai_context.py',
        'backend/portfolio/tasks_signal_verification.py',
        'backend/portfolio/services.py',
        'backend/portfolio/services_backfill.py',
        'backend/portfolio/tasks_prefetch.py',
    ]

    def test_no_direct_dailyprice_query_in_migrated_files(self):
        """Kiểm tra không được dùng DailyPrice.objects (query methods) trong các file đã migrate."""
        # Pattern bắt DailyPrice.objects đi kèm với các method truy vấn phổ biến
        # Không bắt dòng comment (#)
        query_methods = r'(filter|get|count|annotate|order_by|first|last|aggregate|values|values_list|exists|distinct)'
        pattern = rf'DailyPrice\.objects\.{query_methods}'
        
        violations = []
        for fname in self.MIGRATED_FILES:
            file_path = os.path.join(settings.BASE_DIR, fname.replace('backend/', ''))
            if not os.path.exists(file_path):
                continue
                
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_no, line in enumerate(f, 1):
                    # Bỏ qua comment
                    if line.strip().startswith('#'):
                        continue
                    
                    if re.search(pattern, line):
                        violations.append(f"{fname}:{line_no} -> {line.strip()}")
            
        self.assertEqual(len(violations), 0, f"Phát hiện direct DailyPrice query tại:\n" + "\n".join(violations))
