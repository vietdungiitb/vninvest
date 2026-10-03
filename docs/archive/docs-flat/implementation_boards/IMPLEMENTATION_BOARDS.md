# Implementation Boards (Canonical + Soft-Archive Aligned)

> **Status**: ACTIVE  
> **Last aligned**: 2026-04-10  
> **Purpose**: Chuẩn hóa board theo trạng thái code hiện tại, đồng thời giữ dấu vết lịch sử ở mức cần thiết.

---

## Hướng dẫn sử dụng

- Mỗi board tương ứng một giai đoạn/sprint.
- Trạng thái chuẩn: `Todo | In Progress | Review | Done | Blocked | Archived`.
- Khi hạng mục đã triển khai xong nhưng còn cần hardening, chuyển sang board hardening mới thay vì mở lại board cũ.
- Tài liệu tham chiếu vận hành:
  - `docs/WEEKLY_EXECUTION_TEMPLATE.md`
  - `docs/ROADMAP_STATUS.md`
  - `docs/SPRINT_EXECUTION_LOG.md`

---

## Board A — Sprint 7/8/10/11/12/13 Historical Summary (Archived)

> **ARCHIVED**: Các board chi tiết cũ (A/B/C/D/F trong phiên bản trước) được gộp thành snapshot lịch sử để tránh trôi trạng thái.

### Historical completion snapshot
- Domain alignment + route standardization: **Done**
- Portfolio engine/core analytics foundation: **Done**
- Realtime event-driven foundation + WebSocket flow: **Done**
- Shared realtime frontend layer + resilience foundation: **Done**
- Sprint 13 analytics/admin ops/stock workspace core: **Done**

### Canonical references cho lịch sử
- `docs/ROADMAP_STATUS.md`
- `docs/SPRINT_EXECUTION_LOG.md`
- `docs/SPRINT13_ACCEPTANCE_CHECKLIST.md`

---

## Board B — Sprint 14 Re-baseline (Current Active Board)

### Epic B1 — Documentation & Governance Alignment
| ID | Story | Task chi tiết | Owner | Estimate | Phụ thuộc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B1-1 | Chuẩn hóa trạng thái docs | Đồng bộ roadmap/sprint/backlog/board theo source hiện tại | PM/BE | 1d | None | Không còn mâu thuẫn “planning vs delivered” | In Progress |
| B1-2 | Soft-archive docs dư thừa | Gắn nhãn ARCHIVED/DEPRECATED, trỏ canonical docs | PM | 0.5d | B1-1 | Tài liệu không bị trùng vai trò | Todo |
| B1-3 | Traceability matrix | Map claim docs ↔ file route/view/test | BE/QA | 1d | B1-1 | Mọi claim chính có nguồn đối chiếu | Todo |

### Epic B2 — Realtime & Aggregate Hardening
| ID | Story | Task chi tiết | Owner | Estimate | Phụ thuộc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B2-1 | Aggregate feed contract hardening | Chốt filter/sort/cursor semantics cho whale aggregate | BE | 1.5d | None | Contract rõ, test edge-case đủ | Todo |
| B2-2 | Observability baseline | Chuẩn hóa metric/log cho realtime publish/consume | BE/DevOps | 1.5d | B2-1 | Có dashboard/alert tối thiểu | Todo |
| B2-3 | Runtime resiliency checklist | Chốt reconnect/fallback/stale checklist cho FE realtime | FE/QA | 1d | B2-2 | Checklist pass trên môi trường mục tiêu | Todo |

### Epic B3 — Security & Operations Hardening
| ID | Story | Task chi tiết | Owner | Estimate | Phụ thuộc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B3-1 | Permission/rate-limit review | Rà quyền admin/auth/realtime + limit policy | BE | 1d | None | Security checklist signed-off | Todo |
| B3-2 | Release flow hardening | Build/migrate/smoke/rollback runbook | DevOps | 2d | B3-1 | Dry-run release pass | Todo |
| B3-3 | Incident handling baseline | Quy ước cảnh báo và phản ứng sự cố mức cơ bản | DevOps/PM | 1d | B3-2 | Runbook có thể áp dụng ngay | Todo |

