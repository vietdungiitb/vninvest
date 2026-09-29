# Nghiên cứu codebase vnbroker: điểm nâng cấp so với v1.1.0 & kế hoạch tiêu thụ bản GitHub mới

- **Ngày**: 2026-09-23
- **Phạm vi**: `C:\Mujoco Projects\vnbroker` (codebase nguồn) vs phiên bản `vninvest` đang dùng
- **Phương pháp**: đọc code + diff git tĩnh (`v1.1.0..HEAD`), đối chiếu doc ↔ code, trace surface `vninvest` dùng qua adapter. Chưa chạy test/live.
- **Kết luận 1 dòng**: `vninvest` pin `vnbroker@v1.1.0` trong khi codebase local đã ở `3.3.0` + `v3.4-dev`; khoảng cách ~34 commits / 328 files; rào cản lớn nhất là **chưa có tag/release GitHub cho 3.2.0/3.3.0/3.4** nên không thể bump an toàn ngay.

---

## 1. Hiện trạng đã xác minh (kèm file:line)

| Bên | Thực tế | Bằng chứng |
|---|---|---|
| `vninvest` đang pin | `vnbroker @ git+https://x-access-token:${VNBROKER_GITHUB_TOKEN}@github.com/vietdungiitb/vnbroker.git@v1.1.0` | `vninvest/packages/core/backend/requirements.txt:29` |
| Cài trong Docker | Builder mount secret `vnbroker_github_token`, rewrite URL qua `insteadOf`, `pip install -r requirements.build.txt` | `vninvest/packages/core/backend/Dockerfile:23-36` |
| `vnbroker` local | `version = "3.3.0"`, `requires-python >=3.10`, thêm `cryptography`, `websockets>=12.0`, `httpx[http2]`, `tenacity`, `fake_useragent` | `vnbroker/pyproject.toml:7,14,34-49` |
| Kênh version thật | `VERSION_REQUIREMENTS {"3.3.0": ...}`, `PYTHON_VERSION_SUPPORT {"3.3.0": [...]}`; đã fix lỗi so sánh metadata `1.0.x` vs tag `3.x` (chỉ so GitHub) | `vnbroker/config.py:62-81`, `vnbroker/CHANGELOG.md:180-194` |
| Tags GitHub | Chỉ `v1.1.0`, `v3.4.0-core`, `internal-core-1.0.0` — **không có `v3.2.0/v3.3.0`** | `git ls-remote --tags origin`, `git tag --list` (chạy tại `vnbroker/`) |
| Nhánh | `main=c97f4d4` (thời rename vnstock→vnbroker, tương đương 3.1.x), `dev=dbcd81a` (v3.4-dev, đã push `origin/dev`); lệch `origin/main..origin/dev` = 216 files `+25225/-3910` | `git branch -vv`, `git log origin/main/dev`, `git diff --stat origin/main..origin/dev` |
| Tổng diff | `v1.1.0..HEAD` = 34 commits, `328 files, +45453/-4804` | `git rev-list --count v1.1.0..HEAD`, `git diff --stat v1.1.0..HEAD` |
| Surface `vninvest` dùng | `Vnbroker().stock()`, `vnbroker.api.listing.Listing`, `vnbroker.explorer.dnse.quote.DNSEQuote`, `from vnbroker import Company/Finance/News`, `vnbroker.connector.dnse.client.DNSEClient` | `vninvest/.../src/market_data/vnbroker_adapter.py:164,323,906,988,1065,2192`, `vninvest/.../src/user_workspace/vnbroker_dnse_compat.py:42-50` |
| Adapter tự giới hạn | `_SUPPORTED_PROVIDER_SOURCES=('VCI','KBS','DNSE')`, daily chỉ `VCI/KBS` + cờ `DNSE_DAILY_OHLCV_DISABLED` | `vninvest/.../src/market_data/vnbroker_adapter.py:22-25` |
| Glue DNSE | `build_dnse_client` → `DNSEClient(api_key, api_secret, base_url)`; dùng `get_accounts/get_balances/get_order_history` | `vninvest/.../src/user_workspace/vnbroker_dnse_compat.py:42-50,53-151`, `dnse_adapter.py:42-51` |

---

## 2. Điểm nâng cấp chi tiết

### A. Breaking changes (bump là phải sửa phía `vninvest`)

