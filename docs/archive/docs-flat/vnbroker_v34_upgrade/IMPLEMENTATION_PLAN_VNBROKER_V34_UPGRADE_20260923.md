# Kế hoạch nâng cấp vnbroker v1.1.0 → v3.4.0 (tương thích + tận dụng tối đa)

> **Rev.1 (2026-09-23, sau phản biện Entry 162):** S1/B1 (bump pin) ĐÃ XONG từ Entry 161
> (`requirements.txt:29` = `@v3.4.0` SHA `1ff04e60`). Phase A còn S2+S3+S4+S5.
> R4 wording sửa: repo private — token bắt buộc.

- **Ngày**: 2026-09-23 — Trạng thái: **chờ phê duyệt**
- **Nguồn evidence**: CHANGELOG vnbroker (`C:\Mujoco Projects\vnbroker\CHANGELOG.md`),
  tags remote `v3.4.0` (4587fe7b), diff v1.1.0→v3.4.0 (38 commits, 370 files, +51083/-4809),
  live inspect API bằng `vnbroker/.venv` (PYTHONPATH = repo, HEAD = v3.4.0 dev).
- **Liên hệ plan song song**: `docs/IMPLEMENTATION_PLAN_BROKER_MANAGEMENT_20260923.md`
  (Broker Hub SSI/TCBS/DNSE) — plan đó giả định vnbroker v3.x → **nâng cấp này là tiền đề bắt buộc**.

## 1. Tóm tắt (đọc để quyết)

App đang pin `vnbroker @ git+...@v1.1.0` (`packages/core/backend/requirements.txt:29`).
vnbroker đã ra **v3.4.0** (2026-09-23) — một bước nhảy 3 major: bỏ PAT/Gateway (3.0), thu hẹp
nguồn còn KBS/VCI/TCBS/DNSE (3.1), thêm **broker lane SSI native + TCBS** (3.2), retail/UI (3.3),
và **SSI swap parity P0-P4** (3.4).

**Phân tích tương thích (đã live-verify từng import/signature): phần lớn chỉ có 3 dòng import phải sửa.**
Không có breaking change về signature phương thức app đang dùng. Rủi ro nâng cấp THẤP.

**Giá trị nhận được**: 1 provider realtime mới (SSI) + source router AUTO credential-aware mới
→ tăng độ phủ/fallback dữ liệu; `fetch_multiple` batch nhanh hơn (max_concurrency adaptive);
nền cho Broker Hub đa-broker (SSI FastConnect v3, TCBS iFlash, 7 lệnh điều kiện FCO, streaming order);
retail facade (vàng SJC/BTMC + tỷ giá VCB); hàng loạt fix robustness (RLock deadlock cold-start,
Trading.FALLBACK_MAP, kwargs-filtering theo provider, parser InstrumentType fix ETF 8 ký tự).

## 2. Phạm vi hiện tại — bản đồ sử dụng vnbroker của app

| File app | Dòng | Import / dùng | Ghi chú |
|---|---|---|---|
| `packages/core/backend/src/market_data/vnbroker_adapter.py` | 164 | `from vnbroker import Vnbroker` | OK (lazy proxy giữ nguyên) |
| 同 | 323 | `from vnbroker.api.listing import Listing` | OK |
| 同 | 310 | `import_module('vnbroker.explorer.<src>.quote')` | OK (vci/kbs/dnse tồn tại) |
| 同 | 906 | `from vnbroker.explorer.dnse.quote import DNSEQuote` | OK |
| 同 | **988** | `from vnbroker import Company` | **BREAK** |
| 同 | **1065** | `from vnbroker import Finance` | **BREAK** |
| `packages/core/backend/src/market_data/stock_mgmt_native_views.py` | **2192** | `from vnbroker import News` | **BREAK** |
| `packages/core/backend/src/user_workspace/vnbroker_dnse_compat.py` | 43 | `from vnbroker.connector.dnse.client import DNSEClient` | OK (signature + methods giữ nguyên) |
| `tests/examples/vci_perf_benchmark.py`, `tools/dnse_ohlcv_benchmark.py` | — | `vnbroker.explorer.vci.quote`, `core.utils.async_client` | OK (ngoài runtime app) |

Người tiêu thụ ảnh hưởng bởi 3 import break (đều đi qua `vnbroker_adapter` nên chỉ cần sửa gốc):
- `fetch_company_info` → `stock_mgmt_native_views.py:1619-1620` (company profile endpoint)
- `get_company_financials_response` (cache SSOT 12h) → `stock_mgmt_native_views.py:3139`,
  `portfolio_analytics_views.py:1557/1620/1752`, screener fundamentals (`screener_helpers.py:318`)
- `News(...).by_symbol` → `stock_mgmt_native_views.py:2193` (kbs news)

