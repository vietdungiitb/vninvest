from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0020_dpiinvoice_dpilicense_dpiplan_dpirevenueplan_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="userconfig",
            name="auto_downgrade_enabled",
            field=models.BooleanField(
                default=True,
                help_text="Neu tat, job tu dong se khong ha goi khi het han.",
                verbose_name="Cho phep tu dong ha goi",
            ),
        ),
        migrations.AddField(
            model_name="userconfig",
            name="downgraded_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="Thoi diem ha goi gan nhat",
            ),
        ),
        migrations.AddField(
            model_name="userconfig",
            name="plan_assigned_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="Thoi diem gan goi gan nhat",
            ),
        ),
        migrations.AddField(
            model_name="userconfig",
            name="plan_locked_by_admin",
            field=models.BooleanField(
                default=False,
                help_text="Neu bat, tac vu he thong khong duoc tu dong doi goi.",
                verbose_name="Khoa goi boi quan tri",
            ),
        ),
        migrations.AddField(
            model_name="userconfig",
            name="plan_source",
            field=models.CharField(
                choices=[
                    ("system_default", "He thong mac dinh"),
                    ("onboarding_trial", "Onboarding trial"),
                    ("manual_admin", "Admin chinh thu cong"),
                    ("paid", "Da tra phi"),
                ],
                db_index=True,
                default="system_default",
                max_length=30,
                verbose_name="Nguon goi dich vu",
            ),
        ),
        migrations.CreateModel(
            name="OnboardingPlanPolicy",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(default=False, verbose_name="Dang kich hoat"),
                ),
                (
                    "trial_plan",
                    models.CharField(
                        choices=[
                            ("free", "Mien phi"),
                            ("basic", "Co ban"),
                            ("pro", "Chuyen nghiep"),
                            ("premium", "Cao cap"),
                        ],
                        default="basic",
                        max_length=20,
                        verbose_name="Goi trai nghiem",
                    ),
                ),
                (
                    "trial_duration_days",
                    models.PositiveIntegerField(
                        default=30,
                        validators=[django.core.validators.MinValueValidator(1)],
                        verbose_name="Thoi luong trai nghiem (ngay)",
                    ),
                ),
                (
                    "fallback_plan",
                    models.CharField(
                        choices=[
                            ("free", "Mien phi"),
                            ("basic", "Co ban"),
                            ("pro", "Chuyen nghiep"),
                            ("premium", "Cao cap"),
                        ],
                        default="basic",
                        max_length=20,
                        verbose_name="Goi sau khi het han",
                    ),
                ),
                (
                    "effective_from",
                    models.DateTimeField(blank=True, null=True, verbose_name="Hieu luc tu"),
                ),
                (
                    "effective_to",
                    models.DateTimeField(blank=True, null=True, verbose_name="Hieu luc den"),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_onboarding_policies",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Tao boi",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_onboarding_policies",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Cap nhat boi",
                    ),
                ),
            ],
            options={
                "verbose_name": "Chinh sach onboarding trial",
                "verbose_name_plural": "Chinh sach onboarding trial",
                "ordering": ["-updated_at"],
            },
        ),
        migrations.CreateModel(
            name="PlanAssignmentLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("old_plan", models.CharField(blank=True, default="", max_length=20, verbose_name="Goi cu")),
                ("new_plan", models.CharField(max_length=20, verbose_name="Goi moi")),
                ("old_expires_at", models.DateTimeField(blank=True, null=True, verbose_name="Het han cu")),
                ("new_expires_at", models.DateTimeField(blank=True, null=True, verbose_name="Het han moi")),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("signup_trial", "Gan trial khi dang ky"),
                            ("trial_expired", "Het han trial tu dong ha goi"),
                            ("admin_override", "Quan tri chinh thu cong"),
                            ("payment_upgrade", "Nang cap tu thanh toan"),
                        ],
                        db_index=True,
                        max_length=30,
                        verbose_name="Ly do",
                    ),
                ),
                (
                    "actor_type",
                    models.CharField(
                        choices=[("system", "He thong"), ("admin", "Quan tri")],
                        db_index=True,
                        default="system",
                        max_length=20,
                        verbose_name="Nguon tac dong",
                    ),
                ),
                ("metadata_json", models.JSONField(blank=True, null=True, verbose_name="Metadata JSON")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "actor_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plan_assignment_actions",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Nguoi thao tac",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plan_assignment_logs",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Nguoi dung",
                    ),
                ),
            ],
            options={
                "verbose_name": "Nhat ky thay doi goi",
                "verbose_name_plural": "Nhat ky thay doi goi",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="planassignmentlog",
            index=models.Index(fields=["user", "-created_at"], name="idx_plan_log_user_created"),
        ),
        migrations.AddIndex(
            model_name="planassignmentlog",
            index=models.Index(fields=["reason", "-created_at"], name="idx_plan_log_reason_created"),
        ),
        migrations.AddConstraint(
            model_name="onboardingplanpolicy",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True)),
                fields=("is_active",),
                name="uniq_active_onboarding_policy",
            ),
        ),
    ]
