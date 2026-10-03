# AI Advisory + Kline Context Taskboard (2026-04-08)

## 1) Muc tieu taskboard
- Chuyen ke hoach nang cap thanh backlog co the giao viec ngay.
- Giam block giua FE/BE/QA bang dependency ro rang.
- Dam bao rollout an toan voi feature flag + canary.

## 2) Sprint scope de xuat
- Sprint A: P0 + P1 core (khong image).
- Sprint B: P1 hardening + P2 optional vision image.

## 3) Nhom cong viec va estimate
Tong effort de xuat:
- Backend: 5.5-7.5 dev-days
- Frontend: 4.5-6.0 dev-days
- QA: 3.0-4.0 qa-days
- DevOps/Release: 1.0-1.5 devops-days

## 4) Ticket backlog chi tiet
### B0-01: API contract chart_context v1
- Team: Backend
- Estimate: 0.5 day
- Priority: P0
- Mo ta:
  - Chot schema chart_context v1 va max payload bytes.
  - Chot response fields: chart_context_used, chart_context_warnings.
- Output:
  - Contract doc trong code comments + example request/response.
- Acceptance criteria:
  - Team FE/QA xac nhan schema khong mo ho.

### B0-02: StockAIChartContextSerializer
- Team: Backend
- Estimate: 1.0 day
- Priority: P0
- Dependencies: B0-01
- Mo ta:
  - Tao serializer validate cac field: visible_range, ohlcv, indicators, metrics.
  - Clamp data: max 300 points, numeric range, timestamp validity.
- Acceptance criteria:
  - Payload hop le pass.
  - Payload invalid tra warning/fallback theo rule da chot.

### B0-03: Update advisory components generate API
- Team: Backend
- Estimate: 1.0 day
- Priority: P0
- Dependencies: B0-02
- Mo ta:
  - Cap nhat endpoint generate components nhan chart_context optional.
  - Inject chart_context vao pipeline generation.
  - Return response fields: chart_context_used, chart_context_warnings.
- Acceptance criteria:
  - Khong co chart_context van hoat dong nhu cu.
  - Co chart_context hop le thi chart_context_used=true.

### B0-04: Prompt block injection for AI component generation
- Team: Backend
- Estimate: 1.0 day
- Priority: P0
- Dependencies: B0-03
- Mo ta:
  - Cap nhat helper generation prompt de them chart_context_block compact.
  - Uu tien visible-range trend va indicator state trong prompt.
- Acceptance criteria:
  - Prompt builder co test xac nhan co/no chart block theo input.

### B0-05: Backend telemetry and observability
- Team: Backend
- Estimate: 0.75 day
- Priority: P1
- Dependencies: B0-03
- Mo ta:
  - Add telemetry fields:
    - advisory.chart_context.present
    - advisory.chart_context.ohlcv_points
    - advisory.chart_context.payload_bytes
    - advisory.chart_context.used_in_prompt
    - advisory.chart_context.validation_error_count
- Acceptance criteria:
  - Dashboard co the filter theo chart_context_used.

### F0-01: Expose chart context collector in StockDetail/KLine
- Team: Frontend
- Estimate: 1.5 day
- Priority: P0
- Dependencies: B0-01
- Mo ta:
  - Them helper buildChartContext() lay du lieu tu chart instance.
  - Include: ohlcv visible range, active indicators, viewport, derived metrics.
- Acceptance criteria:
  - buildChartContext tra schema dung theo contract v1.

### F0-02: Send chart_context when generate AI tabs
- Team: Frontend
- Estimate: 1.0 day
- Priority: P0
- Dependencies: F0-01, B0-03
- Mo ta:
  - Cap nhat call generate components de gui timeframe + chart_context.
  - Fallback to old payload neu collector fail.
- Acceptance criteria:
  - Network payload dung schema.
  - Khong pha vo flow hien tai.

### F0-03: UX states for context usage
- Team: Frontend
- Estimate: 1.0 day
- Priority: P1
- Dependencies: F0-02
- Mo ta:
  - Hien badge khi chart_context_used=true.
  - Hien warning nhe neu fallback xay ra.
- Acceptance criteria:
  - User thay ro AI co doc chart hien tai hay khong.

