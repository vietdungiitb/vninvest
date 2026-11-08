---
tags: [plan, workflow-dev-loop, B2]
date: 2026-11-08
baseline_head: 38c84ad89 (origin/dev, PR #306 merged)
---

# PLAN — Tiếp tục công việc sau UI/UX Phase B đóng (2026-11-08)

## 1. Mục tiêu

Đóng 3 nợ ngoài scope còn lại từ handoff (`docs/SESSION_HANDOFF_UIUX_20261108.md` §3) mà **không** phá thứ đã đóng ở Entry 424 (full suite 1198/1199, staging xong, verdict Phase B v4 = AGREE). Các mục C3/i18n-lazy/D1/D2 + BE suite + axe/visual là **chờ owner/coordinator quyết** — plan này chỉ liệt kê điều kiện mở, không cam kết làm.

## 2. Baseline exit-code tại HEAD (đo thật phiên này, không đoán)

| Cổng | Lệnh | Kết quả phiên này |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** (0 lỗi, 187 claim, 157 cảnh báo file cũ không chặn) |
| Git | `git status --short` | **sạch**; HEAD detached tại `38c84ad89` vì `dev` bị giữ ở worktree khác |
| Type / FE suite / BE suite / build | — | **CHƯA CHẠY** trong phiên lập plan này (gate tối thiểu trước B5: `npx tsc --noEmit` local + full suite/BE qua VPS staging §12) |
| Evidence kế thừa (không tự đo lại) | Entry 424 (`docs/CODE_CHANGE_AUDIT_LEDGER.md:1-8`) | full suite 177/178 files PASS, 1198/1199 tests PASS, staging deploy+verify PASS |

**Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-008, L-M02, L-V01, L-V02, L-V04]
**Nguồn:** `docs/LESSONS/multi-agent.md:6-118` (L-001/L-002/L-003/L-007/L-008/L-M02) · `docs/LESSONS/verification.md:10-84` (L-V01/L-V02/L-V04)

**MANDATORY CHECKLIST (tick trước khi coi slice xong):**
- [ ] File định chạm không nằm shared deny-list §2 (L-001) · kiểm `docs/AGENT_PROTOCOL.md` §2
- [ ] Claim commit riêng **trước** dòng code đầu tiên, branch = `feat/<tên-agent>` đúng ký tự (L-002, L-M02)
- [ ] Gate chạy **sau** `agent-sync.ps1` (rebase → check migration → gate), không gate trước rebase (L-003)
- [ ] Không commit thẳng `dev`; qua branch + PR; không `--no-verify` (L-008)
- [ ] Không kết luận BE khi chưa có env; ghi `CHƯA CHẠY` thay vì PASS giả (L-007)
- [ ] Mọi số đo phải có control biết đáp án (L-V01); gốc rễ kế thừa phải có phản chứng fail-before trước khi sửa (L-V02); assert giá trị thật + test dương tính (L-V04)
- [ ] `git status --short` sau mỗi lệnh ghi file (test/screenshot/codegen) để bắt side-effect (L-V03, `verification.md:57-71`)

## 3. SCOPE / LIMIT / NON-GOALS / ROLLBACK

