# CODE QUALITY CONSTITUTION - Global Signal Services Control Center

## 1. Purpose

Chất lượng của chương trình này không được định nghĩa bằng việc “API trả 200” hay “UI mở lên được”.

Chất lượng ở đây nghĩa là:

1. signal được phát hiện đúng ở tầng toàn cục, không lệ thuộc user context,
2. canonical event được lưu đúng domain để global consumers tái sử dụng lâu dài,
3. admin control center cho phép operator ra quyết định an toàn, có preview, có audit trail,
4. đội code và AI sessions không thể vô tình hạ chuẩn bằng workaround nhanh.

Nguyên lý áp dụng:

- Deming: chất lượng phải được xây vào flow detect -> persist -> distribute -> operate, không để auditor sửa lại ở cuối.
- Juran: tính đúng ở đây là `fitness for use` cho operator và trader downstream, không phải chỉ đúng theo unit test cô lập.
- Crosby: chi phí của một canonical event sai domain hoặc retention purge sai thứ tự lớn hơn nhiều so với chi phí thêm guardrail ngay từ đầu.

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Universe resolver | 95% risk coverage | Sai universe sẽ làm mọi service chạy sai phạm vi, gây false negative hoặc lãng phí runtime |
| Whale event canonicalization | 95% risk coverage | Nếu whale truth sai domain, toàn bộ global whale consumers sẽ drift |
| Dark-flow global service | 90% risk coverage | Dark flow đã có canonical store nhưng detector purity và severity semantics vẫn là rủi ro |
| Distribution layer | 95% risk coverage | Persist đúng mà fan-out sai audience vẫn là lỗi nghiệp vụ trực tiếp |
| Retention safety | 95% risk coverage | Xóa raw tick trước khi canonical an toàn là lỗi không cứu được bằng UI |
| Admin control center write actions | 95% risk coverage | Không có preview/confirmation sẽ biến UI thành nguồn tạo sự cố toàn hệ thống |
| Jobs and observability | 85% risk coverage | Operator phải phân biệt được healthy thật và “có vẻ healthy” |
| Governance and evidence | 90% risk coverage | Thiếu evidence làm final auditor không thể xác nhận implementation |

## 3. Coverage theater prevention

Những thứ sau không được tính là bằng chứng chất lượng:

1. Chỉ chứng minh Celery task chạy xong mà không chứng minh persisted canonical event tồn tại.
2. Chỉ test UI render card summary mà không test preview-before-apply flow.
3. Chỉ test `OrderFlowSignal` có row mới mà không test audience tracked/watchlist nhận được distribution.
4. Chỉ assert cache có key mà không đối chiếu key đó được dựng từ canonical event chứ không phải raw tick scan.
5. Chỉ chụp screenshot control center mà không có payload snapshot hoặc action log cho write actions.
6. Chỉ nói “admin có thể quản lý ở một nơi” nhưng vẫn để operator phải chuyển qua nhiều panel cũ để hoàn tất một flow.

## 4. Fitness-to-purpose scenarios

### Scenario S1 - Detection bị phụ thuộc user threshold

What can go wrong:
- Cùng một trade lớn nhưng event canonical chỉ tồn tại với user A, không tồn tại với user B vì detector đọc threshold theo user trong phase detect. Global truth bị vỡ ngay tại nguồn.

Where to inspect:
- detector service layer,
- threshold resolution helper,
- persisted event creation path.

How to verify:
- chạy cùng input market event qua hai user contexts khác nhau; persisted canonical event phải giữ nguyên.

### Scenario S2 - WhaleAdvisory bị dùng làm event-store thay thế

What can go wrong:
- Vì `WhaleAdvisory` đã có sẵn metadata, coder dùng nó làm nguồn whale global. Hệ thống sau đó mất event history khi advisory cooldown hoặc entitlement logic thay đổi.

Where to inspect:
- whale service persistence,
- aggregate read models,
- admin recent events API.

How to verify:
- chứng minh global whale feed có thể dựng từ canonical event mà không cần query `WhaleAdvisory`.

### Scenario S3 - Multi-threshold whale duplication

What can go wrong:
- Một trade vượt nhiều ngưỡng tạo nhiều whale events cho cùng trade, làm tăng noise feed và méo distribution counts.

Where to inspect:
- whale detector scoring/threshold selection,
- event-id policy,
- dedupe logic.

