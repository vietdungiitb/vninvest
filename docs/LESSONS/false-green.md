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

## L-V08: Gate coi "khong do duoc" la "khong co vi pham" ⇒ xanh gia + tu de nghi HA baseline

- **Nguyen nhân:** Gate baseline-locked bo qua nhung item **khong do duoc** (route timeout, mau
  khong giai ma duoc) ⇒ tap vi pham **thu nho** ⇒ gate in "khong co vi pham MOI" **va** goi y
  `--update-baseline` de **giam** baseline. Vong sau route do khong do duoc ⇒ vi pham moi **khong bao gio
  bi chan**.
- **Hau qua that (W0, Entry 390):** `check-a11y-runtime.mjs` — 4/10 route timeout ⇒ 44/113 vi pham bi
  gan nhan "da het" ⇒ neu lam theo goi y, baseline 113→69 va **4 route mat vinh vien khoi tam canh**.
  Vong audit lap 2 bat duoc 2 BLOCKER cung kieu: `check-theme-contrast` mat mot cap FAIL doi sang
  `oklch()` ⇒ cap do roi khoi tap ⇒ gate bao "da het" ⇒ **xanh**.
- **Khi nao gap:** `tags: [gate, baseline, false-green, xanh-gia, measure, probe, staging, timeout, update-baseline, oklch, undecodable]`
- **QUY TAC:** "Item **khong do duoc** ≠ item **khong co vi pham**. Phai tach 3 nhan:
  **(a) vi pham moi** ⇒ chan, **(b) khong do duoc** ⇒ `CHUA CHAY` + **KHONG** ket luan xanh,
  **(c) da het** ⇒ chi bao khi **vung do duoc**. `--update-baseline` **tu choi** khi pham vi chua day du
  hoac co cap moi roi vao 'khong doc duoc'."
- **CHECKLIST:**
  - [ ] Gate co phan biet "vi pham moi" / "khong do duoc" / "da het" rieng biet?
  - [ ] Pham vi do **day du** moi duoc phep ghi baseline? (`measured.length === ROUTES.length`)
  - [ ] Cap **roi vao 'khong doc duoc'** co bi tinh la vi pham moi (khong phai "da het")?
  - [ ] `--update-baseline` co tu choi khi pham vi chua du / co cap khong doc duoc moi?
  - [ ] Da **probe** duong lach: doi 1 cap FAIL sang `oklch()` ⇒ gate co bat?
- **TRƯỜNG HỢP THỨ 2 (vòng 3, cùng phiên):** phép đo trên **app sống** ⇒ tập vi phạm **đổi theo dữ liệu**: 3 lần đo liên tiếp trên **cùng 1 build** (fingerprint asset **khớp**) cho **113 → 141 → 173** ⇒ delta **không** phản ánh hồi quy ⇒ **baseline cố định cho phép đo runtime là không khả thi** ⇒ phải **seed dữ liệu** (staging cố định) trước khi dùng làm hàng rào, hoặc hạ xuống **advisory**.
- **Proof:** `docs/AUDIT_UI_STANDARDIZATION_W0.md` §D (B-1, B-2, M-7b) + `docs/SUMMARY_uistd-w0-gates.md` §10.1, §12; probe suite 17/17.

## L-V09: Id cua tap so phai mang **gia tri / so lan** — khong chi ten hay duong dan

- **Nguyen nhan:** Gate so **tap** (set) de tranh "lam xanh bang cach doi cach do". Nhung khi **id**
  cua phan tu **khong mang thong tin can so**, thi tap **bi thay doi ma khong ai biet**: doi
  **gia tri** (van cung ten) hoac **them vi pham vao file da co trong baseline** (van cung duong dan)
  ⇒ gate van xanh.
- **Hau qua that (W0, Entry 390):** 3 gate deu gap loi nay: `check-token-conflict` id = **ten token** ⇒ doi
  `--text-primary` tu `#f8fafc` sang `#000000` (chu bien mat) **khong bi bat**; `check-focus-ring` va
  `check-heading-contract` id = **duong dan file** ⇒ file da trong baseline them 5 vi pham moi **van xanh**.
  Audit lap 2 do 3/17 probe "khong bat" chinh vi ly do nay.
- **Khi nao gap:** `tags: [gate, baseline, id, set, false-green, xanh-gia, token, value, hash, count, probe]`
- **QUY TAC:** "Id cua phan tu violation phai mang **thong tin dung thu can so**: **gia tri** (hash) cho
  mau mau, **so lan** cho vi pham theo file. Id chi la duong dan/toi ten ⇒ gate chi kiem tra *co ton tai*,
  khong kiem tra *co thay doi*."
- **CHECKLIST:**
  - [ ] Id co mang **gia tri** (hash) khi dang so mau mau/token?
  - [ ] Id co mang **so lan** (hoac danh sach dong) khi dang so vi pham theo file?
  - [ ] Do lai tap vi pham **gia tri** (khong phai **ten**) khi tai-key baseline?
  - [ ] Da thu: doi gia tri cua mot phan tu da co trong baseline ⇒ gate co bat?
- **Proof:** `docs/AUDIT_UI_STANDARDIZATION_W0.md` §D (M-1, M-2, N-1) + `docs/SUMMARY_uistd-w0-gates.md` §10.2, §10.3, §10.5.
