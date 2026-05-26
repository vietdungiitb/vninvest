# EXECUTION EVIDENCE TEMPLATE — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Hướng dẫn**: Copy block này cho từng slice `SD-01` → `SD-07` và điền đầy đủ trước khi mark DONE.

---

## Template — `[SLICE-ID] [Slice Name]`

**Ngày thực hiện**: YYYY-MM-DD  
**Developer**: ____________  
**Reviewer**: ____________

### A. Files thay đổi

| File | Action | Notes |
|---|---|---|
| `path/to/file` | Modified | |

### B. Validation commands

```powershell
# command 1
# output

# command 2
# output
```

**Kết quả**: `PASS / FAIL`

### C. UI evidence

- Desktop screenshot: ____________________
- Laptop screenshot: ____________________
- Mobile screenshot: ____________________
- Session-sync recording (nếu slice đụng selected session): ____________________

### D. Requirement IDs covered

- `SDR-REQ-__`
- `SDR-REQ-__`

### E. Residual risks

- None / ______________________________________

### F. Architecture compliance

- Canonical path confirmed as `ShellStockDetailPage -> StockDetailPage -> coreApiAdapter -> /core/v1/*`: `YES / NO`
- Temporary legacy bridge still present: `YES / NO`
- If `YES`, owner: ____________________
- If `YES`, expiry: ____________________
- If `YES`, removal condition: ____________________
- Backend untouched in this slice: `YES / NO`
- If backend touched, OpenAPI metadata + PR gate checklist completed: `YES / NO / N/A`

### G. Selected-session compliance

- `selectedSession` owned at page root: `YES / NO`
- Order flow lane synced to selected session: `YES / NO / N/A`
- Advisory / alert summary synced to selected session: `YES / NO / N/A`

---

## Suggested slice evidence blocks

### `SD-01` — Workspace Contract & Page Architecture

- Key proof: `check:stock-detail-shell` pass + model contract exists.

### `SD-02` — Hero Workspace Frontend

- Key proof: screenshot cho toolbar, meta strip, price pane dominance, footer actions.

### `SD-03` — Order Flow Lane & Contextual Modules

- Key proof: `OrderFlowRadarPanel` nằm ngay dưới chart và session-sync video ngắn.

### `SD-04` — Insight Deck Native

- Key proof: alert/advisory summary follow selected session; news/financials degraded state đúng.

### `SD-05` — Adapter Completion

- Key proof: adapter unit tests + grep no direct fetch.

### `SD-06` — Core Contract Completion

- Key proof: focused backend suites + diff review no legacy route shortcuts.

### `SD-07` — Final Gates

- Key proof: package shell/build/test gates + root frontend build + `./start_dev.ps1` + browser smoke.
