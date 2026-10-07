# AGENT PROTOCOL — Vận hành nhiều agent trên cùng repo

> Hợp đồng bắt buộc cho **mọi** agent (người hoặc tự động) làm việc song song trong repo này.
> Mục tiêu: hai agent có thể chạy cùng lúc mà **không đè file lên nhau, không tranh số migration, không phải giải conflict tay**.
>
> Bối cảnh: 4 xung đột đã xảy ra thật trong 1 phiên ngày 2026-09-26 — xem §1.

---

## 1. Bốn xung đột đã xảy ra (không phải giả định)

| # | Loại | Bằng chứng | Cơ chế chống ở đây |
|---|---|---|---|
| 1 | Ghi đè cùng 1 dòng trong file khác nhau cùng lúc | `packages/web/package.json`: agent audit thêm `check:ai-cc-dag`, agent kia thêm `check:i18n-hardcoded` + sửa `check:shell`. Commit của agent audit sẽ **chứa cả** việc của agent kia. | §2 shared-file deny list + §5 merge queue |
| 2 | File append-only bị trộn, **không tách được** | `AGENTS.md` và `docs/CODE_CHANGE_AUDIT_LEDGER.md`: mỗi file là **1 hunk duy nhất** chứa cả Entry của agent audit lẫn Entry của agent kia ⇒ `git add` không tách nổi | §2 + `merge=union` cho `CLAIMS.md` (§3) |
| 3 | **Trùng số migration** | Plan agent audit đặt M1 = `advisory/0011_canonicalize_prompt_config.py`; agent kia tạo `0011_align_model_choices_with_live_providers.py` lúc 06:55 ⇒ `Conflicting migrations detected; multiple leaf nodes` ⇒ **chặn deploy** | §4 + gate `check:multi-agent` |
| 4 | Trích dẫn `file:line` thối | Agent audit đọc `advisory/views.py:431`; file đổi vài phút sau thành `:439`. Citation trong audit/plan sai ngay | §6 quy tắc citation + §4 gate kiểm file tồn tại |

**Bài học:** 3/4 xung đột **không phải xung đột code** mà là xung đột **quy trình**. Worktree chỉ giải quyết triệt để 0 trong 4 cái trên; phần còn lại là quy ước + gate.

---

## 2. Shared-file deny list — KHÔNG BAO GIỜ sửa khi chạy song song

Agent **không** sửa 5 file dưới đây trong thời gian có ≥ 2 agent cùng hoạt động. Không commit, không stage.

| File | Vì sao | Ai được sửa |
|---|---|---|
| `AGENTS.md` | Append-only, mọi agent đều phải ghi Progress | Coordinator, khi merge |
| `packages/web/package.json` | Mọi agent đều cần thêm script vào `check:*` | Coordinator, khi merge |
| `docs/CLAIMS.md` | Chỉ **append cuối file** (§3) | Mọi agent, theo đúng quy tắc |
| `pyproject.toml`, `requirements.txt`, `package-lock.json` | Dependency lock — đổi một agent phá cả agent khác | Coordinator |
| `docker-compose*.yml`, `.env*` | Hạ tầng dùng chung, cổng + volume | Coordinator |

**Cách điều hành khi agent cần sửa file deny list:** viết vào **claim** của mình dưới cột `note` ("cần thêm script X vào package.json"), và **báo coordinator**. Không tự sửa.

> **Ngoại lệ đã chốt (Owner, 2026-10-03):** `docs/CODE_CHANGE_AUDIT_LEDGER.md` **không còn** nằm trong deny list §2. Ledger là append-only một Entry, nhưng mỗi Entry là một khối riêng nên commit được mà không dính hunk của agent khác — khác với `AGENTS.md` vốn bị gộp hunk vì mọi agent đều ghi chung một mục Progress. Agent được phép commit Entry của mình vào ledger theo quy tắc append ở §3. **Đừng tự thêm lại ledger vào §2.** Lý do gốc: sự cố lịch sử ở bảng §1 dòng 2 vẫn còn nguyên giá trị làm bài học.