## 3. Changelog v3.4.0 tóm tắt (evidence)

| Phiên bản | Ngày | Nội dung chính (từ CHANGELOG.md) |
|---|---|---|
| 3.4.0 | 2026-09-23 | **SSI Swap Parity P0-P4**: source=SSI dùng qua lại với KBS/VCI cho `quote.history` (mở 30m, cửa sổ `HH:MM:SS`, `fetch_multiple` batch), `listing`, `trading.price_board` (trading_date + concurrent); SSI T2 mới (`indices/securities/screener`), T3 realtime (`intraday_ticks/depth_snapshot/session_snapshot/session_flags`); AUTO credential-aware (SSI vào candidates khi có key, failover cuối; `VNBROKER_SSI_AUTO_PRIMARY=1` opt-in primary); **fix deadlock cold-start** (`Lock`→`RLock`, `core/source_router.py`); fix `Trading.FALLBACK_MAP`; `_call_with_fallback` bắt thêm `UnsupportedMethodError`; lazy-auth SSI. 40 tests mới. |
| 3.3.0 | 2026-09-22 | Retail facade (vàng SJC/BTMC, tỷ giá VCB), Unified UI (`vnbroker/ui/`), `InstrumentType` str-Enum + dedup `get_asset_type`, kwargs-filtering `Quote.history/intraday/price_depth` theo signature provider. |
| 3.2.0 | 2026-09-22 | **SSI broker lane native** (không dep `ssi-sdk`): auth (market-only/OTP/Smart-OTP-push/refresh), market data OHLC 8 timeframe, brokerage (balance/positions/PPMMR/maxBuySell/order), write ký RSA-SHA256 stdlib (`dry_run=True` mặc định), **7 lệnh điều kiện FCO** (GTD/Stop/Stop-Limit/Trailing/Trailing-Limit/OCO/BullBear), streaming WebSocket (`websockets>=12.0`), `SSIBrokerClient` đăng ký `BrokerRegistry`. |
| 3.1.1 | 2026-06-22 | Xoá SSI/VNDirect broker scaffolds (chưa triển khai thật) — **chỉ còn TCBS trong BrokerRegistry** (SSI quay lại native ở 3.2). |
| 3.1.0 | 2026-06-18 | Xoá MSN/FMP connector. `SUPPORTED_SOURCES` thu hẹp: **chỉ KBS, VCI, TCBS, DNSE** (MSN/FMP/GATEWAY/AUTO bị loại). |
| 3.0.0 | 2026-06-18 | Bỏ hoàn toàn vninvest-sdk/PAT/Gateway; `Vnbroker.__init__()` bỏ `pat_key`/`gateway_url`; default source `AUTO`→`KBS`. |
| 2.0.0 | 2026-06-17 | Multi-source + source router AUTO failover; TCBS broker lane; bỏ Screener (cũ). |

Diff dependencies v1.1.0→v3.4.0 (`git diff v1.1.0 v3.4.0 -- requirements.txt`): **chỉ thêm `websockets>=12.0`**.
`requires-python = ">=3.10"`; app Dockerfile dùng `python:3.13-slim` (`packages/core/backend/Dockerfile:10`) → **tương thích**.

## 4. MA TRẬN TƯƠNG THÍCH (audit, kèm bằng chứng live rating)

### 4.1 BREAKING — phải sửa (3 dòng + bump version)

| # | App location | Hiện tại | Phải thành | Bằng chứng |
|---|---|---|---|---|
| B1 | `packages/core/backend/requirements.txt:29` | `...@v1.1.0` | `...@v3.4.0` | tag `v3.4.0` tồn tại trên origin (`git ls-remote --tags origin` → `4587fe7b`) |
| B2 | `vnbroker_adapter.py:988` | `from vnbroker import Company` | `from vnbroker.api.company import Company` | `git show v3.4.0:vnbroker/__init__.py` — `__all__` chỉ còn `[Vnbroker, connector, analytics, UnifiedRegistry, INDICES_INFO, ...]`; `from vnbroker import Company` → `AttributeError` (live test) |
| B3 | `vnbroker_adapter.py:1065` | `from vnbroker import Finance` | `from vnbroker.api.financial import Finance` | như B2 (live test `AttributeError`) |
| B4 | `stock_mgmt_native_views.py:2192` | `from vnbroker import News` | `from vnbroker.api.news import News` | như B2 (live test `AttributeError`) |

### 4.2 COMPATIBLE — verify sống, KHÔNG sửa

