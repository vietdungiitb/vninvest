# AUDIT CODE — UI Standardization W0 (S1 + S2 + S3)

> **Vòng audit:** 2 (vòng 1 → `FAIL` → sửa → vòng 2 → `PASS_WITH_MAJOR`)
> **Nhanh đang audit:** `feat/uistd-w0` @ b72bbe244 merge(feat/uistd-w0-gates): sua 2 BLOCKER + 8 MAJOR cua 5 gate UI (audit vong 2) · **Base:** `dev` @ `e7b008f25`
> **Diff:** 31 file · **+7.738 / −0** · không file nào bị viết lại toàn bộ (`git diff --numstat`: mọi dòng là `+`)
> **Auditor:** sub-agent độc lập, **read-only** (không sửa file, không commit) + vòng sửa của slice S2
> **Kế hoạch:** `docs/PLAN_UI_STANDARDIZATION_W0.md` (v1.3) · **Báo cáo slice:** `docs/SUMMARY_uistd-w0-{template,gates,tokens}.md`
> **Lessons áp dụng:** [L-V01] control có đáp án biết trước · [L-V02] phản chứng claim · [L-V03] lệnh đo ghi file ⇒ `git status` · [L-V04] test xanh vì lý do sai · [L-V06] parser màu trả null ≠ trong suốt · [L-F03] không thêm token/class vào `soc.module.css`

---

## 0. TÓM TẮT (5 finding nghiêm trọng nhất)

1. **B-1 (BLOCKER, đã đóng)** — `check-a11y-runtime` coi route **KHÔNG ĐO ĐƯỢC** là "không có vi phạm" ⇒ in "gate xanh" **và gợi ý hạ baseline**. Đã chứng minh bằng chạy thật (4/10 route timeout ⇒ 44 vi phạm bị gán nhãn "đã hết"). Đã sửa: route chưa đo ⇒ `CHUA CHAY` + **không** kết luận xanh + `--update-baseline` bị từ chối.
2. **B-2 (BLOCKER, đã đóng)** — `check-theme-contrast`: một cặp FAIL đổi sang `oklch()` ⇒ rơi khỏi tập ⇒ gate báo "đã hết" ⇒ **xanh** + gợi ý hạ baseline (đường lách 1 dòng). Đã sửa: cặp trong baseline rơi vào `undecodable` ⇒ **vi phạm mới (exit 1)**.
3. **M-1/M-2/N-1 (MAJOR, đã đóng)** — 3 gate so **id** mà id **không mang thông tin cần so**: token-conflict chỉ so *tên* (đổi *giá trị* không bị phát hiện); focus-ring/heading-contract dùng *đường dẫn file* (file đã có trong baseline thêm vi phạm vẫn xanh). Đã sửa: id mang **giá trị** (`name@sha1`) / **số lần** (`file#N`).
4. **M-3/M-4/M-5 (MAJOR, đã đóng)** — `check-focus-ring` bỏ lọt đúng các cách xoá focus ring phổ biến nhất: `shadow-none`/`ring-none`/`border-none`, `outline: 0`, `box-shadow: none`, `border-color: transparent`, và inline `style={{outline:"none"}}`. Đã sửa; **gate chặt hơn ⇒ phát hiện thêm 6 vi phạm thật** (mục 4).
5. **M-10 (MAJOR, CÒN LẠI — cần Owner)** — `CommercialPage.module.css` dùng họ token `--color-*` **không đảo theo light theme** ⇒ ở light theme chữ = `#f1f5f9` trên nền sáng = **1.0955:1 (vô hình)**. Chưa route nào import ⇒ chưa gây lỗi sống, nhưng W1–W3 sẽ nhân bản lỗi này vào 41 route. **Cần Owner chốt cùng câu hỏi light theme của `docs/ADR_THEME_LIGHT_20261020.md` §5.**

---

## A. BẢN ĐỒ KIẾN TRÚC (3 slice)

