# SUMMARY — `uistd-w0-gates` (S2 — 5 gate máy, baseline-locked)

> **Worker:** `uistd-w0-gates` · **Branch:** `feat/uistd-w0-gates` · **Worktree:** `C:\MujocoProjects\agent-uistd-a2`
> **Base:** `dev` @ `e7b008f25` · **Kế hoạch:** `docs/PLAN_UI_STANDARDIZATION_W0.md` (v1.3) — mục **C2**, **AC-2**
> **Claim:** `d3e87d405` (đã khai sẵn trước khi sửa dòng code đầu tiên — **không** khai lại)

---

## 1. Commit

| Commit | Nội dung |
|---|---|
| `d3e87d405` | claim (có sẵn, không do slice này tạo) |
| commit code | 5 gate script + 6 file baseline + `scripts/pre-push-gate.mjs` (thêm điểm gọi) |
| commit SUMMARY | `docs/SUMMARY_uistd-w0-gates.md` |

## 2. File đã tạo / sửa

| File | Vai trò |
|---|---|
| `packages/web/scripts/check-token-conflict.mjs` | scope **mode B** (3 file, khối `:root` + `@theme` của `index.css`; **không** tính block light) |
| `packages/web/scripts/check-heading-contract.mjs` | file tự dựng `<h1>`; allowlist = `commercial/**` + `ShellPageTemplate.js` + `adminUi.tsx` |
| `packages/web/scripts/check-focus-ring.mjs` | `focus:outline-none` không có ring/shadow/border thay thế |
| `packages/web/scripts/check-theme-contrast.mjs` | cặp text/bg đọc **file thật**, 2 theme, canvas runtime |
| `packages/web/scripts/check-a11y-runtime.mjs` | runtime Playwright: h1>1 trong main · main lồng · accessible name (AX tree) · focus ring · contrast · target<24px · tràn 320px |
| `packages/web/scripts/check-ui-baseline/*.json` | 6 file baseline (tập vi phạm) |
| `scripts/pre-push-gate.mjs` | **chỉ THÊM** vòng lặp gọi 5 gate (không sửa gate cũ) |

## 3. Mẫu BASELINE-LOCKED (mẫu chung của 5 gate)

```
exit 0  ⇔  tập vi phạm hiện tại ⊆ baseline đã ghi   (in ra tập vi phạm + baseline)
exit 1  ⇔  có vi phạm MỚI
exit 2  ⇔  KHÔNG VERIFY ĐƯỢC (thiếu baseline) — chỉ dùng cho gate cần bước --update-baseline
--self-test : chèn 1 vi phạm đã biết ⇒ exit ≠ 0
```
So **tập** (set), **không** so số.

**Ràng buộc N1 (đã sửa trong plan v1.3):** gate phụ thuộc staging, khi **không** chạy được ⇒ **exit 0** + in `CHUA CHAY: <lý do>` (vì `scripts/pre-push-gate.mjs:307` coi exit ≠ 0 là FAIL ⇒ chặn push oan). **Cấm** "exit 0 dù có vi phạm" (L-G02).

## 4. Gate đã chạy (exit code thật)

