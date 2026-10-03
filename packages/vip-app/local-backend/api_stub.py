import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from store import VipAppStateStore


STATE_STORE = VipAppStateStore(env=os.environ)


class ApiError(Exception):
    def __init__(self, status_code, error, message, *, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.error = error
        self.message = message
        self.details = details or {}


def _route_list():
    return [f"{method} {path}" for method, path in sorted(ROUTE_HANDLERS.keys())]


def _health_payload(_body=None, _query=None):
    return 200, STATE_STORE.get_health_payload()


def _manifest_payload(_body=None, _query=None):
    return 200, STATE_STORE.get_manifest_payload(_route_list())


def _capability_bootstrap_payload(_body=None, _query=None):
    return 200, STATE_STORE.get_capability_bootstrap_payload()


def _session_payload(_body=None, _query=None):
    return 200, STATE_STORE.get_session_payload()


def _list_users(_body=None, _query=None):
    users = STATE_STORE.list_users()
    return 200, {"ok": True, "count": len(users), "users": users}


def _list_audit_logs(_body=None, query=None):
    raw_limit = (query or {}).get("limit", [50])[0]
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        raise ApiError(400, "invalid_limit", "limit must be an integer")
    audit_logs = STATE_STORE.list_audit_logs(limit=limit)
    return 200, {"ok": True, "count": len(audit_logs), "audit_logs": audit_logs}


def _login(body=None, _query=None):
    body = body or {}
    username = str(body.get("username") or "").strip()
    password = body.get("password")
    if password is None:
        raise ApiError(400, "missing_password", "password is required")
    try:
        session = STATE_STORE.login(username=username, password=password)
    except ValueError as error:
        raise ApiError(400, "invalid_request", str(error))
    except PermissionError:
        raise ApiError(401, "invalid_credentials", "Invalid username or password")

    return 200, {
        "ok": True,
        "session": session,
        "capabilities": STATE_STORE.get_capability_bootstrap_payload(),
    }


def _logout(_body=None, _query=None):
    session = STATE_STORE.logout()
    return 200, {
        "ok": True,
        "session": session,
        "capabilities": STATE_STORE.get_capability_bootstrap_payload(),
    }


def _reset_session(_body=None, _query=None):
    session = STATE_STORE.reset_session()
    return 200, {
        "ok": True,
        "session": session,
        "capabilities": STATE_STORE.get_capability_bootstrap_payload(),
    }


def _upsert_user(body=None, _query=None):
    body = body or {}
    try:
        created, user = STATE_STORE.upsert_user(body)
    except ValueError as error:
        raise ApiError(400, "invalid_request", str(error))

    return (201 if created else 200), {
        "ok": True,
        "created": created,
        "user": user,
    }


ROUTE_HANDLERS = {
    ("GET", "/health"): _health_payload,
    ("GET", "/healthz"): _health_payload,
    ("GET", "/manifest"): _manifest_payload,
    ("GET", "/access/capabilities"): _capability_bootstrap_payload,
    ("GET", "/session/bootstrap"): _session_payload,
    ("GET", "/rbac/users"): _list_users,
    ("GET", "/audit/logs"): _list_audit_logs,
    ("POST", "/auth/login"): _login,
    ("POST", "/auth/logout"): _logout,
    ("POST", "/auth/reset"): _reset_session,
    ("POST", "/rbac/users"): _upsert_user,
    ("GET", "/vip-app/v1/health"): _health_payload,
    ("GET", "/vip-app/v1/healthz"): _health_payload,
    ("GET", "/vip-app/v1/manifest"): _manifest_payload,
    ("GET", "/vip-app/v1/access/capabilities"): _capability_bootstrap_payload,
    ("GET", "/vip-app/v1/session/bootstrap"): _session_payload,
    ("GET", "/vip-app/v1/rbac/users"): _list_users,
    ("GET", "/vip-app/v1/audit/logs"): _list_audit_logs,
    ("POST", "/vip-app/v1/auth/login"): _login,
    ("POST", "/vip-app/v1/auth/logout"): _logout,
    ("POST", "/vip-app/v1/auth/reset"): _reset_session,
    ("POST", "/vip-app/v1/rbac/users"): _upsert_user,
}


class _VipAppApiStubHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def log_message(self, fmt, *args):
        return

    def _dispatch(self, method):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)
        handler = ROUTE_HANDLERS.get((method, path))
        if handler is None:
            self._write_json(
                404,
                {
                    "ok": False,
                    "error": "not_found",
                    "available_routes": _route_list(),
                },
            )
            return

        body = None
        if method == "POST":
            try:
                body = self._read_json_body()
            except ValueError as error:
                self._write_json(
                    400,
                    {
                        "ok": False,
                        "error": "invalid_json",
                        "message": str(error),
                    },
                )
                return

        try:
            status_code, payload = handler(body, query)
        except ApiError as error:
            self._write_json(
                error.status_code,
                {
                    "ok": False,
                    "error": error.error,
                    "message": error.message,
                    "details": error.details,
                },
            )
            return

        self._write_json(status_code, payload)

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            return {}

        raw_body = self.rfile.read(content_length)
        if not raw_body:
            return {}

        try:
            return json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"Malformed JSON body: {error.msg}") from error

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