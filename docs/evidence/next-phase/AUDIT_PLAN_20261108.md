# AUDIT PLAN — B3/B4 vòng workflow-dev-loop (độc lập, chỉ đọc)

| | |
|---|---|
| **Scope** | Audit plan B2 `docs/PLAN_NEXT_PHASE_20261108.md` (99 dòng) và các nguồn plan dựa vào |
| **Ngày** | 2026-11-08 |
| **HEAD lúc audit** | `5315e7cca` (branch `license-portal-lp1`) · `origin/dev` = `38c84ad89` · **lệch baseline plan** (xem R1) |
| **Auditor** | Auditor độc lập (phiên khác planner), **chỉ đọc — không sửa code, không commit** |
| **Đã đọc** | PLAN_NEXT_PHASE_20261108 (toàn bộ) · SESSION_HANDOFF_UIUX_20261108 (toàn bộ) · Ledger Entry 424/423/422 · MASTER_TRACKING §4-§6 · CLAIMS (đuôi + grep `in-progress`/`commercial`) · LESSONS multi-agent L-001/L-002/L-003/L-007/L-008/L-M02 + verification L-V01/L-V02/L-V04 · đối chứng: `AGENT_PROTOCOL.md` §2/§12, test `ai-cc-i18n-clean.component.test.ts` (SRC9 + AC5), `git rev-parse/status/worktree`, `check-multi-agent.mjs` (chạy lại), `PLAN_PM_AUDIT_FIX_20261108.md:69` |

## Bảng Plan vs Hiện trạng

| # | Khẳng định / mục plan | Status | Đối chứng tại audit |
|---|---|---|---|
| 1 | §2 `check-multi-agent` PASS, 187 claim, 157 cảnh báo | ✅ | Auditor chạy lại: **PASS, 187 claim hợp lệ, 157 cảnh báo** — khớp số plan |
| 2 | §2 `git status` sạch; HEAD detached `38c84ad89` | ❌ | HEAD hiện `5315e7cca` (`license-portal-lp1`), status **dirty**: `?? packages/core/backend/src/commercial/test_license.py`; 2 commit ahead `origin/dev`. Baseline đã drift trước B5 |
| 3 | §2 Type/FE/BE/build = **CHƯA CHẠY** (không bịa) | ✅ | Trung thực, đúng L-007 |
| 4 | §2 kế thừa 1198/1199 + staging PASS từ Entry 424 | ✅ | Khớp `CODE_CHANGE_AUDIT_LEDGER.md:1-8` (Entry 424) + handoff §1:16-23 |
| 5 | §3 SCOPE 3 ticket + T3, file-disjoint; thứ tự T0→T1→T3→T2→T4 | ⚠️ | Thứ tự hợp lý (T2 điều tra đặt sau T3 hạ tầng), T1/T2/T3 về file không giao nhau — nhưng T1 nêu "9 file" trong khi `SRC9` chỉ có **7** (xem OBJ-1) |
| 6 | §3 NON-GOALS cấm `packages/core/backend/src/commercial/*` | ✅ | Khớp handoff §4 + Entry 424:6; file dirty `commercial/test_license.py` hiện tại củng cố quy tắc này |
| 7 | §3 ROLLBACK = revert PR merge-commit, không squash | ✅ | Khớp `AGENT_PROTOCOL.md` §10.5 |
| 8 | §3 Mọi test nặng trên VPS, **cấm local Docker** | ✅ | Khớp `AGENT_PROTOCOL.md` §12 + `MASTER_TRACKING.md` §1/§7 |
| 9 | T0 acceptance: deploy `--verify` PASS | ❌ | Gộp guard read-only với deploy mutation trên staging dùng chung (xem OBJ-2) |
| 10 | T1 "93 dòng comment, 9 file, chỉ comment/string nội bộ" | ❌ | `SRC9` = 7 file; AC5 **strip comment** trước khi soi (`ai-cc-i18n-clean.component.test.ts:123-135`) nên label "93 dòng comment" chưa chứng minh được; plan chưa phân loại comment vs runtime string (xem OBJ-1) |
| 11 | T1 acceptance: AC5 PASS + full suite 1199/1199 | ⚠️ | Đo được nhưng thiếu quy tắc exclude của Entry 424 (`--exclude auth-forms-rhf-extra`) và re-measure sau rebase; AC5 có thể pass giả qua strip regex |
| 12 | T2 reproduce-first, trace từng bước, LIMIT 3 vòng | ✅ | Đúng L-V02; khớp handoff §3.2 (pre-existing đã chứng minh bằng stash) |
| 13 | T2 acceptance: lẻ PASS trong <20s | ⚠️ | `--testTimeout=20000` là ngưỡng fail của vitest, không phải tiêu chí pass; thiếu host/timing/repeat; fallback "đóng ticket là flake" che root cause (xem OBJ-3) |
| 14 | T3 ghi CHƯA XÁC MINH lỗi parse cụ thể trước khi sửa | ✅ | Đúng L-V02/L-007; khớp handoff §3.3 |
| 15 | T4 chỉ liệt kê acceptance + lệnh đo, chờ GO, không báo PASS cho chưa chạy | ✅ | Không tự mở việc chờ owner; khớp L-007 |
| 16 | Checklist L-001/L-002/L-003/L-007/L-008/L-M02/L-V01/L-V02/L-V04 | ⚠️ | Đầy đủ, nhưng L-V03 được cite trong checklist mà **không có** trong header `Lessons áp dụng`; L-V04 (test dương tính) chưa gắn vào acceptance nào |
| 17 | MASTER_TRACKING §4-§6 (W0/W1) | ✅ | Không mâu thuẫn: plan thuộc track handoff-debt, không đụng Phase A/B; chỉ ghi nhận registry còn hàng `in-progress` trùng `done` (W0-1/W0-3/W0-6) → coordinator/hygiene, ngoài scope plan này |
| 18 | CLAIMS `commercial/*` + file T1/T2/T3 | ➕ | Không thấy claim `in-progress` nào đè trực tiếp 3 tập file T1/T2/T3; điều này vẫn phải re-check tại B5 (main tree đang có branch license chưa merge) |

