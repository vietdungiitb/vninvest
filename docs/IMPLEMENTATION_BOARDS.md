# Implementation Boards (Canonical + Soft-Archive Aligned)

> **Status**: ACTIVE  
> **Last aligned**: 2026-04-03  
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
