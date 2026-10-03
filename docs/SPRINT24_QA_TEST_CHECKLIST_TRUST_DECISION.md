# Sprint 24 - QA Test Checklist (Trust and Decision Control)

Status: READY FOR EXECUTION
Scope: S24-06..S24-10
Related stories: docs/SPRINT24_TRUST_DECISION_STORIES.md
Related acceptance gates: docs/SPRINT24_ACCEPTANCE_CHECKLIST.md (Section F)

## 1) Test environment and preconditions
1. Frontend build pass tren branch Sprint 24.
2. Dashboard load duoc voi advisory data mock/staging.
3. Co 2 bo du lieu test:
- Dataset A (fresh): feed realtime cap nhat lien tuc.
- Dataset B (stale): feed delay vuot stale threshold.
4. Co user profile mau cho 3 risk mode:
- Defensive
- Balanced
- Growth

## 2) Coverage matrix
| Story | Feature | Happy path | Edge cases | Telemetry validation |
|---|---|---|---|---|
| S24-06 | Explainability card | Yes | Yes | Yes |
| S24-07 | Freshness badge | Yes | Yes | Yes |
| S24-08 | Action checklist | Yes | Yes | Yes |
| S24-09 | Risk mode control | Yes | Yes | Yes |
| S24-10 | Recommendation history mini | Yes | Yes | Yes |

## 3) Detailed test cases

### S24-06 - Decision card explainability

TC-06-01 (Happy path)
- Given recommendation card co data day du
- When user mo card chi tiet
- Then thay du 3 block: why, confidence, invalidation trigger
- Expected: layout dung spec, text khong bi truncate bat thuong

TC-06-02 (Low confidence state)
- Given recommendation confidence < nguong UI
- When card render
- Then hien thi canh bao high uncertainty
- Expected: visual state dung mau/copy theo design token

TC-06-03 (Missing explainability field)
- Given API response thieu 1 trong 3 truong bat buoc
- When card render
- Then hien thi fallback insufficient explainability
- Expected: app khong crash, event recommendation_explainability_insufficient duoc ghi

TC-06-04 (List performance)
- Given dashboard co >=20 recommendations
- When cuon danh sach
- Then card explainability khong gay lag ro rang
- Expected: interaction van muot, khong freeze UI

### S24-07 - Data freshness badge

TC-07-01 (Realtime state)
- Given feed dang cap nhat lien tuc
- When dashboard open
- Then badge hien thi Realtime va age < stale threshold
- Expected: timestamp cap nhat dung theo feed

TC-07-02 (Stale state)
- Given feed khong update qua stale threshold
- When dashboard render
- Then badge hien thi Delayed + last update timestamp
- Expected: stale copy de hieu, user nhan biet ro

TC-07-03 (Fallback mode)
- Given he thong chuyen websocket -> polling fallback
- When status doi
- Then badge cap nhat mode dung va khong flicker
- Expected: khong co nhay UI bat thuong

TC-07-04 (Clock skew tolerance)
- Given browser clock lech nhe
- When tinh age
- Then age khong am va khong hien thi gia tri vo ly
- Expected: format an toan

### S24-08 - Action checklist pre-decision

TC-08-01 (Checklist visible)
- Given user bat dau hanh dong tu recommendation
- When mo panel action
- Then checklist 3-5 items hien thi truoc nut confirm
- Expected: item text ro rang, de tick

TC-08-02 (Block when incomplete)
- Given con item chua hoan tat
- When user bam confirm
- Then action bi block
- Expected: thong bao item con thieu va huong dan tiep

TC-08-03 (Allow when complete)
- Given user da hoan tat checklist
- When user confirm
- Then action duoc tiep tuc
- Expected: event recommendation_action_checklist_completed duoc ghi

TC-08-04 (State reset rule)
- Given user dong panel roi mo lai
- When quay lai panel action
- Then state checklist theo rule da dinh nghia (reset hoac retain)
- Expected: hanh vi nhat quan theo spec

### S24-09 - User risk mode control

TC-09-01 (Mode switch)
- Given user dang o Balanced
- When chuyen sang Defensive hoac Growth
- Then recommendation list update theo mode
- Expected: hien thong bao view updated by risk mode

TC-09-02 (Persistence)
- Given user doi mode va reload trang
- When app khoi dong lai
- Then mode cu duoc restore dung
- Expected: khong ve default sai

TC-09-03 (Cross-session)
- Given user dang nhap lai trong cung trinh duyet
- When vao dashboard
- Then mode van dung theo preference luu tru
- Expected: khong mat setting

TC-09-04 (Invalid stored value)
- Given local storage/server preference bi gia tri loi
- When app load
- Then fallback mode an toan va khong crash
- Expected: co warning log noi bo

### S24-10 - Recommendation history mini

TC-10-01 (Render history list)
- Given co du lieu ket qua T+1/T+3/T+5
- When mo history mini
- Then hien toi da 5 records moi nhat
- Expected: thu tu dung theo thoi gian

TC-10-02 (Empty state)
- Given khong co du lieu history
- When render widget
- Then hien empty state de hieu
- Expected: khong vo bo cuc

TC-10-03 (Gain/loss color policy)
- Given record co ket qua am/duong
- When render
- Then label/mau theo policy
- Expected: khong nham sign

TC-10-04 (Data consistency)
- Given cung 1 recommendation ID
- When so voi detail panel
- Then ket qua T+1/T+3/T+5 phai khop
- Expected: khong mismatch giua widget va detail

## 4) Telemetry verification checklist
1. recommendation_explainability_opened
2. recommendation_explainability_insufficient
3. recommendation_risk_mode_changed
4. recommendation_action_checklist_completed
5. recommendation_action_attempt_blocked
6. recommendation_history_opened

Pass criteria telemetry:
- Moi event co timestamp + user/session context + recommendation ID (neu co).
- Khong co event duplicate bat thuong trong 1 user action.

## 5) Exit criteria for QA sign-off
1. 100% test case critical (TC-06-01, TC-07-02, TC-08-02, TC-09-02, TC-10-01) PASS.
2. Khong con bug Severity 1/2 mo lien quan trust flow.
3. Telemetry check pass cho toan bo event trust.
4. PM + QA dong y go/no-go cho release gate.

## 6) Bug triage labels de su dung
- S24-TRUST-EXPLAINABILITY
- S24-TRUST-FRESHNESS
- S24-TRUST-CHECKLIST
- S24-TRUST-RISKMODE
- S24-TRUST-HISTORY
- S24-TRUST-TELEMETRY