### Shared file **được** phép append tự do
- Bất kỳ file mới nào agent tạo ra, nếu không ai claim.
- File riêng theo feature: `docs/<feature>/*.md`, `docs/evidence/<feature>/**`.

---

## 3. Registry claim — bắt buộc khai trước khi sửa

File: `docs/CLAIMS.md` (đã có `merge=union` trong `.gitattributes` ⇒ **hai agent cùng append sẽ tự merge, không conflict marker**).

**Quy tắc vàng:**
1. Sửa file nào **phải** có 1 dòng trong `CLAIMS.md` liệt kê file đó (glob được).
2. File đã `in-progress` bởi agent khác ⇒ **dừng**. Không sửa.
3. Xong ⇒ đổi trạng thái thành `done`. Merge ⇒ `released`.
4. **Chỉ append ở CUỐI file.** Không sửa/xoá dòng cũ (trừ dòng của chính mình).

> ⚠ **Sai lầm đã mắc phải lúc đầu — đừng lặp lại.**
> Lần đầu tôi khai claim cho 5 file **mà không kiểm tra `git status` trước**. Hai trong số đó
> (`portfolio_analytics_views.py`, `providerModels.ts`) đã bị agent khác đang sửa.
> Claim sai đó che mất đúng thông tin cần nhất.
>
> **Thứ tự đúng, không được đảo:**
> 1. `git status --short` — xem file nào đang bị sửa dở **ngoài commit**
> 2. `grep` CLAIMS.md — xem đã ai giữ chưa
> 3. *rồi mới* viết claim
>
> Lưu ý thêm: agent khác có thể đang sửa file mà **chưa kịp khai claim**. Nên
> `git status` mới là nguồn đáng tin, CLAIMS.md chỉ là bổ trợ — không phải thay thế.
>
> Claim cũ bị thu hẹp thì **đừng xoá**: chuyển sang mục "Claims đã đóng" với status
> `superseded` và ghi lý do. Mất dấu vết là mất bài học.

Gate kiểm tra: `node packages/web/scripts/check-multi-agent.mjs`

---

## 4. Migration — quy tắc chống trùng số

**Trước khi tạo file migration, chạy trong chính worktree của mình:**

```bash
ls src/<app>/migrations | sort | tail -3
python manage.py makemigrations --dry-run   # để Django tự đặt tên rồi đọc tên đó
```

**Cách đúng nhất:** để `makemigrations` sinh file (nó tự tính số kế tiếp từ leaf hiện tại), **không** tự đặt tên.

> ⚠ **Giới hạn quan trọng của worktree — đã kiểm chứng thật (2026-09-26):**
> Worktree được tạo từ **HEAD**, nên **KHÔNG chứa phần chưa commit của agent khác**.
> Khi kiểm thử, worktree `agent-ai-cc` chỉ có `advisory` tới `0009`, trong khi repo chính đã có
> `0010` và `0011_align_model_choices_with_live_providers.py` (đội kia tạo nhưng chưa commit).
>
> Hệ quả:
> - Trong worktree của bạn, số migration có thể **thấp hơn thực tế** ⇒ tuyệt đối không tin số
>   đọc được trong worktree khi quyết định đặt tên migration.
> - Worktree của bạn có thể **thiếu code** mà tài liệu/claim nhắc tới (`views.py`, `orchestrator.py`…)
>   đang ở trạng thái "đã sửa, chưa commit" bên agent kia.
> - Trước khi merge, coordinator phải **`git fetch` + kiểm tra lại head migration trên `dev`**
>   và đánh số lại nếu cần.

**Sau khi tạo, bắt buộc chạy:**

```bash
python manage.py makemigrations --check --dry-run   # phải exit 0
python manage.py showmigrations <app> | tail -3     # xác nhận chỉ 1 leaf
```

> ⚠ **Worktree dùng chung `.git` nhưng KHÔNG dùng chung thư mục làm việc.** Số migration phải đọc từ **worktree của mình** ngay trước khi tạo — agent khác có thể vừa thêm file trong worktree của họ.

**Cấm tuyệt đối:** sửa file migration đã được apply (vi phạm BR-07 của repo). Cần sửa thì tạo file repair mới.

### Database riêng cho từng agent

