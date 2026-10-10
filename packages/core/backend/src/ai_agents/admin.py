"""Quản trị tác tử AI — `ai_agents`.

Vì sao thêm mới
---------------
`ai_agents.AgentRegistry` là **nguồn sự thật** về tác tử AI nào đang tồn tại,
dùng nhà cung cấp nào, model nào. Trước đây không có `admin.py` nghĩa là
`docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_*` (`AGENTS.md`) nói tới
`AgentRegistry` nhưng nhân viên không có chỗ nào xem hoặc sửa nó.

Ranh giới quyền
---------------
`system_prompt` là **prompt hệ thống** — sửa tay ở đây là thay đổi hành vi
tư vấn mà không ai duyệt. Nên nó **chỉ đọc trong admin**; muốn đổi thì đi qua
luồng cấu hình AI (`advisory.SystemAISettings`) đã có.
"""

from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, badge_for

from .models import AgentRegistry


@admin.register(AgentRegistry)
class AgentRegistryAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'agent_type_badge', 'provider', 'model', 'is_active_badge')
    list_filter = ('agent_type', 'provider', 'is_active')
    search_fields = ('name', 'provider', 'model')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('created_by',)
    ordering = ('name',)
    date_hierarchy = 'created_at'

    @admin.display(description='Loại', ordering='agent_type')
    def agent_type_badge(self, obj):
        return badge_for(obj.agent_type)

    @admin.display(description='Đang bật', boolean=True)
    def is_active_badge(self, obj):
        return obj.is_active
