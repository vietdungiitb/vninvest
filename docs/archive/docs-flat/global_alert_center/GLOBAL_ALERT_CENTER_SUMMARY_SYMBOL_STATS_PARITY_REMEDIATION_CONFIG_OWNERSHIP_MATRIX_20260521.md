# Config Ownership Matrix — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21

---

## 1. Nguyên tắc ownership

1. Mỗi concern chỉ có một canonical computation owner.
2. Frontend không được sở hữu aggregate logic của thống kê theo mã.
3. Timeframe semantics phải do backend định nghĩa và thực thi.

---

## 2. Ownership matrix

| Config / Concern | Current canonical writer | Transition owner | End-state owner |
|---|---|---|---|
| Scope filter semantics (`symbol`, `severity`, `family`, `session_date`, `timeframe`) | `signal_intelligence.views` | Core signal_intelligence | Core signal_intelligence |
| Summary aggregates (`total`, `unseen`, `by_severity`) | `signal_intelligence.views` | Core signal_intelligence | Core signal_intelligence |
| Symbol stats aggregates | N/A (missing endpoint) | Core signal_intelligence | Core signal_intelligence |
| Feed pagination behavior | `vninvest_core.pagination` | Core platform | Core platform |
| UI rendering of metrics | `packages/web AlertCenterPage` | Web frontend | Web frontend |
| Adapter route ownership | `packages/web/src/adapters/coreApiAdapter.js` | Web frontend + Core API | Web frontend + Core API |

---

## 3. Ownership rules cần giữ

1. Không cho phép local aggregate theo mã từ feed page ở frontend.
2. Không cho phép timeframe-only control ở frontend mà backend không thực thi.
3. Mọi thay đổi contract phải cập nhật adapter và test cùng lúc.