- **A1. `SUPPORTED_SOURCES` thu hẹp**: `["AUTO","KBS","VCI","TCBS","MSN","DNSE"]` (v1.1.0) → `["KBS","VCI","TCBS","DNSE"]`, default `KBS`, bỏ `AUTO/MSN/FMP/GATEWAY` — `vnbroker/common/client.py:38-39`. `MSNComponents/FMPComponents/msn_symbol_map` đã bị xóa (`git diff v1.1.0..HEAD -- vnbroker/common/data.py`). Mọi code còn kỳ vọng `AUTO`/MSN FX phải bỏ.
- **A2. `Vnbroker.stock()` đổi signature**: bản cũ nhận `auth_token/api_key/api_secret/otp/openapi_base_url` + gọi `request_openapi_token`; bản mới chỉ `(symbol, source)`, TCBS auth đọc từ env `vnbroker_TCBS_*` — xem diff `vnbroker/common/client.py` (v1.1.0 vs HEAD).
- **A3. `fx()/crypto()/world_index()`**: `v3.1.x` raise `NotImplementedError` toàn bộ (do xóa MSN/FMP); `v3.4-dev` chỉ `crypto()` được wiring lại qua Binance, `fx/world_index` vẫn raise — `vnbroker/common/client.py:139-205`, riêng `crypto`:`:158-186`. `vninvest` hiện không gọi 3 hàm này qua adapter nên ảnh hưởng thấp, nhưng không được kỳ vọng FX/index quốc tế.
- **A4. Xóa hạ tầng cũ**: `GatewayHttpClient`, `launcher.py`, `GATEWAY/AUTO` trong enum/settings/dispatch/source_router/user_agent, 4 orphan fixtures — `vnbroker/CHANGELOG.md:68-90`.
- **A5. SSI/VNDirect scaffold xóa rồi thêm lại khác hẳn**: `v3.1.1` xóa `broker/ssi/ + broker/vndirect/`, registry chỉ còn TCBS (`CHANGELOG.md:52-66`); `v3.2.0` thêm lại SSI **native FastConnect v3, không `ssi-sdk`** (`CHANGELOG.md:23-50`). Không tương thích ngược với scaffold cũ.
- **A6. Deps mới**: `websockets>=12.0` (sync client chỉ từ 12.0), `cryptography>=42.0.5` — `vninvest/requirements.txt` không khai báo trực tiếp, phụ thuộc transitive; phải kiểm tra build trên image `python:3.13-slim`.

### B. Market data — sửa đúng chỗ `vninvest` đang đau

- **B1. DNSE Company/Finance fallback mới** (`e98b84c`): `explorer/dnse/company.py +291`, `finance.py +228`, `news.py +184`, `trading.py +148`, `quote.py +200`. Lưu ý `README.md:43` vẫn ghi "DNSE Company/Finance trả rỗng" — đã stale một phần, phải kiểm tra behavior thật trước khi mở DNSE cho company/financials.
- **B2. TCBS explorer viết lại lớn**: `quote.py ±491`, `listing.py +373`, mới `websocket.py +412`, `ws_models.py +89`, `stream.py +170`, `tcbs_compatibility.py +330` + `IMPLEMENTATION_SUMMARY.md`/`MIGRATION_GUIDE.md`. Đây là cơ sở để mở lại TCBS trong `_SUPPORTED_PROVIDER_SOURCES` (hiện adapter loại TCBS).
- **B3. VCI company rewrite ~686 dòng; KBS/VCI thêm `screener.py` (~130 dòng mỗi bên), `stream.py` (~344 dòng mỗi bên)** — nguồn mới cho screener/stream, không cần tự cào.
- **B4. kwargs-filtering** ở `Quote.history/intraday/price_depth` theo signature provider (`CHANGELOG.md:14-16`, `vnbroker/common/data.py:_filter_kwargs`). Giảm lỗi `unexpected kwarg` khi adapter truyền `page_size/interval/show_log` chéo provider (đúng lỗi hay gặp ở `_fetch_intraday_frame`, `vnbroker_adapter.py:163-183`).
- **B5. `InstrumentType` str-Enum + dedup `get_asset_type`**, khóa bug ETF 8 ký tự (`CHANGELOG.md:11-13`, `vnbroker/core/utils/parser.py`). Ảnh hưởng trực tiếp logic phân loại symbol.
- **B6. Price-unit matrix (v3.4-dev, `dbcd81a`)**: một đầu mối `normalize_ohlc_prices/intraday` tại `vnbroker/core/utils/transform.py:32,66,102,135`; DNSE history/intraday chuẩn hóa + `attrs`; TCBS `_compute_ohlc` refactor; test matrix 4 provider × stock/index/derivative. `vninvest` hiện tự chuẩn hóa `THOUSAND_VND` ở adapter — sau upgrade sẽ **trùng 2 lớp**, phải giữ 1 nơi + assert `df.attrs["price_unit"]`. Spec ở `vnbroker/artifacts/v3.4-roadmap/01-price-unit-matrix.md`.

