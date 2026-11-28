# Audit độc lập luồng giá sau Anchor A — 2026-11-28

**Auditor**: subagent read-only, đọc `origin/dev@394d4e04c`; **không chạy test/gate** ⇒ mọi trạng thái gate trong báo cáo này là **CHƯA CHẠY** (không suy diễn).
**Verdict**: **NEED_REVISION** — 8 findings, trong đó F1–F3 là P0 chặn mọi việc bật flag.

| ID | Mức | file:line | Thực tế | Tác động | Fix |
|---|---|---|---|---|---|
| **F1** | P0 | `pricing.py:38-49,60-73`; `stock_mgmt_native_views.py:4213-4223,4241-4256,4288-4293`; `chartAdapter.js:47-52,80-93` | Consumer vẫn nhận adjusted qua `price_source==='cafef'`; sau Anchor A không còn dòng cafef, chỉ `vnbroker_fallback` | Bật flag vẫn trả raw close; `/ohlcv` báo `adjusted=False`; FE gán sai nhãn; Phase 3 `adj_factor≠1` sẽ làm BE/FE lệch | Gate theo `adj_close`/`adj_factor`/`adj_basis`, bỏ literal cafef; cập nhật 2 test contract |
| **F2** | P0 | `tasks.py:722-728,788-806` | Guard ingest chỉ skip `cafef`/`unmapped_cafef`; không skip `vnbroker_fallback` | Backfill ghi `close` mới nhưng giữ `adj_close`/`adj_factor` cũ ⇒ vi phạm `factor_close_mismatch`, trộn basis | Guard mọi dòng có `adj`/`adj_basis`; nếu bắt buộc đổi close thì recompute cùng transaction |
| **F3** | P0 | `anchor_a_relabel.py:16-20,48-53`; `models.py:94-97`; `adjustment.py:153,171-173` | `base_as_of`/`adj_basis` có schema nhưng **không ai ghi**; recompute dùng mọi `ex_date > row.date` | Dòng đã phản ánh event vẫn bị nhân factor ⇒ **double-adjust** | Backfill `base_as_of=T0`/`adj_basis='anchor_provider'`; T+0 ghi đồng thời; recompute chỉ `ex_date > base_as_of` |
| F4 | P1 | `corporate_actions/ingest.py:236-258`; `models.py:197`; `adjustment.py:141-169`; `tasks.py:3792-3807` | Correction có `source_event_id` mới không bị supersede; upsert commit xong mới apply; ValueError không rollback event | Cùng ex_date ⇒ factor nhân đôi; sau halt vẫn cộng sai; report `created=0` sai sự thật | Supersede mọi bản cùng `(symbol, ex_date, action_type)`; bọc upsert+apply trong `atomic()` |
| F5 | P1 | `vnbroker_materializer.py:155-160,192,243-248` | `yesterday` là 1 date toàn cục, không phải phiên gần nhất từng symbol; fallback lấy close hôm nay | Thứ Hai/sau lễ, mã tạm ngừng/mới niêm yết ⇒ trần/sàn lệch ±7% | Query per-symbol `date__lt=today order_by('-date')`, đọc qua `effective_close` (đã fix hàm thứ nhất ở PR #606) |
| F6 | P1 | `stock_mgmt_native_views.py:2068` vs `:4269-4273,4617-4629` | Hai flag độc lập (`PRICE_ADJUSTED_DISPLAY` / `CORPORATE_ACTIONS_ENABLED`) cùng quyết định basis | Bật A thì `/ohlcv` vẫn báo chưa điều chỉnh; bật B tắt A thì FE không scale | Một `price_basis` SSOT trả trong cả 2 contract |
| F7 | P1 | `integrity.py:108-110,143-158`; `check_price_integrity.py:21,28`; `tasks.py:3525,3539` | Coverage tính trên toàn bộ dòng collect; nightly gọi `audit_rows` không truyền `min_coverage` | `--min-coverage 1` fail oan do ~936 mã legacy; audit tự động không đo coverage | Scope coverage theo tập anchor/per-symbol; truyền `min_coverage` từ beat |
| F8 | P2 | `tasks.py:3668,3723,3732,3762` | Rebase/drift nightly vẫn query `price_source='cafef'` | Sau relabel trả 0 dòng ⇒ nightly im lặng no-op | Chọn theo `adj_close IS NOT NULL`/`adj_basis='anchor_provider'` |

## Thứ tự xử lý đề xuất
F1 + F2 + F3 trước khi bật bất kỳ flag (P0) → F4/F5/F6 → F7/F8. Mỗi fix là slice riêng, TDD fail-before + gate thật, **không báo PASS thay cho gate chưa chạy**.

## Liên quan
`SSOT_ADJUSTMENT_DESIGN_REV2_20261127.md` D-01/D-06; `PLAN_PHASE3_20261128.md`; PR #606 đã fix một phần F5 (hàm `fetch_realtime_tickers_from_vnbroker`).
