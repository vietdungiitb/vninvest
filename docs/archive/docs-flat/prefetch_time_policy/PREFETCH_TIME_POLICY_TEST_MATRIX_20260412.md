# PREFETCH TIME POLICY - TEST MATRIX (2026-04-12)

## 1) Test objective

Dam bao policy theo khung gio hoat dong dung, an toan, va khong gay regression.

---

## 2) Unit tests - Backend

### Validator
- T1: timezone hop le -> pass.
- T2: timezone sai -> fail field error.
- T3: open_time >= close_time -> fail.
- T4: interval_seconds < min -> fail.
- T5: batch_size <= 0 -> fail.
- T6: multiplier < 1 -> fail.

### Resolver
- R1: 08:29 -> offhours
- R2: 08:30 -> pre_open
- R3: 09:00 -> market_open
- R4: 11:45 (lunch enabled) -> lunch_break
- R5: 14:45 -> market_open/pre_close theo rule
- R6: 15:00 -> post_close
- R7: 15:29 -> post_close
- R8: 15:31 -> offhours
- R9: weekend -> offhours

### Guard 429
- G1: 429 x2 -> interval tang theo multiplier
- G2: interval clamp max
- G3: non-429 khong doi interval

---

## 3) Integration tests - Backend

- I1: GET settings co policy + rulebook.
- I2: PUT policy valid -> 200 + persisted.
- I3: PUT invalid -> 400 + field_errors.
- I4: cache corrupt -> fallback default + no crash.
- I5: health payload co policy metadata.

---

## 4) Frontend tests

### Rendering
- F1: AdminOps render policy section.
- F2: Load payload -> map dung field.

### Validation
- F3: invalid time range -> block submit.
- F4: invalid numeric range -> block submit.

### Save flow
- F5: save success -> success message.
- F6: save fail 400 -> field errors hien dung.
- F7: save fail 500 -> general error, giu form state.

### Preview
- F8: preview profile update theo response.

---

## 5) Manual QA scenarios

- M1: pre_open 30p behavior.
- M2: market_open behavior.
- M3: lunch_break behavior (enabled/disabled).
- M4: post_close 30p behavior.
- M5: weekend behavior.
- M6: rapid policy changes tu admin UI.

Evidence format:
- Screenshot AdminOps form state.
- Health payload JSON snippet.
- Metrics snapshot.

---

## 6) Regression checklist

- RG1: Watchlist sync endpoint khong bi anh huong ngoai scope.
- RG2: AdminOps cac section cu van hoat dong.
- RG3: Celery task khong crash khi policy missing.
- RG4: No permission bypass trong settings API.

---

## 7) Exit criteria

- 100% test critical pass.
- Khong con blocker P1/P2.
- Canary KPI dat nguong chap nhan.
