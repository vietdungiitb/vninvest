# BÁO CÁO TỔNG THỂ TÍNH NĂNG & LỘ TRÌNH PHÁT TRIỂN — VNInvest

**Ngày:** 2026-10-21 · **Phiên bản:** 2 (sau 8 quyết định của Owner) · **Phạm vi:** toàn bộ repo `vninvest` (5 package track) · **Trạng thái:** tài liệu chiến lược + lộ trình, **không sửa code production**

> **Đọc tài liệu nào?**
> - **Bản này** (`BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md`) = bản **quản lý**, đọc đầu-cuối ~15 phút, chứa quyết định + lộ trình + câu hỏi cần bạn chốt.
> - [`ROADMAP_MASTER_2026Q4_2027.md`](./ROADMAP_MASTER_2026Q4_2027.md) = bản **kỹ thuật chi tiết** cho team thực thi (mỗi slice có file:line + AC đo được).
> - [`COMPETITIVE_BENCHMARK_20261021.md`](./COMPETITIVE_BENCHMARK_20261021.md) = **đối thủ** (4 lớp, 17 sản phẩm, 108 URL nguồn chính thức).
> - [`CODE_CHANGE_AUDIT_LEDGER.md`](./CODE_CHANGE_AUDIT_LEDGER.md) Entry 393/394 = **bằng chứng + quy trình**.

---

## 1. Tóm tắt 1 trang

