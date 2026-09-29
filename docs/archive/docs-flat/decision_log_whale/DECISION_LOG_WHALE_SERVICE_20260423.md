# Decision Log - Whale Service

Ngay chot: 2026-04-23

## D1. Threshold model

Quyet dinh:
1. TrackedSymbol.whale_alert_threshold_million khong cho null sau migration.
2. Khi tao moi symbol theo doi, default threshold = threshold he thong.

Ly do:
- Tranh ambiguity NULL fallback.
- De audit va de enforce contract.

## D2. Threshold mismatch behavior

Quyet dinh:
1. Tooltip/stats theo threshold user.
2. Realtime advisory theo threshold he thong.
3. Neu user threshold < system threshold: hien warning tren UI.

Ly do:
- Giu on dinh pipeline realtime he thong.
- Van cho phep user xem thong ke chi tiet hon.

## D3. Permission model

Quyet dinh:
1. BACKFILL, GLOBAL_RECOMPUTE: admin only.
2. USER_REFRESH: user chi cho symbol minh track.

## D4. Anti-spam strategy

Quyet dinh:
1. Bat buoc 5 lop: rate-limit + idempotency + Redis lock + transactional DB guard/create-gate + queue dedupe.
2. API tra ve accepted/in_progress/duplicate/throttled.

## D5. Backfill default

Quyet dinh:
1. Mac dinh backfill 3 thang.
2. Co cau hinh tren admin UI.

## D6. Data state semantics

Quyet dinh:
1. no_data khac zero_count.
2. Stats payload phai tra data_state de UI va AI phan tich dung.
