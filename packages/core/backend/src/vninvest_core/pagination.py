"""Shared cursor pagination classes for packages/core APIs."""
from rest_framework.pagination import CursorPagination


class CoreCursorPagination(CursorPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200
    ordering = '-created_at'


class AlertCursorPagination(CoreCursorPagination):
    ordering = '-triggered_at'


class AuditCursorPagination(CoreCursorPagination):
    ordering = '-occurred_at'
    page_size = 100
