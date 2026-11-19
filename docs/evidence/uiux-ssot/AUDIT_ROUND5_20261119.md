# AUDIT VÒNG 5 — O-26 / PLAN rev5 (UI/UX W0 Token SSOT)

- **Ngày**: 2026-11-19 · **Branch**: `feat/uiux-ssot-w0` · **Worktree**: `D:/Mujoco Projects/uiux-ssot-w0`.
- **Scope**: CHỈ O-26 / plan rev5. Không audit lại O-01..O-25.
- **Vai trò**: auditor độc lập (session khác người viết plan/code), **read-only** — không sửa plan/code, không claim, không chạy test/build/staging.
- **Verdict**: **NEED_REVISION** — **1 blocker (O-28), 1 major (O-27)**. Chưa đủ điều kiện "0 blocker/0 major" ⇒ **KHÔNG cho phép đụng `check-theme-contrast.mjs` / code** cho tới khi planner sửa và Owner chốt.

## 1. Kiểm chứng WCAG (script Node riêng — KHÔNG phải gate repo)

Lệnh tái lập (Node 24.14.1, `node -e` với template literal để né PowerShell strip quote): công thức `srgbLum` + `contrast` y hệt `packages/web/scripts/check-theme-contrast.mjs:137-150`.

| Cặp | Tự tính | Kỳ vọng plan | Kết luận |
|---|---|---|---|
| `#94a3b8` trên `#0f172a` | **6.963** | 6.96 (`PLAN_W0:20,32,107`) | khớp |
| `#475569` trên `#f8fafc` | **7.243** | 7.24 (`PLAN_W0:32,43,107`) | khớp |
| `#0f172a` trên `#06b6d4` | **7.353** | 7.35 (`PLAN_W0:20,31,43`) | khớp |
| `#94a3b8` trên `#ffffff` | **2.564** | 2.56 (`BLOCKER_O26:26-29`) | khớp — đúng regression đã báo |
| `#475569` trên `#ffffff` | **7.578** | — | > 4.5 |
| `#0891b2` trên `#f8fafc` | **3.519** | — | < 4.5 — xem O-28 |
| `#0e7490` trên `#f8fafc` | **5.121** | ≈5.36 (`ENTRY 539:45`, nền khác) | > 4.5 |

⇒ **Option (a) đúng về mặt toán học cho riêng pair `text-muted-on-bg-panel`** (dark 6.96 / light 7.24). Nhưng điều đó **không đủ để toàn gate exit 0** — xem O-28.

## 2. Findings

### O-27 (MAJOR) — Task 1 test mẫu vẫn là rev4, mâu thuẫn chính Task 2 rev5

Plan rev5 đã đúng ở các chỗ tổng hợp:
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:63` — `LIGHT_KEYS` (6, gồm `--text-muted`), `FORBIDDEN_LIGHT = ["--accent-cyan"]`.
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:53` — Review Focus #3: 6 key gồm `--text-muted: #475569`; **chỉ `--accent-cyan` bị cấm**.
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:32,105` — O-26 trade-off + Task 2 Step 2 thêm `--text-muted: #475569` vào light block.

Nhưng **code mẫu Task 1 chưa được cập nhật theo rev5**:
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:81` — comment `// O-25: --text-muted CŨNG KHÔNG được khai trong light block (giữ base #94a3b8)`.
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:84` — `for (const n of ["--accent-cyan", "--text-muted"]) expect(themeLight).not.toMatch(...)` — vẫn cấm `--text-muted` ở **theme light** (đúng cho SOC light ở `:87`, sai cho theme light).
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:90` — Step 2 kỳ vọng `5 light thiếu + 2 light bị cấm (--accent-cyan, --text-muted)`; rev5 phải là **6 thiếu + 1 cấm**.
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:100` — Task 2 Files chỉ ghi "Modify `.vnbConsole` allowlist test", **thiếu chỉ dẫn đổi test** `LIGHT_KEYS 5→6`, bỏ `--text-muted` khỏi `FORBIDDEN_LIGHT`, bỏ assert cấm ở `theme.light`.
- `docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:21` — cụm "KHÔNG override light" vẫn đứng trong bảng D1 (có nhãn `(dark)` / `(O-25 fix a)`, nhưng dễ đọc nhầm thành cấm tuyệt đối).

Thực tế code partial đang rev4, đúng kỳ vọng "chờ audit v5" (`docs/CODE_CHANGE_AUDIT_LEDGER.md:6`): `token-ssot.component.test.ts:12-18` `LIGHT_KEYS` 5 / `FORBIDDEN_LIGHT` 2; `:54-58` assert cấm `--text-muted` ở `theme.light`; `theme/tokens.css:65-83` chưa có `--text-muted: #475569`.

