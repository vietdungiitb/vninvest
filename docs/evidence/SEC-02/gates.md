# SEC-02 gates — evidence

Slice: `sec02b-multi-version-keys` · branch `feat/sec02b-multi-version-keys`
Date: 2026-09-28 · Postgres `127.0.0.1:5433` (16.13), database `sec02b_verify`.

All commands were run from `packages/core/backend` with:

```powershell
$env:DJANGO_DEBUG="1"
$env:CORE_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/sec02b_verify"
```

> The user is `vninvest`. An earlier run in this slice reported
> "password authentication failed" because the URL said `vninstall` — recorded
> because it produced a *plausible* symptom (Postgres unreachable) for what was a
> typo.

## GT6 — `manage.py check`

```
$ python manage.py check
System check identified no issues (0 silenced).
exit=0
```

Also asserted by a test: the new rotation check is a `Warning`, never an `Error`,
because an `Error` would make this gate non-zero wherever `BROKER_SECRET_KEY` is
absent and contradict AC4.

## GT7 — migration + model

```
$ python manage.py makemigrations user_workspace
Migrations for 'user_workspace':
  src\user_workspace\migrations\0020_userbrokerconfig_secret_version.py
    + Add field secret_version to userbrokerconfig

$ python manage.py makemigrations --check --dry-run
No changes detected
exit=0
```

Numbering was produced by `makemigrations`, not chosen by hand, per AGENTS.md.
`makemigrations --check` returning clean afterwards is the proof that the model
and the migration state agree — a hand-written migration would not satisfy it.

## GT8 — Postgres

```
PostgreSQL 16.13
array_agg available: True        # SQLite is not an option: migration
                                 # identity_access/9000 uses array_agg
$ python manage.py migrate
 Applying user_workspace.0020_userbrokerconfig_secret_version... OK
exit=0
```

## GT9 — backend tests

Targeted suite:

```
$ python manage.py test user_workspace.tests.test_secret_store -v 1 --noinput
Ran 28 tests in 7.486s
OK
exit=0
```

Full suite:

```
$ python manage.py test --noinput
Ran 642 tests in 870.639s
FAILED (failures=11, errors=2)
```

**The 11 failures and 2 errors are pre-existing and are not caused by this slice.**
They were verified by running the same six modules on the clean `dev` tree with no
changes from this branch:

```
$ python manage.py test tests.test_audit_logs_api tests.test_quota_period_accumulation \
    tests.test_scheduler_management_commands tests.test_session_facts_api \
    tests.test_stock_management_api_routes tests.test_admin_route --noinput
Ran 72 tests in 58.166s
FAILED (failures=11, errors=2)
```

Identical names, identical counts, on a tree that does not contain this work.

A third error appeared in an earlier run — `test_admin_login_page_is_servable`,
`ValueError: Missing staticfiles manifest entry for 'admin/css/base.css'`. That was
**not** a regression either: `STATIC_ROOT` is `backend/src/staticfiles`, which holds
a `collectstatic` artifact that is untracked (0 tracked files), so a fresh worktree
does not have it. Copying the artifact from the main tree made the test pass with no
code change. Recorded because "642 / 11 / 3" is the number a reader would otherwise
see and it is wrong.

## GT14 — claim

`docs/CLAIMS.md`, row `sec02b-multi-version-keys`, committed **before** the first
line of code (commit `2054fe56`). `check-multi-agent` passes with 0 errors and
produces no warning for this row.

## Acceptance criteria (spec §4)

| AC | Result | Where |
|---|---|---|
| AC1 missing key version raises `SecretKeyMissingError`, never `""` | PASS | `test_decrypt_missing_version_raises`, `test_decrypt_string_raises_instead_of_returning_empty` |
| AC2 changing the key keeps old ciphertext readable | PASS | `test_rotation_keeps_old_ciphertext_readable` |
| AC3 grep `log.*secret\|print.*secret` in the encryption module → 0 hits | PASS | 0 hits, re-verified with a case-insensitive scan reading the file as source |
| AC4 `manage.py check` 0 issues; ≥6 tests, all pass | PASS | GT6 above; 28 tests |

## Spec test table (spec §6)

All six required tests exist. Two of them were **not** actually testing what they
claimed, and were rewritten:

| # | Test | Note |
|---|---|---|
| 1 | `test_encrypt_decrypt_roundtrip_v1` | was present, still valid |
| 2 | `test_decrypt_missing_version_raises` | was present but asserted bare `ValueError`; now asserts the named `SecretKeyMissingError` |
| 3 | `test_multi_version_coexist` | was present but only v1+v2 with one key each — the thing R5 is about; now covered by real rotation tests |
| 4 | `test_secret_not_derived_from_django_secret` | **was fake**: it assigned `os.environ["SECRET_KEY"]`, which Django never reads. Now uses `override_settings` and actually proves independence |
| 5 | `test_ciphertext_has_version_marker` | was present, still valid |
| 6 | `test_no_plaintext_in_repr` | **was missing entirely**; added |
