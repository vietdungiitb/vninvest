# G0 PROBE — Whale/CVD contract (bắt buộc trước code)

- **Ngày:** 2026-11-24 · **Môi trường:** VPS `14.225.255.47`, container `vninvest-core-db`, DB `vninvest_core` (staging, read-only SELECT).
- **Lệnh tái tạo:** `scp docs/evidence/whale-cvd-contract/G0_PROBE.sql <vps>:/tmp/g0_probe.sql` → `cat /tmp/g0_probe.sql | docker exec -i -e PGPASSWORD=$CORE_DB_PASSWORD vninvest-core-db psql -U vninvest -d vninvest_core -f -`. (File SQL cạnh evidence này.)
- **Lessons:** L-V01 (mọi số có control/nguồn), L-V02 (phản chứng review), L-T02 (citation đúng file).

## Kết quả đo thật

### G0-1 — `market_data_intraday_tick` (7 ngày gần nhất)

| source | n | min_price | avg_price | max_price | UNKNOWN |
|---|---:|---:|---:|---:|---:|
| `vnbroker_intraday` | 140.726 | 300,00 | 33.057,47 | 585.000,00 | 1.060 (0,75%) |

**Kết luận:** price lưu **VND thật** — KHÔNG normalize 1.000×. Có 0,75% tick `UNKNOWN` ⇒ filter ở `order_flow_engine.detect_whale_ticks` là cần thiết (REV.2.1 #1 đúng).

### G0-2 — `WhaleAlertCanonical` theo prefix `source_ref`

| prefix | n | clamp 5B |
|---|---:|---:|
| `whale_tick` | 42.689 | 2.794 |
| `tick_session` | 6.290 | 623 |
| `other` | 48 | 4 |

**Kết luận:** P0-N1 **có thật trong production** — 6.290 row aggregate lẫn vào bảng per-tick; 623 row bị clamp 5 tỷ. Bắt buộc lọc `alert__source_ref__startswith='whale_tick:'` ở builder whale lẫn CVD (`session_facts_engine.py:93-101`). Không xoá dữ liệu, chỉ lọc trên đọc.

### G0-3 — sum `matched_value` 3 phiên gần nhất theo prefix

Có per-tick (`HDB 79,79B`, `SSI 45,06B`, `HPG 32,85B`, …); cột aggregate NULL cho 3 phiên này ⇒ aggregate chủ yếu là lịch sử (xem G0-2). Vẫn phải lọc vì Backfill/historical session có thể đọc lại.

## Gate

G0 **PASS** (3/3 query chạy thật, có evidence). Cho phép chuyển B2 → B3 → B5. Không có thay đổi DB (SELECT-only).
