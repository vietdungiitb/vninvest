# Sprint 12 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 12.

## A. Frontend Realtime Architecture

- [x] Co service/hook realtime dung chung cho Dashboard va Watchlist.
- [x] Subscription management khong lap logic giua cac page.
- [x] Reconnect/backoff co gioi han va khong tao socket leak (1000 = no reconnect, stale ref guard, destroyed flag).
- [x] Cleanup hook co explicit `unsubscribe` truoc khi close socket neu ket noi dang OPEN.

## B. UX and State

- [x] Dashboard panel realtime hien thi dung market breadth (up/down/flat), stale count, event timestamp, observability bar (ticker/whale/hb/reconnect/latency/channel layer).
- [x] Watchlist va Dashboard deu dung cung mot contract realtime (useRealtimeFeed, quotesBySymbol, realtimeStatus, lastEventAt, alerts, metrics).
- [x] Whale alert co history ngan (maxAlerts=5), co co che chong duplicate (uu tien `event_id`, fallback `symbol+ts+side` de tuong thich nguoc).
- [x] Fallback polling hoat dong khi socket disconnect (realtimeStatusRef.current !== 'live').
- [x] Watchlist phan tach ro `Nhóm thị trường` va `Danh sách theo dõi cá nhân` bang nhan va mo ta nhat quan.
- [x] Watchlist ho tro thao tac hai chieu ngay tai bang `Nhóm thị trường`: them tung ma, them ca nhom, bo tung ma, bo cac ma da theo doi cua nhom.
- [x] Bo loc `Tat ca / Chua theo doi / Da theo doi` hien thi bo dem va cap nhat dung theo shortlist hien tai.
- [x] Realtime whale panels dung `severity` va `size_class` do backend WS cap, khong con tu suy luan tu `matched_value`.

## C. Reliability and Observability

- [x] Co event counters hoac logging hook cho connect, disconnect, fallback, stale (eventCounts: ticker_update/whale_alert/heartbeat/reconnect/subscribed/unsubscribed/polling_successes/polling_failures + lastLatencyMs).
- [x] Co cach phan biet local `inmemory` va env Redis-backed (badge tren DashboardRealtimePanel lay tu GET /api/health/realtime/).
- [x] Runbook Redis-backed duoc cap nhat va test lai (GET /api/health/realtime/ tra {channel_layer_type:redis, redis_ok:true}, realtime_tick --sync pass 4 symbols + heartbeat).
- [x] Realtime debug panel hien duoc whale lifecycle fields (`event_id`, `config_version`, `source`) va connection state runtime.

## D. QA

- [x] Frontend build pass (Compiled successfully, no ERR_INSUFFICIENT_RESOURCES).
- [x] Backend targeted realtime tests pass (route smoke 28 tests, realtime gateway/compute 6 tests, whale scoring/contract targeted tests pass).
- [ ] Browser QA matrix cho Dashboard + Watchlist realtime con mo o phan reconnect/fallback/unmount runtime that.

## E. Release Sign-off

- [x] PM/BA xac nhan du du lieu demo de review nghiep vu (seed_demo_data --reset da mo rong phu holdings, snapshots, watchlist, tracked symbols).
- [x] Dev xac nhan khong con blocker P0/P1 cho frontend realtime (ERR_INSUFFICIENT_RESOURCES, infinite loop, 400 watchlist item, WS close before established — tat ca da fix).
- [x] Co danh sach cong viec chuyen tiep cho Sprint 13 (docs/SPRINT13_DETAILED_PLAN.md).

## F. User Registration Extension

- [x] Co tai lieu ke hoach implementation cho registration flow: `docs/SPRINT12_USER_REGISTRATION_PLAN.md`.
- [x] Chot nghiep vu: email required, khong auto-login, can verify email truoc dang nhap.
- [x] Frontend co mode `Dang ky` canh `Dang nhap` tai auth entrypoint.
- [x] API helper frontend cho `POST /api/auth/register/` duoc them va dung dung contract.
- [x] Dang ky thanh cong tao duoc `User` + `UserConfig(plan=free)`.
- [x] Hien thi dung loi cho duplicate username, invalid email, password mismatch, password qua ngan.
- [x] Backend targeted tests cho register flow pass.
- [ ] Frontend smoke test: dang ky moi -> verify email -> dang nhap -> vao duoc dashboard.
- [x] Docs va taskboard Sprint 12 duoc cap nhat sau implementation.
- [x] Co browser QA checklist artifact: `docs/SPRINT12_BROWSER_QA_CHECKLIST_STARTER_PORTFOLIOS_20260408.md`.
- [ ] QA regression mo rong cho login/register flow duoc chay tren browser that.

## G. Starter Portfolios Provisioning (Sprint 12 extension tiep theo)

- [x] Scope duoc gan ve dung sprint goc Sprint 12, khong tach tai lieu sprint moi.
- [x] Da co implementation-ready plan trong `docs/SPRINT12_USER_REGISTRATION_PLAN.md` (muc 15-16).
- [x] Co service idempotent tao 3 portfolio mac dinh va 3 sub-account moi portfolio.
- [x] Hook provisioning vao ca 2 signup paths: email/password va Google OAuth (`created=True`).
- [x] Co tracking fields trong `UserConfig`: seeded flag, seeded_at, template_version.
- [x] Co feature flags rollout (`STARTER_PORTFOLIOS_ENABLED`, `STARTER_PORTFOLIOS_CANARY_PERCENT`).
- [x] Co command backfill cho user cu va co che do `--dry-run`.
- [x] Unit tests cho service provisioning pass.
- [x] Integration tests cho register flow + oauth signup flow pass.
- [x] Seed loi khong lam fail API register (fail-soft duoc test).
- [x] Docs canonical da sync day du: registration plan + checklist + execution log + roadmap.