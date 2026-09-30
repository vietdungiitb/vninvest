"""
SAFE-02 + LED-06 — idempotency trên **bảng có ràng buộc UNIQUE**, không phải cache.

**Vì sao đổi, và vì sao bản cache trước đó không đủ.**

Bản cache dùng `cache.add`, và docstring cũ đã tự thừa nhận điểm yếu: `cache.add`
chỉ atomic **trong một process**. Production chạy nhiều worker ⇒ hai request
song song cùng thắng một key và tạo **hai lệnh**. Đó đúng là kịch bản mà
`Idempotency-Key` sinh ra để chặn.

UNIQUE constraint thì không thể bị thắng ở bất kỳ số process nào: database
tự quyết định thắng thua. Đây là lý do LED-06 yêu cầu model thật.

**Interface giữ nguyên** (`claim` / `store_result` / `release` + `Claim`), nên
`views_dnse.py` không phải sửa một dòng nào. Đó là chủ đích: thay hạ tầng mà
không đổi hợp đồng với call site.

**Các thay đổi hành vi — đều theo hướng an toàn, và đều được nói thẳng:**

1. `tenant` bắt buộc (`NOT NULL`, D-03). Bản cache cho phép namespace
   `no-tenant` dùng chung cho mọi request không resolve được tenant. Nay không
   còn: không resolve được tenant ⇒ **từ chối lệnh**, vì một key dùng chung
   giữa các tenant là đường rò response đơn hàng của tenant khác.
2. `fingerprint` được **băm SHA-256** trước khi lưu. Cột `request_hash` dài 64,
   còn fingerprint của order dài hơn nhiều; băm vừa vừa đúng độ dài vừa không
   lưu payload đơn hàng vào bảng idempotency.
3. Bản cache trả `409` khi request đang xử lý (`in_progress`). Bản DB giữ nguyên
   hành vi đó — nhưng bây giờ nó **thật** vì thắng thua do DB quyết định.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

#: D-12: TTL 7 ngày cho order. Hết hạn thì key được tái dùng.
IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 3600


class IdempotencyKeyError(ValueError):
    """`Idempotency-Key` thiếu, rỗng, hoặc tenant không resolve được."""


class IdempotencyTenantUnresolved(IdempotencyKeyError):
    """Không resolve được tenant ⇒ từ chối, không ghi vào namespace chung."""


@dataclass(frozen=True)
class Claim:
    """Kết quả claim. Dùng một trong `acquired` / `replay` / `conflict` / `in_progress`."""

    acquired: bool
    replay: bool = False
    conflict: bool = False
    in_progress: bool = False
    result: Any = None
    response_code: int | None = None


def _normalize_key(key) -> str:
    if key is None:
        raise IdempotencyKeyError('Thiếu `Idempotency-Key`.')
    normalized = str(key).strip()
    if not normalized:
        raise IdempotencyKeyError('`Idempotency-Key` không được rỗng.')
    if len(normalized) > 255:
        raise IdempotencyKeyError('`Idempotency-Key` dài quá 255 ký tự.')
    return normalized


def _hash_fingerprint(fingerprint) -> str:
    """SHA-256 của fingerprint, hex 64 ký tự — vừa khớp `request_hash` vừa không
    lưu payload đơn hàng vào bảng idempotency."""
    return hashlib.sha256(str(fingerprint).encode('utf-8')).hexdigest()


def _resolve_tenant(tenant_id):
    """Chấp nhận `CoreTenant` hoặc `public_id`; trả `CoreTenant`.

    Raise `IdempotencyTenantUnresolved` nếu không resolve được. **Không** có
    nhánh "trả None rồi ghi vào namespace chung" — đó là fail-open.
    """
    from identity_access.models import CoreTenant

    if tenant_id is None or tenant_id == '':
        raise IdempotencyTenantUnresolved(
            'Không resolve được tenant nên không thể ghi nhận `Idempotency-Key`. '
            'Lệnh tài chính bị từ chối thay vì dùng chung namespace với tenant khác.'
        )
    if isinstance(tenant_id, CoreTenant):
        return tenant_id
    found = CoreTenant.objects.filter(public_id=str(tenant_id)).first()
    if found is None:
        raise IdempotencyTenantUnresolved(
            f'Tenant {tenant_id!r} không tồn tại nên không thể ghi nhận '
            f'`Idempotency-Key`.'
        )
    return found


def _lookup(tenant, user_id, scope, key):
    from user_workspace.models import IdempotencyRecord

    return IdempotencyRecord.objects.filter(
        tenant=tenant, actor_id=user_id, scope=scope, key=key,
    ).first()


def claim(*, user_id, scope: str, key, fingerprint: str, tenant_id=None,
          ttl_seconds: int = IDEMPOTENCY_TTL_SECONDS) -> Claim:
    """Giữ key cho (tenant, actor, scope) này, hoặc báo trạng thái của nó.

    Luồng: thử **tạo** dòng. Ai tạo được là người thắng — và người thắng do
    database quyết định, không phải do khoá trong RAM. Người thua đọc dòng đó
    lên để phân biệt ba trường hợp: trùng payload (replay), khác payload
    (conflict), hay đang chạy (in_progress).
    """
    from user_workspace.models import IdempotencyRecord

    normalized = _normalize_key(key)
    tenant = _resolve_tenant(tenant_id)
    request_hash = _hash_fingerprint(fingerprint)
    now = timezone.now()

    for attempt in (1, 2):
        try:
            with transaction.atomic():
                IdempotencyRecord.objects.create(
                    tenant=tenant, actor_id=user_id, scope=scope, key=normalized,
                    request_hash=request_hash,
                    created_at=now,
                    expires_at=now + timedelta(seconds=ttl_seconds),
                )
            return Claim(acquired=True)
        except IntegrityError:
            record = _lookup(tenant, user_id, scope, normalized)
            if record is None:
                # Thua race VÀ dòng của người thắng đã biến mất (vừa hết hạn rồi
                # bị xoá). Thử lại một lần; lần sau vẫn thất bại thì trả
                # `in_progress` để client thử lại, thay vì đoán.
                if attempt == 1:
                    continue
                return Claim(acquired=False, in_progress=True)

            if record.expires_at is not None and record.expires_at <= timezone.now():
                # Hết TTL ⇒ key tái dùng được (AC5 của SAFE-02). Xoá rồi thử lại;
                # `attempt == 1` bảo đảm không lặp vô hạn.
                if attempt == 1:
                    IdempotencyRecord.objects.filter(pk=record.pk).delete()
                    continue
                return Claim(acquired=False, in_progress=True)

            if record.request_hash != request_hash:
                # Cùng key, khác payload ⇒ client tái dùng nhầm key (SAFE-02 R7).
                return Claim(acquired=False, conflict=True)

            if record.response_code is not None:
                return Claim(
                    acquired=False, replay=True,
                    result=record.response_body,
                    response_code=record.response_code,
                )

            # Dòng đã tồn tại nhưng chưa có response ⇒ request trước đang chạy
            # (hoặc chết giữa chừng). Trả `in_progress` để client thử lại.
            return Claim(acquired=False, in_progress=True)

    return Claim(acquired=False, in_progress=True)


def store_result(*, user_id, scope: str, key, fingerprint: str, result: Any,
                 tenant_id=None, response_code: int = 200,
                 ttl_seconds: int = IDEMPOTENCY_TTL_SECONDS) -> bool:
    """Ghi kết quả để lần sau replay được. Trả `False` nếu key đã lệch.

    Chỉ ghi khi fingerprint khớp **và** response còn trống — nhờ vậy một request
    thất bại không thể đè kết quả của request khác vào cùng một key.
    """
    from user_workspace.models import IdempotencyRecord

    normalized = _normalize_key(key)
    tenant = _resolve_tenant(tenant_id)
    request_hash = _hash_fingerprint(fingerprint)

    updated = IdempotencyRecord.objects.filter(
        tenant=tenant, actor_id=user_id, scope=scope, key=normalized,
        request_hash=request_hash, response_code__isnull=True,
    ).update(
        response_code=response_code, response_body=result,
        expires_at=timezone.now() + timedelta(seconds=ttl_seconds),
    )
    if not updated:
        logger.warning(
            'store_result: khong ghi duoc ket qua cho scope=%s key=%r '
            '(fingerprint lech hoac da co response).', scope, normalized,
        )
    return bool(updated)


def release(*, user_id, scope: str, key, tenant_id=None) -> None:
    """Xoá key khi thao tác thất bại, để client retry được với cùng key.

    Xoá thay vì đánh dấu "đã hỏng": thao tác thất bại **không** phải là một
    lệnh đã được xử lý xong, nên không có gì để replay.
    """
    from user_workspace.models import IdempotencyRecord

    try:
        normalized = _normalize_key(key)
    except IdempotencyKeyError:
        return
    try:
        tenant = _resolve_tenant(tenant_id)
    except IdempotencyTenantUnresolved:
        # Không resolve được tenant thì không xoá được gì cả. Ghi log thay vì
        # im lặng — đây là nhánh "hệ thống không trả lời được", cần thấy được.
        logger.warning(
            'release: khong resolve duoc tenant, bo qua xoa key scope=%s', scope)
        return
    IdempotencyRecord.objects.filter(
        tenant=tenant, actor_id=user_id, scope=scope, key=normalized,
    ).delete()


def purge_expired(*, now=None) -> int:
    """Xoá bản ghi hết hạn. D-12: TTL 7 ngày ⇒ dọn theo `expires_at`.

    Gọi từ task định kỳ; trả số dòng đã xoá.
    """
    from user_workspace.models import IdempotencyRecord

    moment = now or timezone.now()
    deleted, _ = IdempotencyRecord.objects.filter(expires_at__lte=moment).delete()
    logger.info('purge_expired: da xoa %s ban ghi idempotency het han', deleted)
    return deleted