| File | Dòng | Trách nhiệm | Ghi chú audit |
|---|---|---|---|
| `packages/web/src/components/commercial/CommercialPage.tsx` | 118 | Template gốc: 6 vùng, `useId()`, `role="region"` | đúng 1 `<h1>` (L77) · 0 `<main>` · prop `state` ngoài C1 (RV-2) |
| `packages/web/src/components/commercial/primitives/CommercialState.tsx` | 73 | loading/empty/error | `aria-busy` ở node khác vùng live (L39 vs L52) · `role="alert"` luôn mount (L41) |
| `packages/web/src/components/commercial/primitives/CommercialTable.tsx` | 66 | Bảng dữ liệu | `<caption>` (L28) · `scope="col"` (L32) · `scope="row"` (L50) |
| `packages/web/src/components/commercial/primitives/CommercialToolbar.tsx` | 23 | Nhóm toolbar | `role="group"` + `aria-label` khi có label |
| `packages/web/src/components/commercial/primitives/CommercialMeta.tsx` | 26 | Metadata | `<dl>/<dt>/<dd>` |
| `packages/web/src/components/commercial/commercialMessages.ts` | 41 | Catalog VI/EN | 4 chuỗi VI hardcode (L13–17) — reservation RV-1 (xem §6) |
| `packages/web/src/components/commercial/CommercialPage.module.css` | 305 | Style template (`.cm-`) | **0 hex cứng** ✔ · nhưng họ token không đảo light (M-10) |
| `packages/web/src/components/__tests__/commercial-page.component.test.tsx` | 261 | 20 test contract | không snapshot · có **parity 2 chiều** class↔CSS (L177–197) |
| `packages/web/scripts/check-token-conflict.mjs` | 466 | Token trùng `@theme` + `:root` | id = `name@sha1(giá trị)` (đã sửa M-1) |
| `packages/web/scripts/check-heading-contract.mjs` | 363 | Page tự dựng `<h1>` | id = `file#N` (đã sửa N-1) |
| `packages/web/scripts/check-focus-ring.mjs` | 409 | `focus:outline-none` không có ring | id = `file#N`; loại trừ `*-none`; bắt `outline:0` + inline style (đã sửa M-2..M-5) |
| `packages/web/scripts/check-theme-contrast.mjs` | 1029+ | Cặp text/bg 2 theme × 2 variant + canvas runtime | undecodable ⇒ exit 1; "xấu đi" ⇒ exit 1 (đã sửa B-2) |
| `packages/web/scripts/check-a11y-runtime.mjs` | 972+ | Runtime Playwright: h1/main/AX name/focus/contrast/target/overflow | unmeasured ⇒ `CHUA CHAY` (đã sửa B-1) |
| `packages/web/scripts/check-ui-baseline/*.json` | 6 file | Baseline 5 gate (+ 1 scope) | tái-key, tập vi phạm gốc **giữ nguyên** (§4) |
| `packages/web/scripts/measure-theme-tokens.mjs` | 979 | Đo 4 route × 2 theme + 2 mô phỏng | ép `oklch`→`rgb` **đúng** (L347–355 + canvas L376–391) · CONTROL qua đúng hàm đo |
| `scripts/pre-push-gate.mjs` | +39 | **CHỈ THÊM** vòng lặp gọi 5 gate + timeout | không sửa gate cũ |
| `docs/ADR_THEME_LIGHT_20261020.md` | 253 | ADR: R1–R5, 2 phương án, câu hỏi chặn Owner | nêu rõ "chưa sửa gì cả" + "Light theme HIỆN VẪN HỎNG" |

## B. KẾT QUẢ CHẠY GATE THẬT (đã chạy, exit code thật)

### B.1 — 5 gate UI (trên `feat/uistd-w0`, sau khi sửa)

