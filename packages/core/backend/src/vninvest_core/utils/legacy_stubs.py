"""
Compatibility shim views for legacy frontend API paths.

These views map legacy `/api/<legacy-path>/` routes to either:
  - Existing core domain views (real data), or
  - Graceful stub responses (empty lists / minimal objects) for features not yet
    fully migrated to packages/core.

IMPORTANT: Every stub here is a placeholder.  As more domain functionality is
migrated, replace the stub with the real core view.
"""
import base64
import hashlib
import json
from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_list():
    return Response([], status=status.HTTP_200_OK)


def _empty_paginated(request=None):
    return Response({"count": 0, "results": [], "next": None, "previous": None})


from market_data.default_groups import (
    get_default_groups,
    get_group_lookup,
    get_color_palette,
    build_group_payload as _build_stock_management_group_payload,
    _build_item_payload as _build_stock_management_item_payload,
)

# Backwards compatibility - re-exported from default_groups
_STOCK_MANAGEMENT_DEFAULT_GROUPS = get_default_groups()
_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = get_group_lookup()
_STOCK_MANAGEMENT_COLOR_PALETTE = get_color_palette()


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------


class GenericEmptyListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        return _empty_list()

    def post(self, request, **kwargs):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class GenericEmptyStaffView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, **kwargs):
        return _empty_list()

    def post(self, request, **kwargs):
        return Response({"status": "accepted"})

    def put(self, request, **kwargs):
        return Response({"status": "accepted"})

