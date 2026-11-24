# BÁO CÁO PHƯƠNG ÁN CHUYỂN ĐỔI DỮ LIỆU GIÁ — REVISION 1 (2026-11-24)

> Trạng thái: owner ủy quyền chốt toàn bộ §7 (thay mặt). Audit v1 **REQUEST CHANGES** (6 P0) → đã sửa trong bản này → chờ audit v2.
> Audit v1: `docs/evidence/widget-news-events/AUDIT_PLAN_PRICE_MIGRATION_FULL_V1_20261124.md`.
> Không code trong tài liệu này.

## 0. QUYẾT ĐỊNH OWNER (thay mặt, 2026-11-24)

| §7 | Chốt | Điều kiện kèm |
|---|---|---|
| 1 UI default | **Adjusted** cho Chart/Technicals/Screener/Backtest/52w (có toggle Raw); **Raw** cho bảng phiên/tham chiếu/trần/sàn/realtime/sổ | Bắt buộc giải P0-2 (scale O/H/L theo `adj_close/close` hoặc lưu cột adjusted) |
| 2 Phạm vi năm | **Tải đủ 2011–2026 (48 request)** đo phủ 3 sàn thật; mặc định **All 2011–2026** nếu 3 sàn đạt ≥95%, không cắt 2019 (tránh đứt gãy basis 2018→2019) | Coverage gate per-symbol; phần thiếu giữ cũ + cờ |
| 3 DB-only | **Giữ nguyên + cờ `unmapped_cafef` + BẮT BUỘC dọn `adj_close` hỏng** (set NULL); chia 3 nhóm: chỉ số benchmark / huỷ niêm yết-EFT-CW / rác-ngày nghỉ | Không xóa mù; xác minh chỉ số CafeF có trả không (P0-6) |
| 4 Record cũ | **KHÔNG chạy lại** `ScreenerRunHistory`/`AdvisoryRecord`; gắn `price_basis='provider_adjusted_legacy'`, record mới `cafef_*` | Backtest phải ép cùng basis entry/exit; nếu lệch ⇒ cờ `basis_mismatch` |
| 5 Drift 0,5% | `r(t)=A_provider/A_cafef`; return parity ngày thường ≤0,5% ⇒ **REBASE_SHIFT (warn)**; spike ngoài ex-date / lệch ngày / nhảy unit ⇒ **DATA_ERROR (halt)** | Dùng lịch `CorporateAction` để xác định ex-date |

## 1. Mục tiêu & nguyên tắc (cập nhật)

Đưa `DailyPrice` về `close`=giá thô, `adj_close`=giá đã điều chỉnh (CafeF qua vnbroker 3.9.0), cập nhật mọi field đã có, mọi bảng dẫn xuất, có **đường vận hành T+1 và rebase liên tục**.

1. Không big-bang — lô `(exchange,year)` + backup + rollback chọn lọc.
2. Không đổi basis một nửa hệ thống — mọi 🔴 consumer đổi/invalidate trong cùng maintenance window.
3. Nguồn thật CafeF; VCI/KBS chỉ drift monitoring.
4. Không ghi đè sổ user.
5. Test assert **ngày**, không chỉ giá.

## 2. Số liệu nền (đo thật)
`DailyPrice` ~4,58M dòng / 2,25M `adj_close` sai · `CafefDailyPrice` 101.756 dòng (HOSE 2022) · độ phủ: 2022 gộp 3 sàn 98,6% (HOSE-only 27,2%); **2011/2015/2018/2020 là riêng HOSE 39,3/39,5/29,4/28,1% — CHƯA ĐO HNX/UPCOM** · bảng dẫn xuất: SymbolSnapshot 66.040, IntradayBar 244.454, SessionFacts 4.439, ParitySnapshot 33.866 · **CHƯA ĐO**: provider breakdown, DB theo sàn, CafeF có trả chỉ số không.

## 3. Field mapping (sửa P0-4)
| CafeF | DB đích | Ghi chú |
|---|---|---|
| `Giá đóng cửa` | `close` | raw |
| `Giá điều chỉnh` | `adj_close` | adjusted |
| `Giá mở/cao/thấp` | `open/high/low` | raw; **đọc adjusted bằng `ratio=adj_close/close`** (P0-2) |
| `Khối lượng khớp lệnh` | **`volume`** | BẮT BUỘC (P0-4) |
| `Giá trị khớp lệnh` | `value` | ×1e9 |
| `Thay đổi` | `change_pct` | **phải thêm cột vào `CafefDailyPrice` + parser trước S1**; trên ex-date lấy theo giá tham chiếu điều chỉnh, không `(raw_t-raw_{t-1})/raw_{t-1}` |
| — | `source='cafef'`, `price_source='cafef'` (mới), `is_adjusted` | `is_adjusted` giữ semantics "close có adjusted tương ứng"; serializer phải trả thêm `adj_close`+`price_source` (P1-2) |
| `KL/GT thỏa thuận` | bỏ | ghi rõ |

**P0-2 NAV**: `PortfolioEquityCurve/_nav_series` (`portfolio_analytics_views.py:489-546`) phải đổi từ `quantity_hiện_tại × close_365d` sang **chuỗi quantity theo thời gian** (từ `Transaction`/`LedgerEntry`) hoặc ít nhất dùng `adj_close` cho cả entry/exit — không nhân số lượng sau chia với giá thô trước chia.

