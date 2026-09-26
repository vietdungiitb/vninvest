# Khối luật multi-agent — để dán vào `AGENTS.md`

> **File này chưa được dán.** `AGENTS.md` đang bị `core-team` sửa (chưa commit),
> mà `AGENTS.md` nằm trong shared-file deny list của chính protocol này.
> Nên phần này được tách riêng: **coordinator dán vào `AGENTS.md`** khi
> `core-team` commit xong.
>
> Dán vào ngay sau mục `## Goal`, trên `## Constraints & Preferences`.

---

## Multi-agent (bắt buộc khi ≥ 2 agent cùng làm việc)

**Nguyên tắc:** thứ tự lệnh quan trọng hơn độ chặt của luật. Đọc
`docs/AGENT_PROTOCOL.md` §1 trước khi sửa gì.

### Không được

- **Không commit thẳng vào `dev`.** Tạo `feat/<slice>-<agent>` rồi PR.
- **Không commit 11 file shared** (xem §2 protocol): `AGENTS.md`,
  `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `packages/web/package.json`,
  `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`.
  Viết vào claim + báo coordinator. Hook sẽ chặn.
- **Không sửa file agent khác đang claim `in-progress`.**
- **Không tự đặt số migration.** Đọc head thật, hoặc để `makemigrations` sinh.
- **Không chạy `npm install`/`pip install` khi chưa hỏi** (junction `node_modules` dùng chung).
- **Không báo "PASS" cho thứ chưa chạy.** Ghi `CHƯA CHẠY`.
- **Không dùng `--no-verify` để lách hook** trừ khi ghi lý do vào commit body.

### Bắt buộc

1. **Mở phiên:** `sh scripts/agent-install-hooks.sh` → `pwsh -File scripts/agent-sync.ps1`
   → `git -C <main tree> status --short`
2. **Khai claim** vào cuối `docs/CLAIMS.md`, commit riêng, trước khi sửa dòng đầu tiên
3. **Đóng phiên:** `pwsh -File scripts/agent-sync.ps1` (rebase + check migration + gate)
   → claim `done` → push → `pwsh -File scripts/agent-pr.ps1`
4. **Sau khi PR merge:** `pwsh -File scripts/agent-cleanup.ps1 -Branch <branch>`

### Cạm bẫy đã gặp thật 2026-09-26

| Sai lầm | Hậu quả | Chống bằng |
|---|---|---|
| Commit file shared | 1 hunk gộp 2 agent, tách không được | Hook `pre-commit` |
| Tự đặt số migration | `Conflicting migrations; multiple leaf nodes` — chặn deploy | `agent-sync.ps1` bước 4 + gate |
| Khai claim khi chưa `git status` | Che mất file đang bị giữ | Protocol §3 |
| Chạy gate **trước** khi rebase | Báo xanh nhưng code sau rebase khác | `agent-sync.ps1` chạy gate **sau** rebase |
| Tin số migration đọc trong worktree | Worktree không thấy việc chưa commit của agent khác | Đọc head trên `dev` lúc tạo migration |
| Hook chưa commit khi tạo worktree mới | Hook im lặng, mọi thứ lọt | Commit hook trước, worktree sau |

### Gate bắt buộc trước khi báo xong

```powershell
node packages/web/scripts/check-multi-agent.mjs    # luon
npx tsc --noEmit                                   # neu sua packages/web
python manage.py check                             # neu sua backend
# BE test: can CORE_DATABASE_URL + DJANGO_DEBUG=1, xem protocol §4
```

### Không có môi trường ⇒ không có kết luận

Nếu chưa chạy được test (thiếu DB, thiếu env), **phải ghi rõ "CHƯA CHẠY"** trong
báo cáo và PR body. Không suy ra "chắc là được" — đó là sai lầm đã xảy ra.
