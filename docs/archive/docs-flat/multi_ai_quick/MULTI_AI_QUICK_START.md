# Multi-AI Providers v2 - Developer Quick Start Guide

## Getting Started: Step-by-Step Implementation

This guide provides a **copy-paste ready** approach to implement each phase sequentially.

---

## Phase 1: Database & Encryption (Days 1-3)

### Step 1.1: Create Migration File

```bash
cd backend
python manage.py makemigrations portfolio --name add_ai_provider_config
```

This generates: `portfolio/migrations/XXXX_add_ai_provider_config.py`

### Step 1.2: Add encryption_utils.py

**File**: `backend/portfolio/encryption_utils.py`

```python
import logging
import os
from django.conf import settings
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class APIKeyManager:
    """Encrypt/decrypt API keys using Fernet (symmetric encryption)"""
    
    _cipher_cache = None
    
    @classmethod
    def _ensure_encryption_key(cls):
        """Initialize encryption key from settings or environment"""
        if not hasattr(settings, 'ENCRYPTION_KEY'):
            # Try to get from environment or generate
            key = os.environ.get('VNINVEST_ENCRYPTION_KEY')
            if not key:
                # Generate new key (save to .env for production!)
                key = Fernet.generate_key().decode('utf-8')
                logger.warning(
                    'Generated new ENCRYPTION_KEY. '
                    'Add to environment: VNINVEST_ENCRYPTION_KEY=%s', key
                )
            settings.ENCRYPTION_KEY = key.encode() if isinstance(key, str) else key
    
    @classmethod
    def _get_cipher(cls):
        """Get Fernet cipher instance"""
        if cls._cipher_cache is None:
            cls._ensure_encryption_key()
            cls._cipher_cache = Fernet(settings.ENCRYPTION_KEY)
        return cls._cipher_cache
    
    @staticmethod
    def encrypt_key(api_key: str) -> str:
        """Encrypt API key. Returns base64 ciphertext."""
        if not api_key or not api_key.strip():
            return ''
        
        cipher = APIKeyManager._get_cipher()
        encrypted = cipher.encrypt(api_key.encode('utf-8'))
        return encrypted.decode('utf-8')
    
    @staticmethod
    def decrypt_key(encrypted_key: str) -> str:
        """Decrypt API key. Returns plaintext."""
        if not encrypted_key or not encrypted_key.strip():
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
        Get API key for provider.
        Priority: User custom key > System environment key
        """
        # Check user's custom encrypted key
        if user_config.ai_api_key and user_config.ai_api_key_encrypted:
            try:
                key = APIKeyManager.decrypt_key(user_config.ai_api_key)
                if key:
                    return key
            except Exception as e:
                logger.error(f'Failed to use user API key: {e}')
        
        # Fall back to system-level environment key
        from portfolio.ai_config import PROVIDER_CONFIGS
        env_var = PROVIDER_CONFIGS.get(provider, {}).get('env_var_name')
        if env_var:
            return os.getenv(env_var, '')
        
        return ''
```

### Step 1.3: Update models.py

In `backend/portfolio/models.py`, find the `UserConfig` class and add these fields:

```python
class UserConfig(models.Model):
    # ... existing fields (whale_alert_threshold, theme, plan, etc) ...
    
    # ===== AI Provider Configuration (NEW - April 2026) =====
    ai_provider = models.CharField(
        max_length=50,
        choices=[
            ('openclaw', 'OpenClaw (VietnamData)'),
            ('openai', 'OpenAI (GPT)'),
            ('claude', 'Anthropic Claude'),
            ('gemini', 'Google Gemini'),
            ('copilot', 'Microsoft Copilot'),
        ],
        default='openclaw',
        verbose_name='AI Provider',
        help_text='Provider used for generating whale advisories',
    )
    ai_model = models.CharField(
        max_length=100,
        default='default',
        blank=True,
        verbose_name='AI Model',
        help_text='E.g., gpt-4o, claude-3-5-sonnet. Leave empty for provider default.',
    )
    ai_api_key = models.TextField(
        blank=True,
        default='',
        verbose_name='API Key (Encrypted)',
        help_text='Leave empty to use system-level API key from environment',
    )
    ai_api_key_encrypted = models.BooleanField(
        default=False,
        verbose_name='API Key is Encrypted',
        help_text='Internal flag to track encryption status',
    )
    
    # Helper methods
    def set_ai_api_key(self, api_key: str):
        """Encrypt and save API key"""
        from portfolio.encryption_utils import APIKeyManager
        if api_key and api_key.strip():
            self.ai_api_key = APIKeyManager.encrypt_key(api_key)
            self.ai_api_key_encrypted = True
        else:
            self.ai_api_key = ''
            self.ai_api_key_encrypted = False
    
    def get_ai_api_key(self) -> str:
        """Decrypt and return API key"""
        from portfolio.encryption_utils import APIKeyManager
        return APIKeyManager.get_api_key(self, self.ai_provider)
```

