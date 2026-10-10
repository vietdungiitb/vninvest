"""Điểm vào duy nhất cho lớp trình bày của Django admin.

Vì sao file này tồn tại
----------------------
Django autodiscover `admin` module của **mọi** app trong `INSTALLED_APPS`. Thứ
tự autodiscover theo thứ tự khai báo trong `INSTALLED_APPS`, và `vninvest_core`
đứng **trước** `identity_access` (`settings.py:115-116`). Nghĩa là branding set
ở đây sẽ bị `identity_access/admin.py` ghi đè — nên branding của app đó đã được
**gỡ ra** và chuyển vào `admin_ui.branding.apply_branding()`.

Giữ đúng một nơi ghi trạng thái toàn cục: đây là cùng nguyên tắc với phát
hiện "4 nguồn default prompt config, mỗi nơi một giá trị" đã ghi trong
`AGENTS.md` — mỗi nơi một giá trị thì không nơi nào là nguồn sự thật.
"""

from .admin_ui import apply_branding

apply_branding()
