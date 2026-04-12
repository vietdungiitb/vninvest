# PREFETCH TIME POLICY - ROLLBACK RUNBOOK (2026-04-12)

## 1) Muc tieu

Rollback nhanh va an toan khi policy moi gay tac dong xau den he thong.

---

## 2) Trigger rollback

Kich hoat rollback neu co 1 trong cac dieu kien:
- 429 rate vuot nguong rollback.
- Freshness market_open giam manh duoi nguong.
- p95 latency vuot SLO lien tuc.
- Co su co P1/P2 lien quan policy.

---

## 3) Roles

- Incident commander: Tech Lead
- Executor backend: BE on-call
- Observer KPI: SRE/Infra
- Communicator: PM

---

## 4) Rollback steps (T0 -> T+30m)

T0-T5:
1. Xac nhan trigger va dong băng thay doi moi.
2. Thong bao incident channel.

T5-T10:
3. Dat runtime policy ve safe default (offhours conservative).
4. Neu can, tat policy override va dung static settings.

T10-T20:
5. Kiem tra health payload da ve profile an toan.
6. Theo doi KPI 429/freshness/latency moi 5 phut.

T20-T30:
7. Danh gia on dinh tam thoi.
8. Chot trang thai incident (mitigated hoac escalate tiep).

---

## 5) Verification checklist sau rollback

- [ ] Task worker khong crash.
- [ ] 429 trend giam.
- [ ] Freshness phuc hoi xu huong.
- [ ] Latency tro ve nguong chap nhan.
- [ ] Admin settings endpoint van truy cap duoc.

---

## 6) Communication template

- Thoi diem phat hien:
- Trieu chung:
- Trigger rollback:
- Hanh dong da thuc hien:
- Trang thai hien tai:
- ETA cap nhat tiep theo:

---

## 7) Post-rollback actions

- Tao RCA ngan trong 24h.
- Them test case de chan tai dien.
- Dieu chinh nguong release gate neu can.
- Chot quyet dinh rollout lai hay hoan.