### C. Reliability / kiến trúc

- **C1. Persistent circuit-breaker**: `HealthStore` (interface + `SQLiteHealthStore`/`MemoryHealthStore`) — `vnbroker/core/health_store.py:39-159`; `source_router.py +154` thêm half-open probe, restart-safe — `artifacts/v3.4-roadmap/03-circuit-breaker-persistent.md`. `vninvest` đang tự retry/fallback ở adapter (`_build_intraday_source_candidates`, `_INTRADAY_FALLBACK_SOURCES`) — sau upgrade cần phân vai: `vnbroker` lo provider health, adapter chỉ giữ policy.
- **C2. Registry merge thread-safe**: `BrokerRegistry` thêm `Lock`, register-once ở import, `Vnbroker.broker()` lookup qua `UnifiedRegistry.get_broker` — `vnbroker/common/client.py:241-269`, `vnbroker/broker/registry.py`, `artifacts/v3.4-roadmap/02-registry-merge.md`. Fix race khi nhiều Celery worker gọi `vn.broker()` đồng thời.
- **C3. News normalize/dedup/filter + `get_source_health_snapshot("news")`** (`CHANGELOG.md:196-213`). `fetch_rss_news` (`vnbroker_adapter.py:1121`) cần snapshot test lại schema.

### D. Năng lực mới hoàn toàn (không có ở v1.1.0)

- **D1. Retail facade**: `Vnbroker.retail()` → `gold(source=sjc/btmc)` + `exchange_rate()` VCB — `vnbroker/common/retail.py:56,71,121`, `client.py:224-239`, `docs/RETAIL_USAGE.md`. DataFrame đúng schema + `attrs["source"]`, fail-sớm date, RuntimeError prefix nguồn. Cơ hội thêm trang vàng/tỷ giá.
- **D2. Unified UI**: `vnbroker/ui/{market,reference,fundamental,retail,registry}.py` + `show_api()` (`CHANGELOG.md:11-12`). Dùng cho script/dashboard nội bộ, không bắt buộc cho BE.
- **D3. SSI broker lane native (v3.2.0, 171 tests, coverage 93%)**: `vnbroker/broker/ssi/` — auth market-only/OTP/Smart OTP push, OHLC 8 timeframe, master trần/sàn/TC, balance/positions equity + phái sinh, PPMMR, maxBuySell, sổ lệnh, portfolio snapshot, ký RSA stdlib + nanoid idempotency, 7 lệnh FCO (GTD/Stop/Trailing/OCO/BullBear), WS native. Vào qua `vn.broker(provider="ssi")` (`client.py:241-269`, `docs/SSI_USAGE_GUIDE.md`). Nếu mở cần thêm 4 env `VNBROKER_BROKER_SSI_*` + Redactor; write mặc định `dry_run=True`.
- **D4. Binance crypto public (v3.4-dev)**: `vnbroker/connector/binance/client.py +177`, `Vnbroker.crypto(source="BINANCE")` trả OHLCV `price_unit=USDT` — `artifacts/v3.4-roadmap/04-crypto-fx-worldindex-wiring.md`.
- **D5. Analytics indicators**: SMA/EMA/RSI/MACD/BB/ATR/Stochastic/Williams %R/CCI (`CLAUDE.md:272-274`) — có thể thay code tính tay.
- **D6. DNSE connector**: mới `websocket.py +245`, `account/order/market service`, `trade.py ±62`. Glue `vnbroker_dnse_compat.py` phải re-verify toàn bộ (rủi ro cao nhất).

### E. Quality/ops

- **E1. Test**: `522 passed` (3.1.0) → `768 passed/5 skipped` (`dbcd81a`); SSI 171 tests; retail 53 tests (retail 96%, UI 100%). CI matrix `ubuntu/macos/windows × py3.10-3.13` (`vnbroker/.github/workflows/test.yml`); quality gate enforce `scripts/check_mypy_baseline.py` (baseline 552 lỗi strict, expiry 2026-12-31) trong `code-quality.yml`.
- **E2. Docs/env mẫu**: `.env.example +65`, `docs/SSI_USAGE_GUIDE.md`, `docs/RETAIL_USAGE.md`, `docs/ROADMAP_V33_PLAN.md`, bộ `docs/TCBS_*`. Nhưng nhiều chỗ đã stale (xem §3).

