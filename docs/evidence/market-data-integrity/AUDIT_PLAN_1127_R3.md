# RE-AUDIT ĐỘC LẬP VÒNG 3 (FINAL) — PLAN_MARKET_DATA_INTEGRITY_1127 REV.3

- **Scope:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` REV.3 (196 dòng, chưa track) — kiểm chứng việc sửa R-O1/R-O2 từ verdict vòng 2. Các verdict trước `AUDIT_PLAN_1127.md` (v1) và `AUDIT_PLAN_1127_R2.md` (v2) **giữ nguyên, không sửa**.
- **Ngày:** 2026-11-27 · **Vai trò:** cùng auditor độc lập vòng 1/2 (Staff+), read-only; không sửa plan, code, CLAIMS, ledger.
- **Baseline:** HEAD worktree = `9507ca45e` (`git rev-parse --short HEAD`); `origin/dev` lúc re-audit = `d446515b2` (không trôi thêm so với vòng 2). Mọi `file:line` dưới đây tự mở tại HEAD worktree.
- **Phương pháp:** đọc plan REV.3 dòng 1–196; mở lại `market_serving/session_facts_engine.py:127-224` (code thật, không đổi); chạy lại mô phỏng Python thuần (KHÔNG DB, KHÔNG ghi file) tái hiện trung thực `:127-221` với **control có đáp án biết trước**; chạy 4 gate read-only. Không chạy pytest/build, không đụng staging/Docker/DB.

---

## Verdict

**AGREE (với reservation)** — R-O1 đã được sửa thật và tái lập bằng mô phỏng có control; R-O2 đã được sửa ở header và §5. Không còn P0/P1 nào chặn. Không chuyển sang `PASS` tuyệt đối vì còn 1 sai sót tài liệu P2 (R3-N1: dòng `:47` vẫn ghi `origin/dev = 9507ca45e`, mâu thuẫn với `:6`/`:158`) và 3 reservation cần Owner/coordinator chốt.

Reservation phải đóng trước khi xem plan là "sẵn sàng deploy":
1. **Owner (trước B4):** ký văn bản Q2 (cho phép phá dữ liệu staging) và Q9 (`metric` default = `whale`, khác RFC §4.1). Im lặng = KHÔNG code/KHÔNG xoá (plan `:17`, `:24`, `:195`).
2. **Tác giả plan (trong B4, doc-only):** sửa dòng `:47` cho khớp `:6`/`:158` (R3-N1).
3. **Coordinator (ở B5):** `agent-sync.ps1` = rebase → check migration → gate, rồi re-verify mọi `file:line`; KHÔNG báo PASS trên code trước rebase (L-003).

---

## Kiểm chứng R-O1 (kèm output mô phỏng Python có control)

### 1. Plan REV.3 đã sửa đúng chỗ

| Yêu cầu R-O1 | REV.3 | Đối chiếu code thật |
|---|---|---|
| Fixture **≥2 bucket**, bucket 1 sạch làm baseline | `:105`, `:143`, `:72` — "bucket 1 sạch 1B buy + 1B sell làm baseline; bucket 2 = 1B buy + 1B sell + 50B unknown" | `session_facts_engine.py:186` `baseline = median(history) if history else max(total_v,1)`; chỉ có bucket 1 tạo `history` (`:212`) mới làm baseline cho bucket 2 ✅ |
| Fix cả `:144` **và** `:146` | `:37`, `:72`, `:103c` ("`:144` **và `:146`** đều bỏ qua side lạ (RFC M04 yêu cầu cả `total` lẫn `whale`)") | `:144` `bucket['total'] += value`, `:145-146` `if value >= _WHALE_THRESHOLD_VND: bucket['whale'] += value` — đúng 2 chỗ cần sửa ✅ |
| **Chỉ assert `buy_strength`**, kỳ vọng `62.727 → 50.0` | `:105`, `:143` ("KHÔNG assert `institutional_strength`... dễ gây mơ hồ"); `:72` | `:208`/`:218` `buy_strength_final` từ `strength_value` ✅ |
| Giữ `delta_strength_pct` làm control | `:37`, `:72`, `:105`, `:143` | `:214-216` `total_value = total_buy + total_sell` (đã loại unknown), `:220` delta = net/total ✅ |
| Cấm fixture 1 bucket + nêu rõ lý do `:186`/`:191`/`:202` | `:105` ("Fixture 1 bucket **bị cấm**: `baseline=total_v` (`:186`) + `midpoint=raw` (`:191/:202`) ⇒ sigmoid luôn `50`, không thể đỏ") | Đúng cơ chế: `:191` median của `[raw]` với history rỗng = `raw`; `:192` `_sigmoid(raw, midpoint)` = 50 ✅ |
| F-06 / S2 AC / matrix row nhất quán | `:37` ↔ `:103c`/`:105` ↔ `:143` — cùng "fix `:144`+`:146`, 2 bucket, chỉ assert buy_strength, delta control" | Không còn câu tự mâu thuẫn của REV.2 ✅ |

### 2. Mô phỏng Python có control (output nguyên văn)

Tái hiện trung thực các dòng `:127-221` (threshold `:54` = 200M, `_EPS=1e-9`, `_sigmoid`, `statistics.median`, hệ số phạt `:193`/`:204`). "fixed" = bỏ side lạ khỏi cả `total` lẫn `whale`.

```
CONTROL clean-only (known answer: identical)
  old  strengths= [(50.0, 50.0), (50.0, 50.0)]  delta= 0.0
  fixed strengths= [(50.0, 50.0), (50.0, 50.0)]  delta= 0.0
  buy_strength bucket2: old= 50.0  -> fixed= 50.0
  delta unchanged?  True
