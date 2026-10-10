# TEST REPORT — UI/UX wave 11 (2026-10-10)

Phạm vi: `feat/w11-alert-center-url` → `dev`. Giai blocker §4.1 của wave 10.

**Nguyên tắc:** dòng nào không chạy thì ghi `CHƯA CHẠY`. Không suy ra "chắc là được".

---

## 1. Baseline đo lại (không lấy từ nhật ký)

| Mốc | Lệnh | Kết quả |
|---|---|---|
| `dev` sạch @ `5587e6141` | `npx vitest run` (packages/web) | **125 file / 894 test — 894 PASS, 0 fail** |
| `dev` sạch | `node docs/audit-uiux/scripts/nav1-report.mjs` | **44 hit / 34 file** |
| `dev` sạch | `scan-ui-guidelines.mjs … --self-test` | **13/13 PASS**, exit 0 |

⚠ Handoff wave 10 ghi baseline "877 = 876 pass + 1 flake". Lần này **894/894 sạch** —
flake `tenant-storage-ssot` **không** tái diễn. Không coi là hồi quy.

## 2. Gate — đã chạy, có exit code thật

| # | Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|---|
| 1 | test suite | `npx vitest run` | **0** | **127 file / 914 test PASS** (894 → 914) |
| 2 | type-check | `npx tsc --noEmit` | **0** | 0 lỗi |
| 3 | build | `npm run build` | **0** | `✓ built in 33.40s` |
| 4 | lint | `npm run lint` | **0** | **0 error** / 3781 warning |
| 5 | scanner self-test | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test` | **0** | **13/13 PASS** |
| 6 | NAV-1 report | `node docs/audit-uiux/scripts/nav1-report.mjs` | **0** | **44 → 34 hit** |
| 7 | uiux budget | `node packages/web/scripts/check-uiux-budget.mjs` | **0** | `PASS (0 tăng, đã giảm 55)` |
| 8 | multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration` |
| 9 | ledger entry | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **0** | `0 trùng mới; max=264` |
| 10 | pre-push-gate | qua hook khi push | **1** | **16 PASS / 1 FAIL** — xem §5 |

**Lint +2 warning** (3779 → 3781): cả 2 đều là `react/jsx-no-literals` cho
`data-testid="search"` trong **2 file test mới** của 2 commit cherry-pick. Đã kiểm bằng
`npx eslint <2 file>` — không phát sinh từ sửa code runtime. `0 error` là gate.

## 3. Fail-before — tự tái lập, không dùng lời agent

| Trạng thái | Lệnh | Kết quả |
|---|---|---|
| `dev` + 2 commit cherry-pick, **chưa sửa gì** | `npx vitest run` (3 file) | **3 failed · 24 failed / 2 passed** |
| Sau khi sửa | cùng lệnh | **46/46 PASS** |
| Toàn bộ sau khi sửa | `npx vitest run` | **127 file / 914 test PASS** |

⇒ Đúng 24 test đỏ như handoff mô tả. **Không** dùng `--no-verify` cho test.

## 4. Ràng buộc cốt lõi — tái lập bằng probe thật

`useUrlState.ts:161-165` ghi "2 `setParams` trong 1 tick KHÔNG compose" (đo 2026-10-09).
**Không tin comment** — đã viết probe:

```
setParams(a=1) ; setParams(b=2)  trong 1 tick  ⇒  kết quả "b=2"
```

`a` **mất sạch**. ⇒ Ràng buộc thật ⇒ mọi setter trong `useAlertCenterFilters` ghi **toàn bộ**
trạng thái qua optimistic `stateRef`. Test khoá cả hai chiều: `setLane` + `resetStatsPage` +
`setSessionDate` trong 1 handler ⇒ cả 3 còn; `toggleSeverity` × 2 trong 1 tick ⇒ `high,critical`.

## 5. `pre-push-gate` 1 FAIL — **không phải do thay đổi này**

FAIL = `global-config-drift`. Gate so `tools/opencode-global/` (canonical trong repo) với
`~/.opencode/` (bản deploy trên máy) — **không file nào trong đó thuộc thay đổi này**.

| Nơi chạy | Kết quả |
|---|---|
| `dev` sạch (main tree) | `7 OK / 6 cấp đổi byte + 1 smoke test` — **exit 0** |
| worktree `w10b-nav1` — **không đụng file nào** | `4 DRIFT + 0 MISS / 3 OK` — **exit 1** |
| worktree `w11-acurl` (branch này) | `4 DRIFT + 0 MISS / 3 OK` — **exit 1** |

⇒ FAIL là hiện tượng của **mọi worktree trên máy này**, không phải của code tôi.
Push `--no-verify`; lý do ghi trong **commit body** (yêu cầu của `AGENTS.md`).
Tiền lệ cùng repo: PR #46, PR #47. **16/17 gate còn lại PASS**, trong đó `tsc` 0,
`check-multi-agent` PASS, `envelope-contract` 9/9, `openapi-budget` OK.

## 6. `CHƯA CHẠY` — ghi rõ lý do

| Gate | Lý do |
|---|---|
| BE test (Django) | không sửa backend; cần Postgres + `DJANGO_DEBUG=1` |
| Playwright (mobile) | cần backend thật hoặc `storageState` |
| `scan-ui-guidelines.mjs` toàn cây | chạy 3–5 phút (regex O(40·n)/dòng CSS); **không** phải treo |
| `check-h1-graph` | chưa chạy phiên này (gate `shell-ai-command-center` có vấn đề từ wave 6, cần Owner) |
| `i18n:scan:strict` · `check:shell` | không động vào i18n/shell |
| Test browser thật cho `AlertCenterPage` | 2 effect đã xoá là **source** URL; chứng minh bằng test `MemoryRouter` + `SearchProbe`, chưa chạy tay trên trình duyệt |

## 7. Verdict

**PASS** — 9/10 gate xanh, gate thứ 10 FAIL vì lý do môi trường đã chứng minh bằng
worktree đối chứng không bị tôi đụng tới.

`confidence: high` cho việc URL của AlertCenter còn một chủ sở hữu duy nhất
(đọc `useUrlState.ts` + `nav1-report --why` + 914 test).
