"""
Case-insensitive unique constraint on ``auth_user.email``.

``AUTH_USER_MODEL`` is not set in this project, so ``User`` is the stock
``auth_user`` table and ``email`` carries only a plain index -- no uniqueness.
Two concurrent registrations for the same address therefore both pass the
application-level ``.exists()`` check and both insert. After that, every
``User.objects.get(email__iexact=...)`` raises ``MultipleObjectsReturned``,
which is not caught by the surrounding ``except User.DoesNotExist`` handlers, and
the endpoint surfaces a 500.

This migration is deliberately placed in ``vninvest_core`` rather than in
``identity_access`` because the table belongs to ``django.contrib.auth`` and
``identity_access`` does not declare a dependency on the app that owns the user.

Two things this must get right, both of which are easy to miss:

1. **Partial index.** ``auth.User.email`` is ``blank=True`` and defaults to the
   empty string, and a plain ``UNIQUE (lower(email))`` breaks the instant two
   service or legacy accounts exist with an empty address -- which is a normal
   state, not corruption. Hence the ``WHERE email IS NOT NULL AND email <> ''``
   predicate.

2. **Pre-flight.** Creating the index fails outright when duplicates already
   exist. This does NOT silently rewrite or null anybody's address -- that is not
   a migration's job -- it aborts with an actionable message so a human decides.
   ``RunPython`` runs the check; the pre-flight SELECT is also printed in the
   error so the operator does not have to go find it.

Every call site is already defensive meanwhile (``identity_access.security_utils``
resolves a duplicate email deterministically to the lowest primary key), so this
migration closes the race without being load-bearing for correctness of any single
request.
"""

from django.db import migrations

FIND_DUPLICATES = """
SELECT lower(email) AS dup_email, count(*) AS n,
       array_agg(id ORDER BY id) AS ids
FROM auth_user
WHERE email IS NOT NULL AND email <> ''
GROUP BY lower(email)
HAVING count(*) > 1
ORDER BY n DESC, dup_email;
"""

CREATE_INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_lower_uniq
    ON auth_user (lower(email))
    WHERE email IS NOT NULL AND email <> '';
"""

DROP_INDEX = "DROP INDEX IF EXISTS auth_user_email_lower_uniq;"


def preflight_deduplicate(apps, schema_editor):
    """Abort loudly instead of corrupting somebody's address."""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(FIND_DUPLICATES)
        duplicates = cursor.fetchall()
        if duplicates:
            raise RuntimeError(
                "Cannot create a unique index on lower(auth_user.email): "
                f"{len(duplicates)} duplicated address(es) already exist. "
                "Resolve them by hand first (keep the lowest id; correct or blank "
                "the rest), then re-run migrate. Detection query:\n" + FIND_DUPLICATES
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        # Must be explicit: 0028 is the current leaf of this app, and without this
        # line the migration graph has two leaves and `migrate` refuses to run
        # ("Conflicting migrations detected; multiple leaf nodes").
        ("identity_access", "0028_coreserviceaccount_uniq_core_service_account_tenant_name"),
    ]

    operations = [
        migrations.RunPython(preflight_deduplicate, noop),
        migrations.RunSQL(CREATE_INDEX, DROP_INDEX),
    ]
