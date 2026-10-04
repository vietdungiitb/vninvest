#!/usr/bin/env python
"""Cong ngan sach schema OpenAPI — chan thoai lui, khong chan no san.

## Vay sao khong dung `--fail-on-warn` the nao

`manage.py spectacular` hien bao **1090 loi (202 unique)** va **184 canh bao**, va
**exit 0**. Nghia la khong cong nao bat duoc con so nay, va no se tang vo han.

Neu noi `--fail-on-warn` vao gate ngay, gate se **do ngay** va chan moi push cho
den khi sua het **190 operation** chua co schema — cong do la cong viec nhieu
phien, khong lam duoc trong mot dot. Mot cong do chan moi thay doi la cong khong
duoc dung.

## Vay sao lai dung ngan sach

Cong nay **chan REGRESSION**, khong chan **no san**:

| Tinh huong | Hanh dong |
|---|---|
| So loi **tang** so voi baseline | **FAIL** — bi chay, dung y ngay |
| Bang baseline | PASS, in `0 tang` |
| Be hon baseline (da sua them) | PASS, **de xuot baseline len** |
| Khong co file baseline | FAIL — khong cho phép "chua do" |

Nhu vay con so 1090 duoc ghi lai mot lan, mot do chay thi co the giam dan ma
khong phai moi thay doi lai do lai.

## Baseline

`scripts/openapi-schema-baseline.json`. **Phai commit ca hai cung nhau** — doi
mot khong doi cai khac thi gate fail ngay voi thong diep ro rang.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
BASELINE_PATH = HERE / 'openapi-schema-baseline.json'

SUMMARY_ERR = re.compile(r'^Errors:\s+(\d+)\s+\((\d+) unique\)', re.M)
SUMMARY_WARN = re.compile(r'^Warnings:\s+(\d+)\s+\((\d+) unique\)', re.M)

# Biến môi trường giả - spectacular chạy cần Django settings, nhưng gate này
# chỉ cần **sinh schema**, không cần DB thật. Đặt ở đây để lệnh gọi từ gate và
# lệnh gọi tay cho cùng kết quả.
FAKE_ENV = {
    'DJANGO_DEBUG': 'true',
    'DJANGO_SECRET_KEY': 'openapi-budget-gate-not-a-real-key-000000000',
    'CORE_PAT_PEPPER': 'openapi-budget-gate-pepper-000000000000',
}


def measure() -> tuple[int, int, int, int]:
    import os

    env = {**os.environ, **FAKE_ENV}
    proc = subprocess.run(
        [sys.executable, 'manage.py', 'spectacular', '--file', os.devnull],
        cwd=str(HERE.parent), env=env, capture_output=True, text=True,
    )
    blob = (proc.stdout or '') + '\n' + (proc.stderr or '')
    m_err, m_warn = SUMMARY_ERR.search(blob), SUMMARY_WARN.search(blob)
    if not m_err or not m_warn:
        sys.stderr.write('KHONG DOC DUOC so lieu spectacular - khong dua ra ket luan\n')
        sys.stderr.write(blob[-1500:])
        sys.exit(2)
    return int(m_err.group(1)), int(m_err.group(2)), int(m_warn.group(1)), int(m_warn.group(2))


def main() -> int:
    errs, errs_uq, warns, warns_uq = measure()

    if not BASELINE_PATH.exists():
        print('FAIL: thieu baseline', BASELINE_PATH)
        print(f'  do duoi: Errors={errs} ({errs_uq} unique), Warnings={warns}')
        print('  tao file baseline truoc khi merge, de so nay bat bien khong the')
        print('  tu "chua do" thanh "da do".')
        return 1

    base = json.loads(BASELINE_PATH.read_text(encoding='utf-8'))

    print(f'do:   Errors={errs} ({errs_uq} unique)  Warnings={warns} ({warns_uq} unique)')
    print(f'base: Errors={base["errors"]} ({base["errors_unique"]} unique)'
          f'  Warnings={base["warnings"]} ({base["warnings_unique"]} unique)')

    grew = (
        errs > base['errors']
        or errs_uq > base['errors_unique']
        or warns > base['warnings']
        or warns_uq > base['warnings_unique']
    )

    if grew:
        print('FAIL: schema XAU DI — so loi tang so voi baseline.')
        print('      Moi endpoint bo schema se khong ai thay neu con so nay khong bi chan.')
        return 1

    if errs == base['errors'] and warns == base['warnings']:
        print('OK: bang baseline, khong tang.')
    else:
        print('OK: BE HON baseline — nen ha baseline xuong bang so moi.')
    print(f'NO CON: Errors={errs}, Warnings={warns}')
    print('      (no san, da ghi ro. Sua them roi ha baseline trong file JSON.)')
    return 0


if __name__ == '__main__':
    sys.exit(main())