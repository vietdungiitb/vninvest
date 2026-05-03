# OpenCore Quickstart

## Muc tieu

Quickstart nay huong dan khoi dong lane Community/OpenCore voi community artifact sinh tu `packages/web`.

## Nhanh chong

1. Build community artifact cua `packages/web` theo build target `community`.
2. Dat bien moi truong `OPENCORE_WEB_DIST_DIR` tro den thu muc dist hop le.
3. Chay `packages/opencore/distribution/install-community.ps1`.
4. Mo URL self-host o port mac dinh `8088`.

## Kiem tra nhanh

- `GET /health` tra `200 OK`.
- Trang index phai do dung bundle tu `packages/web`, khong phai source clone rieng.