| Lệnh (cwd = `packages/web`) | Exit | Output thật |
|---|---|---|
| `node scripts/check-token-conflict.mjs` | **0** | 13 vi phạm / baseline 13 · `✓ khong co vi pham MOI` |
| `node scripts/check-focus-ring.mjs` | **0** | 8 vi phạm / 415 file · baseline 8 · `✓ khong co vi pham MOI` |
| `node scripts/check-heading-contract.mjs` | **0** | 25 vi phạm / 99 file · baseline 25 · `✓ khong co vi pham MOI` |
| `node scripts/check-theme-contrast.mjs` | **0** | 32 cặp / baseline 32 · `✓ khong co vi pham MOI` |
| `node scripts/check-a11y-runtime.mjs` | **0** | 113 vi phạm / 10 route · baseline 113 · `✓ khong co vi pham MOI` |
| `--self-test` × 5 | **0** | 4 + 6 + 5 + 4 + 8 = **27 case** PASS |

### B.2 — Probe suite 17/17 (fixture **ngoài repo**, baseline đo trên fixture **SẠCH** rồi mới mutate)

| Nhóm | Probe | Vòng 1 | Vòng 2 |
|---|---|---|---|
| focus-ring | `shadow-none` / `ring-none` / `border-none` | xanh | **bắt** |
| focus-ring | CSS `outline:none;box-shadow:none` / `outline:0` / `border-color:transparent` | xanh | **bắt** |
| focus-ring | inline `style={{outline:"none"}}` | xanh | **bắt** |
| focus-ring | file **đã baseline** thêm 5 vi phạm | xanh | **bắt** |
| token-conflict | **đổi giá trị** token xung đột / thêm khai báo thứ ba | xanh | **bắt** |
| heading-contract | page **đã baseline** thêm 2 `<h1>` | xanh | **bắt** |
| theme-contrast | cặp FAIL → `oklch()` | xanh | **bắt** (B-2) |
| theme-contrast | cặp FAIL **xấu đi** (cùng id) | xanh | **bắt** (thêm) |
| *(control)* | 4 CONTROL "vi phạm mới" | bắt | bắt |

⇒ **17/17 PASS**. Probe nằm ở `%TEMP%\opencode\probe-suite.cjs` — **không** commit vào repo (giữ repo sạch).

### B.3 — Baseline gốc (đo lại trên cây đã merge)

| Lệnh | Exit | Kết quả | So với baseline `dev` |
|---|---|---|---|
| `npx tsc --noEmit` | **0** | — | 0 ⇒ 0 |
| `npm run build` | **0** | `✓ built in 29.47s` | 0 ⇒ 0 |
| `npx vitest run` | **0** | 169 file / 1162 test PASS | 168/1142 ⇒ **+1 file / +20 test** (S1) |
| `npm test` (jest) | **1** | 3 suite / 9 test FAIL, 18/21 PASS, 268 total | **3/9 ⇒ delta 0** (cùng 3 suite: route-contract, field-contract, WorkstationLayout) |
| `npx eslint src` | **0** | 4251 problems, **0 error** | 0 err / 4191 warn ⇒ **+60 warning** `react/jsx-no-literals` (S1) |
| `npm run check:tokens` | **1** | đúng 1 lỗi nền `brokerData.css: #c4b5fd` | 1 ⇒ 1 ⇒ **delta 0** |
| `npm run check:contrast` | **0** | PASS (7 tone pairs × 2 modes) | 0 ⇒ 0 |
| `npm run check:dom-landmarks` | **0** | PASS | 0 ⇒ 0 |
| `npm run i18n:scan:strict` | **0** | code sạch | 0 ⇒ 0 |
| `node scripts/check-lessons.mjs` | **0** | 45/60 lesson sạch | 0 ⇒ 0 |
| `node packages/web/scripts/check-multi-agent.mjs` | **0** | 0 lỗi, 0 trùng migration | 0 ⇒ 0 |
| `node scripts/normalize-eol.mjs` | **0** | 0 file thay đổi | 0 ⇒ 0 |
| `node scripts/pre-push-gate.mjs` | **0** | 28 PASS / 0 FAIL (main tree) | +5 dòng `ui-check-*` |

## C. CONTRADICTIONS (plan ↔ code) — đã xử lý hoặc ghi nhận

