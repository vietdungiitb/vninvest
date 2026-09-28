# MANDATORY WORKFLOW — quy trình bắt buộc cho mọi lệnh code

> File này **luôn được nạp** ở mọi session, mọi repo. Đọc trước khi viết code.
> Nguồn chi tiết: `docs/IMPLEMENTATION_PLAN_MANDATORY_AGENT_WORKFLOW_20260927.md` (repo vninvest).

## Thứ tự thẩm quyền — khi mâu thuẫn, THẮNG theo thứ tự này

```
1. CLAIMS.md / git log        (trạng thái thực tế)
2. AGENTS.md                  (ý định, quy trình)
3. skill (playbook)           (chỉ khi match)
4. yêu cầu trong chat         (ghi vào claim nếu phá protocol)
```

Mâu thuẫn → nguồn số 1 thắng, **và phải ghi việc sửa lại nguồn số 2-3**.

## Bảng leo thang — chạy trước khi sửa gì

| # | Kiểm tra | Lệnh | Có → |
|---|---|---|---|
| 1 | Đang ở integration branch? | `git rev-parse --abbrev-ref HEAD` = `main`/`dev`/`master` | **T2** |
| 2 | File sửa có trong deny list? | so với `docs/AGENT_PROTOCOL.md` §2 (nếu có) | **T2** |
| 3 | Tạo/sửa migration? | `git status --short \| grep migrations/` | **T2** |
| 4 | File bị agent khác claim `in-progress`? | `grep 'in-progress' docs/CLAIMS.md` | **DỪNG** |
| 5 | >1 agent chạy song song? | `git worktree list` + `grep 'in-progress' docs/CLAIMS.md` | **T2** |
| 6 | Đụng >1 nhóm file rời nhau? | `git status --short` | **T1** |
| — | Còn lại | | **T0** |

## TẦNG 0 — luôn, mọi lệnh code (6 món, vài giây)

1. **`git status`** — biết mình ở đâu, trên branch nào, file nào đang bị giữ.
2. **Đọc CLAIMS.md trước khi tin AGENTS.md** về trạng thái. Tài liệu tổng hợp có thể cũ.
3. **Verify claim của agent khác trước khi dùng.** Không tin phần tóm tắt — đọc code thật.
4. **Mọi con số phải kèm lệnh tái tạo.** Không tái tạo được → ghi `ƯỚC LƯỢNG` hoặc xoá. Con số không có lệnh là con số bịa.
5. **Chạy gate cho phần đã đổi, báo output thật.**
6. **Không chạy được → `CHƯA CHẠY`.** Không suy ra "chắc là được". Đây là kết quả hợp lệ.

## TẦNG 1 — thêm

- Branch riêng, không commit thẳng vào integration branch.
- Khai claim trước khi sửa dòng đầu tiên.
- **Trước khi commit** (bắt buộc, chạy cả hai):
  ```
  git status --short          # đúng những gì tôi định đổi?
  git diff --cached           # có dòng của người khác lọt vào không?
  ```
  `git diff --unified=0 -- <shared file>` để tách hunk. Thấy dòng không phải của mình → **unstage**, đừng commit.

## TẦNG 2 — thêm

- Worktree riêng cho mỗi agent, database riêng.
- Đủ 8 gate của skill `multi-agent-workflow`.
- Rebase lên integration branch rồi **chạy lại mọi gate**. Gate chạy trước rebase nói không điều gì về code sau rebase.

## Việc cấm

- **Không round-trip file không-ASCII** qua PowerShell (`ReadAllLines` → `WriteAllLines`). Đọc sai decoder sẽ ghi mojibake thật vào file. Sau mỗi `edit` file có tiếng Việt: `git diff --numstat` phải khớp số dòng dự kiến.
- **Không commit file shared** khi đang chạy song song (deny list). Ghi yêu cầu vào cột `note` của claim.
- **Không báo PASS cho thứ chưa chạy.** Không tin `PASS` của người khác — tự chạy lại.
- **Không `--no-verify`** trừ khi ghi lý do vào commit body.