## Critical issues (phải sửa trước verdict AGREE)

### OBJ-1 — T1: scope và acceptance chưa phân loại (comment vs runtime string; 9 vs 7 file)
**Bằng chứng:** plan:53 nêu "93 dòng theo Entry 420:47 ... 9 file AI CC". Thực tế test `SRC9` chỉ liệt kê **7 file** (`ai-cc-i18n-clean.component.test.ts:39-47`) dù comment nội bộ vẫn ghi "9 file". AC5 strip `/* */` và `//` trước khi soi ([ test:128-129]), nghĩa là nếu 93 dòng đúng là comment thì AC5 không fail — vậy hoặc label ledger sai, hoặc các hit là runtime string/JSX text, hoặc strip regex chưa bao quát hết.

**Why it matters:** Phần "Việc" của T1 ("Không chạm logic — chỉ comment/string nội bộ") là giả định chưa chứng minh. Nếu là runtime string/JSX text, fix chạm copy người dùng thấy → phải đặt key `vi.js`/`en.js`, kiểm EN render (L-V04), không phải "dịch comment". Acceptance "AC5 PASS + 1199/1199" có thể pass trong khi independent grep vẫn còn hit (kể cả hit được "gaming" qua strip regex, vd. tiếng Việt nằm sau `//`), và số 1199 thiếu quy tắc exclude nên không so được trước/sau T2.

**Suggested fix (nhỏ, bắt buộc):** Tại B1 (trước claim), chạy grep độc lập trên 7 file `SRC9` tại HEAD kế hoạch, phân loại từng dòng tiếng Việt (block/line comment / string literal / JSX text), đính kèm evidence. Nếu có string/JSX text → rescope T1 thành i18n-key placement + verify EN render. Sửa acceptance thành: "0 hit trên independent scan + AC5 PASS + full-suite count re-measured sau rebase (ghi rõ quy tắc exclude)". Q1 trong plan §6 phải là **gate của B1**, không phải câu hỏi mở khi B4.

