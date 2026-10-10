# Lessons Index - Sổ tay kinh nghiệm hành động

> Sổ tay này chứa các **bẫy thực tế đã từng xảy ra** và gây hậu quả rõ ràng trong dự án.
> Mục đích: **phòng ngừa lặp lại**, không phải ghi lại toàn bộ lịch sử.
>
> Khác với `docs/CODE_CHANGE_AUDIT_LEDGER.md`:
> - **LEDGER** = *đã xảy ra gì* (lịch sử chứng cứ, append-only)
> - **LESSONS** = *phải tránh gì* (playbook phòng ngừa, có checklist hành động)

## 1.1. Mapping Tag → File Lessons

| Tag | File | Mô tả phạm vi áp dụng |
|---|---|---|
| `multi-agent`, `claim`, `claims`, `shared`, `shared-files`, `worktree`, `hook`, `pre-commit`, `rebase`, `agent`, `branch`, `pr` | [`multi-agent.md`](./multi-agent.md) | Quy trình multi-agent, khai claim, file shared, worktree, rebase, hook, `git checkout --` phá dữ liệu. |
| `migration`, `migrations`, `makemigrations`, `leaf`, `leaf-node`, `leaf_node` | [`migrations.md`](./migrations.md) | Django migrations: tránh tự đặt số, đọc head thật, tránh conflicting leaf nodes, worktree vs HEAD. |
| `gate`, `gates`, `build-gate`, `build-gates`, `tsc`, `lint`, `build`, `test`, `PASS`, `CHƯA CHẠY`, `exit`, `no-verify`, `billing`, `ci` | [`build-gates.md`](./build-gates.md) | Build/typecheck/lint/test gates, KHÔNG báo PASS cho thứ chưa chạy, gate trên máy agent, **gate đỏ ở worktree nhưng xanh ở main tree**, đếm route theo registry, số đếm được ≠ số lỗi. |
| `db`, `database`, `postgres`, `backend`, `be-test`, `migrate`, `sqlite` | [`backend.md`](./backend.md) | Backend DB, môi trường test BE cần Postgres, migrate giữa chừng, encoding. |
| `fe`, `frontend`, `bundle`, `vite`, `react`, `hook`, `memo`, `searchParams`, `router`, `page` | [`frontend.md`](./frontend.md) | Đo bundle bằng cạnh import tĩnh, Vite preload, **2 `setSearchParams` trong 1 tick không compose**, **object literal làm memo vô hiệu ⇒ treo render**. |
| `css`, `soc`, `tokens`, `a11y`, `focus`, `color`, `shorthand` | [`css-soc.md`](./css-soc.md) | CSS/SOC tokens, `soc.module.css` chỉ là barrel, script ghi đè CSS shorthand làm mất duration, quét cửa sổ ±N dòng tạo false positive, màu tăng/giảm chuẩn Bloomberg. |
| `powershell`, `shell`, `numstat`, `git`, `line-ending`, `crlf`, `diff`, `citation`, `evidence`, `append` | [`tooling-traps.md`](./tooling-traps.md) | `Get-Content|Set-Content` gộp file, `$LASTEXITCODE` sau pipeline sai, **ghi file = đổi line-ending**, **citation đúng dòng nhưng sai file**. |
| `security`, `secret`, `secrets`, `.env`, `ignore`, `purge`, `fernet` | [`security.md`](./security.md) | Bảo mật, secret trong repo, ignore, quy trình revoke/rotate/purge history. |

## 1.2. Hướng dẫn dùng (Tag-based selection)

Skill [`project-lessons`](../../.opencode/skills/project-lessons/SKILL.md) sẽ:

1. **Phân tích mô tả task** (slice, file paths, hành động: `migrate`, `migration`, `edit`, `shared`, `claim`, `worktree`, `rebase`, `gate`, `test`, `build`, `db`...)
2. **Suy ra tags** phù hợp từ task description
3. **Chỉ đọc file tương ứng** (tag-based selection), **KHÔNG đọc toàn bộ** thư mục
4. **Trả về danh sách `LESSONS APPLICABLE` + CHECKLIST BẮT BUỘC** (tối đa ~15-20 dòng)

**Nguyên tắc an toàn (fallback):** Nếu task có từ khóa mơ hồ liên quan đến
`claim`, `shared`, `migration`, `worktree`, `rebase`, `gate`, `agent`
→ **mặc định load ít nhất [`multi-agent.md`](./multi-agent.md)**.
Ưu tiên an toàn hơn bỏ sót.

### 1.2.1. Ba quy tắc cứng (C1 · C2 · C3) — **có gate kiểm**

Đo 2026-10-10: ba quy tắc này chỉ nằm trong văn bản suốt thời gian qua và
**không quy tắc nào ngăn được** `frontend.md` dài **128 dòng** hay `INDEX.md` ghi
**17 lesson** khi thực tế là **31**. Nay đã có lệnh kiểm:

