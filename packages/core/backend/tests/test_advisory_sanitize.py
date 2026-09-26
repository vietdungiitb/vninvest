"""R0.7 — `sanitize_sensitive_fields` phải đệ quy vào list.

Bằng chứng gốc: `serializers.py:sanitize_sensitive_fields` chỉ có nhánh
`isinstance(value, dict)`, nên một list các dict chứa `api_key` là đường lọt
secret rõ ràng.
"""

from django.test import SimpleTestCase

from advisory.serializers import _sanitize_list, sanitize_sensitive_fields

# 24 ký tự để khớp regex `(sk-proj-|...)[A-Za-z0-9_-]{20,}` và cả nhánh
# mask theo tên key (`api_key` -> 8 ký tự đầu + 8 ký tự cuối).
FAKE_KEY = 'sk-proj-AAAABBBBCCCCDDDDEEEEFFFF'
#: ký tự mask thật của production code (U+2022 BULLET x8)
MASKED_TOKEN = '•' * 8


class SanitizeListTests(SimpleTestCase):

    def test_secret_inside_list_of_dicts_is_masked(self):
        payload = {'components': [{'api_key': FAKE_KEY}]}
        result = sanitize_sensitive_fields(payload)
        value = result['components'][0]['api_key']
        self.assertNotIn('AAAABBBBCCCCDDDDEEEEFFFF', value)
        self.assertTrue(MASKED_TOKEN in value)

    def test_secret_pattern_in_plain_list_string_is_masked(self):
        payload = {'notes': [f'token here {FAKE_KEY} tail']}
        result = sanitize_sensitive_fields(payload)
        self.assertNotIn('AAAABBBBCCCCDDDDEEEEFFFF', result['notes'][0])

    def test_nested_list_of_list(self):
        payload = {'matrix': [[{'api_key': FAKE_KEY}]]}
        result = sanitize_sensitive_fields(payload)
        value = result['matrix'][0][0]['api_key']
        self.assertNotIn('AAAABBBBCCCCDDDDEEEEFFFF', value)

    def test_non_secret_values_untouched(self):
        payload = {'components': [{'component_type': 'technical', 'content': 'RSI quá mua'}]}
        result = sanitize_sensitive_fields(payload)
        self.assertEqual(result['components'][0]['component_type'], 'technical')
        self.assertEqual(result['components'][0]['content'], 'RSI quá mua')

    def test_non_string_scalar_in_list_untouched(self):
        payload = {'values': [1, 2.5, True, None]}
        self.assertEqual(sanitize_sensitive_fields(payload)['values'], [1, 2.5, True, None])

    def test_dict_branch_still_works(self):
        payload = {'nested': {'inner': {'api_key': FAKE_KEY}}}
        result = sanitize_sensitive_fields(payload)
        self.assertNotIn('AAAABBBBCCCCDDDDEEEEFFFF', result['nested']['inner']['api_key'])

    def test_masked_value_length_bounded(self):
        # `_mask_sensitive_value`: <=8 -> 8 mask; >12 -> 8 + 8 mask + 4 = 20
        self.assertEqual(len(_mask(_short())), 8)
        self.assertEqual(len(_mask('a' * 40)), 20)


def _short():
    return 'shortkey'


def _mask(value):
    return sanitize_sensitive_fields({'api_key': value})['api_key']
