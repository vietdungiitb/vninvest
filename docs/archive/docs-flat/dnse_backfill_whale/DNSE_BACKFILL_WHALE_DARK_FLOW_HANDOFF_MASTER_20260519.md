# DNSE Historical Backfill Whale & Dark Flow — Handoff Master
**Ngày**: 2026-05-19
**Status**: Approved — Ready for execution
**Scope**: Backfill IntradayTick lịch sử từ DNSE cho 2 chế độ: hệ thống (admin) và người dùng tự phục vụ; sau đó tái phát hiện WhaleAlertCanonical + CVD cho các phiên lịch sử.

---

## 1. Mục tiêu

1. Cung cấp IntradayTick lịch sử tối thiểu 3 tháng để CVD/buy_strength/dark_flow có ý nghĩa thống kê.
2. Admin (quản trị viên) có thể trigger backfill hàng loạt mã qua SOC Data Ops mà không cần chỉnh env var.
3. Người dùng có thể tự tải lịch sử cho mã cụ thể bằng DNSE API ID/KEY cá nhân.
4. Dữ liệu người dùng tải về sẽ ghi vào shared DB nếu ngày đó còn thiếu trong hệ thống — không tạo silo.
5. Credentials DNSE được lưu mã hóa (Fernet/AES) trong DB, không bao giờ xuất hiện plain text trong env var hoặc logs.
6. Có bộ tài liệu bàn giao đủ để team code và AI agent thực thi + audit mà không cần hỏi lại.

---

## 2. Quyết định thiết kế đã khóa

1. **`UserDNSECredential`** là SSOT duy nhất cho DNSE API key/secret — không dùng env var.
2. **`is_system_provider=True`** chỉ admin (staff/superuser) mới được set; tối đa 1 credential active làm system provider.
3. **System backfill task** đọc credential từ `UserDNSECredential(is_system_provider=True)`; nếu không có → abort, không fallback về env var.
4. **User backfill task** đọc credential của chính user gọi API; không dùng credential của user khác.
5. **Presence check**: `IntradayTick.objects.filter(symbol=sym, timestamp__date=d).exists()` → skip nếu đã có (và `overwrite=False`). Không cần migration unique constraint.
6. **Sau khi insert IntradayTick**: tự động trigger `detect_and_store_global_whale_alerts(symbol, session_date=d)` để populate `WhaleAlertCanonical`.
7. **`detect_and_store_global_whale_alerts`** được mở rộng nhận optional `session_date` param — backwards compatible.
8. **`fetch_intraday_tape_history()`** trong `vnbroker_adapter.py` là SSOT duy nhất cho historical DNSE tape — caller không import vnbroker trực tiếp.
9. **Không tạo per-user data silo**: dữ liệu market luôn là shared; user chỉ sở hữu credential, không sở hữu bản sao data riêng.
10. **Rate limiting user endpoint**: 5 request/user/ngày + 1 request/user/2 phút (burst).
11. **VN UTC+7 → UTC**: mọi DNSE timestamp phải được convert sang UTC-aware trước khi persist.
12. **`source` field**: system backfill ghi `'dnse_system'`, user backfill ghi `'dnse_user'`.

---

## 3. Deliverables doc-pack

| # | Tài liệu | Đường dẫn |
|---|---|---|
| 1 | Handoff Master | docs/DNSE_BACKFILL_WHALE_DARK_FLOW_HANDOFF_MASTER_20260519.md |
| 2 | Implementation Plan | docs/IMPLEMENTATION_PLAN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 3 | Technical Spec | docs/TECH_SPEC_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 4 | Taskboard | docs/TASKBOARD_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 5 | Traceability Matrix | docs/DNSE_BACKFILL_WHALE_DARK_FLOW_TRACEABILITY_MATRIX_20260519.md |
| 6 | Self Audit and Test Protocol | docs/DNSE_BACKFILL_WHALE_DARK_FLOW_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md |
| 7 | Execution Evidence Template | docs/DNSE_BACKFILL_WHALE_DARK_FLOW_EXECUTION_EVIDENCE_TEMPLATE_20260519.md |
| 8 | Config Ownership Matrix | docs/DNSE_BACKFILL_WHALE_DARK_FLOW_CONFIG_OWNERSHIP_MATRIX_20260519.md |
| 9 | Code Quality Constitution | docs/DNSE_BACKFILL_WHALE_DARK_FLOW_CODE_QUALITY_CONSTITUTION_20260519.md |
| 10 | Frontend Design | docs/FRONTEND_DESIGN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 11 | Backend Design | docs/BACKEND_DESIGN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 12 | Run Code Review | docs/RUN_CODE_REVIEW_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 13 | Run Integration Tests | docs/RUN_INTEGRATION_TESTS_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |
| 14 | Run Spec Audit | docs/RUN_SPEC_AUDIT_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md |

