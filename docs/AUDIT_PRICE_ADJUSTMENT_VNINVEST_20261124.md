# Audit — Giá VCI/KBS đã hiệu chỉnh và cơ chế điều chỉnh lần 2 của vninvest

> Ngày: 2026-11-24 · Phạm vi: toàn bộ `market_data.DailyPrice` trên staging + đường ingest/điều chỉnh.
> Người audit: session hiện tại (chỉ đọc; **không sửa code/dữ liệu**).
> Yêu cầu owner: xác định giá DB đã khớp giá thật (đã hiệu chỉnh) của VCI/KBS chưa, hay đã bị vninvest corporate events điều chỉnh lần 2.

## Tóm tắt 5 finding nghiêm trọng nhất

1. **`DailyPrice.close` chính là giá đã hiệu chỉnh của VCI/KBS** — khớp provider khi gọi lại (TPB 2021-12-28: provider 16.449,97 = DB 16.449,97). Nó **không phải giá thô thị trường**.
2. **`DailyPrice.adj_close` bị điều chỉnh LẦN 2** bởi `corporate_actions/adjustment.py:100`: `adj_close = close × Π factor_total`. Với TPB cùng ngày: 16.449,97 → **5.075,12** (×0,3086) — thấp hơn ~3,2 lần so với giá đã chỉnh thật.
3. **Hệ số được tính từ chính giá đã chỉnh**: `adjustment.py:16-23 _prev_close` đọc `DailyPrice.close` (đã chỉnh) làm mẫu số ⇒ lỗi nhân đôi cả ở bước tính factor, không chỉ bước apply.
4. **Quy mô**: 2.250.542/4.584.956 dòng (49,1%) có `adj_close`; đối chiếu CafeF 4 năm (2020/2021/2022/2024): `close` khớp giá điều chỉnh CafeF **80,4–90,6%**, chỉ **11,9–22,4%** khớp giá thô; `adj_close` khớp CafeF điều chỉnh chỉ **0,5–1,0%**, median thấp hơn **31–45%**.
5. **Chuỗi giá provider không ổn định theo thời gian**: VNM 2019-12-23 gọi lại VCI trả 66.154,52 nhưng DB lưu 69.141,43 (VCI back-adjust lại khi có sự kiện mới) ⇒ DB là ảnh chụp tại thời điểm ingest, có drift ~4,5%.

---

## A. Bản đồ luồng dữ liệu

| Thành phần | file:line | Trách nhiệm |
|---|---|---|
| Lấy lịch sử provider | `packages/core/backend/src/market_data/vnbroker_adapter.py:748-769` | `fetch_daily_history` — chép `row['close']` (**:763**) nguyên vẹn từ VCI/KBS |
| Ghi DB | `packages/core/backend/src/data_ingest/tasks.py:653-704` (`_fetch_daily_history_with_retry`, `_classify_daily_price_rows`) | upsert vào `DailyPrice` với `source='vnbroker_<provider>'` (**:703**) |
| Model | `market_data/models.py:63-94` | `close`, `is_adjusted`, `adj_close`; **không có cột giá thô riêng** |
| Sự kiện | `market_data/corporate_actions/ingest.py:152-168` | lấy DIV/ISS từ VCI |
| Tính hệ số | `corporate_actions/adjustment.py:26-78` | `compute_adj_factors`; `_prev_close` **:16-23** đọc `DailyPrice.close` |
| Apply | `corporate_actions/adjustment.py:81-104` | **`adj_close = close × product` (:100)**; ghi `is_adjusted=True` (:101) |
| Orchestrator | `data_ingest/tasks.py:3480-3510` | `sync_corporate_actions` gọi compute + apply cho mọi symbol |
| Đọc/hiển thị | `stock_mgmt_native_views.py:1871+` (`/chart/`), `:4056+` (`/bars/`) | `/chart/` trả `close`; `/bars/` trả `adj_close` (flag bật) |

## B. Luồng đã trace (use-case TPB, ex-date 2026-10-02)

1. VCI trả `close` đã back-adjusted ⇒ adapter chép vào `DailyPrice.close` (`vnbroker_adapter.py:763`).
2. `CorporateAction` được ingest (`ingest.py:196-218`), sự kiện 2026-10-02 ISS 15% + DIV 500 ⇒ factor ~0,8336.
3. `compute_adj_factors` dùng `prev_close` = `DailyPrice.close` (đã chỉnh) (`adjustment.py:16-23,61`) ⇒ factor sai ngay từ đầu.
4. `apply_adjustments` nhân dồn và ghi `adj_close` (`adjustment.py:100-102`).
5. Kết quả DB 2021-12-28: `close=16.449,97` (khớp provider), `adj_close=5.075,12` (×0,3086) — **giá bị trừ hai lần**.

