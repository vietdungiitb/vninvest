# VNStock Source Failover Orchestration Plan (2026-04-16)

## 1. Muc tieu

Van de hien tai:
- Admin Ops da co Runtime VNStock Config (primary + fallback), nhung adapter intraday va mot so channel khac van hardcode source VCI.
- Khi nguon dang dung gap loi, he thong khong co co che auto-failover nhat quan theo channel.
- Ket qua: stale_over_threshold tang cao, UI hien du lieu cu va co nguy co dan den danh gia sai.

Muc tieu can dat:
- Tat ca channel VNStock (price_board, intraday, history, financial_ratio, listing) deu dung chung bo source selection va failover contract.
- Khong con hardcode source o service/view layer.
- Co auto-failover theo health + stale signal, khong chi fallback khi rate-limited.
- Co observability theo tung channel/source de van hanh.

## 2. Root cause da xac nhan

1) Gap thiet ke runtime config:
- Runtime config hien chi co `price_board_source` va `fallback_sources` global.
- Chua co source policy ro theo channel.

2) Gap implementation adapter:
- `fetch_price_board_dataframe(...)` da co multi-source fallback.
- `fetch_intraday_dataframe(...)` dang hardcode source VCI.
- `fetch_history_dataframe(...)` co lay admin source nhung chua co multi-source retry/failover.
- `fetch_financial_ratio_dataframe(...)` va `fetch_listing_symbols_dataframe(...)` dang di theo source truyen vao (thuong la VCI), chua co failover orchestrator.

3) Gap service usage:
- Nhieu diem goi dang hardcode `source='VCI'` o financial/listing overlays.

## 3. In-scope va out-of-scope

In-scope:
- Refactor source orchestration cho 5 channel: price_board, intraday, history, financial_ratio, listing.
- Mo rong RuntimeVnstockConfig de ho tro source config theo channel.
- Bo sung auto-failover theo loi va stale signal.
- Chuan hoa call-sites de bo hardcode VCI.
- Bo sung test backend + observability + runtime admin payload.

Out-of-scope:
- Khong thay doi schema du lieu nghiep vu khac ngoai runtime config VNStock.
- Khong can doi UI trading logic khac ngoai surfacing runtime source health neu can.

## 4. Target architecture

### 4.1 Runtime config contract moi

Them field moi:
- `source_config` (JSON):
  - `price_board.primary`
  - `intraday.primary`
  - `history.primary`
  - `financial_ratio.primary`
  - `listing.primary`
- `fallback_sources` (giu nguyen): danh sach fallback toan cuc, dedup + order.

Backward compatibility:
- Neu `source_config` chua co, fallback ve `price_board_source` hien tai.
- `price_board_source` van duoc giu de tranh vo API cu; map sang `source_config.price_board.primary`.

### 4.2 Adapter-level source resolver

Tao utility chung trong vnstock adapter:
- `_resolve_channel_sources(channel, explicit_source=None)`
  - uu tien explicit_source
  - neu khong co, dung `source_config[channel].primary`
  - neu khong co nua, dung `price_board_source`
  - noi them `fallback_sources` theo thu tu, dedup

Ap dung cho tat ca fetchers:
- fetch_price_board_dataframe
- fetch_intraday_dataframe
- fetch_history_dataframe
- fetch_financial_ratio_dataframe
- fetch_listing_symbols_dataframe

### 4.3 Auto failover policy

Failover trigger cho moi channel/source candidate:
- vnstock_rate_limited
- vnstock_timeout
- vnstock_error co pattern 5xx/bad gateway/unavailable
- payload_invalid / parse_invalid (neu parse fail)

Failover behavior:
- Thu source tiep theo trong candidate list ngay trong cung request.
- Neu source fail lien tuc >= N lan trong cua so T giay: dat temporary penalize (cooldown) cho source-channel.
- Trong cooldown, bo qua source do neu co source khac kha dung.

