# Runbook - Symbol Engagement Warm-up (2026-04-23)

## 1) Muc tieu van hanh
Dam bao warm-up hoat dong on dinh, skip dung luc khi data da fresh, va khong tao duplicate task trong gio giao dich.

## 2) Monitoring checklist
- Queue depth cua warm-up task.
- Ty le skipped_fresh va skipped_lock.
- Ty le success/failed va p95 latency.
- So symbol co engagement moi nhung chua co IntradayTick sau N phut.

## 3) Alert de xuat
- Alert A: warm-up_failed_total tang dot bien trong 5 phut.
- Alert B: warm-up_latency_ms p95 vuot nguong.
- Alert C: symbol engaged but no IntradayTick after threshold time.

## 4) Kich ban su co va xu ly

### Incident 1 - Duplicate warm-up jobs
- Trieu chung: nhieu task cho cung symbol/day.
- Kiem tra:
  - lock key format/TTL.
  - cache availability.
- Xu ly:
  - khoi phuc cache connectivity.
  - tam thoi giam concurrency.
  - verify skipped_lock metric.

### Incident 2 - Warm-up fail do provider
- Trieu chung: failed_total tang cao.
- Kiem tra:
  - provider health.
  - timeout logs.
- Xu ly:
  - tang backoff tam thoi.
  - fallback cho UI tiep tuc hien thi du lieu gan nhat.

### Incident 3 - Data stale du warm-up success
- Trieu chung: co success nhung chart van thieu.
- Kiem tra:
  - freshness threshold co qua chat.
  - tick count sau warm-up.
- Xu ly:
  - dieu chinh threshold theo gio giao dich.
  - re-run warm-up 1 lan qua admin trigger.

## 5) Operational commands (template)
- Kiem tra containers health.
- Kiem tra warm-up task queue length.
- Kiem tra so IntradayTick theo symbol/ngay.

## 6) Rollback strategy
- Disable feature flag warm-up.
- Giu scheduler la nguon cap du lieu chinh.
- Theo doi chart behavior va metric regressions.

## 7) Sign-off checklist truoc production
- [ ] Alerts da duoc cau hinh.
- [ ] Dashboard metrics da co du panel.
- [ ] Team on-call nam runbook.
- [ ] Feature flag rollback da test.
