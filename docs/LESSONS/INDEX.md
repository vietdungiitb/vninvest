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
| `multi-agent`, `claim`, `claims`, `shared`, `shared-files`, `worktree`, `hook`, `pre-commit`, `rebase`, `agent`, `branch`, `pr`, `docker`, `postgres`, `db-down`, `new-agent`, `agent-pr`, `eol-drift`, `byte-drift` | [`multi-agent.md`](./multi-agent.md) + [`multi-agent-2.md`](./multi-agent-2.md) | Quy trình multi-agent, khai claim, file shared, worktree, rebase, hook, `git checkout --` phá dữ liệu. **+ môi trường pipeline**: Docker chết chặn Stage 0 · `agent-pr.ps1` hỏng cú pháp chặn Stage 7 · gate byte-sensitive đỏ ở mọi worktree mới. |
| `migration`, `migrations`, `makemigrations`, `leaf`, `leaf-node`, `leaf_node` | [`migrations.md`](./migrations.md) | Django migrations: tránh tự đặt số, đọc head thật, tránh conflicting leaf nodes, worktree vs HEAD. |
| `gate`, `gates`, `build-gate`, `build-gates`, `tsc`, `lint`, `build`, `test`, `PASS`, `CHƯA CHẠY`, `exit`, `no-verify`, `billing`, `ci` | [`build-gates.md`](./build-gates.md) | Build/typecheck/lint/test gates, KHÔNG báo PASS cho thứ chưa chạy, gate trên máy agent, **gate đỏ ở worktree nhưng xanh ở main tree**, đếm route theo registry, số đếm được ≠ số lỗi. |
| `db`, `database`, `postgres`, `backend`, `be-test`, `migrate`, `sqlite` | [`backend.md`](./backend.md) | Backend DB, môi trường test BE cần Postgres, migrate giữa chừng, encoding. |
| `fe`, `frontend`, `bundle`, `vite`, `react`, `hook`, `memo`, `searchParams`, `router`, `page` | [`frontend.md`](./frontend.md) | Đo bundle bằng cạnh import tĩnh, Vite preload, **2 `setSearchParams` trong 1 tick không compose**, **object literal làm memo vô hiệu ⇒ treo render**. |
| `css`, `soc`, `tokens`, `a11y`, `focus`, `color`, `shorthand`, `table`, `sticky`, `overflow`, `dark-mode`, `layout` | [`css-soc.md`](./css-soc.md) | CSS/SOC tokens, `soc.module.css` chỉ là barrel, script ghi đè CSS shorthand làm mất duration, quét cửa sổ ±N dòng tạo false positive, màu tăng/giảm chuẩn Bloomberg, **đọc CSS đã build mới kết luận class có map** (L-F11). |
| `powershell`, `shell`, `numstat`, `git`, `line-ending`, `crlf`, `diff`, `citation`, `evidence`, `append` | [`tooling-traps.md`](./tooling-traps.md) | `Get-Content|Set-Content` gộp file, `$LASTEXITCODE` sau pipeline sai, **ghi file = đổi line-ending**, **citation đúng dòng nhưng sai file**. |
| `edit`, `fuzzy`, `tool`, `replace`, `stash`, `crlf`, `lf`, `eol`, `diff`, `numstat` | [`tooling-traps-2.md`](./tooling-traps-2.md) | **`Edit` khớp MỜ ⇒ sửa nhầm biến** (không báo lỗi), **`git stash` đổi LF→CRLF** ⇒ phải `normalize-eol --fix` sau mỗi lần. |
| `security`, `secret`, `secrets`, `.env`, `ignore`, `purge`, `fernet` | [`security.md`](./security.md) | Bảo mật, secret trong repo, ignore, quy trình revoke/rotate/purge history. |
| `measure`, `measurement`, `verify`, `probe`, `computed`, `contrast`, `parser`, `fail-before`, `root-cause`, `audit`, `screenshot`, `evidence`, `artifact`, `mutate` | [`verification.md`](./verification.md) | **Sai lầm không báo lỗi**: script đo sai vẫn ra số hợp lý, kiểm tra tồn tại bằng stdout, verify nhầm artifact, gốc rễ kế thừa phải có phản chứng, chạy test làm bẩn working tree. |
| `merge`, `conflict`, `syntax`, `false-green`, `xanh-gia`, `push`, `hook`, `pre-push`, `node --check` | [`build-gates-2.md`](./build-gates-2.md) | **Ghep conflict TAY lam hong gate** ⇒ "push thanh cong" KHONG chung minh gate da chay; phai `node --check` + chay lai gate. |
| `false-green`, `xanh-gia`, `pass`, `delete`, `script`, `numstat`, `resolve`, `proxy`, `urlconf`, `curl`, `dangling`, `suite`, `baseline`, `update-baseline`, `undecodable`, `oklch`, `id`, `set`, `hash`, `count`, `not-measured` | [`false-green.md`](./false-green.md) | **Xanh gia khong kiem tra gi**: suite xanh khi **so test giam**, `resolve()` bi `legacy_proxy_view` che, phai do bang **HTTP that**. |

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
| **C1** | Một file lesson **≤ 120 dòng** (không tính dòng trống) → **tách file mới theo chủ đề**, KHÔNG nhồi thêm vào file cũ | Skill luôn đọc **trên về** 1 file; dưới ngưỡng này không bảo đảm cả luật đọc được trong 1 lần. Đây là cơ chế **chống đọc lướt** — giữ nguyên. |
| **C2** | Tổng số lesson **≤ 60**. Vượt → **tách file chủ đề mới**, KHÔNG gộp bài học không liên quan; chỉ gộp khi hai entry **thật sự trùng nội dung** (và giữ dòng bản bị gộp trong Proof) | Nới 40 → 60 ngày 2026-10-18 (Owner). Ngưỡng cũ **đã đầy** và biến việc ghi bài học thành rào chặn — phiên 2026-10-17 bỏ sót 3 bài học lớn vì lý do đó. |
| **C3** | `INDEX.md` phải khai **tổng số lesson** và liệt kê **mọi** file lesson | Không khai ⇒ nhánh DRIFT **im lặng**, tức là gate không thấy lệch (đã xảy ra thật). Ngoài ra mọi `L-XXX` viết trong `INDEX.md` đều bị gate hiểu là **tham chiếu** — văn bản minh hoạ cũng phải đúng, nếu không sẽ báo DRIFT. |

