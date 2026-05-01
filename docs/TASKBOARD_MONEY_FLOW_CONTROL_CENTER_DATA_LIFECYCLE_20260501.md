# TASKBOARD - Money Flow Control Center and Data Lifecycle

**Ngày**: 2026-05-01  
**Mục tiêu**: điều phối triển khai theo slice cho operator center hợp nhất và lifecycle dữ liệu money-flow nhiều tầng, không tạo parallel writers và không giữ raw thừa.

---

## A. Governance / Boundary Freeze

- [ ] `ARC-01` Khóa writer boundary matrix giữa `Signal Control Center`, `Data Ops`, runtime policy và whale mission-control  
Owner: Tech Lead  
Required AI skill: GitHub Copilot theo repo governance  
Estimate: 2h  
DoD: mỗi knob money-flow chỉ có một canonical writer; mọi surface còn lại là read-only hoặc write-through.  
Test gate: docs pack review across Handoff Master, Tech Spec, Implementation Plan và Traceability Matrix.  
Evidence: ownership matrix, duplicate knob list, deprecation plan snapshot.

- [ ] `ARC-02` Khóa lifecycle tiers và retention owner  
Owner: Tech Lead + Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 2h  
Dependency: ARC-01  
DoD: raw staging, canonical events, bucket facts, session summaries, hot caches và forensic windows có owner và safety rule rõ ràng.  
Test gate: spec review + retention preview contract review.  
Evidence: tier table, retention preview shape, safety checklist.

- [ ] `ARC-03` Khóa IA `Money Flow Control Center` và rule link-out/read-only cho upstream surfaces  
Owner: Frontend Lead + Product Owner  
Required AI skill: `Expert React Frontend Engineer`  
Estimate: 2h  
Dependency: ARC-01, ARC-02  
DoD: operator có một narrative vận hành thống nhất; không còn ambiguity panel nào được quyền apply config gì.  
Test gate: IA review with owner matrix.  
Evidence: IA map, zone list, write/read-only notes.

---

## B. Shared Lifecycle Foundation

- [ ] `BE-1.1` Tạo `effective money-flow lifecycle view` ghép từ signal config, runtime policy và whale governance status  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: ARC-01  
DoD: control plane đọc được effective owner, effective values, freshness và deprecation warnings từ một payload thống nhất.  
Test gate: focused backend API tests cho lifecycle summary.  
Evidence: payload snapshot + tests.

- [ ] `BE-1.2` Chuẩn hóa deprecation semantics cho duplicate knobs  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 3h  
Dependency: BE-1.1  
DoD: raw keep-days, whale threshold compatibility và universe overlap có effective-value semantics rõ ràng; không còn hai write paths hợp lệ song song.  
Test gate: backend deprecation regression tests.  
Evidence: preview/apply payloads + warning states.

- [ ] `BE-1.3` Mở rộng run registry cho materialization, recompute, retention preview và purge  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 3h  
Dependency: BE-1.1  
DoD: jobs money-flow lifecycle xuất hiện chung trong run registry, có status/freshness/log chuẩn.  
Test gate: run registry tests.  
Evidence: job payload snapshots + audit trail.

---

## C. Whale Facts-First Path

- [ ] `BE-2.1` Materialize whale bucket facts cho selected-session analytics  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: ARC-02, BE-1.1  
DoD: bucket facts đủ để dựng CVD, strength, heatmap và marker context mà không cần quét raw toàn session ở read path chính.  
Test gate: focused materialization suite + parity snapshot tests.  
Evidence: fact payload sample + parity report.

- [ ] `BE-2.2` Materialize whale session summary và hot snapshot cache  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-2.1  
DoD: session summary đủ cho overview, advisory context và route warm reads; freshness/completeness flags có mặt.  
Test gate: summary contract tests + cache freshness tests.  
Evidence: summary payload + cache state proof.

- [ ] `BE-2.3` Chuyển whale snapshot API sang facts-first primary path  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: BE-2.2  
DoD: `views_whale_analytics.py` ưu tiên facts-first; raw-based recompute chỉ là degraded fallback có flag.  
Test gate: route parity tests + performance before/after.  
Evidence: payload parity, benchmark snapshot, residual risk note.

---

## D. Dark-Flow Lifecycle Parity

- [ ] `BE-3.1` Materialize dark-flow bucket facts  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: ARC-02, BE-1.1  
DoD: dark-flow bucket facts đủ cho lifecycle panels và future read reuse.  
Test gate: focused dark-flow materialization tests.  
Evidence: fact payload + freshness snapshot.

- [ ] `BE-3.2` Tạo dark-flow session summary và anomaly markers  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-3.1  
DoD: control center xem được session-level health, anomaly backlog và strongest buckets cho dark flow.  
Test gate: summary/anomaly backend tests.  
Evidence: payload snapshot + recent-events correlation.

- [ ] `BE-3.3` Đồng bộ dark-flow freshness vào control-plane summary  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 3h  
Dependency: BE-3.2  
DoD: Overview thấy freshness, lag và recompute pending cho dark flow ngang với whale.  
Test gate: summary API regressions.  
Evidence: summary payload + screenshot.

---

## E. Retention / Forensic / Cleanup

- [ ] `BE-4.1` Tạo retention preview theo tier với completeness safety gate  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-2.2, BE-3.2  
DoD: preview thể hiện impacted rows, blocked reasons, dependency jobs và effective owner.  
Test gate: retention preview tests.  
Evidence: preview payload + safety scenarios.

