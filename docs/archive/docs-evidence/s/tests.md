# SEC-02 — test inventory

File: `packages/core/backend/src/user_workspace/tests/test_secret_store.py`
28 tests, all passing. Reproduce:

```powershell
cd packages/core/backend
$env:DJANGO_DEBUG="1"
$env:CORE_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/<your db>"
python manage.py test user_workspace.tests.test_secret_store -v 2 --noinput
```

Latest run: `Ran 28 tests in 7.486s / OK`.

## The six tests the spec requires

| # | Spec name | Test in this file |
|---|---|---|
| 1 | `test_encrypt_decrypt_roundtrip_v1` | `test_encrypt_decrypt_roundtrip_v1` |
| 2 | `test_decrypt_missing_version_raises` | `test_decrypt_missing_version_raises` (+ `test_decrypt_string_raises_instead_of_returning_empty`, `test_secret_key_missing_error_is_not_a_bare_value_error`) |
| 3 | `test_multi_version_coexist` | `test_multi_version_coexist` (+ the whole `KeyRotationTest` class) |
| 4 | `test_secret_not_derived_from_django_secret` | `test_secret_not_derived_from_django_secret` |
| 5 | `test_ciphertext_has_version_marker` | `test_ciphertext_has_version_marker` (+ `test_bare_fernet_token_is_treated_as_legacy`) |
| 6 | `test_no_plaintext_in_repr` | `test_no_plaintext_in_repr` (+ `test_error_message_does_not_leak_ciphertext_or_plaintext`) |

## Full inventory

`SecretStoreTest` — core behaviour

- `test_encrypt_decrypt_roundtrip_v1`
- `test_decrypt_missing_version_raises` — R4/AC1: raises, never `""`
- `test_decrypt_string_raises_instead_of_returning_empty` — the fail-open that shipped in PR #43
- `test_secret_key_missing_error_is_not_a_bare_value_error` — AC1 names the class, so callers can catch it
- `test_multi_version_coexist` — R5
- `test_secret_not_derived_from_django_secret` — R2, via `override_settings`
- `test_legacy_ciphertext_does_break_when_secret_key_rotates` — asserts the coupling SEC-02 removes is real, so nobody "fixes" it away
- `test_ciphertext_has_version_marker` — R1 envelope
- `test_bare_fernet_token_is_treated_as_legacy` — rows written before SEC-02 have no envelope
- `test_no_plaintext_in_repr` — AC4, the test the spec required and the file lacked
- `test_error_message_does_not_leak_ciphertext_or_plaintext` — R6

`KeyRotationTest` — R5/AC2, the requirement PR #43 did not implement

- `test_rotation_keeps_old_ciphertext_readable`
- `test_in_place_key_swap_at_the_same_version_orphans_rows`
- `test_dropping_retained_key_after_migration_is_safe` — PB3
- `test_rolling_forward_to_a_new_version_number` — v3 needs no code change
- `test_invalid_broker_secret_version_is_rejected`
- `test_write_version_falls_back_to_legacy_without_broker_key`

`UserBrokerConfigSecretVersionTest` — R3

- `test_secret_version_defaults_to_legacy`
- `test_set_secrets_records_legacy_version_without_broker_key`
- `test_set_secrets_records_broker_version_when_configured` — proves v2 is now actually used
- `test_get_secrets_raises_when_key_is_gone` — the second fail-open
- `test_clearing_secrets_clears_the_ciphertext`
- `test_dnsECredential_helpers_still_roundtrip` — the other broker path does not regress

`BrokerSecretKeyCheckTest` — PB1

- `test_warns_when_broker_key_missing`
- `test_warns_when_no_key_retained_for_rotation`
- `test_silent_when_key_present_and_old_key_retained`
- `test_warns_when_retained_slot_is_only_the_current_version`
- `test_check_is_a_warning_not_an_error` — an `Error` would break AC4

## Two tests in the previous file that did not test what they said

Both were replaced rather than deleted, and the reasoning is worth keeping because
they reported green:

1. **`test_secret_not_derived_from_django_secret`** assigned
   `os.environ["SECRET_KEY"] = "different-secret-key"`. Django reads
   `settings.SECRET_KEY`, not the environment, so the assignment changed nothing and
   the test would have passed even if v2 *were* derived from `SECRET_KEY`. The
   replacement uses `override_settings`, and
   `test_legacy_ciphertext_does_break_when_secret_key_rotates` pins the v1 behaviour
   from the other side so the pair cannot both be satisfied by a no-op.
2. **`test_decrypt_missing_version_raises`** asserted `ValueError`. `SecretKeyMissingError`
   did not exist, so that assertion was unfalsifiable as a specification of AC1.

## Test isolation

Every test patches `os.environ` with `mock.patch.dict(..., clear=True)`. The previous
file mutated `os.environ` directly: `setUp` set `BROKER_SECRET_KEY` and one test
`del`'d it, so whether a later test saw a configured key depended on execution order.