Postgres dùng chung ⇒ 2 branch chạy `migrate` sẽ lệch schema.

> **Đã dựng và kiểm chứng (2026-09-26).** Postgres của `docker-compose.dev.yml` chạy ở
> container `vninvest-dev-core-db`, publish `127.0.0.1:5433 → 5432`,
> user `vninvest`, owner `vninvest_core`.
>
> DB riêng cho agent AI CC đã tạo và **đã chạy `migrate` thành công**: `aicc_r0`
> (118 bảng, 145 migration). DB `vninvest_core` của agent khác **không bị đụng**.
>
> ```powershell
> # tạo DB (idempotent)
> docker exec vninvest-dev-core-db createdb -U vninvest -O vninvest aicc_r0
> ```
>
> **Agent phải trỏ DB qua env, KHÔNG sửa file cấu hình:**
> ```powershell
> $env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/aicc_r0"
> $env:DJANGO_DEBUG = "1"          # BẮT BUỘC — xem bên dưới
> cd packages/core/backend
> python manage.py check             # -> "System check identified no issues"
> ```
>
> ⚠ **`DJANGO_DEBUG=1` là bắt buộc khi chạy trên host.**
> `settings.py:21` đặt `DEBUG=False` mặc định, và `settings.py:27-34` **raise
> `ImproperlyConfigured`** nếu `DEBUG=False` mà thiếu `DJANGO_ALLOWED_HOSTS` hoặc
> `DJANGO_SECRET_KEY`. Đây chính là nguyên nhân gốc của "71 errors" được ghi ở
> Entry 228 — **không phải** vì thiếu Postgres. Thiếu Postgres chỉ là một phần.
> Có thể bỏ `DJANGO_DEBUG=1` nếu bạn set cả hai biến kia thay vì dùng wildcard.
>
> **Host port là 5433, không phải 5432.** Container dùng 5432 nội bộ.
> Trong `docker-compose.dev.yml`, app container dùng hostname `core-db`.
> Agent chạy trên host nên dùng `127.0.0.1:5433`.

Các app `advisory` / `ai_analytics` / `ai_agents` độc lập nhau nên migration chạy song song vẫn an toàn.

**Bằng chứng blocker hạ tầng đã được xử lý:** với env trên,
`python manage.py test tests.test_advisory_budget tests.test_advisory_ssot tests.test_advisory_api_routes`
→ **Ran 19 tests … OK**. Full suite `python manage.py test tests` → **Ran 388 tests,
failures=10, errors=4** (từ 71 errors xuống 14 vấn đề).
14 test đỏ nằm ngoài domain AI CC (`test_admin_route`, `test_scheduler_management_commands`,
`test_tenant_quota_middleware`, `test_audit_logs_api`, `test_session_facts_api`,
`test_stock_management_api_routes`) — **chưa xác minh là pre-existing hay do môi trường**,
vì working tree chính đang bị agent khác sửa nên không lấy được baseline sạch để so sánh.
Cần một ticket riêng, không chặn R0 của AI CC.

---

## 5. Quy trình 1 agent (từ lúc nhận việc đến khi merge)

```
0. Đọc docs/AGENT_PROTOCOL.md + docs/CLAIMS.md
1. Kiểm tra CLAIMS.md: file tôi cần đã bị ai giữ chưa?
   - in-progress của agent khác → DỪNG, báo coordinator
   - done/released         → đổi claim sang mình rồi đi tiếp
2. Tạo worktree riêng + branch riêng
3. Ghi claim của mình vào CLAIMS.md (append cuối file) + commit riêng
4. Làm việc. Trước MỖI lần tạo migration: đọc head thật (§4)
5. Chạy gate của mình: check:ai-cc-dag + check:multi-agent + tsc + lint + test
6. Commit — CHỈ file thuộc phạm vi + test + docs riêng của mình
   TUYỆT ĐỐI KHÔNG git add file trong §2
7. Đổi claim: in-progress → done
8. Báo coordinator để merge
```

### Tạo worktree (1 lệnh)

