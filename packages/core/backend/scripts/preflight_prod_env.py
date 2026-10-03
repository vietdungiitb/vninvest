"""BL-11: pre-deployment env validation matrix.

Runs `manage.py check` in prod mode (DJANGO_DEBUG=false) under manipulated
environments. Each case asserts exit code + message fragment. Secrets are
never printed (only presence/absence and fragments are logged).

Exit 0 = matrix all green. Exit 1 = first failing case (named, no secrets).
"""
import os
import subprocess
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANAGE = os.path.join(BACKEND_DIR, 'manage.py')
VENV_PY = os.path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe')
PYTHON = VENV_PY if os.path.exists(VENV_PY) else sys.executable

BASE = {
    'DJANGO_DEBUG': 'false',
    'DJANGO_SECRET_KEY': 'x' * 50,
    'DJANGO_ALLOWED_HOSTS': 'example.com',
    'CORS_ALLOWED_ORIGINS': 'https://example.com',
    'CSRF_TRUSTED_ORIGINS': 'https://example.com',
    'FRONTEND_URL': 'https://example.com',
    'CORE_PAT_PEPPER': 'pepper',
    'CORE_DATABASE_URL': 'sqlite:///preflight.sqlite3',
    'REDIS_URL': 'redis://localhost:6379/1',
}

CASES = [
    # (name, env overrides (None = delete), expect_exit, expect_fragment or None)
    ('full-valid-env', {}, 0, 'no issues'),
    ('missing-ALLOWED_HOSTS', {'DJANGO_ALLOWED_HOSTS': None}, 1, 'DJANGO_ALLOWED_HOSTS'),
    ('missing-SECRET_KEY', {'DJANGO_SECRET_KEY': None}, 1, 'DJANGO_SECRET_KEY'),
    ('missing-PAT_PEPPER', {'CORE_PAT_PEPPER': None}, 1, 'CORE_PAT_PEPPER'),
    ('missing-FRONTEND_URL', {'FRONTEND_URL': None}, 1, 'FRONTEND_URL'),
    ('insecure-SSL_REDIRECT', {'DJANGO_SECURE_SSL_REDIRECT': 'false'}, 1, 'must be true in production'),
    ('insecure-SESSION_COOKIE', {'DJANGO_SESSION_COOKIE_SECURE': '0'}, 1, 'must be true in production'),
]


def run_case(name, overrides, expect_exit, expect_fragment):
    env = dict(BASE)
    for k, v in overrides.items():
        if v is None:
            env.pop(k, None)
        else:
            env[k] = v
    # Scrub real process env: only pass our matrix (plus PATH/SYSTEMROOT for Windows).
    clean = {'PATH': os.environ.get('PATH', ''), 'SYSTEMROOT': os.environ.get('SYSTEMROOT', '')}
    clean.update(env)
    proc = subprocess.run(
        [PYTHON, MANAGE, 'check'], env=clean, capture_output=True, text=True, timeout=120,
    )
    out = (proc.stdout + proc.stderr)[-1500:]
    ok = proc.returncode == expect_exit and (expect_fragment is None or expect_fragment in out)
    print(f"[{'PASS' if ok else 'FAIL'}] {name} (exit={proc.returncode}, want={expect_exit})")
    if not ok:
        print(f"  fragment_want={expect_fragment!r}\n  tail={out[-500:]!r}")
    return ok


def main():
    results = [run_case(*c) for c in CASES]
    print(f"preflight: {sum(results)}/{len(results)} cases green")
    return 0 if all(results) else 1


if __name__ == '__main__':
    sys.exit(main())
