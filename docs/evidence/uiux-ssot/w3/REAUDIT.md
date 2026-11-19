# B8 RE-AUDIT — W3 Command Density (`uiux-cmd-w3`)

- **Ngày**: 2026-11-19 · **Repo**: `D:/Mujoco Projects/uiux-cmd-w3` · **Branch**: `feat/uiux-cmd-w3` · **HEAD**: `b6fb956c6`.
- **Vai trò**: auditor độc lập, read-only (session khác người viết code/plan). Không sửa code/plan/claim, không claim, không commit/push/deploy.
- **Scope**: `docs/PLAN_UIUX_W3_COMMAND_DENSITY_20261119.md` + 5 mục kiểm chứng B8. **Không mở lại O-01..O-31**.
- **Chỉ ghi 2 file**: `docs/evidence/uiux-ssot/w3/REAUDIT.md` (file này) + `## Entry 556` trong `docs/CODE_CHANGE_AUDIT_LEDGER.md`.

## VERDICT: `AGREE` — 0 blocker, 0 major → cho phép B9

Kèm 3 reservation minor (O-32/O-33/O-34) do coordinator đóng ở B9. Không có objection nào chặn B9.

## 1. Git state + scope

| Kiểm chứng | Lệnh tái tạo | Kết quả thật |
|---|---|---|
| Working tree | `git status --short` | Có **1 file untracked**: `docs/evidence/uiux-ssot/w3/green2.md` → KHÔNG sạch (xem O-34) |
| Branch | `git rev-parse --abbrev-ref HEAD` | `feat/uiux-cmd-w3` |
| HEAD 5 commit | `git log --oneline -5` | `b6fb956c6` (fix cast HTMLSelectElement) · `7e30a780f` (feat registry/palette 1 lan/SettingsProvider) · `5b2334a29` (chore claim) · `6e1c36d75` (merge PR #437 uiux-exp-w2) · `24d321d43` (close uiux-exp-w2) |
| Diff scope | `git diff --stat origin/dev..HEAD` | 10 file, 220 insertions, 78 deletions: `docs/CLAIMS.md`, `docs/evidence/uiux-ssot/w3/green.md`, `AppCommandPalette.tsx`, `CommandRegistry.tsx`, `TenantAdminCommandPalette.tsx`, `TenantAdminLayout.tsx`, `uiux-cmd-w3.component.test.tsx`, `SettingsProvider.tsx`, `FullLayout.tsx`, `UserSettingsPage.tsx` |
| Baseline không đổi | `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` | **rỗng** (0 dòng). Không nâng baseline, không `--write-baseline` |
| Dependency/package | `git diff --name-only origin/dev..HEAD` | **Không có** `package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml`, `docker-compose*` → đúng plan `docs/PLAN_UIUX_W3_COMMAND_DENSITY_20261119.md:17` |
| Claim | `docs/CLAIMS.md:1994` | Dòng `uiux-cmd-w3` vẫn `in-progress` (đúng B8, claim chưa đóng) |

## 2. Code theo đúng scope kiểm chứng

- **Registry**: `packages/web/src/components/CommandRegistry.tsx:15-20` — 4 entry global (`/dashboard`, `/portfolios`, `/alert-center`, `/settings/ai`). `:23-39` — đúng 15 entry tenant-admin. `subject` CASL xuất hiện ở `:25-32,34-38` (11 entry). Đối chiếu `git show origin/dev:packages/web/src/components/TenantAdminCommandPalette.tsx` — 15 entry + 11 subject **giữ nguyên**, action filter `"read"` không đổi.
- **Palette**: `packages/web/src/components/AppCommandPalette.tsx:5` import `ALL_COMMANDS`; `:35-38` lọc theo `ability.can("read", entry.subject)`; `:41` có `data-testid="app-command-palette"` + `role="dialog"`, `aria-modal="true"`. Comment `:7-11` ghi rõ mount duy nhất.
- **Mount 1 lần**: `packages/web/src/layouts/full/FullLayout.tsx:7` import + `:122` `e(AppCommandPalette)` — grep `AppCommandPalette|TenantAdminCommandPalette` toàn `packages/web/src` chỉ ra **1** lần mount (`FullLayout.tsx:122`). `TenantAdminLayout.tsx:76-92` **không** có import/mount palette (chỉ comment `:89`). `TenantAdminCommandPalette.tsx:1-2` **chỉ là re-export compat** 2 dòng.
- **Route**: `packages/web/src/main.tsx:158` route `/` dùng `AppShell`; `:230` route `tenant-admin` là con của `/`; `packages/web/src/layouts/AppShell.tsx:1,8` → `FullLayout`. Vậy `/tenant-admin/*` nằm trong FullLayout ⇒ đúng 1 listener Cmd+K (không mất palette khi xoá mount cũ).
- **Density**: `packages/web/src/context/SettingsProvider.tsx:6` khoá `vninvest-density`; `:15-21` đọc localStorage có try/catch; `:24-35` provider (pattern `LangContext`), `:27` ghi `data-density` lên `document.documentElement`, `:29` persist; `:38-42` `useSettings`. `packages/web/src/pages/UserSettingsPage.tsx:8` import, `:90` dùng `useSettings()`, `:210-215` select density dùng `(ev.target as HTMLSelectElement).value` — đúng yêu cầu.
- **Guard theme W0 không bị ghi đè**: `UserSettingsPage.tsx:21-28` `applyUserTheme` vẫn kiểm `isDevThemeFlagActive()` ở `:24` và chỉ xoá `data-theme`; `SettingsProvider.tsx:27` chỉ ghi `data-density`, không đụng `data-theme`.
- **Nguồn density duy nhất**: grep `vninvest-density|data-density|useSettings|SettingsProvider` toàn `src` cho thấy state global/persist chỉ có ở `SettingsProvider.tsx`. Local state cũ ở `WatchlistMainWorkspace.tsx:145` xem O-33.

## 3. Gate — exit code thật (chạy từ `packages/web`)

| Lệnh | Exit code | Kết quả |
|---|---|---|
| `node node_modules/vitest/vitest.mjs run src/components/__tests__/uiux-cmd-w3.component.test.tsx` | **0** | `Test Files 1 passed (1)` · `Tests 3 passed (3)` (v4.1.9, 4.00s) |
| `node scripts/check-tokens.mjs` | **0** | PASS (79 allowlisted hex, 0 violations outside) |
| `node scripts/check-contrast.mjs` | **0** | PASS (7 tone pairs × 2 modes >= 4.5:1) |
| `node scripts/check-theme-contrast.mjs` | **0** | PASS (2 CONTROL 21.00:1 / 4.48:1 OK; 26 baseline vi phạm đã hết) |
| `node scripts/check-token-conflict.mjs` | **0** | 0 vi phạm hiện tại, baseline 0 |
| `node scripts/check-light-theme.mjs` | **0** | OK — mọi màu đều được phủ ở light mode |
| `node scripts/check-heading-contract.mjs` | **0** | PASS (exit 0; output có 1 dòng tham chiếu `AuthResetPasswordPage.tsx:122`, không làm gate fail) |
| `node scripts/check-focus-ring.mjs` | **0** | PASS |
| `node scripts/check-dom-landmarks.mjs` | **0** | PASS (static gate) |
| `node scripts/check-portfolio-contrast.mjs` | **0** | PASS (12 cap × 2 theme >= 4.5:1) |

Test `src/components/__tests__/uiux-cmd-w3.component.test.tsx:16-23` kiểm mount bằng source-regex (`e\(AppCommandPalette\)` = 1; `TenantAdminLayout` không chứa palette); `:25-30` kiểm 4 global + 15 tenant + subject; `:32-39` kiểm `data-density` đổi và giữ state. Đây là kiểm chứng tĩnh cho mount, không phải render router runtime — xem mục CHƯA CHẠY (Playwright/E2E).

## Objections (minor — không chặn B9)

- **O-32 (minor)** — `packages/web/src/pages/UserSettingsPage.tsx:210-213` dùng 4 key `userSettings.density`, `densityComfortable`, `densityCompact` với `defaultValue` tiếng Việt, nhưng `packages/web/src/i18n/locales/vi/userSettings.js:1-14` và `packages/web/src/i18n/locales/en/userSettings.js:1-14` **không có** các key này. Ở locale EN, 4 nhãn density vẫn hiện tiếng Việt. Plan `docs/PLAN_UIUX_W3_COMMAND_DENSITY_20261119.md:29` (Review Focus 5) yêu cầu "key mới đủ VI/EN" — chưa đạt. Đề xuất: thêm 4 key vào cả 2 module `locales/{vi,en}/userSettings.js`; không chặn vì fallback `defaultValue` vẫn render và đây là pattern có sẵn trong file.
- **O-33 (minor, thông tin)** — `packages/web/src/pages/watchlist/components/WatchlistMainWorkspace.tsx:145` vẫn có local state density (`useState("compact"|"comfortable")`) truyền vào `WatchlistTable` (`:356`). Code cũ, **không nằm trong diff slice**; nguồn state density global/persist vẫn duy nhất tại `SettingsProvider.tsx`. Đề xuất coordinator quyết định unify ở slice sau; không chặn.
- **O-34 (minor)** — `git status --short` có 1 file untracked `docs/evidence/uiux-ssot/w3/green2.md` (implementer chạy green lần 2 nhưng chưa commit). Không ảnh hưởng code đã commit. Đề xuất: commit hoặc xoá trước khi đóng claim.

## Kiểm tra encoding trước khi ghi

Ledger trước khi ghi: `U+FFFD=0` · `CJK=0` · `EndsLF=true` (đếm bằng `[System.IO.File]::ReadAllText` + vòng lặp char code, không round-trip PowerShell).

## CHƯA CHẠY

Staging VPS `14.225.255.47` / `https://docker.edusuccess.vn` · deploy & verify · Playwright 375px/1440px (Review Focus 4: overflow bảng 9 cột) · E2E Cmd+K runtime trên `/tenant-admin/*` · full `vitest` · `npx tsc --noEmit` · `npm run build` · `npm run lint` · `i18n:scan:strict` · `check-uiux-budget` · `check-a11y-runtime` · `node packages/web/scripts/check-multi-agent.mjs`. Không suy ra kết quả cho các hạng mục này.

## Next steps / owner

1. Coordinator (Owner): đóng O-32/O-33/O-34 ở B9 theo lựa chọn ở trên.
2. Implementer: dọn file untracked `green2.md`; cập nhật claim `uiux-cmd-w3` → `done`; prepend Entry (auditor đã ghi Entry 556); push; mở PR; cleanup.
3. Chạy staging/Playwright/E2E theo runbook trước khi coi slice hoàn tất.
