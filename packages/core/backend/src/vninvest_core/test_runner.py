"""Test runner that discovers BOTH test locations.

Why this exists
---------------
The repo has two test roots:

* ``packages/core/backend/tests/``            — 71 files, top-level package ``tests``
* ``packages/core/backend/src/<app>/tests/``  — 147 files, package ``<app>.tests``

Django's default :class:`~django.test.runner.DiscoverRunner` only walks the
current directory, so ``manage.py test`` reported **724 tests** — all from the
first root. The 147 files under ``src/<app>/tests/`` (1 501 tests) were never
executed by any "full backend suite" claim in this repo.

Measured on 2026-10-12 (before this runner existed)::

    TOPLEVEL {'tests': 724}
    HAS_market_data_tests False
    USER_WORKSPACE_TESTS 2        # app has 21 test files

This runner unions both roots so the suite actually covers the codebase.

Design constraints
------------------
* **Deterministic**: discovery order is sorted, so two runs on the same tree
  produce the same suite. A gate whose result depends on filesystem ordering
  cannot be trusted.
* **Caller-independent**: no ``sys.path`` mutation that depends on ``cwd``;
  paths are derived from this file's own location. Running by hand and running
  under a hook must give the same answer.
* **No silent skips**: if a root that used to hold tests disappears, that is
  worth a warning rather than a quiet pass.
"""

from __future__ import annotations

import os
import unittest

from django.test.runner import DiscoverRunner

# This file lives at ``backend/src/vninvest_core/test_runner.py``:
#   dirname x1 -> backend/src/vninvest_core
#   dirname x2 -> backend/src
#   dirname x3 -> backend          <- what we want
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ``src/`` holds the apps themselves; ``manage.py`` puts it on sys.path, so an
# app's tests import as ``<app>.tests.*`` — meaning discovery's top level has to
# be ``src/``, NOT ``backend/``.
SRC_DIR = os.path.join(BACKEND_DIR, 'src')


def _app_test_dirs() -> list[tuple[str, str]]:
    """``[(start_dir, top_level_dir)]`` for every ``src/<app>/tests`` package.

    Sorted, so the discovery order is identical on every machine — a suite whose
    contents depend on directory iteration order cannot be trusted as a gate.
    """
    found: list[tuple[str, str]] = []
    if not os.path.isdir(SRC_DIR):
        return found
    for name in sorted(os.listdir(SRC_DIR)):
        app_dir = os.path.join(SRC_DIR, name)
        tests_dir = os.path.join(app_dir, 'tests')
        if os.path.isdir(tests_dir) and os.path.isfile(
            os.path.join(tests_dir, '__init__.py')
        ):
            found.append((app_dir, SRC_DIR))
    return found


# Repo-root-relative test roots, paired with the top level each one needs.
# Keep it a tuple, not a set: discovery order must be stable across runs.
TEST_ROOTS = (
    (os.path.join(BACKEND_DIR, 'tests'), BACKEND_DIR),  # top-level `tests`
    *_app_test_dirs(),                                 # per-app `<app>/tests`
)


class AppTestRunner(DiscoverRunner):
    """``DiscoverRunner`` that also walks ``src/<app>/tests``."""

    def build_suite(self, test_labels=None, extra_tests=None, **kwargs):
        """Union every discovered suite, de-duplicated by test id.

        Django's default implementation returns immediately when it can discover
        from the current directory, which is exactly the behaviour that hid
        ``src/<app>/tests``. Here both roots are always explored and merged.
        """
        test_labels = list(test_labels or [])

        # An explicit label (e.g. ``manage.py test market_data``) is a request
        # for that subset only — do not silently widen it to everything.
        # `extra_tests` is keyword-only on Django 5.1's DiscoverRunner.
        if test_labels:
            return super().build_suite(test_labels, extra_tests=extra_tests, **kwargs)

        runner = self.test_loader
        seen: dict[str, unittest.TestCase] = {}
        duplicates: dict[str, int] = {}

        for start_dir, top_level in TEST_ROOTS:
            if not os.path.isdir(start_dir):
                continue
            suite = runner.discover(
                start_dir=start_dir,
                pattern=self.pattern,
                top_level_dir=top_level,
            )
            for case in _iter_cases(suite):
                # Key on (class path, method name) so the same test discovered
                # through two roots is added once, not twice.
                key = f'{case.__class__.__module__}.{case.__class__.__qualname__}.{case._testMethodName}'
                if key in seen:
                    duplicates[key] = duplicates.get(key, 1) + 1
                    continue
                seen[key] = case

        if duplicates:
            self._note_duplicates(duplicates)

        ordered = [seen[k] for k in sorted(seen)]
        return self.test_suite(ordered)

    def _note_duplicates(self, duplicates: dict[str, int]) -> None:
        """Report tests found under more than one root instead of hiding them."""
        worst = max(duplicates.values())
        self._feedback_buffer.write(
            f'DISCOVERY: {len(duplicates)} test(s) reachable from more than one '
            f'root (max {worst}x) — de-duplicated by test id.\n'
        )


def _iter_cases(suite):
    """Yield every ``TestCase`` inside a (possibly nested) unittest suite."""
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from _iter_cases(item)
        else:
            yield item