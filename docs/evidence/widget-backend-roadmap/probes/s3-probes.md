# S3 probes — read-only trên VPS staging (không sửa code/DB)

> Ngày: 2026-11-13 · Worktree `/tmp/wt-s3` @ `feat/probes-s3` (code dot3, có `period` param) · DB tạm `s3_probe` (đã DROP) · Script `/tmp/s3probe.py` (đã xóa)

## P1 — `Finance(period='year')` có được vnbroker hỗ trợ? (đóng V1 dot3)

- Lệnh: `manage.py shell < /tmp/s3probe.py` → `fetch_company_financials('VNM', period=...)`.
- Kết quả:
  - `Q_KEYS {'ratio': 32, 'income_statement': 25, 'balance_sheet': 0}` — sample key `2026-Q3/2026-Q2/...`.
  - `Y_KEYS {'ratio': 32, 'income_statement': 25, 'balance_sheet': 0}` — sample key `2025/2024/2023/2022`.
  - `YEAR_SAME_AS_QUARTER False` → **year là dữ liệu thật khác quarter, KHÔNG phải echo**.
- Kết luận: **`period='year' ĐƯỢC hỗ trợ** (ít nhất với VNM/KBS). Nhánh 400 `FINANCIALS_YEAR_UNAVAILABLE` giữ lại cho symbol/source không có dữ liệu (fail-closed, đúng Rule 15).

## P2 — Corporate actions còn nguồn không? (D1)

- `fetch_company_info('VNM')` → `EVENTS_COUNT 0`, sample `[{}]`.
- Kết luận: **vẫn không có nguồn** (khớp probe Entry 477 VNM/VCB). Giữ branch B `adjusted:false` + note.

## P3 — Refresh route có serve? (R9, smoke thay vì đọc code)

- `django.urls.resolve('/core/v1/auth/token/refresh/')` → `REFRESH_ROUTE auth-token-refresh view` (không 404).
- Kết luận: route **serve** (khớp B3 đọc code `api_urls.py:18` + mount prefix `api/`).

## P4 — WS ticket (S1) smoke ngoài phạm vi slice này

- Không có PAT thật trong tay → **CHƯA CHẠY** E2E WS từ ngoài. Bù bằng 8 test BE + widget contract đã khớp shape (`fetchWsTicket` đọc flat top-level).