**Tác động**: nếu agent viết test đỏ theo `PLAN:81/84/90` rồi làm Task 2 Step 2 (`:105`) thêm `--text-muted: #475569` vào light block, thì bước "Vitest Task 1 → xanh" (`PLAN:115`) **không bao giờ đạt**; để xanh phải sửa test sau khi code ⇒ tái lập đúng lỗi O-01 (test không còn là spec, red/green giả).

**Cách sửa**: cập nhật `PLAN:81,84,90` thành "`--text-muted` **được phép** ở theme light block; `FORBIDDEN_LIGHT = ["--accent-cyan"]`; 6 light key / 1 bị cấm"; **giữ nguyên** assert `socLight` hết `--text-muted` (`PLAN:87`); bổ sung vào `PLAN:100` nhiệm vụ sửa file test tương ứng; gắn nhãn rõ `(dark only)` cho cụm ở `PLAN:21`.

### O-28 (BLOCKER) — Option (a) chưa đủ: đổi resolve light sinh pair accent `fresh` + `worse`, gate vẫn exit 1

Plan rev5 khẳng định hướng sửa gate sẽ cho "0 vi phạm mới" (`PLAN_W0:32,43,107,109-114`; `HANDOFF:42`), nhưng chưa mô phỏng tác động của việc đưa `light-theme.css` vào map light lên **toàn bộ** baseline.

Chuỗi bằng chứng tĩnh (chưa chạy gate thật — auditor read-only):

1. `packages/web/scripts/check-theme-contrast.mjs:86-99` — `VARIANTS.shell.order` và `VARIANTS.soc.order` **KHÔNG chứa** `packages/web/src/theme/light-theme.css`, dù file này có trong `TOKEN_FILES` (`:65-74`). Hệ quả: `buildMap(..., "light")` (`:449-458`) hiện overlay light block của `theme/tokens.css`/`soc.tokens.css` nhưng **vẫn lấy canvas dark** `#020617` từ `index.css:57`.
2. Task 2b (`PLAN_W0:112`) yêu cầu variant `*/light` resolve **cả fg lẫn bg** từ `theme/tokens.css` light + `light-theme.css` ⇒ cách implement tự nhiên là đưa `light-theme.css` vào light map (sửa `VARIANTS.order` `:86-99` hoặc `buildMap` `:449-458`).
3. Khi đó, với pair `accent-cyan-on-bg-primary` (`mjs:117`):
   - bg `--color-bg-primary` light = `#f8fafc` (`packages/web/src/theme/light-theme.css:11`);
   - fg `--accent-cyan` = `var(--color-accent-primary, #06b6d4)` (`packages/web/src/theme/tokens.css:5`) ⇒ resolve tới `--color-accent-primary` light = `#0891b2` (`light-theme.css:26`; base `#06b6d4` tại `index.css:75`);
   - SOC light block **không còn** override `--accent-cyan` (`soc.tokens.css:141`).
4. Tự tính: `#0891b2` trên `#f8fafc` = **3.519:1** < 4.5 ⇒ pair FAIL ở cả 2 variant light.
5. Baseline lưu `accent-cyan-on-bg-primary@soc/light = 3.77:1` (`packages/web/scripts/check-ui-baseline/check-theme-contrast.json:12,46`):
   - cùng ID mà ratio **3.77 → 3.52** ⇒ rơi vào `worse` (`mjs:860-871`) ⇒ **exit 1**;
   - `accent-cyan-on-bg-primary@shell/light` **chưa có** trong baseline ⇒ rơi vào `fresh` (`mjs:851`) ⇒ **exit 1**.
6. Vì sao các vòng trước không thấy: state hiện tại ID `soc/light` đã `gone` (`contrast-green.md:13-34` không liệt kê) do `--accent-cyan` base `#06b6d4` trên canvas tối cho 8.31; chỉ khi canvas chuyển sang light thì lỗi mới lộ ra. Negative proof `PLAN_W0:113` chỉ inject 2 cặp `text-muted-on-bg-panel*@*/light` ⇒ **không bắt được** lỗi này.

