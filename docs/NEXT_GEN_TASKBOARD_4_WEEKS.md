# VNInvest Next-Gen Taskboard 4 Tuần

Trang thai tong quan: READY FOR EXECUTION

Muc tieu: Chuyen ke hoach 4 tuan thanh bang cong viec co the giao ngay cho Backend, Frontend Web, Data, QA, DevOps ma khong thay doi code trong tai lieu nay.

Mapping sprint roadmap:
1. Sprint 21: Tuan 1 + Tuan 2
2. Sprint 22: Tuan 3 + Tuan 4A + Tuan 4B

---

## 0. Quy uoc su dung taskboard

1. Moi task co owner chinh va owner du phong.
2. Moi task co output ro rang, co tieu chi done, co ngay review.
3. Moi task co danh gia rui ro: Thap, Trung binh, Cao.
4. Moi ngay cap nhat 3 muc: Done, In Progress, Blocked.
5. Neu cham KPI do thi dung rollout va thuc hien rollback theo playbook.

---

## 1. Workstream va owner

1. Workstream A: Refactor Repository (Backend)
- Owner chinh: Backend Engineer
- Owner du phong: Tech Lead

2. Workstream B: Dynamic Thresholds theo ADV (Backend + Data)
- Owner chinh: Data/Backend Engineer
- Owner du phong: Tech Lead

3. Workstream C: Global WebSocket Provider (Frontend Web)
- Owner chinh: Frontend Web Engineer
- Owner du phong: Frontend Lead

4. Gate va van hanh
- Owner chinh: QA + DevOps
- Owner du phong: Tech Lead

---

## 2. Taskboard theo tuan

## Tuan 1 (Sprint 21): Baseline + Infra + Feature Flags

Muc tieu tuan:
- Co baseline metrics that.
- Co feature flags bat/tat tren staging.
- Chot du dieu kien Definition of Ready cho tuan 2.

### Tasks

1. T1-01
- Task: Chot danh sach KPI va nguong canh bao
- Owner: Tech Lead
- Phu thuoc: Khong
- Output: Tai lieu KPI va nguong do
- Done khi: KPI, nguong do, nguong do rollback duoc phe duyet
- Rui ro: Thap

2. T1-02
- Task: Tao dashboard metrics tren Grafana/Admin
- Owner: DevOps
- Phu thuoc: T1-01
- Output: Dashboard gom CPU worker, WS connections/user, reconnect rate, p95 latency
- Done khi: Dashboard co du lieu toi thieu 2 phien mock
- Rui ro: Trung binh

3. T1-03
- Task: Chot ten va default cua feature flags
- Owner: Tech Lead
- Phu thuoc: T1-01
- Output: Bang flag chuan
- Done khi: DYNAMIC_THRESHOLDS_ENABLED=false, GLOBAL_WS_PROVIDER_ENABLED=false, DYNAMIC_THRESHOLDS_CANARY_PERCENT=0
- Rui ro: Thap

4. T1-04
- Task: Cau hinh wrapper feature flags cho BE/FE web
- Owner: Backend Engineer + Frontend Web Engineer
- Phu thuoc: T1-03
- Output: Tai lieu huong dan cach bat/tat o staging
- Done khi: QA co the tu bat/tat flag trong 1 phut
- Rui ro: Trung binh

5. T1-05
- Task: Chup baseline report tuan 1
- Owner: QA + DevOps
- Phu thuoc: T1-02
- Output: Bao cao baseline
- Done khi: Co file baseline lam moc so sanh cho tuan 2-4
- Rui ro: Thap

### Gate cuoi tuan 1

Go khi:
1. Dashboard metrics on dinh.
2. Feature flags toggle duoc tren staging.
3. Baseline report day du.

No-Go khi:
1. Khong thu duoc p95 latency theo gio cao diem.
2. Feature flags chua co kill-switch ro rang.

---

## Tuan 2 (Sprint 21): Refactor Repository (Khong doi nghiep vu)

Muc tieu tuan:
- Tach Data Access khoi module tinh toan.
- Giu nguyen output ham tinh toan.

### Tasks

