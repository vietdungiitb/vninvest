from django.test import SimpleTestCase

from portfolio.tasks import (
    ack_whale_config_rollout,
    activate_due_whale_config_rollouts,
    auto_generate_advisories_for_all_tracked,
    cleanup_old_intraday_ticks,
    collect_and_publish_realtime,
    detect_and_store_order_flow,
    detect_whale_reversal,
    flush_merged_advisory_event,
    generate_all_portfolio_news_digests_task,
    generate_whale_advisory_task,
    monitor_whale_config_anomalies,
    process_expired_onboarding_trials_task,
    process_plan_lifecycle_transitions,
    refresh_whale_config_rollout_status,
    run_stream_consumer_batch,
    run_vnstock_price_board_benchmark,
    sync_all_watch_assets,
    sync_user_watch_assets,
    trim_streams,
)


class CeleryTaskNameStabilityTests(SimpleTestCase):
    def test_public_task_names_remain_stable(self):
        expected_names = {
            detect_and_store_order_flow: 'portfolio.tasks.detect_and_store_order_flow',
            detect_whale_reversal: 'portfolio.tasks.detect_whale_reversal',
            activate_due_whale_config_rollouts: 'portfolio.tasks.activate_due_whale_config_rollouts',
            monitor_whale_config_anomalies: 'portfolio.tasks.monitor_whale_config_anomalies',
            refresh_whale_config_rollout_status: 'portfolio.tasks.refresh_whale_config_rollout_status',
            ack_whale_config_rollout: 'portfolio.tasks.ack_whale_config_rollout',
            sync_user_watch_assets: 'portfolio.tasks.sync_user_watch_assets',
            sync_all_watch_assets: 'portfolio.tasks.sync_all_watch_assets',
            process_plan_lifecycle_transitions: 'portfolio.tasks.process_plan_lifecycle_transitions',
            process_expired_onboarding_trials_task: 'portfolio.tasks.process_expired_onboarding_trials_task',
            auto_generate_advisories_for_all_tracked: 'portfolio.tasks.auto_generate_advisories_for_all_tracked',
            collect_and_publish_realtime: 'portfolio.tasks.collect_and_publish_realtime',
            run_stream_consumer_batch: 'portfolio.tasks.run_stream_consumer_batch',
            cleanup_old_intraday_ticks: 'portfolio.tasks.cleanup_old_intraday_ticks',
            run_vnstock_price_board_benchmark: 'portfolio.tasks.run_vnstock_price_board_benchmark',
            trim_streams: 'portfolio.tasks.trim_streams',
            generate_whale_advisory_task: 'portfolio.tasks.generate_whale_advisory_task',
            flush_merged_advisory_event: 'portfolio.tasks.flush_merged_advisory_event',
            generate_all_portfolio_news_digests_task: 'portfolio.tasks.generate_all_portfolio_news_digests_task',
        }

        for task, expected_name in expected_names.items():
            self.assertEqual(task.name, expected_name)