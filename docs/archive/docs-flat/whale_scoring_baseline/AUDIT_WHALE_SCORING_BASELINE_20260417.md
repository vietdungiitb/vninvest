# AUDIT BASELINE - WHALE SCORING (2026-04-17)

## Scope

- Module: `backend/portfolio/whale_scoring.py`
- Muc tieu: danh gia baseline hien tai truoc khi tuning severity Critical.

## Baseline findings

1. Feature contribution hien tai
- `size_impact`: trong so mac dinh 0.6
- `aggression_bonus`: trong so mac dinh 0.15
- `concentration_ratio`: trong so mac dinh 0.25

2. Severity mapping
- low: [0,25)
- medium: [25,50)
- high: [50,75)
- extreme: [75,101)

3. Display score decay
- half-life mac dinh: 900s
- display_score = event_score * exp(-(ln2/half_life)*age_seconds)

4. Rui ro can luu y
- Aggression bonus co the over-reward side buy/sell o event gia tri vua du nguong.
- Concentration ratio fallback dua tren `matched_value/(threshold*2)` co the tao score tang nhanh khi threshold rat thap.
- Severity band co khoang fixed, chua can chinh theo distribution event thuc te.

## Audit objectives for tuning

- Muc tieu A: Giam false-critical nhung giu du sensitivity cho event dot bien thuc su.
- Muc tieu B: Bao dam tinh on dinh severity khi event age tang (decay behavior).
- Muc tieu C: Khong pha vo compatibility cua payload whale_alert.

## Proposed verification scenarios

1. Threshold-edge cases
- matched_value x threshold x side combinations quanh moc 1x, 2x, 4x.

2. Age-decay cases
- age 0s, 300s, 900s, 1800s voi cung event_score.

3. Concentration stress
- concentration_ratio 0.1, 0.5, 0.9 voi cung matched_value.

4. Severity boundary checks
- Score sat bien 24.99/25, 49.99/50, 74.99/75.

## Recommendation track

- Track 1: Data-driven recalibration severity bands (uu tien).
- Track 2: Mild weight rebalance (neu Track 1 chua du).
- Track 3: Optional feature-flaged scoring profile for canary rollout.

## Next action

- Su dung baseline nay de thuc hien Phase 3B.1 analysis report co de xuat tuning cu the (weights + bands + expected impact).
