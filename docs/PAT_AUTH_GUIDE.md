# Hướng dẫn Client — Authenticate, Validate PAT & Nhận Plan

## 1. Login lấy PAT + plan info

```bash
curl -X POST https://api.edusuccess.vn/core/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "..."}'
```

**Response:**
```json
{
  "access": "vni_pro_a1b2c3d4e5f6g7h8i9j0k...",
  "refresh": "vni_pro_a1b2c3d4e5f6g7h8i9j0k...",
  "token": "vni_pro_a1b2c3d4e5f6g7h8i9j0k...",
  "token_prefix": "vni_pro_a1b2",
  "plan": "pro",
  "active_pat_count": 3,
  "max_active_pats": 25,
  "tenant": {
    "tenant_id": "uuid-...",
    "tenant_code": "TENANT001",
    "display_name": "My Company",
    "plan": "pro",
    "max_active_pats": 25,
    "status": "active",
    "features": []
  },
  "user": {
    "id": 1,
    "username": "tenant_user",
    "email": "user@example.com",
    "first_name": "",
    "last_name": "",
    "is_staff": false
  },
  "abilities": ["read:tenant", "manage_pats", ...],
  "entitlements": {...}
}
```

## 2. Sử dụng PAT trong API calls

Gửi PAT trong `Authorization: Bearer` header:

```bash
curl -H "Authorization: Bearer vni_pro_a1b2c3d4e5f6g7h8i9j0k..." \
  https://api.edusuccess.vn/core/v1/stock-management/stocks/ACB/chart/
```

## 3. Validate PAT + lấy plan info (khi app khởi động lại)

Dùng PAT đã lưu trong localStorage / secure storage gọi endpoint này:

```bash
curl -H "Authorization: Bearer vni_pro_a1b2c3d4e5f6g7h8i9j0k..." \
  https://api.edusuccess.vn/core/v1/auth/me
```

**Response:** Giống response login — bao gồm `plan`, `active_pat_count`, `max_active_pats`, `tenant`.

Khi PAT hết hạn hoặc bị thu hồi → response `401 Unauthorized` → client cần refresh hoặc redirect login.

## 4. Refresh / rotate PAT

```bash
curl -X POST https://api.edusuccess.vn/core/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "vni_pro_a1b2c3d4e5f6g7h8i9j0k..."}'
```

Trả về PAT mới + rotated (PAT cũ bị revoke).

## 5. Offline fallback — parse plan từ prefix

PAT format: `vni_{plan}_{random}`

```ts
function getPlanFromToken(token: string): string | null {
  const parts = token.split('_');
  return parts.length >= 2 ? parts[1] : null;
}
```

Ví dụ:
- `vni_pro_a1b2c3d4...` → `"pro"`
- `vni_free_x9y8z7...` → `"free"`

Dùng khi không có mạng để fallback hiển thị plan badge.

## 6. Giới hạn PAT theo plan

| Plan | `max_active_pats` |
|---|---|
| free | 3 |
| starter | 10 |
| pro | 25 |
| enterprise | -1 (không giới hạn) |
| custom | -1 (không giới hạn) |
| internal | -1 (không giới hạn) |

## 7. Guard logic cho Frontend

Khi `active_pat_count >= max_active_pats`:
- **Disable** "Issue PAT" button
- **Tooltip:** "Đã đạt giới hạn {max_active_pats} PAT cho gói {plan}. Vui lòng thu hồi PAT cũ hoặc nâng cấp plan."
- **Backend** cũng trả về lỗi nếu cố tình gọi API issue PAT

## 8. Tóm tắt endpoints

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| `POST` | `/core/v1/auth/token/` | None | Login user/pass → PAT + plan |
| `GET` | `/core/v1/auth/me` | Bearer PAT | Validate PAT + profile + plan |
| `POST` | `/core/v1/auth/token/refresh/` | None (body: refresh) | Refresh PAT |
| `POST` | `/core/v1/auth/logout` | Bearer PAT | Revoke PAT |
| `GET` | `/core/v1/stock-management/stocks/{symbol}/chart/` | Bearer PAT | Lấy bars chart |
