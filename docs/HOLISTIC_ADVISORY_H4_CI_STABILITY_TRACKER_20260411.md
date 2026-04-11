# Holistic Advisory H4 CI Stability Tracker

Status: IN PROGRESS
Date: 2026-04-11
Scope: Governance Release Gate workflow (`.github/workflows/governance-release-gate.yml`)

## 1) Muc tieu

Theo doi 3-5 lan chay CI dau tien tren `deploy/main` de xac nhan do on dinh, phat hien flaky signal, va tong hop action item truoc GO/NO-GO.

## 2) Checklist moi lan run

- [ ] Workflow trigger (`push`, `pull_request`, hoac `workflow_dispatch`) hop le
- [ ] Postgres service healthy truoc khi test
- [ ] Test count dung ky vong (18 tests)
- [ ] Result `OK`
- [ ] Khong co warning moi ngoai OpenCore DPIPlan known noise
- [ ] Thoi gian job trong nguong chap nhan (de xuat < 8 phut)

## 3) Run log

| # | Timestamp (UTC+7) | Branch | Trigger | Commit | Result | Duration | Notes |
|---|-------------------|--------|---------|--------|--------|----------|-------|
| 1 | 2026-04-11 14:43 (+07) | deploy | push | 6a56371c | PENDING_UI_VERIFY | TODO | Workflow duoc trigger sau push deploy; can xac nhan ket qua tren GitHub Actions UI |
| 2 | TODO | deploy/main | push/PR/manual | TODO | TODO | TODO | |
| 3 | TODO | deploy/main | push/PR/manual | TODO | TODO | TODO | |
| 4 | TODO | deploy/main | push/PR/manual | TODO | TODO | TODO | optional |
| 5 | TODO | deploy/main | push/PR/manual | TODO | TODO | TODO | optional |

## 3.1 Mau dien nhanh tu Actions UI

Su dung mau sau cho moi run, sau do copy vao bang Run log:

```
Timestamp (UTC+7):
Branch:
Trigger: push | pull_request | workflow_dispatch
Commit SHA:
Result: OK | FAIL | CANCELLED
Duration (mm:ss):
Run URL:
Notes:
```

Nguon du lieu trong GitHub Actions UI:

1. `Result`: lay tu trang run summary.
2. `Duration`: lay tu tong job duration (governance-postgres-regression).
3. `Commit SHA`: lay tu run header hoac commit link.
4. `Trigger`: push/PR/manual theo event type.

Quy uoc dien `Notes`:

- Neu co warning OpenCore DPIPlan nhung test `OK`: ghi `known noise only`.
- Neu fail: ghi test dau tien fail + ly do ngan gon.
- Luon kem `Run URL` de trace lai.

## 4) Danh gia on dinh

- Pass rate: TBD (cho du lieu run #1..#3)
- Co flaky? TODO
- Failure pattern: TODO
- False-positive pattern: TODO

## 5) Action items

1. Xac nhan run #1 (commit 6a56371c) tren Actions UI va cap nhat `Result` + `Duration`.
2. TODO
3. TODO

## 5.1 Mapping nhanh trang thai run

- `OK`: tat ca test pass, khong co loi moi ngoai known noise.
- `FAIL`: co it nhat 1 test fail hoac job error.
- `CANCELLED`: run bi huy, khong du dieu kien tinh pass rate.

## 6) Quy tac chot GO/NO-GO

De xuat GO khi:

1. It nhat 3 lan chay lien tiep `OK`.
2. Khong co failure moi lien quan governance tests.
3. Neu co warning noise, da duoc classify va khong anh huong quality gate.

Nguoc lai -> NO-GO tam thoi va mo incident/phien dieu tra.