| App usage | Kết quả | Bằng chứng (live inspect, PYTHONPATH=vnbroker) |
|---|---|---|
| `from vnbroker import Vnbroker` | ✅ OK | proxy lazy giữ nguyên; `Vnbroker(symbol, source, show_log)` signature mới vẫn nhận `source` |
| `from vnbroker.api.listing import Listing` | ✅ OK | `all_symbols/symbols_by_exchange/symbols_by_group/symbols_by_industries` đều tồn tại; `Listing(source=...)` có |
| `import_module('vnbroker.explorer.{vci,kbs}.quote')` + `Quote` | ✅ OK | `Quote.history(start,end,interval,show_log)`, `intraday(symbol,page_size)`, `fetch_multiple(symbols,start,end,interval,show_log)` signatures khớp |
| `from vnbroker.explorer.dnse.quote import DNSEQuote` | ✅ OK | `intraday(date,get_all,page_size,show_log)`, `history(start,end,interval)` khớp |
| `DNSEQuote(symbol, api_key, api_secret, ...)` bắt buộc key | ✅ Không đổi | v1.1.0 cũng `raise ValueError` khi thiếu key (`git show v1.1.0:.../dnse/quote.py`) — **không phải regression** |
| `from vnbroker.connector.dnse.client import DNSEClient` | ✅ OK | `__init__(api_key, api_secret, base_url, show_log, ...)` + `get_accounts/get_balances/get_order_history` khớp |
| `Company(symbol, source)` / `Finance(symbol, source)` / `News(source).by_symbol` | ✅ OK (đổi import path) | class tồn tại tại `api/company.py`, `api/financial.py`, `api/news.py`; method `overview/officers/shareholders/events`, `ratio/income_statement/balance_sheet`, `by_symbol` khớp; KBS provider có `by_symbol` |
| Nguồn dữ liệu app dùng (VCI/KBS/DNSE) | ✅ OK | v3.4.0 `SUPPORTED_SOURCES = KBS, VCI, TCBS, DNSE (+SSI)` |
| `tests/examples` + `tools/` (ngoài runtime) | ✅ OK | import path không đổi |

### 4.3 Lưu ý 2 quirk cũ (KHÔNG regression — không block)

- `_load_quote_class('DNSE')` sẽ `AttributeError` vì `explorer/dnse/quote.py` không export alias `Quote`
  (chỉ có `DNSEQuote`) — **giống v1.1.0**, là quirk pre-existing. DNSE không nằm trong
  `_DAILY_HISTORY_ALLOWED_SOURCES` nên daily path an toàn; realtime path đã catch → warning.
- `fetch_multiple` của DNSE quote không có (vci/kbs có) — giống v1.1.0, không hồi quy.

## 5. Lợi ích tận dụng v3.4.0 (theo pha, tăng dần rủi ro)

### Phase A (bắt buộc, rủi ro thấp) — Nâng cấp + vá 3 import
- A1 bump version pin, A2 sửa 3 import, A3 build/rebuild image core, A4 smoke test các gate cũ (listing,
  realtime price, price board batch, financials SSOT, DNSE compat) — đúng bằng phạm vi §2.
- A5 (cơ hội 0-rủi-ro): **vật `_load_quote_class` đổi ưu tiên `max_concurrency`/`adaptive_concurrency`** khi gọi
  `fetch_price_board_snapshots_batch` (`vnbroker_adapter.py:486-499`) để tận dụng batch mới nhanh hơn.

### Phase B (opt-in, cần credential) — Thêm SSI provider cho market data
- B1 bổ sung `SSI` vào `_SUPPORTED_PROVIDER_SOURCES`/`_INTRADAY_FALLBACK_SOURCES`
  (`vnbroker_adapter.py:22-49`) với gate credential:
  chỉ dùng khi `VNBROKER_BROKER_SSI_API_KEY`+`..._SECRET` có (self-heal theo AUTO credential-aware của v3.4).
- B2 map `client_SSI` source → `vnbroker.explorer.ssi` (quote/live) → dùng cho
  `fetch_realtime_price`, `fetch_price_board_snapshots_batch`, `fetch_intraday_tape`
  (SSI lợi thế: `intraday_ticks/depth_snapshot` mới).
- B3 tận dụng `quote.history` interval `30m` mới + indices/securities (foreign room) cho
  các view index/foreign-ownership trong `stock_mgmt_native_views.py`.

### Phase C (nền tảng cho Broker Hub) — SSI broker lane + TCBS streaming
- **Tiền đề trực tiếp cho `docs/IMPLEMENTATION_PLAN_BROKER_MANAGEMENT_20260923.md`**:
  `SSIBrokerClient` (FastConnect v3, RSA, FCO, stream order) + TCBS iFlash + WebSocket đều đã có trong 3.2/3.4
  → không tự viết SDK. Broker Hub chỉ cần adapter wrap + normalize.
- Cân nhắc sau: Broker Credential vault đã vạch trong plan Broker Hub, không làm ở plan này.

