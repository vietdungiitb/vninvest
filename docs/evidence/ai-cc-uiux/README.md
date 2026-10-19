# Bằng chứng ảnh thật — `/settings/ai` sau PR #267 (2026-10-19)

Deploy: `bash scripts/deploy-staging.sh` trên VPS `14.225.255.47` (`/opt/vninvest` @ `dev` = `34ceeb4a0`).
Chụp: `PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test ai-cc-uiux-s6 --project=chromium`
(spec: `packages/web/tests/visual/ai-cc-uiux-s6.spec.ts` — login qua `storageState` của project `setup`).

## Ảnh

| File | Nội dung |
|---|---|
| `01-settings-ai-after.png` | Toàn trang `/settings/ai` |
| `02-nav-va-tong-quan.png` | Cắt vùng đầu: breadcrumb + H1 + thanh tab + tổng quan |
| `03-verified.png` | Toàn trang, chụp sau khi mọi assert đã xanh |

## Những gì ảnh CHỨNG MINH (đối chiếu trực tiếp với ảnh Owner gửi lúc đầu)

| # | Trước (ảnh Owner) | Sau (ảnh này) |
|---|---|---|
| 1 | **2 thanh tab chồng nhau**, giống hệt | **1 thanh tab duy nhất** — 5 tab route |
| 2 | **2 ô "Tổng quan" cùng sáng** | **chỉ 1 ô** sáng (ô đầu) |
| 3 | Eyebrow **"Cài đặt"** ngay trên H1 | **không còn eyebrow** |
| 4 | Breadcrumb "Cài đặt tài khoản / **Trí tuệ nhân tạo**" | "Cài đặt tài khoản / **Trung tâm AI**" |
| 5 | Ô "NGUỒN DỮ LIỆU" hiện **`command_center`** (enum thô) | "NGUỒN HIỆU LỰC" hiện **"Cấu hình trung tâm AI"** |
| 6 | Panel "Chính sách vận hành" chứa **"Gate sự kiện"** (tùy chọn cá nhân) + 4 ô, 2 ô trùng với form | Panel chỉ còn **1 ô** + badge **"CHỈ ĐỌC"** dạng chip; **"Gate sự kiện"** tách sang panel riêng **"Tuỳ chọn cá nhân"** |
| 7 | 2 số hiện ở panel chỉ đọc **và** lặp lại ở form | không còn số trùng |

## Những gì ảnh **KHÔNG** chứng minh (ghi rõ thay vì kết luận suông)

- **`testuser` trên staging CHƯA có cấu hình AI** ⇒ ô provider = "—", model = "Cần cấu hình". Vì vậy **không** chụp được nhãn provider đã dịch (`Google Gemini`) trên môi trường thật. Phần này **đã** chứng minh bằng test component chạy trên dictionary thật: `ai-cc-enum-labels.component.test.tsx` AC3.1 + AC3.4 (9/9 khoá resolve qua `getNestedValue`).
- Trang có **2 thẻ `h1`** (`["VNInvest", "Trung tâm điều hành AI"]`) — `h1` thứ nhất do app shell render. Đây là điều kiện có sẵn của layout, `docs/audit-uiux/UIUX_AUDIT_20261007.md` §4 đã cảnh báo; sửa thuộc AppShell ⇒ ngoài phạm vi PR này.
- **Tiêu đề `CẤU HÌNH AI RUNTIME` in hoa** giữa 7 panel sentence-case — nhận xét từ audit code, **chưa sửa** (ticket riêng).
- **8 panel tất cả cùng cấp `h2`** dù chỉ có 3 nhóm ý nghĩa — nhận xét từ audit code, **chưa sửa**.
- Không đo contrast, focus ring, hay viewport hẹp — `check:contrast` chỉ phủ 7 tone pair admin, và `aiSettings.module.css` không có `@media max-width` nào.
