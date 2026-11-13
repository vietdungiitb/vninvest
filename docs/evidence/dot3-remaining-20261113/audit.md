# Audit độc lập — PLAN_DOT3_REMAINING_20261113.md rev 1

> Ngày: 2026-11-13 · Auditor: subagent read-only · Branch: `feat/dot3-remaining-20261113` @ `20dafa5ed` (base `02a8891ce`) · Verdict: **NEED_REVISION** (0 B, 1 M, 3 m)

## Verdict

Plan trung thực, bằng chứng lõi đúng hết; sửa 1 M + 3 m rồi code. **Điều kiện V1 CHƯA đủ** (nửa B-6 đạt, nửa B-4 còn thiếu — xem M1/m3).

## Bằng chứng xác nhận (đúng)

- B-4 hardcode: `vnbroker_adapter.py:1226,1239,1252` đều `period='quarter'`; không `cash_flow`; `get_company_financials_response(symbol, force)` (`:1323`) không nhận `period` — khớp plan §0.1.
- Schema lỏng: `stock_mgmt_native_views.py:311-319` (`financials: object nullable`) — khớp plan.
- B-6 lỗ thật: grep `require_pat_scopes` = **0 hit** cả 4 app (`market_serving/`, `market_data/`, `signal_intelligence/`, `advisory/`); grep `market:read|signals:read|ai:invoke` cũng 0 hit 4 app — khớp plan §0.2.
- Schema mount vô điều kiện: `vninvest_core/urls.py:57-58` (comment `:56` nói "chỉ DEBUG" nhưng không có guard) — khớp plan.
- License drift thật: model `LicenseKey` ở `commercial/models.py:168-200`, migration head vẫn `0007_alter_paymenttransaction_plan.py`, chưa có `0008_*` — khớp plan §0.3.
- Helper "có sẵn" tồn tại: `identity_access/permissions.py:39` (`require_pat_scopes_or_human_session`).
- Claim/branch hợp lệ: branch hiện tại đúng `feat/dot3-remaining-20261113`, 1 commit claim; `CLAIMS.md:1939` in-progress; `vet-finish :1879` đã released tại `:1935` — hết giữ `native_views.py`/`stock_mgmt_native_views.py`. Ledger head Entry 478, next 479 — khớp plan §B-2.
- Scope sạch: không chạm deny-list; untracked session khác (`PLAN_A4*`, `PLAN_WIDGET*`, `WIDGET_EMBEDDING*`, `a4-roadmap/`, `facts32.json`, `21-fullbleed-test.png`) được loại trừ tường minh tại plan §2 và vẫn untracked ngoài scope.

## Objections

- **[M1] "Đã có sẵn" thiếu bằng chứng.** Plan §0.2 khẳng định `X-RateLimit-*`, `Retry-After`, SSE ping đã có sẵn chỉ cần test hồi quy — không kèm `file:line` nào (chỉ `admin-ops 410` verify được tại `urls.py:78-79`). Nếu 1 trong 3 chưa tồn tại, scope P2 phình. Yêu cầu: bổ sung `file:line` từng mục hoặc chuyển thành việc phải làm.
- **[m1] Đếm key sai.** Plan §0.1 và AC-B4 viết "đúng 4 key (`period,year,quarter,report_date,items`)" — liệt kê 5 key. Sửa thành 5 hoặc chốt danh sách key chuẩn.
- **[m2] Scope thừa `commercial/models.py`.** P3 chỉ cần `makemigrations` sinh `0008_*`; model đã có sẵn thì không sửa `models.py`. Bỏ khỏi bảng scope hoặc ghi rõ "chỉ đọc".
- **[m3] V1 nửa B-4 chưa có bằng chứng.** Điều kiện V1 (plan §AC) yêu cầu đọc signature `finance.ratio/income_statement/balance_sheet` để chốt `period=year` có được hỗ trợ không — plan chưa trả lời, auditor cũng chưa thấy probe. Không phải lỗi nói quá (plan ghi trung thực là điều kiện pre-code), nhưng **V1 CHƯA đủ**: phải xác minh trước khi code AC-B4 (`?period=year` 400 hay pass-through).
