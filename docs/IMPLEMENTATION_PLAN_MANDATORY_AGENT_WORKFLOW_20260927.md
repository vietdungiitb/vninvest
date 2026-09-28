# Kế hoạch: Biến quy trình multi-agent thành CHUẨN BẮT BUỘC

**Ngày lập:** 2026-09-27
**Câu hỏi khởi phát:** *"làm sao để biến nó thành quy trình chuẩn để bất cứ khi nào người dùng yêu cầu agent code thì phải ưu tiên tham khảo sử dụng quy trình này — biến nó thành quy trình bắt buộc agent phải theo để đảm bảo việc code thống nhất"*
**Phạm vi:** tài liệu kế hoạch. **KHông sửa code, không sửa file deny list.**
**Claim:** `mandatory-workflow-plan` (`docs/CLAIMS.md`)

> **Trạng thái:** Phase 1–6 **CHƯA bắt đầu**. Cần owner chốt 3 câu hỏi ở §12 trước.

---

## 0. Tóm tắt điều hành

Ba kết luận, mỗi cái đều có bằng chứng chạy được:

1. **Prose không bao giờ bắt buộc được — chỉ gate `exit ≠ 0` mới bắt buộc được.** Ngay trên máy này: `~/.opencode/instructions/INSTRUCTIONS.md` là file **luôn nạp mọi session** và có mục *"Mandatory Security Checks"* dạng checklist prose (`- [ ] No hardcoded secrets`). Repo này vẫn có **PAT thật trong 3 file tracked** (Entry 179, xác nhận lại ở Entry 232). Prose đã thất bại ở chính nơi nó được viết, ở dạng rõ ràng nhất.

2. **Cơ chế bắt buộc đã tồn tại sẵn, không cần hạ tầng mới.** `~/.opencode/opencode.json` có mảng `instructions` gồm **14 path** — đã gồm `AGENTS.md`, `instructions/INSTRUCTIONS.md` và 11 file skill. Thêm 1 đường dẫn là có quy trình luôn được nạp ở **mọi repo**.

3. **80% `AGENTS.md` là lịch sử, đó là cơ chế gây sai.** File dài **729 dòng**; khối `## Progress` chiếm **579 dòng = 79%**, trong đó **54** mục `### Done` đã hoàn thành. Quy trình bắt buộc bắt đầu ở **dòng 44**, sau `## Goal`. Trong phiên làm việc 2026-09-27, chính việc đọc một dòng stale trong khối này đã dẫn tới kết luận sai "code không tồn tại" cho 6 slice `tenantreg-*`. **Đây là do loãng ngữ cảnh, không phải do thiếu hiểu biết.**

**Đề xuất:** 6 phase, xếp theo rủi ro tăng dần. Hai phase đầu **không chặn ai, không cần owner merge gì**, và cho biết có đáng làm tiếp hay không.

---

## 1. Phương pháp và dữ kiện đã kiểm chứng

Mọi con số trong tài liệu này đều kèm lệnh tái tạo ở **Appendix A**. Không có con số nào ước lượng.

**Đã kiểm chứng trực tiếp trên máy này:**
- Cấu trúc và độ dài `AGENTS.md` (729 dòng thật, 69 mục `###`, phân bố theo khối)
- Nội dung mảng `instructions` trong `~/.opencode/opencode.json` (14 path)
- Sự tồn tại và nội dung `~/.config/opencode/opencode.jsonc` (không có khoá `instructions`)
- Sự tồn tại `pre-bash-dispatcher.js` + `run-with-flags.js`
- Nội dung `CLAIMS.md` (claim `off-github-actions` — nguồn của bất biến thiết kế §7)

**Chưa kiểm chứng (cần làm ở Phase 2):** 8 gate local có thật sự chặn không, hay đang rỗng. Phase 2 sinh ra con số này.

---

## 2. Hiện trạng: 4 tầng cưỡng chế

Xếp theo **sức thật**, không theo vị trí file.

