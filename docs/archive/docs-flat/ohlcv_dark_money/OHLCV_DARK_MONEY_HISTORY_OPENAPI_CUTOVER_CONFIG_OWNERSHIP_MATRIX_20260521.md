# Config Ownership Matrix - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Ownership baseline

---

| Config/Contract Surface | Owner Team | Backup Owner | Change Rule | Validation Rule |
|---|---|---|---|---|
| Timeframe alias map (chart) | Backend Market Data | Core API Guild | PR + reviewer approval | Unit + API tests |
| Interval/period map (dark-money-history) | Backend Signals/Portfolio | Core API Guild | PR + reviewer approval | Unit + API tests |
| Intraday max lookback clamp | Backend Market Data | Backend Lead | PR + reviewer approval | Boundary tests |
| OpenAPI metadata for chart route | Core API Guild | Backend Lead | PR + schema review | schema lint + integration |
| OpenAPI metadata for dark-money route | Core API Guild | Backend Lead | PR + schema review | schema lint + integration |
| Frontend adapter route mapping | Frontend Platform | Frontend Lead | PR + test required | adapter tests |
| Error envelope parser behavior | Frontend Platform | Core API Guild | PR + test required | adapter/page tests |
| Legacy route deprecation toggle | Backend Lead | Tech Lead | Controlled rollout | parity + regression checks |

---

## Notes

- No production shadow-run requirement for this package in current development stage.
- Dev parity replay remains mandatory before replacement sign-off.
