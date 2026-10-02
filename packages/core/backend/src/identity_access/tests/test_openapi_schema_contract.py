"""Hợp đồng shape schema OpenAPI cho app `identity_access`.

## Vì sao file này tồn tại

App `identity_access` **không có `@extend_schema` nào** trước đợt này. Hệ
quả: **326 operation** (đo tại `8fcb07b87`) không mô tả gì cho response 2xx —
`drf-spectacular` không đoán được vì các view đó là `APIView`/`@api_view`
không có `serializer_class`.

Không có mô tả thì **không thể sai**, nên lỗi đó im lặng qua mọi gate. Đợt này
bổ sung `@extend_schema`; file này là thứ giữ cho nó khỏi mất.

## Vì sao test này **không** nằm trong `test_api_envelope_schema.py`

Bộ test dùng chung đó suy kỳ vọng bằng `_verdicts_for(view, method)`, và hàm
đó **đọc handler qua `type(view).__mro__`**. `@api_view` tạo ra lớp
`WrappedAPIView` của riêng DRF, nên:

```python
_methods_of(WrappedAPIView)   # -> {}   (module `rest_framework.decorators`)
```

⇒ 31 view `@api_view` của app này (`partner_rotate_pat`, `partner_revoke_pat`,
`login_view`, …) rơi vào `NOFUNC` và **bị bỏ qua im lặng** — kể cả khi bọc sai.
Đây đúng là chỗ dễ sai nhất (xem `PATShapeAnchorTest`), nên file này tự tra
cái lỗ hổng đó thay vì sửa file dùng chung — file đó phục vụ 4 app, sửa nó
lúc này sẽ va chạm agent khác.

## Ranh giới (cố ý bỏ ngoài phạm vi)

- Operation **chưa** mô tả: bỏ qua. Danh sách nợ nằm ở
  `docs/`/`CLAIMS.md`, không phải lỗi hợp đồng.
- View mà bộ phân loại **không đọc được** (`UNVERIFIED`): bỏ qua — không đoán.
- 204/205/304: không có body (`test_no_body_statuses_have_no_content` bên kia
  đã giữ).
"""
import ast
import unittest
from pathlib import Path

from drf_spectacular.generators import SchemaGenerator

from vninvest_core.tests.test_api_envelope_schema import (
    _collect_returns,
    _verdicts_for,
)

#: Verdict này là phẳng: `data`/`meta` không tồn tại ở cấp ngoài.
_FLAT_VERDICTS = ('UNWRAPPED', 'SKIP_F4', 'SKIP_F5_SIBLINGS', 'SKIP_NOBODY')

SRC = Path(__file__).resolve().parent.parent

_FUNC_INDEX: dict = {}
_CLASS_INDEX: set = set()


def _index_source():
    """Index `identity_access/**`: hàm theo tên + tập tên class.

    Vì sao phải index từ **source** chứ không lấy từ `sys.modules`:

    ```python
    @extend_schema(...)          # <- tra ve chính `func`, gan annotation
    @api_view(['POST'])
    def partner_issue_pat(request): ...
    ```

    `partner_issue_pat` trong module là **view function của DRF**, không phải
    hàm gốc; và lớp `WrappedAPIView` mà `api_view` sinh ra lại mang
    `__module__` = `'identity_access.views_tenant'` (không phải
    `'rest_framework.decorators'`). Nên:

    - `_methods_of` đi tìm một `class partner_issue_pat` trong source — **không
      có** ⇒ rỗng ⇒ phân loại rỗng ⇒ **bỏ qua im lặng**;
    - `cls.__module__.startswith('rest_framework')` cũng **không** dùng được,
      vì `__module__` lại trỏ về app.

    Cách nhận biết đúng: **tên có class trong source hay không**. Có class ⇒
    view class thật, dùng `_verdicts_for`. Không có class nhưng có hàm ⇒
    `@api_view`, đọc hàm gốc trong source.
    """
    if _FUNC_INDEX:
        return _FUNC_INDEX, _CLASS_INDEX
    for path in sorted(SRC.rglob('*.py')):
        if 'migrations' in path.parts or 'tests' in path.parts:
            continue
        try:
            tree = ast.parse(path.read_text(encoding='utf-8'))
        except (OSError, SyntaxError):
            continue
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                _FUNC_INDEX.setdefault(node.name, node)
            elif isinstance(node, ast.ClassDef):
                _CLASS_INDEX.add(node.name)
    return _FUNC_INDEX, _CLASS_INDEX