- **SCOPE (đúng trong vòng này):** 3 ticket + 1 guard ops (T3 dưới). File ownership file-disjoint, khai claim trước khi sửa.
- **LIMIT:** Tối đa 3 vòng sửa/bước, sau đó ghi `blocker` + dừng (luật cứng workflow-dev-loop #2). Mỗi task = 1 branch `feat/<tên-agent>` + 1 PR.
- **NON-GOALS (cấm làm trong vòng này):** C3 i18n lazy namespace · D1 light theme (a/b) · D2 recharts→widget/echarts · BE suite full trên VPS · axe/visual 5 route · mọi file `packages/core/backend/src/commercial/*` của agent khác (handoff §4: không commit hộ) · sửa `agent-*.ps1` ngoài phạm vi parse-fix T3 · không đụng deny-list.
- **ROLLBACK:** revert PR (merge-commit, không squash). BE task render lại manifest nếu cần. VPS compose ops-side: backup `.bak.20261108` đã có; lần pull sau kiểm tra conflict `CORE_AD_SIGNING_SECRET` trước (handoff §1, Entry 423).
- **Môi trường:** Mọi test BE/FE/build nặng chạy trên **VPS staging** (`14.225.255.47`, `/opt/vninvest`), **cấm local Docker** (AGENTS.md + RUNBOOK §12). Gate nút nhẹ (`check-multi-agent`, `tsc --noEmit`, `check-lessons`, `normalize-eol`) chạy local.

## 4. Chuỗi công việc (thứ tự đề xuất)

### T0 — Guard ops-side (làm ngay khi mở phiên, không phải code)

- **Việc:** Trước bất kỳ `git pull` nào vào VPS staging, kiểm tra conflict ở `docker-compose.staging.yml` do dòng `CORE_AD_SIGNING_SECRET` ở 5 service trên VPS **không có trong git** (deny-list, backup `.bak.20261108`). Chỉ ghi vào claim + evidence, không commit file này (L-001).
- **Acceptance:** Given VPS đã có `CORE_AD_SIGNING_SECRET`, When pull `dev@38c84ad89` (hoặc mới hơn), Then deploy `--verify` PASS, health 2xx, không bị restore mất secret.
- **Fail-before:** Chưa có bằng chứng conflict; đây là **CHƯA XÁC MINH** — cần kiểm chứng bằng `diff` merge thử trên VPS trước khi đóng T0 (L-V02).

### T1 — `ai-cc-i18n-clean` AC5 (comment tiếng Việt, 1/1199 tests)

- **Bằng chứng:** Fail duy nhất còn lại (Entry 424:4, handoff §3.1). Tái hiện: `npx vitest run src/components/__tests__/ai-cc-i18n-clean.component.test.ts`.
- **Việc:** Dịch / giảm comment tiếng Việt trong 9 file AI CC (93 dòng theo Entry 420:47). **Không chạm logic** — chỉ comment/string nội bộ, giữ implementation nguyên.
- **SCOPE:** 9 file AI CC + test AC5. Khác file `commercial/*`. Nếu cần chạm `vi.js/en.js`, claim-check trước (danh sách key là CHƯA XÁC MINH cho tới khi grep, theo PLAN_PM_AUDIT_FIX:23).
- **Acceptance:** Given test AC5 đang FAIL, When fix xong, Then file test **PASS** và full suite **1199/1199** (hoặc số mới đo lại sau rebase). Không regression ở test AI CC khác.
- **Rủi ro:** Gate i18n bỏ qua dòng chứa `className` (Entry 422, handoff §4) — phải đọc code thật trước khi kết luận "0 hit". Ghi lesson nếu phát hiện mới.

### T2 — `auth-forms-rhf-extra.component.test.tsx` treo khi chạy lẻ

- **Bằng chứng:** Handoff §3.2: pre-existing (đã chứng minh bằng stash trên cây sạch), không treo khi chạy full suite cùng repo. Tái hiện: `npx vitest run src/pages/auth/__tests__/auth-forms-rhf-extra.component.test.tsx --testTimeout=20000`.
- **Việc (điều tra trước, sửa sau — L-V02):** Reproduce-first: chạy lẻ với timeout, xác nhận treo thật; trace từng bước (console error / repro script) để phân biệt flake vs hang thật; chỉ sửa khi có bằng chứng root cause. Nếu là test-harness (worker rò rỉ, Entry 424:7), fix ở cấu hình/test setup, không sửa production code.
- **Acceptance:** Given chạy lẻ hiện treo, When fix xong, Then chạy lẻ **PASS trong <20s** và full suite **không regression**. Nếu không tái hiện được (CHƯA XÁC MINH), ghi evidence + đóng ticket là flake, không sửa lung tung (L-V02 checklist).
- **LIMIT:** 3 vòng điều tra; quá thì ghi `blocker` + chuyển ticket flaky riêng, không chặn T1/T3.

### T3 — `agent-sync.ps1` / `agent-cleanup.ps1` lỗi parse PowerShell 5.1

- **Bằng chứng:** Handoff §3.3: tồn tại trước phiên UI/UX (phiên đó đã làm thủ công fetch/rebase → gate → claim `done` → push → PR → merge). **CHƯA XÁC MINH** lỗi parse cụ thể — cần tái hiện trước khi sửa (L-V02).
- **Việc:** Chạy `pwsh -File scripts/agent-sync.ps1` trên PS 5.1, ghi lỗi parse thật (file:line), fix nhỏ nhất đúng chỗ; giữ hành vi trên PWSh 7+. Không sửa các script khác ngoài 2 file này. File thuộc phạm vi agent-infra, không thuộc `commercial/*`.
- **Acceptance:** Given PS 5.1 parse lỗi, When fix xong, Then cả 2 script chạy được trên PS 5.1 (exit 0) và không regression log gate; ghi lại `CHƯA CHẠY` nếu không có máy PS 5.1 thật (L-007).
- **Rủi ro:** Chỉ sửa script → không động production code; rollback = revert PR đơn lẻ.

### T4 — BE suite · Axe · Visual · C3/D1/D2 (chờ owner/coordinator, **không làm trong vòng này**)

- **Điều kiện mở (ghi rõ để không tự mở):** BE full suite + axe 5 route 390×851 + visual baseline 5 route × 2 theme cần staging + browser + quyết định của owner (handoff §3). C3/D1/D2 cần owner chốt hướng (PLAN_PM_AUDIT_FIX:66-68: Q2/Q3/Q5 đã có default, nhưng vẫn chờ xác nhận).
- **Trong vòng này CHỈ làm:** Liệt kê acceptance + lệnh đo cho từng mục vào evidence, khi có GO mới mở claim riêng. Không báo PASS cho chưa chạy (L-007).

## 5. Trình tự vòng kín (mỗi task, bắt buộc)

B1 Đo lường (agent-sync → status → claims → lessons đã ghi ở §2) → **B2 plan này** → B3 audit độc lập (chỉ đọc, người/model khác) → B4 đồng thuận PASS/AGREE (ghi file verdict, không chat-only — luật cứng #6) → B5 claim + worktree cách ly → B6 TDD fail-before → pass-after → B7 gates sau rebase (local nút + VPS staging) → B8 re-audit độc lập → B9 claim done + ledger Entry mới + PR merge-commit → cleanup worktree/branch.

Song song 2 agent: mỗi agent 1 worktree (`scripts/new-agent.ps1` + `agent-install-hooks.sh`) + DB riêng; `workspace.js`/`vi.js`/`en.js` không claim đồng thời (PLAN_PM_AUDIT_FIX order notes).

## 6. Câu hỏi cần làm rõ (chưa hỏi lung tung — ghi CHƯA XÁC MINH cho tới khi đo)

1. T1: Exact 9 file còn comment VI tại HEAD? (cần grep lại tại HEAD, không dùng số 93 dòng cũ)
2. T2: Treo là do test nào / worker nào? (cần repro, không đoán)
3. T3: Lỗi parse PS 5.1 ở dòng nào? (cần chạy thật)
4. T4: Owner có đồng ý mở C3/D1/D2 trong đợt này không, hay giữ defer?

## 7. Đánh giá tổng thể

- **Implementable?** T1–T3 là nhỏ, không blocker, làm ngay được sau B3/B4. T4 là chờ owner — không tự mở.
- **Blocker:** Không có blocker cho T1–T3. Rủi ro duy nhất đã ghi: conflict `CORE_AD_SIGNING_SECRET` trên VPS lần pull sau (T0).
- **Ưu tiên:** T0 → T1 (đóng 1/1199) → T3 (hạ tầng dễ lặp) → T2 (điều tra) → T4 (chờ GO).
  Thứ tự này tách 3 file-disjoint scope, tránh va chạm claim và tránh sửa BE/FE cùng lúc.

## 8. Bàn giao

Plan này là **B2** (chưa B3/B4). Bắt đầu B3 cần auditor độc lập đọc plan này + handoff + ledger Entry 424, ghi verdict vào `docs/evidence/<slice>/AUDIT_*.md` trước khi khai claim. Không viết code cho tới khi có verdict PASS/AGREE bằng văn bản (luật cứng #6).
