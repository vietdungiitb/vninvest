"""Legacy bridge compatibility helper.

SaaS Full Independence mode no longer proxies requests to legacy backend.
Keep this helper to preserve old call signatures while forcing native fallback paths.
"""


def legacy_bridge_response(request, legacy_path: str, *, unavailable_message: str):
    """Return None to signal legacy bridge is disabled.

    Existing callers treat None as "bridge unavailable" and continue to
    native/stub behavior without raising NameError.
    """
    return None
