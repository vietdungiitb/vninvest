# AUDIT — Phản biện độc lập chẩn đoán & 3-slice plan của vnbroker (2026-11-20)

- **Scope**: chẩn đoán + plan 3 slice do phía vnbroker soạn cho nguồn corporate action (`R1–R8` trong `docs/handoffs/HANDOFF_2026-11-20_VNBROKER_CORPORATE_ACTION.md`).
- **Auditor**: độc lập, read-only; không sửa code vnbroker, không khai claim, không chạy gate phát hành.
- **Nguồn đã mở**:
  - `vnbroker@main:eac374b` (`D:\Mujoco Projects\vnbroker`, `pyproject.toml:7` → **3.8.0**, `git status` sạch).
  - `vnbroker-3.7.2@container` trong `vninvest-core-api` (phiên bản **vninvest đang pin**).
  - `dev@0ce7a99b0:packages/core/backend/requirements.txt:38` → `vnbroker==3.7.2`.
  - `docs/LESSONS/{broker-risk,evidence}.md` của vnbroker (L-R04, L-R05, L-E01..L-E07).
- **Quy ước citation**: `repo@branch:sha:path:line`; package trong container: `vnbroker-3.7.2@container:path:line`.

## TÓM TẮT 5 FINDING NGHIÊM TRỌNG NHẤT