---

## 4. Kiến trúc mục tiêu (tóm tắt)

```text
DNSE Historical Tape API
  └── market_data/vnbroker_adapter.py
        fetch_intraday_tape_history(symbol, date, api_key, api_secret)
             │
             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Chế độ A: System Backfill (Admin/SOC)                        │
  │  Credential: UserDNSECredential(is_system_provider=True)      │
  │  Trigger: POST /core/v1/data-ingest/trigger/whale-backfill/  │
  │  Task: data_ingest.tasks.backfill_intraday_tick_system        │
  │  Scope: nhiều mã × nhiều ngày, GlobalSymbolRegistry hot/warm  │
  └──────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Chế độ B: User Self-Serve Backfill                           │
  │  Credential: UserDNSECredential của user gọi API              │
  │  Trigger: POST /core/v1/whale/backfill-symbol/               │
  │  Task: data_ingest.tasks.backfill_intraday_tick_user          │
  │  Scope: 1 mã × days_back ngày (default 90)                   │
  └──────────────────────────────────────────────────────────────┘
             │
             ▼
  IntradayTick (shared global table)
  Presence check: skip nếu đã có
             │
             ▼
  signal_intelligence.tasks.detect_and_store_global_whale_alerts
    (symbol, session_date=d) — auto-triggered sau mỗi date inserted
             │
             ▼
  WhaleAlertCanonical + OrderFlowEvent
             │
             ▼
  SessionFacts (CVD / buy_strength / dark_flow_score) per phiên
```

---

## 5. Định nghĩa thành công

1. Sau backfill hệ thống, `IntradayTick` có dữ liệu >= 60 ngày giao dịch cho các mã VN30.
2. `WhaleAlertCanonical` có records cho các phiên lịch sử — `buy_strength` trả về giá trị thực (≠ 50.0).
3. Endpoint `/core/v1/whale/session-facts/<symbol>/?date=YYYY-MM-DD` trả về dữ liệu đúng cho phiên bất kỳ trong lịch sử được backfill.
4. User với DNSE credential hợp lệ có thể trigger backfill 1 mã và thấy kết quả trên UI whale alerts.
5. Credentials không xuất hiện trong logs, env vars, API responses, hay code source.
6. Rate limit 5/day/user được enforce — request thứ 6 nhận HTTP 429.
7. Toàn bộ tasks trong taskboard có evidence + validation command rõ ràng.

---

## 6. Baseline hiện tại

| Thành phần | Trạng thái |
|---|---|
| `signal_intelligence/order_flow_engine.py` | ✅ DONE (commit 8856732f) |
| `signal_intelligence/tasks.py` (per-tick engine) | ✅ DONE (commit 8856732f) |
| `market_data/vnbroker_adapter.py` | ⚠️ Thiếu `fetch_intraday_tape_history()` |
| `UserDNSECredential` model | ❌ Chưa có |
| Backfill Celery tasks | ❌ Chưa có |
| `detect_and_store_global_whale_alerts` session_date param | ❌ Chưa có |
| SOC trigger endpoint | ⚠️ Có trigger/daily-prices, chưa có trigger/whale-backfill |
| User backfill endpoint | ❌ Chưa có |
| Frontend SOC panel | ⚠️ Cần bổ sung backfill widget |
| Frontend user settings | ❌ Chưa có tab kết nối DNSE |

---

## 7. Hard rules từ AGENTS.md áp dụng

- `market_data/vnbroker_adapter.py` là SSOT: tuyệt đối cấm import `DNSEQuote` từ ngoài adapter.
- Tuyệt đối cấm `except: pass` hay `except Exception: pass` trong API path.
- Error response theo khung chuẩn `{detail, code, timestamp, request_id}`.
- Text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu.
- Tất cả API calls từ frontend phải qua `coreApiAdapter.js`.
- Không tạo per-user data silo — user promote demand vào global matrix.
- Runtime refresh bắt buộc qua `./start_dev.ps1` sau mỗi slice runtime/code.
- Sau mỗi slice: cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.
