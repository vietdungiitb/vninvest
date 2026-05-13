"""Shared pagination classes for packages/core APIs."""
from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response


class StandardPageNumberPagination(PageNumberPagination):
    """
    Standard page-number pagination for list endpoints.
    
    Default: 20 items/page, max: 100 items/page.
    Query params: ?page=1&page_size=20
    
    Response format:
        {
            "count": <int>,
            "next": <url or null>,
            "previous": <url or null>,
            "results": [...]
        }
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_size_query_description = 'Number of results per page. Max: 100.'
    
    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })


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


class OrderFlowCursorPagination(CoreCursorPagination):
    ordering = '-triggered_at'
    page_size = 100


class SnapshotCursorPagination(CoreCursorPagination):
    """Pagination cho SymbolSnapshot / SessionFacts — ordered by session_date desc."""
    ordering = '-session_date'
    page_size = 100