| # | Plan nói | Code thực tế | Xử lý |
|---|---|---|---|
| C-1 | `PLAN:176` (AC-3): "CSS/JSX mới … chạy `check:tokens` ⇒ không hex cứng" | `check-tokens.mjs:40` chỉ quét `.css`/`.module.css`, **không** quét `.tsx/.jsx` | **Đã ghi nhận** trong `SUMMARY_uistd-w0-template.md`; ý nghĩa AC đạt (test `AC-5b` quét hex trên 6 file JSX) nhưng **gate không bảo vệ phần JSX cho slice sau** ⇒ ticket W1 |
| C-2 | `PLAN:176`: "không `focus:outline-none` thiếu ring (gate `check-focus-ring`)" | gate coi `shadow-none` là "đã có ring" | **ĐÃ SỬA** (M-3/M-4/M-5) |
| C-3 | `PLAN:167`: "cấm exit 0 dù có vi phạm" | `check-a11y-runtime.mjs:709-712` coi route lỗi là không vi phạm | **ĐÃ SỬA** (B-1) |
| C-4 | `PLAN:186`: "so tập, không so số" | `oklch()` làm tập **bị thu nhỏ** ⇒ "đã hết" ⇒ xanh | **ĐÃ SỬA** (B-2) |
| C-5 | `PLAN:167`: staging thiếu ⇒ exit 0 + `CHUA CHAY` | `pre-push-gate.mjs:455-457` ưu tiên regex "không có vi phạm MOI" ⇒ giấu nhãn `CHUA CHAY` | **ĐÃ SỬA** (N-10) |
| C-6 | `PLAN:105`: H1 light = "1.01:1" | đo thật = **1.0000:1** | sai số làm tròn của plan (ADR ghi đúng 1.0000:1) |
| C-7 | `PLAN:106`: panel `/portfolios/manage` "16.21:1 dark / 17.85:1 light" | ADR chỉ nêu **giá trị token** (`rgb(8 23 52)`), **không có** con số contrast đo được | **KHÔNG có lệnh tái lập** ⇒ không dùng con số này (vi phạm chính quy tắc `PLAN:16` R-4/R-5) ⇒ ghi vào ledger là **số suy ra, không đo** |
| C-8 | `SUMMARY_uistd-w0-template.md:37`: `src/i18n/{vi,en}.js` là **deny-list §2** | deny-list §2 **không** có file này (xem `.githooks/pre-commit:21-33`) | **ĐÃ SỬA** trong `SUMMARY` (lý do đúng của RV-1 là **scope**, không phải deny-list) ⇒ coordinator có thể gộp key i18n ở PR riêng **không cần `--no-verify`** |

## D. FINDINGS — vòng 1 và trạng thái sau sửa

### BLOCKER (2) — **đã đóng**

| ID | File:line | Thực tế | Tác động | Fix | Trạng thái |
|---|---|---|---|---|---|
| B-1 | `check-a11y-runtime.mjs:698-716, 845-848` | route KHÔNG ĐO ĐƯỢC ⇒ không tính vi phạm ⇒ in "gate xanh" + gợi ý hạ baseline (113→69) | 40% phạm vi ghim không được canh; hồi quy a11y không bao giờ bị chặn | tách `unmeasured[]`; `CHUA CHAY` + không kết luận xanh; `gone` chỉ route đã đo; `--update-baseline` từ chối (exit 2) | **ĐÃ ĐÓNG** — chạy thật: 1 route timeout ⇒ `CHUA CHAY: 1/10 route KHONG DO DUOC` + `KHONG ket luan 'gate xanh'` |
| B-2 | `check-theme-contrast.mjs:201-202, 535-539, 814-843` | cặp FAIL → `oklch()` ⇒ rơi khỏi tập ⇒ "đã hết" ⇒ xanh + gợi ý hạ baseline | đường lách 1 dòng làm hỏng contrast mà gate báo đã sửa | cặp baseline rơi vào undecodable ⇒ exit 1; cặp mới undecodable ⇒ exit 1; chặn `--update-baseline` | **ĐÃ ĐÓNG** — probe exit 1 |

