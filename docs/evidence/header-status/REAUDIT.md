# REAUDIT — B8 slice R1 Header realtime indicator (2026-11-19)

- **Auditor**: auditor độc lập, CHỈ ĐỌC (không sửa code, không commit)
- **Đối tượng**: branch `feat/header-realtime-status` @ `966a70ed1` (source slice còn uncommitted), baseline `dev` @ `62f0d1aba`
- **Audit trước**: `AUDIT_PLAN.md` (NEED_REVISION, O1–O6) → `CONSENSUS.md` (AGREE, R1–R4)
- **VERDICT: PASS** — 0 blocker, 0 major. 3 reservation **minor**, đóng ở bàn giao/B9.

---

## 1. Self-verification (auditor tự chạy / tự mở, KHÔNG tin tóm tắt)

| Lệnh / vị trí | Kết quả tự đo |
|---|---|
| `npx vitest run src/layouts/full/vertical/header/__tests__/Header.component.test.tsx` | **1 file / 13 test PASS** (5.54s) — khớp `GATES.md:32` |
| `npx tsc --noEmit` (packages/web) | `TSC_EXIT=0` |
| `npx eslint <4 file SCOPE>` | `0 error, 3 warning` (`react/jsx-no-literals` ở test `:54/:69/:73`) — khớp `GATES.md:34` |
| `node scripts/i18n-scan-strict.mjs` | `I18N_EXIT=0`; chỉ cảnh báo default-value key cũ, không key `layout.realtime.*` |
| 7 file pre-existing fail (chạy riêng, KHÔNG full suite) | **7 failed (7) · 13 failed / 14 passed (27)** — khớp `GATES.md:50` "GIỮNG NHƯ SAU slice" |
| `git diff --numstat` | ledger `8 0`; `vi/layout.js 8 0`; `en/layout.js 8 0`; `Header.tsx 46 8`; test `100 3` |
| encoding (node đọc byte 4 file SCOPE) | `U+FFFD = 0`, `endsLF = true` — khớp `GATES.md:39` |
| `git worktree list` | chỉ còn cây chính — worktree đối chứng đã gỡ (khớp `GATES.md:52`) |
| `docs/CLAIMS.md` dòng cuối | agent `header-realtime-status` = branch bỏ tiền tố `feat/`; status `in-progress`; 4 file SCOPE nằm trong cột `files`; **U+FFFD = 0** (ký tự lạ ở terminal chỉ là render) |

---

## 2. Trả lời 7 câu kiểm tra

**1. Resolver & nhãn "Offline" — ĐÚNG.** `Header.tsx:53-65`: `!ctx || consumerCount === 0 || status === 'idle' → idle`; `:60` `live|connected → connected`; `:61` `polling`; `:63` `disconnected`; `:64` default `connecting`. `consumerCount` ép `?? 0` ở `:58` rồi so sánh ở `:59` — **R1 đã đóng**, không còn bẫy precedence. Không có nhánh nào gán "Offline" sai: chỉ `disconnected` (`Header.tsx:50`) dùng nhãn `Offline` + chấm đỏ. Trang SOC (0 consumer) → `idle` = "Chưa theo dõi".

**2. Render — ĐÚNG.** `Header.tsx:366` (`title`) và `:372` (nhãn) đều gọi `t(indicator.labelKey, { defaultValue: indicator.defaultValue })`. Dot `:369` = `${indicator.dotClass}${indicator.pulse ? ' live-dot-pulse' : ''}`. 4 màu khớp metadata `:46-50`: `bg-slate-500` / `bg-amber-400` (connecting + polling) / `bg-emerald-400`+pulse / `bg-rose-400`.

**3. Test — assert dương tính thật, KHÔNG xanh giả.** `Header.component.test.tsx:250-256` `assertIndicator()` dùng `screen.getByText(label)` + `dot = labelEl.previousElementSibling` + `expect(dot!.className).toContain(dotClass)`; mock dịch `REALTIME_LABELS_VI:223-229` biến key thành chuỗi tiếng Việt thật (mạnh hơn cả yêu cầu "assert trên key" trong plan). 6 case AC0–AC5 ở `:258-303`, mỗi case assert label + class; AC4 test cả `live` lẫn `connected` + `live-dot-pulse`. Mock `useRealtimeContext` default `null` (`:112-113`) giữ nguyên 7 test cũ — 13/13 tự chạy xanh.

