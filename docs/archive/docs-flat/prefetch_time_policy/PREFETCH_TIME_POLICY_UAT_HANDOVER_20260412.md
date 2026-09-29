# PREFETCH TIME POLICY - UAT HANDOVER (2026-04-12)

## 1) Muc tieu UAT

Xac nhan feature hoat dong dung ky vong business va van hanh an toan truoc full rollout.

Pham vi handover nay tap trung cho giai doan Gate C (Canary exit) va dau vao cho Gate D.

---

## 2) UAT preconditions

- Build da deploy tren canary/test stack.
- Admin account co quyen cap nhat settings.
- Co dashboard metrics va truy cap health payload.
- Da co baseline truoc canary (Gate B2).
- Co rollback runbook va owner on-call trong ca UAT.

Evidence preconditions:
- Gate B2 check: docs/ops-evidence/prefetch-policy-baseline/20260412-080254/gate-b2-check.md
- Release gates snapshot: docs/PREFETCH_TIME_POLICY_RELEASE_GATES_20260412.md
- PR6 test evidence: docs/PREFETCH_TIME_POLICY_PR6_EVIDENCE_20260412.md

---

## 3) Business scenarios

### S1 - Cau hinh policy tu AdminOps
- Steps:
  1. Mo AdminOps policy section.
  2. Chinh interval cho market_open.
  3. Save.
- Expected:
  - Save thanh cong.
  - Health/preview phan anh gia tri moi.

### S2 - Offhours skip
- Steps:
  1. Dat offhours query_enabled=false.
  2. Kiem tra ngoai gio.
- Expected:
  - Query skip xay ra.
  - Metrics skip tang.

### S3 - 429 adaptive behavior
- Steps:
  1. Gia lap upstream 429.
  2. Theo doi effective interval.
- Expected:
  - Interval tang theo multiplier.
  - Khong vuot max_interval.

### S4 - Invalid config prevention
- Steps:
  1. Nhap open_time > close_time.
  2. Thu save.
- Expected:
  - FE chan submit hoac backend tra 400 field errors.
  - Khong ghi policy sai.

### Mau ghi ket qua scenario

| Scenario | Owner | Start/End | Result (PASS/FAIL) | Evidence |
|---|---|---|---|---|
| S1 |  |  |  |  |
| S2 |  |  |  |  |
| S3 |  |  |  |  |
| S4 |  |  |  |  |

---

## 4) UAT evidence checklist

- [ ] Screenshot form truoc/sau save.
- [ ] Response snippet cua settings API.
- [ ] Health payload snippet co policy metadata.
- [ ] Metrics snapshot (429/skip/profile hits).
- [ ] Log snippet neu co fallback.

Goi y duong dan luu evidence cho dot UAT nay:
- docs/ops-evidence/prefetch-policy-uat/20260412-canary-exit/

Ten artifact de de truy vet:
- s1-admin-save-before-after.png
- s2-offhours-skip-metrics.json
- s3-429-adaptive-interval.json
- s4-invalid-config-400.json
- health-policy-metadata.json
- fallback-log-snippet.txt

---

## 5) Quick execution runbook (ops + QA)

1. Chot canary endpoint va xac nhan auth token admin.
2. Chay script capture artifact JSON:
  - scripts/ops/prefetch_policy_uat_capture.ps1 -ApiBase "http://127.0.0.1:8010" -AccessToken "<token>" -RunLabel "20260412-canary-exit"
2. Chay S1 va luu screenshot + response settings API.
3. Chay S2 trong khung offhours, xac nhan skip metric tang.
4. Chay S3 voi 429 simulation, xac nhan effective interval tang va clamp max.
5. Chay S4 voi payload invalid, xac nhan FE/BE chan ghi sai.
6. Cap nhat bang ket qua scenario, attach evidence, ky sign-off.

---

## 6) Mapping voi release gates

- Gate B2: da PASS (chi dung lam baseline tham chieu, khong thay the UAT).
- Gate C1: duoc bao phu boi S2 + S3 va metrics capture.
- Gate C2: duoc bao phu boi S1 + S2 + health payload verification.
- Gate C3: xac nhan tu incident board trong thoi gian canary.

Dieu kien de danh dau "Ready for Gate C sign-off":
- S1-S4 deu PASS.
- Checklist evidence muc 4 du file.
- Khong co P1/P2 mo trong cua so canary.

---

## 7) UAT sign-off

- QA Lead:
- Product Owner:
- Tech Lead:
- PM:
- Date:

---

## 8) Exit criteria

- Tat ca scenario S1-S4 pass.
- Khong co blocker P1/P2.
- Release gate C dat yeu cau.
- Evidence du de audit lai sau release.

---

## 9) Ghi chu hien trang (2026-04-12)

- Backend + frontend readiness da co bang chung test trong PR6 evidence.
- Gate B2 baseline da duoc checker xac nhan PASS.
- UAT scenarios S1-S4: chua ghi nhan ket qua final trong tai lieu nay (can owner cap nhat sau khi chay).

