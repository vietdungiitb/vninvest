import copy
import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock


ROLE_KEYS = ("vip_viewer", "vip_operator", "vip_admin", "vip_superuser")


def _now_isoformat():
    return datetime.now(timezone.utc).isoformat()


def _coerce_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _normalize_role_keys(raw_roles, *, is_staff=False, is_superuser=False):
    if isinstance(raw_roles, str):
        candidates = [item.strip().lower() for item in raw_roles.split(",")]
    elif isinstance(raw_roles, (list, tuple, set)):
        candidates = [str(item).strip().lower() for item in raw_roles]
    else:
        candidates = []

    normalized = []
    for candidate in candidates:
        if candidate in ROLE_KEYS and candidate not in normalized:
            normalized.append(candidate)

    if normalized:
        if is_superuser and "vip_superuser" not in normalized:
            normalized.append("vip_superuser")
        return normalized

    if is_superuser:
        normalized.append("vip_superuser")
    elif is_staff:
        normalized.append("vip_admin")
    else:
        normalized.append("vip_viewer")
    return normalized


def _identity_flags(role_keys):
    role_set = set(role_keys or [])
    is_superuser = "vip_superuser" in role_set
    is_staff = is_superuser or bool(role_set.intersection({"vip_admin", "vip_operator"}))
    return is_staff, is_superuser


def _hash_password(raw_password):
    password = str(raw_password or "")
    salted = f"vninvest-vip-app::{password}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def _strip_secret_fields(user_record):
    sanitized = copy.deepcopy(user_record)
    sanitized.pop("password_hash", None)
    return sanitized


