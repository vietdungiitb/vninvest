# AUDIT VÒNG 6 — O-27 / O-28 / PLAN rev6 (UI/UX W0 Token SSOT)

- **Ngày**: 2026-11-19 · **Branch**: `feat/uiux-ssot-w0` · **Worktree**: `D:/Mujoco Projects/uiux-ssot-w0`.
- **Scope**: CHỈ O-27/O-28 từ audit v5 (`docs/evidence/uiux-ssot/AUDIT_ROUND5_20261119.md:26-72`); KHÔNG audit lại O-01..O-26.
- **Vai trò**: auditor độc lập (session khác người viết plan/code), **read-only** — không sửa plan/code, không claim, không chạy test/build/staging.
- **Verdict**: **AGREE** — **0 blocker, 0 major**, 3 minor (documentation hygiene, không chặn). O-27 và O-28 đã đóng trong plan rev6 (`docs/PLAN_UIUX_W0_TOKEN_SSOT_20261119.md:1`). Theo điều kiện Owner (`PLAN:116`; `HANDOFF:43`), verdict này **cho phép sửa `check-theme-contrast.mjs` / tiến Task 2b**. R2 vẫn giữ nguyên: không `--update-baseline` để che regression, không báo PASS giả (`PLAN:34,107,116`).

## 1. Kiểm chứng WCAG (script Node riêng — KHÔNG phải gate repo)

Lệnh tái lập: Node 24.14.1, pipe một here-string JS qua `node`, công thức `srgbLum` + `contrast` y hệt `packages/web/scripts/check-theme-contrast.mjs:137-150`. Không chạy gate của repo.

| Cặp (fg / bg) | Tự tính | Kỳ vọng plan/ledger | Kết luận |
|---|---|---|---|
| `#0e7490` / `#f8fafc` | **5.121** | 5.12 (`PLAN:33,108`; `LEDGER:5`) | khớp, > 4.5 ✅ |
| `#ffffff` / `#0e7490` | **5.358** | 5.36 (`PLAN:33,106,108`; `LEDGER:5`) | khớp, > 4.5 ✅ |
| `#0f172a` / `#0e7490` | **3.332** | 3.33 (`PLAN:84`; `LEDGER:5`) | khớp, < 4.5 ⇒ đúng lý do bỏ override chữ đen |
| `#475569` / `#f8fafc` | **7.243** | 7.24 (`PLAN:32,108`; `LEDGER:5`) | khớp, > 4.5 ✅ |
| `#0891b2` / `#f8fafc` | **3.519** | 3.519 (`AUDIT_ROUND5:19,58`) | khớp — regression gốc O-28 bị triệt tiêu bởi mapping mới |

⇒ Phương án D12/O-28 đúng về mặt toán học: accent light `#0e7490` pass cả trên nền sáng (5.121) lẫn với chữ trắng (5.358); nếu giữ override chữ đen O-24 thì `#0f172a/#0e7490` = 3.332 ❌. Con số này chính là căn cứ plan dùng để bỏ override (`PLAN:33,84,106`).

## 2. O-27 — ĐÓNG

Tiêu chí v5 (`AUDIT_ROUND5:26-44`) yêu cầu đồng bộ code mẫu Task 1 với Task 2. Đối chiếu rev6:

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| `LIGHT_KEYS` 6, có `--text-muted` | CÓ | `PLAN:64` (`LIGHT_KEYS` (6, gồm `--text-muted`)), `:80`, `:81` |
| `FORBIDDEN_LIGHT` chỉ `["--accent-cyan"]` | CÓ | `PLAN:64`; vòng lặp `:83` dùng biến đó (không còn hard-code 2 tên như `AUDIT_ROUND5:35`) |
| assert `theme.light` có `--text-muted: #475569` | CÓ | `PLAN:81` |
| assert `theme.light` KHÔNG có `--text-on-accent: #0f172a` | CÓ | `PLAN:84-85` |
| SOC light vắng cả 2 tên | CÓ (giữ nguyên) | `PLAN:86-87` |
| Task 2 Files có nhiệm vụ sửa file test | CÓ | `PLAN:100` — "`LIGHT_KEYS` 5→6, bỏ `--text-muted` khỏi `FORBIDDEN_LIGHT`, ... thêm assert `--text-muted: #475569` + assert không có `--text-on-accent: #0f172a`" |
| Step 2 kỳ vọng 13 base + 6 thiếu + 1 cấm | CÓ | `PLAN:90` |

