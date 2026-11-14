# PLAN — Thử nghiệm skill `soc-uiux` với kịch bản refactor UI/UX portfolio workspace

- **Scope**: slice refactor giao diện portfolio workspace (đủ lớn để exercising skill `soc-uiux`: token + contrast + light theme + table sticky + chart + i18n + visual baseline).
- **Date**: 2026-11-14.
- **Status**: CHUẨN BỊ SẴN — chưa khai claim; chờ Owner/agent thực thi. Claim gợi ý: `soc-uiux-trial`, branch `feat/soc-uiux-trial`.
- **Skill cần nạp**: `soc-uiux` (`.opencode/skills/soc-uiux/SKILL.md`) + `project-lessons` (planning gate, AGENTS.md §11) + `workflow-dev-loop` (9 bước).
- **Bằng chứng baseline đã đo 2026-11-14** (trên cây hiện tại, docs-only không đổi source):
  - `npm run check:tokens` → PASS (79 allowlisted hex, 0 violations)
  - `npm run check:contrast` → PASS (7 tone × 2 mode)
  - `npm run check:dom-landmarks` → PASS
  - `npm run check:i18n-hardcoded` → PASS (0 chuỗi tiếng Việt cứng trong 19 file)
  - `node scripts/check-uiux-budget.mjs` → **CHƯA CHẠY** (timeout 2×, không có output — ghi CHƯA CHẠY theo L-007; không suy ra)

---

## 1. Vì sao chọn slice này (đủ lớn, có bài học thật)

- **Diện tích**: 9 trang/component chính (~2.000 dòng JSX/TSX + 1.246 dòng CSS) + chart contract ECharts — đủ để exercising cả 7 phần của skill, không phải một component đơn lẻ.
- **Bài học đã trả giá tại chính surface này**: L-F12 (bảng 9 cột 1377px > container 1202px, sticky column nền sai ở dark theme → Entry 391/W1) — refactor sticky đúng chuẩn là mục tiêu rõ ràng.
- **Gate coverage**: chạm `check:tokens`, `check-portfolio-contrast` (đọc thật `soc.tokens.css`), `check-light-theme`, `check:dom-landmarks`, `check-heading-contract`, `check:i18n-hardcoded`, `check-uiux-budget`, `test:visual` (Playwright baseline) — gần như toàn bộ bản đồ gate §2 của skill.
- **Chart**: `PortfolioChart.tsx` dùng ECharts (S-03) — exercising chạm #3 (chart type + a11y fallback + ngưỡng dữ liệu).

## 2. Files trong scope

| File | Dòng | Vai trò |
|---|---|---|
| `src/pages/portfolio/PortfolioHoldingsPage.tsx` | 341 | Holdings table — L-F12 sticky |
| `src/pages/portfolio/PortfolioAnalyticsPage.tsx` | 207 | Chart + KPI |
| `src/pages/portfolio/PortfolioAllocationPage.tsx` | 119 | Phân bổ |
| `src/pages/portfolio/PortfolioActivityPage.tsx` | 133 | Hoạt động |
| `src/pages/portfolio/PortfolioOverviewPage.tsx` | 143 | Tổng quan |
| `src/pages/portfolio/PortfolioWorkspace.tsx` | 105 | Workspace shell |
| `src/pages/portfolio/PortfolioWorkspacePage.tsx` | 74 | Workspace page |
| `src/pages/portfolio/manage/PortfolioManageTable.tsx` | 206 | Bảng quản lý |
| `src/pages/portfolio/manage/PortfolioManageDrawer.tsx` | 518 | Drawer |
| `src/pages/portfolio/manage/PortfolioManageKpi.tsx` | 89 | KPI |
| `src/pages/portfolio/manage/PortfolioFormDialog.tsx` | 172 | Form dialog |
| `src/components/portfolio/PortfolioChart.tsx` | ? | ECharts contract |
| `src/pages/portfolio/PortfolioWorkspace.css` | 666 | CSS workspace |
| `src/pages/portfolio/manage/portfolioManage.css` | 580 | CSS manage |
| `src/pages/portfolio/format.ts` | 168 | Format helpers |

Tổng ~2.500+ dòng JSX/CSS. **Không đụng** `soc.tokens.css`/`soc.components.css` (SSOT không đổi trong slice này — chỉ tiêu thụ).

## 3. Acceptance criteria (mỗi AC = 1 lệnh chạy được)

