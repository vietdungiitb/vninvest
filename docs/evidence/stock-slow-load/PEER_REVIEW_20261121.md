# PEER REVIEW — `AUDIT_STOCK_DETAIL_SLOW_LOAD_20261121.md` (audit độc lập)

- **Ngày**: 2026-11-21
- **Phạm vi**: bản chẩn đoán `docs/AUDIT_STOCK_DETAIL_SLOW_LOAD_20261121.md` (Entry 581) về `/stocks/VIC` tải ~30s.
- **Phương pháp**: auditor độc lập (subagent, chỉ đọc) verify từng citation + tìm giả thuyết thay thế; coordinator chạy thêm 2 probe read-only trên staging để đóng R1/R2. Không sửa code.
- **Verdict: AGREE** — đồng ý xương sống + 6 reservation (R1–R6), trong đó R2 đã đóng bằng đo mới, R1 đã thu hẹp bằng percentile `duration_ms`, và phát hiện thêm **F-07 (trailing-slash 301)** mà audit gốc bỏ sót.

**Tóm tắt 5 findings nghiêm trọng nhất**: (1) latency systemic backend đã xác nhận độc lập — curl bỏ qua FE vẫn 5–10s, percentile `duration_ms` 2h cho thấy MỌI path đều chậm (overview p50 10,8s/p95 20,6s; watchlists p50 10,7s; ws-ticket p50 8,1s); (2) `CONN_MAX_AGE=0` đã xác nhận bằng `printenv` trong container; (3) audit INSERT ~0,3–0,6s NẰM NGOÀI `duration_ms` nên là cộng thêm, không phải phần 10s — đòn bẩy lớn nhất là worker/connection (F-02), không phải F-01; (4) FE gọi `/session-facts/VIC/cvd?window=1h` thiếu trailing slash → 301 mất 8,7s (finding mới F-07, fix 1 ký tự); (5) F-01 không được drop-in: `cross_ref_pat_audit_events` + test tenantreg_b phụ thuộc dòng ACCESS.

---

## A. Bản đồ kiến trúc (tài liệu đã audit)

| File | Dòng | Trách nhiệm | Note review |
|---|---|---|---|
| `docs/AUDIT_STOCK_DETAIL_SLOW_LOAD_20261121.md` | 172 dòng | chẩn đoán gốc (Entry 581) | citation code 13/13 TỒN TẠI |
| `packages/core/backend/src/ops_audit/middleware.py` | 92 | ghi `AuditEvent` mọi request | verify đúng; comment `:55-57` stale (ghi index 7/settings.py:113 — sai, RequestTrace là index 0) |
| `packages/core/backend/src/vninvest_core/settings.py` | `:143-155`, `:236` | MIDDLEWARE; `CONN_MAX_AGE` default 60 | staging env = 0 đã xác nhận |
| `packages/web/src/context/PortfolioContext.js` | `:599-642` | bootstrap tuần tự | verify đúng |
| `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js` | `:122-131`, `:188-191` | fan-out 4+2 request | verify đúng; `DEFAULT_ORDER_FLOW_WINDOW='1h'` (dòng 7) |
| `packages/web/src/components/WhaleBubbleChart.jsx` | `:622`, `:670` | fetch riêng 30m/session | verify đúng — param KHÁC model (30m vs 1h) nên là overlap chứ không phải duplicate exact |
| `packages/web/src/adapters/core/transport.js` | `:453-459` | 404→null | verify đúng; `market.js:475-480` còn catch kép |
| `packages/web/src/components/VNStockChartPanel.js` | `:115-154`, `:511-519` | lazy widget + gate bars | verify đúng |

## B. Luồng dữ liệu đã trace (độc lập, 1 use-case `/stocks/VIC`)

`PortfolioContext.bootstrap` (`:603-642`: `await syncAuthState` → `await fetchPortfolios`, tuần tự) → shell render → `useStockDetailPageModel.loadBlocking` (`Promise.allSettled` 4 request) + deferred 2 request + `WhaleBubbleChart` 2 request riêng + `useTenantTier` + header `alert-center/summary` → widget `fetchBarsInRange` qua `chartAdapter` → `onBarsChange` mở gate `internalBars.length > 0`. Không phát hiện vòng lặp retry do 404.

## C. CONTRADICTIONS (audit gốc vs kiểm chứng độc lập)

