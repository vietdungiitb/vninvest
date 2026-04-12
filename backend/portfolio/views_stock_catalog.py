from rest_framework import generics, filters as rest_framework_filters
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import SecuritiesGroup, SecuritiesItem, StockProfile
from .serializers import SecuritiesGroupDetailSerializer, SecuritiesItemSerializer, StockProfileSerializer


class StockProfileListView(generics.ListAPIView):
    serializer_class = StockProfileSerializer
    permission_classes = [AllowAny]
    filter_backends = [rest_framework_filters.SearchFilter]
    search_fields = ['symbol', 'company_name']

    def get_queryset(self):
        qs = StockProfile.objects.filter(is_active=True)
        return qs


class SecuritiesGroupListView(generics.ListAPIView):
    serializer_class = SecuritiesGroupDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SecuritiesGroup.objects.all()


class SecuritiesItemListView(generics.ListAPIView):
    serializer_class = SecuritiesItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs['pk']
        return SecuritiesItem.objects.filter(group_id=group_id)