### Epic B4 — Whale Mission Control (Global Config Governance)
| ID | Story | Task chi tiết | Owner | Estimate | Phụ thuộc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B4-1 | Versioned config foundation | Tạo model `WhaleConfigVersion/Draft/Approval/Rollout/Audit/Ack` + migration | BE | 2d | B1-1 | Có schema version hóa + audit trail | Todo |
| B4-2 | Warm-up & integrity check | Diff snapshot trước apply + dependency checks (provider/redis/worker) | BE | 1.5d | B4-1 | Apply bị chặn khi config/dependency không an toàn | Todo |
| B4-3 | Maker-checker workflow | Phân quyền Analyst (draft/preview) vs Supervisor (approve/apply) | BE/QA | 1d | B4-1 | Enforce tách vai trò và không self-approve | Todo |
| B4-4 | Propagation visibility | Worker ACK status + dashboard tín hiệu xanh/đỏ theo version | BE/DevOps | 1.5d | B4-2 | Xác nhận toàn worker đã nhận đúng config | Todo |
| B4-5 | Scheduled + canary rollout | Effective-from theo lịch + rollout theo scope (VN30/exchange/symbol set) | BE | 2d | B4-4 | Rollout phân đoạn chạy đúng scope/time | Todo |
| B4-6 | Safety net auto-revert | Guardrails cứng + anomaly detect spike alerts + rollback tự động + notify | BE/DevOps | 2d | B4-5 | Tự rollback khi vượt ngưỡng bất thường, có audit + cảnh báo | Todo |
| B4-7 | Symbol coverage UX | Bulk upload CSV/XLSX + dynamic group theo sàn/ngành | FE/BE | 1.5d | B4-3 | Quản lý danh sách lớn thuận tiện, validation chuẩn | Todo |

### Epic B5 — Django Admin Google Mail OAuth2 (Sprint 18)
| ID | Story | Task chi tiết | Owner | Estimate | Phụ thuộc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B5-1 | OAuth2 schema foundation | Mo rong `SystemEmailAccount` voi `auth_type` + truong token Google + migration an toan | BE | 1d | B1-1 | Migration pass, khong regression SMTP cu | Todo |
| B5-2 | Admin connect/callback flow | Them connect URL, callback handler, state validation va luu refresh token | BE | 2d | B5-1 | Connect Google thanh cong tu Django Admin | Todo |
| B5-3 | Gmail send transport | Tich hop Gmail API vao `send_system_email` theo branch `google_oauth2` | BE | 1.5d | B5-2 | Gui mail thanh cong qua OAuth2 account | Todo |
| B5-4 | Token lifecycle hardening | Auto-refresh token, status badge, last_error, revoke action | BE | 1d | B5-3 | Admin co the triage va revoke token an toan | Todo |
| B5-5 | QA + rollout + rollback | Test matrix SMTP/OAuth2, canary rollout, rollback ve SMTP | QA/DevOps/BE | 1.5d | B5-4 | Checklist Sprint 18 duoc sign-off | Todo |

### Epic B6 — Mobile App MVP Android + iOS (Sprint 19)
| ID | Story | Task chi tiết | Owner | Estimate | Phụ thuộc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B6-1 | Mobile workspace bootstrap | Tao `mobile-app/` voi Expo + TypeScript, env config, navigation skeleton | Mobile | 1d | B1-1 | App chay tren Android/iOS simulator | Todo |
| B6-2 | Auth + secure token | Register/login/refresh/logout + secure storage + session restore | Mobile/BE | 1.5d | B6-1 | Login + restore + logout pass end-to-end | Todo |
| B6-3 | Dashboard core | Summary/holdings/allocation + loading/empty/error + pull-to-refresh | Mobile | 2d | B6-2 | Dashboard hien dung data backend, scroll muot | Todo |
| B6-4 | Transactions + validation | CRUD giao dich theo subaccount + validation ma CK truoc submit | Mobile/BE | 2d | B6-3 | Transactions flow pass, ma sai bi chan | Todo |
| B6-5 | Watchlist + whale + internal release | Watchlist/tracked + whale hub/detail + realtime fallback + internal build | Mobile/QA/DevOps | 2.5d | B6-4 | Checklist Sprint 19 duoc sign-off | Todo |

