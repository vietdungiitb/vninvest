"""Re-encrypt stored broker secrets onto the current key version.

SEC-02 added the mechanism for this: `SecretStore.reencrypt` plus
`UserBrokerConfig.secret_version`. What it did not add is a way to actually run
the migration, which is why broker credentials written before the change are
still encrypted with a key derived from `DJANGO_SECRET_KEY` - so rotating
`DJANGO_SECRET_KEY` today still destroys every stored broker credential. This
command is the missing half.

Safety properties, in priority order:

* **Dry run by default.** Nothing is written without ``--apply``. A migration you
  cannot preview is a migration you should not run.
* **Fail closed.** If the target key is not configured, the command refuses before
  touching a single row rather than writing ciphertext nobody can read back.
* **Loud on undecryptable rows.** A row whose key is missing is reported and the run
  aborts. Skipping it would leave a hole while reporting success, which is the exact
  failure mode that made the previous `except: return ''` behaviour dangerous.
* **Idempotent.** Rows already on the target version are counted, not rewritten.
* **Narrow writes.** Only ``secrets_cipher``, ``secret_version`` and ``updated_at``
  are saved, so a concurrent edit to another column is not clobbered.

Rotation order is documented in ``docs/evidence/SEC-02/pb-answers.md``: bump
``BROKER_SECRET_VERSION``, keep the old key in ``BROKER_SECRET_KEY_V<old>``, run this,
then drop the retained key.
"""

from __future__ import annotations

import json
from collections import Counter
from typing import Dict

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from user_workspace.models import UserBrokerConfig
from vninvest_core.utils.encryption import SecretKeyMissingError, SecretStore


class Command(BaseCommand):
    help = (
        "Re-encrypt UserBrokerConfig.secrets_cipher onto the current key version. "
        "Dry run unless --apply is passed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually write. Without this flag nothing is modified.",
        )
        parser.add_argument(
            "--target-version",
            type=int,
            default=None,
            help="Key version to write (default: the current BROKER_SECRET_VERSION).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N rows (0 = no limit). Useful for a first canary run.",
        )

    # ── reporting ───────────────────────────────────────────────────────
    def _version_histogram(self) -> Dict[int, int]:
        counts: Counter = Counter()
        rows = UserBrokerConfig.objects.exclude(secrets_cipher="").values_list(
            "secrets_cipher", flat=True
        )
        store = SecretStore()
        for cipher in rows.iterator():
            try:
                counts[store.version_of(cipher)] += 1
            except SecretKeyMissingError:
                counts[-1] += 1
        return dict(sorted(counts.items()))

    def _report_dns_credential_exposure(self) -> None:
        """DNSECredential holds broker secrets too, but has no version column.

        Reported rather than migrated: adding a version column to a model the
        codebase is already consolidating away would be throwaway work, and this
        command must not pretend the blast radius is smaller than it is.
        """
        from user_workspace.models import DNSECredential

        pending = DNSECredential.objects.filter(
            client_id_cipher__gt=""
        ).count()
        if pending:
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING(
                    f"NOTE: {pending} DNSECredential row(s) also hold encrypted broker "
                    f"secrets and have NO secret_version column. They are not touched by "
                    f"this command. Rotating DJANGO_SECRET_KEY will break them until a "
                    f"schema change adds a version column."
                )
            )

    # ── main ────────────────────────────────────────────────────────────
    def handle(self, *args, **options):
        apply_changes = options["apply"]
        limit = options["limit"] or 0

        store = SecretStore()
        try:
            target = options["target_version"] or store.current_version()
            # Resolving the key now means a misconfigured deployment fails before
            # any write, not halfway through.
            store.get_key(target)
        except SecretKeyMissingError as exc:
            raise CommandError(
                f"Refusing to run: no usable key for version {target or '?'}. {exc}"
            ) from exc

        self.stdout.write(f"Target key version: {target}")
        self.stdout.write(f"Mode: {'APPLY (will write)' if apply_changes else 'DRY RUN (no writes)'}")

        before = self._version_histogram()
        self.stdout.write("Current state (version -> rows):")
        for version, count in before.items():
            label = "unparseable/unknown" if version == -1 else str(version)
            self.stdout.write(f"  v{label}: {count}")
        self._report_dns_credential_exposure()

        queryset = UserBrokerConfig.objects.exclude(secrets_cipher="")
        if limit:
            queryset = queryset.order_by("pk")[:limit]

        migrated = 0
        already = 0
        blocked: list = []

        # One transaction for the whole run: if row 900 of 1000 turns out to be
        # unreadable, rows 1-899 must roll back too. Without this the "nothing was
        # committed" claim below would be false, and a half-migrated table is worse
        # than an unmigrated one because the operator may not notice.
        with transaction.atomic():
            for config in queryset.iterator():
                cipher = config.secrets_cipher
                try:
                    current = store.version_of(cipher)
                except SecretKeyMissingError as exc:
                    blocked.append((config.pk, f"cannot read version: {exc}"))
                    continue

                if current == target:
                    already += 1
                    continue

                try:
                    new_cipher = store.reencrypt(cipher, target_version=target)
                except SecretKeyMissingError as exc:
                    blocked.append(
                        (config.pk, f"v{current} -> v{target} needs a key that is not configured: {exc}")
                    )
                    continue

                # Prove the new ciphertext reads back before considering it done.
                verify_plaintext, verify_version = store.decrypt(new_cipher)
                if verify_version != target:
                    blocked.append((config.pk, f"post-write version is v{verify_version}, expected v{target}"))
                    continue
                del verify_plaintext

                if apply_changes:
                    config.secrets_cipher = new_cipher
                    config.secret_version = target
                    config.save(update_fields=["secrets_cipher", "secret_version", "updated_at"])
                migrated += 1

            if blocked:
                # Raising inside atomic() rolls the run back.
                self.stdout.write(self.style.ERROR(f"BLOCKED on {len(blocked)} row(s):"))
                for pk, reason in blocked[:20]:
                    self.stdout.write(f"  pk={pk}: {reason}")
                if len(blocked) > 20:
                    self.stdout.write(f"  ... and {len(blocked) - 20} more")
                raise CommandError(
                    f"{len(blocked)} row(s) could not be migrated. Nothing was committed. "
                    f"Retain the missing key in BROKER_SECRET_KEY_V<n> and re-run."
                )

        verb = "migrated" if apply_changes else "would migrate"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {migrated} row(s); {already} already on v{target}; 0 blocked."
            )
        )
        if not apply_changes:
            self.stdout.write("Dry run only. Re-run with --apply to write.")
        else:
            after = self._version_histogram()
            self.stdout.write("After (version -> rows):")
            for version, count in after.items():
                label = "unparseable/unknown" if version == -1 else str(version)
                self.stdout.write(f"  v{label}: {count}")
            if before.get(target) == after.get(target):
                self.stdout.write(
                    self.style.WARNING(
                        "Distribution did not change - were all rows already on the target?"
                    )
                )
