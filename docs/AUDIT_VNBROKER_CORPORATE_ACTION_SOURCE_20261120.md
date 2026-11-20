# AUDIT — Nguồn corporate actions trong `vnbroker` cho auto-adjust cổ tức (2026-11-20)

> Scope: package `vnbroker==3.7.2` (`packages/core/backend/requirements.txt:38`) đang cài trong container staging `/usr/local/lib/python3.13/site-packages/vnbroker`. Không có clone repo local; đây là mã nguồn phiên bản đang chạy. Read-only + live probe, có `file:line` và lệnh tái tạo. Khung: AGENTS.md §4.

## TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **VCI LÀ NGUỒN KHẢ THI**, KBS không. Probe với `VNM/VCB/FPT`: KBS `events(event_type=2)` trả `(0,0)` cho cả 3 mã (`kbs/company.py:580-645` tồn tại nhưng endpoint rỗng), trong khi VCI `events(from_date='20100101', event_codes='DIV,ISS')` trả **57 sự kiện có `exright_date`** cho VNM (45 DIV + 12 ISS), cũ nhất `2010-02-09`, mới nhất `2026-11-11`.
2. **VCI có cấu trúc đủ để adjust**: `event_code` (`DIV`/`ISS`), `exright_date` (ngày quyền), `event_name_vi`, `event_title_vi` chứa số tiền/tỉ lệ (`vci/company.py:303-318`, `:104-116`). Ví dụ `Trả cổ tức bằng tiền mặt - Đợt 3 2024 - 2,000 VND`, `Phát hành cổ phiếu - Cổ phiếu thưởng tỉ lệ 50.0%`.
3. **Số tiền/tỉ lệ nằm trong văn bản tự do**, không có cột số — parse bằng regex. Với VNM: 45/57 parse được tiền (`\d[\d,]* VND`), 7/57 parse được `%`, **5/57 không parse được** (các dòng "Phát hành cho CBCNV", "Phát hành riêng lẻ") ⇒ phải lưu `raw_title` + trạng thái parse, không được suy diễn.
4. **Trùng `exright_date` là thường lệ**: VNM có 2 DIV cùng ngày (vd `2024-09-24`: 950 VND đợt 4/2023 + 1.500 VND đợt 1/2024) ⇒ factor phải **cộng tiền cùng ngày** rồi nhân dồn, không chạy từng dòng riêng lẻ.
5. **Các provider khác không khả thi ngay**: KBS rỗng; TCBS `dividends()` (`tcbs/company.py:469-492`) bị `ProviderAuthError` (token hết hạn/không có quyền); DNSE (`dnse/company.py:257-265`) và SSI (`ssi/company.py:229-237`) trả DataFrame rỗng theo thiết kế; facade `Company.events()` (`common/data.py:1092`, `api/company.py:179`) fallback qua các provider này ⇒ kết quả rỗng như audit cũ đã thấy.

## A. BẢN ĐỒ NGUỒN

| file:line (trong package) | Vai trò | Kết quả probe |
|---|---|---|
| `vnbroker/explorer/vci/company.py:104-116` | `_fetch_news_events()` → `GET /v1/news-events-for-chart?ticker=...&eventCode=DIV,ISS` | Có data, mặc định 120 ngày; truyền `from_date='20100101'` lấy được lịch sử dài |
| `vnbroker/explorer/vci/company.py:303-318` | `events()` → DataFrame, đổi ms→`YYYY-MM-DD` cho `exright_date` | 57 dòng có ex-date (VNM) |
| `vnbroker/explorer/kbs/company.py:580-645` | `events(event_type=1..5)` → `GET /event/{symbol}?eID=...` | `(0,0)` cho VNM/VCB/FPT dù method/chú thích có ví dụ `event_type=2` |
| `vnbroker/explorer/kbs/const.py:164-171` | `_EVENT_TYPE` = 1 ĐHCĐ, 2 Trả cổ tức, 3 Phát hành, 4 Giao dịch nội bộ, 5 Khác | Có nghĩa nhưng endpoint trả rỗng |
| `vnbroker/explorer/tcbs/company.py:469-492` | `dividends()` → `/v1/company/{symbol}/dividend-payment-histories` | `ProviderAuthError` — cần token TCBS |
| `vnbroker/explorer/dnse/company.py:257-265`, `ssi/company.py:229-237` | `events()` / `dividends()` | Trả empty_df có chủ đích |
| `vnbroker/common/data.py:308-345` | `_call_with_fallback()` — th provider kế tiếp khi rỗng | Giải thích vì sao facade trả rỗng |
| `packages/core/backend/src/market_data/vnbroker_adapter.py:1186-1204` | Code vninvest hiện tại gọi `company.events()` (default KBS) | ⇒ rỗng, dẫn tới kết luận cũ "không có nguồn" |

## B. LỆNH TÁI TẠO (trên VPS, docker exec container core-api)

```bash
docker exec vninvest-core-api python -c "
from vnbroker.explorer.vci.company import Company as VCI
df = VCI('VNM').events(from_date='20100101', event_codes='DIV,ISS')
ev = df[df['exright_date'].notna()]
print(ev[['event_code','exright_date','event_title_vi']].head(8).to_dict('records'))
"
```
Kết quả thật (trích):
```
{'event_code':'DIV','exright_date':'2024-09-24','event_title_vi':'Trả cổ tức bằng tiền mặt - Đợt 4 2023 - 950 VND'}
{'event_code':'DIV','exright_date':'2024-09-24','event_title_vi':'Trả cổ tức bằng tiền mặt - Đợt 1 2024 - 1,500 VND'}
{'event_code':'DIV','exright_date':'2025-05-14','event_title_vi':'Trả cổ tức bằng tiền mặt - Đợt 3 2024 - 2,000 VND'}
{'event_code':'ISS','exright_date':'...','event_title_vi':'Phát hành cổ phiếu - Cổ phiếu thưởng tỉ lệ 50.0%'}
```
Thống kê parse trên VNM: `TOTAL 57 · CASH_PARSE 45 · PCT_PARSE 7 · UNPARSED 5`.