def _app_functions():
    return _index_source()[0]


def _app_classes():
    return _index_source()[1]


class IdentityAccessSchemaFixture(unittest.TestCase):
    """Sinh schema **một lần** cho cả lớp."""

    @classmethod
    def setUpClass(cls):
        generator = SchemaGenerator()
        cls.schema = generator.get_schema(request=None, public=True)
        generator._initialise_endpoints()
        cls.endpoints = generator._get_paths_and_endpoints()

    def _resolve(self, node):
        for _ in range(5):
            if not isinstance(node, dict) or '$ref' not in node:
                break
            ref = node['$ref'].rsplit('/', 1)[-1]
            node = (self.schema.get('components', {}).get('schemas', {}) or {}).get(ref, {})
        return node or {}

    def success_props(self, path, method):
        """Key ở cấp ngoài của response 2xx, hoặc `None` nếu chưa mô tả."""
        op = (self.schema.get('paths', {}).get(path) or {}).get(method.lower()) or {}
        for code, resp in (op.get('responses') or {}).items():
            if not str(code).startswith('2'):
                continue
            content = (resp or {}).get('content') or {}
            if not content:
                continue
            for media in content.values():
                return set((self._resolve(media.get('schema')).get('properties') or {}).keys())
        return None

    def _verdicts(self, view, method):
        """Phân loại `return` thật — kể cả view `@api_view`.

        Xem `_index_source()` để biết vì sao phải phân biệt bằng *source* chứ
        không phải `__module__`.
        """
        name = getattr(type(view), '__name__', '')
        if name not in _app_classes():
            fn = _app_functions().get(name)
            if fn is None:
                return None
            return _collect_returns(fn, _app_functions())
        return _verdicts_for(view, method)

    def _classified(self):
        """(path, method, props, kind) cho operation của app này đọc được.

        kind: `ENVELOPED` | `FLAT` | `SKIPPED` (chưa mô tả / không kết luận được)
        """
        for path, _regex, method, view in self.endpoints:
            if not type(view).__module__.startswith('identity_access'):
                continue
            method = method.lower()
            if not ((self.schema.get('paths', {}).get(path) or {}).get(method)):
                continue
            verdicts = self._verdicts(view, method)
            props = self.success_props(path, method)
            if not verdicts or 'UNVERIFIED' in verdicts:
                yield path, method, props, 'SKIPPED'
                continue
            wrapped = 'WRAPPED' in verdicts
            unwrapped = any(v in verdicts for v in _FLAT_VERDICTS)
            if wrapped and not unwrapped:
                kind = 'ENVELOPED'
            elif unwrapped and not wrapped:
                kind = 'FLAT'
            else:
                kind = 'SKIPPED'
            yield path, method, props, kind


class EnvelopeShapeInSchemaTest(IdentityAccessSchemaFixture):
    """Test trên schema thật — đây mới là chỗ bắt được docs sai."""

    def test_wrapped_views_are_documented_as_data_and_meta(self):
        """Chiều 1: handler trả `{data, meta}` mà schema mô tả phẳng ⇒ đỏ.

        Đây là lỗi 256 operation mà đợt B5 trước để lọt: sửa một
        `@extend_schema` về shape phẳng là test này đỏ ngay.
        """
        offenders = []
        for path, method, props, kind in self._classified():
            if kind != 'ENVELOPED' or props is None:
                continue
            if not {'data', 'meta'} <= props:
                offenders.append(f'{method.upper()} {path} -> {sorted(props)}')
        self.assertEqual(
            offenders, [],
            f'{len(offenders)} operation tra ve {{data, meta}} nhung schema van '
            f'mo ta phang. Xem 5 dau: {offenders[:5]}',
        )

    def test_flat_views_are_not_documented_as_envelope(self):
        """Chiều 2: bọc nhầm view trả phẳng ⇒ đỏ.

        Chiều này **khó bắt hơn** nhiều và là cái dễ làm sai khi thêm
        `envelope_response()` hàng loạt: schema ra đẹp, `spectacular` không
        cảnh báo, không test nào đỏ. `F4` (`{object, …}`) nằm trong đây — bọc
        nó là phá hợp đồng.
        """
        offenders = []
        for path, method, props, kind in self._classified():
            if kind != 'FLAT' or props is None:
                continue
            if {'data', 'meta'} <= props:
                offenders.append(f'{method.upper()} {path}')
        self.assertEqual(
            offenders, [],
            f'{len(offenders)} operation tra ve phang nhung bi mo ta nhu '
            f'envelope: {offenders[:5]}',
        )

    def test_error_responses_are_never_described_as_envelope(self):
        """Lỗi đi qua RFC 9457 `application/problem+json`, không phải envelope."""
        offenders = []
        for path, item in (self.schema.get('paths') or {}).items():
            for method, op in item.items():
                if method == 'parameters':
                    continue
                for code, resp in ((op.get('responses') or {})).items():
                    if not str(code).startswith(('4', '5')):
                        continue
                    for media in ((resp or {}).get('content') or {}).values():
                        props = set(
                            (self._resolve(media.get('schema')).get('properties') or {}).keys())
                        if {'data', 'meta'} <= props:
                            offenders.append(f'{method.upper()} {path} {code}')
        self.assertEqual(offenders, [], f'loi bi mo ta nhu envelope: {offenders[:5]}')

    def test_no_body_statuses_have_no_content(self):
        offenders = []
        for path, item in (self.schema.get('paths') or {}).items():
            for method, op in item.items():
                if method == 'parameters':
                    continue
                for code, resp in ((op.get('responses') or {})).items():
                    if str(code) in ('204', '205', '304') and (resp or {}).get('content'):
                        offenders.append(f'{method.upper()} {path} {code}')
        self.assertEqual(offenders, [], offenders[:5])