| # | Lệnh | Exit | Output thật |
|---|---|---|---|
| G1 | `node scripts/check-token-conflict.mjs` | **0** | `✓ khong co vi pham MOI — gate xanh (tap vi pham ⊆ baseline)` |
| G2 | `node scripts/check-heading-contract.mjs` | **0** | như trên |
| G3 | `node scripts/check-focus-ring.mjs` | **0** | như trên (2 vi phạm: `Sidebar.tsx:93`, `PortfolioHeatmap.js:589`) |
| G4 | `node scripts/check-theme-contrast.mjs` | **0** | như trên |
| G5 | `node scripts/check-a11y-runtime.mjs` (sau khi tạo baseline) | **0** | `✓ khong co vi pham MOI` — baseline **113 vi phạm / 10 route** |
| G6 | `--self-test` × 5 gate | **0** | `4 / 6 / 5 / 4 / 8 case theo dac ta` ⇒ **27 negative case** ⇒ gate **thật sự bắt lỗi** (hazard 9) |
| G7 | `node scripts/pre-push-gate.mjs` (repo root) | **1** | `27 PASS / 1 FAIL / 0 SKIP` — **FAIL duy nhất là `global-config-drift`, KHÔNG phải scope S2** (xem §7) |
| G8 | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng số migration — PASS` |
| G9 | `node scripts/normalize-eol.mjs` | **0** | `OK (0 file thay doi, tat ca khop dang blob goc)` |

**G7 — FAIL duy nhất (`global-config-drift`) là lỗi MÔI TRƯỜNG, không phải lỗi S2** (đã **đối chứng** theo L-G08):
- **main tree** `node scripts/verify-global-config.mjs` ⇒ `7 OK / 6 cập đổi byte` ⇒ **PASS**
- **worktree a2** ⇒ `DRIFT` ở `deny-extract.mjs`, `MANDATORY-WORKFLOW.md`, `scripts-package.json`
- Nguyên nhân: gate so **byte**, mà main checkout có file **CRLF** còn worktree checkout ra **LF** (`sha256(main disk)=8dbee31f47` ≠ `sha256(a2 disk)=4a92eae271`, còn `sha256(HEAD)=sha256(dev)=4a92eae271` ở **cả hai** ⇒ **không có khác biệt code**).
⇒ Xem §7 (reservation) — **push sẽ thực hiện từ main tree** nơi gate PASS.

## 5. Gate CHƯA CHẠY

| Gate | Lý do |
|---|---|
| `npm run test:visual` | không chạy trong slice này (baseline của plan ghi `CHƯA CHẠY`) |

## 6. Waiver xin

| # | Waiver | Vì sao |
|---|---|---|
| WV-1 | **KHÔNG** thêm npm alias trong `packages/web/package.json` | file **deny-list §2** ⇒ coordinator thêm sau khi merge (ghi trong claim note) |

## 7. Rủi ro đã biết

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R-1 | `global-config-drift` FAIL **chỉ trong worktree** (byte-compare + CRLF/LF) — L-G08 | push từ **main tree** (gate PASS ở đó); **không** sửa gate (gate đúng, môi trường lệch) |
| R-2 | Gate baseline-locked có thể bị "nâng baseline" để giấu hồi quy | mỗi lần nâng baseline phải kèm lý do trong commit body; `--update-baseline` in cảnh báo |
| R-3 | `check-a11y-runtime` cần staging + Playwright | có chế độ `CHUA CHAY` (exit 0) khi không có staging |
| R-4 | S2 **sửa** `scripts/pre-push-gate.mjs` — file dùng chung | chỉ **THÊM** vòng lặp; không sửa gate cũ; đã xác nhận 27 gate cũ vẫn PASS |

## 8. Việc ngoài scope đã thấy nhưng KHÔNG sửa

- `check-claims.cjs` (gate của skill) FAIL vì **claim stale có sẵn** của agent `ai-cc-uiux` (3 dòng `in-progress` chồng file) — thuộc agent đó, không đụng.
- 2 vi phạm focus-ring nằm ngoài scope S3 (`Sidebar.tsx:93`, `PortfolioHeatmap.js:589`) ⇒ đóng ở W1–W3.

## 9. Bài học quy trình (1)

**Một gate có "exit 2 = chưa verify được" sẽ chặn push** khi được gọi từ `pre-push-gate.mjs` (dòng 407 coi exit ≠ 0 là FAIL) ⇒ **mọi gate mới gọi từ pre-push phải quy ước exit 0 = "chưa chạy được, không chặn"** kèm nhãn `CHUA CHAY`, và **tách** "lỗi script" (exit ≠ 0) khỏi "chưa có môi trường" (exit 0) — nếu gộp, một lỗi script bị giấu dưới nhãn "chưa chạy" rồi im lặng.

## 10. SỬA THEO AUDIT CODE (vòng 2) — `docs/AUDIT_UI_STANDARDIZATION_W0.md`

Audit độc lập (verdict `FAIL`: **2 BLOCKER · 10 MAJOR · 10 MINOR · 5 NIT**) tìm ra **đường xanh giả (false green)** đã **chứng minh bằng chạy thật**. Đã sửa toàn bộ **BLOCKER + 8 MAJOR** trong slice này.

### 10.1 BLOCKER đã đóng

| ID | Vấn đề | Sửa | Bằng chứng |
|---|---|---|---|
| **B-1** | `check-a11y-runtime` coi route **KHÔNG ĐO ĐƯỢC** là "không có vi phạm" ⇒ gate xanh + gợi ý **hạ baseline** (4/10 route timeout ⇒ 44 vi phạm bị coi là "đã hết") | `unmeasured[]` tách khỏi `violations[]`; route chưa đo ⇒ in `CHUA CHAY: n/10 route KHONG DO DUOC` + **KHÔNG** in "gate xanh"; `gone` chỉ tính route đã đo; `--update-baseline` **từ chối** khi phạm vi chưa đủ (exit 2) | probe + chạy thật: lần chạy có 1 route timeout ⇒ `CHUA CHAY: 1/10 route KHONG DO DUOC` + `KHONG ket luan 'gate xanh'` (exit 0) |
| **B-2** | `check-theme-contrast`: 1 cặp FAIL đổi sang `oklch()` ⇒ rơi khỏi tập ⇒ gate báo "đã hết" ⇒ **xanh** + gợi ý hạ baseline | cặp trong baseline mà rơi vào `undecodable` ⇒ **VI PHẠM MỚI (exit 1)**; cặp **mới** không đọc được ⇒ tập đo được bị thu nho ⇒ exit 1; `--update-baseline` từ chối khi có cặp mất vào undecodable | probe `theme-contrast: cap FAIL doi sang oklch()` ⇒ **exit 1 (bắt)** |

### 10.2 MAJOR đã đóng

| ID | Vấn đề | Sửa |
|---|---|---|
| **M-1** | `check-token-conflict` chỉ so **tên** token ⇒ đổi **giá trị** không bị phát hiện | id = `name@<sha1(gia tri)>` ⇒ đổi giá trị ⇒ id đổi ⇒ vi phạm mới |
| **M-2 / N-1** | id = **đường dẫn file** ⇒ file đã có trong baseline thêm vi phạm vẫn xanh | id = `file#<so lan vi pham>` (không phụ thuộc dòng) |
| **M-3** | `shadow-none` / `ring-none` / `border-none` bị coi là "đã có ring" | `HAS_REPLACEMENT` loại trừ `*-none` |
| **M-4** | CSS `outline: 0` không bị bắt; `box-shadow: none` / `border-color: transparent` bị coi là thay thế | bắt `outline:(none|0)`; strip khai báo no-op trước khi kiểm tra thay thế |
| **M-5** | inline `style={{ outline: "none" }}` không bị bắt | quét **raw source** (key và value là 2 literal khác nhau) |
| **M-8** | baseline không gắn build staging ⇒ so số trên 2 build khác nhau mà vẫn kết luận xanh | build lệch ⇒ in `CHUA CHAY` + **không** in danh sách "đã hết" + không kết luận xanh |
| **M-9** | `pre-push-gate` gọi gate staging **không timeout** ⇒ push treo vô hạn | `run()` nhận `timeoutMs` (300 s cho gate UI) + `killSignal`; hết giờ ⇒ **SKIP + CHUA CHAY** (không chặn push) |
| **N-10** | dòng summary của pre-push ưu tiên "không có vi phạm MOI" nên giấu nhãn `CHUA CHAY` | `CHUA CHAY` được ưu tiên trước |
| *(thêm)* | cặp FAIL **xấu đi** (tỷ lệ thấp hơn, cùng id) không bị phát hiện | so tỷ lệ với `details` trong baseline ⇒ "XAU DI" ⇒ exit 1 |

