"""Dump the backend URLconf into a manifest the frontend contract test can read.

Why
---
`packages/web/src/adapters/core/__tests__/route-contract.test.js` asserts every
adapter path resolves to a route this project actually serves. 32 methods used
to point at routes that did not exist and nothing noticed: each had no call site,
and no check compared adapter paths to the URLconf.

Usage
-----
    python scripts/dump-core-route-manifest.py

Run from `packages/core/backend`, with the same env the tests use (needs
CORE_DATABASE_URL pointing at Postgres). Re-run whenever a urls.py changes; the
regenerated file is committed so CI needs no Django.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
# BACKEND = packages/core/backend, so two parents up is `packages/`.
OUT = (
    BACKEND.parent.parent
    / 'web'
    / 'src'
    / 'adapters'
    / 'core'
    / '__tests__'
    / 'core-route-manifest.json'
)

sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / 'src'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django  # noqa: E402

django.setup()
from django.urls import get_resolver  # noqa: E402
from django.urls.resolvers import RegexPattern  # noqa: E402

CORE_BASE = '/core/v1'


def clean_regex(pattern: str) -> str:
    """Turn a `re_path` regex into the same shape `path()` produces."""
    out = re.sub(r'\(\?P<(\w+)>[^)]*\)', r'<\1>', pattern)
    out = out.lstrip('^').rstrip('$')
    return out.replace('?', '')


def collect() -> set[str]:
    routes: set[str] = set()

    def walk(resolver, prefix=''):
        for entry in resolver.url_patterns:
            pattern = prefix + str(entry.pattern)
            if hasattr(entry, 'url_patterns'):
                walk(entry, pattern)
                continue
            if isinstance(entry.pattern, RegexPattern):
                pattern = prefix + clean_regex(entry.pattern.regex.pattern)
            routes.add('/' + pattern.lstrip('/'))

    walk(get_resolver())
    return routes


def main() -> int:
    routes = collect()
    core = sorted(r for r in routes if r == CORE_BASE or r.startswith(f'{CORE_BASE}/'))
    public = sorted(r for r in routes if r.startswith('/api/public/'))

    payload = {
        '_comment': (
            'Generated from Django URLconf. Do not hand-edit: run '
            'packages/core/backend/scripts/dump-core-route-manifest.py. '
            'Asserted by route-contract.test.js so an adapter path can never '
            'point at a route the backend does not serve.'
        ),
        'core_base': CORE_BASE,
        'core': core,
        'public': public,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'core={len(core)} public={len(public)} -> {OUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())