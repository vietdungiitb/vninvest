# Huong dan cai dat self-host

## Dieu kien truoc

- Da co community artifact tu `packages/web`.
- Da cai Docker va Docker Compose.
- Da co quyen truy cap cac contract public-safe cua `packages/core`.

## Bien moi truong

- `OPENCORE_WEB_DIST_DIR`: thu muc chua artifact community.
- `OPENCORE_HTTP_PORT`: cong public cho Nginx overlay.

## Cach cai dat

1. Chay `npm run build-community` trong `packages/web`.
2. Xac nhan thu muc build community ton tai.
3. Chay `packages/opencore/distribution/install-community.ps1`.
4. Mo `http://localhost:8088/health` de kiem tra.
5. Neu can thay cong, set `OPENCORE_HTTP_PORT` truoc khi chay script.

## Luu y van hanh

- OpenCore chi package hoa distribution lane.
- Toan bo tenant, entitlement, quota va billing van nam o `packages/core`.