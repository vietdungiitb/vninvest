# PLAN — REQ-VN-01..06 & C1–C7 Backend Closure (2026-11-18, rev 2)

> **Slice:** `req-vn-c1-c7-20261118` · **Branch:** `feat/req-vn-c1-c7-20261118` -> `dev`
> **Base:** `dev @ 20d0a98c7` (`origin/dev`, sạch)
> **Loại:** BE + Docs + TDD (`packages/core/backend/**`, `docs/**`)
> **Audit B3:** Round 1 `NEED_REVISION` (1 Blocker + 2 Major + 4 Minor, xem `docs/evidence/req-vn-c1-c7-20261118/audit.md`) → đã sửa đủ ở rev 2.
> **Lessons áp dụng:** `[L-001, L-002, L-003, L-007, L-008, L-M02 (multi-agent.md), L-M08, L-V01, L-V02, L-V09 (multi-agent-2.md), L-G02, L-B01, L-T01, L-T02]`

---

## 1. Mục tiêu

Đóng toàn bộ nhóm đầu mục backend C1–C7 và tài liệu phản hồi REQ-VN-01..06 theo quyết định Owner đã khoá:

1. **C1 (`REQ-VN-01`)**: Xoá file URL chết `packages/core/backend/src/market_data/public_urls.py` (34 route không được include) + đính chính câu stale trong `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:97`.
2. **C2 (`REQ-VN-02`)**: Bổ sung `require_pat_scopes_or_human_session(request, 'market:read')` cho `StockManagementOrderFlowView.get`.
3. **C6 (S-05 Addendum)**: Bổ sung `require_pat_scopes_or_human_session(request, 'signals:read')` cho `AlertCenterAcknowledgeView.post` và `AlertCenterMutePreferenceView.post`, đồng thời cập nhật `@extend_schema` để khai báo `403: OpenApiTypes.OBJECT` và gộp decorator trùng trên `AlertCenterAcknowledgeView`.
4. **C7 (S-05 Addendum)**: Bổ sung `require_pat_scopes_or_human_session(request, 'market:read')` cho toàn bộ `StockManagementPriceAlertsView` (`get`, `post`), `StockManagementPriceAlertDetailView` (`patch`, `delete`), `StockManagementPriceAlertTriggerView` (`post`).
5. **C3 (`REQ-VN-03`)**: Chốt `IntradayTapeView` (`/core/v1/market-data/intraday-tape/<symbol>/`, envelope có `match_type/ts`) làm endpoint canonical; cập nhật docstring `IntradayTapeView` (gỡ luôn câu stale `"with Redis cache (5 min TTL)"` vì code query DB trực tiếp) và đánh dấu `RealtimeIntradayView` (`/core/v1/realtime/intraday/<symbol>/`) là `[LEGACY/COMPAT]` (giữ nguyên route tương thích).
6. **C4 (`REQ-VN-04`)**: Cập nhật docstring `identity_access/ws_ticket.py` và `identity_access/views_ws_ticket.py` cho khớp hành vi thật sau C-01 (`require_human_session` chặn machine PAT mint ticket 403; machine PAT dùng `?token=` tương thích ngược qua TLS).
7. **C5 (`REQ-VN-05`)**: Cập nhật docstring `StockManagementFinancialsView` khỏi `"graceful empty"` sai sự thật sang `"trả payload thật (cash_flow=None) hoặc 400 INVALID_PERIOD / FINANCIALS_YEAR_UNAVAILABLE"`.
8. **`REQ-VN-06`**: Xuất bản tài liệu phản hồi `docs/BACKEND_RESPONSE_REQ_VN_01_06_2026-11-18.md` kèm ADR C3 và bảng 10 dòng xác nhận nhóm E3/E4 neo đúng `file:line` của `vninvest`.

---

## 2. Bằng chứng đọc code thật (B1 — trước khi lập kế hoạch)