| | |
|---|---|
| **VNInvest là gì hôm nay** | Nền tảng phân tích & giao dịch chứng khoán VN: 16 Django app · ~93 000 LOC backend · 69 route web · ~110 000 LOC frontend · 291 file test backend + 215 frontend · multi-tenant + partner API (108 route) + SOC (136 route) + SSO + audit + billing VNPay/Stripe + 3 broker lane (DNSE/SSI/TCBS) + AI advisory đa provider |
| **Chiến lược (bạn đã chốt)** | **Retail-first** · giai đoạn đầu **miễn phí, không doanh thu** · mục tiêu **lấy brand name** · B2B (nhà phát triển ký hợp đồng) để sau khi hệ thống đủ tốt |
| **Thứ retail mua** | Thông tin thị trường **chỗ khác không có**: **charts · whale · dark flow · AI phân tích kỹ thuật** |
| **Ranh giới sản phẩm** | AI = **phân tích kỹ thuật**, KHÔNG phải khuyến nghị đầu tư · **KHÔNG đặt lệnh** (trừ khi có hợp đồng riêng) |
| **Rủi ro lớn nhất** | **Order book trên biểu đồ đang là dữ liệu giả** mà app tiêu thụ âm thầm. Retail sẽ trả tiền cho "dữ liệu mà chỗ khác không có" — nếu dữ liệu không đáng tin thì không có brand name nào xây được trên đó |
| **Nguyên tắc ưu tiên (bản 3)** | **Ưu tiên vấn đề tự giải quyết bằng code [T]; việc phụ thuộc bên ngoài [X] lùi xuống cuối.** Giai đoạn 1 = **36 slice = 100% [T]** ⇒ không bị chặn bởi quyết định pháp lý, hợp đồng hay khoá dịch vụ nào. 12 mục [X] nằm ở hàng đợi, mỗi mục có **điều kiện mở** rõ ràng |
| **Ưu tiên 90 ngày** | **W0** dọn nền (gate, code chết) → **W1** dữ liệu đáng tin + đúng pháp lý sản phẩm + 2 tầng tài khoản broker → **W2** chiều sâu giá trị retail → **W3** brand name (kích hoạt & giữ chân) |
| **Còn cần bạn chốt** | **6 câu** (§7) — Q1 tên vai trò staff thứ 2, Q2 credential tầng 2 thuộc tenant hay operator, Q3 tầng 2 có cần trading token không, Q4 bỏ trial 14 ngày, Q5 free có quảng cáo ở đâu, Q6 ai trả chi phí LLM cho free. **Lưu ý: cả 6 đều là quyết định của bạn — không phải phụ thuộc bên ngoài ⇒ không bị lùi hàng đợi** |
| **Đã triển khai** | **W0.1 + W0.1b + W0.4 xong** (PR #278) ⇒ `pre-push-gate` **32 PASS / 0 FAIL** (trước: 28) — 3 gate "false-green" đã được hồi sinh, 6 entry registry chết đã xoá, gate mới `check-page-registry` chống tái phát. Còn 6 slice W0 → xem handoff `docs/HANDOVER_W0_FOUNDATION_20261022.md` |

---

## 2. Hiện trạng (đã đọc code thật, không suy đoán)

### 2.1 Quy mô

| Hạng mục | Số | Hạng mục | Số |
|---|---|---|---|
| Django app | **16** (1 rỗng) | Route web | **69** catalog / 61 mount thật |
| Backend code | ~93 000 LOC / 396 file | Frontend code | ~110 195 LOC / 421 file |
| Backend test | **291 file** | Frontend test | **215 file** (vitest + jest + playwright) |
| Migration | 149 file | API route | ~500 khai báo |
| i18n | 95 namespace · 6 694 key (vi) / 6 674 (en) — **lệch 20** | Design system SOC | token 211 dòng + class 4 061 dòng |
| 3 package phụ | mobile 3 823 LOC · opencore 62 LOC · vip-app 684 LOC | **Cả 3 đều KHÔNG được nối CI** | |

### 2.2 Bản đồ tính năng (rút gọn)

**Backend (16 app)** — `identity_access` (auth/tenant/PAT/partner API 108 route/SSO) · `user_workspace` (portfolio + **ledger** + watchlist + screener + **3 broker lane** + AI Command Center) · `service_ops` (**SOC 136 route** + operator 27 route) · `advisory` (AI đa provider + budget/audit/trace) · `market_data` (stock profile/OHLCV/intraday + stock-management 37 route) · `data_ingest` (ingestion/backfill/outbox, 92 Celery task) · `market_serving` (realtime read-model) · `signal_intelligence` (alert center + order-flow + whale + WS/SSE) · `commercial` (subscription/quota/invoice/VNPay/Stripe) · `ops_audit` · `support` · `advertising` · `ai_analytics` · `tenant_lifecycle` · `vninvest_core` (health/OpenAPI/legacy proxy) · **`ai_agents` (rỗng, 5 LOC)**

**Frontend (69 route)** — Auth 4 · Market 4 (dashboard/watchlist/screener/stock detail) · Portfolio 7 · Signals/AI 7 · Broker 3 · Commercial 2 · Tenant-admin 17 · Operator/SOC 11 · Admin-fleet 9 · Tenant-self 2 · Khác 5 · **51 route chỉ truy cập được bằng URL, không có trong menu**

### 2.3 Thứ thật, thứ giả — bảng quan trọng nhất với chiến lược retail

| Năng lực | Trạng thái thật | Bằng chứng |
|---|---|---|
| **Whale alerts** | ✅ **THẬT** — dựng từ tick thật (giá, khối lượng, giá trị, cả chiều) | `signal_intelligence/tasks.py:280-360`, metadata `source: pandas_tick_engine` |
| **Dark flow score** | ⚠️ **THẬT nhưng là PROXY** — `|net CVD| / tổng giá trị` (đo hấp thụ), **không** phải "dấu vết cá mập" tuyệt đối | `market_serving/session_facts_engine.py:38,205` · serializer tự ghi *"absorption proxy"* `serializers.py:45` |
| **CVD / session facts** | ✅ THẬT — có `source` (LIVE/CACHE/DEGRADED/COMPUTED) + cờ `stale` | `market_serving/models.py:95-101` |
| **Order flow** | ✅ THẬT — `OrderFlowEvent` có đường ingest | `signal_intelligence/models.py:110` |
| **Order book / depth chart** | ❌ **GIẢ** — docstring tự ghi *"mock implementation"*, sinh bằng `pseudo_random()` từ seed | `market_serving/native_views.py:430,450-451,481-509` |
| **…và app đang ăn nó** | ❌ Chart order book gọi đúng endpoint mock, **không cảnh báo** | `packages/web/src/adapters/chartAdapter.js:160` |
| **AI output** | ❌ **Đúng nghĩa "khuyến nghị đầu tư"** — LLM bị yêu cầu trả `signal: BUY\|SELL\|HOLD` + `target_price` + `recommendation` | `advisory/orchestrator.py:717-723` (prompt) + `:561` (system prompt) |
| **Technical indicator** | ⚠️ Widget có **59** indicator nhưng app **chỉ bật 7**; `tape` + `corporate events` đang tắt | `VNStockChartPanel.js:157-186,257,259` |
| **Screener** | ✅ THẬT & mạnh — **42 trường** (18 TA + 13 whale + 5 dark-flow + 6 fundamental) + lịch quét + chia sẻ rule | `user_workspace/screener_helpers.py:70-94` |
| **Backtest** | ⚠️ Có nhưng **0/5 giả định thị trường VN** — UI tự ghi *"Giá chưa trừ phí/thuế"* | `AdvisoryBacktestPanel.js:104` |
| **Push notification** | ❌ Chưa có key → hệ thống trả **thành công giả** | `outbound_notification_service.py:56-57,102-103` |
| **Referral / PWA / landing / onboarding checklist** | ❌ **0** — không có referral/affiliate, không PWA, không landing page, không checklist | grep toàn repo = 0 hit; `packages/web/public` không tồn tại |

### 2.4 Nợ kỹ thuật cần dọn (Wave 0)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| T1 | **`check-light-theme` KHÔNG được wire vào pre-push** ⇒ gate tưởng chạy thực tế không chạy | grep literal trong `scripts/pre-push-gate.mjs` = 0 hit |
| T2 | **OC-19 doc-sync gate DEAD** — match path `^backend/` đã legacy ⇒ **không file nào match** ⇒ luôn PASS | `scripts/quality/check_opencore_doc_sync.ps1:50-51` |
| T3 | **CI thật 1/9 workflow**; `lint` + `test` + `build` **không** có trong pre-push | `.github/workflows/` (1) vs `workflows-disabled/` (8) |
| T4 | **10/10** entry `exports` của `packages/web/package.json` trỏ file `.ts` **không tồn tại** | `packages/web/package.json:36-48` |
| T5 | **6 page-registry entry bị shadow** ⇒ 837 LOC component chết | `main.tsx:24-28,32-33,49` vs `pageRegistry.js:196-207,239` |
| T6 | **51 route** `market_data` không được include ⇒ rơi vào legacy proxy | `market_data/urls.py:7-12` · `public_urls.py:41-82` |
| T7 | **2 126 LOC** `contracts/admin_ops` + 26 route trả 410 GONE | `vninvest_core/urls.py:37-42,77` |
| T8 | **~17 endpoint `/partner/*`** gọi thẳng từ page, **ngoài adapter** ⇒ không có contract test | `route-contract.test.js:49` |
| T9 | **OpenClaw** `SUPPORTED_PROTOCOLS = ()` ⇒ mọi call 503 | `advisory/ai_clients/openclaw.py:44` |
| T10 | **SAML `strict` luôn raise** — thiếu code verify (thư viện + `xmlsec1` **đã có** trong repo) | `identity_access/saml_service.py:402-406` · `requirements.txt:46` · `Dockerfile:19,58` |
| T11 | **3 tài liệu trạng thái đang sai** (stale 6 tháng / 18 ngày / sai trạng thái PR) ⇒ mọi agent đọc để quyết định đều bị dẫn sai | `ROADMAP_STATUS.md` · `PROGRESS_DASHBOARD.md` · `docs/OPEN_WORK_20260927.md:39-40` |

### 2.5 Lợi thế không thể copy

| Lợi thế | Vì sao đối thủ không copy nhanh |
|---|---|
| **Dữ liệu dòng tiền VN chuẩn hoá + tín hiệu** | TradingView / moomoo / Webull / Bloomberg / FactSet / Koyfin **không có** dữ liều dòng tiền VN. FireAnt **có** nhưng bán dạng feed MetaKit cho AmiBroker (user tự viết AFL) — **chưa phải signal** |
| **Multi-tenant + partner API + SOC cho thị trường VN** | Webull Institutional (Mỹ) · Koyfin Teams (Mỹ) · TradingView Enterprise (global). **Trong nước chưa có đối thủ trực tiếp** (chỉ BSC Open API = broker→app, FireAnt API = data) |
| **AI đa-mô hình có audit + kiểm soát chi phí** | Đối thủ VN ship AI **đóng hộp** (FireAnt Copilot, Mira-bot) — user không chọn model, tenant không kiểm soát |
| **3 broker lane trên 1 tài khoản SaaS** | TradingView trade-through là broker Mỹ · FireAnt Trading là app của FireAnt |
| **Ledger append-only lot-level** | Koyfin có lot-level P/L nhưng **theo dõi**; Webull/Wefolio chỉ tạo basket |
| **Screener 42 trường + cảnh báo đa điều kiện có NOT** | Đối thủ VN ship screener đóng hộp |

**Không nên tự khoe:** số indicator (ta 59 vs TradingView 400+ built-in + 100K cộng đồng) · deep backtest · paper trading (chưa có) · options/futures/margin (không phù hợp sàn VN) · social community (rủi ro đạo đức "đầu cơ").

---

## 3. 8 quyết định của Owner (2026-10-21) và hệ quả

| # | Quyết định | Hệ quả kỹ thuật bắt buộc |
|---|---|---|
| **D1** | Khách trả tiền = **RETAIL**, mua thứ **chỗ khác không có**: charts · whale · dark flow · AI | Bỏ ưu tiên per-seat / advisor workspace khỏi giai đoạn 1 |
| **D2** | AI = **phân tích kỹ thuật**; **KHÔNG đặt lệnh** trừ khi có hợp đồng riêng | ① **Đổi contract đầu ra LLM** (prompt + shape + serializer + component + 2 locale + test khoá shape). ② Gỡ order placement khỏi sản phẩm (giữ `paper`). ③ Thêm disclaimer "phân tích kỹ thuật, không phải khuyến nghị đầu tư" |
| **D3** | Mỗi lane broker có **2 tầng ứng dụng**: retail (portfolio) + **staff COC** (thông tin thị trường) ⇒ **2 tài khoản riêng** | Model credential cấp **tenant/staff** tách khỏi `UserBrokerConfig` (per-user). Hôm nay chỉ có 1 credential **global toàn hệ thống** ⇒ 2 tenant dùng chung ⇒ **slice kiến trúc P0** |
| **D4** | OpenClaw = **tính năng hỗ trợ** | Implement protocol **hoặc** định vị lại + fail-closed có lý do (không để user tưởng AI chính đang chết) |
| **D5** | SAML **dùng thật trong tương lai** | Implement verify thật — thư viện + `xmlsec1` **đã có**, chỉ thiếu code |
| **D6** | Depth chart = **"ước tính"** (giữ, gắn nhãn) | Nhãn ở mọi nơi hiển thị + `is_mock` phải đi tới FE + không được dùng mock mà không cảnh báo |
| **D7** | Push = **tính năng tương lai** | Không báo thành công giả — trả `skipped` + lý do; UI nói "chưa bật" |
| **D8** | **Miễn phí, không doanh thu** · mục tiêu = **brand name** · B2B để sau | ① Hàm mục tiêu đổi từ MRR sang **activation/retention/referral/brand**. ② **Gỡ plan-gating** cho whale/dark-flow/AI/chart. ③ Trial 14 ngày không còn hợp lý. ④ B2B chỉ **thiết kế sẵn** |

---

## 4. Lộ trình (5 wave giai đoạn 1 + 1 hàng đợi bên ngoài · 36 slice [T] + 12 mục [X])

> **Nguyên tắc (bạn đã chốt, bản 3):** ưu tiên **vấn đề có tính kỹ thuật lập trình — tự giải quyết bằng code [T]**; **vấn đề phụ thuộc bên ngoài [X] lùi xuống cuối**. Mỗi slice gắn nhãn **[T]** / **[X]**. **Toàn bộ giai đoạn 1 (W0–W3) = 100% [T]** ⇒ không có mục nào bị chặn bởi UBCKNN, bản quyền dữ liệu, hợp đồng broker, IdP, khoá FCM hay App Store.

### W0 — "Dọn nền để không tự đánh lừa mình" · P0 · 2 tuần · 8 slice · **[T] ×8**
Wire gate thật (`check-light-theme` + lint + vitest + CI) · xoá ~3 000 LOC code chết + 51 route không include · sửa `exports` hỏng · dọn 6 registry entry shadow + 3 feature folder rỗng · đưa ~17 endpoint `/partner/*` về adapter · **fail-closed mọi endpoint trả dữ liệu giả** · đóng 3 blocker AI (OpenClaw fail-closed · **SAML verify thật** · `ai_agents` rỗng) · chuẩn hoá 3 tài liệu trạng thái + bật CI.

### W1 — "Dữ liệu đáng tin + đúng pháp lý sản phẩm" · P0 · 90 ngày · 10 slice · **[T] ×10**
`W1.1` **AI contract → phân tích kỹ thuật** (đổi prompt + shape + serializer + UI + 2 locale + disclaimer) · `W1.2` **gỡ order placement** khỏi sản phẩm (chỉ `paper`, nhãn rõ, audit tách operation) · `W1.3` nhãn **"Ước tính"** cho order book + `is_mock` tới FE · `W1.4` **mở khoá toàn bộ dữ liệu đang bị tắt trong chính repo** (7 → 59 series, tape, corporate events, task NOOP, indicator `None`, 4 endpoint rỗng) — **slice thuần code, tác động lớn nhất tới giá trị retail** · `W1.5` **2 tầng tài khoản broker — phần code** (model + resolver + endpoint SOC theo tenant + permission + role + FE 2 panel) · `W1.6` minh bạch whale/dark flow (công thức "absorption proxy" + nguồn + độ mới) · `W1.7` OpenClaw → tính năng hỗ trợ, fail-closed có lý do · `W1.8` **SAML verify thật** (thư viện + `xmlsec1` đã có trong repo) · `W1.9` bỏ trial 14 ngày (free vô hạn) · `W1.10` push `not_configured` thay vì báo thành công giả.

### W2 — "Chiều sâu giá trị retail" · P1 · 90–180 ngày · 10 slice · **[T] ×10**
`W2.1` **AI chat grounded + trích dẫn nguồn** · `W2.2` **NL-screener** (prompt tiếng Việt → filter + Explanation) · `W2.3` **backtest/paper trading giả định VN** (lô 100 · T+2,5 · phí 2 chiều · PIT 0,1% · slippage) — khác biệt duy nhất vs TradingView · `W2.4` tax-aware P/L + sharpe/sortino · `W2.5` top movers / market pulse (màn hình đầu tiên cho retail) · `W2.6` screener + heatmap theo ngành · `W2.7` chart layout lưu server + share · `W2.8` AI digest mỗi sáng · `W2.9` **tài chính nhiều năm chuẩn hoá** (nguồn đã có sẵn trong repo) + fix bug `revenue_growth_yoy` · `W2.10` P/B · Graham · Z-Score · F-Score · Dupont.

### W3 — "Brand name: kích hoạt & giữ chân" · P1–P2 · 6–12 tháng · 8 slice · **[T] ×8**
`W3.1` **activation funnel** (checklist 5 bước, first value trong 3 phút, dữ liệu mẫu cho empty state) · `W3.2` **referral + share** (mã giới thiệu, link mời, ảnh tóm tắt phân tích) · `W3.3` **PWA** (manifest + service worker + install prompt) · `W3.4` mobile ergonomics cho VN (tiết kiệm data, 3G) · `W3.5` landing page + SEO + brand assets · `W3.6` **widget nhúng thương hiệu = kênh phân phối miễn phí** (tái dùng advertising widget sẵn có) · `W3.7` nhật ký hành trình retail để đo funnel · `W3.8` email vòng dài (welcome · nudges · re-engagement) + abstraction cho SMS/Zalo.

### W4 — "Giai đoạn 2: doanh thu & B2B — phần CODE" · 6 slice · **[T] ×6** · *điều kiện mở: có khách B2B ký hợp đồng*
Chính sách giá + entitlement · giá theo seat + platform fee · advisor/client workspace · bảng giá + landing B2B + demo tenant · AI add-on + model portfolio (phần code) · hóa đơn VAT (phần code: model + abstraction provider).

### W5 — **HÀNG ĐỢI BÊN NGOÀI (X)** · ưu tiên thấp · 12 mục · *mỗi mục có điều kiện mở*

| Mục | Phụ thuộc bên ngoài | Điều kiện mở | Phần code đã làm trước được |
|---|---|---|---|
| Implement protocol OpenClaw | Bạn cấp đặc tả D-03c | Có đặc tả | W1.7 (fail-closed + định vị) |
| **Đặt lệnh live** | **Hợp đồng riêng với broker** | Có hợp đồng | W1.2 (guard + `paper` mode) |
| Conditional orders (OCO/Trailing) | Phụ thuộc đặt lệnh live | Có hợp đồng | — (giá trị thấp khi chưa có live) |
| Nguồn dữ liệu corporate actions | Feed VSDC/broker | Có feed | W2.9 (model + adjustment engine) |
| Chỉ số ngành ICB + chuỗi giá ngành | Nhiều nguồn dữ liệu | Có nguồn | Phân cấp ICB trong code |
| Trái phiếu / tín dụng | Nguồn dữ liệu trái phiếu | Có nguồn | — (chỉ 1 lớp đối thủ có) |
| Bổ sung indicator mới (> 59) | Repo khác `vninvestcharts-widget` | Được sửa repo đó | W1.4 (bật 59 cái đang có) |
| App native iOS/Android | App Store / Play Store | Có account, sau PWA | W3.3 (PWA ăn phần lớn giá trị) |
| Khoá FCM/VAPID production | Tài khoản Google | Có project | W1.10 + W3.3 (plumbing) |
| Bán dữ liệu VN (data licensing) | Bản quyền VSDC/HOSE | Có ý kiến pháp lý | Partner API đã có |
| Affiliate/referral broker (hoa hồng) | Pháp lý UBCKNN | Có ý kiến pháp lý | W3.2 (referral nội bộ — khác hoàn toàn) |
| Agent AI tự đặt lệnh / robo-advisor | Compliance quản lý đầu tư | Có giấy phép | — |

**Luật vận hành:** mỗi tuần rà bảng W5 — mục nào đủ điều kiện thì lên W4. **Không mục [X] nào được chặn W0–W3** (thiết kế đã bảo đảm điều này).


## 5. Chiến lược giai đoạn 1: miễn phí, đo bằng hành vi

### 5.1 Chỉ số mục tiêu (không có metric doanh thu nào)

| Chỉ số | Mục tiêu | Hạ tầng đo trong repo |
|---|---|---|
| **Activation rate** (đăng ký → first value trong 3 phút) | ≥ 40% | Cần sự kiện funnel (W3.7) |
| **D1 / D7 / D30 retention** | 35% / 20% / — | `ops_audit` + `api_rollup` + Prometheus — có sẵn, **chưa có dashboard** |
| **Referral coefficient** | ≥ 0,3 | Chưa có referral (W3.2) |
| **Brand search / traffic tự nhiên** | theo dõi | Landing + SEO (W3.5) |
| **Push opt-in / PWA install** | 25% / 10% | W3.3 |
| **Tỉ lệ màn hình AI có disclaimer** | 100% | W1.1 |
| **Tỉ lệ panel dùng dữ liệu whale/dark-flow thật** | 100% | `SessionFacts.source` + cờ `stale` |

### 5.2 5 chính sách "miễn phí" cần chốt
P1 bỏ trial 14 ngày (free vô hạn) · P2 gỡ plan-gating cho whale/dark-flow/AI/chart · P3 quảng cáo: chỉ ở free, **không** đặt trong màn hình khác biệt cốt lõi · P4 AI: BYOK **+** quota do VNInvest trả cho free (nếu không, free không có AI ⇒ mất khác biệt) · P5 tài khoản staff: chưa thu phí.

### 5.3 Giai đoạn 2 — 3 đường doanh thu (thiết kế sẵn)
**A.** Bán cho nhà phát triển (hợp đồng theo tenant: platform fee + seat + SLA — mốc Koyfin Advisor $209/$299) · **B.** Bán dữ liệu VN (phí theo volume — **cần rà soát bản quyền VSDC/HOSE, chưa xác minh**) · **C.** Affiliate broker (hoa hồng mở tài khoản — **chưa xác minh pháp lý UBCKNN**).

**Mốc giá tham chiếu**: FireAnt 119k/319k/479k đ/tháng · TradingView $12,95–59,95 · TradingView AI Copilot $7,50 · Koyfin Plus/Premium $39/$79 · Koyfin Advisor $209/$299 · Bloomberg $31.980/năm/seat.

---

## 6. Rủi ro

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R1 | **Đặt lệnh ngoài phạm vi hợp đồng** — hiện `live` đã bị chặn cứng, nhưng endpoint vẫn tồn tại | Cao | W1.2 gỡ khỏi sản phẩm + kill-switch 3 tầng sẵn có |
| R2 | **Dữ liệu giả lọt tới retail** (order book) | Cao | W1.3 nhãn + W0.6 fail-closed |
| R3 | **AI vẫn ra lệnh mua/bán** vì đổi câu chữ không đổi contract | Cao | W1.1 đổi prompt + shape + test khoá shape |
| R4 | **2 tenant dùng chung 1 broker credential** (đang có thật) | Cao | W1.4 credential cấp tenant + test tách biệt |
| R5 | **Trial 14 ngày giết retention** khi sản phẩm free | Trung bình | W1.8 + Q4 |
| R6 | **SAML dùng thật mà `strict` chưa verify** ⇒ đăng nhập IdP không an toàn | Trung bình | W1.7 |
| R7 | Gate vẫn xanh giả sau W0 nếu CI không bật | Trung bình | W0.1 + W0.8 cùng lúc |
| R8 | Agent đọc tài liệu trạng thái stale ⇒ quyết định sai | Cao | W0.8 trước mọi wave |
| R9 | Bản quyền dữ liệu VN khi bán data / referral | Trung bình | **CHƯA XÁC MINH** — chặn giai đoạn 2 |

---

## 7. 6 câu cần bạn chốt (chặn W1)

| # | Câu hỏi | Vì sao chặn | Hạn |
|---|---|---|---|
| **Q1** | **Tên gọi cho vai trò staff thứ 2?** — "COC" **đã bị chiếm** bởi *Center Operations Center* trong repo (`docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md:1`) | W1.4 tạo model + permission + route — đặt tên sau rất đắt | Trước W1.4 |
| **Q2** | **Credential tầng 2 thuộc tenant hay thuộc operator?** | Tenant ⇒ mỗi khách 1 tài khoản riêng. Operator ⇒ 1 account dùng chung ⇒ **vi phạm cách ly dữ liệu giữa tenant** (đúng lỗi của credential global hiện tại) | Trước W1.4 |
| **Q3** | **Tầng 2 có cần trading token không?** | Không ⇒ W1.4 chỉ còn read path (`balance`/`positions`/`orders`), **không** đụng lifecycle token DNSE ⇒ scope nhỏ hơn nhiều | Trước W1.4 |
| **Q4** | **Bỏ trial 14 ngày hay giữ?** | `onboarding_views.py:137` + auto-expire `tenant_lifecycle/tasks.py:111,142` — nếu free vô hạn mà quên sửa ⇒ user mất dữ liệu sau 14 ngày | Trước W1.8 |
| **Q5** | **Free có quảng cáo không, đặt ở đâu?** | Đối thủ trả phí đều "No ads" ⇒ ads chỉ ở free, **không** trong màn hình whale/dark-flow/AI | Trước W3 |
| **Q6** | **Ai trả chi phí LLM cho free?** | Không có quota do VNInvest trả ⇒ free không có AI ⇒ mất khác biệt D1. Cần con số chi phí biên/user | Trước W2.3 |

---

## 8. Phụ lục

### 8.1 Cách đọc theo vai trò
- **Owner / quyết định** → bản này (§1, §3, §4, §7).
- **Team kỹ thuật** → `ROADMAP_MASTER_2026Q4_2027.md` (mỗi slice có file:line + AC đo được + phụ thuộc).
- **Marketing / đối thủ** → `COMPETITIVE_BENCHMARK_20261021.md`.
- **Truy vết bằng chứng** → `CODE_CHANGE_AUDIT_LEDGER.md` Entry 393 (audit + benchmark) và Entry 394 (bản 2 + pivot).

### 8.2 Bằng chứng đã kiểm chứng
- **Audit 5 lớp**: backend (16 app) · frontend (69 route theo registry) · 3 package phụ · benchmark 4 lớp đối thủ (108 URL) · verify 33 năng lực `?` trong code ⇒ **HAVE 9 / PARTIAL 13 / MISSING 11**.
- **Spot-citation**: 9/9 citation mở đúng file + đúng dòng (L-T02).
- **Gate chạy thật**: `node scripts/pre-push-gate.mjs` = **28 PASS / 0 SKIP / 0 FAIL** · `check-lessons` = 0 (13 file / 52 lesson) · `check-multi-agent` = 0 lỗi.

### 8.3 Trung thực về những gì **chưa** chạy
`npm run test` toàn bộ · `npm run test:components` toàn bộ · BE `pytest` toàn bộ (cần **Postgres riêng** — **không** chạy được trên SQLite vì `identity_access/9000_auth_user_email_ci_unique.py:60` dùng `array_agg`) · E2E Playwright · ảnh chụp thật sau khi sửa · deploy staging. Baseline BE đã biết: **602 test — failures=10, errors=3** (`e01dbf3d`).
**Audit chuyên sâu growth/activation** (referral, email drip, funnel, SEO) **chưa chạy trọn vẹn** ⇒ W3.1/W3.2 cần audit riêng trước khi code.

### 8.4 Quy trình đã tuân thủ
Claim trước khi sửa → branch riêng `feat/master-roadmap-2026q4` (không commit thẳng vào `dev`) → 8 bước pipeline `docs/AGENT_PROTOCOL.md` → ledger Entry 393/394 → PR #277. Lessons áp dụng: L-V01 · L-V02 · L-V04 · L-G02 · L-G04 · L-G07 · L-T01 · L-T02 · L-F03.

### 8.5 Ghi chú chiến lược
- **Đối thủ trực tiếp ở nhóm data/analysis VN là FireAnt, không phải TradingView.** Bất kỳ roadmap nào không so với FireAnt là so sai.
- Ta **không** cạnh tranh bằng "AI khuyến nghị" (FireAnt Copilot đã có) mà bằng **phân tích kỹ thuật có dữ liệu dòng tiền thật** — đó là chỗ đối thủ quốc tế không vào được, và chỗ mà ta đang có dữ liệu thật.
- **"Thứ chỗ khác không có" là lời hứa ⇒ mọi ô dữ liệu phải trung thực.** Một order book giả bị phát hiện sẽ mất nhiều hơn giá trị của nó.
