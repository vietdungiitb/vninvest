# TEST REPORT — UI/UX wave 7 (2026-10-10)

> **Pham vi**: 3 nhom — (a) root cause `core.bare` chan push, (b) gate chan commit
> do claim stale, (c) salvage 2 branch WIP wave 6.
> **Nhanh**: `fix/hook-mode-git-dir-bare` · **Base**: `origin/dev` @ `1d12fe329`
> **Tien cua**: `docs/audit-uiux/SESSION_LOG_WAVE6_20261009.md` §5.1, §5.2, §5.7
> **Ledger**: `## Entry 261`

---

## 1. Tong ket

| Verdict | So gate |
|---|---|
| **Pass** | **9** |
| **CHUA CHAY** | **4** |

Khong co gate nao **Fail**. Revert fix va chay lai de xac nhan gate **that su bat
loi** (khong phai "xanh vi chua chay") — xem §3.

---

## 2. Gate chay that

| # | Gate | Lenh | Exit | Ghi chu |
|---|---|---|---|---|
| 1 | Type-check | `npx tsc --noEmit` | **0** | 0 loi |
| 2 | Lint | `npm run lint` | **0** | 0 error / 3765 warning |
| 3 | Test component | `npm run test:components` | **0** | **120 file / 854 test PASS** |
| 4 | Build | `npm run build` | **0** | 46.48s |
| 5 | Shell gate | `npm run check:shell` | **0** | 7/7 gate con xanh |
| 6 | NAV-1 | `node docs/audit-uiux/scripts/nav1-report.mjs` | **0** | **60 -> 54 hit** |
| 7 | Hook mode | `node tools/opencode-global/verify-hook-mode.mjs` | **0** | **8/8 PASS** |
| 8 | Pre-push gate | `node scripts/pre-push-gate.mjs` | **0** | **17 PASS / 0 SKIP / 0 FAIL** |
| 9 | Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **0** | 0 loi, 0 trung so migration |

### Chi tiet gate 8 (aggregator)

```
PASS  syntax ............................ 30 file .mjs/.js
PASS  encoding ......................... 8/10 file da doi, 0 U+FFFD
PASS  secret-scan-selftest ............. 52/52 check
PASS  secret-scan ...................... 3760 tracked, 3618 scanned
PASS  i18n-strict ...................... exit 0
PASS  audit-status ..................... 0 dong thieu verified, --strict exit 0
PASS  preflight-selftest ............... 26/26 negative test
PASS  global-config-drift .............. 7 OK / 6 cap doi byte
PASS  shim-delegate .................... canonical that
PASS  preflight-trailer ................ bypass trailer
PASS  preflight-deny-extract ........... trich het muc §2
PASS  hook-mode ........................ block/warn/trailer tren may nay
PASS  i18n-strict-selftest ............. bat loi parse cua scanner
PASS  tsc --noEmit ..................... 0 loi
PASS  check-multi-agent ................ PASS
PASS  envelope-contract ................ 9/9 app 0 UNWRAPPED
PASS  openapi-budget ................... NO CON: Errors=32, Warnings=184 (baseline)
=> 17 PASS / 0 SKIP / 0 FAIL
```

---

## 3. FAIL-BEFORE / PASS-AFTER (hung 6, khong tin gate xanh)

| Bug | Cach kiem chung | Truoc | Sau |
|---|---|---|---|
| **`core.bare`** | revert rieng fix trong `verify-hook-mode.mjs`, chay lai | `core.bare=true`, hook-mode **FAIL 3/8**, exit 1 | `core.bare=false`, **8/8 PASS**, exit 0 |
| **Claim stale chan commit** | `git reset` (index sach) roi chay lai gate | index sach: **PASS**; 7 file staged: **FAIL 1/8, exit 2** | doi claim sang `superseded`: **8/8 PASS** |

### Bang chung goc cua bug `core.bare`