### 10.3 Baseline được **tái-key** (KHÔNG nâng)

Id scheme đổi ⇒ baseline phải tái-key. **Tập vi phạm giữ nguyên** (đã kiểm bằng script so tập gốc):

| Baseline | Trước | Sau | Tập gốc |
|---|---|---|---|
| `check-token-conflict.json` | 13 | 13 | **13 → 13, thêm 0, bớt 0** |
| `check-token-conflict.root-only.json` | 11 | 11 | **11 → 11, thêm 0, bớt 0** |
| `check-focus-ring.json` | 2 | **8** | 2 → 2 (cũ) + **6 mới** (xem 10.4) |
| `check-heading-contract.json` | 25 | 25 | **25 → 25, thêm 0, bớt 0** |
| `check-theme-contrast.json` | 32 | 32 | **32 → 32** + `undecodable` chuyển format (12 → 12, cùng tập) |

### 10.4 Baseline focus-ring **+6** — gate chặt hơn, vi phạm là **THẬT**

Sau khi sửa M-3/M-4/M-5, gate phát hiện thêm **6 vi phạm thật** (inline `outline: "none"` — xoá focus ring của `<input>`/button):

| File | Số hit |
|---|---|
| `packages/web/src/components/TenantAdminCommandPalette.tsx:57` | 1 |
| `packages/web/src/components/screener/ScreenerFilterBuilder.tsx:77,96,120,143` | 4 |
| `packages/web/src/components/screener/ScreenerSchedulePanel.tsx:145` | 1 |
| `packages/web/src/components/soc/SocScreenerConfigForm.tsx:127` | 1 |
| `packages/web/src/components/soc/SocScreenerRuleModal.tsx:45,47,48` | 3 |
| `packages/web/src/pages/ScreenerPage.tsx:92` | 1 |

