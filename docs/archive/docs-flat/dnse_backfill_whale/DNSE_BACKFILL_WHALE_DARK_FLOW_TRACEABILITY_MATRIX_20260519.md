# Traceability Matrix — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## Requirement → Task → Test mapping

| Req ID | Requirement | Tasks | Test Cases | Validation Command |
|---|---|---|---|---|
| R1 | DNSE historical tape có thể fetch cho bất kỳ ngày giao dịch nào | D01 | T-A1, T-A2, T-A3 | `python manage.py test market_data.tests.test_vnbroker_adapter_history` |
| R2 | DNSE API key/secret của user được lưu mã hóa, không plain text | D02 | T-B1, T-B2 | `python manage.py test identity_access.tests.test_dnse_credential` |
| R3 | Tối đa 1 credential là system provider tại một thời điểm | D02 | T-B4 | Unique constraint test |
| R4 | Non-admin không được set is_system_provider | D02 | T-B3 | HTTP 403 test |
| R5 | System backfill task abort khi không có system provider | D03 | T-C1 | `python manage.py test data_ingest.tests.test_backfill_tasks` |
| R6 | System backfill không tạo duplicate (idempotent) | D03 | T-C2 | Presence check test |
| R7 | User backfill bị rate limit 5 req/ngày | D04 | T-C3 | HTTP 429 test |
| R8 | User backfill skip ngày đã đủ data (>= 100 ticks) | D04 | T-C4 | Merge rule test |
| R9 | Detection task chạy đúng cho phiên lịch sử cụ thể | D05 | T-D1, T-D2 | `python manage.py test signal_intelligence.tests.test_detect_historical` |
| R10 | Frontend không gọi API trực tiếp, phải qua coreApiAdapter | D07 | Build check | `npm run build` |
| R11 | Tất cả text UI tiếng Việt qua i18n | D07 | i18n audit | Manual review + grep "hardcoded" |
| R12 | Credentials không xuất hiện trong logs | D01, D02 | Log audit | grep api_key/api_secret trong log output |
| R13 | Auto-trigger detection sau mỗi backfill date | D03, D04 | detect_historical tests | Celery task call assertion |
| R14 | Rate limit burst 1/2min enforce riêng ngoài 5/day | D04 | T-C3b | Burst rate test |

---

## Hard rules từ AGENTS.md

| Rule | Source | Verified by |
|---|---|---|
| vnbroker_adapter.py là SSOT duy nhất | AGENTS §11 | Grep: không có DNSEQuote import ngoài adapter |
| Cấm except:pass trong API path | AGENTS §10.5 | Code review checklist |
| Error response theo khung chuẩn | AGENTS §10.6 | API response shape test |
| Text UI qua i18n tiếng Việt | AGENTS §8.9 | i18n coverage check |
| API calls từ web qua coreApiAdapter | AGENTS §8.8 | Frontend build check |
| Không tạo per-user data silo | AGENTS §12.3 | Architecture review |
| Runtime refresh qua start_dev.ps1 | AGENTS §6.6 | Evidence template |

---

## Coverage gaps (không trong scope)

| Item | Lý do ngoài scope |
|---|---|
| Fernet key rotation procedure | Operational procedure, không phải code |
| DNSE API unavailability > 24h | Fallback scope riêng, không block feature |
| Holiday calendar VN đầy đủ | Workaround: skip weekends, miss holiday OK |
| Batch job scheduler tự động (Celery Beat) | Giai đoạn 2 sau khi system backfill ổn định |
