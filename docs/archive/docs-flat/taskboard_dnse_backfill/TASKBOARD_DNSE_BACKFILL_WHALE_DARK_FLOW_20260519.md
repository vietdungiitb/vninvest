# Taskboard — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19
**Status**: Active — Pending execution

---

## Overview

| Task | Tên | Status | Owner | Note |
|---|---|---|---|---|
| D00 | Doc-pack khởi tạo | DONE | Copilot | Bộ tài liệu bàn giao đầy đủ được tạo |
| D01 | SSOT adapter historical fetch | TODO | Core Backend | `fetch_intraday_tape_history()` trong vnbroker_adapter.py |
| D02 | UserDNSECredential model + migration + CRUD API | TODO | Core Backend | Fernet encrypt, unique constraint system provider |
| D03 | System backfill task + SOC endpoint | TODO | Core Backend | Admin trigger, presence check, ServiceRunLog |
| D04 | User self-serve backfill task + endpoint | TODO | Core Backend | Rate limit 5/day, merge rule, auto-detect |
| D05 | Extend detect_and_store với session_date | TODO | Core Backend | Backwards compatible, filter theo ngày lịch sử |
| D06 | Integration test suite | TODO | QA / Core Backend | 13 test cases, 4 test files |
| D07 | Frontend SOC panel + User settings | TODO | Frontend | SOC backfill widget, DNSE credential tab |

Legend: TODO | IN PROGRESS | DONE | BLOCKED

---

## Gate checklist theo phase

### Phase A — Adapter SSOT (D01)
- [ ] `fetch_intraday_tape_history()` có trong `vnbroker_adapter.py`
- [ ] Không có import `DNSEQuote` bên ngoài adapter
- [ ] VN→UTC convert chính xác
- [ ] Không log api_key/api_secret
- [ ] 5 unit tests PASS

### Phase B — Credential model (D02)
- [ ] Migration tạo thành công
- [ ] Fernet encrypt/decrypt round-trip
- [ ] Unique constraint `unique_active_system_provider` hoạt động
- [ ] GET response không expose credentials
- [ ] `DNSE_CREDENTIAL_FERNET_KEY` trong compose.dev.env + compose.prod.env.example

### Phase C — System backfill (D03)
- [ ] Task abort khi no_system_provider
- [ ] Presence check idempotency
- [ ] ServiceRunLog ghi đầy đủ
- [ ] SOC endpoint 202 + task_id
- [ ] Detection trigger sau mỗi date inserted

### Phase D — User backfill (D04)
- [ ] Rate limit 429 tại request thứ 6/ngày
- [ ] Merge rule (>= 100 ticks → skip)
- [ ] `source='dnse_user'` cho records user insert
- [ ] Auto-trigger detection sau insert

### Phase E — Detection historical (D05)
- [ ] Call với session_date lọc đúng IntradayTick
- [ ] Call không có session_date hoạt động như cũ
- [ ] Không phá existing tests

### Phase F — Integration tests (D06)
- [ ] 13 test cases PASS
- [ ] `--keepdb` mode hoạt động
- [ ] Không có pytest warning mới

### Phase G — Frontend (D07)
- [ ] Build thành công
- [ ] i18n tiếng Việt đầy đủ
- [ ] API calls qua coreApiAdapter.js
- [ ] Rate limit feedback hiển thị đúng

---

## Evidence checklist (bắt buộc trước closeout)

- [ ] Evidence template điền đủ cho mỗi slice D01–D07
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` cập nhật
- [ ] `PROGRESS_DASHBOARD.md` cập nhật
- [ ] `module_tree_full.md` regenerate sau D02, D07
- [ ] Stack rebuild qua `./start_dev.ps1` sau mỗi slice runtime
- [ ] Commit riêng mỗi slice, pushed to `origin/dev`

---

## Residual risks

| Risk | Probability | Mitigation |
|---|---|---|
| DNSE API thay đổi column names | M | Unit test mock → phát hiện ngay khi update vnbroker |
| DNSE rate limit thực tế chặt hơn dự kiến | L | Configurable sleep interval, retry với backoff |
| Fernet key rotation dẫn đến decrypt fail | L | Document key rotation procedure; graceful error + user re-auth |
| Backfill volume làm chậm queue | M | `manual_on_demand` queue riêng, không ảnh hưởng hot/warm |
| Detection task chạy song song gây duplicate WhaleAlertCanonical | L | Idempotent source_ref constraint trên UnifiedAlert đã có |