How to verify:
- regression test một trade vượt nhiều threshold vẫn chỉ cho 1 canonical event.

### Scenario S4 - Dark-flow severity bị làm phẳng

What can go wrong:
- Detector dark-flow vẫn suy severity từ whale threshold ratio, khiến phần lớn events rơi vào `info`, giảm giá trị vận hành và downstream prioritization.

Where to inspect:
- dark-flow severity mapper,
- persisted `OrderFlowSignal` fields,
- distribution payload.

How to verify:
- so trước/sau mapper trên tập event pilot có strength khác nhau.

### Scenario S5 - Universe preview không phản ánh effective scope thật

What can go wrong:
- Admin apply config tưởng chỉ thêm 20 mã nhưng thực tế hybrid union kéo effective universe lên hàng trăm mã vì tracked/watchlist merge logic. Runtime cost tăng đột ngột.

Where to inspect:
- universe preview API,
- effective snapshot builder,
- admin apply modal.

How to verify:
- preview phải hiển thị source counts và effective delta rõ trước apply.

### Scenario S6 - Raw tick bị purge trước khi canonical safety được xác nhận

What can go wrong:
- Retention job dọn raw `IntradayTick` quá sớm, trong khi whale canonical backfill chưa hoàn tất. Sau đó không thể dựng lại sự kiện thiếu.

Where to inspect:
- retention preview/apply,
- canonical completeness checks,
- ops runbook.

How to verify:
- purge phải có preview safety gate và test chặn purge khi canonical readiness fail.

### Scenario S7 - Distribution bỏ sót audience watchlist

What can go wrong:
- Signal được persist đúng nhưng chỉ tracked users nhận, còn watchlist users bị bỏ sót vì distribution resolver chỉ query một nguồn.

Where to inspect:
- audience resolver,
- websocket push path,
- `UserAlertHistory` creation.

How to verify:
- integration test với 1 tracked user + 1 watchlist user cùng symbol, cả hai đều phải nhận.

### Scenario S8 - Control center nhìn healthy nhưng worker thực ra stale

What can go wrong:
- Summary card chỉ hiển thị config `enabled=true` và last successful run cũ, khiến operator tưởng service khỏe dù worker đã stale từ lâu.

Where to inspect:
- summary API,
- run registry,
- heartbeat / Celery inspect.

How to verify:
- simulated stale worker phải làm summary đổi state sang warning/degraded.

### Scenario S9 - Dangerous action không có preview-before-apply

What can go wrong:
- Admin bấm manual recompute hoặc retention purge mà không thấy impacted symbols/counts. Một thao tác nhầm có thể gây backlog hoặc mất dữ liệu.

Where to inspect:
- frontend action buttons,
- preview APIs,
- confirmation modals.

How to verify:
- mọi write action phải có preview payload hoặc confirmation với số liệu thật.

### Scenario S10 - UI mới lại tái phân mảnh bằng panel con rời rạc

What can go wrong:
- Dù đã tạo `Signal Control Center`, coder vẫn giữ các write-path ở panel whale cũ hoặc Django admin, khiến operator phải nhảy giữa nhiều nơi để hoàn tất một workflow.

Where to inspect:
- navigation map,
- action placement,
- deprecation notes cho panel cũ.

How to verify:
- thử workflow thực: preview universe -> apply -> manual run -> recent events -> jobs -> audit trong một surface duy nhất.

## 5. AI session quality discipline

1. Không code trước explicit consent.
2. Mỗi AI session phải đọc ít nhất Handoff Master, Implementation Plan, Tech Spec, Taskboard, Traceability Matrix.
3. Nếu đụng frontend React, phải nạp `Expert React Frontend Engineer` và `react19-source-patterns`.
4. Nếu làm docs/audit/test protocol, phải bám `quality-playbook`.
5. Sau edit đầu tiên phải có focused validation ngay.
6. Mọi thay đổi docs phải có audit report và sync ledger/progress.

## 6. The human gate

Những điểm sau bắt buộc cần human/final auditor quyết định cuối:

1. universe policy cuối cùng có union tracked/watchlist ở mức nào,
2. threshold mặc định của whale global,
3. retention window chính thức cho raw ticks và canonical events,
4. rollout order khi control center mới thay thế panel whale cũ,
5. GO / NO-GO cuối cùng cho runtime rollout.