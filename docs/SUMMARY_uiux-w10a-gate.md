# SUMMARY — UI/UX w10a-gate (NAV-1 generic `<…>` false positive)

**Agent**: `w10a-gate` · **Branch**: `feat/w10a-nav1-generic-gate`
**Commit**: `decedc436` — `fix(docs/uiux): NAV-1 escape — cho phep generic <…> trong useUrlValue/useUrlState`

---

## 1. Phạm vi

| File | Thay đổi |
|---|---|
| `docs/audit-uiux/scripts/nav1-rule.mjs` | +32 / −5 — cho phép generic `<…>` trong `USE_URL_VALUE_RE` + `USE_URL_STATE_RE` |
| `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` | +67 / −0 — thêm self-test `T12` + `T13` |
| `packages/web/scripts/uiux-baseline.json` | **KHÔNG đổi** (xem §6) |

`packages/web/src/**` — **0 dòng** (slice B sở hữu).

---

## 2. Bug — tái kiểm chứng độc lập

`USE_URL_VALUE_RE` / `USE_URL_STATE_RE` yêu cầu `useUrlX\s*\(` — **không** chấp nhận
generic TS chen giữa tên hook và `(`. Wave 4 đã sửa `useUrlRecord` nhưng bỏ sót 2 hook.

**Probe độc lập** (`%TEMP%\opencode\probe-nav1.mjs`, mỗi case **một lệnh gọi riêng với mảng 1 phần tử**
— vì `urlSyncedVars` trả `Map` khoá theo TÊN BIÊN nên truyền nhiều dòng một lúc sẽ cho kết quả
"đúng" vì lý do sai).

Kết quả **trước khi sửa** (`probe-BEFORE.txt`):

```
  A1 useUrlValue<T>(...)  [TenantUsageSummaryPage.tsx:48 — false positive that]
    synced   : []  (co "tab"? false)
    nav1Hit  : HIT var="tab" hook="useUrlValue"
    verdict  : *** HIT — van bi bao loi ***
  A2 useUrlValue(...)     [khong generic — control]
    synced   : [sortCol]  (co "sortCol"? true)      → ESCAPED  (control OK)
  B1 useUrlState<Rec>({...})
    synced   : []  (co "activeTab"? false)          → FAIL (key KHONG duoc dang ky)
  B2 useUrlState({...})   [control]  synced=[statusFilter,sortCol]  → OK
  C1 useUrlRecord<JobFilters>(...)  [mau wave 4]  synced=[filters]   → OK
```

Xác nhận thêm bằng `nav1-report.mjs --why` **trên repo thật**:

```
> packages/web/src/pages/tenant/TenantUsageSummaryPage.tsx  counted=1 escaped=0
>   HIT  :48  tab                    khong dong bo URL (useUrlValue)
```

Sau khi sửa: probe **6/6 PASS** (`probe-AFTER.txt`), và `TenantUsageSummaryPage` **biến mất khỏi** `--why`.

### Về `useUrlState<T>` — lỗi *tiềm ẩn*, không phải false positive đang lộ

Đo thật trong repo (`grep useUrlState` trên `packages/web/src`):
- `useUrlValue<T>` — **1** call site thật (`:48`).
- `useUrlState<T>` — **0** call site thật (TS suy luận `T` từ `spec`).

Ngoài ra hook trả **tuple** `[T, setter]` với `T` là RECORD (`useUrlState.ts:141`), nên dạng
`const [tab, setTab] = useUrlState<Rec>(…)` là **sai kiểu** — không tồn tại. Dòng khai báo thật
là destructure **bản ghi** `const [{…}, setS] =` ⇒ `NAME_RE` không khớp ⇒ `nav1Candidate` trả
null **vì lý do khác hẳn**, không phải vì regex đúng.

Vì vậy probe ban đầu của tôi có một case D2 suy ra sai; đã bỏ và thay bằng kiểm tra trực tiếp
(`NAME_RE`/`ANY_DESTRUCTURE_RE` có khớp không) + đếm call site thật. Sửa vẫn đáng làm: mọi call
site có generic đều **chưa đăng ký key** — lỗi tiềm ẩn, sửa tại nguồn thay vì chờ file nào lộ ra.

---

## 3. Fail-before / pass-after (bắt buộc)

Bản gốc lưu ở `%TEMP%\opencode\nav1-rule.ORIGINAL.mjs`; khôi phục bằng **`Copy-Item` (file copy)**,
**không** dùng `git checkout --` (hazard 11).

**Trước khi sửa** (`selftest-BEFORE.txt`): `✓ self-test PASS (11/11)` — chưa có T12/T13.

**Sau khi sửa**: `✓ self-test PASS (13/13)` — exit 0.

**Fail-before** — trả `nav1-rule.mjs` về **bản gốc** (chỉ khác 2 regex), giữ nguyên T12/T13:

```
  FAIL  T12 useUrlValue<T> co generic van escape (TenantUsageSummaryPage:48)
         hits=[tab,filterStatus] — mong doi KHONG co "tab" (co generic) VA KHONG
         co "sortCol" (khong generic), VAN co "filterStatus"
  FAIL  T13 useUrlState<T> co generic van DANG KY key (khong phai null do lenh dong)
         synced=[] hits=[filterStatus] — mong doi synced co "activeTab"/"pageSize"
         (bang chung dang ky THAT), VAN co "filterStatus" trong hits
✗ self-test FAIL — 2/13 truong hop KHONG bat duoc
```
**exit code = 1.** Đúng như dự đoán: T12 lộ `tab` (false positive thật), T13 lộ `synced=[]`.
11 case cũ vẫn PASS ⇒ test mới không phá gì.

**Re-apply fix** → `✓ self-test PASS (13/13)`, exit 0, `git diff --numstat` về `32 5`.

