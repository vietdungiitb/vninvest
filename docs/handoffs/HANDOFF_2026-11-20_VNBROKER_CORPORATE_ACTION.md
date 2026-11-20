# HANDOFF — vnbroker team: nguồn dữ liệu cổ tức / corporate action để auto-adjust giá

- **Ngày**: 2026-11-20 (bản sửa sau phản biện C1–C13; thay thế bản PR #455 đã merge)
- **Từ**: vninvest team · **Tới**: vnbroker package team
- **Trạng thái**: cần phản hồi/quyết định; vninvest đã khởi động plan B (parse-from-text sau feature flag) nên **không bị chờ** R1
- **Repo/phiên bản liên quan**: `vninvest` `dev@3845063a5:packages/core/backend/requirements.txt:38` → `vnbroker==3.7.2`
- **Evidence gốc**: `docs/AUDIT_VNBROKER_CORPORATE_ACTION_SOURCE_20261120.md` · `docs/AUDIT_MARKET_DATA_SYNC_20261120.md` · `docs/AUDIT_CORPORATE_ACTION_PHASE0_EVIDENCE_20261120.md` · ledger Entry 566/567/569
- **Quy ước citation**: `branch@sha:path:line`. Mặc định cho repo là `dev@3845063a5:`; riêng bars API chỉ có trên dev, **`main@117b2de98:` không có contract `adjusted:false`**. `file:line` trong §3 là của package `vnbroker==3.7.2` trong container staging.

---

## 1. TÓM TẮT (đọc trước)

Chúng tôi cần **trường dữ liệu corporate action có cấu trúc** (ngày quyền `ex_date`, loại sự kiện, số tiền cổ tức/tỉ lệ cổ phiếu) để tự động tính `adj_close` cho biểu đồ, MA, backtest và P&L. Hiện tại `vnbroker` **chỉ trả số tiền/tỉ lệ nằm trong chuỗi văn bản tiếng Việt** ở VCI `events()`, trong khi KBS `events()` trả rỗng và TCBS bị lỗi xác thực.

**Yêu cầu cốt lõi (P0)**: bổ sung/đảm bảo một API corporate-action thống nhất trả các field số đã tách sẵn, có `ex_date`, hỗ trợ nhiều provider có fallback, và định nghĩa rõ cách xử lý nhiều sự kiện cùng ngày quyền. Nếu không có field số, chúng tôi buộc phải regex tiểu đề — đây là nguồn sai số không chấp nhận được cho dữ liệu tài chính.

---

## 2. BỐI CẢNH PHÍA VNINVEST

| file:line (`dev@3845063a5:` trừ khi ghi rõ) | Hiện trạng |
|---|---|
| `dev@3845063a5:packages/core/backend/src/market_data/models.py:80` | `DailyPrice.is_adjusted` tồn tại nhưng `default=False`; grep gán `True` trong `src` = **0 hit** |
| `dev@3845063a5:packages/core/backend/src/market_data/stock_mgmt_native_views.py:4381-4384` | API bars trả `adjusted:false` + `'Bars chua dieu chinh co tuc (corporate actions).'` — **chỉ trên dev**; `main@117b2de98` không có key này |
| `dev@3845063a5:packages/core/backend/src/market_data/vnbroker_adapter.py:1188` / `main@117b2de98:.../vnbroker_adapter.py:1032` | Gọi `company.events()` qua facade mặc định ⇒ rỗng |
| `dev@3845063a5:packages/core/backend/src/data_ingest/tasks.py:790-796` | Upsert DailyPrice chỉ ghi `open/high/low/close/volume/source` — không có `adj_close` |

Hệ quả: return/MA/backtest sai quanh ngày chia cổ tức, cổ phiếu thưởng, phát hành quyền.

---

## 3. EVIDENCE TỪ PACKAGE `vnbroker` 3.7.2 (đã chạy thật)

### 3.1 Vị trí source & lệnh lấy version

```
docker exec vninvest-core-api python -c "import vnbroker,os;print(os.path.dirname(vnbroker.__file__))"
→ /usr/local/lib/python3.13/site-packages/vnbroker
→ __version__ = 3.7.2
```
Mọi `file:line` ở bảng §3.2 là đường dẫn **trong package 3.7.2 tại container**, tiền tố đầy đủ `/usr/local/lib/python3.13/site-packages/vnbroker/`.

### 3.2 Bảng provider

| Provider | file:line trong package | Kết quả probe (VNM, VCB, FPT) | Đánh giá |
|---|---|---|---|
| **VCI** | `vnbroker-3.7.2@container:explorer/vci/company.py:104-116` (`_fetch_news_events` → `/v1/news-events-for-chart?...eventCode=DIV,ISS`) và `:303-318` (`events()`) | VNM: 57 dòng có `exright_date`, 45 `DIV` + 12 `ISS`, `2010-02-09` → `2026-11-11` | ✅ **Khả thi nhất**, nhưng số tiền/tỉ lệ nằm trong `event_title_vi` |
| KBS | `vnbroker-3.7.2@container:explorer/kbs/company.py:580-645` (`events(event_type)` → `/event/{symbol}?eID=...`); `explorer/kbs/const.py:164-171` (`1 ĐHCĐ, 2 Trả cổ tức, 3 Phát hành, 4 Giao dịch nội bộ, 5 Khác`) | `(0,0)` cho cả 3 mã, kể cả `event_type=None` | ⚠️ Method có nhưng **probe với params hiện tại trả rỗng**, nguyên nhân chưa rõ (đang hỏi Q3) — không khẳng định provider không hỗ trợ |
| TCBS | `vnbroker-3.7.2@container:explorer/tcbs/company.py:469-492` (`dividends()` → `/v1/company/{symbol}/dividend-payment-histories`) | `ProviderAuthError`: "Token hết hạn/không hợp lệ hoặc provider từ chối quyền truy cập" | ❌ Cần hỗ trợ cấu hình token/quyền |
| DNSE | `vnbroker-3.7.2@container:explorer/dnse/company.py:257-265` → `empty_df`; `connector/dnse/client.py:612` + `services/account_service.py:56` → `get_corporate_action_history(account_no, market_type, ...)` | Method tồn tại nhưng **account-scoped**, cần `DNSEClient(api_key, api_secret)` + số tài khoản | ❌ Không phải feed thị trường công khai; không thay được VCI. Đã probe 3.7.2 (xem evidence Phase 0 §2) |
| SSI | `vnbroker-3.7.2@container:explorer/ssi/company.py:229-237` | `empty_df(_EVENTS_COLUMNS)` / `_DIVIDENDS_COLUMNS` | ❌ Theo thiết kế |
| Facade | `vnbroker-3.7.2@container:common/data.py:308-345` (`_call_with_fallback`), `:1092`; `api/company.py:179-180` | Mặc định KBS → fallback providers rỗng → kết quả rỗng | ⚠️ Giải thích vì sao audit cũ kết luận "không có nguồn" |

### 3.3 Dữ liệu VCI thực tế (trích)

```text
DIV  2024-09-24  Trả cổ tức bằng tiền mặt - Đợt 4 2023 - 950 VND
DIV  2024-09-24  Trả cổ tức bằng tiền mặt - Đợt 1 2024 - 1,500 VND
DIV  2025-05-14  Trả cổ tức bằng tiền mặt - Đợt 3 2024 - 2,000 VND
ISS  ...         Phát hành cổ phiếu - Cổ phiếu thưởng tỉ lệ 50.0%
```

Thống kê parse trên VNM: `TOTAL 57 · CASH_PARSE 45 · PCT_PARSE 7 · UNPARSED 5`.

### 3.4 Lệnh tái tạo

```bash
docker exec vninvest-core-api python -c "
from vnbroker.explorer.vci.company import Company as VCI
df = VCI('VNM').events(from_date='20100101', event_codes='DIV,ISS')
ev = df[df['exright_date'].notna()]
print(len(ev), ev['event_code'].value_counts().to_dict())
print(ev[['event_code','exright_date','event_title_vi']].head(10).to_dict('records'))
"
```

---

## 4. CÁC VẤN ĐỀ CẦN ĐỘI VNBROKER XỬ LÝ

| ID | Mức | Vấn đề | Yêu cầu cụ thể |
|---|---|---|---|
| R1 | **P0** | Số tiền/tỉ lệ chỉ nằm trong `event_title_vi` (text tự do) | Trả field số: `cash_amount_per_share`, `stock_ratio_pct` (Decimal/float) ngay trong DataFrame `events()`/`dividends()`; giữ `raw_title` để trace |
| R2 | **P0** | Không có API corporate-action thống nhất, fallback ngầm qua provider rỗng | Cung cấp `corporate_actions(symbol, from_date, to_date)` (hoặc tương đương) trả schema ổn định, có `source`, `ex_date`, dedup theo `source_event_id`, order by `ex_date` |
| R3 | **P0** | Nhiều sự kiện cùng `ex_date` (VNM `2024-09-24` có 950 + 1.500 VND) | Định nghĩa semantics: gộp hay giữ riêng? Nếu gộp, cần field `group_id`/`combined_amount`; nếu giữ riêng, client phải tự cộng — phải ghi rõ trong docs |
| R4 | P1 | KBS `events()` trả rỗng dù có method | Điều tra endpoint `/event/{symbol}?eID=...`; nếu provider đổi API, cập nhật adapter hoặc ghi rõ "không còn hỗ trợ" để client không fallback vô ích |
| R5 | P1 | TCBS `ProviderAuthError` | Hỗ trợ cấu hình token (env/config) hoặc tài liệu hóa cách cấp quyền `dividend-payment-histories`; trả lỗi có mã `PROVIDER_AUTH` kèm hướng dẫn thay vì fail chung |
| R6 | P1 | 5/57 event VNM không parse được ("Phát hành cho CBCNV", "Phát hành riêng lẻ") | Có cờ `is_amount_known`/`parse_status` và **không** suy diễn số; client cần biết chắc event nào thiếu để giữ `adjusted:false` |
| R7 | P1 | Độ sâu lịch sử & giới hạn | Xác nhận phạm vi `from_date` tối thiểu (chúng tôi cần từ `2010-01-01`), giới hạn số bản ghi/lần gọi, rate limit, TTL cache khuyến nghị |
| R8 | P2 | Chưa có factor/adj_close series | Nếu package có thể trả `adj_factor(symbol, from, to)` hoặc `adj_close` theo ex-date, chúng tôi ưu tiên dùng thay vì tự tính |

---

## 5. CONTRACT DỮ LIỆU ĐỀ XUẤT

`CorporateActionEvent` (mỗi dòng = một sự kiện gốc, không gộp mất dữ liệu):

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `symbol` | str | ✅ | Mã chứng khoán, uppercase |
| `action_type` | enum `DIV`,`ISS` | ✅ | DIV=cổ tức tiền, ISS=phát hành/cổ phiếu thưởng. `SPLIT`/`RIGHTS` **không có** trong VCI 3.7.2 (probe: trả tin tức, không có `event_code`) — nếu đối tác có nguồn khác, vui lòng xác nhận (Q8) |
| `ex_date` | date (ISO `YYYY-MM-DD`) | ✅ | Ngày quyền; **field bắt buộc để tính adjust** |
| `record_date` | date\|null | ⬜ | Ngày chốt danh sách |
| `payment_date` | date\|null | ⬜ | Ngày chi trả |
| `cash_amount_per_share` | Decimal\|null | ⬜ | VND/cổ phiếu; null nếu không phải DIV tiền |
| `stock_ratio_pct` | Decimal\|null | ⬜ | % cổ phiếu thưởng/phát hành thêm |
| `currency` | str | ⬜ | Mặc định `VND` |
| `source` | enum `VCI`,`KBS`,`TCBS` | ✅ | Provider nguồn |
| `source_event_id` | str | ✅ | Id để dedup/idempotent |
| `raw_title` | str | ⬜ | Tiêu đề gốc để audit |
| `parse_status` | enum `structured`,`parsed_from_text`,`unparsed` | ✅ | **Enum duy nhất** (thay cho `{cash,ratio,unparsed}` ở audit cũ). `unparsed` ⇒ client không được đoán số |
| `fetched_at` | datetime | ✅ | Thời điểm lấy |

Bổ sung khuyến nghị: 2 cờ độc lập `cash_parsed: bool`, `ratio_parsed: bool` để biểu diễn event VCB vừa tiền vừa tỉ lệ (một dòng hoặc 2 dòng cùng `ex_date` — cần đối tác xác nhận), trong khi `parse_status` vẫn là nguồn sự thật duy nhất.

Ví dụ kỳ vọng cho 2 dòng VNM cùng ex-date (không tự gộp mất gốc):

```json
[
  {"symbol":"VNM","action_type":"DIV","ex_date":"2024-09-24","cash_amount_per_share":950,
   "source":"VCI","source_event_id":"...","parse_status":"parsed_from_text","raw_title":"Trả cổ tức bằng tiền mặt - Đợt 4 2023 - 950 VND"},
  {"symbol":"VNM","action_type":"DIV","ex_date":"2024-09-24","cash_amount_per_share":1500,
   "source":"VCI","source_event_id":"...","parse_status":"parsed_from_text","raw_title":"Trả cổ tức bằng tiền mặt - Đợt 1 2024 - 1,500 VND"}
]
```

---

## 6. CÁCH VNINVEST SẼ DÙNG (để đội package hiểu mục đích field)

Với ngày quyền `d`, giá đóng cửa trước đó `P_prev`, và mọi event có `parse_status != unparsed` trong cùng ngày `d`:

- Cổ tức tiền: `factor_cash = (P_prev - Σ cash_amount_per_share) / P_prev`
- Cổ phiếu thưởng / phát hành: `factor_stock = 1 / (1 + Σ stock_ratio_pct / 100)`
- `factor_total(d) = factor_cash × factor_stock`
- `adj_close(t) = close(t) × ∏ factor_total(d) với mọi ex_date d > t`

Trong đó `P_prev` = raw close của **phiên giao dịch liền trước** `ex_date` (không phải `ex_date - 1` ngày lịch); factor dùng `Decimal(28,10)`, tiền `Decimal(18,2)`; nếu `Σ cash ≥ P_prev` hoặc tỉ lệ ≤ -100 ⇒ không sinh factor (log cảnh báo, giữ `adjusted:false`).

`close` gốc **không bị ghi đè**. Với event `unparsed`: chỉ flag `adjusted:false + note` cho **ex_date bị ảnh hưởng và đoạn lịch sử phụ thuộc factor đó** (per-date), không vô hiệu hoá toàn bộ mã — nếu không, VNM với 5/57 event unparsed sẽ không bao giờ được adjust. Không tự suy diễn số cho event unparsed.

---

## 7. BỘ DỮ LIỆU KIỂM THỬ ĐỀ XUẤT

| Symbol | Tình huống | Kỳ vọng |
|---|---|---|
| VNM | 2 DIV cùng `2024-09-24` (950 + 1.500 VND, **2 `id` VCI khác nhau**) | 2 event gốc, tổng = `Σ cash_amount_per_share` — **số tiền chưa đối chiếu độc lập**, không fix số cứng; dedup theo `source_event_id`, không double-count |
| FPT | ISS `Cổ phiếu thưởng tỉ lệ 15.0%` | `stock_ratio_pct = 15.0`, factor = 1/1.15 (làm tròn `Decimal(28,10)`) |
| VCB | ISS `49.5%` + DIV `450 VND` **cùng `ex_date`** (tách 2 dòng) | Cả 2 event, `factor_total = factor_cash × factor_stock`, assert số cụ thể |
| VNM | 5 event "Phát hành cho CBCNV"/"riêng lẻ" | `parse_status = unparsed`, không tự gán tỉ lệ |
| Mã không có sự kiện | `events()` trả rỗng có schema | Không crash, client giữ `adjusted:false` |

---

## 8. ACCEPTANCE CRITERIA (Given/When/Then)

- **AC1** — Given symbol VNM và `from_date=2010-01-01`; When gọi API corporate actions; Then trả ≥57 event có `ex_date` từ 2010, kèm `source`, `source_event_id`, `parse_status`.
- **AC2** — Given event DIV có title "... 1,500 VND"; When trả kết quả; Then `cash_amount_per_share = 1500` dạng số, không phải chuỗi.
- **AC3** — Given 2 event cùng `ex_date` với `source_event_id` khác nhau; When trả kết quả; Then semantics gộp/không gộp được document rõ, client reproduce total = `Σ cash_amount_per_share` sau dedup; **không** chốt số cứng khi chưa có đối chiếu độc lập (xem Q2). Cùng `source_event_id` ⇒ update, không cộng.
- **AC4** — Given event ISS không có tỉ lệ; When trả kết quả; Then `stock_ratio_pct = null`, `parse_status = unparsed`, không có suy diễn.
- **AC5** — Given TCBS chưa có token; When gọi `dividends()`; Then lỗi có mã `PROVIDER_AUTH` + hướng dẫn cấu hình (không phải exception chung).
- **AC6** — Given provider chính trả rỗng; When có fallback; Then fallback được ghi rõ trong field `source` và không trả lặp event.
- **AC7** — Given cùng `source_event_id` gọi lại nhiều lần; Then kết quả idempotent (không tạo bản ghi trùng phía client).

---

## 9. NON-GOALS / PHẠM VI PHÍA VNINVEST

- Chúng tôi **không** yêu cầu package tính `adj_close` nếu R1–R3 chưa xong; fallback hiện tại (`adjusted:false + note`) vẫn giữ nguyên.
- Chúng tôi **sẽ** xây model `CorporateAction`, task sync và adjustment engine theo **plan B: parse-from-text có `parse_status` + feature flag `CORPORATE_ACTIONS_ENABLED` (default `False`)** — swap sang field số của đối tác khi R1 xong. Không chờ contract ổn định mới implement (phản biện C11).
- Không tự ý tích hợp feed khác (VSDC/HOSE) khi chưa có quyết định owner.

---

## 10. CÂU HỎI CẦN VNBROKER TEAM PHẢN HỒI

1. VCI có thể trả `cash_amount_per_share`/`stock_ratio_pct` dạng số trong bao lâu? (Ưu tiên P0)
2. Hai DIV cùng `2024-09-24` của VNM là dữ liệu đúng hay trùng provider? Semantics gộp thế nào?
3. KBS `events()` trả rỗng do API provider đổi hay do tham số `eID`/`p`/`s` sai?
4. Có thể cung cấp token/quyền TCBS cho môi trường staging để đối chiếu chéo không?
5. Phạm vi `from_date` tối thiểu và rate limit của VCI `news-events-for-chart` là bao nhiêu?
6. Có kế hoạch trả `adj_factor`/`adj_close` series theo ex-date không, hay client tự tính là chuẩn?
7. VCI `events()` trả cột `id` (hex 24). ID này có **ổn định vĩnh viễn** và có bị reuse cho nội dung khác không? Chúng tôi đã dùng làm `source_event_id` (probe 2 lần cùng ID).
8. `P_prev` nên là raw close phiên liền trước ex_date và precision `Decimal(28,10)` có phù hợp kỳ vọng đối tác không? Có event `SPLIT`/`RIGHTS` ở nguồn nào khác không (VCI 3.7.2 chỉ có `DIV,ISS`)?
9. `get_corporate_action_history` của DNSE là API theo tài khoản — đối tác có feed **thị trường công khai** nào trả field số (không cần `account_no`) để đối chiếu chéo VCI không?

---

## 11. TIẾP NHẬN & LIÊN LẠC

- Người nhận: vnbroker package team (thông qua owner vninvest).
- vninvest đã chốt nội bộ (Phase 0): parse text tạm thời sau flag (D1 `Σ cash` động, D2 per-date, D4 dùng VCI `id`, D5 `P_prev`/precision, D6 `DIV,ISS`). Còn chờ đối tác: **Q1–Q9 (tất cả)** — trong đó Q3 đang được hỏi, Q4/Q5/Q6 chưa có câu trả lời; Q7/Q8/Q9 là câu hỏi mới từ Phase 0. Chưa có câu nào được đóng bởi phản hồi chính thức.
- vninvest mở slice `feat/corporate-actions` (model + ingest + adjustment engine + test golden VNM/FPT/VCB) theo workflow-dev-loop vninvest; bản sửa này thay thế nội dung đã merge ở PR #455 (sẽ có PR mới).
