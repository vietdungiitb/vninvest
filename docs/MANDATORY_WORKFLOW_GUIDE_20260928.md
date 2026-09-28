# Hướng dẫn sử dụng Mandatory Agent Workflow

> Dành cho **agent** (và người review agent) làm việc trong `vninvest` hoặc repo khác.
> Quy trình gốc: `~/.opencode/instructions/MANDATORY-WORKFLOW.md` (nạp mỗi session).
> Chi tiết định nghĩa: `docs/AGENT_PROTOCOL.md`.
>
> `verified: 2026-09-28 @ 262eb9c4`

---

## 0. Trong `vninvest` — không cần cấu hình gì

Đã nối sẵn. Agent mở session là chạy.

| Thành phần | Vị trí | Trạng thái |
|---|---|---|
| Quy trình bắt buộc | `~/.opencode/instructions/MANDATORY-WORKFLOW.md` | nạp qua `opencode.json.instructions` |
| 10 hook (7 pre-bash + 3 post-bash) | `~/.opencode/scripts/hooks/` | qua `bash-hook-dispatcher.js` |
| Preflight chặn deny-list | `AGENT_PREFLIGHT_MODE=block` mặc định | **đang chặn** |
| 13 gate | `.husky/pre-push` | chạy mỗi `git push` |

Chạy kiểm tra sức khoẻ:

```bash
node scripts/pre-push-gate.mjs        # kỳ vọng: 13 PASS / 0 FAIL
node scripts/verify-global-config.mjs  # kỳ vọng: exit 0
```

---

## 1. Agent phải làm gì mỗi lần code

### Tầng 0 — luôn, dưới 6 giây

```bash
git status    # 1. Tôi đang ở đâu? File nào đang bị giữ?
```

2. **Đọc `docs/CLAIMS.md` trước khi tin `AGENTS.md`.** Tài liệu tổng hợp có thể cũ; registry là nguồn sự thật.
3. **Verify claim của agent khác bằng code thật.** Đừng tin tin nhắn.
4. **Mọi con số phải kèm lệnh tạo ra.** Không tự bịa.
5. **Chạy gate cho phần đã đổi, báo output thật.**
6. **Không chạy được → ghi `CHƯA CHẠY`.** Không suy ra "chắc là được".

### Khai claim — trước khi sửa dòng đầu tiên

Thêm 1 dòng vào cuối `docs/CLAIMS.md`, commit riêng:

```
| `ten-agent` | `feat/ten-slice` | t | `duong/dan/file` | in-progress | 2026-09-28 | ly do |
```

`docs/CLAIMS.md` là **append-only**: được sửa bình thường, nhưng chỉ được thêm **dòng của chính mình** vào `CLAIMS.md` — dòng của agent khác thì preflight chặn.

### Trước lúc commit — bắt buộc

```bash
git status --short     # đúng những gì tôi định đổi
git diff --cached      # có dòng lạ của người khác lọt vào không?
git diff --unified=0 -- <shared file>   # tách hunk nếu file dùng chung
```

Thấy dòng không phải của mình → **unstage**, dừng commit.

---

## 2. Ba cửa lách — và vì sao vẫn để mở

```bash
git commit --no-verify            # lách toàn bộ pre-commit + pre-push
SKIP_PRE_PUSH_GATE=1 git push    # lách 13 gate
AGENT_PREFLIGHT=0                # tắt preflight
```

Cả 3 **còn mở cố ý**. Lý do: `AGENT_PROTOCOL.md` §2 cho phép coordinator sửa file deny-list
(ví dụ thêm script vào `check:shell`), và đó là bước duy nhất để làm việc đó mà vẫn
ghi được lý do vào commit. Gỡ 3 cửa này thì coordinator không còn đường hợp pháp.

Nếu muốn siết, phải chọn: **siết chặt**, hoặc **giữ đường ghi claim**. Không có cách thứ ba.

---

## 3. Đưa sang repo khác

Phần này **chưa** tự động. Không làm thì ở repo đó preflight vẫn chạy (dùng 16 file mặc định),
nhưng **11/13 gate SKIP, exit 0** — tức gần như không kiểm gì.

### 3.1. Deploy lên máy

```bash
# copy từ repo vninvest, hoặc dùng lệnh deploy có sẵn
node tools/opencode-global/deploy.mjs
node scripts/verify-global-config.mjs    # exit 0 = đã khớp
```

Bản deployed phải chạy được **standalone**:

```
~/.opencode/scripts/agent-preflight.mjs
~/.opencode/scripts/deny-extract.mjs      ← dependency, thiếu là crash
~/.opencode/scripts/test-agent-preflight.mjs
~/.opencode/instructions/MANDATORY-WORKFLOW.md
~/.opencode/scripts/hooks/pre-bash-agent-preflight.js
~/.opencode/scripts/package.json           ← {"type":"commonjs"}, bắt buộc
```

