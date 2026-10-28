"""R4.2 — scope của khoá API + trạng thái xoay khoá (đọc cho FE).

**Vì sao có `management`?** Trong hệ thống này có hai loại việc dùng khoá của
user:

- **suy luận** (`inference`): `advisory/views.py` chạy advisory bằng khoá của
  user. Đây là nơi tiêu hao tiền/token.
- **quản trị** (`management`): `test-connection`
  (`user_workspace/portfolio_analytics_views.py:1999`) chỉ probe để kiểm tra cấu
  hình, không sinh khuyến nghị.

Trộn hai loại thì một khoá được cấp **để quản trị** (ví dụ khoá read-only, khoá hạn
mức thấp, khoá dùng để kiểm tra) lại chạy được suy luận hết — tức là quyền đã cấp
bị nới rộng mà không ai nhận ra. Đây là nội dung AC1.

Hai nguyên tắc giữ cho mọi hàm ở đây:

- **Không trả về khoá khi bị chặn.** Hàm trả `(key, reason)`; bị chặn thì `key=''`
  và `reason` là **mã** (`key_scope_management`), để log/ghi audit được mà không
  bao giờ phát tán bí mật.
- **Chặn khoá, không chặn dịch vụ.** Scope sai ⇒ bỏ qua khoá cá nhân và rơi về khoá
  hệ thống trong hạn mức fallback (giống AC7 của R4.1). Chặn cả request sẽ biến
  một cấu hình sai thành mất dịch vụ, mà khoá hệ thống vẫn audit được.
"""
from __future__ import annotations

from datetime import timedelta


def is_inference_allowed(credential) -> bool:
    """Khoá này có được dùng cho **suy luận** không.

    `credential` thiếu field `key_scope` (dữ liệu cũ chưa qua R4.2) coi như
    `inference` — ngược lại thì **mọi** khoá BYOK hiện hữu sẽ bị chặn ngay lúc
    deploy, đúng cái kiểu hồi qui nghiêm trọng nhất.
    """
    scope = getattr(credential, 'key_scope', None)
    if not scope:
        return True
    return str(scope) == 'inference'


def resolve_user_key_for_inference(credential, decrypt):
    """`(key, reason)` — khoá để dùng cho suy luận và mã lý do nếu bị chặn.

    `decrypt` là hàm giải mã (tiêm vào để test được, và để call site không phải
    biết Fernet). Không gọi `decrypt` khi scope sai — không chỉ để tốc nhanh mà
    để **khoá sai scope không bao giờ chạm tới bộ giải mã** ở đường suy luận.
    """
    reason = ''
    if credential is None:
        return '', 'no_credential'
    if not is_inference_allowed(credential):
        return '', 'key_scope_management'
    encrypted = getattr(credential, 'encrypted_api_key', '') or ''
    if not encrypted:
        return '', 'no_key'
    try:
        return decrypt(encrypted), ''
    except Exception:
        return '', 'decrypt_failed'


def rotation_status(credential) -> dict:
    """Mốc xoay khoá cho UI (AC5). **Không** chứa ciphertext hay bản mã nào."""
    from django.utils import timezone

    now = timezone.now()
    rotated = getattr(credential, 'key_rotated_at', None)
    grace_until = getattr(credential, 'grace_until', None)

    days_left = None
    within_grace = True
    if grace_until:
        days_left = (grace_until - now).days
        within_grace = grace_until > now

    next_rotation = grace_until or (rotated + timedelta(days=90) if rotated else None)
    return {
        'key_scope': getattr(credential, 'key_scope', '') or 'inference',
        'key_rotated_at': rotated.isoformat() if rotated else None,
        'grace_until': grace_until.isoformat() if grace_until else None,
        'within_grace': within_grace,
        'days_until_grace_end': days_left,
        'next_rotation_at': next_rotation.isoformat() if next_rotation else None,
    }