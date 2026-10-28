import os

from cryptography.fernet import Fernet


def get_crypto_cipher() -> Fernet:
    # Lấy key riêng biệt cho email từ biến môi trường
    key = os.environ.get('MAIL_CREDENTIAL_FERNET_KEY', '').strip()
    if not key:
        # Nếu đang chạy local/dev test và key trống, có thể sinh tạm key để không làm crash dev environment.
        # Nhưng ở production, bắt buộc phải nâng lỗi.
        from django.conf import settings
        if getattr(settings, 'DEBUG', False):
            # Sinh tạm một key ổn định từ SECRET_KEY trong DEBUG mode
            import base64
            import hashlib
            secret = (getattr(settings, 'SECRET_KEY', '') + ':mail-default-key-dev').encode('utf-8')
            key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest()).decode('utf-8')
        else:
            raise RuntimeError("THIẾT LẬP THIẾU: MAIL_CREDENTIAL_FERNET_KEY bắt buộc phải được khai báo đúng định dạng AES-256 Fernet.")
    
    # Đảm bảo key hợp lệ (chuẩn 32-bytes base64 key)
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        raise RuntimeError(f"MAIL_CREDENTIAL_FERNET_KEY không hợp lệ: {e!s}")

def encrypt_secret(plaintext: str) -> bytes:
    if not plaintext:
        return b''
    return get_crypto_cipher().encrypt(plaintext.encode('utf-8'))

def decrypt_secret(ciphertext: bytes) -> str:
    if not ciphertext:
        return ""
    try:
        # Hỗ trợ cả string và bytes đầu vào
        cipher_bytes = ciphertext.encode('utf-8') if isinstance(ciphertext, str) else bytes(ciphertext)
        return get_crypto_cipher().decrypt(cipher_bytes).decode('utf-8')
    except Exception:
        # Tránh crash luồng khi decrypt lỗi
        return ""