`scripts/package.json` không có nghĩa là hook `.js` chết: `~/.opencode/package.json` đặt
`"type": "module"`, mọi hook dùng `require()` sẽ `ReferenceError`.

### 3.2. Tạo deny list cho repo đó

`tools/opencode-global/deny-extract.mjs` đọc bảng trong (theo thứ tự, dừng ở file đầu tiên có bảng):

```
docs/AGENT_PROTOCOL.md  →  AGENT_PROTOCOL.md  →  AGENTS.md  →  CLAUDE.md
```

Định dạng cell đầu cột, phân tách bằng dấu phẩy, có thể kèm giải thích sau `:`:

```markdown
| File | Vì sao | Ai được sửa |
|---|---|---|
| `pyproject.toml`, `requirements.txt` | deps | Coordinator |
| `docker-compose*.yml`, `.env*` | hạ tầng dùng chung | Coordinator |
| `packages/web/package.json`: mọi agent đều thêm script | scripts | Coordinator |
```

Không có bảng thì chỉ chạy 16 file mặc định.

### 3.3. Copy gate

```bash
cp .husky/pre-push         <repo>/
mkdir -p scripts && cp scripts/pre-push-gate.mjs scripts/
```

Gate tự `SKIP` những gate vninvest-đặc thù (`tsc`, `check-multi-agent`, `i18n-strict`) nếu
thiếu điều kiện. **SKIP không phải PASS** — xem dòng cuối output.

---

## 4. Nguyên tắc vàng — từ 6 lỗi thật trong phiên 2026-09-27

> **"Gate chạy exit 0" không phải bằng chứng gate hoạt động.**

Trong một phiên, 6 lần tin vào exit 0 dẫn tới kết luận sai. Nguyên nhân đều khác nhau:

| Vì sao | Ví dụ |
|---|---|
| Test injection không thay đổi gì | stage file trùng `HEAD` ⇒ preflight thấy "không staged" ⇒ PASS **sai** |
| Inject sai file | đưa lỗi vào `src/i18n/vi.js`, file bị config loại có chủ ý |
| Chạy nhầm binary | `npx tsc` từ repo root resolve package `tsc` **deprecated**, in banner, exit 1, không in lỗi nào |
| Windows-specific | `npx` là shim `.cmd`; Node chặn spawn không shell ⇒ `EINVAL` |
| Gate báo "chưa chạy được" như "0 lỗi" | `spawnSync` ENOENT ⇒ `status === null` bị đọc thành exit ≠ 0 với 0 dòng lỗi |
| Probe đo sai thứ cần đo | `verify-shim` kiểm log ⇒ đo *"có file đang staged"*, không đo *"shim có gọi canonical"* |

**Bắt buộc:** mỗi gate mới phải có **negative test** — inject lỗi thật, xác nhận gate FAIL.
Và negative test của chính probe cũng phải FAIL khi thay thế thứ nó kiểm.

```
sạch        → exit 0
inject lỗi  → exit 1     ← dòng này mới là bằng chứng
```

---

## 5. Cạm bẫy đã gặp thật

| Cạm bẫy | Hậu quả |
|---|---|
| Cộng gộp `--stat` từng commit | đếm trùng file sửa ở cả hai commit ⇒ số liệu sai |
| `ReadAllLines`/`WriteAllLines` (PowerShell) trên file tiếng Việt | ghi mojibake thật vào file. Sau mỗi `edit`: `git diff --numstat` phải khớp |
| Round-trip file UTF-8 bằng `Set-Content` | mất BOM/dấu. Dùng `[System.IO.File]::WriteAllText` với `UTF8Encoding($false)` |
| Bỏ qua bảng deny list vì "giống mặc định" | cơ chế đọc tài liệu yếu hơn quảng cáo — phải đo, đừng đoán |
| Tự đặt số migration | `Conflicting migrations; multiple leaf nodes` — chặn deploy |

---

## 6. Khi nào không áp dụng

- **Một mình, một repo, không có agent khác** → bỏ qua phần worktree/claim, giữ Tầng 0.
- **Repo không phải git** → `CLAIMS.md` tuỳ chọn; check 2 và 3 tự bỏ qua.
- **Chỉ đọc, không sửa** → không cần khai claim.

---

## Tài liệu liên quan

| File | Vai trò |
|---|---|
| `~/.opencode/instructions/MANDATORY-WORKFLOW.md` | quy trình gốc, nạp mỗi session |
| `docs/AGENT_PROTOCOL.md` | định nghĩa deny list §2, registry §3 |
| `docs/CLAIMS.md` | registry — nguồn sự thật về trạng thái claim |
| `docs/evidence/gate-audit/baseline.md` | đo 8 gate: cái nào thật, cái nào báo lỗi rồi exit 0 |
| `docs/IMPLEMENTATION_PLAN_MANDATORY_AGENT_WORKFLOW_20260927.md` | kế hoạch 6 phase |
| `tools/opencode-global/` | canonical — nguồn triển khai duy nhất |
