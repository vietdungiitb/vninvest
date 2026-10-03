# EXECUTION EVIDENCE TEMPLATE - Whale Alerts Symbol KLine Intelligence Upgrade

**Trạng thái**: TEMPLATE - READY TO FILL

Sử dụng tài liệu này để thu thập bằng chứng cho từng slice trước khi chuyển reviewer nội bộ hoặc final auditor.

## A. Metadata

- Date: ____
- Environment: dev / staging
- Slice ID: ____
- Req IDs: ____
- Slice type: frontend / backend / integration / docs-only
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

## F. Performance / Stability evidence

- Response time / render time: ____
- Cache key / version checked: ____
- Cold path note: ____
- Degraded-state scenario checked: PASS / FAIL

## G. SSOT / Governance checklist

- [ ] Slice đã map đúng SSOT domain
- [ ] Không tạo pipeline song song ngoài contract hiện có
- [ ] Không sửa trực tiếp 3 immutable bubble source files
- [ ] Text UI mới đã qua i18n
- [ ] Nếu là docs change: đã có audit report doc riêng

## H. Self-audit checklist

- [ ] Đã đối chiếu slice với Req ID trong traceability matrix
- [ ] Đã chạy focused validation ngay sau hoàn tất slice
- [ ] Đã thu đúng loại evidence cần thiết cho slice này
- [ ] Đã cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- [ ] Đã cập nhật `PROGRESS_DASHBOARD.md`
- [ ] Đã ghi residual risk nếu còn

## I. Verdict nội bộ

- Verdict: PASS / PASS WITH NOTES / FAIL
- Rationale:
  - ____

## J. Residual risks and follow-up

1. Risk: ____
   - Owner: ____
   - ETA: ____
2. Risk: ____
   - Owner: ____
   - ETA: ____

## K. Sign-off

- Slice owner: ____  Date/Time: ____
- Internal reviewer: ____  Date/Time: ____
- QA reviewer: ____  Date/Time: ____