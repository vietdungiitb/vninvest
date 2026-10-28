"""Focused Matrix API and coordinator regression tests."""

import threading
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.matrix_coordinator import MatrixCoordinator, generate_cycle_id
from service_ops.models import ScrapeMatrixCell
from service_ops.registry import ensure_service_registry
from service_ops.tests.envelope import unwrapped_json

User = get_user_model()


class MatrixApiBaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-matrix-admin',
            email='soc-matrix-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class MatrixProviderCatalogApiTestCase(MatrixApiBaseTestCase):
    def test_providers_endpoint_exposes_kbs_vci_dnse_catalog(self):
        response = self.client.get('/api/soc/matrix/providers/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        provider_ids = [provider['provider'] for provider in payload['providers']]
        self.assertEqual(provider_ids, ['vci', 'kbs', 'dnse'])
        self.assertEqual(payload['default_providers'], ['vci', 'kbs', 'dnse'])

        dnse_provider = next(
            provider
            for provider in payload['providers']
            if provider['provider'] == 'dnse'
        )
        self.assertTrue(dnse_provider['requires_runtime_credentials'])
        self.assertFalse(dnse_provider['runtime_ready'])
        self.assertIn('SOC_MATRIX_DNSE_API_ID', dnse_provider['required_runtime_envs'])
        self.assertIn('SOC_MATRIX_DNSE_API_KEY', dnse_provider['required_runtime_envs'])

    def test_operator_canonical_provider_endpoint_matches_soc_alias(self):
        soc_response = self.client.get('/api/soc/matrix/providers/')
        canonical_response = self.client.get('/core/v1/operator/scraping/matrix/providers/')

        self.assertEqual(canonical_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(canonical_response), unwrapped_json(soc_response))

    @patch('service_ops.views.matrix.run_scrape_cycle.delay')
    def test_start_cycle_rejects_removed_or_unready_providers(self, run_scrape_cycle_delay):
        removed_provider_response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {'providers': ['ssi'], 'symbol_group_ids': ['vn30']},
            format='json',
        )
        unready_provider_response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {'providers': ['dnse'], 'symbol_group_ids': ['vn30']},
            format='json',
        )

        self.assertEqual(removed_provider_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(removed_provider_response)['code'], 'MATRIX_PROVIDER_UNSUPPORTED')
        self.assertEqual(unready_provider_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(unready_provider_response)['code'], 'MATRIX_PROVIDER_NOT_READY')
        run_scrape_cycle_delay.assert_not_called()

    @patch('service_ops.views.matrix.run_scrape_cycle.delay', return_value=Mock(id='dispatch-active'))
    def test_provider_gate_still_applies_when_active_cycle_exists(self, _run_scrape_cycle_delay):
        first_response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {'providers': ['vci'], 'symbol_group_ids': ['vn30']},
            format='json',
        )
        blocked_response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {'providers': ['dnse'], 'symbol_group_ids': ['vn30']},
            format='json',
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(blocked_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(blocked_response)['code'], 'MATRIX_PROVIDER_NOT_READY')

    @patch('service_ops.views.matrix.run_scrape_cycle.delay', return_value=Mock(id='dispatch-cycle-1'))
    def test_start_cycle_allows_vci_and_kbs(self, _run_scrape_cycle_delay):
        start_response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {'providers': ['vci', 'kbs'], 'symbol_group_ids': ['vn30', 'vn100']},
            format='json',
        )

        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(start_response)
        self.assertEqual(payload['providers'], ['vci', 'kbs'])
        self.assertEqual(len(payload['cells']), 4)
        self.assertEqual(payload['dispatch_task_id'], 'dispatch-cycle-1')

        monitor_response = self.client.get('/api/soc/matrix/monitor/')
        self.assertEqual(monitor_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(monitor_response)['providers'], ['vci', 'kbs'])

    @patch('service_ops.views.matrix.run_scrape_cycle.delay', return_value=Mock(id='dispatch-operator-cycle'))
    def test_operator_canonical_start_cycle_dispatches_same_matrix_workflow(self, run_scrape_cycle_delay):
        response = self.client.post(
            '/core/v1/operator/scraping/matrix/cycles/start/',
            {'providers': ['vci', 'kbs'], 'symbol_group_ids': ['vn30']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
        self.assertEqual(payload['providers'], ['vci', 'kbs'])
        self.assertEqual(payload['dispatch_task_id'], 'dispatch-operator-cycle')
        run_scrape_cycle_delay.assert_called_once_with(
            cycle_id=payload['cycle_id'],
            symbol_group_ids=['vn30'],
            providers=['vci', 'kbs'],
        )

    @patch('service_ops.views.matrix.run_scrape_cycle.delay', return_value=Mock(id='dispatch-cycle-2'))
    def test_start_cycle_dispatches_scrape_workflow(self, run_scrape_cycle_delay):
        response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {'providers': ['vci', 'kbs'], 'symbol_group_ids': ['vn30']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
        run_scrape_cycle_delay.assert_called_once_with(
            cycle_id=payload['cycle_id'],
            symbol_group_ids=['vn30'],
            providers=['vci', 'kbs'],
        )

    def test_monitor_returns_idle_when_only_terminal_cycle_exists(self):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['vci', 'kbs'])
        matrix = coordinator.create_cycle(['vn30'])
        coordinator.abort_cycle()

        response = self.client.get('/api/soc/matrix/monitor/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(response)['status'], 'idle')
        self.assertIsNone(unwrapped_json(response)['cycle_id'])
        self.assertEqual(unwrapped_json(response)['providers'], ['vci', 'kbs', 'dnse'])


class MatrixCoordinatorTestCase(TestCase):
    def test_try_claim_cell_rejects_second_claim_after_first_claim(self):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['vci', 'kbs'])
        matrix = coordinator.create_cycle(['vn30'])

        first_claim = coordinator.try_claim_cell('vn30', 'vci', 'worker-1')
        second_claim = coordinator.try_claim_cell('vn30', 'vci', 'worker-2')

        claimed_cell = ScrapeMatrixCell.objects.get(
            matrix=matrix,
            symbol_group_id='vn30',
            provider='vci',
        )
        self.assertTrue(first_claim)
        self.assertFalse(second_claim)
        self.assertEqual(claimed_cell.status, 'claimed')
        self.assertEqual(claimed_cell.worker_id, 'worker-1')

    def test_mark_cell_done_skips_other_cells_in_same_row(self):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['vci', 'kbs'])
        matrix = coordinator.create_cycle(['vn30'])

        claimed = coordinator.try_claim_cell('vn30', 'vci', 'worker-1')
        coordinator.mark_cell_done('vn30', 'vci', symbols_processed=30)

        self.assertTrue(claimed)
        self.assertEqual(matrix.cells.filter(status='done').count(), 1)
        skipped_cell = ScrapeMatrixCell.objects.get(
            matrix=matrix,
            symbol_group_id='vn30',
            provider='kbs',
        )
        self.assertEqual(skipped_cell.status, 'skipped')
        self.assertFalse(coordinator.try_claim_cell('vn30', 'kbs', 'worker-2'))


@skipUnlessDBFeature('has_select_for_update')
class MatrixCoordinatorAtomicClaimTestCase(TransactionTestCase):
    reset_sequences = True

    @staticmethod
    def _claim_cell(cycle_id, symbol_group_id, provider, worker_id, start_barrier, results, errors, index):
        close_old_connections()
        try:
            coordinator = MatrixCoordinator(cycle_id, providers=['vci', 'kbs'])
            start_barrier.wait(timeout=5)
            results[index] = coordinator.try_claim_cell(symbol_group_id, provider, worker_id)
        except Exception as exc:  # pragma: no cover - failure path asserted via errors collection
            errors[index] = exc
        finally:
            close_old_connections()

    def test_try_claim_cell_allows_only_one_concurrent_winner(self):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['vci', 'kbs'])
        matrix = coordinator.create_cycle(['vn30'])
        start_barrier = threading.Barrier(2)
        results = [None, None]
        errors = [None, None]
        worker_ids = ['worker-1', 'worker-2']
        threads = [
            threading.Thread(
                target=self._claim_cell,
                args=(matrix.cycle_id, 'vn30', 'vci', worker_id, start_barrier, results, errors, index),
            )
            for index, worker_id in enumerate(worker_ids)
        ]

        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(errors, [None, None])
        self.assertCountEqual(results, [True, False])

        claimed_cell = ScrapeMatrixCell.objects.get(
            matrix=matrix,
            symbol_group_id='vn30',
            provider='vci',
        )
        self.assertEqual(claimed_cell.status, 'claimed')
        self.assertIn(claimed_cell.worker_id, worker_ids)