| Audit gốc | Kiểm chứng | Tác động |
|---|---|---|
| "INSERT audit ~0,6s là thủ phạm chính trong 10s" | `duration_ms` (ghi ở `middleware.py:87`) đo TRƯỚC khi INSERT (INSERT ở `:37` sau khi response xong) → percentile p50 10–17s là view-time thuần, CHƯA gồm INSERT | Attribution cần hiệu chỉnh: INSERT là cộng thêm (~0,3–0,6s + jitter), không giải thích phần 10s |
| "`CONN_MAX_AGE=0` → mở connection mới mỗi request" (không paste evidence) | `docker exec printenv CORE_DB_CONN_MAX_AGE` → `0`. **Đã đóng.** | Luận điểm đứng; kết hợp pgbouncer CPU 24% → connection churn là đồng phạm hợp lý |
| Audit không nhắc trailing slash | Log Playwright: `301 8697ms /session-facts/VIC/cvd?window=1h` → `200 3013ms .../cvd/?window=1h`; code `market.js:293` không có slash cuối | Bỏ sót finding F-07 (~8,7s waste, fix 1 ký tự) |

## D. Findings của peer review

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| R1 | major→**đã thu hẹp** | `ops_audit/middleware.py:87` + probe percentile 2h | p50/p95: overview 10,8/20,6s; whale 11,3/21,8s; order-flow 14,2/21,2s; tickers 17,4/24,1s; watchlists 10,7/23,4s; ws-ticket 8,1/22,7s. 1457 req/2h, 11,8% ≥5s, 8,3% ≥9s | Mọi path đều chậm → systemic, không phải 1 view | Ưu tiên F-02 (worker/persistent conn) TRƯỚC F-01 |
| R2 | major→**ĐÃ ĐÓNG** | container env `CORE_DB_CONN_MAX_AGE=0` | default code 60 nhưng staging = 0 | Mỗi request TCP+auth mới qua pgbouncer | Đặt `CONN_MAX_AGE=60` + đo lại percentile trước mọi thay đổi khác |
| R3/F-07 | minor→**finding mới** | `market.js:288-299` (`getSessionFactsCvd` thiếu `/` cuối) | 301 APPEND_SLASH mất 8,7s | 1 round-trip lãng phí/request | Thêm `/` cuối; rà soát các `coreGet` khác thiếu slash |
| R4 | minor | `identity_access/tasks.py:507-551`; `middleware.py:52-53` | `cross_ref_pat_audit_events` + test tenantreg_b phụ thuộc dòng ACCESS | F-01 drop-in làm mù PAT traffic + phá test | F-01 bắt buộc kèm update task + test |
| R5 | minor | container 512MB dùng 76% | tăng daphne worker chưa có số liệu memory/pool | worker sync thêm → nhân connection DB | Đo memory + pgbouncer pool trước khi duyệt F-02 |
| R6 | info | `ops_audit/models.py` (chưa đọc) | index `_like` + archive/partition chưa rõ migration/gate cấm | — | check riêng trước khi sửa index |

Giả thuyết thay thế đã loại trừ (có đọc code): TenantResolution/TenantQuota/RateLimit middleware (vài query indexed, không 5s); view overview/order-flow/alert-summary (3 query nhẹ / 1 aggregation + cache 10s); 401-refresh (không có request refresh trong log); ngoài giờ giao dịch (thiếu facts trả rỗng ngay, `market_serving/views.py:371-384`).

## E. Quality gates audit

- Lint/type-check/i18n/test: **không áp dụng** (phiên này 0 dòng code, chỉ docs).
- `node docs/audit-uiux/scripts/check-ledger-entry.mjs`: sẽ chạy sau khi prepend Entry 582.
- Probe staging toàn read-only (`SELECT` percentile + `printenv`); file `/tmp/probe_*` đã xóa khỏi container (`CLEAN`).

## F. Câu hỏi cần làm rõ (cho Owner/hạ tầng)

1. Chấp nhận đặt `CORE_DB_CONN_MAX_AGE=60` trên staging và đo lại percentile không? (R2 — đòn bẩy rẻ nhất)
2. `cross_ref_pat_audit_events` có được phép mù PAT traffic nếu giới hạn audit write-only? (R4 — quyết định compliance)
3. Memory headroom + pgbouncer pool size hiện tại cho phép tăng daphne worker không? (R5)

## G. Đánh giá tổng thể

Xương sống đứng vững và đã được xác nhận độc lập: latency systemic backend (curl bỏ qua FE vẫn 5–10s; percentile mọi path đều chậm), 404 là noise có chủ đích (verify cả view lẫn handler), thứ tự P0-backend trước FE đúng. **Implementable**, với hiệu chỉnh attribution: đòn bẩy lớn nhất là **kết nối/worker (R2/F-02)**, sau đó là **trailing slash (F-07)** và trùng request FE, cuối cùng mới là audit INSERT (F-01, bắt buộc kèm R4). Không blocker cho việc triển khai R2+F-07+F-04 ngay.
