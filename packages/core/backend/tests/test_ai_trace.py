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
        """Hai hash phải là SHA-256 **thật** (64 ký tự hex).

        Bản đầu của test này có câu `sha256_hex(hash)` — vô nghĩa và **không bao
        giờ** đúng với hash khác rỗng. Cách kiểm đúng: hash lại một chuỗi đã biết
        và so (xem `test_response_hash_matches_actual_response` cho phía response).
        """
        from advisory.models import AITrace
        from advisory.trace import sha256_hex

        self.run_orchestrator(FakeClient())
        traces = list(AITrace.objects.all())
        self.assertEqual(len(traces), 4)
        for tr in traces:
            self.assertEqual(len(tr.prompt_hash), 64, tr.step)
            self.assertEqual(len(tr.response_hash), 64, tr.step)
            int(tr.prompt_hash, 16)  # hex hợp lệ, raise nếu sai
            int(tr.response_hash, 16)

        canary = 'canary-3.8'
        self.assertEqual(
            sha256_hex(canary),
            hashlib.sha256(canary.encode('utf-8')).hexdigest())
        self.assertEqual(sha256_hex(''), '')

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


class SyncOnlyOperationRegressionTest(AITraceTestBase):
    """Chặn regression cho P0 tiền có của R2.6 — lỗi này **không do R3.1 gây ra**.

    `_resolve_routing` đọc `AIDeployment.objects.all()` (DB). Gọi nó bên trong
    event loop ⇒ Django ném `SynchronousOnlyOperation`. Vì `run()` bọc
    `asyncio.run(run_async(...))` nên **mọi** lần sinh advisory từ R2.6 đều sập ở
    đó — mà 340 test của M2 vẫn xanh vì không test nào chạy `run_async` thật.

    Đã tái hiện trên `dev` đã merge (`209e4c46d`) bằng probe độc lập trước khi sửa.
    """

    def test_real_run_path_does_not_raise_sync_only_operation(self):
        """Đường thật (`run()` → `asyncio.run(run_async)`) phải chạy được.

        AC1 chỉ assert **đếm trace**, nên lỗi này sẽ hiện ra dưới dạng "0 != 4"
        và che mất nguyên nhân. Test này assert đúng tên exception đã bị xoá.
        """
        from django.core.exceptions import SynchronousOnlyOperation

        from advisory.orchestrator import AdvisoryOrchestrator

        with patch('advisory.orchestrator.get_ai_client', return_value=FakeClient()), \
             patch('advisory.orchestrator.build_ohlcv_lookback_context', return_value=''), \
             patch('advisory.orchestrator.build_cvd_lookback_context', return_value=''):
            try:
                AdvisoryOrchestrator.run(self.context, 'VIC')
            except SynchronousOnlyOperation as exc:
                self.fail(
                    'P0 R2.6 con song: _resolve_routing goi ORM trong event loop '
                    f'({exc}) — moi lan sinh advisory deu sập.')

    def test_run_passes_routing_from_sync_land(self):
        """`run()` phải giải routing TRƯỚC khi vào event loop."""
        import inspect

        from advisory.orchestrator import AdvisoryOrchestrator

        run_src = inspect.getsource(AdvisoryOrchestrator.run)
        self.assertIn(
            '_resolve_routing', run_src,
            'run() phai goi _resolve_routing o vung sync truoc asyncio.run')
        async_run_src = inspect.getsource(AdvisoryOrchestrator.run_async)
        # Trong run_async, `_resolve_routing` chỉ được nằm sau `sync_to_async`.
        self.assertNotIn(
            'routing = _resolve_routing(provider)', async_run_src,
            'run_async van goi _resolve_routing truc tiep => SynchronousOnlyOperation')
        self.assertIn('sync_to_async', async_run_src)


