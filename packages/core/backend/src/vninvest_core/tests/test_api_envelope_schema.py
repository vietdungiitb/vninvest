"""Hợp đồng schema OpenAPI cho envelope `{data, meta}`.

## Vì sao file này tồn tại

`service_ops/tests/test_soc_api_domain.py` có các test đọc schema từ
`/core/v1/schema/`, nhưng chúng chỉ assert `summary` / `requestBody` /
`security` — **không** assert shape của `responses`. Nên chúng **pass trong
lúc docs sai**: sau khi 3 app bọc `{data, meta}` (`02d8b25f1`, `07d7be028`,
`4c59dc1ab`), schema vẫn mô tả payload phẳng và không test nào đỏ.

Đo tại `4c59dc1ab`: **256 operation** mô tả sai shape, **0 operation** mô tả
đúng. File này là thứ làm cho lỗi đó **đỏ được**.

## Vì sao có một "global invariant" thay vì danh sách endpoint

Danh sách endpoint cứng sẽ chỉ bảo vệ đúng những dòng đã liệt kê — 256
operation sai mà test chỉ nhắc 5 thì 251 cái sai tiếp. Nên test ở đây suy ra
kỳ vọng **từ code production**: đọc `return` thật của handler (AST, dùng chung
bộ phân loại với `scripts/check-envelope-contract.py`) rồi so với những gì
schema khai. Sửa một khai báo `@extend_schema` về shape phẳng ⇒ test đỏ.

## Cái test KHÔNG kiểm

- Response `>= 400`: đi qua RFC 9457 `application/problem+json`, **không** phải
  envelope. `test_error_responses_are_never_described_as_envelope` giữ ranh giới.
- 204/205/304: không có body.
- F4 (`{object, generated_at, …}`) và F5 (`{data, +siblings}`): hợp đồng phẳng riêng.
- Operation 2xx **không** mô tả gì: test bỏ qua. Không có mô tả thì không thể
  "sai", và những operation đó là nợ riêng (xem `docs/`), không phải lỗi.
"""
import ast
import importlib.util
import inspect
import sys
import unittest
from pathlib import Path

from drf_spectacular.generators import SchemaGenerator
from rest_framework import serializers

from vninvest_core.api_envelope import envelope_response

BACKEND = Path(__file__).resolve().parent.parent.parent.parent

#: Các base class của framework không phải code của repo — đọc chúng ra vô nghĩa.
_FRAMEWORK_ROOTS = frozenset({'rest_framework', 'django', 'drf_spectacular'})


