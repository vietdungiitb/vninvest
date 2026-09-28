# Quyết định dọn dẹp & kế hoạch thực thi — 2026-09-28

`verified: 2026-09-28 @ dab83196` · nguồn: `docs/CLEANUP_AUDIT_20260928.md` (PR #56)

Tài liệu này **ghi lại 5 quyết định của owner** và chuyển chúng thành kế hoạch thực thi cụ
thể. **Chưa xoá gì** — mỗi bước dưới đây còn là đề xuất cho tới khi bạn nói "bắt đầu".

---

## 1. Quyết định của owner

| # | Câu hỏi | Quyết định | Hệ quả |
|---|---|---|---|
| Q1 | 3 dump trong `backups/` có dữ liệu người dùng thật không? | **Không** | P0 **giảm** mạnh: không phải thông báo khách hàng. Vẫn nên gỡ khỏi git vì 155 MB rác + dữ liệu nội bộ |
| Q2 | 23 test `vnbroker` | **Bỏ** | Xoá có chọn lọc, xem §4 vì 2/4 file còn test khác |
| Q3 | Cây `frontend/` | **Bỏ** | 737 file · 5,74 MB · **và phải gỡ chặn ở pre-commit hook** |
| Q4 | Tài liệu | **Chỉ giữ cái còn liên quan** | Cần quy tắc + đợi duyệt danh sách, xem §5 |
| Q5 | Có thời điểm nào không còn agent chạy? | **Có, hiện tại** | Cho phép rewrite history — **nhưng có 3 PR đang mở**, xem §7 |

Tôi đã kiểm chứng Q5 bằng dữ liệu thay vì tin lời nói: `docs/CLAIMS.md` có **0 claim
`in-progress`**, chỉ có 1 worktree, main tree **0 file chưa commit**. Khớp.

---

## 2. Phát hiện P0 mới — sót lọt trong audit

Trong lúc lập danh sách xoá, tôi thấy `update_admin_password.sql` ở thư mục gốc:

```sql
UPDATE auth_user
SET password='pbkdf2_sha256$600000$5h4qBLIDF27uTxNDJXuChZ4Smrnn2VofPPfDEOMQql4=$YNoWNEhtIsGnPcUwB/VhB+5Fdvy5SR5aGkHJzSFxOM0='
WHERE username='admin';

SELECT id, username, email, is_staff, is_superuser, password FROM auth_user WHERE username='admin';
```

Đây là **hash mật khẩu admin với salt cố định**, cộng thêm một câu `SELECT` in ra email
của admin. File đang được git track.

**Scanner của chính tôi không bắt được**: chạy `scan-secrets.mjs update_admin_password.sql`
→ *"OK, no secrets found"*. Lý do: scanner tìm mẫu `tên_bí_danh = giá_trị`, còn đây là SQL
literal `password='...'`. Đây là lỗ hổng thật của scanner, được ghi lại để sửa.

**Việc cần làm (không thuộc dọn dẹp):** rotate mật khẩu admin. Với `pbkdf2_sha256` +
600.000 vòng lặp thì không bị giải mã tức thì, nhưng nếu mật khẩu yếu thì salt cố định
này khiến việc dò mật khẩu ngoài tuyến trở nên khả thi. Xoá file **không** thay thế cho
việc rotate.

---

## 3. Bước 1 — Xoá rác an toàn (rủi ro ≈ 0)

13 file, tất cả là output rác:

```
backfill_hang_fix.patch
extracted_raw_match_step_110_107.md      extracted_raw_match_step_182_179.md
extracted_raw_match_step_129_126.md      extracted_raw_match_step_185_182.md
extracted_raw_match_step_145_142.md      extracted_raw_match_step_186_183.md
extracted_raw_match_step_151_148.md      extracted_raw_match_step_190_187.md
extracted_raw_match_step_153_150.md      extracted_raw_match_step_154_151.md
test_ohlcv_output.txt
test_output.txt
```

Thêm `.run_resp.json` (17,5 KB, output của một lần chạy) và `update_admin_password.sql`
(§2 — xoá file **và** rotate mật khẩu).

**Kiểm chứng:** `git grep -l "<tên file>"` trước khi xoá, để chắc không có script nào
tham chiếu. `git status` phải sạch sau khi commit.

---

## 4. Bước 2 — Bỏ 23 test `vnbroker` (Q2)

Đã xác định chính xác từ log đo. **Không thể xoá cả 4 file** vì 2 file trộn lẫn test khác:

| File | Số test vnbroker | Hành động |
|---|---|---|
| `market_data/tests/test_vnbroker_adapter_history.py` | **16** | **Xoá cả file** (dành riêng cho vnbroker) |
| `market_data/tests/test_vnbroker_ssi_optin.py` | **2** | **Xoá cả file** |
| `user_workspace/test_broker_retail.py` | 3 | **Xoá 3 test case**, giữ file |
| `data_ingest/tests/test_backfill_tasks.py` | 2 | **Xoá 2 test case**, giữ file |

Sau khi xoá: chạy lại 2 file còn lại để chắc không hỏng thứ khác. Ghi lại trong
`docs/CLEANUP_AUDIT_20260928.md` rằng `vnbroker` là dependency **chưa có trong repo** nhưng
được import ở 6 chỗ production — nếu sau này xây package thì phải viết lại test.

---

## 5. Bước 3 — Bỏ `frontend/` (Q3)

737 file · 5,74 MB · không package nào trỏ tới · không compose nào serve.

**Phải làm cả hai, nếu không sẽ hỏng quy trình:**

1. `git rm -r frontend/`
2. **Gỡ quy tắc chặn `frontend/` khỏi `.git/hooks/pre-commit`.** Hook hiện chặn mọi thay
   đổi trên `backend/` và `frontend/`. Sau khi cây chết biến mất, quy tắc này chỉ còn gây
   nhiễu. *(Lưu ý: `.git/hooks/` không được track — cần cập nhật script nguồn
   `scripts/agent-install-hooks.sh` để người khác cài lại không tái phát.)*

**Kiểm chứng:** `npm run build` + `npx tsc --noEmit` + `npm test` ở `packages/web` phải
xanh trước và sau. Kỳ vọng repo nhỏ hơn ~737 file, nhưng **dung lượng git chỉ giảm sau khi
gc** — `backups/` mới là thứ tốn 155 MB.

---

## 6. Bước 4 — Tài liệu (Q4): "chỉ giữ cái còn liên quan"

Phân bố 1.591 file trong `docs/`:

| Nhóm | Số | Đề xuất |
|---|---|---|
| 2026-04 | 375 | archive |
| 2026-05 | 599 | archive |
| 2026-06 | 74 | archive |
| 2026-07 | 65 | archive |
| 2026-08 | 5 | archive |
| **2026-09** | **127** | **giữ** — công việc hiện hành |
| 2025 | 2 | archive |
| **không đánh số ngày** | **344** | **giữ — cần rà tay** |

Riêng thư mục gốc có thêm **68 file `.md`** (`AUDIT_*`, `FINAL_*`, `SAAS_*`,
`PHASE*_SUMMARY_*`…) và `docs/evidence/` có **180 file**.

**Nguyên tắc đề xuất, để bạn duyệt:**

- **Giữ:** `AGENTS.md`, `README.md`, `docs/AGENT_PROTOCOL.md`, `docs/CLAIMS.md`,
  `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `docs/OPEN_WORK_*.md`, toàn bộ tài liệu 2026-09,
  `docs/evidence/` (là dấu vết kiểm toán), và **bất kỳ file nào được `AGENTS.md` tham chiếu**.
- **Chuyển `docs/archive/<năm>/`:** tài liệu 2026-04 → 2026-08 và 2025.
- **Xoá hẳn:** `README_DRAFT.md` (đã có README chính), và các bản "SUMMARY/COMPLETE" ở
  root trùng nội dung với bản trong `docs/`.

**Tôi cần bạn duyệt trước khi di chuyển hàng loạt.** 344 file không đánh số ngày rất
khó phân loại bằng máy — xoá nhầm tài liệu còn dùng là mất lịch sử quyết định.

---

## 7. Bước 5 — Gỡ `backups/` + rewrite history (Q1, Q5)

Vì bạn xác nhận **không có dữ liệu người dùng thật**, mức độ chuyển từ "sự cố bảo mật"
xuống "dọn rác nghiêm trọng". Vẫn nên làm vì 155 MB rác nằm trong mọi clone.

**Cảnh báo trước khi làm — có 3 PR đang mở:**

| PR | Nội dung |
|---|---|
| #54 | `fix(preflight)` — 3 commit trên `docs/workflow-concurrency-traps`, đã push |
| #55 | đo test discovery |
| #56 | audit dọn dẹp (tài liệu này) |

Không có agent nào *đang chạy*, nhưng #54 có **3 commit chưa merge**. Rewrite history sẽ
làm chúng phải rebase. Thứ tự an toàn:

1. Merge hoặc đóng #54, #55, #56 trước.
2. `git rm -r backups/`
3. Chạy lại gate.
4. **Chỉ sau đó** mới rewrite history để gỡ 3 dump khỏi commit `e4fb0e31`.
5. Bắt buộc: thông báo cho mọi người đang có clone để re-clone — ai giữ clone cũ thì vẫn
   còn dump.

Tôi **không** tự rewrite history. Đó là thao tác không hoàn tác được, cần bạn đứng ra
chịu trách nhiệm và có mọi người biết.

---

## 8. Bước 6 — Test (ngoài Q2)

Giữ nguyên quan điểm đã nêu: **không xoá test chỉ vì nó đỏ.**

- **14 test cơ học** (8 × `django.utils.timezone.utc` đã bị Django 5 xoá, 6 × test tự đóng
  connection) → **sửa**, rủi ro thấp, không đụng hành vi.
- **39 lỗi endpoint** → chia theo feature; chỉ xoá khi feature đã bị hủy, có ghi lý do.
- **17 lỗi format** → sửa dần.
- Bật discovery chỉ **sau khi** các nhóm trên xanh, và bật ở mức **cảnh báo trước**.

---

## 9. Đề xuất việc bổ sung cho PR #56

Bổ sung rule mới cho scanner: phát hiện hash mật khẩu và chuỗi bị mã hoá trong **SQL
literal** (`password='...'`, `token='...'`, `secret='...'`), không chỉ mẫu `tên = giá_trị`.
Nếu không, `update_admin_password.sql` sẽ tái xuất hiện.

---

## 10. Thứ tự đề xuất, mỗi bước một PR

| # | Việc | Rủi ro | Cần bạn |
|---|---|---|---|
| 1 | Xoá 15 file rác ở root | ≈ 0 | — |
| 2 | Xoá 23 test `vnbroker` (2 file + 5 test case) | thấp | — |
| 3 | Sửa 14 test cơ học | thấp | — |
| 4 | Xoá `frontend/` + gỡ chặn hook | thấp | — |
| 5 | Thêm rule SQL literal cho scanner | thấp | — |
| 6 | Rà & chuyển tài liệu 2026-04→08 + 68 `.md` root | trung bình | **duyệt danh sách** |
| 7 | Xoá `backups/` khỏi HEAD | thấp | — |
| 8 | Rewrite history để gỡ 3 dump | **cao, không hoàn tác** | **đóng 3 PR trước** |
| 9 | Gộp jest + vitest | cao | sau khi 1–8 xanh |

Mỗi bước chạy gate thật trước khi đề nghị merge. Không gộp bước nào lại để khi có vấn đề
thì biết ngay nó đến từ đâu.
