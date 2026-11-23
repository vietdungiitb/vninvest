# Phản hồi backend vninvest cho widget — News & Events API

> Người nhận: đội `vninvestcharts-widget`
> Ngày: 2026-11-23
> Đáp án cho: `docs/REQ_BACKEND_FOR_WIDGET_NEWS_EVENTS_20261123.md`
> Trạng thái: **RQ-B1 ✅ · RQ-B2 ✅ · RQ-B3 ✅** — đủ điều kiện UAT staging.

## 1. RQ-B1 — Corporate Actions endpoint: ✅ SHIPPED (PR #518)

`GET /core/v1/stock-management/stocks/{symbol}/corporate-actions/?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N`

- View: `packages/core/backend/src/market_data/corporate_actions/views.py` (mount tại `market_data/core_urls.py`).
- Contract đúng yêu cầu: response `{symbol, from, to, count, actions: [...], note}`; `limit` default 200 / max 1000; `from=to-365d`; lọc `is_latest=true` + `ex_date` in range; sort `ex_date ASC`; symbol `upper().strip()`; 404 mã lạ; 400 `from>to`; 401/403 fail-closed; lỗi nguồn → envelope rỗng + `note`.
- Gates: BE 10/10 + regression 71/71 trên VPS staging.

## 2. RQ-B2 — News endpoint tôn trọng `limit`: ✅ SHIPPED (PR #519)

`GET /core/v1/stock-management/stocks/{symbol}/news/?limit=N`

- `limit` default 20 / max 100; giá trị hỏng → 20; cache key `stock_news:{symbol}:{limit}` (không nhiễm chéo giữa các limit); cắt `news_list[:limit]`.
- Shape giữ nguyên `{symbol, news: [...], note}`; `published_at` là ISO string, FE parse sang ms epoch (mapper bỏ item lỗi, không crash).
- Gates: RED 4/5 → GREEN 5/5 trên VPS; `limit=2` trả đúng 2 item, `limit=999` cap 100, cache key có hậu tố.

## 3. RQ-B3 — Wiring adapter: ✅ SHIPPED (PR #518)

- `createChartStockDataAdapter` implement `fetchCorporateEvents(symbol, fromMs, toMs) → CorporateEvent[]` (chế độ `live`, fail → `[]`, widget tự tính `timeIndex`).
- `fetchSymbolNews(symbol, limit?) → NewsItem[] | null` có trên `chartAdapter` + enterprise binding (fail/không tin → `null`, no mock).
- Panel truyền `showCorporateEvents: true`, `corporateEventsMode: 'live'`; không bật `allowMockEvents`.
- Gates: mapper 9/9 + panel 21/21.

## 4. Phiên bản & UAT

- Widget đang pin: `@vninvestcharts/widget@0.4.7-ent` (`packages/web/package.json:107`).
- Widget staging HEAD theo báo cáo: `54563d13` (đã có `SymbolNewsPanel` + dock tab `"news"` + events overlay).
- Backend `dev` HEAD sau 2 PR: `6ab6a1563`. Đội widget có thể chạy UAT ngay với điều kiện token/staging theo runbook; nếu cần deploy bản mới lên staging, báo coordinator.

## 5. Ghi chú

- Không đổi ngưỡng 50 bars, type `D|E|N|S`, field `CorporateEvent` (đúng §4 yêu cầu).
- Không bật mock ở production; không thay đổi ingest/adjustment.
- Suite FE đầy đủ (`npm run test`, `test:components`, `vite build`) vẫn **CHƯA CHẠY** do thiếu `GITHUB_TOKEN` (read:packages) trên VPS — không ảnh hưởng contract BE; cần token transient để chạy full nếu widget yêu cầu.

Bằng chứng: `docs/evidence/widget-news-events/call-path.md`, `task1-gates.md`, `task3-gates.md`, `news-limit-gates.md`; ledger Entry 615/616.
