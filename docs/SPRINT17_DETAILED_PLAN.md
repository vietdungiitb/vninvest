# Sprint 17 Detailed Plan — AI Advisory Multi-Tab & Executive Summary

**Ngay lap ke hoach**: 2026-04-04  
**Trang thai**: COMPLETED (implemented and validated)  
**Muc tieu sprint**: Nang cap AI Advisory Session thanh mo hinh da-thanh-phan (component-first), co tab rieng cho tung goc nhin AI va mot phan tong ket cuoi cung co trong so.

---

## 1) Why sprint nay can uu tien

Voi flow hien tai, AI advisory tra ve mot khoi noi dung duy nhat, kho audit va kho kiem soat khi co tin hieu xung dot. Sprint 17 chuyen sang mo hinh:

- Moi goc nhin AI = 1 ban ghi thanh phan (component record).
- User co quyen chon include/exclude tung thanh phan truoc khi tong hop.
- Summary cuoi cung co versioning, co timestamp, va giai thich ro ly do ket luan.

Gia tri dat duoc:
- Tang minh bach va kha nang truy vet.
- Tang chat luong khuyen nghi nhieu nguon du lieu.
- Giam rui ro AI "hallucination" vi buoc tong hop bi rang buoc boi schema.

---

## 2) Scope Sprint 17

### In-scope
1. Data model cho component records va executive summary versions.
2. API tao/lay/cap nhat include-exclude/xoa mem component.
3. API regenerate executive summary tu tap component dang active.
4. FE panel da tab tren StockDetail AI Advisory Session.
5. Hien thi timestamp chinh xac cho tung tab component.
6. Nut xoa component (soft delete) de summary co the dung hoac bo qua.

### Out-of-scope
1. OCR chart image to AI vision (de cho sprint tiep theo).
2. News sentiment ingestion real-time quy mo lon.
3. Tu dong dat lenh/broker integration.

---

## 3) Kien truc nghiep vu moi

### 3.1 Component Record (ban ghi thanh phan)

Moi component la mot goc nhin AI doc lap (VD: RSI, Price Action, Volume/Order Flow).

Schema nghiep vu de xuat:
- component_type: `price_action | indicator | volume_orderflow | sentiment`
- indicator_name: string (VD: RSI, Bollinger Bands)
- status: `overbought | oversold | accumulation | breakout | neutral`
- confidence_score: int 1..10
- suggested_action: `watch | buy | sell | hold_off`
- rationale_text: text ngan, co bang chung
- timeframe: `5m | 15m | 30m | 1h | 1d`
- include_in_summary: bool (default true)
- is_deleted: bool (soft delete)
- created_at, updated_at

### 3.2 Executive Summary Record

Tong hop tu N component dang include=true va is_deleted=false.

Schema nghiep vu de xuat:
- strategy_action: `BUY | SELL | HOLD | STAND_ASIDE`
- synthesis_text: text tong hop xung dot/tuong dong giua cac component
- target_price_zone: string
- stop_loss_zone: string
- risk_level: `low | medium | high`
- overall_confidence: int 1..10
- used_component_ids: list[int]
- summary_version: int (tang dan theo moi lan regenerate)
- created_at

### 3.3 Quy tac trong so (hybrid)

Rule engine giu trong so co dinh, LLM chi dien giai ngon ngu va tinh chinh nhe:
- Trend/Price Action: 35%
- Momentum/Indicator: 25%
- Volume + Order Flow: 30%
- Sentiment/Context: 10%

Neu tin hieu xung dot manh (>= 2 component action trai nguoc), giam overall_confidence toi thieu 1-2 diem.

---

## 4) API Contract (draft)

### 4.1 Session detail
- `GET /api/stock-management/stocks/{symbol}/ai-advisory-session/`
- Tra ve: summary hien tai + danh sach components theo thu tu moi nhat.

### 4.2 Generate components
- `POST /api/stock-management/stocks/{symbol}/ai-advisory-components/generate/`
- Input: symbol + timeframe + selected component types.
- Output: danh sach component records vua tao.

### 4.3 Toggle include/exclude component
- `POST /api/stock-management/ai-advisory-components/{id}/toggle-include/`
- Output: include_in_summary moi.

