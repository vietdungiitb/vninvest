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
| `multi-agent`, `claim`, `claims`, `shared`, `shared-files`, `worktree`, `hook`, `pre-commit`, `rebase`, `agent` | [`multi-agent.md`](./multi-agent.md) | Quy trình multi-agent, khai claim, file shared, worktree, rebase, timing gate, hook pre-commit. |
| `migration`, `migrations`, `makemigrations`, `leaf`, `leaf-node`, `leaf_node` | [`migrations.md`](./migrations.md) | Django migrations: tránh tự đặt số, đọc head thật, tránh conflicting leaf nodes, worktree vs HEAD. |
| `gate`, `gates`, `build-gate`, `build-gates`, `tsc`, `lint`, `build`, `pass-vs-unrun`, `test` | [`build-gates.md`](./build-gates.md) | Build/typecheck/lint/test gates, KHÔNG báo PASS cho thứ chưa chạy, gate trên máy agent, **con số đếm được KHÔNG phải con số lỗi (phân loại mức độ trước khi báo cáo)**, `deletions` bất thường là triệu chứng, revert theo lô làm mất fix, **đếm route theo registry chứ không theo tên file (component con không phải route)**. |
| `db`, `database`, `postgres`, `backend`, `be-test`, `migrate`, `sqlite` | [`backend.md`](./backend.md) | Backend DB, môi trường test BE cần Postgres, migrate giữa chừng, encoding. |
| `fe`, `frontend`, `bundle`, `i18n`, `css`, `tokens`, `soc` | [`frontend.md`](./frontend.md) | Frontend, bundle, i18n, CSS/SOC tokens, tránh đo bundle sai, **KHÔNG dùng Get-Content|Set-Content để sửa file nhiều dòng (gộp file thành 1 dòng)**, script sửa CSS shorthand phải giữ duration/easing, quét theo cửa sổ ±N dòng tạo false positive, `$LASTEXITCODE` sau pipeline là sai, màu tăng/giảm theo chuẩn Bloomberg. |
| `security`, `secret`, `secrets`, `.env`, `ignore`, `purge`, `fernet` | [`security.md`](./security.md) | Bảo mật, secret trong repo, ignore, quy trình revoke/rotate/purge history. |

## 1.2. Hướng dẫn dùng (Tag-based selection)

Skill [`project-lessons`](../../skills/project-lessons/SKILL.md) sẽ:

1. **Phân tích mô tả task** (slice, file paths, hành động: `migrate`, `migration`, `edit`, `shared`, `claim`, `worktree`, `rebase`, `gate`, `test`, `build`, `db`...)
2. **Suy ra tags** phù hợp từ task description
3. **Chỉ đọc file tương ứng** (tag-based selection), **KHÔNG đọc toàn bộ** thư mục
4. **Trả về danh sách `LESSONS APPLICABLE` + CHECKLIST BẮT BUỘC** (tối đa ~15-20 dòng)

**Nguyên tắc an toàn (fallback):** Nếu task có từ khóa mơ hồ liên quan đến
`claim`, `shared`, `migration`, `worktree`, `rebase`, `gate`, `agent`
→ **mặc định load ít nhất [`multi-agent.md`](./multi-agent.md)**.
Ưu tiên an toàn hơn bỏ sót.

## 1.3. Quy tắc ghi lesson mới

Chỉ thêm entry mới khi **ĐỒNG THỜI** thỏa cả 4 điều kiện:

- **Đã xảy ra thực tế** trong repo (có bằng chứng: commit / ledger entry / claim)
- **Gây hậu quả rõ ràng** (tốn thời gian, chặn build/merge, sinh conflict)
- **Có thể phòng ngừa trước** (có CHECKLIST rõ ràng để agent thực thi)
- **Atomic**: 1 bài học = 1 lõi sai lầm, tránh gộp nhiều lỗi khác nhau

**Không đưa vào** nếu quy tắc đã có trong `AGENT_PROTOCOL.md` nhưng **chưa từng gây lỗi**
→ thuộc phạm vi quy tắc, không phải bài học. Nếu **đã từng gây lỗi nhiều lần**
→ viết lại dạng checklist ngắn ở đây.

**Liên kết với hệ thống:** `continuous-learning-v2` có thể **đề xuất** entry mới sau session,
nhưng **cần team leader phê duyệt** trước khi thêm vào `LESSONS/`.

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

## 1.5. Trạng thái

- **Có:** `multi-agent.md` (L-001..L-008), `migrations.md` (L-M01..L-M03), `build-gates.md` (L-G01..L-G02), `backend.md` (L-B01..L-B02), `frontend.md` (L-F01), `security.md` (L-S01)
- **Nguồn:** Trích từ bảng "Cạm bẫy đã gặp thật 2026-09-26" + các mục Progress trong `AGENTS.md`
- **Mở rộng:** Thêm entry khi có bài học mới đủ giá trị theo §1.3