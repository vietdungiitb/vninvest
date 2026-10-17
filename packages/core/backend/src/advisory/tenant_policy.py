"""R4.1 — đọc và kiểm tra policy AI cấp tenant.

Đây là **SSOT** của câu hỏi "policy tenant có cho phép cái này không?". View và
task **không** tự đọc `AITenantPolicy` và tự so — chỗ đó là chỗ sinh ra hai cách
hiểu khác nhau về cùng một luật, đúng kiểu lỗi đã xảy ra ở `resolve_budget`
(budget.py:3 tự ghi "một nơi duy nhất quyết định có chạm hạn mức không").

Hai quy tắc kinh điển của R4.1:

- **Trần của admin không phải hạn mức tiêu thụ.** `max_tokens_per_day` ở đây là
  trần cho *cấu hình* user (`UserAICredential.max_tokens_per_day`), không phải hạn
  mức tiêu thụ trong ngày. Hạn mức tiêu thụ vẫn thuộc `AIBudget` (R2.8) và được
  chặn ở `advisory/views.py:442` bằng 429. Gộp hai nghĩa vào một trường sẽ tạo
  hai con số mâu thuẫn cho cùng một tên.
- **Thiếu policy = cho phép.** Không có dòng `AITenantPolicy` thì mặc định là
  `allow_byok=True`, không trần — đúng như R2.8 AC9 ("migration không backfill"),
  và đúng AC2 của R4.1 chỉ nói *admin đặt* `allow_byok=false` mới chặn. Đọc hành
  vi ngược lại (thiếu policy = chặn) sẽ khóa BYOK của mọi tenant đang chạy ngay
  lúc deploy.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from advisory.models import AITenantPolicy

#: Payload CC PUT dùng key này cho trần token/ngày của user.
USER_TOKEN_CEILING_FIELD = 'advisory_max_tokens_per_day'
#: Payload CC PUT dùng key này cho khoá API của user (BYOK).
USER_API_KEY_FIELD = 'ai_api_key'


def resolve_tenant(request, *, operator_hint: bool = False):
    """Tenant áp dụng policy cho request này, hoặc `None`.

    **Vì sao không dùng `getattr(request, 'tenant', None)`?** Đo bằng probe HTTP
    (`wsgi_request.tenant` sau khi gọi endpoint): thuộc tính này **không tồn tại**
    trong request thật của test lẫn một số đường đi qua middleware — nó được set
    bởi `TenantResolutionMiddleware`, và khi không có, code đọc nó nhận `None`.
    Hậu quả nếu để nguyên là **fail-open âm thầm**: policy không tồn tại trong
    mắt code nên mọi request đều "được phép", tức là `allow_byok=false` của admin
    im lặng không có tác dụng. Đó là loại lỗi tệ nhất: không đỏ, không log, chỉ
    mất tác dụng.

    Vì vậy resolve **ở đây**, theo đúng thứ tự của
    `user_workspace/permissions.py:_resolve_tenant`: `X-Tenant-ID` (public_id,
    qua SSOT `resolve_tenant_for_user`) → owner → first eligible member. Không tự
    viết lại membership check.

    `operator_hint=True` cho phép staff chọn tenant khác bằng `?tenant=<code>`
    (AC5, read-only) — đây là quyền operator của hệ thống, không phải membership,
    nên không đi qua `resolve_tenant_for_user`.
    """
    from identity_access.utils.resolve_tenant import (
        RESOLVABLE_TENANT_STATUSES,
        first_eligible_tenant_for_user,
        owner_tenant_for_user,
        resolve_tenant_for_user,
    )

    is_operator = bool(
        getattr(getattr(request, 'user', None), 'is_staff', False)
        or getattr(getattr(request, 'user', None), 'is_superuser', False)
    )
    if operator_hint and is_operator:
        code = str(request.query_params.get('tenant') or '').strip()
        if code:
            from identity_access.models import CoreTenant

            return CoreTenant.objects.filter(tenant_code__iexact=code).first()

    hint = str(request.headers.get('X-Tenant-ID') or '').strip()
    if hint:
        tenant, _role = resolve_tenant_for_user(request.user, hint)
        return tenant

    owner = owner_tenant_for_user(request.user)
    if owner is not None and owner.status in RESOLVABLE_TENANT_STATUSES:
        return owner
    tenant, _role = first_eligible_tenant_for_user(request.user)
    return tenant


def defaults() -> dict:
    """Giá trị khi tenant chưa có dòng policy — cũng là shape của GET."""
    return {
        'allow_byok': True,
        'allowed_providers': [],
        'allowed_models': [],
        'max_tokens_per_day': 0,
        'max_cost_per_day': None,
    }


def get_policy(tenant) -> AITenantPolicy | None:
    """Dòng policy của tenant, hoặc `None` (chưa cấu hình). Không tự tạo."""
    if tenant is None:
        return None
    return AITenantPolicy.objects.filter(tenant=tenant).first()


def as_payload(policy: AITenantPolicy | None, tenant=None) -> dict:
    """Shape trả về cho API, kèm `version`/`is_default` để FE biết có phải mặc định."""
    if policy is None:
        data = defaults()
        return {
            **data,
            'version': 0,
            'is_default': True,
            'tenant_code': getattr(tenant, 'tenant_code', '') or '',
            'updated_at': None,
            'updated_by': None,
        }
    cost = policy.max_cost_per_day
    return {
        'allow_byok': bool(policy.allow_byok),
        'allowed_providers': list(policy.allowed_providers or []),
        'allowed_models': list(policy.allowed_models or []),
        'max_tokens_per_day': int(policy.max_tokens_per_day or 0),
        'max_cost_per_day': str(cost) if cost is not None else None,
        'version': int(policy.version),
        'is_default': False,
        'tenant_code': getattr(policy.tenant, 'tenant_code', '') or '',
        'updated_at': policy.updated_at.isoformat() if policy.updated_at else None,
        'updated_by': getattr(policy.updated_by, 'username', None),
    }


def system_policy_block(policy: AITenantPolicy | None, tenant=None) -> dict:
    """Khối `system_policy` trong CC GET — **giữ nguyên nghĩa của R0.9**.

    Cảnh báo đã mắc trước khi viết dòng này: `managed_by_platform` **không** có
    nghĩa là "user bị cấp quyền mang khoá riêng". R0.9 (F5) dùng nó để nói *"trường
    `system_prompt_template` do nền tảng quản lý, user thường không thấy nội dung"*,
    và hai test đang ghim đúng nghĩa đó
    (`test_ai_cc_policy_gating.py:69`, `test_ai_management_center.py:171`). Suy ra
    nó từ `allow_byok` là **đổi nghĩa một trường đã có hợp đồng**, và làm 2 test
    đỏ — dấu hiệu đúng, vì test ghim hành vi cũ là có chủ đích.

    Vì vậy: giữ `managed_by_platform = True` (template do nền tảng quản lý), và
    thêm hai cờ **mới** để R4.1 truyền đúng thông tin:
    - `byok_forced`: tenant admin đã tắt BYOK ⇒ không lưu được khoá riêng (AC2).
    - `max_tokens_per_day`: trần cho cấu hình của user (AC3).
    """
    data = as_payload(policy, tenant=tenant)
    return {
        'managed_by_platform': True,
        'byok_forced': not data['allow_byok'],
        'allow_byok': data['allow_byok'],
        'max_tokens_per_day': data['max_tokens_per_day'],
        'allowed_providers': data['allowed_providers'],
        'allowed_models': data['allowed_models'],
    }


def check_byok(tenant, api_key: str) -> dict | None:
    """`None` = cho phép; còn lại là `field_errors` cần trả về cho client.

    `api_key` rỗng là hành động **xoá** khoá đã lưu, không phải lưu BYOK — chặn nó
    sẽ kẹt user ở cảnh báo "không được dùng khoá của mình" mà không xoá được khoá
    cũ. Vì vậy chỉ khoá **không rỗng** mới bị chặn.
    """
    if not str(api_key or '').strip():
        return None
    policy = get_policy(tenant)
    if policy is None or policy.allow_byok:
        return None
    return {
        USER_API_KEY_FIELD: [
            'Tenant khong cho phep luu khoa API rieng (BYOK). '
            'Van dung duoc goi bang khoa he thong trong han muc fallback.',
        ],
    }


def check_user_settings(tenant, payload: dict) -> dict[str, list[str]]:
    """So **cấu hình user** với trần của tenant. Rỗng = không vượt.

    Trả về `field_errors` (dict field -> lý do) đúng shape của
    `UnprocessableEntityException` (`vninvest_core/exceptions.py:554`), nên view
    raise thẳng được, không phải tự dựng payload lỗi.
    """
    errors: dict[str, list[str]] = {}
    policy = get_policy(tenant)
    if policy is None or not isinstance(payload, dict):
        return errors

    ceiling = int(policy.max_tokens_per_day or 0)
    if ceiling > 0 and USER_TOKEN_CEILING_FIELD in payload:
        try:
            requested = int(payload.get(USER_TOKEN_CEILING_FIELD))
        except (TypeError, ValueError):
            # Sai kieu: de view goc bao loi field, khong ganh loi cho policy.
            return errors
        if requested > ceiling:
            errors[USER_TOKEN_CEILING_FIELD] = [
                f'Gia tri vuot tran cua tenant ({requested} > {ceiling} token/ngay).',
            ]

    for field, allowed in (
        ('ai_provider', policy.allowed_providers or []),
        ('ai_model', policy.allowed_models or []),
    ):
        allowed_list = allowed or []
        if not allowed_list or field not in payload:
            continue
        value = str(payload.get(field) or '').strip().lower()
        if value and value not in {str(item).strip().lower() for item in allowed_list}:
            errors[field] = [
                f'Gia tri "{value}" khong nam trong danh sach duoc phep cua tenant.',
            ]

    return errors


def cost_decimal(value):
    """Chuyển `max_cost_per_day` từ payload sang Decimal; `None` khi rỗng/rác."""
    if value in (None, ''):
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None