⇒ **KHÔNG sửa** (ngoài scope W0, các file này đang ở wave W1–W3) ⇒ đưa vào baseline + **ticket W1** (xem §11). Việc nâng baseline ở đây **không phải** để giấu hồi quy: tập vi phạm cũ **giữ nguyên**, chỉ có **thêm** các vi phạm mới mà gate giờ mới nhìn thấy.

### 10.5 PROBE SUITE — 17/17 đường lách đã bị chặn

Probe chạy trên **fixture ngoài repo** (`%TEMP%\opencode`), phương pháp: đo baseline trên fixture **SẠCH** → mutate → chạy lại ⇒ phải exit 1.

| # | Probe | Trước | Sau |
|---|---|---|---|
| 1 | focus-ring `shadow-none` | xanh | **bắt** |
| 2 | focus-ring `ring-none` | xanh | **bắt** |
| 3 | focus-ring `border-none` | xanh | **bắt** |
| 4 | focus-ring CSS `outline:none; box-shadow:none` | xanh | **bắt** |
| 5 | focus-ring CSS `outline:0` | xanh | **bắt** |
| 6 | focus-ring CSS `outline:none; border-color:transparent` | xanh | **bắt** |
| 7 | focus-ring inline `style={{outline:"none"}}` | xanh | **bắt** |
| 8 | focus-ring file **đã baseline** thêm 5 vi phạm | xanh | **bắt** |
| 9 | focus-ring CONTROL file mới | bắt | bắt |
| 10 | token-conflict **đổi giá trị** token xung đột | xanh | **bắt** |
| 11 | token-conflict thêm khai báo thứ ba | xanh | **bắt** |
| 12 | token-conflict CONTROL conflict mới | bắt | bắt |
| 13 | heading-contract page **đã baseline** thêm 2 `<h1>` | xanh | **bắt** |
| 14 | heading-contract CONTROL page mới | bắt | bắt |
| 15 | theme-contrast cặp FAIL → `oklch()` | xanh | **bắt** (B-2) |
| 16 | theme-contrast CONTROL cặp FAIL mới | bắt | bắt |
| 17 | theme-contrast cặp FAIL **xấu đi** (cùng id) | xanh | **bắt** (thêm) |

⇒ **17/17 PASS** (probe suite nằm ở `%TEMP%\opencode\probe-suite.cjs`, **không** commit vào repo).