### 4.4 Soft delete component
- `DELETE /api/stock-management/ai-advisory-components/{id}/`
- Hanh vi: `is_deleted=true`, khong xoa cung DB.

### 4.5 Regenerate executive summary
- `POST /api/stock-management/stocks/{symbol}/ai-advisory-summary/regenerate/`
- Input: optional list component IDs (neu khong co => lay toan bo include=true).
- Output: summary record version moi.

---

## 5) Frontend UX Plan (StockDetail)

### 5.1 Layout
- Khoi tren: tab list theo component records.
- Moi tab hien:
  - indicator name
  - status + confidence
  - suggested action
  - created timestamp
  - include/exclude switch
  - nut xoa component
- Khoi duoi (co dinh): Executive Summary
  - strategy_action
  - synthesis_text
  - target/stoploss
  - confidence + risk
  - "Regenerate" button

### 5.2 Hanh vi UX quan trong
1. Sau khi xoa/toggle, summary khong tu regen ngay; user bam Regenerate de tranh cost AI.
2. Hien "Summary duoc tao tu N components".
3. Component qua cu (qua 1 phien) hien badge "stale".
4. Neu khong con component active -> summary panel hien trang thai "chua du du lieu".

---

## 6) Work Breakdown theo phase

### Phase 1 — Backend Model & Migration
- Tao model `AIAdvisoryComponentRecord`.
- Tao model `AIAdvisoryExecutiveSummary`.
- Index theo `(user, symbol, created_at)`.
- Migration + admin registration + serializer.

### Phase 2 — Backend Service + API
- Service generate component records theo schema chuan.
- Service synthesize summary voi weighting hybrid.
- Endpoints: list session, generate components, toggle include, soft delete, regenerate summary.
- Cooldown + rate limit cho regenerate.

### Phase 3 — Frontend Multi-Tab Panel
- Refactor panel AI Advisory tren StockDetail.
- Tab component records + timestamp + include/exclude + delete.
- Summary block phia duoi + button regenerate.
- Empty/loading/error states day du.

### Phase 4 — QA & Hardening
- Unit tests BE cho CRUD + regenerate + versioning.
- FE interaction tests (toggle/delete/regenerate flow).
- Build + smoke test cho route `/stocks/:symbol`.

---

## 7) Testing Strategy

### Backend
- test tao component records theo schema hop le.
- test soft delete khong mat audit history.
- test toggle include cap nhat dung record user/symbol.
- test regenerate tang `summary_version`.
- test summary bo qua component da xoa hoac exclude.

### Frontend
- render dung so tab components.
- hien timestamp va status badge.
- nut xoa va include/exclude cap nhat UI state dung.
- regenerate update summary block khong reload trang.

---

## 8) DoD Sprint 17

1. User thay duoc giao dien AI Advisory da tab tren StockDetail.
2. Moi component co timestamp + include/exclude + soft delete.
3. Executive summary co versioning va regenerate theo component selected.
4. Co test backend/ frontend cho luong chinh.
5. `npm run build` pass, backend tests pass.
6. Docs cap nhat: execution log, roadmap status, acceptance checklist, taskboard.

---

## 9) Risk & Mitigation

1. Cost AI tang do regenerate nhieu:
- Mitigation: cooldown + max regenerate/phiensession + button disable khi processing.

2. Summary khong on dinh giua cac lan regenerate:
- Mitigation: luu input snapshot + component IDs dung de tong hop.

3. User xoa nham component:
- Mitigation: soft delete + confirm modal + co the "restore" o sprint sau.

4. Prompt drift:
- Mitigation: schema strict + parser validation + fallback defaults.

---

## 10) Phan cong de xuat

- BE-1: models/migration/services/apis/tests
- FE-1: multi-tab panel + summary block + interactions
- QA: regression + acceptance checklist sign-off
- PM/BA: review wording cua status/action enums

---

## 11) Tai lieu lien quan

- docs/SPRINT17_ACCEPTANCE_CHECKLIST.md
- docs/TASKBOARD_SPRINT17.csv
- docs/FEATURE_EXPANSION_BACKLOG.md
- docs/ROADMAP_STATUS.md