**Tác động**: dù đã thêm `--text-muted: #475569` đúng như O-24/O-26, Task 2 Step 4 (`PLAN_W0:107`) vẫn `exit 1` ⇒ agent sẽ kẹt tại blocker mới hoặc (tệ hơn) bị cám dỗ `--update-baseline` để xanh — vi phạm R2 (`PLAN_W0:33,107`; `HANDOFF:99`).

**Cách sửa (bắt buộc, Owner chốt — không tự chọn)**:
- (1) Task 2b phải yêu cầu **full simulation** sau khi đổi resolve, assert đồng thời `fresh = 0` · `worse = 0` · `newUndecodable = 0` · `lostToUndecodable = 0` (`mjs:848-871`), và ghi **toàn bộ** danh sách ID thay đổi vào evidence — không chỉ 2 cặp text-muted như `PLAN:113`.
- (2) Chốt phương án accent light, ví dụ:
  - (i) đổi mapping `--color-accent-primary` light `#0891b2 → #0e7490` (tự tính **5.121:1** trên `#f8fafc`, pass) **thông qua mapping trong `packages/web/scripts/check-light-theme.mjs` rồi chạy `--update`** — KHÔNG sửa tay `light-theme.css:1-2` (auto-generated); hoặc
  - (ii) giữ `--accent-cyan` ở base `#06b6d4` ngay ở light bằng cơ chế resolve có chủ đích, kèm negative proof riêng; hoặc
  - (iii) nâng baseline — **R2 cấm**, trừ khi Owner ghi rõ lý do.
- (3) Cập nhật `HANDOFF:34,42` + Entry ledger mới theo quyết định; audit vòng 6 trước khi đụng gate.

## 3. Kiểm các yêu cầu kiểm chứng khác — PASS

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| Task 2b (a) resolve cả chữ + nền light | CÓ | `PLAN_W0:112` |
| Task 2b (b) negative proof inject hành vi cũ, đỏ đúng 2 cặp | CÓ (nhưng **chưa đủ** — O-28) | `PLAN_W0:113` |
| Task 2b (c) cấm đổi baseline JSON | CÓ | `PLAN_W0:114` |
| Task 2b (d) cấm đổi hợp đồng exit-code | CÓ ("exit 0 = subset baseline") | `PLAN_W0:114`; `mjs:39-46,848-871` |
| Task 2b (e) audit v5 AGREE mới được sửa gate | CÓ | `PLAN_W0:114`; `HANDOFF:42`; `LEDGER:6` |
| Cấm `--update-baseline` / báo PASS giả (R2) | CÓ | `PLAN_W0:32,33,107,151`; `HANDOFF:99`; `LEDGER:6` |
| Entry 543 tồn tại, 542 còn, không trùng | CÓ | `LEDGER:1` (543), `:11` (542); Entry 544 chưa có |
| D11 + disposition O-26 | CÓ | `HANDOFF:42` (D11 thay D10:41), `:34` |
| Mâu thuẫn O-05 vs O-25 được loại bỏ | **MỘT PHẦN** — tổng hợp đúng, test mẫu sai (O-27) | `PLAN_W0:53,63,105` vs `:81,84,90` |

## 4. Gate status

Audit **docs-only** ⇒ **CHƯA CHẠY**: `vitest`, `check-theme-contrast`, `check-token-conflict`, `check:tokens/contrast/light-theme`, `npx tsc --noEmit`, `npm run build`, staging, browser, ảnh before/after. Chỉ chạy script Node tự tính WCAG (mục 1) — không phải gate của repo. Mọi con số trong O-28 là trace tĩnh `file:line` + arithmetic có lệnh tái lập; cần simulation thật ở vòng sau để xác nhận.

## 5. Next steps / Owner

1. **Planner** (trước khi code): sửa O-27 trong `PLAN_W0` rev6 + cập nhật handoff/ledger; mở rộng O-28 theo mục (1).
2. **Owner**: chốt phương án accent light O-28 mục (2)(i/ii/iii) — đây là quyết định semantics gate, không được agent tự chọn.
3. **Auditor vòng 6**: audit lại CHỈ O-27/O-28; chỉ `AGREE` (0 blocker/0 major) mới cho phép sửa `check-theme-contrast.mjs` và tiếp Task 2b/3–5.
4. **Owner**: giữ nguyên lệnh "không `--update-baseline`, không báo PASS giả" cho tới khi gate xanh thật.

**Người chịu trách nhiệm**: coordinator/Owner (quyết định) + agent lập kế hoạch W0 (sửa plan) + auditor vòng 6 (xác minh).
