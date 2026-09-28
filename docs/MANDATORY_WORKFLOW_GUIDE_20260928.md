# Hướng dẫn sử dụng Mandatory Agent Workflow

> Dành cho **agent** (và người review agent) làm việc trong `vninvest` hoặc repo khác.
> Quy trình gốc: `~/.opencode/instructions/MANDATORY-WORKFLOW.md` (nạp mỗi session).
> Chi tiết định nghĩa: `docs/AGENT_PROTOCOL.md`.
>
> `verified: 2026-09-28 @ feat/preflight-identity`
> Đo thật: `pre-push-gate` **13 PASS / 0 SKIP / 0 FAIL** · `test-agent-preflight` **23/23** ·
> `verify-deny-extract` **9/9 + 9/9** · `verify-global-config` **7 OK, drift 0**.
> Doc này chưa commit — điền sha sau khi commit.

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
node scripts/pre-push-gate.mjs          # kỳ vọng: 13 PASS / 0 FAIL
node scripts/verify-global-config.mjs    # kỳ vọng: exit 0
node tools/opencode-global/test-agent-preflight.mjs   # kỳ vọng: 23/23
node tools/opencode-global/verify-deny-extract.mjs    # kỳ vọng: 9/9 + 9/9
```

Hai lệnh cuối là **negative test** — xem §4.1. Chúng chạy trên temp fixture nên
không đụng file thật của repo. `exit 0` của chúng **không** có nghĩa gate hoạt
động trong repo của bạn; `docs/CLAIMS.md` của repo vẫn phải đúng quy tắc tên ở §1.

### Đưa sang repo khác — 3 thứ phải làm, theo thứ tự này

1. `node tools/opencode-global/deploy.mjs` + `node scripts/verify-global-config.mjs`
   ⇒ có preflight ở mọi repo (không cần copy script vào từng repo).
2. Tạo bảng deny list với **`File` ở cột 1** trong `AGENTS.md` ⇒ §3.2.
   Không làm thì repo đó chỉ được 16 file mặc định.
3. Copy gate **kèm `git config core.hooksPath .husky`** ⇒ §3.3. Bỏ dòng này thì
   `git push` không chạy gate nào.

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
| ten-slice | feat/ten-slice | mô tả scope | duong/dan/file | in-progress | 2026-09-28 | ly do |
```

**Quy tắc bắt buộc: tên agent PHẢI BẰNG tên branch bỏ tiền tố.**
`feat/ten-slice` ⇒ tên agent là `ten-slice`. Không phải `ten-agent`, không phải
`core-team`, không phải viết tắt.

Lý do — đây **không** là quy ước thẩm mỹ. Preflight phải biết dòng nào trong
`CLAIMS.md` là của mình thì mới phân biệt được "file tôi đang giữ" với "file
agent khác đang giữ". Nếu không khớp thì preflight rơi vào một trong hai hướng,
cả hai đều sai:

| Tình huống | Hậu quả |
|---|---|
| coi dòng của mình là của người khác | **tự khóa commit của chính mình** |
| không xác định được nên bỏ qua | **im lặng cho phép sửa file của agent khác** |

Hướng 2 nguy hiểm hơn vì nó im lặng. Từ 2026-09-28, trường hợp này bị chặn với
lỗi `claim-identity` và preflight nói rõ cần sửa gì.

