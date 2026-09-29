# QA, UAT VÀ AUDIT PACK - WHALE ANALYTICS v2.0

## 1. Mục tiêu

Tài liệu này là bộ tiêu chí dùng để:
- nghiệm thu nội bộ,
- audit công việc của đội code sau khi hoàn thành,
- chặn các lỗi kiểu “đã code xong nhưng sai ngữ nghĩa”.

## 2. Bằng chứng đội code bắt buộc phải nộp

### 2.1 Bằng chứng backend

- JSON payload mẫu cho mỗi timeframe chính: `15m`, `30m`, `1h`, `session`
- capture header gồm `ETag`, `Last-Modified`, `Cache-Control`
- log hoặc test output cho `304 Not Modified`
- test output chứng minh strength không bão hòa giả

### 2.2 Bằng chứng frontend

- video hover bubble
- video hover line CVD/strength/institutional strength
- video pause tab rồi quay lại focus để chứng minh fetch ngay
- screenshot off-hours và cuối tuần
- screenshot hiển thị lunch gap

### 2.3 Bằng chứng tích hợp

- network capture trước và sau refactor để chứng minh giảm over-fetch
- ảnh hoặc clip chứng minh chỉ còn 1 request logic cho chart view

### 2.4 Bằng chứng tự động đã thu được đến 2026-04-24

- Backend regression:
	- `python manage.py test portfolio.tests.test_whale_analytics_snapshot_api portfolio.tests.test_whale_analytics_snapshot_flow_series --keepdb -v 1`
	- Kết quả: `14/14 PASS`
	- Bao phủ: schema snapshot, `ETag`, `Last-Modified`, `Cache-Control`, `304 Not Modified`, weekend fallback, holiday fallback, degraded metadata, cache hit reuse, lock/coalescing reuse, ATO/ATC bucket mapping, formula strength và institutional strength.
- Frontend regression:
	- `CI=true npm test -- --watch=false --runTestsByPath src/components/WhaleBubbleChart.tooltip.test.jsx src/hooks/useWhaleAnalyticsData.test.js src/components/WhaleAnalytics.degraded.test.jsx`
	- Kết quả: `7/7 PASS`
	- Bao phủ: tooltip bubble point-anchored, tooltip line point-anchored, empty state degraded, badge missing intraday, pause background polling, immediate focus resume, stale-response drop khi đổi symbol/timeframe.
- Build/deploy evidence:
	- `npm run build` => frontend compile thanh cong, `main` bundle ~147.84 kB gzip.
	- `docker compose -f c:/Mujoco Projects/vninvest/docker-compose.dev.yml up -d --build frontend` => frontend container restart thanh cong voi bundle moi.

## 3. Checklist nghiệm thu chức năng

| Hạng mục | Kết quả mong đợi | Pass/Fail | Ghi chú |
|---------|------------------|-----------|--------|
| Timezone | Toàn bộ chart và payload dùng `UTC+7` | PASS | Da khoa bang backend snapshot tests va time adapter contract. |
| Session window | Trục X hiển thị đúng `09:00-15:00` | PASS | Da khoa bang backend session resolution va frontend adapter; can them screenshot manual trong UAT pack neu muon close audit. |
| Weekend/Holiday | Hiển thị phiên gần nhất có dữ liệu | PASS | Backend regression da cover weekend fallback va DailyPrice holiday fallback. |
| Lunch gap | Giữ gap trưa đúng tỷ lệ thời gian | PARTIAL | Logic da code hoa theo adapter/spec, nhung con thieu screenshot/video manual. |
| ATO/ATC | Volume auction không bị rải sang phút giả | PASS | Backend regression da cover bucket mapping theo `bucket_start`. |
| Price line | Hiển thị rõ trên bubble pane | PARTIAL | Da co implementation, can screenshot/video manual de dong audit. |
| Tooltip bubble | Chỉ hiện đúng dữ liệu bubble đang hover | PASS | Regression `WhaleBubbleChart.tooltip.test.jsx` da khoa bubble point-anchored. |
| Tooltip line | Chỉ hiện đúng dữ liệu line đang hover | PASS | Regression `WhaleBubbleChart.tooltip.test.jsx` da khoa line point-anchored. |
| Empty state | Hiển thị `Không có dữ liệu` khi thiếu dữ liệu hợp lệ | PASS | Regression `WhaleAnalytics.degraded.test.jsx` da cover degraded empty state. |
| Crosshair sync | Đồng bộ vertical line giữa 2 pane theo timestamp | PARTIAL | Da co implementation; con thieu evidence manual/visual. |
| Background pause | Tab ẩn không polling tiếp | PASS | Regression `useWhaleAnalyticsData.test.js` da khoa pause polling khi hidden. |
| Focus resume | Tab hiện lại fetch snapshot mới ngay | PASS | Regression `useWhaleAnalyticsData.test.js` da khoa immediate resume khi visible/focus. |
| Degraded mode | Có notice dữ liệu chậm và metadata hợp lệ | PASS | Backend regression va frontend degraded regression da cover stale/degraded semantics. |
| Cache headers | Response có `ETag`, `Last-Modified`, `Cache-Control` | PASS | Backend regression da xac nhan headers va conditional `304`. |
| Contract | Frontend dùng snapshot endpoint duy nhất | PASS | Hook snapshot-only va regression lifecycle da chot path fetch hien tai. |

