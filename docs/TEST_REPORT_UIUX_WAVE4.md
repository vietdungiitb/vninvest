# TEST REPORT — UI/UX wave 4 (Stage 6)

Đo tại `feat/uiux-wave4`, base `dev` @ `ea0002d00`, ngày 2026-10-09.
Mọi dòng dưới đây đã **chạy thật**; exit code là exit code thật của lệnh đó.

> ⚠ Đọc `docs/AUDIT_UIUX_WAVE4.md` trước: 4 major phát hiện ở Stage 5 đã sửa và
> chạy lại gate. Bảng này là trạng thái **sau** khi sửa.

---

## 1. GATE CHÍNH (cwd = repo root)

| # | Lệnh | Exit | Kết quả thật |
|---|---|---|---|
| 1 | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | **0** | `TONG = 177  P0=0 P1=112 P2=63 P3=2` · **3–5 phút** |
| 2 | `… --self-test` | **0** | **5/5** (T1–T5) |
| 3 | `node packages/web/scripts/check-uiux-budget.mjs` | **0** | `baseline 2026-10-09 = 177, hien tai = 177 (+0)` · `NAV-1 = 104` |
| 4 | `… check-uiux-budget.mjs --self-test` | **0** | 1 trường hợp tăng bị bắt |
| 5 | `node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src` | **0** | `counted=104  escaped=7  tong=111` · 45 file |
| 6 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **0** | 0 trùng mới; 59 số trùng cũ giữ nguyên |
| 7 | `… check-ledger-entry.mjs --next-entry` | **0** | in **257** |
| 8 | `node packages/web/scripts/check-multi-agent.mjs` | **0** | 0 lỗi, 0 trùng migration · ~66 cảnh báo claim cũ |
| 9 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --self-test` | **0** | **8/8** (4 âm + 4 dương) |
| 10 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --gate` | **1** | ⚠ **XEM MỤC 3 — CÓ SẴN, không phải hồi quy** |
| 11 | `pwsh -File scripts/agent-sync.ps1` | **CHƯA CHẠY** | Stage 7, chạy sau rebase |

## 2. GATE `packages/web` (cwd = `packages/web`)

| # | Lệnh | Exit | Kết quả thật |
|---|---|---|---|
| 12 | `npx tsc --noEmit` | **0** | 0 error |
| 13 | `npm run lint` | **0** | **3754 problems / 0 error** (3743 ở `dev`, +11 warning mới — xem §5) |
| 14 | `npm run test:components` | **0** | **119 file / 844 test PASS** (`dev`: 117/817) |
| 15 | `npm run build` | **0** | `built in 48.70s` |
| 16 | `npm run check:tokens` | **0** | |
| 17 | `npm run check:contrast` | **0** | |
| 18 | `npm run check:dom-landmarks` | **0** | |
| 19 | `npm run check:ts-imports` | **0** | |
| 20 | `npm run check:i18n-hardcoded` | **0** | |
| 21 | `npm run check:admin-spa-routes` | **0** | |
| 22 | `npm run check:shell` | **0** | |
| 23 | `npm run i18n:scan:strict` | **0** | ⚠ gate này **mù** — xem §5 |
| 24 | `npx playwright test --project=mobile-ergonomics` | **0** | **2 passed** · `[h-scroll] 393 ≤ 393` · `[hit-area] undersized: none` |
| 25 | `python manage.py makemigrations --check --dry-run` | **N/A** | wave này **0 file `.py`** ⇒ không có migration |

## 3. GATE **ĐỎ** — báo cáo trung thực, không PASS

### G10 `check-h1-graph --gate` = exit 1

```
✗ check-h1-graph --gate — FAIL (1 vi phạm)
   [unreferenced-registry-entry] shell-ai-command-center
   (registry khai nhưng không route nào trong entry tham chiếu)
```

**Đây là lỗi CÓ SẴN, không phải do wave 4.** Bằng chứng:

```bash
git show dev:packages/web/src/pages/pageRegistry.js | Select-String "shell-ai-command-center"
# -> CO trong dev   (L201, giống hệt)
Select-String -Path packages/web/src/main.tsx -Pattern "shell-ai-command-center"
# -> không có route nào
```

`pageRegistry.js:201` khai `shell-ai-command-center` nhưng `main.tsx` không có
`<Route>` tương ứng. Script **tái hiện độc lập** một phát hiện đã ghi ở
`AGENTS.md` Entry 228 ("`ShellAiCommandCenterPage` không route").

