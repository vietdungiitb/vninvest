# PREFETCH TIME POLICY - RELEASE GATES (2026-04-12)

## Muc tieu

Thiet lap cong tam kiem soat truoc khi:
- Mo canary.
- Mo full production.

Tai lieu nay dung cho PM, Tech Lead, QA Lead, BE Lead va FE Lead ky duyet.

---

## Gate map

1. Gate A - Pre-merge readiness
2. Gate B - Canary deploy approval
3. Gate C - Canary exit approval
4. Gate D - Full rollout approval
5. Gate E - Post-release verification

---

## Gate A - Pre-merge readiness

### A1. Code readiness
- [x] PR-1 toi PR-6 deu co scope ro rang va checklist da tick.
- [x] Khong con TODO critical trong code lien quan policy.
- [x] Da cap nhat changelog va docs dieu huong.

### A2. Test readiness
- [x] Backend unit/integration test critical pass.
- [x] Frontend test critical pass.
- [x] Manual QA matrix da co va da assign owner.

### A3. Operational readiness
- [x] Da co default policy an toan neu runtime policy loi.
- [x] Da co rollback path ro rang.

### A4. Sign-off
- [ ] BE Lead
- [ ] FE Lead
- [ ] QA Lead
- [ ] Tech Lead

Ghi chu Gate A (2026-04-12):
- Da pass consolidated backend tests (9 tests): adapter fallback + policy resolver + policy guard metrics + admin policy API.
- Da pass frontend automated suite (7 suites, 41 tests).
- De local run on dinh, dung test env override `DB_ENGINE=sqlite`.
- Evidence chi tiet: docs/PREFETCH_TIME_POLICY_PR6_EVIDENCE_20260412.md

---

## Gate B - Canary deploy approval

### B1. Deploy plan
- [ ] Chon canary scope (service/tenant/traffic ratio).
- [ ] Chot thoi gian monitor toi thieu 24h.
- [ ] Xac nhan team on-call trong khung gio canary.

### B2. KPI baseline truoc canary
- [x] Baseline 429 rate duoc chup lai.
- [x] Baseline cooldown events duoc chup lai.
- [x] Baseline freshness trong market_open duoc chup lai.
- [x] Baseline latency p95 endpoint lien quan duoc chup lai.

Huong dan thu baseline:
- Script: `scripts/ops/prefetch_policy_capture_baseline.ps1`
- Playbook: `docs/PREFETCH_TIME_POLICY_BASELINE_CAPTURE_PLAYBOOK_20260412.md`
- Evidence output: `docs/ops-evidence/prefetch-policy-baseline/<timestamp>/baseline-summary.json`

Ghi chu hien tai:
- Da smoke-run script (khong auth): `docs/ops-evidence/prefetch-policy-baseline/20260412-074032/`.
- Da chay baseline co auth tren runtime `http://127.0.0.1:8010`: `docs/ops-evidence/prefetch-policy-baseline/20260412-080254/`.
- Da chay checker tu dong va PASS: `docs/ops-evidence/prefetch-policy-baseline/20260412-080254/gate-b2-check.md`.
- Luu y: metrics hien tai cho thay latency p95 cao va 5xx ratio cao tren `realtime-ticker`; can duoc dung lam baseline de so sanh canary, khong coi la "healthy" threshold.

### B3. Guardrail config
- [x] Co ngong canh bao va ngong rollback cho tung KPI.
- [ ] Co alert route den kenh van hanh.

Tai lieu nguong:
- `docs/PREFETCH_TIME_POLICY_GUARDRAIL_THRESHOLDS_20260412.md`

### B4. Sign-off
- [ ] SRE/Infra
- [ ] Tech Lead
- [ ] PM

---

## Gate C - Canary exit approval

### C1. KPI pass/fail criteria
- [ ] 429 rate khong tang qua nguong chap nhan.
- [ ] Cooldown events khong tang bat thuong.
- [ ] Freshness market_open khong giam qua nguong.
- [ ] p95 latency khong xau di qua nguong.

### C2. Functional confidence
- [ ] Health payload hien thi policy profile dung theo gio.
- [ ] Offhours skip hoat dong dung expectation.
- [ ] AdminOps save policy hoat dong on dinh.

### C3. Incident review
- [ ] Khong co P1/P2 mo lien quan policy.
- [ ] Neu co P3/P4 da co workaround ro rang.

### C4. Sign-off
- [ ] QA Lead
- [ ] Tech Lead
- [ ] PM

---

## Gate D - Full rollout approval

### D1. Rollout phasing
- [ ] Ke hoach mo rong traffic theo buoc da duoc ghi ro.
- [ ] Co dieu kien dung rollout neu KPI xau.

### D2. Communication
- [ ] Da thong bao team support/ops.
- [ ] Da thong bao stakeholder ve expected behavior ngoai gio.

### D3. Final approval
- [ ] Tech Lead
- [ ] Product Owner
- [ ] PM

---

## Gate E - Post-release verification (24-72h)

### E1. KPI verification
- [ ] 429 rate cai thien so voi baseline.
- [ ] Cooldown events giam hoac on dinh.
- [ ] Freshness trong gio giao dich dat muc ky vong.
- [ ] p95 latency on dinh.

### E2. Functional verification
- [ ] Khong co regression tren watchlist/admin sync flow.
- [ ] Time profile transitions dung theo policy.

### E3. Documentation closure
- [ ] Cap nhat task tracker trang thai done.
- [ ] Luu evidences vao PR-6.
- [ ] Chot postmortem ngan (neu co su co).

---

## Rollback trigger matrix

- Trigger R1: 429 rate tang > nguong rollback trong 30-60 phut lien tiep.
- Trigger R2: Freshness market_open giam duoi nguong toi thieu.
- Trigger R3: p95 latency vuot nguong SLO lien tiep.
- Trigger R4: Xuat hien P1/P2 lien quan policy.

Neu bat ky trigger nao xay ra:
1. Kich hoat rollback policy ngay.
2. Khoi phuc safe default.
3. Theo doi 30 phut sau rollback.
4. Tao incident note va quyet dinh rollout lai sau.

---

## Ky duyet

- Ngay:
- BE Lead:
- FE Lead:
- QA Lead:
- SRE/Infra:
- Tech Lead:
- PM:
- Product Owner:

---

## Snapshot hien tai (2026-04-12)

- Gate A: Ready for sign-off.
- Gate B: In progress (B2 da complete, B1/B3/B4 pending).
- Gate C: Not started.
- Gate D: Not started.
- Gate E: Not started.
