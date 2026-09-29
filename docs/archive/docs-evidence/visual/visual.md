# Visual QA — `/ai-advisory` (B4)

Ảnh: `docs/evidence/ai-advisory-ui/visual/` · Spec: `packages/web/tests/visual/advisory-visual-qa.spec.ts`

```powershell
cd packages/web
npx playwright test tests/visual/advisory-visual-qa.spec.ts --project=chromium --workers=1
# 8 passed
```

Ảnh được ghi ra `docs/evidence/...` ở **gốc repo** dùng
`resolve(process.cwd(), '../../docs/evidence/ai-advisory-ui/visual')`. Lần chụp
đầu dùng `resolve('docs/...')` — đường dẫn tương đối so với cwd mà cwd của
Playwright là `packages/web`, nên ảnh rơi vào `packages/web/docs/evidence/...`
và phải chép tay. Đã sửa, và không dùng `__dirname` vì spec là ESM.

## Danh mục ảnh

| Ảnh | Nội dung |
|---|---|
| `advisory-dark-data.png` | dark · mã `VIC` |
| `advisory-light-data.png` | light · mã `VIC` |
| `advisory-dark-empty.png` | dark · mã `HAG` (chưa có tư vấn) |
| `advisory-light-empty.png` | light · mã `HAG` |
| `advisory-dark-error.png` | dark · cắt mọi request `/core/v1/**` |
| `advisory-light-error.png` | light · cắt mọi request `/core/v1/**` |
| `advisory-desktop-1440-two-column.png` | regression layout 2 cột ở 1440×900 |

## CHƯA CÓ ẢNH "CÓ DỮ LIỆU THẬT"

Không chụp được, và **không giả vờ**: hạn mức Gemini đã hết (bằng chứng ở
`e2e.md` §7.3) nên DB không có `AdvisoryRecord status=generated` nào. Ảnh
`*-data.png` vì thế thể hiện empty state, và điều này được nói thẳng trong
docstring của spec thay vì để tên file gợi ý sai. Đặt biến môi trường
`ADVISORY_DATA_SYMBOL` sang mã đã có tư vấn là spec tự chụp được ảnh có dữ liệu.

## Bốn lỗi phát hiện được CHỈ VÌ chụp ảnh — không lỗi nào lộ ra ở test tự động

### 1. Contrast light mode không đạt WCAG AA (lỗi nghiêm trọng nhất)

Ảnh `advisory-light-data.png` (lần chụp đầu): "Thận trọng" và "Tăng trưởng" gần
như **không đọc được**.

Nguyên nhân: `RiskModeSelector.js` dùng nền `-950` (gần đen) + chữ `-300`/`-200`
(rất sáng) — bảng màu thiết kế cho dark mode **ONLY**. Ở light mode
`bg-blue-950/30` = 30% navy đè lên trang trắng → thành xám xanh nhạt, trong khi
`text-blue-300` vẫn xanh rất sáng → chữ sáng trên nền sáng.

Sửa: màu light làm mặc định (không tiền tố), màu cũ nằm sau `dark:`. App định
nghĩa `@custom-variant dark` là `:root:not([data-theme="light"] *)` nên `dark:`
đúng nghĩa "chỉ khi KHÔNG phải light", khớp cơ chế bật theme ở `main.tsx:175-180`.

### 2. Theme test chụp nhầm — cả 2 nhóm ảnh đều ra màu tối

Lần chụp đầu dùng `test.use({ colorScheme: 'light' })` và **cả nhóm `light` vẫn
tối**. Vì app **không** theo OS preference mà theo attribute `data-theme`
(`index.css:13` định nghĩa variant dark là `:root:not([data-theme="light"] *)`).
Nếu chỉ nhìn ảnh mà không kiểm tra, sẽ tưởng light mode đã được kiểm chứng.

Sửa: đặt `localStorage['vninvest-theme']` qua `addInitScript` trước khi tải
trang, và **assert** `document.documentElement.getAttribute('data-theme')` sau
khi chụp — ảnh "light" mà không assert theme thì vô nghĩa mà vẫn báo xanh.

### 3. Ảnh chụp trúng trạng thái tải, không phải giao diện

Lần chụp đầu có 3 thanh xám `h-24 animate-pulse` ở giữa trang, trông như giao
diện hỏng. Đo lại bằng probe: sau ~6s mỗi endpoint được gọi **đúng 1 lần** và
skeleton tự tắt — tức là trạng thái tải tạm thời, **không** phải lỗi vòng lặp.

Sửa: chờ `div.animate-pulse.h-24` về 0 trước khi chụp. Ngoài ra 7 test chạy song
song làm nghẽn container (sau 20s skeleton vẫn còn) → chuyển sang
`mode: 'serial'` + `--workers=1`, vì ảnh QA chỉ có giá trị khi trạng thái ổn định.

### 4. Thông báo kỹ thuật tiếng Anh lọt ra UI

`advisory-dark-error.png` (lần chụp đầu) hiện "Failed to fetch" (raw error của
`fetch`) ngay dưới câu tiếng Việt.

Sửa: map lỗi mạng về thông điệp đã bản địa
(`aiAdvisory.error.network`), giữ chuỗi gốc trong `title` để hỗ trợ tra cứu.
Mã lỗi nội bộ (không phải lỗi mạng) vẫn hiện nguyên vì có giá trị chẩn đoán.
Spec có assert chống lỗi này quay lại.

## Sửa thêm phát hiện qua ảnh: phân trang vỡ trong sidebar hẹp

Sidebar footer hiện "0—/0—/0" thay vì "0–0 / 0" — chuỗi bị bóp trong khung ~320px
và dấu gạch nối xuống dòng; nhãn "Kích thước trang" và "Trang 1 / 1" cũng vỡ.

`PaginationBar` là component **dùng chung** nên sửa tối thiểu, không cấu trúc
lại: thêm `flex-wrap` + `whitespace-nowrap shrink-0` vào các span bị bóp. Cải
thiện mọi nơi dùng mà không đổi layout ở khung rộng.

## Ghi nhận

Ba khẳng định được kiểm chứng trực tiếp trên ảnh (không phải suy từ code):

- **N1 layout 2 cột đã đúng**: `advisory-desktop-1440-two-column.png` + assert
  `boundingBox().x > 700` (sidebar nằm bên phải, không rơi xuống dưới).
- **N3 deep-link giữ đúng mã**: ảnh hiện `HAG` kèm "Mã {HAG} chưa có tư vấn cho
  phiên hôm nay" dù HAG không nằm trong holdings/watchlist.
- **Metric không có nguồn thì hiện `—`, không hiện 0**: "CƯỜNG ĐỘ DÒNG TIỀN —",
  "GIÁ TRỊ THAM CHIẾU —". Đây là hành vi trung thực, không phải lỗi.
