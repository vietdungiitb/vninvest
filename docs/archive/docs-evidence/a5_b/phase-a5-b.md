# Evidence Phase A5 + Phase B — price-board tune + SSI opt-in

Ngày: 2026-09-23. Spec: `IMPLEMENTATION_PLAN_VNBROKER_V34_UPGRADE_20260923.md` Rev.1 (§5 Phase A5/B).

## A5 — max_concurrency (đo thật, vnbroker 3.4.0/KBS/20 mã, `bench_a5.py`)

- level=8 → 6.9s (2.9/s) | level=16 → 9.3s | level=32 → 16.2s
- Kết luận: concurrency cao bị upstream throttle → CHẬM hơn. Chốt `max_concurrency=8`
  trong `fetch_price_board_snapshots_batch` (thấp hơn default lib KBS 16 / VCI 24).
- Live qua adapter: 10 mã/5.5s, closes thật (FPT 66100, HPG 21050, MBB 20000).

## Phase B — SSI opt-in (code + test + live gate)

- `_SUPPORTED_PROVIDER_SOURCES` += SSI; `_QUOTE_CLASS_ALIASES={'SSI':'SSIQuote'}`
  (DNSE giữ quirk cũ); gate `_ssi_keys_available()` (env, không log secret);
  explicit SSI thiếu key → fallback + warning; intraday candidates lọc SSI khi thiếu key;
  daily giữ VCI/KBS (không đổi).
- Verified tại tag v3.4.0: `SSIQuote(symbol, api_key→env, ...)` + `history(start,end,interval)`
  intervals 1m/3m/5m/15m/**30m**/1H/1D/1W/1M; `Vnbroker` client SUPPORTED_SOURCES có SSI.
- Live gate (không SSI key ở dev): explicit SSI → fallback VCI, không crash.
- B3 (30m/indices cho views): verify lib đủ khả năng; wiring views để follow-up (ngoài scope B).

## gates

- BE: `Ran 61 tests OK (skip 2)` — ssi-optin 8 + adapter history/guard + broker API +
  signatures + soc-broker; `manage.py check` 0.
- Chưa chạy: `tsc`/`build` (FE không đụng ở A5/B), screenshots (manual khi cần).
