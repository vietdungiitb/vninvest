# EXECUTION EVIDENCE TEMPLATE — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục đích**: template chuẩn để nộp bằng chứng cho mỗi slice hoặc cho whole-pack closeout.

---

## 1. Header

- **Slice ID**:
- **Task title**:
- **Owner**:
- **Date**:
- **Status**: PASS / FAIL / BLOCKED
- **Environment**: local / dev / staging / production
- **Branch**:

---

## 2. Files changed

| File | Change type | Notes |
|---|---|---|
| `path/to/file.tsx` | add/edit/delete |  |
| `path/to/file.md` | add/edit/delete |  |

---

## 3. Validation commands and results

| Command | Expected | Actual | Pass? |
|---|---|---|---|
| `npm run build` | exit 0 |  |  |
| `npm run lint` | exit 0 |  |  |
| `curl ...` | 200 / JSON |  |  |
| browser smoke | page renders |  |  |

---

## 4. UI evidence

### Screenshot list

| Screenshot | What it proves | File path |
|---|---|---|
| 1 | homepage VI | `evidence/...png` |
| 2 | homepage EN | `evidence/...png` |
| 3 | chart page | `evidence/...png` |
| 4 | playground output | `evidence/...png` |

### Screenshot notes
- capture full viewport on desktop
- capture responsive mobile if layout changed
- annotate only if the UI state is ambiguous

---

## 5. Payload evidence

### Chart relay payload

```json
{
  "symbol": "VNM",
  "tf": "1d",
  "rows": 0,
  "status": "ok"
}
```

### Playground relay payload

```json
{
  "symbol": "VNM",
  "data_type": "ohlcv",
  "period": "1M",
  "rows": 0
}
```

### Notes
- Include real payload snapshot when slice touches route/data.
- Redact secrets, tokens, cookies, and private backend URLs.

---

## 6. Rebuild / deploy evidence

- `docker build` output:
- `docker compose` output:
- Portainer service name:
- Health status:
- Public domain curl result:

---

## 7. Residual risk note

Write one short paragraph covering:
- what is still not ideal,
- whether it blocks release,
- what the next slice or Ops action should be.

Example:
> Residual risk: Pyodide still loads from CDN, so first paint depends on external network availability. This does not block functional release, but we should self-host the runtime in a follow-up hardening slice.

---

## 8. Sign-off

- **Code owner**:
- **Reviewer**:
- **QA / Ops**:
- **Approval**: PASS / CONDITIONAL PASS / NO-GO