### Epic B7 — Backend Audit Hardening Wave (2026-04-05)
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B7-1 | Audit to execution board | Chot workboard owner-ready tu audit v2 | PM/BE | 0.5d | B1-1 | Board active, co owner + gate + KPI sheet | Done |
| B7-2 | External IO consolidation | Chuyen call provider ve 1 facade va xoa call truc tiep trong HTTP path | BE | 3d | B7-1 | Khong con import provider truc tiep o flow da scope | Todo |
| B7-3 | Rollout by metrics | Chot canary gate + rollback trigger theo p95/5xx/fallback ratio | DevOps/QA | 2d | B7-2 | Co runbook + evidence theo ngay | Todo |

Tham chieu board chi tiet: `docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md`.

### Epic B8 — Sprint 23 Backend Audit Coding Execution
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B8-1 | Sprint 23 coding plan | Chot backlog S23-01..S23-08 + acceptance gate | PM/BE | 0.5d | B7-1 | Plan/checklist/taskboard du bo | Done |
| B8-2 | Code hardening execution | Thuc thi S23-01..S23-06 theo coding plan | BE/QA | 7d | B8-1 | Gates A/B pass trong S23 checklist | In Progress |
| B8-3 | Runtime rollout execution | Thuc thi S23-07..S23-08 + sign-off | DevOps/PM/QA | 3d | B8-2 | Gates C/D/E pass, co bien ban GO/NO-GO | Todo |

Tham chieu sprint moi:
- `docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md`
- `docs/SPRINT23_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT23_TASKBOARD.csv`
- `docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md`

### Epic B9 — Sprint 24 Dashboard Realtime Consistency
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B9-1 | Sprint 24 planning lock | Chot backlog S24-01..S24-05 + acceptance gate | PM/FE | 0.5d | B8-3 | Plan/checklist/taskboard du bo | Done |
| B9-2 | Dashboard consistency execution | Thuc thi S24-01..S24-03 (single source + live overlay + UX polish) | FE/QA | 4d | B9-1 | Gates A/B pass trong S24 checklist | Todo |
| B9-3 | Runtime validation + mini canary | Thuc thi S24-04..S24-05 + go/no-go | Ops/PM/QA | 3d | B9-2 | Gates C/D/E pass, co closure note | Todo |

Tham chieu sprint moi:
- `docs/SPRINT24_DASHBOARD_REALTIME_EXECUTION_PLAN.md`
- `docs/SPRINT24_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT24_TASKBOARD.csv`
- `docs/SPRINT24_TRUST_DECISION_STORIES.md`
- `docs/SPRINT24_CODING_BREAKDOWN_PLAN.md`

### Epic B10 — Sprint 27 Onboarding Trial Plan Admin Policy
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B10-1 | Sprint 27 planning lock | Chot business decisions + policy/checklist/decision pack | PM/BE | 0.5d | None | 3 tai lieu canonical da du va duoc phe duyet | Done |
| B10-2 | Schema + migration | Tao OnboardingPlanPolicy + PlanAssignmentLog + mo rong UserConfig | BE | 1d | B10-1 | Migration pass, constraint 1 policy active hoat dong | Done |
| B10-3 | Service core | Implement signup assign + expiry downgrade + audit helper | BE | 1d | B10-2 | Unit tests pass, idempotent va race-safe | Done |
| B10-4 | Registration integration | Hook auto-assign cho email/password va OAuth signup | BE | 0.75d | B10-3 | User moi nhan plan dung theo policy | Done |
| B10-5 | Celery expiry job | Tao task + schedule + feature flag rollout | BE/DevOps | 0.5d | B10-3 | Downgrade dung dieu kien, co metrics/log | Done |
| B10-6 | Full admin UI + audit | Policy admin, user override, audit filter day du | BE/QA | 1d | B10-2 | Admin thao tac duoc full luong + co log | Done |
| B10-7 | QA + rollout decision | Test matrix + go/no-go + rollback runbook | QA/PM/DevOps | 0.5d | B10-4,B10-5,B10-6 | Checklist pass, san sang deploy | Done |