---

## 3. CONTRADICTIONS doc ↔ code (đã xác minh)

| # | Doc nói | Code thực tế | Tác động |
|---|---|---|---|
| 1 | `README.md:5` ghi `v3.1.0` | `pyproject.toml:7` là `3.3.0`, `CHANGELOG.md:5` đã có `3.3.0` | Không biết tin version nào khi pin |
| 2 | `README.md:43` ghi DNSE Company/Finance rỗng | `explorer/dnse/company.py`/`finance.py` đã có implementation (`e98b84c`) | Có thể mở DNSE sớm hơn tưởng — phải test thật |
| 3 | `CLAUDE.md:260` ghi current `3.1.0` | Thực tế `3.3.0` + `v3.4-dev` | Agent mới đọc nhầm kiến trúc |
| 4 | `TODO.md:19` tick crypto xong | `client.py:188-205` FX/world_index vẫn raise (đúng roadmap tách PR) | Dễ hiểu nhầm "crypto/fx/index xong hết" |
| 5 | `02-registry-merge.md:8` thừa nhận `client.py` còn import SSI trong khi TODO ghi đã xóa | Đã fix ở `dbcd81a` (register-once) | Bằng chứng doc stale nhanh hơn code |

---

## 4. Ma trận ảnh hưởng tới từng hàm adapter `vninvest`

| Hàm `vnbroker_adapter.py` | Dùng `vnbroker` gì | Ảnh hưởng upgrade |
|---|---|---|
| `fetch_realtime_price`, `fetch_price_board_*` (`:430,:456,:529`) | `Vnbroker().stock().quote` + `_load_quote_class` (`:305`) | Hưởng lợi price-unit matrix + HealthStore; test lại nếu mở TCBS |
| `fetch_daily_history` (`:558`, chỉ VCI/KBS) | `quote.history` + kwargs-filter | Giữ cấm DNSE daily tới khi matrix DNSE xanh |
| `fetch_listing_symbols`, `fetch_symbol_group_members`, `sync_cached_symbol_groups` (`:642,:693,:1311`) | `api.listing.Listing` (`:323`) | TCBS listing mới có thể thay seed cứng `_LISTING_SEED_DATA:61-92`; test lại `symbols_by_exchange` fallback |
| `fetch_intraday_*` (`:779,:818,:872`) + `_fetch_intraday_frame` (`:163`) | `quote.intraday` VCI/KBS/DNSE | DNSE đã normalize ở v3.4 — bỏ normalize tay trùng; kiểm tra `interval/bar_type` mapping |
| `fetch_company_info/financials` (`:982,:1059,:1167`) | `Company/Finance` (`:988,:1065`) | Cơ hội dùng DNSE fallback; pin `source` rõ, không AUTO |
| `fetch_rss_news` (`:1121`), `News` (`:2192`) | `news/normalize/dedup` | Schema có thể đổi — snapshot test response |
| DNSE glue (`dnse_adapter.py:42-51`, `vnbroker_dnse_compat.py:42-50`) | `DNSEClient` | Rủi ro cao nhất: signature/behavior đổi → chạy lại toàn bộ DNSE tests trước khi bump |

---

## 5. Kế hoạch tiêu thụ bản GitHub mới

### Phase 0 — Đóng băng & xác minh (0.5–1 ngày, làm ngay, không cần release mới)

- [ ] Chốt commit sẽ lấy: khuyến nghị `38eec3a` (v3.3.0, đã có release-note) trước; `dbcd81a` (v3.4-dev) để sau. Không lấy `dev` trôi nổi.
- [ ] Trong `vninvest`, chạy lại suite liên quan `vnbroker_adapter/DNSE/materializer` với pin hiện tại để có baseline đỏ/xanh trước khi đổi.
- [ ] Liệt kê mọi `import vnbroker` + env `DNSE_*/VNBROKER_*` đang dùng, đối chiếu với `.env.example` mới của `vnbroker`.

### Phase 1 — Release hygiene phía `vnbroker` (chủ repo, 1–2 ngày)

