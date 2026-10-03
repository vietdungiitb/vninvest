# Đặc tả Kỹ thuật: Runtime Prompt Source Configuration (AI Advisory)

## 1. Tổng quan
Tài liệu này hướng dẫn chi tiết cách triển khai tính năng cấu hình nguồn dữ liệu đầu vào cho Prompt của AI Advisory tại Runtime. Đội phát triển có thể căn cứ vào đây để thực hiện backend và frontend.

---

## 2. API Contract (Backend)

> [!IMPORTANT]
> Canonical contract chính thức cho schema/rules/registry được định nghĩa tại `docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md`.
> Nếu có khác biệt giữa ví dụ trong tài liệu này và canonical contract, ưu tiên canonical contract.

### A. Endpoint
`POST /api/portfolio/regenerate-executive-summary/`

### B. Request Body Schema
Hệ thống sẽ gửi kèm một object `prompt_config` trong body:

```json
{
  "symbol": "MWG",
  "prompt_config": {
    "sources": {
      "whale": {"enabled": true, "lookback": 180},
      "dark_flow": {"enabled": true, "lookback": 90},
      "technical": {
        "enabled": true, 
        "lookback": 30,
        "indicators": ["vols", "prices", "cdms", "ma20", "ma50", "rsi", "bollinger", "snapshot"]
      },
      "news": {"enabled": true, "lookback": 14},
      "market": {"enabled": true, "lookback": 7},
      "fundamental": {"enabled": false, "lookback": 0},
      "ownership": {"enabled": false, "lookback": 365},
      "sector": {"enabled": true, "lookback": 60}
    }
  }
}
```

### C. Logic Xử lý tại Backend (`ai_advisory_helpers.py`)
1. **Kiểm tra Flag**: Trong hàm `_sprint17_generate_executive_synthesis_with_ai`, duyệt qua danh sách `sources`.
2. **Loại bỏ Context (Filtering)**: Nếu `enabled: false`, tuyệt đối không gọi hàm build context tương ứng và không đưa đoạn text đó vào Prompt.
3. **Tham số Lookback**: Truyền giá trị `lookback` vào các hàm xử lý dữ liệu. Ví dụ: `_build_whale_context_for_prompt(user, symbol, lookback_days=config['whale']['lookback'])`.

---

## 3. Chi tiết 8 Nguồn dữ liệu

### 1-5: Nguồn Hiện có (Refactor)
- **Whale Activity**: Điều chỉnh `lookback_days` theo cấu hình.
- **Dark Money Flow**: Điều chỉnh `lookback_days` theo cấu hình.
- **Technical Analysis**: 
    - Điều chỉnh số phiên (`lookback_sessions`).
    - **Granular Control**: Chỉ đưa vào prompt các thành phần được chọn trong danh sách `indicators`.
    - Các flag cụ thể:
        - `vols`: Phân tích khối lượng, RVOL, volume trend.
        - `prices`: Price action, nến Nhật, support/resistance.
        - `cdms`: Current Daily Market Status (trạng thái động lượng trong ngày).
        - `ma20`/`ma50`: Đường trung bình động ngắn và trung hạn.
        - `rsi`: Chỉ báo quá mua/quá bán.
        - `bollinger`: Dải Bollinger và vị trí giá so với dải.
        - `snapshot`: Tổng quan ngắn gọn (Overview).
- **News Sentiment**: Lọc tin tức trong khoảng `lookback` ngày gần nhất.
- **Market Context**: Lấy lịch sử khuyến nghị cũ (`executive_summaries`) trong khoảng ngày quy định.

### 6-8: Nguồn Mới (Implementation Required)
- **Fundamental Health**:
    - Lấy dữ liệu từ bảng tài chính (EPS, P/E, P/B, Debt/Equity).
    - AI Instruction: "Phân tích sức khỏe tài chính dựa trên các chỉ số cơ bản mới nhất."
- **Ownership Insights**:
    - Truy vấn giao dịch của cổ đông lớn và ban lãnh đạo (Insider Trading).
    - AI Instruction: "Đánh giá động thái của ban lãnh đạo và các tổ chức lớn."
- **Sector Relative**:
    - So sánh % biến động của mã hiện tại với chỉ số ngành (Sector Index) hoặc VNIndex.
    - AI Instruction: "Đánh giá sức mạnh tương đối so với nhóm ngành và thị trường chung."

---

## 4. Giao diện người dùng (Frontend)