```bash
git worktree add ../agent-<tên> -b feat/<feature> dev
# Windows — tiết kiệm 503 MB npm install + .venv:
cmd /c mklink /J ../agent-<tên>/packages/web/node_modules packages/web/node_modules
cmd /c mklink /J ../agent-<tên>/node_modules node_modules
cmd /c mklink /J ../agent-<tên>/.venv .venv
```

**Junction có rủi ro:** cả 2 agent dùng chung `node_modules` ⇒ `npm install` của agent này có thể phá agent kia. **Luật: chỉ một agent được chạy `npm install`/`pip install` tại một thời điểm** (hỏi coordinator). Nếu cần cài độc lập thì bỏ junction và `npm install` riêng.

---

## 6. Quy tắc trích dẫn

`file:line` **không đủ** — file thay đổi là số dòng sai ngay.

| Tình huống | Cách trích dẫn đúng |
|---|---|
| Trong code comment / PR description | `path:line` + tên hàm, đủ để grep |
| Trong audit / plan (tài liệu lâu dài) | `path:line @ <short-sha>` |
| Khi hành động theo tài liệu cũ | **Bắt buộc verify lại file:line trước khi sửa** |

Ví dụ: `packages/core/backend/src/advisory/views.py:431 @ 954c0ef2` — sau khi `views.py` đổi, người đọc biết ngay phải verify.

---

## 7. Điều KHÔNG nên làm

| Không nên | Vì sao | Làm thay thế bằng |
|---|---|---|
| Tách Docker container cho mỗi agent | `docker-compose.dev.yml` dùng chung cổng + volume; 2 bộ worker sẽ **cùng consume cùng 1 queue** ⇒ test của agent này làm hỏng test agent kia | Worktree + DB riêng |
| Sửa file deny list khi đang chạy song song | Không tách được hunk ⇒ commit bắt nhầm việc người khác | Ghi vào claim + báo coordinator |
| Tự đặt số migration | Trùng số ⇒ hỏng `migrate` | Để `makemigrations` sinh (§4) |
| Chạy `npm install` khi đang dùng junction | Phá `node_modules` chung | Hỏi coordinator trước |
| Sửa `.husky/pre-commit` / `pre-push` | Nó là **shared** ⇒ chặn luôn agent khác | Gate riêng cho agent, xem §8 |
| Báo "PASS" khi thực tế chưa verify | Đã xảy ra ở chính phiên này | Xem §8 |

---

## 8. Gate — đổi quy ước thành kiểm tra tự động

```bash
node packages/web/scripts/check-multi-agent.mjs
```

Kiểm 5 điều, exit 1 nếu vi phạm:

1. **Trùng số migration** trên mọi app ⇒ đây là lỗi **làm hỏng build**, phải bắt được.
2. **Nhiều leaf node** trong 1 app (`makemigrations` sẽ lỗi).
3. `CLAIMS.md` có dòng `in-progress` trỏ tới file/branch **không tồn tại**.
4. `CLAIMS.md` claim file nằm trong **deny list** (§2).
5. Cột `files` rỗng ở dòng claim `in-progress`.

Gate đã có **test âm tính** (tiêm lỗi → exit 1), tương tự `check-ai-cc-dag`.

**Cố tình KHÔNG nối vào `check:shell`** — vì `check:shell` là shared, thêm vào sẽ làm agent khác fail giả. Agent tự chạy, hoặc coordinator wire vào `agent-sync.ps1` sau khi cả 2 agent về.

> **Cập nhật 2026-09-27:** GitHub Actions đã **tắt** (200/200 run gần nhất thất bại do billing, `steps=0`). Không còn "wire vào CI" được nữa — mọi gate phải chạy qua `agent-sync.ps1` hoặc thủ công. Xem `.github/workflows-disabled/README.md`.

---

## 9. Danh sách tự kiểm trước khi kết thúc phiên

- [ ] Không có file nào trong §2 bị tôi sửa hoặc commit
- [ ] Mọi file tôi sửa đều có trong `CLAIMS.md` của tôi
- [ ] `CLAIMS.md` chỉ append ở cuối, không sửa dòng của agent khác
- [ ] Không trùng số migration; `makemigrations --check` exit 0
- [ ] Không chạy `npm install`/`pip install` khi chưa hỏi
- [ ] Claim của tôi đã đổi `in-progress` → `done`
- [ ] Báo coordinator: commit hash + danh sách file + gate đã chạy + cái **chưa** verify