1. T2-01
- Task: Lap ban do ham dang dung inline import/ORM trong order flow
- Owner: Backend Engineer
- Phu thuoc: Tuan 1 Go
- Output: Danh sach diem can tach
- Done khi: Co inventory day du cua cac ham bi dinh data access
- Rui ro: Thap

2. T2-02
- Task: Thiet ke interface repository
- Owner: Backend Engineer
- Phu thuoc: T2-01
- Output: Contract input/output cho repository
- Done khi: Tech Lead review interface dat
- Rui ro: Trung binh

3. T2-03
- Task: Chuan bi bo fixture regression cho output hien tai
- Owner: QA + Backend Engineer
- Phu thuoc: T2-01
- Output: Snapshot output truoc refactor
- Done khi: Co bo fixture de so sanh truoc/sau
- Rui ro: Trung binh

4. T2-04
- Task: Tach query sang repository va giu nguyen cong thuc
- Owner: Backend Engineer
- Phu thuoc: T2-02, T2-03
- Output: Ban refactor da pass test
- Done khi: Khong con inline import model trong ham tinh toan muc tieu
- Rui ro: Cao

5. T2-05
- Task: Chay regression test va benchmark runtime
- Owner: QA + Backend Engineer
- Phu thuoc: T2-04
- Output: Bao cao so sanh output + runtime
- Done khi: Output khong doi, runtime p95 khong xau hon >10%
- Rui ro: Cao

### Gate cuoi tuan 2

Go khi:
1. Regression pass.
2. Output khong doi.
3. Runtime trong nguong.

No-Go khi:
1. Co sai khac output chua giai thich.
2. Co loi circular import moi.

---

## Tuan 3 (Sprint 22): ADV Pipeline + Shadow Mode

Muc tieu tuan:
- Co du lieu ADV 10 ngay on dinh.
- Dynamic thresholds chay shadow, chua anh huong user.

### Tasks

1. T3-01
- Task: Chot schema ADV va timestamp freshness
- Owner: Data/Backend Engineer
- Phu thuoc: Tuan 2 Go
- Output: Dac ta schema truong ADV
- Done khi: Da chot datatype, default, cach tinh freshness
- Rui ro: Trung binh

2. T3-02
- Task: Chot nguon ADV va lich cap nhat hang ngay
- Owner: Data Engineer
- Phu thuoc: T3-01
- Output: Ke hoach ingest + cron
- Done khi: Co lich cap nhat ro rang va cach monitor fail
- Rui ro: Trung binh

3. T3-03
- Task: Thiet ke fallback khi ADV thieu/stale
- Owner: Backend Engineer
- Phu thuoc: T3-01
- Output: Rule fallback static + warning
- Done khi: QA xac nhan rule fallback dung voi 3 case loi
- Rui ro: Cao

4. T3-04
- Task: Chay shadow mode static vs dynamic
- Owner: Backend Engineer + QA
- Phu thuoc: T3-02, T3-03
- Output: Log doi chieu shadow
- Done khi: Co bao cao diff theo nhom von hoa
- Rui ro: Cao

5. T3-05
- Task: Review precision va spam risk
- Owner: Tech Lead + QA
- Phu thuoc: T3-04
- Output: Ket luan canary co the bat 10% hay khong
- Done khi: Co bien ban go/no-go tuan 4A
- Rui ro: Trung binh

### Gate cuoi tuan 3

Go khi:
1. ADV freshness <24h dat SLO.
2. Fallback stable.
3. Bao cao shadow diff ro rang.

No-Go khi:
1. Ty le ADV stale cao.
2. Diff chenh lech lon khong co giai thich nghiep vu.

---

## Tuan 4A (Sprint 22): Canary Dynamic Thresholds

Muc tieu pha:
- Bat dynamic cho 10% user noi bo.
- Kiem soat chat alert va kha nang rollback.

### Tasks

1. T4A-01
- Task: Chot nhom user canary 10%
- Owner: QA + Ops
- Phu thuoc: Tuan 3 Go
- Output: Danh sach canary
- Done khi: Co nhom canary va ke hoach thong bao
- Rui ro: Thap

2. T4A-02
- Task: Bat cờ canary dynamic
- Owner: Ops
- Phu thuoc: T4A-01
- Output: Canary da bat
- Done khi: He thong chay on 1 phien mock
- Rui ro: Cao

