# Evidence Phase C/D — adapter hợp nhất + retail reference

Ngày: 2026-09-23. Spec: `IMPLEMENTATION_PLAN_VNBROKER_V34_UPGRADE_20260923.md` Rev.1 (§5 Phase C/D).

## Phase C — tầng BrokerAdapter (nền Broker Hub)

- `user_workspace/broker/adapters.py` MỚI: interface `BrokerAdapter` + DTO chuẩn
  (BrokerAccount/Balance/Position/Order) + `DnseBrokerAdapter` (wrap compat đang chạy) +
  `SsiBrokerAdapter` (kwargs bắt buộc, mapping phòng thủ) + `TcbsBrokerAdapter` +
  factory `get_broker_adapter()` + `BrokerUnavailableError`. Chỉ READ ở pha này.
- Tests `test_broker_adapters.py` 7/7 (factory/normalize 3 lanes/kwargs/unavailable).
- Bug test hạ được: `_stub_module` có điều kiện rò rỉ khi lane thật đã import trước
  trong cùng process → chuyển unconditional (hermetic). Bằng chứng: lẻ xanh, gộp đỏ,
  sửa xong gộp xanh.

## Phase D1 — retail reference endpoint (xong)

- `GET broker/retail/gold/?source=sjc|btmc` + `GET broker/retail/exchange-rate/`
  (IsAuthenticated, cache 1h, lỗi upstream → 400 mã rõ, không secret).
- Tests `test_broker_retail.py` 5/5 (ok+cache/400/auth/upstream-map).

## Phase D2 — screener universe (HOÃN, có lý do)

- Screener native tính từ DB theo rule engine riêng; thêm universe provider là feature
  độc lập (schema rule, cache, quota) — không nhét vào upgrade lib. Để backlog riêng.

## gates

- BE gộp một lượt: `Ran 119 tests OK (skip 2 live-gated)` — adapters 7 + retail 5 +
  config API 17 + signatures 6 + model 6 + runtime 7 + domain 8 + soc 11 + system-cred 4 +
  ssi-optin 8 + adapter-history/guard 18 + backfill 21 (số cộng gộp, redis-noise pre-existing).
- `manage.py check` 0 (chạy ở Đợt Closings trước, không model mới ở C/D).
- FE không đụng ở C/D (bỏ qua tsc/build).
