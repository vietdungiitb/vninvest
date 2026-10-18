import os
import base64
import hashlib
import logging
from datetime import datetime, timezone as dt_timezone
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)

#: Số phiên bản khoá tối đa mà env có thể khai báo (`..._V1` .. `..._V8`).
#: Giới hạn cứng để một biến rác (`AI_CREDENTIAL_FERNET_KEY_V99`) không bị quét
#: vô tận, và để con số này **không phải** thứ tự ưu tiên — thứ tự do
#: `AI_CREDENTIAL_FERNET_KEY_ACTIVE` quyết định.
MAX_FERNET_KEY_VERSIONS = 8

#: Mã lỗi ghi kèm log, để vận hành lọc được (grep theo mã, không theo câu chữ).
CODE_KEY_FALLBACK = 'fernet_key_version_fallback'
CODE_KEY_EXPIRED = 'fernet_key_grace_expired'
CODE_KEY_MISSING = 'fernet_key_version_missing'
CODE_NO_KEY = 'fernet_key_not_configured'


def _env(name: str) -> str:
    return (os.environ.get(name) or '').strip()


def _parse_moment(raw: str):
    """ISO-8601 → datetime có tz. Trả `None` khi rỗng/không đọc được.

    Không ném lỗi: một `GRACE_UNTIL` sai định dạng **không được** biến thành
    "grace vô hạn" (đọc sai hướng, tức lỏng quá) cũng không thành "chặn ngay"
    (lỏng bị quá). Sai định dạng ⇒ `None` + log, và quy tắc bên dưới quyết định.
    """
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except ValueError:
        logger.warning('%s: khong doc duoc ISO-8601, bo qua.', CODE_KEY_EXPIRED)
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=dt_timezone.utc)
    return parsed


def _synthetic_key() -> bytes:
    """Khoá dự phòng băm từ `SECRET_KEY` — giữ hành vi **cũ** của hệ thống.

    Đây là đường **không được bỏ**: `AI_CREDENTIAL_FERNET_KEY` không phải mọi môi
    trường đều có, và trước R4.2 hệ thống rơi về đúng đường này. Nếu biến nó thành
    lỗi, mọi môi trường thiếu env sẽ **không lưu được khoá API** ngay lúc deploy.

    Nó có tên riêng `v0` để lúc nào có key thật mà dữ liệu cũ vẫn còn mã hoá bằng
    `v0`, vận hành nhìn `key_ring_status()` là thấy ngay — thay vì âm thầm gọi nó là
    "V1" rồi cứ nghĩ dữ liệu cũ hỏng.
    """
    h = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(h)


def _fernet_key_ring():
    """Trả về `[(version, key_bytes), ...]` — thứ tự **ưu tiên giải mã**.

    Cấu hình:
      - `AI_CREDENTIAL_FERNET_KEY` — biến **cũ**, tương đương `..._V1`. Giữ tên
        này là bắt buộc: xoá nó là mất khoá BYOK của toàn bộ user ngay lần deploy
        đầu tiên.
      - `AI_CREDENTIAL_FERNET_KEY_V1..V8` — các phiên bản có thể tồn tại song song.
      - `AI_CREDENTIAL_FERNET_KEY_ACTIVE` — version dùng để **mã hoá**; mặc định
        version **thấp nhất** đang có, để hành vi của hệ thống cũ (chỉ 1 key)
        không đổi khi thêm biến mới.
      - `v0` — khoá tổng hợp băm từ `SECRET_KEY`, chỉ dùng khi env **không** có key.

    Danh sách trả về: khoá active **trước**, rồi các khoá còn trong grace, cuối
    cùng là các khoá đã quá hạn (xem `decrypt_user_api_key` — quá hạn thì bị
    chặn, không phải thử).
    """
    ring: list[tuple[str, bytes]] = []
    legacy = _env('AI_CREDENTIAL_FERNET_KEY')
    if legacy:
        ring.append(('v1', legacy.encode()))
    for index in range(1, MAX_FERNET_KEY_VERSIONS + 1):
        value = _env(f'AI_CREDENTIAL_FERNET_KEY_V{index}')
        if value:
            ring.append((f'v{index}', value.encode()))
    if not ring:
        ring.append(('v0', _synthetic_key()))

    # Trùng version (legacy V1 + _V1 cùng tồn tại) ⇒ giữ **dòng đầu** (legacy),
    # để hành vi không đổi so với trước R4.2.
    deduped: list[tuple[str, bytes]] = []
    seen: set[str] = set()
    for version, key in ring:
        if version in seen:
            continue
        seen.add(version)
        deduped.append((version, key))
    return deduped


def _active_version(ring) -> str:
    requested = _env('AI_CREDENTIAL_FERNET_KEY_ACTIVE').lower()
    if requested:
        requested = requested if requested.startswith('v') else f'v{requested}'
        if any(version == requested for version, _key in ring):
            return requested
        logger.warning('%s: ACTIVE=%s khong ton tai, dung version thap nhat.', CODE_KEY_MISSING, requested)
    return ring[0][0] if ring else ''


def _grace_until():
    return _parse_moment(_env('AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL'))


def _grace_open() -> bool:
    """Grace còn mở hay không. **Không cấu hình grace = luôn mở** (mặc định an toàn
    cho dữ liệu cũ); cấu hình grace thì tới mốc là đóng, kể cả khi mốc đã qua."""
    grace = _grace_until()
    if grace is None:
        return True
    return datetime.now(dt_timezone.utc) < grace


def key_ring_status() -> dict:
    """Tóm tắt cấu hình key ring — dùng cho vận hành. **Không** chứa key."""
    ring = _fernet_key_ring()
    active = _active_version(ring) if ring else ''
    grace = _grace_until()
    return {
        'versions': [version for version, _key in ring],
        'active_version': active,
        'grace_until': grace.isoformat() if grace else None,
        'grace_open': _grace_open(),
    }


