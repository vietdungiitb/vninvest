# S1 Gates — WHALE-BE-FIELDS-1127 (2026-11-27)

| Gate | Command | Exit | Result |
|---|---|---|---|
| Session sync | `pwsh -File scripts/agent-sync.ps1` | 0 | rebase xong, 0 trùng migration, check-multi-agent PASS; large-file warnings không chặn |
| Claim open | `git commit -m "chore(claim): open whale-be-fields-1127"` | 0 | 1 dòng append cuối `docs/CLAIMS.md` |
| Syntax | `python -m py_compile packages/core/backend/src/market_serving/native_views.py packages/core/backend/src/market_data/tests/test_whale_cvd_full_tf.py` | 0 | PASS |
| Diff check | `git diff --numstat` | — | native_views 35+/9-, test 96+/0 — khớp dự kiến, không đổi EOL hàng loạt |
| BE pytest | `CORE_DATABASE_URL=... DJANGO_DEBUG=1 python manage.py test market_data.tests.test_whale_cvd_full_tf` | **CHƯA CHẠY** | Session không có `CORE_DATABASE_URL`/`DJANGO_DEBUG`; AGENTS.md + L-B01 bắt buộc Postgres riêng trên VPS, không suy ra PASS |

## Fail-before / TDD

5 test method mới (AC-01..05) được viết **trước** khi sửa `native_views.py`:
- `test_whale_buckets_exposes_buy_and_sell_values`
- `test_whale_buckets_window_1h`
- `test_whale_feed_default_min_value_stays_500m`
- `test_whale_feed_min_value_floor_and_ceiling`
- `test_whale_feed_query_cap_keeps_newest`

Không chạy được trên code cũ vì thiếu DB ⇒ **fail-before chưa có output thực**; ghi rõ CHƯA CHẠY thay vì nhận định "sẽ đỏ". Implement xong vẫn chưa chạy được ⇒ trạng thái tests CHƯA CHẠY, không báo PASS.

## Re-audit (B8)

Auditor độc lập (subagent `ses_de32e4dcfffet2sBl9jtSKpKJc`): **AGREE**, 0 blocker / 0 major, 3 minor (M1 bucket envelope `truncated`, M2 window detail string, M3 `>=` vs `>`). Cả 3 đã đóng: envelope bucket lấy `any(b['data_quality']=='truncated')`, detail thêm `1h`, cap dùng `>`; thêm test `test_whale_bucket_cap_reports_truncated_envelope`. `py_compile` lại exit 0. Verdict audit gốc giữ AGREE; minor closed trước commit.
