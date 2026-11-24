# HANDOFF — Whale/CVD API contract cho widget (2026-11-24)

- **Repo/branch:** `vninvest` · `feat/whale-cvd-contract-be` @ `691587b3e` (+ commit chốt B9).
- **Trạng thái:** `done` (code + test xanh, re-audit PASS); chờ PR merge + coordinator đổi env staging.
- **Owner slice:** backend `whale-cvd-contract-be` (claim đã chuyển `done`).
- **Nguồn:** `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` (REV.2.1/2.2), `docs/PLAN_WHALE_CVD_CONTRACT_BE_20261124.md`.

## Kết quả (có evidence, không suy diễn)

- G0 probe production: `IntradayTick.price` VND thật; **6.290 row aggregate `tick_session:`** lẫn vào `WhaleAlertCanonical` ⇒ lọc cứng `whale_tick:` ở whale feed lẫn CVD. `docs/evidence/whale-cvd-contract/G0_PROBE.md`.
- Endpoint widget dùng `/core/v1/realtime/whale-feed/{symbol}/` giờ trả `whale_orders[]` per-tick + `summary` 8 field + `alerts[]` shape cũ; alias `/core/v1/whale-feed` giữ nguyên envelope/side HOA/`signals:read`/`?session_date=`.
- CVD phục vụ qua `/core/v1/session-facts/{symbol}/cvd/?window=5m|15m|30m|1h` với `unit:"vnd"`, `delta`, `revision`, `source`, `trade_count:null`, scope `market:read`; `/core/v1/orderflow/{symbol}/cvd|trades/` trả `501 not_provisioned` (Rule 15 — không fake aggressor).
- WS: subscribe nhận `events[]`; event aggressor chưa provision → control `not_provisioned` chỉ cho event opt-in; helper `resolve_ws_identity()` additive (không phá ticket tests cũ).
- Test: **14/14 OK** trên VPS DB riêng; S1 đỏ 4/4 trước khi code; gates `pre-push 36 PASS`, `tsc 0`, `jest route-contract 4/4`. `docs/evidence/whale-cvd-contract/gates.md`.
- Audit: plan NEED_REVISION(5)→AGREE(3 đóng); code NEED_REVISION(3)→**PASS**. `docs/evidence/whale-cvd-contract/{AUDIT_PLAN,AUDIT_CODE}.md`.

## Next steps / owner

1. **Coordinator:** merge PR (merge-commit), cập nhật `CORS_ALLOWED_ORIGINS` trong `/opt/vninvest/compose.staging.env` thêm `https://charts.edusuccess.vn`, restart staging; đóng reservation P0-B6 (dynamic CORS allow-all) ở ticket riêng. **CHƯA CHẠY** ở slice này.
2. **Widget team:** đổi URL CVD sang `session-facts/{symbol}/cvd/?window=15m` (D4), map `cvd_series` vào `externalCvdSeries`, bỏ AC `<1s`, cập nhật citation; contract test theo shape mới.
3. **Không làm trong slice:** pipeline live tick/aggressor, retention 30 ngày, SLA production — thuộc data product của khách theo quyết định PM 2026-11-12.
