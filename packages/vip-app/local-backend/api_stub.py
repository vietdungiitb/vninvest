import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


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
    return "vip"


def _user_identity():
    is_local_admin = _env_flag("VIP_APP_STUB_IS_LOCAL_ADMIN", True)
    return {
        "user_id": _env_int("VIP_APP_STUB_USER_ID", 101),
        "username": os.getenv("VIP_APP_STUB_USERNAME", "vip-local-admin"),
        "email": os.getenv("VIP_APP_STUB_EMAIL", "vip-local-admin@vninvest.local"),
        "is_staff": is_local_admin,
        "is_superuser": _env_flag("VIP_APP_STUB_IS_SUPERUSER", False),
    }


def _ability_rules(identity):
    rules = [
        {"action": "read", "subject": "Dashboard"},
        {"action": "read", "subject": "WhaleAdvisory"},
        {"action": "read", "subject": "Watchlist"},
        {"action": "read", "subject": "Transactions"},
        {"action": "read", "subject": "Settings"},
        {"action": "read", "subject": "VipLocalControl"},
    ]
    if identity["is_staff"]:
        rules.append({"action": "manage", "subject": "VipLocalControl"})
    return rules


def _visible_groups():
    return ["workspace", "signals", "system", "vip-local"]


def _visible_routes():
    return [
        "dashboard",
        "ai-advisory",
        "whale-alerts",
        "watchlist",
        "transactions",
        "support",
        "settings",
        "vip-local-control",
    ]


def _capability_bootstrap_payload():
    identity = _user_identity()
    return {
        "version": "1.0.0",
        "principal": {
            "mode": "human",
            "identity": identity,
        },
        "build": {
            "target": _build_target(),
            "plan": os.getenv("VIP_APP_STUB_PLAN", "vip"),
        },
        "abilities": _ability_rules(identity),
        "navigation": {
            "visible_groups": _visible_groups(),
            "visible_routes": _visible_routes(),
        },
        "surfaces": {
            "show_admin_ops": False,
            "show_ai_command_center": True,
            "show_vip_shell": True,
        },
    }


def _session_payload():
    identity = _user_identity()
    return {
        "version": "1.0.0",
        "session_id": os.getenv("VIP_APP_STUB_SESSION_ID", "vip-local-session"),
        "principal": {
            "kind": "human",
            "user_id": identity["user_id"],
            "username": identity["username"],
        },
        "tenant": {
            "tenant_id": _env_int("VIP_APP_STUB_TENANT_ID", 1),
            "tenant_slug": os.getenv("VIP_APP_STUB_TENANT_SLUG", "vip-local"),
            "service_account_id": _env_int("VIP_APP_STUB_SERVICE_ACCOUNT_ID", 9001),
        },
        "build_target": _build_target(),
        "issued_at": _now_isoformat(),
    }


def _health_payload():
    return {
        "ok": True,
        "service": "vip-app-local-api",
        "environment": os.getenv("VIP_APP_ENV", "foundation"),
        "version": "1.0.0",
    }


def _manifest_payload():
    return {
        "package": "vip-app-local-backend",
        "service": "vip-app-local-api",
        "build_target": _build_target(),
        "routes": sorted(ROUTE_HANDLERS.keys()),
    }


ROUTE_HANDLERS = {
    "/health": _health_payload,
    "/healthz": _health_payload,
    "/manifest": _manifest_payload,
    "/access/capabilities": _capability_bootstrap_payload,
    "/session/bootstrap": _session_payload,
    "/vip-app/v1/health": _health_payload,
    "/vip-app/v1/healthz": _health_payload,
    "/vip-app/v1/manifest": _manifest_payload,
    "/vip-app/v1/access/capabilities": _capability_bootstrap_payload,
    "/vip-app/v1/session/bootstrap": _session_payload,
}


class _VipAppApiStubHandler(BaseHTTPRequestHandler):
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
    port = int(os.getenv("VIP_APP_API_PORT", "8200"))
    server = ThreadingHTTPServer(("0.0.0.0", port), _VipAppApiStubHandler)
    print(f"[vninvest-vip-app] local api stub listening on :{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()