# RCA Revision: Prefetch Health Drift and Legacy Path Risk
**Date**: 2026-04-21  
**Scope**: Realtime prefetch, health endpoint, scheduler/task runtime, startup warmup  
**Status**: Mitigated, chua dong incident  
**Policy gate**: Mot chuan su that (SSOT), khong duy tri dual-path legacy

---

## 1) Executive Summary

Su co khong chi la van de runtime ma la van de governance code: he thong dang ton tai pha tron giua luong moi (shard scheduler) va legacy assumptions (single scan + retry narrative). Ket qua la bao cao truoc day co nhieu diem khong sat thuc te, dan den nguy co fix sai muc tieu.

RCA ban nay chot nguyen tac thuc thi:
- Chi giu 1 luong canonical trong production.
- Xoa endpoint/code legacy sau migration, khong de che do song song keo dai.
- Mọi dashboard, script, test, docs phai doi sang SSOT.

---

## 2) Facts Da Xac Minh (Ground Truth)

### Fact A - Runtime backend hien tai
- Backend image dang dung `python:3.11-slim`, shell startup la `/bin/sh`.
- `entrypoint.sh` hien tai la LF-only (khong phai CRLF).

### Fact B - Luong prefetch hien tai la shard scheduler
- Scheduler enqueue theo tier/shard.
- Runtime log thuc te cho thay universe 37 symbols duoc chia 4 shard hot, moi shard 1 batch.

### Fact C - Throttle 1.5s da co
- Da ton tai `time.sleep(1.5)` giua cac chunk trong ca shard task va legacy task.

### Fact D - Health 503 hien tai do stale meta, khong phai cache miss 0/10
- Payload health cho thay `reason=stale_prefetch_meta` voi `sample_cache_hits=12/12`.

### Fact E - Endpoint canonical la `/api/health/prefetch/`
- Khong co route `/api/system/prefetch/` trong backend runtime.

---

## 3) Problem Statement Chuan Hoa

Van de goc khong phai "chi do 429", ma la:
- Do lech SSOT giua implementation moi va cach mo ta/van hanh theo legacy.
- Do ton tai artifact legacy trong docs/script/nhan thuc van hanh.
- Do observability prefetch meta chua du de chot incident la "Resolved".

---

## 4) Root Cause (5 Whys)

1. Vi sao incident report sai mot phan?  
Vi bao cao tron luong legacy voi luong shard scheduler.

2. Vi sao tron luong?  
Vi chua co migration gate bat buoc de tat hoan toan legacy assumptions.

3. Vi sao migration gate khong chot?  
Vi docs/script/test va runtime de chung cac artifact khac nhau.

4. Vi sao artifact khac nhau ton tai dai?  
Vi chua ap dung chinh sach xoa code cu ngay sau khi luong moi dat DoD.

5. Vi sao chua xoa code cu?  
Vi thieu checklist SSOT-level release gate rang buoc doi backend/frontend/ops.

Ket luan RCA: **Governance drift + dual-path debt** la root cause he thong.

---

## 5) Corrective Actions (Bat buoc thuc thi)

### P0 - Dong bo su that va chan drift (24h)
1. Chuan hoa endpoint monitoring ve duy nhat `/api/health/prefetch/`.
2. Cap nhat toan bo docs/scripts dang reference endpoint legacy.
3. Dat incident status tu `Resolved` -> `Mitigated` cho den khi qua du SLO freshness.
4. Bo sung evidence block bat buoc trong incident docs: log + payload + timestamp + service version.

### P1 - Cat bo legacy runtime path (48-72h)
1. Xac nhan luong canonical: shard scheduler la SSOT prefetch runtime.
2. Loai bo luong legacy prefetch scheduler branch khoi runtime production.
3. Xoa hooks, flags, docs, test data phuc vu legacy path.
4. Freeze API contract theo canonical payload/schema duy nhat.

**P1 execution status (2026-04-21):**
- DONE: scheduler branch legacy `prefetch-ticker-price-board` da bi go khoi runtime settings.
- DONE: admin warm prefetch API da chay/queue theo canonical flow (`build_realtime_symbol_universe_snapshot` + `schedule_realtime_prefetch_shards`).
- DONE: legacy task `prefetch_ticker_price_board` da bi xoa khoi `tasks_prefetch.py`.
- DONE: legacy bridge `_legacy_views_module` trong admin runtime da bi loai bo, thay bang import truc tiep tu `runtime_policy_helpers`.
- DONE: bo sung gate test chong tai xuat legacy symbol trong runtime files.

### P2 - Hard gate release theo SSOT (<= 7 ngay)
1. Tao release checklist "No Legacy Left Behind":
    - Khong con endpoint cu.
    - Khong con task/scheduler cu.
    - Khong con docs huong dan cu.
    - Khong con tests bám luong cu.
2. CI gate fail neu con reference legacy keyword/route.
3. Tao dashboard canary so sanh SLO truoc/sau xoa legacy.

---

## 6) Implementation Plan Cho Doi Code

### Workstream A - Backend (Owner: Backend Lead)
1. Chot danh sach symbol/call-site canonical cho prefetch shard.
2. Xoa code path legacy khong con duoc invoke.
3. Chuan hoa retry/backoff ve 1 co che duy nhat theo policy.
4. Chot health reason taxonomy (`ok`, `stale_prefetch_meta`, `policy_throttled`, ...).

### Workstream B - Frontend/Admin Ops (Owner: Frontend Lead)
1. Tat ca UI health va admin stats doc duy nhat endpoint canonical.
2. Loai bo hardcoded fallback endpoint cu.
3. Chuan hoa thong diep DEGRADED theo reason code canonical.

### Workstream C - Ops/SRE (Owner: Ops Lead)
1. Cap nhat script thu thap evidence theo endpoint canonical.
2. Chuan hoa runbook restart/checklist post-deploy.
3. Dat SLO gate:
    - prefetch freshness p95 <= 120s trong market_open
    - sample cache hit ratio >= 95%
    - khong co stale_prefetch_meta lien tuc > 3 chu ky

### Workstream D - QA (Owner: QA Lead)
1. Bo test matrix legacy.
2. Tao regression suite cho canonical flow.
3. Add test "no legacy route reference" va "single source contract".

---

## 7) Definition of Done (DoD)

Incident chi duoc dong khi dat du 100%:
- Khong con endpoint/code/scheduler/test/doc legacy trong nhom prefetch health.
- Dashboard va script ops chi dung canonical route/schema.
- CI pass voi gate khong reference legacy.
- Soak test >= 24h dat SLO freshness + cache-hit.
- RCA evidence pack day du va reproducible.

---

## 8) Risk Va Rollback

- Khong rollback bang cach mo lai legacy path.
- Rollback duy nhat: quay ve release tag truoc migration va giu nguyen SSOT policy gate cho release tiep theo.
- Neu can emergency, dung feature flag tren canonical path thay vi phuc hoi code cu.

---

## 9) Task Board De Thuc Thi Ngay

1. Tao PR-1: docs/scripts endpoint canonicalization.  
2. Tao PR-2: remove legacy runtime path + tests cleanup.  
3. Tao PR-3: CI legacy-reference gate + release checklist.  
4. Tao PR-4: soak test + evidence pack + incident close report.

Nguong chap nhan merge moi PR:
- Co evidence attach.
- Co file list audit cap nhat.
- Co owner/ETA ro rang.
