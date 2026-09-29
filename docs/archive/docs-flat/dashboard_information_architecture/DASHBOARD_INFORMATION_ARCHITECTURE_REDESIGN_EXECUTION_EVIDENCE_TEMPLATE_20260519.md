# EXECUTION EVIDENCE TEMPLATE — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Hướng dẫn**: Copy block này cho từng slice `DIR-01` → `DIR-07` và điền đầy đủ trước khi mark DONE.

---

## Template — `[SLICE-ID] [Slice Name]`

**Ngày thực hiện**: YYYY-MM-DD  
**Developer**: ____________  
**Reviewer**: ____________

### A. Files thay đổi

| File | Action | Notes |
|---|---|---|
| `path/to/file.jsx` | Modified | |

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
- Tablet screenshot: ____________________
- Mobile screenshot: ____________________

### D. Requirement IDs covered

- `DIR-REQ-__`
- `DIR-REQ-__`

### E. Residual risks

- None / ______________________________________

### F. Architecture compliance

- Canonical path confirmed as `PackageDashboardHost -> DashboardPage -> coreApiAdapter -> /core/v1/*`: `YES / NO`
- Temporary legacy bridge still present: `YES / NO`
- If `YES`, owner: ____________________
- If `YES`, expiry: ____________________
- If `YES`, removal condition: ____________________
- Backend untouched in this slice: `YES / NO`
- If backend touched, OpenAPI metadata + PR gate checklist completed: `YES / NO / N/A`

---

## Suggested slice evidence blocks

### `DIR-01` — Shared Layout Contract

- Files: `frontend/src/index.css`, `packages/web/src/pages/DashboardPage.js`, `frontend/src/pages/PackageDashboardHost.jsx`
- Key proof: AI lane slot exists, bubble slot de-prioritized

### `DIR-02` — Top Triad

- Files: `frontend/src/pages/modern/ModernDashboard.jsx`
- Key proof: 1440px screenshot shows alert | heatmap | AI

### `DIR-03` — Full-width Deck

- Files: `frontend/src/pages/modern/ModernDashboard.jsx`, optional deck wrapper files
- Key proof: deck sits below triad and spans width

### `DIR-04` — Remove Low-value Blocks

- Files: `frontend/src/pages/modern/ModernDashboard.jsx`, `frontend/src/components/modern/SmartStatsHeader.jsx`
- Key proof: no sticky alert strip, no sidebar, compact metrics retained

### `DIR-05` — Package-host Parity

- Files: `frontend/src/pages/PackageDashboardHost.jsx`, `packages/web/src/pages/DashboardPage.js`
- Key proof: host screenshot matches IA of live route

### `DIR-06` — Responsive + Accessibility

- Files: CSS + page shells
- Key proof: desktop/tablet/mobile screenshots + focus/scroll notes

### `DIR-07` — Final Gates

- Files: ledger/progress/module tree as applicable
- Key proof: build PASS, runtime refresh PASS, review + spec audit PASS
