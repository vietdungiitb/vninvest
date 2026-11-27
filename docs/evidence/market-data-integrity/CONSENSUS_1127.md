# ĐỒNG THUẬN (B4) — KẾ HOẠCH Toàn vẹn Dữ liệu Thị trường / Market CVD / Whale SSOT

- **Ngày:** 2026-11-27 · **Vai trò:** tác giả plan (vninvest BE team) ghi nhận verdict của **auditor độc lập** (không phải người viết plan).
- **Đối tượng đồng thuận:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` **REV.3** (196 dòng).
- **Baseline citations:** HEAD worktree `9507ca45e`; `origin/dev` đã trôi `d446515b2` ⇒ trước B5 bắt buộc rebase + re-verify (xem reservation R-3).
- **Trạng thái (CẬP NHẬT 2026-11-27 — quyết định Owner mới, thay thế quyết định "giữ plan/chưa code" trước đó):** `AGREE — Owner MỞ KHÓA có kiểm soát: S0 commit+PR doc ngay · S1 → S2 → S3 → S5 trước · S4 khóa thi hành staging chờ dry-run · S6 cuối · Q2=KHÔNG ghi staging · Q3 điều chỉnh theo G-2 · Q9=giữ default metric=whale.`

---

## 1. Chuỗi audit (bằng chứng đã lưu thành file, không phải chat)

| Vòng | File verdict | Verdict | Nội dung chính |
|---|---|---|---|
| B3-v1 | `docs/evidence/market-data-integrity/AUDIT_PLAN_1127.md` | `NEED_REVISION` | 12 objection (2 P0: migration `0013` bị chiếm; fail-before M03 xanh giả do presence-check) |
| B3-v2 | `docs/evidence/market-data-integrity/AUDIT_PLAN_1127_R2.md` | `NEED_REVISION` | 11/12 resolved; còn **R-O1** (fixture M04 1 bucket ⇒ sigmoid luôn 50) + R-O2 (baseline trôi) |
| B3-v3 (final) | `docs/evidence/market-data-integrity/AUDIT_PLAN_1127_R3.md` | **`AGREE (với reservation)`** | R-O1/R-O2 sửa thật; mô phỏng có control xác nhận `buy_strength 62.727 → 50.0` (đỏ thật); **không còn P0/P1**, không cần REV.4 |

> Cổng ra B4→B5 theo `workflow-dev-loop` là `PASS`/`AGREE` — **đã đạt**. Tuy nhiên `AGREE` kèm reservation phải được đóng theo §2 trước khi khai claim.

---

## 2. Reservation & người đóng

| ID | Reservation | Người đóng | Đóng ở bước | Trạng thái |
|---|---|---|---|---|
| **R-1** | Auditor v3 ghi `R3-N1`: plan `:47` từng ghi `origin/dev = 9507ca45e` mâu thuẫn với header/§5 | Tác giả plan | B4 (ngay) | **ĐÃ ĐÓNG** — `:47` đổi thành "HEAD worktree `9507ca45e`; `origin/dev` trôi `d446515b`" |
| **R-2** | Auditor v3 ghi `R3-N2`: nhãn "REV.2" ở `:14`, số "3 file doc" ở `:161` | Tác giả plan | B4 (ngay) | **ĐÃ ĐÓNG** — `:14` → "REV.3", `:161` → "4 file doc" |
| **R-3** | `origin/dev = d446515b2` (khác HEAD worktree). Mọi `file:line` đúng tại HEAD nhưng sẽ thối sau rebase | Tác giả plan + coordinator | **B5**, trước dòng code đầu tiên | MỞ — bắt buộc `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → gate), rồi re-verify citation + chạy lại gate. **Không báo PASS trên code cũ** (L-003) |
| **R-4** | **Owner ký Q2** (cho phép cleanup/backfill phá dữ liệu staging) | **Owner** | Trước S4 | **ĐÃ ĐÓNG 2026-11-27: `KHÔNG`** — S4 bị khóa trong phiên này; không xóa/backfill staging, probe chỉ đọc |
| **R-5** | **Owner ký Q9** (default `metric`) | **Owner** | Trước S5 | **ĐÃ ĐÓNG 2026-11-27: giữ `whale`** — khác RFC §4.1 (`market`); `market` là opt-in, bảo vệ tương thích ngược |
| **R-6** | Q1 scope + Q3..Q8 còn lại | **Owner** | Trước slice tương ứng | **Q1 ĐÃ ĐÓNG: "Giữ nguyên plan, chưa code"** → dừng B4, không sang B5. Q3..Q8 giữ mặc định plan §0, chưa áp dụng vì chưa code |

---

## 3. Nội dung đồng thuận (tác giả + auditor cùng nhất trí)