### MAJOR (10) — 9 đã đóng, 1 còn lại

| ID | File:line | Thực tế | Trạng thái |
|---|---|---|---|
| M-1 | `check-token-conflict.mjs:176` | id = **tên** ⇒ đổi giá trị không bị phát hiện | **ĐÃ ĐÓNG** — id = `name@sha1(giá trị)` |
| M-2 | `check-focus-ring.mjs:126-128` | id = **đường dẫn** ⇒ file đã baseline thêm vi phạm vẫn xanh | **ĐÃ ĐÓNG** — id = `file#N` |
| M-3 | `check-focus-ring.mjs:56` | `shadow-none`/`ring-none`/`border-none` bị coi là thay thế | **ĐÃ ĐÓNG** — loại trừ `*-none` |
| M-4 | `check-focus-ring.mjs:134-142` | CSS `outline:0` không bắt; `box-shadow:none`/`border-color:transparent` bị coi là thay thế | **ĐÃ ĐÓNG** |
| M-5 | `check-focus-ring.mjs:74-103` | inline `style={{outline:"none"}}` không bắt | **ĐÃ ĐÓNG** — quét raw source |
| M-6 | `check-theme-contrast.mjs:99-124, 535-539` | 12 cặp `--pf-*` (màu tăng/giảm) **không đọc được** ⇒ không được canh | **CÒN LẠI (W1)** — nay **ghi nhận tường minh** trong baseline (`undecodable[]`) + chặn cặp mới ⇒ không còn "biến mất im lặng" |
| M-7 | `check-a11y-runtime.mjs:84, 319-327` | lấy mẫu 250 phần tử text **đầu** ⇒ đo **shell**, chưa đo nội dung route | **CÒN LẠI (W1)** — cần lấy mẫu phân bố theo vùng ⇒ phải đo lại baseline trên staging |
| **M-7b (mới, vòng 3)** | `check-a11y-runtime.mjs` (đo trên **app sống**) | tập vi phạm **đổi theo dữ liệu**: 3 lần đo liên tiếp trên **cùng 1 build** (fingerprint khớp) cho **113 → 141 → 173** ⇒ delta **không** chứng minh hồi quy | **ĐÃ XỬ LÝ (vòng 3)** — thêm cờ `--advisory`: báo cáo nhưng **exit 0**; `pre-push-gate` gọi kèm cờ ⇒ **4 gate tĩnh** mới chặn push. Cần staging **có dữ liệu đóng** để chặn thật (**T-2**) |
| M-8 | `check-a11y-runtime.mjs:821-826` | baseline không gắn build staging ⇒ so số trên 2 build khác nhau | **ĐÃ ĐÓNG** — build lệch ⇒ `CHUA CHAY` + không in "đã hết" + không kết luận xanh |
| M-9 | `scripts/pre-push-gate.mjs:74-84, 433-460` | `run()` không timeout ⇒ push treo vô hạn (worst-case ≈ 8 phút) | **ĐÃ ĐÓNG** — timeout 300 s + `killSignal`; hết giờ ⇒ SKIP + `CHUA CHAY` (không chặn push) |
| M-10 | `CommercialPage.module.css:4,19,41,47,83,89,141,146,155,178,210,215,230,254,273,285,294,299,304` | dùng `var(--color-text-primary)` … **không đảo theo light theme** (`index.css:61` không có override light) ⇒ ở light theme = **1.0955:1** | **CÒN LẦI — CẦN OWNER** (cùng câu hỏi `ADR_THEME_LIGHT_20261020.md` §5) |

### MINOR (10) / NIT (5) — tóm tắt

