"""Guard against the Django 6 removal of `timezone.utc` coming back.

Django 6.0.6 dropped `django.utils.timezone.utc` in favour of `timezone.UTC`.
Sweeping that across the tree on 2026-09-29 went wrong twice, both times for the
same underlying reason, and both times the full BE suite caught it:

  1. A substring search for "timezone.utc" cannot distinguish Django's
     `timezone.utc` from the STDLIB `datetime.timezone.utc`, which is CORRECT.
  2. It also cannot see the STDLIB imported as a bare name - `from datetime
     import datetime, timezone` binds the stdlib module to plain `timezone`, and
     `from datetime import timezone as dt_timezone` binds it to an alias. Neither
     spells the substring `datetime.timezone`, so a sweep that only protects the
     fully-qualified form rewrites both and raises
     `AttributeError: type object 'datetime.timezone' has no attribute 'UTC'`.

So the rule is not "the text timezone.utc is banned" - it is "the name `timezone`
must not be the stdlib module when `.UTC` is used". This test resolves the import
per file, which is the check that actually holds.
"""

import re
import unittest
from pathlib import Path

# src/ - this file is at src/vninvest_core/tests/, so three levels up. Getting
# this wrong silently narrows the scan to one app: the first version used
# parent.parent, never saw the files outside vninvest_core, and failed only
# because of the stdlib sanity check below.
SRC_ROOT = Path(__file__).resolve().parents[2]
SELF = Path(__file__).resolve()

# Number of STDLIB timezone uses in src/ excluding this file, measured on dev at
# 87482f4b. Proves the stdlib branch of the classifier below is actually being
# exercised, so a clean run is not vacuously clean.
# 18 -> 20 on 2026-10-04: `test_ohlcv_bars_native_api` called `timezone.UTC`
# where `timezone` was the STDLIB module, which is an AttributeError at runtime
# (9 errors). Rewritten to the aliased `dt_timezone.utc` form this file's own
# docstring calls out as correct. Intentional, so the ratchet moves up.
EXPECTED_STDLIB_USES = 20

# `from django.utils import timezone` (incl. `as`) or `import django.utils.timezone`
DJANGO_IMPORT_RE = re.compile(
    r'from\s+django\.utils\s+import\s+[^\n]*?\btimezone\b'
    r'|import\s+django\.utils\.timezone\b'
)
# `from datetime import ... timezone ...` (incl. `as alias`)
STDLIB_FROM_IMPORT_RE = re.compile(r'from\s+datetime\s+import\s+([^\n]+)')


def _python_sources():
    for path in SRC_ROOT.rglob('*.py'):
        if '__pycache__' in path.parts:
            continue
        yield path


def _is_migration(path):
    return 'migrations' in path.parts


def _stdlib_timezone_names(text):
    """Names bound to the STDLIB timezone by a `from datetime import ...`."""
    names = set()
    for m in STDLIB_FROM_IMPORT_RE.finditer(text):
        for part in m.group(1).split(','):
            token = part.strip()
            if token == 'timezone':
                names.add('timezone')
            else:
                alias = re.match(r'timezone\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$', token)
                if alias:
                    names.add(alias.group(1))
    return names


def _used_utc_names(text):
    """Every `<name>.UTC` / `<name>.utc` occurrence in the file."""
    return {m.group(1) for m in re.finditer(r'\b([A-Za-z_][A-Za-z0-9_]*)\.(?:UTC|utc)\b', text)}


class DjangoTimezoneUtcRemovedTests(unittest.TestCase):
    """`timezone.UTC` must only appear where `timezone` is Django's module."""

    def test_utc_only_on_django_timezone(self):
        offenders = []
        stdlib_uses = 0

        for path in sorted(_python_sources()):
            if path.resolve() == SELF:
                continue
            text = path.read_text(encoding='utf-8', errors='ignore')
            if '.UTC' not in text and 'timezone.utc' not in text:
                continue
            if _is_migration(path):
                # An applied migration is history. Rewriting it would change the
                # meaning of a schema that is already deployed.
                continue

            rel = path.relative_to(SRC_ROOT).as_posix()
            stdlib_names = _stdlib_timezone_names(text)
            is_django = bool(DJANGO_IMPORT_RE.search(text))
            names = _used_utc_names(text)

            # `import datetime` + `datetime.timezone.utc` - the qualified form.
            for m in re.finditer(r'\bdatetime\.timezone\.(UTC|utc)\b', text):
                stdlib_uses += 1
                if m.group(1) == 'UTC':
                    offenders.append(
                        f'{rel}: datetime.timezone.UTC does not exist '
                        f'(the stdlib spelling is datetime.timezone.utc)'
                    )

            for name in sorted(names):
                if name in stdlib_names:
                    # Bound to the stdlib module: `.utc` is correct, `.UTC` is not.
                    stdlib_uses += 1
                    if f'{name}.UTC' in text:
                        offenders.append(
                            f'{rel}: {name}.UTC but {name} is the STDLIB timezone, '
                            f'which has no UTC attribute (it is {name}.utc)'
                        )
                elif name == 'timezone':
                    # The bare name is Django's module, so `.utc` is the removed
                    # spelling. The check has to be on the BARE name: a file may
                    # hold both `timezone.utc` (Django, wrong) and
                    # `datetime.timezone.utc` (stdlib, right) side by side, and
                    # the qualified form must not mask the bare one.
                    if is_django and re.search(r'(?<![\w.])timezone\.utc\b', text):
                        offenders.append(
                            f'{rel}: timezone.utc was removed in Django 6.0.6 '
                            f'(use timezone.UTC)'
                        )
                    elif not is_django and 'timezone.UTC' in text:
                        offenders.append(
                            f'{rel}: timezone.UTC but timezone is not imported from '
                            f'django.utils - check which module it is bound to'
                        )

        self.assertEqual(
            offenders,
            [],
            'Django 6.0.6 removed django.utils.timezone.utc (use timezone.UTC), but '
            'the STDLIB timezone has no .UTC (it is .utc). Fix the binding, not the '
            'spelling:\n  ' + '\n  '.join(offenders),
        )
        self.assertEqual(
            stdlib_uses,
            EXPECTED_STDLIB_USES,
            f'stdlib timezone uses changed from {EXPECTED_STDLIB_USES} to {stdlib_uses}. '
            'If they were rewritten or removed, update EXPECTED_STDLIB_USES after '
            'confirming it was intentional - otherwise this test may be passing '
            'because the classifier stopped finding the stdlib cases.',
        )
