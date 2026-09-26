# R0.8 — unique index (user, symbol, session_date) cho AdvisorySession.
#
# `tasks.py` dùng `update_or_create(user, symbol, session_date)` nhưng bảng không
# có ràng buộc duy nhất nên hai worker chạy song song có thể tạo hai session cho
# cùng một (user, mã, ngày), làm sai số token budget và mất tính nhất quán.
#
# Vì sao dùng RunSQL thay vì AddConstraint:
#   app `advisory` có `migrations/0001_initial.py` không đăng ký model vào
#   migration state, nên thao tác `AddConstraint` fail với
#   `KeyError: ('advisory', 'advisingsession')` và làm hỏng cổng
#   `makemigrations --check`. Unique index ở tầng DB là nơi thực sự chống race
#   nên vẫn đạt mục tiêu của R0.8. Sửa migration state gốc cần squash toàn bộ
#   lịch sử migration của app và nằm ngoài phạm vi task này.

from django.db import migrations

INDEX_NAME = 'uniq_advisory_session_user_symbol_date'
INDEX_COLUMNS = ('user_id', 'symbol', 'session_date')


def dedupe_sessions(apps, schema_editor):
    """Giữ bản ghi `updated_at` mới nhất cho mỗi nhóm trùng, xoá bản ghi còn lại.

    Bắt buộc chạy TRƯỚC khi tạo unique index, nếu không thì index tạo sẽ fail
    trên DB đang có bản ghi trùng.
    """
    AdvisorySession = apps.get_model('advisory', 'AdvisorySession')
    seen = set()
    duplicates = []
    queryset = (
        AdvisorySession.objects
        .order_by('user_id', 'symbol', 'session_date', '-updated_at', '-id')
    )
    for session in queryset.iterator(chunk_size=500):
        key = (session.user_id, session.symbol, session.session_date)
        if key in seen:
            duplicates.append(session.id)
        else:
            seen.add(key)
    if duplicates:
        AdvisorySession.objects.filter(id__in=duplicates).delete()


def noop_reverse(apps, schema_editor):
    """Không gỡ index: dữ liệu đã dedupe không thể khôi phục nguyên vẹn."""


def _target_table(apps):
    """Lấy tên bảng thật từ historical model.

    Không hardcode tên bảng: bảng trong DB là `advisory_advisorysession`
    (khác tên mặc định `advisory_advisingsession` của Django), nên chỉ
    `model._meta.db_table` mới là nguồn đúng.
    """
    return apps.get_model('advisory', 'AdvisorySession')._meta.db_table


def create_unique_index(apps, schema_editor):
    table = schema_editor.quote_name(_target_table(apps))
    columns = ', '.join(schema_editor.quote_name(col) for col in INDEX_COLUMNS)
    schema_editor.execute(
        f'CREATE UNIQUE INDEX IF NOT EXISTS {INDEX_NAME} ON {table} ({columns})'
    )


def drop_unique_index(apps, schema_editor):
    schema_editor.execute(f'DROP INDEX IF EXISTS {INDEX_NAME}')


class Migration(migrations.Migration):

    dependencies = [
        ('advisory', '0009_useraicredential_prompt_config_history'),
    ]

    operations = [
        migrations.RunPython(dedupe_sessions, noop_reverse),
        migrations.RunPython(create_unique_index, drop_unique_index),
    ]
