# PHẢN BIỆN — Handoff & audit nguồn corporate action gửi vnbroker (2026-11-20)

- **Ngày**: 2026-11-20
- **Vai trò**: reviewer độc lập, read-only — không claim, không sửa code, không chạy gate code.
- **Scope**: `docs/handoffs/HANDOFF_2026-11-20_VNBROKER_CORPORATE_ACTION.md` · `docs/AUDIT_VNBROKER_CORPORATE_ACTION_SOURCE_20261120.md` (`a6e7bb7f2`, PR #453) · `docs/AUDIT_MARKET_DATA_SYNC_20261120.md` (`278ae91e7`, PR #452) · ledger Entry 566/567/568.
- **Lệnh tái tạo chính**: `git show origin/main:docs/AUDIT_VNBROKER_CORPORATE_ACTION_SOURCE_20261120.md` · `git grep -n -i "adjusted" origin/main -- packages/core/backend/src` · `git show origin/dev:packages/core/backend/src/market_data/stock_mgmt_native_views.py | Select-Object -Skip 4377 -First 10`.

## VERDICT

Hướng kỹ thuật (VCI là nguồn khả thi, cộng tiền cùng ex-date, không ghi đè `close` thô) **đúng và đủ để gửi**. Tuy nhiên có **4 điểm blocker/major** cần sửa trước khi gửi cho đội vnbroker, nếu không báo cáo sẽ tự mâu thuẫn hoặc bị đối chiếu sai ngay trên `main`:

| ID | Mức | Vấn đề ngắn |
|---|---|---|
| C1 | BLOCKER | Golden VNM "2 DIV = 2.450 VND" vừa được chốt trong §7/AC3, vừa bị hỏi lại ở §10.Q2 |
| C2 | BLOCKER | Rule "unparsed ⇒ `adjusted:false` toàn bộ lịch sử mã" triệt tiêu chính ca VNM |
| C3 | MAJOR | Loại DNSE khi chưa probe `get_corporate_action_history` — nguồn có cấu trúc đã được audit cũ nhắc tới |
| C4 | MAJOR | `file:line` evidence chỉ đúng trên `dev`, sai trên `main` (bars API không có `adjusted` trên main) |

Ngoài ra 9 điểm major/minor khác liệt kê ở §2.

---

## 1. PHẦN ĐÚNG CẦN GIỮ NGUYÊN

- VCI `events(from_date='20100101', event_codes='DIV,ISS')` trả 57 sự kiện có `exright_date` cho VNM, parse 45 tiền + 7 % + 5 unparsed — đây là evidence probe thật (`AUDIT_VNBROKER... §B`).
- Facade mặc định KBS ⇒ rỗng, giải thích đúng vì sao audit cũ (`qb2-probe.md:28`) kết luận "không có nguồn" (`vci/company.py:104-116,303-318`; `common/data.py:308-345`).
- Công thức adjust đúng chiều: `factor_cash=(P_prev−Σcash)/P_prev`, `factor_stock=1/(1+Σratio/100)`, nhân dồn cho mọi `ex_date > t`, không ghi đè `close` (handoff §6) — khớp backward adjustment chuẩn.
- Entry 567/568 có thật trên `origin/main` (verify: `git show origin/main:docs/CODE_CHANGE_AUDIT_LEDGER.md | Select-String "Entry 56[7-8]"`); audit file nằm trên `origin/main` tại `a6e7bb7f2`. Phần traceability này ổn.

---

## 2. FINDINGS CHI TIẾT

### C1 — BLOCKER — Golden case tự mâu thuẫn

- **Evidence**: handoff `§7` dòng 143 ghi VNM `2 DIV cùng 2024-09-24 (950 + 1.500 VND)` → kỳ vọng *"tổng tiền 2.450 VND, không double-count"*; `§8 AC3` dòng 155 lại bắt *"client có thể reproduce total = 2450 VND"*. Trong khi `§10 Q2` dòng 174 hỏi *"Hai DIV cùng 2024-09-24 là dữ liệu đúng hay trùng provider?"*.
- **Impact**: nếu 950 và 1.500 là 2 bản ghi trùng (cùng một lần chia, một record cũ + một record cập nhật), factor sai đúng **950 VND** (~1–2% giá VNM), lan sang toàn bộ lịch sửadjusted trước ex-date đó ⇒ mọi MA/backtest/P&L lệch. Đang vừa hỏi đáp án vừa nhét đáp án vào test oracle.
- **Root cause**: chưa có đối chiếu chéo độc lập (TCBS token chưa có, chưa xem disclosure HOSE/VSDC), nhưng đã viết kết luận vào golden.
- **Đề xuất**: (a) đổi §7/AC3 thành *"semantics = cộng theo `ex_date`; tổng = Σ cash_amount đã xác minh"*, chưa fix số 2.450; (b) thêm negative test: nếu 2 record có cùng `source_event_id` ⇒ dedup, **không** cộng; (c) chỉ chốt 2.450 sau khi có xác nhận từ Q2. Ưu tiên xử lý trước khi gửi.

### C2 — BLOCKER — Rule unparsed triệt tiêu ca VNM

- **Evidence**: handoff `§6` dòng 135: *"Nếu có **bất kỳ** event `unparsed` nào trong lịch sử mã đó ⇒ giữ `adjusted:false + note`"*. Audit VCA-04 lại ghi *"unparsed ⇒ giữ `adjusted:false+note` **cho symbol/ngày đó**"*. R6/AC4 cũng dùng ngôn ngữ khác nhau.
- **Impact**: VNM có **5/57 unparsed** (audit §B) ⇒ theo rule của handoff, VNM **không bao giờ** được adjust. Toàn bộ golden VNM ở §7/AC1/AC3 trở nên vô nghĩa, và tính năng "auto-adjust" không áp được cho mã flagship. Đây là lỗi thiết kế, không phải lỗi diễn đạt.
- **Root cause**: trộn 2 mục tiêu — "không đoán số" (đúng) và "không trả số sai" (đúng) — thành 1 rule quá rộng.
- **Đề xuất**: chọn 1 trong 2 và sửa đồng bộ §6 + AC4 + R6 + VCA-04:
  - **(a) per-date**: chỉ flag `adjusted:false` cho các ex_date có event unparsed (và đoạn lịch sử bị ảnh hưởng bởi factor đó), các ex_date sạch vẫn adjust;
  - **(b) classify lại 5 event**: "Phát hành cho CBCNV / riêng lẻ" nhiều khả năng không làm đổi giá niêm yết — nếu owner chốt được thì vẫn adjust nhưng đính kèm `note` liệt kê event bị bỏ qua. **Không tự suy diễn**, phải có quyết định owner.

### C3 — MAJOR — Bỏ sót nguồn có cấu trúc DNSE

- **Evidence**: `docs/AUDIT_MARKET_DATA_SYNC_20261120.md` Dòng D (MDS-01) đề xuất *"ingest từ feed có sẵn (DNSE `get_corporate_action_history` theo `AUDIT_MARKET_DATA_SYNC_GAP_20260921.md:286-287`)"*; audit cũ §J9 (`git show docs/vnbroker-corp-action-source:docs/archive/docs-flat/market_data_sync/AUDIT_MARKET_DATA_SYNC_GAP_20260921.md`) ghi rõ `dnse/client.py:408 get_corporate_action_history` là ứng viên. Audit mới chỉ probe `dnse/company.py:257-265 events()` → `empty_df` rồi kết luận "DNSE theo thiết kế, không khả thi" (bảng §3.2).
- **Impact**: `events()` rỗng **không** suy ra `get_corporate_action_history` rỗng — đó là method khác. Nếu method còn tồn tại và trả field số trong v3.7.2, R1/R6 được giải quyết **không cần regex**, giảm đáng kể công của cả hai team. Bỏ sót ⇒ ta tự nguyện nhận phần việc khó hơn rồi đi xin đối tác đổi API.
- **Root cause**: audit mới thu hẹp probe vào `events()/dividends()` theo facade, không tra cứu lại các ứng viên đã nêu ở audit cũ. Cần nhớ **version trap**: audit cũ chạy v1.0.2, hiện tại v3.7.2 — phải probe lại trên đúng container, không cite file:line của bản cũ.
- **Đề xuất**: thêm một dòng probe `get_corporate_action_history` vào §3 của audit; nếu có data ⇒ đưa vào §10 như câu hỏi ưu tiên và hạ cấp R1 xuống P1. Nếu không còn method ⇒ ghi rõ "đã thử trên 3.7.2, không còn" để đóng hẳn.

### C4 — MAJOR — Evidence không tái tạo được trên `main`

- **Evidence** (các lệnh ở header):
  - Handoff §2 / audit MDS-01 dẫn `stock_mgmt_native_views.py:4381-4384` trả `adjusted:false` + note. Trên `origin/main`: `git grep -n -i "adjusted" origin/main -- packages/core/backend/src` chỉ ra `models.py:80`, `admin.py`, `serializers.py`, migration — **không có** key `adjusted` hay note ở bars API. Trên `origin/dev` mới có đúng tại `:4382-4384`.
  - `vnbroker_adapter.py:1186-1204` (audit VCA-02) trên `origin/main` là code `fetch_company_financials`; `company.events()` thực tế ở **`:1032` (main)** và **`:1188` (dev)**.
- **Impact**: báo cáo nói "hiện trạng" nhưng đội vnbroker đối chiếu `main` sẽ thấy sai ⇒ mất uy tín toàn bộ phần evidence. Đây cũng là lý do local branch `docs/handoff-vnbroker-to-main` (stale, `878c7074f`) không thấy file audit dù file đã merge vào main — dễ gây hiểu nhầm "audit thất lạc".
- **Root cause**: viết `file:line` mà không gắn `(branch, commit)`; dev và main đã phân nhánh từ S3.1.
- **Đề xuất**: chuẩn hóa mọi citation thành `dev@<sha>:path:line` hoặc kèm lệnh `git show <branch>:...`. Sửa §2 thành *"trên dev (PR #454); main chưa có contract `adjusted:false`"*. Không gửi báo cáo với `file:line` "trần" nữa.

### C5 — MAJOR — Enum `parse_status` không thống nhất giữa 3 tài liệu

- **Evidence**: handoff §5 dòng 110 = `{structured, parsed_from_text, unparsed}`; audit VCA-04 = `{cash, ratio, unparsed}`; R6 dòng 87 = `is_amount_known`/`parse_status`.
- **Impact**: VCB (§7 dòng 145) có ISS 49.5% + DIV 450 VND "cùng kỳ" — nếu là **một** event có cả 2 field số thì enum `{cash, ratio}` không biểu diễn được; nếu là **hai** event thì "cùng kỳ" chưa được định nghĩa (cùng `ex_date`? cùng `payment_date`?) ⇒ golden VCB không viết được test xác định.
- **Đề xuất**: 1 enum duy nhất `{structured, parsed_from_text, unparsed}` + 2 flag độc lập `cash_parsed: bool`, `ratio_parsed: bool`. Định nghĩa "cùng kỳ" = cùng `ex_date` (hoặc cùng `record_date`, phải chốt) và tách VCB thành 2 dòng trong §7.

### C6 — MAJOR — `source_event_id` bắt buộc nhưng chưa chứng minh VCI có

- **Evidence**: audit §A chỉ liệt kê cột VCI `event_code`, `exright_date`, `event_name_vi`, `event_title_vi` — **không có ID**. Handoff R2/AC7 lại dùng `source_event_id` làm khóa dedup/idempotent; §5 dòng 108 đánh dấu bắt buộc.
- **Impact**: nếu phải tự hash `(symbol, ex_date, title)` thì VCI sửa title (dấu hiệu rõ ràng: "Đợt 4 2023" xuất hiện với ex-date 2024) ⇒ ID đổi ⇒ AC7 fail và dedup hỏng. Ngược lại nếu ID bị reuse cho nội dung khác thì mất update.
- **Đề xuất**: thêm câu hỏi vào §10: *"VCI `events()` trả field ID nào, có ổn định qua các lần fetch không, có reuse không?"*. Tạm thời định nghĩa dedup key dự phòng `(symbol, ex_date, action_type, cash_amount, ratio_pct, raw_title)` + chính sách rõ ràng khi cùng ID nhưng khác nội dung (`update` thay vì `insert`).

### C7 — MAJOR — Công thức thiếu định nghĩa `P_prev`, guard và precision

- **Evidence**: handoff §6 dòng 128-133 dùng `P_prev` nhưng không định nghĩa; §7 chỉ ghi "factor = 1/1.15", không có giá trị `adj_close` mong đợi cụ thể.
- **Impact**: (a) `P_prev` là close ngày giao dịch liền trước (không phải ngày lịch) hay raw close? Nếu lưu nhầm ngày ⇒ factor sai; (b) không có guard khi `Σcash ≥ P_prev` hoặc `ratio ≤ -100` ⇒ factor ≤ 0, `adj_close` âm; (c) `Decimal` vs `float` + số chữ số làm tròn không quy định ⇒ golden test VNM/FPT/VCB không có expected number để assert.
- **Đề xuất**: bổ sung §6: `P_prev = raw close của phiên giao dịch liền trước ex_date`, validate `0 < factor_cash ≤ 1`, `0 < factor_stock ≤ 1`, precision `Decimal(28, 10)` (hoặc con số owner chốt), kèm 1 bảng expected `adj_close` cho 3 ca golden.

### C8 — MAJOR — Phạm vi `DIV,ISS` hẹp hơn enum contract

- **Evidence**: audit/handoff chỉ probe `event_codes='DIV,ISS'` (§3.4), nhưng §5 dòng 100 enum gồm `SPLIT`, `RIGHTS`.
- **Impact**: nếu VCI phát hành quyền/chia tách nằm ở mã khác, event bị **lọc mất từ đầu** ⇒ không có cờ `unparsed` để cảnh báo; hệ thống trả `adjusted:true` nhưng sai — tệ hơn là im lặng đúng kiểu ta đang muốn tránh.
- **Đề xuất**: liệt kê toàn bộ `eventCode` VCI hỗ trợ (probe `event_codes=None` hoặc đọc const trong package) và map sang enum; thêm 1 golden casesplit/rights. Nếu VCI không có ⇒ ghi rõ enum contract thu hẹp còn `DIV,ISS`.

### C9 — MAJOR — Sync nightly & recompute chưa được thiết kế

- **Evidence**: R7 hỏi rate limit nhưng không có thiết kế; audit §E.2 đề xuất "beat nightly + backfill `2010-01-01` cho **mọi** symbol active"; contract có `fetched_at` nhưng không có `is_latest`/`superseded_by`; audit §F.Q4 hỏi "bảng riêng hay materialize" nhưng handoff §9 đã chọn xây engine.
- **Impact**: full-history nightly cho ~1.500 mã ⇒ rủi ro rate limit ngay ngày đầu. Khi VCI sửa số tiền (correction), `adj_close` đã materialize không tự recompute ⇒ sai số âm thầm.
- **Đề xuất**: đưa vào §10 (ưu tiên cao): incremental sync (chỉ ex_date mới) + backfill một lần + TTL cache; thêm field `is_latest`/`superseded_by` và chính sách recompute toàn lịch sử mã khi có correction. Chốt "bảng `adj_factor` riêng" (audit F.Q4) trước khi code.

### C10 → C13 — MINOR / hygiene

- **C10** (R5): đừng hỏi "hỗ trợ cấu hình token" như thể lỗi là do package — root cause có thể là vninvest chưa set env. Sửa thành *"cho biết tên env var / cách cấp quyền; cung cấp credential staging qua secret manager, **không** gửi token trong doc/handoff"*.
- **C11** (§9): chiến lược "chờ contract ổn định rồi mới implement" có thể kích hoạt chậm vô ích — R1 là feature request ngoài tầm kiểm soát, không có timeline. Nên nêu plan B: implement parse-from-text sau feature flag với `parse_status`, swap sang field số khi R1 xong; để owner chốt thay vì để trống.
- **C12** (bảng §3.2): KBS rỗng mới chỉ đúng với param đã thử (`event_type=2`, `eID/p/s` chưa rõ — §10.Q3). Đổi ngôn ngữ từ "❌ Không khả thi" sang *"probe với params hiện tại trả rỗng, nguyên nhân chưa rõ (đang hỏi Q3)"* để không chụp mũ provider team.
- **C13**: local branch `docs/handoff-vnbroker-to-main` stale so với `origin/main` (không có file audit dù audit đã merge `a6e7bb7f2`). Không phải lỗi nội dung, nhưng `fetch/rebase` trước khi tiếp tục để không tưởng evidence bị mất.

---

## 3. TESTS / VALIDATION ĐỀ XUẤT (thêm vào slice sau khi owner chốt)

1. Golden VNM: assert `Σ cash` chỉ sau khi có xác nhận độc lập (C1) + assert dedup theo `source_event_id`.
2. Golden VNM unparsed: assert 5 event unparsed ⇒ flag theo phạm vi đã chọn (C2), không assert `adjusted:false` toàn mã.
3. Golden VCB: 2 dòng (450 VND + 49.5%), assert `factor_cash`, `factor_stock`, `factor_total` và `adj_close` số cụ thể (C5, C7).
4. Golden FPT: `stock_ratio_pct=15.0`, factor `1/1.15`, expected `adj_close` numeric (C7).
5. Negative: `Σcash ≥ P_prev` ⇒ không sinh factor, log cảnh báo, giữ `adjusted:false` (C7).
6. Contract test: mọi `file:line` trong handoff/audit có dạng `branch@sha:path:line` và lệnh `git show` tái tạo được (C4).
7. Probe test: DNSE `get_corporate_action_history` trên v3.7.2 — có/không có data, kèm lệnh (C3).

## 4. NEXT STEPS / OWNER

| Việc | Owner | Khi nào |
|---|---|---|
| Sửa C1, C2 trong handoff trước khi gửi | vninvest owner | **Trước** khi gửi link PR #455 cho vnbroker |
| probe DNSE `get_corporate_action_history` trên container 3.7.2 | vninvest (author audit) | Trước khi chốt R1 = P0 |
| chuẩn hóa citation `branch@sha` | author audit | Trước khi gửi |
| Chốt 5 câu hỏi §10 + 3 câu mới (ID VCI, P_prev/precision, split/rights) | vnbroker team | Sau khi gửi |
| Mở slice `feat/corporate-actions` (model + ingest + engine + golden) | vninvest | Sau khi contract ổn định & có plan B (C11) |

**Ghi chú quy trình**: reviewer read-only; không sửa `docs/CLAIMS.md`, không thêm Entry 569 vào `CODE_CHANGE_AUDIT_LEDGER.md` trên nhánh stale này (tránh claim-identity conflict). Khi owner commit phản biện này nên tạo branch `docs/critique-corp-action` riêng, rebase từ `origin/main`, thêm ledger entry có lệnh tái tạo, rồi mới mở PR. **CHƯA CHẠY**: mọi gate code (doc-only, không đổi source).

---

## 5. OWNER RESOLUTION (2026-11-20) — không sửa verdict ở trên

Owner đã xử lý từng finding trong plan `docs/PLAN_CORPORATE_ACTIONS_PIPELINE_20261120.md` (đã sửa) + evidence `docs/AUDIT_CORPORATE_ACTION_PHASE0_EVIDENCE_20261120.md`. Phần này **chỉ ghi cách đóng**, không thay đổi nội dung review.

| Finding | Cách đóng | Bằng chứng |
|---|---|---|
| C1 BLOCKER | D1 = `Σ cash` động, bỏ 2450 cứng trong cả handoff lẫn golden test; assert dedup theo `source_event_id` VCI `id` | evidence §3 + plan D1/Task 4 |
| C2 BLOCKER | D2 = per-date; `AdjFactor.status='partial'` chỉ ex_date bị ảnh hưởng | plan D2/Task 4 `test_unparsed_is_per_date` |
| C3 MAJOR | **Đã probe 3.7.2**: method có thật ở `connector/dnse/{client.py:612,services/account_service.py:56}` nhưng account-scoped (`account_no`, `api_key`, `api_secret`) ⇒ không thay feed công khai; R1 giữ P0. Reviewer đúng là "chưa probe", nhưng kỳ vọng "có data" không thành sự thật | evidence §2 |
| C4 MAJOR | Mọi citation repo gắn `dev@3845063a5:` / `main@117b2de98:`; handoff sửa ở PR mới (PR #455 đã merge, gate "gửi PR #455" stale) | handoff đã sửa + plan D7/Task 8 |
| C5 MAJOR | Enum thống nhất `{structured, parsed_from_text, unparsed}`; VCB tách 2 dòng, "cùng kỳ" = cùng `ex_date` | handoff §5/§7 + plan Task 2/4 |
| C6 MAJOR | D4: VCI trả cột `id` hex 24, ổn định qua 2 fetch; fallback hash **bỏ `raw_title`** (lỗi này reviewer chỉ ra gián tiếp, plan cũ tự mâu thuẫn với AC7) | evidence §3 + plan Task 3 |
| C7 MAJOR | D5: `P_prev` = raw close phiên liền trước, `Decimal(28,10)`, guard `0 < factor ≤ 1`, golden assert số FPT/VCB | plan Task 4 |
| C8 MAJOR | D6: probe chứng minh VCI chỉ hỗ trợ `DIV,ISS`; `SPLIT/RIGHTS` trả tin tức ⇒ enum thu hẹp + log unknown | evidence §4 + plan D6 |
| C9 MAJOR | Task 5 incremental (`max(ex_date) - 7 days`), `is_latest` supersede, recompute khi correction | plan Task 4/5 |
| C10–C13 | token đọc env (không ghi doc); KBS đổi ngôn ngữ "probe params hiện tại trả rỗng"; plan B flag bật ngay không chờ contract; **B1 sửa sai router** — repo `dev` có tooling, gate đúng `node packages/web/scripts/check-multi-agent.mjs` exit 0 ⇒ vninvest profile | evidence §1 + plan B1b |

**Sai sót mới phát hiện trong Phase 0 (ghi để không lặp lại):** người viết plan chạy `node scripts/check-multi-agent.mjs` (đường dẫn cũ) và `git ls-tree origin/main` (nhánh không có tooling) rồi kết luận "Generic profile" — đây là lỗi **L-V01/L-V02** (đo sai vẫn ra số hợp lý + tin gốc rễ kế thừa). Đã đính chính B1b, nạp lesson `project-lessons`, khai claim riêng `dccfe1ba6` trước khi sửa docs.