### A. UI Control
- **Button**: Nút "Tùy chỉnh Nguồn AI" đặt tại mục `Advanced` của component `StockDetailsAdvisory`.
- **Drawer**: Sử dụng `Ant Design Drawer` hoặc `Tailwind Modal`.
- **Items**:
    - Mỗi nguồn là một `Card` hoặc `List Item`.
    - Có `Switch` để Bật/Tắt (màu xanh thương hiệu VNInvest).
    - Khi Bật, hiển thị `Slider` bên dưới với dải giá trị `1 - 365`.
    - Tooltip giải thích ý nghĩa của nguồn dữ liệu đó.

### B. Persistance Strategy
- Cấu hình được lưu vào `localStorage` dưới key `vninvest_ai_prompt_settings`.
- Khi người dùng bấm "Refresh AI", frontend sẽ đọc từ `localStorage` để gửi lên API.

---

## 5. Rào cản Kỹ thuật (Guardrails)
- **Token Limit**: Nếu người dùng bật tất cả 8 nguồn với lookback 365 ngày, prompt có thể vượt quá 10,000 tokens. 
    - **Giải pháp**: Phía Backend cần có hàm `_truncate_context` để đảm bảo context quan trọng luôn được giữ lại.
- **Data Gap**: Một số mã không có dữ liệu Ownership hoặc Fundametal.
    - **Giải pháp**: Nếu truy vấn trả về rỗng, hàm helper trả về chuỗi: `"Dữ liệu [Source] hiện chưa khả dụng cho mã này."` thay vì để trống.

---

## 6. Checklist cho đội Dev
- [ ] Cập nhật Serializer để handle `prompt_config`.
- [ ] Refactor helpers trong `ai_advisory_helpers.py`.
- [ ] Viết hàm build context cho 3 nguồn dữ liệu mới.
- [ ] Xây dựng UI Drawer tại frontend.
- [ ] Kết nối State của Drawer với API call `regenerate`.
- [ ] Tuân thủ đầy đủ canonical contract tại `docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md`.

---

## 7. Nguyên tắc Kiến trúc Bắt buộc (Single Source of Truth)

Do chức năng AI Advisory được dùng ở nhiều module, bắt buộc áp dụng mô hình **một nguồn sự thật duy nhất (SSOT)** cho toàn bộ luồng Runtime Prompt Config.

### A. Ràng buộc Kiến trúc
- Toàn bộ module chỉ được dùng một service lõi duy nhất để xử lý `prompt_config` và build prompt context.
- Cấm viết bản sao logic theo từng module (copy/paste helper, xử lý riêng trong view khác, hoặc biến thể cục bộ).
- Mọi thay đổi về sources, indicators, lookback rules chỉ được khai báo một nơi trong registry trung tâm.

### B. Thành phần Bắt buộc
- **Core Runtime Service** (ví dụ: `AdvisoryPromptRuntimeService`):
  - Validate và normalize payload `prompt_config`.
  - Điều phối build context theo từng source và technical indicators.
  - Áp dụng guardrails dùng chung (`_truncate_context`, fallback data gap).
- **Shared Schema/Contract**:
  - Dùng chung một schema serializer cho tất cả endpoint/module gọi AI Advisory.
  - Các module legacy phải map về schema chuẩn này qua compatibility layer.
- **Source Registry Trung tâm**:
  - Lưu default state, range lookback, đơn vị lookback và metadata giải thích nguồn/chỉ báo.
  - Frontend UI và backend validation cùng đọc từ một định nghĩa chuẩn.

### C. Quy tắc Tích hợp Liên Module
- Các module chỉ được gọi qua interface service dùng chung; không tự build prompt text trong module cục bộ.
- Khi nâng cấp indicator hoặc nguồn dữ liệu, triển khai một lần tại service trung tâm và tự động có hiệu lực toàn hệ thống.
- Thêm test liên module để xác nhận cùng một input config cho hành vi nhất quán ở mọi nơi sử dụng AI Advisory.

### D. Điều kiện Nghiệm thu SSOT
- Không còn helper build prompt trùng lặp ngoài service trung tâm.
- Mọi endpoint AI Advisory liên quan runtime config đều đi qua cùng pipeline chuẩn.
- Có kiểm thử regression bảo vệ contract chung và hành vi đồng nhất giữa nhiều module gọi.

---
*Tài liệu này được phê duyệt bởi Antigravity AI Architect vào ngày 18/04/2026.*
