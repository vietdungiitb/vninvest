# HANDOFF — Full vitest suite trên VPS staging (2026-11-13)

> **Ngày:** 2026-11-13 · **Phạm vi:** chạy toàn bộ FE suite (`npm run test:components`) trên VPS staging theo runbook §12.4
> **Nhánh:** `feat/full-vitest-vps` → `dev` (PR #366, merged `833741fa`) · closeout `feat/fullvitest-handoff` (file này)
> **Worktree:** `D:/Mujoco Projects/vninvest-wt-fullvitest` (riêng — không làm trên worktree chính)

## 1. Trạng thái

| Item | Trạng thái | Evidence |
|---|---|---|
| Full suite VPS | **chạy xong** — 8 đỏ / 1243 xanh, exit 1 (KHÔNG xanh) | log VPS `/tmp/wt-fullvitest.log` (256KB, đã thu excerpt, đã xóa) |
| Claim `full-vitest-vps` | **done** | `docs/CLAIMS.md` |
| Ledger | **Entry 474** (đổi từ 473 vì `dev` đã có 473 của session khác — lịch sử họ giữ nguyên) | `docs/CODE_CHANGE_AUDIT_LEDGER.md:1` |
| Evidence | `docs/evidence/full-vitest-vps-20261113/gates.md` | lệnh tái hiện + kết quả + quy kết + việc còn lại |

## 2. Kết quả (chạy thật, log đầy đủ — không cụt như local)

- **Test Files: 3 failed | 183 passed (186)** · **Tests: 8 failed | 1243 passed (1251)** · Duration 75s.
- 8 đỏ = **7 echarts-canvas** (`AIUsageDashboard` ×6 + `ai-usage-chart-r16` AC3 — zrender `dpr` null trên jsdom; file của slice ai-r15/ai-r16, pre-existing) + **1 S4 stale** (`chartIndicators` dời sang `locales/vi|en/stockDetail.js:2` sau D3 split; key vẫn tồn tại, user không ảnh hưởng).
- Test của sidebar-spa-nav (4/4), W-I, W-K **xanh** · B-1 BE-only không nằm trong FE suite · không slice nào của phiên này gây đỏ.
- `check-multi-agent` 0 lỗi · `check-ledger-entry` FAIL do trùng Entry 386 PRE-EXISTING (Entry 474 xuất hiện 1 lần).
- **CHƯA CHẠY:** E2E trình duyệt thật.

## 3. Việc còn lại + owner

| Việc | Owner |
|---|---|
| D3 cập nhật S4 theo vị trí key mới (khai claim trước — file test nhiều slice cùng sửa) | session D3/uiux |
| Echarts-canvas jsdom (mock/skip + đo browser thật) | session FE |
| Chạy lại suite trên VPS sau khi 2 ticket xong (npm ci ~5-10 phút) | ai chạy cũng được, theo §12.4 |
| Re-baseline gate trùng 386 + ticket `secret-scan` facts20.json | coordinator + session `staging-pro-layout` |

## 4. Bài học vòng kín (phiên này)

1. **Worktree riêng cho mọi thay đổi** — kể cả docs-only (vi phạm ở slice sidebar trước đó, đã sửa từ slice này).
2. **Trùng số Entry khi rebase**: session khác chiếm 473 trước → Entry của mình đổi thành 474, lịch sử họ giữ nguyên, không `--skip`, không đoán số mới (lấy `--next-entry` sau rebase).
3. **Không tin exit code của probe**: probe phải inject lỗi thật (mutation check T4) — đã bắt được 1 xanh giả trong phiên sidebar.
4. **Badge "PASS" chỉ dán cho thứ chạy thật trên đúng code sau rebase** — full suite local OOM không được tính là gate.
