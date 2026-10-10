---
name: project-lessons
description: >-
  Context-aware lessons autoload for VNInvest. Reads ONLY relevant lessons by tags
  extracted from the task description, then returns a short "LESSONS APPLICABLE"
  checklist that must be reflected in the plan. Use BEFORE planning or claiming any
  work that touches migrations, shared files, worktrees, gates, DB, frontend bundles,
  or secrets. Prevents repeating mistakes already recorded in docs/LESSONS/.
---

# project-lessons

## Purpose

Chuyển "kinh nghiệm nhớ lại" thành **"kinh nghiệm buộc phải kiểm tra"** ngay tại thời điểm lập kế hoạch.

Đọc **chỉ phần lesson liên quan** đến task hiện tại (tag-based selection), trả về checklist ngắn.
**KHÔNG** đọc toàn bộ `docs/LESSONS/` - mục tiêu là tránh context bloat.

## When to use

Bắt buộc trước khi:
- Tạo todo list / kế hoạch chi tiết
- Khai claim trong `docs/CLAIMS.md`
- Bắt đầu sửa code

Đây là **Planning Gate** theo `docs/AGENT_PROTOCOL.md` §11.

## Input

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `taskDescription` | Có | Mô tả task/slice đầy đủ |
| `filePaths` | Không | Danh sách file dự kiến sửa (giúp suy ra tag) |
| `actions` | Không | Hành động dự kiến: `migrate`, `edit`, `claim`, `rebase`, `gate`, `build`, `test`, `db`, `shared` |

## Step 1 — Trích tag

Suy ra tag (case-insensitive) từ `taskDescription` + `filePaths` + `actions`:

| Từ khóa / Path | Tags | File cần đọc |
|---|---|---|
| `claim`, `claims`, `shared`, `deny`, `worktree`, `rebase`, `hook`, `pre-commit`, `multi-agent`, `agent`, `branch`, `merge`, `pr`, `checkout --` | `multi-agent` | `docs/LESSONS/multi-agent.md` |
| `migrat`, `migration`, `makemigrations`, `leaf`, `leaf-node`, `leaf_node`, `*/migrations/*` | `migrations` | `docs/LESSONS/migrations.md` |
| `gate`, `gates`, `tsc`, `typecheck`, `lint`, `build`, `test`, `PASS`, `CHƯA CHẠY`, `exit`, `no-verify`, `billing`, `ci` | `build-gates` | `docs/LESSONS/build-gates.md` |
| `db`, `database`, `postgres`, `sqlite`, `backend`, `be-test`, `CORE_DATABASE_URL`, `migrate` | `backend` | `docs/LESSONS/backend.md` |
| `fe`, `frontend`, `bundle`, `vite`, `chunk`, `preload`, `react`, `hook`, `memo`, `useCallback`, `useMemo`, `searchParams`, `setSearchParams`, `router`, `useState` | `frontend` | `docs/LESSONS/frontend.md` |
| `css`, `soc`, `tokens`, `a11y`, `focus`, `color`, `shorthand`, `module.css`, `scss` | `css-soc` | `docs/LESSONS/css-soc.md` |
| `powershell`, `shell`, `numstat`, `git`, `line-ending`, `crlf`, `diff`, `citation`, `evidence`, `append`, `proof` | `tooling-traps` | `docs/LESSONS/tooling-traps.md` |
| `security`, `secret`, `secrets`, `.env`, `ignore`, `purge`, `rotate`, `revoke`, `token`, `fernet`, `history` | `security` | `docs/LESSONS/security.md` |

**Quy tắc an toàn (fallback) — ưu tiên bỏ sót:**
Nếu task có **bất kỳ** từ khóa nào sau: `claim`, `shared`, `migration`, `worktree`,
`rebase`, `gate`, `agent` → **mặc định đọc `multi-agent.md`** bất kể tag suy ra được.

**Fallback thứ hai — chạm vào git hoặc báo cáo bằng chứng:** nếu task sẽ `commit`,
`append` vào file docs, hoặc viết `Proof:` / citation `file:line` → **đọc thêm
`tooling-traps.md`**. Đây là nhóm lỗi đã gây ra diff phình và báo cáo sai lệch.

**Fallback thứ ba — sửa React hook:** nếu task sửa/thêm `use*` hook, `useEffect` deps,
hoặc state đồng bộ URL → **đọc `frontend.md`**.

## Step 2 — Đọc file lesson tương ứng

Đọc **chỉ** các file trong bảng trên. Không đọc `docs/LESSONS/` toàn bộ.
Nếu file không tồn tại → ghi `LESSONS: file KHÔNG TỒN TẠI` (không đoán nội dung).

## Step 3 — Trích checklist

Từ mỗi lesson có tag khớp, lấy:
- `QUY TẮC` (1 dòng, rút gọn)
- `CHECKLIST` (các mục `- [ ]`)

Bỏ qua lesson không khớp tag.

## Step 4 — Trả về

Format output **bắt buộc**:

```
LESSONS APPLICABLE (<n>):
- [L-XXX | <tiêu đề ngắn>] — QUY TẮC: <1 dòng>

MANDATORY CHECKLIST:
- [ ] <item 1>
- [ ] <item 2>
...

FILES READ: <danh sách file đã đọc>
```

**Giới hạn: tối đa ~20 dòng.** Nếu vượt, giữ các mục `KHÔNG`/`PHẢI` và các checklist có rủi ro cao nhất.

**Trường hợp không khớp lesson nào:**
```
LESSONS APPLICABLE: NONE
Lý do: <ngắn gọn>
FILES READ: (none)
```

## Step 5 — Áp dụng vào plan (bắt buộc)

Sau khi nhận output, plan PHẢI chứa **một trong hai dạng**:

- `Lessons áp dụng: [L-XXX, L-M01, ...]`
- `Lessons áp dụng: NONE – <lý do ngắn>`

Và **phải tick các mục trong `MANDATORY CHECKLIST`** trước khi coi slice là xong.

## Anti-pattern (KHÔNG làm)

| Sai lầm | Vì sao sai |
|---|---|
| Đọc toàn bộ `docs/LESSONS/` | Context bloat, agent skim mất tập trung |
| Gọi skill nhưng không ghi `Lessons áp dụng` vào plan | Không ai kiểm chứng được → quy tắc không thi hành được |
| Tự thêm lesson mới vào `docs/LESSONS/` | Cần team leader phê duyệt (xem `INDEX.md` §1.3) |
| Suy ra nội dung lesson khi chưa đọc file | Vi phạm nguyên tắc "không đoán" |
| Bỏ qua fallback `multi-agent.md` vì "task không liên quan" | Đây là nhóm lỗi tần suất cao nhất |

## Cross-reference

- Quy tắc nguồn: `docs/AGENT_PROTOCOL.md` §11 (Planning Gate)
- Danh sách lesson: `docs/LESSONS/INDEX.md`
- **Gate máy kiểm C1/C2/C3**: `node scripts/check-lessons.mjs` (+ `--self-test`) — chạy
  trong `scripts/pre-push-gate.mjs`. Sửa `docs/LESSONS/` mà quên chạy ⇒ push sẽ bị chặn.
- Bằng chứng gốc: `docs/CODE_CHANGE_AUDIT_LEDGER.md`