### 10.6 Gate sau khi sửa (exit code thật)

| Gate | exit | Self-test |
|---|---|---|
| `check-token-conflict` | **0** | 4 case PASS |
| `check-focus-ring` | **0** | 6 case PASS |
| `check-heading-contract` | **0** | 5 case PASS |
| `check-theme-contrast` | **0** | 4 case PASS |
| `check-a11y-runtime` | **0** | 8 case PASS |

## 11. Việc còn lại (KHÔNG làm trong W0)

| # | Việc | Vì sao | Ai |
|---|---|---|---|
| T-1 | Sửa 6 inline `outline:"none"` (mục 10.4) | ngoài scope W0; file ở wave W1–W3 | W1 |
| T-2 | `check-a11y-runtime` chỉ lấy mẫu **250 phần tử text đầu** ⇒ đo **shell**, chưa đo nội dung route | cần lấy mẫu phân bố theo vùng; đổi ⇒ phải đo lại baseline trên staging | W1 |
| T-3 | 12 cặp `--pf-*` (màu tăng/giảm) **không đọc được** tĩnh | cần đọc token ở runtime qua canvas | W1 |
| T-4 | `check-theme-contrast` CONTROL của self-test chỉ assert "0 vi phạm ⇒ exit 0" | nên assert thêm "số cặp **đã đo** ≥ N" | W1 |
| T-5 | `check-heading-contract` không bắt `<h1>` tạo qua biến (`const Tag="h1"`) | giới hạn của phân tích tĩnh | W1 |
| T-6 | `CommercialPage.module.css` dùng họ token `--color-*` **không đảo theo light theme** (audit M-10) | cần Owner chốt cùng câu hỏi light theme của ADR §5 | Owner |

## 12. GATE RUNTIME PHẢI LÀ **ADVISORY** (vòng 3 — phát hiện khi push)

Khi push lần đầu, `check-a11y-runtime` chạy đủ 10 route rồi **BLOCKED push** với **39 "VI PHAM MOI"**. Điều tra:

| Lần đo (cùng 1 build staging, fingerprint **khớp**) | Số vi phạm | Ghi chú |
|---|---|---|
| Lúc tạo baseline (02:11) | **113** | baseline commit |
| Lần đo khi push (lần 1) | **141** | +28 |
| Lần đo ngay sau đó (vòng 3) | **173** | +32 |
| Lần đo lúc sửa (lần 4) | **173** | ổn định tạm thời |

⇒ **Tập vi phạm của app SỐNG đổi theo DỮ LIỆU** (có alert hay không, breadcrumb, `chip-count`, nội dung list) ⇒ **delta KHÔNG chứng minh hồi quy** ⇒ baseline cố định cho một phép đo runtime là **không khả thi**.

⇒ **Quyết định (vòng 3):** `check-a11y-runtime` có thêm cờ `--advisory`:
- `--advisory` ⇒ **báo cáo** đầy đủ (tập vi phạm + delta + lý do) nhưng **exit 0** ⇒ **KHÔNG chặn push**.
- **không** cờ ⇒ hành vi cũ (exit 1 khi có vi phạm mới) ⇒ dùng khi chạy **độc lập/CI** trên staging **có dữ liệu đóng (seed)**.
- `scripts/pre-push-gate.mjs` gọi gate này **kèm `--advisory`** ⇒ push path chỉ có **4 gate tĩnh** chặn (token-conflict, heading-contract, focus-ring, theme-contrast) — cả 4 đọc **file**, không phụ thuộc app sống.

⇒ **Điều kiện để gate runtime chặn thật** (ticket **T-2** ở §11): staging phải có **dữ liệu đóng** (seed) + đo lại baseline ⇒ khi đó bỏ `--advisory` ở pre-push.

⚠ **Không** sửa baseline theo từng lần đo (113 → 141 → 173) — baseline là **mốc tham chiếu**, không phải trạng thái hiện tại. Tài liệu này ghi rõ độ **không ổn định** để không ai tưởng gate này là hàng rào chắc.
