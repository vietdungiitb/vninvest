# Config Ownership Matrix — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

---

## 1. Nguyên tắc ownership

1. Mỗi config chỉ có một canonical writer.
2. Trong giai đoạn transition, bridge read-only được phép nhưng bridge writer là cấm.
3. Cutover chỉ được thực hiện sau khi owner matrix không còn ambiguity.

---

## 2. Ownership matrix

| Config / Concern | Current canonical writer | Transition owner | End-state owner |
|---|---|---|---|
| Global symbol matrix registry | `market_data.global_symbol_registry` | Core market_data | Core market_data |
| Demand ledger edges | user/admin mutation flows qua registry service | Core market_data | Core market_data |
| Coverage/freshness policy | `market_data.global_symbol_coverage` + DataOps runtime config | Core market_data + service_ops | Core market_data + service_ops |
| Detection universe policy | `global_signal_policy_helpers.py` while legacy still live | Legacy policy SSOT, core read-only mirror | Core signal_intelligence after approved cutover |
| Ingest cadence / runtime policy | `runtime_policy_helpers.py` + runtime config | Existing runtime owner | Core/service_ops after approved migration phase |
| Alert taxonomy policy | signal_intelligence domain docs/spec | Core signal_intelligence | Core signal_intelligence |
| User delivery preference | new core delivery preference model | Core signal_intelligence / user_workspace | Core signal_intelligence / user_workspace |
| OpenAPI contract metadata | core domain serializers/views | Core API owners | Core API owners |
| packages/web adapter contract | `packages/web/src/adapters/coreApiAdapter.js` | Frontend lead + core API lead | packages/web |
| Compat route deprecation schedule | SaaS migration/final independence gates | Tech lead | N/A after legacy sunset |

---

## 3. Ownership rules cần giữ

1. Không có parallel writer mới cho detection universe trong lúc legacy writer còn sống.
2. `packages/web` chỉ đọc qua `coreApiAdapter`; không sở hữu schema riêng.
3. Compat routes không được trở thành canonical writer/read model sau khi native path tồn tại.
4. Legacy decommission chỉ được bắt đầu khi ownership matrix đã thu về core-native end-state.
