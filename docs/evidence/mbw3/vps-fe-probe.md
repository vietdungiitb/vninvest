# VPS-FE-PROBE — mbw3-fe (Wave 3, trả nợ HANDOFF §4 + plan §5.4)

Ngày: 2026-10-15 · Người chạy: agent FE (`feat/mbw3-fe`) · VPS: `14.225.255.47`

## 1. Kết luận

FE chạy được trên VPS. Runbook §12.4 đã sửa theo thực tế (commit này).
`npm` KHÔNG có sẵn trên VPS — dùng `corepack npm` (npm 11.18.0).

## 2. Thực tế probe (log đủ, kể cả thất bại)

| # | Lệnh / thao tác | Kết quả |
|---|---|---|
| 1 | `ssh root@14.225.255.47 "node --version; npm --version"` | node v22.22.1 có (`/usr/bin/node`); `npm: command not found` |
| 2 | Tìm npm: `/usr/bin/npm*`, `/usr/local/bin/npm`, nvm, `/root/.npm-global`, `find /usr /opt -name npm-cli.js` | KHÔNG có npm ở đâu cả |
| 3 | Image `vninvest-staging-frontend:latest` có node/npm không? | KHÔNG — image nginx-only (`COPY /app/dist`, không toolchain) |
| 4 | `corepack prepare npm@11.18.0 --activate` (registry.npmjs.org reachable, HTTP 200) | OK; gọi qua `/usr/bin/corepack npm` (`corepack npm --version` → 11.18.0). Chú ý: PATH rỗng trong ssh non-interactive nên phải dùng đường dẫn tuyệt đối |
| 5 | `/tmp/wt-mbw3-fe` cũ trên VPS | Là bản copy tay (không phải git worktree), chứa `node_modules` Linux (`@esbuild/linux-x64` + `.bin/vitest`) + `src` trùng HEAD `1a98db915` (`diff -rq` = 0 khác biệt), `package-lock.json` trùng. Tái dùng được |
| 6 | `git worktree add /tmp/wt-mbw3-fe-vps origin/feat/mbw3-fe` + `mv node_modules` sang | OK. SAI LẦN 1: `worktree remove` trước khi dời `node_modules` ra ⇒ mất 733 MB, phải `npm ci` lại từ đầu (đã ghi lesson) |
| 7 | `corepack npm ci` trong `/tmp/wt-mbw3-fe-vps/packages/web` | **exit 0** (~733 MB, `@vninvest/web@0.1.0`) |
| 8 | 5 test mới (`test:components`, vitest) | LẦN 1: **exit 1 — 1 failed / 19 passed** (`BindingsPanel` unknown: `getByText(/không rõ/i)` trúng 2 phần tử). Sửa test (`getAllByText` + `> 0`, giữ implementation), push `9427f0038`, dựng lại worktree, chạy lại → **exit 0 — 5 files / 20 tests passed** |
| 9 | Control: `BrokerSettingsSection.component.test.tsx` | **exit 0 — 1 file / 5 tests passed** (test cũ vẫn xanh sau sửa comment-only) |
| 10 | `npm run i18n:scan:strict` | **exit 0** (dòng `Added new translation key ... node_modules/.cache` là nhiễu scanner, không phải lỗi; 169 dòng chứa "fail" đều là tên key như `action_fail`, đã đối chiếu tay) |
| 11 | `npm run build` | **exit 0** (`tsc && vite build`, 31.99 s) |
| 12 | `node scripts/measure-route-graph.mjs BrokerHubPage` | 16 chunk, **1361.0 KB** (không gzip) ≤ 1450 ✅, không echarts/xlsx trong tải đầu |
| 13 | `... BrokerAccountPage` | 17 chunk, **1356.5 KB** ≤ 1450 ✅ |
| 14 | Fail-before ĐỎ: worktree `/tmp/wt-mbw3-red` tại commit test `8c9922375` (có test, chưa có implementation), `node_modules` symlink từ worktree trên | **exit 1 — 5/5 files failed**: `BindingsPanel`/`ScopedWatchlist` = `Failed to resolve import` (file chưa tồn tại); `route-dedup` = `expected 2 to have length 1` + `expected 'routes.portfolios' to be 'portfoliosManage.title'`; `matchedOrderStatus` = `MATCHED_ORDER_STATUS_LIST is not iterable`. Đúng fail-before textbook |
| 15 | Dọn | `/tmp/wt-mbw3-red` đã xoá sau khi lấy log; `/tmp/wt-mbw3-fe-vps` (+`node_modules`) GIỮ LẠI cho supervisor tái chạy, sẽ dọn sau merge (`agent-cleanup` + `worktree remove`) |

## 3. Giới hạn còn lại (ghi đúng, không nói quá)

- `measure-route-graph.mjs` đọc `dist/` ⇒ bắt buộc build trước (đã build trên VPS, số liệu §2.12–13).
- `npm` trên VPS chỉ tồn tại qua corepack; nếu image/node đổi, kiểm tra lại bước 4.
- Không copy `node_modules` Windows-local lên VPS (binary `@esbuild` khác platform) — luôn `npm ci` trên VPS hoặc tái dùng bản Linux có sẵn khi lock trùng (đã verify `diff -q package-lock.json`).
