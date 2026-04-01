from django.core.management.base import BaseCommand

from portfolio.tasks import collect_and_publish_realtime


class Command(BaseCommand):
    help = "Run one realtime collect/publish cycle for Sprint 11."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, help="Optional user id scope")
        parser.add_argument(
            "--sync",
            action="store_true",
            help="Run task synchronously instead of dispatching to Celery worker",
        )

    def handle(self, *args, **options):
        user_id = options.get("user_id")
        run_sync = options.get("sync")

        if run_sync:
            result = collect_and_publish_realtime(user_id=user_id)
            self.stdout.write(self.style.SUCCESS(f"Realtime tick (sync): {result}"))
            return

        async_result = collect_and_publish_realtime.delay(user_id=user_id)
        self.stdout.write(self.style.SUCCESS(f"Realtime tick queued: task_id={async_result.id}"))
