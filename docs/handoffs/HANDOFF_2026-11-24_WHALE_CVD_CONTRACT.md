# HANDOFF — Whale/CVD API contract cho widget (2026-11-24)

- **Repo/branch:** `vninvest` · `feat/whale-cvd-contract-be` @ `691587b3e` (+ commit chốt B9).
- **Trạng thái:** `done` — code + 14/14 test xanh, re-audit PASS, **PR #525 đã merge vào `dev`** (`c75012499`), env CORS staging đã cập nhật + deploy/verify xong, handoff đã đẩy sang `main` (`1465ed0ab`). Phiên chốt 2026-11-24.
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

1. **Coordinator — ĐÃ XONG trong phiên:** PR #525 merge (`c75012499`); env `CORE_CORS_ALLOWED_ORIGINS=https://docker.edusuccess.vn,https://charts.edusuccess.vn` trong `/opt/vninvest/compose.staging.env` (backup `compose.staging.env.bak-20261124-whalecvd`); `bash scripts/deploy-staging.sh` + `--verify` exit 0; probe thật `OPTIONS .../core/v1/realtime/whale-feed/VIC/` với `Origin: https://charts.edusuccess.vn` → HTTP/2 200 + `access-control-allow-origin: https://charts.edusuccess.vn`. **Còn lại:** mở ticket riêng đóng P0-B6 (dynamic CORS allow-all) — ngoài scope slice.
2. **Widget team:** đổi URL CVD sang `session-facts/{symbol}/cvd/?window=15m` (D4), map `cvd_series` vào `externalCvdSeries`, bỏ AC `<1s`, cập nhật citation; contract test theo shape mới.
3. **Không làm trong slice:** pipeline live tick/aggressor, retention 30 ngày, SLA production — thuộc data product của khách theo quyết định PM 2026-11-12.
