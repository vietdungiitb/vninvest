# Audit Record — Slice `req-vn-c1-c7-20261118`

> **Đối tượng:** `docs/PLAN_REQ_VN_C1_C7_20261118.md` (nhánh `feat/req-vn-c1-c7-20261118`, base `dev @ 20d0a98c7`)
> **Quy tắc:** Rule 14 — đọc code thật trong `d:\Mujoco Projects\vninvest`, mọi finding kèm `file:line`.

---

## 1. B3 — Audit Kế hoạch độc lập (Round 1)

- **Auditor:** Subagent độc lập read-only (`1b579834-7bb9-4a5d-8c51-2982c7bbb95c`)
- **Verdict Round 1:** `NEED_REVISION` (1 Blocker, 2 Major, 4 Minor)

### Findings Round 1 & Xử lý ở Rev 2

| # | Mức độ | Nội dung finding | Xử lý ở Rev 2 |
|---|---|---|---|
| B-1 | BLOCKER | `AC1` (`:43`) thiếu namespace `market_data:` trong `reverse('market-data-price-alerts')` và `reverse('market-data-stock-financials', ...)` vì `vninvest_core/urls.py:66` mount `namespace='market_data'`. | Đã sửa thành `reverse('market_data:market-data-price-alerts')` và `reverse('market_data:market-data-stock-financials', kwargs={'symbol': 'FPT'})`. |
| M-1 | MAJOR | `§5.5` sai module label (`test_dot3_remaining` → `tests.test_dot3_remaining`, tương tự `test_stock_management_api_routes`, `test_ws_ticket`), thiếu các suite/gate tác động trực tiếp (`test_api_envelope_schema`, `test_market_data_*`, `test_native_views`, `test_alert_center_stream`, `test_soc_sse_ticket_c01`, `check-envelope-contract.py`, `check-openapi-schema-budget.py`, `dump-core-route-manifest.py`, lưu ý `L-V09` full BE suite). | Đã sửa đầy đủ trong §3 AC1/AC5 và §5.5 rev 2. |
| M-2 | MAJOR | `AlertCenterMutePreferenceView` (`signal_intelligence/views.py:741`) thiếu `403: OpenApiTypes.OBJECT` trong `@extend_schema`, và `AlertCenterAcknowledgeView` (`:692-713`) đang chồng 2 decorator `@extend_schema`. | Đã thêm vào §1, §2, §4 và §6 để gộp/bổ sung `403: OpenApiTypes.OBJECT` và kiểm chứng bằng `check-openapi-schema-budget.py` + `test_api_envelope_schema`. |
| m-1 | MINOR | Mâu thuẫn số lượng view trong `public_urls.py` (`34` route ở §1 vs `"33 view"` ở §2). Thực tế `public_urls.py:4-37` import 34 view và `core_urls.py:51-84` mount cả 34 (lưu ý `<str:...>` vs `<int:...>` ở 5 route). | Đã đính chính thành **34 view / 34 path** và ghi rõ khác biệt `<str:>` vs `<int:>` ở §2 rev 2. |
| m-2 | MINOR | `L-M02` / `L-V09` trùng ID giữa các file lesson; end-line citation `:2214` (nên là `:2265`) và `:2615` (nên là `:2619`). | Đã ghi rõ `L-M02 (multi-agent.md)`, `L-V09 (multi-agent-2.md)` và chỉnh đúng `:2265`, `:2619`. |
| m-3 | MINOR | Docstring `IntradayTapeView` (`market_data/views.py:430`) còn câu stale `"with Redis cache (5 min TTL)"` trong khi `get` (`:437-497`) query DB trực tiếp. | Đã bổ sung vào §1.5, §2 và AC5 để bỏ luôn câu stale khi cập nhật C3. |
| m-4 | MINOR | Bổ sung dọn `/tmp/probe_*.py`, `/tmp/*.log` trên VPS + cleanup local; lưu ý `Watchlist`/`WatchlistItem(symbol='VCI')` cho `owner_user` ở fixture AC3. | Đã bổ sung vào AC3, §5.2 và §5.6 rev 2. |

---

## 2. B3 — Audit Kế hoạch độc lập (Round 2)

- **Auditor:** Subagent độc lập read-only (`1b579834-7bb9-4a5d-8c51-2982c7bbb95c`)
- **Verdict Round 2:** **`AGREE` (PASS)** — **0 Blocker / 0 Major / 0 Minor**
- **Kết quả:** Toàn bộ 7 finding Round 1 (`B-1`, `M-1`, `M-2`, `m-1..m-4`) đã được xác minh **CLOSED** trên `docs/PLAN_REQ_VN_C1_C7_20261118.md` (rev 2).
- **Implementation Notes (giữ đúng khi code):**
  1. Gộp 2 `@extend_schema` trên `AlertCenterAcknowledgeView` (`signal_intelligence/views.py:692-714`) giữ `request=OpenApiTypes.OBJECT`, `200: envelope_response(UserAlertDeliveryStateSerializer)`, và `400/401/403/404/429: OpenApiTypes.OBJECT`.
  2. `core-route-manifest.json` giữ nguyên `i/lf` trong Git index (`L-T01`).
  3. Commit claim `in-progress` riêng vào `docs/CLAIMS.md` trước khi sửa `src/` hoặc `tests/`.

---

## 3. B8 — Re-audit Implementation độc lập

*(Chờ cập nhật sau bước B7)*
