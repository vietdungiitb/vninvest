import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)

def _get_fernet_key() -> bytes:
    """Trả về khóa Fernet từ biến môi trường hoặc băm url-safe base64 từ SECRET_KEY."""
    # Ưu tiên cấu hình khóa thông qua biến môi trường để đảm bảo an toàn vận hành
    key = os.environ.get('AI_CREDENTIAL_FERNET_KEY', '').strip()
    if key:
        return key.encode() if isinstance(key, str) else key
        
    # Dự phòng url-safe base64 key 32-bytes sinh tự động từ SECRET_KEY hệ thống
    h = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(h)

def encrypt_user_api_key(plain_key: str) -> str:
    """Mã hóa khóa người dùng bằng chuẩn Fernet trước khi lưu vào preferences JSON."""
    if not plain_key:
        raise ValueError('Khóa API người dùng không được để trống khi thực hiện mã hóa.')
        
    key = _get_fernet_key()
    fernet = Fernet(key)
    encrypted_bytes = fernet.encrypt(plain_key.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_user_api_key(encrypted_key: str) -> str:
    """Giải mã an toàn API Key phục vụ cho cuộc gọi LLM ở AdvisoryOrchestrator.
    
    Không nuốt lỗi ngầm (silent swallow) để dễ dàng phục vụ kiểm toán bảo mật.
    """
    if not encrypted_key:
        return ""
        
    key = _get_fernet_key()
    fernet = Fernet(key)
    try:
        decrypted_bytes = fernet.decrypt(encrypted_key.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except InvalidToken as e:
        logger.error("Giải mã API Key thất bại: Khóa giải mã hoặc chữ ký Fernet không hợp lệ.")
        raise RuntimeError("Khóa giải mã bảo mật không trùng khớp hoặc dữ liệu khóa đã bị sửa đổi.") from e
    except Exception as e:
        logger.error(f"Lỗi giải mã khóa hệ thống ngoài dự kiến: {str(e)}")
        raise RuntimeError(f"Lỗi bảo mật khi xử lý giải mã khóa: {str(e)}") from e