### Step 1.4: Run Migration

```bash
python manage.py migrate portfolio
```

**Verify**: Check database
```bash
python manage.py dbshell
sqlite> SELECT ai_provider, ai_model FROM portfolio_userconfig LIMIT 1;
```

### Step 1.5: Test Encryption

```bash
python manage.py shell
>>> from portfolio.encryption_utils import APIKeyManager
>>> encrypted = APIKeyManager.encrypt_key("sk-test-1234567890")
>>> decrypted = APIKeyManager.decrypt_key(encrypted)
>>> print(decrypted == "sk-test-1234567890")
True
```

✅ **Phase 1 Complete**

---

## Phase 2: AI Service Factory (Days 4-6)

### Step 2.1: Create ai_config.py

**File**: `backend/portfolio/ai_config.py`

```python
"""
Configuration for AI providers and available models.
Used by both frontend (for dropdowns) and backend (for validation).
"""

# ===== Available Models per Provider =====
AVAILABLE_AI_MODELS = {
    'openai': [
        {
            'id': 'gpt-4o',
            'name': 'GPT-4o (Latest, most capable)',
            'cost': 'high',
            'description': 'Best for complex analysis',
        },
        {
            'id': 'gpt-4-turbo',
            'name': 'GPT-4 Turbo (Fast, capable)',
            'cost': 'medium',
            'description': 'Good balance of speed and quality',
        },
        {
            'id': 'gpt-3.5-turbo',
            'name': 'GPT-3.5 Turbo (Fast, economic)',
            'cost': 'low',
            'description': 'Fast responses, economical',
        },
    ],
    'claude': [
        {
            'id': 'claude-3-5-sonnet-20240620',
            'name': 'Claude 3.5 Sonnet (Latest)',
            'cost': 'medium',
            'description': 'Good speed-quality tradeoff',
        },
        {
            'id': 'claude-3-opus-20240229',
            'name': 'Claude 3 Opus (Most capable)',
            'cost': 'high',
            'description': 'Best for detailed analysis',
        },
        {
            'id': 'claude-3-haiku-20240307',
            'name': 'Claude 3 Haiku (Fast, economic)',
            'cost': 'low',
            'description': 'Fastest option',
        },
    ],
    'gemini': [
        {
            'id': 'gemini-1.5-pro',
            'name': 'Gemini 1.5 Pro (Latest)',
            'cost': 'medium',
            'description': 'High performance',
        },
        {
            'id': 'gemini-1.5-flash',
            'name': 'Gemini 1.5 Flash (Fast)',
            'cost': 'low',
            'description': 'Fast and efficient',
        },
    ],
    'copilot': [
        {
            'id': 'copilot-pro',
            'name': 'Copilot Pro (Microsoft)',
            'cost': 'medium',
            'description': 'Microsoft enterprise solutions',
        },
    ],
    'openclaw': [
        {
            'id': 'default',
            'name': 'OpenClaw (VietnamData)',
            'cost': 'low',
            'description': 'Vietnam stock market specialist',
        },
    ],
}

# ===== Default Model per Provider =====
DEFAULT_MODELS = {
    'openai': 'gpt-4o',
    'claude': 'claude-3-5-sonnet-20240620',
    'gemini': 'gemini-1.5-pro',
    'copilot': 'copilot-pro',
    'openclaw': 'default',
}

# ===== Provider Configuration =====
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

### Step 2.2: Create ai_client.py (Base Class)

**File**: `backend/portfolio/ai_client.py`

```python
"""
Abstract base class for AI providers.
Each provider implements generate_summary() and generate_detail().
"""
from abc import ABC, abstractmethod
from typing import Tuple, Dict
import logging