```bash
node scripts/check-lessons.mjs                    # C1 + C2 + C3
node scripts/check-lessons.mjs --self-test        # chứng minh gate THẬT SỰ bắt
```

Gate đã nối vào `scripts/pre-push-gate.mjs` (mục `lessons`) nên chạy trước mỗi lần push.
Exit `2` = **không verify được** — tuyệt đối không đọc là PASS.

## 1.3. Quy tắc ghi lesson mới

**Ghi bài học là việc được KHUYẾN KHÍCH, không cần xin duyệt** (Owner chốt 2026-10-18).
Nếu bạn vừa mắc một lỗi tốn thời gian/chặn build/lừa người đọc báo cáo thì **viết
ngay trong phiên đó**, đừng để "chờ có người duyệt" rồi quên.

Chỉ thêm entry mới khi **ĐỒNG THỜI** thỏa cả 4 điều kiện:

- **Đã xảy ra thực tế** trong repo (có bằng chứng: commit / ledger entry / claim)
- **Gây hậu quả rõ ràng** (tốn thời gian, chặn build/merge, sinh conflict)
- **Có thể phòng ngừa trước** (có CHECKLIST rõ ràng để agent thực thi)
- **Atomic**: 1 bài học = 1 lõi sai lầm, tránh gộp nhiều lỗi khác nhau

**Không đưa vào** nếu quy tắc đã có trong `AGENT_PROTOCOL.md` nhưng **chưa từng gây lỗi**
→ thuộc phạm vi quy tắc, không phải bài học. Nếu **đã từng gây lỗi nhiều lần**
→ viết lại dạng checklist ngắn ở đây.

### Khi hết chỗ trong file: **chuyển sang file kế tiếp**, KHÔNG gộp entry

- Vượt **C1** (120 dòng) ⇒ **tách file mới theo chủ đề**: `migrations.md` → `migrations-2.md`.
- **KHÔNG ghi đè / sửa nội dung entry cũ** để lấy chỗ. Entry cũ có thể **đã được
  diễn giải sai** ở tài liệu hoặc báo cáo khác; xoá nó là mất dấu vết và làm hỏng
  những chỗ đang trích dẫn nó. Nếu một entry **sai**, sửa bằng entry mới có Proof
  trỏ tới entry cũ, hoặc thêm dòng "ĐÃ SỬA/ĐÃ GỘP" **bên trong** entry cũ (không xoá).
- Vượt **C2** (60 lesson) ⇒ **tách file chủ đề mới**, KHÔNG gộp bài học không liên quan.
  Chỉ gộp khi hai entry thật sự **trùng nội dung** (ví dụ một entry "không báo PASS"
  nằm ở cả nhóm multi-agent lẫn build-gates) — và bản bị gộp **phải được giữ lại
  dạng dòng trong Proof** của entry còn lại.

**Liên kết với hệ thống:** `continuous-learning-v2` có thể **đề xuất** entry mới sau
session. Đề xuất **được tự thêm** nếu thoả cả 4 điều kiện trên — chỉ cần ghi vào
cùng commit/PR đang làm.

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

