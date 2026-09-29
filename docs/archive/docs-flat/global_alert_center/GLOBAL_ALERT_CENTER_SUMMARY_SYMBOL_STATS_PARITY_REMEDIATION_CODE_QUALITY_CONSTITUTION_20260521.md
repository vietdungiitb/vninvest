# Code Quality Constitution — Global Alert Center Summary-Symbol Stats Parity Remediation

## 1. Purpose

Chất lượng của fix này không phải chỉ là "số trông hợp lý" mà là:

1. Cùng scope phải ra cùng truth ở mọi widget liên quan.
2. `timeframe` phải là server truth, không phải UI decoration.
3. Symbol stats phải đại diện toàn scope, không đại diện sample page.
4. Người dùng đọc UI không được hiểu sai ngữ nghĩa số liệu.

---

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Shared scope builder | 95% risk coverage | Sai scope là nguyên nhân gốc mismatch |
| Summary aggregates | 95% risk coverage | Sai total/unseen làm KPI mất tin cậy |
| Symbol-stats endpoints | 95% risk coverage | Cần server truth thay local sample truth |
| Frontend scope synchronization | 90% risk coverage | Tránh race/mismatch giữa các widget |
| UI semantics labeling | 90% risk coverage | Tránh hiểu sai dữ liệu |

---

## 3. Coverage theater prevention

Không được coi là pass nếu:

1. Test chỉ chạy trên dataset nhỏ hơn page size.
2. Chỉ verify render UI mà không verify invariant số liệu.
3. Timeframe button đổi active state nhưng payload không đổi.
4. Không có evidence snapshot đối chiếu summary với symbol-stats.

---

## 4. Fitness-to-purpose scenarios

### Scenario Q1 — KPI tổng cao, bảng mã thấp bất thường

Nguyên nhân điển hình: bảng tính từ feed page sample. Đây là fail-level issue.

### Scenario Q2 — Timeframe thay đổi nhưng dữ liệu không đổi

Nguyên nhân điển hình: backend không áp timeframe. Đây là fail-level issue.

### Scenario Q3 — Unseen biến động bất thường giữa users

Nguyên nhân điển hình: aggregate không khóa user cho deliveries. Đây là fail-level issue.

### Scenario Q4 — UI không ghi rõ phạm vi số liệu

Nguyên nhân điển hình: semantics mơ hồ tổng scope với page hiện tại. Đây là high-severity UX issue.
