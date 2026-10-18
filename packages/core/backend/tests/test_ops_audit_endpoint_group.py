"""R5.2 — map đúng group `ai_agents` trong audit rollup (plan `:1274-1277`).

Lỗi thật đo được trước khi sửa: `ops_audit/tasks.py:140` map
`'/core/v1/ai-agents/'` → `ai_agents`, nhưng route **thật** là `/core/v1/ai/agents/`
(`ai_agents/urls.py:6`). Tệ hơn nữa, `'/core/v1/ai/'` nằm ở dòng **135** — đứng
trước — nên request thật khớp generic và bị ghi nhóm `ai`, còn nhánh `ai_agents` là
**code chết**. Audit trail vì vậy **không bao giờ** ghi `ai_agents`, đúng thứ AC muốn.

Vì `dict` giữ thứ tự chèn và vòng lặp dùng `startswith` theo thứ tự đó, cách sửa
đúng là đặt prefix **cụ thể hơn lên trước** prefix tổng quát — không phải sửa chuỗi
rồi hy vọng thứ tự. Test bên dưới ghim cả hai điều: đường dẫn thật vào đúng nhóm,
và prefix cụ thể không bị generic nuốt mất.
"""
from django.test import TestCase

from ops_audit.tasks import _endpoint_group


class EndpointGroupMappingTests(TestCase):
    def test_ai_agents_real_path_maps_to_ai_agents(self):
        self.assertEqual(_endpoint_group('/core/v1/ai/agents/'), 'ai_agents')
        self.assertEqual(
            _endpoint_group('/core/v1/ai/agents/12/'), 'ai_agents',
        )

    def test_stale_prefix_is_gone(self):
        """`/core/v1/ai-agents/` không phải route nào ⇒ phải rơi về `other`.

        Bản đầu của test này assert ngược lại (`== 'ai_agents'`) trong khi docstring
        lại nói "đừng giữ để trông có map" — tức là **test mâu thuẫn với chính nó**.
        Giữ prefix chết là giữ một dòng trông như có phân loại nhưng không bao giờ
        chạy; và nếu test bảo vệ dòng đó thì bug quay lại mà không ai thấy.
        """
        self.assertEqual(_endpoint_group('/core/v1/ai-agents/'), 'other')

    def test_generic_ai_prefix_still_maps_other_ai_routes(self):
        """Sửa lỗi không được nuốt mất các route AI khác."""
        for path in ('/core/v1/ai/usage/', '/core/v1/ai/whatever/'):
            self.assertEqual(_endpoint_group(path), 'ai')

    def test_nearby_groups_unchanged(self):
        cases = {
            '/core/v1/partner/': 'partner',
            '/core/v1/identity/': 'identity',
            '/api/core/v1/auth/': 'auth',
            '/core/v1/market-data/': 'market_data',
            '/core/v1/data-ingest/': 'data_ingest',
            '/core/v1/operator/': 'operator',
            '/core/v1/health': 'health',
            '/api/public/': 'public',
            '/core/v1/khong-ton-tai/': 'other',
            '': 'other',
        }
        for path, expected in cases.items():
            self.assertEqual(_endpoint_group(path), expected, path)