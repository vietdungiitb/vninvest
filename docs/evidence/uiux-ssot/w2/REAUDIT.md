# B8 RE-AUDIT — W2 Experience (`uiux-exp-w2`)

- **Ngày**: 2026-11-19 · **Repo**: `D:/Mujoco Projects/uiux-exp-w2` · **Branch**: `feat/uiux-exp-w2` · **HEAD**: `cc6459f06`.
- **Vai trò**: auditor độc lập, read-only (session khác người viết code/plan). Không sửa code/plan/claim, không commit/push/deploy.
- **Scope**: chỉ `docs/PLAN_UIUX_W2_EXPERIENCE_20261119.md` (rev2) + 6 mục kiểm chứng của yêu cầu B8. **Không mở lại O-01..O-30** (đã đóng ở W0/W1).
- **Chỉ ghi 2 file**: `docs/evidence/uiux-ssot/w2/REAUDIT.md` (file này) + `## Entry 555` trong `docs/CODE_CHANGE_AUDIT_LEDGER.md`.

## VERDICT: `AGREE` — 0 blocker, 0 major → cho phép B9

Kèm 3 reservation minor (O-31a/b/c) do coordinator đóng ở B9. Không có objection nào chặn B9.

## 1. Git state + scope

| Kiểm chứng | Lệnh tái tạo | Kết quả thật |
|---|---|---|
| Working tree | `git status --short` | Có **1 file untracked**: `docs/evidence/uiux-ssot/w2/green2.md` → KHÔNG sạch (xem O-31b) |
| HEAD 6 commit | `git log --oneline -6` | `cc6459f06` (fix import), `15108683d` (claim), `21e25bcfc` (FreshnessBadge + DESIGN.md), `9ad677810` (merge uiux-a11y-w1), `5f06e4a0b`, `f5d20b15e` |
| Branch | `git rev-parse --abbrev-ref HEAD` | `feat/uiux-exp-w2` |
| Diff scope | `git diff --stat origin/dev..HEAD` | 7 file, 273 insertions, 12 deletions: `docs/CLAIMS.md`, `docs/evidence/uiux-ssot/w2/green.md`, `packages/web/.impeccable/design.json`, `packages/web/DESIGN.md`, `.../__tests__/uiux-exp-w2.component.test.tsx`, `.../feedback/FreshnessBadge.tsx`, `.../workstation/StockOrderBookWidget.jsx` |
| File S3 không bị đụng | `git diff --name-status origin/dev..HEAD` | Không có `CoreDashboardPositionDeck.tsx` / `PortfolioHoldingsPage.tsx` → đúng plan `docs/PLAN_UIUX_W2_EXPERIENCE_20261119.md:15` |

## 2. FreshnessBadge + StockOrderBookWidget

- `packages/web/src/components/feedback/FreshnessBadge.tsx:3` — `FreshnessState = "fresh"|"delayed"|"stale"|"empty"` (đủ 4 trạng thái).
- `:14-16` — `data-testid` theo state, **`data-state`**, **`data-note`** (note là prop tuỳ chọn). `:17` `title: note`.
- `:6-10` — props `{ state, label, note }`; `:30` render `label` do caller truyền. Component **không import i18n, không hardcode text** → đúng yêu cầu.
- `:19-28` — style inline có hex `#34d399`/`#fbbf24`; cả 2 nằm trong allowlist `packages/web/scripts/check-tokens.mjs:15,16`. Đây là style, không phải nội dung i18n.
- `packages/web/src/components/workstation/StockOrderBookWidget.jsx:4` — `import { FreshnessBadge } from "../feedback/FreshnessBadge";` **không extension** → Vite resolve `.tsx` (xác nhận bởi vitest chạy xanh, mục 4).
- `StockOrderBookWidget.jsx:155-164` — thay `<span className="ob-estimated-badge">` thô bằng `e(FreshnessBadge, {...})`; map `unavailable → state:"empty", note:"backend_missing"`, còn lại `state:"delayed", note:"estimated_from_snapshot"`; label vẫn lấy qua `t(...)` của caller. Không còn style badge hardcode trong widget.
- `packages/web/src/components/__tests__/uiux-exp-w2.component.test.tsx:7-15` chỉ assert 3 state `fresh|delayed|stale` (chưa assert `empty`) → xem O-31c (minor, component vẫn đúng).

## 3. DESIGN.md + sidecar

- `packages/web/DESIGN.md:1-50` — YAML frontmatter (`name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`); kết thúc `---` ở `:50`.
- 8 section canonical, **đúng thứ tự**: `## Overview` `:54` · `## Colors` `:66` · `## Typography` `:84` · `## Layout` `:96` · `## Elevation & Depth` `:100` · `## Shapes` `:104` · `## Components` `:108` · `## Do's and Don'ts` `:122`. Không section thừa/thiếu.
- North Star `**Creative North Star: "The Trading Cockpit"**` ở `DESIGN.md:56`; lặp lại nhất quán trong sidecar `.impeccable/design.json:50`.
- Đối chiếu **từng hex** trong `DESIGN.md` với allowlist `packages/web/scripts/check-tokens.mjs:10-29`:

