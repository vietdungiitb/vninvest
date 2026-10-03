"""Chạy **toàn bộ** test của backend — kể cả phần `manage.py test` bỏ sót.

Vì sao file này tồn tại
---------------------
`python manage.py test` (không truyền label) chỉ dò được `backend/tests/`
(642 test) và **không** dò được `src/*/tests/` (2104 test). Lý do: nhiều app
đều có package tên `tests`, còn `src` không phải package, nên
`unittest.defaultTestLoader.discover()` không dò đệ quy vào được.

Hệ quả: mọi con số "full suite = 642 test" ghi trong `docs/CLAIMS.md` từ trước
tới nay — Wave 2, LED-06, API-01 — **chưa từng chạy test app**. Đây không phải
lý do để bỏ qua 2104 test đó, nên script này liệt kê label tường minh rồi chạy
đủ.

Dùng
----
    python run_tests.py                    # toàn bộ (backend/tests + src/*)
    python run_tests.py --src-only         # chỉ src/*
    python run_tests.py user_workspace     # chỉ app này
    python run_tests.py --list             # chỉ liệt kê label, không chạy

Cần `CORE_DATABASE_URL` trỏ Postgres thật — migration `9000_auth_user_email_ci_unique`
dùng `array_agg` của Postgres nên **không chạy được trên SQLite**.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
SRC = BACKEND / 'src'

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')


def _module_label(path: Path) -> str:
    parts = list(path.relative_to(SRC).parts)
    parts[-1] = parts[-1][:-len('.py')]
    if parts[-1] == '__init__':
        parts.pop()
    return '.'.join(parts)


def src_labels():
    """Mọi module test trong `src/`, theo đúng pattern của Django (`test*.py`)."""
    labels = []
    for path in sorted(SRC.rglob('test*.py')):
        if path.name == '__init__.py':
            continue
        labels.append(_module_label(path))
    return labels


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('labels', nargs='*',
                        help='module cụ thể; bỏ trống để chạy hết')
    parser.add_argument('--src-only', action='store_true',
                        help='bỏ qua backend/tests/')
    parser.add_argument('--list', action='store_true',
                        help='liệt kê label rồi thoát, không chạy test')
    args = parser.parse_args()

    labels = list(args.labels)
    if not labels:
        labels = src_labels()
        if not args.src_only:
            labels = ['tests', *labels]

    if args.list:
        print('\n'.join(labels))
        return 0

    cmd = [sys.executable, 'manage.py', 'test', '--noinput', *labels]
    print(f'>> chạy {len(labels)} label', file=sys.stderr)
    return subprocess.call(cmd, cwd=str(BACKEND))


if __name__ == '__main__':
    raise SystemExit(main())
