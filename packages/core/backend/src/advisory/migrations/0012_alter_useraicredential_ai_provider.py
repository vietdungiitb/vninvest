"""
Gỡ provider `copilot` khỏi `UserAICredential.ai_provider`.

Tên file do `makemigrations` sinh (`0012_alter_useraicredential_ai_provider`),
nội dung bổ sung bên dưới là do ta viết thêm.

VÌ SAO GỠ — bằng chứng probe thật 2026-09-26, không phải suy đoán:

| Bước | Kết quả |
|---|---|
| Loại key đang lưu | GitHub PAT classic (`ghp_`, ~40 ký tự) |
| Key còn hiệu lực? | `GET https://api.github.com/user` → **200** (tài khoản hợp lệ) |
| Có scope `copilot`? | **Có** — `X-OAuth-Scopes` chứa `copilot` |
| Đổi sang session token | `GET .../copilot_internal/v2/token` → **404 "Not Found"**, thử cả `token` và `Bearer` |

Nên 404 **KHÔNG phải vì key sai** — key đúng và scope đúng. `copilot_internal` là
endpoint NỘI BỘ của Copilot, không nhận PAT; GitHub trả 404 thay vì 403 nên dễ
chẩn đoán nhầm thành "key hỏng".

Hệ quả nếu giữ provider: `advisory/orchestrator.py` chỉ có 3 nhánh endpoint —
`local` (Ollama), `gemini` (Google), `else` → `api.openai.com`. `copilot` rơi
vào `else` ⇒ gửi tên model tới OpenAI kèm GitHub token ⇒ 401. Provider chỉ tạo
ra request hỏng im lặng.

Copilot không phải API LLM dùng chung: nó là tính năng subscription dành cho
client của GitHub, không có endpoint chính thức cho ứng dụng bên thứ ba. Không
có URL thay thế hợp lệ nào, và không đoán.

BƯỚC CHUYỂN DỮ LIỆU:

Migration `0004` đã map `preferences.ai_provider='copilot'` → credential
`ai_provider='copilot'`. Nên nếu có môi trường nào chạy qua `0004` (prod,
staging) thì ĐANG CÓ credential `copilot` dù dev không có. Vì vậy thêm
`RunPython` chuyển các bản ghi đó về `openclaw` (provider mặc định của hệ
thống) TRƯỚC khi ràng buộc `choices`.

Cố ý KHÔNG xoá `encrypted_api_key`: xoá credential là thao tác phá huỷ dữ liệu
mà không cần thiết. Key đó vốn đã vô dụng sau khi gỡ provider; ai muốn dọn thì
xoá qua UI (`/settings/ai`). Lưu ý bảo mật: nếu key đó là classic PAT rộng quyền
(`repo`, `admin:org`, `workflow`…) thì nên gỡ ở phía GitHub, không chỉ ở DB.

Số bản ghi thực tế: dev = 0 (đã đo bằng truy vấn trực tiếp). Migration này là
phòng thủ cho các DB khác, nên `elidable=True` để bước đọc-ghi bị bỏ nếu
database không cho phép.
"""

from django.db import migrations, models

FALLBACK_PROVIDER = 'openclaw'


def copilot_to_system_default(apps, schema_editor):
    """Chuyển credential `copilot` về provider mặc định của hệ thống."""
    UserAICredential = apps.get_model('advisory', 'UserAICredential')
    qs = UserAICredential.objects.filter(ai_provider='copilot')
    n = qs.count()
    if n:
        qs.update(ai_provider=FALLBACK_PROVIDER)
    print(f"  [0012] chuyen {n} credential copilot -> {FALLBACK_PROVIDER}")


def noop(apps, schema_editor):
    """Chiều ngược giữ nguyên dữ liệu: không ghi được 'copilot' nữa nên không
    cố khôi phúc — hành vi đúng là để rollback thủ công."""


class Migration(migrations.Migration):

    dependencies = [
        ('advisory', '0011_align_model_choices_with_live_providers'),
    ]

    operations = [
        migrations.RunPython(
            copilot_to_system_default,
            noop,
            elidable=True,
        ),
        migrations.AlterField(
            model_name='useraicredential',
            name='ai_provider',
            field=models.CharField(
                choices=[
                    ('openai', 'OpenAI (ChatGPT)'),
                    ('gemini', 'Google Gemini'),
                    ('claude', 'Anthropic (Claude)'),
                    ('local', 'Local Model (Ollama/vLLM)'),
                    ('openclaw', 'OpenClaw (System Default)'),
                ],
                default='openai',
                max_length=32,
                verbose_name='Nhà cung cấp AI',
            ),
        ),
    ]
