# Verification - Lessons (đo, kiểm chứng, fail-before, side effect)

> `tags: [measure, measurement, verify, probe, computed, contrast, parser, fail-before,
> root-cause, audit, screenshot, evidence, artifact, mutate]`

Nhóm bài học này đều có chung một đặc điểm: **sai lầm không báo lỗi**. Không có
exception nào, output vẫn in ra con số trông chuyên nghiệp — nên phải có cơ chế riêng
mới phát hiện được.

## L-V01: Phép đo sai vẫn trông hợp lý — mọi script đo phải có đối chứng

- **Nguyên nhân:** Script tự viết parse dữ liệu mà **không tự kiểm chứng chính nó**.
  `getComputedStyle` trả về `oklch()`/`oklab()`/`color-mix()` tùy trình duyệt; parser
  `lum()` chỉ biết `rgb()` nên `regex [\d.]+` lấy nhầm số, vẫn ra một tỉ lệ "hợp lý".
- **Hậu quả thật (Entry 274, 2026-10-12):**
  ① 3 dòng báo `FAIL WCAG AA` hoàn toàn **giả**; tin chúng thì sửa CSS theo lỗi không
  tồn tại. ② Cùng phiên, `git cat-file -e` được kiểm bằng **stdout** — lệnh này in rỗng
  cả khi thành công lẫn thất bại ⇒ báo "thiếu trên `dev`" cho cả `docs/CLAIMS.md` ⇒ kết
  luận sai cho cả 6 nhánh ngay trước đó.
- **QUY TẮC:** Không dùng số của script tự viết để kết luận **trước khi** chạy một
  **control** có đáp án biết trước. Control hỏng ⇒ mọi dòng khác cùng lô vô giá trị.
- **CHECKLIST:**
  - [ ] Script đo của tôi đã chạy qua **≥1 control biết đáp án** chưa? (control phải
        ra `true`; không thì dừng, không đọc kết quả)
  - [ ] Màu `getComputedStyle` trả về là `rgb()` hay `oklch()`/`oklab()`? Nếu không phải
        `rgb()` → nội suy qua browser (span tạm → computed → `rgb()`), đừng parse chuỗi.
  - [ ] Lệnh kiểm tra tồn tại (`cat-file -e`, `rev-parse`, `ls-files`) đang đọc **exit
        code** hay **stdout**?
  - [ ] Tôi đang kiểm chứng **artifact nào**? `packages/web/dist` trên host **không
        phải** output của docker build (`RUN npm run build` chạy trong image) — kiểm tra
        bằng `docker cp` từ `/usr/share/nginx/html/assets/`, hoặc `docker exec`.
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 274 §② (parser `oklch`) và §③
  (`git cat-file -e`); Entry 272 §"dist/ trên host KHÔNG phải artifact docker build".

## L-V02: Gốc rễ do người khác ghi phải có phản chứng trước khi hành động

- **Nguyên nhân:** Tiếp nhận "root cause" từ ledger / claim / audit report như sự thật
  đã kiểm chứng. Môi trường repo càng có nhiều người viết tài liệu thì claim sai càng
  lây nhanh.
- **Hậu quả thật (Entry 274):** Entry 270 khẳng định *"E2E bị chặn vì `vite.config.ts`
  khai `proxy` chỉ trong `server`, `preview` không có"*. Tôi sửa theo đó rồi chạy
  **fail-before**: bản HEAD **không có** `preview.proxy` vẫn trả HTTP 200 + JSON API
  thật. Source Vite 5.4.21: `proxy: preview2?.proxy ?? server.proxy` ⇒ `preview` **tự
  kế thừa**. Root cause sai, "fix" vô tác dụng. Lần tương tự: audit UI/UX yêu cầu "ép
  chữ treemap thành trắng" trong khi `textOnHeat()` đã chọn màu theo luminance.
- **QUY TẮC:** Mọi "gốc rễ" kế thừa phải có **phản chứng** trước khi sửa: fail-before
  chạy thật, hoặc đọc source của thư viện. Không tái hiện được lỗi ⇒ **CHƯA XÁC MINH**.
