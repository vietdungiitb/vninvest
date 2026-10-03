# Sprint 24 - Trust and Decision Control Stories

Status: READY FOR EXECUTION
Scope window: Day 6 -> Day 10 in Sprint 24
Related plan: docs/SPRINT24_DASHBOARD_REALTIME_EXECUTION_PLAN.md
Related checklist: docs/SPRINT24_ACCEPTANCE_CHECKLIST.md
Related taskboard IDs: S24-06..S24-10

## 1) Sprint objective
Tang trai nghiem tin cay du lieu va giup user lam chu quyet dinh thong qua 5 nang luc:
1. Explainability tren recommendation card.
2. Data freshness va source transparency.
3. Action checklist truoc khi ra quyet dinh.
4. Risk mode do user tu chon va luu preference.
5. Recommendation history mini co ket qua T+1/T+3/T+5.

## 2) User stories (INVEST + GWT)

### S24-06 - Decision card explainability
- Story:
As a retail investor, I want moi recommendation card co ly do va dieu kien vo hieu, so that toi hieu vi sao he thong de xuat va tu quyet dinh duoc.
- INVEST checklist:
I (Independent): tach rieng khoi data ingestion va co the release rieng.
N (Negotiable): co the thay doi so luong signal contributors theo UX test.
V (Valuable): giam tinh trang "AI black-box".
E (Estimable): 1 ngay FE + 0.5 ngay QA.
S (Small): mot card component va schema mapping.
T (Testable): pass neu card hien thi du why/confidence/invalidation.
- Acceptance criteria (Given/When/Then):
1. Given recommendation card co data hop le, when user mo card, then hien thi 3 nhom thong tin: why, confidence, invalidation trigger.
2. Given confidence < threshold UI, when card render, then hien thi canh bao "high uncertainty".
3. Given thieu bat ky field bat buoc, when render, then fallback block hien thi "insufficient explainability" va log telemetry.
- Owner: FE-Lead-1
- Estimate: 1d
- Dependency: S24-02

### S24-07 - Data freshness badge
- Story:
As an active trader, I want thay duoc data realtime/delayed va timestamp cap nhat cuoi, so that toi danh gia duoc do tin cay cua du lieu truoc khi hanh dong.
- INVEST checklist:
I: co the trien khai doc lap voi recommendation logic.
N: nguong stale co the tune theo canary.
V: tang trust vao quote/P-L.
E: 1 ngay FE.
S: mot UI badge + time formatter + stale state.
T: test duoc bang fixture stale/fresh.
- Acceptance criteria (Given/When/Then):
1. Given feed dang song, when dashboard cap nhat, then badge hien thi "Realtime" + age < stale threshold.
2. Given feed dung update qua stale threshold, when render, then badge chuyen "Delayed" + hien thi thoi gian cap nhat cuoi.
3. Given fallback polling mode, when status doi, then badge cap nhat dung mode va khong flicker.
- Owner: FE-2
- Estimate: 1d
- Dependency: S24-02, S24-04

### S24-08 - Action checklist pre-decision
- Story:
As a disciplined investor, I want checklist ngan truoc khi xac nhan hanh dong, so that toi khong ra quyet dinh bóc dong.
- INVEST checklist:
I: tach rieng UI flow truoc action button.
N: co the thay noi dung checklist theo PM.
V: tang quality quyet dinh.
E: 1 ngay FE + QA script.
S: 3-5 cau hoi voi complete state.
T: pass neu co completion state va tracking event.
- Acceptance criteria (Given/When/Then):
1. Given user chon hanh dong tu recommendation, when mo panel action, then checklist 3-5 items hien thi truoc nut confirm.
2. Given user chua hoan tat checklist, when bam confirm, then he thong chan hanh dong va huong dan item con thieu.
3. Given user hoan tat checklist, when confirm, then action duoc tiep tuc va ghi telemetry completion.
- Owner: FE-2
- Estimate: 1d
- Dependency: S24-06

### S24-09 - User risk mode control
- Story:
As a portfolio owner, I want chon risk mode (Phong thu/Can bang/Tang truong), so that recommendation phu hop khau vi rui ro cua toi.
- INVEST checklist:
I: control UI + persisted preference.
N: mapping ngưong recommendation co the tune sau.
V: user co cam giac lam chu he thong.
E: 1 ngay FE.
S: selector + preference persistence.
T: pass neu mode duoc luu/restore dung.
- Acceptance criteria (Given/When/Then):
1. Given user doi risk mode, when save, then mode moi duoc ap dung cho recommendation filtering hien tai.
2. Given user reload trang, when app khoi dong, then mode truoc do duoc restore.
3. Given mode moi khien recommendation list thay doi, when render, then hien thi thong bao "view updated by risk mode".
- Owner: FE-1
- Estimate: 1d
- Dependency: S24-06

### S24-10 - Recommendation history mini
- Story:
As a skeptical investor, I want xem ket qua recommendation gan day (T+1/T+3/T+5), so that toi danh gia duoc do dang tin cua he thong.
- INVEST checklist:
I: widget doc lap o dashboard/advisory panel.
N: co the doi ky han hien thi.
V: tang bang chung hieu qua.
E: 1 ngay FE + 0.5 ngay data mapping.
S: mini list + badge ket qua.
T: pass neu hien thi dung du lieu mau va empty state.
- Acceptance criteria (Given/When/Then):
1. Given co history data, when mo panel, then hien thi toi da 5 records moi nhat voi ket qua T+1/T+3/T+5.
2. Given khong co data, when render, then hien thi empty state ro rang va khong vo layout.
3. Given record co ket qua am/duong, when render, then dung color token + label policy da dinh nghia.
- Owner: FE-1
- Estimate: 1d
- Dependency: S24-06, S24-07

## 3) Sprint 24 trust-specific telemetry
1. recommendation_explainability_opened
2. recommendation_explainability_insufficient
3. recommendation_risk_mode_changed
4. recommendation_action_checklist_completed
5. recommendation_action_attempt_blocked
6. recommendation_history_opened

## 4) Go/No-Go checklist for trust track
1. 100% recommendation card co explainability block.
2. 100% decision surfaces co freshness badge va timestamp.
3. Action checklist co block behavior truoc confirm.
4. Risk mode duoc persist qua session reload.
5. Recommendation history mini hien thi duoc T+1/T+3/T+5 tren sample user.
6. Co log telemetry cho toan bo luong trust actions.

## 5) Daily execution protocol (Day 6-10)
1. 09:00 lock scope story trong ngay.
2. 14:00 post half-day evidence (screenshot + test status + blocker).
3. 17:30 update taskboard va checklist gate.
4. Blocker > 4h phai escalate PM + FE lead ngay trong ngay.
