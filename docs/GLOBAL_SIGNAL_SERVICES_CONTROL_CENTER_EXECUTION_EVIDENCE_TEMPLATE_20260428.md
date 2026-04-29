# EXECUTION EVIDENCE TEMPLATE - Global Signal Services Control Center

**Trạng thái**: TEMPLATE - READY TO FILL

Sử dụng tài liệu này để thu thập bằng chứng cho từng slice trước khi chuyển reviewer nội bộ hoặc final auditor.

## A. Metadata

- Date: ____
- Environment: dev / staging
- Slice ID: ____
- Req IDs: ____
- Slice type: backend / frontend / integration / ops / docs-only
- Required AI skill used: ____
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

## D. Model / Canonical data evidence

- Canonical store impacted: whale / dark_flow / both / none
- Event ID or primary key proof: ____
- Deterministic / dedupe check: PASS / FAIL
- Sample payload path: ____

## E. Admin API / Payload evidence

- Endpoint: ____
- Request params/body: ____
- Key fields verified:
  1. ____
  2. ____
  3. ____
- Payload snapshot path: ____

## F. UI / Runtime evidence

- Screenshot path: ____
- Video path: ____
- Dev stack rebuild command: ____
- Runtime smoke result: PASS / FAIL
- PaginationBar used where needed: YES / NO / N/A
- i18n text verified: PASS / FAIL

## G. Retention / Performance evidence

- Response time / render time: ____
- Cache key family checked: ____
- Retention preview checked: PASS / FAIL
- Raw-to-canonical safety gate checked: PASS / FAIL

## H. Governance checklist

- [ ] Slice đã map đúng SSOT domain
- [ ] Detection không phụ thuộc user-specific threshold
- [ ] Preview-before-apply đã được kiểm nếu slice có write action
- [ ] Nếu là frontend list lớn, đã dùng `PaginationBar`
- [ ] Text UI mới đã qua i18n tiếng Việt
- [ ] Nếu là docs change: đã có audit report doc riêng
- [ ] Đã có explicit consent record nếu slice là coding slice

## I. Self-audit checklist

- [ ] Đã đối chiếu slice với Req ID trong traceability matrix
- [ ] Đã chạy focused validation ngay sau hoàn tất slice
- [ ] Đã thu đúng loại evidence cần thiết cho slice này
- [ ] Đã cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- [ ] Đã cập nhật `PROGRESS_DASHBOARD.md`
- [ ] Đã ghi residual risk nếu còn

## J. Verdict nội bộ

- Verdict: PASS / PASS WITH NOTES / FAIL
- Rationale:
  - ____

## K. Residual risks and follow-up

1. Risk: ____
   - Owner: ____
   - ETA: ____
2. Risk: ____
   - Owner: ____
   - ETA: ____

## L. Sign-off

- Slice owner: ____  Date/Time: ____
- Internal reviewer: ____  Date/Time: ____
- QA reviewer: ____  Date/Time: ____