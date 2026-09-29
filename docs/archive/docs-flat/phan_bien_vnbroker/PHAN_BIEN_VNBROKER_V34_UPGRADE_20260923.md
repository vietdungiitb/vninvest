# PHẢN BIỆN ĐỘC LẬP — IMPLEMENTATION_PLAN_VNBROKER_V34_UPGRADE_20260923

**Ngày**: 2026-09-23 — Đối tượng: `docs/IMPLEMENTATION_PLAN_VNBROKER_V34_UPGRADE_20260923.md`
**Phương pháp**: đọc file thật cả hai repo + `git show v3.4.0:` (authoritative, thay vì venv),
grep toàn bộ usage `vnbroker` trong BE. Không đổi code.

> **Tóm tắt 5 findings nghiêm trọng nhất**
> C1. Tiền đề plan đã LỖI THỜI: `requirements.txt:29` KHÔNG còn pin v1.1.0 — đã bump lên
> `@v3.4.0` SHA `1ff04e60` từ Entry 161 (commit `c36acb82`). S1/B1 "bump version" trong plan là
> việc đã xong — Phase A thực chất chỉ còn S2 (3 import) + S4 (rebuild) + S5 (smoke).
> C2. Bằng chứng "live-verify bằng vnbroker/.venv (HEAD=v3.4.0)" không đáng tin:
> `.venv` cài vnbroker **3.1.0**, còn repo HEAD là dev (code sau tag). Mọi kết luận đã được
> kiểm lại bằng `git show v3.4.0:` — đúng, nhưng S4 phải smoke lại trên image đã pin.
> C3. Chế độ lỗi bị mô tả sai: không phải crash (`AttributeError`) mà là **mất dữ liệu thầm lặng**
> (adapter bọc `try/except Exception` trả `{}`) — smoke test PHẢI assert non-empty.
> C4. Phase B đánh giá thiếu: SSI cần key ngay cả khi xem giá + mapping interval + thứ tự failover
> — cần ma trận tương thích riêng, không chỉ gate credential.
> C5. Không phát hiện import break nào ngoài 3 dòng plan đã nêu (quét 16 usages) — phần này plan đúng.

---

## A. Bản đồ xác minh (plan ⇄ code thật)

| Ref plan | Thực tế verified | Kết luận |
|---|---|---|
| §1/`requirements.txt:29` pin v1.1.0 | File hiện tại: `...@1ff04e60` (v3.4.0) — do Entry 161 | ❌ C1 (tiền đề stale) |
| B2 `adapter.py:988` → `api.company` | `from vnbroker import Company` @988, dùng `Company(symbol=, source=)` @989; v3.4.0 `__all__` không có Company, `api/company.py::Company` có `overview/shareholders/officers/events`, `__init__(source, symbol, ...)` nhận kwargs | ✅ break thật, fix đúng |
| B3 `adapter.py:1065` → `api.financial` | Dùng `Finance(symbol=, source=)` @1066 + `ratio(period='quarter')` @1071; v3.4.0 `api/financial.py::Finance` có `ratio/income_statement/balance_sheet`, init nhận kwargs | ✅ break thật, fix đúng |
| B4 `stock_mgmt_native_views.py:2192` → `api.news` | Dùng `News(source='KBS').by_symbol(symbol)` @2193; v3.4.0 `api/news.py::News` có `by_symbol/latest`, init `(source='auto', ...)` | ✅ break thật, fix đúng |
| §4.2 `Vnbroker/Listing/Quote/DNSEQuote/DNSEClient` OK | `Vnbroker().stock()` @adapter:164-173; `Listing` @323; explorer vci/kbs `Quote` + `fetch_multiple` **vẫn classmethod** @v3.4.0 (gọi trên class @adapter:486 an toàn, coroutine đã handle @493-497); `history(symbol,start,end,interval)` khớp; `DNSEQuote(symbol,api_key,api_secret,show_log)` @adapter:908-913 khớp init v3.4.0; `DNSEClient` khớp (xác minh Entry 154) | ✅ đúng hết (kể cả nghi ngờ fetch_multiple — đã tự bác) |
| §4.3 quirk DNSE `Quote` alias + daily-guard | `_load_quote_class` dùng `getattr(module,'Quote')` @adapter:310-313 (DNSE chỉ có `DNSEQuote` cả 2 version); `_DAILY_HISTORY_ALLOWED_SOURCES=('VCI','KBS')` @adapter:23 | ✅ pre-existing đúng |
| Diff 38 commits / 370 files / +51083 | `rev-list --count v1.1.0..v3.4.0`=38; diffstat `370 files, 51083/4809` | ✅ khớp |
| Deps +`websockets>=12.0`, py>=3.10, image py3.13 | `git show v3.4.0:pyproject.toml` khớp; `Dockerfile:10` `PYTHON_VERSION=3.13` | ✅ đúng |
| `api_version 2026-05-07` (R2) | Tồn tại trong `connector/dnse/client.py` @v3.4.0 | ✅ rủi ro thật |
| A5 `max_concurrency` batch | `fetch_multiple(..., max_concurrency=24, ...)` @v3.4.0 `api/quote.py`; adapter gọi @486-492 chưa truyền | ✅ có cơ sở tune |
| Quét usage toàn BE (16 hits) | Runtime chỉ còn 3 import break trên; còn lại (`broker/ssi.py`, `broker/tcbs.py`, compat, tests) đã viết cho v3.x + lazy import | ✅ không sót |

