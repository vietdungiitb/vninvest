# TEST REPORT — UI/UX wave 10 (2026-10-10)

Phạm vi: `feat/w10-integration` → `dev` (3 slice: A gate bug · B 1/3 file · C 2 file e2e).

**Nguyên tắc:** dòng nào không chạy thì ghi `CHƯA CHẠY`. Không suy ra "chắc là được".

---

## 1. Baseline đo được (không lấy từ nhật ký)

| Mốc | Lệnh | Kết quả |
|---|---|---|
| `dev` sạch @ `d18cb95c0` | `npx vitest run` (packages/web) | **877 test / 122 file** — 876 pass + **1 fail** |
| NAV-1 baseline | `node docs/audit-uiux/scripts/nav1-report.mjs` | **50 hit / 35 file** |

⚠ Nhật ký phiên trước ghi "854 → 877". Đo lại ở `dev` sạch: **877 tổng** nhưng **1 fail** —
`src/hooks/tenant-storage-ssot.component.test.js` AC1. Chạy riêng **3/3 lần đều 5/5 PASS**
⇒ **flake tải, có sẵn từ trước**, đã ghi trong `AGENTS.md`. **Không** tính là hồi quy của wave 10.

---

## 2. Gate — đã chạy, có exit code thật

| # | Gate | Lệnh (chạy ở `packages/web` trừ khi ghi) | Exit | Kết quả |
|---|---|---|---|---|
| 1 | test suite | `npx vitest run` | **0** | **125 file / 894 test PASS** |
| 2 | type-check | `npx tsc --noEmit` | **0** | 0 lỗi |
| 3 | build | `npm run build` | **0** | `✓ built in 43.62s` |
| 4 | lint | `npm run lint` | **0** | **0 error** / 3779 warning |
| 5 | scanner self-test | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src --self-test` | **0** | **13/13 PASS** (11 → 13) |
| 6 | NAV-1 report | `node docs/audit-uiux/scripts/nav1-report.mjs` | **0** | **50 → 44 hit / 34 file** |
| 7 | uiux budget | `node packages/web/scripts/check-uiux-budget.mjs` | **0** | `PASS (0 tăng, đã giảm 45)` |
| 8 | multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration` |
| 9 | ledger entry | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **0** | `0 trùng mới; max=263` |

**Baseline json `uiux-baseline.json` KHÔNG đổi** — đọc consumer trước:
`check-uiux-budget.mjs:158` chỉ FAIL khi `count > baseline`, tức là **trần hồi quy**, không phải trần cứng.
50 → 49 vẫn dưới 89 nên gate xanh. (Ghi chú: con số 89 trong baseline **đã cũ sẵn** trước phiên này —
thuộc wave khác, không gán vào commit này.)

---

## 3. Fail-before / pass-after — **tôi tự chạy lại**, không dùng báo cáo của agent

### 3.1 Bug gate (slice A)

| Trạng thái | Self-test | Exit |
|---|---|---|
| Regex gốc (từ `origin/dev`) + T12/T13 | **11/13 — FAIL `T12`, FAIL `T13`** | **1** |
| Sau khi sửa | **13/13 PASS** | 0 |

Dòng FAIL lấy từ output thật:
```
FAIL  T12 useUrlValue<T> co generic van escape (TenantUsageSummaryPage:48)
        hits=[tab,filterStatus] — mong doi KHONG co "tab" (co generic) ...
FAIL  T13 useUrlState<T> co generic van DANG KY key (khong phai null do lenh dong)
        synced=[] hits=[filterStatus] — mong doi synced co "activeTab"/"pageSize" ...
```

⚠ Khôi phục bằng **copy file** (`Copy-Item`), **không** `git checkout --` (hazard 11).
Sau khi khôi phục: `git status --short` **rỗng** ⇒ byte-giống commit.

### 3.2 Câu hỏi đã trả lời: sửa regex có làm rule yếu đi không?

Có test khoá **cả hai chiều**: `filterStatus`/`filterStatus` vẫn phải bị bắt ở cả T12 và T13.
Không có đường nới nào để số hit giảm.

### 3.3 Slice C — không dùng kỹ thuật "revert fix"

Nguồn đã có sẵn fix từ trước. Agent dựng **bản sao thay `useUrlState` bằng `useState`** rồi assert:
**5/8 assertion FAIL** trên bản sao (ví dụ `Expected "wb_tab=signals", Received ""`).
3 assertion AC-A **PASS cả hai bên** — agent **không tính chúng là bằng chứng** (đúng: `useState`
cũng không ghi URL nên AC-A không phân biệt được). Ghi rõ thay vì khoe 8/8.

---

## 4. Hồi quy — **24 test đỏ, ĐÃ ĐỂ LẠI, ĐÃ TỰ KIỂM CHỨNG**

Slice B commit 2 và 3 làm hỏng 24 test ở 3 file **ngoài phạm vi**:

| File | Hỏng | Lỗi |
|---|---|---|
| `src/pages/AlertCenterPage.component.test.tsx` | 18/18 | `useLocation() may be used only in the context of a <Router>` |
| `src/components/AIUsageDashboard.component.test.js` | 5/5 | như trên |
| `src/components/AISliceE.i18n.component.test.js` | 1/3 (E-AC1) | như trên |

**Tôi đã tự chạy lại trên `feat/w10b-nav1`: `Test Files 3 failed | 122 passed` · `Tests 24 failed | 875 passed` (899).**
Số liệu của agent **chính xác**.

**Vì sao KHÔNG sửa bằng `MemoryRouter`**: `AlertCenterPage.tsx:121-135` tự dựng `URLSearchParams`
rồi `window.history.replaceState` ⇒ xoá tham số hook vừa ghi và **bypass React Router**; effect mount
`:107-108` còn **tắt filter severity** khi đọc `?severity=high`. Bọc `MemoryRouter` sẽ làm suite
xanh trong khi tính năng **vẫn hỏng trên trang thật** — đúng hazard 8 (proxy observable).

⇒ Chỉ merge commit 1 của B (`AIAuditLogsPanel`, 5 hit). **2 commit còn lại không merge.**

---

## 5. `CHƯA CHẠY` — ghi rõ lý do

| Gate | Lý do |
|---|---|
| BE test (Django) | không sửa backend; cần Postgres + `DJANGO_DEBUG=1` |
| Playwright (mobile) | cần backend thật hoặc `storageState` |
| `scan-ui-guidelines.mjs` toàn cây | chạy 3–5 phút (regex O(40·n)/dòng CSS); **không** phải treo |
| `check-h1-graph` | chưa chạy ở phiên này (gate `shell-ai-command-center` có vấn đề từ wave 6, cần Owner) |
| `i18n:scan:strict` · `check:shell` | không động vào i18n/shell; không chạy lại |
| `pre-push-gate` | **sẽ chạy khi push** (17 gate, xem §6) |

---

## 6. Verdict

**PASS** với điều kiện đã nêu: 2 commit của slice B **bị loại có chủ đích**, không phải vì
gate xanh. Đã đọc đủ 9 gate, trong đó 2 gate có bằng chứng fail-before **tôi tự tái lập**.

`confidence: high` cho phần merge (slice A + C + B/3).
`confidence: cao` cho kết luận "B còn lại là BLOCKER thật" — dựa trên đọc `AlertCenterPage.tsx:97-135`,
không phải suy đoán.