from django.contrib.auth.models import User
from django.db import models


class AgentRegistry(models.Model):
    class AgentTypes(models.TextChoices):
        ADVISORY = 'advisory', 'AI Advisory'
        ANALYST = 'analyst', 'Market Analyst'
        SCREENER = 'screener', 'Stock Screener'
        WHALE = 'whale', 'Whale Monitor'
        NEWS = 'news', 'News Aggregator'
        CUSTOM = 'custom', 'Custom Agent'

    name = models.CharField(max_length=64, unique=True, verbose_name='Tên agent')
    agent_type = models.CharField(
        max_length=32,
        choices=AgentTypes.choices,
        default=AgentTypes.ADVISORY,
        verbose_name='Loại agent',
    )
    provider = models.CharField(max_length=32, default='openai', verbose_name='Nhà cung cấp AI')
    model = models.CharField(max_length=64, default='gpt-4o-mini', verbose_name='Mô hình AI')
    capabilities = models.JSONField(default=list, blank=True, verbose_name='Năng lực')
    system_prompt = models.TextField(blank=True, default='', verbose_name='System prompt')
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='Đang kích hoạt')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Agent AI'
        verbose_name_plural = 'Agent AI'
        ordering = ['name']

    def __str__(self) -> str:
        return f'{self.name} ({self.get_agent_type_display()})'
