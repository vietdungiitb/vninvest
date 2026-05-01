# CODE QUALITY CONSTITUTION - Money Flow Control Center and Data Lifecycle

## 1. Purpose

Chất lượng của chương trình này không được định nghĩa bằng việc:

1. route `whale-alerts/:symbol` mở lên được,
2. admin page có thêm vài card mới,
3. retention preview trả JSON hợp lệ.

Chất lượng ở đây nghĩa là:

1. mọi business meaning chỉ có một canonical writer hoặc một write-through bridge rõ ràng,
2. money-flow primary read path chuyển sang facts-first nhưng vẫn giữ nguyên selected-session truth,
3. raw dữ liệu được giữ ngắn hạn có chủ đích, còn long-lived storage ưu tiên canonical events, bucket facts, session summaries và forensic windows chọn lọc,
4. operator có thể vận hành, preview, recompute, purge và audit mà không phải suy diễn owner hay nhảy qua nhiều surface chồng chéo.

Nguyên lý áp dụng:

- Deming: chất lượng phải được xây vào flow `ingest -> canonicalize -> materialize -> serve -> retain -> audit`, không để auditor vá lại ở cuối.
- Juran: fitness ở đây là `fitness for use` cho operator, route whale và final auditor, không phải chỉ pass unit test cô lập.
- Crosby: chi phí của một duplicate writer, một facts-first cutover sai selected session, hoặc một raw purge sai thứ tự lớn hơn nhiều so với chi phí thêm guardrails ngay từ đầu.

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Writer ownership and deprecation semantics | 95% risk coverage | Sai owner làm mọi tối ưu sau đó trở thành drift có hệ thống |
| Whale facts-first route path | 95% risk coverage | Đây là hot path user-facing, sai sẽ vừa chậm vừa sai semantics |
| Dark-flow lifecycle parity | 90% risk coverage | Dark flow phải được vận hành ngang hàng whale nhưng không bị trộn domain |
| Materialization and recompute services | 95% risk coverage | Facts/summaries sai hoặc stale sẽ phá route và control plane cùng lúc |
| Retention and forensic safety | 95% risk coverage | Xóa raw hoặc facts sai thứ tự là lỗi có thể không phục hồi được |
| Admin control plane write actions | 95% risk coverage | Preview/apply sai ở control center có thể làm hỏng toàn bộ runtime |
| Effective owner visibility | 90% risk coverage | Operator không biết knob thuộc domain nào sẽ rất dễ gây parallel writer |
| Governance and evidence | 90% risk coverage | Thiếu evidence làm final auditor không thể xác nhận implementation |
| Legacy writer hard-block and deprecation boundaries | 95% risk coverage | Hidden write surfaces tạo phantom writes dù UI đã demote |
| Recompute invalidation and cache safety | 95% risk coverage | L4 cache stale sau recompute sẽ làm facts-first route trả dữ liệu cũ |
| Permission-gated link-out surfaces | 90% risk coverage | Dead links phá narrative vận hành của operator |
| Physical forensic carve-out | 95% risk coverage | Tag-only window sẽ mất dữ liệu khi partition/raw cleanup chạy |

## 3. Coverage theater prevention

Những thứ sau không được tính là bằng chứng chất lượng:

1. Chỉ chứng minh route whale trả nhanh hơn nhưng không chứng minh source path đã rời raw-full-scan primary path.
2. Chỉ chứng minh summary API có số liệu nhưng không có `effective owner`, `effective value` hoặc deprecation warning cho knob chồng chéo.
3. Chỉ chứng minh materialization job chạy xong mà không chứng minh facts/session summaries parity với selected-session semantics.
4. Chỉ chứng minh retention preview có counts mà không chứng minh purge bị chặn khi completeness hoặc dependency checks fail.
5. Chỉ thêm link sang whale mission-control nhưng vẫn để một writer blob song song tồn tại trong control center mới.
6. Chỉ chụp screenshot UI mà không có payload snapshot, source markers hoặc job evidence cho recompute/retention actions.

## 4. Fitness-to-purpose scenarios

### Scenario S1 - Parallel writer drift

What can go wrong:
- `Raw tick keep days`, whale threshold hoặc detection universe được chỉnh ở hai surface khác nhau. Runtime nhìn có vẻ hoạt động, nhưng thực ra các jobs và read paths đang đọc hai nguồn meaning khác nhau.

Where to inspect:
- ownership matrix,
- preview/apply APIs,
- UI zones và link-out semantics.

How to verify:
- cùng một knob chỉ có một writer hợp lệ; mọi surface khác phải hiện read-only, effective value hoặc write-through.

### Scenario S2 - Facts-first nhưng selected session bị drift

What can go wrong:
- route whale bỏ raw scan thành công, nhưng bucket facts hoặc session summaries lại map sai selected session, làm bubble/advisory/CVD/strength lệch khỏi truth hiện tại.

Where to inspect:
- snapshot assembly path,
- selected-session resolver,
- route parity tests.

How to verify:
- so snapshot/pane/bubble/advisory của cùng symbol/session trước và sau facts-first cutover.

### Scenario S3 - Raw retention owner bị nhập nhằng

What can go wrong:
- `intraday_tick_keep_days` và `global_signal_retention_policy.raw_intraday_keep_days` cùng tồn tại như hai writer ngầm. Operator đổi một bên nhưng purge job đọc bên kia.

Where to inspect:
- runtime policy helpers,
- signal retention preview/apply path,
- control center effective owner badges.