class PATShapeAnchorTest(IdentityAccessSchemaFixture):
    """Ba view PAT trả **khác nhau** — đây là ranh giới dễ phá nhất.

    `partner_issue_pat` đã bọc `envelope()` (`views_tenant.py:362`) còn
    `partner_rotate_pat` (`:414`) và `partner_revoke_pat` (`:434`) trả dict
    thẳng có khoá `object` — hợp đồng F4 phẳng. Ba view **cùng nhìn giống
    nhau** (đều là `@api_view(['POST'])` trên `/pats/…`), nên "bọc cho đồng bộ"
    là cách sai rất dễ rơi vào.

    Vì vậy 3 path này được **ghim tường minh** thay vì để test suy luận.

    ## Vì sao `test_rotate_and_revoke_stay_flat` là chốt chặn **thật sự**

    Đo bằng bộ phân loại dùng chung:

    | view | verdict | test suy luận bắt được? |
    |---|---|---|
    | `partner_issue_pat` | `WRAPPED` | có |
    | `partner_revoke_pat` | `SKIP_F4` | có (`FLAT`) |
    | `partner_rotate_pat` | **`UNVERIFIED`** | **không** |

    `partner_rotate_pat` trả `Response(payload, status=200)` — `payload` là
    **biến**, không phải dict literal, nên `_returns_envelope` không đọc được
    và trả `UNVERIFIED` ⇒ bị `_classified()` bỏ qua im lặng. Nếu chỉ tin test
    suy luận thì bọc nhầm view này là **không ai bắt**.

    Đã kiểm chứng bằng cách sửa tạm `envelope_response(PATRotationResponseSerializer)`
    vào `partner_rotate_pat`: `test_rotate_and_revoke_stay_flat` đỏ. Sửa lại ⇒ xanh.
    """

    ENVELOPED = ('/core/v1/partner/pats/issue', 'post')
    FLAT = (
        ('/core/v1/partner/pats/{pat_id}/rotate/', 'post'),
        ('/core/v1/partner/pats/{pat_id}/revoke/', 'post'),
    )

    def test_issue_pat_is_enveloped(self):
        props = self.success_props(*self.ENVELOPED)
        self.assertIsNotNone(props, 'POST /pats/issue chua mo ta gi')
        self.assertEqual(
            set(props), {'data', 'meta'},
            'issue_pat tra envelope() nen phai mo ta {data, meta}',
        )

    def test_rotate_and_revoke_stay_flat(self):
        for path, method in self.FLAT:
            with self.subTest(path=path):
                props = self.success_props(path, method)
                self.assertIsNotNone(props, f'{path} chua mo ta gi')
                self.assertEqual(
                    {'data', 'meta'} & set(props), set(),
                    f'{path} tra dict phang co khoa "object" (F4). Boc vao '
                    f'{{data, meta}} la pha hop dong — xem PATShapeAnchorTest.',
                )
                self.assertIn('object', props, f'{path} phai van giu khoa "object"')
