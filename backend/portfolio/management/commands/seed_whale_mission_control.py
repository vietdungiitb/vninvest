from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from portfolio.models import (
    StockProfile,
    WhaleAdvisory,
    WhaleConfigApproval,
    WhaleConfigAuditLog,
    WhaleConfigDraft,
    WhaleConfigRollout,
    WhaleConfigVersion,
    WhaleConfigWorkerAck,
)
from portfolio.seed_governance import assert_demo_seed_allowed


class Command(BaseCommand):
    help = 'Seed demo Whale Mission Control data for Django admin testing.'

    version_prefix = 'demo-whale-2026'
    draft_prefix = 'Demo Whale'
    audit_ticket = 'MC-DEMO-SEED'
    advisory_provider = 'seed-demo'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete previously seeded Whale Mission Control demo data first.')
        parser.add_argument('--analyst-username', default='whale_analyst', help='Username for the seeded analyst account.')
        parser.add_argument('--supervisor-username', default='whale_supervisor', help='Username for the seeded supervisor account.')
        parser.add_argument('--password', default='Test@123456', help='Password applied to both seeded users.')
        parser.add_argument('--allow-production', action='store_true', help='Allow demo seed on production-like environment.')

    def handle(self, *args, **options):
        analyst_username = options['analyst_username']
        supervisor_username = options['supervisor_username']
        password = options['password']
        reset = options['reset']
        allow_production = bool(options.get('allow_production'))

        assert_demo_seed_allowed(command_name='seed_whale_mission_control', allow_production_flag=allow_production)

        with transaction.atomic():
            analyst = self._ensure_user(
                username=analyst_username,
                password=password,
                is_staff=False,
                is_superuser=False,
            )
            supervisor = self._ensure_user(
                username=supervisor_username,
                password=password,
                is_staff=True,
                is_superuser=True,
            )

            self._ensure_stock_profiles()

            if reset:
                self._reset_seeded_data()

            summary = self._seed_demo_data(analyst=analyst, supervisor=supervisor)

        self.stdout.write(self.style.SUCCESS('Seeded Whale Mission Control demo data.'))
        self.stdout.write(f"Analyst: {analyst_username} / {password}")
        self.stdout.write(f"Supervisor: {supervisor_username} / {password}")
        self.stdout.write(
            'Summary: '
            f"drafts={summary['drafts']}, approvals={summary['approvals']}, versions={summary['versions']}, "
            f"rollouts={summary['rollouts']}, worker_acks={summary['worker_acks']}, advisories={summary['advisories']}"
        )

    def _ensure_user(self, *, username: str, password: str, is_staff: bool, is_superuser: bool) -> User:
        user, _created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': f'{username}@vninvest.vn',
                'is_staff': is_staff,
                'is_superuser': is_superuser,
            },
        )
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.email = user.email or f'{username}@vninvest.vn'
        user.set_password(password)
        user.save(update_fields=['email', 'is_staff', 'is_superuser', 'password'])
        return user

    def _ensure_stock_profiles(self):
        stock_profiles = {
            'FPT': {'company_name': 'CTCP FPT', 'industry': 'Cong nghe', 'exchange': 'HOSE'},
            'HPG': {'company_name': 'CTCP Tap doan Hoa Phat', 'industry': 'Thep', 'exchange': 'HOSE'},
            'VNM': {'company_name': 'CTCP Sua Viet Nam', 'industry': 'Tieu dung', 'exchange': 'HOSE'},
            'MWG': {'company_name': 'CTCP Dau tu The Gioi Di Dong', 'industry': 'Ban le', 'exchange': 'HOSE'},
            'VCB': {'company_name': 'Ngan hang TMCP Ngoai thuong Viet Nam', 'industry': 'Ngan hang', 'exchange': 'HOSE'},
        }
        for symbol, payload in stock_profiles.items():
            StockProfile.objects.update_or_create(
                symbol=symbol,
                defaults={
                    **payload,
                    'is_active': True,
                },
            )

    def _reset_seeded_data(self):
        WhaleConfigAuditLog.objects.filter(ticket_ref=self.audit_ticket).delete()
        WhaleAdvisory.objects.filter(ai_provider=self.advisory_provider).delete()
        WhaleConfigApproval.objects.filter(draft__name__startswith=self.draft_prefix).delete()
        WhaleConfigWorkerAck.objects.filter(rollout__note__icontains='seed_demo_whale').delete()
        WhaleConfigRollout.objects.filter(note__icontains='seed_demo_whale').delete()
        WhaleConfigDraft.objects.filter(name__startswith=self.draft_prefix).delete()
        WhaleConfigVersion.objects.filter(version_code__startswith=self.version_prefix).delete()

    def _seed_demo_data(self, *, analyst: User, supervisor: User) -> dict:
        now = timezone.now()

        stable_version = WhaleConfigVersion.objects.create(
            version_code=f'{self.version_prefix}-stable',
            config_json={
                'whale_threshold': 800,
                'shark_threshold': 220,
                'cooldown_seconds': 900,
                'rate_limit_per_minute': 60,
                'coverage_mode': 'tracked',
                'weights': {'size_impact': 0.5, 'aggression_bonus': 0.25, 'concentration_ratio': 0.25},
            },
            status=WhaleConfigVersion.StatusChoices.ARCHIVED,
            created_by=analyst,
            approved_by=supervisor,
            approved_at=now - timedelta(days=7),
            activated_at=now - timedelta(days=7),
            notes='seed_demo_whale stable baseline',
        )
        active_version = WhaleConfigVersion.objects.create(
            version_code=f'{self.version_prefix}-active',
            config_json={
                'whale_threshold': 700,
                'shark_threshold': 180,
                'cooldown_seconds': 600,
                'rate_limit_per_minute': 90,
                'coverage_mode': 'tracked',
                'weights': {'size_impact': 0.45, 'aggression_bonus': 0.3, 'concentration_ratio': 0.25},
            },
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
            created_by=analyst,
            approved_by=supervisor,
            approved_at=now - timedelta(days=2),
            activated_at=now - timedelta(days=2),
            notes='seed_demo_whale active production config',
        )
        scheduled_version = WhaleConfigVersion.objects.create(
            version_code=f'{self.version_prefix}-scheduled',
            config_json={
                'whale_threshold': 650,
                'shark_threshold': 170,
                'cooldown_seconds': 480,
                'rate_limit_per_minute': 100,
                'coverage_mode': 'tracked',
                'weights': {'size_impact': 0.42, 'aggression_bonus': 0.33, 'concentration_ratio': 0.25},
            },
            status=WhaleConfigVersion.StatusChoices.APPROVED,
            created_by=analyst,
            approved_by=supervisor,
            approved_at=now - timedelta(hours=6),
            notes='seed_demo_whale approved for scheduled rollout',
        )
        canary_version = WhaleConfigVersion.objects.create(
            version_code=f'{self.version_prefix}-canary',
            config_json={
                'whale_threshold': 620,
                'shark_threshold': 160,
                'cooldown_seconds': 420,
                'rate_limit_per_minute': 120,
                'coverage_mode': 'tracked',
                'weights': {'size_impact': 0.4, 'aggression_bonus': 0.35, 'concentration_ratio': 0.25},
            },
            status=WhaleConfigVersion.StatusChoices.APPROVED,
            created_by=analyst,
            approved_by=supervisor,
            approved_at=now - timedelta(hours=2),
            notes='seed_demo_whale approved for canary rollout',
        )
        experimental_version = WhaleConfigVersion.objects.create(
            version_code=f'{self.version_prefix}-experimental',
            config_json={
                'whale_threshold': 550,
                'shark_threshold': 140,
                'cooldown_seconds': 300,
                'rate_limit_per_minute': 150,
                'coverage_mode': 'tracked',
                'weights': {'size_impact': 0.38, 'aggression_bonus': 0.37, 'concentration_ratio': 0.25},
            },
            status=WhaleConfigVersion.StatusChoices.DRAFT,
            created_by=analyst,
            notes='seed_demo_whale experimental draft version',
        )
        rollback_version = WhaleConfigVersion.objects.create(
            version_code=f'{self.version_prefix}-rollback',
            config_json={
                'whale_threshold': 500,
                'shark_threshold': 125,
                'cooldown_seconds': 240,
                'rate_limit_per_minute': 160,
                'coverage_mode': 'tracked',
                'weights': {'size_impact': 0.36, 'aggression_bonus': 0.39, 'concentration_ratio': 0.25},
            },
            status=WhaleConfigVersion.StatusChoices.ROLLED_BACK,
            created_by=analyst,
            approved_by=supervisor,
            approved_at=now - timedelta(days=1),
            activated_at=now - timedelta(days=1),
            rollback_of=active_version,
            notes='seed_demo_whale rolled back after anomaly',
        )

        approved_draft = WhaleConfigDraft.objects.create(
            name=f'{self.draft_prefix} Threshold Rebalance',
            config_json=scheduled_version.config_json,
            status=WhaleConfigDraft.StatusChoices.APPROVED,
            created_by=analyst,
            submitted_at=now - timedelta(hours=8),
            linked_version=scheduled_version,
            reason='Seeded demo draft ready for scheduled rollout.',
        )
        canary_draft = WhaleConfigDraft.objects.create(
            name=f'{self.draft_prefix} Sector Canary',
            config_json=canary_version.config_json,
            status=WhaleConfigDraft.StatusChoices.APPROVED,
            created_by=analyst,
            submitted_at=now - timedelta(hours=4),
            linked_version=canary_version,
            reason='Seeded demo draft for HOSE technology canary.',
        )
        rejected_draft = WhaleConfigDraft.objects.create(
            name=f'{self.draft_prefix} Risky Expansion',
            config_json={
                'whale_threshold': 90,
                'shark_threshold': 30,
                'cooldown_seconds': 30,
                'rate_limit_per_minute': 500,
            },
            status=WhaleConfigDraft.StatusChoices.REJECTED,
            created_by=analyst,
            submitted_at=now - timedelta(days=1),
            reason='Rejected demo draft with aggressive thresholds.',
        )
        in_progress_draft = WhaleConfigDraft.objects.create(
            name=f'{self.draft_prefix} Experimental Lab',
            config_json=experimental_version.config_json,
            status=WhaleConfigDraft.StatusChoices.DRAFT,
            created_by=analyst,
            linked_version=experimental_version,
            reason='Draft still under analyst review.',
        )

        approval_records = [
            WhaleConfigApproval.objects.create(
                draft=approved_draft,
                reviewer=supervisor,
                decision=WhaleConfigApproval.DecisionChoices.APPROVED,
                comment='Ready for scheduled rollout window.',
            ),
            WhaleConfigApproval.objects.create(
                draft=canary_draft,
                reviewer=supervisor,
                decision=WhaleConfigApproval.DecisionChoices.APPROVED,
                comment='Canary scope validated for HOSE tech names.',
            ),
            WhaleConfigApproval.objects.create(
                draft=rejected_draft,
                reviewer=supervisor,
                decision=WhaleConfigApproval.DecisionChoices.REJECTED,
                comment='Threshold too low and cooldown too aggressive.',
            ),
        ]

        completed_rollout = WhaleConfigRollout.objects.create(
            version=active_version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.COMPLETED,
            initiated_by=supervisor,
            note='seed_demo_whale completed active rollout',
            started_at=now - timedelta(days=2, minutes=10),
            finished_at=now - timedelta(days=2, minutes=7),
        )
        scheduled_rollout = WhaleConfigRollout.objects.create(
            version=scheduled_version,
            mode=WhaleConfigRollout.ModeChoices.SCHEDULED,
            status=WhaleConfigRollout.StatusChoices.PENDING,
            initiated_by=supervisor,
            effective_from=now + timedelta(hours=2),
            note='seed_demo_whale pending scheduled rollout',
        )
        canary_rollout = WhaleConfigRollout.objects.create(
            version=canary_version,
            mode=WhaleConfigRollout.ModeChoices.CANARY,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            initiated_by=supervisor,
            canary_scope_json={'symbols': ['FPT', 'MWG'], 'exchange': 'HOSE', 'percent': 50},
            note='seed_demo_whale running canary rollout',
            started_at=now - timedelta(minutes=25),
        )
        rollback_rollout = WhaleConfigRollout.objects.create(
            version=rollback_version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.ROLLED_BACK,
            initiated_by=supervisor,
            note='seed_demo_whale auto_reverted:demo-whale-2026-stable',
            started_at=now - timedelta(days=1, hours=2),
            finished_at=now - timedelta(days=1, hours=1, minutes=55),
        )

        worker_acks = [
            WhaleConfigWorkerAck.objects.create(
                rollout=completed_rollout,
                worker_name='mission-control@win-main',
                worker_version=active_version.version_code,
                acked=True,
                acked_at=now - timedelta(days=2, minutes=9),
                details='loaded_ok',
            ),
            WhaleConfigWorkerAck.objects.create(
                rollout=completed_rollout,
                worker_name='mission-control@win-shadow',
                worker_version=active_version.version_code,
                acked=True,
                acked_at=now - timedelta(days=2, minutes=8),
                details='loaded_ok',
            ),
            WhaleConfigWorkerAck.objects.create(
                rollout=scheduled_rollout,
                worker_name='mission-control@scheduler',
                worker_version='',
                acked=False,
                details='awaiting_schedule_window',
            ),
            WhaleConfigWorkerAck.objects.create(
                rollout=canary_rollout,
                worker_name='mission-control@canary-a',
                worker_version=canary_version.version_code,
                acked=True,
                acked_at=now - timedelta(minutes=20),
                details='loaded_ok',
            ),
            WhaleConfigWorkerAck.objects.create(
                rollout=canary_rollout,
                worker_name='mission-control@canary-b',
                worker_version='',
                acked=False,
                details='awaiting_ack',
            ),
            WhaleConfigWorkerAck.objects.create(
                rollout=canary_rollout,
                worker_name='realtime@legacy-worker',
                worker_version=stable_version.version_code,
                acked=True,
                acked_at=now - timedelta(minutes=18),
                details='stale_version_seen_in_runtime',
            ),
            WhaleConfigWorkerAck.objects.create(
                rollout=rollback_rollout,
                worker_name='mission-control@rollback',
                worker_version=rollback_version.version_code,
                acked=True,
                acked_at=now - timedelta(days=1, hours=1, minutes=58),
                details='auto_revert_applied',
            ),
        ]

        advisories = [
            WhaleAdvisory.objects.create(
                symbol='FPT',
                matched_value=1_450_000_000,
                side='BUY',
                threshold=620_000_000,
                ai_summary='Seed demo canary alert for FPT.',
                ai_detail='Seeded advisory to make AdminOps Mission Control dashboard non-empty.',
                ai_provider=self.advisory_provider,
                prompt_tokens=320,
                completion_tokens=110,
            ),
            WhaleAdvisory.objects.create(
                symbol='MWG',
                matched_value=980_000_000,
                side='SELL',
                threshold=620_000_000,
                ai_summary='Seed demo canary alert for MWG.',
                ai_detail='Second seeded advisory for recent anomaly and alert counters.',
                ai_provider=self.advisory_provider,
                prompt_tokens=280,
                completion_tokens=95,
            ),
        ]
        WhaleAdvisory.objects.filter(pk=advisories[0].pk).update(created_at=now - timedelta(minutes=4))
        WhaleAdvisory.objects.filter(pk=advisories[1].pk).update(created_at=now - timedelta(minutes=9))

        audit_logs = [
            WhaleConfigAuditLog.objects.create(
                actor=analyst,
                action='create_draft',
                draft=approved_draft,
                version=scheduled_version,
                reason='seed_demo_whale create approved draft',
                before_json={},
                after_json={'status': approved_draft.status},
                ticket_ref=self.audit_ticket,
            ),
            WhaleConfigAuditLog.objects.create(
                actor=analyst,
                action='submit_draft',
                draft=approved_draft,
                version=scheduled_version,
                reason='seed_demo_whale submit draft',
                before_json={'status': 'draft'},
                after_json={'status': 'submitted'},
                ticket_ref=self.audit_ticket,
            ),
            WhaleConfigAuditLog.objects.create(
                actor=supervisor,
                action='approve',
                draft=approved_draft,
                version=scheduled_version,
                reason='seed_demo_whale approve draft',
                before_json={'status': 'submitted'},
                after_json={'status': 'approved'},
                ticket_ref=self.audit_ticket,
            ),
            WhaleConfigAuditLog.objects.create(
                actor=supervisor,
                action='apply',
                version=active_version,
                rollout=completed_rollout,
                reason='seed_demo_whale apply active config',
                before_json={'status': 'approved'},
                after_json={'status': 'active', 'rollout_status': completed_rollout.status},
                ticket_ref=self.audit_ticket,
            ),
            WhaleConfigAuditLog.objects.create(
                actor=supervisor,
                action='rollback',
                version=rollback_version,
                rollout=rollback_rollout,
                reason='seed_demo_whale rollback after anomaly',
                before_json={'status': 'active'},
                after_json={'status': 'rolled_back'},
                ticket_ref=self.audit_ticket,
            ),
        ]

        return {
            'drafts': WhaleConfigDraft.objects.filter(name__startswith=self.draft_prefix).count(),
            'approvals': len(approval_records),
            'versions': WhaleConfigVersion.objects.filter(version_code__startswith=self.version_prefix).count(),
            'rollouts': WhaleConfigRollout.objects.filter(note__icontains='seed_demo_whale').count(),
            'worker_acks': len(worker_acks),
            'advisories': len(advisories),
            'audit_logs': len(audit_logs),
        }