| Tầng | Cơ chế | Sức mạnh | Phạm vi | Hiện trạng |
|---|---|---|---|---|
| **0** | `~/.config/opencode/AGENTS.md` hoặc entry trong `instructions` | intent, luôn nạp | **mọi repo** | ⚠️ `INSTRUCTIONS.md` có, nhưng chỉ prose |
| **1** | repo `AGENTS.md`, khối đầu file | intent, luôn nạp | repo này | ⚠️ có nhưng **loãng** (80% lịch sử) |
| **2** | `PreToolUse` hook (`Bash`/`Edit`/`Write`) | **CHẶN ĐƯỢC** | mọi repo | ✅ `pre-bash-dispatcher.js` đã tồn tại |
| **3** | skill `multi-agent-workflow` | playbook, opt-in | khi match | ✅ có; trigger chỉ khi *parallel* |

**Điểm quan trọng:** tầng 2 là tầng duy nhất thật sự *bắt buộc*, và **nó đã có sẵn**. Không cần xây hạ tầng mới.

---

## 3. Vì sao không áp dụng một quy tắc chung cho mọi việc

Skill tự nói: *"**Do not** auto-activate on a single coordinated task — one agent with sequential stages is faster and safer."* Áp full 8 gate cho một dòng sửa typo là nghi thức vô nghĩa, và sẽ dẫn tới việc agent bỏ qua toàn bộ.

Vì vậy cần **thang bậc**, và **điều kiện leo thang phải là lệnh kiểm được, không phải cảm tính**.

---

## 4. Bảng leo thang — xương sống của cả kế hoạch

Đây là thứ **duy nhất chạy mọi lần có code**. Mỗi ô là một lệnh.

| # | Kiểm tra | Lệnh | Có → |
|---|---|---|---|
| 1 | Đang ở integration branch? | `git rev-parse --abbrev-ref HEAD` = `dev` \| `main` | **T2** |
| 2 | File sửa có trong deny list §2? | so với `docs/AGENT_PROTOCOL.md` §2 | **T2** |
| 3 | Tạo/sửa migration? | `git status --short \| grep migrations/` | **T2** |
| 4 | File bị agent khác claim `in-progress`? | `grep 'in-progress' docs/CLAIMS.md` | **DỪNG** |
| 5 | >1 agent chạy song song? | `git worktree list` + `grep 'in-progress' docs/CLAIMS.md` | **T2** |
| 6 | Đụng >1 nhóm file rời nhau? | `git status --short` | **T1** |
| — | Còn lại | | **T0** |

### Tầng 0 — luôn, mọi lần code (6 món, vài giây)

1. `git status` để biết mình đang ở đâu, trên branch nào.
2. Đọc `docs/CLAIMS.md` **trước khi tin `AGENTS.md`** về trạng thái.
3. **Verify** claim của agent khác trước khi dùng — không tin phần tóm tắt.
4. Mọi con số phải kèm lệnh tái tạo. Không có → ghi `ƯỚC LƯỢNG` hoặc xoá.
5. Chạy gate cho phần đã đổi, báo **output thật**.
6. Không chạy được → `CHƯA CHẠY`. Không giả định "chắc là được".

### Tầng 1 — thêm

Branch riêng + khai claim + `git diff --unified=0` chứng minh staged diff chỉ có của mình.

### Tầng 2 — thêm

Worktree mỗi agent + đủ 8 gate + rebase lên integration branch rồi **chạy lại mọi gate**.

### Thứ tự thẩm quyền khi mâu thuẫn

```
docs/CLAIMS.md   (trạng thái thực tế)   ← THẮNG
      ↓
AGENTS.md        (ý định, quy trình)
      ↓
skill            (playbook)
```

Mâu thuẫn → `CLAIMS.md` thắng **và phải ghi việc sửa lại nguồn thấp hơn**. Suy ra trực tiếp từ lỗi phiên 2026-09-27.

---

## 5. Sáu phase

### Phase 1 — Tầng 0: quy trình tối thiểu, luôn nạp, **ngoài repo**

| | |
|---|---|
| **File** | Tạo `~/.opencode/instructions/MANDATORY-WORKFLOW.md` (~50 dòng) · sửa `~/.opencode/opencode.json` thêm 1 path vào mảng `instructions` |
| **Nội dung** | Bảng leo thang §4 · 6 check T0 · thứ tự thẩm quyền §4 |
| **Vì sao đầu tiên** | Rẻ nhất (ngoài repo, không ai review), **không chặn ai**, và **đo được ngay**: phiên sau có dùng bảng leo thang không |
| **Gate** | `opencode.json` parse được · file tồn tại · nội dung ≤ 60 dòng |
| **Rủi ro** | Ảnh hưởng **mọi repo** của owner, kể cả repo không liên quan. Nếu nội dung nặng, agent sẽ bỏ qua |
| **Rollback** | Xoá 1 dòng trong mảng `instructions` |

