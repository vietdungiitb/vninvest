# Full vitest suite trên VPS staging — 2026-11-13

> **Chạy theo:** `docs/STAGING_VPS_RUNBOOK.md` §12.4 (FE trên VPS) · **Claim:** `full-vitest-vps`
> **Lý do:** full suite local OOM (`FATAL ERROR: JavaScript heap out of memory`, 182/183 file, output cụt không quy kết được) + runbook **CẤM** chạy suite local. VPS: 23G RAM (trống 16G), node qua corepack `npm 11.18.0`.

## 1. Cách chạy (lệnh tái hiện)

```bash
# Trên VPS (worktree tạm, KHÔNG checkout đè /opt/vninvest):
cd /opt/vninvest && git fetch origin dev --quiet
git worktree add /tmp/wt-fullvitest origin/dev          # = edc314445 lúc chạy
cd /tmp/wt-fullvitest/packages/web && /usr/bin/corepack npm ci   # exit 0 (Linux, không copy node_modules Windows)
/usr/bin/corepack npm run test:components > /tmp/wt-fullvitest.log 2>&1   # vitest run, nohup nền
# Dọn sau khi lấy log: git worktree remove --force /tmp/wt-fullVITest + prune (+ xóa log /tmp)
```

## 2. Kết quả (chạy thật, log đầy đủ 256KB — không cụt như local)

- **Test Files: 3 failed | 183 passed (186)**
- **Tests: 8 failed | 1243 passed (1251)** · Duration 75s · exit 1
- `Errors 6 errors` = unhandled rejections của lỗi canvas (dưới)

### 8 test đỏ (danh sách đầy đủ)

| # | File | Test | Nguyên nhân (xác minh) |
|---|---|---|---|
| 1-6 | `src/components/AIUsageDashboard.component.test.js` | Slice 3 ×3, F2, AC6, F1 | `TypeError: Cannot set properties of null (setting 'dpr')` — zrender/echarts khởi tạo canvas trên jsdom (không có canvas thật). File chạm lần cuối ở slice ai-r15/ai-r16 (`d1c7344e7`, `997540322`), **không liên quan** sidebar/widget/B-1. Lỗi môi trường, pre-existing trên snapshot này. |
| 7 | `src/components/__tests__/ai-usage-chart-r16.component.test.ts` | AC3 chart aria-hidden + bảng số | Cùng họ echarts-canvas (file của slice ai-r16, không thuộc slice nào của phiên này). |
| 8 | `src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` | S4 `chartIndicators` ở **cả** vi.js và en.js | Slice uiux **D3** (2026-11-13) tách i18n thành `locales/vi\|en/<ns>.js` → key DỜI sang `locales/vi/stockDetail.js:2` (`chartIndicators: 'Chỉ báo'`) + `locales/en/stockDetail.js:2` (`'Indicators'`); `vi.js`/`en.js` giờ chỉ còn barrel import (8193 byte, không chứa key) → assert vị trí cũ của S4 đỏ. **Key vẫn tồn tại (user không ảnh hưởng)** — chỉ test stale. Thuộc claim i18n của session D3 → **không tự sửa** (file shared, ngoài scope). Đã ghi ticket ở §4. |

### Quy kết cho các slice của phiên này

- **sidebar-spa-nav** (PR #360): chỉ sửa `Sidebar.tsx` onClick + 1 test mới — 4/4 test của slice **xanh** trong run này (không nằm trong 8 đỏ). Không liên quan 8 lỗi trên.
- **W-I / W-K** (PR #351/#355): S19/S20/S21 + characterization + mapper **xanh** trong run này; S4 đỏ là do D3 merge **sau** (file i18n dời chỗ), không phải do code các slice đó.
- **B-1** (PR #357): BE-only, không nằm trong FE suite.

## 3. Dọn dẹp

- `/tmp/wt-fullvitest` (worktree + node_modules Linux ~700MB trên tmpfs) đã **xóa** sau khi lấy log (npm ci lại chỉ mất ~5-10 phút nếu cần chạy lại).
- Log đầy đủ đã thu excerpt vào file này; bản full 256KB **không** commit vào repo (nhiễu), đã xóa khỏi VPS cùng worktree.

## 4. Việc còn lại (ticket cho session khác)

1. **Session D3/uiux**: cập nhật S4 (hoặc dời assert sang `locales/vi|en/stockDetail.js`) — key còn nguyên, chỉ vị trí đổi. File test `vnstock-chart-panel.data-unlock...` hiện do nhiều slice cùng sửa → phối hợp qua claim trước khi đụng.
2. **Echarts canvas trên jsdom** (7 test AIUsageDashboard + ai-usage-chart-r16): hoặc mock canvas (`vitest-canvas-mock`/setup), hoặc đánh dấu skip có lý do + đo lại trên browser thật. Không thuộc slice nào đã merge trong phiên này.
3. Muốn gate full-suite xanh hoàn toàn cho `dev`: chạy lại suite này **sau** khi (1)+(2) xong, vẫn trên VPS.