**4. i18n — ĐÚNG.** `locales/vi/layout.js:23-28` và `locales/en/layout.js:23-28` đều có object `realtime` với đủ 5 key `idle/connecting/polling/online/disconnected`. Grep `common.online` → 0 hit; `Header.tsx:46-50` chỉ dùng `layout.realtime.*`. Barrel `i18n/{vi,en}.js` vẫn nạp namespace `layout` ⇒ `t()` resolve thật, có `defaultValue` dự phòng.

**5. Reservation B4 — đã đóng R1–R4.** R1: `PLAN:68` có ngoặc `(consumerCount ?? 0) === 0` + code tách biến; R2: object `realtime` được tạo ở cả 2 locale; R3: comment MOCKS cập nhật `:24-31`, `vi.mock` `:47`, beforeEach `:106-128` (chỉ plan còn dẫn số dòng cũ — xem M2); R4: auditor tự chạy lại test/tsc/eslint/i18n/7-file fail — xanh/đúng.

**6. Full-suite 13 fail đối chứng — ĐỦ TIN.** `GATES.md:48-52` mô tả worktree tạm ở `966a70ed1` (HEAD sạch, source slice chưa commit), junction `node_modules`, chạy đúng 7 file → `13 failed | 14 passed (27)`. Auditor tự chạy lại **7 file trên cây hiện tại** (có slice) ra **con số y hệt** ⇒ slice không thêm fail; `git worktree list` xác nhận worktree đã gỡ. Không có điểm nào sai; chỉ không tự tạo lại worktree (ngoài phạm vi chỉ đọc).

**7. Blocker/major: KHÔNG CÓ.** 3 reservation minor bên dưới, không ảnh hưởng hành vi hay kết quả gate.

---

## 3. Reservation minor (ai đóng, bước nào)

| # | Reservation | Ai đóng | Bước |
|---|---|---|---|
| **M1** | `GATES.md:38` ghi numstat test `99 2`; thực tế `git diff --numstat` = **`100 3`** (lệch 1 dòng thêm / 1 dòng xoá, do chỉnh comment sau khi viết evidence). Cập nhật lại dòng 38 cho đúng số liệu. | Implementer (tác giả GATES) | B9 / handoff |
| **M2** | `PLAN...:45` còn dẫn số dòng cũ của file test (`:30-36`, `:38-43`, `:102-119`); sau khi thêm mock/file dài 303 dòng, vị trí thật là hoisted `:32-39`, `vi.mock` `:41-47`, `beforeEach` `:106-128`. Chỉ sai citation, không sai nội dung. | Coordinator / owners plan (sửa plan hoặc ghi errata) | B9 (doc-only) |
| **M3** | 4 file untracked ở root `probe-login.mjs`, `probe-register.mjs`, `qa-account.mjs`, `try-login.mjs` (tạo 21:21–21:25 cùng ngày) **không nằm trong claim/SCOPE** và không tính vào `git diff --numstat`. Cần xác nhận là artifact điều tra/staging cũ, **không commit** cùng slice. | Coordinator | B9 trước `git add` |

**CHƯA CHẠY (đã ghi đúng trong `GATES.md:54-58`, không phải reservation kỹ thuật):** `npm run build`/`vite build`, deploy + verify VPS staging `14.225.255.47`, Playwright/visual 375–1440, eslint/i18n strict toàn repo. Không báo PASS cho các hạng mục này.

---

## 4. Kết luận

Toàn bộ mapping, render, i18n, test và numstat đã tự kiểm chứng bằng lệnh thật; 0 blocker, 0 major; fail-before có log đỏ 4 case (`GATES.md:16-26`) và pass-after 13/13; 13 fail full-suite là baseline đã đối chứng. ⇒ **PASS**. Đóng M1–M3 ở B9, rebuild/staging/Playwright khi deploy (owner/coordinator), rồi claim `done` + ledger Entry 559.
