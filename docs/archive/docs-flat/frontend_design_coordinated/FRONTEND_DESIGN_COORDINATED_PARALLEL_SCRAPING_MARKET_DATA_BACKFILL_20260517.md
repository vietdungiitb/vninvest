# Frontend Design - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

## 1. Muc tieu frontend

1. Surface cho operator theo doi CPS health.
2. Khong dua business crawl logic len client.
3. Ho tro trigger run co audit va feedback ro rang.

---

## 2. Scope UI

1. DataOps Panel:
- backlog cards by dataset/tier
- fail-rate trend (1h/24h)
- starvation alerts
- run summary table

2. Planner controls:
- preview before run
- explicit dataset/tier filters
- force refresh option with warning

3. Governance UX:
- show run_id, status, started_at, elapsed
- show reason and requested_window summary

---

## 3. Contract requirements

1. API responses can include:
- queue_tier
- planned_items
- dispatched_runs
- skipped_tiers with reason
- metrics snapshots

2. i18n requirements:
- Vietnamese full diacritics mandatory
- no hardcoded operator strings

---

## 4. Accessibility and usability

1. Status colors with text labels (not color-only).
2. Mobile layout keeps key metrics visible first.
3. Error states show actionable next steps.

---

## 5. Test requirements

1. UI tests for cards, filters, status transitions.
2. API adapter tests for new fields.
3. Regression tests for active-run lock behavior.