## 4. Checklist kiểm định công thức

### 4.1 Strength

Các ca kiểm phải có:
- bucket rất nhỏ nhưng lệch buy/sell cực mạnh
- bucket trung bình nhưng bất thường so với baseline
- bucket lớn bất thường thật sự
- chuỗi bucket bình thường liên tiếp

Kỳ vọng:
- case bucket nhỏ không chạm 100 vô lý
- case bất thường thật sự mới tiến gần 90-100
- output mượt và không dính saturation hàng loạt

### 4.2 Institutional strength

Các ca kiểm phải có:
- buy pressure cao nhưng whale/dark flow không xác nhận
- whale/dark flow cao nhưng buy pressure trung tính
- trường hợp cả hai cùng cao

Kỳ vọng:
- institutional strength không trùng buy strength theo cách máy móc

## 5. Checklist regression kỹ thuật

- `PARTIAL` không phát sinh flicker lớn khi đổi timeframe: cần clip manual.
- `PASS` không còn race condition khi đổi symbol liên tục: regression hook da cover stale-response drop.
- `PASS` không render sai khi response cũ về muộn: regression hook da cover request context mismatch.
- `PASS` không còn request đôi `session + 1M` cho một view intraday ngắn: snapshot-only hook da thay the flow cu.

## 5.1 Hạng mục manual còn mở

- quay video hover bubble / hover line tren runtime thuc te
- chup screenshot off-hours, weekend va lunch gap
- capture devtools/network cho single-request chart view va cache headers thuc te
- ghi pass/fail chinh thuc vao audit close-out sau khi co bang chung tren

## 6. Mẫu audit theo task

### Mẫu ghi nhận

```text
Task ID:
Owner:
Files changed:
Expected behavior:
Observed behavior:
Evidence attached:
Result: PASS | FAIL | PARTIAL
Notes:
```

## 7. Điều kiện pass toàn gói

Chỉ được coi là pass khi:
- toàn bộ mục Critical trong taskboard đã pass
- không còn fail ở nhóm thời gian, tooltip, contract, resume lifecycle
- có đủ evidence backend, frontend và integration

## 8. Điều kiện fail ngay lập tức

Nếu gặp một trong các lỗi sau thì gói bị fail ngay, không cần tranh luận thêm:
- Tooltip hiển thị dữ liệu khác timestamp đang hover
- Session start vẫn là `08:45` ở một phần hệ thống
- Off-hours hoặc cuối tuần hiển thị sai phiên
- Strength vẫn chạm 100 hàng loạt trên bucket nhỏ
- Frontend vẫn dùng combo request cũ gây over-fetch
- Tab background vẫn polling

## 9. Kết luận audit

Auditor phải kết luận theo 3 mức:
- `PASS`: đạt đầy đủ, có evidence tốt
- `PASS WITH NOTES`: đạt chính, còn thiếu nhỏ không ảnh hưởng ngữ nghĩa
- `FAIL`: sai nghiệp vụ, sai contract, hoặc thiếu evidence trọng yếu