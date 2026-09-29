# PHẢN BIỆN — Tài liệu Thảo luận Screener SaaS Native

**Ngày phản biện**: 2026-07-10
**Tài liệu gốc**: `docs/THAO_LUAN_SCREENER_SAAS_NATIVE_20260710.md`
**Phương pháp**: Đối chiếu từng claim kỹ thuật với mã nguồn thực tế (backend Python + frontend TS/TSX/JS).

---

## 1. Đánh giá tổng quan

Tài liệu có **cấu trúc tốt**: mục lục rõ ràng, bảng so sánh commercial (TradingView/Finviz/StockRover) sắc sảo, xác định USP (Whale/Dark Pool) chính xác, và lộ trình 4 pha hợp lý về mặt định hướng.

**Tuy nhiên**, nhiều claim tự xưng "dựa trên mã nguồn thực tế tại thời điểm 2026-07-10" (dòng 816) là **sai sự thật**. Nghiêm trọng hơn: một số lỗi nằm ngay trong **đoạn code đề xuất sửa** — nếu làm theo y nguyên sẽ **không chạy được**. Tài liệu này dùng làm "cơ sở ra quyết định" (mục 1) nên các lỗi事实 này làm giảm độ tin cậy của toàn bộ kế hoạch.

Bảng tóm tắt độ xác thực:

| # | Claim | Thực tế | Kết luận |
|---|-------|---------|----------|
| 1 | View tên `ScreenerRule*`, nằm `portfolio_analytics_views.py:1278-1441`, URLs không import | Tên thật `PortfolioScreenerRule*`, list/create ở `views.py:461`, URLs **đã import** 2 view nhưng thiếu `path()` | **Tên sai → fix code lỗi** |
| 2 | Type conflict presets vs rules | Đúng | ✅ |
| 3 | 10 DRF views SOC screener | Thực tế **9** view classes | ❌ Sai số lượng |
| 4 | Route/nav catalog thiếu + hardcoded route | Đúng | ✅ |
| 5 | Typo `soc.screenter.scan_started` tại dòng 121 | **Không tồn tại** — key đúng `soc.screener.scan_symbols_required` | ❌ Sai |
| 6 | ScreenerPage: 5 `as any`, 533 dòng | Đúng | ✅ |
| 7 | SocScreenerPanel: 4 `as unknown as`, 4 `alert()`, 1 `confirm()`, 344 dòng | `alert()` là **6**, không phải 4 | ⚠️ Sai số lượng |
| 8 | Legacy 414/476 dòng | Đúng | ✅ |
| 9 | `ai_advisory_helpers.py` / `screener_helpers.py` / `MarketDataService` tồn tại | Chỉ `screener_helpers.py` có; `ai_advisory_helpers.py` **không tồn tại**; `MarketDataService` **không tồn tại** | ❌ Sai |
| 10 | `DailyPrice` có `pe_ratio/market_cap/dividend_yield/eps` | Model tồn tại nhưng **không có** các trường này | ❌ Sai |

---

## 2. Lỗi nghiêm trọng (làm hỏng cả đề xuất sửa)

### 2.1. Tên view sai → code fix ở mục 2.1 & Phase 0.1 sẽ lỗi ImportError (CRITICAL)

Tài liệu bảo views tên `ScreenerRuleListCreateAPIView`, `ScreenerRuleDetailView`, `ScreenerRuleRunView` nằm trong `portfolio_analytics_views.py:1278-1441`. Thực tế mã nguồn:

- Tên thật: `PortfolioScreenerRuleDetailView` (`portfolio_analytics_views.py:1278`) và `PortfolioScreenerRuleRunView` (`portfolio_analytics_views.py:1339`).
- `ScreenerRuleListCreateAPIView` nằm ở `views.py:461`, **không** ở file kia.
- `urls.py` **đã import** 2 view trên (lines 26-27). Vấn đề đúng như doc mô tả: chỉ là **chưa có `path()`** nên 404.

→ Đoạn code đề xuất (mục 2.1, dòng 84-94) import 3 tên sai và add 3 path sẽ **raise ImportError ngay lập tức**. Phải sửa thành:
  - Đúng tên: `PortfolioScreenerRuleDetailView`, `PortfolioScreenerRuleRunView`.
  - Xác định đúng view list/create (ở `views.py`, không phải `portfolio_analytics_views.py`).
  - Giữ namespace path trùng khớp với runtime (`workspace.js:539-562` dùng `getScreenerRules` → đường dẫn `/api/portfolio/screener/rules/` là khớp).