1. **Evidence & contradictory:** C-1 đúng — lỗi `UNKNOWN→sell` **đã được sửa trong code** (`signal_intelligence/tasks.py:281-282`, commit `6e50418a9`); chỉ còn là dữ liệu lịch sử cần dọn. C-2..C-9 (ngưỡng 200M/500M, UNKNOWN chia 50/50, `trade_seq` không tồn tại, `detail` JSONField, baseline cũ, `WhaleAlertCanonical` không có `session_phase`, cache key thiếu `metric`) đều đã ghi thành văn bản.
2. **Cấu trúc 6 slice / 4 phase / 10 REQ — THỨ TỰ ĐÃ ĐỔI theo G-1:** S1 (M01) → S2 (M02+M04+Q6) → S3 (M03) → **S5 (M06/07/08) chạy TRƯỚC S4** → **S4 khóa thi hành staging (M05)** → S6 (M09/10). Lý do G-1: nếu backfill ở S4 trước khi có S5, `IntradayTick` chỉ ghi vào `SessionFactsBucket` kiểu cũ (whale-only), hết retention 7 ngày rồi S5 lại phải backfill DNSE lần 2. Với thứ tự mới, **1 lần backfill duy nhất** phục hồi đồng thời `IntradayBar` + `WhaleAlertCanonical` + `SessionFactsBucket(full_tick)`. Mỗi slice = 1 claim + 1 branch `feat/<agent>` + 1 PR + fail-before đỏ→pass-after→re-audit.
3. **Fail-before là thật, không xanh giả:** M03 dùng monkeypatch presence-check + assert conflict ≥1 + `IntegrityError` + test dương tính; M04 dùng fixture **2 bucket**, fix `:144`+`:146`, **chỉ assert `buy_strength` 62.727→50.0**, `delta_strength` làm control; M01 assert volume 501000 vs 1000.
4. **Migration an toàn:** head `market_data` hiện `0014_alter_pricerebaserun_status.py` — **không tự đặt `0013`**; để `makemigrations` sinh, dedup dữ liệu cũ trước khi tạo unique, re-verify head sau rebase.
5. **API tương thích ngược:** caller cũ không truyền `?metric=` vẫn nhận shape cũ với **ngữ nghĩa `whale`** (Q9/R-5); `market` là opt-in; cache key đưa `metric` vào + bump `v5`/`v3`.
6. **Staging:** S4 chỉ chạy sau snapshot 4 bảng → `--dry-run` → canary `VIC/FPT/VNM` → probe `0%` I-1 & skew `14:00<85%` → mới VN30/toàn sàn; Q2 mặc định KHÔNG.
7. **Trung thực cổng:** mọi thứ không chạy được ghi `CHƯA CHẠY` (pytest Postgres riêng, `makemigrations --check`, build/tsc, probe staging). Không báo PASS giả (L-007).

---

## 4. Cổng đã chạy / `CHƯA CHẠY` (tại thời điểm đồng thuận)

| Cổng | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS` (kèm warning claim stale, không chặn) |
| `git status --short` (worktree) | 4 file doc chưa track; **không có code/migration** |
| `git log --oneline -1` (worktree) | `9507ca45e Merge pull request #584 ...` |
| python simulation AC M04 (auditor v3, có control) | CONTROL old≡fixed; 2-bucket old `(62.727,56.15)` → fixed `(50.0,50.0)`; 1-bucket old=fixed=`50.0` |
| `makemigrations --check --dry-run` | **CHƯA CHẠY** (chưa đổi model) |
| BE `pytest` trên Postgres riêng / VPS staging | **CHƯA CHẠY** (L-B01; cấm local Docker) |
| `npm run build` / `tsc --noEmit` | **CHƯA CHẠY** (không sửa FE) |
| Probe staging đọc / cleanup ghi | **CHƯA CHẠY / S4 bị khóa Q2** |

---

## 5. Điều kiện để sang B5 (tất cả phải đạt)

- [x] B3 verdict cuối `AGREE` (R-1/R-2 đã đóng trong B4).
- [x] **Owner ra quyết định MỚI 2026-11-27** (thay quyết định "giữ plan/chưa code"): S0 commit+PR doc ngay; mở khóa `S1 → S2 → S3 → S5`; S4 khóa thi hành staging; S6 cuối; Q2=KHÔNG ghi staging; Q3 theo G-2; Q9 giữ `whale`.
- [x] G-1..G-4 đã ghi vào §7 (thứ tự S5 trước S4, chống nuốt lệnh trùng giây, fallback giờ ICT + timezone 2H/4H, commit 5 file untracked).
- [ ] `pwsh -File scripts/agent-sync.ps1` / rebase `docs/mdi-plan-1127` lên `origin/dev d446515b2` → check migration → gate; re-verify `file:line` **sau** rebase (R-3/L-003).
- [ ] S0: khai claim doc-only (`mdi-plan-1127`) → commit 5 file → PR vào `dev`.
- [ ] B5: khai claim S1 riêng, branch `feat/<agent>` khớp tên (L-M02) → code fail-before → gates → re-audit → PR.
- [ ] S2 → S3 (query read-only trùng giây theo G-2) → S5; **S4 vẫn khóa** chờ dry-run + snapshot được Owner duyệt.

