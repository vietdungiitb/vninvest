from django.test import TestCase

from service_ops.models import OwnershipRecord
from service_ops.ownership import ServiceOwnershipMatrix, build_ownership_matrix_from_db, get_ownership_matrix


class ServiceOwnershipMatrixTestCase(TestCase):
    def test_default_matrix_allows_native_write_and_blocks_bridge_write(self):
        matrix = get_ownership_matrix()

        self.assertTrue(matrix.is_domain_writable('vnbroker'))
        self.assertTrue(matrix.is_domain_writable('dataops_market_data'))
        self.assertFalse(matrix.is_domain_writable('signals'))
        self.assertIsNone(matrix.get_write_block_reason('vnbroker'))
        self.assertIn('signal_intelligence', matrix.get_write_block_reason('signals'))

    def test_to_response_dict_exposes_writer_and_locked_fields(self):
        matrix = get_ownership_matrix()

        payload = matrix.to_response_dict('signals')

        self.assertEqual(payload['domain'], 'signals')
        self.assertEqual(payload['mode'], 'bridge-write')
        self.assertTrue(payload['writer'])
        self.assertGreater(len(payload['locked_fields']), 0)
        self.assertFalse(payload['can_apply'])

    def test_unknown_domain_returns_explicit_block_reason(self):
        matrix = ServiceOwnershipMatrix()

        self.assertIn('không được nhận dạng', matrix.get_write_block_reason('not-a-domain'))

    def test_build_ownership_matrix_from_db_preserves_bridge_write_block(self):
        OwnershipRecord.objects.update_or_create(
            domain='signals',
            defaults={
                'owner_team': 'signal_intelligence',
                'write_mode': 'bridge-write',
                'write_surface': 'packages/core/backend/src/signal_intelligence/',
                'locked_fields': ['whale_threshold_vnd', 'canonical_thresholds'],
                'compatibility_domains': ['whale_alerts'],
            },
        )

        matrix = build_ownership_matrix_from_db()
        payload = matrix.to_response_dict('signals')

        self.assertFalse(matrix.is_domain_writable('signals'))
        self.assertFalse(payload['can_apply'])
        self.assertEqual(payload['mode'], 'bridge-write')
        self.assertIn('canonical_thresholds', payload['locked_fields'])

    def test_build_ownership_matrix_from_db_allows_native_write_override(self):
        OwnershipRecord.objects.update_or_create(
            domain='prefetch',
            defaults={
                'owner_team': 'core',
                'write_mode': 'native-write',
                'write_surface': 'service_ops',
                'locked_fields': [],
                'compatibility_domains': [],
            },
        )

        matrix = build_ownership_matrix_from_db()

        self.assertTrue(matrix.is_domain_writable('prefetch'))
        self.assertIsNone(matrix.get_write_block_reason('prefetch'))