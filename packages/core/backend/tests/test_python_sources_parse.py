"""Mọi file `.py` trong `src/` phải parse được.

Vì sao cần
----------
`signal_intelligence/outbound_notification_service.py` sống sót với
`"Authorization": fcode"key={fcm_api_key}"` — sai lệch từ 2026-05-28 (`edda0182`).

Python parse **toàn bộ module** lúc import, nên một dòng sai làm chết **cả file**,
kể cả `send_email` vốn chạy tốt. Nó sống sót 4 tháng vì **không module nào
import nó**: nên `manage.py check` vẫn PASS, và cả full suite 2746 test vẫn xanh.

Đó chính là khoảng trống mà test này lấp: một file hỏng mà không ai import thì
chỉ lộ ra khi ai đó định dùng nó — lúc đó app không boot được. Test này bắt được
ngay lúc viết, không cần ai import.

Không dùng `compileall` vì nó dừng ở lỗi đầu tiên; ở đây ta **liệt kê hết**
lỗi trong một lần chạy.
"""

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SRC = BACKEND / 'src'

#: Ngưỡng tối thiểu. Nếu glob hỏng và tìm được 0 file, test phải ĐỎ chứ không
#: được xanh — một test "parse 0 file" là test vô dụng.
MIN_FILE_COUNT = 500


class PythonSourcesParseTests(unittest.TestCase):
    def _py_files(self):
        return sorted(SRC.rglob('*.py'))

    def test_all_sources_parse(self):
        files = self._py_files()
        self.assertGreaterEqual(
            len(files), MIN_FILE_COUNT,
            f'chỉ tìm thấy {len(files)} file .py trong {SRC} — glob có thể hỏng, '
            f'khiến test pass vô nghĩa',
        )

        broken = []
        for path in files:
            try:
                source = path.read_text(encoding='utf-8')
            except UnicodeDecodeError as exc:
                broken.append(f'{path}: KHÔNG đọc được bằng utf-8 ({exc})')
                continue
            try:
                ast.parse(source, filename=str(path))
            except SyntaxError as exc:
                rel = path.relative_to(SRC).as_posix()
                broken.append(f'{rel}:{exc.lineno}: {exc.msg}')

        self.assertEqual(
            broken, [],
            'Các file sau KHÔNG parse được — mỗi file hỏng là một quả bom '
            'hẹn giờ cho module định import nó:\n  ' + '\n  '.join(broken),
        )

    def test_known_broken_file_is_now_fixed(self):
        """Khoá đúng cái bug từng sống sót, để nó không quay lại âm thầm."""
        path = SRC / 'signal_intelligence' / 'outbound_notification_service.py'
        self.assertTrue(path.is_file(), f'{path} không còn tồn tại')
        ast.parse(path.read_text(encoding='utf-8'), filename=str(path))


if __name__ == '__main__':
    unittest.main()