> **Bẫn đã gặp thật 3 lần (PR #20, #23, #31):** `docs/CLAIMS.md` ở `vninvest`
> **không kết thúc bằng LF**. Append bằng `\n` + dòng mới sẽ **dính vào dòng
> trước**, thành một dòng. Hậu quả: `check2` chỉ đọc cell đầu tiên nên thấy đúng
> một agent (của bạn) và **pass nhầm** — dòng của người khác bị nuốt mà không ai
> báo. Luôn kiểm byte cuối file trước khi append:
>
> ```powershell
> $b = [System.IO.File]::ReadAllBytes("docs/CLAIMS.md"); $b[-1] -eq 10
> ```
>
> `False` ⇒ phải chèn LF trước dòng mới.

`docs/CLAIMS.md` là **append-only**: được sửa bình thường, nhưng chỉ được thêm
**dòng của chính mình** — dòng của agent khác thì preflight chặn.

### Đóng claim — khi xong việc

Sửa `in-progress` → `done` **trên chính dòng của mình**, commit riêng:

```
| ten-slice | feat/ten-slice | ... | ... | done | 2026-09-28 | PR #NN |
```

Preflight cho phép sửa nội dung dòng của mình (`check2` chỉ chặn dòng của agent
khác). **Không** để dòng kẹt ở `in-progress` khi đã xong: dòng đó tiếp tục giữ
file và sẽ chặn agent khác. Xem mục Đánh đổi ở §5.

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
git commit --no-verify            # lách pre-commit (lint-staged) + pre-push (13 gate)
SKIP_PRE_PUSH_GATE=1 git push    # lách 13 gate
AGENT_PREFLIGHT=0                # tắt preflight
```

Cả 3 **còn mở cố ý**. Lý do: `AGENT_PROTOCOL.md` §2 cho phép coordinator sửa file deny-list
(ví dụ thêm script vào `check:shell`), và đó là bước duy nhất để làm việc đó mà vẫn
ghi được lý do vào commit. Gỡ 3 cửa này thì coordinator không còn đường hợp pháp.

Nếu muốn siết, phải chọn: **siết chặt**, hoặc **giữ đường ghi claim**. Không có cách thứ ba.

### 2.1 Sửa nhầm cần biết trước khi dùng cửa lách

`--no-verify` **không** lách được preflight, vì hai tầng này khác nhau:

| Tầng | Chạy ở đâu | `--no-verify` có lách? |
|---|---|---|
| `pre-commit` / `pre-push` (husky) | tiến trình git | **Có** |
| `agent-preflight` (hook OpenCode) | **trước khi** git chạy | **Không** |

`pre-bash-agent-preflight.js` khớp lệnh bằng `/\bgit\s+commit\b/` — cờ `--no-verify`
không làm lệnh bị bỏ qua. Nên:

- Muốn lách **preflight** ⇒ chỉ có `AGENT_PREFLIGHT=0`, hoặc commit ngoài OpenCode.
- Muốn lách **13 gate** ⇒ `SKIP_PRE_PUSH_GATE=1`.
- Muốn lách **deny-list** mà vẫn có vết kiểm toán ⇒ **commit trailer**, xem §2.2.

Còn một cửa thứ tư **không ai nhắc**: `pre-bash-agent-preflight.js` bọc `spawnSync`
trong `try { } catch { return PASS }` — preflight **ném exception** thì commit được
cho qua. Đúng tinh thần "hook hỏng không được chặn agent", nhưng đây là fail-open
không ghi vào đâu. Nếu thấy preflight im lặng bất thường, kiểm tra nó có chạy hề
không trước khi tin `exit 0`.

### 2.2 Đường hợp pháp để sửa file deny-list: commit trailer

Khi **là coordinator** và cần sửa file trong deny list, ưu tiên commit trailer —
đây là đường **có lưu vết kiểm toán**, không phải lách:

```bash
git commit -m "chore(deny): them script check:shell vao deny list" \
  -m "Claim-Deny-List: yeu cau cua owner 2026-09-28, xem claim <ten>"
```

Trailer phải nằm **đầu dòng** và có nội dung sau nó (`TRAILER_RE = /^Claim-Deny-List:\s*\S.*/m`).
Commit body chỉ *nhắc* chuỗi `Claim-Deny-List:` ở giữa câu sẽ **không** được chấp nhận —
đó là lỗi bypass đã dựng lại được, xem `verify-trailer-bypass.mjs`.

Chỉ khi script **crash bất khả kháng** mới dùng `--no-verify` hoặc `AGENT_PREFLIGHT=0`,
và phải ghi lý do vào thân commit.

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

**`File` PHẢI Ở CỘT 1.** Bộ đọc lấy *cell đầu tiên* của mỗi dòng. Bảng viết
`| STT | File | ... |` sẽ đọc cột `STT` ⇒ **0 path** ⇒ deny list của chính repo đó
bị bỏ qua im lặng.

Không có bảng thì chỉ chạy 16 file mặc định.

**Quy tắc dừng, không đoán (2026-09-28):** file ưu tiên cao nhất **có bảng** là
nguồn. Nếu bảng đó đọc ra 0 path, loader **dừng** và chỉ dùng 16 mặc định, kèm cảnh
báo `[deny-list]` — **không** rơi tiếp sang tài liệu ưu tiên thấp hơn.

Lý do: trước đây `if (added) break` khiến một bảng hỏng ở `docs/AGENT_PROTOCOL.md`
lặng lẽ lấy deny list từ `AGENTS.md`. Đo được: repo khai `secret-a.txt` ở §2 của
chính mình ⇒ **không** được bảo vệ, trong khi path khai ở `AGENTS.md` thì được.
Đây là fail-open im lặng, đúng loại gate §4 cảnh báo.

Nếu thấy cảnh báo này ở repo của bạn: sửa bảng (bỏ cột `STT`, hoặc chuyển bảng deny
list lên tài liệu ưu tiên cao nhất). Chạy `node tools/opencode-global/verify-deny-extract.mjs`
để kiểm — script này có negative test riêng cho tình huống trên.

### 3.3 Copy gate — phải bật hooksPath, nếu không hook chết

```bash
mkdir -p .husky scripts
cp .husky/pre-push            .husky/
cp scripts/pre-push-gate.mjs  scripts/
git config core.hooksPath .husky        # BẮT BUỘC — thiếu dòng này hook không chạy
```

> **Hai lỗi trong bản cũ của chính mục này, đã sửa:** (1) `cp .husky/pre-push <repo>/`
> đặt file vào **thư mục gốc repo** — git không bao giờ nhìn ở đó; git mặc định chỉ
> đọc `.git/hooks/`. (2) `cp scripts/pre-push-gate.mjs scripts/` copy file **vào
> chính nó** (nguồn = đích) nên lỗi `cp: same file` và gate vẫn thiếu.
>
> Đo được: làm đúng theo bản cũ xong `git config core.hooksPath` rỗng, `.git/hooks/pre-push`
> không tồn tại ⇒ `git push` **không chạy gate nào** mới ra cảm giác an toàn giả.
> Nhớ: `core.hooksPath` là cấu hình **cục bộ theo clone**, nên máy khác phải chạy
> lại lệnh này.

Gate tự `SKIP` những gate vninvest-đặc thù (`tsc`, `check-multi-agent`, `i18n-strict`) nếu
thiếu điều kiện. **SKIP không phải PASS** — xem dòng cuối output.

Ở `vninvest` mới có 13 gate. Ở repo khác, `SKIP` là chuyện bình thường: phải **map
từng gate vninvest-đặc thù** sang lệnh chuẩn của repo đích, nếu không thì
"13 gate" chỉ là 2 gate chạy được + 11 dòng `SKIP`.


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

### 4.1 Probe của chính bạn cũng cần negative test

Nguyên tắc trên bị bỏ sót ở chính các script trong `tools/opencode-global/`. Ba
lỗi dưới đây đều **sống sót** vì chỉ được chạy trên repo thật, nơi dữ liệu luôn
"đúng" — nên không bao giờ lộ:

| Probe | Chỉ chạy trên | Lỗi lọt |
|---|---|---|
| `verify-deny-extract.mjs` | `docs/AGENT_PROTOCOL.md` thật (bảng đúng cột) | không ai thử bảng `\| STT \|` ⇒ không biết loader rơi nhầm tài liệu |
| `test-agent-preflight.mjs` | branch tên khớp tên agent | không ai thử tên lệch ⇒ không biết preflight tự khóa commit của chính mình |
| cả hai | `CLAIMS.md` **kết thúc bằng LF** | không ai thử file không có LF ⇒ không biết dòng claim bị dính |

Đã sửa: `verify-deny-extract.mjs` có **9 negative test** trên temp fixture
(`| STT |` + tài liệu ưu tiên thấp hơn), `test-agent-preflight.mjs` có **23**
(kể cả 1 test ghim *đánh đổi đã biết* thay vì giấu nó). Chạy:

```bash
node tools/opencode-global/test-agent-preflight.mjs
node tools/opencode-global/verify-deny-extract.mjs
```

### 4.2 Ba bẫy probe tôi tự mắc trong lúc audit (2026-09-28)

Cả ba đều cho kết luận **sai**, trước khi dựng lại fixture sạch. Ghi lại vì
chúng rất dễ lặp lại:

1. **Repo chưa có commit** ⇒ `git rev-parse --abbrev-ref HEAD` trả chuỗi `HEAD`
   (không phải tên branch). Mọi phép so khớp tên branch trở nên vô nghĩa, kết quả
   tưởng là "self-block" hoá ra là "probe hỏng". Phải `git init` + `commit` trước.
2. **Thiếu `Push-Location`** ⇒ `node` chạy ở cwd khác, `REPO` resolve sai chỗ,
   preflight im lặng trả `exit 0`. Kết quả trông như "gate pass".
3. **File không kết thúc bằng LF** ⇒ append làm hai dòng dính làm một.
   `check2` đọc cell đầu thấy đúng agent của bạn rồi **pass nhầm** — đúng cơ chế
   đã gây ra PR #20/#23/#31.

Nguyên tắc rút ra: **probe phải in ra cái nó đo**, không chỉ exit code. Cả ba lỗi
trên đều bị phát hiện chỉ vì tôi in `git rev-parse` ra xem, thay vì tin `exit 0`.

---

## 5. Cạm bẫy đã gặp thật

| Cạm bẫy | Hậu quả |
|---|---|
| Cộng gộp `--stat` từng commit | đếm trùng file sửa ở cả hai commit ⇒ số liệu sai |
| `ReadAllLines`/`WriteAllLines` (PowerShell) trên file tiếng Việt | ghi mojibake thật vào file. Sau mỗi `edit`: `git diff --numstat` phải khớp |
| Round-trip file UTF-8 bằng `Set-Content` | mất BOM/dấu. Dùng `[System.IO.File]::WriteAllText` với `UTF8Encoding($false)` |
| Bỏ qua bảng deny list vì "giống mặc định" | cơ chế đọc tài liệu yếu hơn quảng cáo — phải đo, đừng đoán |
| Tự đặt số migration | `Conflicting migrations; multiple leaf nodes` — chặn deploy |
| `import('C:\...')` trong Node ESM | `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Bọc `pathToFileURL(abs).href` |
| Append vào file không có LF cuối | dòng mới dính vào dòng cũ ⇒ check2 mù, mất dòng của agent khác |
| **Tin `exit 0` của preflight mà không biết nó có chạy không** | preflight chỉ chạy qua hook OpenCode, **không** nối vào `.husky/pre-commit` (file đó chỉ chạy `lint-staged`). Commit bằng IDE, bằng người, hoặc ngoài OpenCode ⇒ **0 check nào chạy**. Ngoài ra `catch { return PASS }` trong hook ⇒ preflight crash là commit qua. |
| Đo `core.hooksPath` của máy mình | cấu hình này **cục bộ theo clone** — máy khác, container khác đều rỗng |

### 5.1 Hai false positive của chính preflight — đã sửa 2026-09-28

Cả hai lộ ra khi chạy preflight trên thay đổi thật của `vninvest`, không phải trên
fixture. Ghi lại vì chúng cho thấy **test fixture có thể sạch hơn dữ liệu thật**:

| Triệu chứng | Nguyên nhân | Đã sửa |
|---|---|---|
| `foreign-claim (+<tên agent khác>)` dù tôi không sửa dòng đó | `CLAIMS.md` không có LF cuối ⇒ chèn LF làm git ghi dòng cũ thành 1 dòng `-` + 1 dòng `+` **nội dung y hệt**. Mà bước chèn LF lại là bắt buộc. | `check2` bỏ qua dòng `+` nội dung trùng dòng `-` (`POS7`), kèm biến cạnh `NEG6` để không bỏ quá tay |
| `claimed-in-progress docs/CLAIMS.md` | Chính `portfolio-exec-plan` đang giữ registry ở `in-progress`, trong khi **mọi agent đều phải append vào đó** để khai claim ⇒ nếu chặn thì không ai khai claim được. | `check3` miễn file `APPEND_ONLY`; việc bảo vệ registry là của `check2` (`POS8`) |

**Bài học chung:** một gate chỉ được chạy trên fixture sạch sẽ bỏ sót chính những
false positive xảy ra trên dữ liệu thật. Luôn chạy gate trên chính thay đổi của
mình ít nhất một lần, và coi "gate chặn tôi" là câu hỏi cần trả lời, không phải
bằng chứng gate đúng.

### Đánh đổi đã biết — đọc trước khi đổi quy tắc

| Đánh đổi | Vì sao chấp nhận |
|---|---|
| Dòng claim **stale** của agent đã chết **trên cùng branch** được coi là "của tôi" ⇒ file nó giữ không còn bị bảo vệ | Đây là cách sửa tự khóa mà **không phải đoán** (đọc cột `branch`). Preflight in cảnh báo `[claim-name]` mỗi lần chạy để agent đổi tên dòng đó. Hành động giảm thiểu: đóng claim (`in-progress` → `done`) **trước khi** nhận việc. Ghim bằng test `KNOWN1` — nếu đổi quy tắc, test này phải đổi theo. |
| Cảnh báo deny list **không chặn** | Chặn sẽ nổ trên mọi repo có bảng phụ 2–3 cột ở `AGENTS.md`. Gate hoang ló thì bị bỏ qua — tệ hơn không có gate. Chặn cứng nằm ở `verify-deny-extract.mjs` (chạy trong pre-push gate). |
| Bảng claim rộng ≥ 7 cột có thể bị đọc nhầm là dòng claim | `isClaimRow` chỉ loại bảng **hẹp** (< 8 cột), đủ cho bảng chú giải trạng thái 2 cột trong `CLAIMS.md` thật. Bảng rộng kiểu đó chưa dựng được false positive cụ thể — xem `POS5` trong test suite. **CHƯA xử lý.** |

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
