import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import TestCase, override_settings
from identity_access.security import encrypt_user_api_key, decrypt_user_api_key

class BYOKSecurityTests(TestCase):
    def test_encrypt_and_decrypt_returns_original_plaintext(self):
        plain_key = "gsk_vninvest_api_key_extremely_secret_12345"
        
        # 1. Thực hiện mã hóa
        encrypted = encrypt_user_api_key(plain_key)
        self.assertNotEqual(plain_key, encrypted)
        
        # 2. Thực hiện giải mã
        decrypted = decrypt_user_api_key(encrypted)
        self.assertEqual(plain_key, decrypted)
        
    def test_encrypt_empty_raises_value_error(self):
        with self.assertRaises(ValueError):
            encrypt_user_api_key("")
            
    def test_decrypt_empty_returns_empty_string(self):
        self.assertEqual(decrypt_user_api_key(""), "")
        
    def test_decrypt_invalid_token_raises_runtime_error(self):
        with self.assertRaises(RuntimeError):
            decrypt_user_api_key("invalid_fernet_token_garbage_data")

    def test_decrypt_with_different_key_raises_runtime_error(self):
        plain_key = "secret_key_to_be_encrypted"
        # 1. Mã hóa bằng key gốc
        encrypted = encrypt_user_api_key(plain_key)
        
        # 2. Thay đổi SECRET_KEY bằng override_settings phục vụ kiểm thử rotation
        with override_settings(SECRET_KEY="different_fallback_key_for_testing_purposes"):
            # 3. Giải mã bằng key mới -> phải ném lỗi
            with self.assertRaises(RuntimeError):
                decrypt_user_api_key(encrypted)
