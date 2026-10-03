# SEC-02 — answers to the required rebuttals

Spec: `docs/PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md`, section 5.

## PB1 — `BROKER_SECRET_KEY` missing in production: raise at import, or fail only at decrypt?

**Answer: neither, and that is the point of the third option.**

Raising at import would take down every endpoint, health check, migration and
background worker in a deployment that simply has no broker credentials configured
yet. The blast radius would be the whole application in order to protect an optional
feature. `settings.py` already refuses to boot without `DJANGO_SECRET_KEY` and
`CORE_PAT_PEPPER`, so the failure mode exists in this codebase — and for a broker key
it would be the wrong trade, because broker integration is opt-in per user.

But PB1 also says failing only at decrypt is not enough, because "the next request
is uncontrolled". That part is correct and it is the part that was actually broken:
`decrypt_string` caught the error and returned `""`, so a broker credential whose key
had gone missing surfaced as *blank credentials*, not as a fault. `UserBrokerConfig.get_secrets`
had the same shape, returning `{}` — which reads as "this user never configured a
broker". Two silent states where there should have been one loud one.

So the resolution is three layers:

1. **Fail closed at the point of use.** `SecretKeyMissingError` (a named type, not a
   bare `ValueError`) propagates out of `decrypt`, `decrypt_string` and
   `get_secrets`. No path returns an empty plaintext for a non-empty ciphertext.
2. **Visible before the first request.** A Django system check
   (`check_broker_secret_key_rotation`, `vninvest_core.W003`) reports the missing key
   at boot, and a second (`W004`) reports the case where `BROKER_SECRET_KEY` is set but
   no older key is retained — i.e. the operator is one rotation away from stranding
   rows and has not been told.
3. **A `Warning`, not an `Error`.** Matching the existing `TURNSTILE_SECRET_MISSING`
   precedent in the same file: an `Error` would also make `manage.py check` non-zero in
   every environment lacking the variable, which AC4 requires to be clean. The
   `Error`-vs-`Warning` distinction in this file is deliberate and the comment at the
   top of `checks.py` says why.

## PB2 — are there other places still calling `Fernet(SECRET_KEY)` for broker secrets?

**Grepped the whole backend. There are four separate Fernet call sites, and only two
of them are on the broker path.**

| Location | What it is | Broker? |
|---|---|---|
| `vninvest_core/utils/encryption.py` | `SecretStore` — the SEC-02 subject | **yes** |
| `vninvest_core/utils/crypto.py:22` | unrelated helper | no |
| `identity_access/security.py:27,40` | unrelated helper | no |
| `identity_access/models.py:879-897` (`_get_fernet`) | mail/other credential cipher | no |

Broker secrets reach `SecretStore` through two model helpers, both confirmed by
reading the call sites:

- `UserBrokerConfig.set_secrets` / `get_secrets` (`user_workspace/models.py:598-613`)
- `DNSECredential.set_client_id` / `set_client_secret` (`:484-498`)

**The finding that matters: neither reached v2 before this slice.** Both call
`encrypt_string`, which pinned `version=1` — the key derived from `SECRET_KEY`. So
`BROKER_SECRET_KEY` existed in the code and was called by nobody, and broker secrets
were *still* bound to `SECRET_KEY` after PR #43 merged. That is the exact 90% risk in
the spec, and R2 was written but not wired.

`encrypt_string` now resolves the write version through the store, so these paths use
`BROKER_SECRET_KEY` whenever it is configured.

Two related paths were deliberately left alone:

- `DNSECredential` has no version column, so its rows cannot be listed for
  re-encryption. The spec scopes R3 to `UserBrokerConfig`; the class docstring says
  the two DNSE stores are being merged, so adding a column to the legacy model would
  be throwaway work. Noted as remaining scope, not done.
- `rotate_mail_credential_key.py` is a separate rotation script for mail credentials
  and is unaffected.

## PB3 — add a new key version, then delete the old one: is old ciphertext still readable?

**Only if it was re-encrypted first. This slice makes both orderings testable, and
the failing order fails loudly rather than silently.**

Covered by three tests in `KeyRotationTest`:

- `test_rotation_keeps_old_ciphertext_readable` — new key at a new version, old key
  retained: the old row still reads, new writes use the new key (AC2).
- `test_dropping_retained_key_after_migration_is_safe` — re-encrypt, then drop the
  retained key: the migrated row reads, the un-migrated row raises.
- `test_in_place_key_swap_at_the_same_version_orphans_rows` — the trap this design
  closes, asserted deliberately.

**Rotation procedure, and the constraint that makes it safe:**

1. Set `BROKER_SECRET_KEY` to the new key material and `BROKER_SECRET_VERSION` to a new
   number (default 2, so use 3, 4, …).
2. Keep the previous version's key in `BROKER_SECRET_KEY_V<old version>` so existing
   rows still decrypt.
3. Re-encrypt the rows: `SecretStore().reencrypt(cipher_text)`.
4. Only then remove `BROKER_SECRET_KEY_V<old version>`.

Replacing the key material *in place at the same version number is not supported and
must not be**: the live key always wins for the current version, so an in-place swap
orphans every existing row. The first version of this code got the resolution order
backwards — the retained slot shadowed the live key — and
`test_dropping_retained_key_surfaces_the_fault` caught it. That is recorded here
because the bug looked like a passing rotation until you dropped the key.

`W004` deliberately does **not** count `BROKER_SECRET_KEY_V<current>` as a retained
key, since that slot protects nothing and would report a safe path that does not exist.

## Known limitation, stated rather than hidden

This slice makes the mechanism correct and makes rotation possible. It does **not**
by itself remove the `SECRET_KEY` coupling from data that already exists: no rows were
re-encrypted. `secret_version` defaults to 1, which is the truth for every pre-existing
row, so the position is accurate and the operator can now find and migrate them:

```sql
SELECT secret_version, count(*) FROM user_workspace_userbrokerconfig
WHERE secrets_cipher <> '' GROUP BY 1;
```

A data migration cannot be a schema migration here — it needs the target key to exist
at migrate time, and running it in a deployment where `BROKER_SECRET_KEY` is not yet
set would destroy the rows it was meant to migrate. It stays an operator step, guarded
by the re-encrypt tests above.
