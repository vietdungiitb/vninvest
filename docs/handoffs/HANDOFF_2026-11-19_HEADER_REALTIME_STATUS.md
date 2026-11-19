# HANDOFF — R1 Header realtime indicator (2026-11-19)

- **Branch**: `feat/header-realtime-status` · **Commits**: `966a70ed1` (claim) · `424160fb6` (code + docs) · **Status**: `done` (local; chờ push/PR + deploy staging).
- **Scope**: sửa chỉ báo "Offline" sai trên `/operations-center?tab=dataops`. 2 lỗi 404 (`advisory/latest/VMG`, `billing/subscription`) là empty-state có chủ đích, **không** thuộc slice này — xem `docs/DIAGNOSIS_OFFLINE_404_DATAOPS_20261119.md`.

## Kết quả (bằng chứng)

- `packages/web/src/layouts/full/vertical/header/Header.tsx:37-65` — module-level `REALTIME_INDICATOR` + `resolveRealtimeIndicator(ctx)`: `idle` khi không có context/consumerCount=0/status=idle; `connected` cho `live|connected`; `polling`; `disconnected` (defensive); default `connecting`. Chỉ `disconnected` mới hiện "Offline" + chấm đỏ.
- `Header.tsx:360-372` — render dùng `t(labelKey,{defaultValue})` cho `title` + nhãn; dot xám/vàng/xanh-pulse/đỏ tương ứng.
- `packages/web/src/i18n/locales/{vi,en}/layout.js:23-28` — 5 key `layout.realtime.*`; không đụng barrel `i18n/{vi,en}.js`.
- Test `Header.component.test.tsx`: fail-before **4 đỏ** (AC0–AC3) → pass-after **13/13**.
- Audit: B3 `NEED_REVISION` → B4 `AGREE` → B8 `PASS` (0 blocker/0 major), evidence tại `docs/evidence/header-status/`.
- Full suite 1334 test / 13 fail (7 file) — đã đối chứng trên `HEAD` sạch: cùng 7 file/13 fail ⇒ **pre-existing** (xem `docs/evidence/header-status/GATES.md`).

## CHƯA CHẠY / Next

- `npm run build`, deploy staging VPS `14.225.255.47` (`bash scripts/deploy-staging.sh`), Playwright/visual 375–1440 — **chưa chạy**; không báo PASS giả. Owner/Coordinator đóng khi deploy.
- R2 (đổi contract 404 empty-state) và R3 (badge `LIVE` tĩnh trong SOC) còn mở — ticket riêng, không nằm trong slice này.
- File handoff này cần merge/cherry-pick sang `main` theo handoff-evidence-rule.

## Cập nhật 2026-11-19 (gate baseline)

Trước push, `pre-push-gate` có 5 FAIL baseline (đã đối chứng trên `dev` sạch). Đã sửa trong cùng branch: global config deploy, i18n `ErrorState`, 2 envelope exemption, system-design encoding + regenerate catalog, refresh OpenAPI baseline. Kết quả: **36 PASS / 0 FAIL**, đủ điều kiện push. Chi tiết: `docs/evidence/prepush-gate-baseline/EVIDENCE_20261119.md` (Entry 561).

**Owner**: coordinator · **Ngày**: 2026-11-19.
