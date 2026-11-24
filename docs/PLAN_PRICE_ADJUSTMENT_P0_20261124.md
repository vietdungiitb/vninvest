# PLAN P0 — Ngừng ghi `adj_close` nhân đôi (2026-11-24)

> Trạng thái: **đề xuất plan, chưa code**. Theo `PROPOSAL_..._REVISION1.md` §2 P0 và
> `DECISION_SSOT_OWNER_ITEMS_20261124.md`. Không đụng vnbroker, không đụng UI, không migrate DB.  
> **Lessons áp dụng: [L-E01, L-E06, L-P03, L-P06]**

## 1. Mục tiêu & bằng chứng

Dừng ngay việc ghi `DailyPrice.adj_close = close × Π factor` — hệ quả là `adj_close` thấp hơn
giá đã điều chỉnh thật 3,5× (TPB 04/01/2022: DB `5.159` vs CafeF adjusted `17.940`).

Bằng chứng đã tự mở:
- `packages/core/backend/src/market_data/corporate_actions/adjustment.py:97-102` — nhân factor rồi ghi.
- `docs/AUDIT_PRICE_ADJUSTMENT_VNINVEST_20261124.md:51-52` — F-2/F-3 double-adjust P0.
- `docs/PROPOSAL_VNBROKER_SSOT_PRICE_SOURCE_20261124.md:28-32` — định nghĩa P0.
- Test hiện tại `market_data/tests/test_corporate_action_adjustment.py:69-71,100-113` **giả định cũ**
  (assert `adj_close` không None sau `apply_adjustments`) ⇒ phải đổi kỳ vọng, không giữ assertion cũ.

## 2. AC (Given/When/Then)

| ID | Given | When | Then |
|---|---|---|---|
| AC-1 | flag mặc định `False` | gọi `apply_adjustments('VNM')` | trả `0`; **không** UPDATE `adj_close`/`is_adjusted` của bất kỳ dòng nào |
| AC-2 | flag bật tường minh (env/override cho test legacy) | gọi `apply_adjustments` | hành vi y hệt cũ, **kể cả vòng reset stale F1** (`adjustment.py:90-96`) — để test `:100-113` vẫn bảo vệ được F1 |
| AC-2b | flag tắt (mặc định) | dữ liệu có `adj_close` stale | **không reset** (freeze hoàn toàn); stale được xử lý ở P2 khi đổi nguồn — phải ghi rõ trong docstring |
| AC-3 | `DailyPrice.close` hiện có | sau P0 | **không đổi** (chỉ đính kèm doc/flag semantics = "provider-adjusted") |
| AC-4 | mọi test corporate action cũ | chạy lại | ở chế độ **flag OFF** (mặc định) assertion `adj_close` cũ phải đổi thành "không ghi"; ở chế độ **flag ON** (AC-2) assertion F1 `:100-113` được **giữ nguyên** — 0 assertion cũ ở chế độ flag OFF |
| AC-5 | `CafefDailyPrice` hiện có | chạy P0 | dùng để đối chiếu, **không** ghi đè `DailyPrice` |
| AC-6 | import module | chạy gate | không lỗi import; flag đọc qua `os.getenv` (pattern có sẵn tại `corporate_actions/ingest.py:43`) |

## 3. SCOPE / LIMIT / non-goals

**SCOPE:**
- `market_data/corporate_actions/adjustment.py` (thêm flag + **early-return ở ĐẦU HÀM `:83`** —
  freeze cả reset lẫn ghi, để AC-1 "0 UPDATE" đúng; nếu đặt ở `:97` thì vòng reset `:90-96` vẫn
  `save()` ⇒ AC-1 sai). Đây là điểm chốt thiết kế, không đẩy cho implementer.
- `market_data/tests/test_corporate_action_adjustment.py` (đổi expectation + thêm test flag-on/off).
- `CHANGELOG.md` / `CODE_CHANGE_AUDIT_LEDGER.md` / handoff (bàn giao).

**LIMIT:** 1 slice, ≤3 vòng sửa/bước. Không đụng `data_ingest/tasks.py`, `vnbroker_adapter.py`,
UI, schema DB, vnbroker.