### 2.2. `ai_advisory_helpers.py` KHÔNG tồn tại — toàn bộ Phase 3 sụp đổ premise

Mục 3.1 ("Tận dụng `ai_advisory_helpers.py` đã có") và mục 6.3 (Data Flow có `ai_advisory_helpers.py`) viết như thể file đã có. Thực tế: **file này không tồn tại** trong backend.

→ Phase 3 (5-7 ngày, "vượt commercial với AI-powered analysis") dựa trên một file ảo. Cần:
  - Xóa claim "đã có", chuyển Phase 3 thành "nghiên cứu + xây dựng từ đầu" (tăng thời gian thực tế).
  - Bổ sung task tạo `ai_advisory_helpers.py` vào Phase 3.1.
  - Risk table (mục 8) không hề nhắc đến điểm này → bổ sung rủi ro "Thiếu AI helper sẵn có".

### 2.3. `DailyPrice` KHÔNG có trường cơ bản — Phase 2.1 tính toán trên dữ liệu không tồn tại

Mục 2.1 định công thức `pe_ratio = close/eps`, `market_cap = close*shares_outstanding`, `dividend_yield = dividend_per_share/close*100`, `eps_growth_yoy`... nhưng `DailyPrice` (`market_data/models.py:63`) chỉ có: `symbol, date, open, high, low, close, volume, value, change_pct, source, is_adjusted, created_at`. **Không có** `eps`, `shares_outstanding`, `dividend_per_share`, `total_debt`, `total_equity`.

→ Mục 8 có ghi rủi ro "Cao - cần xác nhận" nhưng **Phase 2.1 và 2.5 (templates PE<20, Market cap<500B, EPS growth>20%) vẫn viết như thể data có sẵn**. Đây là mâu thuẫn nội tại: vừa thừa nhận thiếu data, vừa thiết kế tính năng dựa trên data đó.

→ Cần bổ sung rõ ràng: Phase 2 phải bắt đầu bằng **audit nguồn dữ liệu cơ bản** (từ đâu lấy PE/EPS/Market Cap? có trong bảng nào khác không?) trước khi hứa hẹn 13 field mới.

### 2.4. i18n typo "screenter" KHÔNG tồn tại → Phase 0.5 vô nghĩa

Mục 2.4 claim `SocScreenerPanel.tsx:121` dùng `t("soc.screenter.scan_started")`. Thực tế:
- Dòng 122: `t("soc.screener.scan_symbols_required")`
- Dòng 130: `t("soc.screener.scan_queued")`

Cả hai key đều **đúng chính tả** và tồn tại trong `vi.js`/`en.js`. → Task 0.5 (fix typo + add key) là **không cần thiết**; nếu làm sẽ sinh ra key thừa.

---

## 3. Lỗi nhỏ về số lượng (không chặn nhưng gây mất tin cậy)

- **Mục 3 (SOC endpoints)**: doc dùng "10 DRF views" nhiều chỗ, thực tế file `service_ops/views/screener.py` có **9** view classes (ScreenerConfigView, ScreenerRulesView, ScreenerRuleUpdateView, ScreenerRuleDeleteView, ScreenerResultsView, ScreenerAlertHistoryView, ScreenerManualScanView, ScreenerRulesRunView, ScreenerOwnershipView).
- **Mục 7 / Phụ lục A (Phase 1.4)**: doc ghi thay `alert()` "4 vị trí", thực tế `SocScreenerPanel.tsx` có **6** lần `alert()` (lines 101, 114, 122, 130, 134, 147). Task 1.4 sẽ bỏ sót 2 chỗ.

---

## 4. Vấn đề lập luận & kế hoạch

1. **Timeline quá lạc quan.** Phase 2 (10-14 ngày) hứa hẹn tính năng commercial-grade: 13 field mới (trong đó 6 fundamental **chưa có data source**), AND/OR/NOT logic, sortable/paginated table, CSV/Excel export, 10 templates, scheduled scanning (Celery beat). Riêng việc tìm nguồn fundamental data có thể tốn cả pha. Nên tách Phase 2 thành 2.1 (data audit + fundamental) và 2.2 (UX features) với buffer.