Stale-aware escalation (intraday):
- Neu stale_over_threshold=true lien tiep va source hien tai dang fail, bo qua source dang penalized va force thử source ke tiep.

### 4.4 Observability bo sung

Bo sung counters theo channel/source:
- vnstock_channel_source_success_total
- vnstock_channel_source_fail_total
- vnstock_channel_source_failover_total
- vnstock_channel_source_cooldown_skip_total

Bo sung payload telemetry:
- source_used
- source_attempts (list ngan)
- failover_applied (bool)

## 5. Pha thuc hien

### Phase A - Runtime config foundation
- Mo rong model + serializer + admin ops APIs cho `source_config`.
- Migration data: khoi tao `source_config` tu `price_board_source`.
- Van giu field cu de compatibility.

### Phase B - Adapter orchestration
- Refactor cac fetch_* trong vnstock_adapter.py dung resolver chung + failover loop.
- Chuan hoa dieu kien failover theo channel.

### Phase C - Service call-site hardening
- Bo hardcode source='VCI' tai market_data_service va cac view lien quan.
- Chuyen toan bo qua adapter defaults / explicit source config.

### Phase D - Stale-aware intraday safeguards
- Noi stale_over_threshold signal vao source penalization/failover strategy.
- Dam bao intraday endpoint uu tien source fresh hon neu co.

### Phase E - Tests + rollout gate
- Unit tests cho resolver + failover matrix.
- API tests cho intraday/history/financial/listing khi primary fail.
- Regression tests khong vo freshness contract hien tai.

## 6. Test matrix bat buoc

1) Config/API tests:
- GET/PATCH runtime config tra/nhan `source_config` hop le.
- Backward compatibility voi payload cu (khong co source_config).

2) Adapter tests:
- intraday: primary fail -> fallback success.
- history: primary fail -> fallback success.
- financial_ratio: primary fail -> fallback success.
- listing: primary fail -> fallback success.
- retry + cooldown behavior theo runtime config.

3) Service integration tests:
- intraday endpoint khong con bi khoi tao cung 1 source duy nhat.
- history overlays khong bi hardcode VCI.
- financial/listing overlays fallback duoc khi source chinh loi.

4) Runtime smoke:
- Admin chon KBS primary, fallback KBS,VCI/VCI,KBS theo channel.
- Simulate KBS fail, xac nhan auto-failover sang VCI.
- Simulate source hoi phuc, xac nhan quay lai primary sau cooldown.

## 7. Rollout va rollback

Rollout:
1. Deploy config schema + adapter logic giu compatibility.
2. Bat source_config theo channel voi default giong current behavior.
3. Bat failover counters + monitor 1 phien.
4. Tune cooldown/retry theo metrics.

Rollback:
- Flag `VNSTOCK_CHANNEL_FAILOVER_ENABLED=False` de quay ve single-source path an toan.
- Giu field source_config read-only, khong xoa schema.

## 8. DOD

- Tat ca channel da dung chung resolver + failover policy.
- Khong con hardcode `source='VCI'` tai cac flow runtime chinh.
- Intraday stale_over_threshold duoc giam ro rang trong gio giao dich.
- Test matrix pass day du.
- Cap nhat audit ledger day du file list + bang chung test.

## 9. File inventory du kien sua

Backend:
- backend/portfolio/models.py
- backend/portfolio/serializers.py
- backend/portfolio/views_admin_runtime.py
- backend/portfolio/vnstock_runtime_config.py
- backend/portfolio/adapters/vnstock_adapter.py
- backend/portfolio/market_data_service.py
- backend/portfolio/services_realtime_adapter.py
- backend/portfolio/views_realtime_depth_financial.py
- backend/portfolio/views_stock_workspace_admin.py
- backend/portfolio/tests/test_adapters.py
- backend/portfolio/tests/test_admin_ops.py
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py

Docs:
- docs/VNSTOCK_SOURCE_FAILOVER_ORCHESTRATION_PLAN_20260416.md
- docs/CODE_CHANGE_AUDIT_LEDGER.md