## C. CONTRADICTIONS

| Plan/doc | Thực tế | Tác động |
|---|---|---|
| `market_data/models.py:83` gọi `adj_close` = "Giá đóng cửa đã điều chỉnh" (ngầm hiểu duy nhất) | `close` cũng từ provider đã chỉnh; `adj_close` là lần 2 | Người đọc API nhầm `close` là giá thô |
| `capabilityProbe.ts:219` coi `adjCloseSource` = "có adj_close" ⇒ live | Có `adj_close` nhưng sai ⇒ capability báo xanh trong khi dữ liệu sai | False-green |
| `docs/evidence/widget-news-events/TPB_ADJUSTED_PRICE_COMPARISON_20261124.md:20` (kết luận cũ "chart hiện giá thô") | Bị refute bằng nến cũ; `close` là giá đã chỉnh | Kết luận cũ sai, đã đính chính ở `TPB_OLD_BARS_ADJUSTMENT_REVERIFY...md` |

## D. Findings

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| F-1 | P0 | `vnbroker_adapter.py:763`; `models.py:74` | `close` = provider adjusted | Không có giá thô trong DB; chart/indicator dùng giá đã chỉnh mà UI không nói | Đổi tên/document rõ `close` là provider-adjusted; nếu cần giá thô phải lưu cột riêng |
| F-2 | P0 | `adjustment.py:100-102` | `adj_close = close × factors` | Double-adjust, thấp 31–45% so với thật | **Ngừng apply** khi provider đã chỉnh; hoặc chỉ ghi `adj_close = close` |
| F-3 | P0 | `adjustment.py:16-23,61` | factor tính từ giá đã chỉnh | Sai cả hệ số, không chỉ lần nhân | Tính factor từ giá thô hoặc lấy factor từ provider |
| F-4 | P1 | `data_ingest/tasks.py:703` | source ghi đè theo provider cuối | VNM drift 4,5% giữa các lần fetch | Lưu snapshot + version/ngày lấy |
| F-5 | P1 | `stock_mgmt_native_views.py:4071-4072` | `/bars/` phơi `adj_close` sai | FE tiêu thụ giá sai nếu dùng field này | Flag + mô tả rõ nguồn |
| F-6 | P2 | `adjustment.py:89` | fail-closed reset khi có partial factor | Nhiều symbol có `adj_close=NULL` dù có event computed | Đã audit ở `AUDIT_PLAN_CA_NOOP...`, chờ owner |

## E. Số liệu đo (lệnh tái tạo trong evidence)

| Năm | Dòng CafeF | Khớp DB | `close`≈giá điều chỉnh | `close`≈giá thô | `adj_close`≈CafeF chỉnh | median `db_adj/CafeF_adj` |
|---|---|---|---|---|---|---|
| 2020 | 100.646 | 97.083 | 80,4% | 11,9% | 0,6% | 0,5551 |
| 2021 | 102.646 | 99.188 | 84,8% | 13,8% | 0,5% | 0,6353 |
| 2022 | 101.756 | 99.424 | 88,4% | 17,9% | 0,5% | 0,6894 |
| 2024 | 99.111 | 97.739 | 90,6% | 22,4% | 1,0% | 0,8294 |

Đối chiếu trực tiếp provider (gọi lại `fetch_daily_history`): TPB 2021-12-28 provider 16.449,97 = DB `close` 16.449,97; DB `adj_close` 5.075,12. VIC 2021-12-28 provider 49.200 = DB 49.200, `adj_close` NULL. VNM 2019-12-23 provider 66.154,52 ≠ DB 69.141,43.

## F. Câu hỏi cần owner chốt
1. Có dừng ngay `apply_adjustments` cho mọi symbol không (dữ liệu đang sai)?
2. `close` có được coi là "giá đã hiệu chỉnh" trong contract API không, hay cần thêm cột giá thô?
3. Xử lý drift VNM thế nào: backfill lại toàn bộ từ provider hay giữ snapshot?

## G. Đánh giá
**Chưa chính xác.** `close` khớp provider (đã chỉnh) nhưng `adj_close` bị điều chỉnh lần 2 — sai hệ thống. Không nên dùng `adj_close`/`is_adjusted` hiện tại cho indicator hay hiển thị. Ưu tiên P0: dừng apply + định nghĩa lại semantics; sau đó mới xét backfill/đối chiếu CafeF (đang DEFERRED theo owner).

> Ghi chú: báo cáo này chỉ audit. Không code/dữ liệu nào bị thay đổi. Mục hiệu chỉnh vẫn DEFERRED theo chỉ đạo owner 2026-11-24.
