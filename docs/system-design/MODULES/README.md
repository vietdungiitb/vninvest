# MODULES — Dossier Từng Django App

> Mỗi app nghiệp vụ có một dossier `MODULES/<app>.md` theo cùng một khung. Quy mô:
> 15 app (máy đo — claim `C-001`). Danh sách dưới đây lấy `verbose_name` từ
> `apps.py` thật (đo 2026-10-14).

## 1. Khung dossier (bắt buộc cho mọi app)

1. Mục đích app (1 đoạn) + ranh giới với app khác.
2. Model chính + ràng buộc tenant (row-level ở đâu).
3. API/route nhóm này (trỏ `07.02` khi có).
4. Job/beat/signal (vd bù trừ sổ cái).
5. Finding P0/P1 đang mở + test khóa hành vi.
6. Trạng thái: ✅ viết xong / ⏳ stub / ❓ chưa kiểm chứng.

## 2. Danh sách app

| App | Tên hiển thị (`apps.py`) | Dossier |
|---|---|---|
| `advertising` | Advertising | ✅ dossier v1 (2026-10-14) |
| `advisory` | Advisory | ✅ dossier v1 (2026-10-14) |
| `ai_agents` | AI Agents Registry | ✅ dossier v1 (2026-10-14) |
| `ai_analytics` | AI Usage Analytics | ✅ dossier v1 (2026-10-14) |
| `commercial` | Commercial | ✅ dossier v1 (2026-10-14) |
| `data_ingest` | Data Ingest | ✅ dossier v1 (2026-10-14) |
| `identity_access` | Identity & Access | ✅ dossier v1 (2026-10-14) |
| `market_data` | Market Data | ✅ dossier v1 (2026-10-14) |
| `market_serving` | Market Serving | ✅ dossier v1 (2026-10-14) |
| `ops_audit` | Ops Audit | ✅ dossier v1 (2026-10-14) |
| `service_ops` | Service Operations Center | ✅ dossier v1 (2026-10-14) |
| `signal_intelligence` | Signal Intelligence | ✅ dossier v1 (2026-10-14) |
| `support` | (apps.py không khai `verbose_name`) | ✅ dossier v1 (2026-10-14) |
| `tenant_lifecycle` | Tenant Lifecycle | ✅ dossier v1 (2026-10-14) |
| `user_workspace` | User Workspace | ✅ dossier v1 (2026-10-14) |

> Ngoài ra `vninvest_core` là project package (settings, envelope, middleware) —
> không phải app nghiệp vụ, không có dossier riêng mà mô tả ở `02.01`.