## B. CONTRADICTIONS

| # | Plan | Thực tế | Tác động & fix |
|---|---|---|---|
| C1 | §1/§6-S1/B1/§10: "App pin v1.1.0", bump là việc phải làm | `requirements.txt:29` đã là `@v3.4.0` SHA `1ff04e60` (Entry 161, `c36acb82`) | Plan phải rebase Rev.1: gạch S1/B1, DoD-1 sửa thành "verify pin". Phase A còn S2+S4+S5. Mức HIGH (quyết định sai phạm vi). |
| C2 | §1 dòng 6 + B2/B3/B4: "live-verify bằng vnbroker/.venv (HEAD=v3.4.0)" | `.venv` cài **3.1.0**; repo HEAD là dev (code sau tag, gồm ISSUE-00 typing + SSI explorer chưa release ở 3.4.0?) — không phải code tag v3.4.0 | Kết luận đúng (tôi kiểm lại bằng tag) nhưng evidence yếu. **Fix**: chạy lại 3 check import + smoke trên checkout sạch tag (hoặc image sau S4) trước khi merge. Mức MED. |
| C3 | B2/B3/B4: "→ AttributeError (live test)" | Thực tế là `ImportError` lúc import, và app bọc `try/except Exception` trả `{}/{}/[]` (adapter:1048-1055 mẫu) → **câm lặng mất dữ liệu**, cache SSOT trống, không crash | Smoke §7 PHẢI assert **non-empty** (financials FPT ≠ {}, news ≠ []) chứ không chỉ "không crash". S2+S4 phải atomic 1 commit (không rebuild trước khi sửa import). Mức MED (ảnh hưởng DoD + thứ tự). |
| C4 | Phase B: "chỉ cần gate credential + map source" | Thiếu: (a) mapping interval adapter ('1D'...) vs SSI explorer (30m+...); (b) SSI xem giá cũng cần key (khác VCI/KBS keyless) — failover order phải quyết (plan B1 nói fallback-cuối, khớp AUTO v3.4, nhưng chưa ghi rõ); (c) `_SUPPORTED_PROVIDER_SOURCES` chạm cả realtime/intraday/daily | Phase B cần ma trận tương thích riêng trước khi code. Không block Phase A. Mức LOW-MED. |
| C5 | §9-R4 "Tag v3.4.0 public ở cùng remote" | Repo **private** — token vẫn bắt buộc (may là flow secret sẵn có) | Sửa wording; gate S4 thêm verify `pip install` log đúng SHA. Mức LOW. |

## C. GAPS / RISKS bổ sung

- **G1**: `.venv` local (vnbroker 2.0.0 HỎNG — `ImportError BrokerAPIError`) lệch image (v3.4.0): test BE local chạm đường vnbroker thật có thể cho kết quả khác container. Khuyến nghị reinstall venv từ SHA pin sau S1-rebase (ghi vào S4).
- **G2**: S3 guard DNSE "optional" — vị trí đúng là quanh `DNSEQuote(...)` @adapter:908-913 (plan ghi :905, lệch 3 dòng, không sao). Nên làm luôn (rẻ) vì DNSE thiếu key hiện raise ValueError thô.
- **G3**: Rollback "1 commit sạch" đúng (không migration), nhưng image đã build + tag SHA cũ cần giữ lại để rollback nhanh — ghi rõ giữ image `core-api:pre-v34`.

## D. Verdict Phase A

**APPROVE có điều kiện (Rev.1)**: thực chất chỉ còn **S2 (sửa đúng 3 import theo B2/B3/B4) + S4 (rebuild image) + S5 (smoke)** — S1 đã xong, S3 nên gộp, A5/B/C/D để pha sau.
Điều kiện bắt buộc:
1. S2 + S4 atomic trong **1 commit** (không để image v3.4.0 chạy với import cũ → mất dữ liệu câm lặng).
2. Smoke assert **non-empty** cho financials/news/company (C3), chạy trên image mới (C2).
3. Verify `pip show vnbroker` trong image == v3.4.0 + reinstall `.venv` local (G1).
4. Cập nhật plan Rev.1 (gạch S1/B1, sửa R4 wording) + ledger trước khi merge.
Rủi ro sau điều kiện: **THẤP**. Không blocker.

## E. Quality gates (của phản biện này)

- Mọi khẳng định qua `git show v3.4.0:` / đọc file thật kèm line; không chạy code (venv local sai version).
- Không phát hiện thêm usage break ngoài 3 dòng (quét 16 hits toàn `src/`).
