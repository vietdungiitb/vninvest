# IMPLEMENTATION PLAN — WHALE ALERTS UI REMEDIATION (từ phản biện audit 2026-09-21)

Ngày: 2026-09-21  
Nguồn audit: `docs/PHAN_BIEN_AUDIT_WHALE_ALERTS_20260921.md` + ledger Entry 134–135.  
Phạm vi: `packages/web` AlertCenter/feed/stats/filter/i18n/CSS + `packages/core/backend` `signal_intelligence` serializer/view (chỉ thay đổi cộng thêm, có test).  
Nguyên tắc: tuân `AGENTS.md` — i18n qua LangContext, nhãn Việt full dấu, API qua adapter, `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi step.

## 0. Mục tiêu bàn giao

1. Xóa các lỗi trình bày dữ liệu P0: trùng title/summary, header stats sai tổng, format số/ngày不一致, timestamp chưa chứng minh.
2. Sửa layout thật: missing `soc.panel`, clipping do fixed-size virtual list, toolbar/filter conflict.
3. Nâng card/bảng lên mật độ thương mại mà không mất virtualization, CSV, URL sync, pause, retry, skeleton hiện có.
4. Mọi slice đều có minh chứng xác thực để reviewer phản biện độc lập, không nghiệm thu bằng screenshot cảm tính.

## 1. Ngoài phạm vi

- Không redesign toàn app, không đổi theme system.
- Không tạo endpoint BE mới, trừ đúng một thay đổi cộng thêm ở Slice 3.2 để expose giá/khối lượng whale đã có trong DB.
- Không đổi canonical `title` backend; chỉ chuẩn hóa cách UI hiển thị.
- Không cam kết giờ khớp 20:36 là đúng/sai trước khi có payload thô phiên 21/09.

## 2. Gates toàn kế hoạch

- Mỗi sub-step: `npx tsc --noEmit` trong `packages/web` = 0 errors.
- Cuối mỗi step: `npm run build` PASS.
- `npm run lint` 0 errors; `npm run i18n:scan` sạch key mới.
- FE: vitest/jest các file chạm slice phải xanh.
- BE (chỉ Slice 3.2): `manage.py check` 0 + `manage.py test signal_intelligence` PASS.
- Minh chứng mỗi slice: output lệnh + ảnh before/after + bảng payload thô nếu liên quan dữ liệu.

---

# STEP 1 — P0 data correctness (Sprint 1)

## Slice 1.1: Header stats dùng tổng scope, không dùng độ dài trang

**Vấn đề:** `StatsPanel.tsx:31-36` hiển thị `rows.length` trong khi `rows` đã là slice 8 dòng tại `AlertCenterPage.tsx:329-335`. Backend đã trả `total_symbols` và hook đã giữ tại `useAlertCenterData.js:129-137`.

**Files:** `StatsPanel.tsx`, `AlertCenterPage.tsx` (truyền thêm `totalSymbols`), test component.

**Yêu cầu:**
- Header hiển thị tổng mã trong scope hiện tại, ví dụ `24 Mã CP`.
- Thêm dòng phụ `Trang 1/3 · 8 mã/trang` để phân biệt tổng vs trang.
- Không đổi logic slice 8 dòng trong slice này.

**Acceptance:**
- Với 24 symbols: header = 24, pagination vẫn 3 trang, trang 2 không reset.
- Test: render 16 symbols giả lập, assert header tổng 16 nhưng chỉ thấy 8 dòng trang 1.

**Checklist thẩm định:**
- Đối chiếu `StatsPanel.tsx` nhận prop tổng từ page, không tự đếm slice.
- Không dùng `aggregatedSymbols.length` cho header.

**Minh chứng:** ảnh header trước/sau + output vitest case mới.

## Slice 1.2: Chống trùng title/summary ở card

**Vấn đề:** whale `body=''` tại `materializers.py:831-832`, serializer fallback `summary=body||title` tại `serializers.py:41-45`, UI render cả hai tại `AlertCard.tsx:147-149` và `AlertCard.tsx:168-170`.

**Files:** `AlertCard.tsx`, test `AlertCenterPage.component.test.tsx` hoặc test card.

**Yêu cầu:**
- Chuẩn hóa chuỗi title/summary: trim, collapse whitespace, so sánh không phân biệt `đ/VND` và dấu phân cách nghìn.
- Nếu summary trùng title: chỉ render title, không render đoạn mô tả trùng.
- Giữ nguyên `title` chuẩn cho drawer/CSV; không sửa backend.
- Ẩn “Độ tươi” ở metadata nếu đã có badge “Mới/Cũ” trên cùng card.

**Acceptance:**
- Card VBB mẫu chỉ còn 1 dòng nội dung chính, không còn 3 lần lặp số tiền/nội dung.
- Test với fixture `title == summary` và `title != summary`.

**Checklist thẩm định:**
- Reviewer kiểm tra hàm normalize có unit test cho `588,479,248đ` vs `588.479.248 VND`.
- Không xóa field dữ liệu, chỉ điều kiện render.

**Minh chứng:** ảnh 1 card before/after + test output.

## Slice 1.3: Điều tra và chốt timestamp/khớp lệnh

**Vấn đề:** UI phân biệt `executed_at/triggered_at` tại `AlertCard.tsx:186-192`, nhưng formatter dùng timezone trình duyệt tại `AlertCenterPage.tsx:74-83`, server là `Asia/Ho_Chi_Minh` tại `settings.py:214`.

**Files:** `AlertCenterPage.tsx` helper format, `AlertCard.tsx`, `StatsTable.tsx`, `DetailDrawer.tsx`, tài liệu evidence.

**Yêu cầu:**
- Thu payload thô 5 alert mẫu phiên 21/09 gồm `symbol/session_date/triggered_at/executed_at`.
- Pin toàn bộ hiển thị thời gian AlertCenter về `Asia/Ho_Chi_Minh`.
- Chuẩn hóa nhãn: `Giờ khớp` cho `executed_at`, `Giờ phát` cho `triggered_at`, `Phiên` cho `session_date` dạng `dd/MM/yyyy`.
- Card, bảng, drawer render cùng một instant phải ra cùng một giờ ICT.

**Acceptance:**
- Bảng evidence 5 dòng: raw ISO → giờ card → giờ bảng → giờ drawer, 100% khớp.
- Không còn 3 cách viết ngày cho cùng một trường ngữ nghĩa.

**Checklist thẩm định:**
- Reviewer đối chiếu payload thô, không chấp nhận “nhìn giờ hợp lý”.
- Kiểm tra cả trường hợp `executed_at=null` fallback rõ ràng.

**Minh chứng:** file evidence `docs/evidence/whale-alerts-ui-20260921/timestamp-payload.md` + ảnh 3 vị trí hiển thị.

## Slice 1.4: Chuẩn hóa số VND và ngày

**Vấn đề:** giá trị góc phải dùng `vi-VN` tại `AlertCenterPage.tsx:68-72`, tiêu đề backend dùng format Python tại `materializers.py:209-210`, tổng bảng từ `Decimal(2)` tại `views.py:273` nhưng frontend không chuẩn hóa fraction.

**Files:** util format mới dùng chung, `AlertCenterPage.tsx`, `StatsTable.tsx`, `DetailDrawer.tsx`, i18n nếu cần key tooltip.

**Yêu cầu:**
- Một formatter `vi-VN` duy nhất cho AlertCenter.
- VND hiển thị 0 decimals; nếu backend trả fraction thì làm tròn có quy tắc và test.
- Hai lớp hiển thị: gọn cho KPI/bảng (`588,5 triệu ₫`, `16,76 tỷ ₫`), đầy đủ cho tooltip/detail/CSV.
- Ngày chuẩn `dd/MM/yyyy`; date input hiển thị theo locale, không để `mm/dd/yyyy` trong app Việt.

**Acceptance:**
- Cùng một value không bao giờ vừa `588.479.248` vừa `588,479,248đ` trên cùng màn hình.
- Test matrix: integer, Decimal `.00`, fraction `.05`, null, string số.

**Minh chứng:** bảng test format + ảnh KPI/bảng/tooltip.

## Slice 1.5: Xác minh và sửa missing `soc.panel`

**Vấn đề:** `StatsPanel.tsx:31` dùng `soc.panel` nhưng quét thư mục SOC không thấy định nghĩa `.panel`; cột trái dùng `ShellPanel` radius 24 tại `ShellPageTemplate.module.css:176-182`.

**Files:** `StatsPanel.tsx`, `soc.components.css` hoặc `ShellPageTemplate` reuse, test visual/manual.

**Yêu cầu:**
- Xác minh build hiện tại render class nào cho container phải: log class thực tế, không đoán từ source CSS.
- Nếu missing thật: định nghĩa `.panel` trong SOC hoặc chuyển StatsPanel sang `ShellPanel` cho đồng nhất.
- Giữ layout grid và sticky hiện có tại `soc.components.css:2115-2140`; không thêm sticky mới.

**Acceptance:**
- Hai cột dùng cùng hệ card, kiểm tra 1440px và 1100px.
- Không regression filter/table bên trong.

**Minh chứng:** DOM class trước/sau + ảnh hai cột.

## Slice 1.6: Sửa clipping do fixed-size virtual list

**Vấn đề:** `FixedSizeList` 460/280 tại `AlertCenterPage.tsx:518-523` + `overflow:hidden` tại dòng 539 có thể cắt card khi mở evidence/nội dung dài.

**Files:** `AlertCenterPage.tsx`, `AlertCard.tsx`, CSS liên quan, test component.

**Yêu cầu:**
- Giữ virtualization, chuyển sang đo chiều cao động/variable-size hoặc auto-size theo nội dung.
- Card mở evidence không bị cắt, không tạo thêm scroll context mới ngoài ý muốn.
- Giữ sort ổn định và dedupe SSE hiện có.

**Acceptance:**
- Mở evidence ở card đầu/dài nhất: không cắt chữ, không mất nút hành động.
- Scroll feed mượt, không nhảy thứ tự khi poll nền.

**Minh chứng:** ảnh/clip card dài trước/sau + test regression sort.

---

# STEP 2 — Filter, toolbar, search (Sprint 2)

## Slice 2.1: Chip filter có count + aria-pressed

**Files:** `FilterBar.tsx`, `soc.components.css` nếu cần, test.

**Yêu cầu:**
- Severity/family chip hiển thị count theo scope hiện tại.
- Thêm `aria-pressed` đúng trạng thái chọn.
- Giữ nút “Xóa lọc” hiện có; chỉ hiện khi có filter active.

**Acceptance:** bật/tắt chip bằng keyboard đọc được trạng thái; count khớp feed.

## Slice 2.2: Tách lane/timeframe và gỡ xung đột date

**Files:** `FilterBar.tsx`, `AlertCenterPage.tsx`, i18n hint.

**Yêu cầu:**
- Vạch ngăn lane vs timeframe nhìn thấy được, không chỉ div 1px vô hình.
- Chọn `session_date` phải có precedence rõ ràng: hoặc clear preset timeframe xung đột, hoặc hiển thị hint “đang áp cả ngày cụ thể + preset”.
- Backend giữ nguyên; chỉ chuẩn hóa query frontend vì backend có thể áp cả cutoff lẫn `session_date` tại `views.py:211-225`.

**Acceptance:** không còn trường hợp chọn ngày + preset cho ra feed trống khó hiểu mà không có hint.

## Slice 2.3: Toolbar một hàng responsive + date picker Việt hóa

**Files:** `FilterBar.tsx`, `soc.components.css`, i18n.

**Yêu cầu:**
- Gom tìm mã/date/refresh về cùng toolbar, responsive wrap hợp lý.
- Date hiển thị `dd/MM/yyyy`; fix placeholder “Tìm nhanh mã” bị cắt do `max-width:160px`.
- Nút refresh có tooltip và trạng thái loading rõ.

## Slice 2.4: Làm rõ scope 3 ô tìm mã

**Files:** `FilterBar.tsx`, `StatsPanel.tsx`, i18n placeholder/label.

**Yêu cầu:**
- Ghi rõ ô nào lọc feed, ô nào lọc bảng stats, ô header là global.
- Không xóa mù stats search vì nó lọc client snapshot tại `AlertCenterPage.tsx:315-318`.
- Thêm clear cho ô stats nếu cần.

---

# STEP 3 — Card, bảng, realtime (Sprint 3)

## Slice 3.1: Card gọn + expandable + hành động phân cấp

**Files:** `AlertCard.tsx`, `MuteModal.tsx`, i18n, CSS.

**Yêu cầu:**
- Card mặc định gọn: symbol/severity/family + số tiền + hướng + 1 dòng meta + giờ tương đối.
- Chi tiết mở rộng: evidence, confidence formula hint, giá/khối lượng khi có Slice 3.2.
- “Chi tiết” primary; “Đã xem”/“Tắt tiếng” icon-button + tooltip; nhãn mute đổi thành “Tắt tiếng…” vì đã có modal 15/30/60/240.
- Thêm “Đánh dấu tất cả đã xem” cho alert đang load, dùng ack hiện có theo batch có giới hạn + báo lỗi từng item, không gọi ồ ạt.

**Acceptance:** một viewport thấy được nhiều card hơn, không mất thông tin quyết định.

## Slice 3.2: Expose giá/khối lượng whale cho feed/detail (thay đổi cộng thêm duy nhất ở BE)

**Vấn đề:** `UnifiedAlertSerializer` không expose `price/volume` dù `WhaleAlertCanonical` đã có tại `models.py:87-95`; evidence cũng thiếu giá/volume tại `materializers.py:32-39`.

**Files BE:** `serializers.py`, test `test_alert_center_api.py` hoặc test serializer mới, contract doc nếu cần.  
**Files FE:** type alert, `AlertCard.tsx`, `DetailDrawer.tsx`.

**Yêu cầu:**
- Thêm field read-only cộng thêm, ví dụ nested `whale_detail: {price, volume, matched_value, side, executed_at} | null`.
- Không đổi field hiện có; non-whale trả `null`, không phá client cũ.
- Cập nhật OpenAPI schema qua serializer, không dùng field ảo ở FE.
- FE render `12.000 cp @ 49.000` khi có dữ liệu; thiếu thì hiển thị `—` + tooltip, không bịa.

**Acceptance:**
- API detail/feed có block whale mới cho whale alert, `null` cho non-whale.
- BE test xanh + `manage.py check` 0.

**Rủi ro/rollback:** nếu contract nhạy cảm thì tách Slice 3.2 thành PR riêng và revert bằng cách bỏ field cộng thêm; FE đã guard `null`.

## Slice 3.3: Bảng gọn, sort, pagination

**Files:** `StatsTable.tsx`, `StatsPanel.tsx`, i18n, CSS.

**Yêu cầu:**
- Hàng gọn: giờ tương đối + tooltip ngày đầy đủ; `white-space:nowrap` cho badge.
- Đổi “Tần suất” thành “Mật độ”, tránh nhầm severity.
- Cột Mua/Bán một dòng: bar + `8 / 4`, giữ tooltip Mua/Bán/Khác.
- Sort theo alert/gia trị/giờ; tăng page size 8 → 20 hoặc virtualize bảng.
- Giữ sticky header/tabular/hover/link hiện có.

## Slice 3.4: Realtime không đẩy list + banner stale

**Files:** `AlertCenterPage.tsx`, `useAlertCenterStream.ts`, i18n.

**Yêu cầu:**
- SSE mới vào buffer, hiện pill `▲ N cảnh báo mới`, chỉ chèn khi user bấm.
- Giữ pause hiện có; thêm banner khi stream polling quá lâu hoặc dữ liệu quá hạn theo `latest_triggered_at`.
- Giữ URL sync hiện có tại `AlertCenterPage.tsx:96-134`; không đổi `replaceState` thành `pushState` nếu không có lý do.

**Acceptance:** user đang đọc không bị đẩy vị trí; banner stale xuất hiện đúng ngưỡng.

---

# STEP 4 — Token, i18n, a11y (Sprint 4)

## Slice 4.1: Token type/radius + Việt hóa

**Files:** shell/SOC CSS liên quan, `vi.js/en.js`, `AlertCenterPage.tsx`.

**Yêu cầu:**
- Chốt token radius/type cho page, không để shell 28 vs panel 24 vs metric 20 trôi tự do.
- Glossary: Cá mập/Dòng tiền ngầm/Sốc giá/Tín hiệu/Hệ thống/Dữ liệu quá hạn; giữ thuật ngữ gốc trong tooltip.
- Viết lại subtitle, bỏ “theo chuẩn OpenAPI”; badge live dùng “Trực tiếp”, ẩn `WS` khỏi user.

## Slice 4.2: A11y còn thiếu

**Files:** `FilterBar.tsx`, `StatsTable.tsx`, `AlertCard.tsx`.

**Yêu cầu:**
- Chip filter `aria-pressed`; bảng có sort semantics + keyboard; thanh mua/bán có `role=img` + `aria-label` số liệu.
- Giữ focus ring và reduced-motion hiện có; verify bằng keyboard-only pass.

## Slice 4.3 (P2 optional): KPI click-to-filter giới hạn

**Yêu cầu:**
- Chỉ cho KPI severity dùng filter severity hiện có; KPI unseen hiển thị tooltip giải thích, chưa làm filter unseen nếu thiếu BE.
- Không làm sort/filter mới ở backend trong slice này.

---

# 3. Checklist thẩm định chung cho đội review

1. Mọi claim “đã fix” phải kèm `file:line` mới, không dùng ảnh thay bằng chứng logic.
2. Bug dữ liệu phải có bảng raw → render, không nghiệm thu bằng “nhìn hợp lý”.
3. Không tạo class CSS mới trùng hệ thống; ưu tiên reuse Shell/SOC.
4. Không đổi response shape hiện có; Slice 3.2 chỉ được thêm field và phải có test.
5. Không hardcode chuỗi Việt mới; chạy `i18n:scan`.
6. Không đoán timezone; mọi giờ hiển thị phải pin `Asia/Ho_Chi_Minh` và có test.

# 4. Minh chứng bàn giao mỗi slice

- Output `npx tsc --noEmit`, `npm run build`, lint, test liên quan.
- Ảnh before/after ở cùng viewport/filter/dataset.
- Với slice dữ liệu: file evidence payload thô + bảng mapping render.
- Ghi ledger entry trỏ đúng file test và ảnh evidence.

# 5. Rủi ro lớn nhất

- Timestamp phiên 21/09 có thể là dữ liệu Naw/mock/stale chứ không phải bug format; Slice 1.3 phải đi trước mọi kết luận múi giờ.
- `soc.panel` missing có thể là regression CSS module; Slice 1.5 phải xác minh DOM build, không sửa mù.
- Expose thêm field BE dù cộng thêm vẫn cần review contract; tách PR nếu reviewer yêu cầu.
