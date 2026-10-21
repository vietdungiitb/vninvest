# HANDOVER — UI Standardization W1 (light theme (a) + M-10 + T-1 + T-6)

> **PR:** [#273](https://github.com/vietdungiitb/vninvest/pull/273) · **Nhánh:** `feat/uistd-w1` · **Base:** `feat/uistd-w0` (PR #272) — **PR XẾP TẦNG**
> **Owner chốt (2026-10-21):** (1) light theme theo **phương án (a)** — làm cho **đúng** (KHÔNG tắt); (2) M-10 + **phần còn lại** (T-1..T-6) theo khuyến nghị.
> **Tài liệu:** plan `docs/PLAN_UI_STANDARDIZATION_W1.md` · **báo cáo slice:** `docs/SUMMARY_uistd-w1.md` · **ledger:** Entry 391 · **claim:** `uistd-w1-theme` (done) + `uistd-w1-fixes` (done)
> **Lessons áp dụng:** [L-F03] [L-F05] [L-F06] [L-F08] [L-F11] [L-V01] [L-V02] [L-V03] [L-V05] [L-V06] [L-003] [L-005] [L-007] [L-008] [L-M02] [L-V08] [L-V09]

---

## 1. Kết quả (ĐO THẬT trên staging, cùng script + cùng route)

| Route | H1 light (trước → sau) | Chữ dưới AA (trước → sau) |
|---|---|---|
| `/admin/users` | **1.0000:1 (VÔ HÌNH)** → **13.98:1** | 28/60 → **5/60** |
| `/dashboard` | 1.0471:1 → **12.85:1** | 29/60 → **5/60** |
| `/portfolios/manage` | 17.85:1 (đã tốt) | 9/60 → 8/60 |
| `/operations-center` | — | → 5/60 |

**Còn lại 5 phần tử dưới AA / ~700 mẫu**: 4× breadcrumb chip (chữ `#0f172a` trên nền `#2563eb` = 3.45:1) + 1× "Treemap" 4.45:1 ⇒ **W1-C backlog** (không che).

## 2. Cách làm (để phiên sau không phải đoán)

| Tầng | Nội dung | File |
|---|---|---|
| T1 | `:root[data-theme="light"]` cho **26 token** `--color-*` (bg/text/border/accent + 8 token ngữ nghĩa) | `packages/web/src/theme/light-theme.css` — **SINH BẰNG SCRIPT**, đừng sửa tay |
| T2 | remap `text-*`/`bg-*`/`border-*` **theo property** + **185 biến thể alpha** (giữ alpha bằng `color-mix(in oklab, X N%, transparent)`) | cùng file |
| T3 | gate `check-light-theme.mjs` — mỗi màu Tailwind dùng trong `src` phải được phủ ở light; class mới màu tối ⇒ gate đỏ | `packages/web/scripts/check-light-theme.mjs` + điểm gọi trong `pre-push-gate.mjs` |

**Vì sao KHÔNG sửa 89 file:** `--color-slate-950` dùng **cả làm chữ** (admin `text-slate-950`) lẫn **làm nền** (36 file) ⇒ remap biến sẽ phá chữ admin ⇒ remap **theo property** giữ được cả hai (đúng pattern repo ở `index.css:302-389`).

**Đổi giá trị token ⇒ phải chạy lại:** `node packages/web/scripts/check-light-theme.mjs --update` (sinh lại CSS) + **đo lại baseline** `check-theme-contrast` (tập vi phạm phải **không đổi**; nếu đổi ⇒ ghi rõ trong commit).

## 3. Việc đã xong ở W1-B

| Việc | Kết quả |
|---|---|
| **M-10** | `CommercialPage.module.css`: **41** `var(--color-*)` → họ đảo được (`--text-*`/`--border-default`/`--bg-panel`/`--accent-cyan`/`--accent-blue`) ⇒ 0 `var(--color-*)` còn lại |
| **T-1** | Bỏ **11** inline `outline:"none"` ở 6 file ⇒ `check-focus-ring` **8 → 2** |
| **T-6** | Khối `commercialPage` (5 key) vào **cả 2** locale `src/i18n/{vi,en}.js`; catalog TS chỉ giữ fallback EN ⇒ `check:i18n-hardcoded` **0** |

## 4. Gate đã chạy (exit thật)

`tsc` 0 · `build` 0 (verify rule trong **CSS build**) · `vitest` 0 · `eslint` 0 error · `check-token-conflict` 0 · `check-focus-ring` 0 · `check-heading-contract` 0 · `check-theme-contrast` 0 · `check-light-theme` 0 (227 màu/424 file) + self-test **5/5** · `check:i18n-hardcoded` 0 · `i18n:scan:strict` 0 · `pre-push-gate` **29 PASS / 0 FAIL**.

**CHƯA CHẠY (không ghi PASS):** `npm run test:visual` · BE test · **ảnh chụp thật light/dark** (L-V05) · staging E2E ngoài 10 route ghim.

## 5. Còn lại — W1-C backlog (theo thứ tự nên làm)

| # | Việc | Ghi chú |
|---|---|---|
| C-1 | 4× breadcrumb chip (chữ tối trên nền xanh, 3.45:1) | class `truncate` lấy nền từ **phần tử cha**; cần probe cha để truy rule (nguồn sâu hơn 1 tầng) |
| C-2 | 1× "Treemap" 4.45:1 | biên (thiếu 0.05) |
| C-3 | **M-6**: đọc 12 token `--pf-*` (màu tăng/giảm — quan trọng nhất app chứng khoán) ở **runtime** | cần staging + đo lại baseline |
| C-4 | **M-7**: `check-a11y-runtime` lấy mẫu 250 phần tử text **đầu** ⇒ đo shell, chưa đo nội dung route | lấy mẫu phân bố theo vùng ⇒ đo lại baseline staging |
| C-5 | **T-2**: staging **có dữ liệu đóng (seed)** ⇒ bỏ cờ `--advisory` (gate runtime mới chặn thật) | hiện gate runtime chạy **advisory** vì app sống ⇒ tập vi phạm đổi theo dữ liệu (113 → 141 → 173) |
| C-6 | Plan **v1.4**: bỏ "AC-5"/"AC-6" (plan v1.3 chỉ có **AC-1..AC-4**) | sửa ở `docs/PLAN_UI_STANDARDIZATION_W0.md` |
| C-7 | **Ảnh chụp thật** light/dark 4 route (L-V05: phải **mở ảnh ra xem**) | bằng chứng cho Owner |

## 6. Bẫy môi trường đã gặp (đừng lặp lại)

| Bẫy | Hiện tượng | Cách xử lý |
|---|---|---|
| **Push trong worktree** | `global-config-drift` FAIL (gate so **byte**; main tree CRLF còn worktree LF) | **push từ main tree** — không sửa gate (L-G08) |
| **Blob EOL "mixed"** | file bị ghi qua PowerShell rồi Node ⇒ `normalize-eol` **chặn mọi lần sửa sau** (kẹt vĩnh viễn) | **xoá rồi thêm lại** (gate bỏ qua file bị xoá) với EOL chuẩn — **LF cho `.mjs`** |
| **Double-encoding UTF-8** | comment trong script thành `â€”` | viết generator bằng **ASCII thuần** |
| **Probe "0 lỗi" giả** | chưa đăng nhập ⇒ redirect `/login` (8 phần tử) | luôn có **control "đã đo thật"** (≥40 phần tử chữ + H1 ≠ logo shell) + selector login đúng (`input#auth-login-username, input[type="text"], ...`) |
| **Specificity** | `[data-theme="light"] .X` (0,2,0) thua rule CSS-module (0,2,0) | dùng `:root[data-theme="light"] .X` (0,3,0) |
| **Class bị scope hash** | `soc.components.css` qua barrel ⇒ `_statusBadge_1c09a_1` | override **tại file định nghĩa**, không từ file global |

## 7. Việc cần làm TIẾP THEO (theo thứ tự)

1. Owner **merge PR #272** (W0) ⇒ rồi **PR #273** (W1, base `feat/uistd-w0`) — PR #273 là **xếp tầng**, cần #272 trước.
2. Chạy `pwsh -File scripts/agent-sync.ps1` trên `feat/uistd-w1` (rebase → check migration → gate) **trước** khi merge.
3. Sau khi merge: `pwsh -File scripts/agent-cleanup.ps1 -Branch feat/uistd-w1 -Execute` + dọn 2 worktree `agent-uistd-w1a/w1b` (và 3 worktree W0 `agent-uistd-a1/a2/a3`).
4. Mở **W1-C** (mục 5) — ưu tiên **C-7 (ảnh chụp thật)** + **C-3/M-6 (màu tăng/giảm)** + **C-1 (breadcrumb chip)**.
5. **Wave W2–W3** (migrate 41 route sang template `CommercialPage`) chỉ mở sau khi light theme ổn định + template đã qua W1-C.

## 8. Trạng thái claim / PR / worktree

| Agent | Branch | Trạng thái |
|---|---|---|
| `uistd-w1-theme` | `feat/uistd-w1-theme` | **done** (claim đóng) |
| `uistd-w1-fixes` | `feat/uistd-w1-fixes` | **done** (claim đóng) |
| `uistd-w0-coord` | `feat/uistd-w0` (PR #272) | **done** (claim đóng) |
| — | `feat/uistd-w1` (PR #273, tích hợp) | chờ merge |

Worktree: `C:\MujocoProjects\agent-uistd-w1a` (W1-A), `agent-uistd-w1b` (W1-B) — **xoá sau khi merge** (3 worktree W0 cũng còn: `agent-uistd-a1/a2/a3`).
