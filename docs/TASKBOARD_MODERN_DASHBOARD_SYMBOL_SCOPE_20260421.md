# Taskboard: Modern Dashboard Symbol Scope Selector

**Ngày tạo**: 2026-04-21  
**Trạng thái**: Chưa bắt đầu  
**Owner**: Frontend + Backend shared

---

## Slice 1 — Universe aggregation

- [x] Fetch watchlist groups/items in Modern Dashboard
- [x] Normalize holdings/tracked/watchlist symbols to uppercase unique set
- [x] Annotate per-symbol source tags (`in_holdings`, `in_tracked`, `in_watchlist`)
- [x] Add derived selectors for `holdings`, `tracked`, `watchlist`, `all`
- [ ] Add tests for normalize + dedupe behavior

Definition of done:
- Modern Dashboard can derive 4 scopes consistently from one unified source map.

---

## Slice 2 — Shared toolbar in ModularPositionDeck

- [x] Add `symbolScope` selector UI
- [x] Add `selectedSymbol` selector UI
- [x] Reset symbol to `all` when scope changes
- [x] Guard invalid symbol after scope shrink
- [x] Add i18n labels for selector controls

Definition of done:
- User can switch source scope and symbol without breaking tab state.

---

## Slice 3 — Overview tab refactor

- [x] Decide whether to replace `HoldingsTable` or wrap it conditionally
- [x] Create unified symbol table for mixed source rows
- [x] Keep position metrics only for holdings rows
- [x] Add source badges per row
- [x] Add empty state for zero-symbol scope

Definition of done:
- Overview no longer assumes every row is a holding.

---

## Slice 4 — Whale tab selector integration

- [x] Feed whale symbol options from current scope
- [x] Support tracked/watchlist symbols in combobox
- [x] Handle `selectedSymbol = all` with single-symbol fallback policy
- [x] Keep chart single-symbol only

Definition of done:
- Whale bubble chart can open symbols outside holdings.

---

## Slice 5 — Technical bulk API

- [x] Add backend endpoint for technicals by symbol list
- [x] Reuse `_screener_build_technical` logic for arbitrary symbols
- [x] Add request validation and list cap
- [x] Add API tests
- [x] Integrate frontend technical tab with new endpoint

Definition of done:
- Technical tab works for holdings/tracked/watchlist/all.

---

## Slice 6 — AI monitor mode

- [x] Separate portfolio-only metrics from universe-level AI content
- [x] Keep health score only for `holdings`
- [x] Add degraded or alternative UI for non-holdings scopes
- [x] Document exact fallback behavior if backend AI universe summary is not ready

Definition of done:
- AI tab no longer mixes portfolio analytics with non-holding scope silently.

---

## Risks to track

- [ ] Non-holding rows accidentally show fake position metrics
- [ ] Realtime monitored symbol count grows too large when `scope=all`
- [ ] Whale chart becomes ambiguous if multi-symbol rendering is attempted
- [ ] Technical bulk endpoint returns too slowly for large symbol sets

---

## Release gate

- [ ] UX review approved for selector placement and labels
- [ ] Data semantics approved for Overview and AI tab
- [ ] Backend API contract approved for technicals bulk
- [ ] Manual smoke run completed on holdings/tracked/watchlist/all
- [ ] Audit ledger and progress dashboard updated
