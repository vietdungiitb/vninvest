# AUDIT REPORT: Whale Analytics Data Recovery & Pipeline Hardening (2026-04-22)

## 1. Executive Summary
This audit addresses the critical failure of Whale Analytics metrics for **DXG**, where the dashboard reported "0 Whale Buy/Sell" despite the existence of eligible large trades. The investigation revealed a combination of massive data duplication in `IntradayTick` and a lack of historical signal persistence.

We have successfully implemented a recovery pipeline, hardened the database schema, and increased UI transparency regarding data quality.

---

## 2. Technical Findings

### 2.1. The "Zero Signals" Root Cause
- **Data Ingestion Failure**: Real-time tasks were skipping DXG signals because the duplicate ratio in `IntradayTick` exceeded the safety threshold (audit revealed **99.67% duplicate ratio** for 2026-04-22).
- **Persistence Gap**: Previously, `OrderFlowSignal` relied on `created_at` for dating, making it difficult to backfill historical days without polluting the "Today" view.
- **Frontend Fallback**: When the DB returned empty results, `DarkMoneyMasterChart.jsx` fell back to a "synthetic" model (constant strength ~50), creating uniform green bars that misled users.

### 2.2. API & Data Quality Issues
- **Mixed Types**: Django ORM errors occurred when comparing `DateField` and `DateTimeField` in the history API.
- **Missing Parameters**: `MarketDataService.get_ohlcv_batch` was called without a required `start_date`, causing reference price failures.

---

## 3. Implementation Details

### 3.1. Backend Components
- **`backend/portfolio/order_flow_history.py`**: A new service module specialized for historical tick processing.
  - Implements on-the-fly deduplication based on `{trade_time, price, volume, side, match_type}`.
  - Calculated "Whale Value" using a 4-tier price fallback (1000x multiplier for low-unit prices).
- **`scratch/recompute_dark_flow.py`**: A high-performance CLI tool for manual data recovery.
  - Supports `--dry-run`, `--force` (to bypass duplicate checks), and `--replace-existing`.
  - Persists signals with a deterministic `event_id` to prevent double-counting.

### 3.2. Database Schema (Migration `0052`)
- **Field Added**: `OrderFlowSignal.trade_date` (DateField).
- **Purpose**: Decouples the "Signal Date" from the "Processing Date" (`created_at`), allowing accurate historical charts after backfilling.
- **Migration File**: `backend/portfolio/migrations/0052_orderflowsignal_trade_date.py`.

### 3.3. API & Frontend Hardening
- **`views_dark_money_history.py`**: 
  - Updated to use `Coalesce('trade_date', Cast('created_at', DateField()))` for robust date grouping.
  - Fixed `get_ohlcv_batch` argument signature.
- **`DarkMoneyMasterChart.jsx`**:
  - Added an `isSynthetic` flag.
  - Implemented a **"Synthetic Data"** badge in the UI header to notify users when fallback heuristics are in effect.

---

## 4. Verification Results (DXG Case Study)

Execution on 2026-04-22:
- **Raw Ticks Scanned**: 30,573
- **Unique Ticks (After Dedup)**: ~100
- **Duplicate Ratio**: 99.67%
- **Signal Detected**: **ICEBERG** (Strength: 100)
- **Status**: Successfully persisted to DB and verified via API response.

---

## 5. Operator Playbook (How to Backfill)

To recover missing signals for any symbol:

```bash
# 1. Audit only (Dry run)
python scratch/recompute_dark_flow.py --symbol SYM --start-date YYYY-MM-DD --end-date YYYY-MM-DD --dry-run

# 2. Force backfill if duplicates are known (e.g. crawler noise)
python scratch/recompute_dark_flow.py --symbol SYM --start-date YYYY-MM-DD --end-date YYYY-MM-DD --force --replace-existing
```

---

## 6. Audit Trail (Code Changes)

| Component | File Path | Status |
|-----------|-----------|--------|
| Model | `backend/portfolio/models.py` | Updated (Migration 0052) |
| Migration | `backend/portfolio/migrations/0052_orderflowsignal_trade_date.py` | Added + applied |
| Service | `backend/portfolio/order_flow_history.py` | **NEW** |
| Tool | `scratch/recompute_dark_flow.py` | **NEW** |
| API | `backend/portfolio/views_dark_money_history.py` | Patched |
| UI | `frontend/src/components/DarkMoneyMasterChart.jsx` | Patched |

---
**Auditor**: Antigravity AI
**Date**: 2026-04-22 23:11 (Local)
**Status**: RECOVERED
