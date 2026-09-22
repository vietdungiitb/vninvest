import logging

from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from vninvest_core.exceptions import ValidationErrorException

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def password_change_view(request):
    """
    POST /core/v1/auth/password-change/ — đổi mật khẩu user đang đăng nhập.
    Body: { "current_password": "...", "new_password": "...", "new_password_confirm": "..." }
    Rate limit 5 lần/phút/user để chống brute-force mật khẩu hiện tại.
    """
    user = request.user
    current_password = str(request.data.get('current_password') or '')
    new_password = str(request.data.get('new_password') or '')
    new_password_confirm = str(request.data.get('new_password_confirm') or '')

    if not current_password or not new_password or not new_password_confirm:
        raise ValidationErrorException(
            detail='current_password, new_password và new_password_confirm là bắt buộc.',
        )

    cache_key = f'ratelimit:password-change-user:{getattr(user, "pk", "anon")}'
    count = cache.get(cache_key, 0)
    if count >= 5:
        raise ValidationErrorException(
            detail='Quá nhiều lần thử đổi mật khẩu. Vui lòng thử lại sau 1 phút.',
        )
    cache.set(cache_key, count + 1, 60)

    if not user.check_password(current_password):
        raise ValidationErrorException(
            detail='Mật khẩu hiện tại không đúng.',
        )
    if new_password != new_password_confirm:
        raise ValidationErrorException(
            detail='Mật khẩu mới nhập lại không khớp.',
        )
    if len(new_password) < 8:
        raise ValidationErrorException(
            detail='Mật khẩu mới phải có ít nhất 8 ký tự.',
        )
    if user.check_password(new_password):
        raise ValidationErrorException(
            detail='Mật khẩu mới phải khác mật khẩu hiện tại.',
        )

    user.set_password(new_password)
    user.save(update_fields=['password'])
    logger.info('password_change: user=%s changed password', getattr(user, 'pk', '?'))
    return Response({'detail': 'Đã đổi mật khẩu thành công.'}, status=status.HTTP_200_OK)
