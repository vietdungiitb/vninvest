# Self Audit and Test Protocol — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21

---

## 1. Mục tiêu audit

Đảm bảo mọi số liệu Alert Center được tính nhất quán theo cùng scope lọc và không gây hiểu nhầm cho người dùng.

---

## 2. Checklist self-audit bắt buộc

### A. Scope correctness
- [ ] Có shared scope builder dùng chung feed/summary/symbol-stats/context
- [ ] `timeframe` được parse và áp filter tại backend
- [ ] `session_date` và `timeframe` không xung đột logic

### B. Aggregate correctness
- [ ] `summary.total == sum(symbol_stats.count)`
- [ ] `by_severity` summary khớp tổng `by_severity` theo mã
- [ ] `unseen` phản ánh user hiện tại

### C. Frontend correctness
- [ ] Bảng theo mã dùng payload server, không dùng local feed sample aggregate
- [ ] Summary cards và bảng theo mã dùng cùng filter state
- [ ] Labels phân biệt rõ toàn scope và page hiển thị

### D. Contract correctness
- [ ] Endpoint symbol-stats có pagination/schema rõ ràng
- [ ] `coreApiAdapter` có methods tương ứng
- [ ] Không có direct fetch business route ngoài adapter

### E. Evidence correctness
- [ ] Có snapshot API trước/sau fix
- [ ] Có screenshot UI trước/sau fix
- [ ] Có residual risk note

---

## 3. Test categories bắt buộc

1. Backend API tests cho timeframe.
2. Backend invariant tests cho total vs symbol sum.
3. Backend multi-user tests cho unseen.
4. Frontend adapter tests cho endpoints mới.
5. Frontend page tests cho scope sync và labels.

---

## 4. Fail conditions

Block merge nếu có một trong các dấu hiệu:

1. `summary.total != sum(symbol_stats.count)` trong cùng scope.
2. Chuyển timeframe không làm thay đổi dữ liệu server.
3. Bảng theo mã vẫn aggregate từ feed page sample.
4. UI không ghi rõ ngữ nghĩa phạm vi số liệu.
5. Thiếu evidence bàn giao cho slice hoàn tất.
