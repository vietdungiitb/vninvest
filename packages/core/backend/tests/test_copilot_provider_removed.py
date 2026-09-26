"""Gỡ provider `copilot` — test chặn nó quay lại.

Vì sao cần test: `copilot` là provider DUY NHẤT không có transport thật trong
toàn bộ codebase. `git grep` `copilot_internal` / `api.githubcopilot` trong
`packages/core/backend/src` và `packages/web/src` trả **0 file**, còn
`advisory/orchestrator.py` chỉ có 3 nhánh endpoint:

    local  -> Ollama
    gemini -> Google
    else   -> https://api.openai.com   <-- 'copilot' rơi vào đây

Nên nó không hỏng ngay lập tức mà chỉ **âm thầm gửi sai chỗ** → 401. Không có
test nào bắt được điều đó, vì test cũ chỉ mock trả kết quả thành công.

Bằng chứng gỡ (probe thật 2026-09-26, xem docstring migration 0012):
- key là GitHub PAT classic, `GET /user` → 200, scope `copilot` CÓ
- `GET .../copilot_internal/v2/token` → 404 "Not Found", thử cả `token` và
  `Bearer` ⇒ endpoint nội bộ không nhận PAT (404 chứ không 403 nên dễ chẩn
  đoán nhầm là key hỏng)
"""

import re
from pathlib import Path

from django.test import SimpleTestCase

REPO_SRC = Path(__file__).resolve().parents[1] / 'src'
WEB_SRC = Path(__file__).resolve().parents[3] / 'web' / 'src'
#: Gốc repo để in đường dẫn ngắn gọn. Dùng `relative_to` trực tiếp với
#: `REPO_SRC` sẽ VỠ khi file nằm ở `packages/web` vì nó không nằm dưới
#: `packages/core` — khi đó test crash bằng ValueError thay vì báo sai lệch,
#: tức guard trở nên vô dụng. Phải cắt theo chuỗi, không dùng relative_to.
REPO_ROOT = Path(__file__).resolve().parents[3]


def _short(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


class CopilotProviderRemovedTests(SimpleTestCase):
    def test_provider_choices_no_longer_offer_copilot(self):
        from advisory.models import UserAICredential

        keys = [c[0] for c in UserAICredential.ProviderChoices.choices]
        self.assertNotIn('copilot', keys, 'Copilot da duoc bo khoi ProviderChoices')
        # 5 provider con lai phai con nguyen.
        for keep in ('openai', 'gemini', 'claude', 'local', 'openclaw'):
            self.assertIn(keep, keys)

    def test_copilot_is_not_a_freeform_provider(self):
        from advisory.model_choices import FREEFORM_PROVIDERS

        self.assertNotIn(
            'copilot', FREEFORM_PROVIDERS,
            'copilot phai duoc goi khoi FREEFORM_PROVIDERS',
        )

    def test_copilot_not_in_provider_labels(self):
        from advisory.model_choices import PROVIDER_LABELS

        self.assertNotIn('copilot', PROVIDER_LABELS)

    def test_no_source_file_references_copilot_as_a_live_provider(self):
        """Chặn tái phát: không file source nào được nhắc tới `copilot` nữa.

        Quét toàn bộ source BE + FE, bỏ qua `migrations/` vì migration LỊCH SỬ
        (0003/0004) là bản ghi bất biến, không được sửa — 0004 vẫn map
        `copilot` -> `copilot` và đó là lịch sử đúng.
        """
        offenders = []
        scanned = 0
        for root in (REPO_SRC, WEB_SRC):
            for path in root.rglob('*'):
                if not path.is_file():
                    continue
                if path.suffix not in ('.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'):
                    continue
                parts = path.parts
                if 'migrations' in parts or 'tests' in parts or '__tests__' in parts:
                    continue
                if 'node_modules' in parts or 'dist' in parts:
                    continue
                try:
                    text = path.read_text(encoding='utf-8', errors='ignore')
                except OSError:
                    continue
                scanned += 1
                # Bo qua comment: giai thich bang chung can nhac toi copilot.
                for m in re.finditer(r'copilot', text, re.IGNORECASE):
                    line_no = text.count('\n', 0, m.start()) + 1
                    line = text.splitlines()[line_no - 1].strip()
                    if line.startswith(('#', '//', '*', '/*')):
                        continue
                    offenders.append(f'{_short(path)}:{line_no}: {line[:90]}')

        # Chống xanh giả: nếu đường dẫn sai thì `rglob` ra 0 file và mọi khẳng
        # định phía trên đều "đạt" một cách vô nghĩa. Phải chứng minh quét thật.
        self.assertGreater(
            scanned, 500,
            f'Chi quet {scanned} file — duong dan quet co the sai, guard se xanh giả',
        )
        self.assertEqual(
            offenders, [],
            'Con source dang nhac toi copilot ngoai comment:\n  ' + '\n  '.join(offenders),
        )
