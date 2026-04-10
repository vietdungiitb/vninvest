from __future__ import annotations

import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from portfolio.models import UserConfig


class Command(BaseCommand):
    help = "Set per-user AI provider/model/token for one or more users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--users",
            nargs="+",
            required=True,
            help="List of usernames to update.",
        )
        parser.add_argument(
            "--provider",
            default="copilot",
            help="AI provider (default: copilot).",
        )
        parser.add_argument(
            "--model",
            default="openai/gpt-4.1-mini",
            help="AI model id (default: openai/gpt-4.1-mini).",
        )
        parser.add_argument(
            "--token",
            default="",
            help="Raw token value. Prefer --token-env for safer usage.",
        )
        parser.add_argument(
            "--token-env",
            default="COPILOT_API_KEY",
            help="Environment variable name to read token from (default: COPILOT_API_KEY).",
        )

    def handle(self, *args, **options):
        usernames: list[str] = [str(name).strip() for name in options["users"] if str(name).strip()]
        provider = str(options.get("provider") or "").strip().lower()
        model = str(options.get("model") or "").strip()
        token = str(options.get("token") or "").strip()
        token_env_name = str(options.get("token_env") or "COPILOT_API_KEY").strip()

        if not usernames:
            raise CommandError("No valid usernames provided.")
        if not provider:
            raise CommandError("Provider is required.")
        if not model:
            raise CommandError("Model is required.")

        if not token:
            token = str(os.getenv(token_env_name) or "").strip()

        if not token:
            raise CommandError(
                f"Missing token. Set --token or export environment variable {token_env_name}."
            )

        updated_count = 0
        missing_users: list[str] = []

        for username in usernames:
            user = User.objects.filter(username=username).first()
            if not user:
                missing_users.append(username)
                continue

            cfg, _ = UserConfig.objects.get_or_create(user=user)
            cfg.ai_provider = provider
            cfg.ai_model = model
            cfg.set_ai_api_key(token)
            cfg.save(update_fields=["ai_provider", "ai_model", "ai_api_key", "updated_at"])
            updated_count += 1
            self.stdout.write(self.style.SUCCESS(f"Updated AI config for user: {username}"))

        if missing_users:
            self.stdout.write(self.style.WARNING(f"Missing users: {', '.join(missing_users)}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Updated {updated_count} user(s)."))
