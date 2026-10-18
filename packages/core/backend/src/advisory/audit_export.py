"""R4.3 — export `AIAuditLog` ra CSV (append-only: chỉ có đường **đọc** ra).

Ba điều kiện định hình module này:

1. **Append-only được hiểu đúng.** AC1 nói "không có API sửa/xoá log". Nhưng
   `AIAuditLog.objects.create(...)` ở các view khác là **ghi thêm** — đó là cơ chế
   audit, cấm nó thì hệ thống mất dấu vết. Nên module này chỉ **đọc** và export,
   không cấm việc ghi ở nơi khác; cái cần khoá là **không có đường sửa/xoá qua
   HTTP**, và `tests/test_ai_audit_retention_export.py` quét source để canh.

2. **BOM UTF-8 là bắt buộc, không phải chi tiết thẩm mỹ.** `before_json`/
   `after_json`/lý do thường chứa tiếng Việt có dấu. Excel trên Windows mở CSV
   không BOM bằng cp1252 ⇒ ra ký tự hỏng. Đây là lý do AC3 nhắc BOM.

3. **Cap 5000 + cờ `truncated`.** Không có cờ thì người tải file nghĩ đó là **toàn
   bộ** dữ liệu và kết luận sai (kiểu lỗi "số đếm được không phải số đúng" đã có
   ở `build-gates.md` L-G04). Cờ đặt trong **header HTTP** để client không cần đoán
   từ nội dung file.
"""
from __future__ import annotations

import csv
import io

#: AC3 — trần số dòng cho một lần export.
EXPORT_MAX_ROWS = 5000

#: BOM UTF-8 (EF BB BF). Excel Windows cần nó để đọc tiếng Việt đúng.
UTF8_BOM = '﻿'

CSV_COLUMNS = (
    'id',
    'created_at',
    'action',
    'actor',
    'tenant',
    'user',
    'reason',
    'diff_summary',
    'before_json',
    'after_json',
    'legacy_unattributed',
)


def export_rows(rows) -> tuple[list[dict], bool]:
    """Cắt `rows` theo trần, trả `(rows, truncated)`.

    Cắt **ở tầng hàm** chứ không ở tầng view, để giới hạn được kiểm bằng unit test
    không cần dựng HTTP — nếu chỉ kiểm ở view thì một code path gọi thẳng hàm này
    (export theo lịch, script vận hành) sẽ lách trần mà không ai thấy.
    """
    materialised = list(rows)
    truncated = len(materialised) > EXPORT_MAX_ROWS
    return materialised[:EXPORT_MAX_ROWS], truncated


def rows_to_csv(rows) -> str:
    """Dựng CSV (đã kèm BOM) từ các dict dòng."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(CSV_COLUMNS), extrasaction='ignore')
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key, '') for key in CSV_COLUMNS})
    return UTF8_BOM + buffer.getvalue()


def serialize_logs(queryset) -> tuple[list[dict], bool]:
    """Queryset `AIAuditLog` → `(rows, truncated)` sẵn sàng cho CSV.

    `before_json`/`after_json` được `json.dumps` **tại đây** chứ không để `csv`
    tự render dict — `csv` sẽ in ra `{'a': 1}` bằng `str(dict)` của Python, vừa
    khó đọc vừa dễ sai (thứ tự key).
    """
    import json

    materialised, truncated = export_rows(queryset)
    rows = []
    for log in materialised:
        rows.append({
            'id': log.pk,
            'created_at': log.created_at.isoformat() if log.created_at else '',
            'action': log.action,
            'actor': log.actor or '',
            'tenant': getattr(log.tenant, 'tenant_code', '') or '',
            'user': log.user_id or '',
            'reason': log.reason or '',
            'diff_summary': log.diff_summary or '',
            'before_json': json.dumps(log.before_json or {}, ensure_ascii=False),
            'after_json': json.dumps(log.after_json or {}, ensure_ascii=False),
            'legacy_unattributed': 'true' if log.legacy_unattributed else 'false',
        })
    return rows, truncated