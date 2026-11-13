# Gates — slice `gate-p0-20261113` (Đợt 0 "gate xanh") — 2026-11-13

> **Claim:** `gate-p0-20261113` · **Branch:** `feat/gate-p0-20261113` → `dev`
> **Plan:** `docs/PLAN_GATE_P0_20261113.md` · **Base đo:** `origin/dev` @ `e59298e1c`
> **Quy trình:** `docs/STAGING_VPS_RUNBOOK.md` §12.4 (FE test **bắt buộc** trên VPS) · **Lessons:** [L-001 L-002 L-003 L-008 L-M02 L-A01 L-T01 L-T02 L-F07 L-V01 L-V02 L-V04 L-V06 L-V08 L-G01 L-G02]

---

## 1. B1 — Baseline gate trên worktree slice (chạy thật, local)

| # | Lệnh | Exit | Kết quả |
|---|---|---|---|
| B-1 | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration — PASS` (4 warning claim cũ, cột file ghi nhiều path trong 1 ô) |
| B-2 | `node packages/web/scripts/scan-secrets.mjs` | **0** | `4659 tracked file(s), 4474 scanned, 185 skipped` → `OK, no secrets found` |
| B-3 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **0** | `baseline 2026-11-13: 1 số trùng` · `88 header / 87 số khác nhau / max=475` → `PASS (0 trùng mới; 1 số trùng có sẵn vẫn nguyên danh)` |
| B-4 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs --self-test` | **0** | `✓ self-test PASS (4 trường hợp)` — gate **còn bắt được** trùng mới |
| B-5 | `node scripts/check-lessons.mjs` | **0** | `14 file \| 58/60 lesson — sạch` |
| B-6 | `node scripts/normalize-eol.mjs` | **0** | `OK (0 file thay đổi, tất cả khớp dạng blob gốc)` |
| B-7 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry` | — | **476** (Entry kế tiếp — lấy bằng tool, không tự đặt) |
| B-8 | `git rev-list --left-right --count origin/dev...dev` | — | `0  0` |

**`CHƯA CHẠY` ở lúc B1:** `tsc --noEmit` · `eslint` · `npm run build` · `npm run test:components` (full suite) — §12.1 **cấm** chạy suite local.

### 1.1 Xác nhận fail-before dùng đúng code chưa-fix

```
git diff --stat origin/dev 214f7aedd -- packages/web/src/components packages/web/vitest.config.ts
→ (rỗng)   ⇒ 3 file test ở origin/dev **giống hệt** commit trước khi fix
git diff --stat origin/dev feat/gate-p0-20261113 -- packages/web/package.json packages/web/package-lock.json
→ (rỗng)   ⇒ lock giống ⇒ VPS tái dùng được node_modules Linux giữa 2 worktree
```

---

## 2. FAIL-BEFORE (VPS staging, đo trên `origin/dev` = trạng thái **chưa** fix)

**Lệnh (runbook §12.4):**

```bash
cd /opt/vninvest && git fetch origin dev --quiet
git worktree add /tmp/wt-gatep0 origin/dev          # HEAD = e59298e1c
cd /tmp/wt-gatep0/packages/web
/usr/bin/corepack npm ci                            # npm 11.18.0, exit 0
/usr/bin/corepack npm run test:components -- \
  src/components/AIUsageDashboard.component.test.js \
  src/components/__tests__/ai-usage-chart-r16.component.test.ts \
  src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts
```

**Kết quả (log VPS `/tmp/gatep0-failbefore.log`):**

- **Test Files 3 failed (3)** · **Tests 7 failed | 25 passed (32)** · **Errors 5** · Duration 6.42s

| # | File | Test đỏ | Nguyên nhân (đọc từ log) |
|---|---|---|---|
| 1 | `AIUsageDashboard.component.test.js` | `renders title and summary cards after load (Slice 3)` | `TypeError: Cannot set properties of null (setting 'dpr')` |
| 2 | `AIUsageDashboard.component.test.js` | `exports CSV via a full fetch when the export button is clicked (Slice 3)` | như trên |
| 3 | `AIUsageDashboard.component.test.js` | `passes model/status filter params to records API (F2)` | như trên |
| 4 | `AIUsageDashboard.component.test.js` | `renders usage chart from summary API (F1)` | như trên |
| 5 | `AIUsageDashboard.component.test.js` | `passes model/status filter params to summary + aggregate APIs (R1.5 AC6)` | như trên |
| 6 | `__tests__/ai-usage-chart-r16.component.test.ts` | `AC3: chart aria-hidden + bảng số .srOnly có số liệu` | `TypeError: Cannot read properties of null (reading 'clearRect')` |
| 7 | `__tests__/vnstock-chart-panel.data-unlock.component.test.ts` | `S4 — label i18n 'chartIndicators' co o CA vi.js va en.js` | `AssertionError: expected '// D3 (2026-11-13): barrel — moi name…' to match /chartIndicators:/` |

**Tần suất lỗi trong log:** `Cannot set properties of null (setting 'dpr')` × 6 · `Cannot read properties of null (reading 'clearRect')` × 1
⇒ **xác nhận gốc rễ**: zrender/echarts `CanvasRenderer` cần canvas thật, jsdom không có (không phải lỗi fixture sai).

**Số test đỏ 7 (3 file) vs 8 (full suite ở baseline `docs/evidence/full-vitest-vps-20261113/gates.md`):**
full-suite chạy 186 file còn 3-file chạy 32 test ⇒ thứ tự/isolation khác nhau; ở full suite có thêm
`renders the table with no rows when there are no records (Slice 3)` đỏ. **Con số đối chiếu chuẩn là full suite** (S0.5), không phải 3 file.

---

## 3. PASS-AFTER (VPS, commit có fix)

_(điền sau khi chạy)_

---

## 4. FULL SUITE (S0.5) — VPS

_(điền sau khi chạy)_

---

## 5. Đính chính Entry 474 (bắt buộc, ghi trong Entry 476)

`docs/evidence/full-vitest-vps-20261113/gates.md:27` ghi 7 test echarts là *"Lỗi môi trường, pre-existing trên snapshot này"*.
**SAI.** Đo lại ở B1/fail-before: lỗi do **regression D2** (`b3920f980` đổi import `AIUsageDashboard.tsx:11` từ `recharts`
sang shim `./charts/RechartsCompat` dùng `CanvasRenderer`) — file test **chạm cuối ở slice ai-r15/ai-r16**, nhưng
**import trong component** đổi ở D2 ⇒ jsdom không có canvas ⇒ đỏ. Sửa bằng mock shim có sẵn
(`packages/web/src/components/charts/__mocks__/RechartsCompat.tsx`). Không sửa lịch sử Entry 474 — đính chính bằng Entry mới.

---

## 6. Dọn dẹp

_(điền sau khi chạy)_