> **Cần owner duyệt nội dung trước.** Đây là phase duy nhất ảnh hưởng ngoài repo.

### Phase 2 — Đo gate hiện có (không chặn ai)

| | |
|---|---|
| **File** | `scripts/audit-gates.mjs` (mới) → `docs/evidence/gate-audit/baseline.md` |
| **Việc** | Liệt kê 8 gate local: `check:dom-landmarks`, `check:tokens`, `check:contrast`, `check:admin-spa-routes`, `check:i18n-hardcoded`, `check:multi-agent`, `check-large-files`, `i18n:scan`. Với mỗi gate: **inject 1 vi phạm đã biết, assert `exit ≠ 0`**. Phân loại `thật` / `rỗng` / `không kiểm được` |
| **Vì sao trước khi thêm gate** | Đã biết 3 gate đang rỗng (§8). Thêm gate mới lên nền đó là **nhân bản bệnh** |
| **Kỳ vọng** | **4/8 rỗng**. Nếu kết quả khác dự đoán, Phase 3 phải viết lại |
| **Gate** | Script chạy end-to-end, phân loại hết 8 gate kèm lệnh tái tạo |
| **Rủi ro** | Thấp — chỉ báo cáo, không chặn. Có thể chậm (8 gate × 2 lần) |
| **Rollback** | Xoá script |

### Phase 3 — Preflight có `exit ≠ 0` (viết, **chưa** wire)

Ba check, chọn vì **zero false-positive** — cả ba đều có bằng chứng vi phạm thật:

| # | Check | Bằng chứng nó cần thiết |
|---|---|---|
| 1 | Commit file deny list mà commit body **không** có trailer `Claim-Deny-List: <lý do>` → fail | Đã phải bypass 2 lần (Entry 233, 237) |
| 2 | Staged `docs/CLAIMS.md` có dòng không thuộc claim của mình → fail | Skill cảnh báo đúng case này; `merge=union` **không** cứu được |
| 3 | File sắp sửa có claim `in-progress` của agent khác → fail | Hazard 1 |

**Bất biến:** check 2 và 3 chỉ chạy khi có `--staged` hoặc khi đang sửa file — **không** quét repo, để không bao giờ fail vì trạng thái có sẵn.

| | |
|---|---|
| **Gate (bắt buộc)** | 3/3 negative test → `exit ≠ 0` · chạy trên `dev` sạch → **0 false positive** · kill-switch `AGENT_PREFLIGHT=0` tắt được |
| **Rủi ro** | Trung bình. Nếu chặn nhầm, agent sẽ `--no-verify` |
| **Rollback** | Ở phase này chưa wire vào gì → rủi ro bằng **0** |

### Phase 4 — Cắm Phase 3 vào hook (rủi ro cao nhất)

| | |
|---|---|
| **File** | `~/.opencode/scripts/hooks/pre-bash-dispatcher.js` (đã tồn tại, đang chạy mọi session) |
| **Điều kiện** | **Chỉ sau khi Phase 3 đạt cả 3 gate.** Không wire sớm |
| **Thiết kế an toàn** | Tuần đầu: in cảnh báo + chỉ block `git commit`. Chỉ chuyển sang block toàn phần sau khi quan sát thấy không có `--no-verify` nào |
| **Gate** | Session thật: commit hợp lệ pass · commit vi phạm bị chặn · kill-switch hoạt động |
| **Rủi ro** | **Cao nhất trong kế hoạch.** Hook sai ⇒ chặn nhầm mọi session |
| **Rollback** | `AGENT_PREFLIGHT=0`, hoặc xoá 1 entry trong `hooks.json` |

### Phase 5 — Tách `AGENTS.md` (deny list, **cần owner merge**)