### OBJ-2 — T0: acceptance gộp guard read-only với deploy mutation trên staging dùng chung
**Bằng chứng:** plan:47 bắt T0 `deploy --verify` PASS + health 2xx, trong khi T0 được khai là "không phải code", không claim. Staging là môi trường dùng chung (`AGENT_PROTOCOL.md` §12, `MASTER_TRACKING.md` §1); file `docker-compose.staging.yml` nằm deny-list (`AGENT_PROTOCOL.md` §2:33); main tree đang có branch license chưa merge + file dirty.

**Why it matters:** Mục đích guard (không mất `CORE_AD_SIGNING_SECRET` ở lần pull sau) là kiểm tra read-only. Deploy `--verify` là mutation trên staging dùng chung — chạy trong T0 không qua luồng claim B5/B7 sẽ có thể push state bất ngờ, va chạm deploy của agent khác, hoặc vô tình commit ops-side secret vào git.

**Suggested fix:** Tách **T0a** (read-only, evidence-only): VPS `git status`/`diff` của `docker-compose.staging.yml` vs git chỉ còn đúng hunks `CORE_AD_SIGNING_SECRET` ở 5 service + backup `.bak.20261108` tồn tại + secret có trong `compose.staging.env`. **T0b**: `deploy --verify` thuộc luồng claim B5/B7, chỉ chạy khi coordinator xác nhận staging idle. Acceptance T0 = evidence T0a (không gồm deploy).

### OBJ-3 — T2: acceptance chưa vận hành được + fallback đóng ticket hời hợt
**Bằng chứng:** plan:60–62 dùng `--testTimeout=20000` (ngưỡng fail của vitest, không phải tiêu chí pass) và acceptance "PASS trong <20s" nhưng không ghi host (theo §3 là VPS), cách đo, số lần lặp. Fallback plan:62 là "đóng ticket là flake" khi không tái hiện được.

**Why it matters:** Hang thật vs build chậm không phân biệt được; `<20s` qua SSH lên VPS rất flaky. Đóng một hang có thể là thật dưới nhãn "flake" mà không có root cause chính là che vấn đề — vi phạm tinh thần L-V02 (chưa tái hiện ⇒ CHƯA XÁC MINH, không phải đã giải quyết).

**Suggested fix:** Operationalize — chạy lẻ file test trên VPS 3 lần liên tiếp, wall-clock <20s mỗi lần (dùng `time`/`Measure-Command`), full-suite count không đổi. Không tái hiện được ⇒ ghi **"flaky-unconfirmed, giữ ticket mở"** kèm lệnh tái hiện để triage sau, không đóng. Bổ sung giả thuyết worker rò rỉ đã ghi ở Entry 424:7 vào trace checklist.

## Improvement opportunities (không chặn)

- T3: thử **parse probe read-only** local (`[System.Management.Automation.PSParser]::Tokenize` hoặc `pwsh -NoProfile -Command` chế độ parse-only) trước khi ghi CHƯA CHẠY — probe parse là gate nhẹ (được phép local theo §12), khác với chạy cả script. Ghi tên lệnh "log gate" cụ thể trong acceptance của T3.
- §2 header `Lessons áp dụng` thêm L-V03 (checklist đã dùng) cho nhất quán; gắn L-V04 vào acceptance T1 (test dương tính: key mới hiển thị đúng cả VI/EN).
- Thêm §2 addendum về drift HEAD (license-portal-lp1 + file dirty `commercial/*`) để B5 có căn cứ re-sync, tránh hiểu baseline plan là hiện trạng.
- Ghi rõ mọi lệnh FE test trong plan là chạy trên VPS (theo §3), đặc biệt T2 khi đo timing (tránh đo local rồi kết luận).

## VERDICT

**NEED_REVISION** — 3 objection (OBJ-1, OBJ-2, OBJ-3); phán quyết gỡ khi plan sửa cả 3 tại §4 (phân loại T1 + chốt acceptance; tách T0a/T0b; operationalize T2) rồi auditor xác nhận lại. Không ý kiến đạo đức/pháp lý.