## C. CONTRADICTIONS

| Tài liệu cũ | Thực tế hôm nay | Tác động |
|---|---|---|
| `docs/evidence/closeout-dot1-20261113/qb2-probe.md:28`: `Company.events()` rỗng ⇒ chọn nhánh B (`adjusted:false+note`) | Probe đó dùng facade mặc định (KBS). VCI `events()` có 57 sự kiện thật | Kết luận "không có nguồn" là **đúng với KBS, sai với VCI** — cần mở lại quyết định B-3 |
| `docs/BACKEND_QA_ANSWERS_QB1_QB4_2026-11-12.md:40,45`: "không có bảng/model corporate actions; Company.events() ứng viên nhưng CHƯA XÁC MINH" | Nguồn VCI đã được xác minh bằng probe; vẫn chưa có model | Phần "chưa xác minh" nay chuyển thành "đã xác minh, bị block bởi parse + thiết kế model" |
| `docs/AUDIT_MARKET_DATA_SYNC_20261120.md` MDS-01 (write doc trước khi có probe này) | Có nguồn khả thi | Cần đính chính MDS-01: không còn "blocked bởi nguồn", mà blocked bởi effort parse/model |

## D. FINDINGS / ĐỀ XUẤT

| ID | Mức | file:line | Thực tế | Đề xuất |
|---|---|---|---|---|
| VCA-01 | INFO | `vci/company.py:104-116,303-318` | Nguồn DIV/ISS có ex-date + amount dạng text | Dùng VCI làm nguồn ingest corporate actions |
| VCA-02 | HIGH | `vnbroker_adapter.py:1186-1204` | Facade mặc định KBS ⇒ rỗng | Thêm `fetch_corporate_actions(symbol, from_date)` gọi trực tiếp `vnbroker.explorer.vci.company.Company(symbol).events(from_date, event_codes='DIV,ISS')`, không qua facade |
| VCA-03 | HIGH | probe VNM 2 DIV cùng `2024-09-24` | Cần cộng tiền cùng ex-date | Factor = ∏[(P_prev - Σcash)/P_prev] × ∏[1/(1+ratio)] theo ex_date; lưu từng event + group key |
| VCA-04 | MED | 5/57 title không parse được | Không được suy diễn | Model có `raw_title`, `parse_status ∈ {cash, ratio, unparsed}`; unparsed ⇒ giữ `adjusted:false+note` cho symbol/ngày đó |
| VCA-05 | MED | `kbs/company.py:580-645`, `tcbs/company.py:469-492` | KBS rỗng, TCBS lỗi auth | Không phụ thuộc KBS/TCBS; có thể probe lại sau khi owner cung cấp token TCBS (dự phòng đối chiếu chéo) |

## E. LỘ TRÌNH ĐỀ XUẤT (chưa implement — cần owner chốt)

1. Model `CorporateAction(symbol, ex_date, action_type∈{DIV,ISS}, cash_amount, ratio_pct, raw_title, parse_status, source='VCI', fetched_at)` + unique `(symbol, ex_date, action_type, raw_title)`. Migration do `makemigrations` sinh.
2. Task `sync_corporate_actions` (beat nightly) + CLI backfill `from_date='2010-01-01'` cho mọi symbol active; idempotent.
3. Engine tính `adj_factor` theo ex_date (cộng tiền trùng ngày, nhân dồn tỉ lệ); lưu `DailyPrice.adj_close` hoặc bảng riêng — **không ghi đè `close` thô**.
4. API bars (`stock_mgmt_native_views.py:4381-4384`): trả `adj_close` + `adjusted:true` khi có factor; giữ `adjusted:false + note` khi unparsed (fallback hiện tại).
5. Test golden với VNM (2 DIV cùng ngày), FPT (ISS 15%), VCB (cash 450 VND + stock 49.5%).

## F. CÂU HỎI CẦN OWNER CHỐT

1. Chấp nhận parse số cổ tức từ `event_title_vi` (văn bản tự do) làm nguồn chính, hay yêu cầu feed có cột số (TCBS khi có token)?
2. Với 5/57 event không parse được: hiển thị cảnh báo hay vẫn giữ `adjusted:false` cho toàn bộ lịch sử mã đó?
3. Hai DIV cùng ex-date (VNM) có phải cộng dồn không, hay dữ liệu VCI đang trùng lặp cần đối chiếu nguồn khác?
4. Có cần lưu lịch sử điều chỉnh theo `ex_date` dạng bảng riêng (recompute được) hay chỉ materialize `adj_close`?

## G. KẾT LUẬN

**Có nguồn khả thi: VCI.** Đây là thay đổi đáng kể so với kết luận cũ ("không có nguồn"). KBS có method nhưng trả rỗng; TCBS bị chặn auth. VCI cho đủ ngày quyền + loại sự kiện + số tiền/tỉ lệ (dạng text), phù hợp để xây pipeline corporate action tự động. Rủi ro nằm ở parse và trùng ex-date — đều xử lý được bằng model + test golden. Trước khi code cần owner chốt 4 câu hỏi trên; không tự tích hợp feed khi chưa có quyết định.

**Gates**: doc-only/read-only — lint/build/test **CHƯA CHẠY** trong slice này (không đổi source).
