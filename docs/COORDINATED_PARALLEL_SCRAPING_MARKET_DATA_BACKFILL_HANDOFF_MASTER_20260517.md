# Coordinated Parallel Scraping Market Data Backfill - Handoff Master
**Ngay**: 2026-05-17
**Status**: Approved for planning and execution
**Scope**: Day du lich su gia (daily + intraday) cho cac ma trong global symbol matrix bang mo hinh Coordinated Parallel Scraping (CPS), giu missing-only semantics, va tu dong hoa qua queue-tier scheduler.

---

## 1. Muc tieu

1. Khong con tinh trang symbol moi chi co vai nen do planner chi xin trade_date.
2. Backfill du lieu theo global matrix, khong crawl silo theo user.
3. Parallel scraping co dieu phoi theo tier + provider + quota, khong full-scan mu quang.
4. Co observability ro rang cho backlog, throughput, fail-rate, va coverage trend.
5. Co bo tai lieu ban giao day du de team code va audit co the thuc thi ngay.

---

## 2. Hard decisions da khoa

1. Global symbol matrix la SSOT duy nhat cho universe crawl.
2. Planner la coordinator duy nhat cua requested_window; worker khong tu mo rong pham vi crawl.
3. Default policy la missing_only, overwrite_existing=false.
4. CPS phai chia theo queue tiers (hot/warm/cold/recovery) va provider buckets, co quota va lock.
5. Daily bootstrap cua symbol missing phai dung days-window (khong dung trade_date-only).
6. Intraday depth phai co policy rieng theo tier; cam full-depth indiscriminate cho long-tail.
7. Runtime refresh bat buoc qua ./start_dev.ps1 sau moi slice runtime/code.

---

## 3. Deliverables doc-pack

| # | Tai lieu | Duong dan |
|---|---|---|
| 1 | Handoff Master | docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_HANDOFF_MASTER_20260517.md |
| 2 | Implementation Plan | docs/IMPLEMENTATION_PLAN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 3 | Technical Spec | docs/TECH_SPEC_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 4 | Taskboard | docs/TASKBOARD_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 5 | Traceability Matrix | docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_TRACEABILITY_MATRIX_20260517.md |
| 6 | Self Audit and Test Protocol | docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_SELF_AUDIT_AND_TEST_PROTOCOL_20260517.md |
| 7 | Execution Evidence Template | docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_EXECUTION_EVIDENCE_TEMPLATE_20260517.md |
| 8 | Config Ownership Matrix | docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_CONFIG_OWNERSHIP_MATRIX_20260517.md |
| 9 | Code Quality Constitution | docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_CODE_QUALITY_CONSTITUTION_20260517.md |
| 10 | Frontend Design | docs/FRONTEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 11 | Backend Design | docs/BACKEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 12 | Run Code Review | docs/RUN_CODE_REVIEW_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 13 | Run Integration Tests | docs/RUN_INTEGRATION_TESTS_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |
| 14 | Run Spec Audit | docs/RUN_SPEC_AUDIT_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md |

---

## 4. Kien truc muc tieu (tom tat)

```text
Demand Sources -> Global Symbol Registry (SSOT)
                -> Coverage/Freshness Inventory
                -> Planner Preview/Run (missing-only)
                -> Queue Tier Scheduler (hot/warm/cold/recovery)
                -> Coordinated Parallel Workers (provider buckets)
                -> Canonical Data Layer (DailyPrice/IntradayBar/IntradayTick/SessionFacts)
                -> Product Read Paths + Operator DataOps
```

---

## 5. Dinh nghia thanh cong

1. Daily coverage missing cua nhom hot_user_demand <= 2%.
2. Symbol missing coverage khong con bi plan trade_date-only.
3. Throughput tang ma khong tang fail-rate vuot nguong gate.
4. Co dashboard theo doi backlog va canh bao tier starvation.
5. Toan bo tasks trong taskboard co evidence + validation command ro rang.
