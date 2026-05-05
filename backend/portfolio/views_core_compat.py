"""
Compatibility shim: /core/v1/* views bridging the Django backend for frontend
calls that expect the core-api service format (SFI transitional period).

These routes are registered WITHOUT the /api/ prefix so that nginx can route
/core/v1/* directly to the backend while core-api is not yet in the prod stack.
"""
import uuid
from datetime import datetime, timezone

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response

from .auth_views import _resolve_auth_bootstrap_state


@require_GET
@csrf_exempt
def core_health(request):
    return JsonResponse({
        "ok": True,
        "service": "vninvest-backend",
        "environment": "production",
        "version": "1.0.0",
    })


class CoreAuthMeView(APIView):
    """GET /core/v1/auth/me — session payload in core-api format."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        return Response({
            "version": "1.0.0",
            "session_id": f"legacy-{uuid.uuid4().hex[:12]}",
            "principal": {
                "kind": "human",
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": bool(user.is_staff),
                "is_superuser": bool(user.is_superuser),
            },
            "tenant": {
                "tenant_id": None,
                "tenant_slug": None,
                "service_account_id": None,
            },
            "build_target": "saas",
            "issued_at": datetime.now(timezone.utc).isoformat(),
        })


class CoreCapabilitiesView(APIView):
    """GET /core/v1/access/capabilities — capability bootstrap in core-api format."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        _cfg, entitlements, plan = _resolve_auth_bootstrap_state(user)

        is_staff = bool(user.is_staff or user.is_superuser)
        build_target = "saas"

        abilities = [
            {"action": "read", "subject": "Dashboard"},
            {"action": "read", "subject": "WhaleAdvisory"},
            {"action": "read", "subject": "Support"},
            {"action": "read", "subject": "Watchlist"},
            {"action": "read", "subject": "Settings"},
            {"action": "read", "subject": "Transactions"},
            {"action": "manage", "subject": "Portfolios"},
        ]
        visible_routes = [
            "dashboard", "watchlist", "support", "settings",
            "ai-advisory", "whale-alerts", "transactions", "portfolios",
        ]
        visible_groups = ["workspace", "signals", "system"]

        if is_staff:
            abilities += [
                {"action": "read", "subject": "admin.operator.read"},
                {"action": "manage", "subject": "system.ai_command_center.manage"},
            ]
            visible_routes += ["admin-ops", "ai-command-center"]
            visible_groups.append("admin")

        return Response({
            "version": "1.0.0",
            "snapshot_version": "2026-05-05",
            "principal": {
                "mode": "human",
                "identity": {
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_staff": is_staff,
                    "is_superuser": bool(user.is_superuser),
                },
            },
            "build": {
                "target": build_target,
                "plan": plan or "free",
            },
            "abilities": abilities,
            "navigation": {
                "visible_groups": visible_groups,
                "visible_routes": visible_routes,
            },
            "surfaces": {
                "show_admin_ops": is_staff,
                "show_ai_command_center": True,
                "show_vip_shell": False,
            },
        })