class VipAppStateStore:
    def __init__(self, *, data_dir=None, env=None):
        self._env = dict(env or {})
        base_dir = Path(__file__).resolve().parent
        self.data_dir = Path(data_dir) if data_dir else base_dir / "data"
        self.state_file = self.data_dir / "state.json"
        self._lock = RLock()
        self._state = None
        self._load_or_initialize_state()

    def get_build_target(self):
        return "vip"

    def get_plan(self):
        return str(self._env.get("VIP_APP_STUB_PLAN", "vip") or "vip")

    def get_health_payload(self):
        return {
            "ok": True,
            "service": "vip-app-local-api",
            "environment": self._env.get("VIP_APP_ENV", "foundation"),
            "version": "1.0.0",
        }

    def get_manifest_payload(self, routes):
        summary = self.get_state_summary()
        return {
            "package": "vip-app-local-backend",
            "service": "vip-app-local-api",
            "build_target": self.get_build_target(),
            "persistence": summary,
            "routes": routes,
        }

    def get_state_summary(self):
        with self._lock:
            session = self._state.get("active_session", {})
            return {
                "state_file": str(self.state_file),
                "user_count": len(self._state.get("users", [])),
                "audit_count": len(self._state.get("audit_logs", [])),
                "has_active_session": bool(session.get("session_id")),
            }

    def get_capability_bootstrap_payload(self):
        with self._lock:
            user = self._get_active_user_locked()
            return {
                "version": "1.0.0",
                "principal": {
                    "mode": "human",
                    "identity": self._identity_payload_locked(user),
                },
                "build": {
                    "target": self.get_build_target(),
                    "plan": self.get_plan(),
                },
                "abilities": self._ability_rules_locked(user),
                "navigation": {
                    "visible_groups": self._visible_groups_locked(user),
                    "visible_routes": self._visible_routes_locked(user),
                },
                "surfaces": {
                    "show_admin_ops": False,
                    "show_ai_command_center": bool(user),
                    "show_vip_shell": True,
                },
            }

    def get_session_payload(self):
        with self._lock:
            session = copy.deepcopy(self._state.get("active_session", {}))
            user = self._get_user_by_id_locked(session.get("user_id"))
            return {
                "version": "1.0.0",
                "session_id": str(session.get("session_id") or ""),
                "principal": {
                    "kind": "human",
                    "user_id": user.get("user_id") if user else None,
                    "username": user.get("username") if user else "",
                },
                "tenant": copy.deepcopy(self._state["tenant"]),
                "build_target": self.get_build_target(),
                "issued_at": session.get("issued_at") or _now_isoformat(),
            }

    def list_users(self):
        with self._lock:
            users = [_strip_secret_fields(item) for item in self._state.get("users", [])]
            return sorted(users, key=lambda item: item.get("user_id") or 0)

    def list_audit_logs(self, *, limit=50):
        with self._lock:
            capped_limit = max(int(limit or 0), 1)
            items = copy.deepcopy(self._state.get("audit_logs", []))
            items.sort(key=lambda item: item.get("audit_id") or 0, reverse=True)
            return items[:capped_limit]

    def login(self, *, username, password):
        normalized_username = str(username or "").strip().lower()
        if not normalized_username:
            raise ValueError("username is required")

        with self._lock:
            user = self._get_user_by_username_locked(normalized_username)
            if user is None or user.get("password_hash") != _hash_password(password):
                raise PermissionError("invalid credentials")

            self._state["active_session"] = self._build_session_record_locked(
                user,
                session_id=str(uuid.uuid4()),
            )
            self._append_audit_log_locked(
                action="auth.login",
                actor_username=user["username"],
                details={"user_id": user["user_id"]},
            )
            self._persist_locked()
            return self.get_session_payload()

    def logout(self):
        with self._lock:
            actor = self._get_active_user_locked()
            self._state["active_session"] = self._anonymous_session_record()
            self._append_audit_log_locked(
                action="auth.logout",
                actor_username=actor.get("username") if actor else "system",
                details={"reason": "manual_logout"},
            )
            self._persist_locked()
            return self.get_session_payload()

    def reset_session(self):
        with self._lock:
            default_user = self._resolve_seed_user_locked()
            self._state["active_session"] = self._build_session_record_locked(
                default_user,
                session_id=str(self._env.get("VIP_APP_STUB_SESSION_ID", "vip-local-session") or "vip-local-session"),
            )
            self._append_audit_log_locked(
                action="auth.reset",
                actor_username=default_user["username"],
                details={"user_id": default_user["user_id"]},
            )
            self._persist_locked()
            return self.get_session_payload()

    def upsert_user(self, payload):
        username = str(payload.get("username") or "").strip()
        if not username:
            raise ValueError("username is required")

        with self._lock:
            target_user = None
            raw_user_id = payload.get("user_id")
            if raw_user_id is not None:
                try:
                    target_user = self._get_user_by_id_locked(int(raw_user_id))
                except (TypeError, ValueError):
                    raise ValueError("user_id must be an integer")

            if target_user is None:
                target_user = self._get_user_by_username_locked(username)

            requested_role_keys = payload.get("role_keys")
            if target_user is None:
                role_keys = _normalize_role_keys(
                    requested_role_keys,
                    is_staff=_coerce_bool(payload.get("is_staff"), default=False),
                    is_superuser=_coerce_bool(payload.get("is_superuser"), default=False),
                )
            elif requested_role_keys is None and "is_staff" not in payload and "is_superuser" not in payload:
                role_keys = list(target_user.get("role_keys") or [])
            else:
                role_keys = _normalize_role_keys(
                    requested_role_keys,
                    is_staff=_coerce_bool(payload.get("is_staff"), default=target_user.get("is_staff", False)),
                    is_superuser=_coerce_bool(payload.get("is_superuser"), default=target_user.get("is_superuser", False)),
                )
            is_staff, is_superuser = _identity_flags(role_keys)

            if target_user is None:
                user_record = {
                    "user_id": self._allocate_user_id_locked(),
                    "username": username,
                    "email": str(payload.get("email") or f"{username}@vninvest.local"),
                    "is_staff": is_staff,
                    "is_superuser": is_superuser,
                    "role_keys": role_keys,
                    "password_hash": _hash_password(payload.get("password") or self._env.get("VIP_APP_STUB_PASSWORD", "vip-demo-pass")),
                }
                self._state["users"].append(user_record)
                created = True
            else:
                target_user["username"] = username
                target_user["email"] = str(payload.get("email") or target_user.get("email") or f"{username}@vninvest.local")
                target_user["is_staff"] = is_staff
                target_user["is_superuser"] = is_superuser
                target_user["role_keys"] = role_keys
                if payload.get("password"):
                    target_user["password_hash"] = _hash_password(payload["password"])
                user_record = target_user
                created = False

            active_session = self._state.get("active_session", {})
            if active_session.get("user_id") == user_record["user_id"]:
                active_session["username"] = user_record["username"]

            self._append_audit_log_locked(
                action="rbac.user_upsert",
                actor_username=self._active_username_locked(),
                details={
                    "user_id": user_record["user_id"],
                    "username": user_record["username"],
                    "created": created,
                    "role_keys": list(user_record["role_keys"]),
                },
            )
            self._persist_locked()
            return created, _strip_secret_fields(user_record)

    def _load_or_initialize_state(self):
        with self._lock:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            if self.state_file.exists():
                try:
                    raw_state = json.loads(self.state_file.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    raw_state = None
            else:
                raw_state = None

            self._state = self._default_state() if raw_state is None else self._normalize_state(raw_state)
            self._persist_locked()

    def _default_state(self):
        seed_user = self._seed_user_record()
        return {
            "version": "1.0.0",
            "tenant": self._seed_tenant_record(),
            "users": [seed_user],
            "active_session": self._build_session_record_locked(
                seed_user,
                session_id=str(self._env.get("VIP_APP_STUB_SESSION_ID", "vip-local-session") or "vip-local-session"),
            ),
            "audit_logs": [
                {
                    "audit_id": 1,
                    "action": "bootstrap.seed",
                    "actor_username": seed_user["username"],
                    "created_at": _now_isoformat(),
                    "details": {"user_id": seed_user["user_id"]},
                }
            ],
            "metadata": {
                "next_user_id": seed_user["user_id"] + 1,
                "next_audit_id": 2,
            },
        }

    def _normalize_state(self, raw_state):
        state = {
            "version": "1.0.0",
            "tenant": self._normalize_tenant_record(raw_state.get("tenant")),
            "users": [],
            "active_session": raw_state.get("active_session") or self._anonymous_session_record(),
            "audit_logs": list(raw_state.get("audit_logs") or []),
            "metadata": copy.deepcopy(raw_state.get("metadata") or {}),
        }

        for index, raw_user in enumerate(raw_state.get("users") or [], start=1):
            state["users"].append(self._normalize_user_record(raw_user, fallback_user_id=100 + index))

        if not state["users"]:
            state["users"].append(self._seed_user_record())

        session = state["active_session"]
        session_user = self._get_user_by_id_from_state(state, session.get("user_id"))
        if session_user is None and session.get("user_id") is not None:
            state["active_session"] = self._anonymous_session_record()
        elif session_user is not None:
            state["active_session"] = self._build_session_record_locked(
                session_user,
                session_id=str(session.get("session_id") or uuid.uuid4()),
                issued_at=session.get("issued_at"),
            )

        max_user_id = max((user.get("user_id") or 0 for user in state["users"]), default=100)
        max_audit_id = max((item.get("audit_id") or 0 for item in state["audit_logs"]), default=0)
        state["metadata"]["next_user_id"] = max(max_user_id + 1, int(state["metadata"].get("next_user_id") or 0), 101)
        state["metadata"]["next_audit_id"] = max(max_audit_id + 1, int(state["metadata"].get("next_audit_id") or 0), 1)
        return state

    def _seed_tenant_record(self):
        return {
            "tenant_id": int(self._env.get("VIP_APP_STUB_TENANT_ID", 1) or 1),
            "tenant_slug": str(self._env.get("VIP_APP_STUB_TENANT_SLUG", "vip-local") or "vip-local"),
            "service_account_id": int(self._env.get("VIP_APP_STUB_SERVICE_ACCOUNT_ID", 9001) or 9001),
        }

    def _normalize_tenant_record(self, raw_tenant):
        seed = self._seed_tenant_record()
        raw_tenant = raw_tenant or {}
        return {
            "tenant_id": int(raw_tenant.get("tenant_id") or seed["tenant_id"]),
            "tenant_slug": str(raw_tenant.get("tenant_slug") or seed["tenant_slug"]),
            "service_account_id": int(raw_tenant.get("service_account_id") or seed["service_account_id"]),
        }

    def _seed_user_record(self):
        user_id = int(self._env.get("VIP_APP_STUB_USER_ID", 101) or 101)
        role_keys = _normalize_role_keys(
            [],
            is_staff=_coerce_bool(self._env.get("VIP_APP_STUB_IS_LOCAL_ADMIN"), default=True),
            is_superuser=_coerce_bool(self._env.get("VIP_APP_STUB_IS_SUPERUSER"), default=False),
        )
        is_staff, is_superuser = _identity_flags(role_keys)
        return {
            "user_id": user_id,
            "username": str(self._env.get("VIP_APP_STUB_USERNAME", "vip-local-admin") or "vip-local-admin"),
            "email": str(self._env.get("VIP_APP_STUB_EMAIL", "vip-local-admin@vninvest.local") or "vip-local-admin@vninvest.local"),
            "is_staff": is_staff,
            "is_superuser": is_superuser,
            "role_keys": role_keys,
            "password_hash": _hash_password(self._env.get("VIP_APP_STUB_PASSWORD", "vip-demo-pass")),
        }

    def _normalize_user_record(self, raw_user, *, fallback_user_id=101):
        role_keys = _normalize_role_keys(
            raw_user.get("role_keys"),
            is_staff=_coerce_bool(raw_user.get("is_staff"), default=False),
            is_superuser=_coerce_bool(raw_user.get("is_superuser"), default=False),
        )
        is_staff, is_superuser = _identity_flags(role_keys)
        password_hash = str(raw_user.get("password_hash") or "")
        if not password_hash:
            password_hash = _hash_password(self._env.get("VIP_APP_STUB_PASSWORD", "vip-demo-pass"))
        return {
            "user_id": int(raw_user.get("user_id") or fallback_user_id),
            "username": str(raw_user.get("username") or "vip-user"),
            "email": str(raw_user.get("email") or "vip-user@vninvest.local"),
            "is_staff": is_staff,
            "is_superuser": is_superuser,
            "role_keys": role_keys,
            "password_hash": password_hash,
        }

    def _build_session_record_locked(self, user_record, *, session_id=None, issued_at=None):
        return {
            "session_id": str(session_id or uuid.uuid4()),
            "user_id": user_record["user_id"],
            "username": user_record["username"],
            "issued_at": issued_at or _now_isoformat(),
        }

    def _anonymous_session_record(self):
        return {
            "session_id": "",
            "user_id": None,
            "username": "",
            "issued_at": _now_isoformat(),
        }

    def _persist_locked(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        temp_path = self.state_file.with_suffix(".tmp")
        temp_path.write_text(
            json.dumps(self._state, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        temp_path.replace(self.state_file)

    def _append_audit_log_locked(self, *, action, actor_username, details):
        audit_id = self._state["metadata"].get("next_audit_id", 1)
        self._state["metadata"]["next_audit_id"] = audit_id + 1
        self._state["audit_logs"].append(
            {
                "audit_id": audit_id,
                "action": action,
                "actor_username": actor_username,
                "created_at": _now_isoformat(),
                "details": copy.deepcopy(details),
            }
        )

    def _allocate_user_id_locked(self):
        next_user_id = int(self._state.get("metadata", {}).get("next_user_id") or 101)
        if next_user_id <= 0:
            next_user_id = 101
        if self._state is not None:
            self._state.setdefault("metadata", {})["next_user_id"] = next_user_id + 1
        return next_user_id

    def _active_username_locked(self):
        user = self._get_active_user_locked()
        return user.get("username") if user else "system"

    def _resolve_seed_user_locked(self):
        configured_username = str(self._env.get("VIP_APP_STUB_USERNAME", "vip-local-admin") or "vip-local-admin").lower()
        user = self._get_user_by_username_locked(configured_username)
        if user is not None:
            return user
        for candidate in self._state.get("users", []):
            if candidate.get("is_staff"):
                return candidate
        return self._state["users"][0]

    def _get_user_by_id_locked(self, user_id):
        return self._get_user_by_id_from_state(self._state, user_id)

    def _get_user_by_id_from_state(self, state, user_id):
        for candidate in state.get("users", []):
            if candidate.get("user_id") == user_id:
                return candidate
        return None

    def _get_user_by_username_locked(self, username):
        normalized = str(username or "").strip().lower()
        for candidate in self._state.get("users", []):
            if str(candidate.get("username") or "").strip().lower() == normalized:
                return candidate
        return None

    def _get_active_user_locked(self):
        session = self._state.get("active_session", {})
        return self._get_user_by_id_locked(session.get("user_id"))

    def _identity_payload_locked(self, user_record):
        if user_record is None:
            return {
                "user_id": None,
                "username": "",
                "email": "",
                "is_staff": False,
                "is_superuser": False,
            }
        return {
            "user_id": user_record["user_id"],
            "username": user_record["username"],
            "email": user_record["email"],
            "is_staff": bool(user_record["is_staff"]),
            "is_superuser": bool(user_record["is_superuser"]),
        }

    def _ability_rules_locked(self, user_record):
        if user_record is None:
            return []

        rules = [
            {"action": "read", "subject": "Dashboard"},
            {"action": "read", "subject": "WhaleAdvisory"},
            {"action": "read", "subject": "Watchlist"},
            {"action": "read", "subject": "Transactions"},
            {"action": "read", "subject": "Settings"},
            {"action": "read", "subject": "VipLocalControl"},
        ]
        role_keys = set(user_record.get("role_keys") or [])
        if role_keys.intersection({"vip_operator", "vip_admin", "vip_superuser"}):
            rules.extend(
                [
                    {"action": "read", "subject": "VipAuditLog"},
                    {"action": "manage", "subject": "VipLocalControl"},
                ]
            )
        if role_keys.intersection({"vip_admin", "vip_superuser"}):
            rules.append({"action": "manage", "subject": "VipLocalUsers"})
        if user_record.get("is_superuser"):
            rules.append({"action": "manage", "subject": "all"})
        return rules

    def _visible_groups_locked(self, user_record):
        if user_record is None:
            return ["system"]
        return ["workspace", "signals", "system", "vip-local"]

    def _visible_routes_locked(self, user_record):
        if user_record is None:
            return ["settings"]
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