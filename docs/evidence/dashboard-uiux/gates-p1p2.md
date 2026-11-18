# Gates — Dashboard wave 2 (P1+P2 + Q4), 2026-11-18

> Branch `feat/dash-p1p2-uiux` · base `dev @ 6aa570fa2` · revision cuối `261d7ef2a`.
> Plan `docs/PLAN_DASHBOARD_P1P2_20261118.md` · B3 `AUDIT_PLAN_P1P2_B3.md` (NEED_REVISION → B4 AGREE) · B8 `REAUDIT_P1P2_B8.md` (AGREE).

## 1. TDD fail-before → pass-after

| Lệnh | Kết quả |
|---|---|
| `cd packages/web && npx vitest run <3 file test wave2>` **trước** sửa code | **3 file fail / 14 test fail** — source contract đỏ đúng chỗ (`.seg nowrap`, title+summary concat, `<a href>`, heatmap header không wrap, `--dash-chrome` chưa định nghĩa, `handleClick` navigate thay vì mở dialog, `"No new notifications"`, `top-0 z-30`, breadcrumb/flag/search, nút `disabled: true`, tab hardcode, breadth helper chưa tồn tại, resize sai API). |
| sau khi sửa | **3 file pass / 18 test pass** + 7 file cũ liên quan pass (Header 7, heatmap-scale, smart-stats-cta, alert-card-compact 11, alert-list-20repro 2…). |

## 2. Gate tĩnh local

| Gate | Lệnh | Kết quả |
|---|---|---|
| Type-check | `npx tsc --noEmit` | exit **0** (sau khi bổ sung `useRealtimeContext` vào `RealtimeContext.d.ts` — fileDeclaration được TS ưu tiên hơn `.js`) |
| Lint | `npm run lint` | exit **0** — 0 errors, 4629 warnings (baseline repo) |
| Tokens | `npm run check:tokens` | PASS — 79 allowlisted, 0 violation |
| i18n | `npm run i18n:scan:strict` | exit 0 — chỉ warning `loadError` có sẵn |
| Lessons | `node scripts/check-lessons.mjs` | exit 0 — **60/60**, 14 file; C2 đầy nên bài học router đã ghi dạng checklist bổ sung trong `L-V04` (`docs/LESSONS/verification.md`) |
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | 0 lỗi, PASS |

## 3. VPS staging — full suite + build (ĐÃ CHẠY 2026-11-18)

Quy trình `docs/STAGING_VPS_RUNBOOK.md` §12.4: `git worktree add /tmp/wt-dash-p1p2 origin/feat/dash-p1p2-uiux`, tái dùng `node_modules` Linux (`corepack npm 11.18.0`), **không deploy đè staging**.

| Lệnh | Kết quả |
|---|---|
| `/usr/bin/corepack npm run test:components` @ `261d7ef2a` | **196 file / 1299 test · 1294 pass · 5 fail** — exit 1 |
| 5 fail | đúng 2 file SSE đã chứng minh fail sẵn trên `dev @ 577ddf646` (xem `gates.md` §4) ⇒ **0 hồi quy** |
| `/usr/bin/corepack npm run build` | exit **0** — `✓ built in 39.22s` |
| Dọn | `git worktree remove --force /tmp/wt-dash-p1p2` + `git worktree prune` — `git worktree list` chỉ còn 3 worktree cũ |

**2 regression thật do wave này gây ra, đã đóng:**

1. `c2a06706d` — 13 test AlertCenter + 2 test repro fail: `TypeError: Cannot destructure property 'basename' of useContext(...) as null` do `<Link>` render ngoài `<Router>`. Sửa tại `261d7ef2a` bằng bridge `useInRouterContext()` → `<Link>` trong app, `<a href>` fallback trong test. Đây là **lần 2** cùng dạng lỗi (lần 1: `useNavigate` ở SmartStatsHeader, P0 commit `2927ced2a`) — đã cập nhật checklist `L-V04`.
2. Sau fix: full suite về đúng 5 fail baseline, build vẫn xanh.

## 4. `--dash-chrome` — trạng thái số đo (M2 từ B8)

- Giá trị trong code: `--dash-chrome: 296px` (`packages/web/src/index.css:459`), dùng tại `:477` `max-height: min(720px, calc(100dvh - var(--dash-chrome)))`.
- **Nguồn số:** suy từ constant CSS (`Header` `h-18` = 4.5rem = 72px · `SmartStatsHeader` `py-2` + nội dung ~56px · heading + gaps/padding ~168px). Đây là **ước lượng có rationale**, KHÔNG phải số đo runtime.
- **CHƯA CHẠY:** đo computed style thực của `.core-dashboard-page` / `.dashboard-triad-lane` trên viewport cao 900px bằng Chromium (staging hoặc local browser) để xác nhận legend + hàng tile đáy nằm trong khung nhìn đầu. Chưa có số đo ⇒ **không báo PASS cho P1-4 về mặt thị giác**; cần visual QA (§5).

## 5. CHƯA CHẠY (không suy diễn)

- Visual QA / screenshot: heatmap popover, filter pills wrap, sticky offset, viewport 900px — cần mở ảnh ra xem (L-V05).
- E2E Playwright `/dashboard` + `/alert-center`.
- `check-a11y-runtime` cho dropdown gợi ý & popover mới.
- `npm run test` (jest).
- Deploy staging branch này lên shared env — không tự ý (đang chạy code `dev @ 7a0bd7aa7`).

## 6. Gate report của pre-push

`pre-push-gate` 4 FAIL / 32 PASS — cùng baseline đã document trong Entry 527 (`system-design`, `global-config-drift`, `envelope-contract`, `openapi-budget`); slice này FE-only, push dùng `--no-verify` với lý do ghi trong commit body theo quy định.
