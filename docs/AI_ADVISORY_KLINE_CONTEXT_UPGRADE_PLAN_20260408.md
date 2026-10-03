# AI Advisory + Kline Context Upgrade Plan (2026-04-08)

## 1) Muc tieu
- Dam bao khi user tao AI tab trong trang stock detail, he thong co the truyen du lieu so tu chart hien tai de AI hieu dung boi canh.
- Giam hallucination va tang do khop giua noi dung advisory va chart user dang nhin.
- Van giu duoc hieu nang, bao mat, va kha nang fallback neu chart context khong day du.

## 2) Van de hien tai (baseline)
- Frontend hien tai chi gui symbol + timeframe khi goi API generate AI components.
- AI prompt cho component generation chua nhan chart snapshot data (ohlcv window, indicator state, viewport state).
- Backend build context dua tren du lieu tong hop (daily/intraday/order-flow) tu database, khong phai exact chart state tren UI.
- Screenshot chart hien tai chi dung de download local, chua co luong upload/gui anh cho AI.

## 2.1 Thuc trang da xac minh
- Da fix xong loi toggle indicator tren KlineChart (MACD/RSI/VOL... tat la an dung).
- Chua co payload image trong request tao AI tab.
- Chua co response flag xac nhan AI da su dung chart-context.

## 3) Pham vi nang cap
In scope:
- Nang cap API generate AI components de nhan chart context payload.
- Frontend thu thap va gui chart context khi user bam "Tao tab AI".
- Backend validate, sanitize, va dua chart context vao prompt.
- Them telemetry + test + rollout canary.

Out of scope (phase sau):
- Fine-tuning model.
- OCR tu anh screenshot chart.
- Full multi-modal advisory.

## 4) Dinh nghia du lieu can truyen
### 4.1 Payload chart_context (de xuat)
{
  "timeframe": "30m",
  "chart_context": {
    "symbol": "VNM",
    "chart_timeframe": "30m",
    "visible_range": {
      "from_ts": 1712500000000,
      "to_ts": 1712507200000
    },
    "ohlcv": [
      { "ts": 1712500000000, "o": 70.1, "h": 70.3, "l": 69.9, "c": 70.0, "v": 120000 },
      { "ts": 1712501800000, "o": 70.0, "h": 70.4, "l": 69.8, "c": 70.2, "v": 98000 }
    ],
    "active_indicators": {
      "MA": true,
      "VOL": true,
      "MACD": true,
      "RSI": false,
      "BOLL": false
    },
    "computed_metrics": {
      "change_visible_pct": 1.35,
      "atr_estimate": 0.42,
      "volatility_visible": 0.87,
      "volume_ratio_vs_20": 1.21
    },
    "drawing_meta": {
      "overlay_count": 2,
      "types": ["line", "rect"]
    },
    "client_generated_at": "2026-04-08T09:30:00+07:00"
  }
}

### 4.2 Gioi han payload
- ohlcv toi da 300 diem.
- kich thuoc JSON <= 64 KB.
- bo qua truong khong hop le, fallback ve context hien co.

### 4.3 Image policy (phase sau)
- Phase 1: khong gui anh, chi gui du lieu so (de nhanh va an toan).
- Phase 2 (optional): gui image_url da upload object storage (khong gui base64 truc tiep neu payload lon).
- Neu provider khong ho tro vision: bo qua image, van dung chart_context dang so.

## 5) Thiet ke backend
### 5.1 API contract
Endpoint: POST /api/stock-management/stocks/{symbol}/ai-advisory-components/generate/

Thay doi:
- Nhan them chart_context (optional).
- Validate schema + clamp values.
- Neu chart_context invalid: khong fail cứng, warning + fallback.

### 5.2 Validation layer
Tao serializer moi: StockAIChartContextSerializer
- Validate timestamp, number ranges, length arrays.
- Validate symbol trong payload phai trung symbol URL.
- Strip fields la, limit precision de tranh prompt bloat.

### 5.3 Prompt builder
Cap nhat ham _sprint17_generate_component_templates_with_ai:
- Them "chart_context_block" vao prompt.
- Uu tien du lieu visible_range + ohlcv + indicators truoc dark_flow.
- Neu chart_context co metric mau thuan voi backend context, prompt can ghi ro "uu tien chart visible range cua user".

### 5.4 Logging/Observability
Them event telemetry:
- advisory.chart_context.present (bool)
- advisory.chart_context.ohlcv_points (int)
- advisory.chart_context.payload_bytes (int)
- advisory.chart_context.used_in_prompt (bool)
- advisory.chart_context.validation_error_count (int)

## 6) Thiet ke frontend
### 6.1 Thu thap chart context
Tai StockDetail + KLineChart component:
- expose method lay visible range.
- expose active indicators state hien tai.
- lay du lieu ohlcv dang apply vao chart (subset theo visible range).
- tinh nhanh metrics local (change %, volatility visible, volume ratio).

### 6.2 Goi API generate
Khi bam "Tao tab AI":
- payload gui timeframe + chart_context.
- neu thu thap chart_context loi: van goi API voi payload cu (symbol + timeframe).

### 6.3 UX
- Hien badge "AI da doc chart hien tai" khi backend confirm used_in_prompt=true.
- Hien thong bao fallback nhe neu chart_context khong hop le.