- **ĐÃ ĐÓNG**: N-1 (id heading-contract), N-10 (nhãn `CHUA CHAY` bị che), N-4 (CONTROL self-test theme-contrast chỉ assert "0 vi phạm" ⇒ còn yếu — ghi nhận W1).
- **GHI NHẬN (không sửa trong W0)**: N-3 (allowlist `commercial/**` vô hiệu vì scope gate chỉ `pages/**`), N-5 (`parseColor` trả `a:0` cho màu rỗng), N-6 (`waitReady` nuốt lỗi timeout), N-7 (SUMMARY nói i18n là deny-list — **đã sửa** ở C-8), N-8 (`check:i18n-hardcoded` không quét `src/components/commercial` ⇒ 4 chuỗi VI mới không gate nào bắt; khi gộp key i18n phải sửa **cả 2 locale** vì `i18n/index.js:42` fallback về VI), N-9 (số "585 file" trong ADR đã cũ ⇒ 593), T-1 (SUMMARY ghi 230 dòng/18 test thay vì 261/20), T-2 (5 dòng claim cho 3 worker), T-3 (**AC-5 không tồn tại** trong plan v1.3 — chỉ AC-1..AC-4; `PLAN:39` còn sót "AC-6"), T-4 (60 warning `react/jsx-no-literals` phần lớn false positive), T-5 (4 file tài liệu nguồn nằm ngoài SCOPE/rollback của cả 3 slice).

## E. VERDICT

### Vòng 1 (trước khi sửa)

# ❌ **FAIL** — 2 BLOCKER · 10 MAJOR · 10 MINOR · 5 NIT

S1 và S3 **XANH** (contract C1 tuân thủ chính xác, test thật 20/20, 0 hex cứng, mọi số đo trong ADR tái lập được tuyệt đối). Vấn đề nằm ở **S2**: 2 gate có đường **xanh giả đã chứng minh bằng chạy thật**.

### Vòng 3 (bổ sung sau lần push đầu bị chặn — trạng thái hiện tại)

Lần push đầu bị **hook chặn** vì gate runtime báo 39 vi phạm mới. Điều tra cho thấy tập vi phạm **đổi theo dữ liệu** (113 → 141 → 173 trên cùng build) ⇒ **không** thể dùng làm hàng rào cứng trên app sống ⇒ thêm `--advisory` (báo cáo, không chặn) và chuyển **4 gate tĩnh** thành hàng rào chặn push. Chi tiết: `docs/SUMMARY_uistd-w0-gates.md` §12.

### Vòng 2 (sau khi sửa)

# 🟡 **PASS_WITH_MAJOR** — 0 BLOCKER · **1 MAJOR cần Owner** (M-10) · 2 MAJOR kỹ thuật tồn đọng (M-6, M-7 — đều cần đo lại baseline trên staging nên chuyển W1)

| Mức | Vòng 1 | Vòng 2 |
|---|---|---|
| BLOCKER | 2 | **0** |
| MAJOR | 10 | **1** (M-10 — cần Owner) + 2 tồn đọng (M-6/M-7 → W1) |
| MINOR | 10 | 1 (N-4 → W1), 9 ghi nhận |
| NIT | 5 | ghi nhận |

**Điều kiện để nâng lên PASS** (chỉ cần Owner chốt M-10): 5 gate đã **thật** bắt lỗi (17/17 probe) ⇒ có thể dùng làm hàng rào chặn hồi quy cho W1–W3 **với điều kiện** 2 gate staging (a11y-runtime) phải chạy trên staging ổn định (xem M-7 + §7).

## F. CÂU HỎI CẦN LÀM RÕ