REV.3 fixture 2 buckets
  old  strengths= [(50.0, 50.0), (62.727, 56.15)]  delta= 0.0
  fixed strengths= [(50.0, 50.0), (50.0, 50.0)]  delta= 0.0
  buy_strength bucket2: old= 62.727  -> fixed= 50.0
  delta unchanged?  True
BANNED single-bucket fixture
  old  strengths= [(50.0, 50.0)]  delta= 0.0
  fixed strengths= [(50.0, 50.0)]  delta= 0.0
  buy_strength bucket2: old= 50.0  -> fixed= 50.0
  delta unchanged?  True
```

**Đọc output:**
- **Control** (không có unknown) cho old ≡ fixed → mô phỏng tự kiểm đúng (L-V01).
- Fixture REV.3: `buy_strength` bucket 2 **62.727 → 50.0** ⇒ fail-before **đỏ thật trên code cũ**, đúng số plan `:105` nêu. `delta_strength_pct = 0.0` ở cả 2 ⇒ control hợp lệ. `institutional_strength` 56.15 → 50.0 cũng đổi, nhưng plan chủ động **không assert** (đúng reservation R-O1, tránh phụ thuộc vào cách fix `:146`).
- Fixture 1 bucket bị cấm: mọi biến thể đều `50.0` ⇒ xác nhận lại lý do plan nêu là đúng.

**Kết luận R-O1: RESOLVED (có bằng chứng độc lập).**

---

## Kiểm chứng R-O2

| Yêu cầu | REV.3 | Gate thực tế |
|---|---|---|
| Phân biệt HEAD worktree vs `origin/dev` | `:6` — "HEAD worktree `9507ca45e` — mọi `file:line` đúng tại HEAD này… `origin/dev` lúc re-audit v2 đã trôi tới `d446515b`"; `:157`/`:158` tách 2 dòng riêng; `:81` đối chiếu §2b | `git rev-parse --short HEAD` = `9507ca45e`; `git rev-parse --short origin/dev` = `d446515b2` ✅ |
| Nêu rõ rebase + re-verify + chạy lại gate trước B5 | `:6` ("trước B5 phải `agent-sync.ps1` (rebase → check migration → gate) rồi **re-verify mọi `file:line`** (L-003); KHÔNG báo PASS trên code cũ"), `:81`, `:113`, `:158`, `:196` | Đúng quy trình L-003 / `AGENT_PROTOCOL.md:17` ✅ |
| Không coi drift của `origin/dev` lúc chạy gate là lỗi plan | Đã ghi rõ mốc "lúc re-audit v2" — chấp nhận được | `origin/dev` hiện `d446515b2`, **không trôi thêm** ✅ |

**Kết luận R-O2: RESOLVED ở nội dung chính.** Sai sót còn lại chỉ ở dòng tái tạo số liệu (xem R3-N1).

---

## Findings mới

| ID | Mức | plan file:line | Thực tế | Tác động | Đề xuất fix / ai đóng |
|---|---|---|---|---|---|
| **R3-N1** | P2 (doc-only) | `:47` | Dòng "Lệnh tái tạo số liệu" vẫn ghi `git rev-parse --short origin/dev = 9507ca45e`, trong khi `:6` và `:158` ghi `d446515b`. Chạy lệnh hiện tại trả `d446515b2` ≠ `9507ca45e`. | Sai sót nhỏ nhưng **mâu thuẫn nội bộ ngay sau khi đã sửa R-O2**; người đọc copy dòng `:47` vào consensus sẽ ghi baseline sai. | Tác giả plan, tại B4: đổi `:47` thành "`git rev-parse --short HEAD` = `9507ca45e`; `origin/dev` re-verify trước B5 (xem `:6`)". |
| **R3-N2** | P3 (cosmetic) | `:14`, `:161`, `:93` | Tiêu đề cột `:14` vẫn "Khuyến nghị REV.2"; `:161` ghi "3 file doc chưa track" trong khi thực tế 4 (plan + v1 + v2 + v3); `:93` chỉ kể tới vòng 2 trong lịch sử S0. | Không ảnh hưởng implement; chỉ làm consensus doc hơi lệch. | Tác giả plan, B4: đổi nhãn REV.3, cập nhật "4 file doc", nối thêm "→ vòng 3 AGREE". |

**Không có finding P0/P1 nào mới.** Các nội dung khác (O1–O12, Q6/S2, cache v5/v3 ở `:42`/`:125`/`:147`, Q9 opt-in ở `:24`/`:126`, predicate C-8 `:118`, chain O10 `:119`, S4 delete-tick `:120`) đều giữ nguyên và đã được kiểm ở vòng 2; REV.3 không làm thay đổi chúng theo hướng xấu hơn.

---

## Cổng đã chạy / CHƯA CHẠY

| Lệnh | Exit/output thực tế |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS`; vẫn kèm warning claim stale (dòng 2092, v.v.). Khớp plan `:160`. |
| `git status --short` | `?? docs/PLAN_MARKET_DATA_INTEGRITY_1127.md`; `?? docs/evidence/market-data-integrity/` — **4 file doc chưa track** (plan + 3 verdict). Không có code/migration bị sửa. |
| `git log --oneline -1` | `9507ca45e Merge pull request #584 from vietdungiitb/docs/ssot-adjustment-rev2` |
| `git rev-parse --short origin/dev` | `d446515b2` (không trôi thêm so với vòng 2) |
| `git rev-parse --short HEAD` | `9507ca45e` |
| Mô phỏng Python có control | Output ở mục "Kiểm chứng R-O1" — control old≡fixed; REV.3 fixture buy_strength `62.727 → 50.0`, delta `0.0 → 0.0`; 1 bucket mọi biến thể `50.0` |
| pytest / BE test Postgres, `makemigrations --check`, build/tsc, probe staging | **CHƯA CHẠY** — đúng yêu cầu read-only; plan `:162-165` ghi CHƯA CHẠY |