Các dòng v5 bị khiếu nại đã được thay trực tiếp: `:81` (cũ: cấm `--text-muted` ở theme light) → assert có `#475569`; `:84` (cũ: cấm 2 tên) → dùng `FORBIDDEN_LIGHT`; `:90` (cũ: 5 thiếu + 2 cấm) → 6 thiếu + 1 cấm; `:100` (cũ: thiếu nhiệm vụ sửa test) → bổ sung. `PLAN:90` còn thêm cảnh báo phải sửa test rev4 trên disk **trước** khi chạy — đúng `AUDIT_ROUND5:42`.

**Kết luận**: O-27 không còn blocker/major. (Phần mã nguồn trên disk vẫn rev4 — `token-ssot.component.test.ts:12-18` `LIGHT_KEYS` 5 / `FORBIDDEN_LIGHT` 2, `:54-58` assert cấm `--text-muted` ở `theme.light`; đây là trạng thái "chưa sửa theo rev6" đúng kỳ vọng, không phải lỗi plan.)

## 3. O-28 — ĐÓNG

Tiêu chí v5 (`AUDIT_ROUND5:46-72`) yêu cầu Task 2b có đủ (a)-(e). Đối chiếu:

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| (a) mapping `#0891b2 → #0e7490` qua `check-light-theme.mjs --update`, KHÔNG sửa tay `light-theme.css` | CÓ | `PLAN:33,112`. Khả thi đã kiểm chứng: mapping nằm tại `check-light-theme.mjs:146` (`"--color-accent-primary": "#0891b2"`); cờ `--update` tại `:319` và `:434-440` ghi đè CSS; `light-theme.css:1-2` header "`KHONG sua tay`", `:26` giá trị hiện tại `#0891b2` |
| (b) full simulation `fresh=0 · worse=0 · newUndecodable=0 · lostToUndecodable=0` + list toàn bộ ID | CÓ | `PLAN:115`. Cả 4 trường tồn tại thật: `check-theme-contrast.mjs:851` `fresh`, `:856` `lostToUndecodable`, `:859` `newUndecodable`, `:868-871` `worse` — trích dẫn `(mjs:848-871)` của plan **chính xác** |
| (c) negative proof 4 ID | CÓ | `PLAN:114` — `text-muted-on-bg-panel*@*/light` VÀ `accent-cyan-on-bg-primary@*/light` (không còn chỉ 2 cặp như `AUDIT_ROUND5:62`) |
| (d) cấm đổi baseline JSON + giữ hợp đồng exit 0 | CÓ | `PLAN:116`. R2 không bị vi phạm: `:126` cho phép `--update-baseline` chỉ **sau** khi gate thực sự 0 — đúng định nghĩa "không nâng baseline trước khi sửa thật" (`PLAN:34`) |
| (e) audit v6 AGREE mới được sửa gate | CÓ | `PLAN:116`; `HANDOFF:43` (D12: "Plan rev6 + audit v6 → mới được sửa gate"); `LEDGER:1-8` |

**Triệt tiêu root-cause v5 (trace tĩnh, chưa simulation thật)**: `check-theme-contrast.mjs:86-99` vẫn không đưa `light-theme.css` vào `VARIANTS.order` — đúng `AUDIT_ROUND5:52`. Task 2b `PLAN:112-113` bắt resolve cả fg lẫn bg light; với mapping mới `PLAN:112`, `--accent-cyan → --color-accent-primary` light = `#0e7490` thay vì `#0891b2`, nên pair `accent-cyan-on-bg-primary@*/light` = 5.121 ✅ thay vì 3.519 ❌ (`AUDIT_ROUND5:54-61`). Đây là trace `file:line` + arithmetic có lệnh tái lập (mục 1); **cần simulation thật ở Task 2 Step 4/2b để xác nhận** — xem mục 5.