## 4. Fan-out (bổ sung P1-1)
Thêm vào 🔴: 3 beat job (`deep-history-bootstrap-weekly` CN 03:00 `settings.py:811-816`, `pre5y-history-backfill-weekly` CN 04:00 `:821-830`, `ingest-daily-prices-1705` `:836-842`) + 4 on-demand (`promotion_fast_path.py:99`, `global_symbol_planner.py:143`, `backfill_service.py:56`, `data_ingest/views.py:157`) — pause hết trong S3c–S5. `/bars/` metadata `adjusted` (`stock_mgmt_native_views.py:4398-4418`) đang check `AdjFactor.PARTIAL` ⇒ đổi sang `price_source=='cafef'`. Anomaly-alert 5m (`signal_intelligence/materializers.py:508`) pause khi recompute snapshot. RVOL (`market_serving/native_views.py:427`) + whale fallback (`portfolio_analytics_views.py:2853-2870`) đối chiếu volume basis mới. `StockChartView` (`market_data/views.py:184-252`) là **dead code chưa mount** — không sửa, ghi rõ.

## 5. Thứ tự triển khai (sửa P0-3 — 9 bước)

| Bước | Việc | Tiêu chí dừng |
|---|---|---|
| **S0 Backup** | `pg_dump` **từng bảng** + bảng staging `(symbol,date,old_*)` vào `/opt/backups/price-migration-20261124/` | checksum khớp; **gate dung lượng trống ≥80 GB** (VPS từng đầy 98%) |
| **S1 Bulk CafeF** | **Thống nhất đường fetch**: dùng `vnbroker 3.9.0 bulk_year(exchange,year)` (48 req); thay `cafef/importer.py` gọi local `fetcher.py` bằng wrapper vnbroker. Thêm cột `change_pct` cho `CafefDailyPrice` + parser. Ghi 3 sàn × 2011–2026 | per-symbol coverage gate; đo phủ 3 sàn thật, báo cáo trước khi chốt scope |
| **S2 Dry-run diff** | Diff `(symbol,date)` mọi field; phân loại DB-only 3 nhóm; kiểm tra CafeF có trả chỉ số | nhảy=warn; lệch unit/ngày=halt; drift phân loại theo §0.5 |
| **S3a Schema migration** | Thêm `price_source` + index `CREATE INDEX CONCURRENTLY` trên bảng 4,58M; cột `adj_open/high/low` (hoặc `adj_factor`) theo §3 | migration chạy xong, không lock dài |
| **S3b Guard + Pause** | Sửa `vnbroker_adapter.py:763` + `tasks.py:792-798` skip `(symbol,date)` có `price_source='cafef'`; **pause 3 beat + 4 on-demand + anomaly-alert 5m**; `adjustment.py` giữ flag tắt | chạy nightly giả lập → 0 row cafef bị đổi |
| **S3c Persist** | Ghi mọi field từ `CafefDailyPrice`; **INSERT cả CafeF-only** (~38.986 dòng/2022); DB-only: giữ `close` cũ + **set `adj_close=NULL`** + cờ; **KHÔNG UPDATE in-place khi đang có traffic** — ghi cột mới rồi cutover bằng flag 1 lần | assert `updated_count == dry_run_matched_count` + checksum mẫu (không dùng "row count trước=after"); VACUUM ANALYZE giữa lô |
| **S4 Invalidate** | Xoá cache §4.2; rebuild coverage/inventory | cache key mới trả số mới |
| **S5 Recompute + Deploy consumer** | Chạy materializer SymbolSnapshot + pre-open (§4 bổ sung); deploy BE+FE §4 trong cùng release; gắn `price_basis`; **resume beat** | E2E: chart TPB adjusted=17.940 toggle raw=42.750; không trộn basis |
| **S6 Verify + Monitor** | 20 mã × 5 năm đối chiếu; drift 2 tuần; rollback **chọn lọc `WHERE date<=cutover`** từ bảng old_* (KHÔNG restore pg_dump đè dữ liệu mới) | parity report; rollback sẵn trong 2 tuần |
| **S7 Dọn** | Sau parity: dọn local fetcher/parser; giữ `CafefDailyPrice` staging | — |

## 6. Ongoing T+1 + rebase (sửa P0-1)
- **Daily sync**: `daily-backfill-prices-1700` được thay bằng job CafeF `daily_bars(basis='both')` cho mọi mã active; dòng T+1 **luôn do CafeF chèn** (`price_source='cafef'`), VCI/KBS chỉ bổ sung khi CafeF không có (`unmapped_cafef`).
- **Rebase**: khi có `CorporateAction` ex-date mới (hoặc định kỳ hằng ngày), re-fetch chuỗi `adj_close` của mã đó từ CafeF (CafeF tự rebase) và cập nhật theo lô; **không tự nhân factor**. Flag drift theo §0.5.
- Giữ `AdjFactor` chỉ cho overlay sự kiện; không đọc làm nguồn `adj_close`.

## 7. Rủi ro bổ sung
Disk (gate 80GB + VACUUM) · rollback chọn lọc · trộn basis (maintenance window) · NAV quantity time-series · `is_adjusted` semantics · benchmark chỉ số chưa xác minh.

## 8. Kết luận
REVISION 1 đóng 6 P0: T+1/rebase, OHLC ratio + NAV, thứ tự schema→guard→persist, field/volume, DB-only dọn adj_close + CafeF-only INSERT + tiêu chí không false-green, đường fetch vnbroker + số liệu gộp 3 sàn. Chờ audit v2 trước khi lập plan triển khai chi tiết.