Tham chieu sprint moi:
- `docs/ONBOARDING_TRIAL_PLAN_ADMIN_POLICY_20260408.md`
- `docs/ONBOARDING_TRIAL_PLAN_IMPLEMENTATION_CHECKLIST_20260408.md`
- `docs/ONBOARDING_TRIAL_PLAN_PRECODE_DECISION_PACK_20260408.md`
- `docs/SPRINT27_ONBOARDING_TRIAL_EXECUTION_PLAN.md`
- `docs/SPRINT27_TASKBOARD.csv`
- `docs/SPRINT27_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT27_STAGING_SMOKE_CHECKLIST.md`
- `docs/SPRINT27_GO_NO_GO_REPORT_20260408.md`
- `docs/SPRINT27_RELEASE_COMMANDS.md`

### Epic B11 — Sprint 28 Legal Content at Login + User Menu
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B11-1 | Sprint 28 planning lock | Chot execution plan + checklist + taskboard cho legal content | PM/BE/FE | 0.25d | None | Co bo tai lieu canonical cho dev thuc thi | Done |
| B11-2 | Schema + admin | Tao LegalPage model + migration + admin list/filter/active action | BE | 1d | B11-1 | Admin sua duoc about/disclaimer vi/en, 1 active version moi slug+locale | Todo |
| B11-3 | Public legal API | Tao endpoint public legal pages + locale fallback logic | BE | 0.75d | B11-2 | API khong can auth, response dung contract | Todo |
| B11-4 | Login integration | Hien legal content tai man hinh login/register (truoc dang ky) | FE | 1d | B11-3 | User doc duoc legal content truoc khi dang ky, fail-soft khi API loi | Todo |
| B11-5 | User menu integration | Them legal links trong menu sau dang nhap + legal routes | FE | 0.75d | B11-3 | User doc lai legal content sau login tren desktop/mobile | Todo |
| B11-6 | QA + release gate | Backend tests + frontend smoke + go/no-go + rollback note | QA/PM/DevOps | 0.75d | B11-4,B11-5 | Checklist pass va san sang deploy | Todo |

Tham chieu sprint moi:
- `docs/SPRINT28_LEGAL_CONTENT_EXECUTION_PLAN.md`
- `docs/SPRINT28_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT28_TASKBOARD.csv`

### Epic B12 — Sprint 29 AI Advisory + Kline Chart Context
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B12-1 | Sprint 29 planning lock | Chot execution plan + acceptance checklist + taskboard canonical | PM/BE/FE | 0.5d | None | Co bo tai lieu canonical cho dev thuc thi | Done |
| B12-2 | Backend contract + serializer | Tao chart_context serializer + validate/clamp + response flags | BE | 2.0d | B12-1 | API contract pass matrix valid/invalid/oversize | Done |
| B12-3 | Prompt + telemetry integration | Inject chart block vao prompt + metric context usage | BE/DevOps | 1.5d | B12-2 | Co evidence chart_context_used va dashboard metric | Done |
| B12-4 | Frontend chart context collector | Build collector tu Kline (visible OHLCV + indicators + metrics) | FE | 1.5d | B12-1 | Payload tra dung schema v1, fallback an toan | Done |
| B12-5 | Frontend generate + UX state | Gui chart_context khi generate tab + badge/warning states | FE | 1.5d | B12-4,B12-2 | UX minh bach context used/fallback | Done |
| B12-6 | QA + canary + go/no-go | API/E2E/perf + canary 10% + rollback verification | QA/PM/DevOps | 2.0d | B12-3,B12-5 | Checklist Sprint 29 duoc sign-off | In Progress |

Tham chieu sprint moi:
- `docs/SPRINT29_AI_ADVISORY_KLINE_CONTEXT_EXECUTION_PLAN.md`
- `docs/SPRINT29_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT29_TASKBOARD.csv`
- `docs/AI_ADVISORY_KLINE_CONTEXT_UPGRADE_PLAN_20260408.md`
- `docs/AI_ADVISORY_KLINE_CONTEXT_TASKBOARD_20260408.md`
- `docs/AI_ADVISORY_KLINE_CONTEXT_EXECUTION_TRACKER_20260408.md`

