# AUDIT ROUND 4 — UI/UX SSOT program (rev4)

> **Verdict: AGREE.** 0 blocker, 0 major. Còn 3 reservation **minor** (R1–R3), không chặn S0 merge docs / cấp worktree S1.
> O-25 (major duy nhất của vòng 3) **đã đóng đúng fix (a)**; 5 minor note C1–C5 từ vòng 3 đều đã xử lý.

- **Ngày**: 2026-11-19 · **Auditor**: phiên độc lập, read-only; không claim, không sửa plan/code, không tạo worktree, không deploy.
- **Phạm vi**: CHỈ O-25 + C1–C5 từ `docs/evidence/uiux-ssot/AUDIT_ROUND3_20261119.md:26-55`; **không audit lại O-01..O-24** đã đóng (`AUDIT_PLAN_PROGRAM_20261119.md:87-205`, `:249-257`).
- **Base**: `dev@2b10b3016` (lệnh `git rev-parse --short HEAD`, chạy trong phiên). Branch hiện tại `dev`.
- **Tài liệu đọc**: `AUDIT_ROUND3_20261119.md` · `AUDIT_PLAN_PROGRAM_20261119.md` · `PLAN_UIUX_W0_TOKEN_SSOT_20261119.md` · `PLAN_UIUX_W1_CHROME_20261119.md` · `HANDOFF_2026-11-19_UIUX-SSOT.md` · `CODE_CHANGE_AUDIT_LEDGER.md` Entry 541/540.
- **Nguyên tắc phân biệt**: đây là **PLAN audit**. Code trên disk **chưa** áp dụng rev4 — `packages/web/src/theme/tokens.css:3` vẫn là `--text-muted: var(--color-text-muted, #64748b)` và `packages/web/src/components/soc/soc.tokens.css:146` vẫn là `--text-muted: #475569`. Đây là **trạng thái chưa implement đúng thiết kế**, không phải finding chống lại plan. Mọi kiểm tra dưới đây đối chiếu **văn bản plan** với yêu cầu O-25; không suy diễn code đã đổi.

---

## A. Disposition O-25 — FIXED (theo fix (a) đã chốt)

| # | Yêu cầu từ vòng 3 | Bằng chứng rev4 | Kết luận |
|---|---|---|---|
| A1 | `theme/tokens.css:3` = `--text-muted: #94a3b8` **giá trị trực tiếp**, không `var(--…)` | `PLAN_W0:21` "Đổi `theme/tokens.css:3` từ `var(--color-text-muted, #64748b)` sang `#94a3b8` — sửa fallback không đủ vì `index.css:67` định nghĩa biến"; `:103` Step 3 "**giá trị trực tiếp**, không phải fallback — C1" | ✅ |
| A2 | `--text-muted` **KHÔNG** khai trong light block (`theme/tokens.css:65-82`) | `PLAN_W0:7` "**không** thêm `--text-muted` vào light block (O-25 fix a)"; `:32` "**KHÔNG** khai `--text-muted` trong light block"; `:53`, `:81`, `:84` assert vắng mặt; `:102` "**KHÔNG** thêm `--text-muted: #475569`" | ✅ |
| A3 | W0 Task 1: `LIGHT_KEYS = 5`, `FORBIDDEN_LIGHT = ["--accent-cyan","--text-muted"]`, có control âm/dương | `PLAN_W0:63` khai đúng tên/số lượng; `:74-76` control dương `--bg-panel: red;` = true, âm comment/prefix = false; `:78` assert base = null; `:84` assert 2 tên bị cấm vắng ở `themeLight` | ✅ |
| A4 | Task 2 Step 2 dời **đúng 5** light key, **KHÔNG** có `--text-muted: #475569` | `PLAN_W0:102` liệt kê 5 key (`--text-primary`, `--text-secondary`, `--border-default`, `--bg-panel`, `--bg-panel-soft`) + `--text-on-accent: #0f172a`, đồng thời cấm `--accent-cyan: #0e7490` (O-24) và `--text-muted: #475569` (O-25); `:95` xoá 13 base + 7 light khỏi `soc.tokens.css` (trong đó có `:146`) | ✅ |
| A5 | Task 2 Step 4 assert 3 cặp `text-muted*@shell/light` không xấu đi + known limitation | `PLAN_W0:104` "**và 3 cặp `text-muted*@shell/light` không xấu đi** (3.75/4.24/3.75 giữ nguyên, không về 2.66/2.66/2.66)", kèm `contrast-green.md`, 10 tỉ lệ tự tính, "known limitation: app light dev-only có `text-muted` 2.45 — sửa gate riêng, không nâng baseline" | ✅ |
| A6 | Handoff có D10 + disposition O-25; D1 ghi giữ `#94a3b8`, không hội tụ | `HANDOFF:33` disposition O-25 fix (a); `:40` **D10 mới**; `:39` D1 rev2 "muted dark **giữ `#94a3b8`** … net delta 0" (xem thêm R2 về wording); `PLAN_W0:21` ghi trực tiếp "**giữ `#94a3b8` (KHÔNG hội tụ về `#64748b`, KHÔNG override light)**" | ✅ |

