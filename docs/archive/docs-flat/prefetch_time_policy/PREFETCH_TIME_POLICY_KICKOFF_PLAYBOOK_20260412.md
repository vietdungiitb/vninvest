# PREFETCH TIME POLICY - KICKOFF PLAYBOOK (2026-04-12)

## Muc tieu

Chuan hoa ngay khoi dong sprint de tat ca owner bat dau dung huong, dung scope va co dau ra ngay trong 24h dau.

---

## T-1 (truoc kickoff 1 ngay)

### PM / Tech Lead
- Chot owner cho PR-1..PR-6.
- Chot ngay freeze cho canary gate.
- Xac nhan kenh thong tin chung (chat channel + incident channel).

### BE Lead
- Xac nhan strategy fallback policy an toan.
- Chot naming metric va nguong canh bao baseline.

### FE Lead
- Chot wireframe field grouping cho AdminOps policy section.
- Chot i18n naming convention cho key moi.

### QA Lead
- Chuan bi test matrix cho moc gio pre_open/post_close/weekend.
- Chot owner manual QA va evidence format.

---

## Ngay 1 Kickoff Agenda (60 phut)

1. 10 phut: Muc tieu sprint va success criteria.
2. 15 phut: Di qua dependency map PR-1..PR-6.
3. 15 phut: Chot KPI baseline va nguong rollback.
4. 10 phut: Chot quy uoc cap nhat tracker va release gates.
5. 10 phut: Q&A va lock scope.

Output bat buoc sau kickoff:
- Owner tung PR da confirm.
- Due date tung PR da confirm.
- Risk top 3 da co owner theo doi.

---

## Day-1 Deliverables bat buoc

### PR-1 Owner (BE-1)
- Tao branch va mo draft PR-1.
- Commit bo khung schema + validator ban dau.
- Up test skeleton cho GET/PUT settings.

### PR-2 Owner (BE-2)
- Chot bang quy tac resolver profile theo moc gio.
- Draft test cases boundary time.

### PR-4 Owner (FE-1)
- Tao khung UI section tren AdminOps.
- Gan du lieu mock local de validate layout.

### QA-1
- Tao file checklist manual test scenario.
- Chot evidence format screenshot/log.

---

## Definition of Ready cho tung PR

### PR-1 DoR
- Co payload schema da thong nhat.
- Co rulebook field-level constraints.

### PR-2 DoR
- Co bang map profile theo khung gio.
- Co timezone handling rule ro rang.

### PR-3 DoR
- Co metric names final.
- Co logic clamp max interval duoc thong nhat.

### PR-4 DoR
- Co field list va i18n key list.
- Co responsive constraints.

### PR-5 DoR
- Co validation rule list tu backend rulebook.
- Co error mapping strategy.

### PR-6 DoR
- Co test matrix final.
- Co release gates file va sign-off flow.

---

## Daily standup format (9:15)

Moi owner cap nhat 4 dong:
1. Da xong gi hom qua.
2. Hom nay lam gi.
3. Blocker hien tai.
4. Ho tro can team.

Neu blocker > 24h:
- Nang cap len Tech Lead trong ngay.

---

## Escalation rule

- Blocker technical > 4h: ping BE/FE Lead.
- Blocker cross-team > 24h: tao decision item trong tracker.
- Risk KPI canary: escalated ngay cho PM + Tech Lead + SRE.

---

## End-of-day checklist (Ngay 1)

- [ ] PR-1 da co draft + checklist.
- [ ] PR-2 da co resolver test table.
- [ ] PR-4 da co UI khung + i18n skeleton.
- [ ] QA da co matrix + owner + evidence format.
- [ ] Tracker da duoc cap nhat day du.

---

## Lien ket nhanh

- Master index: docs/PREFETCH_TIME_POLICY_MASTER_INDEX_20260412.md
- Execution board: docs/PREFETCH_TIME_POLICY_EXECUTION_BOARD_20260412.md
- Task tracker: docs/PREFETCH_TIME_POLICY_TASK_TRACKER_20260412.md
- Release gates: docs/PREFETCH_TIME_POLICY_RELEASE_GATES_20260412.md
