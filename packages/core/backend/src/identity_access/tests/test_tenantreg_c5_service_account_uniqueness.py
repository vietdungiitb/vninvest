"""Slice C / C5 — CoreServiceAccount must be unique per (tenant, name).

Defect (verified file:line before the fix):
  identity_access/models.py:211-217 — Meta had indexes only, no unique_together.
  get_or_create(tenant=..., name='default') at views/register.py:139 (and :288,
  views/sso.py:300, views_personal.py:50, data_ingest/tasks.py:3155) is a
  SELECT-then-INSERT and is NOT race-safe without the constraint. views/login.py:146
  then picks .first() under ordering ['-created_at','-pk'] — i.e. the NEWEST row —
  and attaches whatever scopes that row carries to the user's login PAT, while the
  elevated scopes (ai:invoke, manage_pats) are written by views/register.py:297-299.
"""
from __future__ import annotations

import importlib

from django.apps import apps as global_apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test import TestCase, TransactionTestCase

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant


User = get_user_model()

MIGRATION_MODULE = 'identity_access.migrations.0028_coreserviceaccount_uniq_core_service_account_tenant_name'
CONSTRAINT_NAME = 'uniq_core_service_account_tenant_name'


def load_merge_callable():
    module = importlib.import_module(MIGRATION_MODULE)
    return module.merge_duplicate_service_accounts


def _get_constraint():
    for constraint in CoreServiceAccount._meta.constraints:
        if constraint.name == CONSTRAINT_NAME:
            return constraint
    raise AssertionError(f'{CONSTRAINT_NAME} is not declared on CoreServiceAccount._meta')


class ServiceAccountUniquenessTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='c5owner', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c5_tenant',
            display_name='C5 tenant',
        )

    # ------------------------------------------------------------------
    # C5-AC1: the constraint actually exists and is enforced by the DB.
    # ------------------------------------------------------------------
    def test_c5_constraint_is_declared_on_the_model(self):
        constraints = {
            c.name: c
            for c in CoreServiceAccount._meta.constraints
        }
        self.assertIn(CONSTRAINT_NAME, constraints)
        self.assertEqual(
            tuple(constraints[CONSTRAINT_NAME].fields),
            ('tenant', 'name'),
        )

    def test_c5_duplicate_service_account_is_rejected(self):
        CoreServiceAccount.objects.create(tenant=self.tenant, name='default')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CoreServiceAccount.objects.create(tenant=self.tenant, name='default')

    def test_c5_same_name_allowed_across_different_tenants(self):
        other = CoreTenant.objects.create(
            owner_user=User.objects.create_user(username='c5other', password='x'),
            tenant_code='c5_other',
            display_name='C5 other',
        )
        CoreServiceAccount.objects.create(tenant=self.tenant, name='default')
        CoreServiceAccount.objects.create(tenant=other, name='default')
        self.assertEqual(CoreServiceAccount.objects.filter(name='default').count(), 2)

    def test_c5_get_or_create_is_idempotent(self):
        first, created_first = CoreServiceAccount.objects.get_or_create(
            tenant=self.tenant, name='default', defaults={'scopes': ['market:read']}
        )
        second, created_second = CoreServiceAccount.objects.get_or_create(
            tenant=self.tenant, name='default', defaults={'scopes': ['market:read']}
        )
        self.assertTrue(created_first)
        self.assertFalse(created_second)
        self.assertEqual(first.pk, second.pk)