---

## 6. Phê duyệt của Owner — QUYẾT ĐỊNH MỚI, ĐÃ KÝ 2026-11-27

| Ô | Quyết định |
|---|---|
| S0 — doc | **DUYỆT commit + PR ngay** 5 file plan/audit/consensus (bổ sung G-1..G-4 ở §7 là đủ, không cần REV.4) |
| Q1 — scope/thứ tự | **MỞ KHÓA có kiểm soát**: `S1 → S2 → S3 → S5` trước; `S4` khóa chờ dry-run; `S6` cuối. 1 slice = 1 claim + 1 branch + 1 PR. Bắt đầu **S1** ngay, nối **S2** |
| Q2 — phá dữ liệu staging | **KHÓA THI HÀNH** — được viết code + unit test S4 sau S5, nhưng **CẤM ghi/xóa staging** ch tới Owner duyệt `--dry-run` + snapshot 4 bảng cho `VIC/FPT/VNM` |
| Q3 — `dedup_key` | **ĐIỀU CHỈNH theo G-2** — query read-only tick trùng cùng giây trước khi migration; nếu provider không có trade ID ⇒ dùng `seq_in_key` |
| Q4 / Q5 / Q6 / Q7 / Q8 | **ĐỒNG Ý** như plan §0 (dùng `detail` JSONField; giữ hàm CVD cũ + path mới; 500M; backfill **1 lần duy nhất sau S5**; Coordinator/Owner giữ quyền deploy) |
| Q9 — default `metric` | **GIỮ `whale`** → `market` opt-in; widget tự gọi `?metric=market` lúc cutover |
| Ngày ký / người ký | 2026-11-27 · Owner (quyết định chính thức thay mặt Owner) |

## 7. Phản biện bổ sung G-1..G-4 (đã chấp nhận, cập nhật vào plan khi implement)

| ID | Mức | Nội dung | Hành động |
|---|---|---|---|
| **G-1** | HIGH | S4 trước S5 ⇒ đốt quota DNSE backfill 2 lần (lần 2 khi S5 cần `full_tick` sau khi tick hết retention 7 ngày) | **Đảo thứ tự**: `S1→S2→S3→S5→S4→S6`; 1 lần backfill phục hồi cả 3 bảng |
| **G-2** | HIGH | `dedup_key` hash phẳng `(symbol,timestamp,price,volume,side,match_type,source)` nuốt lệnh lô lẻ trùng giây (tape DNSE độ phân giải giây) ⇒ hụt volume, vỡ `I-2` | Trước migration S3: query read-only 1 ngày `VIC/FPT` đếm tuple trùng hoàn toàn + kiểm tra raw DNSE có `matchId`/`seq` không; nếu không có ⇒ khóa gồm `seq_in_key` (đánh số theo thứ tự xuất hiện trong cùng 1 fetch) |
| **G-3a** | MED-HIGH | `_floor_intraday_bucket` (`data_ingest/tasks.py:361-373`) floor theo UTC cho khung `2H`/`4H` (định nghĩa tại `:92`) ⇒ lệch biên nến so với giờ VN | Helper recompute ở S1 phải dùng **cùng quy ước múi giờ** với `synthesize_intraday_bars_from_ticks` |
| **G-3b** | MED-HIGH | DNSE historical tape có thể trả `match_type` rỗng/`NormalMatch` cho ATC | S2 **bảo vệ kép**: đọc `match_type` thật **và** fallback theo giờ ICT (`09:00:00–09:14:59 → ATO`, `14:30:01–14:59:59 → ATC`) ⇒ cưỡng ép `side='UNKNOWN'` trước `detect_whale_ticks` |
| **G-4** | MED | 5 file doc đang untracked; giữ "chưa code" làm staging tiếp tục bị cụt `IntradayBar` mỗi 5 phút | Đã giải bằng S0 commit+PR ngay + mở S1/S2 (bugfix code thuần, 0 migration, 0 phá dữ liệu) |

> **Phối hợp widget:** trong lúc BE chạy `S1→S2→S3→S5`, widget triển khai độc lập Slice A (`FIX-CVD-PRICE-AXIS-SLOT` + crosshair compact) và Slice B (`FIX-WHALE-FEED-STATUS-UX`), không chờ BE.

---

> **Trạng thái code tại thời điểm ký:** chưa có dòng code production nào bị sửa, chưa có migration, chưa đụng staging. S0 (doc) được commit ngay theo quyết định trên; S1 bắt đầu sau khi S0 xong.
