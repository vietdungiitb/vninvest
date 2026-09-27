# GitHub Actions — ĐÃ TẮT 2026-09-27

**Trạng thái:** tắt. Không workflow nào chạy.

## Vì sao tắt

GitHub Actions của repo này **không tạo ra tín hiệu nào**:

- **200/200 run gần nhất thất bại. Không một run xanh nào.**
- 8 workflow × 5 run gần nhất = **40/40 fail**.
- Nguyên nhân gốc: `The job was not started because recent account payments have failed or
  your spending limit needs to be increased.` — job fail sau **2–3 giây với `steps=0`**,
  tức runner chưa chạy bước nào. Không phải lỗi code.
- Lỗi này xảy ra trên **cả run của `dev`**, nên không có tín hiệu CI nào khả dụng.

## Bật lại

```bash
git mv .github/workflows-disabled/*.yml .github/workflows/
```

Không cần sửa gì thêm — YAML còn nguyên.

## Những gì đã mất, và chạy thay ở đâu

Toàn bộ logic gate nằm ở **script PowerShell local**, không nằm trong YAML. Nên tắt Actions
không mất logic nào — chỉ mất lớp thực thi tự động.

| Workflow cũ | Logic thật | Chạy tay / tự động ở đâu |
|---|---|---|
| `multi-agent-gate.yml` | `node packages/web/scripts/check-multi-agent.mjs` | `agent-sync.ps1` bước 5 |
| `large-file-guard.yml` | `scripts/quality/check_large_files.ps1` | `agent-sync.ps1` bước 5d (**chỉ cảnh báo**, xem §Sau) |
| `opencore-doc-sync-gate.yml` | `scripts/quality/check_opencore_doc_sync.ps1` | `agent-sync.ps1` bước 5c |
| `web-ci.yml`, `web.yml` | `tsc` + `eslint` + `check:shell` + `vitest` + `build` | `agent-sync.ps1` bước 5b/5b2 |
| `backend.yml`, `core-api.yml` | `manage.py check` + test BE | `agent-sync.ps1` bước 5c (cần `CORE_DATABASE_URL`) |
| `governance-release-gate.yml` | kiểm tra release governance | **chưa có bản local** — xem §Còn thiếu |

## Sau: `check_large_files` chỉ cảnh báo, không chặn

Script này **đang FAIL** trên `dev` (`exit 1`): 77 dòng cảnh báo/vi phạm, nhiều file
`frontend/` (cây legacy đã bị thay bằng `packages/web/`) và
`packages/web/src/components/soc/SocDataOpsConfigSection.tsx` (950 dòng).

Gate này **chưa từng chạy xanh** trên CI nên chưa ai thấy vi phạm. Nếu bật chặn ngay thì
mọi agent đều bị chặn vì nợ tồn đọng sẵn có ⇒ gate sẽ bị bỏ qua, tệ hơn không có.

Đang chạy ở chế độ **warn**. Nâng lên chặn khi nợ đã xử lý xong.

## Còn thiếu — cần bổ sung nếu muốn thay CI

- `governance-release-gate` chưa có bản chạy local. Trước khi tắt Actions thì nó cũng chưa
  từng chạy, nên **không mất tín hiệu nào** — nhưng nếu muốn giữ ý nghĩa thì phải viết script.

## Hệ quả cần biết

- **Không còn gate tự động nào.** Chỉ còn gate chạy tay qua `agent-sync.ps1`.
- Ai đó bypass `agent-sync.ps1` (ví dụ commit thẳng lên `dev`, hoặc `git push --no-verify`)
  sẽ **không bị chặn bởi gì cả**. Đây là đánh đổi thật của việc bỏ CI.
- `AGENTS.md` / `docs/AGENT_PROTOCOL.md` có nhắc tới CI ở một số chỗ — đã cập nhật phần
  nói "chờ CI" thành "chạy local".