---

## 10. SOP: từ lúc nhận việc đến lúc code lên `dev`

### 10.0 Ai ở đâu

| Worktree | Branch | Chủ sở hữu | Quy tắc |
|---|---|---|---|
| `C:\Mujoco Projects\vninvest` | `dev` | **core-team** | Là **main tree**. Làm việc tại đây, KHÔNG commit thẳng vào `dev` — hãy tạo branch. |
| `C:\Mujoco Projects\agent-ai-cc` | `feat/ai-cc-r0` | **ai-cc-agent** | Branch riêng, commit thoải mái. |

> **Hiện trạng đang lệch chuẩn:** `core-team` đang commit thẳng vào `dev`.
> Đó là gốc rễ của cả 4 xung đột — không có điểm merge thì không ai kịp đồng bộ,
> nên mới sinh ra migration trùng số lúc 06:55.
>
> **Khuyến nghị cấu trúc:** để `dev` làm branch **tích hợp — không ai commit trực tiếp**.
> `core-team` cũng nên có worktree riêng (`../core-team` + `feat/...`).
> Chỉ khi đó PR/review mới có ý nghĩa.

### 10.1 Mở phiên (bắt buộc, theo thứ tự)

```powershell
# 1. Hook riêng cho worktree này (1 lần đầu mỗi worktree)
sh scripts/agent-install-hooks.sh

# 2. Đồng bộ dev mới + kiểm tra migration + chạy gate
pwsh -File scripts/agent-sync.ps1

# 3. Đọc CLAIMS.md, và git status CỦA MAIN TREE để biết agent khác đang
#    sửa file nào CHƯA commit (CLAIMS.md có thể chưa kịp ghi)
git -C "C:\Mujoco Projects\vninvest" status --short
```

| Bước | Vì sao phải làm |
|---|---|
| Cài hook | Không có hook thì quy tắc chỉ là lời khuyên, agent quên là mất |
| `agent-sync.ps1` | Worktree tạo từ HEAD nên **không thấy** việc chưa commit của agent khác. Sync trước khi viết code |
| `git status` main tree | Agent khác có thể đang sửa file mà **chưa kịp khai claim** → đây mới là nguồn đáng tin, không phải CLAIMS.md |

### 10.2 Khai claim (trước khi sửa dòng nào)

1. `git status` main tree — file nào đang bị sửa dở?
2. `grep` `docs/CLAIMS.md` — đã ai giữ chưa?
3. **Rồi mới** append dòng claim của mình vào cuối `CLAIMS.md`, commit riêng.

Không làm đúng thứ tự này thì chính tôi đã mắc lỗi một lần: claim 5 file, trong đó
2 file đã bị agent khác giữ → claim sai, che mất thông tin quan trọng nhất.

### 10.3 Làm việc

- Commit nhỏ, một việc một commit.
- **Trước mỗi lần tạo migration:** đọc head thật (§4). Để `makemigrations` sinh tên.
- Sau mỗi sub-step: `npx tsc --noEmit` + gate liên quan.
- Hook `pre-commit` tự chặn vi phạm — **đừng `--no-verify` để lách**.
  Nếu thật sự cần, ghi lý do vào commit body.

### 10.4 Kết thúc phiên

```powershell
pwsh -File scripts/agent-sync.ps1      # rebase + check migration + chạy gate lại
```

**Gate chạy lại sau rebase mới đáng tin** — gate trước rebase không nói được gì
về code sau rebase.

Rồi:
1. Sửa `docs/CLAIMS.md`: `in-progress` → `done` (commit riêng)
2. `git push -u origin <branch>`
3. `pwsh -File scripts/agent-pr.ps1 -Title "..."` → tạo PR kèm checklist
4. Báo coordinator: commit hash · file đã đổi · **gate nào PASS** · **gate nào CHƯA chạy**

### 10.5 Review & merge

Checklist bắt buộc của người review (đã in sẵn trong PR body):

1. PR có kéo theo file deny list §2 không? → `agent-pr.ps1` tự chặn, nhưng
   người review vẫn phải soi nếu dùng `--no-verify`
