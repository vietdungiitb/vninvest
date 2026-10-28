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
#: Emitted when BROKER_SECRET_KEY is absent, which pins every new broker secret to
#: the legacy key derived from SECRET_KEY. See SEC-02 PB1.
BROKER_SECRET_KEY_MISSING_ID = "vninvest_core.W003"
#: Emitted when BROKER_SECRET_KEY is set but no retained older key is configured,
#: i.e. rotating it would strand existing ciphertext.
BROKER_SECRET_KEY_NO_RETAINED_ID = "vninvest_core.W004"
#: Emitted when BROKER_SECRET_KEY (or a retained BROKER_SECRET_KEY_V<n>) still
#: holds the literal placeholder shipped in ``compose.dev.env.example``. This is an
#: ``Error`` and is NOT suppressed by DEBUG, because ``cp *.example *.env`` is the
#: documented onboarding step: a dev stack would otherwise encrypt every broker
#: credential under a value published in the repository while the code reports that
#: the key is properly decoupled from SECRET_KEY.
BROKER_SECRET_KEY_PLACEHOLDER_ID = "vninvest_core.E002"


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
def check_broker_secret_key_rotation(app_configs, **kwargs):
    """SEC-02 PB1: make key misconfiguration visible without breaking boot.

    PB1 asks whether a missing ``BROKER_SECRET_KEY`` should raise at import or only
    fail at decrypt. Answer: neither import nor a hard ``Error``.

    * Raising at import would take down every endpoint, health check and migration
      in a deployment that simply has no broker credentials configured yet - the
      blast radius is the whole application for a feature that is optional.
    * Failing only at decrypt is what SEC-02 flagged as insufficient, because the
      failure would otherwise surface as the first broker request and nothing else.
      So ``SecretStore`` raises :class:`SecretKeyMissingError` (never an empty
      plaintext), and this check makes the misconfiguration visible up front.

    ``Warning`` rather than ``Error``, matching ``check_turnstile_secret``: an
    ``Error`` would also make ``manage.py check`` non-zero in every environment
    without the variable, which contradicts SEC-02 AC4.
    """
    import os
    import re

    from django.conf import settings

    from vninvest_core.env_validation import is_placeholder_value
    from vninvest_core.utils.encryption import SecretKeyMissingError, SecretStore

    if _running_tests():
        return []

    broker_key = os.environ.get("BROKER_SECRET_KEY", "").strip()
    placeholder_vars = [
        name
        for name in os.environ
        if re.fullmatch(r"BROKER_SECRET_KEY(_V\d+)?", name)
        and is_placeholder_value(os.environ[name])
    ]
    if is_placeholder_value(broker_key) or placeholder_vars:
        return [
            Error(
                "Broker secret key(s) still hold the placeholder value from "
                f"compose.dev.env.example: {sorted(placeholder_vars) or ['BROKER_SECRET_KEY']}.",
                hint=(
                    "cp compose.dev.env.example compose.dev.env leaves <REQUIRED> in place. "
                    "That literal is a public constant, so every broker credential would be "
                    "encrypted under a known value while the code reports the key as "
                    "decoupled from DJANGO_SECRET_KEY. Generate a real Fernet key: "
                    'python -c "from cryptography.fernet import Fernet; '
                    "print(Fernet.generate_key().decode())\""
                ),
                id=BROKER_SECRET_KEY_PLACEHOLDER_ID,
            )
        ]

    if getattr(settings, "DEBUG", False):
        return []

    if not broker_key:
        return [
            Warning(
                "BROKER_SECRET_KEY is not set, so new broker secrets fall back to the "
                "legacy key derived from SECRET_KEY.",
                hint=(
                    "Until this is set, UserBrokerConfig rows are written at secret "
                    "version 1 and rotating DJANGO_SECRET_KEY will make every stored "
                    "broker credential undecryptable - the coupling SEC-02 exists to "
                    "remove. Set BROKER_SECRET_KEY to a value of your choosing to decouple "
                    "them; existing rows keep working and can be re-encrypted later."
                ),
                id=BROKER_SECRET_KEY_MISSING_ID,
            )
        ]

    # A retained slot for the CURRENT version protects nothing: the live key is
    # what that version resolves to, so counting it would report a safe rotation
    # path that does not exist.
    try:
        current = SecretStore.current_version()
    except SecretKeyMissingError:
        current = None

    retained = [
        name
        for name in os.environ
        if re.fullmatch(r"BROKER_SECRET_KEY_V\d+", name)
        and os.environ[name].strip()
        and name != f"BROKER_SECRET_KEY_V{current}"
    ]
    if retained:
        return []

    return [
        Warning(
            "BROKER_SECRET_KEY is set but no BROKER_SECRET_KEY_V<n> key is retained.",
            hint=(
                "Rotating BROKER_SECRET_KEY right now would strand every row already "
                "written under the current key: SecretStore would raise "
                "SecretKeyMissingError on read. To rotate, first start the new key under "
                "BROKER_SECRET_KEY_V<old version>, re-encrypt the affected rows with "
                "SecretStore.reencrypt(), and only then promote it to BROKER_SECRET_KEY."
            ),
            id=BROKER_SECRET_KEY_NO_RETAINED_ID,
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
