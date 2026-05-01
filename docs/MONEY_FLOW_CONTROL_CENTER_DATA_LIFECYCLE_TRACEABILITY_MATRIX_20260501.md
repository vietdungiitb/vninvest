# TRACEABILITY MATRIX - Money Flow Control Center and Data Lifecycle

## 1. Mục tiêu

Ma trận này truy vết trực tiếp từ yêu cầu đã thống nhất sang quyết định kiến trúc, slice thực hiện và bằng chứng audit bắt buộc.

## 2. Ma trận truy vết

| Req ID | Yêu cầu | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit bắt buộc |
|---|---|---|---|---|---|
| MFC-01 | Phải có một operator center thống nhất cho whale + dark flow + lifecycle | `Money Flow Control Center` là evolution của `signals` tab, không phải settings island mới | Handoff Master mục 5.1, Tech Spec mục 5 | ARC-03, FE-6.1 | IA map + navigation proof |
| MFC-02 | Không được tạo parallel writers giữa Signal Control Center, Data Ops, runtime policy và whale mission-control | owner matrix và link-out/write-through semantics là bắt buộc | Handoff Master mục 5.2-5.3, Tech Spec mục 2 | ARC-01, BE-1.2, FE-6.5 | owner matrix + deprecation warnings + UI proof |
| MFC-03 | Raw tick phải có owner retention duy nhất | `runtime_policy_helpers.intraday_tick_keep_days` là canonical raw-staging owner | Handoff Master mục 5.3, Tech Spec mục 2.3 | ARC-02, BE-4.1 | retention preview payload + blocked duplicate writer proof |
| MFC-04 | Detection universe của whale/dark flow phải có SSOT riêng với ingest hints | `global_signal_universe_policy` là detection universe SSOT; runtime group IDs chỉ là hint | Handoff Master mục 5.3, Tech Spec mục 2.3 | ARC-01, BE-1.2 | effective universe payload + owner badge proof |
| MFC-05 | Whale policy không được drift giữa mission-control và signal config | whale thresholds phải write-through hoặc derived, không hai writer đồng cấp | Handoff Master mục 5.3, Tech Spec mục 2.3 | ARC-01, BE-5.3, FE-6.3 | bridge payload + rollout audit note |
| MFC-06 | `whale-alerts/:symbol` phải bỏ raw-full-scan trên primary path sau migration | facts-first primary path dùng bucket facts + session summaries + canonical events | Handoff Master mục 5.5, Tech Spec mục 4.4, 7 | BE-2.1, BE-2.2, BE-2.3, QA-7.3 | route parity + before/after performance evidence |
| MFC-07 | Dữ liệu lâu dài phải ưu tiên canonical events, facts, summaries thay vì giữ raw toàn phần | lifecycle tiers L0-L5 là contract bắt buộc | Handoff Master mục 5.4, Tech Spec mục 3 | ARC-02, BE-4.1, BE-4.2 | tier preview + forensic sample + cleanup proof |
| MFC-08 | Dark flow phải ở cùng operator center nhưng giữ policy domain riêng | shared lifecycle, whale governance và dark-flow policy là ba domain khác nhau | Handoff Master mục 5.2, Tech Spec mục 2.2, 5.2 | ARC-01, FE-6.3 | zone map + payload proof |
| MFC-09 | Mọi dangerous action phải preview-before-apply | materialization, retention, recompute, purge đều có preview + confirmation metadata | Handoff Master mục 2, Tech Spec mục 4.5, 6 | ARC-03, BE-5.2, FE-6.2 | preview payload + UI confirmation proof |
| MFC-10 | Selected-session truth không được vỡ khi tối ưu performance | facts và snapshots phải khóa selected-session semantics | Handoff Master mục 5.5, Tech Spec mục 1, 4.4, 7 | BE-2.3, QA-7.3 | parity snapshot + UI/runtime smoke |
| MFC-11 | Compute nặng phải bám SQL projection + Pandas vectorized batch | facts materialization ưu tiên SQL-first projection, không kéo full raw payload vô cớ | Handoff Master mục 5.7, Tech Spec mục 4.1 | BE-2.1, BE-3.1 | code review proof + benchmark note |
| MFC-12 | Recompute/backfill phải invalidate impacted L4 caches sau materialization | TTL không thay thế invalidation chủ động; stale snapshot không được sống đủ 24h nếu facts đã đổi | Handoff Master mục 5.4-5.6, Tech Spec mục 4.5-4.6 | BE-4.3, QA-7.1 | cache invalidation proof + recompute regression |
| MFC-13 | Whale governance write-through không được overwrite active version trực tiếp | bridge phải tạo pending/draft version và chờ explicit approval/rollout | Handoff Master mục 5.2-5.3, Tech Spec mục 5.2-5.3 | BE-5.3, FE-6.3 | bridge payload + approval/rollout proof |
| MFC-14 | Deprecated writer surfaces phải hard-block backend-side, không chỉ ẩn UI | backend legacy writes phải trả 400/403/redirect; UI demotion chỉ là lớp phụ | Handoff Master mục 5.2-5.3, Tech Spec mục 5.3 | BE-1.2, FE-6.4, FE-6.5 | blocked-write regression + deprecation warning proof |
| MFC-15 | Link-out tới Data Ops/Vnstock phải permission-gated | thiếu quyền thì render disabled state/badge thay vì link chết | Handoff Master mục 5.3, Tech Spec mục 5.3 | ARC-03, FE-6.5 | disabled-state screenshot + permission test |
| MFC-16 | Forensic windows phải physical carve-out và purge không được deadlock vô hạn | L5 là physical copy/move riêng; nếu completeness không thể phục hồi phải có bounded override | Handoff Master mục 5.4-5.6, Tech Spec mục 4.5 | BE-4.1, BE-4.2, BE-4.3 | forensic sample + expiry proof + override audit |
| GOV-01 | Không coding trước explicit consent của owner | plan/docs freeze trước, coding gate sau | Handoff Master mục 8, Implementation Plan mục 5 | ARC-01 | owner confirmation record |
| GOV-02 | Docs-only và coding slices đều phải sync audit/progress | ledger/progress update là bắt buộc | Self-Audit Protocol mục 2-3 | DOC-ALL | ledger + progress sync |

## 3. Quy tắc sử dụng matrix

1. Mỗi slice phải map ít nhất một `Req ID`.
2. Không có bằng chứng ở cột cuối thì slice chưa được PASS.
3. Nếu một slice không chỉ ra canonical writer hoặc effective owner, slice đó chưa đủ điều kiện execute.
4. Nếu preview-before-apply bị bỏ qua ở lifecycle action nguy hiểm, toàn bộ pack phải bị đánh `FAIL` trong audit nội bộ.