logger = logging.getLogger(__name__)


class AIClientBase(ABC):
    """Abstract base for all AI provider clients"""
    
    def __init__(self, api_key: str, model: str = None, **kwargs):
        self.api_key = api_key
        self.model = model or self.get_default_model()
        self.extra_config = kwargs
    
    @abstractmethod
    def get_default_model(self) -> str:
        """Return default model ID for this provider"""
        pass
    
    @abstractmethod
    def generate_summary(
        self,
        symbol: str,
        side: str,
        value: float,
        context: str
    ) -> Tuple[str, Dict]:
        """
        Generate short advisory summary (50-60 words for Pro plan).
        
        Returns:
            (text, metadata) where metadata = {
                'tokens': {'prompt': int, 'completion': int},
                'model': str,
                'cost': float (optional),
            }
        """
        pass
    
    @abstractmethod
    def generate_detail(
        self,
        symbol: str,
        side: str,
        value: float,
        context: str
    ) -> Tuple[str, Dict]:
        """
        Generate detailed analysis (200-300 words for Premium plan).
        
        Returns:
            (text, metadata) where metadata = {
                'tokens': {'prompt': int, 'completion': int},
                'model': str,
                'cost': float (optional),
            }
        """
        pass
    
    def health_check(self) -> Tuple[bool, str]:
        """
        Quick health check to verify API key + model work.
        
        Returns:
            (is_healthy: bool, status_message: str)
        """
        try:
            _, _ = self.generate_summary(
                symbol='TEST',
                side='BUY',
                value=1_000_000,
                context='System health check'
            )
            return (True, 'API connection OK')
        except Exception as e:
            return (False, f'Health check failed: {str(e)}')
```

### Step 2.3: Create OpenAI Client

**File**: `backend/portfolio/ai_clients/openai_client.py`

```python
import logging
import openai
from typing import Tuple, Dict
from portfolio.ai_client import AIClientBase

logger = logging.getLogger(__name__)


class OpenAIClient(AIClientBase):
    """OpenAI GPT client for whale advisory generation"""
    
    def __init__(self, api_key: str, model: str = None, **kwargs):
        super().__init__(api_key, model or 'gpt-4o', **kwargs)
        self.client = openai.OpenAI(api_key=self.api_key)
    
    def get_default_model(self) -> str:
        return 'gpt-4o'
    
    def generate_summary(
        self,
        symbol: str,
        side: str,
        value: float,
        context: str
    ) -> Tuple[str, Dict]:
        """Generate 50-60 word summary"""
        prompt = f"""Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,.0f} VNĐ.
Ngữ cảnh: {context}

Phân tích ngắn gọn (50-60 từ) về tác động tiềm năng tới thị trường và tâm lý nhà đầu tư:"""
        
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
    
    def generate_detail(
        self,
        symbol: str,
        side: str,
        value: float,
        context: str
    ) -> Tuple[str, Dict]:
        """Generate 200-300 word detailed analysis"""
        prompt = f"""Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,.0f} VNĐ.
Ngữ cảnh: {context}

Phân tích chi tiết (200-300 từ) bao gồm:
1. Tác động tâm lý ngắn hạn trên thị trường
2. Mức hỗ trợ/kháng cự gần nhất (giá)
3. Khả năng xu hướng đảo chiều hoặc tiếp tục
4. Cảnh báo rủi ro chính cần quan sát
5. Khuyên cáo hành động cho nhà đầu tư thông thường"""
        
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

### Step 2.4: Create Claude Client

**File**: `backend/portfolio/ai_clients/claude_client.py`

