# AUDIT REPORT - WHALE SCORING TUNING RECOMMENDATIONS (2026-04-17)

## 1. Executive summary

- Trang thai truoc tuning:
  - Scoring on dinh va deterministic, nhung do nhay cua muc extreme/critical co the cao o cac event sat nguong.
- Quyết định ky thuat:
  - Trien khai profile scoring canary `v2` co feature flag `WHALE_SCORE_PROFILE`.
  - Mac dinh van giu `v1` de tranh thay doi hanh vi production khong kiem soat.

## 2. Core findings

1. Aggression bonus saturation
- `buy/sell` truoc day co bonus = 1.0 ngay ca khi matched_value chi nhinh hon threshold.
- He qua: event sat nguong co the bi day score len khong can thiet.

2. Concentration fallback over-saturation
- Fallback `matched_value/(threshold*2)` dat tran 1.0 kha nhanh.
- He qua: feature concentration de bi "full scale" som.

3. Severity bands
- Muc extreme bat dau tu 75 co the kha nhay trong khung event dense.

## 3. Applied safe tuning

- Them profile `v2` voi 3 thay doi:
  1. Weights rebalance nhe:
     - size_impact 0.64, aggression_bonus 0.10, concentration_ratio 0.26.
  2. Aggression bonus theo size_ratio:
     - <1.2x: 0.55
     - <2.0x: 0.78
     - >=2.0x: 1.0
  3. Fallback concentration denominator tu 2.0 -> 3.0.
- Severity bands v2:
  - low [0,28)
  - medium [28,56)
  - high [56,82)
  - extreme [82,101)

## 4. Compatibility and rollback

- Payload contract khong doi field set.
- Mac dinh `WHALE_SCORE_PROFILE=v1` giu hanh vi hien tai.
- Rollback ngay lap tuc: set `WHALE_SCORE_PROFILE=v1`.

## 5. Verification checklist

- Unit tests bo sung:
  - v1 contract giu nguyen.
  - v2 severity boundary stricter cho extreme.
  - v2 score nhe hon v1 o near-threshold buy event.
- Compile/error checks: must pass.

## 6. Canary recommendation

1. Dev: bat `WHALE_SCORE_PROFILE=v2` de so sanh trend severe events.
2. Staging: quan sat 24-48h ratio high/extreme va false-positive feedback.
3. Production: rollout theo cohort nho neu chi so on dinh.
