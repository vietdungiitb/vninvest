# AI Advisory + Kline Context Execution Tracker (2026-04-08)

## 1) Cach dung tracker
- Moi ngay cap nhat trang thai: Not Started | In Progress | Blocked | Done.
- Moi ticket phai co owner ro rang va ETA.
- Neu blocked > 1 ngay, bat buoc co giai phap unblock va owner ho tro.

## 2) Nhom owner de xuat
- FE Lead: [TEN_FE]
- BE Lead: [TEN_BE]
- QA Lead: [TEN_QA]
- DevOps: [TEN_DEVOPS]
- Product/AI Reviewer: [TEN_PRODUCT_AI]

## 3) Lich trien khai 10 ngay (de xuat)
### Day 1
- B0-01 API contract chart_context v1
- B0-02 bat dau serializer skeleton
- F0-04 regression hardening indicator toolbar
- Output:
  - Contract chot va thong nhat FE/BE/QA
  - Baseline UI indicator stable

### Day 2
- B0-02 hoan tat validation + clamp
- B0-03 bat dau update endpoint generate
- F0-01 bat dau buildChartContext collector
- Output:
  - Serializer pass unit tests co ban
  - FE collector tra payload mau

### Day 3
- B0-03 hoan tat nhan chart_context + response fields
- B0-04 prompt injection chart_context block
- F0-01 hoan tat
- Output:
  - Endpoint chay voi/khong chart_context
  - Prompt da co chart context section

### Day 4
- F0-02 gui payload chart_context khi generate tab
- B0-05 telemetry instrumentation
- Q0-01 bat dau API contract tests
- Output:
  - FE-BE handshake thong
  - Co logs telemetry co ban

### Day 5
- F0-03 UX badge/warning states
- Q0-01 hoan tat
- Q0-02 bat dau E2E flow
- Output:
  - User thay AI co dung chart context hay fallback
  - API test matrix pass

### Day 6
- Q0-02 tiep tuc E2E VNM/VCB/FPT
- Q0-03 performance benchmark truoc/sau
- Output:
  - E2E evidence + bug list
  - p95, fail rate report

### Day 7
- Fix cac bug tu QA
- Hardening prompt theo output quality
- Output:
  - Regression pass vong 2
  - Prompt quality cai thien ro rang

### Day 8
- R0-01 feature flag + canary setup
- Release candidate tren staging
- Output:
  - Toggle release-ready
  - Canary runbook hoan tat

### Day 9
- Canary 10% production
- Monitor telemetry + alerts
- Output:
  - Bao cao 24h canary
  - Quyetsach go/no-go

### Day 10
- Mo rong 100% neu KPI dat
- Dong goi release notes + handover
- Output:
  - Production rollout full
  - Tai lieu van hanh cap nhat

## 4) Bang theo doi ticket thuc thi
| Ticket | Owner | ETA | Status | Blocker | Next Action |
|---|---|---|---|---|---|
| B0-01 | [TEN_BE] | Day 1 | Not Started | - | Chot schema voi FE/QA |
| B0-02 | [TEN_BE] | Day 2 | Done | - | Serializer da merge, tiep tuc hardening telemetry |
| B0-03 | [TEN_BE] | Day 3 | Done | B0-02 | Endpoint da nhan chart_context + response flags |
| B0-04 | [TEN_BE] | Day 3 | Done | B0-03 | Prompt da inject chart context block |
| B0-05 | [TEN_BE] | Day 4 | Done | B0-03 | Telemetry da map vao runtime KPI snapshot (`ai_chart_context`) va test pass |
| F0-01 | [TEN_FE] | Day 3 | In Progress | B0-01 | Collector da gui context tu chartData, can bo sung visible-range theo chart viewport |
| F0-02 | [TEN_FE] | Day 4 | In Progress | F0-01, B0-03 | Payload da gui chart_context, tiep tuc polish warning badge |
| F0-03 | [TEN_FE] | Day 5 | Done | F0-02 | Da them badge used/fallback + warning UI trong advisory panel |
| F0-04 | [TEN_FE] | Day 1 | Done | - | Keep regression checks |
| Q0-01 | [TEN_QA] | Day 5 | In Progress | B0-03 | 2 test chart_context moi da pass, mo rong matrix con lai |
| Q0-02 | [TEN_QA] | Day 6 | Not Started | F0-02 | E2E stock detail flow |
| Q0-03 | [TEN_QA] | Day 6 | Not Started | B0-05 | Performance report |
| R0-01 | [TEN_DEVOPS] | Day 8 | Not Started | Q0-03 | Feature flag + canary |

## 5) Daily standup format de xuat
- Hom qua da xong gi?
- Hom nay lam gi?
- Dang bi block boi ai/boi cai gi?
- Co rui ro nao anh huong release khong?

## 6) Go/No-Go checklist truoc full rollout
- [ ] chart_context_used >= 95% tren request hop le
- [ ] p95 latency tang <= 15%
- [ ] failure rate tang <= 1% absolute
- [ ] QA sign-off + Product/AI sign-off
- [ ] Rollback plan da verify

## 7) Rollback plan ngan
- Tat feature flag AI_ADVISORY_ENABLE_CHART_CONTEXT.
- System quay ve flow cu (symbol + timeframe only).
- Theo doi 30 phut sau rollback de xac nhan on dinh.
