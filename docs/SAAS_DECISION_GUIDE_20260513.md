# HƯỚNG DẪN RA QUYẾT ĐỊNH — SaaS Migration Path

**Ngày**: 2026-05-13  
**Mục đích**: Tổng hợp để ra quyết định chiến lược, không phải tài liệu kỹ thuật

---

## CÂU HỎI CẦN TRẢ LỜI TRƯỚC KHI QUYẾT ĐỊNH

### Câu hỏi 1: Timeline là bao lâu?

| Timeline | Phương án phù hợp |
|---|---|
| 1-2 tuần | Chỉ làm AI Advisory wire + WebSocket verify |
| 1 tháng | Portfolio Analytics + core DB tách + AI Advisory |
| 3 tháng | Full migration — tắt được legacy backend |
| Không deadline | Incremental, feature-by-feature |

---

### Câu hỏi 2: Features nào là critical?

Kiểm tra analytics usage:
- SubAccount: Bao nhiêu user dùng? (Nếu < 5%, drop)
- Screener: Bao nhiêu user dùng? (Nếu < 10%, stub OK tạm)
- Telegram: Bao nhiêu user link Telegram?

---

### Câu hỏi 3: Mục tiêu tắt legacy là gì?

**Mục tiêu A — Cost saving (tắt backend container)**:  
→ Cần: Portfolio Analytics + Ingest migration + Core DB tách  
→ Timeline: ~3 tháng

**Mục tiêu B — Code simplification (xóa backend/ folder)**:  
→ Cần: Tất cả P0, P1, P2  
→ Timeline: 4-6 tháng

**Mục tiêu C — Independence (không dùng legacy DB)**:  
→ Cần: Thêm data migration scripts  
→ Timeline: Thêm 2-3 tuần sau khi tắt được container

---

## BA KỊCH BẢN CỤ THỂ

### Kịch bản A: "Quick Win" — Làm trong 2 tuần

**Mục tiêu**: Cải thiện UX ngay, không rủi ro lớn.

**Việc làm**:
1. Wire AI Advisory frontend → `/core/v1/advisory/latest/{symbol}/` (2 ngày)
2. Verify WebSocket consumer (1 ngày)
3. Rotate CORE_PAT_PEPPER trong prod (0.5 ngày)

**Không làm**:
- Không tắt legacy
- Không migrate database
- Không implement analytics

**Kết quả**: Core advisory endpoints được dùng, security improved. Legacy vẫn running.

---

### Kịch bản B: "Portfolio Analytics" — Làm trong 4-6 tuần

**Mục tiêu**: Core xử lý được toàn bộ portfolio tracking.

**Việc làm**:
1. Implement Portfolio Analytics views (holdings, summary, chart, equity-curve)
2. Wire frontend portfolio analytics → core
3. SubAccount decision (migrate simple model hoặc drop)
4. Validate parity vs legacy

**Không làm**:
- Không tắt legacy (vẫn cần cho stock-management, ingest)
- Không migrate database

**Kết quả**: Portfolio feature hoàn toàn từ core. Legacy chỉ còn phục vụ stock data.

---

### Kịch bản C: "Full Independence" — Làm trong 3 tháng

**Mục tiêu**: Tắt `backend` và `backend-worker` containers.

**Sequence**:

**Tuần 1-2**: Portfolio Analytics (P0-1)
**Tuần 3**: AI Advisory wire, WebSocket verify
**Tuần 4-5**: Ingest migration sang core-worker
**Tuần 6**: Core DB tách (setup `vninvest_core`)
**Tuần 7-8**: Data migration scripts (copy portfolios/transactions/watchlists)
**Tuần 9**: Stock Management core implementation (profile, chart, news)
**Tuần 10**: SubAccount + Screener quyết định cuối
**Tuần 11**: Parity testing (shadow run 3 ngày)
**Tuần 12**: Decommission legacy backend

**Tắt legacy checklist**:
- [ ] Portfolio Analytics PASS parity >= 99%
- [ ] Stock data từ core (không qua bridge)
- [ ] Ingest worker chạy trong core-worker
- [ ] Core DB tách (vninvest_core riêng)
- [ ] Data migration complete
- [ ] SubAccount resolved
- [ ] Screener resolved
- [ ] Telegram resolved
- [ ] 3 ngày shadow run tất cả features
- [ ] Tech Lead sign-off

---

## ĐỀ XUẤT CỦA TÔI

**Bắt đầu ngay với Kịch bản A** trong 2 tuần (low risk, quick improvement), sau đó quyết định Kịch bản B hoặc C tùy vào business priority.

Việc làm ngay không cần họp:
1. `CORE_PAT_PEPPER` rotation trong prod — security risk, làm ngay
2. AI Advisory wire frontend → core — 2 ngày, không rủi ro
3. WebSocket verify — 1 ngày investigation

---

## ĐỌC THÊM

| Tài liệu | Mục đích |
|---|---|
| [SAAS_STATE_ASSESSMENT_20260513.md](archive/docs-flat/saas_state_assessment/SAAS_STATE_ASSESSMENT_20260513.md) | Trạng thái chi tiết từng domain |
| [SAAS_REMAINING_WORK_20260513.md](archive/docs-flat/saas_remaining_work/SAAS_REMAINING_WORK_20260513.md) | Danh sách việc cần làm với effort estimate |
