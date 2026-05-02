import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from .app_manifest import get_core_manifest


def _env_flag(name, default=False):
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _now_isoformat():
    return datetime.now(timezone.utc).isoformat()


def _build_target():
    return os.getenv("CORE_STUB_BUILD_TARGET", "saas").strip().lower() or "saas"


def _user_identity():
    is_staff = _env_flag("CORE_STUB_IS_STAFF", True)
    is_superuser = _env_flag("CORE_STUB_IS_SUPERUSER", True)
    return {
        "user_id": _env_int("CORE_STUB_USER_ID", 1),
        "username": os.getenv("CORE_STUB_USERNAME", "package-admin"),
        "email": os.getenv("CORE_STUB_EMAIL", "package-admin@vninvest.local"),
        "is_staff": is_staff,
        "is_superuser": is_superuser,
    }


def _ability_rules(identity, build_target):
    rules = [
        {"action": "read", "subject": "Dashboard"},
        {"action": "read", "subject": "WhaleAdvisory"},
        {"action": "read", "subject": "Support"},
        {"action": "read", "subject": "Watchlist"},
        {"action": "read", "subject": "Settings"},
    ]
    if build_target in {"saas", "vip"}:
        rules.extend([
            {"action": "read", "subject": "Transactions"},
            {"action": "manage", "subject": "Portfolios"},
        ])
    if identity["is_staff"] or identity["is_superuser"]:
        rules.append({"action": "manage", "subject": "all"})
    return rules


def _visible_groups(identity, build_target):
    groups = ["workspace", "signals", "system"]
    if build_target in {"saas", "vip"} and (identity["is_staff"] or identity["is_superuser"]):
        groups.append("admin")
    if build_target == "vip":
        groups.append("vip-local")
    return groups


def _visible_routes(identity, build_target):
    routes = ["dashboard", "watchlist", "support", "settings"]
    if build_target in {"saas", "vip"}:
        routes.extend(["ai-advisory", "whale-alerts", "transactions", "portfolios"])
    if build_target in {"saas", "vip"} and (identity["is_staff"] or identity["is_superuser"]):
        routes.extend(["admin-ops", "ai-command-center"])
    if build_target == "vip":
        routes.append("vip-local-control")
    return routes


def _capability_bootstrap_payload():
    identity = _user_identity()
    build_target = _build_target()
    plan = os.getenv("CORE_STUB_PLAN", "pro")
    return {
        "version": "1.0.0",
        "principal": {
            "mode": "human",
            "identity": identity,
        },
        "build": {
            "target": build_target,
            "plan": plan,
        },
        "abilities": _ability_rules(identity, build_target),
        "navigation": {
            "visible_groups": _visible_groups(identity, build_target),
            "visible_routes": _visible_routes(identity, build_target),
        },
        "surfaces": {
            "show_admin_ops": identity["is_staff"] or identity["is_superuser"],
            "show_ai_command_center": build_target in {"saas", "vip"},
            "show_vip_shell": build_target == "vip",
        },
    }


def _session_payload():
    identity = _user_identity()
    return {
        "version": "1.0.0",
        "session_id": os.getenv("CORE_STUB_SESSION_ID", "core-session-foundation"),
        "principal": {
            "kind": "human",
            "user_id": identity["user_id"],
            "username": identity["username"],
        },
        "tenant": {
            "tenant_id": None,
            "tenant_slug": None,
            "service_account_id": None,
        },
        "build_target": _build_target(),
        "issued_at": _now_isoformat(),
    }


def _health_payload():
    return {
        "ok": True,
        "service": "core-api",
        "environment": os.getenv("CORE_ENV", "foundation"),
        "version": get_core_manifest()["version"],
    }


ROUTE_HANDLERS = {
    "/health": _health_payload,
    "/healthz": _health_payload,
    "/manifest": get_core_manifest,
    "/access/capabilities": _capability_bootstrap_payload,
    "/session/me": _session_payload,
    "/core/v1/health": _health_payload,
    "/core/v1/healthz": _health_payload,
    "/core/v1/manifest": get_core_manifest,
    "/core/v1/access/capabilities": _capability_bootstrap_payload,
    "/core/v1/session/me": _session_payload,
}


class _CoreApiStubHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        payload_factory = ROUTE_HANDLERS.get(path)
        if payload_factory is not None:
            self._write_json(200, payload_factory())
            return

        self._write_json(
            404,
            {
                "ok": False,
                "error": "not_found",
                "available_paths": sorted(ROUTE_HANDLERS.keys()),
            },
        )

    def log_message(self, fmt, *args):
        return

    def _write_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(os.getenv("CORE_API_PORT", "8100"))
    server = ThreadingHTTPServer(("0.0.0.0", port), _CoreApiStubHandler)
    print(f"[vninvest-core] api stub listening on :{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()