| | |
|---|---|
| **Việc** | 729 → ~70 dòng. Cắt khối `## Progress` (dòng 44–622, **579 dòng = 80%**) sang `docs/ARCHIVE_AGENTS_PROGRESS.md` |
| **Giữ lại** | 5 mục `### OPEN P0` (còn sống) · 2 mục mốc (`VERIFY tenantreg`, `DOC MỐC`) · `Goal` · `Constraints` · `Multi-agent` · `AI Audit Framework` |
| **Bỏ** | **54 mục `### Done`** — đã hoàn thành, chỉ làm loãng. Giữ trong archive nhưng **không nạp mỗi session** |
| **Chống hazard 5** | Sau khi cắt: đối chiếu **byte** phần giữ lại với bản gốc, và `git diff --numstat` phải khớp dự kiến. Đây chính là chỗ đã hỏng 28 ký tự trong phiên 2026-09-27 |
| **Gate** | `git diff --numstat` khớp · phần giữ lại diff = 0 dòng ngoài ý muốn · `npx tsc --noEmit` 0 |
| **Rủi ro** | Trung bình — deny list + encoding |
| **Rollback** | `git revert`, file thuần văn bản |

### Phase 6 — Chống tự thối

| | |
|---|---|
| **Việc** | Mọi khẳng định trạng thái trong `AGENTS.md` phải có `verified: <YYYY-MM-DD> @ <sha>` · in thứ tự thẩm quyền ở đầu file |
| **Gate mới** | `scripts/audit-status-claims.mjs`: quét dòng trạng thái thiếu ngày + sha → báo cáo (**chưa chặn**) |
| **Vì sao** | Đây là nguyên nhân gốc của lỗi phiên 2026-09-27: 1 dòng stale trong `AGENTS.md` ⇒ cả phiên kết luận sai |
| **Rủi ro** | Thấp |

---

## 6. Thứ tự thực hiện và lý do

```
P1  (rẻ, ngoài repo, đo được ngay, không chặn ai)
 └─→ P2  (đo bệnh hiện có — trước khi kê thuốc)
      ├─→ P3  (viết gate, CHƯA wire → rủi ro 0)
      │    └─→ P4  (wire + kill-switch)      ← rủi ro cao nhất
      └─→ P5  (deny list, cần owner merge)   ← làm cuối
 └─→ P6  (chống thối)
```

**Vì sao P5 làm cuối:** nó chạm deny list §2 và rủi ro encoding. Làm sớm sẽ đẩy việc review lên vai owner khi các thứ khác còn chưa ổn định.

**Vì sao P2 trước P3:** nếu 4/8 gate rỗng như dự đoán, thiết kế Phase 3 phải đổi. Đo trước khi viết.

---

## 7. Hai bất biến thiết kế — lấy từ chính lịch sử repo này

| Bất biến | Nguồn |
|---|---|
| **Mọi gate mới phải qua negative test trước khi bật chặn.** Gate đang FAIL sẵn trên `dev` sẽ bị bỏ qua. Nguyên văn claim `off-github-actions`: *"Bật chặn ngay sẽ chặn mọi agent vì nó tồn tại từ đó ⇒ gate bị bỏ qua, **tệ hơn không có gate**."* | `docs/CLAIMS.md` |
| **Mọi gate mới phải có kill-switch.** Không có đường thoát ⇒ sẽ bị bypass âm thầm hoặc bị bỏ hẳn. | Suy ra từ bất biến trên |

Hệ quả: `check_large_files.ps1` phải hạ xuống warn-only vì nó FAIL sẵn 77 dòng trên `dev`. Đây là tiền lệ đúng cho mọi gate mới.

---

## 8. Ba gate đang rỗng — bằng chứng

Đây là lý do Phase 2 tồn tại. Cả ba đều **pass trong khi không kiểm tra gì**.

| Gate | Vì sao rỗng | Bằng chứng |
|---|---|---|
| `check:i18n-hardcoded` | Allowlist **5 path** cố định trong `package.json` | Chạy tay lên `PortfoliosPage.tsx`: **exit 1, `TOTAL_HARDCODED_VI=12`** — nhưng `check:shell` vẫn exit 0 vì không quét file đó |
| `i18n:scan` | In lỗi parse rồi **vẫn exit 0** | `i18next-scanner: Unable to parse code` + `Error: Line 8: Unexpected identifier`, `EXIT=0` |
| `ops_audit.action` | `max_length=16` nuốt `DataError` trong `except` | Audit order **không bao giờ ghi được** (Entry 232, phát hiện 2026-09-26) |

> **Gate rỗng tệ hơn không có gate**, vì nó tạo cảm giác an toàn giả. Đây là lý do Phase 2 phải chạy *trước* khi thêm gate mới.

---

## 9. Bốn việc cố ý KHÔNG làm

