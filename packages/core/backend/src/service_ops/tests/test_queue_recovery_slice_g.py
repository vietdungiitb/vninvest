"""
Slice G (QueueRecovery) — queue_depths trong observability + SSE signature.

Covers:
- _read_broker_queue_depths fail-open (dict, không raise khi Redis unreachable)
- _dataops_signature đổi khi queue_depths đổi (audit C-4), giữ nguyên khi giống nhau
"""
from django.test import TestCase

from service_ops.dataops_market_data import _read_broker_queue_depths
from service_ops.views.dataops_stream import _dataops_signature


def _snap(depths):
    return {
        'observability': {
            'backlog': {'by_dataset': [], 'by_tier': []},
            'fail_rates': {},
            'queue_depths': dict(depths),
        },
        'coverage': {'datasets': [], 'top_gaps': []},
        'queue_tiers': {'tiers': []},
    }


class QueueDepthsHelperTest(TestCase):
    def test_fail_open_returns_dict(self):
        depths = _read_broker_queue_depths()
        self.assertIsInstance(depths, dict)
        for value in depths.values():
            self.assertIsInstance(value, int)


class DataOpsSignatureQueueDepthsTest(TestCase):
    def test_signature_changes_with_depth(self):
        sig_base = _dataops_signature(_snap({'realtime_prefetch': 10}))
        sig_same = _dataops_signature(_snap({'realtime_prefetch': 10}))
        sig_changed = _dataops_signature(_snap({'realtime_prefetch': 5000}))
        self.assertEqual(sig_base, sig_same)
        self.assertNotEqual(sig_base, sig_changed)

    def test_signature_without_depths_still_works(self):
        snap = {'observability': {}, 'coverage': {}, 'queue_tiers': {}}
        self.assertTrue(isinstance(_dataops_signature(snap), str))
