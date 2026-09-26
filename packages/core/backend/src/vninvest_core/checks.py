"""Django system checks for the self-service registration / tenant path.

These exist because a misconfiguration in this area fails SILENTLY and expensively
rather than loudly:

* ``TRUSTED_PROXY_IPS=[]`` looks like the conservative choice, but in the
  containerised deployment the app is only reachable through the nginx container
  on a private network, so ``REMOTE_ADDR`` is the proxy's address for every
  request. Every rate limiter then buckets the entire platform as one client, and
  the Nth registration/login per minute is refused no matter who sent it. That is
  the same class of outage as a spoofing hole, just aimed at availability instead
  of integrity, so it must not be shippable without a human deciding to accept it.
* ``TURNSTILE_SECRET_KEY`` missing means the signup form's bot check is skipped.

A warning is not enough here. The Turnstile double-assignment defect survived in
this codebase precisely because a comment described the right behaviour and
nothing failed. A check that reports ``Error`` stops the boot.
"""

from django.core.checks import Error, Warning, register

#: Emitted when TRUSTED_PROXY_IPS is explicitly empty while not in DEBUG.
TRUSTED_PROXY_EMPTY_ID = "vninvest_core.E001"
#: Emitted when TURNSTILE_SECRET_KEY is absent while not in DEBUG. A Warning
#: rather than an Error, because ``env_validation.validate_production_settings``
#: already raises ImproperlyConfigured for that variable at import time -- a second
#: hard stop here would only duplicate the failure, and would additionally block
#: ``manage.py test`` (Django forces DEBUG=False there, so the check could never
#: tell a test run from a real boot).
TURNSTILE_SECRET_MISSING_ID = "vninvest_core.W002"


def _running_tests():
    """True under ``manage.py test``, where DEBUG is forced False by Django.

    Guards would otherwise make the suite unrunnable, which is how a check turns
    into something people disable wholesale.
    """
    import sys

    return "test" in sys.argv


@register()
def check_trusted_proxy_ips(app_configs, **kwargs):
    from django.conf import settings

    if getattr(settings, "DEBUG", False) or _running_tests():
        return []

    trusted = getattr(settings, "TRUSTED_PROXY_IPS", None)
    if trusted:
        return []

    return [
        Error(
            "TRUSTED_PROXY_IPS is empty while DEBUG is False.",
            hint=(
                "Behind the bundled nginx the application only ever sees the proxy's "
                "container address in REMOTE_ADDR, so an empty trusted-proxy list makes "
                "vninvest_core.client_ip return the SAME address for every request in the "
                "deployment. Every rate limiter (register, login, resend) then shares one "
                "global bucket and the platform starts refusing logins. Either unset the "
                "variable to use the built-in private-range default, or set it to the "
                "proxy network, e.g. TRUSTED_PROXY_IPS=127.0.0.1,::1,172.16.0.0/12"
            ),
            id=TRUSTED_PROXY_EMPTY_ID,
        )
    ]


@register()
def check_turnstile_secret(app_configs, **kwargs):
    from django.conf import settings

    if getattr(settings, "DEBUG", False) or _running_tests():
        return []

    if getattr(settings, "TURNSTILE_SECRET_KEY", ""):
        return []

    return [
        Warning(
            "TURNSTILE_SECRET_KEY is not set while DEBUG is False.",
            hint=(
                "The self-service registration form's bot check is skipped when the "
                "secret is missing, leaving only a honeypot field and a short "
                "disposable-domain list. Set TURNSTILE_SECRET_KEY, or deliberately "
                "disable the form."
            ),
            id=TURNSTILE_SECRET_MISSING_ID,
        )
    ]


@register()
def check_onboarding_path_exempt(app_configs, **kwargs):
    """The self-service tenant signup path must be exempt from tenant resolution.

    Without the exemption ``TenantResolutionMiddleware`` returns 403
    ``tenant_not_found`` before the view runs, for exactly the only kind of user
    that endpoint serves: someone with no tenant yet. The endpoint then looks
    implemented and tested while being unreachable in production.
    """
    from django.conf import settings

    try:
        from identity_access.middleware import TenantResolutionMiddleware
    except Exception:  # pragma: no cover - import order during early startup
        return []

    if "/core/v1/onboarding/" in TenantResolutionMiddleware.EXEMPT_PATH_PREFIXES:
        return []

    return [
        Error(
            "'/core/v1/onboarding/' is missing from "
            "TenantResolutionMiddleware.EXEMPT_PATH_PREFIXES.",
            hint=(
                "Self-service tenant registration is unreachable: the middleware "
                "resolves a tenant and returns 403 tenant_not_found before the view "
                "runs, for exactly the tenant-less user it exists to serve."
            ),
            id="vninvest_core.E003",
        )
    ]


@register()
def check_email_verification_pruning_scheduled(app_configs, **kwargs):
    """``EmailVerificationToken`` rows accumulate unless the prune task is scheduled.

    Rows are written on every registration and on every resend. The task exists and
    is unit-tested; if it is not on the beat schedule the table grows without
    bound, and the tests give false confidence because they call the task directly.
    """
    from django.conf import settings

    if getattr(settings, "DEBUG", False) or _running_tests():
        return []

    scheduled = {
        entry.get("task")
        for entry in getattr(settings, "CELERY_BEAT_SCHEDULE", {}).values()
        if isinstance(entry, dict)
    }
    if "identity_access.email_tasks.prune_email_verification_tokens" in scheduled:
        return []

    return [
        Warning(
            "prune_email_verification_tokens is not in CELERY_BEAT_SCHEDULE.",
            hint=(
                "EmailVerificationToken gains a row per registration and per resend "
                "and is never deleted, so the table grows without bound. Add the task "
                "to CELERY_BEAT_SCHEDULE (e.g. crontab minute=17 hourly)."
            ),
            id="vninvest_core.W001",
        )
    ]