| Không làm | Vì sao |
|---|---|
| Sửa `description` của skill để trigger rộng hơn | Skill là tầng 3 (playbook). Mở rộng trigger sẽ kéo quy trình nặng 8-gate vào việc sửa một dòng |
| Chặn ở `pre-commit` | `pre-commit` đang chạy `lint-staged`. Thêm rule ở đó rủi ro hơn giá trị. `pre-push` / dispatcher là đủ |
| Tạo `UserBrokerConfig` hay sửa BE | Không liên quan. Phase 2 sẽ cho biết có cần không |
| Đụng `packages/web/package.json` | Deny list §2. Tránh bằng cách đặt script **ngoài** `scripts/` hiện có, trong `scripts/audit-gates.mjs` và `scripts/agent-preflight.mjs` — vốn ngoài deny list |

---

## 10. Rủi ro và rollback tổng

| Phase | Rủi ro | Rollback | Cần owner? |
|---|---|---|---|
| P1 | Trung bình (ảnh hưởng mọi repo) | Xoá 1 dòng trong `instructions` | ✅ duyệt nội dung |
| P2 | Thấp | Xoá script | ❌ |
| P3 | Thấp (chưa wire) | Tự nhiên | ❌ |
| P4 | **Cao** | `AGENT_PREFLIGHT=0` | ✅ cân nhắc bỏ hẳn |
| P5 | Trung bình | `git revert` | ✅ merge |
| P6 | Thấp | Xoá script | ❌ |

---

## 11. Tiêu chí thành công — đo được

**Đề xuất một chỉ số duy nhất, đo trước và sau:**

> **Tỉ lệ lỗi quy trình mà một gate bắt được.**

| | Hiện tại | Mục tiêu sau 6 phase |
|---|---|---|
| Số lỗi quy trình bị bắt bởi gate `exit ≠ 0` | **0 / 4** | **≥ 3 / 4** |

Bốn lỗi quy trình đã xảy ra trong phiên 2026-09-27 (cùng một agent, tuần tự — **không** phải lỗi multi-agent):

| # | Lỗi | Gate nào lẽ ra phải bắt |
|---|---|---|
| 1 | Báo "code không tồn tại" cho 6 slice `tenantreg-*` dựa trên dòng stale trong `AGENTS.md` | Phase 2 (`audit-status-claims`) + thứ tự thẩm quyền |
| 2 | Tin claim sai rằng `vitest.config.ts:12` làm file không chạy | Phase 2 (verify claim) |
| 3 | Kết luận "363/364 file fail" từ phép đo vô nghĩa, rồi tự bác bỏ 2 lần | Chỉ quy tắc "mọi số kèm lệnh tái tạo" |
| 4 | Commit 28 ký tự hỏng encoding vào file shared | Phase 3 check 2 + `git diff --numstat` ở Phase 5 |

**Nếu không đo được chỉ số này, cả kế hoạch chỉ là văn bản đẹp** — đúng thứ bị chỉ ở `INSTRUCTIONS.md`.

---

## 12. Ba câu hỏi cần owner quyết

| # | Câu hỏi | Vì sao cần owner |
|---|---|---|
| 1 | Duyệt nội dung `MANDATORY-WORKFLOW.md`? | Phase 1 ảnh hưởng **mọi repo**, kể cả repo không liên quan |
| 2 | Chấp nhận rủi ro sửa `pre-bash-dispatcher.js`? Nó đang chạy mọi session. Hay chỉ làm P1–P3 + P5–P6 và để P4 lần sau? | Rủi ro cao nhất |
| 3 | Bỏ hẳn 54 mục `### Done` khỏi `AGENTS.md` (chuyển `docs/ARCHIVE_*.md`) được không? Có muốn xem trước bản rút gọn? | Thay đổi lớn nhất |

**Khuyến nghị bắt đầu:** **P1 + P2**. Cả hai **không chặn ai**, **không cần owner merge gì**, và P2 cho biết có đáng làm P3–P4 hay không.

---

## Appendix A — Lệnh tái tạo mọi con số

Chạy từ repo root, trừ khi ghi khác.

### A.1 — Cấu trúc `AGENTS.md`

> **Cảnh báo đo lường:** `Measure-Object -Line` đếm **dòng không rỗng** (673), còn `ReadAllLines` đếm
> **tất cả** (729). Dùng nhầm lệnh sẽ ra số khác. Tài liệu này dùng **tổng dòng thật = 729**.

