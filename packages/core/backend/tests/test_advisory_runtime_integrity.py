"""N2 — bằng chứng 3 lỗi thật tìm được khi chạy pipeline thật.

Ba lỗi dưới đây đều KHÔNG lộ ra ở test cũ, vì test cũ chỉ mock trả về
kết quả thành công:

1. `matched_value` + `whale_intensity` được serializer đọc từ
   `structured_output` nhưng không module nào trong app `advisory` ghi 2 key
   đó. Metric hiển thị `—` vĩnh viễn, không có lỗi nào để debug.
   Sửa: tính deterministic từ `SymbolSnapshot` + `SessionFacts` trong
   `AdvisoryOrchestrator.run()`.

2. `AdvisorySession` KHÔNG có FK tới `AdvisoryRecord`; nó định danh bằng
   `(user, symbol, session_date)`. Khi record MỚI fail (provider 429),
   session của lần chạy thành công trước vẫn được trả về -> UI hiển thị
   khuyến nghị mua/bán của phiên cũ ngay sau khi người dùng bấm "làm mới".
   Với sản phẩm tài chính thì rủi ro nặng hơn lỗi hiển thị.

3. 429 gộp chung hai nguyên nhân: quá tốc độ tạm thời và HẾT HẠN MỨC tài
   khoản. Thông điệp "thử lại sau ít phút" khiến người dùng retry vô hạn
   trong khi nguyên nhân thật là phải nạp tiền / đổi gói.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

from django.test import TestCase

from advisory.orchestrator import (
    QUOTA_EXHAUSTED_CODE,
    QUOTA_EXHAUSTED_MESSAGE,
    _is_quota_exhausted,
    _retry_delay_seconds,
)
from advisory.serializers import AdvisoryRecordSerializer
from advisory.signal_norm import SIGNAL_HOLD


class N2QuotaExhaustionTest(TestCase):
    """Lỗi 3 — phân biệt hết hạn mức với giới hạn tạm thời."""

    def test_detects_quota_exhausted_markers(self):
        self.assertTrue(_is_quota_exhausted(
            "You exceeded your current quota, please check your plan and billing details. "
            "For more information, visit https://ai.google.dev/gemini-api/quotas"
        ))
        self.assertTrue(_is_quota_exhausted("RESOURCE_EXHAUSTED: Quota exceeded"))
        self.assertTrue(_is_quota_exhausted("out of quota for this project"))

    def test_transient_rate_limit_is_not_quota_exhausted(self):
        # 429 do qua toc do tam thoi: van phai retry.
        self.assertFalse(_is_quota_exhausted(""))
        self.assertFalse(_is_quota_exhausted(None))
        self.assertFalse(_is_quota_exhausted("Resource has been exhausted (e.g. check quota)."))
        self.assertFalse(_is_quota_exhausted("Too many requests, slow down"))

    def test_retry_after_header_wins_over_exponential_backoff(self):
        response = MagicMock()
        response.headers = {"Retry-After": "7"}
        self.assertEqual(_retry_delay_seconds(response, 1), 7.0)

    def test_retry_after_absent_falls_back_to_backoff(self):
        response = MagicMock()
        response.headers = {}
        # attempt 1 -> 2.0s, attempt 2 -> 4.0s
        self.assertEqual(_retry_delay_seconds(response, 1), 2.0)
        self.assertEqual(_retry_delay_seconds(response, 2), 4.0)

    def test_retry_after_malformed_or_huge_is_clamped(self):
        response = MagicMock()
        response.headers = {"Retry-After": "abc"}
        self.assertEqual(_retry_delay_seconds(response, 1), 2.0)
        response.headers = {"Retry-After": "99999"}
        self.assertEqual(_retry_delay_seconds(response, 1), 120.0)

    def test_no_retry_when_response_is_none(self):
        self.assertEqual(_retry_delay_seconds(None, 1), 2.0)

    def test_quota_code_and_message_are_actionable(self):
        # Thong diep phai bao ham dong, khong phai "thu lai sau it phut".
        self.assertEqual(QUOTA_EXHAUSTED_CODE, "provider_quota_exceeded")
        self.assertIn("hạn mức", QUOTA_EXHAUSTED_MESSAGE)
        self.assertIn("thanh toán", QUOTA_EXHAUSTED_MESSAGE)
        self.assertNotIn("thử lại sau", QUOTA_EXHAUSTED_MESSAGE.lower())


class N2DeterministicMetricsTest(TestCase):
    """Lỗi 1 — 2 metric chết vì không có nguồn ghi."""

    def _orchestrate(self, symbol="VIC"):
        """Chạy `AdvisoryOrchestrator.run()` thật, chỉ chặn bước gọi LLM.

        `run_async` là coroutine nên `asyncio.run` chạy thật, không mock. Nhờ vậy
        test thực sự kiểm tra `db_data` mà orchestrator dựng ra.
        """
        from advisory.orchestrator import AdvisoryOrchestrator

        captured = {}

        async def fake_run_async(effective_context, sym, db_data):
            captured.update(db_data)
            return {"advisory_text": "x", "ai_model": "gemini-3.8-flash"}

        context = {
            "ai_provider": "gemini",
            "ai_model": "gemini-3.8-flash",
            "api_key": "real-key-not-mock",
            "prompt_config": {"version": 2, "sources": {
                "technical": {"enabled": False, "lookback": 20},
                "whale": {"enabled": False, "lookback": 20},
                "dark_flow": {"enabled": False, "lookback": 20},
            }},
        }
        with patch("advisory.orchestrator.build_ohlcv_lookback_context", return_value=""), \
             patch("advisory.orchestrator.build_cvd_lookback_context", return_value=""), \
             patch.object(AdvisoryOrchestrator, "run_async", staticmethod(fake_run_async)):
            result = AdvisoryOrchestrator.run(context, symbol)
        return captured, result

    def _run(self):
        captured, _result = self._orchestrate()
        return captured

    def _seed_db(self):
        from market_serving.models import SessionFacts, SymbolSnapshot

        SymbolSnapshot.objects.create(
            symbol="VIC", session_date="2026-09-25", price=232000,
            reference_price=231000, high=233000, low=230000,
            volume=3_200_000, stale=False,
        )
        SessionFacts.objects.create(
            symbol="VIC", session_date="2026-09-25", institutional_strength=0.62,
            buy_strength=0.71, cvd_normalized=0.35, whale_net_flow=1_850_000_000,
            total_buy_volume=2_100_000, total_sell_volume=1_100_000,
            dark_flow_score=0.44, stale=False,
        )

    def test_metrics_are_derived_from_db_not_invented(self):
        self._seed_db()
        db_data = self._run()
        metrics = db_data["metrics"]
        # `matched_value` = gia tham chieu that, khong phai con so LLM bia.
        self.assertEqual(metrics["matched_value"], 231000.0)
        # `whale_intensity` = institutional_strength, dung tien le tai
        # portfolio_analytics_views.py:1957
        self.assertAlmostEqual(metrics["whale_intensity"], 0.62, places=4)
        self.assertEqual(metrics["total_buy_volume"], 2_100_000)
        self.assertEqual(metrics["total_sell_volume"], 1_100_000)
        self.assertAlmostEqual(metrics["dark_flow_score"], 0.44, places=4)

    def test_input_snapshot_records_exact_numbers_fed_to_model(self):
        self._seed_db()
        db_data = self._run()
        snap = db_data["input_snapshot"]
        self.assertEqual(snap["symbol"], "VIC")
        self.assertEqual(snap["price"], 232000.0)
        self.assertEqual(snap["session_date"], "2026-09-25")
        self.assertEqual(snap["whale_net_flow"], 1_850_000_000)
        self.assertTrue(snap["data_sources"]["has_snapshot"])
        self.assertTrue(snap["data_sources"]["has_session_facts"])
        self.assertFalse(snap["data_sources"]["snapshot_stale"])

    def test_stale_flag_propagates(self):
        self._seed_db()
        db_data = self._run()
        self.assertFalse(db_data["is_stale"])
        self.assertFalse(db_data["feature_attribution"]["is_stale"])

    def test_stale_db_row_is_flagged_not_hidden(self):
        from market_serving.models import SessionFacts, SymbolSnapshot

        self._seed_db()
        SessionFacts.objects.filter(symbol="VIC").update(stale=True)
        SymbolSnapshot.objects.filter(symbol="VIC").update(stale=True)
        db_data = self._run()
        self.assertTrue(db_data["is_stale"])
        self.assertTrue(db_data["feature_attribution"]["is_stale"])
        self.assertTrue(db_data["input_snapshot"]["data_sources"]["snapshot_stale"])
        self.assertTrue(db_data["input_snapshot"]["data_sources"]["session_facts_stale"])

    def test_missing_db_rows_yield_null_not_fake_zero(self):
        # Khong seed du lieu.
        captured, _result = self._orchestrate()
        metrics = captured["metrics"]
        # Khong co du lieu -> None. Khong bao gio zero teo (0 se bi hieu la
        # "gia tri bang 0", phai la "chua co du lieu").
        self.assertIsNone(metrics["whale_intensity"])
        self.assertIsNone(metrics["matched_value"])
        self.assertIsNone(captured["input_snapshot"]["session_date"])
        self.assertFalse(captured["input_snapshot"]["data_sources"]["has_snapshot"])


class N2StaleComponentLeakTest(TestCase):
    """Lỗi 2 — record fail KHÔNG được mượn component của phiên cũ."""

    def setUp(self):
        from django.contrib.auth.models import User
        from advisory.models import AdvisoryComponent, AdvisoryRecord, AdvisorySession
        from django.utils import timezone

        self.user = User.objects.create_user(username="n2leak", password="x")
        self.day = timezone.localdate()
        # 1 lan chay THANH CONG truoc do -> tao session + components
        self.old_record = AdvisoryRecord.objects.create(
            user=self.user, symbol="VIC", session_date=self.day,
            status="generated", ai_model="gemini-2.5-flash",
            structured_output={"signal": SIGNAL_HOLD, "summary": "Phien cu"},
        )
        self.session = AdvisorySession.objects.create(
            user=self.user, symbol="VIC", session_date=self.day,
        )
        AdvisoryComponent.objects.create(
            session=self.session, component_type="recommendation",
            content="KHUYEN NGHI CU: MUA VIC", order=4,
        )

    def _serializer_for(self, record):
        return AdvisoryRecordSerializer(record).data

    def test_failed_record_does_not_expose_previous_session_components(self):
        from advisory.models import AdvisoryRecord

        failed = AdvisoryRecord.objects.create(
            user=self.user, symbol="VIC", session_date=self.day,
            status="failed", ai_model="gemini-3.8-flash",
            error_message="Het han muc",
            structured_output={},
        )
        data = self._serializer_for(failed)
        self.assertEqual(data["signal"], "UNKNOWN")
        self.assertEqual(data["components"], [])
        # Session cu van ton tai trong DB - chi la KHONG duoc tra ra ngoai.
        self.assertTrue(self.session.components.exists())

    def test_generated_record_still_returns_components(self):
        data = self._serializer_for(self.old_record)
        self.assertEqual(len(data["components"]), 1)
        self.assertEqual(data["components"][0]["content"], "KHUYEN NGHI CU: MUA VIC")

    def test_own_structured_components_survive_for_failed_record(self):
        # structured_output thuoc ve chinh record -> van an toan, tra ve duoc.
        from advisory.models import AdvisoryRecord

        failed = AdvisoryRecord.objects.create(
            user=self.user, symbol="VIC", session_date=self.day,
            status="failed", ai_model="gemini-3.8-flash",
            structured_output={"components": [
                {"component_type": "summary", "content": "partial cua record nay"}
            ]},
        )
        data = self._serializer_for(failed)
        self.assertEqual(len(data["components"]), 1)
        self.assertEqual(data["components"][0]["content"], "partial cua record nay")
