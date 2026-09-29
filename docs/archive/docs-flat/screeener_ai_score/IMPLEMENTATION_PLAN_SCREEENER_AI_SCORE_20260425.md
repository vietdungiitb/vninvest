# IMPLEMENTATION PLAN: Screener AI Score 0-100 Backend Merge (2026-04-25)

**Ngay tao**: 2026-04-25  
**Pham vi**: BE slice - Screener run path + AI scoring 0-100  
**Level**: A (Major - thay doi response contract backend)  
**Owner**: Backend Lead  
**Reviewer**: Project Lead  
**Trang thai**: READY FOR REVIEW / DOI PHE DUYET

---

## 1. Muc tieu

- Khi `ScreenerRuleRunView.post()` chay, backend tra ve danh sach `matched` kem them `ai_advisory` payload 0-100 cho tung ma thoa dieu kien.
- Tai dung cac thanh phan san co trong `ai_advisory_helpers.py`, `AIAdvisoryComponentRecord`, `AIAdvisoryExecutiveSummary` de tranh tao pipeline song song.
- Giu contract cu cua screener: `rule_name`, `matched_count`, `total_scanned`, `matched` van con, chi bo sung field moi theo kieu backward-compatible.
- Khong tao model moi, khong them migration trong slice dau.

## 2. Hien trang

- Screener run path da on dinh sau khi loai bo dead loop va undefined `rows` reference.
- `ScreenerRunTests` da pass sau khi khoi phuc PostgreSQL local container.
- Backend da co sẵn layer AI advisory component/summary voi `strategy_action`, `synthesis_text`, `risk_level`, `overall_confidence`.
- Frontend `Screener.jsx` hien chi doc contract cu, nen se an toan neu backend them field moi.

## 3. In-Scope

- Them helper adapter de chuyen screener technical snapshot thanh AI advisory payload.
- Enrich response cua `ScreenerRuleRunView` cho tung symbol match.
- Duy tri fallback an toan: neu AI helper fail, screener van tra ket qua technical binh thuong.
- Bo sung tests cho ai-enriched response va fallback path.
- Cap nhat audit ledger, progress dashboard, va refresh impacted dev Docker stack truoc audit cuoi khi code xong.

## 4. Non-Scope

- Khong lam websocket push o slice nay.
- Khong refactor frontend trong slice nay.
- Khong persist alert/advisory moi tren DB neu khong can thiet cho contract.
- Khong tach mot queue AI rieng trong slice nay; phan nay de lai cho slice realtime alert.

## 5. Target Response Contract

Moi item trong `matched[]` se giu full technical fields hien co va them:

```json
{
  "symbol": "VNM",
  "date": "2026-04-25",
  "close": 80000,
  "rsi_14": 28.4,
  "sma20": 78500,
  "sma50": 77200,
  "ai_advisory": {
    "ai_score_0_100": 82,
    "ai_confidence_0_100": 80,
    "strategy_action": "BUY",
    "risk_level": "medium",
    "synthesis_text": "...",
    "target_price_zone": "...",
    "stop_loss_zone": "...",
    "generated_at": "2026-04-25T09:15:00+07:00",
    "source": "screener_ai_v1"
  }
}
```

Quy tac chinh:
- `ai_score_0_100` la diem co hoi mua/ban tong hop.
- `ai_confidence_0_100` la do tin cay cua advisory.
- `strategy_action` van giu direction ro rang (`BUY`, `SELL`, `HOLD`, `STAND_ASIDE`).
- Neu khong co advisory, field `ai_advisory` co the la `null` hoac bi bo qua theo contract da chot.

## 6. Target Design

- Tao mot helper trong `ai_advisory_helpers.py` de build advisory payload tu screener technical snapshot.
- Tinh diem 0-100 dua tren signal confluence hien co, `overall_confidence`, va direction bias tu `strategy_action`.
- Giu scoring on dinh, deterministic, khong lay LLM network path trong loop run screener.
- Uu tien SSOT hien co: khong viet lai cong thuc summary neu co the adapter duoc tu helper da co.

## 7. Implementation Slices

### BE-1 - Screener AI advisory adapter
- Them helper moi de bien doi technical snapshot thanh component/summary payload.
- Mapping cac field screener hien co (`rsi_14`, `sma20`, `sma50`, `momentum_20d_pct`, `price_vs_sma20_pct`, `volume_rvol`, `macd_hist`) sang logic advisory.
- Output phai co `ai_score_0_100`, `ai_confidence_0_100`, `strategy_action`, `risk_level`, `synthesis_text`.

### BE-2 - Screener view enrichment
- Cap nhat `ScreenerRuleRunView` de bo sung `ai_advisory` cho tung matched row.
- Duy tri contract cu neu AI enrichment bi tat hoac helper fail.
- Khong lam cham nhieu hon muc can thiet; chi enrich sau khi row da match technical criteria.

### BE-3 - Test coverage
- Them/doi test cho case co match va co AI advisory.
- Them test fallback: khi helper fail thi response van hop le.
- Giu `ScreenerRunTests` hiem tra contract cu.

### BE-4 - Audit + release hygiene
- Cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` va `PROGRESS_DASHBOARD.md` sau khi xong code.
- Regenerate `module_tree_full.md` sau khi code xong.
- Refresh impacted dev Docker stack truoc khi bao cao audit cuoi (backend rebuild/restart neu can).
- Rerun test slice va confirm container/service dung ban code moi.

## 8. Testing Plan

Bat buoc chay:
- `backend/manage.py test portfolio.tests.test_screener_api.ScreenerRunTests --keepdb`
- Test moi cho AI-enriched screener contract.
- `get_errors` tren file bi sua.
- `git diff --check` cho cac file touched.

Tieu chi PASS:
- Screener run van pass voi va khong co `ai_advisory` khi fallback.
- Khi AI enrichment bat, `ai_score_0_100` nam trong range 0-100 va co direction ro rang.
- Khong co regression cho `matched_count`, `total_scanned`, `rule_name`, `matched`.

## 9. Rollout Guardrails

- Neu helper advisory fail, screener van tra ket qua technical de tranh block user.
- Neu can gate rollout, co the bat qua feature flag hoac query param o muc implementation.
- Khong merge slice nay neu chua co evidence test va docker refresh sau code.

## 10. Dinh Nghia Hoan Thanh

- Screener backend tra duoc AI score 0-100 cho matched symbols.
- Contract cu cua screener khong bi vo.
- Test pass.
- Audit ledger va progress dashboard da dong bo.
- Dev Docker stack da duoc refresh truoc final audit report.

---

**Decision needed**: xac nhan `dong y` / `tien hanh` / `code di` de toi bat dau sua runtime code cho slice nay.