```powershell
# tong dong THAT (kem dong trong) — 729
[System.IO.File]::ReadAllLines("$PWD\AGENTS.md").Count

# vi tri khoi
Select-String -Path AGENTS.md -Pattern '^##\s' | ForEach-Object { "$($_.LineNumber)  $($_.Line)" }

# dem muc con
(Select-String -Path AGENTS.md -Pattern '^###\s'   | Measure-Object).Count   # 69
(Select-String -Path AGENTS.md -Pattern '^### Done' | Measure-Object).Count   # 54
(Select-String -Path AGENTS.md -Pattern '^### OPEN P0' | Measure-Object).Count # 5
```

Phân bố khối (đo ở commit `378bf74d`, 2026-09-27):

| Khối | Dòng | Số dòng |
|---|---|---|
| `## Goal` + `## Constraints` | 2–10 | 9 |
| `## Multi-agent` | 11–43 | 33 |
| `## Progress` (lịch sử) | 44–622 | **579** |
| `## Key Decisions & Metrics` | 623–633 | 11 |
| `## AI Audit/Research Framework` | 634–700 | 67 |
| Phần còn lại | 701–729 | 29 |

⇒ `579 / 729 = 79%`

> **Ghi chú tự thừa nhận:** con số này từng là `722 / 579 = 80%` khi tôi đo đầu phiên, trước khi
> PR #38 chèn thêm 7 dòng. Số cũ **không tái tạo được** từ HEAD hiện tại. Đây đúng là loại lỗi mà
> nguyên tắc *"mọi con số phải kèm lệnh tái tạo"* sinh ra để bắt — và nó đã bắt được chính tài liệu
> này. Số đã sửa ở trên.

### A.2 — Cơ chế luôn nạp

```powershell
$j = Get-Content "$env:USERPROFILE\.opencode\opencode.json" -Raw | ConvertFrom-Json
$j.instructions          # 14 path
Test-Path "$env:USERPROFILE\.config\opencode\opencode.jsonc"   # True — nhưng KHÔNG có khoá `instructions`
```

### A.3 — Tầng 2 (hook) đã tồn tại

```powershell
Test-Path "$env:USERPROFILE\.opencode\scripts\hooks\pre-bash-dispatcher.js"   # True
Test-Path "$env:USERPROFILE\.opencode\scripts\hooks\run-with-flags.js"        # True
```

### A.4 — Ba gate rỗng (§8)

```powershell
# 1) check:i18n-hardcoded là allowlist 5 path
node scripts/check-i18n-hardcoded.mjs src/pages/PortfoliosPage.tsx   # EXIT=1, TOTAL_HARDCODED_VI=12
# nhưng check:shell vẫn exit 0 vì không quét file đó

# 2) i18n:scan in lỗi rồi exit 0
npm run i18n:scan   # in "Unable to parse" + "Unexpected identifier", EXIT=0
```

### A.5 — Bất biến thiết kế §7

```powershell
Select-String -Path docs\CLAIMS.md -Pattern 'off-github-actions'
# nguyên văn: "Bật chặn ngay sẽ chặn mọi agent vì nó tồn tại từ đó => gate bị bỏ qua, tệ hơn không có gate"
```

### A.6 — Encoding file ledger (phục vụ Phase 5)

```powershell
# file trên đĩa là UTF-8 hợp lệ — mojibake là do công cụ ĐỌC, không phải file hỏng
node -e "const b=require('fs').readFileSync('docs/CODE_CHANGE_AUDIT_LEDGER.md');console.log(b.toString('utf8').includes(String.fromCharCode(0xFFFD))?'CO U+FFFD':'SACH')"
# → SACH  (0 ký tự thay thế)
```

---

## Appendix B — Liên hệ

| Tài liệu | Vai trò |
|---|---|
| `docs/AGENT_PROTOCOL.md` | Nguồn chi tiết của deny list §2, quy tắc claim, thứ tự merge |
| `docs/CLAIMS.md` | Registry — **thẩm quyền về trạng thái** |
| `AGENTS.md` | Ý định + lịch sử (sẽ tách ở Phase 5) |
| `docs/OPEN_WORK_20260927.md` | Mốc 6 việc tồn đọng + baseline test đã biết |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Nhật ký thay đổi — deny list §2 |
| skill `multi-agent-workflow` | Playbook tầng 3 cho nhánh parallel |
