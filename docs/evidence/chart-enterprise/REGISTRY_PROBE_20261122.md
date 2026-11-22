# Bằng chứng — Registry `@vninvestcharts` probe (2026-11-22)

> Dùng `GITHUB_TOKEN` do Owner cung cấp, **transient qua ENV**, không ghi vào repo/file/log.
> Token đã xuất hiện trong lịch sử chat ⇒ khuyến nghị **rotate sau khi dùng xong**.

## 1. Bản có trên registry (lệnh: `npm view <pkg> versions --json`)

| Package | Versions mới nhất | Ghi chú |
|---|---|---|
| `@vninvestcharts/widget` | **0.4.6** | **KHÔNG có 0.4.7** (demo chạy build local tại commit `ddc947dd`) |
| `@vninvestcharts/widget-pro` | **0.4.5** | Mọi bản 0.4.3/0.4.4/0.4.5 đều pin `@vninvestcharts/widget: 0.4.3` |
| `@vninvestcharts/engine-core` | 0.5.8 | widget 0.4.6 cần `^0.5.6` ✅ |
| `@vninvestcharts/engine-drawing` | 0.5.7 | widget 0.4.6 cần `^0.5.6` ✅ |
| `@vninvestcharts/engine-react` | 0.5.8 | widget 0.4.6 cần `^0.5.6` ✅ |
| `@vninvestcharts/engine-pro` | 0.5.2 | widget-pro pin `0.4.1` (xem mục 3) |

## 2. Widget 0.4.6 trên registry có gì / thiếu gì

Tải `npm pack @vninvestcharts/widget@0.4.6` vào temp (ngoài repo, **không** `npm install`),
giải nén rồi quét 735 file:

| Chuỗi | Số hit | Kết luận |
|---|---|---|
| `subscriptionTier` | 5 | **CÓ** — bản registry đã có fix envelope/`tier_code` (F3 của gap report) |
| `tier_code` | 10 | **CÓ** — đọc được `tier_code` flat lẫn trong `data` (`dist/index.js`, `extractPlan`) |
| `enterprise` | 157 | CÓ (khái niệm/marker) |
| `/api/v1/entitlement` | **0** | **THIẾU** — không có preload entitlement same-origin như demo |
| `enterpriseBinding` | **0** | **THIẾU** — không có prop binding dock enterprise |
| `EnterpriseDockProvider` | **0** | **THIẾU** — không mount được 6 dock tab enterprise |
| `fetchWhaleCampaigns` | **0** | **THIẾU** — adapter enterprise chưa có |
| `fetchOrderbookDepth` | **0** | **THIẾU** — adapter enterprise chưa có |

⇒ **D2 (chosen registry) KHÔNG đạt parity với demo**: 0.4.6 là bản có WIDGET_SAAS_TIER nhưng
**chưa có** E0–E5/enterprise dock (những cái đó chỉ nằm ở source 0.4.7 / build demo).

## 3. Xung đột dependency D2 × D4 (blocker)

```
npm view @vninvestcharts/widget-pro@0.4.5 dependencies --json
→ { "@vninvestcharts/engine-pro": "0.4.1", "@vninvestcharts/widget": "0.4.3" }
```

Cả 3 bản `widget-pro` công khố (0.4.3/0.4.4/0.4.5) đều **pin cứng widget@0.4.3**.
Chọn widget `0.4.6` (D2) + widget-pro `0.4.5` (D4) ⇒ xung đột dependency, không cài được
mà không ép override (override có nguy cơ vỡ API vì widget-pro biên dịch theo 0.4.3).

## 4. Hệ quả cho kế hoạch

| Quyết định Owner | Vấn đề | Cần quyết thêm |
|---|---|---|
| D2 = registry token | Registry tối đa 0.4.6, thiếu entitlement-preload + enterprise dock | **D2b**: chấp nhận 0.4.6 + tự wiring phía host, hay yêu cầu widget team publish 0.4.7, hay dùng build local dù đã loại phương án này? |
| D4 = widget-pro ngay | pin widget@0.4.3 xung đột 0.4.6 | **D4b**: dùng widget@0.4.3 (mất tính năng 0.4.6), ép override (rủi ro), hay defer widget-pro tới khi có bản tương thích? |

## 5. Lệnh tái hiện (không chứa token)

```powershell
$env:GITHUB_TOKEN='<transient>'
npm view @vninvestcharts/widget versions --json
npm view @vninvestcharts/widget-pro@0.4.5 dependencies --json
npm pack @vninvestcharts/widget@0.4.6 --pack-destination <temp>
# giải nén rồi quét chuỗi như mục 2
```

## 6. Trạng thái

**CHƯA có quyết định D2b/D4b.** Không bump dependency, không `npm install`, không viết code.
Plan/consensus đã ghi reservation tương ứng; gate B4→B5 tạm **đóng lại** cho tới khi Owner chốt.