- **CHECKLIST:**
  - [ ] Tôi đã tái hiện lỗi trên code **chưa sửa** chưa? Không tái hiện được thì chưa biết
        root cause kế thừa có đúng không.
  - [ ] Tính khả thi của lý thuyết đã được kiểm bằng **source** (không đoán API từ tên)?
  - [ ] Fix của tôi đã **đo trước/sau** chưa? Fix làm tệ hơn ⇒ **revert**, đừng giữ cho có.
  - [ ] Root cause kế thừa không tái hiện được ⇒ ghi `CHƯA XÁC MINH` + hỏi, đừng sửa theo.
- **Proof:** ledger Entry 274 §① (refute Entry 270, có bảng fail-before); Entry 272
  §"Audit claim bị REFUTE"; Entry 264 §4 (2/2 claim "bug thật" của wave 10 hoá ra sai).

## L-V03: Chạy test/gate/script có thể GHI ĐÈ file đang được track

- **Nguyên nhân:** Bỏ qua side effect của lệnh. Spec Playwright dùng
  `page.screenshot({path})` trỏ thẳng vào file trong repo (`docs/evidence/**`,
  `tests/visual/*.png`), nên **chạy E2E = mutate working tree**.
- **Hậu quả thật (Entry 274):** 10 file PNG bị ghi đè trong lúc chạy suite để điều tra.
  Commit thẳng sẽ đưa 10 ảnh rác vào PR **và** làm hỏng baseline hợp lệ của repo.
- **QUY TẮC:** Sau **mỗi** lần chạy lệnh có khả năng ghi file (test, screenshot, codegen,
  migration, capture), phải `git status --short` trước khi commit. Mọi thay đổi phát
  sinh là **sản phẩm phụ cần review**, không phải việc bạn định làm.
- **CHECKLIST:**
  - [ ] Lệnh vừa chạy có ghi file vào repo không? (test · screenshot · baseline · codegen)
  - [ ] `git status --short` có **đúng** các file tôi cố ý sửa không?
  - [ ] File phát sinh: **revert** hay review rồi mới giữ? Không bao giờ commit mặc định.
- **Proof:** ledger Entry 274 §① ("Tác dụng phụ đã bắt + hoàn tác: 10 ảnh PNG").

## L-V04: Test "XANH" vì URL/fixture sai — assert giá trị THẬT, và luôn có test dương tính

- **Nguyên nhân:** Khẳng định được viết theo hướng "không xảy ra" (`assertNotEqual(x, 'sk-personal')`) nên **rỗng cũng đạt**. Endpoint sai URL ⇒ không chạy ⇒ `x` là `None` ⇒ assert vẫn xanh.
- **Hậu quả thật (Entry 369, R4.2):** `test_advisory_refresh_never_uses_management_scoped_key` gọi `/core/v1/workspace/ai-advisory/VIC/refresh/` — **404 thật** — nhưng báo PASS vì `captured` rỗng. Nếu tin vào nó thì AC1 "đã đạt" trong khi **chưa từng chạy qua** đường sử dụng. Tệ hơn: khi thêm test dương tính thì mới lộ URL thật là `/core/v1/advisory/refresh/<symbol>/` và fixture phải có `plan=PRO` + `QuotaRecord` (không có thì 403).
- **Khi nào gặp:** `tags: [test, vitest, django, fail-before, false-green, xanh-gia, assertion, fixture]`
- **QUY TẮC:** "Test chỉ chứng minh được điều gì đó **đã xảy ra**. Assert `None`/rỗng là **không chứng minh gì**. Và mỗi khẳng định phủ định phải có test dương tính đi kèm."
- **CHECKLIST:**
  - [ ] Assert của mình có khả năng **đạt khi endpoint/fixture hỏng** không? (rỗng, `None`, `0`, `[]` ⇒ xanh giả)
  - [ ] Đã assert **giá trị thật** đi tới chỗ cần kiểm (vd `assertIsNotNone(captured['api_key'])` trước khi so sánh)?
  - [ ] Đã kiểm status code **không phải 404/403/500** trước khi kết luận endpoint chạy?
  - [ ] Đã có test **dương tính** chứng minh cơ chế *vẫn dùng* khi cấu hình hợp lệ không? (thiếu thì "luôn không làm gì cả" cũng xanh)
  - [ ] Khi thấy 2+ test ghim hành vi cũ **đỏ** sau khi mình đổi code → cân nhắc mình đang **đổi nghĩa** một field đã có hợp đồng, **không** phải test sai. Đọc lại tên field + comment trước khi sửa test.
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 369 §"XANH GIẢ vì URL sai"; `docs/evidence/ai-cc/r42-gates.md` §"Bẫy thật".

## L-V05: Bằng chứng ảnh/screenshot — exit 0 KHÔNG chứng minh được gì, phải mở ảnh ra xem

- **Nguyên nhân:** Hai lỗi độc lập cùng cho ra kết quả "test xanh nhưng tài liệu vô dụng":
  (a) **chụp trước khi nội dung có** ⇒ ảnh ghi lại trạng thái *đang tải*; (b) **selector
  khớp nhầm chỗ** — ví dụ `a[href="/settings/ai"]` khớp cả link điều hướng toàn cục
  trên layout nên vẫn xanh khi trang chưa render nội dung cần kiểm.
- **Hậu quả thật (Entry 372, R4.4):** AC3 yêu cầu 3 ảnh. **Cả 3 lần chụp đều PASS** và
  **cả 3 ảnh đều vô dụng** — lần 1 chỉ có dòng "Đang tải…", lần 2 bị overlay lazy-load
  phủ, lần 3 mới đúng. Chỉ phát hiện được vì **mở ảnh ra xem**, không phải vì đọc log.
- **Khi nào gặp:** `tags: [screenshot, visual, playwright, evidence, false-green, xanh-gia, selector]`
- **QUY TẮC:** "Với bằng chứng hình ảnh: **đợi nội dung → chụp → assert**, dùng selector **đúng chỗ** (ưu tiên `data-testid` riêng của khối trong trang), và **luôn mở ảnh ra xem** trước khi báo PASS."
- **CHECKLIST:**
  - [ ] Ảnh có được chụp **sau** khi nội dung cần kiểm đã render chưa? (không phải lúc skeleton/overlay)
  - [ ] Đã chờ overlay/skeleton **biến mất** trước khi chụp?
  - [ ] Selector có khớp **nhầm phần tử giống nhau ở chỗ khác** không? (link toàn cục, sidebar, header)
  - [ ] Đã **mở ảnh** xác nhận đúng nội dung, không chỉ tin exit code?
  - [ ] Ảnh chụp đúng **phiên bản đã deploy**, không phải bản cũ còn trên môi trường?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 372 §"AC3 tốn 3 lần chụp"; `docs/evidence/ai-r44/visual/`.

## L-V06: Parser mau CSS tra `null` (= "duc") cho mau BAN TRONG SUOT

- **Nguyen nhan:** `[^)]*` dung o dau tien cua `var(...)` nen doc sai gia tri;
  tach `[\s,/]` roi doi 4 thanh phan nen bo qua cu phat CSS4 `/ alpha`.
- **Hau qua that (PR #269, 2026-10-19):** gate chan hoi quy "nen modal phai DUC"
  bao **XANH GIA** cho chinh token dang can bat loi — `--bg-panel: rgba(var(--soc-rgb-081734) / 0.4)`
  doc ra `null` = "duc", dung thuoc tinh can dung. 3 vong sua truoc khi tim ra.
- **QUY TAT:** khi parser mau tra `null`/`undefined` = "khong co gi", phai **hoi
  xem co phai "khong khai alpha" hay "parse that bai"**. Dung mau co `var(...)` lam
  **control** — mau phai ra alpha thuoc nghinh theo tai lieu.
- **CHECKLIST:**
  - [ ] Mau trong mau co `var(--x) / 0.4` (CSS4) hay `rgba(r,g,b,a)` (cu phap cu)?
  - [ ] Regex co dung `[^)]*` hay `)` ben trong `var(...)`?
  - [ ] `null` cua parser duoc gan nghia la "DUC" hay la "LOI"?
  - [ ] Da chay **control** co dap an biet truoc chua (L-V01)?
- **Proof:** `CODE_CHANGE_AUDIT_LEDGER.md` Entry 384; `packages/web/src/pages/portfolio/manage/__tests__/modal-surface-opaque.component.test.ts` (control `.pfm-kpi__card` phai do ra ~0.4).
