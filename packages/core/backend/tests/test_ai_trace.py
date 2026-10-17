"""R3.1 — `AITrace`: 4 bước mỗi advisory (AC1-AC6, plan `:1043-1063`).

Nguyên tắc của file này: **đếm trace thật trong DB**, không assert trên giá trị trả về
của hàm. Orchestrator chạy thật (`run_async` qua `asyncio.run`), chỉ chặn đúng tầng
gọi mạng bằng client giả — nếu chỉ patch `run_async` thì 4 trace có thể do test tự chế
ra chứ không phải orchestrator ghi.

AC2 là quyết định PIPL: **không** lưu plaintext prompt/response.
"""
import hashlib
import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

User = get_user_model()

SYNTH_OK = json.dumps({
    'signal': 'BUY',
    'summary': 'Tong hop kien nghi',
    'recommendation': 'MUA',
    'target_price': 55000,
    'confidence_score': 0.72,
})


class FakeClient:
    """Client giả theo đúng hợp đồng `AiClient.complete_resilient()` (base.py:267).

    Phân biệt bước bằng `response_format`: orchestrator chỉ truyền `response_format='json'`
    cho SYNTHESIS (orchestrator.py:623), 3 sub-agent gọi không truyền.
    """

    provider = 'openai'

    def __init__(self, *, fail_subagent=False, bad_synthesis_json=False):
        self.fail_subagent = fail_subagent
        self.bad_synthesis_json = bad_synthesis_json
        self.calls = []

    async def complete_resilient(
        self, system, user, *, model, temperature, max_tokens,
        timeout=None, response_format=None, policy=None,
    ):
        from advisory.ai_clients.base import ProviderHTTPError

        is_synthesis = response_format == 'json'
        self.calls.append(('synthesis' if is_synthesis else 'sub', model))
        if is_synthesis:
            text = 'KHONG PHAI JSON' if self.bad_synthesis_json else SYNTH_OK
        elif self.fail_subagent:
            raise ProviderHTTPError(500, 'boom')
        else:
            text = f'phan tich {model} cho {user[:24]}'
        return {
            'text': text,
            'raw': {'usage': {
                'total_tokens': 300, 'prompt_tokens': 120, 'completion_tokens': 180,
            }},
            'usage': {'input': 120, 'output': 180},
            'finish_reason': 'stop',
        }

    async def probe(self):
        return {'ok': True, 'latency_ms': 1, 'error_code': '', 'detail': ''}


