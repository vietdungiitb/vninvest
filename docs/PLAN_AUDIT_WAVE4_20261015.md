# AUDIT PLAN Wave 4 MBW4 — 2 vong doc lap (Stage 2 DONG)

- **Plan:** `docs/PLAN_WAVE4_SOC_OPS_20261015.md` rev 1 (`47b85a39c`) → rev 2 (`c89e7d10d`) · **Nhanh:** `feat/mbw4-soc-ops`
- **Ket qua:** Vong 1 `NEED_REVISION` (O-1..O-6 + F1..F6) → sua het rev 2 → Vong 2 `AGREE` (mo Stage 3).

## Vong 1 — NEED_REVISION (6 objection bat buoc + 6 findings)

| # | Loai | Noi dung | Sua o rev 2 |
|---|---|---|---|
| C1/F5 | ERROR | B4.3 ghi sai adapter: SOC ops that o `adapters/core/soc.js:205-244`, `broker.js:28-202` la hub user | O-1: `soc.js` chu, `broker.js` chi DOC |
| C2 | CONTRADICTION | "Disjoint tuyet doi" trong khi B4.1 ⊂ B4.2 (cung `service_ops/**`) — vo L-M03 | O-2: 1 agent BE tuan tu; disjoint chi BE↔FE |
| C3/F2 | ERROR | `SystemBrokerCredential` khong co `expires_at` → expiry bat buoc migration hoac derived | O-3: derived (`now-last_verified_at>30d` hoac `!is_verified`), khong migration |
| C4/F3 | GAP | Kill-switch write + CSV chua co contract (route/method/scope) | O-4: dung lai `POST config/apply` (`views/broker.py:139-165`); O-5: CSV `?download=csv` theo `views/audit.py:105-128`, scope service, max 5000 |
| F1 | GAP | Health hien tai chi registry-status (`broker.py:259-264`), chua ops-health | Ghi ro B4.1 la viec moi (aggregate `BrokerSyncRun/Issue` + queue) |
| F4 | ERROR | `SocBrokerPanel.tsx:7` import barrel `soc.module.css` (plan cam) | B4.3 phai migrate sang tokens/components |
| F6 | RISK | AC chi tiet do plan suy ra, khong co goc | Ghi ro AC moi do plan nay de ra |
| L-T02 | Ghi nhan | Audit ghi `models.py:961-988` thieu path — dung la `identity_access/models.py:961-988` | Citation da sua; finding giu (ban chat dung) |

Da verify doc lap truoc khi sua (L-V02): `soc.js` + `SocBrokerPanel.tsx:7` + `identity_access/models.py:961-1010` mo that — C1/C3/F4 DUNG, C2 DUNG logic.

## Vong 2 — AGREE (verify exact tung dong, 20 diem)

O-1..O-6 DONG het voi bang chung: `soc.js:45,203-245` + `broker.js:28-32,75-201` · `models.py:961-988` khong `expires_at` + `982-985,1009-1014` khop · `broker.py:139-165` validate+audit + `broker_runtime.py:75-118` fail-closed · `audit.py:58,105-128` CSV pattern + `models.py:322-362` `ConfigChangeAudit` khong tenant FK · `PLAN:36` het mau thuan · `vi.js:2362`/`en.js:2365` `brokerWave3:` that · `mbw1_wave` nhat quan `CHUA XAC MINH`. 2 nit cosmetic (header `PLAN:11`, range runtime) — sua luc code, khong can rev plan. Khong citation sai, khong contradiction moi.

## Quyet dinh Stage 3 (cho phien code)

2 claims (`mbw4-be` gop B4.0+B4.1+B4.2 tuan tu · `mbw4-fe` B4.3) → 2 worktree cung checkout `feat/mbw4-soc-ops` → code → audit code → gates VPS → 1 PR `--merge` → released → ledger Entry → handoff → cleanup. Nguong §3 plan (bundle ≤1450, tsc 0, 1 leaf, pre-push 22/22).