### F0-04: Regression hardening for Kline indicator toolbar
- Team: Frontend
- Estimate: 0.75 day
- Priority: P0
- Dependencies: none
- Mo ta:
  - Verify tat/bat tat ca indicator button hoat dong on dinh.
  - Verify khong conflict voi screenshot/fullscreen/drawing.
- Acceptance criteria:
  - MACD/RSI/VOL/others tat la an dung pane.

### Q0-01: API contract test suite
- Team: QA + Backend support
- Estimate: 1.0 day
- Priority: P0
- Dependencies: B0-03
- Mo ta:
  - Test matrix: co context, khong context, context invalid, context oversize.
- Acceptance criteria:
  - Tat ca case co expected behavior ro rang.

### Q0-02: E2E stock detail to AI tab flow
- Team: QA
- Estimate: 1.0 day
- Priority: P0
- Dependencies: F0-02
- Mo ta:
  - E2E tren VNM/VCB/FPT voi 3 timeframe.
  - Verify advisory output co tinh lien quan den chart visible trend.
- Acceptance criteria:
  - Pass tren staging voi screenshot/chung cu log.

### Q0-03: Performance and stability checks
- Team: QA + DevOps
- Estimate: 1.0 day
- Priority: P1
- Dependencies: B0-05, F0-03
- Mo ta:
  - So sanh p95 latency truoc/sau.
  - Verify fail-rate khong vuot nguong.
- Acceptance criteria:
  - p95 tang <= 15%, fail-rate tang <= 1% absolute.

### R0-01: Feature flag and canary rollout
- Team: DevOps + Backend
- Estimate: 1.0 day
- Priority: P0
- Dependencies: B0-03, F0-02
- Mo ta:
  - Them flag AI_ADVISORY_ENABLE_CHART_CONTEXT.
  - Canary 10% user pro, monitor 24-48h.
- Acceptance criteria:
  - Co rollback switch nhanh, khong can hotfix code.

## 5) Optional Phase P2 tickets (vision image)
### B2-01: Image capability routing by provider
- Team: Backend
- Estimate: 1.0 day
- Priority: P2
- Dependencies: P1 complete
- Mo ta:
  - Detect provider co vision hay khong.
  - Neu non-vision: bo qua image, dung numeric context.

### F2-01: Screenshot upload flow
- Team: Frontend
- Estimate: 1.5 day
- Priority: P2
- Dependencies: B2-01
- Mo ta:
  - Upload screenshot len object storage.
  - Gui image_url vao payload thay vi base64.

### Q2-01: Vision fallback test matrix
- Team: QA
- Estimate: 0.75 day
- Priority: P2
- Dependencies: F2-01
- Mo ta:
  - Test provider vision/non-vision va fallback behavior.

## 6) Dependency map ngan gon
- B0-01 -> B0-02 -> B0-03 -> B0-04 -> B0-05
- B0-01 -> F0-01 -> F0-02 -> F0-03
- B0-03 + F0-02 -> Q0-01 + Q0-02
- B0-05 + F0-03 -> Q0-03
- B0-03 + F0-02 -> R0-01

## 7) Definition of Ready
- Schema chart_context v1 da chot.
- Feature flag strategy da chot.
- Owner tung ticket da duoc assign.

## 8) Definition of Done
- Ticket pass test va co evidence.
- Co release note ngan cho thay doi API/UX.
- Monitoring dashboard co data sau release.

## 9) KPI gate truoc khi mo rong 100%
- >=95% request generate tab co chart_context hop le.
- p95 latency tang <=15%.
- failure rate tang <=1% absolute.
- quality complaint "AI khong dung chart" giam >=25%.

## 10) De xuat thu tu vao viec ngay
1. B0-01, B0-02 song song voi F0-04.
2. B0-03 + F0-01 + F0-02.
3. B0-04 + F0-03.
4. Q0-01 + Q0-02 + Q0-03.
5. R0-01 canary, danh gia KPI, quyet dinh P2.

## 11) Link execution tracker
- Theo doi theo ngay va owner tai:
  - docs/AI_ADVISORY_KLINE_CONTEXT_EXECUTION_TRACKER_20260408.md