```
GIT_DIR=<repo>/.git  +  node tools/opencode-global/verify-hook-mode.mjs
  => core.bare: false -> TRUE

chi `git init` trong thu muc tam, GIT_DIR ke thua
  => lap lai TRUE
```

---

## 4. CHUA CHAY — khong bao PASS

| Gate | Ly do |
|---|---|
| **Test BE (Django)** | `CORE_DATABASE_URL` chua set; branch nay **khong sua backend**. Khong suy ra "chắc là được". |
| **Playwright mobile** | Can backend that hoac `storageState` gia lap. |
| **`scan-ui-guidelines.mjs`** | Mat 3-5 phut (211-312 s do regex O(40*n) tren CSS); **khong chay lai** trong phien nay. |
| **Runtime that tren trinh duyet** | Chi kiem chung muc `MemoryRouter` o test; **chua bam tay** tren UI that tren may. |

> Ghi chu: `scan-ui-guidelines.mjs` **khong phai** treo (xem Entry 256/258) — phai
> cho timeout >= 400000 roi chay lai neu can so lieu tong UI guidelines.

---

## 5. HANH DONG XAC MINH DUOC (chi bao khi chay that)

| # | Hanh dong | Kiem chung | Ket qua |
|---|---|---|---|
| 1 | Bat `core.bare` de khoi dong | dat `GIT_DIR` roi chay `verify-hook-mode.mjs` | FAIL 3/8 + `git add` loi — **da lap lai 2 lan** |
| 2 | Tim thu pham khi gate FAIL co index | `git reset` vs staged; bisect 8 file 1 lan | `WhaleBubbleChart.jsx` |
| 3 | Claim co stale khong | `git branch -a --list "*uiux-improvement*"` | **rong** ⇒ branch khong con ⇒ claim chet |
| 4 | Line-ending lam hong `CLAIMS.md` | do byte: 1090 LF + 32 CRLF | `ReadAllLines` → diff 1093/1092 |
| 5 | Khoi phuc khong lam mat claim | `git hash-object` vs `git rev-parse HEAD:<path>` | **khop chinh xac** |
| 6 | WIP co parse duoc that khong | `vitest` tren file test cua `hooks` | `Parse failed` tai `:278`; **`tsc` exit 0** |
| 7 | `check-shell.mjs` co that su hong khong | doc header + chay `npm run check:shell` | **script da DEPRECATED**; gate that **exit 0** |

---

## 6. Phan tich WIP (khong merge duoc nguyen trang)

| Branch | Commit | Ket qua verify |
|---|---|---|
| `feat/uiux-w6-hooks` | `9885f2ea1` | **HONG** — parse error + 3 test assert symbol chua ton tai + 1 assertion sai |
| `feat/uiux-w6-pages` | `bae85e53a` | **HONG** — 3/844 test do (`useLocation()` ngoai `<Router>`) |

Ca 2 **BEHIND `origin/dev` 27 commit**.

**Da giu**: 4 component (`hooks`) + 3 page (`pages`) + sua 1 file test.
**KHONG giu**: file test hong cua `hooks`; `pageRegistry.js` (agent khac giu).

---

## 7. Residual risk

1. **8 file chuyen state sang URL CHUA co test end-to-end** cua rieng. Gate chung
   xanh (854 test) **khong chung minh** deep-link hoat dong — can Playwright hoac
   test moi theo mau `soc-nav1-url-state.component.test.tsx`.
2. **`Header.tsx` gan `q` vao URL.** `q` la query token pho bien; phai kiem tra
   khong dau vao `?q=` cua trang khac khi user dien URL day du.
3. **CLAIMS.md con 4 claim `in-progress` stale** khac (`uiux-wave5-nav1`,
   `uiux-w6-soc`, `uiux-w6-session-log`, `uiux-w6-handoff-fix` — ca 4 da merge).
   Lan sau se chan tiep.
4. **Khong ai kiem chung `core.bare` tren may khac.** Root cause la env, nen tren
   may khac (hook khong deploy) se khong xay ra — nhung fix van dung chung.