⚠ **ID không đồng nhất theo lịch sử**: `multi-agent.md` dùng `L-001`, các file
khác dùng `L-F01`. Gate `check-lessons.mjs` **cố ý nhận cả hai**
(`L-(?:[A-Z]+)?\d+`) — bản Python của `vnbroker` chỉ nhận `L-[A-Z]\d+` và **bỏ sót
8/31 lesson** mà không báo gì.

**Vì sao KHÔNG đổi lại ID cho đồng nhất** (đã cân nhắc 2026-10-10 và **giữ nguyên**):
`L-001..L-008` được **5 tài liệu có ngày** tham chiếu nguyên văn —
`docs/KE_HOACH_SO_TAY_KINH_NGHIEM_SKILL_20261007.md:60`,
`docs/KE_HOACH_XU_LY_TON_DONG_CLAIMS_20261007.md:62-64`,
`docs/PLAN_QUYET_DINH_4_VIEC_20261007.md:270`,
`docs/AUDIT_CLAIMS_HANDOFFS_20261007.md:233`. Sửa ID trong đó là **bịa lại lịch sử**.
Cách rẻ hơn nhiều: giữ regex khoan dung + ghi rõ ở đây. **Nếu sau này vẫn muốn thu hẹp
regex, phải sửa cả 5 tài liệu lịch sử, không chỉ `INDEX.md`.**

## 1.5. Trạng thái

| File | Số lesson | ID |
|---|---|---|
| [multi-agent.md](./multi-agent.md) | 8 | `L-001`, `L-002`, `L-003`, `L-005`, `L-007`, `L-008`, `L-A01`, **`L-M02`** |
| [`multi-agent-2.md`](./multi-agent-2.md) | 3 | **`L-M05`**, **`L-M06`**, **`L-M07`** |
| [`build-gates.md`](./build-gates.md) | 8 | `L-G01`…`L-G08` |
| [`css-soc.md`](./css-soc.md) | 5 | `L-F03`, `L-F05`, `L-F06`, `L-F08`, **`L-F11`** |
| [`frontend.md`](./frontend.md) | 4 | `L-F01`, `L-F02`, `L-F09`, `L-F10` |
| [`migrations.md`](./migrations.md) | 3 | `L-M01`, `L-M02`, `L-M04` |
| [`backend.md`](./backend.md) | 4 | `L-B01`…`L-B03`, `L-B04` |
| [`security.md`](./security.md) | 2 | `L-S01`, `L-S02` |
| [`tooling-traps.md`](./tooling-traps.md) | 4 | `L-F04`, `L-F07`, `L-T01`, `L-T02` |
| [`tooling-traps-2.md`](./tooling-traps-2.md) | 2 | **`L-T03`**, **`L-T04`** |
| [`verification.md`](./verification.md) | 5 | `L-V01`…`L-V05` |
| [`false-green.md`](./false-green.md) | 2 | `L-V06`, `L-V07` |

**Tổng: 56 lesson / 14 file**

- **Nguồn:** trích từ bảng "Cạm bẫy đã gặp thật 2026-09-26" + các mục Progress trong `AGENTS.md`
  + `docs/audit-uiux/SESSION_LOG_WAVE{7,10,11}_*.md` + Entry 272/274 (2026-10-12)
- **Đổi cấu trúc 2026-10-10:** `frontend.md` tách thành `frontend.md` (bundle + React hook)
  và `css-soc.md` + `tooling-traps.md`, để chờ C1. ID cũ **giữ nguyên**, không renumber.
- **C2 nới lên 60 (Owner, 2026-10-18):** bản cũ ghi *"đã dùng hết chỗ C2 (40/40), muốn thêm phải gộp lesson trùng lặp"*. Ngưỡng đó **biến bài học thành thứ phải đi xin phép**, và phiên 2026-10-17 đã bỏ sót 3 bài học lớn (`L-M04`, `L-V04`, `L-B04`) chính vì "đã đầy" mà không có chỗ. Giờ **ghi bài học là việc được khuyến khích**, không cần xin duyệt.
  - C1 (≤120 dòng/file) **giữ nguyên và siết thêm ý nghĩa**: đó là cơ chế chống agent đọc lướt — file đầy thì **tách file mới theo chủ đề**, KHÔNG gộp entry.
  - **Khi file đầy: chuyển sang file kế tiếp** (`<chủ đề>-2.md`), KHÔNG ghi đè entry cũ — entry cũ có thể đã được diễn giải sai ở nơi khác, xoá nó là mất dấu vết.
  - ID mới **không renumber** ID cũ; ID bị bỏ trống sau khi gộp là **có chủ đích**, và
    entry thay thế ghi rõ bản bị gộp ở dòng **Proof**.

