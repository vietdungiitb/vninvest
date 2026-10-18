# FALSE GREEN - nhung cach lam "PASS" ma khong kiem tra duoc gi

> Tach tu `verification.md` 2026-10-18 khi file do vuot C1 (120 dong). Owner chot:
> **het C1 thi tach file moi, khong gop/over entry cu.**
> Chu de chung: ket qua "xanh" **khong** chung minh thu gi dang con ton tai.

## L-V06: Suite xanh khi **số test GIẢM** = xanh giả — script xoá hàng loạt tự dính test khác

- **Nguyên nhân:** Xoá code bằng script lọc dòng (`.filter(!includes(...))`) trong file test. Khối cần xoá
  không kết thúc ở dòng có điều kiện ⇒ script nuốt tiếp các khối **kế tiếp**. File vẫn **parse hợp lệ**,
  suite vẫn chạy, vẫn **PASS** — chỉ là các test bị nuốt **không còn được kiểm**.
- **Hậu quả thật (Entry 375, R5.1):** xoá test `AIAgentFederationPage` nuốt luôn
  `AIUsageAnalyticsPage`, `AdminUsersPage`, `AdminUsersPanel` (mất cả fix race W3-4 kèm comment
  15 dòng). Báo cáo ghi `376/376 OK` — **số test đã giảm** mà không ai để ý. Phải phát hiện khi
  soi `--numstat`: `-49` dòng trong 1 file test thay vì `-8`.
- **Khi nào gặp:** `tags: [test, script, delete, remove, false-green, xanh-gia, numstat, refactor]`
- **QUY TẮC:** "Xoá test bằng script ⇒ **đếm dòng trước/sau**, liệt kê **tên** các test bị xoá,
  và **so số test** của suite với baseline. **Số test giảm mà không giải thích được từng test là
  xanh giả.** Xoá khối nhiều dòng: `git checkout HEAD -- <file>` rồi xoá **đúng** số dòng cần."
- **CHECKLIST:**
  - [ ] `git diff --numstat` có đúng số dòng **dự kiến xoá** không (toàn file = đổi cả EOL/khối)?
  - [ ] Đã **liệt kê tên** mọi `test(...)` bị mất, và tự xác nhận từng cái là dư?
  - [ ] Tổng số test của suite có **tăng/giảm** so với baseline — nếu giảm thì giải thích được chỗ nào?
  - [ ] Chạy lại **đúng các file bị đụng** (không chỉ file của slice hiện tại) và xác nhận còn test?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 375 §"XOA NHAM 3 TEST"; `docs/evidence/ai-cc/r51-gates.md` §"Năm lỗi tôi mắc".

## L-V07: `django.urls.resolve()` bị `legacy_proxy_view` che — mọi route đều "resolve được", kể cả route đã xoá

- **Nguyên nhân:** URLconf có một **proxy bắt-tất-cả** ở cuối, nên `resolve(path)` **luôn trả
  view** cho mọi đường dẫn kể cả route đã bị gỡ. Công cụ đo báo "còn route" ⇒ bằng chứng giả.
- **Hậu quả thật (Entry 375, R5.1):** đo bằng `resolve()` cho `/ai/agents/`, `/ai/audit/`,
  `/ai/usage/summary/` đều ra `legacy_proxy_view`. Nếu dừng ở đó thì ghi "AC2 đạt" trong khi
  **AC2 chưa hề được đo**. Phải dùng `curl` mới thấy: `/ai/agents/` **404** còn
  `/ai/usage/summary/` **401**.
- **Khi nào gặp:** `tags: [django, urls, resolve, urlconf, proxy, catch-all, false-green, xanh-gia, curl, staging]`
- **QUY TẮC:** "Đo route còn/mất bằng **HTTP thật** (`curl`), không bằng `resolve()`/`reverse()`.
  Luôn kèm **một route lân cận còn sống** trong cùng lệnh đo (401 chứng minh prefix còn thông,
  404 chứng minh route đúng là biến mất). Và grep `urls.py` xác nhận include đã bỏ."
- **CHECKLIST:**
  - [ ] Có **request HTTP thật** (curl/playwright) chứ không chỉ `resolve()`?
  - [ ] Có **route đối chứng còn sống** trong cùng lệnh để loại trừ "deploy hỏng chung"?
  - [ ] Có grep `urls.py` xác nhận `include` đã bỏ?
  - [ ] Với FE: đã kiểm **bundle deploy** (`dist/assets`) chứ không chỉ source?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 375 §"BẪY ĐO resolve()"; `docs/evidence/ai-cc/r51-gates.md` §"Bẫy đo".
