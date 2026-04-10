# Sprint 33 Live Evidence Template

Date: 2026-04-10
Release window:
Environment: staging / production
Release commander:

## 1) Deploy metadata

- Branch:
- Commit SHA:
- Deployer:
- Start time:
- End time:

## 2) Service status evidence

Command:
- `docker compose ps`

Paste output:

```

```

Result:
- [ ] PASS
- [ ] FAIL

Notes:

## 3) Django deploy checks evidence

Commands:
- `docker compose exec backend python manage.py migrate --noinput`
- `docker compose exec backend python manage.py collectstatic --noinput`
- `docker compose exec backend python manage.py check --deploy`

Paste key output:

```

```

Result:
- [ ] PASS
- [ ] FAIL

Notes:

## 4) Auth smoke evidence

### A1 Invalid credentials
- Status: [ ] PASS [ ] FAIL
- Screenshot/link:
- Observed message:

### A2 Unverified email guidance
- Status: [ ] PASS [ ] FAIL
- Screenshot/link:
- Observed message:

### A3 Resend verification flow
- Status: [ ] PASS [ ] FAIL
- Screenshot/link:
- Observed message:

## 5) UserConfig smoke evidence

### U1 Route accessibility
- Status: [ ] PASS [ ] FAIL
- Screenshot/link:

### U2/U3 Persistence (language/theme)
- Status: [ ] PASS [ ] FAIL
- Recording/link:

### U5 Event-based toggle persistence
- Status: [ ] PASS [ ] FAIL
- API snapshot/link:

## 6) Advisory governance evidence

### G1/G2/G3 Toggle OFF blocks enqueue
- Status: [ ] PASS [ ] FAIL
- Worker log snippet:

```

```

### G4 Toggle ON allows enqueue
- Status: [ ] PASS [ ] FAIL
- Worker log snippet:

```

```

### G5/G6 Manual and periodic behavior
- Status: [ ] PASS [ ] FAIL
- UI/API snapshot:

## 7) Console and i18n evidence

### I1-I3 labels and key rendering
- Status: [ ] PASS [ ] FAIL
- Screenshot/link:

### I4 browser console sanity
- Status: [ ] PASS [ ] FAIL
- Console capture/link:

## 8) Incident and rollback notes

- Any incident during release:
- Rollback triggered: [ ] Yes [ ] No
- If Yes, rollback start time:
- If Yes, rollback end time:
- Recovery notes:

## 9) Final sign-off

- FE sign-off: [ ] PASS / [ ] HOLD - Name:
- BE sign-off: [ ] PASS / [ ] HOLD - Name:
- QA sign-off: [ ] PASS / [ ] HOLD - Name:
- PM sign-off: [ ] PASS / [ ] HOLD - Name:

Final decision:
- [ ] GO LIVE
- [ ] HOLD RELEASE

Decision time:
