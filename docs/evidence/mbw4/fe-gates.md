# FE gates — mbw4 (B4.3)

Ngay: 2026-10-15 · Nhanh: `feat/mbw4-fe` -> `feat/mbw4-soc-ops`
VPS: `14.225.255.47` · Worktree VPS: `/tmp/wt-mbw4-fe` · `npm ci` exit 0 (Linux, 1101 packages)
Runner: `bash /tmp/mbw4_fe_suites.sh` (`/usr/bin/corepack npm`, §12.4)

## 1. TDD fail-before (RED) — test moi tren panel cu

`soc-broker-wave4.component.test.tsx` (4 tests) chay voi `SocBrokerPanel.tsx` o wave base
(`git checkout feat/mbw4-soc-ops -- <panel>`, byte-safe, WIP da commit truoc) → **4/4 failed**.
Khoi phuc panel wave4 bang `git checkout <wip-sha> -- <panel>` (khong dung `>` cua PowerShell —
ghi UTF-16 lam hong file, da gap + sua, xem ledger).

## 2. GREEN tren VPS (gate chinh thuc; local chi sanity 7/7, khong thay gate)

| Gate | Ket qua (VPS) |
|---|---|
| vitest 2 files (`soc-broker-wave4` 4 + `soc-broker` B2.3 3) | **7/7 exit 0** (lan 1 + lan 2 sau audit-loop) |
| `i18n:scan:strict` | **exit 0** (0 thieu; `brokerWave4.*` du vi+en) |
| `npm run build` (tsc + vite) | **exit 0** (~31s) |
| bundle `ShellOperationsCenterPage` | **2387.4 KB** (lan 1) / **2387.5 KB** (lan 2), 19 chunk |

## 3. Bundle baseline (khong regression)

Base wave (`/tmp/wt-mbw4-base` @ wave branch, node_modules symlink, build exit 0):
**2381.1 KB / 18 chunk** → delta wave4 **+6.3 KB (+0.26%)** (panel + i18n; chunk 19 la `socCsv` tach 0.58KB).
Ghi nhan hieu chinh nguong: plan §3 ghi bundle **≤1450 KB (Wave 3: 1361.0/1363.3)** —
con so do do tren route **`/broker`**, khong phai `operations-center` (da nang san ~2381KB
tu echarts 711KB + i18n 524KB + react-vendor 298KB — pre-existing, ngoai scope wave).
Gate dung cho wave4 la **khong regression** tren route cham: DAT (+6.3KB).

## 4. Ghi chu

- `t()` khong provider tra `defaultValue` (neu co) thay vi key → test assert chu hien thi
  that ("Lần chạy cuối", "Cần xác minh") thay vi key. Bai hoc cho test i18n sau.
- Test B2.3 cu sua 1 assert (`audit_title` → "Nhật ký audit") theo contract moi (tien le R0.2).
