# Multi-AI Providers Integration Roadmap (v2)

**Status**: Planning & Architecture Design  
**Target Date**: Sprint 15  
**Priority**: Medium (Enhancement over current OpenClaw-only setup)

---

## 1. Current State Analysis

### Architecture Overview
- **Current Model**: Single OpenClaw provider with hardcoded integration
- **WhaleAdvisory Model**: Has `ai_provider` field (default='openclaw') but unused
- **UserConfig Model**: NO ai_provider field (NEED TO ADD)
- **Task Handler**: `generate_whale_advisory_task()` hardcoded to call OpenClaw
- **Frontend**: No provider selection UI

### Key Files
- `backend/portfolio/models.py` - WhaleAdvisory + UserConfig
- `backend/portfolio/tasks.py` - generate_whale_advisory_task()
- `backend/portfolio/openclaw_client.py` - OpenClaw-specific SDK
- `backend/portfolio/serializers.py` - WhaleAdvisorySerializer
- `backend/portfolio/views.py` - WhaleAdvisoryListView
- `frontend/src/pages/WhaleAdvisory.jsx` - UI (no config shown)

### Limitations
1. No way for users to select provider or model
2. No API key management (assumes system-wide OpenClaw key)
3. No model flexibility (can't use GPT-4 for better analysis)
4. No fallback if OpenClaw is rate-limited

---

## 2. Proposed Architecture (v2)

### 2.1 Data Model Changes

#### UserConfig Extension
```python
class UserConfig(models.Model):
    # ... existing fields ...
    
    # === AI Provider Configuration (NEW) ===
    ai_provider = models.CharField(
        max_length=50,
        choices=[
            ('openclaw', 'OpenClaw'),
            ('openai', 'OpenAI (GPT)'),
            ('claude', 'Anthropic Claude'),
            ('gemini', 'Google Gemini'),
            ('copilot', 'Microsoft Copilot'),
        ],
        default='openclaw',
        verbose_name='AI Provider sử dụng',
    )
    ai_model = models.CharField(
        max_length=100,
        default='default',
        blank=True,
        verbose_name='AI Model (e.g., gpt-4o, claude-3-5-sonnet)',
        help_text='Mã model cụ thể - để trống = dùng model mặc định của provider',
    )
    ai_api_key = models.TextField(
        blank=True,
        default='',
        verbose_name='API Key (mã hóa)',
        help_text='Để trống = dùng system-level key từ environment',
    )
    ai_api_key_encrypted = models.BooleanField(
        default=False,
        verbose_name='API Key đã mã hóa',
    )
```

#### Model Availability Map (Constants)
```python
# backend/portfolio/ai_config.py (NEW FILE)

"""
Configuration for supported AI providers and their models.
Frontend sử dụng để populate dropdown; Backend dùng để validate.
"""

AVAILABLE_AI_MODELS = {
    'openai': [
        {'id': 'gpt-4o', 'name': 'GPT-4o (Latest, most capable)', 'cost': 'high'},
        {'id': 'gpt-4-turbo', 'name': 'GPT-4 Turbo (Fast, capable)', 'cost': 'medium'},
        {'id': 'gpt-3.5-turbo', 'name': 'GPT-3.5 Turbo (Fast, economic)', 'cost': 'low'},
    ],
    'claude': [
        {'id': 'claude-3-5-sonnet-20240620', 'name': 'Claude 3.5 Sonnet (Latest)', 'cost': 'medium'},
        {'id': 'claude-3-opus-20240229', 'name': 'Claude 3 Opus (Most capable)', 'cost': 'high'},
        {'id': 'claude-3-haiku-20240307', 'name': 'Claude 3 Haiku (Fast, economic)', 'cost': 'low'},
    ],
    'gemini': [
        {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro (Latest)', 'cost': 'medium'},
        {'id': 'gemini-1.5-flash', 'name': 'Gemini 1.5 Flash (Fast)', 'cost': 'low'},
    ],
    'copilot': [
        {'id': 'copilot-pro', 'name': 'Copilot Pro (Microsoft)', 'cost': 'medium'},
    ],
    'openclaw': [
        {'id': 'default', 'name': 'OpenClaw (VietnamData)', 'cost': 'low'},
    ],
}

# Model Identifiers for default fallbacks
DEFAULT_MODELS = {
    'openai': 'gpt-4o',
    'claude': 'claude-3-5-sonnet-20240620',
    'gemini': 'gemini-1.5-pro',
    'copilot': 'copilot-pro',
    'openclaw': 'default',
}

# System-level API endpoints (from settings.py)
PROVIDER_CONFIGS = {
    'openai': {
        'endpoint': 'https://api.openai.com/v1/chat/completions',
        'env_var_name': 'OPENAI_API_KEY',
        'default_model': 'gpt-4o',
        'supports_streaming': True,
        'supports_vision': True,
    },
    'claude': {
        'endpoint': 'https://api.anthropic.com/v1/messages',
        'env_var_name': 'ANTHROPIC_API_KEY',
        'default_model': 'claude-3-5-sonnet-20240620',
        'supports_streaming': True,
        'supports_vision': True,
    },
    'gemini': {
        'endpoint': 'https://generativelanguage.googleapis.com/v1beta/openai/',
        'env_var_name': 'GOOGLE_API_KEY',
        'default_model': 'gemini-1.5-pro',
        'supports_streaming': True,
        'supports_vision': True,
    },
    'copilot': {
        'endpoint': 'https://api.copilot.microsoft.com/v1/chat/completions',
        'env_var_name': 'COPILOT_API_KEY',
        'default_model': 'copilot-pro',
        'supports_streaming': False,
        'supports_vision': False,
    },
    'openclaw': {
        'endpoint': 'https://openclaw-api.vietdata.com/v1/advise',
        'env_var_name': 'OPENCLAW_API_KEY',
        'default_model': 'default',
        'supports_streaming': False,
        'supports_vision': False,
    },
}
```

---

## 3. Implementation Phases

### Phase 1: Backend - Model & Encryption Layer
**Duration**: 2-3 days  
**Files**: models.py, encryption_utils.py, migrations

#### 1.1 Database Migration
```bash
# Generate migration
python manage.py makemigrations portfolio

# Create migration file: 
# 0038_auto_userconfig_ai_provider.py
```

**Migration SQL**:
```python
# Add three columns to portfolio_userconfig
- ai_provider (CharField, default='openclaw')
- ai_model (CharField, default='default')
- ai_api_key (TextField, blank=True)
- ai_api_key_encrypted (BooleanField, default=False)
```

#### 1.2 Encryption Utilities
```python
# backend/portfolio/encryption_utils.py (NEW)

from django.conf import settings
from cryptography.fernet import Fernet
import os

class APIKeyManager:
    """
    Manages encryption/decryption of sensitive API keys.
    Uses Fernet (symmetric encryption).
    """
    
    @staticmethod
    def _get_cipher():
        """Get Fernet cipher from settings.SECRET_KEY"""
        if not hasattr(settings, 'ENCRYPTION_KEY'):
            # Generate key from SECRET_KEY (not ideal for production)
            key = Fernet.generate_key()
            settings.ENCRYPTION_KEY = key
        return Fernet(settings.ENCRYPTION_KEY)
    
    @staticmethod
    def encrypt_key(api_key: str) -> str:
        """Encrypt API key. Returns base64 ciphertext."""
        if not api_key:
            return ''
        cipher = APIKeyManager._get_cipher()
        encrypted = cipher.encrypt(api_key.encode('utf-8'))
        return encrypted.decode('utf-8')
    
    @staticmethod
    def decrypt_key(encrypted_key: str) -> str:
        """Decrypt API key. Returns plaintext."""
        if not encrypted_key:
            return ''
        try:
            cipher = APIKeyManager._get_cipher()
            decrypted = cipher.decrypt(encrypted_key.encode('utf-8'))
            return decrypted.decode('utf-8')
        except Exception as e:
            logger.error(f'Failed to decrypt API key: {e}')
            return ''
    
    @staticmethod
    def get_api_key(user_config, provider: str) -> str:
        """
        Get API key for given provider.
        Priority: User's saved key > environment variable > None
        """
        # Check if user has custom key
        if user_config.ai_api_key and user_config.ai_api_key_encrypted:
            try:
                return APIKeyManager.decrypt_key(user_config.ai_api_key)
            except Exception:
                pass
        
        # Fallback to system-level environment key
        from portfolio.ai_config import PROVIDER_CONFIGS
        env_var = PROVIDER_CONFIGS[provider]['env_var_name']
        return os.getenv(env_var, '')
```

#### 1.3 UserConfig Model Update
```python
# backend/portfolio/models.py

class UserConfig(models.Model):
    # ... existing fields ...
    
    ai_provider = models.CharField(
        max_length=50,
        choices=[
            ('openclaw', 'OpenClaw'),
            ('openai', 'OpenAI'),
            ('claude', 'Claude'),
            ('gemini', 'Gemini'),
            ('copilot', 'Copilot'),
        ],
        default='openclaw',
        verbose_name='AI Provider',
    )
    ai_model = models.CharField(
        max_length=100,
        default='default',
        blank=True,
        verbose_name='Model Name',
    )
    ai_api_key = models.TextField(
        blank=True,
        default='',
        verbose_name='API Key (encrypted)',
    )
    ai_api_key_encrypted = models.BooleanField(default=False)
    
    def set_ai_api_key(self, api_key: str):
        """Helper to encrypt and save API key"""
        from portfolio.encryption_utils import APIKeyManager
        if api_key:
            self.ai_api_key = APIKeyManager.encrypt_key(api_key)
            self.ai_api_key_encrypted = True
        else:
            self.ai_api_key = ''
            self.ai_api_key_encrypted = False
    
    def get_ai_api_key(self) -> str:
        """Helper to decrypt API key"""
        from portfolio.encryption_utils import APIKeyManager
        return APIKeyManager.get_api_key(self, self.ai_provider)
```

---

### Phase 2: AI Client Dispatcher Refactoring
**Duration**: 3-4 days  
**Files**: ai_client.py (NEW), provider clients (NEW), tasks.py (update)

#### 2.1 Abstract AI Client Interface
```python
# backend/portfolio/ai_client.py (NEW)

from abc import ABC, abstractmethod
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class AIClientBase(ABC):
    """
    Abstract base class for all AI providers.
    Each provider implements these methods.
    """
    
    def __init__(self, api_key: str, model: str = None, **kwargs):
        self.api_key = api_key
        self.model = model or self.get_default_model()
        self.extra_config = kwargs
    
    @abstractmethod
    def get_default_model(self) -> str:
        """Return default model ID for this provider"""
        pass
    
    @abstractmethod
    def generate_summary(self, symbol: str, side: str, value: float, context: str) -> Tuple[str, Dict]:
        """
        Generate short advisory summary.
        Returns: (text, metadata={'tokens': {...}, 'cost': {...}})
        """
        pass
    
    @abstractmethod
    def generate_detail(self, symbol: str, side: str, value: float, context: str) -> Tuple[str, Dict]:
        """
        Generate detailed advisory analysis.
        Returns: (text, metadata={'tokens': {...}, 'cost': {...}})
        """
        pass
    
    def health_check(self) -> Tuple[bool, str]:
        """
        Quick health check: verify API key works.
        Returns: (is_healthy, status_message)
        """
        try:
            # Simple test call
            result = self.generate_summary(
                symbol='TEST',
                side='BUY',
                value=1_000_000,
                context='Health check'
            )
            return (True, 'OK')
        except Exception as e:
            return (False, str(e))
```

#### 2.2 OpenAI Client Implementation
```python
# backend/portfolio/ai_clients/openai_client.py (NEW)

import openai
from typing import Tuple, Dict
from portfolio.ai_client import AIClientBase

class OpenAIClient(AIClientBase):
    def __init__(self, api_key: str, model: str = None, **kwargs):
        super().__init__(api_key, model or 'gpt-4o', **kwargs)
        openai.api_key = self.api_key
        self.client = openai.OpenAI(api_key=self.api_key)
    
    def get_default_model(self) -> str:
        return 'gpt-4o'
    
    def generate_summary(self, symbol: str, side: str, value: float, context: str) -> Tuple[str, Dict]:
        """Generate 50-60 word summary using OpenAI"""
        prompt = f"""
Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,} VNĐ.
Ngữ cảnh: {context}

Phân tích ngắn gọn (50-60 từ) về tác động tiềm năng tới thị trường:
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{'role': 'user', 'content': prompt}],
                temperature=0.7,
                max_tokens=100,
            )
            text = response.choices[0].message.content
            metadata = {
                'tokens': {
                    'prompt': response.usage.prompt_tokens,
                    'completion': response.usage.completion_tokens,
                },
                'model': self.model,
            }
            return (text, metadata)
        except Exception as e:
            logger.error(f'OpenAI API error: {e}')
            raise
    
    def generate_detail(self, symbol: str, side: str, value: float, context: str) -> Tuple[str, Dict]:
        """Generate 200+ word detailed analysis using OpenAI"""
        prompt = f"""
Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,} VNĐ.
Ngữ cảnh: {context}

Phân tích chi tiết (200-300 từ) bao gồm:
1. Tác động tâm lý thị trường
2. Mức hỗ trợ/kháng cự gần nhất
3. Khả năng xu hướng đảo chiều
4. Cảnh báo rủi ro
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{'role': 'user', 'content': prompt}],
                temperature=0.5,
                max_tokens=400,
            )
            text = response.choices[0].message.content
            metadata = {
                'tokens': {
                    'prompt': response.usage.prompt_tokens,
                    'completion': response.usage.completion_tokens,
                },
                'model': self.model,
            }
            return (text, metadata)
        except Exception as e:
            logger.error(f'OpenAI API error: {e}')
            raise
```

#### 2.3 Claude Client Implementation
```python
# backend/portfolio/ai_clients/claude_client.py (NEW)

import anthropic
from typing import Tuple, Dict
from portfolio.ai_client import AIClientBase

class ClaudeClient(AIClientBase):
    def __init__(self, api_key: str, model: str = None, **kwargs):
        super().__init__(api_key, model or 'claude-3-5-sonnet-20240620', **kwargs)
        self.client = anthropic.Anthropic(api_key=self.api_key)
    
    def get_default_model(self) -> str:
        return 'claude-3-5-sonnet-20240620'
    
    def generate_summary(self, symbol: str, side: str, value: float, context: str) -> Tuple[str, Dict]:
        """Generate summary using Claude (Sonnet = good speed/quality balance)"""
        prompt = f"""
Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,} VNĐ.
Ngữ cảnh: {context}

Phân tích ngắn gọn (50-60 từ) về tác động tiềm năng tới thị trường:
"""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=150,
                messages=[{'role': 'user', 'content': prompt}],
            )
            text = response.content[0].text
            metadata = {
                'tokens': {
                    'prompt': response.usage.input_tokens,
                    'completion': response.usage.output_tokens,
                },
                'model': self.model,
            }
            return (text, metadata)
        except Exception as e:
            logger.error(f'Claude API error: {e}')
            raise
    
    def generate_detail(self, symbol: str, side: str, value: float, context: str) -> Tuple[str, Dict]:
        """Generate detailed analysis (Claude Opus for best quality)"""
        prompt = f"""
Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,} VNĐ.
Ngữ cảnh: {context}

Phân tích chi tiết (200-300 từ):
1. Tác động tâm lý thị trường
2. Mức hỗ trợ/kháng cự gần nhất
3. Khả năng xu hướng đảo chiều
4. Cảnh báo rủi ro
"""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                messages=[{'role': 'user', 'content': prompt}],
            )
            text = response.content[0].text
            metadata = {
                'tokens': {
                    'prompt': response.usage.input_tokens,
                    'completion': response.usage.output_tokens,
                },
                'model': self.model,
            }
            return (text, metadata)
        except Exception as e:
            logger.error(f'Claude API error: {e}')
            raise
```

#### 2.4 Dispatcher & Factory
```python
# backend/portfolio/ai_service.py (NEW)

from typing import Type
from portfolio.ai_client import AIClientBase
from portfolio.ai_clients.openai_client import OpenAIClient
from portfolio.ai_clients.claude_client import ClaudeClient
from portfolio.ai_clients.gemini_client import GeminiClient
from portfolio.ai_clients.copilot_client import CopilotClient
from portfolio.ai_clients.openclaw_client import OpenClawClient
from portfolio.encryption_utils import APIKeyManager
import logging

logger = logging.getLogger(__name__)

class AIServiceFactory:
    """Factory to instantiate correct AI client based on provider"""
    
    CLIENTS: dict[str, Type[AIClientBase]] = {
        'openai': OpenAIClient,
        'claude': ClaudeClient,
        'gemini': GeminiClient,
        'copilot': CopilotClient,
        'openclaw': OpenClawClient,
    }
    
    @staticmethod
    def create_client(provider: str, api_key: str, model: str = None) -> AIClientBase:
        """
        Create AI client for given provider.
        Raises ValueError if provider not supported.
        """
        if provider not in AIServiceFactory.CLIENTS:
            raise ValueError(f'Unsupported provider: {provider}')
        
        client_class = AIServiceFactory.CLIENTS[provider]
        return client_class(api_key=api_key, model=model)
    
    @staticmethod
    def get_client_for_user(user_config) -> AIClientBase:
        """
        Get AI client configured for specific user.
        Priority: user's custom key > system-level key
        """
        provider = user_config.ai_provider
        model = user_config.ai_model or None
        api_key = APIKeyManager.get_api_key(user_config, provider)
        
        if not api_key:
            raise ValueError(f'No API key found for provider {provider}')
        
        return AIServiceFactory.create_client(provider, api_key, model)
```

#### 2.5 Update generate_whale_advisory_task()
```python
# backend/portfolio/tasks.py

from portfolio.ai_service import AIServiceFactory
from portfolio.encryption_utils import APIKeyManager

@app.task(bind=True, max_retries=3, default_retry_delay=60)
def generate_whale_advisory_task(self, symbol: str, matched_value_vnd: float, side: str, threshold: float = 0) -> dict:
    """
    Celery task: Generate whale advisory using user-configured AI provider.
    
    Changed from hardcoded OpenClaw to dynamic provider selection.
    """
    try:
        # Get system admin user config (or fall back to default OpenClaw)
        from django.contrib.auth.models import User
        admin_user = User.objects.filter(is_staff=True).first()
        
        if not admin_user:
            logger.warning('No admin user found, using default OpenClaw')
            provider = 'openclaw'
            api_key = os.getenv('OPENCLAW_API_KEY', '')
            model = 'default'
        else:
            user_config = admin_user.user_config
            provider = user_config.ai_provider
            model = user_config.ai_model
            api_key = APIKeyManager.get_api_key(user_config, provider)
        
        # Create client instance
        ai_client = AIServiceFactory.create_client(provider, api_key, model)
        
        # Generate summary (Pro plan)
        summary, summary_meta = ai_client.generate_summary(
            symbol=symbol,
            side=side,
            value=matched_value_vnd,
            context=f'Threshold: {threshold}M VNĐ'
        )
        
        # Generate detail (Premium plan)
        detail, detail_meta = ai_client.generate_detail(
            symbol=symbol,
            side=side,
            value=matched_value_vnd,
            context=f'Threshold: {threshold}M VNĐ'
        )
        
        # Combine token usage
        total_tokens_prompt = (
            summary_meta.get('tokens', {}).get('prompt', 0) +
            detail_meta.get('tokens', {}).get('prompt', 0)
        )
        total_tokens_completion = (
            summary_meta.get('tokens', {}).get('completion', 0) +
            detail_meta.get('tokens', {}).get('completion', 0)
        )
        
        # Save to database
        advisory = WhaleAdvisory.objects.create(
            symbol=symbol,
            matched_value=matched_value_vnd,
            side=side,
            threshold=threshold,
            ai_summary=summary,
            ai_detail=detail,
            ai_provider=provider,
            prompt_tokens=total_tokens_prompt,
            completion_tokens=total_tokens_completion,
        )
        
        # Push WebSocket event
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'whale_{symbol}',
                {
                    'type': 'whale_advisory',
                    'message': {
                        'event_type': 'whale_advisory',
                        'data': {
                            'id': advisory.id,
                            'symbol': symbol,
                            'side': side,
                            'summary': summary,
                            'detail': detail,
                            'provider': provider,
                            'model': model,
                        }
                    }
                }
            )
        except Exception as e:
            logger.warning(f'WebSocket push failed: {e}')
        
        return {
            'status': 'success',
            'advisory_id': advisory.id,
            'provider': provider,
            'tokens_used': {
                'prompt': total_tokens_prompt,
                'completion': total_tokens_completion,
            }
        }
    
    except Exception as exc:
        logger.error(f'generate_whale_advisory_task failed: {exc}')
        raise self.retry(exc=exc)
```

---

### Phase 3: API Endpoints
**Duration**: 2-3 days  
**Files**: views.py, serializers.py, urls.py

#### 3.1 New Serializers
```python
# backend/portfolio/serializers.py (additions)

class UserConfigAISerializer(serializers.Serializer):
    """Serializer for USER AI configuration (with API key input)"""
    ai_provider = serializers.ChoiceField(
        choices=['openai', 'claude', 'gemini', 'copilot', 'openclaw'],
        required=True,
    )
    ai_model = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text='Leave blank for provider default'
    )
    ai_api_key = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        write_only=True,  # Never return key to frontend
        help_text='Leave blank to use system-level key',
    )
    
    def validate_ai_provider(self, value):
        from portfolio.ai_config import AVAILABLE_AI_MODELS
        if value not in AVAILABLE_AI_MODELS:
            raise serializers.ValidationError(f'Invalid provider: {value}')
        return value
    
    def validate_ai_model(self, value):
        from portfolio.ai_config import AVAILABLE_AI_MODELS
        provider = self.initial_data.get('ai_provider')
        if provider and value:
            valid_models = [m['id'] for m in AVAILABLE_AI_MODELS.get(provider, [])]
            if value not in valid_models:
                raise serializers.ValidationError(
                    f'Invalid model for {provider}. Valid: {valid_models}'
                )
        return value


class AIOptionsResponseSerializer(serializers.Serializer):
    """Response for GET /api/ai-options/"""
    providers = serializers.DictField(
        child=serializers.ListField(
            child=serializers.DictField()
        )
    )


class TestConnectionResponseSerializer(serializers.Serializer):
    """Response for POST /api/ai-config/test-connection/"""
    status = serializers.CharField()  # 'success' or 'failed'
    message = serializers.CharField()
    model_used = serializers.CharField(required=False)
    tokens_used = serializers.DictField(required=False)
```

#### 3.2 New API Views
```python
# backend/portfolio/views.py (additions)

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.decorators import action
from portfolio.ai_config import AVAILABLE_AI_MODELS
from portfolio.ai_service import AIServiceFactory
from portfolio.serializers import UserConfigAISerializer, AIOptionsResponseSerializer

class AIOptionsView(generics.GenericAPIView):
    """
    GET /api/ai-options/
    Public endpoint: Return available AI providers and models (no auth required).
    Frontend uses this to populate dropdowns.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        response_data = {
            'providers': AVAILABLE_AI_MODELS,
        }
        return Response(response_data)


class AIConfigUpdateView(generics.GenericAPIView):
    """
    PUT /api/ai-config/ - Update user's AI settings
    POST /api/ai-config/test-connection/ - Test API key
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserConfigAISerializer
    
    def put(self, request):
        """Update user AI configuration"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_config = request.user.user_config
        user_config.ai_provider = serializer.validated_data['ai_provider']
        user_config.ai_model = serializer.validated_data.get('ai_model', 'default')
        
        # Handle API key
        api_key = serializer.validated_data.get('ai_api_key', '')
        if api_key:
            user_config.set_ai_api_key(api_key)
        
        user_config.save()
        
        return Response({
            'status': 'success',
            'message': 'AI config updated',
            'ai_provider': user_config.ai_provider,
            'ai_model': user_config.ai_model,
        })
    
    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """Test if API key + model combination works"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        provider = serializer.validated_data['ai_provider']
        model = serializer.validated_data.get('ai_model')
        api_key = serializer.validated_data.get('ai_api_key')
        
        try:
            # Test with provided or system-level key
            test_key = api_key or os.getenv(
                f'{provider.upper()}_API_KEY', ''
            )
            
            if not test_key:
                return Response(
                    {'status': 'failed', 'message': f'No API key for {provider}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create client and run health check
            client = AIServiceFactory.create_client(provider, test_key, model)
            is_healthy, message = client.health_check()
            
            if is_healthy:
                return Response({
                    'status': 'success',
                    'message': 'API connection OK',
                    'provider': provider,
                    'model': model,
                })
            else:
                return Response({
                    'status': 'failed',
                    'message': message,
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return Response({
                'status': 'failed',
                'message': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
```

#### 3.3 URL Routes
```python
# backend/config/urls.py (additions)

urlpatterns = [
    # ... existing routes ...
    
    path('api/ai-options/', AIOptionsView.as_view(), name='ai_options'),
    path('api/ai-config/', AIConfigUpdateView.as_view(), name='ai_config_update'),
    path('api/ai-config/test-connection/', 
         AIConfigUpdateView.as_view(actions={'post': 'test_connection'}),
         name='test_ai_connection'),
]
```

---

### Phase 4: Frontend UI Components
**Duration**: 3-4 days  
**Files**: WhaleAdvisory.jsx, AdminOps.jsx, api/client.js

#### 4.1 AI Config Form Component
```jsx
// frontend/src/components/AIConfigForm.jsx (NEW)

import React, { useState, useEffect } from 'react';
import { AVAILABLE_AI_MODELS } from '../constants/aiModels';
import { updateAIConfig, testAIConnection } from '../api/client';

function AIConfigForm({ onSaved }) {
  const [provider, setProvider] = useState('openclaw');
  const [model, setModel] = useState('default');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  // Get available models for selected provider
  const availableModels = AVAILABLE_AI_MODELS[provider] || [];

  // Auto-select first model when provider changes
  useEffect(() => {
    if (availableModels.length > 0 && model !== availableModels[0].id) {
      setModel(availableModels[0].id);
    }
  }, [provider]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setError(null);
    try {
      const result = await testAIConnection({
        ai_provider: provider,
        ai_model: model || undefined,
        ai_api_key: apiKey || undefined,
      });
      setTestResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await updateAIConfig({
        ai_provider: provider,
        ai_model: model || undefined,
        ai_api_key: apiKey || undefined,
      });
      setTestResult(null);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 p-6 rounded-lg">
      <h3 className="text-lg font-bold text-cyan-300">AI Provider Configuration</h3>

      {/* Provider Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          AI Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-400"
        >
          <option value="openclaw">OpenClaw (VietnamData)</option>
          <option value="openai">OpenAI (GPT)</option>
          <option value="claude">Anthropic Claude</option>
          <option value="gemini">Google Gemini</option>
          <option value="copilot">Microsoft Copilot</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">
          Select your preferred AI provider for whale advisory generation
        </p>
      </div>

      {/* Model Selector (Dynamic based on Provider) */}
      {availableModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-400"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.cost})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* API Key Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          API Key (Optional)
        </label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Leave empty to use system-level API key"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showApiKey ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Your API key is encrypted. Leave blank to use system API key from environment.
        </p>
      </div>

      {/* Test Connection */}
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testingConnection}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white rounded font-medium transition-colors"
      >
        {testingConnection ? 'Testing...' : 'Test Connection'}
      </button>

      {/* Test Result Indicator */}
      {testResult && (
        <div
          className={`p-3 rounded ${
            testResult.status === 'success'
              ? 'bg-green-900/30 border border-green-600 text-green-300'
              : 'bg-red-900/30 border border-red-600 text-red-300'
          }`}
        >
          <p className="text-sm font-medium">
            {testResult.status === 'success' ? '✓ Success' : '✗ Failed'}
          </p>
          <p className="text-xs mt-1">{testResult.message}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded bg-red-900/30 border border-red-600 text-red-300">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-500 text-white rounded font-medium transition-colors"
      >
        {loading ? 'Saving...' : 'Save Configuration'}
      </button>
    </form>
  );
}

export default AIConfigForm;
```

#### 4.2 Frontend Constants
```javascript
// frontend/src/constants/aiModels.js (NEW)

export const AVAILABLE_AI_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Latest, most capable)', cost: 'high' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (Fast, capable)', cost: 'medium' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Fast, economic)', cost: 'low' },
  ],
  claude: [
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (Latest)', cost: 'medium' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Most capable)', cost: 'high' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast, economic)', cost: 'low' },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Latest)', cost: 'medium' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)', cost: 'low' },
  ],
  copilot: [
    { id: 'copilot-pro', name: 'Copilot Pro (Microsoft)', cost: 'medium' },
  ],
  openclaw: [
    { id: 'default', name: 'OpenClaw (VietnamData)', cost: 'low' },
  ],
};
```

#### 4.3 API Client Functions
```javascript
// frontend/src/api/client.js (additions)

export async function getAIOptions() {
  return apiClient.get('/api/ai-options/');
}

export async function updateAIConfig(config) {
  return apiClient.put('/api/ai-config/', config);
}

export async function testAIConnection(config) {
  return apiClient.post('/api/ai-config/test-connection/', config);
}
```

#### 4.4 Admin Settings Page (Integration)
```jsx
// frontend/src/pages/AdminOps.jsx (modification)

import AIConfigForm from '../components/AIConfigForm';

function AdminOps() {
  // ... existing code ...
  
  return (
    <div className="space-y-6">
      {/* ... existing panels ... */}
      
      {/* NEW: AI Configuration Panel */}
      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-cyan-300 mb-4">
          🤖 AI Provider Settings
        </h2>
        <AIConfigForm onSaved={() => {
          // Refresh stats after save
          // toast.success('AI configuration updated');
        }} />
      </section>
    </div>
  );
}
```

---

### Phase 5: Testing & Documentation
**Duration**: 2-3 days  
**Files**: tests/, docs

#### 5.1 Backend Unit Tests
```python
# backend/portfolio/tests/test_ai_config.py (NEW)

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from portfolio.models import UserConfig
from portfolio.ai_service import AIServiceFactory
from portfolio.encryption_utils import APIKeyManager

class APIKeyEncryptionTests(TestCase):
    """Test encryption/decryption of API keys"""
    
    def test_encrypt_decrypt_roundtrip(self):
        plain_key = 'sk-test-1234567890'
        encrypted = APIKeyManager.encrypt_key(plain_key)
        decrypted = APIKeyManager.decrypt_key(encrypted)
        self.assertEqual(plain_key, decrypted)
    
    def test_empty_key_handling(self):
        encrypted = APIKeyManager.encrypt_key('')
        self.assertEqual(encrypted, '')


class AIServiceFactoryTests(TestCase):
    """Test AI client factory"""
    
    def test_create_openai_client(self):
        client = AIServiceFactory.create_client('openai', 'sk-test-key')
        self.assertEqual(client.model, 'gpt-4o')
    
    def test_unsupported_provider(self):
        with self.assertRaises(ValueError):
            AIServiceFactory.create_client('invalid', 'key')


class AIConfigAPITests(APITestCase):
    """Test AI configuration endpoints"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_get_ai_options(self):
        response = self.client.get('/api/ai-options/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('providers', response.json())
    
    def test_update_ai_config_valid(self):
        data = {
            'ai_provider': 'openai',
            'ai_model': 'gpt-4o',
            'ai_api_key': 'sk-test-key'
        }
        response = self.client.put('/api/ai-config/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify saved
        self.user.user_config.refresh_from_db()
        self.assertEqual(self.user.user_config.ai_provider, 'openai')
```

#### 5.2 Integration Test: Whale Advisory Generation
```python
# backend/portfolio/tests/test_whale_advisory_multi_provider.py (NEW)

from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth.models import User
from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks import generate_whale_advisory_task

class WhaleAdvisoryMultiProviderTests(TestCase):
    """Test WhaleAdvisory generation with different providers"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin',
            is_staff=True,
            password='testpass'
        )
        self.user_config = self.user.user_config
    
    @patch('portfolio.ai_clients.openai_client.OpenAIClient.generate_summary')
    @patch('portfolio.ai_clients.openai_client.OpenAIClient.generate_detail')
    def test_whale_advisory_with_openai(self, mock_detail, mock_summary):
        """Test whale advisory generation using OpenAI"""
        mock_summary.return_value = ('Test summary', {'tokens': {'prompt': 50, 'completion': 20}})
        mock_detail.return_value = ('Test detail', {'tokens': {'prompt': 100, 'completion': 100}})
        
        # Configure user for OpenAI
        self.user_config.ai_provider = 'openai'
        self.user_config.ai_model = 'gpt-4o'
        self.user_config.set_ai_api_key('sk-test-key')
        self.user_config.save()
        
        # Run task
        with patch('portfolio.tasks.AIServiceFactory.create_client') as mock_factory:
            mock_client = MagicMock()
            mock_client.generate_summary = mock_summary
            mock_client.generate_detail = mock_detail
            mock_factory.return_value = mock_client
            
            result = generate_whale_advisory_task('VCB', 100_000_000, 'BUY')
        
        # Verify WhaleAdvisory created
        advisory = WhaleAdvisory.objects.get(symbol='VCB')
        self.assertEqual(advisory.ai_provider, 'openai')
        self.assertEqual(advisory.ai_summary, 'Test summary')
```

---

## 4. Implementation Priority & Timeline

### Sprint 15 (2 weeks)
- **Week 1**:
  - Phase 1: Database migration + encryption layer
  - Phase 2: AI client dispatcher (OpenAI + Claude)
  
- **Week 2**:
  - Phase 3: API endpoints
  - Phase 4: Frontend UI (Phase 1)
  - Begin Phase 5: Testing

### Sprint 16 (1 week)
- Phase 4: Complete frontend UI
- Phase 5: Full test coverage
- Documentation + deployment

---

## 5. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| API key exposure | Fernet encryption + no key in logs |
| Rate limiting from new providers | Exponential backoff + retry queue |
| Backward compatibility | Fallback to OpenClaw if config missing |
| Model naming inconsistency | Centralized AVAILABLE_AI_MODELS constant |
| Testing with paid APIs | Mock all API calls in tests |
| User confusion on API keys | Clear UI help text + test button |

---

## 6. Success Criteria

✅ Users can switch providers via AdminOps UI  
✅ Each provider has multiple models to choose from  
✅ API keys are encrypted at rest  
✅ WhaleAdvisory.ai_provider reflects selected provider  
✅ Whale advisory generation works with OpenAI + Claude (v1 release)  
✅ Test connection endpoint validates provider + model + key  
✅ 95%+ test coverage for new code  
✅ No performance regression vs. OpenClaw-only  
✅ Documentation updated with setup guide per provider

---

## 7. Follow-up Features (Not in v2)

🔲 Cost tracking per provider  
🔲 A/B testing: compare outputs from different providers  
🔲 Streaming responses (for providers that support it)  
🔲 Model switching on-the-fly without page reload  
🔲 Scheduled reanalysis of old advisories with new provider  
🔲 Admin dashboard: provider health, token usage trends  

---

## Appendix: Code Structure Overview

```
backend/portfolio/
├── models.py (updated)
│   └── UserConfig: +ai_provider, ai_model, ai_api_key fields
├── ai_config.py (NEW)
│   └── AVAILABLE_AI_MODELS, PROVIDER_CONFIGS constants
├── encryption_utils.py (NEW)
│   └── APIKeyManager: encrypt/decrypt functions
├── ai_client.py (NEW)
│   └── AIClientBase abstract class
├── ai_service.py (NEW)
│   └── AIServiceFactory dispatcher
├── ai_clients/ (NEW directory)
│   ├── openai_client.py: OpenAIClient implementation
│   ├── claude_client.py: ClaudeClient implementation
│   ├── gemini_client.py: GeminiClient implementation
│   ├── copilot_client.py: CopilotClient implementation
│   └── openclaw_client.py: Wrapper for existing OpenClaw
├── tasks.py (updated)
│   └── generate_whale_advisory_task(): now uses AIServiceFactory
├── views.py (updated)
│   ├── AIOptionsView: GET /api/ai-options/
│   └── AIConfigUpdateView: PUT /api/ai-config/, POST test-connection/
├── serializers.py (updated)
│   ├── UserConfigAISerializer: validation
│   └── AIOptionsResponseSerializer: response format
├── tests/
│   ├── test_ai_config.py (NEW)
│   ├── test_whale_advisory_multi_provider.py (NEW)
│   └── ...existing tests...
└── migrations/
    └── 0038_auto_userconfig_ai_provider.py (NEW)

frontend/src/
├── constants/
│   └── aiModels.js (NEW): AVAILABLE_AI_MODELS mapping
├── components/
│   └── AIConfigForm.jsx (NEW): provider/model/key input form
├── pages/
│   └── AdminOps.jsx (updated): integrate AIConfigForm
├── api/
│   └── client.js (updated): getAIOptions, updateAIConfig, testAIConnection
└── ...existing components...
```

---

**Document Version**: 2.0  
**Last Updated**: April 4, 2026  
**Next Review**: End of Sprint 15
