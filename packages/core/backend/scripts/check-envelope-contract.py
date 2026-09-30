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


def _returns_envelope(node: ast.expr) -> str:
    """Phân loại giá trị trả về."""
    # `Response(envelope(x))` → đã bọc
    if isinstance(node, ast.Call):
        name = getattr(node.func, 'id', '') or getattr(node.func, 'attr', '')
        if any(name == w or name.endswith(f'_{w}') for w in WRAPPER_NAMES):
            return 'WRAPPED'
        if name in RETURNERS:
            args = node.args
            if not args:
                return 'UNVERIFIED'
            first = args[0]
            if _is_dict_with(first, 'data') and _is_dict_with(first, 'meta'):
                return 'WRAPPED'
            if _is_dict_with(first, 'data'):
                # Có `data` nhưng thiếu `meta` ⇒ không phải envelope F2.
                return 'UNWRAPPED'
            if isinstance(first, ast.Dict):
                return 'UNWRAPPED'
            return 'UNVERIFIED'
    if isinstance(node, ast.Dict):
        if _is_dict_with(node, 'data') and _is_dict_with(node, 'meta'):
            return 'WRAPPED'
        return 'UNWRAPPED'
    return 'UNVERIFIED'


def scan(app: str):
    app_dir = SRC / app
    if not app_dir.is_dir():
        print(f'KHONG TIM THAY app: {app_dir}', file=sys.stderr)
        return 1

    rows = {'WRAPPED': [], 'UNWRAPPED': [], 'UNVERIFIED': []}
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
                continue
            rows[verdict].append(f'{rel.as_posix()}:{node.lineno}')

    for verdict in ('WRAPPED', 'UNWRAPPED'):
        print(f'{verdict}: {len(rows[verdict])}')
    print(f'UNVERIFIED (may, can doc tay): {len(rows["UNVERIFIED"])}')

    if rows['UNWRAPPED']:
        print('\nCHUA BOC — app nay co hai shape khac nhau cung luc:')
        for item in rows['UNWRAPPED']:
            print(f'  {item}')
        return 1

    print('\nOK: khong con diem nao may chung minh la chua boc.')
    return 0


def main():
    if len(sys.argv) < 2:
        print(f'dung: {Path(sys.argv[0]).name} <app-name> [<app-name> ...]', file=sys.stderr)
        return 2
    rc = 0
    for app in sys.argv[1:]:
        print(f'\n{"=" * 60}\napp: {app}\n{"=" * 60}')
        rc |= scan(app)
    return rc


if __name__ == '__main__':
    raise SystemExit(main())
