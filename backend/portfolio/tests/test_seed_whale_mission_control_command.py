from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from portfolio.models import (
    WhaleAdvisory,
    WhaleConfigApproval,
    WhaleConfigDraft,
    WhaleConfigRollout,
    WhaleConfigVersion,
    WhaleConfigWorkerAck,
)


class SeedWhaleMissionControlCommandTests(TestCase):
    def test_seed_command_populates_whale_mission_control_models(self):
        stdout = StringIO()

        call_command('seed_whale_mission_control', '--reset', '--allow-production', stdout=stdout)

        self.assertIn('Seeded Whale Mission Control demo data.', stdout.getvalue())
        self.assertEqual(WhaleConfigDraft.objects.filter(name__startswith='Demo Whale').count(), 4)
        self.assertEqual(WhaleConfigApproval.objects.count(), 3)
        self.assertEqual(WhaleConfigVersion.objects.filter(version_code__startswith='demo-whale-2026').count(), 6)
        self.assertEqual(WhaleConfigRollout.objects.filter(note__icontains='seed_demo_whale').count(), 4)
        self.assertEqual(WhaleConfigWorkerAck.objects.count(), 7)
        self.assertEqual(WhaleAdvisory.objects.filter(ai_provider='seed-demo').count(), 2)

    def test_seed_command_reset_is_idempotent(self):
        call_command('seed_whale_mission_control', '--reset', '--allow-production')
        first_counts = {
            'drafts': WhaleConfigDraft.objects.filter(name__startswith='Demo Whale').count(),
            'approvals': WhaleConfigApproval.objects.count(),
            'versions': WhaleConfigVersion.objects.filter(version_code__startswith='demo-whale-2026').count(),
            'rollouts': WhaleConfigRollout.objects.filter(note__icontains='seed_demo_whale').count(),
            'worker_acks': WhaleConfigWorkerAck.objects.count(),
        }

        call_command('seed_whale_mission_control', '--reset', '--allow-production')
        second_counts = {
            'drafts': WhaleConfigDraft.objects.filter(name__startswith='Demo Whale').count(),
            'approvals': WhaleConfigApproval.objects.count(),
            'versions': WhaleConfigVersion.objects.filter(version_code__startswith='demo-whale-2026').count(),
            'rollouts': WhaleConfigRollout.objects.filter(note__icontains='seed_demo_whale').count(),
            'worker_acks': WhaleConfigWorkerAck.objects.count(),
        }

        self.assertEqual(first_counts, second_counts)
