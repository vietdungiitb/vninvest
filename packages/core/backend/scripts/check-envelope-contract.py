#!/usr/bin/env python3
"""Gate: một app đã bọc xong `{data, meta}` **hay chưa**.

## Vì sao cần
Agent B5 đầu tiên bọc `analytics`/`billing`/`audit` nhưng bỏ sót
`dataops_config`/`dataops_planner`/`matrix` — `service_ops` có **hai** shape
phân trang cùng lúc, và **không test nào bắt được**. Gate này là thứ đã bắt
được việc đó, và phải có **trước** khi chia agent.

## Cách kiểm
AST thật, không phải grep. Tìm mọi `return` mà giá trị là lời gọi trả về
response, rồi phân loại tham số đầu:

| Kết luận | Điều kiện |
|---|---|
| `WRAPPED` | dict literal có **cả** `'data'` và `'meta'` |
| `WRAPPED` | lời gọi qua helper (`envelope`, `envelope_response`, `paginated_envelope`, …) |
| `UNWRAPPED` | dict literal **không** có `meta` — chắc chắn sai |
| `UNVERIFIED` | không đọc được (biến, attribute, `paginate_queryset`) — cần đọc tay |

`UNVERIFIED` **không** làm fail. Nhưng số nó phải được báo, vì đó là phần
chưa được máy kiểm — giống `CHƯA CHẠY`.

## Dùng
```powershell
python scripts/check-envelope-contract.py identity_access
echo $LASTEXITCODE      # 0 = app đã bọc hết phần máy kiểm được
```

Exit 1 nếu còn bất kỳ `UNWRAPPED` nào.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SRC = BACKEND / 'src'

#: Tên lời gọi được coi là đã bọc (helper của app, hoặc tương đương).
WRAPPER_NAMES = ('envelope', 'envelope_response', 'paginated_envelope')

#: Lời gọi trả về response mà ta cần kiểm.
RETURNERS = ('Response', 'JsonResponse')


def _is_dict_with(payload, key: str) -> bool:
    if not isinstance(payload, ast.Dict):
        return False
    for k in payload.keys:
        if isinstance(k, ast.Constant) and k.value == key:
            return True
    return False


#: Tên hằng trong `django.http` / DRF `status`. Cần vì code viết
#: `status=status.HTTP_404_NOT_FOUND` — đó là `ast.Attribute`, không phải
#: literal số, nên bản đầu gate đọc `status=` bằng `ast.Constant` là **bỏ sót
#: toàn bộ** các response lỗi viết theo convention của Django. Đó là lý do 45
#: điểm bị báo sai.
_HTTP_STATUS_NAMES = {
    'HTTP_100_CONTINUE': 100, 'HTTP_200_OK': 200, 'HTTP_201_CREATED': 201,
    'HTTP_202_ACCEPTED': 202, 'HTTP_204_NO_CONTENT': 204,
    'HTTP_206_PARTIAL_CONTENT': 206, 'HTTP_301_MOVED_PERMANENTLY': 301,
    'HTTP_302_FOUND': 302, 'HTTP_304_NOT_MODIFIED': 304,
    'HTTP_400_BAD_REQUEST': 400, 'HTTP_401_UNAUTHORIZED': 401,
    'HTTP_402_PAYMENT_REQUIRED': 402, 'HTTP_403_FORBIDDEN': 403,
    'HTTP_404_NOT_FOUND': 404, 'HTTP_405_METHOD_NOT_ALLOWED': 405,
    'HTTP_409_CONFLICT': 409, 'HTTP_410_GONE': 410,
    'HTTP_418_IM_A_TEAPOT': 418, 'HTTP_422_UNPROCESSABLE_ENTITY': 422,
    'HTTP_429_TOO_MANY_REQUESTS': 429, 'HTTP_500_INTERNAL_SERVER_ERROR': 500,
    'HTTP_501_NOT_IMPLEMENTED': 501, 'HTTP_502_BAD_GATEWAY': 502,
    'HTTP_503_SERVICE_UNAVAILABLE': 503, 'HTTP_504_GATEWAY_TIMEOUT': 504,
}


def _status_kwarg(call: ast.Call):
    """Lấy `status=` — nhận cả literal số lẫn `status.HTTP_404_NOT_FOUND`."""
    for kw in call.keywords:
        if kw.arg != 'status':
            continue
        if isinstance(kw.value, ast.Constant):
            return kw.value.value
        if isinstance(kw.value, ast.Attribute):
            return _HTTP_STATUS_NAMES.get(kw.value.attr)
    return None


def _returns_envelope(node: ast.expr) -> str:
    """Phân loại giá trị trả về.

    Bản đầu đếm **response lỗi** là "chưa bọc" ⇒ gate không bao giờ xanh, và
    nếu ai đó cố làm nó xanh thì sẽ bọc lỗi ⇒ phá RFC 9457. Vì vậy: `Response`
    có `status >= 400` thì **bỏ qua** — error envelope không thuộc phạm vi
    API-02.

    Tương tự, `return {...}` trình thuần (không bọc trong `Response(...)`) là
    giá trị của một **helper**, không phải HTTP response. Không đọc được thì
    ghi `UNVERIFIED` chứ không đoán — đoán thành `UNWRAPPED` thì gate báo động
    giả và mất tác dụng.
    """
    if isinstance(node, ast.Call):
        name = getattr(node.func, 'id', '') or getattr(node.func, 'attr', '')
        if any(name == w or name.endswith(f'_{w}') for w in WRAPPER_NAMES):
            return 'WRAPPED'

        if name in RETURNERS:
            status = _status_kwarg(node)
            # `status >= 400` ⇒ response lỗi ⇒ thuộc RFC 9457, KHÔNG bọc.
            if isinstance(status, int) and status >= 400:
                return 'SKIP_ERROR'
            # 204/205/304 không có body ⇒ không có gì để bọc.
            if isinstance(status, int) and status in (204, 205, 304):
                return 'SKIP_NOBODY'
            if not node.args:
                return 'UNVERIFIED'
            first = node.args[0]
            if isinstance(first, ast.Dict):
                if _is_dict_with(first, 'data') and _is_dict_with(first, 'meta'):
                    return 'WRAPPED'
                # F3 `{status, timestamp, request_id, data}` — đã đúng sẵn.
                if _is_dict_with(first, 'status') and _is_dict_with(first, 'timestamp'):
                    return 'SKIP_F3'
                # F4 `{object, generated_at, summary_cards, data}` — hợp đồng
                # riêng, nằm ngoài phạm vi API-02 đợt này.
                # F4 co HAI bien the: {object, ...} (identity_access) va
                # {..., generated_at} (service_ops). Chi kiem 'object' thi
                # bien thu hai rot xuong UNWRAPPED — va neu ai do boc no de lam
                # gate xanh thi tao shape khac voi identity_access.
                if _is_dict_with(first, 'object') or _is_dict_with(first, 'generated_at'):
                    return 'SKIP_F4'
                # F5 `{data, +siblings}` — bọc sẽ **làm rơi sibling**.
                # `identity_access/views_usage.py:140,205` là ví dụ thật:
                # `{group_by, data, days, start_date, end_date}`.
                if _is_dict_with(first, 'data') and len(first.keys) > 1:
                    return 'SKIP_F5_SIBLINGS'
                # Body lỗi **không** kèm `status=` (vd `{'error': 'Bad Request'}`)
                if _is_dict_with(first, 'error'):
                    return 'SKIP_ERROR'
                if _is_dict_with(first, 'message') and len(first.keys) == 1:
                    return 'SKIP_ACK_MESSAGE'
                # Giao thức callback của cổng thanh toán bên thứ ba.
                #
                # `RspCode` là trường BẮT BUỘC của VNPay IPN/return API: bọc nó
                # vào `{data, meta}` sẽ làm VNPay không đọc được phản hồi, tức
                # là **hỏng tích hợp thanh toán**.
                #
                # Bằng chứng nội tại rằng đây là giao thức máy chứ không phải REST
                # dành cho frontend: `commercial/views.py:343` trả
                # `{'RspCode': '99', 'Message': 'Internal Error: ...'}` với
                # **HTTP 200** — không REST API nào trả 200 cho lỗi nội bộ.
                #
                # Nhận diện CHÍNH bằng tên trường `RspCode` (chữ ký đặc thù), KHÔNG
                # dùng "có key `Message`" — key đó quá rộng và sẽ âm thầm bỏ sót
                # response phẳng thật.
                if _is_dict_with(first, 'RspCode'):
                    return 'SKIP_GATEWAY_PROTOCOL'
                # ACK tới webhook của bên thứ ba: `{'received': True}`.
                # Chỉ áp dụng khi `received` là key **duy nhất** — nếu có thêm
                # field khái báo dữ liệu thì đó là response thật và phải bọc.
                if _is_dict_with(first, 'received') and len(first.keys) == 1:
                    return 'SKIP_WEBHOOK_ACK'
                return 'UNWRAPPED'
            return 'UNVERIFIED'

        # `return <tên hàm khác>(...)` — không chắc là response.
        return 'UNVERIFIED'

    if isinstance(node, ast.Dict):
        if _is_dict_with(node, 'data') and _is_dict_with(node, 'meta'):
            return 'WRAPPED'
        return 'UNVERIFIED'

    return 'UNVERIFIED'


def scan(app: str):
    app_dir = SRC / app
    if not app_dir.is_dir():
        print(f'KHONG TIM THAY app: {app_dir}', file=sys.stderr)
        return 1

    rows = {'WRAPPED': [], 'UNWRAPPED': [], 'UNVERIFIED': []}
    skipped = {'SKIP_ERROR': [], 'SKIP_NOBODY': [], 'SKIP_F3': [], 'SKIP_ACK_MESSAGE': [],
               'SKIP_GATEWAY_PROTOCOL': [], 'SKIP_WEBHOOK_ACK': []}
    for path in sorted(app_dir.rglob('*.py')):
        rel = path.relative_to(SRC)
        if 'migrations' in rel.parts or 'tests' in rel.parts:
            continue
        if path.name.startswith('test_') or path.name.endswith('_test.py'):
            continue
        try:
            tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
        except SyntaxError as exc:
            print(f'LỖI CÚ PHÁP {rel}:{exc.lineno}: {exc.msg}', file=sys.stderr)
            return 1

        for node in ast.walk(tree):
            if not isinstance(node, ast.Return) or node.value is None:
                continue
            verdict = _returns_envelope(node.value)
            if verdict == 'UNVERIFIED':
                # Phải **ghi lại** rồi mới `continue`. Bản trước `continue`
                # luôn ⇒ cột UNVERIFIED **luôn in 0**, tức gate im lặng ở đúng
                # chỗ cần minh bạch nhất: những call site nó không đọc được.
                # Đó là lỗ hổng khiến lần bọc trước bỏ sót 3 file mà không
                # ai thấy.
                rows['UNVERIFIED'].append(f'{rel.as_posix()}:{node.lineno}')
                continue
            if verdict.startswith('SKIP_'):
                skipped.setdefault(verdict, []).append(
                    f'{rel.as_posix()}:{node.lineno}')
                continue
            rows[verdict].append(f'{rel.as_posix()}:{node.lineno}')

    for verdict in ('WRAPPED', 'UNWRAPPED'):
        print(f'{verdict}: {len(rows[verdict])}')
    print(f'UNVERIFIED (may, can doc tay): {len(rows["UNVERIFIED"])}')
    for key in sorted(skipped):
        print(f'{key} (co y dinh KHONG boc): {len(skipped[key])}')

    if rows['UNWRAPPED']:
        print('\nCHUA BOC — app nay co hai shape khac nhau cung luc:')
        for item in rows['UNWRAPPED']:
            print(f'  {item}')
        return 1

    print('\nOK: khong con diem nao may chung minh la chua boc.')
    return 0


# App duoc MIEN TRU co chu dich — dung contract khac, khong phai con no.
#
# `market_serving` khong theo F2: no da co `contract_version: '2.0'` rieng cho
# response pha trang co khoi `data` la **sibling**, khong phai mau mau ma F2 boc
# (`CONTRACT_DECISION.md` §quyet dinh, va B5 da loai no khoi pham vi).
#
# Khong khai bao mien tru thi gate **bao do FAIL vinh vien** cho app nay — mot
# tin hieu do sai ma nguoi doc se phai bo qua. Thay vi im lang bo qua, gate in
# ro ly do de khong ai them tinh rang no la con no.
EXEMPT_APPS = {
    'market_serving': "contract_version '2.0' rieng — data la sibling, khong phai mau F2",
}


def main():
    if len(sys.argv) < 2:
        print(f'dung: {Path(sys.argv[0]).name} <app-name> [<app-name> ...]', file=sys.stderr)
        return 2
    rc = 0
    for app in sys.argv[1:]:
        if app in EXEMPT_APPS:
            print(f'\n{"=" * 60}\napp: {app} — MIENTRU\n{"=" * 60}')
            print(f'  ly do: {EXEMPT_APPS[app]}')
            print('  KHONG ap dung gate F2 cho app nay.')
            continue
        print(f'\n{"=" * 60}\napp: {app}\n{"=" * 60}')
        rc |= scan(app)
    return rc


if __name__ == '__main__':
    raise SystemExit(main())
