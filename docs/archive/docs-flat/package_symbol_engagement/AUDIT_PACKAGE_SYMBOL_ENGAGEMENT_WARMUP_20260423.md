# Audit Package - Symbol Engagement Warm-up (2026-04-23)

## 1) Muc tieu goi audit
Bo tai lieu nay dung de audit viec trien khai hanh vi chung khi them symbol tu nhieu nguon (tracked symbols, watchlist, holdings), voi warm-up la lop dem den khi scheduler lap lai.

## 2) Pham vi audit
In scope:
- Hanh vi kich hoat warm-up dong nhat giua cac nguon engagement.
- Co che freshness check va lock idempotency.
- Tinh khong gay qua tai (skip khi fresh, tranh duplicate task).
- Metrics, logs, va kha nang truy vet.

Out of scope:
- Thay doi scheduler cadence.
- Xay dung service nen moi thay scheduler.

## 3) Bo tai lieu can review (bat buoc)
1. docs/IMPLEMENTATION_PLAN_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
2. docs/TECH_SPEC_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
3. docs/TASKBOARD_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
4. docs/QA_TEST_MATRIX_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
5. docs/RUNBOOK_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
6. docs/TRACEABILITY_MATRIX_SYMBOL_ENGAGEMENT_WARMUP_20260423.md

## 4) Tieu chi gate de dong audit
Gate A - Functional parity:
- Add symbol tu tracked/watchlist/holdings deu kich hoat cung mot luong backend.

Gate B - Idempotency:
- Cung symbol/cung ngay khong co nhieu warm-up task chay song song.

Gate C - Freshness-aware:
- Co du lieu fresh thi skip warm-up.
- Thieu/stale thi warm-up chay dung mot lan.

Gate D - Performance:
- Khong tao dot bien queue trong gio giao dich.
- Co gioi han retry va concurrency.

Gate E - Observability:
- Metrics/day logs du de tra loi: ai kich hoat, khi nao, ket qua gi.

## 5) Bang evidence can nop khi audit
- Build/test logs:
  - Unit tests cho service/task.
  - Integration tests cho 3 nguon engagement.
  - Concurrency test cho cung symbol nhieu users.
- Runtime evidence:
  - Metrics snapshot sau rollout.
  - Trich xuat logs cho warm-up success/skip/fail.
- Ops evidence:
  - Kich ban su co va cach recover trong runbook.

## 6) RACI de doi code thuc thi
- Owner implementation: Backend team.
- Reviewer technical: Tech lead backend.
- Reviewer operations: DevOps/SRE.
- Sign-off product behavior: Product owner.

## 7) Muc ky xac nhan
- [ ] Tech lead approve implementation quality.
- [ ] QA approve test matrix ket qua PASS.
- [ ] DevOps approve runbook va monitoring readiness.
- [ ] Product owner approve behavior parity giua cac entry points.
