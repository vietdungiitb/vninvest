# PM decisions D1–D8 — Owner-proxy toàn quyền (2026-11-13, thay Owner quyết để پیاده)

> Căn cứ: probes S3 trên + QB1–QB4 + Entry 477 + tôn chỉ "vninvest = backend demo/reference".

| # | Quyết định FINAL | Bằng chứng | Hệ quả slice |
|---|---|---|---|
| D1 | Corporate actions: **GIỮ branch B** (`adjusted:false` + note). Không build EP-1 thật. | S3 probe `EVENTS_COUNT 0` (= Entry 477). Không nguồn ex-date/ratio. | S4 đóng (0 code). EP-1 thật cần ticket thương vụ mua nguồn — ngoài plan này. |
| D2 | Depth: **GIỮ route rỗng trung thực** (dot2 D1b). Không drop route, không nối broker. | Q-B1: không order book API nào trong vnbroker đang dùng. Widget `orderbook_dom` 0 callsite (tự degrade). | S5 đóng (0 code). |
| D3 | Tick sub-second: **GIỮ WS + poll hiện tại cho demo**. Không build push. | QB4: tick thật (1377 symbols, ~5M rows) nhưng staging short-lived; retention chưa đo dài hạn. | S6 đóng (0 code). Đo retention dài hạn là ticket riêng nếu cần hứa. |
| D4 | Server Pine cross-symbol: **DEFER** (đã trong spec §4). | Cần EP-1 + EP-4 sạch dữ liệu (chưa có). | S7 không mở slice. |
| D5 | `public_jwk` + `/api/v1/activations`: **thuộc vnsaas**, không phải vninvest. | Widget roadmap G0.3/G0.8 owner là vnsaas/engine. | Redirect, không slice vninvest. |
| D6 | Refresh prefix `/api/*`: **đã serve** (code + URL resolve). | S3 P3. | S3 smoke đủ; không code. |
| D7 | `period='year'`: **ĐƯỢC hỗ trợ** (VNM/KBS ra dữ liệu năm thật). | S3 P1 `YEAR_SAME_AS_QUARTER False`. Đóng V1 dot3 còn nợ. | Không code thêm; giữ nhánh 400-fallback cho symbol rỗng. |
| D8 | Cloud alert `POST /alerts` + `workspace/v1`: **KHÔNG build**. Surface demo = price-alerts CRUD + portfolios/watchlists hiện có. | S8 grep: 2 route đó 0 hit trong `src/`; widget E3 là local-first + SSE có sẵn. | S8 đóng (0 code). Widget map contract vào endpoint hiện có; lệch cụ thể → ticket mới có AC. |

**Rủi ro duy nhất còn lại:** quyết định D1/D2/D5 dựa trên "không có nguồn/việc của repo khác" — nếu Owner ký vendor data sau này, mở lại EP-1/EP-3 với AC mới.
