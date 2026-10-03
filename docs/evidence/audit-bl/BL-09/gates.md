# BL-09 gates — dep scan baseline + digest pin (2026-09-24)

## Scan baseline (lần đầu, lưu tại đây)
- **npm (packages/web)**: `npm audit` = **18 vulns (1 low, 5 moderate, 12 high)**. Highs: axios, brace-expansion, fast-uri, form-data, js-yaml, nanoid, postcss, react-router, react-router-dom, undici, vite, xlsx. Phần lớn là transitive devDeps (vite/esbuild/vitest/postcss toolchain); runtime-relevant: axios 1.17.0, xlsx, react-router-dom 6.30.3 (GHSA-2j2x open redirect, moderate).
- **pip (.venv BE)**: `pip-audit` = **46 vulns / 12 pkgs**: anyio 4.14.0→4.14.2, autobahn 26.6.1→26.7.1, cryptography 49.0.0→50.0.0, django 5.2.15→5.2.16 (7 findings), djangorestframework 3.17.1→3.17.2 (2), h2 4.3.0→4.4.1, httplib2 0.31.2→0.32.0, msgpack 1.2.0→1.2.1, pip 26.0.1→26.1.x (4).

## Disposition (fix hoặc risk-accept — DoD cho phép)
- **FIXED hôm nay**: pip venv 26.0.1→26.2.1 (zero-risk, installer only) — kills 4 pip findings. Image digest pinned (dưới).
- **ACCEPT + follow-up W2**: Django 5.2.15→5.2.16 + DRF 3.17.1→3.17.2 (patch bumps, cần BE test re-run — ticket W2). cryptography 49→50 (major, cần compat check — ticket W2). npm runtime highs (axios major bump / rrd v7 breaking / xlsx thay thế — cần FE re-verify, ticket W2). Dev-only transitive highs: accept, tự hết khi bump toolchain.
- Không chạy `npm audit fix` hôm nay (đổi lock + đòi re-verify toàn FE, vượt timebox W1).

## Digest pin (FIXED)
- `prom/prometheus:v3.7.0@sha256:29c1e0…95cc4dc`, `grafana/grafana:12.2.0@sha256:7414418…3609183adf7` (digests via `docker buildx imagetools inspect`, verified).
- Applied 6 chỗ: `docker-compose.yml:191,211`, `docker-compose.prod.yml:481,501`, `docker-compose.ghcr.yml:260,280`. Grep `:latest` còn lại cho prom/grafana = **0 hit**. `docker compose config --quiet` = **exit 0**.

## Cadence
- Scan hàng tháng, owner DevOps; lệnh chuẩn: `npm audit` (web+mobile) + `python -m pip_audit` (BE venv). Ghi kết quả vào `docs/evidence/audit-bl/BL-09/scan-YYYYMM.md`.

## DoD tick
- [x] baseline lưu · [x] 0 Critical chưa disposition (0 Critical trong cả 2 report) · [x] hết tag latest prod · [x] cadence + owner.