class NameErrorRegressionTest(TestCase):
    """Chặn regression P0 #2 tiền có của R2 (đưa vào bởi `7caf14059` R2.2).

    `run_async` **định nghĩa** `sentiment_user_prompt` nhưng lại **dùng**
    `sent_user_prompt` ⇒ `NameError` ngay khi tạo task sentiment. Vì
    `asyncio.gather` nhận coroutine nên lỗi nổ ra **khi gather**, tức mọi lần sinh
    advisory đều hỏng. Cả hai P0 này đều **không bị 340 test của M2 bắt** vì không
    test nào chạy `run_async` thật với DB thật.

    Đã xác nhận trên `dev` đã merge `209e4c46d`: định nghĩa ở dòng 560, dùng sai ở 579.
    """

    def test_sentiment_subagent_uses_the_defined_variable_name(self):
        import inspect

        from advisory.orchestrator import AdvisoryOrchestrator

        src = inspect.getsource(AdvisoryOrchestrator.run_async)
        self.assertNotIn(
            'sent_user_prompt', src,
            'run_async dung bien `sent_user_prompt` trong khi khai bao '
            '`sentiment_user_prompt` => NameError khi goi sub-agent sentiment')

    def test_all_three_subagent_prompt_variables_are_defined_before_use(self):
        import inspect

        from advisory.orchestrator import AdvisoryOrchestrator

        src = inspect.getsource(AdvisoryOrchestrator.run_async)
        for var in ('tech_user_prompt', 'flow_user_prompt', 'sentiment_user_prompt'):
            self.assertIn(
                f'{var} = f', src, f'thai bien {var} chua duoc gan')
        # Mọi tên biến dùng trong lời gọi `call_agent_async` phải được gán trước đó.
        call_pos = src.find('tech_task = call_agent_async(')
        self.assertGreater(call_pos, 0)
        before = src[:call_pos]
        for var in ('tech_user_prompt', 'flow_user_prompt', 'sentiment_user_prompt'):
            self.assertLess(
                before.find(f'{var} = f'), call_pos,
                f'{var} chua gan truoc khi goi sub-agent')


class TraceNeverBreaksAdvisoryTest(AITraceTestBase):
    """Trace lỗi KHÔNG được làm hỏng advisory (non-blocking)."""

    def test_write_failure_does_not_propagate(self):
        """Trace hỏng KHÔNG được làm hỏng transaction chứa advisory.

        Bản đầu chỉ assert "không raise" — nhưng trên Postgres, nuốt lỗi insert mà
        không savepoint sẽ **abort cả transaction**, nên advisory ghi sau đó và cả
        `commit` vẫn chết với `current transaction is aborted`.

        Dùng vi phạm UNIQUE `(trace_id, step)` vì đó là lỗi **bị bắt ngay**
        (UNIQUE không deferrable). `symbol=None` không dùng được: helper chuẩn
        hoá thành `''`. FK thì **deferred** nên `advisory_id` sai mới lộ lúc
        commit, không chứng minh được cơ chế savepoint.
        """
        from advisory.models import AdvisoryRecord
        from advisory.trace import record_step_trace

        ctx = {
            'trace_id': str(uuid.uuid4()),
            'advisory_id': self.record.advisory_id,
            'user_id': self.user.id,
            'symbol': 'VIC',
            'session_date': self.record.session_date,
        }
        first = record_step_trace(
            ctx, 'technical', provider='openai', model='m',
            prompt='p', response='r', tokens_in=1, tokens_out=1,
            latency_ms=5, status='ok', error_code='',
        )
        self.assertIsNotNone(first)

        # Ghi lại đúng (trace_id, step) ⇒ UNIQUE vi phạm ngay.
        self.assertIsNone(record_step_trace(
            ctx, 'technical', provider='openai', model='m',
            prompt='p', response='r', tokens_in=1, tokens_out=1,
            latency_ms=5, status='ok', error_code='',
        ))

        # Transaction vẫn sống: ghi advisory thật ngay sau lần ghi trace hỏng.
        rec = AdvisoryRecord.objects.create(
            symbol='VIC', session_date=self.record.session_date,
            user=self.user, ai_model='m',
        )
        self.assertIsNotNone(rec.pk)
        self.assertEqual(AdvisoryRecord.objects.filter(pk=rec.pk).count(), 1)

    def test_missing_advisory_id_does_not_raise_at_call_time(self):
        """`advisory_id` sai ⇒ FK deferred ⇒ lỗi lộ lúc commit, không lúc gọi.

        Ghi lại hành vi thật thay vì giả định: đây là lý do `trace_ctx` luôn dựng
        từ một `AdvisoryRecord` thật (`advisory.tasks`), không nhận UUID từ ngoài.
        """
        from advisory.trace import record_step_trace

        ctx = {
            'trace_id': str(uuid.uuid4()),
            'advisory_id': uuid.uuid4(),
            'user_id': self.user.id,
            'symbol': 'VIC',
            'session_date': self.record.session_date,
        }
        record_step_trace(
            ctx, 'technical', provider='openai', model='m',
            prompt='p', response='r', latency_ms=5, status='ok', error_code='',
        )
        # Không khẳng định có row hay không — chỉ khẳng định KHÔNG ném lỗi ra ngoài.

    def test_no_trace_ctx_means_no_trace_not_crash(self):
        from advisory.models import AITrace
        from advisory.orchestrator import AdvisoryOrchestrator

        with patch('advisory.orchestrator.get_ai_client', return_value=FakeClient()), \
             patch('advisory.orchestrator.build_ohlcv_lookback_context', return_value=''), \
             patch('advisory.orchestrator.build_cvd_lookback_context', return_value=''):
            AdvisoryOrchestrator.run(self.context, 'VIC')
        self.assertEqual(AITrace.objects.count(), 0)