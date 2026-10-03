from django.apps import AppConfig


class UserWorkspaceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'user_workspace'
    verbose_name = 'User Workspace'

    def ready(self):
        from . import signals  # noqa: F401
