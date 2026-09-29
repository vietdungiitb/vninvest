# EXECUTION EVIDENCE TEMPLATE - Whale Alerts Symbol Kline Refactor

**Trạng thái**: TEMPLATE - READY TO FILL

Sử dụng tài liệu này để thu thập bằng chứng cho từng slice trước khi chuyển final auditor.

## A. Metadata

- Date: ____
- Environment: dev / staging
- Slice ID: ____
- Req IDs: ____
- Evidence owner: ____
- Reviewer nội bộ: ____

## B. Scope slice

- Mục tiêu slice: ____
- File thay đổi thực tế:
  1. ____
  2. ____
  3. ____

## C. Validation commands

| Command | Kết quả | Ghi chú |
|---|---|---|
| `____` | PASS / FAIL | ____ |
| `____` | PASS / FAIL | ____ |
| `____` | PASS / FAIL | ____ |

## D. UI / Runtime evidence

- Screenshot path: ____
- Video path: ____
- Dev stack rebuild command: ____
- Runtime smoke result: PASS / FAIL

## E. API / Payload evidence

- Endpoint: ____
- Request params: ____
- Key fields verified:
  1. ____
  2. ____
  3. ____
- Payload snapshot path: ____

## F. Self-audit checklist

- [ ] Đã đối chiếu slice với `Req ID` trong traceability matrix
- [ ] Đã xác nhận focused validation chạy ngay sau hoàn tất slice
- [ ] Đã xác nhận evidence đủ cho loại slice này
- [ ] Đã cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- [ ] Đã cập nhật `PROGRESS_DASHBOARD.md`
- [ ] Đã ghi residual risk nếu còn

## G. Verdict nội bộ

- Verdict: PASS / PASS WITH NOTES / FAIL
- Rationale:
  - ____

## H. Residual risks and follow-up

1. Risk: ____
   - Owner: ____
   - ETA: ____
2. Risk: ____
   - Owner: ____
   - ETA: ____

## I. Sign-off

- Slice owner: ____  Date/Time: ____
- Internal reviewer: ____  Date/Time: ____
- QA reviewer: ____  Date/Time: ____