| Hạng mục | File & dòng trong `vninvest` | Thực tế đọc được |
|---|---|---|
| C1 dead URLs | `packages/core/backend/src/market_data/public_urls.py:1-83` (`4-37` imports, `40-83` urlpatterns), `vninvest_core/urls.py:56-73`, `market_data/core_urls.py:44-84` | `vninvest_core/urls.py:66` chỉ include `market_data.core_urls`; grep `public_urls` ngoài `docs/` và `module_tree_full.md` chỉ còn `commercial.public_urls` (`urls.py:73`) = **0 tham chiếu thật** tới `market_data/public_urls.py`. Toàn bộ 34 view (`34` import / `34` `path(`) đã mount live trong `core_urls.py:51-84` (lưu ý 5 route ở `public_urls.py:74,78-81` dùng `<str:...>` trong khi `core_urls.py:72,75-78` dùng `<int:...>`). |
| C1 doc stale | `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:97` | Ghi sai `"mount thứ 2 ở market_data/public_urls.py:75"`. |
| C2 order-flow | `packages/core/backend/src/market_data/stock_mgmt_native_views.py:2157-2265` | `permission_classes = TENANT_PERMISSION_CLASSES` (`:2159`), `get` (`:2187-2265`) vào thẳng query `UnifiedAlert`, thiếu `require_pat_scopes_or_human_session(request, 'market:read')` so với `chart` (`:1903`), `financials` (`:3405`), `bars` (`:4256`). |
| C5 financials doc | `packages/core/backend/src/market_data/stock_mgmt_native_views.py:3372-3423` | Class docstring `:3373` ghi `"— graceful empty."` dù `get` (`:3403-3423`) trả payload vnbroker (`cash_flow=None`, serializer `:343` `allow_null=True`) hoặc 400 `INVALID_PERIOD` / `FINANCIALS_YEAR_UNAVAILABLE`. |
| C7 price-alerts | `packages/core/backend/src/market_data/stock_mgmt_native_views.py:4696-4838` | `StockManagementPriceAlertsView` (`get:4700`, `post:4705`), `StockManagementPriceAlertDetailView` (`patch:4752`, `delete:4809`), `StockManagementPriceAlertTriggerView` (`post:4833`) đều chỉ đặt `TENANT_PERMISSION_CLASSES`, thiếu `require_pat_scopes_or_human_session(request, 'market:read')`. Cả 3 view đã khai `403: OpenApiTypes.OBJECT` trong `@extend_schema`. |
| C6 alert-center write | `packages/core/backend/src/signal_intelligence/views.py:692-772` vs `:381-385,485-488,549-552,638-641,668-671,837-840` | 6 view anh em (`Feed`, `Summary`, `SymbolStats`, `EventDetail`, `SymbolContext`, `Stream`) đều gọi `require_pat_scopes_or_human_session(request, 'signals:read')`; riêng `AlertCenterAcknowledgeView.post` (`:718`) và `AlertCenterMutePreferenceView.post` (`:747`) thiếu. Ngoài ra `AlertCenterMutePreferenceView` (`:741`) thiếu `403: OpenApiTypes.OBJECT`, và `AlertCenterAcknowledgeView` (`:692-713`) đang xếp chồng 2 `@extend_schema`. |
| C3 intraday dup | `packages/core/backend/src/market_data/views.py:426-498` (`market_data/urls.py:11`, `core_urls.py:47`) vs `market_serving/native_views.py:191-252` (`market_serving/urls.py:28`) | Cả hai đọc `IntradayTick` và enforce `market:read`; `IntradayTapeView` trả envelope có `ts`, `match_type` (docstring `:430` ghi sai `"with Redis cache (5 min TTL)"`, code query DB trực tiếp); `RealtimeIntradayView` trả flat có `bars=trades`. |
| C4 ws-ticket doc | `packages/core/backend/src/identity_access/ws_ticket.py:1-6`, `views_ws_ticket.py:22-40` | `WsTicketView.post` (`:36`) gọi `require_human_session(request)` (machine PAT nhận 403), nhưng `ws_ticket.py:4` và `views_ws_ticket.py:23` vẫn ghi `"Bearer PAT"` / `"user/PAT"`. |
| E3/E4 & Index | `signal_intelligence/urls.py:6-16`, `market_data/urls.py:12-13`, `market_serving/urls.py:20-42`, `user_workspace/urls.py:52-76,103`, `user_workspace/portfolio_analytics_views.py:267-780,2584-2619` | Toàn bộ 10 nhóm E3/E4 đều live, gồm `IndexConstituentsView` (`market_data/views.py:510-557`, `market:read`). |

---

## 3. Acceptance Criteria (Given / When / Then)