3. T4A-03
- Task: Theo doi KPI va spam risk
- Owner: QA + DevOps
- Phu thuoc: T4A-02
- Output: Bao cao canary 24h
- Done khi: KPI khong cham dieu kien do
- Rui ro: Cao

4. T4A-04
- Task: Rollback drill
- Owner: QA + Ops
- Phu thuoc: T4A-02
- Output: Bien ban drill
- Done khi: Tat cờ va phuc hoi ve static duoi 3 phut
- Rui ro: Trung binh

### Gate cuoi pha 4A

Go khi:
1. KPI on dinh.
2. Khong spam alert bat thuong.
3. Rollback drill dat.

No-Go khi:
1. Reconnect >5% trong 5 phut.
2. P95 latency vuot SLA lien tuc.

---

## Tuan 4B (Sprint 22): WebSocket Provider Phase 1 (Watchlist)

Muc tieu pha:
- Giam so ket noi WS tren web.
- Giu nguyen UX chuc nang.

### Tasks

1. T4B-01
- Task: Chot adapter plan cho hook cu
- Owner: Frontend Web Engineer
- Phu thuoc: Tuan 1-3 khong blocker FE
- Output: Ke hoach migrate Watchlist
- Done khi: Review thong qua voi Frontend Lead
- Rui ro: Trung binh

2. T4B-02
- Task: Migrate Watchlist sang provider (phase 1)
- Owner: Frontend Web Engineer
- Phu thuoc: T4B-01
- Output: Watchlist dung provider
- Done khi: 1 page nhieu widget van chi 1 WS open
- Rui ro: Cao

3. T4B-03
- Task: Kiem tra reconnect/token refresh
- Owner: QA + Frontend Web Engineer
- Phu thuoc: T4B-02
- Output: Bao cao reconnect
- Done khi: Drop/reconnect khong xau hon baseline
- Rui ro: Cao

4. T4B-04
- Task: Danh gia kha nang mo rong Dashboard
- Owner: Frontend Lead
- Phu thuoc: T4B-03
- Output: Quyet dinh mo phase 2 hay giu
- Done khi: Co bien ban go/no-go cho phase tiep
- Rui ro: Trung binh

### Gate cuoi pha 4B

Go khi:
1. WS connections giam >=40% tren context muc tieu.
2. Reconnect rate <3%.
3. Khong regression UX.

No-Go khi:
1. Co bug subscribe/unsubscribe anh huong data live.
2. Co token refresh loop.

---

## 3. Bang KPI va nguong canh bao

1. P95 realtime latency <1.5s.
2. WS connections giam >=40% so voi baseline context.
3. Reconnect rate <3% tren web.
4. Dynamic threshold giam canh bao rac o Mid/Small cap.

Nguong do immediate rollback:
1. Reconnect >5% trong 5 phut.
2. Alert volume tang dot bien khong ly giai duoc.
3. P95 latency vuot SLA lien tuc 10 phut.

---

## 4. Cadence hop va bao cao

1. Daily standup 15 phut:
- Hom qua da lam gi
- Hom nay lam gi
- Blocked gi

2. Mid-week checkpoint:
- So baseline KPI hien tai voi KPI gate.

3. End-week review:
- Ket qua gate Go/No-Go.
- Quyet dinh tiep tuc hay rollback.

---

## 5. Mau cap nhat trang thai hang ngay

Ngay:

Workstream A
- Done:
- In Progress:
- Blocked:

Workstream B
- Done:
- In Progress:
- Blocked:

Workstream C
- Done:
- In Progress:
- Blocked:

Ops/QA
- Done:
- In Progress:
- Blocked:

KPI Snapshot
- Latency p95:
- Reconnect rate:
- WS connections/user:
- Alert noise note:

Quyet dinh trong ngay
- Continue / Hold / Rollback
- Ly do:

---

## 6. Quyet dinh sau tuan 4

Chi mo planning cho cac hang muc sau khi dat KPI 4 tuan:
1. MessagePack/Protobuf (chi khi co bang chung bottleneck bang thong).
2. AI Rebalancing (sau khi threshold on dinh it nhat 1-2 thang).
3. Multi-asset Derivatives (di stream doc lap, khong tron voi wave on dinh loi).
