# Checklist Whale Service Execution

Ngay cap nhat: 2026-04-23
Muc tieu: Checklist thuc thi de doi code lam theo tung buoc, khong can hoi lai.

Ghi chu pham vi:
- A-J la master checklist full implementation scope.
- Dot 2026-04-23ak la hotfix/re-audit slice, KHONG bao phu toan bo A-J.
- Vi vay, cac muc con [ ] trong A-J KHONG dong nghia voi fail cua hotfix slice; trang thai pass/fail cua dot nay duoc chot tai muc K.

## A. Kickoff va freeze pham vi

- [ ] Da doc DECISION_LOG va dong y toan bo quyet dinh nghiep vu.
- [ ] Da dong y rule threshold mismatch: tooltip theo user, realtime advisory theo system.
- [ ] Da dong y anti-spam 5 lop: rate-limit, idempotency, Redis lock, DB guard, queue dedupe.
- [ ] Da chot permission matrix admin/user cho trigger API.
- [ ] Da chot scope release va rollback owner.

## B. Backend migration va schema

- [ ] Tao migration fill null threshold cho TrackedSymbol.
- [ ] Logic fill null uu tien UserConfig.whale_alert_threshold, fallback 500.
- [ ] Them field is_stale vao TrackedSymbol.
- [ ] Tao model WhaleServiceJob va enum service_type/status.
- [ ] Them field idempotency_key, lock_key, progress_pct, counters, heartbeat_at.
- [ ] Them index can thiet cho WhaleServiceJob va TrackedSymbol.
- [ ] Enforce whale_alert_threshold_million null=False sau migration du lieu.
- [ ] Chay verify script: khong con ban ghi threshold null.

## C. Orchestration va anti-spam

- [ ] Implement WhaleJobManager tao job + state transitions.
- [ ] Implement helper tao idempotency_key tu service_type + scope + date range.
- [ ] Implement Redis lock theo scope job.
- [ ] Implement lock heartbeat gia han TTL khi task dang chay.
- [ ] Implement transactional DB guard + Redis create-gate de chong race.
- [ ] Implement duplicate queue guard o worker.
- [ ] Implement response state: accepted, in_progress, duplicate, throttled.

## D. Task va compute engine

- [ ] Implement recompute_whale_stats_task cho USER_REFRESH.
- [ ] Implement recompute_whale_stats_task cho GLOBAL_RECOMPUTE.
- [ ] Implement whale_backfill_service chunking va batching.
- [ ] Implement checkpoint/resume cho backfill.
- [ ] Persist data_state: no_data, zero_count, has_signal.
- [ ] Set is_stale=False sau khi recompute thanh cong.
- [ ] Mark PARTIAL neu loi mot phan batch.

## E. API backend

- [ ] Tao POST /api/portfolio/whale-service/trigger/.
- [ ] Tao GET /api/portfolio/whale-service/jobs/{job_id}/.
- [ ] Tao GET /api/portfolio/whale-service/jobs/.
- [ ] Nang cap stats API tra buy_count_raw, sell_count_raw.
- [ ] Stats API tra threshold_warning, is_stale, data_state.
- [ ] Validate symbol ownership cho USER_REFRESH.
- [ ] Ap dung rate limiting dung key policy.

## F. Frontend

- [ ] Them nut Manual Refresh tren WhaleBubbleChart.
- [ ] Disable nut khi co job cung scope dang RUNNING/PENDING.
- [ ] Hien thi progress/spinner theo job status.
- [ ] Tooltip map dung buy_count_raw/sell_count_raw.
- [ ] Hien thi warning khi user_threshold < system_threshold.
- [ ] Hien thi state no_data va zero_count ro rang.

## G. Admin UI

- [x] Form trigger GLOBAL_RECOMPUTE.
- [x] Form trigger BACKFILL voi default 3 thang.
- [x] Job registry list/filter theo status/service_type/date.
- [x] Co thao tac retry an toan cho FAILED/PARTIAL jobs.

## H. Testing

- [ ] Unit test state transitions cua WhaleServiceJob.
- [ ] Unit test idempotency va lock conflict.
- [ ] Unit test heartbeat lock TTL cho job dai.
- [ ] Integration test permission matrix.
- [ ] Integration test trigger API response states.
- [ ] Integration test stats API payload moi.
- [ ] Test backfill checkpoint/resume.
- [ ] Test no_data vs zero_count semantics.
- [ ] Spam test: 20 requests trong 30 giay cung scope.
- [ ] Regression test trang whale alerts khong vo UI.

## I. Deployment gate

- [ ] Chay staging migration thanh cong.
- [ ] Canary release thanh cong voi nho hon 10% user.
- [ ] Metrics on dinh: failed jobs, lock conflict, throttled rate.
- [ ] Khong phat hien duplicate compute job cung scope.
- [ ] Da chuan bi rollback playbook va owner ca truc.

## J. Evidence va handoff

- [x] Cap nhat test evidence vao QA report.
- [x] Cap nhat runbook neu co sai lech thuc te.
- [x] Cap nhat taskboard trang thai DONE/IN PROGRESS.
- [x] Cap nhat CODE_CHANGE_AUDIT_LEDGER.
- [x] Cap nhat PROGRESS_DASHBOARD audit file list.
- [x] Chot handoff cho team QA va van hanh.

## K. Re-audit execution 2026-04-23ak

- [x] Concurrency hardening: create race duoc chan, chi con 1 active job cung scope.
- [x] Worker lock conflict khong de lai PENDING orphan (mark SKIPPED_DUPLICATE).
- [x] Permission tests dung runtime behavior, khong monkeypatch `IsProPlan`.
- [x] Frontend polling doi sang exponential backoff co gioi han.
- [x] Production env drift da dong bo backend/.env.production voi policy production.
- [x] Test suite `test_whale_service_orchestration` pass 6/6.
- [x] Django check pass.
- [x] Compose production config render thanh cong.

## L. Runtime incident fix 2026-04-23as (pending jobs stuck)

- [x] Xac dinh duoc root cause worker task registry drift (`portfolio.compute_watchlist_indicators` unregistered).
- [x] Bo sung task import vao `portfolio/tasks.py` de worker autodiscover dang ky day du watchlist + whale service task.
- [x] Bo sung stale active job recovery trong `WhaleJobManager.get_or_create_job` de tranh duplicate gia do PENDING qua han.
- [x] Restart backend/celery_worker/celery_beat va xac nhan celery inspect registered da co task whale service.
- [x] Kiem chung E2E USER_REFRESH scope ACB: job cu stale bi auto-close, job moi chuyen COMPLETED.