1. **BLOCKER — Version trap**: plan được viết trên clone local **3.8.0** (`vnbroker@main:eac374b:pyproject.toml:7`), nhưng vninvest pin **3.7.2** (`dev@0ce7a99b0:...requirements.txt:38`). Dù 3 slice code xong, **không có tác dụng gì** với vninvest cho tới khi release + bump pin + re-verify. Plan thiếu slice này.
2. **MAJOR — Parser nhầm ESOP thành cổ phiếu thưởng**: rule `DIV + % ⇒ unparsed` đúng, nhưng `ISS + % ⇒ stock_ratio_pct` là **sai**. Probe 3.7.2 cho FPT: `ISS 2024-10-09 Phát hành cho CBCNV tỉ lệ 0.5%`, `0.2%` (và các năm 2025/2026). Đây là phát hành cho nhân viên, không phải cổ phiếu thưởng làm đổi giá niêm yết. Cần giới hạn `stock_ratio_pct` cho title chứa `Cổ phiếu thưởng` / `Trả Cổ tức bằng Cổ phiếu`; các dòng `Phát hành cho CBCNV tỉ lệ` ⇒ `unparsed`. **vninvest parser hiện tại (`corp-actions` PR #458) cũng dính lỗi này** — phải sửa cả hai bên.
3. **MAJOR — Golden VCB sai sự thật**: handoff §7 ghi VCB `ISS 49.5% + DIV 450 VND` "cùng `ex_date`". Probe: ISS 49.5% ngày `2025-03-12`, DIV 450 VND ngày `2025-10-03` — **khác ex_date, cách nhau 7 tháng**. Test fail-before của plan dùng fixture "cùng kỳ" sẽ xanh giả. Ngược lại VNM có 3 cặp cùng ex_date thật (`2023-08-03`, `2024-09-24`, `2025-10-16`) — mới là fixture đúng cho R3.
4. **MAJOR — "TCBS lỗi chỉ là docs" đúng một nửa**: auth thực sự hỗ trợ `TCBS_JWT_TOKEN` (`vnbroker@main:eac374b:vnbroker/explorer/tcbs/auth.py:42-55`, `vnbroker/core/provider_pool.py:44`) và `ProviderAuthError.error_code='PROVIDER_AUTH'` (`core/exceptions.py:374-394`). **Nhưng** docs vẫn dạy sai: `explorer/tcbs/IMPLEMENTATION_SUMMARY.md:146` và `MIGRATION_GUIDE.md:36,44,47` ghi `TCBS_AUTH_TOKEN=your-jwt-token`. Thông báo lỗi của `dividends()` (`explorer/tcbs/company.py:468-499`) cũng không nhắc `TCBS_JWT_TOKEN` (chỉ `bars.py:357`, `quote.py:476,766` có). Slice 3 phải sửa **cả 2 doc + message**, không chỉ 1 chỗ.
5. **MAJOR — `source_event_id` chưa đủ điều kiện làm khóa duy nhất**: plan pass-through VCI `id` là đúng hướng (probe 2 fetch cùng ID), nhưng độ ổn định dài hạn (Q7) chưa ai trả lời. `group_id=(symbol, ex_date)` dạng tuple không serialize được sang JSON/DataFrame contract. Cần định nghĩa `group_id` dạng chuỗi `f"{symbol}:{ex_date}"` và ghi rõ "không dedup theo tiêu đề; 2 DIV cùng ex_date là 2 dòng riêng".

## A. VERIFY TỪNG CITATION/TRONG CHẨN ĐOÁN

| Chẩn đoán | Citation | Kết quả verify |
|---|---|---|
| VCI lấy raw `news-events-for-chart`, default `DIV,ISS` | `vnbroker@main:eac374b:explorer/vci/company.py:104-119` | ✅ Đúng (`:111-113`). 3.7.2 tương đương `:104-116` |
| `events()` chỉ đổi date rồi trả DataFrame, số nằm trong title | `...:302-317` | ✅ Đúng (`:309-317`). Không có cột số |
| Facade gộp provider rỗng ⇒ "không có nguồn" | `api/company.py:179-181`, `common/data.py:327-343` | ✅ Đúng; `_call_with_fallback` giữ `empty_result` rồi trả ở `:342-343` |
| TCBS `dividends()` có field số `listDividendPaymentHis` | `explorer/tcbs/company.py:468-499` | ⚠️ Đúng ở mức source (`:492` `json_normalize`); **CHƯA XÁC MINH runtime** — cần JWT thật để probe |
| Auth đã hỗ trợ `TCBS_JWT_TOKEN` | `explorer/tcbs/auth.py:42-55` | ✅ Đúng, kèm fallback `TCBS_AUTH_TOKEN` (`:49-51`) |
| `ProviderAuthError` có `error_code='PROVIDER_AUTH'` | `core/exceptions.py:374-394` | ✅ Đúng (`:394`) |
| Decorator cache là no-op, không có TTL | `core/utils/execution.py:15-31` | ✅ Đúng (xem thêm `:28-37`); plan B đúng: TTL là trách nhiệm consumer |
| KBS dựng param đúng, không sửa mù | `explorer/kbs/company.py:605-619` | ✅ Đồng ý — `l/p/s/eID` được dựng; chưa có response payload thật để đối chiếu |
| `common/data.py` đang bị claim in-progress | `docs/CLAIMS.md:47` (`w34-ratelimit`) | ✅ Đúng; plan tránh file này là hợp lý |
| `dynamic_method` đi qua fallback có sẵn | `base.py:44-65`, `:183-221`, `core/source_router.py:493` | ✅ Đúng — `NotImplementedError` nằm trong `should_failover`, fallback hoạt động khi source=AUTO |

## B. CONTRADICTIONS (plan vs bằng chứng)

| Plan/doc | Thực tế | Tác động |
|---|---|---|
| Plan soạn trên `main` 3.8.0 (`pyproject.toml:7`) | vninvest pin 3.7.2 (`dev@0ce7a99b0:...requirements.txt:38`) | 3 slice xong vẫn **không tới production** nếu thiếu release + bump pin |
| Parser: chỉ `DIV+%` đánh dấu ambiguous | FPT `ISS ... CBCNV tỉ lệ 0.5%` tồn tại thật (probe 3.7.2) | Sai factor cho FPT/ESOP; lan sang MA/backtest |
| Fixture VCB "49.5% + 450 VND cùng kỳ" | `2025-03-12` vs `2025-10-03` | Golden test sai; AC3/R3 bị hiểu nhầm |
| `group_id=(symbol, ex_date)` | Contract handoff §5 dùng JSON/DataFrame fields | Tuple không serialize; cần format chuỗi |
| "Lỗi TCBS là docs/error message" (ngầm định 1 chỗ) | 2 file docs cũ + message `dividends()` thiếu hướng dẫn | Sửa sót ⇒ user vẫn set sai env |
| "Không hứa ID ổn định" (đúng) nhưng vẫn dùng làm `source_event_id` | Q7 chưa có câu trả lời | Dedup/idempotent có thể hỏng dài hạn |

## C. FINDINGS CHI TIẾT

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| C-01 | BLOCKER | `vnbroker@main:eac374b:pyproject.toml:7` vs `dev@0ce7a99b0:...requirements.txt:38` | 3.8.0 vs 3.7.2 | Slice vô tác dụng với consumer | Thêm **Slice 4**: release 3.8.x, bump pin phía vninvest, re-probe sau bump; ghi rõ timeline |
| C-02 | MAJOR | `vnbroker-3.7.2@container` probe FPT `2024-10-09/2025-05-07/2025-06-24/2026-06-24` ISS ESOP % | `ISS+%` không đồng nghĩa cổ phiếu thưởng | Factor sai cho ESOP | Parser: chỉ `Cổ phiếu thưởng` / `Trả Cổ tức bằng Cổ phiếu` ⇒ `stock_ratio_pct`; `Phát hành cho CBCNV tỉ lệ` ⇒ `unparsed` + flag. Sửa cả vninvest `parser.py` |
| C-03 | MAJOR | probe VCB `2025-03-12` (49.5%) / `2025-10-03` (450 VND) | Không cùng ex_date | Golden/AC sai | Đổi handoff §7 + fixture test: VCB là 2 ex_date riêng; giữ VNM 3 cặp cùng ex_date làm golden R3 |
| C-04 | MAJOR | `vnbroker@main:eac374b:explorer/tcbs/IMPLEMENTATION_SUMMARY.md:146`, `MIGRATION_GUIDE.md:36,44,47`; `explorer/tcbs/company.py:468-499` | Docs dạy sai env; message `dividends()` thiếu hướng dẫn | User set nhầm token | Slice 3 sửa cả 2 docs + message; thêm test assert message chứa `TCBS_JWT_TOKEN` |
| C-05 | MAJOR | plan `source_event_id` từ VCI `id`; Q7 mở | ID ổn định ngắn hạn mới được chứng minh | Dedup hỏng nếu provider đổi ID | Ghi rõ không dedup theo title; `group_id` dạng `f"{symbol}:{ex_date}"`; expose raw `id` + `parse_status`; giữ 2 dòng cùng ex_date |
| C-06 | MED | `common/data.py:327-343`, `base.py:44-65,183-221` | Fallback chỉ chạy đúng khi source=AUTO và có provider implement method | Explicit `source='KBS'` ⇒ NotImplementedError (chấp nhận được, nhưng phải document) | Slice 2 thêm test: `source='AUTO'` fallback sang VCI; `source='KBS'` raise rõ, không trả rỗng |
| C-07 | MED | `vnbroker@main:eac374b:docs/CLAIMS.md:47` + nhiều claim `in-progress` từ 2026-10-10 | Registry stale | Branch/claim dễ nhầm | Vẫn khai claim riêng; tên agent phải **bằng đúng** `feat/corporate-actions-source` bỏ tiền tố; không đụng `common/data.py` |
| C-08 | MED | `CLAUDE.md:4-13` | Plan không có dòng `Lessons áp dụng:`; chưa nạp `broker-risk`/`evidence` | Vi phạm hard rule repo | Trước code: nạp 3 lesson (`broker-risk`, `evidence`, `process`), ghi `Lessons áp dụng: [L-R04, L-E01, L-E06, ...]` vào plan |
| C-09 | LOW | plan contract có `record_date`/`payment_date` | Probe VCI DataFrame không có 2 cột này (chỉ `public_date`, `exright_date`, `display_date`) | Field sẽ luôn null | Ghi rõ null về phía VCI; không suy diễn từ `public_date` |
| C-10 | LOW | `group_id` tuple | Không JSON-serializable | Contract test fail | Đổi thành chuỗi `SYMBOL:YYYY-MM-DD` |

## D. ĐIỀU PLAN LÀM ĐÚNG (giữ nguyên)

- Không đưa `adj_close`/`adj_factor` vào package — đúng ranh giới (cần `P_prev`, precision, guard).
- Không sửa KBS khi chưa có response payload thật — đúng nguyên tắc "không sửa mù" (`explorer/kbs/company.py:605-619`).
- `events()` giữ nguyên, method mới additive — backward compatible.
- Phát hiện đúng decorator cache no-op (`core/utils/execution.py:15-37`) và TTL là trách nhiệm consumer.
- Tránh `common/data.py` đang bị claim — đúng.
- Đề xuất fail-before + test golden — đúng, nhưng fixture phải sửa (C-02/C-03).

## E. QUALITY GATES

| Gate | Kết quả |
|---|---|
| Verify citation bằng `read`/`git grep` trên `vnbroker@main:eac374b` | Đã chạy — 10/10 citation đúng trừ các điểm nêu ở §B |
| Probe live 3.7.2 (VNM/FPT/VCB) | Đã chạy — 57/79/23 event; lộ C-02/C-03 |
| `git status` vnbroker | Sạch, trên `main` (đúng như bạn nói) |
| `git status` vninvest (nơi viết audit này) | Sạch trước khi ghi doc |
| `scripts/check_all.ps1` vnbroker | **CHƯA CHẠY** — audit read-only, không đổi source |
| `pytest tests/...` vnbroker | **CHƯA CHẠY** — chưa có test mới; baseline repo có flaky/network tests (L-E04) |
| `vnbroker-3.7.2@container` dividends() runtime | **CHƯA CHẠY** — thiếu JWT thật; chỉ verify source |

## F. CÂU HỎI CẦN CHỐT TRƯỚC KHI CODE

1. Slice 4 (release + bump pin 3.7.2→3.8.x) ai làm, khi nào? Nếu không, 3 slice chỉ có giá trị cho phiên bản tương lai.
2. Có chấp nhận thu hẹp `stock_ratio_pct` cho ISS theo C-02 không? (Ảnh hưởng cả vninvest PR #458 — tôi có thể mở slice sửa riêng.)
3. VNM 950+1.500 (và 2 cặp khác) có được coi là 2 sự kiện thật không? Chưa có đối chiếu TCBS/disclosure (Q2 vẫn mở).
4. `source_event_id` = VCI `id`: có tài liệu nào của VCI về tính ổn định/reuse không (Q7)?
5. Có JWT TCBS thật trong staging để probe `dividends()` và đối chiếu VCB không?

## G. KẾT LUẬN

**Chẩn đoán gốc đúng (~80%): nguyên nhân là thiếu field số + API ổn định, không phải adj_close.** 3 slice đúng hướng và đáng làm. **Nhưng chưa đủ điều kiện bắt đầu**: có 1 blocker (version trap) + 4 major (ESOP parser, golden VCB, docs auth, ID/group_id) cần đưa vào plan trước dòng code đầu tiên. Khuyến nghị: cập nhật plan thành **4 slice** (thêm release/bump pin), sửa C-02/C-03/C-04/C-05, nạp lesson theo `CLAUDE.md:4-13`, rồi mới tạo branch + claim + fail-before. Không có lý do để chờ vnbroker code xong mới sửa parser phía vninvest — hai bên nên sửa song song nhưng **cùng một rule** để không phân kỳ.

**Lessons áp dụng (cho audit này)**: `[L-R04, L-E01, L-E02, L-E06, L-T02]` — không khẳng định runtime khi chưa probe (TCBS), mọi con số kèm lệnh, trích nguyên văn dòng code, fail-before phải chạm hàm thật.

**Next steps / Owner**: vnbroker owner chốt 5 câu hỏi §F → sửa plan → tôi (hoặc auditor khác) re-audit vòng 2 → mới khai claim. Không commit file này vào `main` vnbroker; đây là evidence phía vninvest.
