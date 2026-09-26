"""R0.5 — validate `ai_model` theo `ai_provider`.

Bằng chứng gốc (runtime probe DB dev 2026-09-25): `effective_ai_context` có
`ai_provider=gemini` nhưng `ai_model=gpt-4o-mini`; orchestrator chọn endpoint
OpenAI-compat của Google rồi gửi tên model OpenAI → HTTP 404 →
`error_message="synthesis provider_status=404"`. Nguyên nhân gốc: PUT
`ai_model` không validate theo provider.
"""

from django.test import SimpleTestCase

from advisory.model_choices import (
    model_matches_provider,
    suggest_model_for_provider,
    validate_model_for_provider,
)


class ModelMatchesProviderTests(SimpleTestCase):

    def test_regression_gemini_provider_with_openai_model(self):
        """Case đã hỏng production: provider gemini + model OpenAI."""
        self.assertFalse(model_matches_provider('gemini', 'gpt-4o-mini'))

    def test_compatible_pairs(self):
        cases = [
            ('openai', 'gpt-4o'),
            ('openai', 'gpt-4o-mini'),
            ('openai', 'gpt-3.5-turbo'),
            ('openai', 'o3-mini'),
            ('gemini', 'gemini-2.5-flash'),
            ('gemini', 'gemini-3.8-flash'),
            ('gemini', 'gemini-pro'),
            ('claude', 'claude-sonnet-4'),
        ]
        for provider, model in cases:
            with self.subTest(provider=provider, model=model):
                self.assertTrue(model_matches_provider(provider, model))

    def test_incompatible_pairs(self):
        cases = [
            ('gemini', 'gpt-4o'),
            ('gemini', 'gpt-4o-mini'),
            ('openai', 'gemini-2.5-flash'),
            ('openai', 'gemini-pro'),
            ('claude', 'gpt-4o'),
        ]
        for provider, model in cases:
            with self.subTest(provider=provider, model=model):
                self.assertFalse(model_matches_provider(provider, model))

    def test_freedom_providers_accept_anything(self):
        for provider in ('local', 'openclaw', 'copilot'):
            with self.subTest(provider=provider):
                self.assertTrue(model_matches_provider(provider, 'llama3-70b'))
                self.assertTrue(model_matches_provider(provider, 'gpt-4o'))

    def test_empty_model_is_allowed(self):
        self.assertTrue(model_matches_provider('openai', ''))
        self.assertTrue(model_matches_provider('gemini', None))

    def test_custom_model_allowed(self):
        self.assertTrue(model_matches_provider('openai', 'custom'))


class ValidateModelForProviderTests(SimpleTestCase):

    def test_returns_error_message_in_vietnamese(self):
        is_valid, message = validate_model_for_provider('gemini', 'gpt-4o-mini')
        self.assertFalse(is_valid)
        self.assertIn('gpt-4o-mini', message)
        self.assertIn('gemini', message.lower())

    def test_valid_pair_has_no_message(self):
        is_valid, message = validate_model_for_provider('gemini', 'gemini-2.5-flash')
        self.assertTrue(is_valid)
        self.assertIsNone(message)

    def test_case_insensitive(self):
        self.assertTrue(validate_model_for_provider('GEMINI', 'GEMINI-2.5-FLASH')[0])
        self.assertFalse(validate_model_for_provider('Gemini', 'GPT-4O-MINI')[0])

    def test_suggest_model(self):
        self.assertEqual(suggest_model_for_provider('openai'), 'gpt-4o-mini')
        self.assertEqual(suggest_model_for_provider('gemini'), 'gemini-2.5-flash')
        self.assertEqual(suggest_model_for_provider('claude'), 'claude-sonnet-4')
        self.assertEqual(suggest_model_for_provider('local'), '')


class ModelChoicesListAlignsWithLiveProvidersTests(SimpleTestCase):
    """B1 — danh sách model gợi ý không được chứa model provider đã bỏ.

    Bằng chứng 2026-09-26: probe thật endpoint OpenAI-compat của Google trả 404
    cho các model dưới đây, nên chọn chúng nghĩa là chắc chắn hỏng.
    """

    #: model đã bị provider gỡ, tuyệt đối không đưa vào choices gợi ý
    DEAD_GEMINI_MODELS = (
        'gemini-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-3-pro',
        'gemini-3-flash',
    )

    def test_dead_models_absent_from_system_choices(self):
        from advisory.models import SystemAISettings
        offered = {value for value, _label in SystemAISettings.ModelChoices.choices}
        for dead in self.DEAD_GEMINI_MODELS:
            with self.subTest(model=dead):
                self.assertNotIn(dead, offered)

    def test_live_gemini_models_present(self):
        from advisory.models import SystemAISettings
        offered = {value for value, _label in SystemAISettings.ModelChoices.choices}
        for live in ('gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'):
            with self.subTest(model=live):
                self.assertIn(live, offered)

    def test_dead_models_absent_from_frontend_catalogue(self):
        """FE `providerModels.ts` phải khớp — nếu lệch, menu vẫn mời chọn model chết."""
        import re
        from pathlib import Path
        source = (Path(__file__).resolve().parents[3] / 'web' / 'src' / 'shared' / 'providerModels.ts')
        self.assertTrue(source.exists(), f'khong tim thay {source}')
        text = source.read_text(encoding='utf-8')
        gemini_block = text.split('gemini: [', 1)[1].split(']', 1)[0]
        for dead in self.DEAD_GEMINI_MODELS:
            with self.subTest(model=dead):
                self.assertNotIn(f'"{dead}"', gemini_block)

    def test_default_model_for_gemini_is_live(self):
        from advisory.model_choices import DEFAULT_MODEL_BY_PROVIDER
        self.assertNotIn(DEFAULT_MODEL_BY_PROVIDER['gemini'], self.DEAD_GEMINI_MODELS)
