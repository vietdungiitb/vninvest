"""SSOT chuẩn hoá `signal` của AI advisory.

Đây là nguồn duy nhất được phép quyết định một khuyến nghị là BUY / SELL /
HOLD / UNKNOWN. Orchestrator, Celery task, API view, backtest và contract
test đều phải gọi `normalize_signal` — không được tự parse text.

Nguyên tắc fail-closed: mọi trường hợp không chắc chắn đều trả `UNKNOWN`
thay vì đoán theo chiều có lợi cho giao dịch.
"""

import re
import unicodedata

SCHEMA_VERSION = 2

SIGNAL_BUY = 'BUY'
SIGNAL_SELL = 'SELL'
SIGNAL_HOLD = 'HOLD'
SIGNAL_UNKNOWN = 'UNKNOWN'

SIGNAL_CHOICES = (SIGNAL_BUY, SIGNAL_SELL, SIGNAL_HOLD, SIGNAL_UNKNOWN)

SIGNAL_TO_SIDE = {
    SIGNAL_BUY: 'BUY',
    SIGNAL_SELL: 'SELL',
    SIGNAL_HOLD: 'HOLD',
}

SIDE_TO_SIGNAL = {
    'BUY': SIGNAL_BUY,
    'SELL': SIGNAL_SELL,
    'HOLD': SIGNAL_HOLD,
}

# Token dương, đã chuẩn hoá không dấu.
# "MUA LUC" khớp cả "MUA LÚC" lẫn "mua lắc".
BUY_TOKENS = frozenset({
    'BUY', 'MUA', 'TANG', 'TICH LUC', 'KHUYEN NGHI MUA',
    'NEN MUA', 'DU KIEN MUA',
})

SELL_TOKENS = frozenset({
    'SELL', 'BAN', 'GIAM', 'CHOT LOI', 'HUY', 'THOAT',
    'NEN BAN', 'DU KIEN BAN', 'CHOT LAI',
})

FLAT_TOKENS = frozenset({
    'HOLD', 'WATCH', 'NEUTRAL', 'GIU', 'THEO DOI', 'GAM', 'DONG',
    'KHONG GIAO DICH', 'DUU TINH', 'CHUA CO',
})

# Phủ định tuyệt đối. Phải kiểm TRƯỚC khi so khớp token dương vì
# "KHÔNG MUA" chứa cả "KHONG" lẫn "MUA".
# Lưu ý: "NEN" không nằm ở đây vì "NÊN MUA" là khuyến nghị dương hợp lệ.
NEGATION_TOKENS = frozenset({
    'KHONG', 'KHONG NEN', 'DUNG', 'CHUA', 'TUONG DOI', 'TRANH', 'TUYEN', 'CHAP',
    'NOT', 'NO', 'AVOID', 'DONT', 'SHOULDNT', 'WITHHOLD',
})

_WORD_SPLIT_RE = re.compile(r'[\s,.;:()\[\]/\-–—+*&%!?"\'`]+')
_NON_ASCII_RE = re.compile(r'[^A-Z ]')

# Trên số token này coi như prose mô tả chứ không phải khuyến nghị.
MAX_TOKENS = 4


def strip_accents(value: str) -> str:
    """Chuẩn hoá Unicode rồi bỏ dấu thanh/dấu phụ.

    `re.sub(r'[^A-Z ]', ' ', s.upper())` làm mất dấu tiếng Việt một cách âm
    thầm: ký tự có dấu không thuộc `[A-Z]` nên bị xoá trước khi ta kịp so
    khớp. Phải decompose về Latin base trước, rồi mới lọc ký tự lạ.
    """
    decomposed = unicodedata.normalize('NFD', value)
    without_marks = ''.join(
        char for char in decomposed
        if unicodedata.category(char) != 'Mn'
    )
    return _NON_ASCII_RE.sub(' ', without_marks)


def tokenize(value) -> list:
    """Tách chuỗi thành token đã chuẩn hoá không dấu, viết hoa."""
    if not isinstance(value, str):
        return []
    normalized = strip_accents(value.upper())
    return [token for token in _WORD_SPLIT_RE.split(normalized) if token]


def _has_negation(tokens) -> bool:
    return any(token in NEGATION_TOKENS for token in tokens)


def normalize_signal(raw) -> str:
    """Chuẩn hoá khuyến nghị thành BUY / SELL / HOLD / UNKNOWN.

    - ``None`` / rỗng / không phải chuỗi -> ``UNKNOWN``
    - Trên ``MAX_TOKENS`` token -> ``UNKNOWN`` (prose, không phải tín hiệu)
    - Có token phủ định -> ``UNKNOWN`` (chặn "KHÔNG MUA" -> BUY)
    - Vừa khớp BUY vừa khớp SELL -> ``UNKNOWN`` (mâu thuẫn)
    - Chỉ khớp token phẳng -> ``HOLD``
    """
    if not isinstance(raw, str) or not raw.strip():
        return SIGNAL_UNKNOWN

    tokens = tokenize(raw)
    if not tokens:
        return SIGNAL_UNKNOWN
    if len(tokens) > MAX_TOKENS:
        return SIGNAL_UNKNOWN

    if _has_negation(tokens):
        return SIGNAL_UNKNOWN

    joined = ' '.join(tokens)
    buy = any(token in BUY_TOKENS for token in tokens) or joined in BUY_TOKENS
    sell = any(token in SELL_TOKENS for token in tokens) or joined in SELL_TOKENS

    if buy and sell:
        return SIGNAL_UNKNOWN
    if buy:
        return SIGNAL_BUY
    if sell:
        return SIGNAL_SELL
    if any(token in FLAT_TOKENS for token in tokens) or joined in FLAT_TOKENS:
        return SIGNAL_HOLD
    return SIGNAL_UNKNOWN


def normalize_confidence(raw):
    """Chuẩn hoá confidence về ``[0, 1]`` hoặc ``None``.

    Không tự bịa giá trị: input thiếu / sai kiểu / ngoài khoảng -> ``None``.
    """
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, str):
        try:
            raw = float(raw.strip().replace(',', '.'))
        except (ValueError, TypeError):
            return None
    if not isinstance(raw, (int, float)):
        return None
    value = float(raw)
    if value != value:  # NaN
        return None
    if value < 0.0 or value > 1.0:
        return None
    return round(value, 4)


def signal_to_side(signal):
    """Map signal sang side dùng cho UI / đặt lệnh. UNKNOWN -> ``UNKNOWN``."""
    key = str(signal or '').strip().upper()
    return SIGNAL_TO_SIDE.get(key, SIGNAL_UNKNOWN)


def normalize_risk_level(raw):
    """Chuẩn hoá risk_level về low/medium/high, không đoán."""
    key = str(raw or '').strip().lower()
    if key in ('low', 'medium', 'high'):
        return key
    return 'unknown'
