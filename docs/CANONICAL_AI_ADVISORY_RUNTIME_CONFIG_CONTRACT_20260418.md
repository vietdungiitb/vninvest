# Canonical Contract: AI Advisory Runtime Config (SSOT)

## 1. Mục tiêu
Tài liệu này là nguồn sự thật duy nhất cho contract runtime config của AI Advisory.
Mọi module backend/frontend phải tuân thủ tài liệu này khi triển khai hoặc tích hợp.

## 2. Phạm vi áp dụng
- Regenerate executive summary cho AI Advisory.
- Tất cả endpoint/module có gọi luồng build prompt context cho AI Advisory.
- UI cấu hình nguồn dữ liệu trong StockDetail và các màn hình khác tái sử dụng cùng contract.

## 3. Canonical API Contract

### 3.1 Endpoint chuẩn
- Canonical endpoint mới: `POST /api/portfolio/regenerate-executive-summary/`
- Legacy endpoint hiện hữu vẫn hỗ trợ trong giai đoạn migration:
  - `POST /api/stock-management/stocks/{symbol}/ai-advisory-summary/regenerate/`

### 3.2 Chiến lược tương thích
- Cả endpoint canonical và legacy đều phải đi qua cùng một pipeline service trung tâm.
- Legacy endpoint nhận payload cũ và payload mới; nếu payload cũ thì chuẩn hóa về schema canonical trước khi xử lý.

### 3.3 Request body canonical (v2)
```json
{
  "symbol": "MWG",
  "synthesis_preference": "balanced",
  "prompt_config": {
    "version": 2,
    "sources": {
      "whale": {"enabled": true, "lookback": 180, "lookback_unit": "day"},
      "dark_flow": {"enabled": true, "lookback": 90, "lookback_unit": "day"},
      "technical": {
        "enabled": true,
        "lookback": 30,
        "lookback_unit": "session",
        "indicators": ["vols", "prices", "cdms", "ma20", "ma50", "rsi", "bollinger", "snapshot"]
      },
      "news": {"enabled": true, "lookback": 14, "lookback_unit": "day"},
      "market": {"enabled": true, "lookback": 7, "lookback_unit": "day"},
      "fundamental": {"enabled": false, "lookback": 1, "lookback_unit": "quarter"},
      "ownership": {"enabled": false, "lookback": 365, "lookback_unit": "day"},
      "sector": {"enabled": false, "lookback": 60, "lookback_unit": "session"}
    }
  }
}
```

### 3.4 Technical indicators enum
- `vols`
- `prices`
- `cdms`
- `ma20`
- `ma50`
- `rsi`
- `bollinger`
- `snapshot`

## 4. Source Registry chuẩn

| source_id | default_enabled | min_lookback | max_lookback | lookback_unit | ghi chú |
| :--- | :---: | :---: | :---: | :--- | :--- |
| whale | true | 1 | 365 | day | Whale activity context |
| dark_flow | true | 1 | 365 | day | Dòng tiền ngầm |
| technical | true | 1 | 180 | session | Bắt buộc indicators nếu enabled |
| news | true | 1 | 30 | day | Tin tức và sentiment |
| market | true | 1 | 30 | day | Bối cảnh thị trường |
| fundamental | false | 1 | 8 | quarter | Mặc định lấy quý gần nhất |
| ownership | false | 1 | 365 | day | Insider/organization ownership |
| sector | false | 1 | 180 | session | So sánh tương quan ngành |

Ghi chú chuẩn hóa:
- `sector` mặc định là `false`.
- `technical` dùng đơn vị `session`.
- `fundamental` dùng đơn vị `quarter`.

## 5. Validation Rules (Backend bắt buộc)
1. `prompt_config.version` bắt buộc là số nguyên, hiện hỗ trợ `2`.
2. `sources` bắt buộc là object, mọi source không khai báo sẽ dùng default từ registry.
3. Nếu source `enabled=true`, `lookback` phải nằm trong min/max của source đó.
4. `lookback_unit` phải đúng với source theo registry chuẩn.
5. Nếu `technical.enabled=true`:
   - `indicators` bắt buộc là mảng không rỗng.
   - Mọi phần tử phải nằm trong enum đã công bố.
6. Nếu `technical.enabled=false`, backend bỏ qua `indicators` khi build context.
7. Nếu tất cả source `enabled=false`, trả lỗi validation 400 với mã `empty_prompt_sources`.

## 6. Runtime Behavior Rules
1. Chỉ build context cho source đang bật.
2. Context technical chỉ chứa block tương ứng với indicator được chọn.
3. Token budget áp dụng qua hàm truncate tập trung ở service lõi.
4. Nếu thiếu dữ liệu nguồn, trả fallback text chuẩn, không để block rỗng.

## 7. Migration Map (Pre-code)

### 7.1 Hiện trạng đã rà
- Luồng regenerate đang vận hành tại:
  - `backend/portfolio/views_ai_advisory_components_summary.py`
  - Hàm gọi AI tổng hợp: `backend/portfolio/ai_advisory_helpers.py::_sprint17_generate_executive_synthesis_with_ai`
- Frontend gọi regenerate từ:
  - `frontend/src/pages/StockDetail.jsx`
  - API client: `frontend/src/api/client.js`

### 7.2 Đích kiến trúc
- Tạo service trung tâm, ví dụ `AdvisoryPromptRuntimeService`, chịu trách nhiệm:
  - Parse/normalize/validate `prompt_config`
  - Build context theo source registry
  - Truncate/fallback
- Cả endpoint canonical và legacy phải gọi service này.

## 8. Definition of Ready trước coding
- [x] Chốt nguyên tắc SSOT trong Spec và Plan.
- [x] Chốt canonical schema v2 và source registry.
- [x] Chốt quy tắc validation cho technical multi-select.
- [x] Chốt chiến lược tương thích endpoint legacy/canonical.
- [x] Chốt migration map backend/frontend.
- [x] Chốt tiêu chí nghiệm thu liên module.
- [ ] Chủ dự án xác nhận chính thức để bắt đầu coding.

## 9. Tiêu chí nghiệm thu sau coding (để tham chiếu)
1. Tất cả module regenerate AI advisory đi qua một pipeline trung tâm.
2. Không còn duplicate prompt builder ngoài service lõi.
3. Frontend gửi `prompt_config` canonical và backend xử lý đúng theo source registry.
4. Có test validation cho technical indicators và lookback unit/range.
5. Có test compatibility cho legacy endpoint.
