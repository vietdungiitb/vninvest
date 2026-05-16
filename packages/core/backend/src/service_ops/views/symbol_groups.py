"""Symbol Groups domain views — list predefined groups + full CRUD for custom groups."""

from __future__ import annotations

import re

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from ..matrix_coordinator import PREDEFINED_SYMBOL_GROUPS
from ..models import CustomSymbolGroup
from ..views.base import SOCBaseView


def _slugify(name: str) -> str:
    """Tạo slug từ tên: lowercase, thay ký tự đặc biệt bằng dấu _."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '_', slug)
    slug = re.sub(r'^_+|_+$', '', slug)
    return slug[:60]


def _serialize_custom_group(group: CustomSymbolGroup) -> dict:
    return {
        'id': group.pk,
        'slug': group.slug,
        'group_id': group.group_id,
        'name': group.name,
        'description': group.description,
        'symbols': group.symbols or [],
        'symbol_count': len(group.symbols or []),
        'is_active': group.is_active,
        'created_by': group.created_by,
        'created_at': group.created_at.isoformat() if group.created_at else None,
        'updated_at': group.updated_at.isoformat() if group.updated_at else None,
        'type': 'custom',
    }


class SymbolGroupListView(SOCBaseView):
    """
    GET  /api/soc/symbol-groups/  → Danh sách nhóm mã (predefined + custom).
    POST /api/soc/symbol-groups/  → Tạo nhóm mã tuỳ chỉnh mới.
    """

    @extend_schema(
        summary='Danh sách nhóm mã',
        description='Trả về toàn bộ nhóm mã predefined (VN30, VN100...) và custom do operator tạo.',
        tags=['SOC Symbol Groups'],
    )
    def get(self, request):
        predefined = [
            {
                'slug': g['id'],
                'group_id': g['id'],
                'name': g['name'],
                'symbol_count': g.get('symbol_count'),
                'type': g.get('type', 'index'),
                'is_active': True,
                'is_predefined': True,
            }
            for g in PREDEFINED_SYMBOL_GROUPS
        ]
        custom_qs = CustomSymbolGroup.objects.all().order_by('name')
        custom = [_serialize_custom_group(g) for g in custom_qs]
        return Response({'predefined': predefined, 'custom': custom})

    @extend_schema(
        summary='Tạo nhóm mã tuỳ chỉnh',
        description='Tạo nhóm mã tuỳ chỉnh mới với danh sách mã do operator cung cấp.',
        tags=['SOC Symbol Groups'],
    )
    def post(self, request):
        name = str(request.data.get('name') or '').strip()
        if not name:
            return Response(
                {'detail': 'Tên nhóm không được để trống.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(name) > 100:
            return Response(
                {'detail': 'Tên nhóm không được vượt quá 100 ký tự.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slug = str(request.data.get('slug') or '').strip() or _slugify(name)
        if not slug:
            return Response(
                {'detail': 'Không thể tạo slug từ tên đã nhập.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if CustomSymbolGroup.objects.filter(slug=slug).exists():
            return Response(
                {'detail': f"Slug '{slug}' đã được dùng. Vui lòng chọn slug khác."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_symbols = request.data.get('symbols') or []
        if not isinstance(raw_symbols, list):
            return Response(
                {'detail': 'symbols phải là danh sách.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalize & deduplicate
        seen: set[str] = set()
        cleaned: list[str] = []
        for raw in raw_symbols:
            sym = str(raw or '').strip().upper()
            if sym and sym not in seen:
                seen.add(sym)
                cleaned.append(sym)

        actor = getattr(request.user, 'username', '') or str(request.user)
        group = CustomSymbolGroup.objects.create(
            name=name,
            slug=slug,
            description=str(request.data.get('description') or '').strip(),
            symbols=cleaned,
            is_active=True,
            created_by=actor,
        )
        return Response(_serialize_custom_group(group), status=status.HTTP_201_CREATED)


class SymbolGroupDetailView(SOCBaseView):
    """
    GET    /api/soc/symbol-groups/<slug>/  → Lấy chi tiết nhóm custom.
    PUT    /api/soc/symbol-groups/<slug>/  → Cập nhật nhóm custom.
    DELETE /api/soc/symbol-groups/<slug>/  → Xoá nhóm custom.
    """

    def _get_group_or_404(self, slug: str):
        try:
            return CustomSymbolGroup.objects.get(slug=slug)
        except CustomSymbolGroup.DoesNotExist:
            return None

    @extend_schema(
        summary='Chi tiết nhóm mã tuỳ chỉnh',
        tags=['SOC Symbol Groups'],
    )
    def get(self, request, slug: str):
        group = self._get_group_or_404(slug)
        if not group:
            return Response({'detail': 'Nhóm mã không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_custom_group(group))

    @extend_schema(
        summary='Cập nhật nhóm mã tuỳ chỉnh',
        tags=['SOC Symbol Groups'],
    )
    def put(self, request, slug: str):
        group = self._get_group_or_404(slug)
        if not group:
            return Response({'detail': 'Nhóm mã không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

        if 'name' in request.data:
            name = str(request.data['name'] or '').strip()
            if not name:
                return Response({'detail': 'Tên nhóm không được để trống.'}, status=status.HTTP_400_BAD_REQUEST)
            group.name = name

        if 'description' in request.data:
            group.description = str(request.data['description'] or '').strip()

        if 'symbols' in request.data:
            raw_symbols = request.data.get('symbols') or []
            if not isinstance(raw_symbols, list):
                return Response({'detail': 'symbols phải là danh sách.'}, status=status.HTTP_400_BAD_REQUEST)
            seen: set[str] = set()
            cleaned: list[str] = []
            for raw in raw_symbols:
                sym = str(raw or '').strip().upper()
                if sym and sym not in seen:
                    seen.add(sym)
                    cleaned.append(sym)
            group.symbols = cleaned

        if 'is_active' in request.data:
            group.is_active = bool(request.data['is_active'])

        group.save()
        return Response(_serialize_custom_group(group))

    @extend_schema(
        summary='Xoá nhóm mã tuỳ chỉnh',
        tags=['SOC Symbol Groups'],
    )
    def delete(self, request, slug: str):
        group = self._get_group_or_404(slug)
        if not group:
            return Response({'detail': 'Nhóm mã không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
