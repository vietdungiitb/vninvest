# CONFIG OWNERSHIP MATRIX — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: chỉ rõ config nào do ai sở hữu, config nào là source of truth, và ai có quyền chạm vào khi triển khai.

---

## 1. Ownership rules

1. Mọi config production phải có owner rõ ràng.
2. Không sửa config chỉ vì “tạm chạy được”.
3. Environment variable public-facing phải được review trước khi deploy.
4. Config liên quan security hoặc relay phải có Frontend + DevOps sign-off.
5. Nếu config ảnh hưởng data contract thì Backend Lead phải được gắn vào review.

---

## 2. Matrix

| Config / artifact | Source of truth | Owner | Editable by | Used by | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | deploy env | DevOps | DevOps | metadata, canonical URL | must match public domain |
| `VIRTUAL_HOST` | Portainer stack | DevOps | DevOps | nginx-proxy | `about.vninvest.edusuccess.vn` |
| `LETSENCRYPT_HOST` | Portainer stack | DevOps | DevOps | TLS cert automation | same as VIRTUAL_HOST |
| `ABOUT_SITE_BACKEND_URL` | env file | Backend Lead | DevOps + Backend | route handlers | target relay host |
| `ABOUT_SITE_REDIS_URL` | env file | DevOps | DevOps | rate limit helper | used only server-side |
| `ABOUT_SITE_DEFAULT_LOCALE` | package config | Frontend Lead | Frontend Lead | i18n router | default `vi` |
| `ABOUT_SITE_ALLOWED_SYMBOLS` | code constant / env override | Frontend + Backend | Frontend Lead | chart + playground routes | whitelist must be consistent |
| `ABOUT_SITE_RATE_LIMIT_BARS` | config constant | Backend Lead | Backend Lead | `/api/bars` route | public chart relay |
| `ABOUT_SITE_RATE_LIMIT_VNBROKER` | config constant | Backend Lead | Backend Lead | `/api/public/vnbroker-data` route | playground relay |
| `ABOUT_SITE_PYODIDE_CDN` | env or code constant | Frontend Lead | Frontend Lead | playground loader | pin version explicitly |
| `ABOUT_SITE_REVALIDATE_SECONDS` | route config | Frontend Lead | Frontend Lead | blog ISR | default 86400 |
| `ABOUT_SITE_CSP_POLICY` | middleware / next config | DevOps | DevOps | public headers | must be reviewed |
| `ABOUT_SITE_OG_IMAGE_PATH` | static asset | Frontend Lead | Frontend Lead | SEO metadata | 1200x630 recommended |
| `BLOG_SEED_LOCK` | repo content | Content owner | Frontend Lead | blog content | phase 1 no CMS |

---

## 3. Ownership by area

### Frontend Lead owns
- route shell
- i18n messages
- chart surface
- playground UI
- blog pages
- SEO metadata helpers

### Backend Lead owns
- relay contract shape
- rate limit policy for public routes
- response schema compatibility
- whitelist consistency between chart and playground

### DevOps owns
- Dockerfile
- GHCR push workflow
- Portainer stack
- VIRTUAL_HOST / TLS / headers / runtime env

### Content owner owns
- blog copy
- legal text
- marketing copy on homepage and pricing

---

## 4. Change control

Any change to the following requires explicit review:
- `ABOUT_SITE_BACKEND_URL`
- `ABOUT_SITE_CSP_POLICY`
- allowed symbol list
- Pyodide CDN/version
- canonical domain URL
- rate limit thresholds

Do not merge if config drift exists between:
- docs
- env file
- route handler constants
- Portainer stack
