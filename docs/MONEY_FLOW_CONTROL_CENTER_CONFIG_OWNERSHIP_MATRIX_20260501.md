# CONFIG OWNERSHIP MATRIX - Money Flow Control Center

## 1. Mục tiêu

Tài liệu này khóa theo từng field/knob đang có nguy cơ chồng chéo giữa `Signal Control Center`, `Data Ops`, runtime policy, whale mission-control và control plane mới.

Nguyên tắc dùng tài liệu này:

1. mỗi business meaning chỉ có một canonical writer,
2. các surface còn lại chỉ được read-only, link-out hoặc write-through,
3. nếu một knob chưa có canonical writer rõ, knob đó chưa được đưa vào implementation.

## 2. Ownership matrix theo field/knob

| Domain meaning | Canonical writer hiện tại / target | Surface hiện có | Money Flow Control Center behavior | Quyết định khóa | Ghi chú migration |
|---|---|---|---|---|---|
| Service enablement tổng thể | `global_signal_policy_helpers.py` -> `global_signal_services_config.enabled` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ | shared lifecycle domain |
| Whale service enabled | `global_signal_policy_helpers.py` -> `global_signal_services_config.whale_service.enabled` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ TẠM | nếu sau này whale governance hấp thụ field này, chỉ còn write-through |
| Dark-flow service enabled | `global_signal_policy_helpers.py` -> `global_signal_services_config.dark_flow_service.enabled` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ | dark-flow policy domain |
| Distribution websocket/history/batch size | `global_signal_policy_helpers.py` -> `global_signal_services_config.distribution.*` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ | shared lifecycle domain |
| Detection universe include tracked/watchlist/admin symbols | `global_signal_policy_helpers.py` -> `global_signal_universe_policy` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ | detection universe SSOT |
| Prefetch ingest group IDs | `runtime_policy_helpers.py` -> `intraday_universe_group_ids` | `Prefetch`, `Data Ops` | read-only effective value hoặc link-out | GIỮ, NHƯNG KHÔNG PHẢI DETECTION SSOT | chỉ là ingest/warm-tier hint |
| Force warm tier cho ingest groups | `runtime_policy_helpers.py` -> `intraday_universe_force_warm_tier` | `Prefetch`, `Data Ops` | read-only effective value hoặc link-out | GIỮ | upstream runtime concern |
| Raw tick auto cleanup enabled | `runtime_policy_helpers.py` -> `intraday_tick_auto_cleanup_enabled` | `Data Ops`, runtime surfaces | read-only hoặc link-out cho đến khi có migration rõ | GIỮ | raw staging lifecycle owner |
| Raw tick keep days | `runtime_policy_helpers.py` -> `intraday_tick_keep_days` | `Data Ops`, runtime surfaces | hiển thị effective value; không thêm writer mới | GIỮ | `global_signal_retention_policy.raw_intraday_keep_days` phải deprecate |
| Compatibility field `global_signal_retention_policy.raw_intraday_keep_days` | không còn là canonical writer trong end-state | `Signal Control Center` cũ | chỉ hiển thị deprecation/effective value | DEPRECATE | xóa write semantics khi implementation bắt đầu |
| Whale default threshold | whale mission-control active config hoặc derived effective whale value | `Signal Control Center`, whale mission-control | write-through hoặc read-only effective value | MIGRATE | không giữ 2 writer lâu dài |
| Whale cooldown / run limits | `global_signal_services_config.whale_service.*` hoặc derived from mission-control nếu whale domain hấp thụ | `Signal Control Center` | phase đầu cho phép preview/apply; phải audit lại nếu whale governance mở rộng | GIỮ TẠM | cần quyết định owner cuối trước coding |
| Dark-flow window seconds | `global_signal_services_config.dark_flow_service.window_seconds` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ | dark-flow policy domain |
| Dark-flow warning/urgent strength | `global_signal_services_config.dark_flow_service.warning_strength/urgent_strength` | `Signal Control Center` | preview/apply writer trực tiếp | GIỮ | dark-flow policy domain |
| Provider throttling / retry / cooldown | `runtime_policy_helpers.py` | `Prefetch`, `Vnbroker Config`, `Data Ops` | read-only effective value hoặc link-out | GIỮ | upstream ingest concern, không duplicate ở control center |
| Realtime stream enabled | `runtime_policy_helpers.py` -> `realtime_stream_enabled` | runtime surfaces | read-only effective value hoặc link-out | GIỮ | không phải money-flow policy writer |
| Session-close capture enabled | `runtime_policy_helpers.py` -> `session_close_capture_enabled` | runtime surfaces | read-only effective value hoặc link-out | GIỮ | upstream ingestion/runtime concern |
| Whale active version / draft / approval / rollout | `WhaleConfig*` models + `backend/portfolio/services.py` | whale mission-control, admin overview | write-through bridge, không duplicate form blob | GIỮ | whale governance domain |
| Whale anomaly dashboard | `backend/portfolio/services.py` derived read model | admin overview | read-only | GIỮ | operator observability |
| Materialization enablement / recompute actions | control plane mới của pack này | chưa có | preview/apply guarded writer | NEW | chỉ thêm sau khi owner approve implementation |
| Bucket fact retention | control plane mới của pack này | chưa có | preview/apply guarded writer | NEW | tách khỏi raw retention |
| Session summary retention | control plane mới của pack này | chưa có | preview/apply guarded writer | NEW | tách khỏi raw retention |
| Forensic window retention policy | control plane mới của pack này | chưa có | preview/apply guarded writer | NEW | selective storage only |
| Backfill window / recompute range | control plane mới của pack này | chưa có | preview/apply guarded writer | NEW | phải đi qua run registry |

## 3. Các quyết định deprecation bắt buộc

1. `global_signal_retention_policy.raw_intraday_keep_days` không được tiếp tục là writer chính sau lifecycle implementation.
2. `global_signal_services_config.whale_service.default_threshold_vnd` không được tồn tại lâu dài như writer song song với whale mission-control.
3. Mọi field hiển thị trong Money Flow Control Center nhưng thuộc runtime ingest domain phải có nhãn `Nguồn chỉnh sửa chuẩn` và link-out tương ứng.

## 4. Quy tắc audit theo matrix này

1. Nếu một UI panel render nút apply cho field không thuộc canonical writer của panel đó, slice phải FAIL.
2. Nếu một API mới ghi vào field đã có writer khác mà không có deprecation/bridge plan, slice phải FAIL.
3. Nếu migration tạm thời cần dual-write, phải time-boxed và có explicit rollback note trong evidence.