# Văn bản yêu cầu chính thức gửi dự án vnbroker

- **Ngày:** 2026-10-14 · **Từ:** vninvest (PM/Tech Lead) · **Trạng thái:** CHƯA GỬI
- **Căn cứ:** ADR-006 (broker SSOT qua vnbroker) · vnbroker đang dùng: **3.7.2**
- **Quy tắc:** vninvest không tự phát triển logic broker; thiếu gì yêu cầu ở đây.

## VNBROKER-REQ-001 — `capabilities()` machine-readable theo lane [P1]

- **Vấn đề:** vninvest cần biết method nào thật / method nào đã gỡ (`_REMOVED_PATHS`
  nội bộ ở `broker/tcbs/equity.py:50-58`, `broker/tcbs/account.py`) mà không có API
  chính thức — hiện chỉ phát hiện bằng try/except lúc chạy (sai fail-closed).
- **Yêu cầu:** `BrokerRegistry.capabilities(provider) -> {version, methods: {name:
  {supported: bool, reason_code: str}}}`. Version để client phát hiện cache cũ.
- **Nghiệm thu:** gọi trên 3 lane không cần credential; method removed hiện
  `supported: false` đúng 100% danh sách `_REMOVED_PATHS` hiện tại.

## VNBROKER-REQ-002 — TCBS order history nhiều ngày [P2, có điều kiện]

- **Vấn đề:** `TCBSBrokerClient.get_order_history` RAISE (`equity.py:169-183`) do path
  `/aion/.../orders/history` không có trong 2 tài liệu TCBS chính thức. Đối soát TCBS
  của vninvest bị giới hạn trong ngày (`get_orders`) + đã khớp (`get_executions`).
- **Yêu cầu:** khôi phục **khi và chỉ khi** probe server chứng minh path sống
  (quyết định thuộc Owner vnbroker; không khôi phục đoán mò). Nếu path chết thật, cung
  cấp alternative chính thức (vd phân trang `get_executions` theo ngày).
- **Nghiệm thu:** đọc được lịch sử khớp ≥ 30 ngày trên tài khoản TCBS thật, hoặc văn bản
  xác nhận path đã chết + alternative.

## VNBROKER-REQ-003 — Khai báo + lộ trình watchlist [P1 khai báo / P3 API]

- **Vấn đề:** cả 3 provider đều không có API watchlist user (kết luận
  `docs/RESEARCH_WATCHLIST_BROKER_20261014.md` mục 0–4). vninvest cần khai báo trung
  thực để UI không bao giờ hứa sai.
- **Yêu cầu:** (a) `WatchlistCapability = unsupported` cho cả 3 lane trong registry;
  (b) khi provider mở API (mẫu IBKR `GET /iserver/watchlist`), cung cấp
  `get_watchlist / create_watchlist / update_watchlist / delete_watchlist` chuẩn 3 lane.
- **Nghiệm thu:** (a) capability trả `unsupported` đúng; (b) CRUD watchlist 2 chiều khi
  provider có API. **Cấm** reverse-engineer web private (R-W2).

## VNBROKER-REQ-004 — Tài liệu hoá `market_type` của DNSE `get_positions` [P2]

- **Vấn đề:** `DNSEClient.get_positions(account_no, market_type)` (`connector/dnse/
  client.py:310`) bắt buộc `market_type` nhưng không tài liệu hoá tập giá trị hợp lệ;
  vninvest đang retry mù `ALL/STOCK/EQUITY` (`vnbroker_dnse_compat.py:113`).
- **Yêu cầu:** hằng `MARKET_TYPES` + docstring liệt kê giá trị + hành vi khi sai.
- **Nghiệm thu:** truyền sai giá trị nhận lỗi có mã (không phải response rỗng im lặng).

## VNBROKER-REQ-005 — Hút `vnbroker_dnse_compat` về vnbroker (nợ kỹ thuật) [P2]

- **Vấn đề:** vninvest đang tự chuẩn hoá DataFrame/list/dict + retry market_type trong
  `user_workspace/vnbroker_dnse_compat.py` — đúng loại logic thuộc về vnbroker (ADR-006).
- **Yêu cầu:** vnbroker cung cấp normalize + `market_type` fallback trong
  `DNSEClient` (hoặc module compat chính thức); vninvest xoá file của mình.
- **Nghiệm thu:** xoá `vnbroker_dnse_compat.py` khỏi vninvest, toàn bộ test DNSE xanh.

## Theo dõi trạng thái

| REQ | Nội dung | Ưu tiên | Trạng thái 2026-10-14 |
|---|---|---|---|
| 001 | `capabilities()` theo lane | P1 | **vnbroker ĐÃ LÀM** (`broker/capabilities.py`, class-level, JSON) + sửa 3 lỗi AC. vninvest: CHƯA ÁP DỤNG (đợi merge + bump 3.8.0) |
| 002 | TCBS order history | P2 (điều kiện) | **Văn bản, không code** — path không có trong spec; SSI/DNSE đã có history. vninvest: giữ giới hạn TCBS in-day + executions |
| 003 | Watchlist | P1/P3 | **003a ĐÃ LÀM** (`unsupported` + contract test); **003b mở** (không có API để gọi). vninvest: ADR-007, không ticket CRUD |
| 004 | DNSE `market_type` docs | P2 | **vnbroker ĐÃ LÀM, mở rộng** (`MARKET_TYPES={STOCK,DERIVATIVE}` + `ORDER_CATEGORIES`). vninvest: bỏ retry mù khi adopt 3.8.0 |
| 005 | Hút compat DNSE về | P2 | **vnbroker ĐÃ LÀM, thu hẹp** (`normalize_payload` + `get_*_all_markets`). vninvest: xoá compat trong Wave 1 + sửa 2 bug P0 (balance 0, retry chết) |

> Nguồn: `vnbroker/docs/RESPONSE_TO_VNINVEST_20261014.md` @ `f6cf68b` (nhánh
> `feat/vninvest-req-20261014`, **chưa merge**, CHANGELOG `Unreleased`).
> Đã kiểm chứng độc lập: 26 contract test passed + probe `capabilities()`.
> **Gate: chỉ áp dụng sau khi vnbroker merge + bump 3.8.0** (`requirements.txt`
> vẫn ghim `3.7.2`).
