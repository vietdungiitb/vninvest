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
| `measure`, `measurement`, `verify`, `probe`, `computed`, `contrast`, `parser`, `fail-before`, `root-cause`, `audit`, `screenshot`, `evidence`, `artifact`, `mutate`, `claim cua nguoi khac` | `verification` | `docs/LESSONS/verification.md` |
| `false-green`, `xanh-gia`, `pass`, `delete`, `script`, `numstat`, `resolve`, `proxy`, `urlconf`, `curl`, `dangling`, `suite`, `baseline`, `update-baseline`, `undecodable`, `oklch`, `id`, `set`, `hash`, `count`, `not-measured` | `false-green` | `docs/LESSONS/false-green.md` |

**Quy tắc an toàn (fallback) — ưu tiên bỏ sót:**

1. Nếu task có **bất kỳ** từ khóa nào sau: `claim`, `shared`, `migration`, `worktree`,
   `rebase`, `gate`, `agent` → **mặc định đọc `multi-agent.md`** bất kể tag suy ra được.
2. Nếu task **đo, kiểm chứng, hoặc điều tra** — `đo`, `đo được`, `verify`, `kiểm chứng`,
   `audit`, `screenshot`, `ảnh chụp`, `contrast`, `fail-before`, `root cause`, `gốc rễ`,
   `claim của người khác`, `script đo`, `probe`, `computed style` → **mặc định đọc
   `verification.md`**. Nhóm này gồm những lỗi **không báo lỗi** (sai âm thầm): script
   đo sai vẫn ra số hợp lý, và gốc rễ kế thừa từ ledger/claim/audit có thể sai hoàn toàn.
3. **Fallback thứ hai — chạm vào git hoặc báo cáo bằng chứng:** nếu task sẽ `commit`,
   `append` vào file docs, hoặc viết `Proof:` / citation `file:line` → **đọc thêm
   `tooling-traps.md`**. Đây là nhóm lỗi đã gây ra diff phình và báo cáo sai lệch.
4. **Fallback thứ ba — sửa React hook:** nếu task sửa/thêm `use*` hook, `useEffect` deps,
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

## Step 6 — GHI BÀI HỌC MỚI (bắt buộc khi vừa mắc lỗi)

Một lỗi không được ghi thì slice sau sẽ mắc lại — đúng thứ hệ thống này sinh ra để
chặn. **Ghi ngay trong phiên đang làm, KHÔNG cần xin duyệt ai** (Owner chốt
2026-10-18; xem `docs/LESSONS/INDEX.md` §1.3).

Đủ cả 4 điều kiện: đã xảy ra thực tế (có commit/ledger/claim) · gây hậu quả rõ
(tốn thời gian, chặn build, lừa người đọc báo cáo) · có checklist phòng ngừa được ·
**atomic** (1 entry = 1 lõi sai lầm).

Cách làm:

1. Chọn file theo **chủ đề** (tag), không phải file đang ngẫu nhiên.
2. **File sắp vượt C1 (120 dòng) ⇒ TÁCH FILE MỚI** (`<chủ đề>-2.md`).
   **KHÔNG gộp entry cũ, KHÔNG xoá entry cũ** — entry cũ có thể đã được diễn giải
   sai ở nơi khác; xoá là mất dấu vết. Muốn đính chính entry cũ thì thêm entry
   mới có Proof trỏ ngược, hoặc thêm dòng "ĐÃ SỬA/ĐÃ GỘP" **bên trong** entry cũ.
3. Ghi **Proof** trỏ `file:line` hoặm `CODE_CHANGE_AUDIT_LEDGER.md#Entry-N`.
4. Cập nhật bảng ở `INDEX.md` §1.5 (số lesson + ID của file vừa sửa) — gate C3 bắt lệch.
5. Chạy `node scripts/check-lessons.mjs` (exit 0) trước khi commit.

Trong output của skill, nhắc lại điều này ở dạng:

```
GHI LESSON MỚI: <bắt buộc nếu phiên này mắc lỗi đã tốn thời gian / chặn build / lừa người đọc báo cáo>
```

## Anti-pattern (KHÔNG làm)

| Sai lầm | Vì sao sai |
|---|---|
| Đọc toàn bộ `docs/LESSONS/` | Context bloat, agent skim mất tập trung |
| Gọi skill nhưng không ghi `Lessons áp dụng` vào plan | Không ai kiểm chứng được → quy tắc không thi hành được |
| **Mắc lỗi rồi không ghi lesson, để "chờ có người duyệt"** | Chính là lỗi xảy ra 2026-10-17: 3 bài học lớn biến mất vì nghĩ phải xin duyệt |
| Ghi đè / gộp entry cũ để lấy chỗ | Entry cũ có thể đã được diễn giải sai ở nơi khác → mất dấu vết |
| Vượt C1 mà nhồi thêm vào file hiện tại | Mất tác dụng chống đọc lướt; phải tách file mới |
| Suy ra nội dung lesson khi chưa đọc file | Vi phạm nguyên tắc "không đoán" |
| Bỏ qua fallback `multi-agent.md` vì "task không liên quan" | Đây là nhóm lỗi tần suất cao nhất |

## Cross-reference

- Quy tắc nguồn: `docs/AGENT_PROTOCOL.md` §11 (Planning Gate)
- Danh sách lesson: `docs/LESSONS/INDEX.md`
- **Gate máy kiểm C1/C2/C3**: `node scripts/check-lessons.mjs` (+ `--self-test`) — chạy
  trong `scripts/pre-push-gate.mjs`. Sửa `docs/LESSONS/` mà quên chạy ⇒ push sẽ bị chặn.
- Bằng chứng gốc: `docs/CODE_CHANGE_AUDIT_LEDGER.md`