```python
import logging
import anthropic
from typing import Tuple, Dict
from portfolio.ai_client import AIClientBase

logger = logging.getLogger(__name__)


class ClaudeClient(AIClientBase):
    """Anthropic Claude client for whale advisory generation"""
    
    def __init__(self, api_key: str, model: str = None, **kwargs):
        super().__init__(api_key, model or 'claude-3-5-sonnet-20240620', **kwargs)
        self.client = anthropic.Anthropic(api_key=self.api_key)
    
    def get_default_model(self) -> str:
        return 'claude-3-5-sonnet-20240620'
    
    def generate_summary(
        self,
        symbol: str,
        side: str,
        value: float,
        context: str
    ) -> Tuple[str, Dict]:
        """Generate 50-60 word summary using Claude"""
        prompt = f"""Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,.0f} VNĐ.
Ngữ cảnh: {context}

Phân tích ngắn gọn (50-60 từ) về tác động tiềm năng tới thị trường và tâm lý nhà đầu tư:"""
        
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
    
    def generate_detail(
        self,
        symbol: str,
        side: str,
        value: float,
        context: str
    ) -> Tuple[str, Dict]:
        """Generate 200-300 word detailed analysis"""
        prompt = f"""Nhà đầu tư khối lượng lớn vừa {side.lower()} {symbol} trị giá {value:,.0f} VNĐ.
Ngữ cảnh: {context}

Phân tích chi tiết (200-300 từ) bao gồm:
1. Tác động tâm lý ngắn hạn trên thị trường
2. Mức hỗ trợ/kháng cự gần nhất (giá)
3. Khả năng xu hướng đảo chiều hoặc tiếp tục
4. Cảnh báo rủi ro chính cần quan sát
5. Khuyên cáo hành động cho nhà đầu tư thông thường"""
        
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

### Step 2.5: Create Service Factory

**File**: `backend/portfolio/ai_service.py`

```python
"""
Factory pattern: Creates appropriate AI client based on provider.
Used by tasks.py to dispatch whale advisory generation.
"""
import logging
from typing import Type
from portfolio.ai_client import AIClientBase
from portfolio.ai_clients.openai_client import OpenAIClient
from portfolio.ai_clients.claude_client import ClaudeClient
from portfolio.encryption_utils import APIKeyManager

logger = logging.getLogger(__name__)


class AIServiceFactory:
    """Factory for creating AI client instances"""
    
    CLIENTS: dict[str, Type[AIClientBase]] = {
        'openai': OpenAIClient,
        'claude': ClaudeClient,
        # 'gemini': GeminiClient,  # Add in Phase 4
        # 'copilot': CopilotClient,  # Add in Phase 4
        # 'openclaw': OpenClawClient,  # Add in Phase 4
    }
    
    @staticmethod
    def create_client(
        provider: str,
        api_key: str,
        model: str = None
    ) -> AIClientBase:
        """
        Factory method: Create AI client for given provider.
        
        Args:
            provider: 'openai' | 'claude' | 'gemini' | 'copilot' | 'openclaw'
            api_key: API key (plain, not encrypted)
            model: Optional model override
        
        Returns:
            Instantiated AIClientBase subclass
        
        Raises:
            ValueError: If provider not supported
        """
        if provider not in AIServiceFactory.CLIENTS:
            raise ValueError(
                f'Unsupported provider: {provider}. '
                f'Supported: {list(AIServiceFactory.CLIENTS.keys())}'
            )
        
        client_class = AIServiceFactory.CLIENTS[provider]
        return client_class(api_key=api_key, model=model)
    
    @staticmethod
    def get_client_for_user(user_config) -> AIClientBase:
        """
        Create AI client configured for specific user.
        Decrypts user's API key if set, otherwise uses environment variable.
        """
        provider = user_config.ai_provider or 'openclaw'
        model = user_config.ai_model or None
        
        # Get API key (user's encrypted key or system-level env var)
        api_key = APIKeyManager.get_api_key(user_config, provider)
        
        if not api_key:
            raise ValueError(
                f'No API key found for provider {provider}. '
                f'Set user API key or environment variable.'
            )
        
        return AIServiceFactory.create_client(provider, api_key, model)
