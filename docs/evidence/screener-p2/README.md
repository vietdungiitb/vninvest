# Evidence — Screener P2 (P2.0–P2.7) — 2026-09-14

> **Scope:** P2 UX + lịch + history server (§2–§7 của `docs/IMPLEMENTATION_PLAN_SCREENER_P2_20260913.md`). Tài liệu này đóng DoD P2 (R2.x).

---

## 1. P2.0 — 12 templates

- BE `screener_templates.py`: 12 entries (`volume_breakout` RVOL>2.5 + price_vs_sma20>5, `profit_growth` EPS>20 + rev>15).
- i18n `vi.js`/`en.js`: `screener.templates.volume_breakout/profit_growth` name/desc full dấu.
- Verify: `GET /core/v1/screener/templates/` trả 12 items (manual, dev).

## 2. P2.1 — URL share

- `ScreenerPage.tsx`: `useSearchParams` + `syncUrl(rule,params)` replace + `useEffect` apply sau khi rules load.
- Verify manual: `/screener?rule=3` → mở editor rule 3; `?rule=3&run=1&sort=close&order=asc&page=2` → auto-run, bảng `page 2`; `?rule=9999` → toast, không 404.

## 3. P2.2 — React Query

- `ScreenerPage.tsx`: `useTenantAdminQuery(['screener','rules'])`, invalidate on create/update/delete, `tenant-changed` auto (QueryProvider).
- Verify manual: đổi tenant → list refetch không reload; tạo rule → list tự refetch.

## 4. P2.3 — History server (Q5)

- BE `test_screener_history.py` 5 tests: create+list, quota 100, tenant isolation, backtest, delete/clear — **PASS**.
- FE `ScreenerHistory`: server query `limit=20` + fallback localStorage, per-run Backtest (server 5d) + delete.
- Backtest v2 `GET /screener/history/<id>/backtest/?horizon=5` dùng `DailyPrice` DB (không `getDailyPrices` từng symbol client).

## 5. P2.4 — Schedule + alert (Q6)

- BE `test_screener_schedule.py` 4 tests: crud, invalid (400), run-now enqueue, beat due + alerts — **PASS**.
- FE `ScreenerSchedulePanel` 2 tests: create + list/toggle/run/delete + alerts — **PASS**.
- Beat `screener_scheduled_run` 5m → queue `manual_on_demand` (settings + queue_policy route có sẵn `manual_*`).
- Email channel: residual (in_app cache 7d `screener:sched_alerts:{user}`).

## 6. P2.5 — Row actions + column persist

- `ScreenerRowActions.component.test.tsx` 5 tests: +WL add, +WL empty notice, +Alert form + create, column persist localStorage, aria-sort/keyboard — **PASS**.
- `visible` init merge `localStorage vninvest_screener_columns_v1`, persist on toggle.

## 7. P2.6 — Mobile/a11y

- `th` có `role=columnheader` + `aria-sort` + `tabIndex=0` + Enter/Space; pager `aria-label` Prev/Next.
- Table `overflow-x:auto` giữ; filterBuilder grid responsive; page `maxWidth 1200`.

## 8. Gates (sau P2.5/P2.6)

```
manage.py test user_workspace --verbosity 1  → 53 tests: 52 pass + 1 pre-existing holdings (httpx.UnsupportedProtocol)
npm run test:components                      → 27 files 113 passed (screener 9 files: 6 cũ 30 + polling 7 + schedule 2 + rowActions 5 = 44)
npm run lint                                 → 0 errors (3546 warnings baseline)
npm run build                                → PASS (ScreenerPage ~50k)
npm run i18n:scan                            → exit 0
```

## 9. How to reproduce locally

```bash
DJANGO_DEBUG=true .venv/Scripts/python manage.py test user_workspace.test_screener_history user_workspace.test_screener_schedule -v 2
npm --prefix packages/web run test:components -- src/components/screener
# UI: http://localhost/screener → tạo rule → Chạy → ?rule=&run=1 → history server → schedule → +WL/+Alert
```

---

*Generated: 2026-09-14 — P2.0–P2.6 committed, P2 DONE.*
