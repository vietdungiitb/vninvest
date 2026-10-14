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
| `advertising` | Advertising | ⏳ chưa viết |
| `advisory` | Advisory | ⏳ chưa viết |
| `ai_agents` | AI Agents Registry | ⏳ chưa viết |
| `ai_analytics` | AI Usage Analytics | ⏳ chưa viết |
| `commercial` | Commercial | ⏳ chưa viết |
| `data_ingest` | Data Ingest | ⏳ chưa viết |
| `identity_access` | Identity & Access | ⏳ chưa viết |
| `market_data` | Market Data | ⏳ chưa viết |
| `market_serving` | Market Serving | ⏳ chưa viết |
| `ops_audit` | Ops Audit | ⏳ chưa viết |
| `service_ops` | Service Operations Center | ⏳ chưa viết |
| `signal_intelligence` | Signal Intelligence | ⏳ chưa viết |
| `support` | (apps.py không khai `verbose_name`) | ⏳ chưa viết |
| `tenant_lifecycle` | Tenant Lifecycle | ⏳ chưa viết |
| `user_workspace` | User Workspace | ⏳ chưa viết |

> Ngoài ra `vninvest_core` là project package (settings, envelope, middleware) —
> không phải app nghiệp vụ, không có dossier riêng mà mô tả ở `02.01`.