```

✅ **Phase 2 Complete** (Basic OpenAI + Claude support)

---

## Phase 3: API Endpoints (Days 7-9)

### Step 3.1: Update serializers.py

Add to `backend/portfolio/serializers.py`:

```python
class UserConfigAISettingsSerializer(serializers.Serializer):
    """Serializer for updating user AI configuration"""
    ai_provider = serializers.ChoiceField(
        choices=['openai', 'claude', 'gemini', 'copilot', 'openclaw'],
        required=True,
    )
    ai_model = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )
    ai_api_key = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        write_only=True,  # Never send back to frontend
    )
    
    def validate_ai_provider(self, value):
        """Validate provider is supported"""
        from portfolio.ai_config import AVAILABLE_AI_MODELS
        if value not in AVAILABLE_AI_MODELS:
            raise serializers.ValidationError(f'Unsupported provider: {value}')
        return value
    
    def validate_ai_model(self, value):
        """Validate model exists for provider"""
        if not value:
            return value
        
        from portfolio.ai_config import AVAILABLE_AI_MODELS
        provider = self.initial_data.get('ai_provider')
        if provider:
            valid_model_ids = [m['id'] for m in AVAILABLE_AI_MODELS.get(provider, [])]
            if value not in valid_model_ids:
                raise serializers.ValidationError(
                    f'Invalid model for {provider}. Valid: {valid_model_ids}'
                )
        return value
```

### Step 3.2: Add Views

Add to `backend/portfolio/views.py`:

```python
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from portfolio.ai_config import AVAILABLE_AI_MODELS
from portfolio.ai_service import AIServiceFactory
from portfolio.serializers import UserConfigAISettingsSerializer


class AIOptionsView(generics.GenericAPIView):
    """GET /api/ai-options/ - Return available providers and models"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Return AVAILABLE_AI_MODELS for frontend dropdowns"""
        return Response({
            'providers': AVAILABLE_AI_MODELS,
        })


