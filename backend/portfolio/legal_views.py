"""
legal_views.py — Public API endpoints cho nội dung pháp lý (Giới thiệu, Tuyên bố trách nhiệm).
Endpoint này KHÔNG yêu cầu xác thực, được dùng tại trang đăng nhập/đăng ký lẫn menu người dùng.
"""
import logging

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LegalPage
from .serializers import LegalPageSerializer

logger = logging.getLogger(__name__)

DEFAULT_LOCALE_FALLBACK = 'vi'


class LegalPagePublicView(APIView):
    """
    GET /api/public/legal-pages/
    Trả về tất cả bản active (hoặc lọc theo slug và/hoặc locale qua query params).

    Query params:
      - slug: 'about' | 'disclaimer'   (optional)
      - locale: 'vi' | 'en'            (optional, fallback sang 'vi' nếu không tìm thấy)

    Không yêu cầu JWT. Fail-soft: lỗi DB trả về list rỗng thay vì 500.
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Skip JWT parser hoàn toàn cho endpoint này

    def get(self, request):
        slug = request.query_params.get('slug', '').strip()
        locale = request.query_params.get('locale', '').strip() or DEFAULT_LOCALE_FALLBACK

        try:
            qs = LegalPage.objects.filter(is_active=True)

            if slug:
                qs = qs.filter(slug=slug)

            # Thử locale yêu cầu trước, fallback về 'vi' nếu không có
            locale_qs = qs.filter(locale=locale)
            if not locale_qs.exists() and locale != DEFAULT_LOCALE_FALLBACK:
                locale_qs = qs.filter(locale=DEFAULT_LOCALE_FALLBACK)

            serializer = LegalPageSerializer(locale_qs, many=True)
            return Response({'results': serializer.data})

        except Exception:
            logger.exception('LegalPagePublicView: lỗi khi truy vấn DB — trả về rỗng')
            return Response({'results': []})