class AITraceTestBase(TestCase):
    def setUp(self):
        from advisory.models import AdvisoryRecord

        self.user = User.objects.create_user(
            username='r31-user', email='r31@example.com', password='testpass123',
        )
        self.record = AdvisoryRecord.objects.create(
            symbol='VIC',
            session_date=timezone.now().date(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.PENDING,
            ai_model='gpt-4o-mini',
        )
        self.context = {
            'ai_provider': 'openai',
            'ai_model': 'gpt-4o-mini',
            'api_key': 'k-test',
            'prompt_config': {'version': 2, 'sources': {
                'technical': {'enabled': True, 'lookback': 20},
                'whale': {'enabled': True, 'lookback': 20},
                'dark_flow': {'enabled': True, 'lookback': 20},
            }},
        }

    def run_orchestrator(self, client, expect_error=False, **trace_ctx_extra):
        """Chạy orchestrator thật, chỉ chặn tầng mạng + lookback (không cần DB bars).

        Mặc định **không** nuốt exception: AC1/2/3 phải FAIL kèm traceback gốc nếu
        orchestrator nổ, nếu không sẽ chỉ thấy "0 != 4" và mất nguyên nhân thật.
        Chỉ `expect_error=True` (AC4) mới bắt lỗi — đó là lỗi **được kỳ vọng**.
        """
        from advisory.orchestrator import AdvisoryOrchestrator

        trace_ctx = {
            'trace_id': str(uuid.uuid4()),
            'advisory_id': self.record.advisory_id,
            'user_id': self.user.id,
            'symbol': self.record.symbol,
            'session_date': self.record.session_date,
        }
        trace_ctx.update(trace_ctx_extra)
        with patch('advisory.orchestrator.get_ai_client', return_value=client), \
             patch('advisory.orchestrator.build_ohlcv_lookback_context', return_value=''), \
             patch('advisory.orchestrator.build_cvd_lookback_context', return_value=''):
            if expect_error:
                try:
                    return AdvisoryOrchestrator.run(
                        self.context, 'VIC', trace_ctx=trace_ctx)
                except Exception as exc:  # lỗi synthesis là **kết quả mong đợi**
                    return exc
            return AdvisoryOrchestrator.run(
                self.context, 'VIC', trace_ctx=trace_ctx)


class AC1FourTracesTest(AITraceTestBase):
    """AC1: 1 refresh ⇒ **đúng 4** trace (3 sub + 1 synthesis)."""

    def test_exactly_four_traces_per_refresh(self):
        from advisory.models import AITrace

        self.run_orchestrator(FakeClient())
        self.assertEqual(AITrace.objects.count(), 4)

    def test_four_steps_are_the_expected_set(self):
        from advisory.models import AITrace

        self.run_orchestrator(FakeClient())
        self.assertEqual(
            sorted(AITrace.objects.values_list('step', flat=True)),
            ['flow', 'sentiment', 'synthesis', 'technical'],
        )

    def test_one_refresh_twice_gives_eight_not_duplicates(self):
        from advisory.models import AITrace

        client = FakeClient()
        self.run_orchestrator(client)
        self.run_orchestrator(client)
        # 2 lần chạy trên CÙNG 1 advisory ⇒ 8 trace, không phải 4 (ghi trùng do retry).
        self.assertEqual(AITrace.objects.count(), 8)


class AC2NoPlaintextTest(AITraceTestBase):
    """AC2: hash SHA-256, **không** lưu plaintext (PIPL 13/2023)."""

    def test_hashes_are_sha256_of_prompt_and_response(self):
        from advisory.models import AITrace
        from advisory.trace import sha256_hex

        self.run_orchestrator(FakeClient())
        for tr in AITrace.objects.all():
            self.assertEqual(len(tr.prompt_hash), 64)
            self.assertEqual(len(tr.response_hash), 64)
            int(tr.prompt_hash, 16)  # hex hợp lệ
            int(tr.response_hash, 16)
        tech = AITrace.objects.get(step='technical')
        self.assertNotEqual(tech.prompt_hash, '')
        self.assertEqual(tech.prompt_hash, sha256_hex(tech.prompt_hash))

    def test_no_plaintext_prompt_or_response_anywhere(self):
        from advisory.models import AITrace

        client = FakeClient()
        self.run_orchestrator(client)
        blob = json.dumps({
            'fields': {
                f.name: str(getattr(tr, f.name))
                for tr in AITrace.objects.all()
                for f in tr._meta.fields
            },
        }, ensure_ascii=False)
        # Chuỗi trong prompt/response thật KHÔNG được xuất hiện ở bất kỳ field nào.
        self.assertNotIn('phan tich gpt-4o-mini', blob)
        self.assertNotIn('Tong hop kien nghi', blob)
        self.assertNotIn('Viet Nam', blob)  # marker trong user prompt của orchestrator

    def test_response_hash_matches_actual_response(self):
        from advisory.models import AITrace

        self.run_orchestrator(FakeClient())
        synth = AITrace.objects.get(step='synthesis')
        self.assertEqual(
            synth.response_hash,
            hashlib.sha256(SYNTH_OK.encode('utf-8')).hexdigest(),
        )


class AC3SameTraceIdTest(AITraceTestBase):
    """AC3: 4 bước dùng chung `trace_id`."""

    def test_all_four_steps_share_one_trace_id(self):
        from advisory.models import AITrace

        self.run_orchestrator(FakeClient())
        ids = set(AITrace.objects.values_list('trace_id', flat=True))
        self.assertEqual(len(ids), 1)

    def test_trace_id_is_the_one_passed_in_context(self):
        from advisory.models import AITrace

        my_id = str(uuid.uuid4())
        self.run_orchestrator(FakeClient(), trace_id=my_id)
        self.assertEqual(
            {str(t) for t in AITrace.objects.values_list('trace_id', flat=True)},
            {my_id},
        )


class AC4ErrorStillTracedTest(AITraceTestBase):
    """AC4: provider lỗi vẫn tạo trace `status='error'`."""

    def test_subagent_failure_is_traced_as_error(self):
        from advisory.models import AITrace

        self.run_orchestrator(FakeClient(fail_subagent=True))
        sub = AITrace.objects.filter(step__in=['technical', 'flow', 'sentiment'])
        self.assertEqual(sub.count(), 3)
        for tr in sub:
            self.assertEqual(tr.status, AITrace.Status.ERROR)
            self.assertNotEqual(tr.error_code, '')

    def test_synthesis_invalid_json_is_traced_as_error(self):
        from advisory.models import AITrace

        result = self.run_orchestrator(
            FakeClient(bad_synthesis_json=True), expect_error=True)
        self.assertIsNotNone(
            getattr(result, 'public_payload', None),
            f'orchestrator khong raise khi synthesis tra JSON hong: {result!r}',
        )
        synth = AITrace.objects.get(step='synthesis')
        self.assertEqual(synth.status, AITrace.Status.ERROR)
        self.assertNotEqual(synth.error_code, '')
        # 3 sub-agent vẫn OK ⇒ AC1 giữ được ngay cả khi synthesis hỏng.
        self.assertEqual(
            AITrace.objects.filter(status=AITrace.Status.OK).count(), 3)

    def test_clean_run_is_all_ok(self):
        from advisory.models import AITrace

        self.run_orchestrator(FakeClient())
        self.assertEqual(AITrace.objects.filter(status=AITrace.Status.OK).count(), 4)
        self.assertEqual(
            AITrace.objects.exclude(error_code='').count(), 0)


class AC5IndexesTest(TestCase):
    """AC5: index theo `(user, session_date)` + `(trace_id)`."""

    def test_indexes_declared_on_model(self):
        from advisory.models import AITrace

        pairs = {
            tuple(i.fields) for i in AITrace._meta.indexes
        }
        self.assertIn(('user', 'session_date'), pairs)
        self.assertIn(('trace_id',), pairs)

    def test_indexes_really_exist_in_database(self):
        """AC5 ở mức DB thật.

        KHÔNG assert theo **tên** index: Postgres cắt tên ở 63 ký tự nên
        `advisory_aitrace_user_id_session_date_...` thành `advisory_ai_user_id_e7df41_idx`
        — tên bị cắt mất `session_date`. Phải đọc **cột** trong `indexdef`.
        """
        from django.db import connection
        from advisory.models import AITrace

        with connection.cursor() as cur:
            cur.execute(
                "SELECT indexdef FROM pg_indexes WHERE tablename = %s",
                [AITrace._meta.db_table],
            )
            defs = [r[0] for r in cur.fetchall()]
        composite = [d for d in defs if '(user_id, session_date)' in d]
        self.assertTrue(
            composite,
            f'khong tim thay index (user_id, session_date) trong {defs}')
        self.assertTrue(
            any('trace_id' in d for d in defs),
            f'khong tim thay index theo trace_id trong {defs}')


class AC6RetentionTest(TestCase):
    """AC6: retention xoá trace > 90 ngày."""

    def _make(self, age_days, *, step='technical'):
        from advisory.models import AdvisoryRecord, AITrace

        user = User.objects.create_user(
            username=f'r31-ret-{age_days}-{uuid.uuid4().hex[:6]}',
            email=f'r31-{uuid.uuid4().hex[:6]}@example.com',
            password='testpass123',
        )
        rec = AdvisoryRecord.objects.create(
            symbol='VIC', session_date=timezone.now().date(), user=user,
            ai_model='m',
        )
        tr = AITrace.objects.create(
            trace_id=uuid.uuid4(), advisory=rec, user=user, symbol='VIC',
            session_date=rec.session_date, step=step, provider='openai',
            model='m', prompt_hash='a' * 64, response_hash='b' * 64,
        )
        AITrace.objects.filter(pk=tr.pk).update(
            created_at=timezone.now() - timedelta(days=age_days))
        return tr

    def test_purges_only_traces_older_than_90_days(self):
        from advisory.models import AITrace
        from advisory.trace import purge_traces_older_than

        # 89 ngày = **trong** ngưỡng (số nguyên). Biên 91 ngày thuộc nhóm xoá —
        # bản đầu của test này đặt 91 rồi lại kỳ vọng nó sống ⇒ tự mâu thuẫn.
        old = self._make(120)
        just_inside = self._make(89)
        fresh = self._make(10)

        deleted = purge_traces_older_than(days=90)

        self.assertEqual(deleted, 1)
        self.assertFalse(AITrace.objects.filter(pk=old.pk).exists())
        self.assertTrue(AITrace.objects.filter(pk=just_inside.pk).exists())
        self.assertTrue(AITrace.objects.filter(pk=fresh.pk).exists())

    def test_task_is_registered_as_shared_task(self):
        from advisory import tasks

        self.assertTrue(hasattr(tasks, 'purge_ai_traces'))
        self.assertEqual(
            tasks.purge_ai_traces.name, 'advisory.purge_ai_traces')
        self.assertEqual(tasks.purge_ai_traces(), 0)

    def test_beat_schedule_registers_retention(self):
        from django.conf import settings

        entry = settings.CELERY_BEAT_SCHEDULE.get('purge-ai-traces')
        self.assertIsNotNone(entry, 'chua dang ky beat cho retention')
        self.assertEqual(entry['task'], 'advisory.tasks.purge_ai_traces')
        self.assertIn('schedule', entry)


class TraceNeverBreaksAdvisoryTest(AITraceTestBase):
    """Trace lỗi KHÔNG được làm hỏng advisory (non-blocking)."""

    def test_write_failure_does_not_propagate(self):
        from advisory.trace import record_step_trace

        ctx = {
            'trace_id': str(uuid.uuid4()),
            'advisory_id': self.record.advisory_id,
            'user_id': self.user.id,
            'symbol': 'VIC',
            'session_date': self.record.session_date,
        }
        # advisory không tồn tại ⇒ FK fail ⇒ phải nuốt, không raise.
        bad_ctx = dict(ctx, advisory_id=uuid.uuid4())
        record_step_trace(
            bad_ctx, 'technical', provider='openai', model='m',
            prompt='p', response='r', tokens_in=1, tokens_out=1,
            latency_ms=5, status='ok', error_code='',
        )

    def test_no_trace_ctx_means_no_trace_not_crash(self):
        from advisory.models import AITrace
        from advisory.orchestrator import AdvisoryOrchestrator

        with patch('advisory.orchestrator.get_ai_client', return_value=FakeClient()), \
             patch('advisory.orchestrator.build_ohlcv_lookback_context', return_value=''), \
             patch('advisory.orchestrator.build_cvd_lookback_context', return_value=''):
            AdvisoryOrchestrator.run(self.context, 'VIC')
        self.assertEqual(AITrace.objects.count(), 0)