How to verify:
- raw staging retention phải có duy nhất một canonical owner; compatibility field chỉ được hiển thị như deprecated/effective value.

### Scenario S4 - Materialization freshness giả

What can go wrong:
- hot cache hoặc session summary hiển thị `healthy` dù bucket facts đã stale hoặc recompute thất bại. Operator tưởng route đang dùng facts tươi, thực tế đang rơi sang degraded fallback.

Where to inspect:
- summary API,
- freshness markers,
- run registry and fallback flags.

How to verify:
- simulated stale/degraded states phải đổi rõ UI/API status.

### Scenario S5 - Whale threshold compatibility không được time-boxed

What can go wrong:
- `global_signal_services_config.whale_service.default_threshold_vnd` tiếp tục sống song song quá lâu với whale mission-control, làm policy whale drift và audit không xác định được ai là truth.

Where to inspect:
- ownership matrix,
- whale bridge API,
- deprecation warnings.

How to verify:
- field này chỉ tồn tại như compatibility/effective value hoặc write-through bridge có audit note rõ ràng.

### Scenario S6 - Forensic windows biến thành raw retention trá hình

What can go wrong:
- vì sợ mất dữ liệu, forensic windows bị giữ quá rộng hoặc không có expiry, làm hệ thống quay lại lưu raw gần như toàn phần.

Where to inspect:
- forensic policy,
- retention preview,
- stored forensic samples.

How to verify:
- forensic windows phải có reason, scope hẹp và expiry rõ ràng.

### Scenario S7 - Control center mới vẫn buộc operator đi qua panel cũ

What can go wrong:
- Money Flow Control Center nhìn như trung tâm vận hành, nhưng để hoàn tất workflow operator vẫn phải nhảy sang `Data Ops` hoặc whale panel legacy để apply những knob cùng meaning.

Where to inspect:
- navigation map,
- owner badges,
- link-out vs writer actions.

How to verify:
- workflow chuẩn phải hoàn thành trong một narrative thống nhất; link-out chỉ dành cho upstream domain khác meaning.

### Scenario S8 - Route whale vẫn full-scan raw trong thực tế

What can go wrong:
- code path công bố là facts-first nhưng vì cold cache, missing facts hoặc fallback không giới hạn, request production vẫn thường xuyên quét raw ticks như cũ.

Where to inspect:
- snapshot service,
- cache/source markers,
- performance benchmarks.

How to verify:
- source markers và timing evidence phải chứng minh primary path thật sự là facts-first.

### S9 - Recompute xong nhưng L4 cache vẫn stale

What can go wrong:
- backfill/recompute đã cập nhật facts nhưng cache route whale vẫn còn dữ liệu cũ vì invalidation không được chạy hoặc không ghi rõ impacted keys.

Where to inspect:
- recompute orchestration,
- cache invalidation helpers,
- recompute evidence payload.

How to verify:
- recompute/backfill phải invalidate impacted L4 keys ngay sau materialization và evidence phải nêu rõ key set bị ảnh hưởng.

### S10 - Whale bridge overwrite active version

What can go wrong:
- write-through bridge từ Money Flow Control Center ghi đè active whale version trực tiếp thay vì tạo pending/draft và chờ approval.

Where to inspect:
- whale bridge API,
- approval/rollout audit note,
- effective owner summary.

How to verify:
- bridge payload phải thể hiện pending/draft state và không có đường publish active version nếu thiếu approval.

### S11 - Link-out chết vì thiếu quyền upstream

What can go wrong:
- operator không có quyền Data Ops/Vnstock vẫn thấy link-out có thể click, dẫn thẳng tới 403 và làm workflow đứt gãy.

Where to inspect:
- control-center IA,
- permission metadata,
- disabled-state rendering.

How to verify:
- thiếu quyền thì UI phải render disabled state + badge `Requires Data Ops permission`, không render link chết.

### S12 - Forensic window chỉ là tag trên raw

What can go wrong:
- forensic window chỉ gắn tag lên raw L0, tới lúc partition cleanup chạy thì dữ liệu forensic biến mất luôn.

Where to inspect:
- forensic storage path,
- retention preview,
- stored sample evidence.

How to verify:
- forensic sample phải là physical carve-out sang L5 riêng và có expiry proof.

## 5. AI session quality discipline

1. Không code trước explicit consent.
2. Session nào chạm pack này phải đọc ít nhất Handoff Master, Implementation Plan, Tech Spec, Taskboard, Traceability Matrix và Ownership Matrix.
3. Nếu đụng frontend React, phải nạp `Expert React Frontend Engineer` và `react19-source-patterns`.
4. Nếu làm docs/audit/test protocol, phải bám `quality-playbook`.
5. Sau edit đầu tiên phải có focused validation ngay.
6. Mọi thay đổi docs phải có audit report và sync ledger/progress.

## 6. The human gate

Những điểm sau bắt buộc cần human/final auditor quyết định cuối:

1. owner cuối cùng cho whale compatibility threshold fields,
2. retention windows chính thức cho raw staging, canonical events, bucket facts và forensic windows,
3. rollout order khi Money Flow Control Center thay thế hoặc hấp thụ control center cũ,
4. ngưỡng freshness/degraded cho route whale và control plane,
5. GO / NO-GO cuối cùng cho facts-first cutover trên runtime thật,
6. approval model cho whale bridge publish vs pending,
7. cache invalidation policy sau recompute/backfill,
8. permission-gated link-out behavior cho upstream surfaces,
9. physical carve-out vs tagging semantics cho forensic windows.