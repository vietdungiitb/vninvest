# BẢNG TRUY XUẤT NGUỒN GỐC (TRACEABILITY MATRIX)
## GLOBAL SCREENER & AI ALERTS SCALABILITY REFACTOR

Bảng này giúp liên kết các yêu cầu kiến trúc cốt lõi với mã nguồn thực tế và kết quả kiểm thử. Mọi dòng code sinh ra phải nhắm tới giải quyết một trong các yêu cầu dưới đây.

| Mã Yêu Cầu (REQ_ID) | Mô tả Yêu cầu | Tập tin bị thay đổi (Target Files) | Giao thức Kiểm thử (Test Protocol) |
| --- | --- | --- | --- |
| `REQ_SSOT_01` | Screener không tự gọi DB raw mà lấy từ SSOT Cache/Services. | `services_global_screener.py` | `test_global_screener_ssot_integration` |
| `REQ_DEDUP_01` | Khóa gọi LLM giới hạn ở mức độ Symbol, không phân biệt User. | `tasks_whale_preflight.py` | `test_llm_cache_lock_by_symbol` |
| `REQ_DEDUP_02` | Celery Auto Gen Task loại bỏ vòng lặp query User. | `tasks_whale_auto_generation.py` | `test_auto_gen_task_takes_symbol_list` |
| `REQ_MEM_01` | User Screener API chỉ đọc kết quả filter trên mảng Memory/Redis. | `views_screener.py` | `test_screener_run_no_db_queries` |
| `REQ_FLAG_01` | Tính năng User Screener có thể bị tắt bởi Admin (Feature Flag). | `models_screener_admin.py`, `views_screener.py` | `test_user_screener_disabled_403` |
| `REQ_HIST_01` | Lịch sử thông báo khi có Match hoặc Tư vấn phải lưu vào DB. | `models_alert_history.py`, `services_whale_broadcast.py` | `test_alert_history_saved_on_event` |
| `REQ_CRON_01` | Lịch trình quét (Cron Job) lấy từ Database linh động. | `tasks_global_screener.py`, `celerybeat-schedule` | `test_celery_task_reads_dynamic_schedule` |

## Lưu ý về Trách Nhiệm Audit
Sau khi lập trình viên code xong một Slice, phải mở file **TRACEABILITY MATRIX** này ra và tự đánh giá xem phần code của mình đang thỏa mãn mã yêu cầu (REQ_ID) nào. Ghi chú lại vào báo cáo Evidence.