class AIConfigView(generics.GenericAPIView):
    """
    PUT /api/ai-config/ - Save user AI settings
    POST /api/ai-config/test-connection/ - Test API key
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserConfigAISettingsSerializer
    
    def put(self, request):
        """Update user AI configuration"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_config = request.user.user_config
        user_config.ai_provider = serializer.validated_data['ai_provider']
        user_config.ai_model = serializer.validated_data.get('ai_model', '')
        
        # Handle API key encryption
        api_key = serializer.validated_data.get('ai_api_key', '')
        if api_key:
            user_config.set_ai_api_key(api_key)
        
        user_config.save()
        
        return Response({
            'status': 'success',
            'message': 'AI configuration updated',
            'ai_provider': user_config.ai_provider,
            'ai_model': user_config.ai_model,
        }, status=status.HTTP_200_OK)
    
    def post(self, request):
        """Test API key + model connection"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        provider = serializer.validated_data['ai_provider']
        model = serializer.validated_data.get('ai_model')
        api_key = serializer.validated_data.get('ai_api_key')
        
        try:
            # Use provided key or system environment key
            test_key = api_key
            if not test_key:
                from portfolio.ai_config import PROVIDER_CONFIGS
                env_var = PROVIDER_CONFIGS[provider]['env_var_name']
                test_key = os.getenv(env_var, '')
            
            if not test_key:
                return Response({
                    'status': 'failed',
                    'message': f'No API key found. Set {provider.upper()}_API_KEY env var.',
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create client and test
            client = AIServiceFactory.create_client(provider, test_key, model)
            is_healthy, msg = client.health_check()
            
            if is_healthy:
                return Response({
                    'status': 'success',
                    'message': msg,
                    'provider': provider,
                    'model': model,
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'status': 'failed',
                    'message': msg,
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f'Test connection failed: {e}')
            return Response({
                'status': 'failed',
                'message': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
```

### Step 3.3: Add URL Routes

In `backend/config/urls.py`, add:

```python
urlpatterns = [
    # ... existing paths ...
    path('api/ai-options/', AIOptionsView.as_view(), name='ai_options'),
    path('api/ai-config/', AIConfigView.as_view(), name='ai_config'),
    path('api/ai-config/test-connection/', AIConfigView.as_view(), name='test_ai_connection'),
]
```

### Step 3.4: Test Endpoints

```bash
# Test GET /api/ai-options/
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/ai-options/

# Test PUT /api/ai-config/
curl -X PUT 
  -H "Authorization: Bearer $TOKEN" 
  -H "Content-Type: application/json"
  -d '{"ai_provider": "openai", "ai_model": "gpt-4o", "ai_api_key": "sk-test"}' 
  http://localhost:8000/api/ai-config/

# Test POST /api/ai-config/test-connection/
curl -X POST 
  -H "Authorization: Bearer $TOKEN" 
  -H "Content-Type: application/json"
  -d '{"ai_provider": "openai", "ai_model": "gpt-4o", "ai_api_key": "sk-test"}' 
  http://localhost:8000/api/ai-config/test-connection/
```

✅ **Phase 3 Complete**

---

## Phase 4: Frontend UI (Days 10-13)

### Step 4.1: Create AI Model Constants

**File**: `frontend/src/constants/aiModels.js`

```javascript
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

### Step 4.2: Update api/client.js

Add to `frontend/src/api/client.js`:

```javascript
export async function getAIOptions() {
  const response = await apiClient.get('/api/ai-options/');
  return response.data;
}

export async function updateAIConfig(config) {
  const response = await apiClient.put('/api/ai-config/', config);
  return response.data;
}

export async function testAIConnection(config) {
  const response = await apiClient.post('/api/ai-config/test-connection/', config);
  return response.data;
}
```

### Step 4.3: Create AIConfigForm Component

**File**: `frontend/src/components/AIConfigForm.jsx`

```jsx
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

  const availableModels = AVAILABLE_AI_MODELS[provider] || [];

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.find(m => m.id === model)) {
      setModel(availableModels[0].id);
    }
  }, [provider, availableModels, model]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await testAIConnection({
        ai_provider: provider,
        ai_model: model || undefined,
        ai_api_key: apiKey || undefined,
      });
      setTestResult(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
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
      setApiKey('');
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 p-6 rounded-lg border border-slate-700">
      <h3 className="text-lg font-bold text-cyan-300">🤖 AI Provider Configuration</h3>

      {/* Provider Dropdown */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          AI Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
        >
          <option value="openclaw">OpenClaw (VietnamData)</option>
          <option value="openai">OpenAI (GPT)</option>
          <option value="claude">Anthropic Claude</option>
          <option value="gemini">Google Gemini</option>
          <option value="copilot">Microsoft Copilot</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">
          Select yoru preferred AI provider for whale advisory analysis
        </p>
      </div>

      {/* Model Dropdown (Dynamic) */}
      {availableModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.cost})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Cost: Low = best bang for buck | High = best quality
          </p>
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
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 text-sm"
          >
            {showApiKey ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          🔒 Encrypted & never exposed. Leave blank to use system API key from environment.
        </p>
      </div>

      {/* Test Connection Button */}
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testingConnection || loading}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white rounded font-medium transition-colors"
      >
        {testingConnection ? 'Testing...' : '🔌 Test Connection'}
      </button>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-3 rounded border ${
            testResult.status === 'success'
              ? 'bg-green-900/30 border-green-600 text-green-300'
              : 'bg-red-900/30 border-red-600 text-red-300'
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
        <div className="p-3 rounded bg-red-900/30 border border-red-600 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || testingConnection}
        className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-500 text-white rounded font-medium transition-colors"
      >
        {loading ? 'Saving...' : '💾 Save Configuration'}
      </button>
    </form>
  );
}

export default AIConfigForm;
```

### Step 4.4: Integrate into AdminOps

Update `frontend/src/pages/AdminOps.jsx`:

```jsx
import AIConfigForm from '../components/AIConfigForm';

export default function AdminOps() {
  // ... existing code ...
  
  const handleAIConfigSaved = () => {
    // Refresh stats if needed
    // toast.success('AI configuration saved');
  };
  
  return (
    <div className="space-y-6 p-6">
      {/* ... existing panels ... */}
      
      {/* NEW: AI Configuration Section */}
      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <AIConfigForm onSaved={handleAIConfigSaved} />
      </section>
    </div>
  );
}
```

✅ **Phase 4 Complete**

---

## Phase 5: Update Tasks & Testing (Days 14-17)

### Step 5.1: Update generate_whale_advisory_task()

In `backend/portfolio/tasks.py`, update:

```python
@app.task(bind=True, max_retries=3, default_retry_delay=60)
def generate_whale_advisory_task(self, symbol: str, matched_value_vnd: float, side: str, threshold: float = 0) -> dict:
    """
    UPDATED: Generate whale advisory using AI service factory.
    Now respects user-configured provider instead of hardcoded OpenClaw.
    """
    from django.contrib.auth.models import User
    from portfolio.ai_service import AIServiceFactory
    from portfolio.models import WhaleAdvisory
    from portfolio.encryption_utils import APIKeyManager
    
    try:
        # Get admin user config (or use defaults)
        admin_user = User.objects.filter(is_staff=True).first()
        if not admin_user:
            logger.warning('No admin user found, using OpenClaw default')
            provider = 'openclaw'
            api_key = os.getenv('OPENCLAW_API_KEY', '')
            model = 'default'
        else:
            user_config = admin_user.user_config
            provider = user_config.ai_provider or 'openclaw'
            model = user_config.ai_model or None
            api_key = APIKeyManager.get_api_key(user_config, provider)
        
        # Create AI client
        ai_client = AIServiceFactory.create_client(provider, api_key, model)
        
        # Generate summary (Pro plan)
        summary, summary_meta = ai_client.generate_summary(
            symbol=symbol,
            side=side,
            value=matched_value_vnd,
            context=f'Whale alert threshold: {threshold}M VNĐ'
        )
        
        # Generate detail (Premium plan)
        detail, detail_meta = ai_client.generate_detail(
            symbol=symbol,
            side=side,
            value=matched_value_vnd,
            context=f'Whale alert threshold: {threshold}M VNĐ'
        )
        
        # Combine token stats
        total_prompt_tokens = (
            summary_meta.get('tokens', {}).get('prompt', 0) +
            detail_meta.get('tokens', {}).get('prompt', 0)
        )
        total_completion_tokens = (
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
            ai_provider=provider,  # Now reflects chosen provider!
            prompt_tokens=total_prompt_tokens,
            completion_tokens=total_completion_tokens,
        )
        
        # Push WebSocket update
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'whale_{symbol}',
                {
                    'type': 'whale_advisory_message',
                    'data': {
                        'id': advisory.id,
                        'symbol': symbol,
                        'side': side,
                        'ai_provider': provider,
                        'ai_model': model,
                    }
                }
            )
        except Exception as e:
            logger.warning(f'WebSocket push failed: {e}')
        
        return {
            'status': 'success',
            'advisory_id': advisory.id,
            'provider': provider,
            'model': model,
        }
    
    except Exception as exc:
        logger.error(f'generate_whale_advisory_task failed: {exc}')
        raise self.retry(exc=exc)
```

### Step 5.2: Run Tests

```bash
cd backend

# Unit tests
python manage.py test portfolio.tests.test_encryption
python manage.py test portfolio.tests.test_ai_service
python manage.py test portfolio.tests.test_ai_config_api

# Manual integration test
python manage.py shell
>>> from portfolio.ai_service import AIServiceFactory
>>> from portfolio.encryption_utils import APIKeyManager
>>> # Test OpenAI client
>>> client = AIServiceFactory.create_client('openai', 'sk-test-key', 'gpt-4o')
>>> # Test Claude client
>>> client = AIServiceFactory.create_client('claude', 'sk-test-key')
```

---

## ✅ Summary: What You've Built

| Phase | What | Duration | Status |
|-------|------|----------|--------|
| 1 | DB Migration + Encryption | 2-3 days | ✅ |
| 2 | AI Clients (OpenAI, Claude) | 3-4 days | ✅ |
| 3 | API Endpoints | 2-3 days | ✅ |
| 4 | Frontend UI + Integration | 3-4 days | ✅ |
| 5 | Task Update + Tests | 1-2 days | ✅ |
| **TOTAL** | **Multi-AI Support** | **~2 weeks** | **READY** |

---

## 🚀 Next Steps

1. **Create feature branch** and push changes
2. **Code review** with senior dev
3. **Deploy to staging** and test each provider
4. **Monitor production** for errors
5. **Document runbook** per provider setup

---

**Last Updated**: April 4, 2026  
**Version**: 2.0 - Ready to Implement  
Good luck, developer! 🎉