### Phase D (tuỳ chọn) — Retail facade & nâng cao screener
- D1 `vnbroker.ui`/retail (SJC/BTMC/VND) → endpoint tham chiếu vàng/tỷ giá.
- D2 screener VCI/KBS/SSI như nguồn universe bổ sung cho screener native (hiện screener native tính từ DB).

## 6. Các bước triển khai (Slice)

| # | Việc | File | Gate |
|---|---|---|---|
| S1 | ~~Bump pin `@v1.1.0` → `@v3.4.0`~~ XONG (Entry 161) — chỉ verify | `packages/core/backend/requirements.txt:29` | `grep` pin + `pip show vnbroker` trong image |
| S2 | Đổi 3 import (B2/B3/B4) | `vnbroker_adapter.py:988,1065`, `stock_mgmt_native_views.py:2192` | `import vnbroker_adapter` OK |
| S3 | ~~Thêm guard DNSE~~ BỎ — tests `test_vnbroker_adapter_history.py` lock contract
"key None vẫn tiến tới DNSEQuote (mock/env fallback)"; guard skip-sớm làm 12 tests đỏ.
Giữ behavior cũ (ValueError đã được bọc → `[]`). | `vnbroker_adapter.py` (không đổi) | 18/18 xanh |
| S4 | Rebuild image core + san bằng tầng test | `docker compose build core-api` | container import OK |
| S5 | Smoke test runtime thật (§7) | adapter functions | kết quả mong đợi |
| S6 | (Phase A5) tune `fetch_price_board_snapshots_batch` params tận dụng batch mới | `vnbroker_adapter.py:486-499` | throughput đo được |
| S7 | (Phase B) SSI provider opt-in + tests | `vnbroker_adapter.py`, tests | test mới cho gate credential |
| S8 | Ledger + AGENTS.md + docs plan cập nhật | `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `AGENTS.md` | — |

## 7. Verification / Quality gates

- `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run i18n:scan` (FE không đụng — nhưng giữ nguyên chuẩn)
- BE: `manage.py check` 0; chạy lại test suite có vnbroker adapter:
  `test_vnbroker_adapter_history.py`, `test_vnbroker_daily_history_guard.py`,
  `test_backfill_tasks.py`, `test_soc_tasks.py` (đều mock `vnbroker.explorer.*` → không đổi).
- Smoke live (docker): `fetch_listing_symbols(KBS/VCI)`, `fetch_realtime_price`,
  `fetch_price_board_snapshots_batch`, `get_company_financials_response('FPT')`,
  `fetch_company_info('FPT')`, kbs news endpoint, `build_dnse_client` + `get_accounts` (nếu có key DNSE), `fetch_intraday_tape_history` (nếu có key).
- So sánh output DB trước/sau nâng cấp cho 2 phiên EOD (daily backfill + price board hoạt động đúng).

## 8. Rollback

- Revert `requirements.txt:29` về `@v1.1.0` + revert 3 dòng import + rebuild image — không có migration,
  không đụng DB, rollback sạch 1 commit.

## 9. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| ABC các API ngầm của vnbroker đổi hành vi không nằm trong signature (e.g. dtype/order cột DataFrame) | Trung bình | Smoke test §7 với data thật trước khi cắt; giữ fallback sẵn có (listing seed, source fallback chain) |
| DNSE OpenAPI `api_version` mới mặc định `2026-05-07` (`connector/dnse/client.py`) đổi shape response | Trung bình | `vnbroker_dnse_compat.py` map nhiều key fallback (đã có); test read-only với key thật |
| `websockets>=12.0` mới được pip tải trong image | Thấp | Chỉ tăng build time; không dùng ở runtime hiện tại (dành stream Phase C) |
| Phiên bản pin git cần token clone (`VNBROKER_GITHUB_TOKEN`) | Thấp | Repo **private** — token bắt buộc; dùng Docker build secret sẵn có; gate S4 verify log đúng SHA |

## 10. DoD

- [x] `requirements.txt` pin `@v3.4.0` SHA (XONG Entry 161); 3 import đã sửa (Entry 163);
  `import vnbroker_adapter` + app import OK.
- [x] `manage.py check` 0; test BE broker/market suites xanh (119 OK Entry 166);
  container core rebuild healthy (Entry 164).
- [x] Smoke §7 pass **với assert non-empty** 6/6 local + container (Entry 163-164).
- [x] Phase A5 (batch mc=8, đo 6.9s vs 9.3s/16.2s) + Phase B (SSI opt-in + gate + 8 tests) — Entry 165.
- [x] Phase C (adapter hợp nhất + 7 tests) + Phase D1 (retail endpoint + 5 tests) — Entry 166.
  Phase D2 (screener universe) HOÃN có lý do (feature độc lập, backlog riêng).
- [x] i18n/lint/tsc xanh ở các đợt chạm FE (B1.3/B2.3/B3.3).
- [x] Ledger cập nhật (Entry 162-166).