- **AC1 (C1)**: Given `market_data/public_urls.py` bị xoá, When chạy `manage.py check`, test trên VPS, và `reverse('market_data:market-data-price-alerts')` / `reverse('market_data:market-data-stock-financials', kwargs={'symbol': 'FPT'})`, Then tất cả PASS không lỗi `ModuleNotFoundError` / `NoReverseMatch`; `BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:97` không còn khẳng định `public_urls.py` được mount; kiểm chứng trên VPS qua `scripts/dump-core-route-manifest.py` cho thấy `core-route-manifest.json` giữ nguyên 0 thay đổi.
- **AC2 (C2)**: Given machine PAT thiếu `market:read`, When `GET /core/v1/stock-management/stocks/FPT/order-flow/`, Then trả `403` có `'scope'`; Given machine PAT có `market:read` hoặc human session, Then trả `200`.
- **AC3 (C6)**: Given machine PAT thiếu `signals:read`, When `POST /core/v1/signals/alert-center/events/<alert_id>/ack` hoặc `POST /core/v1/signals/alert-center/preferences/mute`, Then trả `403`; Given machine PAT có `signals:read` (với symbol nằm trong `Watchlist` của `owner_user` để qua delivery policy), Then trả `200`.
- **AC4 (C7)**: Given machine PAT thiếu `market:read`, When gọi 5 endpoint price-alerts (`GET`/`POST /core/v1/stock-management/price-alerts/`, `PATCH`/`DELETE .../<pk>/`, `POST .../<pk>/mark-triggered/`), Then đều trả `403`; Given machine PAT có `market:read` (và human session), Then hoạt động bình thường (`200`/`201`/`204`).
- **AC5 (C3/C4/C5)**: Given đọc `__doc__` tại runtime của `IntradayTapeView`, `RealtimeIntradayView`, `ws_ticket`, `WsTicketView`, `StockManagementFinancialsView`, Then mọi mô tả khớp hành vi code thật (không còn `"graceful empty"`, không còn `"with Redis cache"`, không còn khẳng định machine PAT mint được `ws-ticket`, rõ canonical vs `[LEGACY/COMPAT]`). Đồng thời `check-envelope-contract.py` và `check-openapi-schema-budget.py` PASS không tăng lỗi/warning OpenAPI.
- **AC6 (`REQ-VN-06` & Gates)**: `docs/BACKEND_RESPONSE_REQ_VN_01_06_2026-11-18.md` có đủ 10 dòng bảng E3/E4 + kết quả C1–C7 + ADR C3; VPS BE tests PASS trên DB tạm + dọn sạch VPS/local; local gates (`check-multi-agent`, `check-lessons`, `scan-secrets`, `normalize-eol`) PASS; audit B3 & re-audit B8 đều PASS; `CODE_CHANGE_AUDIT_LEDGER.md` Entry 527 + `CLAIMS.md` `done`.

---

## 4. Scope & Non-goals

- **Files trong scope (14 file)**:
  1. `packages/core/backend/src/market_data/public_urls.py` *(delete)*
  2. `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
  3. `packages/core/backend/src/market_data/views.py`
  4. `packages/core/backend/src/market_serving/native_views.py`
  5. `packages/core/backend/src/signal_intelligence/views.py`
  6. `packages/core/backend/src/identity_access/ws_ticket.py`
  7. `packages/core/backend/src/identity_access/views_ws_ticket.py`
  8. `packages/core/backend/tests/test_req_vn_c1_c7.py` *(new)*
  9. `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md`
  10. `docs/PLAN_REQ_VN_C1_C7_20261118.md` *(new)*
  11. `docs/BACKEND_RESPONSE_REQ_VN_01_06_2026-11-18.md` *(new)*
  12. `docs/evidence/req-vn-c1-c7-20261118/audit.md` *(new)*
  13. `docs/CLAIMS.md`
  14. `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- **Non-goals**:
  - Không xoá route `RealtimeIntradayView` (giữ compat cho caller cũ).
  - Không thêm migration, không sửa deny-list, không sửa code frontend (`packages/web/**`), không chạm repo nào ngoài `vninvest`.
  - Không thay đổi logic nghiệp vụ ngoài việc thêm `require_pat_scopes_or_human_session`, chuẩn `@extend_schema` thêm `403`, và cập nhật docstring/tài liệu.
  - Không deploy container staging mới (chỉ chạy test trên DB tạm theo `STAGING_VPS_RUNBOOK.md` §12.3 rồi dọn sạch).

---

## 5. Kế hoạch TDD Fail-Before & Kiểm thử VPS (§12.3)

