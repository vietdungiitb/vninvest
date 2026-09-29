# Execution Evidence Template — DNSE Historical Backfill Whale & Dark Flow

---

## Slice metadata
- Slice ID: D0_ (D01 / D02 / D03 / D04 / D05 / D06 / D07)
- Ngày thực hiện:
- Owner:
- Commit hash:

---

## Objective
-

---

## Files changed
1. (CREATE / MODIFY)
2.
3.

---

## Validation commands

```powershell
# Tests
Push-Location ./packages/core/backend
python manage.py test <app>.tests.<test_file> --keepdb
Pop-Location

# Stack rebuild
cd "c:\Mujoco Projects\vninvest"; .\start_dev.ps1

# Smoke check
docker exec vninvest-dev-core-api python -c "..."
```

---

## Validation results

```
Test output:
...
Ran X tests in Xs
OK
```

---

## Runtime evidence
- start_dev.ps1 result: [ PASS / FAIL ]
- Health check containers: [ healthy ]
- Stack errors after rebuild: [ none / list ]

---

## Metrics snapshot (cho D03/D04)
- ticks_inserted:
- dates_inserted:
- dates_skipped_already_exists:
- dates_skipped_system_has_data:
- symbols_processed:
- task status:

---

## Security check (cho D01/D02)
- DNSEQuote import outside adapter: [ 0 matches ]
- api_key in logs: [ not found ]
- GET credential response contains key: [ NO ]

---

## API/UI evidence
- API payload snapshot (nếu chạm contract):
- UI screenshot (nếu là D07):

---

## Residual risks
-

---

## Next slice
- Slice tiếp theo: D0_
- Điều kiện tiên quyết đã đủ: [ YES / NO ]
- Ghi chú:

---
