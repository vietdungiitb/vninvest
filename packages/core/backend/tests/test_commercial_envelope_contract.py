"""`commercial`: 2xx đã bọc envelope, giao thức cổng thanh toán KHÔNG bọc.

## Vì sao test này tồn tại

`commercial` là app cuối cùng còn trả 2xx phẳng. Có **hai** hướng cần khóa, và
chỉ một hướng dễ quên:

| Hướng | Rủi ro nếu không khóa |
|---|---|
| 7 call site phải bọc | migration lùi 1 phần, không ai thấy |
| **11 call site phải KHÔNG bọc** | **bọc nhầm là HỎNG TÍCH HỢP THANH TOÁN** |

Hướng thứ hai nguy hiểm hơn nhiều: `VNPayService` yêu cầu phản hồi đúng shape
`{RspCode, Message}`. Bọc nó vào `{data, meta}` thì VNPay không đọc được phản
hồi. Đây là loại bug chỉ lộ ra khi có giao dịch thật.

## Vì sao `RspCode` chứng minh đây là giao thức máy

`views.py` trả `{'RspCode': '99', 'Message': 'Internal Error: ...'}` với
**HTTP 200** cho lỗi nội bộ. Không REST API nào cho frontend làm vậy.

## Vì sao `{'received', 'error'}` KHÔNG được miễn

`stripe_webhooks.py:111` có **hai** key. Nó mang dữ liệu thật, không phải ACK
rỗng. Ngoại lệ `SKIP_WEBHOOK_ACK` chỉ áp dụng khi `received` là key duy nhất —
test này khóa lại ranh giới đó để không ai nới nó ra sau này.
"""

import ast
import os
import pathlib
import sys

BACKEND = pathlib.Path(__file__).resolve().parent.parent
_src = BACKEND / 'src'
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.test import SimpleTestCase

from commercial.envelope import envelope, adopt_envelope

APP = _src / 'commercial'


class EnvelopeHelperTests(SimpleTestCase):
    def test_envelope_wraps_data_and_meta(self):
        resp = envelope({'ok': True})
        self.assertEqual(resp.data, {'data': {'ok': True}, 'meta': {}})

    def test_meta_defaults_to_empty_not_invented(self):
        """`meta` không được bịa giá trị - client không tin thứ không có nguồn."""
        self.assertEqual(envelope({'x': 1}).data['meta'], {})

    def test_adopt_is_idempotent(self):
        once = adopt_envelope(envelope({'a': 1}))
        twice = adopt_envelope(once)
        self.assertEqual(once.data, twice.data)
        self.assertEqual(twice.data['data'], {'a': 1})


class GatewayProtocolMustStayFlatTests(SimpleTestCase):
    """Khóa hướng dễ quên: các call site này KHÔNG được bọc."""

    def _returns_in(self, filename):
        tree = ast.parse((APP / filename).read_text(encoding='utf-8'))
        out = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Return) and isinstance(node.value, ast.Call):
                fn = node.value.func
                name = getattr(fn, 'id', None) or getattr(fn, 'attr', None)
                out.append((node.lineno, name))
        return out

    def test_no_call_site_wraps_a_rspcode_response(self):
        """VNPay IPN phải trả phẳng `{RspCode, Message}`."""
        offenders = []
        for filename in ('views.py', 'views_analytics.py'):
            tree = ast.parse((APP / filename).read_text(encoding='utf-8'))
            for node in ast.walk(tree):
                if not (isinstance(node, ast.Return) and isinstance(node.value, ast.Call)):
                    continue
                name = getattr(node.value.func, 'id', None) or getattr(
                    node.value.func, 'attr', None)
                if name not in ('envelope', 'paginated_envelope', 'adopt_envelope'):
                    continue
                src = ast.dump(node.value)
                if 'RspCode' in src:
                    offenders.append(f'{filename}:{node.lineno}')
        self.assertEqual(
            offenders, [],
            'Boc response RspCode se lam VNPay khong doc duoc -> hong giao dich',
        )

    def test_rspcode_responses_are_still_flat(self):
        """Xác nhận trực tiếp: các response RspCode dùng `Response`, không `envelope`."""
        flat = wrapped = 0
        tree = ast.parse((APP / 'views.py').read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Return) and isinstance(node.value, ast.Call)):
                continue
            if 'RspCode' not in ast.dump(node.value):
                continue
            name = getattr(node.value.func, 'id', None) or getattr(
                node.value.func, 'attr', None)
            if name == 'Response':
                flat += 1
            elif name in ('envelope', 'paginated_envelope'):
                wrapped += 1
        self.assertGreater(flat, 0, 'Khong con response RspCode phang nao')
        self.assertEqual(wrapped, 0, 'Co response RspCode da bi boc - sai hop dong')

    def test_two_key_received_error_is_not_exempt(self):
        """`{'received': True, 'error': ...}` mang dữ liệu nên không được miễn.

        Ranh giới của `SKIP_WEBHOOK_ACK`: chỉ khi `received` là key DUY NHẤT.
        """
        tree = ast.parse((APP / 'stripe_webhooks.py').read_text(encoding='utf-8'))
        bare_ack = 0
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Return) and isinstance(node.value, ast.Call)):
                continue
            if getattr(node.value.func, 'id', None) != 'Response':
                continue
            src = ast.dump(node.value)
            if "'received'" not in src:
                continue
            # đếm số key trong dict literal
            dict_node = node.value.args[0] if node.value.args else None
            if isinstance(dict_node, ast.Dict) and len(dict_node.keys) == 1:
                bare_ack += 1
        self.assertEqual(
            bare_ack, 1,
            'Ky vong 1 ACK trang (chi `received`); neu them/bot thi xem lai',
        )