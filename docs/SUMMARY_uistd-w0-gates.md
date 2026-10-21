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
