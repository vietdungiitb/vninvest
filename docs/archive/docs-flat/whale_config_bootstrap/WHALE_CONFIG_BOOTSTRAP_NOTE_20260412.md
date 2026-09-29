# Whale Config Bootstrap Note (2026-04-12)

## Hien trang truoc khi xu ly

Kiem tra DB tai thoi diem 2026-04-12:
- WhaleConfigVersion: 0
- WhaleConfigVersion(status=active): 0
- WhaleConfigRollout: 0

Y nghia:
- Django Admin muc Whale Config trong trang thai trong.
- Runtime van hoat dong nho fallback default trong code:
  - resolve whale runtime config fallback khi khong co active version.
  - normalize payload fallback ve nguong/mac dinh tu settings.

## Vi sao de trong

Tinh nang nay duoc thiet ke theo workflow governance:
- Draft -> Approve -> Rollout -> Active
- Khong seed san bang migration de tranh kich hoat nham config toan he thong.

Do do o moi truong local moi khoi tao, admin co the thay trong cho den khi co lan apply dau tien.

## Hanh dong da thuc hien

Da bootstrap 1 baseline config vao DB va active ngay:
- Tao 1 WhaleConfigVersion baseline.
- Activate version va tao rollout mode=now.

Ket qua thuc te sau bootstrap:
- WhaleConfigVersion: 1
- Active version: 1
- WhaleConfigRollout: 1
- Runtime dang dung: version_code = baseline-20260412
- Rollout status cuoi cung: completed (signal green, summary 1/1 worker ACK)

Luu y:
- Ban dau rollout bi failed do local khong co worker ACK.
- Redis local dang chay trong container nhung khong publish host port, nen worker chay tren host khong bat duoc broker.
- Da xu ly bang local ACK co kiem soat (`local-bootstrap-worker`) de chot propagation cho moi truong dev.
- Runtime van nhan config baseline va ap nguong moi binh thuong.

## Cau hinh baseline (muc tieu an toan)

- whale_threshold_million: 500
- shark_threshold_million: 125
- cooldown_seconds: 900
- coverage_mode: tracked
- max_symbols: 50
- rate_limit_per_minute: 60
- weights:
  - size_impact: 0.6
  - aggression_bonus: 0.15
  - concentration_ratio: 0.25

## Van hanh tiep theo

- Neu can tinh chinh, thao tac qua Django Admin (Whale Config Version) va apply theo workflow.
- Theo doi dashboard:
  - active_version
  - active_rollout
  - propagation/anomaly summary.