**Non-goals:** không backfill, không đổi `close`, không xoá `AdjFactor`, không migrate, không
đụng `market_data/cafef/*` (giữ làm staging), không bump version vnbroker.

**Rollback:** đổi flag default về `True` (1 dòng) — không cần migrate, không mất dữ liệu.

## 4. Baseline gate (đo trước khi code)

| Gate | Lệnh | Baseline |
|---|---|---|
| BE test slice | `python manage.py test market_data.tests.test_corporate_action_adjustment` (trên VPS staging, cần `CORE_DATABASE_URL`, `DJANGO_DEBUG=1`) | **CHƯA CHẠY** — không có DB local; cấm Docker local |
| check-multi-agent | `node packages/web/scripts/check-multi-agent.mjs` (đường dẫn đúng theo `AGENTS.md:28`; lệnh cũ MODULE_NOT_FOUND) | **PASS** — tự chạy 2026-11-24: `0 lỗi, 0 trùng số migration — PASS`, exit 0 (có warning stale claim, không phải lỗi) |
| check-experiment-env | `node scripts/check-experiment-env.mjs` (đường dẫn đúng; `packages/web/scripts/...` không tồn tại) | **CHƯA CHẠY** |
| import check (không cần DB) | `python -m py_compile <file đổi>` + `python manage.py check` | **CHƯA CHẠY** — nên thêm, chạy được local |
| pre-push-gate | `node scripts/pre-push-gate.mjs` | **CHƯA CHẠY** |
| FE gates | `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run test` | **CHƯA CHẠY** (P0 không đụng FE) |

Không báo PASS cho gate chưa chạy. Thiếu DB ⇒ ghi `CHƯA CHẠY`, không suy ra.

## 5. TDD (đỏ trước)

1. Viết test AC-1/AC-2/AC-4: mock `DailyPrice.objects` (không cần DB) để chặn `save()`;
   flag-off assert `save` không gọi, flag-on assert `save` gọi. Chạy → **ĐỎ** đúng lý do "flag chưa có".
2. Implement: đọc flag `os.getenv('PRICE_ADJUSTMENT_WRITES_ENABLED','0') == '1'`; nếu tắt →
   `return 0` **ở đầu hàm `:83`** (freeze cả reset). Cập nhật docstring semantics của `close`.
3. Đổi expectation **flag OFF** tại `test_corporate_action_adjustment.py:70,71` (tối thiểu `:71`)
   → **XANH**. **Giữ nguyên 4 assertion F1** `:100,102,113,114` nhưng chuyển test đó sang chạy với
   **flag ON** để tiếp tục bảo vệ vòng reset stale (AC-2). Tổng 6 assertion liên quan trong file
   (25 `self.assert` toàn file), **không phải 11**. Không đụng assertion ở
   `test_ohlcv_bars_native_api.py:467-470,486` — chúng tạo `adj_close` trực tiếp, không qua
   `apply_adjustments` (ngoài scope P0).
4. Chạy lại slice + gate; nếu đỏ quá 3 vòng ⇒ ghi blocker, dừng.

## 6. Rủi ro / chốt sẵn (L-P03)

- Test cũ assert `adj_close` không None — **không được giữ**; nếu giữ, P0 xanh giả (L-E06).
- Flag phải mặc định **tắt**; bật chỉ trong test legacy có chủ đích (AC-2), không bật production.
- Owner chốt §1 ToS & §2 UI của `DECISION_...` **không** chặn P0 — P0 không gọi CafeF,
  không đổi UI. Không lấy lý do đó để trì hoãn P0.
- Working tree hiện **không sạch**: `M docs/CODE_CHANGE_AUDIT_LEDGER.md` + 3 file doc mới
  (audit/decision/plan) chưa commit. Trước khi claim P0 phải commit riêng phần docs hoặc tách rõ
  hunks — không lẫn vào code slice. Không đụng `merge`/`rebase` trong lúc này.

## 7. Next steps

B3 audit độc lập → B4 đồng thuận → B5 claim (agent = tên branch `feat/price-adjustment-p0`) →
B6 TDD → B7 gate (có DB) → B8 re-audit → B9 bàn giao + ledger Entry mới.

Sau P0 mới lập P1 (vnbroker `daily_bars`) — không gộp slice.