class DuplicateServiceAccountMergeTests(TransactionTestCase):
    """The constraint alone would fail to apply on a live table with duplicates.

    These tests drop the constraint, build the mess a real race produces, run the
    migration's merge function, and assert nothing of value was lost.

    TransactionTestCase (not TestCase) on purpose: the DROP/ADD CONSTRAINT has to
    commit on its own, because PostgreSQL refuses ALTER TABLE while deferred FK
    trigger events from earlier inserts in the same transaction are still pending.
    """

    def setUp(self):
        self.merge = load_merge_callable()
        self.owner = User.objects.create_user(username='c5mowner', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c5m_tenant',
            display_name='C5 merge tenant',
        )
        self._drop_constraint()
        self._constraint_present = False

    def tearDown(self):
        if not self._constraint_present:
            self._restore_constraint()

    def _drop_constraint(self):
        with connection.schema_editor() as editor:
            editor.remove_constraint(CoreServiceAccount, _get_constraint())
        self._constraint_present = False

    def _restore_constraint(self):
        with connection.schema_editor() as editor:
            editor.add_constraint(CoreServiceAccount, _get_constraint())
        self._constraint_present = True

    def _make_duplicate_group(self):
        """Mimic the race: three 'default' rows, oldest first."""
        oldest = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read'],
        )
        middle = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'ai:invoke'],
            allowed_symbols=['VNM'],
        )
        newest = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='default',
            status=CoreServiceAccount.StatusChoices.DISABLED,
            scopes=['market:read', 'manage_pats'],
        )
        return oldest, middle, newest

    def test_c5_merge_collapses_the_group_to_the_oldest_row(self):
        oldest, middle, newest = self._make_duplicate_group()
        self.assertEqual(CoreServiceAccount.objects.filter(name='default').count(), 3)

        self.merge(global_apps, None)

        remaining = list(CoreServiceAccount.objects.filter(tenant=self.tenant, name='default'))
        self.assertEqual(len(remaining), 1)
        # Survivor = oldest (created_at, pk) → the public_id customers have longest.
        self.assertEqual(remaining[0].pk, oldest.pk)
        self.assertEqual(remaining[0].public_id, oldest.public_id)
        self.assertFalse(CoreServiceAccount.objects.filter(pk=middle.pk).exists())
        self.assertFalse(CoreServiceAccount.objects.filter(pk=newest.pk).exists())

    def test_c5_merge_unions_scopes_so_no_grant_is_lost(self):
        oldest, middle, newest = self._make_duplicate_group()
        self.merge(global_apps, None)

        survivor = CoreServiceAccount.objects.get(pk=oldest.pk)
        self.assertEqual(
            sorted(survivor.scopes),
            sorted(['market:read', 'signals:read', 'ai:invoke', 'manage_pats']),
        )
        self.assertEqual(survivor.allowed_symbols, ['VNM'])

    def test_c5_merge_keeps_status_active_if_any_duplicate_was_active(self):
        oldest, middle, newest = self._make_duplicate_group()
        self.merge(global_apps, None)

        survivor = CoreServiceAccount.objects.get(pk=oldest.pk)
        self.assertEqual(survivor.status, CoreServiceAccount.StatusChoices.ACTIVE)
        self.assertTrue(
            CoreServiceAccount.objects.filter(
                tenant=self.tenant, status=CoreServiceAccount.StatusChoices.ACTIVE
            ).exists(),
            'helpers.py:104 needs at least one active account to attach to a login PAT.',
        )

    def test_c5_merge_repoints_pats_instead_of_cascade_deleting_them(self):
        """service_account is on_delete=CASCADE — a plain delete revokes live tokens."""
        oldest, middle, newest = self._make_duplicate_group()
        pats = []
        for sa, label in ((oldest, 'a'), (middle, 'b'), (newest, 'c')):
            credential, _raw = CorePATCredential.issue_for_service_account(sa, scopes=['market:read'], label=label)
            pats.append(credential)
        pat_public_ids = {p.public_id for p in pats}

        self.merge(global_apps, None)

        survivor = CoreServiceAccount.objects.get(pk=oldest.pk)
        for public_id in pat_public_ids:
            credential = CorePATCredential.objects.get(public_id=public_id)
            self.assertEqual(
                credential.service_account_id,
                survivor.pk,
                f'PAT {public_id} was cascade-deleted or orphaned by the merge.',
            )
        self.assertEqual(CorePATCredential.objects.count(), len(pats))

    def test_c5_merge_leaves_other_names_and_tenants_untouched(self):
        oldest, _mid, _new = self._make_duplicate_group()
        sibling = CoreServiceAccount.objects.create(tenant=self.tenant, name='ci-runner')
        other_tenant = CoreTenant.objects.create(
            owner_user=User.objects.create_user(username='c5mother', password='x'),
            tenant_code='c5m_other',
            display_name='C5 merge other',
        )
        foreign = CoreServiceAccount.objects.create(tenant=other_tenant, name='default')

        self.merge(global_apps, None)

        self.assertTrue(CoreServiceAccount.objects.filter(pk=sibling.pk).exists())
        self.assertTrue(CoreServiceAccount.objects.filter(pk=foreign.pk).exists())
        self.assertEqual(CoreServiceAccount.objects.filter(tenant=self.tenant).count(), 2)

    def test_c5_merge_is_idempotent(self):
        self._make_duplicate_group()
        self.merge(global_apps, None)
        self.merge(global_apps, None)
        self.assertEqual(
            CoreServiceAccount.objects.filter(tenant=self.tenant, name='default').count(),
            1,
        )

    def test_c5_merge_on_clean_table_is_a_noop(self):
        CoreServiceAccount.objects.create(tenant=self.tenant, name='default')
        self.merge(global_apps, None)
        self.assertEqual(
            CoreServiceAccount.objects.filter(tenant=self.tenant, name='default').count(),
            1,
        )

    def test_c5_constraint_reapplies_cleanly_after_the_merge(self):
        """The whole point: the migration must not die on a dirty table."""
        self._make_duplicate_group()
        self.merge(global_apps, None)
        self._restore_constraint()  # tearDown would otherwise be the first attempt

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CoreServiceAccount.objects.create(tenant=self.tenant, name='default')
