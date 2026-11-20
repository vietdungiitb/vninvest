# Structured migration + baseline closure + Q1/Q2 (2026-11-20)

- **Scope**: xử lý triệt để các việc còn sau Entry 577 — (1) baseline full BE, (2) fix 1 regression Admin, (3) migrate ingest sang field số 3.8.2 có fallback, (4) FE build, (5) đối chiếu Q1/Q2, (6) deploy staging.
- **Claim**: `corp-actions-structured` (`53001d956`) · **Branch**: `feat/corp-actions-structured`.

## 1. BASELINE FULL BE — 0 REGRESSION

| Cây | Tests | Failures | Errors |
|---|---:|---:|---:|
| Baseline `165cdc8d2` (trước code pipeline) | 3536 | 35 | 221 |
| Trước fix Admin (Entry 577) | 3574 | 36 | 221 |
| **Sau fix Admin + migrate ingest** | **3576** | **35** | **221** |

Lệnh: `python manage.py test -v 1` trên cây backend đầy đủ, container `vninvest-core-api`, DB tạm riêng (đã drop). So sánh danh sách `FAIL:`/`ERROR:` giữa baseline và cây hiện tại: **comm -13 / comm -23 đều rỗng** ⇒ 0 test mới fail, 0 test cũ bị hỏng.

1 fail mới ở Entry 577 là `tests.test_admin_ui.ModelAdminContractTests.test_S3_AC2_every_own_admin_has_time_filter_or_hierarchy` — do `CorporateActionAdmin`/`AdjFactorAdmin` thiếu `date_hierarchy`. Đã thêm `date_hierarchy='ex_date'` cho cả 2 (`market_data/admin.py`), fail biến mất.

## 2. MIGRATE INGEST SANG FIELD SỐ (vnbroker 3.8.2)

- `ingest.fetch_corporate_actions` giờ instantiate `VCICompany` **một lần**, thử `corporate_actions()` trước; nếu trả `pandas.DataFrame` có đủ 7 cột bắt buộc (`action_type, ex_date, cash_amount, stock_ratio_pct, source_event_id, raw_title, parse_status, source`) ⇒ map thẳng sang dict pipeline.
- Mapping: `cash_amount → cash_amount_per_share`, `action_type/ex_date/record_date/payment_date/currency/source/source_event_id/parse_status` giữ nguyên; cờ `ambiguous_*` vẫn lấy từ parser trên `raw_title` (package contract không trả cờ).
- **Fallback**: nếu package cũ/không có method, trả DataFrame rỗng hoặc sai schema ⇒ log `STRUCTURED_UNAVAILABLE` rồi gọi `events()` + parser như cũ. AC7/idempotent, guard provider rỗng, golden 950+1.500 đều giữ nguyên.
- Test mới: `test_fetch_prefers_structured_fields` (assert `events()` **không** được gọi) + `test_structured_empty_falls_back_to_events`.
- Pipeline 6 module: **68/68 OK** (tăng từ 66 = 2 test mới).

## 3. FE BUILD

`cd packages/web && npm run build` → **exit 0**, `✓ built in 37.99s`, chỉ chunk-size warning pre-existing. `git status` sạch (dist không dính working tree).

## 4. Q1/Q2 — ĐÓNG BẰNG NGUỒN CHÍNH THỨC

Không có `TCBS_JWT_TOKEN` trên staging ⇒ không probe được TCBS. Thay bằng thông báo **VSDC chi nhánh TP.HCM (30/08/2024)** — `https://vsdc.vn/vi/ad/174349` (đối chiếu chéo `tinnhanhchungkhoan.vn`, `cotuc.vn`, `fireant.vn`):

- VNM, GDKHQ **24/09/2024**, ĐKCC 25/09/2024, thanh toán 24/10/2024.
- Tỷ lệ 24,5%/cp = **2.450 đồng**: *"Chi trả cổ tức đợt cuối năm 2023: 9,5% (950 đồng/cp)"* + *"Tạm ứng cổ tức đợt 1/2024: 15,0% (1.500 đồng/cp)"*.
- ⇒ 950 và 1.500 là **2 kỳ riêng biệt, không trùng provider**; golden 2.450 có bằng chứng độc lập. Các nguồn khác liệt kê đúng 2 dòng cùng ngày. **Q1/Q2 đóng.**

Hệ quả: reservation D1 trong `PHASE0_AUDIT.md` (golden chỉ là test cơ học) nay có xác nhận số tiền thật. Vẫn giữ rule "không double-count" và dedup theo `source_event_id`.

## 5. DEPLOY STAGING

- VPS `/opt/vninvest` pulled `origin/dev` → `ffe511d1c`; `bash scripts/deploy-staging.sh --verify` **OK** (compose config, API health, container chết/restart, worker chạy ổn).
- Deploy thật chỉ sau khi slice này merge (để VPS có thêm fix Admin + structured ingest).

**Deploy thật đã chạy sau PR #472** (`89f9bb06`): VPS pull dev → `bash scripts/deploy-staging.sh` **exit 0**, "Deploy xong"; `core-api/core-beat/core-worker*/frontend` đều Up (core-api healthy). Post-deploy verify:

```
[X] market_data/0008_dailyprice_adj_close_adjfactor_corporateaction
[X] market_data/0009_corporateaction_ambiguous_cash_pct_and_more
celery inspect registered -> data_ingest.tasks.sync_corporate_actions (3 workers)
GET https://docker.edusuccess.vn/api/health/ -> 200
```

## 6. FLAG

`CORPORATE_ACTIONS_ENABLED` vẫn default `False` trong code. Điều kiện kỹ thuật + dữ liệu đã đạt (baseline 0 regression, FE build xanh, Q1/Q2 đóng, re-probe 3.8.2 đạt). Việc bật flag là thay đổi env trên staging/production — **owner quyết**; không tự bật trong slice này.

**Lessons**: `[L-V01, L-V04, L-E04, L-E07, L-T01]` — mọi con số kèm lệnh; so baseline cùng cây/lần chạy; một lần đỏ không đủ kết luận; không báo PASS giả.