### Epic B13 — Sprint 31 Whale Alerts Professionalization Phase 0-1
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B13-1 | Sprint 31 planning lock | Chot execution plan + acceptance checklist + taskboard canonical | PM/BE/FE | 0.5d | None | Co bo tai lieu canonical cho team vao sprint ngay | Done |
| B13-2 | Threshold + market-time consistency | Thuc thi WA-P0-1 va WA-P0-2 (threshold override + local market-time normalization) | BE/QA | 3.5d | B13-1 | Regression tests pass, khong con mismatch semantics tren cac surface | Done |
| B13-3 | Event trust metadata + FE trust chips | Thuc thi WA-P0-3 va WA-P0-5 (`source_layer`, `threshold_source`, `freshness_bucket`, labels FE) | BE/FE/QA | 2.5d | B13-2 | FE hien trust markers dung contract, UX khong mu mo source/freshness | Done |
| B13-4 | Realtime observability baseline | Thuc thi WA-P0-4 metrics + health summary + runbook canh bao | BE/DevOps | 2d | B13-2 | Co evidence baseline freshness/dedup/recovery/source-mix | Done |
| B13-5 | Aggregate window filter v2 kickoff | Thuc thi WA-P1-1 va lock contract adapter cho FE | BE/FE | 2d | B13-4 | Window filter hoat dong on dinh, cursor deterministic | Done |

Tham chieu sprint moi:

### Phase 1 Kickoff: Campaign Intelligence + Professional Workflow (Ready for D1 execution)
| Id | Story | Estimate | Phu thuoc | Status |
|---|---|---|---|---|
| WA-P1-2 | Campaign grouping engine | 2d BE | B13-5 | Backlog |
| WA-P1-3 | Abnormality scoring layer | 2d BE + 1d FE | B13-5 | Backlog |
| WA-P1-4 | Whale Hub v2 (Campaigns tab) | 2.5d FE | WA-P1-2 | Backlog |
| WA-P1-5 | Dark money co-observation | 1d BE | B13-5 | Backlog |
| WA-P1-6 | Explainability + UI layer | 2d BE+FE | WA-P1-3 | Backlog |
| WA-P1-7 | Performance + regression suite | 2d QA | All stories | Backlog |

Tham chieu sprint Phase 1:
- `docs/SPRINT31_PHASE1_PLANNING_20260410.md` (Full backlog breakdown + architecture design)
- `docs/SPRINT31_PHASE1_D1_TASKBOARD.csv` (D1 owner-level execution board)
- `docs/SPRINT31_PHASE1_DEBT_TRACKER.md` (Option B debt hardening lane)

Tham chieu sprint Phase 0:
- `docs/SPRINT31_WHALE_ALERTS_PROFESSIONALIZATION_EXECUTION_PLAN.md`
- `docs/SPRINT31_CODING_BREAKDOWN_PLAN.md`
- `docs/SPRINT31_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT31_TASKBOARD.csv`
- `docs/WHALE_ALERTS_PHASE0_PHASE1_EXECUTION_PLAN_20260410.md`
- `docs/WHALE_ALERTS_API_CONTRACT_V2_DRAFT_20260410.md`

---

## Board C — Future Expansion (Backlog-linked)

> Board này chỉ nhận task khi Board B đạt ngưỡng ổn định.

### Epic C1 — Analytics depth expansion
- HHI/VaR/stress scenarios (nếu chưa hoàn thiện ở mức production-ready)

### Epic C2 — Stock workspace advanced tooling
- Nâng cấp technical workspace, indicator/insight workflow

### Epic C3 — External integrations
- News/events feed, broker integration, advanced market depth

Tham chiếu ưu tiên: `docs/FEATURE_EXPANSION_BACKLOG.md`.

---

## Quy tắc quản trị board

1. Daily update status + blocker trước 10:00.
2. Task Blocked quá 2 ngày phải có owner xử lý rõ.
3. Khi task Done bắt buộc cập nhật tài liệu trạng thái liên quan.
4. Không tạo board mới nếu chưa đóng vòng consistency ở board hiện tại.