⚠ Lưu ý kỹ thuật: `--self-test` **không** chạy được với `node … --self-test` trần — `ROOT`
lấy từ `process.argv[2]` nên bị nuốt mất (`ENOENT … '--self-test'`). Phải truyền root:
`node docs/audit-uiux/scripts/scan-ui-guidelines.mjs <root> --self-test`.

---

## 4. NAV-1 count trước / sau

```
node docs/audit-uiux/scripts/nav1-report.mjs
```

| | file có ứng viên | COUNTED (gate thấy) | escaped | tổng ứng viên |
|---|---|---|---|---|
| Trước | 35 | **50** | 29 | 79 |
| Sau  | 35 | **49** | 30 | 79 |

`Compare-Object` cho **đúng 3 dòng khác** — không có thay đổi nào ngoài dự kiến:

```
  file co ung vien: 35 | COUNTED (gate thay): 49 | escaped (bi bo qua): 30 =>
  file co ung vien: 35 | COUNTED (gate thay): 50 | escaped (bi bo qua): 29 <=
      1  packages/web/src/pages/tenant/TenantUsageSummaryPage.tsx          <=
```

Giảm đúng 1 = đúng false positive đã biết. Không có mục nào tăng.

---

## 5. Gate — exit code THẬT

| Lệnh | Exit | Kết quả thật |
|---|---|---|
| `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs <root> --self-test` | **0** | `✓ self-test PASS (13/13)` |
| `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs <root> --self-test` (bản GỐC) | **1** | `✗ self-test FAIL — 2/13` (T12, T13 FAIL) |
| `node docs/audit-uiux/scripts/nav1-report.mjs` | **0** | COUNTED 50 → 49 |
| `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration — PASS` |
| `npx tsc --noEmit` (packages/web) | **0** | không output |
| `npx vitest run src/hooks` (packages/web) | **0** | `Test Files 14 passed (14)` · `Tests 87 passed (87)` · 31.99s |
| `node scripts/check-uiux-budget.mjs` (packages/web) | **0** | `✓ check-uiux-budget — PASS (0 tang so voi baseline, da giam 40)` |

`check-multi-agent` có nhiều dòng `!` cảnh báo `CLAIMS.md` dòng 882–998 trỏ file không tồn tại
trong worktree này — **tiền có, không liên quan** file tôi sửa (gate vẫn exit 0).

---

## 6. `uiux-baseline.json` — KHÔNG đổi, và vì sao

Đọc **consumer** trước (`packages/web/scripts/check-uiux-budget.mjs`) — hazard 9
"script tồn tại ≠ script hoạt động".

`compare()` dòng 158:
```js
if (v.count > b) increased.push(...)     // CHỈ FAIL khi TĂNG
```
và dòng 142: `BE hơn baseline (đã sửa) → PASS, đề xuất nâng baseline`.

⇒ baseline là **trần chống thoái lui**, KHÔNG phải trần cứng. Sửa này làm NAV-1 **GIẢM** 50→49 ⇒ vẫn dưới baseline 89 ⇒ gate PASS (đã chạy thật, exit 0). Không cần sửa.

Ghi chú: baseline `"NAV-1": 89` **đã lệch trước khi tôi vào** (thực tế đã là 50), vì đó là số chốt từ wave 5 và các wave sau chỉ giảm. Đó là chuyện của wave khác, không gộp vào commit này.

---

## 7. Line-ending

Cả 2 file là **LF** trong git (`core.autocrlf=false`, không có `.gitattributes` cho path này).
Đo bằng `node`: `CRLF count = 0` cho cả 2 trước và sau khi sửa.
`git diff --numstat` = `32 5` + `67 0` — **không nổ toàn file**.

---

## 8. Ràng buộc đã giữ

- Không đụng `NAME_RE`, `HOOK_RE`, `ANY_DESTRUCTURE_RE`, `DATA_CACHE_RE`, `USE_URL_RECORD_RE`, `USE_SEARCH_PARAMS_RE`.
- **Không** thêm blacklist theo tên, **không** nới luật để số đi m — sửa đúng **nguồn** chưa đọc hết.
- `packages/web/src/**`: 0 dòng.
- Không chạm `docs/CLAIMS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `AGENTS.md`, `packages/web/package.json`.
- Không `npm install`, không migration.

---

## 9. Bài học quy trình

**Đừng suy luận từ kết quả tổng của một hàm nhiều-dòng.** Bản probe đầu của tôi truyền nhiều dòng
vào `urlSyncedVars` một lúc và kết luận "escape hoạt động" ở Case B — vì `Map` khoá theo tên biến
và một dòng khác đã điền sẵn khoá đó. Mỗi case phải là **một lệnh gọi riêng, mảng 1 phần tử**.
Tệ hơn: suy ra một case "biến thật" cho `useUrlState<T>` mà đọc `useUrlState.ts:141` mới thấy
dạng đó **sai kiểu** (hook trả tuple, `T` là record). Kiểm **signature thật** trước khi viết case
— test viết từ suy đoán sẽ "PASS" vì lý do sai, y hệt lỗi mà chính T13 đang chống lại.

---

## 10. CHƯA CHẠY

| Mục | Trạng thái |
|---|---|
| `npm run lint` | **CHƯA CHẠY** (ngoài danh sách gate được giao) |
| `npm run build` (vite build) | **CHƯA CHẠY** |
| `check-uiux-budget --self-test` | **CHƯA CHẠY** |
| `check-ledger-entry` · `check-h1-graph` | **CHƯA CHẠY** |
| Full `npm run test` / `test:components` | **CHƯA CHẠY** (chỉ chạy `src/hooks` theo yêu cầu) |
| Playwright / BE test | **CHƯA CHẠY** |