| Hex | Vị trí | Allowlist | Ghi chú |
|---|---|---|---|
| `#06b6d4` | `DESIGN.md:5,71` | CÓ (`:11`) | accent cyan |
| `#0e7490` | `DESIGN.md:6,71,76` | CÓ (`:14`) | accent light |
| `#0b1424` | `DESIGN.md:7,74` | **KHÔNG** | token `--pf-surface` có sẵn tại `packages/web/src/components/soc/soc.tokens.css:46` → xem O-31a |
| `#0f172a` | `DESIGN.md:8,75` | CÓ (`:18`) | surface panel |
| `#f1f5f9` | `DESIGN.md:9,76` | CÓ (`:20`) | text primary |
| `#94a3b8` | `DESIGN.md:10,76` | CÓ (`:20`) | text muted |
| `#475569` | `DESIGN.md:11,76` | CÓ (`:21`) | text muted light |
| `#34d399` | `DESIGN.md:12,80` | CÓ (`:15`) | gain |
| `#f87171` | `DESIGN.md:13,80` | CÓ (`:17`) | loss |

- Các `rgba(...)` (`DESIGN.md:14-15,77,106`) không phải hex → không thuộc diện allowlist hex.
- Sidecar `.impeccable/design.json`: hex dùng `:7` `#06b6d4`, `:8` `#34d399`, `:9` `#f87171`, `:10` `#0f172a`, `:31` `#f1f5f9`, `:39` `#94a3b8`/`#f1f5f9`, `:46` `#fbbf24` — **tất cả có trong allowlist** (`check-tokens.mjs:11,15,17,18,16,20,16`).
- `node -e "JSON.parse(...)"` → exit **0**; `schemaVersion` = **2** (`:2`); `components` = 3 (`:24-48`), mỗi component đều có `html` + `css` self-contained (`:30-31`, `:38-39`, `:45-46`).

## 4. Gate — exit code thật (chạy từ `packages/web`)

| Lệnh | Exit code | Kết quả |
|---|---|---|
| `node node_modules/vitest/vitest.mjs run src/components/__tests__/uiux-exp-w2.component.test.tsx` | **0** | `Test Files 1 passed (1)` · `Tests 2 passed (2)` (v4.1.9) |
| `node scripts/check-tokens.mjs` | **0** | PASS |
| `node scripts/check-contrast.mjs` | **0** | PASS |
| `node scripts/check-theme-contrast.mjs` | **0** | PASS |
| `node scripts/check-token-conflict.mjs` | **0** | PASS |
| `node scripts/check-light-theme.mjs` | **0** | PASS |
| `node scripts/check-heading-contract.mjs` | **0** | PASS |
| `node scripts/check-focus-ring.mjs` | **0** | PASS |
| `node scripts/check-dom-landmarks.mjs` | **0** | PASS |
| `node scripts/check-portfolio-contrast.mjs` | **0** | PASS |
| `node -e "JSON.parse(design.json) + assert schemaVersion/components"` | **0** | `schemaVersion=2 components=3 selfContained=true` |

## 5. Không đụng baseline / claim

- `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` → **rỗng** (0 dòng). Không nâng baseline, không `--write-baseline`.
- `docs/CLAIMS.md:1993` — dòng `| uiux-exp-w2 | ... | in-progress | 2026-11-19 |` vẫn **in-progress** (đúng B8; claim chưa đóng).

## 6. Không đụng Cmd+K / density (S5)

- `git diff origin/dev..HEAD | Select-String -Pattern 'CommandRegistry|SettingsProvider'` → **không có output** (rỗng). Xác nhận Cmd+K/density đã tách sang S5/W3, không lọt vào slice này.

## Objections (minor — không chặn B9)

- **O-31a (minor)** — `packages/web/DESIGN.md:7,74` ghi `#0b1424` nhưng hex này **không có** trong allowlist `packages/web/scripts/check-tokens.mjs:10-29`. Tuy nhiên đây không phải palette mới: token `--pf-surface: #0b1424` đã tồn tại từ W0 tại `packages/web/src/components/soc/soc.tokens.css:46` (và `check-theme-contrast.mjs:993`). Gate `check-tokens` exit 0 vì script chỉ quét CSS usage ngoài `:root` (`:8,31-35,56`). Đề xuất coordinator ở B9: giữ nguyên và ghi rõ đây là *token-definition hex đã có sẵn*, hoặc xoá khỏi DESIGN.md — **không nới allowlist**.
- **O-31b (minor)** — `git status --short` có 1 file untracked `docs/evidence/uiux-ssot/w2/green2.md` (implementer chạy green lần 2 nhưng chưa commit). Không ảnh hưởng code đã commit. Đề xuất: commit hoặc xoá trước khi đóng claim.
- **O-31c (minor)** — `packages/web/src/components/__tests__/uiux-exp-w2.component.test.tsx:7-15` chưa assert state `empty` dù type có 4 state (`FreshnessBadge.tsx:3`) và CODE dùng `empty` (`StockOrderBookWidget.jsx:158`). Đề xuất bổ 1 assertion `data-state="empty"` nếu coordinator muốn coverage 4/4. Không phải blocker vì giữ nguyên hành vi.

## CHƯA CHẠY

Staging VPS `14.225.255.47` / `https://docker.edusuccess.vn` · deploy & verify · ảnh chụp visual (Playwright) · E2E · `test:visual` snapshot mới · full `vitest` · `npx tsc --noEmit` · `npm run build` · `npm run lint` · `i18n:scan:strict` · `check-uiux-budget` · `check-a11y-runtime`. Không suy ra kết quả cho các hạng mục này.

## Next steps / owner

1. Coordinator (Owner): đóng O-31a/b/c ở B9 theo lựa chọn ở trên.
2. Implementer: dọn file untracked `green2.md`; cập nhật claim `uiux-exp-w2` → `done`; prepend Entry (auditor đã ghi Entry 555 ở đây); push; mở PR; cleanup.
3. Chạy staging/visual/E2E theo runbook trước khi coi slice hoàn tất.
