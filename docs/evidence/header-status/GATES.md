# Gates — R1 Header realtime indicator (2026-11-19)

- Branch `feat/header-realtime-status` · claim commit `966a70ed1` · baseline `dev` @ `62f0d1aba`
- Plan: `docs/PLAN_HEADER_REALTIME_STATUS_20261119.md` · Diagnosis: `docs/DIAGNOSIS_OFFLINE_404_DATAOPS_20261119.md`

## 1. Baseline (trước khi sửa, chạy thật)

| Lệnh | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS` (206 cảnh báo stale, không chặn) |
| `npx tsc --noEmit` (packages/web) | exit 0, không output |
| `npx vitest run .../Header.component.test.tsx` | 1 file / **7 test PASS** |

Claim check: parse 13 claim `in-progress` bằng `split('|').map(trim)` → **0** claim giữ 4 file SCOPE. Không deny-list, không migration, không `package.json`.

## 2. Fail-before (test mới chạy trên code chưa sửa)

```
npx vitest run .../Header.component.test.tsx --reporter=json
→ total 13, passed 9, failed 4
FAIL AC0 — khong co RealtimeProvider: trạng thái idle, khong throw, khong hien Offline
FAIL AC1 — consumerCount=0 (trang SOC khong co symbol): idle + cham xam
FAIL AC2 — dang ket noi: nhan vang
FAIL AC3 — polling (fallback hop le): nhan vang Dự phòng
```
AC4/AC5 vẫn xanh vì code cũ vẫn render "Online"/"Offline" đúng ở 2 trạng thái đó — đúng kỳ vọng.

## 3. Sau khi sửa (pass-after)

| Lệnh | Kết quả |
|---|---|
| `npx vitest run .../Header.component.test.tsx` | **13/13 PASS** (7 cũ + 6 mới) — từ 4 đỏ → 0 đỏ |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint <4 file SCOPE>` | **0 error**, 3 warning `react/jsx-no-literals` ở dòng 54/69/73 — **có sẵn trước slice** (3 probe `data-testid` của test cũ) |
| `node scripts/i18n-scan-strict.mjs` | exit 0; chỉ cảnh báo default-value của key cũ, không key `layout.realtime.*` |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS` |
| `node scripts/normalize-eol.mjs` | `OK (5 file thay đổi, tất cả khớp dạng blob gốc)` |
| `git diff --numstat` (source) | `8 0 vi/layout.js` · `8 0 en/layout.js` · `46 8 Header.tsx` · `100 3 Header.component.test.tsx` — **đúng 4 file SCOPE, 0 file ngoài** |
| U+FFFD / LF | 4/4 file `U+FFFD = 0`, `endsLF = true` |

## 4. Full component suite — 13 fail là PRE-EXISTING (đã đối chứng)

```
npx vitest run  → 203 file, 1334 test, 13 failed | 1321 passed
```
7 file fail: `StockOrderBookWidget.estimated`, `soc-overview-stream`, `soc-signals-stream`, `page-heading-ac3`, `user-settings-ai-link`, `user-settings-password-rhf`, `modal-surface-opaque`. **Không có file Header.**

Đối chứng: tạo worktree tạm ở `966a70ed1` (HEAD sạch, chưa có source slice), junction node_modules, chạy đúng 7 file đó:
```
7 failed (7) · 13 failed | 14 passed (27)   ← GIỚNG NHƯ SAU slice
```
⇒ 13 fail là baseline cũ, **không quy cho slice này**. Worktree tạm đã `git worktree remove --force` + xoá junction; `git worktree list` chỉ còn cây chính.

## 5. CHƯA CHẠY

- `npm run build` / `vite build` — chưa chạy (chỉ `tsc --noEmit`).
- Deploy + xác minh trên VPS staging `14.225.255.47` (`bash scripts/deploy-staging.sh`), Playwright/visual 375–1440 — chưa chạy. Không báo PASS giả.
- Full eslint/i18n strict toàn repo — chỉ chạy trên 4 file SCOPE + script strict có sẵn.

## 6. Kết luận gate

Tất cả gate trong SCOPE đạt; fail-before được chứng minh; full-suite failures đã đối chứng là pre-existing. Slice sẵn sàng B8 re-audit. Staging/build vẫn nợ và phải ghi rõ khi bàn giao.