- [ ] Merge `dev → main` hoặc tạo `release/v3.3.0` từ `38eec3a`; đồng bộ `pyproject.toml:7` ↔ `config.py:62-81` ↔ `README.md:5` ↔ `CLAUDE.md:260`.
- [ ] Tạo tag + GitHub Release `v3.2.0` (SSI), `v3.3.0` (Retail/UI), sau đó `v3.4.0` khi `dbcd81a` ổn định. Mỗi release ghi breaking (xóa MSN/FMP/AUTO, signature `stock()`, `websockets>=12`) + migration snippet.
- [ ] Đính chính `README` (DNSE Company/Finance) + `TODO` (phạm vi crypto/fx).
- [ ] Đảm bảo CI `test.yml` + `code-quality.yml` xanh trên tag (nhất là `check_mypy_baseline.py`).

### Phase 2 — Tích hợp trong `vninvest` (2–4 ngày, tách PR theo chặng)

- [ ] **PR-1 bump an toàn**: `requirements.txt:29` `@v1.1.0 → @v3.3.0` (ghim SHA tag, không dùng branch). Rebuild image builder (`Dockerfile:23-36`), kiểm tra `cryptography/websockets` trên `python:3.13-slim`.
- [ ] **PR-2 adapter tương thích**:
  - Giữ `_SUPPORTED_PROVIDER_SOURCES` cũ ở bước đầu; mở TCBS sau khi test listing/quote mới xanh.
  - Xóa mọi truyền `auth_token/api_key/otp` vào `stock()`; chuyển TCBS auth sang env.
  - Bỏ normalize giá trùng với `transform.normalize_*`; chỉ assert `df.attrs["price_unit"]`.
  - Re-verify `vnbroker_dnse_compat.build_dnse_client/get_accounts/get_balances/get_order_history` với DNSE connector mới + bổ sung test compat.
  - Phân vai failover: `vnbroker` (HealthStore) lo provider health, adapter chỉ giữ policy retry/source-order + log.
- [ ] **PR-3 năng lực mới (opt-in, mỗi cái 1 PR riêng)**: Retail vàng/VCB, `crypto(BINANCE)`, SSI lane (env + Redactor, giữ `dry_run=True` mặc định).
- [ ] Cập nhật `AGENTS.md` + ledger khi đổi pin / mở thêm source.

### Phase 3 — Kiểm chứng & rollout (1–2 ngày)

- [ ] Gates: `npx tsc --noEmit`, `npm run build`, `manage.py check`, BE tests `market_data/data_ingest/user_workspace`, FE tests chạm adapter, `i18n:scan` nếu thêm UI retail/SSI.
- [ ] Live smoke gated ngoài giờ: `fetch_daily_history` VCI/KBS, intraday DNSE, listing TCBS, `retail.gold/exchange_rate`, `crypto.history` (nếu mở), DNSE session bootstrap — quota thấp.
- [ ] Staging với `VNBROKER_GITHUB_TOKEN` có quyền read tag mới; giữ rollback 1 dòng về `@v1.1.0`.
- [ ] Sau 3 phiên ổn định mới xét lên `v3.4.0` (quyết nơi lưu sqlite `HealthStore` trong container để không mất state khi restart).

---

## 6. Câu hỏi cần chủ repo `vnbroker` chốt

1. Tag `v3.2.0/v3.3.0` khi nào có? Lấy `38eec3a` hay đợi `dbcd81a` thành `v3.4.0`?
2. DNSE Company/Finance đã đủ dùng cho `vninvest` chưa, hay vẫn coi như rỗng?
3. Chuẩn `price_unit` sau v3.4 là `VND` toàn bộ hay còn ngoại lệ index/derivative, USDT cho crypto?
4. `HealthStore` sqlite mặc định lưu ở đâu trong container? Có backend Redis không?
5. SSI lane có đưa vào `vninvest` không, hay chỉ giữ TCBS + DNSE hiện tại?

## 7. Đánh giá tổng thể

Implementable, không blocker kiến trúc. Giá trị lớn → nhỏ: **TCBS listing/quote rewrite → kwargs-filtering + InstrumentType → DNSE Company/Finance/WS → SSI native → Retail/UI → Binance crypto → HealthStore/registry/thread-safety → price-unit matrix**. Rủi ro lớn nhất là **quy trình phát hành (thiếu tag, main lạc hậu, version/doc lệch)** và **DNSE compat đổi ngầm**. Đi đúng Phase 0→3 thì tiêu thụ được bản mới an toàn, rollback được, mỗi bước có gate đo được.