def _load_gate():
    """Nạp bộ phân loại F3/F4/F5 của `scripts/check-envelope-contract.py`.

    Cố ý **dùng chung** module đó thay vì viết lại tiêu chí: nếu ở đây dùng
    tiêu chí khác, gate và test sẽ bất đồng và một trong hai sẽ báo sai.
    """
    path = BACKEND / 'scripts' / 'check-envelope-contract.py'
    spec = importlib.util.spec_from_file_location('_envelope_contract_gate', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


GATE = _load_gate()


def _dedent_block(src):
    lines = src.splitlines()
    indents = [len(ln) - len(ln.lstrip()) for ln in lines if ln.strip()]
    base = min(indents) if indents else 0
    return '\n'.join(ln[base:] if len(ln) >= base else ln for ln in lines)


def _own_class(cls, method):
    """Class đầu tiên trong MRO **thuộc app** định nghĩa `method`."""
    for base in cls.__mro__:
        if (getattr(base, '__module__', '') or '').split('.')[0] in _FRAMEWORK_ROOTS:
            continue
        if method in base.__dict__:
            return base
    return None


_MODULE_CACHE: dict = {}


def _module_tree(module_name):
    """Parse module một lần rồi cache — endpoint gọi lại cho cùng file."""
    if module_name in _MODULE_CACHE:
        return _MODULE_CACHE[module_name]
    module = sys.modules.get(module_name)
    tree = None
    if module is not None:
        try:
            tree = ast.parse(_dedent_block(inspect.getsource(module)))
        except (OSError, TypeError, SyntaxError):
            tree = None
    _MODULE_CACHE[module_name] = tree
    return tree


def _api_view_handler(cls):
    """`FunctionDef` gốc của view `@api_view`, hoặc `None` nếu không phải.

    `rest_framework.decorators.api_view` tạo class bằng `type()` rồi gán
    `WrappedAPIView.__name__ = func.__name__` và
    `WrappedAPIView.__module__ = func.__module__`
    (`rest_framework/decorators.py:44-45`). Hệ quả: class đó **trùng tên với
    hàm gốc**, còn source chỉ có `FunctionDef` — **không** có `ClassDef`.

    Bản trước `_methods_of()` chỉ đi tìm `ClassDef` ⇒ tìm không thấy ⇒ trả
    `{}` ⇒ `_verdicts_for()` trả `None` ⇒ `EnvelopeGlobalInvariantTest`
    `continue` ⇒ **139 operation `@api_view` của `identity_access` được miễn
    kiểm trong im lặng**, trong đó 131 operation còn chưa mô tả gì cho 2xx.

    Tiêu chí nhận biết: tên **có** `ClassDef` trong source hay không. Có
    `ClassDef` ⇒ class thật, để `_methods_of()` xử lý như cũ.
    """
    tree = _module_tree(getattr(cls, '__module__', '') or '')
    if tree is None:
        return None
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == cls.__name__:
            return None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == cls.__name__:
            return node
    return None


def _methods_of(cls) -> dict:
    """`{ten_method: FunctionDef}` cho class + các base class thuộc repo."""
    found: dict = {}
    for base in cls.__mro__:
        if base is object or base.__module__ == 'builtins':
            continue
        tree = _module_tree(base.__module__)
        if tree is None:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == base.__name__:
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        found.setdefault(child.name, child)
    # View `@api_view`: mọi method được trỏ cùng một hàm gốc, nên map theo
    # `http_method_names` mà DRF tự sinh. `options` bỏ vì `APIView` đã có
    # sẵn và nó không phải handler của view.
    handler = _api_view_handler(cls)
    if handler is not None:
        for method in getattr(cls, 'http_method_names', ()) or ():
            if method != 'options':
                found.setdefault(method, handler)
    return found


def _is_error_status(node) -> bool:
    """`400`, `status.HTTP_404_NOT_FOUND`, … — mọi cách viết mã lỗi trong repo.

    Dùng bảng `_HTTP_STATUS_NAMES` của gate để không phải tự chế danh sách.
    """
    if isinstance(node, ast.Constant) and isinstance(node.value, int):
        return node.value >= 400
    if isinstance(node, ast.Attribute):
        value = GATE._HTTP_STATUS_NAMES.get(node.attr)
        return value is not None and value >= 400
    return False


def _is_error_helper(func) -> bool:
    """Helper chỉ trả **response lỗi**.

    `SOCBaseView.error_response` (`service_ops/views/base.py:140`) lấy
    `http_status` từ tham số mặc định `400` rồi luôn truyền vào
    `Response(..., status=http_status)`. Bộ phân loại đọc `status=` bằng
    literal nên **không** nhận ra đây là nhánh lỗi ⇒ `UNVERIFIED` ⇒ mọi
    handler gọi nó đều bị loại khỏi kiểm tra. Đó là lý do `scheduler.py` có 4
    endpoint bị bỏ sót dù `return` thật là `paginated_envelope`.

    Tiêu chí (cả hai đều phải đúng): có tham số mặc định ≥ 400 **và** mọi
    `Response` trong thân đều dùng đúng tham số đó làm `status=`.

    Mặc định trong repo viết là `status.HTTP_400_BAD_REQUEST` — một
    `ast.Attribute`, **không phải** `ast.Constant`. Kiểm tra bằng `Constant`
    đơn thuần làm tiêu chí hụt và im lặng: `error_response` bị coi là helper
    thường ⇒ handler gọi nó rơi về `UNVERIFIED` ⇒ endpoint bị bỏ sót.
    """
    args = func.args
    positional = list(args.posonlyargs) + list(args.args)
    defaults = list(args.defaults)
    status_params = set()
    if defaults:
        for arg, default in zip(positional[-len(defaults):], defaults):
            if _is_error_status(default):
                status_params.add(arg.arg)
    if not status_params:
        return False
    responses = [n for n in ast.walk(func)
                 if isinstance(n, ast.Call) and getattr(n.func, 'id', '') == 'Response']
    if not responses:
        return False
    for call in responses:
        status_kw = next((kw.value for kw in call.keywords if kw.arg == 'status'), None)
        if not (isinstance(status_kw, ast.Name) and status_kw.id in status_params):
            return False
    return True


def _classify_return(node, methods, depth) -> set:
    verdict = GATE._returns_envelope(node)
    if verdict != 'UNVERIFIED' or depth > 3:
        return {verdict}
    name = None
    if isinstance(node, ast.Call):
        func = node.func
        if isinstance(func, ast.Attribute):
            name = func.attr
        elif isinstance(func, ast.Name):
            name = func.id
    if name and name in methods:
        target = methods[name]
        if _is_error_helper(target):
            return {'SKIP_ERROR'}
        return _collect_returns(target, methods, depth + 1)
    return {'UNVERIFIED'}


def _collect_returns(func, methods, depth=0) -> set:
    found = set()
    for sub in ast.walk(func):
        if isinstance(sub, ast.Return) and sub.value is not None:
            found |= _classify_return(sub.value, methods, depth)
    return found


def _verdicts_for(view, method):
    """Tập phân loại của mọi `return` trong handler — `None` nếu không đọc được."""
    cls = type(view)
    methods = _methods_of(cls)
    if method.lower() not in methods:
        return None
    return _collect_returns(methods[method.lower()], methods)


def _first_endpoint(module_name, view_name):
    """`(path, method, view)` đầu tiên khớp — sinh schema tự động nếu chưa có."""
    generator = SchemaGenerator()
    generator._initialise_endpoints()
    for path, _regex, method, view in generator._get_paths_and_endpoints():
        cls = type(view)
        if cls.__name__ != view_name:
            continue
        if getattr(cls, '__module__', '') != module_name:
            continue
        return path, method, view
    raise AssertionError(f'khong tim thay endpoint {module_name}.{view_name}')


def _resolve_first(module_name, view_name):
    """View thật (instance) của một endpoint, để test truy cập `type(view)`."""
    return _first_endpoint(module_name, view_name)[2]


def _identity_access_endpoints():
    """Endpoint của riêng app `identity_access`."""
    generator = SchemaGenerator()
    generator._initialise_endpoints()
    return [
        (path, regex, method, view)
        for path, regex, method, view in generator._get_paths_and_endpoints()
        if (getattr(type(view), '__module__', '') or '').startswith('identity_access')
    ]


class EnvelopeSchemaFixture(unittest.TestCase):
    """Sinh schema **một lần** cho cả lớp — sinh mỗi test là chậm vô lý."""

    @classmethod
    def setUpClass(cls):
        generator = SchemaGenerator()
        cls.schema = generator.get_schema(request=None, public=True)
        generator._initialise_endpoints()
        cls.endpoints = generator._get_paths_and_endpoints()

    # --- tien ich ---
    def _resolve(self, node):
        for _ in range(5):
            if not isinstance(node, dict) or '$ref' not in node:
                break
            ref = node['$ref'].rsplit('/', 1)[-1]
            node = (self.schema.get('components', {}).get('schemas', {}) or {}).get(ref, {})
        return node or {}

    def success_props(self, path, method):
        """Tập key ở cấp `data` của response 2xx, hoặc `None` nếu không mô tả."""
        op = (self.schema.get('paths', {}).get(path) or {}).get(method.lower()) or {}
        for code, resp in (op.get('responses') or {}).items():
            if not str(code).startswith('2'):
                continue
            content = (resp or {}).get('content') or {}
            for media in content.values():
                return set((self._resolve(media.get('schema')).get('properties') or {}).keys())
        return None

    def _iter_classified(self):
        for path, _regex, method, view in self.endpoints:
            op = (self.schema.get('paths', {}).get(path) or {}).get(method.lower())
            if not op:
                continue  # bi @extend_schema(exclude=True) loai
            yield path, method.lower(), view, self.success_props(path, method)


class EnvelopeHelperUnitTest(unittest.TestCase):
    """Helper phải tự bảo vệ — lỗi ở đây làm hỏng schema của cả app."""

    def test_wraps_serializer_in_data_and_meta(self):
        class InnerSerializer(serializers.Serializer):
            value = serializers.CharField()

        response = envelope_response(InnerSerializer)
        serializer = response.response
        self.assertEqual(set(serializer.fields), {'data', 'meta'})
        self.assertIsInstance(serializer.fields['data'], InnerSerializer)

    def test_component_name_is_deterministic(self):
        class InnerSerializer(serializers.Serializer):
            value = serializers.CharField()

        first = envelope_response(InnerSerializer).response
        second = envelope_response(InnerSerializer).response
        self.assertEqual(first.Meta.ref_name, second.Meta.ref_name)
        self.assertTrue(first.Meta.ref_name.endswith('Envelope'))

    def test_many_uses_a_different_component_name(self):
        """`many=True` khác `many=False` **cả hình dạng lẫn tên**.

        Cùng tên `DataMetaEnvelope` cho một object và một array khiến
        drf-spectacular cảnh báo `Encountered 2 components with identical
        names ... incorrect schema`. Cảnh báo không làm `spectacular` fail nên
        lọt qua mọi gate.
        """
        flat = envelope_response().response
        listed = envelope_response(many=True).response
        self.assertNotEqual(flat.Meta.ref_name, listed.Meta.ref_name)

    def test_same_serializer_yields_same_class(self):
        """Chống trùng tên component.

        `@extend_schema` chạy lúc import, và cùng một serializer thường dùng cho
        cả GET lẫn POST. Không cache ⇒ hai class **khác nhau** cùng tên ⇒
        drf-spectacular cảnh báo `Encountered 2 components with identical
        names ... will very likely result in an incorrect schema`. Cảnh báo đó
        **không** làm lệnh `spectacular` fail, nên không gate nào bắt được.
        """
        class InnerSerializer(serializers.Serializer):
            value = serializers.CharField()

        first = envelope_response(InnerSerializer).response
        second = envelope_response(InnerSerializer).response
        self.assertIs(type(first), type(second))

    def test_many_wraps_data_in_list(self):
        class RowSerializer(serializers.Serializer):
            value = serializers.CharField()

        serializer = envelope_response(RowSerializer, many=True).response
        self.assertTrue(serializer.fields['data'].many)

    def test_accepts_serializer_instance(self):
        class RowSerializer(serializers.Serializer):
            value = serializers.CharField()

        serializer = envelope_response(RowSerializer()).response
        self.assertEqual(set(serializer.fields), {'data', 'meta'})

    def test_free_form_payload_still_has_data_and_meta(self):
        serializer = envelope_response().response
        self.assertEqual(set(serializer.fields), {'data', 'meta'})

    def test_rejects_non_serializer(self):
        # Không có guard này, `responses={200: envelope_response(OpenApiTypes.OBJECT)}`
        # sẽ ra schema free-form **không báo lỗi** — docs sai mà test vẫn xanh.
        with self.assertRaises(TypeError):
            envelope_response({'type': 'object'})

    def test_meta_is_free_form_object(self):
        serializer = envelope_response().response
        self.assertIsInstance(serializer.fields['meta'], serializers.DictField)


class EnvelopeShapeInSchemaTest(EnvelopeSchemaFixture):
    """Test trên schema thật — đây mới là chỗ bắt được docs sai."""

    #: Endpoint đã bọc, phải mô tả `{data, meta}`. Cố ý lấy từ **nhiều file** và
    #: cả ba dạng khai báo, để một lần revert ở bất kỳ file nào cũng phải bắt
    #: được: serializer có tên, `OpenApiTypes.OBJECT` (free-form), và `many=True`.
    KNOWN_ENVELOPED = (
        # service_ops — serializer có tên (pilot đầu tiên)
        ('/api/soc/prefetch/config/', 'get', '200'),
        ('/api/soc/prefetch/config/', 'post', '201'),
        # service_ops — file khác
        ('/core/v1/operator/scraping/matrix/cycles/', 'get', '200'),
        ('/api/soc/signals/config/', 'get', '200'),
        ('/api/soc/vnbroker/config/', 'get', '200'),
        # service_ops — `OpenApiTypes.OBJECT` -> `data` free-form
        ('/api/soc/dataops/backfill/runs/', 'get', '200'),
        ('/api/soc/dataops/inventory/', 'get', '200'),
        # service_ops — `data` là mảng
        ('/api/soc/overview/export/audits/', 'get', '200'),
        # service_ops — hai nhánh 2xx khác hình dạng -> `data` free-form
        ('/api/soc/signals/deliveries/', 'get', '200'),
        # user_workspace — app thứ 3 đã bọc
        ('/core/v1/workspace/whale-analytics/{symbol}/', 'get', '200'),
    )

    def test_known_endpoints_document_data_and_meta(self):
        for path, method, code in self.KNOWN_ENVELOPED:
            with self.subTest(path=path, method=method):
                op = (self.schema['paths'][path][method])['responses'][code]
                schema = self._resolve(
                    op['content']['application/json']['schema'])
                props = set((schema.get('properties') or {}).keys())
                self.assertEqual(
                    props, {'data', 'meta'},
                    f'{method.upper()} {path} {code} phai mo ta {{data, meta}}, '
                    f'hien la {sorted(props)}',
                )

    def test_error_responses_are_never_described_as_envelope(self):
        """RFC 9457 là hợp đồng khác — bọc lỗi vào `{data, meta}` là sai."""
        offenders = []
        for path, item in (self.schema.get('paths') or {}).items():
            for method, op in item.items():
                if method == 'parameters':
                    continue
                for code, resp in (op.get('responses') or {}).items():
                    if not str(code).startswith(('4', '5')):
                        continue
                    for media in ((resp or {}).get('content') or {}).values():
                        props = set(
                            (self._resolve(media.get('schema')).get('properties') or {}).keys())
                        if {'data', 'meta'} <= props:
                            offenders.append(f'{method.upper()} {path} {code}')
        self.assertEqual(offenders, [], f' loi bi mo ta nhu envelope: {offenders}')

    def test_no_body_statuses_have_no_content(self):
        offenders = []
        for path, item in (self.schema.get('paths') or {}).items():
            for method, op in item.items():
                if method == 'parameters':
                    continue
                for code, resp in (op.get('responses') or {}).items():
                    if str(code) in ('204', '205', '304') and (resp or {}).get('content'):
                        offenders.append(f'{method.upper()} {path} {code}')
        self.assertEqual(offenders, [], offenders)


class EnvelopeGlobalInvariantTest(EnvelopeSchemaFixture):
    """Suy ra kỳ vọng từ **code production**, không từ danh sách viết tay."""

    def _classified(self):
        """(path, method, props, kind) cho mọi operation đọc được.

        `kind`:
        - `ENVELOPED` — handler trả `{data, meta}`
        - `FLAT` — handler trả 2xx phẳng bọc tay
        - `F4_FLAT` — handler trả F4 (`{object, generated_at, …}` / có
          `generated_at`), hợp đồng phẳng **riêng**, phải giữ phẳng
        """
        for path, _regex, method, view in self.endpoints:
            method = method.lower()
            op = (self.schema.get('paths', {}).get(path) or {}).get(method)
            if not op:
                continue
            verdicts = _verdicts_for(view, method)
            if not verdicts:
                continue  # không đọc được handler → không kết luận
            props = self.success_props(path, method)
            # `UNVERIFIED` ⇒ có nhánh 2xx mà không đọc ra được. "Chắc chắn
            # WRAPPED" thì cũng chưa đủ bằng chứng — nhánh đó có thể là 2xx phẳng.
            if 'UNVERIFIED' in verdicts:
                continue
            wrapped = 'WRAPPED' in verdicts
            unwrapped = 'UNWRAPPED' in verdicts
            if wrapped and not unwrapped:
                kind = 'ENVELOPED'
            elif unwrapped and not wrapped:
                kind = 'FLAT'
            elif not wrapped and not unwrapped and 'SKIP_F4' in verdicts:
                kind = 'F4_FLAT'
            elif not wrapped and not unwrapped and 'SKIP_F5_SIBLINGS' in verdicts:
                # F5 `{data, +siblings}` — hợp đồng phẳng riêng. Bản trước KHÔNG
                # có nhánh này nên mọi view F5 rơi xuống `else: continue`:
                # bọc chúng vào `{data, meta}` (làm rơi sibling) **không test
                # nào bắt**. Thêm nhánh này thì
                # `test_flat_views_are_not_documented_as_envelope` bắt được, và
                # negative proof NP4/NP5 xanh.
                kind = 'F5_FLAT'
            else:
                continue
            yield path, method, props, kind

    def test_enveloped_views_are_not_documented_flat(self):
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
        """Chiều ngược lại: bọc bừa cũng sai, và sai kiểu đó khó phát hiện hơn.

        Bao gồm `F4_FLAT` (`{generated_at, …}`) và `F5_FLAT` (`{data, +siblings}`):
        đó là hai hợp đồng **phẳng riêng**, bọc vào `{data, meta}` là phá hợp
        đồng — cũng là phá, và với F5 thì còn **làm rơi sibling** nên client mất
        trường. Đây là ranh giới dễ bị lấn nhất khi thêm `envelope_response()`
        hàng loạt (negative proof NP3/NP4/NP5).
        """
        offenders = []
        for path, method, props, kind in self._classified():
            if kind not in ('FLAT', 'F4_FLAT', 'F5_FLAT') or props is None:
                continue
            if {'data', 'meta'} <= props:
                offenders.append(f'{kind} {method.upper()} {path}')
        self.assertEqual(offenders, [], f' bi boc nhung view tra ve phang: {offenders}')


class ApiViewResolutionUnitTest(unittest.TestCase):
    """`_api_view_handler()` — phần đã sửa của `_methods_of()`.

    Không có lớp test này thì bản sửa ở trên có **giá trị bằng 0**: hỏng thì
    không test nào đỏ, và các view `@api_view` lại rơi vào im lặng như cũ.
    """

    def test_resolves_a_function_view_from_its_source(self):
        view = _resolve_first('identity_access.views_personal', 'personal_summary')
        handler = _api_view_handler(type(view))
        self.assertIsNotNone(
            handler,
            'view @api_view phai tim duoc FunctionDef cung ten trong source',
        )
        self.assertEqual(handler.name, 'personal_summary')

    def test_maps_every_http_method_to_that_handler(self):
        """Một path nhiều method ⇒ tất cả method trỏ **cùng** một hàm gốc."""
        view = _resolve_first('identity_access.views_personal', 'personal_keys_list_create')
        methods = _methods_of(type(view))
        self.assertIn('get', methods)
        self.assertIn('post', methods)
        self.assertIs(methods['get'], methods['post'])

    def test_ignores_options_which_is_an_apiview_default(self):
        """`options` phải trỏ tới handler của `APIView`, **không** phải của view.

        `http_method_names` của một view `@api_view` luôn có `'options'` (DRF
        tự thêm vào allowed methods). Nếu map nó sang hàm của view thì phân
        loại đọc nhầm handler của `APIView.options` — và đây chính xác là loại
        sai mà test này chặn.

        Lưu ý `options` **vẫn** xuất hiện trong dict: `_methods_of()` duyệt cả
        MRO nên `APIView.options` ở `rest_framework/views.py` được gom vào.
        Điều cần khẳng định là **danh tính** của nó, không phải sự vắng mặt.
        """
        view = _resolve_first('identity_access.views_personal', 'personal_summary')
        methods = _methods_of(type(view))
        handler = _api_view_handler(type(view))
        self.assertIn('options', methods)
        self.assertIsNot(
            methods['options'], handler,
            '`options` phai la handler cua APIView, khong phai ham cua view nay',
        )
        self.assertEqual(methods['get'], handler)

    def test_returns_none_for_a_real_drf_class(self):
        """Class thật vẫn đi qua đường `ClassDef` như cũ, không qua lối tắt."""
        view = _resolve_first('identity_access.views_reports', 'ScheduledReportDetailView')
        self.assertIsNone(_api_view_handler(type(view)))

    def test_every_api_view_operation_is_now_judgeable(self):
        """139 operation `@api_view` của `identity_access` trước đây trả `None`.

        Chốt bằng **con số**, không bằng cảm giác: nhét `None` vào lại thì test
        này đỏ.
        """
        unreadable = [
            f'{method.upper()} {path}'
            for path, _regex, method, view in _identity_access_endpoints()
            if _verdicts_for(view, method.lower()) is None
        ]
        self.assertEqual(
            unreadable, [],
            f'{len(unreadable)} operation @api_view doc khong duoc handler: '
            f'{unreadable[:5]}',
        )


class HandlerResolvabilityTest(EnvelopeSchemaFixture):
    """Chốt: không operation nào của repo bị **bỏ qua im lặng**.

    `_verdicts_for()` trả `None` ⇒ `EnvelopeGlobalInvariantTest` `continue` ⇒
    view đó **không** được kiểm ở cả hai chiều. Đây là điều đã xảy ra với
    toàn bộ view `@api_view` trước khi sửa `_methods_of()`.

    `KNOWN_UNREADABLE` liệt kê nợ còn lại **kèm lý do** thay vì im lặng bỏ
    qua — cùng nguyên tắc `EXEMPT_APPS` của `scripts/check-envelope-contract.py`.
    """

    #: 25 operation, ngoài phạm vi `identity_access`, đã biết trước nguyên nhân.
    KNOWN_UNREADABLE = {
        # ViewSet: endpoint gọi method HTTP (`get`) nhưng handler thật là action
        # (`list`/`retrieve`/`create`) do `ViewSetMixin.as_view({...})` ánh xạ.
        # `_methods_of()` tra theo tên method nên không khớp.
        ('advertising.views', 'OperatorAdCampaignViewSet'): 'viewset action ten khac method',
        ('advertising.views', 'OperatorAdDailySummaryViewSet'): 'viewset action ten khac method',
        ('data_ingest.views', 'DataIngestAdminViewSet'): 'viewset action ten khac method',
        ('data_ingest.views', 'IngestJobViewSet'): 'viewset action ten khac method',
        ('data_ingest.views', 'IngestRunViewSet'): 'viewset action ten khac method',
        # `_module_tree()` trả `None` ⇒ không đọc được source để tìm handler.
        ('user_workspace.views_broker', 'broker_providers_api'): 'module source doc khong duoc',
        ('user_workspace.views_broker', 'broker_config_schema_api'): 'module source doc khong duoc',
        ('user_workspace.views_broker', 'broker_config_api'): 'module source doc khong duoc',
        ('user_workspace.views_broker', 'broker_test_connection_api'): 'module source doc khong duoc',
        ('user_workspace.views_broker', 'broker_job_status_api'): 'module source doc khong duoc',
    }

    def test_no_silent_skips_outside_the_known_list(self):
        offenders = []
        for path, _regex, method, view in self.endpoints:
            cls = type(view)
            module = getattr(cls, '__module__', '') or ''
            root = module.split('.')[0]
            if root in _FRAMEWORK_ROOTS or root in ('', 'builtins'):
                continue
            if _verdicts_for(view, method.lower()) is not None:
                continue
            key = (module, cls.__name__)
            if key in self.KNOWN_UNREADABLE:
                continue
            offenders.append(f'{method.upper()} {path} -> {key}')
        self.assertEqual(
            offenders, [],
            f'{len(offenders)} operation doc khong duoc handler va KHONG nam trong '
            f'KNOWN_UNREADABLE. Xem 5 dau: {offenders[:5]}',
        )

    def test_known_unreadable_entries_are_still_needed(self):
        """Danh sách phải **thu đúng** — entry thừa là nợ đã được sửa mà quên xoá.

        Không có test này thì ai đó sửa xong 1 nhóm cũng quên dọn danh sách, và
        danh sách bị phình vô hạn trong khi không còn ai kiểm.
        """
        still_unreadable = set()
        for _path, _regex, method, view in self.endpoints:
            cls = type(view)
            key = (getattr(cls, '__module__', '') or '', cls.__name__)
            if _verdicts_for(view, method.lower()) is None and key[0].split('.')[0] not in _FRAMEWORK_ROOTS:
                still_unreadable.add(key)
        stale = set(self.KNOWN_UNREADABLE) - still_unreadable
        self.assertEqual(
            stale, set(),
            f'nhung muc nay da doc duoc handler nen xoa khoi KNOWN_UNREADABLE: {stale}',
        )