2. Mọi file sửa đều có trong `CLAIMS.md` của branch?
3. Số migration có trùng với branch khác không? **Đây là lỗi chặn deploy.**
4. Các mục "CHƯA CHẠY" trong PR body đã được đọc và chấp nhận chưa?
5. Có test mới cho hành vi mới không?

Merge:
```powershell
gh pr merge <n> --merge --delete-branch
```
Dùng `--merge` (không squash) để giữ dấu vết từng slice — repo này lịch sử linear,
đừng tạo thêm 20 merge commit chồng lên nhau.

### 10.6 Dọn dẹp sau merge

```powershell
pwsh -File scripts/agent-cleanup.ps1 -Branch feat/ai-cc-r0
```

Script tự **từ chối** xoá nếu: commit chưa push · worktree chưa sạch · PR chưa merge ·
`CLAIMS.md` còn claim `in-progress`. Không có `--force` thì không mất việc.

Coordinator làm nốt: góp file deny list → `CLAIMS.md` → `released` → push `dev`.

### 10.7 Khi có nhiều hơn 2 agent

Thêm worktree theo đúng khuôn, **tên worktree = tên agent**:

```powershell
git worktree add ..\core-team -b feat/core-w1 dev
cmd /c mklink /J ..\core-team\packages\web\node_modules packages\web\node_modules
```

| Việc | Ai làm |
|---|---|
| Tạo worktree + branch + cài hook | Mỗi agent tự làm 1 lần đầu |
| DB riêng | `docker exec vninvest-dev-core-db createdb -U vninvest -O vninvest <ten>` |
| Claim | Mỗi agent tự khai |
| Merge + góp deny list | **Coordinator** — một người, một thời điểm |

---

## 11. Planning Gate — đọc bài học trước khi lập kế hoạch

> Thêm 2026-10-07. Mục đích: chuyển "kinh ngọc từ lỗi cũ" thành **quy tắc bắt buộc kiểm tra**,
> vì các lỗi quy trình đã lặp lại nhiều lần dù đã được ghi nhận.

### 11.1 Khi nào bắt buộc chạy

**Trước khi**: tạo todo list / kế hoạch chi tiết · khai claim trong `CLAIMS.md` · bắt đầu sửa code.

### 11.2 Cách thực hiện

Gọi skill [`project-lessons`](../skills/project-lessons/SKILL.md) với:
- `taskDescription` — mô tả task/slice (bắt buộc)
- `filePaths` — file dự kiến sửa (khuyến nghị)
- `actions` — `migrate` / `edit` / `claim` / `rebase` / `gate` / `build` / `test` / `db` / `shared` (khuyến nghị)

Skill sẽ chọn lọc theo tag, chỉ đọc lesson liên quan từ `docs/LESSONS/`, trả về
`LESSONS APPLICABLE` + `MANDATORY CHECKLIST` (tối đa ~20 dòng).

### 11.3 Yêu cầu bắt buộc trong plan

Plan PHẢI chứa **một trong hai dạng**:

- `Lessons áp dụng: [L-XXX, L-M01, ...]`
- `Lessons áp dụng: NONE – <lý do ngắn>`

Và **tick các mục trong `MANDATORY CHECKLIST`** trước khi coi slice là xong.

### 11.4 Điều KHÔNG được

- **KHÔNG** đọc toàn bộ `docs/LESSONS/` (context bloat) — để skill chọn lọc
- **KHÔNG** gọi skill xong mà không ghi `Lessons áp dụng` vào plan → quy tắc không thi hành được
- **KHÔNG** tự thêm lesson mới vào `docs/LESSONS/` — cần team leader phê duyệt (`docs/LESSONS/INDEX.md` §1.3)
- **KHÔNG** bỏ qua fallback `multi-agent.md` khi task có từ khóa `claim`/`shared`/`migration`/`worktree`/`rebase`/`gate`/`agent`

### 11.5 Áp dụng cho

Cả **agent chính tự lập kế hoạch** lẫn **planner subagent**. Khi tách task cho subagent,
phải truyền kèm danh sách lessons đã trích.
