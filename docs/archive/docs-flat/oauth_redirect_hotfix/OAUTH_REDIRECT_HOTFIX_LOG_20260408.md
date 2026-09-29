# OAuth Redirect Hotfix Log (2026-04-08)

## Muc tieu
- Khac phuc loi Google OAuth `redirect_uri_mismatch` do callback bi sinh thanh `http://vninvest.edusuccess.vn/...` thay vi `https://...`.
- Dam bao stack Portainer truyen dung bien moi truong vao runtime.

## Trieu chung ghi nhan
- Google tra ve loi:
  - `You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy.`
  - `redirect_uri=http://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/`

## Nguyen nhan goc (xac nhan trong qua trinh debug)
1. Chuoi proxy co luc khong giu duoc proto `https` vao backend.
2. Stack Portainer chua truyen bien `GOOGLE_OAUTH_REDIRECT_URI` vao backend/celery => app tiep tuc tu sinh URL callback.
3. Kha nang container dang chay image/config cu sau cac lan redeploy khong force recreate.

## Cac thay doi da thuc hien

### 1) Backend: trust proxy SSL headers
- File: `backend/config/settings.py`
- Bo sung:
  - `USE_X_FORWARDED_HOST`
  - `USE_X_FORWARDED_PORT`
  - `SECURE_PROXY_SSL_HEADER`
- Muc dich: de `build_absolute_uri()` uu tien scheme HTTPS khi dung reverse proxy.

### 2) Backend: safety-net ep callback sang https
- File: `backend/portfolio/admin.py`
- Ham: `_resolve_google_oauth_redirect_uri`
- Logic moi:
  - Neu co `GOOGLE_OAUTH_REDIRECT_URI` thi dung ngay.
  - Neu app sinh `http://` cho host non-local thi chuyen sang `https://`.
- Muc dich: tranh phu thuoc tuyet doi vao header cua proxy chain.

### 3) Frontend nginx gateway: ep forwarded proto la https
- File: `frontend/docker/nginx.conf`
- Cap nhat cho cac route `/admin/`, `/static/admin/`, `/api/`, `/ws/`:
  - `proxy_set_header X-Forwarded-Proto https;`
- Muc dich: backend luon nhan proto HTTPS trong moi truong production domain.

### 4) Portainer stack: truyen bien OAuth redirect vao runtime
- File: `portainer-stack-nginx-proxy.yml`
- File: `portainer-stack-https.yml`
- Them bien vao `backend`, `celery_worker`, `celery_beat`:
  - `GOOGLE_OAUTH_REDIRECT_URI: ${GOOGLE_OAUTH_REDIRECT_URI}`

### 5) Env example: bo sung bien bat buoc
- File: `portainer-nginx-proxy.env.example`
- Them:
  - `GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/`

## Trang thai Git
- Branch da tao va push: `deploy`
- Remote: `origin/deploy`
- Commit da push: `f0542140`
- Message: `Fix Google OAuth redirect scheme behind proxy`

## Cau hinh production can dam bao
- Portainer Environment co day du:
  - `GOOGLE_OAUTH_REDIRECT_URI=https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/`
  - `FRONTEND_BASE_URL=https://vninvest.edusuccess.vn`
  - `DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1`
  - `CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`
  - `CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn`

## Checklist deploy/verify
1. Portainer stack tro den branch `deploy` (hoac ref `refs/heads/deploy`).
2. Redeploy voi tuy chon recreate containers (va pull/build image moi neu co).
3. Google Cloud Console phai co Authorized redirect URI chinh xac:
   - `https://vninvest.edusuccess.vn/admin/portfolio/systememailaccount/google/callback/`
4. Thu lai flow OAuth trong cua so an danh.
5. Neu van loi, kiem tra ngay URL redirect_uri tra ve co con `http://` hay khong.

## Cong viec tiep theo de track
- [ ] Xac nhan production da het `redirect_uri_mismatch`.
- [ ] Chot tai lieu huong dan deploy final trong `docs/PORTAINER_DEPLOY_VNINVEST_EDUSUCCESS.md`.
- [ ] Tao PR tu branch `deploy` vao nhanh chinh sau khi verify thanh cong.