| # | Cho ai | Câu hỏi |
|---|---|---|
| 1 | **Owner** | **Light theme** (ADR §5): (a) làm light theme đúng — ≥89 file / 497 chỗ màu chữ cứng + 36 file nền tối cứng; hay (b) tắt light theme khỏi bộ chọn (~3 dòng)? Số đo trong ADR **tái lập được** (đã chạy lại, khớp tuyệt đối) và light theme **hiện vẫn hỏng** (H1 `/admin/users` = 1.0000:1) |
| 2 | **Owner** | **M-10**: đổi họ token của `CommercialPage.module.css` sang họ đảo được (`--text-*`/`--bg-*`) **trước W1** không? (Đụng NG-1 ⇒ cần Owner đồng ý) |
| 3 | **Coordinator** | 5 key i18n `commercialPage.*` gộp vào `src/i18n/{vi,en}.js` ở PR nào? (**không** nằm trong deny-list §2 ⇒ không cần `--no-verify`) — bắt buộc sửa **cả 2 locale** cùng lúc (`i18n/index.js:42` fallback về VI) |
| 4 | **Coordinator** | `check-a11y-runtime` cần staging **ổn định**: đo thật 4/10 route timeout (lần chạy của auditor) và 1/10 (lần chạy của tôi) ⇒ gate chỉ kết luận `CHUA CHAY`. Nên: tăng timeout route, hay đưa gate ra khỏi đường push (chạy theo lịch)? |
| 5 | **Coordinator** | Baseline 5 gate ghi **fingerprint asset** (chưa ghi sha staging) — plan C2 yêu cầu "ghi sha staging đang chạy" ⇒ có bổ sung `stagingSha` vào JSON baseline không? |

## G. ĐÁNH GIÁ THEO AC CỦA PLAN (v1.3 định nghĩa **AC-1..AC-4**; **AC-5 không tồn tại**)

| AC | Nội dung | Kết luận | Bằng chứng |
|---|---|---|---|
| **AC-1** (S3) | Đo light theme, **không sửa**, viết ADR có câu hỏi chặn | 🟢 **ĐẠT** | đo thật: control 21.00/4.48 OK; H1 `/admin/users` **20.1728:1 (dark) / 1.0000:1 (light)**; 60 phần tử, dark 8/60, light 28/60; canvas `#030712` cả 2 theme; token conflict 13/11 — **tái lập được tuyệt đối**; `git diff --numstat` = **0 file .css** |
| **AC-2** (S2) | Gate bắt lỗi thật, **không xanh giả**, có điểm gọi | 🟡 **ĐẠT SAU VÒNG 2** | 27 self-test case + **17/17 probe**; staging thiếu ⇒ exit 0 + `CHUA CHAY`; `pre-push-gate` in 5 dòng `ui-check-*` (28 PASS / 0 FAIL ở main tree) — **đã đóng 2 BLOCKER + 9 MAJOR** |
| **AC-3** (S1) | Template render đúng 6 vùng, 1 `<h1>`, không phá DOM | 🟢 **ĐẠT** | test **20/20 PASS**; 0 hex cứng (CSS + 6 file JSX); `check:tokens` delta 0; `:focus-visible` có ring (L165–168) |
| **AC-4** (tất cả) | Không làm hỏng gì | 🟢 **ĐẠT** | tsc 0 · lint 0 err · vitest 169/1162 · jest **3/9 = baseline** · build 0 · check:tokens delta 0 · check:contrast 0 · check:dom-landmarks 0 · i18n:scan:strict 0 · check-lessons 0 · check-multi-agent 0 · normalize-eol 0 |
| **AC-5** | — | ⚪ **KHÔNG TỒN TẠI** | plan v1.3 chỉ định nghĩa AC-1..AC-4 (`PLAN:157,162,171,180`); `PLAN:15,47` nhắc "AC-1..AC-5" và `PLAN:39` còn sót "AC-6" ⇒ **sửa plan v1.4** |

## H. KIẾN NGHỊ

1. **Merge** `feat/uistd-w0` vào `dev` **sau** khi S3 → S1 → S2 (đã làm) và **sau** khi baseline 5 gate được tái-key (đã làm, tập gốc giữ nguyên).
2. **Không dùng 5 gate làm hàng rào chặn cứng cho W1–W3** cho tới khi (a) M-10 được Owner chốt, (b) staging của `check-a11y-runtime` ổn định (M-7). Tới đó gate là **báo động sớm**, ghi rõ trong plan W1.
3. **Sửa ngay ở W1** (rẻ, đã biết chính xác): 6 inline `outline:"none"` (§4 của `SUMMARY_uistd-w0-gates.md`), lấy mẫu a11y phân bố theo vùng (M-7), đọc token `--pf-*` ở runtime (M-6), gộp 5 key i18n (C-8/N-8).
