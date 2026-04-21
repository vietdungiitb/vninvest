# Taskboard: AI Advisory Enhancement & Market Discovery (2026-04-21)

This taskboard tracks the execution of AI Advisory Improvements based on the April 2026 Audit.

## Slice 1: Logic Consolidation (SSOT)
*Goal: Centralize whale detection logic to prevent data interpretation drift.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **AD-BE-01** | Create `WhaleSignalEngine` service class | [ ] | BE |
| **AD-BE-02** | Move side-detection logic from views to `WhaleSignalEngine` | [ ] | BE |
| **AD-BE-03** | Standardize threshold resolution using canonical service | [ ] | BE |
| **AD-BE-04** | Verify alert/advisory consistency with automated tests | [ ] | BE |

---

## Slice 2: Market Discovery API
*Goal: Breakthrough the "Watchlist Gate" by providing market-wide visibility.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **AD-BE-05** | Add `scope=market` query support to symbol-stats API | [ ] | BE |
| **AD-BE-06** | Optimize global `IntradayTick` aggregation for discovery mode | [ ] | BE |
| **AD-BE-07** | Implement `sync_market_whale_discovery` periodic task | [ ] | BE |

---

## Slice 3: Frontend Discovery & Polish
*Goal: Intuitive UI for discovering whales and visualizing them spatially.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **AD-FE-01** | Add "Market Mode" toggle in `WhaleSymbolSidebar` | [ ] | FE |
| **AD-FE-02** | Update `WhaleAdvisoryCommandPanel` to handle "Market" context | [ ] | FE |
| **AD-FE-03** | Integrate **Whale Bubble Chart** into Advisory Panel | [ ] | FE |
| **AD-FE-04** | Add "Deep Link" to tick logs for AI explainability | [ ] | FE |

---

## Slice 4: Release & Validation
*Goal: Ensure performance and correctness after enhancement.*

| Task ID | Description | Status | Owner |
| :--- | :--- | :--- | :--- |
| **AD-QA-01** | Stress test Market Discovery under high volume (1M+ ticks) | [ ] | QA |
| **AD-QA-02** | Verify Discovery-to-Watchlist conversion flow | [ ] | QA |
| **AD-REL-01** | Release Gated rollout for Pro+ users | [ ] | DevOps |

---

## Definition of Done (DoD)
- [ ] Logic for detecting whales is unified in `WhaleSignalEngine`.
- [ ] Users can browse top market whales without tracking them.
- [ ] Sidebar and Command Panel are visually synchronized in real-time.
- [ ] All new labels are translated in `vi.js` and `en.js`.