1. **Token**: `npm run check:tokens` + `node scripts/check-token-conflict.mjs` xanh — mọi hex mới (nếu có) phải vào allowlist qua Owner.
2. **Contrast**: `npm run check:portfolio-contrast` + `npm run check:theme-contrast` xanh — cả 2 theme.
3. **Light theme**: `npm run check:light-theme` xanh — không còn property-scoped override thiếu.
4. **DOM landmarks + heading**: `npm run check:dom-landmarks` + `node scripts/check-heading-contract.mjs` xanh — page không tự render `<h1>`.
5. **i18n**: `npm run i18n:scan:strict` + `npm run check:i18n-hardcoded` xanh — label tiếng Việt đủ dấu qua `LangContext`.
6. **Ngân sách**: `npm run check:uiux-budget` không tăng findings (nếu CHƯA CHẠY thì ghi CHƯA CHẠY — không suy ra).
7. **Visual**: `npm run test:visual` — ảnh baseline mới phải có chủ đích, ghi lý do trong PR.
8. **Type-check**: `npx tsc --noEmit` xanh.
9. **Lint**: `npm run lint` xanh (0 errors).
10. **A11y runtime** (nếu đổi layout lớn): `node scripts/check-a11y-runtime.mjs` (cần Chromium).
11. **Playbook skill**: mỗi chạm §3 của skill phải được ghi trong PR (pattern greenfield? → portfolio là refactor, không greenfield — ghi rõ "không áp dụng chạm 1"), tra cứu UX (chạm 2) ≥1 rule tham chiếu, chart (chạm 3) ≥1 rule tham chiếu.

## 4. Cách dùng skill trong slice (đúng thứ tự)

1. **Planning gate** (AGENTS.md §11): nạp `project-lessons` với `taskDescription` + `filePaths` + `actions`; ghi `Lessons áp dụng: [L-...]` hoặc `NONE – <lý do>`.
2. **Nạp `soc-uiux`** — đọc §1 (SSOT) trước khi viết dòng đầu tiên.
3. **Claim** vào `docs/CLAIMS.md` (key gợi ý `soc-uiux-trial`) **TRƯỚC** dòng đầu tiên (L-002).
4. **Đo trước code** (fail-before): chạy toàn bộ AC §3 để có baseline gate (gates hiện đang xanh — ghi CHƯA CHẠY cho budget).
5. **Refactor theo checklist §4 của skill**, anti-pattern §6 (đặc biệt L-F12 bảng sticky, L-F11 đọc CSS build trước khi kết luận class).
6. **Re-audit**: chạy lại gate sau rebase (thứ tự rebase → migration → gate, L-003).
7. **Bàn giao**: Entry ledger + claim done + PR qua `agent-pr.ps1`.

## 5. Đo hiệu quả skill (để trả lời "có cần thiết không")

| Metric | Cách đo | Mục tiêu |
|---|---|---|
| Gate xanh first-run | Số gate trong §3 pass ngay lần chạy đầu sau refactor | ≥8/11 |
| Token drift | Số hex mới thêm vào allowlist | 0 (hoặc Owner duyệt rõ) |
| Section references | Số mục § của skill được trích trong PR | ≥3 |
| UX rule references | Rule từ `--domain ux` được tham chiếu | ≥1 |
| Chart rule references | Rule từ `--domain chart` được tham chiếu | ≥1 |
| Visual diff chủ đích | Ảnh baseline thay đổi có giải thích | Có |
| Thời gian | Từ claim đến PR ready | Ghi lại để so sánh slice tương tự trước skill |

**Control (không bắt buộc)**: nếu Owner muốn so sánh, chạy 1 slice cùng loại **không** nạp skill và so 2 metric đầu — nhưng tốn gấp đôi công. Khuyến nghị: không control, chỉ đo first-run gate xanh vs baseline "sai lầm đã từng mắc" (L-F12, L-F11) — nếu slice tránh được đúng những lỗi đó thì skill có giá trị.

## 6. STOP conditions (không tự ý vượt)

- Cần sửa `soc.tokens.css`/`soc.components.css` (SSOT) → dừng, claim riêng + Owner duyệt.
- Cần thêm hex vào allowlist → Owner duyệt, không tự nới.
- Phát hiện rò rỉ ngoài scope (security/i18n cross-tenant) → báo, không tự mở rộng.
- AC nào fail sau 2 lần sửa → có thể finding gốc sai, dừng và báo.
- Cần migration BE → dừng (slice này FE-only).

## 7. Rủi ro & những gì CHƯA xác minh

- `check-uiux-budget` **CHƯA CHẠY** (timeout) — baseline 327 findings lấy từ header script, chưa đo lại. Nếu slice này chạy gate thành công thì ghi vào evidence.
- `check-a11y-runtime` cần Chromium — nếu chưa cài thì ghi CHƯA CHẠY (L-007).
- Playwright visual baseline update cần `--update-snapshots` — phải là quyết định có chủ đích, không chạy ngầm.
- Effort ước tính 1–2 ngày cho 1 agent FE; nếu chạy song song nhiều agent thì phải claim trước và tuân L-001 (không đụng file agent khác).

## 8. Next

1. Owner/agent thực thi theo §4 — slice này là **thử nghiệm skill**, không phải deliverable production.
2. Sau khi merge PR slice, cập nhật `docs/AUDIT_UIUX_PRO_MAX_SKILL_APPLICABILITY_20261114.md` §H/§I với kết quả đo §5 (giữ hay thả skill).
3. Nếu slice thành công → cân nhắc áp dụng cùng playbook cho các surface khác; nếu không → `uipro uninstall` và giữ skill repo `soc-uiux` (nó vẫn là bản đồ gate, không phụ thuộc catalog ngoài).