---

## Kết luận

**B4 có tiến được: CÓ, với reservation.** R-O1 (blocker duy nhất của vòng 2) đã được sửa đúng và tái lập độc lập bằng mô phỏng có control: fixture 2 bucket cho `buy_strength` **62.727 → 50.0**, `delta_strength` giữ nguyên làm control, và fixture 1 bucket bị cấm bằng lý do `:186`/`:191`/`:202` đã được xác nhận. R-O2 đã sửa ở header/§5. Không còn blocker P0/P1; đây là vòng cuối nên **không cần REV.4**.

Trước/khi vào B4:
- Tác giả plan sửa R3-N1 (dòng `:47`) — 1 dòng, doc-only; R3-N2 sửa luôn nếu tiện.
- **Owner chốt bằng văn bản Q2 + Q9** (plan `:17`, `:24`, `:195`). Chưa chốt thì giữ mặc định KHÔNG code/KHÔNG xoá; không tự deploy staging.
- B5 bắt buộc `agent-sync.ps1` (rebase `origin/dev@d446515b2` → check migration → gate) rồi **re-verify mọi `file:line`**; mới khai claim + branch `feat/<agent>`.
- Mọi con số BE/test/probe hiện vẫn `CHƯA CHẠY` — không được báo PASS cho S1–S6 khi chưa chạy thật trên Postgres riêng/staging theo workflow.