**Kết luận A**: O-25 **đóng**. Rev4 không còn instruction nào thêm `--text-muted` vào light block; net delta = 0; baseline không bị nâng (`PLAN_W0:33`, `HANDOFF:40`).

---

## B. 5 minor note từ vòng 3 (`AUDIT_ROUND3:48-54`)

| Note | Yêu cầu | Bằng chứng | Kết luận |
|---|---|---|---|
| C1 | `--text-muted` direct value | `PLAN_W0:21,103` | ✅ FIXED |
| C2 | Net delta muted = 0; D1 bỏ mũi tên "#94a3b8→#64748b" | `PLAN_W0:21` (không hội tụ), `HANDOFF:39-40` (giữ, net delta 0) | ✅ FIXED (xem R2) |
| C3 | Dev flag precedence 3 nhánh | `PLAN_W0:126` early-return khi `devThemeFlag.active`, giữ dark khi không có flag | ✅ FIXED |
| C4 | Detector gate cập nhật trong Task 2, baseline-locked | `PLAN_UIUX_W1_CHROME_20261119.md:39,68` cập nhật `check-heading-contract.mjs` trong Task 2, "không nâng baseline" | ✅ FIXED |
| C5 | Re-run simulation, `contrast-green.md` kèm 10 tỉ lệ | `PLAN_W0:101` (red), `:104` (green + 10 tỉ lệ) | ✅ FIXED |

---

## C. Tự tính WCAG AA (script độc lập, KHÔNG copy số planner)

Lệnh tái lập (script đã lưu tạm tại `C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\audit_round4_calc.js`, chạy với cwd repo):

```
node "C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\audit_round4_calc.js"
```

Nội dung script (để tái tạo ở máy khác):

```js
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = h => 0.2126*lin(parseInt(h.slice(1,3),16)) + 0.7152*lin(parseInt(h.slice(3,5),16)) + 0.0722*lin(parseInt(h.slice(5,7),16));
const cr = (a,b) => { const x=L(a), y=L(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
const d="#020617", l="#f8fafc";
for (const t of ["#475569","#94a3b8","#64748b"])
  console.log(t, cr(t,d).toFixed(3), cr(t,l).toFixed(3));
console.log(Math.sqrt((L(l)+0.05)/(L(d)+0.05)).toFixed(4));
```

Kết quả chạy thật trong phiên:

| Text | Trên `#020617` (gate dark — `index.css:57`) | Trên `#f8fafc` (app light — `theme/light-theme.css:11`) |
|---|---:|---:|
| `#475569` | **2.662** ❌ | **7.243** ✅ |
| `#94a3b8` | **7.868** ✅ | **2.451** ❌ |
| `#64748b` | **4.239** ❌ (baseline 4.24) | **4.548** ✅ |

- `(L_light+0.05)/(L_dark+0.05) = 19.2806` ⇒ `max min-contrast = sqrt(19.2806) = **4.3910** < 4.5`.
- ⇒ **Kết luận "không có giá trị đơn lẻ pass cả hai" là ĐÚNG** (đúng cả về mặt toán học: tích của 2 tỉ lệ không phụ thuộc màu text). Khớp `PLAN_W0:32` (≈19.2 / ≈4.38) và `CODE_CHANGE_AUDIT_LEDGER.md:16` (Entry 541). Số auditor vòng 3 (`AUDIT_ROUND3:36-38`: 2.36/7.58) lệch do nền đo khác, nhưng hướng kết luận không đổi.
- Cross-check O-24 (không mở lại, chỉ confirm số plan): `#0f172a` trên `#06b6d4` = **7.353** · trắng trên `#06b6d4` = 2.428 · trắng trên `#0e7490` = 5.358 · `#06b6d4` trên `#020617` = 8.309 · `#0e7490` trên `#020617` = 3.765 · `#94a3b8` trên `#0f172a` = 6.963 — khớp `AUDIT_ROUND3:17`, `:84`.

---

## D. Ledger & vệ sinh file