1. Khai claim `in-progress` thành commit riêng trước dòng code đầu tiên.
2. Viết `packages/core/backend/tests/test_req_vn_c1_c7.py` kiểm chứng đủ AC1–AC5 (lưu ý `Watchlist` + `WatchlistItem(symbol='VCI')` cho `self.owner` ở AC3 và `market_data:` namespace ở AC1).
3. Đẩy commit test lên nhánh remote (hoặc chạy trên worktree VPS theo §12.3), chạy `manage.py test tests.test_req_vn_c1_c7 --noinput` trên DB tạm Postgres ở VPS `14.225.255.47` → chụp log **FAIL (ĐỎ)** trước khi sửa `src/`.
4. Thực thi thay đổi C1–C7 + docs.
5. Chạy trên VPS (§12.3, `CORE_DATABASE_URL` trỏ DB tạm riêng, `DJANGO_DEBUG=1`):
   - `python manage.py check`
   - `python manage.py test tests.test_req_vn_c1_c7 --noinput` (PASS)
   - Targeted suites bị tác động trực tiếp:
     - `tests.test_dot3_remaining`
     - `tests.test_stock_management_api_routes`
     - `tests.test_market_data_api_routes`
     - `tests.test_market_data_intraday_native`
     - `tests.test_workstation_endpoints`
     - `tests.test_signal_intelligence_api_routes`
     - `tests.test_ws_ticket`
     - `market_data.tests.test_stock_management_native_api`
     - `market_data.tests.test_index_constituents`
     - `market_serving.tests.test_native_views`
     - `signal_intelligence.tests.test_alert_center_api`
     - `signal_intelligence.tests.test_alert_center_stream`
     - `signal_intelligence.tests.test_materializers`
     - `signal_intelligence.tests.test_user_alert_delivery`
     - `service_ops.tests.test_soc_sse_ticket_c01`
     - `vninvest_core.tests.test_api_envelope_schema`
     - `identity_access.tests.test_openapi_schema_contract`
   - Contract & Schema gates trên VPS:
     - `python scripts/check-envelope-contract.py market_data market_serving signal_intelligence identity_access`
     - `python scripts/check-openapi-schema-budget.py`
     - Kiểm chứng `python scripts/dump-core-route-manifest.py` tạo diff 0 dòng so với `core-route-manifest.json` hiện tại (`git diff` rỗng, rồi revert nếu chỉ khác whitespace hoặc verify trực tiếp).
   - **Full BE suite (`L-V09`):** chạy toàn bộ `manage.py test --noinput` trên VPS (hoặc nếu gặp lỗi môi trường/timeout thì báo trung thực `CHƯA CHẠY` / đối chiếu baseline `dev`). Nếu full suite hoàn tất, đối chiếu kết quả khớp baseline không hồi quy.
6. Dọn dẹp bắt buộc trên VPS & local (`L-M08`, `AGENT_PROTOCOL.md §10.8`):
   - `DROP DATABASE <db_tam>;` trên `vninvest-core-db`
   - `git worktree remove --force /tmp/wt-req-vn-c1-c7 && git worktree prune`
   - Xoá file tạm `/tmp/probe_*.py`, `/tmp/*.log` (nếu có) và xác nhận `docker ps` không còn container thử nghiệm.
   - Local sau khi merge PR: đồng bộ `dev`, xoá branch/worktree thừa.

---

## 6. Rủi ro & Rollback

- **Rủi ro C1**: Nếu có test/code nào import `market_data.public_urls` ẩn qua chuỗi động → `manage.py check` và suite trên VPS sẽ bắt ngay; nếu xảy ra sẽ dừng và báo lại (`enter_plan_mode`).
- **Rủi ro C2/C6/C7**: Có test cũ dùng machine PAT không có `market:read` hoặc `signals:read` gọi vào `order-flow`, `price-alerts`, `ack`, `mute` → chạy đầy đủ các suite liên quan trên VPS để phát hiện trước khi merge.
- **Rủi ro C6 OpenAPI**: Đảm bảo sau khi chỉnh `@extend_schema` trên `AlertCenterAcknowledgeView` & `AlertCenterMutePreferenceView`, cả `check-openapi-schema-budget.py` lẫn `vninvest_core.tests.test_api_envelope_schema` đều PASS.
- **Rollback**: 1 PR / 1 nhánh riêng; revert bằng `git revert <merge_commit>` hoặc revert từng commit theo C1..C7.