2. **`MarketDataService` không tồn tại** (mục 6.3 vẽ trong Data Flow). Thực tế chỉ có `MarketDataConfig`, `MarketDataRuntimeConfig`, `MarketDataParitySnapshot`. Cần vẽ lại sơ đồ data flow khớp với thực tế (qua `SymbolSnapshot` + `DailyPrice` + `SessionFacts` như view `PortfolioScreenerRuleRunView` đang làm).

3. **"31 filters hiện tại" chưa được xác minh** (mục 4.1, 2.1). Doc tự claim 31 (technical + whale) nhưng không liệt kê từng field. Nên đính kèm danh sách 31 field thực tế từ `screener_helpers.py` để so sánh client-side vs backend cho đúng.

4. **Mâu thuẫn risk vs plan.** Mục 8 nhận diện "Thiếu fundamental data source — Khả năng Cao" nhưng Phase 2 vẫn assign 2 ngày backend + 2 ngày frontend cho expanded filters như thể data sẵn sàng. Nên đưa data audit thành task độc lập P0.5 hoặc Phase 2.0.

5. **Câu hỏi thảo luận (mục 9) thiếu câu hỏi cốt lõi.** Không hỏi "Có nên ưu tiên sửa cho screener chạy (Phase 0) trước rồi mới quyết Phase 2/3 không?" — dù mục 3.1 ghi UI parity ~95% nhưng backend 404. Đây là quyết định quan trọng nhất mà doc để ngỏ.

---

## 5. Điểm tốt cần giữ

- So sánh commercial (mục 4.1) khách quan, không thổi phồng; bảng USP (Whale/Dark Pool, VN market focus) là argument thuyết phục để ưu tiên Phase 2.
- Phát hiện **type conflict presets vs rules** (mục 2.2, 5.4) là chính xác và quan trọng — runtime dùng `getScreenerRules`, `.d.ts` hứa `getScreenerPresets`. Đề xuất sửa `coreApiAdapter.d.ts` là đúng hướng.
- Phát hiện **route/nav catalog thiếu** (mục 2.3) chính xác, ảnh hưởng build-target gating.
- Phụ lục C (checklist verification) rất thực dụng, giúp đo tiến độ.

---

## 6. Đề xuất sửa tài liệu (action items)

| STT | Vị trí | Sửa thành |
|-----|--------|-----------|
| 1 | Mục 2.1 + Phase 0.1 | Đổi tên view thành `PortfolioScreenerRuleDetailView`/`PortfolioScreenerRuleRunView`; xác định đúng view list/create ở `views.py`; giữ path `/screener/rules/` |
| 2 | Mục 2.4 + Phase 0.5 | Xóa claim typo `screenter`; xác nhận key `soc.screener.*` đã đúng |
| 3 | Mục 3 / xuyên suốt | Đổi "10 DRF views" → "9 DRF views" |
| 4 | Mục 7 (1.4) + Phụ lục A | Đổi "4 alert()" → "6 alert()" |
| 5 | Mục 3.1 / 6.3 / Phase 3 | Xóa "Tận dụng ai_advisory_helpers.py đã có"; thêm task xây dựng helper từ đầu |
| 6 | Mục 2.1 / 2.5 / Phase 2 | Thêm bước "audit nguồn dữ liệu cơ bản" trước khi thiết kế 13 field; sửa công thức dựa trên model `DailyPrice` thực tế |
| 7 | Mục 6.3 | Vẽ lại Data Flow dùng `SymbolSnapshot`+`DailyPrice`+`SessionFacts`, bỏ `MarketDataService` ảo |
| 8 | Mục 8 (risk) | Thêm rủi ro "Thiếu AI helper sẵn có" và "Fundamental data cần nguồn mới" |
| 9 | Mục 9 | Thêm câu hỏi ưu tiên Phase 0 (cho chạy được) trước Phase 2/3 |
| 10 | Mục 4.1 / 2.1 | Đính kèm danh sách 31 field thực tế từ `screener_helpers.py` |

---

*Phản biện này đối chiếu trực tiếp với mã nguồn tại thời điểm 2026-07-10. Các claim được xác minh qua explore agent quét `packages/core/backend/` và `packages/web/`. Tài liệu gốc vẫn có giá trị định hướng cao sau khi sửa các lỗi事实 nêu trên.*
