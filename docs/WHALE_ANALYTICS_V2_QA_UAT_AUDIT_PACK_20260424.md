# QA, UAT VA AUDIT PACK - WHALE ANALYTICS V2

## 1. Mục tiêu

Tài liệu này định nghĩa cách nghiệm thu và audit để bảo đảm implementation bám sát:

- yêu cầu UX thực tế,
- contract API thực tế,
- hành vi code thực tế.

## 2. Nguyên tắc audit không được vi phạm

1. Không audit theo cảm giác đẹp/xấu của giao diện.
2. Audit phải ưu tiên tính đúng, tính trung thực và khả năng truy vết.
3. Nếu chart mất bubble hợp lệ trên ngưỡng lọc, coi là fail ngay.
4. Nếu hover bind sai timestamp, coi là fail ngay.

## 3. Audit gates theo giai đoạn

## 3.1 Giai đoạn 1

### Evidence bắt buộc

- video hover bubble -> Information Panel
- video hover line -> Information Panel
- screenshot filter preset
- video slider log-scale hoạt động
- screenshot chứng minh vùng bubble dày vẫn giữ đủ các lệnh trên ngưỡng
- screenshot không còn raw i18n key

### Checklist pass/fail

| Hạng mục | Kết quả mong đợi | Pass/Fail | Ghi chú |
|---------|------------------|-----------|--------|
| Information Panel | Không che chart |  |  |
| Bubble visibility | Mọi bubble trên ngưỡng đều hiển thị |  |  |
| No density cheating | Không opacity taper mặc định |  |  |
| Filter semantics | Bubble filter minh bạch, line không bị filter theo bubble threshold |  |  |
| Direct labels | Nhìn chart biết line nào là gì mà không cần dò legend |  |  |
| i18n | Không còn raw key |  |  |

## 3.2 Giai đoạn 2

### Evidence bắt buộc

- network capture payload có `session_levels`
- screenshot ref/high/low/trần/sàn trên chart
- video DataZoom sync hai pane
- screenshot off-hours
- screenshot weekend/holiday
- screenshot lunch gap

### Checklist pass/fail

| Hạng mục | Kết quả mong đợi | Pass/Fail | Ghi chú |
|---------|------------------|-----------|--------|
| Session levels | Payload đúng đủ ref/high/low/trần/sàn |  |  |
| Unit consistency | Cùng đơn vị giữa line context và price series |  |  |
| DataZoom | Zoom sync hai pane, không lệch timestamp |  |  |
| Off-hours | Resolve đúng phiên gần nhất |  |  |
| Lunch gap | Hiện gap thời gian thật |  |  |

## 3.3 Giai đoạn 3

### Evidence bắt buộc

- payload mẫu speed
- payload mẫu percentile 10 phiên
- screenshot progress bar percentile
- screenshot/clip speed panel
- evidence degrade khi thiếu baseline

### Checklist pass/fail

| Hạng mục | Kết quả mong đợi | Pass/Fail | Ghi chú |
|---------|------------------|-----------|--------|
| Speed contract | Có một canonical unit rõ ràng |  |  |
| Percentile contract | Có baseline sample size |  |  |
| Degraded path | Thiếu baseline/speed không hiện số 0 giả |  |  |
| UI semantics | Không còn phụ thuộc vào `Có/Có` khi có percentile |  |  |

## 4. Audit assertions bắt buộc theo yêu cầu người dùng

Auditor phải kiểm riêng các assertion sau:

1. Chart không làm giảm độ đậm hoặc ẩn bubble hợp lệ theo cách làm sai cảm nhận mật độ giao dịch.
2. Mọi lệnh trên ngưỡng lọc được hiển thị đầy đủ.
3. Người dùng chủ động chọn lọc ngưỡng mới làm thay đổi tập bubble hiển thị.
4. Các công cụ hỗ trợ đọc như zoom/filter/panel không bóp méo dữ liệu gốc.

## 5. Điều kiện fail ngay lập tức

Nếu gặp một trong các lỗi sau thì fail ngay:

- bubble trên ngưỡng bị mất,
- opacity taper mặc định làm vùng dày nhìn như ít lệnh hơn thực tế,
- hover bubble nhưng panel hiển thị dữ liệu của bubble khác,
- `session_levels` sai đơn vị giá,
- percentile/speed hiện như dữ liệu thật trong khi backend thiếu source.

## 6. Mẫu audit theo task

```text
Task ID:
Requirement ID:
Owner:
Files changed:
Expected behavior:
Observed behavior:
Evidence attached:
Result: PASS | FAIL | PARTIAL
Notes:
```

## 7. Kết luận audit

Auditor chỉ được dùng 3 mức kết luận:

- `PASS`
- `PASS WITH NOTES`
- `FAIL`

`PASS WITH NOTES` chỉ hợp lệ nếu phần còn thiếu không ảnh hưởng tới tính đúng và tính trung thực thị giác.