- [ ] `BE-4.2` Tạo selective forensic window policy  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-4.1  
DoD: raw dài hạn chỉ còn các window được chọn lọc theo severity/anomaly rules.  
Test gate: forensic retention tests.  
Evidence: stored forensic sample + expiry proof.

- [ ] `BE-4.3` Chuẩn hóa purge orchestration và recompute dependency checks  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-4.1, BE-4.2  
DoD: không purge tier nào khi còn job phụ thuộc hoặc completeness chưa đạt.  
Test gate: cleanup orchestration tests.  
Evidence: blocked purge proof + successful safe purge proof.

---

## F. Admin Backend Control Plane

- [ ] `BE-5.1` Mở rộng summary API cho lifecycle tiers, deprecation warnings và materialization lag  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-1.1, BE-2.2, BE-3.2  
DoD: admin summary có enough data cho operator hiểu owner, lag, anomaly và risky duplicate fields.  
Test gate: focused admin API tests.  
Evidence: summary payload snapshot.

- [ ] `BE-5.2` Tạo preview/apply APIs cho materialization, retention và effective-value warnings  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-4.1, BE-5.1  
DoD: mọi action lifecycle nguy hiểm có preview payload và confirmation metadata.  
Test gate: admin API regression tests.  
Evidence: preview diff + apply audit payload.

- [ ] `BE-5.3` Tạo whale-governance bridge cho write-through semantics  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: ARC-01, BE-5.1  
DoD: control center không tự ghi whale config blob riêng; mọi whale policy update đi qua bridge vào mission-control flow.  
Test gate: bridge API tests + approval/rollout proof.  
Evidence: payload snapshot + rollout audit note.

---

## G. Admin Frontend Money Flow Control Center

- [ ] `FE-6.1` Evolve tab `signals` thành shell `Money Flow Control Center`  
Owner: Frontend Lead  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 4h  
Dependency: ARC-03, BE-5.1  
DoD: có shell mới, overview narrative mới và không tạo thêm route admin trùng vai trò.  
Test gate: frontend build + shell smoke test.  
Evidence: screenshot navigation + i18n proof.

- [ ] `FE-6.2` Dựng `Shared Lifecycle`, `Materialization`, `Storage and Retention` panels  
Owner: Frontend Dev  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 5h  
Dependency: FE-6.1, BE-5.2  
DoD: operator xem được effective owners, preview payloads, lag và storage tiers trên cùng surface.  
Test gate: frontend panel tests + build.  
Evidence: screenshots + payload diff proof.

- [ ] `FE-6.3` Dựng `Whale Governance` và `Dark Flow Policy` panels với boundary rõ ràng  
Owner: Frontend Lead  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 5h  
Dependency: FE-6.1, BE-5.3  
DoD: whale panel là write-through/bridge, dark-flow panel là direct writer; UI có nhãn owner rõ ràng.  
Test gate: focused frontend tests + build.  
Evidence: screenshots + owner badge proof.

- [ ] `FE-6.4` Dựng `Jobs and Audit` panel với warning/deprecation states  
Owner: Frontend Dev  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 4h  
Dependency: FE-6.2, BE-1.3  
DoD: jobs, anomalies, recent actions và deprecation warnings xuất hiện trên cùng surface, list lớn dùng `PaginationBar`.  
Test gate: frontend tests + build.  
Evidence: screenshots + pagination proof.

- [ ] `FE-6.5` Demote hoặc link-out các writer cũ gây xung đột  
Owner: Frontend Lead  
Required AI skill: `Expert React Frontend Engineer`  
Estimate: 3h  
Dependency: FE-6.3, FE-6.4  
DoD: operator không còn thấy hai nút apply cho cùng một business meaning; các surface upstream được gắn nhãn link-out/read-only rõ ràng.  
Test gate: UX smoke + build.  
Evidence: before/after navigation map + screenshots.

---

## H. QA / Performance / Rollout

- [ ] `QA-7.1` Viết regression suites cho lifecycle facts, owner matrix và retention safety  
Owner: QA Lead  
Required AI skill: `quality-playbook`  
Estimate: 4h  
Dependency: backend slices tương ứng  
DoD: test suite chứng minh không còn parallel writer hữu hiệu và purge không xóa sai tier.  
Test gate: backend suites PASS.  
Evidence: test outputs + traceability mapping.

- [ ] `QA-7.2` Viết frontend tests cho IA, preview/apply, effective-value warnings và pagination  
Owner: QA Lead + Frontend Lead  
Required AI skill: `quality-playbook` + `Expert React Frontend Engineer`  
Estimate: 4h  
Dependency: FE slices tương ứng  
DoD: operator flow chính có regression coverage.  
Test gate: frontend suites PASS.  
Evidence: test outputs + screenshots.

- [ ] `QA-7.3` Chạy performance evidence cho `whale-alerts/:symbol` trước/sau facts-first  
Owner: QA Lead + Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 3h  
Dependency: BE-2.3  
DoD: có before/after timings cùng symbol/session và explanation rõ route đã bỏ raw-full-scan primary path.  
Test gate: benchmark evidence PASS.  
Evidence: timing snapshot + payload/source markers.

- [ ] `OPS-7.4` Refresh stack, rehearse backfill/cleanup và chuẩn bị evidence final  
Owner: DevOps Lead  
Required AI skill: GitHub Copilot theo ops guardrails  
Estimate: 3h  
Dependency: QA-7.1, QA-7.2, QA-7.3  
DoD: frontend/backend/celery stack refreshed, worker jobs chạy được, auditor có thể kiểm tra ngay.  
Test gate: runtime smoke PASS.  
Evidence: rebuild logs + screenshots/video + residual risk note.