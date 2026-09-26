"""3 lỗi phát hiện trong lúc review lại code đã ship — test chặn tái phát.

Cả 3 đều là lỗi THẬT trong `advisory/signal_norm.py` + `orchestrator.py` đã
merge. Không test nào bắt được vì lý do khác nhau:

1. `NameError` trong `orchestrator.run_async` — test N2 của tôi patch hẳn
   `run_async` đi nên vòng code hỏng không bao giờ chạy; E2E container thì
   synthesis fail (hết hạn mức) TRƯỚC khi tới câu return. Không tầng nào
   chạm tới đường đi thật.

2. `"DON'T BUY"` → BUY — `_NON_ASCII_RE` thay MỌI ký tự ngoài `[A-Z ]` bằng
   space, nên `DON'T` thành `DON T` và entry `'DONT'` **không bao giờ** khớp.
   Cùng loại với bug `KHÔNG MUA → BUY` mà W0 định sửa — tôi bỏ sót case
   tiếng Anh có dấu nháy.

3. `TRUNG LẬP` → UNKNOWN — orchestrator tự phát chuỗi này ở mock branch nhưng
   SSOT không có nó trong `FLAT_TOKENS`, nên tín hiệu trung lập hợp lệ bị
   fail-closed thành FAILED.
"""

from django.test import SimpleTestCase

from advisory.signal_norm import SIGNAL_UNKNOWN, normalize_signal, tokenize

AP = chr(39)  # dấu nháy đơn, tránh lỗi quoting khi test chạy


class ApostropheNegationTests(SimpleTestCase):
    """Lỗi 2 — `DON'T BUY` không được thành BUY."""

    def test_dont_buy_is_unknown(self):
        self.assertEqual(normalize_signal('DON' + AP + 'T BUY'), SIGNAL_UNKNOWN)

    def test_dont_sell_is_unknown(self):
        self.assertEqual(normalize_signal('DON' + AP + 'T SELL'), SIGNAL_UNKNOWN)

    def test_apostrophe_removed_not_split(self):
        # `DON'T` phải thành MỘT token `DONT`, không phải hai token `DON` + `T`.
        # Nếu tách thì entry `'DONT'` trong NEGATION_TOKENS không bao giờ khớp.
        self.assertEqual(tokenize('DON' + AP + 'T BUY'), ['DONT', 'BUY'])

    def test_curly_apostrophe_also_handled(self):
        self.assertEqual(normalize_signal('DON’T BUY'), SIGNAL_UNKNOWN)


class MultiTokenNegationTests(SimpleTestCase):
    """Lỗi 2 (tiếp) — phủ định nhiều từ không bị bỏ sót."""

    def test_do_not_buy_is_unknown(self):
        self.assertEqual(normalize_signal('DO NOT BUY'), SIGNAL_UNKNOWN)

    def test_khong_nen_mua_is_unknown(self):
        self.assertEqual(normalize_signal('KHONG NEN MUA'), SIGNAL_UNKNOWN)

    def test_never_and_skip_are_negations(self):
        for raw in ('NEVER BUY', 'SKIP BUYING', 'TUYET DOI KHONG MUA'):
            self.assertEqual(normalize_signal(raw), SIGNAL_UNKNOWN, raw)


class NeutralTokenTests(SimpleTestCase):
    """Lỗi 3 — tín hiệu trung lập phải ra HOLD, không phải UNKNOWN."""

    def test_trung_lap_is_hold(self):
        # Chuỗi này chính mock branch của orchestrator phát ra.
        self.assertEqual(normalize_signal('TRUNG LẬP'), 'HOLD')

    def test_sideways_is_hold(self):
        self.assertEqual(normalize_signal('SIDEWAYS'), 'HOLD')

    def test_english_neutral_still_hold(self):
        # Nhánh tiếng Anh luôn chạy được vì 'NEUTRAL' đã có sẵn.
        self.assertEqual(normalize_signal('NEUTRAL'), 'HOLD')

    def test_mua_ban_trung_lap_contradiction_stays_unknown(self):
        # Mở rộng FLAT_TOKENS không được biến mâu thuẫn thành HOLD.
        self.assertEqual(normalize_signal('MUA BAN TRUNG LAP'), SIGNAL_UNKNOWN)