## 4. Kiểm chứng bổ sung

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Tiêu đề rev6 + Global Constraints O-28 | CÓ | `PLAN:1` · `:33` |
| Review Focus #3 sửa theo rev5 (6 key, 1 cấm) | CÓ (nhưng còn tàn dư — M1) | `PLAN:54` |
| D12 + disposition | D12 có (`HANDOFF:43`); trạng thái rev6 tại `:3` | Bảng disposition §0 (`HANDOFF:8-34`) dừng ở O-26 (`:34`) — O-27/O-28 không có row riêng nhưng được phủ bởi D12 + header `:3` + `LEDGER:1-8`. Đủ traceability |
| Entry 545 hiện diện, 544 còn, không trùng | CÓ | `LEDGER:1` (545), `:10` (544); grep `^## Entry 54[45]:` trả đúng 2 kết quả |
| Cấm `--update-baseline` / báo PASS giả (R2) | CÓ | `PLAN:34,107,116,126`; `HANDOFF:53`; `LEDGER:5,8` |

## 5. Gate status

Audit **docs-only** ⇒ **CHƯA CHẠY**: `vitest`, `check-theme-contrast --no-runtime`, full simulation, `check-light-theme --update/--self-test`, `check-token-conflict`, `check:tokens/contrast/light-theme`, `npx tsc --noEmit`, `npm run build`, staging, browser, ảnh before/after. Chỉ chạy script Node tự tính WCAG (mục 1) — không phải gate repo. Mọi con số ở mục 3 là trace tĩnh + arithmetic; **không** suy diễn gate đã xanh.

## 6. Minor reservations (không chặn AGREE)

- **M1** — `PLAN:7,20,31,54` vẫn mô tả `--text-on-accent: #0f172a` là hành vi hiện hành (Architecture, bảng D1, O-24 trade-off, Review Focus #3 nhãn "(rev5)"), mâu thuẫn với `PLAN:33,85,100,106` (bỏ override). Cách sửa: thêm nhãn "đã bị O-28 bỏ" vào `:7,:20,:31`; đổi `:54` thành "**không** bổ sung `--text-on-accent` (O-28)". Không chặn vì code mẫu `:85` + Task 2 `:100,106` đã đúng và tự bắt lỗi nếu agent thêm override.
- **M2** — `PLAN:95,110` header Task 2 / Task 2b vẫn "(rev5)" dù nội dung rev6. Cách sửa: đổi thành "(rev6)".
- **M3** — `PLAN:100` cụm "bỏ assert cấm ở `theme.light`" dễ đọc nhầm thành xoá luôn guard `--accent-cyan` tại `:83` (vốn phải GIỮ). Cách sửa: viết rõ "thay loop `["--accent-cyan","--text-muted"]` bằng `FORBIDDEN_LIGHT` (chỉ `--accent-cyan`)".

## 7. Next steps / Owner

1. Auditor v6 → **AGREE**: Owner cho phép agent thực hiện Task 2b (`PLAN:110-116`) + Task 2 Step 2/4 (`:106,108`). Giữ R2.
2. Agent: sửa file test theo rev6 **trước** khi chạy (`PLAN:90`) → Task 1 red/`red.md` → Task 2 → Task 2b → ghi `contrast-green.md` (toàn bộ ID đổi), `gate-negative-light.md` (4 ID), full simulation 4 trường = 0.
3. Dọn M1-M3 khi planner tiện (không chặn gate).
4. Sau gate xanh thật: B8 re-audit (`PLAN:148`) → Entry ledger → PR. Không báo PASS khi còn đỏ.

**Người chịu trách nhiệm**: Owner (cho phép sửa gate) · agent W0 (implementation + evidence) · auditor B8 (re-audit).

## 8. Hygiene ghi file

Chỉ ghi 2 file theo chỉ định: file này + `docs/CODE_CHANGE_AUDIT_LEDGER.md` (prepend `## Entry 546`). Kiểm: U+FFFD = 0 · CJK = 0 · numstat khớp 2 file. Không đụng `AUDIT_ROUND5_20261119.md` (untracked, của session trước) hay bất kỳ file plan/code nào.