- Sau khi prepend Entry 542 (11 dòng mới): `CODE_CHANGE_AUDIT_LEDGER.md:1` = Entry 542, `:12` **Entry 541 tồn tại** (1 lần), `:22` **Entry 540 còn nguyên** (1 lần), `:31` Entry 539. Script đếm `^## Entry (\d+):` → `542=1, 541=1, 540=1, total=153`. Không có Entry 541/540 trùng.
- Entry `386` bị lặp tại `:1715` và `:1782` (số đã cập nhật sau prepend) — **lỗi lịch sử có từ trước**, không liên quan rev4, không thuộc phạm vi audit này; ghi nhận để owner dọn riêng, **không** tạo objection mới.
- U+FFFD = **0**, CJK = **0** trên cả 3 file: `PLAN_W0:1-141`, `HANDOFF:1-105`, `CODE_CHANGE_AUDIT_LEDGER.md:1-1787`.
- `git status --short` khi vào phiên: branch `dev`, `M docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 541/540/539 của planner, baseline `+91/-0`) + 8 path docs chưa track (`docs/PLAN_UIUX_*.md`, `docs/handoffs/…`, `docs/evidence/uiux-ssot/`, `docs/AUDIT_UIUX_FULL_20261119.md`). Không có file code production nào bị sửa bởi audit này.

---

## E. Verdict từng slice (vòng 4 — chỉ W0 thay đổi)

| Slice | Verdict vòng 3 | Verdict vòng 4 | Blocker/Major |
|---|---|---|---|
| W0 `feat/uiux-ssot-w0` | NEED_REVISION (O-25) | **AGREE** | 0 / 0 |
| W1 chrome `feat/uiux-chrome-w1` | AGREE | **AGREE** (không đổi; C4 đã xác nhận `:39,68`) | 0 / 0 |
| W1 a11y `feat/uiux-a11y-w1` | AGREE | **AGREE** (không đổi) | 0 / 0 |
| W2 `feat/uiux-exp-w2` | AGREE | **AGREE** (không đổi) | 0 / 0 |
| W3 `feat/uiux-cmd-w3` | AGREE | **AGREE** (không đổi) | 0 / 0 |

---

## F. Quality gates

**docs-only ⇒ CHƯA CHẠY** (không có dòng code production nào thay đổi trong rev4): simulation `check-theme-contrast` sau fix, staging deploy, browser/Chromium, E2E Playwright, `npm run test` / `test:components`, `npx tsc --noEmit`, `npm run build`, ảnh before/after. Không có kết luận nào trong audit này dựa trên các gate đó. Các gate đã chạy thật trong phiên: tự tính WCAG (mục C), đếm Entry, quét U+FFFD/CJK, `git status`, `git rev-parse`.

---

## G. Reservation (minor — KHÔNG chặn)

- **R1 (minor)** — Nhãn revision lạc hậu: `PLAN_W0:1` và `PLAN_UIUX_W1_CHROME:1` tự ghi "rev2", `HANDOFF:1,3` ghi "rev2 — chờ audit vòng 2", trong khi `CODE_CHANGE_AUDIT_LEDGER.md:12` (Entry 541) gọi "Plan rev4" và nội dung đã chứa D9/D10, O-24/O-25 (`HANDOFF:32-33`). Đề xuất S0 đổi nhãn thành rev4 + cập nhật dòng trạng thái trước merge; không ảnh hưởng kỹ thuật của O-25.
- **R2 (minor)** — `HANDOFF:39` (D1) ghi "giữ `#94a3b8` … net delta 0" nhưng không có cụm từ "KHÔNG hội tụ" như yêu cầu note C2; cụm từ này có ở `PLAN_W0:21`. Đề xuất thêm "(không hội tụ về `#64748b`)" vào D1 handoff cho khớp từ khóa.
- **R3 (minor)** — `PLAN_W0:84` assert vắng mặt `--text-muted`/`--accent-cyan` chỉ trên `themeLight`; chưa có assert tường minh rằng `socLight` (`soc.tokens.css` light block) đã xoá `--text-muted: #475569` sau Task 2 Step 2 (`:102`). Lệnh xoá đã có ở `:95`, nhưng nên thêm 1 assert để khoá regression. `soc.tokens.css:196` (`--soc-c-94a3b8: #475569`) là legacy alias **không phải** `--text-muted`, nằm ngoài yêu cầu O-25.

---

## H. Next steps / Owner

1. **Coordinator (S0)**: merge 6 file docs (handoff + 5 plan) + Entry 541/542 vào `dev` **trước** `new-agent.ps1`; tuỳ ý đóng R1–R3 trong cùng commit. Không append dòng `released` (D8, `HANDOFF:48,67`).
2. **S1 `uiux-ssot-w0`**: cấp worktree sau S0; thực thi `PLAN_W0` Task 1→5 fail-before, chạy simulation red/green với assert 3 cặp text-muted ở `:104`, ghi `contrast-green.md` kèm known limitation; **không** `--update-baseline` (R2, `PLAN_W0:33`).
3. **Program riêng (Owner)**: sửa gate `check-theme-contrast` để include `light-theme.css` (giải quyết gốc inverse problem), không nâng baseline để che regression.
4. **Owner ledger**: dọn Entry 386 trùng (`CODE_CHANGE_AUDIT_LEDGER.md:1715,:1782`) ở ticket riêng.

---

**Kết luận**: **AGREE** — 0 blocker, 0 major; O-25 FIXED, C1–C5 FIXED. Cho phép S0 merge docs và cấp worktree S1. 3 reservation minor (R1–R3) nên đóng trước merge nhưng không chặn.