**Cần Owner quyết**: nối route (mở tính năng AI Command Center trong shell) hay
gỡ entry khỏi registry. **Không tự quyết** — nằm ngoài phạm vi UI/UX.

## 4. `CHƯA CHẠY` — có lý do

| Mục | Lý do |
|---|---|
| Thiết bị thật, notch thật, focus ring khi chạm, tốc độ cuộn thật | Máy không có thiết bị. `env(safe-area-inset-*)` trả `0px` trong headless ⇒ **không kiểm chứng được bằng hành vi** |
| Safari iOS (`webkit`), `firefox` | **Không cài** — không chạy `npx playwright install` (deny non-goal) |
| **Mọi route cần đăng nhập** | `tests/visual/auth.setup.ts:5-30` login thật vào `vite preview` **không có backend** ⇒ project `setup` chết **trước thân test**. Không đo được bằng `vite preview` tĩnh |
| `scan-ui-guidelines` trên **worktree sạch** | `dist` bị gitignore (0 file tracked) ⇒ `vite preview` fail. Wave 4 chạy ở main tree, `dist` có sẵn |
| `pwsh -File scripts/agent-sync.ps1` | Stage 7, sau rebase |

## 5. SỐ TĂNG / GATE MÙ — không giấu

- **`lint`: 3743 → 3754** (+11 warning, **0 error**). Cả 11 đều ở file mới của
  wave 4 (`useUrlRecord.component.test.tsx`, 4 trang admin) và là loại
  `react/jsx-no-literals` vốn đã có 3581 lần. **Không** đụng warning cũ
  (non-goal 4).
- **`test:components`: 817 → 844** (+27 test, +2 file). Toàn bộ là test mới:
  `useUrlRecord.component.test.tsx` (20), `page-heading-ac3.component.test.tsx`
  (6), +1 test của `portfolio-deep-link-fu05`.
- **`TONG`: 172 → 177** — tăng **có chủ đích** vì rule NAV-1 nghiêm hơn. Chi tiết
  ở `AUDIT_UIUX_WAVE4.md` §5.
- **`i18n:scan:strict` là gate MÙ**: nó exit 0 kể cả khi key nằm sai chỗ
  (biểu hiện: `aria-label` render ra **chính chuỗi key**). Wave 4 **không** thêm
  chuỗi hiển thị mới (chỉ comment + `aria-label` không mới) ⇒ hạng mục này không
  phát sinh, nhưng **không** dựa vào gate này làm bằng chứng.

## 6. FAIL-TRƯỚC ĐÃ CHỨNG MINH (hazard 10)

Mọi thứ dưới đây dùng cách **an toàn**: copy file ra `%TEMP%` → `git show dev:<file>`
ghi đè → chạy → copy lại. **Không** dùng `git checkout --` (hazard 11).

| Thay đổi | Bằng chứng fail-trước |
|---|---|
| Major 2 (`replace`) | code `dev`: `expected 'PUSH' to be 'REPLACE'` + `expected '/p?search=HP' not to contain 'search='` ⇒ **2 failed**; code mới **7 passed** |
| Sửa 2× `<h1>` | `expected [ …(2) ] to have a length of 1 but got 2` (`/stocks/:symbol`) |
| Bộ test `<h1>` bắt mất h1 | bỏ `<h1>` ở `/upgrade` ⇒ `expected [] to have a length of 1 but got +0` — đúng cái `≤1` sẽ bỏ lọt |
| ID-3 (`replaceKeys`) | đưa bug về ⇒ `expected 'PUSH' to be 'REPLACE'` ×2 |
| T5 (self-test scanner) | bỏ lọc comment ⇒ `self-test FAIL 1/5`; **trước khi thêm T5 thì vẫn PASS 4/4** |
| Mobile 44×44 | auditor đo 7 control < 44 px trước khi sửa CSS (input 38 px, submit 36 px) |

## 7. KẾT LUẬN

`0 blocker` · `0 major` còn lại (`AUDIT_UIUX_WAVE4.md`) ·
`test:components` **0** · `check-uiux-budget` **0** ·
`check-h1-graph --gate` **1 vì lỗi có sẵn, đã báo cáo ở §3**.

Đủ điều kiện merge, **với điều kiện** `check-h1-graph --gate` được ghi nhận là
nợ có sẵn và cần Owner quyết riêng.