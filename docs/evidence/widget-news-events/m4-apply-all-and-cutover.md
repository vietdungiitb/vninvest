# M4 apply toàn bộ + Cutover runtime (2026-11-25)

## 1. Apply tất cả lô (HOSE/HNX/UPCOM 2011–2026)
Driver `/tmp/m4_parallel.py` trên VPS: 3 worker, mỗi lô 1 `docker exec` riêng,
`PRICE_MIGRATION_PAUSED=1`, pacing 1s, report `/tmp/m4_<EXCHANGE>_<YEAR>.json`.

Sự cố đã xử lý (không phải lỗi dữ liệu):
- Container core-api limit 512MB → OOM 137; nâng 4GB.
- Postgres limit 2GB → OOM kill; nâng 12GB.
- Agent khác deploy image cũ làm mất `price_source`/`adj_factor` trên model class (DB vẫn có cột) ⇒ `FieldError`; copy lại model + command + persist + migration.
- `BATCH` 2000→500 trong container (ops tuning) để giảm memory/lô.
- 5 lô (HNX 2023/2024/2025/2026, UPCOM 2026) có **0 dòng CafeF nguồn** (`HNX_LATE=[]`, `UPCOM26=0`) ⇒ không cần apply.

## 2. Verify DB cuối (lệnh: `python3 /tmp/final_verify.py`)
```json
{
  "total": {"cafef": 1904487, "unmapped": 1553342, "cafef_with_factor": 1904487},
  "bad_cafef": 0, "bad_unmapped": 0,
  "mismatches": [
    {"key":"UPCOM:2015","source":12095,"persisted":0},
    {"key":"UPCOM:2011","source":9685,"persisted":0},
    {"key":"HNX:2012","source":492,"persisted":0},
    {"key":"UPCOM:2014","source":11239,"persisted":0}
  ],
  "batch_count": 74
}
```
4 mismatch đúng là lô bulk CafeF lỗi nguồn 504/400/503 đã loại từ đầu — giữ `vnbroker_legacy`, không suy diễn dữ liệu. Mọi lô còn lại khớp 100% số dòng nguồn.

## 3. Cutover runtime (đã chạy)
- Commit container thành image `vninvest-core-api:cutover` (giữ code đã copy), set `APP_RELEASE=cutover`.
- `docker-compose.staging.yml`: truyền `PRICE_MIGRATION_PAUSED` + `PRICE_ADJUSTED_DISPLAY` vào 5 service core (commit có trailer `Claim-Deny-List:` — coordinator chốt). `compose.staging.env`: `PRICE_ADJUSTED_DISPLAY=1`, `PRICE_MIGRATION_PAUSED=0`.
- `docker compose up -d --force-recreate` ⇒ flag trong container: `DISPLAY=1`, `PAUSED=0`.
- Deploy FE: build local (`dist`, 149 file) → `docker cp` vào `vninvest-frontend:/usr/share/nginx/html/`; assets chứa `unmapped_cafef`.
- Apply migration `advisory/0024`, `user_workspace/0031` — cột `price_basis` tồn tại cả 2 bảng.
- `cache.clear()` xong.

## 4. E2E
- API-level (Django `APIRequestFactory`, `/chart` TPB): `status=200`, `adjusted_display=true`, 955 points, `first_point.adj_close=10280`/`adj_factor=0.4195918367`/`price_source=cafef`; `effective_close(TPB 2022-01-04)=17940.0`.
- **Visual Playwright ĐÃ CHẠY** (owner cung cấp tài khoản test): đăng nhập `admin`, vào `/stocks/TPB`, đợi widget render xong (~25s), screenshot `/tmp/m5c_chart_e2e_final.png` **đã mở ảnh kiểm tra** — chart hiển thị 2.145 nến, EMA20/EMA50/Bollinger/volume, không có pageerror. Console có 1 lỗi 404 tại `/core/v1/advisory/latest/TPB/` (endpoint advisory cũ, outside scope). Widget hiển thị nhãn "Chưa điều chỉnh" vì host map `adj_close` vào `close` trước khi truyền widget (thiết kế M5c: widget không tự render adjusted) — nến lịch sử vẫn lấy field điều chỉnh từ payload.

## 5. Residual quan sát sau cutover
`vninvest-core-beat` + 3 worker báo **unhealthy** do healthcheck `curl http://127.0.0.1:8100/core/v1/health` — dịch vụ beat/worker không chạy HTTP server (chỉ core-api có). Log beat cho thấy scheduler vẫn phân phối đúng task (`materialize-symbol-snapshot-60s`, `market-data-queue-tier-scheduler-30s`, …) ⇒ **không phải regression của cutover**, là cấu hình healthcheck dùng chung từ API. Không sửa trong scope này.

## 6. Rollback (sẵn)
Backup S0 `before_20261124.dump` (99 MB, sha256 `6c5a7e05…c19691`) + `inserted_keys` từ report từng lô. Để rollback: tắt `PRICE_ADJUSTED_DISPLAY`, đặt lại `PRICE_MIGRATION_PAUSED=1`, khôi phục compose/env từ `/tmp/*.bak-cutover`, restore DB nếu có owner sign-off.