| # | Quy tắc | Lý do |
|---|---|---|
| **C1** | Một file lesson **≤ 120 dòng** (không tính dòng trống) → **tách tiếp** | Skill luôn đọc **trên về** 1 file; dưới ngưỡng này không bảo đảm cả luật đọc được trong 1 lần. |
| **C2** | Tổng số lesson **≤ 40**. Vượt → **gộp lesson trùng lặp**, KHÔNG thêm file | Vượt ngưỡng thường là hiện tượng viết 2 lesson cho cùng một lỗi, hoặc ghi quy tắc chưa từng gây lỗi. |
| **C3** | `INDEX.md` phải khai **tổng số lesson** và liệt kê **mọi** file lesson | Không khai ⇒ nhánh DRIFT **im lặng**, tức là gate không thấy lệch (đã xảy ra thật). |

```bash
node scripts/check-lessons.mjs                    # C1 + C2 + C3
node scripts/check-lessons.mjs --self-test        # chứng minh gate THẬT SỰ bắt
```

Gate đã nối vào `scripts/pre-push-gate.mjs` (mục `lessons`) nên chạy trước mỗi lần push.
Exit `2` = **không verify được** — tuyệt đối không đọc là PASS.

## 1.3. Quy tắc ghi lesson mới

Chỉ thêm entry mới khi **ĐỒNG THỜI** thỏa cả 4 điều kiện:

- **Đã xảy ra thực tế** trong repo (có bằng chứng: commit / ledger entry / claim)
- **Gây hậu quả rõ ràng** (tốn thời gian, chặn build/merge, sinh conflict)
- **Có thể phòng ngừa trước** (có CHECKLIST rõ ràng để agent thực thi)
- **Atomic**: 1 bài học = 1 lõi sai lầm, tránh gộp nhiều lỗi khác nhau

**Không đưa vào** nếu quy tắc đã có trong `AGENT_PROTOCOL.md` nhưng **chưa từng gây lỗi**
→ thuộc phạm vi quy tắc, không phải bài học. Nếu **đã từng gây lỗi nhiều lần**
→ viết lại dạng checklist ngắn ở đây.

Vượt C1 ⇒ **tách file**, không cắt bớt nội dung. Vượt C2 ⇒ **gộp lesson trùng lặp**,
không thêm file mới.

**Liên kết với hệ thống:** `continuous-learning-v2` có thể **đề xuất** entry mới sau session,
nhưng **cần coordinator phê duyệt** trước khi thêm vào `LESSONS/`.

## 1.4. Format chuẩn của một entry

```markdown
## L-XXX: [Tiêu đề ngắn, phản ánh đúng lỗi đã gặp]

- **Nguyên nhân:** Ngắn gọn, đúng thực tế
- **Hậu quả thật:** VD: "Conflicting migrations; multiple leaf nodes"
- **Khi nào gặp:** `tags: [...]`
- **QUY TẮC:** "KHÔNG ... / PHẢI ..."
- **CHECKLIST:**
  - [ ] Câu hỏi kiểm tra cụ thể, trả lời Có/Không
- **Proof:** `file:line` | `docs/CODE_CHANGE_AUDIT_LEDGER.md#Entry-N` | commit hash
```

⚠ **ID không đồng nhất theo lịch sử**: `multi-agent.md` dùng `L-001`, các file khác
dùng `L-F01`. Gate `check-lessons.mjs` **cố ý nhận cả hai** (`L-(?:[A-Z]+)?\d+`) —
bản Python của `vnbroker` chỉ nhận `L-[A-Z]\d+` và **bỏ sót 8/31 lesson** mà không
báo gì. Đừng thu hẹp regex trước khi chuẩn hoá ID trong file.

## 1.5. Trạng thái

| File | Số lesson |
|---|---|
| [`multi-agent.md`](./multi-agent.md) | 9 |
| [`build-gates.md`](./build-gates.md) | 8 |
| [`css-soc.md`](./css-soc.md) | 4 |
| [`frontend.md`](./frontend.md) | 4 |
| [`migrations.md`](./migrations.md) | 3 |
| [`backend.md`](./backend.md) | 3 |
| [`security.md`](./security.md) | 2 |
| [`tooling-traps.md`](./tooling-traps.md) | 4 |

**Tổng: 37 lesson / 8 file**

- **Nguồn:** trích từ bảng "Cạm bẫy đã gặp thật 2026-09-26" + các mục Progress trong `AGENTS.md`
  + `docs/audit-uiux/SESSION_LOG_WAVE{7,10,11}_*.md`
- **Đổi cấu trúc 2026-10-10:** `frontend.md` tách thành `frontend.md` (bundle + React hook)
  và `css-soc.md` + `tooling-traps.md`, để chờ C1. ID cũ **giữ nguyên**, không renumber.

## 1.6. ⚠ Văn bản trong `css-soc.md` còn bị hỏng — chưa sửa

`docs/LESSONS/` hiện có **ký tự bị nuốt** do `Set-Content`/`.Replace` trên Windows:
`transition` → `ransition`, `font` → `<TAB>ont`, `focus` → mất `f`.
Đo 2026-10-10: chuỗi `transition` nguyên vẹn xuất hiện **1** lần, `ransition` **7** lần.

Đây chính là "PowerShell `.Replace` trên file UTF-8 **no-op âm thầm**" — companion của
lesson 15 trong skill `agent-lessons`. **Chưa sửa** trong wave 11 để giữ diff đọc được;
là ticket riêng. Sửa bằng script Node, **không** dùng PowerShell, và kiểm
`git diff --numstat` sau khi sửa (xem `L-T01`).