def _single_key() -> bytes:
    """Khoá dùng để mã hoá (tương đương hành vi cũ, nay có version)."""
    ring = _fernet_key_ring()
    active = _active_version(ring)
    return dict(ring)[active]


def _get_fernet_key() -> bytes:
    """Khoá Fernet **đang dùng để mã hoá** (giữ tên hàm cũ cho người gọi cũ).

    R4.2 đổi bên trong (biết version), nhưng **giữ nguyên chữ ký** để không phải
    sửa 6 call site chỉ vì đổi tên hàm.
    """
    return _single_key()


def encrypt_user_api_key(plain_key: str) -> str:
    """Mã hóa khóa người dùng bằng chuẵn Fernet trước khi lưu vào preferences JSON.

    R4.2: bản mã **có tiền tố `vN:`** nói rõ nó mã hoá bằng version nào. Fernet
    token là opaque nên không có cách nào khác để biết; tiền tố nằm trong **cột
    cũ** nên thêm version mới **không cần migration DB** (AC3). Bản mã cũ
    (không tiền tố) vẫn giải mã được qua `decrypt_user_api_key`.
    """
    if not plain_key:
        raise ValueError('Khóa API người dùng không được để trống khi thực hiện mã hóa.')

    ring = _fernet_key_ring()
    active = _active_version(ring)
    key = dict(ring)[active]
    fernet = Fernet(key)
    encrypted_bytes = fernet.encrypt(plain_key.encode('utf-8'))
    return f'{active}:{encrypted_bytes.decode("utf-8")}'


def _split_versioned(encrypted_key: str):
    """Tách `vN:token` ⇒ `(version, token)`; không có tiền tố ⇒ `(None, token)`."""
    raw = encrypted_key or ''
    if ':' in raw[:4]:
        head, _sep, tail = raw.partition(':')
        candidate = head.strip().lower()
        if candidate.startswith('v') and candidate[1:].isdigit():
            return candidate, tail
    return None, raw


def decrypt_user_api_key(encrypted_key: str) -> str:
    """Giải mã an toàn API Key phục vụ cho cuộc gọi LLM ở AdvisoryOrchestrator.

    R4.2 thêm **key ring**: thử khoá `active` trước, rồi tới các khoá còn trong
    `AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL`. Quá hạn ⇒ **fail-closed** (không thử
    nữa) chứ không âm thầm dùng khoá cũ — giữ hành vi cũ trong khi trông như đã
    xoay khoá là cách "xoay khoá" nguy hiểm nhất.

    Không nuốt lỗi ngầm (silent swallow) để dễ dàng phục vụ kiểm toán bảo mật.
    """
    if not encrypted_key:
        return ""

    ring = _fernet_key_ring()
    if not ring:
        raise RuntimeError(
            f'{CODE_NO_KEY}: khong co key Fernet nao duoc cau hinh, khong giai ma duoc.'
        )
    active = _active_version(ring)
    versioned, token = _split_versioned(encrypted_key)

    if versioned:
        # Có tiền tố ⇒ chỉ thử **đúng** version đó. Mò key khác sẽ cho cảm giác
        # "vẫn chạy được" trong khi dữ liệu đã hỏng.
        match = next((k for v, k in ring if v == versioned), None)
        if match is None:
            logger.error('%s: khong tim thay %s trong key ring.', CODE_KEY_MISSING, versioned)
            raise RuntimeError(f'{CODE_KEY_MISSING}: khong co khoa {versioned}.')
        if versioned != active and not _grace_open():
            logger.error('%s: du lieu van ma hoa bang %s sau moc grace.', CODE_KEY_EXPIRED, versioned)
            raise RuntimeError(f'{CODE_KEY_EXPIRED}: khoa {versioned} da qua han xoay.')
        try:
            plain = Fernet(match).decrypt(token.encode('utf-8')).decode('utf-8')
        except InvalidToken as e:
            logger.error('%s: %s khong giai ma duoc.', CODE_KEY_MISSING, versioned)
            raise RuntimeError(f'{CODE_KEY_MISSING}: khoa {versioned} khong khop du lieu.') from e
        if versioned != active:
            logger.warning(
                '%s: du lieu duoc ma hoa bang %s trong khi key dang hoat dong la %s.',
                CODE_KEY_FALLBACK, versioned, active,
            )
        return plain

    # Bản mã legacy (không tiền tố) = mã hoá bằng khoá duy nhất thời đó (V1).
    candidates = [(v, k) for v, k in ring if v == active] + [
        (v, k) for v, k in ring if v != active and _grace_open()
    ]
    for version, key in candidates:
        try:
            plain = Fernet(key).decrypt(token.encode('utf-8')).decode('utf-8')
        except InvalidToken:
            continue
        except Exception as e:  # noqa: BLE001 - lỗi không dự kiến thì báo, không im
            logger.error(f'Lỗi giải mã khóa hệ thống ngoài dự kiến: {str(e)}')
            raise RuntimeError(f'Lỗi bảo mật khi xử lý giải mã khóa: {str(e)}') from e
        if version != active:
            logger.warning(
                '%s: du lieu cu ma hoa bang %s, dang dung %s de giai ma (active=%s).',
                CODE_KEY_FALLBACK, 'khoa cu', version, active,
            )
        return plain

    logger.error('%s: khong khoa nao giai ma duoc du lieu legacy.', CODE_KEY_MISSING)
    raise RuntimeError(f'{CODE_KEY_MISSING}: khoa giai ma khong trung khop du lieu.')