## 7) Bao mat va an toan
- Khong gui screenshot binary o phase nay.
- Khong gui thong tin nhay cam user.
- Clamp so luong point + max payload bytes de tranh abuse.
- Bo sung ratelimit rieng neu can (advisory_generate_with_chart_context).

## 8) Ke hoach test
### 8.1 Backend unit/integration
- test serializer validate pass/fail.
- test symbol mismatch -> warning + fallback.
- test payload oversize -> trim/reject theo rule.
- test prompt co chart_context_block khi du lieu hop le.

### 8.2 Frontend
- test buildChartContext tra dung schema.
- test click generate gui dung payload.
- test fallback khi chart ref null.

### 8.3 E2E
- Case 1: chart_context day du -> advisory message co mention indicator/visible trend.
- Case 2: chart_context khong day du -> van tao tab thanh cong.
- Case 3: payload invalid -> he thong khong crash.

## 9) Rollout 2 giai doan
### Giai doan A (1 sprint)
- Ship API + validation + FE payload + prompt support.
- Feature flag: AI_ADVISORY_ENABLE_CHART_CONTEXT=true/false.
- Canary 10% user pro.

### Giai doan B (1 sprint)
- Toi uu prompt + telemetry dashboard.
- Bat 100% neu KPI dat.

## 9.1 Ke hoach phase chi tiet de trien khai
### Phase P0 (1-2 ngay): Hardening co so
- Hoan tat fix Kline indicator toggle/remove (DONE).
- Kiem tra regression toolbar chart + screenshot + fullscreen.
- Chot schema chart_context v1 va gioi han payload.

### Phase P1 (3-5 ngay): Chart numeric context
- FE: thu thap visible OHLCV + indicator state + viewport + metrics.
- BE: validate serializer + sanitize + inject prompt block.
- API response: them `chart_context_used` va `chart_context_warnings`.
- QA: smoke + regression + E2E generate tab.

### Phase P2 (2-4 ngay, optional): Vision image context
- FE: upload screenshot len storage, gui image_url kem chart_context.
- BE: route theo provider capability (vision/non-vision).
- Prompt strategy: uu tien so lieu, image chi de bo sung boi canh.
- Add safety gate theo feature flag.

## 10) KPI chap nhan
- >= 95% request generate tab co chart_context hop le.
- p95 latency tang khong qua 15% so voi baseline.
- Ti le advisory bi user danh gia "khong dung chart" giam >= 25%.
- Ti le generate fail khong tang qua 1% tuyet doi.

## 11) RACI de xuat
- FE owner: 1 dev (StockDetail + KLine integration)
- BE owner: 1 dev (API contract + serializer + prompt)
- QA owner: 1 tester (regression + E2E)
- Product/AI owner: 1 nguoi review chat quality

## 12) Work breakdown chi tiet
1. Backend schema + serializer + tests.
2. Backend prompt injection + telemetry + tests.
3. Frontend chart context collector + API integration.
4. Frontend UX badges + fallback states.
5. E2E test scripts + canary rollout.
6. KPI tracking + tuning prompt.

## 12.1 Checklist implementation theo team
### Backend
- [ ] Tao `StockAIChartContextSerializer` validate payload.
- [ ] Cap nhat `stock_ai_advisory_components_generate_api` nhan `chart_context`.
- [ ] Cap nhat `_sprint17_generate_component_templates_with_ai` de nhan chart context block.
- [ ] Them response fields: `chart_context_used`, `chart_context_warnings`.
- [ ] Them telemetry fields cho dashboard observability.
- [ ] Viet tests: valid payload, invalid payload fallback, oversize payload.

### Frontend
- [ ] Expose helper build chart context tu `KLineChartComponent`.
- [ ] Gui payload moi khi bam "Tao tab AI".
- [ ] Hien badge "AI da doc chart hien tai" khi `chart_context_used=true`.
- [ ] Hien warning nhe khi backend fallback.
- [ ] Test toggle indicators + generate AI tab trong cung session.

### QA
- [ ] Functional test cho tung indicator toggle.
- [ ] API contract test voi/khong co chart_context.
- [ ] E2E cho symbol VNM/VCB/FPT voi 3 timeframe.
- [ ] Performance check p95 truoc/sau rollout.

## 13) Rui ro va giam thieu
- Rui ro prompt qua dai: gioi han point + compact format.
- Rui ro mismatch du lieu chart va backend: uu tien visible range, log discrepancy.
- Rui ro hieu nang: benchmark truoc/sau, toi uu JSON compact.
- Rui ro quality khong tang: A/B test advisory text co/khong chart_context.

## 14) Tieu chi Done
- API generate nhan chart_context va pass full test.
- Frontend gui payload chart_context on-demand.
- Advisory tao ra co dau vet da su dung chart context (telemetry + response flag).
- Docs cap nhat va team QA sign-off.

## 15) De xuat implementation order (de tranh block)
1. Merge fix Kline indicator (hoan tat).
2. Implement BE serializer + API contract truoc.
3. Implement FE chart_context payload theo contract da chot.
4. Bat feature flag cho internal/staging.
5. Chay E2E + tuning prompt, sau do canary production.

## 16) Tai lieu taskboard trien khai
- Xem board chi tiet ticket-ready tai:
  - docs/AI_ADVISORY_KLINE_CONTEXT_TASKBOARD_20260408.md
